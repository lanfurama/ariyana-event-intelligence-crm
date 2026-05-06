/**
 * /extract-organizations operation — extract organization names from imported
 * data. GPT-only.
 */

export interface ExtractOrganizationsArgs {
  data: string;
  summary?: unknown;
}

export interface ExtractOrganizationsResult {
  organizations: Array<{
    name: string;
    rowIndex: number;
    sourceField: string;
  }>;
}

/**
 * System message. Moved verbatim from gpt.ts.
 */
export const OPENAI_EXTRACT_ORGANIZATIONS_SYSTEM_MESSAGE = `Extract organization names only. Not events, venues, or contacts. One per org.`;

/**
 * User prompt builder. Moved verbatim from gpt.ts.
 */
export function buildOpenaiExtractOrganizationsPrompt(args: ExtractOrganizationsArgs): string {
  const { data, summary } = args;
  return `Extract organizations from: ${data}${summary ? `\nSummary: ${JSON.stringify(summary)}` : ''}

Return: {"organizations": [{"name": "Org Name", "rowIndex": 1, "sourceField": "Field"}]}`;
}

/**
 * Parse the OpenAI response. Falls back to empty array on parse error.
 * Moved from gpt.ts.
 */
export function parseExtractOrganizationsResponse(content: string): ExtractOrganizationsResult {
  try {
    const parsed = JSON.parse(content || '{}');
    if (!parsed.organizations || !Array.isArray(parsed.organizations)) {
      return { organizations: [] };
    }
    return parsed as ExtractOrganizationsResult;
  } catch (e) {
    console.error('JSON Parse Error in extract-organizations:', e);
    return { organizations: [] };
  }
}
