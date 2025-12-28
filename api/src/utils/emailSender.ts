import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { Lead as LeadRow } from '../types/index.js';

// Load .env from project root (3 levels up from api/src/utils)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });

interface EventForEmail {
  name: string;
  organizationName?: string;
  rawData?: Record<string, any>;
  eventHistory?: string;
}

interface ContactInfo {
  email: string | null;
  name: string | null;
  organization: string | null;
}

export interface EmailFailure {
  eventName: string;
  email?: string;
  error: string;
  leadId?: string; // Add leadId to track which lead failed
  subject?: string; // Add subject to log failed emails
}

export interface EmailSendResult {
  attempted: number;
  sent: number;
  failures: EmailFailure[];
  skipped?: boolean;
  message?: string;
  successIds?: string[];
  missingContactIds?: string[];
  sentEmails?: Array<{ leadId: string; subject: string; messageId?: string }>; // Track sent emails with subjects and message IDs
}

let cachedTransporter: nodemailer.Transporter | null = null;
let transporterInitError: string | null = null;

const emailHost = process.env.EMAIL_HOST;
const emailPort = Number(process.env.EMAIL_PORT || 587);
const emailUser = process.env.EMAIL_HOST_USER;
const emailPassword = process.env.EMAIL_HOST_PASSWORD;
const defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || emailUser || '';

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!emailHost || !emailUser || !emailPassword) {
    transporterInitError =
      'Email credentials are not fully configured. Please set EMAIL_HOST, EMAIL_HOST_USER, and EMAIL_HOST_PASSWORD.';
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });

  return cachedTransporter;
}

function extractFirstMatchingValue(rawData: Record<string, any> | undefined, keywords: string[]): string | null {
  if (!rawData) return null;

  for (const [key, value] of Object.entries(rawData)) {
    const normalizedKey = key.toLowerCase();
    if (!keywords.some((keyword) => normalizedKey.includes(keyword))) {
      continue;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const firstString = value.find((item) => typeof item === 'string' && item.trim().length > 0);
      if (firstString) {
        return firstString.trim();
      }
    }
  }

  return null;
}

function extractContactInfo(event: EventForEmail): ContactInfo {
  const rawData = event.rawData || {};

  const emailCandidate = extractFirstMatchingValue(rawData, ['email', 'mail']);
  let email: string | null = null;
  if (emailCandidate) {
    const emailMatch = emailCandidate.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) {
      email = emailMatch[0];
    }
  }

  const nameCandidate = extractFirstMatchingValue(rawData, [
    'contact',
    'key person',
    'person',
    'chair',
    'president',
    'secretary',
    'delegate',
    'name',
  ]);

  let contactName = nameCandidate;
  if (contactName && contactName.toLowerCase() === contactName) {
    contactName = contactName.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  const organizationCandidate =
    event.organizationName ||
    extractFirstMatchingValue(rawData, ['organization', 'organisation', 'association', 'company', 'host']);

  return {
    email,
    name: contactName || null,
    organization: organizationCandidate || null,
  };
}

function buildEmailBody(event: EventForEmail, contact: ContactInfo): { subject: string; text: string; html: string } {
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
    defaultFromEmail || 'marketing@furamavietnam.com',
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

function buildLeadContactInfo(lead: LeadRow): ContactInfo {
  const primaryEmail = (lead.key_person_email || '').trim();
  const secondaryEmail = (lead.secondary_person_email || '').trim();
  const email = primaryEmail || secondaryEmail || '';

  const contactName = (lead.key_person_name || lead.secondary_person_name || '').trim();
  const organization = lead.company_name;

  return {
    email: email || null,
    name: contactName || null,
    organization,
  };
}

function buildLeadEmailBody(lead: LeadRow, contact: ContactInfo): { subject: string; text: string; html: string } {
  const salutation = contact.name ? `Dear ${contact.name},` : 'Dear Event Organizer,';
  const location = [lead.city, lead.country].filter(Boolean).join(', ');
  const industryLine = lead.industry ? `As a key organization in the ${lead.industry} sector,` : 'As a leading international association,';
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
    defaultFromEmail || 'marketing@furamavietnam.com',
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

export async function sendEventEmails(events: EventForEmail[]): Promise<EmailSendResult> {
  const result: EmailSendResult = {
    attempted: 0,
    sent: 0,
    failures: [],
  };

  if (!events || events.length === 0) {
    result.message = 'No events supplied for email dispatch.';
    return result;
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      attempted: 0,
      sent: 0,
      failures: [],
      skipped: true,
      message: transporterInitError ?? 'Email transport could not be initialized.',
    };
  }

  const recipients = new Map<
    string,
    {
      event: EventForEmail;
      contact: ContactInfo;
    }
  >();

  events.forEach((event) => {
    const contact = extractContactInfo(event);
    if (!contact.email) {
      return;
    }

    if (!recipients.has(contact.email.toLowerCase())) {
      recipients.set(contact.email.toLowerCase(), { event, contact });
    }
  });

  result.attempted = recipients.size;

  if (recipients.size === 0) {
    result.message = 'No contact emails were detected in the imported events.';
    return result;
  }

  for (const [email, { event, contact }] of recipients) {
    try {
      const { subject, text, html } = buildEmailBody(event, contact);
      await transporter.sendMail({
        from: defaultFromEmail
          ? `"Ariyana Convention Centre" <${defaultFromEmail}>`
          : '"Ariyana Convention Centre" <marketing@furamavietnam.com>',
        to: email,
        replyTo: defaultFromEmail || undefined,
        subject,
        text,
        html,
      });
      result.sent += 1;
    } catch (error: any) {
      result.failures.push({
        eventName: event.name,
        email,
        error: error?.message || 'Unknown SMTP error',
      });
    }
  }

  if (result.sent === 0 && result.failures.length > 0) {
    result.message = 'All automatic email attempts failed. Please review the failures list.';
  }

  return result;
}

export async function sendLeadEmails(leads: LeadRow[]): Promise<EmailSendResult> {
  const summary: EmailSendResult = {
    attempted: 0,
    sent: 0,
    failures: [],
    successIds: [],
    missingContactIds: [],
    sentEmails: [],
  };

  if (!leads || leads.length === 0) {
    summary.message = 'No leads supplied for email dispatch.';
    return summary;
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      attempted: 0,
      sent: 0,
      failures: [],
      skipped: true,
      message: transporterInitError ?? 'Email transport could not be initialized.',
    };
  }

  for (const lead of leads) {
    const contact = buildLeadContactInfo(lead);

    if (!contact.email) {
      summary.failures.push({
        eventName: lead.company_name,
        error: 'No contact email available for this lead.',
        leadId: lead.id,
      });
      summary.missingContactIds?.push(lead.id);
      continue;
    }

    summary.attempted += 1;

    try {
      const { subject, text, html } = buildLeadEmailBody(lead, contact);
      const info = await transporter.sendMail({
        from: defaultFromEmail
          ? `"Ariyana Convention Centre" <${defaultFromEmail}>`
          : '"Ariyana Convention Centre" <marketing@furamavietnam.com>',
        to: contact.email,
        replyTo: defaultFromEmail || undefined,
        subject,
        text,
        html,
      });
      summary.sent += 1;
      summary.successIds?.push(lead.id);
      summary.sentEmails?.push({ 
        leadId: lead.id, 
        subject,
        messageId: info.messageId || undefined
      });
    } catch (error: any) {
      const { subject } = buildLeadEmailBody(lead, contact);
      summary.failures.push({
        eventName: lead.company_name,
        email: contact.email,
        error: error?.message || 'Unknown SMTP error',
        leadId: lead.id,
        subject: subject,
      });
    }
  }

  if (summary.sent === 0 && summary.failures.length > 0) {
    summary.message = 'Email campaign completed with no successful deliveries. Check failures for details.';
  } else if (summary.sent > 0 && summary.failures.length === 0) {
    summary.message = 'All selected leads were contacted successfully.';
  } else if (summary.sent > 0 && summary.failures.length > 0) {
    summary.message = 'Email campaign completed with partial success. Review failures for leads that need attention.';
  }

  return summary;
}

export interface CustomEmailContent {
  leadId: string;
  subject: string;
  body: string; // HTML body
}

export async function sendLeadEmailsWithCustomContent(
  leads: LeadRow[],
  customEmails: CustomEmailContent[]
): Promise<EmailSendResult> {
  const summary: EmailSendResult = {
    attempted: 0,
    sent: 0,
    failures: [],
    successIds: [],
    missingContactIds: [],
    sentEmails: [],
  };

  if (!leads || leads.length === 0) {
    summary.message = 'No leads supplied for email dispatch.';
    return summary;
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      attempted: 0,
      sent: 0,
      failures: [],
      skipped: true,
      message: transporterInitError ?? 'Email transport could not be initialized.',
    };
  }

  // Create a map of leadId to custom email content
  const emailMap = new Map<string, CustomEmailContent>();
  customEmails.forEach(email => {
    emailMap.set(email.leadId, email);
  });

  for (const lead of leads) {
    const contact = buildLeadContactInfo(lead);

    if (!contact.email) {
      summary.failures.push({
        eventName: lead.company_name,
        error: 'No contact email available for this lead.',
        leadId: lead.id,
      });
      summary.missingContactIds?.push(lead.id);
      continue;
    }

    const customEmail = emailMap.get(lead.id);
    if (!customEmail) {
      summary.failures.push({
        eventName: lead.company_name,
        error: 'No custom email content provided for this lead.',
        leadId: lead.id,
      });
      continue;
    }

    summary.attempted += 1;

    try {
      // Convert HTML body to text for plain text version
      const textBody = customEmail.body
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      const info = await transporter.sendMail({
        from: defaultFromEmail
          ? `"Ariyana Convention Centre" <${defaultFromEmail}>`
          : '"Ariyana Convention Centre" <marketing@furamavietnam.com>',
        to: contact.email,
        replyTo: defaultFromEmail || undefined,
        subject: customEmail.subject,
        text: textBody,
        html: customEmail.body,
      });
      summary.sent += 1;
      summary.successIds?.push(lead.id);
      summary.sentEmails?.push({ 
        leadId: lead.id, 
        subject: customEmail.subject,
        messageId: info.messageId || undefined
      });
    } catch (error: any) {
      summary.failures.push({
        eventName: lead.company_name,
        email: contact.email,
        error: error?.message || 'Unknown SMTP error',
        leadId: lead.id,
        subject: customEmail.subject,
      });
    }
  }

  if (summary.sent === 0 && summary.failures.length > 0) {
    summary.message = 'Email campaign completed with no successful deliveries. Check failures for details.';
  } else if (summary.sent > 0 && summary.failures.length === 0) {
    summary.message = 'All selected leads were contacted successfully.';
  } else if (summary.sent > 0 && summary.failures.length > 0) {
    summary.message = 'Email campaign completed with partial success. Review failures for leads that need attention.';
  }

  return summary;
}