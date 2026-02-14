/**
 * Prompt template for lead/key-person enrichment.
 * Kept separate for easy tuning without touching route logic.
 * Uses full lead context for more accurate research.
 */

export interface EnrichContext {
  companyName: string;
  keyPerson?: string;
  city?: string;
  country?: string;
  website?: string;
  industry?: string;
  keyPersonTitle?: string;
  keyPersonEmail?: string;
  keyPersonPhone?: string;
  notes?: string;
  researchNotes?: string;
  pastEventsHistory?: string;
  secondaryPersonName?: string;
  secondaryPersonTitle?: string;
  secondaryPersonEmail?: string;
}

const SEARCH_STEPS = `SEARCH STRATEGY (follow in order; use Google Search):
1. Find the organization's official website (search: "__ORG__" official website).
2. On that site, look for: "Contact", "Our Team", "Leadership", "Secretariat", "Staff", "About Us".
3. On those pages, look for email. Prefer person-specific emails (e.g. firstname.lastname@domain, name@domain). If you only find info@ or contact@, note it and keep searching for a named contact with direct email.
4. If needed, search: "__ORG__" contact email, "__ORG__" secretariat email, "__ORG__" director contact (use only publicly available information).`;

const OUTPUT_FORMAT = `OUTPUT FORMAT (use this EXACT format so the system can parse it):

**KEY PERSON CONTACT:**
- Name: [Full Name]
- Title: [Job Title]
- Email: [email@domain.com or "Not found"]

If no key person with email is found after all search steps:
**KEY PERSON CONTACT:**
- Name: Not found
- Title: Not found
- Email: Not found
Then add one short line describing what you searched (e.g. "Searched official site, contact page; no direct email found").`;

export function buildEnrichPrompt(ctx: EnrichContext): string {
  const org = String(ctx.companyName || '').trim();
  const keyPerson = ctx.keyPerson?.trim() || '';
  const city = ctx.city?.trim() || '';
  const country = ctx.country?.trim() || '';
  const website = ctx.website?.trim() || '';
  const industry = ctx.industry?.trim() || '';
  const keyPersonTitle = ctx.keyPersonTitle?.trim() || '';
  const keyPersonEmail = ctx.keyPersonEmail?.trim() || '';
  const notes = ctx.notes?.trim() || '';
  const researchNotes = ctx.researchNotes?.trim() || '';
  const pastEventsHistory = ctx.pastEventsHistory?.trim() || '';
  const secondaryPerson = ctx.secondaryPersonName?.trim()
    ? `${ctx.secondaryPersonName}${ctx.secondaryPersonTitle ? ` (${ctx.secondaryPersonTitle})` : ''}${ctx.secondaryPersonEmail ? ` - ${ctx.secondaryPersonEmail}` : ''}`
    : '';

  const searchSteps = SEARCH_STEPS.replace(/__ORG__/g, org);

  const contextLines: string[] = [`- Name: ${org}`];
  if (keyPerson) contextLines.push(`- Key person to find: ${keyPerson}`);
  if (keyPersonTitle) contextLines.push(`- Known title (verify): ${keyPersonTitle}`);
  if (keyPersonEmail) contextLines.push(`- Known email (verify/update): ${keyPersonEmail}`);
  if (city) contextLines.push(`- City: ${city}`);
  if (country) contextLines.push(`- Country: ${country}`);
  if (website) contextLines.push(`- Website: ${website} (use to verify domain, find contact pages)`);
  if (industry) contextLines.push(`- Industry: ${industry}`);
  if (pastEventsHistory) contextLines.push(`- Past events: ${pastEventsHistory.slice(0, 300)}${pastEventsHistory.length > 300 ? '...' : ''}`);
  if (secondaryPerson) contextLines.push(`- Secondary contact (alternative): ${secondaryPerson}`);
  if (notes) contextLines.push(`- Notes: ${notes.slice(0, 200)}${notes.length > 200 ? '...' : ''}`);
  if (researchNotes) contextLines.push(`- Previous research: ${researchNotes.slice(0, 200)}${researchNotes.length > 200 ? '...' : ''}`);

  return `GOAL: Find ONE key person for this organization who has: (1) full name, (2) job title, and (3) EMAIL.
Do NOT return a key person with Email as "Not found" unless you have completed all search steps below and still found nothing.

ORGANIZATION TO RESEARCH (use all context for accurate search):
${contextLines.join('\n')}

KEY PERSON ROLE PRIORITY (choose someone with one of these roles, and with email):
- Sales/Marketing: Sales Director, Marketing Manager, Business Development, CMO, Communications Director
- Events: Director of Events, Conference Director, Event Manager, Meeting Planner
- Executive: Director, Manager, Head, VP, President, CEO, Secretariat
- Other: Partnership Manager, Client Relations, Outreach Coordinator

RULES:
- The key person MUST have a clear full name and job title.
- You MUST have EMAIL for that person to report them. If you only find name and title but no email, continue searching using the steps below.
- Only after exhausting the search strategy may you return "Email: Not found".
- Do not invent or guess; use only information you find via search.
- Prefer person-specific email over generic info@/contact@ when possible.

${searchSteps}

${OUTPUT_FORMAT}

Always include the KEY PERSON CONTACT block in your response with the exact format above.`;
}
