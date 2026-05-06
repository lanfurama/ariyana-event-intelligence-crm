/**
 * /draft-email operation — generate an outreach email for a lead.
 * Both providers return JSON with `subject` and `body` fields.
 */

export interface DraftEmailArgs {
  leadName: string;
  leadCompany: string;
  leadTitle?: string;
  eventContext?: string;
}

export interface DraftEmailResult {
  subject: string;
  body: string;
}

/**
 * Gemini prompt — uses Gemini's responseSchema (Type.OBJECT) for JSON.
 * Moved verbatim from api/src/routes/gemini.ts:234-245.
 */
export function buildGeminiDraftEmailPrompt(args: DraftEmailArgs): string {
  const { leadName, leadCompany, leadTitle, eventContext } = args;
  return `Write a personalized, professional sales email to ${leadName}, ${leadTitle} at ${leadCompany}.

  Context: I am representing 'Ariyana Convention Centre' in Danang, Vietnam.
  We want to host their next event: ${eventContext}.

  Highlight:
  - Oceanfront location
  - Large capacity (APEC venue)
  - Proximity to heritage sites

  Tone: Professional, warm, inviting.
  Format: JSON with 'subject' and 'body' fields.`;
}

/**
 * Parse Gemini draft-email response. Strips markdown code fences and JSON-parses.
 * Falls back to a stub on parse error. Moved from gemini.ts:263-274.
 */
export function parseGeminiDraftEmailResponse(text: string): DraftEmailResult {
  try {
    const cleaned = (text || '')
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON Parse Error', e);
    return { subject: 'Error generating subject', body: text || '' };
  }
}

/**
 * OpenAI prompt — uses GPT's json_object response_format.
 * Moved verbatim from api/src/routes/gpt.ts:656-669.
 */
export function buildOpenaiDraftEmailPrompt(args: DraftEmailArgs): string {
  const { leadName, leadCompany, leadTitle, eventContext } = args;
  return `
Draft a professional sales email for:
- Lead Name: ${leadName}
- Company: ${leadCompany}
- Title: ${leadTitle || 'Not provided'}
- Event Context: ${eventContext || 'Not provided'}

The email should:
1. Be professional and personalized
2. Highlight Ariyana Convention Centre Danang's advantages (hosted APEC 2017, modern facilities, beautiful location)
3. Propose hosting their next conference in Danang (2026-2027)
4. Include a clear call-to-action

Return a JSON object with "subject" and "body" fields.`;
}

/**
 * OpenAI system message for /draft-email. Moved from gpt.ts:676.
 */
export const OPENAI_DRAFT_EMAIL_SYSTEM_MESSAGE =
  'You are an expert sales email writer specializing in MICE industry outreach.';
