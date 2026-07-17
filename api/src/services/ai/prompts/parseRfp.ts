/**
 * /parse-rfp operation — extract structured booking-request fields from a
 * pasted venue-inquiry email (the "AI intake" flow).
 */

export interface RfpExtraction {
  is_rfp: boolean;
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  event_type?: string;
  expected_guests?: number;
  /** YYYY-MM-DD */
  preferred_date?: string;
  layout?: string;
  summary?: string;
}

const KNOWN_LAYOUTS = ['theatre', 'classroom', 'banquet', 'cocktail', 'ushape', 'boardroom'];

/**
 * Gemini prompt. `todayIso` (YYYY-MM-DD) is injected by the caller so date
 * normalization ("next March 12th") is deterministic and testable.
 */
export function buildGeminiParseRfpPrompt(emailText: string, todayIso: string): string {
  return `You are the sales-intake assistant of Ariyana Convention Centre Danang (Vietnam), a venue for conferences, banquets and exhibitions.

Analyze the following inbound email/text and extract a structured venue booking request.

Today's date is ${todayIso}.

Rules:
- "is_rfp" is true only if the text is plausibly an inquiry about hiring event space (venue rental, conference, banquet, meeting, exhibition...). Marketing spam, unrelated mail or replies about other topics -> false.
- Extract only what is actually present; omit unknown fields.
- "preferred_date" must be formatted YYYY-MM-DD. If the year is missing, use the NEXT future occurrence relative to today's date. If a date range is given, use the first day.
- "expected_guests" is a number (people attending).
- "layout" only if clearly implied; one of: ${KNOWN_LAYOUTS.join(', ')}.
- "summary" is one or two English sentences describing the request for the sales team.

Return JSON with fields: is_rfp (boolean), company_name, contact_name, email, phone, event_type, expected_guests (number), preferred_date, layout, summary.

EMAIL TEXT:
"""
${emailText}
"""`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Parse + coerce the model's JSON response. Garbage in -> safe
 * `{ is_rfp: false }` out; individually invalid fields are dropped rather
 * than failing the whole extraction.
 */
export function parseRfpExtraction(text: string): RfpExtraction {
  let raw: any;
  try {
    const cleaned = (text || '')
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    raw = JSON.parse(cleaned);
  } catch (e) {
    console.error('parse-rfp JSON parse error', e);
    return { is_rfp: false };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { is_rfp: false };
  }

  const result: RfpExtraction = { is_rfp: raw.is_rfp === true };

  const company = cleanString(raw.company_name);
  if (company) result.company_name = company;
  const contact = cleanString(raw.contact_name);
  if (contact) result.contact_name = contact;
  const email = cleanString(raw.email);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) result.email = email;
  const phone = cleanString(raw.phone);
  if (phone) result.phone = phone;
  const eventType = cleanString(raw.event_type);
  if (eventType) result.event_type = eventType;

  const guests = Number(raw.expected_guests);
  if (Number.isFinite(guests) && guests > 0) {
    result.expected_guests = Math.round(guests);
  }

  const date = cleanString(raw.preferred_date);
  if (date && DATE_RE.test(date)) result.preferred_date = date;

  const layout = cleanString(raw.layout)?.toLowerCase();
  if (layout && KNOWN_LAYOUTS.includes(layout)) result.layout = layout;

  const summary = cleanString(raw.summary);
  if (summary) result.summary = summary;

  return result;
}
