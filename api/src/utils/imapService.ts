import Imap from 'imap';
import { simpleParser } from 'mailparser';
import type { ParsedMail } from 'mailparser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { EmailLogModel } from '../models/EmailLogModel.js';
import { EmailReplyModel } from '../models/EmailReplyModel.js';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });

// IMAP Configuration - supports Gmail, Outlook, and other providers
const emailImapHost = process.env.EMAIL_IMAP_HOST; // Optional: separate IMAP host (for Outlook, etc.)
const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com'; // SMTP host (used as fallback)
const emailUser = process.env.EMAIL_HOST_USER;
const emailPassword = process.env.EMAIL_HOST_PASSWORD;
const emailPort = Number(process.env.EMAIL_IMAP_PORT || 993);

// Auto-detect IMAP host based on email domain if not explicitly set
const getImapHost = (): string => {
  if (emailImapHost) {
    return emailImapHost;
  }
  
  // Auto-detect based on email domain
  if (emailUser) {
    const domain = emailUser.split('@')[1]?.toLowerCase();
    if (domain?.includes('outlook.com') || domain?.includes('hotmail.com') || domain?.includes('live.com')) {
      return 'imap-mail.outlook.com'; // Outlook.com personal
    }
    if (domain?.includes('office365.com') || domain?.includes('microsoft.com')) {
      return 'outlook.office365.com'; // Office 365
    }
    if (domain?.includes('gmail.com')) {
      return 'imap.gmail.com'; // Gmail
    }
  }
  
  // Default: try to convert SMTP host to IMAP (e.g., smtp.gmail.com -> imap.gmail.com)
  if (emailHost.includes('smtp.')) {
    return emailHost.replace('smtp.', 'imap.');
  }
  
  // Final fallback
  return 'imap.gmail.com';
};

interface CheckInboxOptions {
  since?: Date;
  maxEmails?: number;
  subjectFilter?: string; // Filter by subject (case-insensitive partial match)
}

export class ImapService {
  private static getImapConfig(): Imap.Config | null {
    if (!emailUser || !emailPassword) {
      console.error('❌ [IMAP] Email credentials not configured');
      return null;
    }

    const imapHost = getImapHost();
    
    return {
      user: emailUser,
      password: emailPassword,
      host: imapHost,
      port: emailPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    };
  }

  /**
   * Check inbox for new email replies
   * Matches replies with sent emails using Message-ID and In-Reply-To headers
   */
  static async checkInboxForReplies(options: CheckInboxOptions = {}): Promise<number> {
    const config = this.getImapConfig();
    if (!config) {
      throw new Error('IMAP not configured. Please set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD.');
    }

    return new Promise((resolve, reject) => {
      const imap = new Imap(config);
      let processedCount = 0;

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          // Search for unread emails or emails since a certain date
          const searchCriteria: any[] = ['UNSEEN'];
          if (options.since) {
            searchCriteria.push(['SINCE', options.since]);
          }

          imap.search(searchCriteria, (err, results) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              console.log('📭 [IMAP] No new emails found');
              imap.end();
              return resolve(0);
            }

            // Limit number of emails to process
            const emailsToProcess = options.maxEmails 
              ? results.slice(0, options.maxEmails)
              : results;

            console.log(`📬 [IMAP] Found ${emailsToProcess.length} new email(s) to process`);

            const fetch = imap.fetch(emailsToProcess, {
              bodies: '',
              struct: true,
            });

            fetch.on('message', (msg, seqno) => {
              msg.on('body', (stream) => {
                simpleParser(stream, async (err, parsed: ParsedMail) => {
                  if (err) {
                    console.error(`❌ [IMAP] Error parsing email ${seqno}:`, err);
                    return;
                  }

                  try {
                    // Filter by subject if specified
                    if (options.subjectFilter) {
                      const subject = parsed.subject || '';
                      if (!subject.toLowerCase().includes(options.subjectFilter.toLowerCase())) {
                        return; // Skip this email if subject doesn't match
                      }
                    }
                    
                    await this.processEmailReply(parsed);
                    processedCount++;
                  } catch (error: any) {
                    console.error(`❌ [IMAP] Error processing email ${seqno}:`, error.message);
                  }
                });
              });
            });

            fetch.once('end', () => {
              imap.end();
              console.log(`✅ [IMAP] Processed ${processedCount} email reply(ies)`);
              resolve(processedCount);
            });

            fetch.once('error', (err) => {
              imap.end();
              reject(err);
            });
          });
        });
      });

      imap.once('error', (err) => {
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Process a single email and match it with sent emails
   */
  private static async processEmailReply(parsed: ParsedMail): Promise<void> {
    // Extract headers
    const messageId = parsed.messageId || '';
    const inReplyTo = parsed.inReplyTo || '';
    const references = parsed.references || [];
    const from = parsed.from?.value[0];
    const subject = parsed.subject || '';
    const text = parsed.text || '';
    const html = parsed.html || text;
    const date = parsed.date || new Date();

    if (!from || !from.address) {
      console.log('⚠️ [IMAP] Email has no from address, skipping');
      return;
    }

    // Check if this reply already exists
    if (messageId) {
      const existing = await EmailReplyModel.getByMessageId(messageId);
      if (existing) {
        console.log(`⏭️ [IMAP] Reply already processed: ${messageId}`);
        return;
      }
    }

    // Try to match with sent email using In-Reply-To or References header
    let matchedEmailLog = null;
    const searchMessageIds = [inReplyTo, ...references].filter(Boolean);

    for (const searchId of searchMessageIds) {
      if (!searchId) continue;

      // Find email log by message_id
      const emailLogs = await EmailLogModel.getAll();
      matchedEmailLog = emailLogs.find(log => 
        log.message_id && log.message_id.includes(searchId.replace(/[<>]/g, ''))
      );

      if (matchedEmailLog) {
        console.log(`✅ [IMAP] Matched reply to email log ${matchedEmailLog.id} (Message-ID: ${searchId})`);
        break;
      }
    }

    // If no match found, try matching by subject (for cases where headers are missing)
    if (!matchedEmailLog && subject) {
      const emailLogs = await EmailLogModel.getAll();
      // Look for emails with similar subject (replies usually have "Re: " prefix)
      const originalSubject = subject.replace(/^(Re:|RE:|re:)\s*/i, '').trim();
      matchedEmailLog = emailLogs.find(log => 
        log.subject.toLowerCase().includes(originalSubject.toLowerCase()) ||
        originalSubject.toLowerCase().includes(log.subject.toLowerCase())
      );

      if (matchedEmailLog) {
        console.log(`✅ [IMAP] Matched reply by subject to email log ${matchedEmailLog.id}`);
      }
    }

    if (!matchedEmailLog) {
      console.log(`⚠️ [IMAP] Could not match reply from ${from.address} (Subject: ${subject})`);
      return;
    }

    // Create email reply record
    const replyId = `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await EmailReplyModel.create({
      id: replyId,
      email_log_id: matchedEmailLog.id,
      lead_id: matchedEmailLog.lead_id,
      from_email: from.address,
      from_name: from.name || undefined,
      subject: subject,
      body: text,
      html_body: html,
      reply_date: date,
      message_id: messageId || undefined,
      in_reply_to: inReplyTo || undefined,
      references_header: references.join(' ') || undefined,
    });

    console.log(`✅ [IMAP] Saved reply from ${from.address} for lead ${matchedEmailLog.lead_id}`);
  }

  /**
   * Count emails in inbox by subject filter
   * Returns count of emails matching the subject (case-insensitive partial match)
   */
  static async countEmailsBySubject(subjectFilter: string, options: { since?: Date; includeRead?: boolean } = {}): Promise<number> {
    const config = this.getImapConfig();
    if (!config) {
      throw new Error('IMAP not configured. Please set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD.');
    }

    return new Promise((resolve, reject) => {
      const imap = new Imap(config);
      let count = 0;

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          // Search criteria
          const searchCriteria: any[] = [];
          if (!options.includeRead) {
            searchCriteria.push('UNSEEN'); // Only unread by default
          }
          if (options.since) {
            searchCriteria.push(['SINCE', options.since]);
          }
          // Note: IMAP doesn't support case-insensitive subject search well,
          // so we'll fetch all and filter in code

          imap.search(searchCriteria.length > 0 ? searchCriteria : ['ALL'], (err, results) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              imap.end();
              return resolve(0);
            }

            const fetch = imap.fetch(results, {
              bodies: 'HEADER',
              struct: true,
            });

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed: ParsedMail) => {
                  if (err) {
                    return;
                  }

                  const subject = parsed.subject || '';
                  if (subject.toLowerCase().includes(subjectFilter.toLowerCase())) {
                    count++;
                  }
                });
              });
            });

            fetch.once('end', () => {
              imap.end();
              console.log(`📊 [IMAP] Found ${count} email(s) with subject containing "${subjectFilter}"`);
              resolve(count);
            });

            fetch.once('error', (err) => {
              imap.end();
              reject(err);
            });
          });
        });
      });

      imap.once('error', (err) => {
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Mark emails as read after processing
   */
  static async markAsRead(messageIds: number[]): Promise<void> {
    const config = this.getImapConfig();
    if (!config) return;

    return new Promise((resolve, reject) => {
      const imap = new Imap(config);

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          imap.addFlags(messageIds, '\\Seen', (err) => {
            imap.end();
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });

      imap.once('error', reject);
      imap.connect();
    });
  }
}

