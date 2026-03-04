import type { Lead as LeadRow, EmailTemplate } from '../../types/index.js';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface EmailFailure {
  eventName: string;
  email?: string;
  error: string;
  leadId?: string;
  subject?: string;
}

export interface EmailSendResult {
  attempted: number;
  sent: number;
  failures: EmailFailure[];
  skipped?: boolean;
  message?: string;
  successIds?: string[];
  missingContactIds?: string[];
  sentEmails?: Array<{ leadId: string; subject: string; messageId?: string }>;
}

export interface CustomEmailContent {
  leadId: string;
  subject: string;
  body: string; // HTML body
  cc?: string; // CC email addresses (comma-separated)
  attachments?: Array<{ name: string; file_data: string; type?: string }>;
}

export interface EventForEmail {
  name: string;
  organizationName?: string;
  rawData?: Record<string, any>;
  eventHistory?: string;
}

export interface ContactInfo {
  email: string | null;
  name: string | null;
  organization: string | null;
}

export interface MailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  cc?: string | string[];
  attachments?: NodemailerAttachment[];
}

export type EmailTemplateWithAttachments = EmailTemplate & {
  attachments?: Array<{ name: string; type: string; file_data?: string }>;
};

export type NodemailerAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: 'base64';
};

export type { LeadRow };
