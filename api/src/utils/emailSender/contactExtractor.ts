import { EMAIL_REGEX } from './config.js';
import type { EventForEmail, ContactInfo, LeadRow } from './types.js';

// ============================================================================
// Contact Info Extraction
// ============================================================================

export class ContactExtractor {
  /**
   * Extract first matching value from raw data
   */
  private static extractFirstMatchingValue(
    rawData: Record<string, any> | undefined,
    keywords: string[]
  ): string | null {
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

  /**
   * Extract contact info from event data
   */
  static extractFromEvent(event: EventForEmail): ContactInfo {
    const rawData = event.rawData || {};

    const emailCandidate = this.extractFirstMatchingValue(rawData, ['email', 'mail']);
    let email: string | null = null;
    if (emailCandidate) {
      const emailMatch = emailCandidate.match(EMAIL_REGEX);
      if (emailMatch) {
        email = emailMatch[0];
      }
    }

    const nameCandidate = this.extractFirstMatchingValue(rawData, [
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
      this.extractFirstMatchingValue(rawData, ['organization', 'organisation', 'association', 'company', 'host']);

    return {
      email,
      name: contactName || null,
      organization: organizationCandidate || null,
    };
  }

  /**
   * Extract contact info from lead data
   */
  static extractFromLead(lead: LeadRow): ContactInfo {
    const email = (lead.key_person_email || '').trim() || null;
    const contactName = (lead.key_person_name || lead.secondary_person_name || '').trim();
    const organization = lead.company_name;

    return {
      email,
      name: contactName || null,
      organization,
    };
  }
}
