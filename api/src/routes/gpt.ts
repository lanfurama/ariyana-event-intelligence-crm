import { Router, Request, Response } from 'express';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { query } from '../config/database.js';
import { Lead } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const router = Router();

// Helper to get OpenAI client
const getAiClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }
  return new OpenAI({ apiKey });
};

// Helper: Load ICCA Leads data from database and format as knowledge base
const getICCALeadsKnowledge = async (): Promise<string> => {
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

    leads.forEach(lead => {
      // Group by industry
      const industry = lead.industry || 'Unknown';
      if (!byIndustry[industry]) byIndustry[industry] = [];
      byIndustry[industry].push(lead);

      // Group by country
      const country = lead.country || 'Unknown';
      if (!byCountry[country]) byCountry[country] = [];
      byCountry[country].push(lead);

      // High priority: has Vietnam events or high delegate count
      if (lead.vietnam_events > 0 || (lead.number_of_delegates && lead.number_of_delegates >= 300)) {
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
    Object.entries(byIndustry).slice(0, 10).forEach(([industry, industryLeads]) => {
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
        if (lead.past_events_history) knowledge += ` - History: ${lead.past_events_history.substring(0, 100)}`;
        if (lead.key_person_email) knowledge += ` - Email: ${lead.key_person_email}`;
        knowledge += `\n`;
      });
      knowledge += `\n`;
    }

    // Key patterns and insights
    knowledge += `Key Patterns:\n`;
    const avgDelegates = leads
      .filter(l => l.number_of_delegates)
      .reduce((sum, l) => sum + (l.number_of_delegates || 0), 0) / 
      leads.filter(l => l.number_of_delegates).length || 0;
    if (avgDelegates > 0) {
      knowledge += `- Average delegate count: ${Math.round(avgDelegates)}\n`;
    }
    const totalVietnamEvents = leads.reduce((sum, l) => sum + l.vietnam_events, 0);
    knowledge += `- Total Vietnam events across all leads: ${totalVietnamEvents}\n`;
    const leadsWithEmail = leads.filter(l => l.key_person_email).length;
    knowledge += `- Leads with contact email: ${leadsWithEmail} (${Math.round(leadsWithEmail / leads.length * 100)}%)\n`;
    knowledge += `\n`;

    knowledge += `=== END OF ICCA LEADS KNOWLEDGE BASE ===\n\n`;
    knowledge += `IMPORTANT: When answering questions about leads, organizations, or market analysis, use this knowledge base to provide accurate, data-driven insights. Reference specific leads, industries, or patterns from this data when relevant.\n`;

    return knowledge;
  } catch (error: any) {
    console.error('Error loading ICCA Leads knowledge:', error);
    return 'ICCA Leads data is currently unavailable. Please try again later.';
  }
};

// Helper: Extract retry delay from rate limit error
const extractRetryDelay = (error: any): number | null => {
  try {
    if (error.status === 429) {
      // Check for retry-after header
      if (error.headers?.['retry-after']) {
        return parseInt(error.headers['retry-after']);
      }
      // Default retry after 60 seconds
      return 60;
    }
  } catch (e) {
    console.error('Error parsing retry delay:', e);
  }
  return null;
};

// POST /api/gpt/extract-organizations - Extract organization names using GPT-4o mini with Research Tools
router.post('/extract-organizations', async (req: Request, res: Response) => {
  try {
    const { data, summary } = req.body;

    if (!data || data.trim() === '') {
      return res.status(400).json({ error: 'Data is required' });
    }

    const openai = getAiClient();

    const systemPrompt = `Extract organization names only. Not events, venues, or contacts. One per org.`;

    const userPrompt = `Extract organizations from: ${data}${summary ? `\nSummary: ${JSON.stringify(summary)}` : ''}

Return: {"organizations": [{"name": "Org Name", "rowIndex": 1, "sourceField": "Field"}]}`;

    console.log('🟢 [GPT API] Extract organizations request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for maximum accuracy - no hallucination
      // Note: GPT-4o mini supports function calling but doesn't have built-in web search
      // For production, integrate with web search API (Tavily, Serper, etc.) for research capabilities
      // The model will use its extensive training data knowledge
    });

    let result;
    try {
      const content = response.choices[0]?.message?.content || '{}';
      result = JSON.parse(content);
    } catch (e) {
      console.error('JSON Parse Error in extract-organizations:', e);
      result = { organizations: [] };
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error in extract-organizations:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Failed to extract organizations',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// POST /api/gpt/strategic-analysis - Strategic analysis using GPT-4o mini with Research Tools
router.post('/strategic-analysis', async (req: Request, res: Response) => {
  try {
    const { leadsData } = req.body;

    if (!leadsData || leadsData.trim() === '') {
      return res.status(400).json({ error: 'Leads data is required' });
    }

    const openai = getAiClient();

    const prompt = `Evaluate event for Ariyana Convention Centre Danang. Use EXACT event name from data as companyName.

Data: ${leadsData}

Scoring: History(0-25: VN=25, SEA=15), Region(0-25: ASEAN/Asia=25, Asian=15), Contact(0-25: email+phone=25, email=15), Delegates(0-25: >=500=25, >=300=20, >=100=10).

Output: Brief summary, scoring breakdown, next steps, then JSON array:
[{
  "companyName": "EXACT event name from data",
  "industry", "country", "city", "website", "keyPersonName", "keyPersonTitle", "keyPersonEmail", "keyPersonPhone",
  "vietnamEvents": 0, "totalEvents": 1, "numberOfDelegates": null,
  "totalScore": 0-100, "historyScore": 0-25, "regionScore": 0-25, "contactScore": 0-25, "delegatesScore": 0-25,
  "problems": ["Missing email", "No phone"], "notes": "Brief", "pastEventsHistory": "2023: City, Country",
  "nextStepStrategy": "Action", "status": "New",
  "eventBrief": {
    "eventName", "eventSeries", "industry", "averageAttendance", "openYear", "frequency", "rotationArea", "rotationPattern",
    "duration", "preferredMonths", "preferredVenue", "breakoutRooms", "roomSizes", "infoOnLastUpcomingEvents", "eventHistory",
    "delegatesProfile", "internationalOrganisationName", "internationalOrganisationWebsite", "organizationProfile",
    "localHostName", "localHostTitle", "localHostOrganization", "localHostWebsite", "localStrengths",
    "decisionMaker", "decisionMakingProcess", "keyBidCriteria", "competitors", "competitiveAnalysis", "hostResponsibility",
    "sponsors", "layout", "fitForAriyana", "opportunityScore": 0-100
  }
}]

Research missing fields. Empty string if not found. Only list problems for truly missing fields after research.`;

    console.log('🟢 [GPT API] Strategic analysis request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: 'MICE sales analyst. Evaluate events for Ariyana Convention Centre. Return factual data only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
    });

    // Handle tool calls if any
    let finalResponse = response.choices[0]?.message?.content || '';
    
    // If model requested tool use, we would need to handle it here
    // For now, OpenAI's function calling will be handled by the model internally
    // In production, you might want to implement actual web search integration

    res.json({ text: finalResponse });
  } catch (error: any) {
    console.error('Error in strategic-analysis:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Strategic analysis failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// POST /api/gpt/enrich - Data enrichment using Research Tools
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const { companyName, keyPerson, city } = req.body;

    if (!companyName || companyName.trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const openai = getAiClient();

    const prompt = `Research MICE organization: ${companyName}${keyPerson ? ` | Contact: ${keyPerson}` : ''}${city ? ` | City: ${city}` : ''}

Return JSON with factual data only. Empty string if not found. 

CRITICAL FIELDS (must research):
1. secretaryGeneral, organizingChairman (full names)
2. website, keyPersonEmail, keyPersonPhone, keyPersonName, keyPersonTitle
3. breakoutRooms (e.g., "8-10 rooms"), roomSizes (e.g., "200-300 sqm main hall, 50-80 sqm breakout")
4. sponsors (format: "Diamond: Company1; Gold: Company2; Silver: Company3")
5. layoutEvent (venue layout requirements)
6. conferenceRegistration (website, fees, deadlines)
7. iccaQualified ("yes" or "no" with brief explanation)
8. competitors (competing venues/destinations)
9. localStrengthsWeaknesses (format: "Strengths: [list]. Weaknesses: [list]")

ALL JSON fields required:
website, industry, keyPersonName, keyPersonTitle, keyPersonEmail, keyPersonPhone, openYear, frequency, duration, preferredMonth, rotationPattern, upcomingEvents, delegatesProfile, organizingChairman, secretaryGeneral, sponsors, breakoutRooms, roomSizes, layoutEvent, conferenceRegistration, iccaQualified, decisionMaker, competitors, numberOfDelegates, localStrengthsWeaknesses, researchSummary`;

    console.log('🟢 [GPT API] Data enrichment request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1', // Using GPT-5.1 for better capabilities
      messages: [
        { 
          role: 'system', 
          content: `MICE industry researcher. Find factual data only. Priority: Secretary General, Organizing Chairman, website, email. Return JSON only. Empty string if not found.` 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_completion_tokens: 1500, // Optimized for concise responses
    });

    const content = response.choices[0]?.message?.content || '{}';
    let enrichedData = {};
    
    try {
      enrichedData = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse GPT response as JSON:', e);
      enrichedData = { researchSummary: content };
    }

    res.json({ 
      text: JSON.stringify(enrichedData, null, 2), 
      research: enrichedData 
    });
  } catch (error: any) {
    console.error('Error in enrich:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Data enrichment failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// POST /api/gpt/draft-email - Email drafting
router.post('/draft-email', async (req: Request, res: Response) => {
  try {
    const { leadName, leadCompany, leadTitle, eventContext } = req.body;

    if (!leadName || !leadCompany) {
      return res.status(400).json({ error: 'Lead name and company are required' });
    }

    const openai = getAiClient();

    const prompt = `
Draft a professional sales email for:
- Lead Name: ${leadName}
- Company: ${leadCompany}
- Title: ${leadTitle || 'Not provided'}
- Event Context: ${eventContext || 'Not provided'}

The email should:
1. Be professional and personalized
2. Highlight Ariyana Convention Centre Danang's advantages (hosted APEC 2017, modern facilities, beautiful location)
3. Propose hosting their next conference in Danang (2026-2027)
4. Include a clear call-to-action

Return a JSON object with "subject" and "body" fields.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: 'You are an expert sales email writer specializing in MICE industry outreach.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for accurate, factual email content
    });

    const content = response.choices[0]?.message?.content || '{}';
    const email = JSON.parse(content);

    res.json({ subject: email.subject || '', body: email.body || '' });
  } catch (error: any) {
    console.error('Error in draft-email:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Email drafting failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// POST /api/gpt/chat - Chat assistant
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { history, message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Load ICCA Leads knowledge base
    console.log('📚 [GPT API] Loading ICCA Leads knowledge base...');
    const iccaKnowledge = await getICCALeadsKnowledge();

    // Build enhanced system instruction with ICCA Leads knowledge
    const systemInstruction = `Sales assistant for Ariyana Convention Centre Danang. Use ICCA Leads data for accurate insights.

${iccaKnowledge}

Rules: Reference specific leads/data. Provide stats from knowledge base. Suggest strategies based on patterns. Identify high-potential leads (Vietnam history, delegates, industry). Be data-driven and specific.`;

    const openai = getAiClient();

    const messages: any[] = [
      { role: 'system', content: systemInstruction }
    ];

    // Convert history format if needed
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.role || 'user',
          content: msg.content || msg.text || ''
        });
      });
    }

    messages.push({ role: 'user', content: message });

    console.log('🟢 [GPT API] Chat request with ICCA Leads knowledge base');
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages,
      temperature: 0, // Zero temperature for accurate, factual responses based on knowledge base
    });

    const text = response.choices[0]?.message?.content || '';

    res.json({ text });
  } catch (error: any) {
    console.error('Error in chat:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Chat failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// Research edition-specific leadership (chairman, secretary)
// TEMPORARILY DISABLED: AI Research for Organizing Chairman and Secretary General
router.post('/research-edition', async (req: Request, res: Response) => {
  try {
    const { eventName, edition, year, city, country } = req.body;

    if (!eventName) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    // TEMPORARILY DISABLED: Return empty data without calling GPT API
    res.json({ 
      success: true,
      data: {
        organizingChairman: '',
        secretaryGeneral: '',
        confidence: 'low'
      }
    });

    /* DISABLED AI RESEARCH CODE - Keep for reference
    const prompt = `
Research the specific leadership for this conference edition:

**Event:** ${eventName}
**Edition:** ${edition || 'N/A'}
**Year:** ${year || 'N/A'}
**Location:** ${[city, country].filter(Boolean).join(', ') || 'N/A'}

Find the SPECIFIC leadership for THIS edition only (not general organization leadership):

1. **Organizing Chairman** or **Congress President** for this specific edition
   - Search for: "[Year] [Event] organizing chairman", "congress president"
   - Look for names in conference programs, proceedings, announcements
   
2. **Secretary General** for this specific edition (if different from organization level)
   - Some editions have edition-specific secretaries

**CRITICAL:**
- Return names ONLY if you find specific information for THIS edition
- If information is not available for this specific edition, return empty string
- Do NOT return organization-level leadership unless confirmed for this edition
- Prefer specific names over generic titles

Return JSON:
{
  "organizingChairman": "Full name of organizing chairman for this edition (empty if not found)",
  "secretaryGeneral": "Full name of secretary for this edition (empty if not found)",
  "confidence": "high/medium/low - your confidence in the accuracy"
}
`;

    const openai = getAiClient();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { 
          role: 'system', 
          content: 'You are a research assistant specializing in finding historical conference leadership information. Be conservative - only return names if you have specific information for the requested edition.' 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_completion_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    let researchData = {};
    
    try {
      researchData = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse GPT response:', e);
      researchData = {};
    }

    res.json({ 
      success: true,
      data: researchData 
    });
    */

  } catch (error: any) {
    console.error('Edition research error:', error);
    res.status(500).json({ 
      error: 'Failed to research edition leadership',
      message: error.message 
    });
  }
});

export default router;

