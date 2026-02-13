/**
 * Prompt template for lead/key-person enrichment.
 * Kept separate for easy tuning without touching route logic.
 * Focus: find ONE key person with email; explicit search strategy.
 */

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

export function buildEnrichPrompt(companyName: string, keyPerson: string, city: string): string {
  const org = companyName.trim();
  const keyPersonInfo =
    keyPerson && keyPerson.trim()
      ? `Key contact person (if known): ${keyPerson.trim()}`
      : 'Key contact person: Not specified';
  const cityInfo = city && city.trim() ? `Located in: ${city.trim()}` : 'Location: Not specified';

  const searchSteps = SEARCH_STEPS.replace(/__ORG__/g, org);

  return `GOAL: Find ONE key person for this organization who has: (1) full name, (2) job title, and (3) EMAIL.
Do NOT return a key person with Email as "Not found" unless you have completed all search steps below and still found nothing.

ORGANIZATION TO RESEARCH:
- Name: ${org}
${keyPersonInfo}
${cityInfo}

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
