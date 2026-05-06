import { query } from '../../config/database.js';
import type { Lead } from '../../types/index.js';

/**
 * Loads ICCA leads knowledge base text used as context for AI prompts.
 * Moved verbatim from api/src/routes/{gemini,gpt}.ts.
 *
 * No tests in this commit — this function reads from the database, which is
 * real I/O. Tests belong to sub-project #5 (layer-ization) where the data
 * source can be properly abstracted behind an interface.
 */
export const getICCALeadsKnowledge = async (): Promise<string> => {
  try {
    // Get all leads from database
    const result = await query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 500', []);
    const leads: Lead[] = result.rows;

    if (leads.length === 0) {
      return 'No ICCA Leads data available in the database yet.';
    }

    // Group leads by industry and country for better organization
    const byIndustry: Record<string, Lead[]> = {};
    const byCountry: Record<string, Lead[]> = {};
    const highPriorityLeads: Lead[] = [];
    const vietnamLeads: Lead[] = [];

    leads.forEach((lead) => {
      // Group by industry
      const industry = lead.industry || 'Unknown';
      if (!byIndustry[industry]) byIndustry[industry] = [];
      byIndustry[industry].push(lead);

      // Group by country
      const country = lead.country || 'Unknown';
      if (!byCountry[country]) byCountry[country] = [];
      byCountry[country].push(lead);

      // High priority: has Vietnam events or high delegate count
      if (
        lead.vietnam_events > 0 ||
        (lead.number_of_delegates && lead.number_of_delegates >= 300)
      ) {
        highPriorityLeads.push(lead);
      }

      // Vietnam-related leads
      if (lead.vietnam_events > 0) {
        vietnamLeads.push(lead);
      }
    });

    // Build knowledge base text
    let knowledge = `\n=== ICCA LEADS KNOWLEDGE BASE ===\n\n`;
    knowledge += `Total Leads in Database: ${leads.length}\n`;
    knowledge += `High Priority Leads (Vietnam events or 300+ delegates): ${highPriorityLeads.length}\n`;
    knowledge += `Leads with Vietnam Event History: ${vietnamLeads.length}\n\n`;

    // Industry breakdown
    knowledge += `Industry Distribution:\n`;
    Object.entries(byIndustry)
      .slice(0, 10)
      .forEach(([industry, industryLeads]) => {
        knowledge += `- ${industry}: ${industryLeads.length} leads\n`;
      });
    knowledge += `\n`;

    // Country breakdown
    knowledge += `Top Countries:\n`;
    Object.entries(byCountry)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([country, countryLeads]) => {
        knowledge += `- ${country}: ${countryLeads.length} leads\n`;
      });
    knowledge += `\n`;

    // High priority leads summary
    if (highPriorityLeads.length > 0) {
      knowledge += `High Priority Leads (Top 20):\n`;
      highPriorityLeads.slice(0, 20).forEach((lead, idx) => {
        knowledge += `${idx + 1}. ${lead.company_name} (${lead.industry || 'N/A'}, ${lead.country || 'N/A'})`;
        if (lead.vietnam_events > 0) knowledge += ` - ${lead.vietnam_events} Vietnam event(s)`;
        if (lead.number_of_delegates) knowledge += ` - ${lead.number_of_delegates} delegates`;
        if (lead.key_person_name) knowledge += ` - Contact: ${lead.key_person_name}`;
        knowledge += `\n`;
      });
      knowledge += `\n`;
    }

    // Vietnam leads details
    if (vietnamLeads.length > 0) {
      knowledge += `Leads with Vietnam Event History (Top 15):\n`;
      vietnamLeads.slice(0, 15).forEach((lead, idx) => {
        knowledge += `${idx + 1}. ${lead.company_name}`;
        knowledge += ` - ${lead.vietnam_events} Vietnam event(s)`;
        if (lead.past_events_history)
          knowledge += ` - History: ${lead.past_events_history.substring(0, 100)}`;
        if (lead.key_person_email) knowledge += ` - Email: ${lead.key_person_email}`;
        knowledge += `\n`;
      });
      knowledge += `\n`;
    }

    // Key patterns and insights
    knowledge += `Key Patterns:\n`;
    const avgDelegates =
      leads
        .filter((l) => l.number_of_delegates)
        .reduce((sum, l) => sum + (l.number_of_delegates || 0), 0) /
        leads.filter((l) => l.number_of_delegates).length || 0;
    if (avgDelegates > 0) {
      knowledge += `- Average delegate count: ${Math.round(avgDelegates)}\n`;
    }
    const totalVietnamEvents = leads.reduce((sum, l) => sum + l.vietnam_events, 0);
    knowledge += `- Total Vietnam events across all leads: ${totalVietnamEvents}\n`;
    const leadsWithEmail = leads.filter((l) => l.key_person_email).length;
    knowledge += `- Leads with contact email: ${leadsWithEmail} (${Math.round((leadsWithEmail / leads.length) * 100)}%)\n`;
    knowledge += `\n`;

    knowledge += `=== END OF ICCA LEADS KNOWLEDGE BASE ===\n\n`;
    knowledge += `IMPORTANT: When answering questions about leads, organizations, or market analysis, use this knowledge base to provide accurate, data-driven insights. Reference specific leads, industries, or patterns from this data when relevant.\n`;

    return knowledge;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error loading ICCA Leads knowledge:', error);
    return 'ICCA Leads data is currently unavailable. Please try again later.';
  }
};
