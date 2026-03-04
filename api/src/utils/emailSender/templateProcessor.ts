import type { EmailTemplate, LeadRow } from '../../types/index.js';
import type { EmailTemplateWithAttachments } from './types.js';
import { EmailUtils } from './utils.js';
import { TEMPLATE_VARIABLES } from './config.js';

// ============================================================================
// Template Processing
// ============================================================================

export class TemplateProcessor {
  /**
   * Select appropriate template for a lead based on language and lead_type
   */
  static selectTemplateForLead(
    lead: LeadRow,
    templates: EmailTemplateWithAttachments[]
  ): EmailTemplateWithAttachments | null {
    if (templates.length === 0) return null;

    const leadHasNoType = !lead.type || String(lead.type).trim() === '';
    const templateHasNoType = (t: EmailTemplate) => !t.lead_type || String(t.lead_type).trim() === '';

    const leadLanguage = EmailUtils.getLanguageFromCountry(lead.country);
    const templateHasLanguage = (t: EmailTemplate, lang: string | null) =>
      lang && t.language && t.language.trim().toLowerCase() === lang.toLowerCase();
    const templateHasNoLanguage = (t: EmailTemplate) => !t.language || String(t.language).trim() === '';

    // Priority 1: Match both language and lead_type
    if (leadLanguage && !leadHasNoType) {
      const exactMatch = templates.find(
        (t) => templateHasLanguage(t, leadLanguage) && t.lead_type === lead.type
      );
      if (exactMatch) return exactMatch;
    }

    // Priority 2: Match language only (no lead_type requirement)
    if (leadLanguage) {
      const langMatch = templates.find(
        (t) => templateHasLanguage(t, leadLanguage) && templateHasNoType(t)
      );
      if (langMatch) return langMatch;
    }

    // Priority 3: Match lead_type only (no language requirement)
    if (!leadHasNoType) {
      const typeMatch = templates.find(
        (t) => t.lead_type === lead.type && templateHasNoLanguage(t)
      );
      if (typeMatch) return typeMatch;
    }

    // Priority 4: Default template (no language, no lead_type)
    return templates.find((t) => templateHasNoType(t) && templateHasNoLanguage(t)) ?? null;
  }

  /**
   * Render template with lead data
   */
  static renderTemplate(template: EmailTemplate, lead: LeadRow): { subject: string; body: string } {
    let subject = template.subject;
    let body = template.body;

    const replacements: [RegExp, string][] = [
      [new RegExp(TEMPLATE_VARIABLES.COMPANY_NAME, 'g'), lead.company_name || ''],
      [new RegExp(TEMPLATE_VARIABLES.KEY_PERSON_NAME, 'g'), (lead.key_person_name || lead.secondary_person_name || '')],
      [new RegExp(TEMPLATE_VARIABLES.KEY_PERSON_TITLE, 'g'), (lead.key_person_title || lead.secondary_person_title || '')],
      [new RegExp(TEMPLATE_VARIABLES.CITY, 'g'), lead.city || ''],
      [new RegExp(TEMPLATE_VARIABLES.COUNTRY, 'g'), lead.country || ''],
      [new RegExp(TEMPLATE_VARIABLES.INDUSTRY, 'g'), lead.industry || ''],
    ];

    for (const [re, value] of replacements) {
      subject = subject.replace(re, value);
      body = body.replace(re, value);
    }

    return { subject, body };
  }
}
