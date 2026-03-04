// ============================================================================
// Public API Exports
// ============================================================================

export { EmailTransporter, getTransporter } from './transporter.js';
export { EmailUtils } from './utils.js';
export { AttachmentProcessor } from './attachmentProcessor.js';
export { TemplateProcessor } from './templateProcessor.js';
export { ContactExtractor } from './contactExtractor.js';
export { EmailContentBuilder } from './emailContentBuilder.js';
export { MailSender } from './mailSender.js';
export { ResultFormatter } from './resultFormatter.js';

export type {
  EmailFailure,
  EmailSendResult,
  CustomEmailContent,
  EventForEmail,
  ContactInfo,
  MailOptions,
  EmailTemplateWithAttachments,
  NodemailerAttachment,
  LeadRow,
} from './types.js';

// ============================================================================
// Public API Functions
// ============================================================================

import type { LeadRow, EmailTemplate } from '../../types/index.js';
import { EmailTemplateModel } from '../../models/EmailTemplateModel.js';
import { EmailTransporter } from './transporter.js';
import { ContactExtractor } from './contactExtractor.js';
import { EmailContentBuilder } from './emailContentBuilder.js';
import { TemplateProcessor } from './templateProcessor.js';
import { AttachmentProcessor } from './attachmentProcessor.js';
import { MailSender } from './mailSender.js';
import { EmailUtils } from './utils.js';
import { ResultFormatter } from './resultFormatter.js';
import type { EventForEmail, EmailSendResult, CustomEmailContent } from './types.js';

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

  const transporter = EmailTransporter.getInstance();
  if (!transporter) {
    return {
      attempted: 0,
      sent: 0,
      failures: [],
      skipped: true,
      message: EmailTransporter.getInitError() ?? 'Email transport could not be initialized.',
    };
  }

  const recipients = new Map<string, { event: EventForEmail; contact: ReturnType<typeof ContactExtractor.extractFromEvent> }>();

  events.forEach((event) => {
    const contact = ContactExtractor.extractFromEvent(event);
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
      const { subject, text, html } = EmailContentBuilder.buildEventEmail(event, contact);
      await MailSender.sendMail(transporter, { to: email, subject, text, html });
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

  const transporter = EmailTransporter.getInstance();
  if (!transporter) {
    return {
      attempted: 0,
      sent: 0,
      failures: [],
      skipped: true,
      message: EmailTransporter.getInitError() ?? 'Email transport could not be initialized.',
    };
  }

  // Load templates with attachments
  const templates = await EmailTemplateModel.getAll();
  const templatesWithAttachments = await Promise.all(
    templates.map(async (template) => {
      const attachments = await EmailTemplateModel.getAttachments(template.id);
      return { ...template, attachments };
    })
  );

  for (const lead of leads) {
    const contact = ContactExtractor.extractFromLead(lead);

    if (!contact.email) {
      summary.failures.push({
        eventName: lead.company_name,
        error: 'No contact email available for this lead.',
        leadId: lead.id,
      });
      summary.missingContactIds?.push(lead.id);
      continue;
    }

    const selectedTemplate = TemplateProcessor.selectTemplateForLead(lead, templatesWithAttachments);
    if (!selectedTemplate) {
      summary.failures.push({
        eventName: lead.company_name,
        error: 'No matching email template for this lead type.',
        leadId: lead.id,
      });
      continue;
    }

    summary.attempted += 1;

    try {
      const { subject, body: bodyHtml } = TemplateProcessor.renderTemplate(selectedTemplate, lead);
      const linksHtml = AttachmentProcessor.extractLinksAsHtml(selectedTemplate.attachments);
      const html = bodyHtml + linksHtml;
      const text = EmailUtils.htmlToText(html);

      const fileAttachments = AttachmentProcessor.extractFileAttachments(selectedTemplate.attachments);

      const { messageId } = await MailSender.sendMail(transporter, {
        to: contact.email,
        subject,
        text,
        html,
        attachments: fileAttachments,
      });

      summary.sent += 1;
      summary.successIds?.push(lead.id);
      summary.sentEmails?.push({
        leadId: lead.id,
        subject,
        messageId,
      });
    } catch (error: any) {
      summary.failures.push({
        eventName: lead.company_name,
        email: contact.email,
        error: error?.message || 'Unknown SMTP error',
        leadId: lead.id,
        subject: selectedTemplate.subject,
      });
    }
  }

  summary.message = ResultFormatter.generateSummaryMessage(summary);
  return summary;
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

  const transporter = EmailTransporter.getInstance();
  if (!transporter) {
    return {
      attempted: 0,
      sent: 0,
      failures: [],
      skipped: true,
      message: EmailTransporter.getInitError() ?? 'Email transport could not be initialized.',
    };
  }

  const emailMap = new Map<string, CustomEmailContent>();
  customEmails.forEach(email => {
    emailMap.set(email.leadId, email);
  });

  for (const lead of leads) {
    const contact = ContactExtractor.extractFromLead(lead);

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
      const textBody = EmailUtils.htmlToText(customEmail.body);
      const emailAttachments = customEmail.attachments && customEmail.attachments.length > 0
        ? AttachmentProcessor.convertToNodemailerFormat(customEmail.attachments)
        : [];

      const ccAddresses = EmailUtils.parseCcAddresses(customEmail.cc);
      const totalSize = EmailUtils.calculateAttachmentsSize(emailAttachments);

      console.log(`[sendLeadEmailsWithCustomContent] Sending email to ${contact.email} with ${emailAttachments.length} attachment(s), total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

      const { messageId } = await MailSender.sendMail(transporter, {
        to: contact.email,
        subject: customEmail.subject,
        text: textBody,
        html: customEmail.body,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        attachments: emailAttachments,
      });

      summary.sent += 1;
      summary.successIds?.push(lead.id);
      summary.sentEmails?.push({
        leadId: lead.id,
        subject: customEmail.subject,
        messageId,
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

  summary.message = ResultFormatter.generateSummaryMessage(summary);
  return summary;
}

export async function sendTestEmail(
  to: string,
  subject: string,
  body: string,
  attachments: Array<{ name: string; file_data: string; type?: string }> = [],
  cc: string[] = []
): Promise<{ success: boolean; error?: string }> {
  const transporter = EmailTransporter.getInstance();
  if (!transporter) {
    return { success: false, error: EmailTransporter.getInitError() ?? 'Email transport could not be initialized.' };
  }

  if (!EmailUtils.isValidEmail(to)) {
    return { success: false, error: 'Invalid email address.' };
  }

  try {
    const textBody = EmailUtils.htmlToText(body);
    const emailAttachments = AttachmentProcessor.convertToNodemailerFormat(attachments);
    const totalSize = EmailUtils.calculateAttachmentsSize(emailAttachments);

    console.log(`[sendTestEmail] Sending test email to ${to} with ${emailAttachments.length} attachment(s), total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    const startTime = Date.now();
    await MailSender.sendMail(transporter, {
      to: to.trim(),
      subject,
      text: textBody,
      html: body,
      cc: cc.length > 0 ? cc : undefined,
      attachments: emailAttachments,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[sendTestEmail] Test email sent successfully to ${to} in ${duration} seconds`);
    return { success: true };
  } catch (error: any) {
    console.error('[sendTestEmail] Error:', error);
    return { success: false, error: error?.message || 'Unknown SMTP error' };
  }
}
