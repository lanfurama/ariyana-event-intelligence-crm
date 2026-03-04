import { EMAIL_CONFIG } from './config.js';
import type { EventForEmail, ContactInfo, LeadRow } from './types.js';

// ============================================================================
// Email Content Builders
// ============================================================================

export class EmailContentBuilder {
  /**
   * Build email body for events
   */
  static buildEventEmail(event: EventForEmail, contact: ContactInfo): { subject: string; text: string; html: string } {
    const salutation = contact.name ? `Dear ${contact.name},` : 'Dear Event Organizer,';
    const organization = contact.organization || event.name;

    const historySnippet = event.eventHistory
      ? `We noticed previous editions such as ${event.eventHistory.split(';').slice(0, 2).join('; ')}. `
      : '';

    const textBody = [
      salutation,
      '',
      'Greetings from Ariyana Convention Centre Danang - the award-winning venue that proudly hosted APEC 2017.',
      '',
      `We recently reviewed the ${event.name} series and believe Danang would be an exceptional destination for your upcoming edition. ${historySnippet}Our world-class facilities, experienced team, and vibrant city make for a compelling experience for international delegates.`,
      '',
      `We would be honored to schedule a short call to explore how Ariyana Convention Centre can support ${organization}.`,
      '',
      'Warm regards,',
      'Ariyana Convention Centre Danang',
      EMAIL_CONFIG.FROM_EMAIL || EMAIL_CONFIG.DEFAULT_FROM,
    ].join('\n');

    const htmlBody = textBody
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    return {
      subject: `Invitation to host ${event.name} in Danang, Vietnam`,
      text: textBody,
      html: htmlBody,
    };
  }

  /**
   * Build email body for leads (legacy - not used with templates)
   */
  static buildLeadEmail(lead: LeadRow, contact: ContactInfo): { subject: string; text: string; html: string } {
    const salutation = contact.name ? `Dear ${contact.name},` : 'Dear Event Organizer,';
    const location = [lead.city, lead.country].filter(Boolean).join(', ');
    const industryLine = lead.industry
      ? `As a key organization in the ${lead.industry} sector,`
      : 'As a leading international association,';
    const historyLine = lead.past_events_history
      ? `We have reviewed your past events (${lead.past_events_history}) and believe Danang offers a compelling rotation option in Asia.`
      : 'We believe Danang offers a compelling rotation option in Asia for your future meetings.';
    const delegatesLine = lead.number_of_delegates
      ? `Our convention centre can comfortably host ${lead.number_of_delegates}+ delegates with premium meeting facilities, breakout rooms, and exhibition space.`
      : 'Our convention centre offers premium meeting facilities, breakout rooms, and exhibition space tailored for international congresses.';

    const textBody = [
      salutation,
      '',
      `${industryLine} we would like to invite ${lead.company_name} to consider Danang, Vietnam for an upcoming edition.`,
      '',
      historyLine,
      delegatesLine,
      location ? `We understand your community engages stakeholders across ${location} and would love to partner with you on a future edition.` : '',
      '',
      'Ariyana Convention Centre Danang is the award-winning venue that proudly hosted APEC 2017. Our experienced international team is ready to support your bidding process and tailor a proposal to your requirements.',
      '',
      'May we arrange a short call to discuss how we can support your next event in Vietnam?',
      '',
      'Warm regards,',
      'Sales & Marketing Team',
      'Ariyana Convention Centre Danang',
      EMAIL_CONFIG.FROM_EMAIL || EMAIL_CONFIG.DEFAULT_FROM,
    ]
      .filter(Boolean)
      .join('\n');

    const htmlBody = textBody
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    return {
      subject: `Invitation for ${lead.company_name} to host in Danang, Vietnam`,
      text: textBody,
      html: htmlBody,
    };
  }
}
