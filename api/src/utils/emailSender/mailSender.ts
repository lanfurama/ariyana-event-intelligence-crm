import nodemailer from 'nodemailer';
import { EmailUtils } from './utils.js';
import { EMAIL_CONFIG } from './config.js';
import type { MailOptions, NodemailerAttachment } from './types.js';

// ============================================================================
// Mail Sender
// ============================================================================

export class MailSender {
  /**
   * Build mail options
   */
  private static buildMailOptions(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
    cc?: string | string[];
    attachments?: NodemailerAttachment[];
  }): MailOptions {
    return {
      from: EmailUtils.buildFromAddress(),
      to: options.to,
      replyTo: options.replyTo || EMAIL_CONFIG.FROM_EMAIL || undefined,
      subject: options.subject,
      text: options.text,
      html: options.html,
      cc: options.cc,
      attachments: options.attachments && options.attachments.length > 0 ? options.attachments : undefined,
    };
  }

  /**
   * Send email using transporter
   */
  static async sendMail(
    transporter: nodemailer.Transporter,
    options: {
      to: string;
      subject: string;
      text: string;
      html: string;
      replyTo?: string;
      cc?: string | string[];
      attachments?: NodemailerAttachment[];
    }
  ): Promise<{ messageId?: string }> {
    const mailOptions = this.buildMailOptions(options);
    const info = await transporter.sendMail(mailOptions);
    return { messageId: info.messageId || undefined };
  }
}
