import type { Lead } from '../types';

/** Generic or non-actionable email prefixes */
const GENERIC_EMAIL_PREFIXES = ['info@', 'contact@', 'admin@', 'support@'];

function isGenericEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return GENERIC_EMAIL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function isEmpty(value: string | undefined): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Returns true if the lead is missing useful key person info (name, email, or phone).
 * Email is considered missing if empty or generic (info@, contact@, etc.).
 */
export function isLeadMissingPersonInfo(lead: Lead): boolean {
  const nameOk = !isEmpty(lead.keyPersonName);
  const emailOk =
    !isEmpty(lead.keyPersonEmail) && !isGenericEmail(lead.keyPersonEmail || '');
  const phoneOk = !isEmpty(lead.keyPersonPhone);

  return !nameOk || !emailOk || !phoneOk;
}

export interface ParsedEnrichContact {
  keyPersonName?: string;
  keyPersonTitle?: string;
  keyPersonEmail?: string;
  keyPersonPhone?: string;
}

const NOT_FOUND_LOWER = 'not found';

function trimValue(s: string): string {
  return s.replace(/^["']|["']$/g, '').trim();
}

function acceptValue(v: string, isEmail = false): boolean {
  if (!v || v.toLowerCase() === NOT_FOUND_LOWER) return false;
  if (isEmail && !v.includes('@')) return false;
  return true;
}

/**
 * Extract value from block using multiple possible line formats:
 * - "- Name: value" or "**Name**: value" or "Name: value"
 */
function extractLine(block: string, key: string): string | null {
  const patterns = [
    new RegExp(`[-*]\\s*\\*\\*${key}\\*\\*:\\s*(.+?)(?=\n|$)`, 'i'),
    new RegExp(`[-*]\\s*${key}:\\s*(.+?)(?=\n|$)`, 'i'),
    new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+?)(?=\n|$)`, 'i'),
    new RegExp(`^${key}:\\s*(.+?)(?=\n|$)`, 'im'),
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m) return trimValue(m[1]);
  }
  return null;
}

/**
 * Parses the KEY PERSON CONTACT block from Vertex/Gemini enrich text response.
 * Supports multiple formats, e.g.:
 *   **KEY PERSON CONTACT:**     or    ### **2. KEY PERSON CONTACT:**
 *   - Name: ...                       **Name**: Kunchit Judprasong
 *   **Name**: ...
 */
export function parseEnrichResponse(text: string): ParsedEnrichContact {
  const result: ParsedEnrichContact = {};

  if (!text || typeof text !== 'string') return result;

  const blockMatch = text.match(
    /(?:###\s*)?\*\*(\d+\.\s*)?KEY PERSON CONTACT:\*\*[\s\S]*?(?=\n\n#{1,3}\s|\n\n\*\*|$)/i
  );
  const block = blockMatch ? blockMatch[0] : text;

  const nameVal = extractLine(block, 'Name');
  const titleVal = extractLine(block, 'Title');
  const emailVal = extractLine(block, 'Email');
  const phoneVal = extractLine(block, 'Phone');

  if (nameVal && acceptValue(nameVal)) result.keyPersonName = nameVal;
  if (titleVal && acceptValue(titleVal)) result.keyPersonTitle = titleVal;
  if (emailVal && acceptValue(emailVal, true)) result.keyPersonEmail = emailVal;
  if (phoneVal && acceptValue(phoneVal)) result.keyPersonPhone = phoneVal;

  return result;
}
