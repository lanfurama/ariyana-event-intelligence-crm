import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { Lead as LeadRow, EmailTemplate } from '../types/index.js';
import { EmailTemplateModel } from '../models/EmailTemplateModel.js';

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

export function getTransporter(): nodemailer.Transporter | null {
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
    // No timeout - let it take as long as needed for large attachments
    connectionTimeout: 0,
    greetingTimeout: 0,
    socketTimeout: 0,
    // Increase max messages per connection for better performance
    pool: true,
    maxConnections: 1,
    maxMessages: 3,
  });

  return cachedTransporter;
}

// Helper function to convert attachments to nodemailer format (shared by all email sending functions)
function convertAttachmentsToNodemailerFormat(
  attachments: Array<{ name: string; file_data: string; type?: string }>
): Array<{ filename: string; content: Buffer | string; contentType?: string; encoding?: 'base64' }> {
  return attachments
    .filter(att => {
      if (!att.file_data || att.file_data.trim() === '') {
        console.warn(`[convertAttachments] Skipping attachment "${att.name}" - no file data`);
        return false;
      }
      return true;
    })
    .map(att => {
      // Remove data URL prefix if present (data:image/png;base64,)
      let base64Data = att.file_data.trim();
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      
      // Validate base64 data
      if (!base64Data || base64Data.trim() === '') {
        throw new Error(`Attachment "${att.name}" has invalid base64 data`);
      }
      
      // Use Buffer for better performance with large files
      try {
        const buffer = Buffer.from(base64Data, 'base64');
        console.log(`[convertAttachments] Attachment "${att.name}": ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        return {
          filename: att.name,
          content: buffer,
          contentType: att.type || 'application/octet-stream',
        };
      } catch (bufferError: any) {
        // Fallback to base64 string if Buffer conversion fails
        console.warn(`[convertAttachments] Buffer conversion failed for ${att.name}, using base64 string:`, bufferError.message);
        return {
          filename: att.name,
          content: base64Data,
          encoding: 'base64' as const,
          contentType: att.type || 'application/octet-stream',
        };
      }
    });
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
  const email = (lead.key_person_email || '').trim() || null;

  const contactName = (lead.key_person_name || lead.secondary_person_name || '').trim();
  const organization = lead.company_name;

  return {
    email,
    name: contactName || null,
    organization,
  };
}

function selectTemplateForLead(lead: LeadRow, templates: EmailTemplate[]): EmailTemplate | null {
  if (templates.length === 0) return null;

  const leadHasNoType = lead.type == null || String(lead.type || '').trim() === '';
  const templateHasNoType = (t: EmailTemplate) =>
    t.lead_type == null || String(t.lead_type || '').trim() === '';

  if (leadHasNoType) {
    return templates.find(templateHasNoType) ?? null;
  }

  return templates.find((t) => t.lead_type === lead.type) ?? null;
}

function renderTemplateWithLead(
  template: EmailTemplate,
  lead: LeadRow
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  const replacements: [RegExp, string][] = [
    [/\{\{companyName\}\}/g, lead.company_name || ''],
    [/\{\{keyPersonName\}\}/g, (lead.key_person_name || lead.secondary_person_name || '')],
    [/\{\{keyPersonTitle\}\}/g, (lead.key_person_title || lead.secondary_person_title || '')],
    [/\{\{city\}\}/g, lead.city || ''],
    [/\{\{country\}\}/g, lead.country || ''],
    [/\{\{industry\}\}/g, lead.industry || ''],
  ];

  for (const [re, value] of replacements) {
    subject = subject.replace(re, value);
    body = body.replace(re, value);
  }

  return { subject, body };
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

  const templates = await EmailTemplateModel.getAll();
  // Load attachments for all templates
  const templatesWithAttachments = await Promise.all(
    templates.map(async (template) => {
      const attachments = await EmailTemplateModel.getAttachments(template.id);
      return { ...template, attachments };
    })
  );

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

    const selectedTemplate = selectTemplateForLead(lead, templatesWithAttachments);
    if (!selectedTemplate) {
      summary.failures.push({
        eventName: lead.company_name,
        error: 'No matching email template for this lead type.',
        leadId: lead.id,
      });
      continue;
    }

    summary.attempted += 1;

    const { subject: subj, body: bodyHtml } = renderTemplateWithLead(selectedTemplate, lead);
    const subject = subj;
    
    // Add links to email body if any - simple style like the image
    let html = bodyHtml;
    const links = selectedTemplate.attachments?.filter(att => att.type === 'link') || [];
    if (links.length > 0) {
      const linksHtml = links.map(link => {
        const linkName = link.file_data || link.name;
        const linkUrl = link.name;
        return `
          <div style="margin: 8px 0; padding: 12px 16px; background-color: #f0f0f0; border: 1px solid #d1d5db; border-radius: 6px; display: inline-block; max-width: 100%;">
            <span style="font-size: 18px; margin-right: 8px; vertical-align: middle;">📁</span>
            <a href="${linkUrl}" target="_blank" style="color: #374151; text-decoration: underline; font-size: 14px; vertical-align: middle;">${linkName}</a>
          </div>
        `;
      }).join('');
      html = bodyHtml + '<div style="margin-top: 5px;">' + linksHtml + '</div>';
    }
    
    const text = html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    // Convert file attachments to nodemailer format (exclude links)
    const emailAttachments = selectedTemplate.attachments?.filter(att => att.type !== 'link').map(att => {
      // Remove data URL prefix if present (data:image/png;base64,)
      const base64Data = att.file_data?.includes(',') 
        ? att.file_data.split(',')[1] 
        : att.file_data;
      
      if (!base64Data) return null;
      
      try {
        const buffer = Buffer.from(base64Data, 'base64');
        return {
          filename: att.name,
          content: buffer,
          contentType: att.type || 'application/octet-stream',
        };
      } catch {
        return {
          filename: att.name,
          content: base64Data,
          encoding: 'base64' as const,
          contentType: att.type || 'application/octet-stream',
        };
      }
    }).filter(Boolean) || [];

    try {
      const info = await transporter.sendMail({
        from: defaultFromEmail
          ? `"Ariyana Convention Centre" <${defaultFromEmail}>`
          : '"Ariyana Convention Centre" <marketing@furamavietnam.com>',
        to: contact.email,
        replyTo: defaultFromEmail || undefined,
        subject,
        text,
        html,
        attachments: emailAttachments.length > 0 ? emailAttachments as any[] : undefined,
      });
      summary.sent += 1;
      summary.successIds?.push(lead.id);
      summary.sentEmails?.push({
        leadId: lead.id,
        subject,
        messageId: info.messageId || undefined,
      });
    } catch (error: any) {
      summary.failures.push({
        eventName: lead.company_name,
        email: contact.email,
        error: error?.message || 'Unknown SMTP error',
        leadId: lead.id,
        subject,
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
  cc?: string; // CC email addresses (comma-separated)
  attachments?: Array<{ name: string; file_data: string; type?: string }>;
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

      // Convert attachments to nodemailer format using shared helper function
      const emailAttachments = customEmail.attachments && customEmail.attachments.length > 0
        ? convertAttachmentsToNodemailerFormat(customEmail.attachments)
        : [];

      const ccAddresses = customEmail.cc?.split(',').map(addr => addr.trim()).filter(Boolean) || [];
      
      const totalSize = emailAttachments.length > 0 ? emailAttachments.reduce((sum, att) => {
        const size = Buffer.isBuffer(att.content) ? att.content.length : (att.content as string).length;
        return sum + size;
      }, 0) : 0;
      
      console.log(`[sendLeadEmailsWithCustomContent] Sending email to ${contact.email} with ${emailAttachments.length} attachment(s), total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[sendLeadEmailsWithCustomContent] CustomEmail attachments input:`, customEmail.attachments?.map(a => ({ name: a.name, hasFileData: !!a.file_data, fileDataLength: a.file_data?.length || 0 })) || []);
      if (emailAttachments.length > 0) {
        console.log(`[sendLeadEmailsWithCustomContent] Attachment files:`, emailAttachments.map(a => a.filename));
      } else {
        console.log(`[sendLeadEmailsWithCustomContent] No attachments converted - input attachments:`, customEmail.attachments?.length || 0);
      }
      
      const mailOptions = {
        from: defaultFromEmail
          ? `"Ariyana Convention Centre" <${defaultFromEmail}>`
          : '"Ariyana Convention Centre" <marketing@furamavietnam.com>',
        to: contact.email,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        replyTo: defaultFromEmail || undefined,
        subject: customEmail.subject,
        text: textBody,
        html: customEmail.body,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      };
      
      const info = await transporter.sendMail(mailOptions);
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

export async function sendTestEmail(
  to: string,
  subject: string,
  body: string,
  attachments: Array<{ name: string; file_data: string; type?: string }> = [],
  cc: string[] = []
): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, error: transporterInitError ?? 'Email transport could not be initialized.' };
  }

  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  if (!emailRegex.test(to.trim())) {
    return { success: false, error: 'Invalid email address.' };
  }

  try {
    const textBody = body
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    // Convert attachments to nodemailer format using shared helper function
    const emailAttachments = convertAttachmentsToNodemailerFormat(attachments);

    const totalSize = emailAttachments.reduce((sum, att) => {
      const size = Buffer.isBuffer(att.content) ? att.content.length : (att.content as string).length;
      return sum + size;
    }, 0);
    console.log(`[sendTestEmail] Sending test email to ${to} with ${emailAttachments.length} attachment(s), total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    const mailOptions = {
      from: defaultFromEmail
        ? `"Ariyana Convention Centre" <${defaultFromEmail}>`
        : '"Ariyana Convention Centre" <marketing@furamavietnam.com>',
      to: to.trim(),
      cc: cc.length > 0 ? cc.join(', ') : undefined,
      replyTo: defaultFromEmail || undefined,
      subject,
      text: textBody,
      html: body,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    };

    console.log(`[sendTestEmail] Starting email send...${cc.length > 0 ? ` CC: ${cc.join(', ')}` : ''}`);
    const startTime = Date.now();
    
    await transporter.sendMail(mailOptions);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[sendTestEmail] Test email sent successfully to ${to} in ${duration} seconds`);
    return { success: true };
  } catch (error: any) {
    console.error('[sendTestEmail] Error:', error);
    return { success: false, error: error?.message || 'Unknown SMTP error' };
  }
}