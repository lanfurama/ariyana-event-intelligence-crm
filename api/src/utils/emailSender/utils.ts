import { EMAIL_REGEX, COUNTRY_TO_LANGUAGE, EMAIL_CONFIG } from './config.js';
import type { NodemailerAttachment } from './types.js';

// ============================================================================
// Utility Functions
// ============================================================================

export class EmailUtils {
  /**
   * Convert HTML to plain text
   */
  static htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Validate email address
   */
  static isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email.trim());
  }

  /**
   * Parse CC addresses from comma-separated string
   */
  static parseCcAddresses(cc?: string): string[] {
    if (!cc) return [];
    return cc.split(',').map(addr => addr.trim()).filter(Boolean);
  }

  /**
   * Get language code from country name
   */
  static getLanguageFromCountry(country: string | null | undefined): string | null {
    if (!country) return null;
    const normalized = country.trim().toLowerCase();
    return COUNTRY_TO_LANGUAGE[normalized] || null;
  }

  /**
   * Build from email address with name
   */
  static buildFromAddress(email?: string): string {
    const fromEmail = email || EMAIL_CONFIG.FROM_EMAIL || EMAIL_CONFIG.DEFAULT_FROM;
    return `"${EMAIL_CONFIG.FROM_NAME}" <${fromEmail}>`;
  }

  /**
   * Calculate total size of attachments in bytes
   */
  static calculateAttachmentsSize(attachments: NodemailerAttachment[]): number {
    return attachments.reduce((sum, att) => {
      const size = Buffer.isBuffer(att.content) ? att.content.length : (att.content as string).length;
      return sum + size;
    }, 0);
  }
}
