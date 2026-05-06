/**
 * /enrich operation — research and fill in missing organization data.
 * Both gpt.ts and gemini.ts implement this with provider-tuned prompts;
 * Gemini returns plain text (with Google Search grounding); GPT returns
 * a parsed JSON object. The two output shapes are intentionally different
 * — frontend handles each.
 */

export interface EnrichArgs {
  companyName: string;
  keyPerson?: string;
  city?: string;
}

/**
 * Gemini prompt — research-oriented, instructs Google Search use, free-form
 * text output with a structured KEY PERSON CONTACT block.
 * Moved verbatim from api/src/routes/gemini.ts:202-297.
 */
export function buildGeminiEnrichPrompt(args: EnrichArgs): string {
  const { companyName, keyPerson, city } = args;
  const keyPersonInfo =
    keyPerson && keyPerson.trim()
      ? `Key contact person: ${keyPerson}`
      : 'Key contact person: Not specified';
  const cityInfo = city && city.trim() ? `Located in: ${city}` : 'Location: Not specified';

  return `DATA ENRICHMENT TASK FOR MICE ORGANIZATION
==========================================

ORGANIZATION TO RESEARCH:
- Name: ${companyName}
${keyPersonInfo}
${cityInfo}

TASK: Research and provide factual data about this organization. Use Google Search to find real, verified information.

⚠️ CRITICAL: KEY PERSON RESEARCH REQUIREMENTS
---------------------------------------------
The KEY PERSON must be someone with an IMPORTANT ROLE in the organization, specifically:
- Sales-related roles: Sales Director, Sales Manager, Business Development Manager, Revenue Director, Commercial Director, Account Manager
- Marketing-related roles: Marketing Director, Marketing Manager, CMO, Head of Marketing, Communications Director
- Event/Conference roles: Director of Events, Conference Director, Event Manager, Meeting Planner
- Executive roles: Director, Manager, Head, VP, Vice President, President, CEO, CMO, CSO
- Other important roles: Partnership Manager, Client Relations Manager, Outreach Coordinator, Engagement Specialist

REQUIREMENTS FOR KEY PERSON:
1. Must have BOTH a clear FULL NAME and a clear TITLE/ROLE
2. Must be someone with decision-making authority or direct responsibility for events/conferences/sales
3. Priority order: Sales/Marketing roles > Event/Conference roles > Executive roles > Other important roles
4. Do NOT include generic contacts like "info@", "contact@", or unnamed positions
5. The person must be identifiable with both name and title clearly stated

REQUIRED RESEARCH AREAS:
-----------------------
1. COMPANY OVERVIEW:
   - Brief description of what this organization does
   - Industry/sector classification

2. KEY PERSON CONTACT INFORMATION (HIGHEST PRIORITY - SEARCH THOROUGHLY):
   ⚠️ CRITICAL: Search specifically for people with important roles (Sales, Marketing, Business Development, Director, Manager, etc.)

   Search for:
   - Key Person FULL NAME: Must be a real person with a clear name (e.g., "John Smith", "Maria Garcia", "David Chen")
   - Key Person TITLE: Must be a specific, important role (e.g., "Sales Director", "Marketing Manager", "Business Development Manager", "Director of Events", "Conference Manager")
   - Key Person EMAIL: Official email address (preferably person-specific, not generic info@ or contact@)
   - Key Person PHONE: Direct contact number if available

   IMPORTANT: Only include a key person if you can find BOTH a clear name AND a clear title. If you cannot find both, state "Key person information not found" clearly.

3. ORGANIZATION CONTACT:
   - Website URL: Find official organization website
   - General contact email: info@, contact@, etc. (as backup)
   - Phone Number: Official phone number if available

4. EVENT HISTORY:
   - Notable past events/conferences organized
   - Years and locations of events
   - Event frequency and patterns

5. INDUSTRY CONTEXT:
   - Industry or sector classification
   - Type of organization (association, society, corporation, etc.)

6. RECENT ACTIVITY:
   - Notable recent news or activities
   - Upcoming events if known

RESEARCH GUIDELINES FOR KEY PERSON:
-----------------------------------
1. Search organization website, LinkedIn, press releases, event pages, team pages
2. Look for "Our Team", "Leadership", "Contact Us", "About Us" pages
3. Search for people with titles containing: Sales, Marketing, Business Development, Director, Manager, Head, VP, President, Events, Conferences
4. Verify the person exists and has a clear role - do not guess or invent names
5. If multiple key persons found, prioritize: Sales/Marketing > Events/Conferences > Executive
6. Format: "Full Name, Title" (e.g., "John Smith, Sales Director" or "Maria Garcia, Marketing Manager")
7. Include email in format: "name@domain.com" if found
8. If key person information is not available, clearly state "Key person with important role not found"

OUTPUT FORMAT:
--------------
Format your response in a clear, structured way useful for a sales team. CRITICAL: For KEY PERSON information, use this EXACT format:

**KEY PERSON CONTACT:**
- Name: [Full Name] (e.g., "John Smith" or "Maria Garcia")
- Title: [Job Title] (e.g., "Sales Director" or "Marketing Manager")
- Email: [email@domain.com] (if found, otherwise "Not found")
- Phone: [Phone number] (if found, otherwise "Not found")

If key person is not found, use:
**KEY PERSON CONTACT:**
- Name: Not found
- Title: Not found
- Email: Not found
- Phone: Not found

For other sections:
- Use clear headings for each section
- Provide specific details when available
- Note data sources or confidence level if relevant
- Include actionable contact information prominently

IMPORTANT: Always include the KEY PERSON CONTACT section with the exact format above, even if information is not found.`;
}

/**
 * OpenAI prompt — strict-JSON output, fixed field schema. Used with GPT's
 * json_object response_format. Moved verbatim from api/src/routes/gpt.ts:609-719.
 */
export function buildOpenaiEnrichPrompt(args: EnrichArgs): string {
  const { companyName, keyPerson, city } = args;

  return `DATA ENRICHMENT TASK FOR MICE ORGANIZATION
==========================================

⚠️ CRITICAL ACCURACY REQUIREMENT:
You MUST provide ONLY FACTUAL, VERIFIED information from your knowledge base.
NEVER guess, invent, or hallucinate data. If information is truly unavailable after thorough research, use empty string "" for strings or null for numbers.
Incorrect data is WORSE than missing data. Research thoroughly and verify accuracy.

ORGANIZATION TO RESEARCH:
- Name: ${companyName}
${keyPerson ? `- Known Contact: ${keyPerson}` : ''}
${city ? `- City: ${city}` : ''}

TASK: Research and provide factual data about this organization. Use empty string "" if information is not found (never null for strings).

⚠️ CRITICAL MANDATORY FIELDS - MUST BE RESEARCHED AND FILLED:
---------------------------------------------------------------
The following fields are ABSOLUTELY REQUIRED and MUST NOT be empty:

1. **localStrengthsWeaknesses** (Local Strengths & Weaknesses):
   - MUST analyze BOTH strengths AND weaknesses for Vietnam market
   - Format: "Strengths: [3-5 advantages]. Weaknesses: [2-3 challenges]"
   - This field is CRITICAL for understanding Vietnam's competitive position

2. **layoutEvent** (Layout Event):
   - MUST provide detailed event layout specifications
   - Format: "Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [poster area, networking space, registration area, catering areas, etc.]"
   - Include ALL space requirements: plenary hall, breakout rooms, exhibition, poster sessions, networking areas, registration, catering

3. **conferenceRegistration** (Conference Registration):
   - MUST include registration website URL, fees, deadlines, process, contact
   - Format: "Registration Website: [URL]. Registration Fees: [details]. Deadlines: [early bird date, regular deadline]. Process: [description]. Contact: [email/phone]"

REQUIRED RESEARCH FIELDS:
------------------------
1. CONTACT INFORMATION:
   - website: Official organization website URL
   - keyPersonName: Full name of key contact (President/Director/Secretary General)
   - keyPersonTitle: Actual title (e.g., "Secretary General", "President", "Executive Director")
   - keyPersonEmail: Official contact email (info@, contact@, or person-specific)
   - keyPersonPhone: Official phone number

2. ORGANIZATION LEADERSHIP:
   - secretaryGeneral: Full name of Secretary General
   - organizingChairman: Full name of Organizing Chairman (if different from Secretary General)

3. EVENT DETAILS:
   - industry: Industry/sector (Medical, Technology, Legal, etc.)
   - openYear: Year organization was established
   - frequency: Event frequency ("annually", "biennially", "triennially", "irregular")
   - duration: Typical event duration (e.g., "3 days", "5 days")
   - preferredMonth: Preferred months for events (e.g., "March-June")
   - rotationPattern: Event rotation pattern description
   - upcomingEvents: Information about upcoming events
   - numberOfDelegates: Typical delegate count

4. VENUE REQUIREMENTS:
   - breakoutRooms: Number needed (e.g., "8-10 rooms")
   - roomSizes: Size specifications (e.g., "200-300 sqm main hall, 50-80 sqm breakout")
   - layoutEvent: ⚠️ MANDATORY - Venue layout requirements. MUST provide detailed specifications: "Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [poster area, networking space, registration area, catering areas, etc.]"

5. BUSINESS INTELLIGENCE:
   - sponsors: Sponsor information (format: "Diamond: Company1; Gold: Company2; Silver: Company3")
   - conferenceRegistration: ⚠️ MANDATORY - Registration details. MUST include: "Registration Website: [URL]. Registration Fees: [details]. Deadlines: [early bird date, regular deadline]. Process: [description]. Contact: [email/phone]"
   - iccaQualified: "yes" or "no" with brief explanation
   - competitors: Competing venues/destinations
   - decisionMaker: Who makes venue decisions
   - localStrengthsWeaknesses: ⚠️ MANDATORY - Format "Strengths: [3-5 advantages Vietnam offers, e.g., Growing economy, strategic location in SEA, modern infrastructure, competitive costs, skilled workforce]. Weaknesses: [2-3 challenges, e.g., Limited international connectivity compared to Singapore/Thailand, visa requirements, language barriers]"
   - delegatesProfile: Profile of typical delegates

OUTPUT FORMAT:
--------------
Return valid JSON object with ALL fields. Use empty string "" for missing string fields, null for missing number fields.

{
  "website": "[string or empty string]",
  "industry": "[string or empty string]",
  "keyPersonName": "[string or empty string]",
  "keyPersonTitle": "[string or empty string]",
  "keyPersonEmail": "[string or empty string]",
  "keyPersonPhone": "[string or empty string]",
  "openYear": [number or null],
  "frequency": "[string or empty string]",
  "duration": "[string or empty string]",
  "preferredMonth": "[string or empty string]",
  "rotationPattern": "[string or empty string]",
  "upcomingEvents": "[string or empty string]",
  "delegatesProfile": "[string or empty string]",
  "organizingChairman": "[string or empty string]",
  "secretaryGeneral": "[string or empty string]",
  "sponsors": "[string or empty string]",
  "breakoutRooms": "[string or empty string]",
  "roomSizes": "[string or empty string]",
  "layoutEvent": "[string or empty string]",
  "conferenceRegistration": "[string or empty string]",
  "iccaQualified": "[string or empty string]",
  "decisionMaker": "[string or empty string]",
  "competitors": "[string or empty string]",
  "numberOfDelegates": [number or null],
  "localStrengthsWeaknesses": "[string or empty string]"
}

CRITICAL ACCURACY REQUIREMENTS:
1. All string fields must be strings (use "" for empty, never null)
2. All number fields must be numbers (use null for missing, never empty string)
3. Research thoroughly - use your knowledge base to find REAL, VERIFIED information
4. ACCURACY IS PARAMOUNT - if uncertain or cannot verify, use empty string "" rather than guessing
5. NEVER invent, guess, or hallucinate data - incorrect data is WORSE than missing data
6. Verify information from multiple sources in your knowledge base when possible
7. JSON must be valid and parseable
8. Double-check all contact information, dates, and names for accuracy`;
}

/**
 * Parse OpenAI's JSON-mode response. Falls back to wrapping the raw text
 * if parsing fails. Moved from gpt.ts:737-745.
 */
export function parseOpenaiEnrichResponse(content: string): Record<string, unknown> {
  const text = content || '{}';
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse GPT response as JSON:', e);
    return { researchSummary: text };
  }
}

/**
 * OpenAI system message for /enrich. Moved from gpt.ts:728.
 */
export const OPENAI_ENRICH_SYSTEM_MESSAGE = `You are an expert MICE industry researcher. CRITICAL ACCURACY RULES: 1) Only provide FACTUAL, VERIFIED information from your knowledge base. 2) NEVER guess, invent, or hallucinate data. 3) If information is truly unavailable after thorough research, use empty string "" for strings or null for numbers. 4) Priority fields: Secretary General, Organizing Chairman, website, email, contact information. 5) Research thoroughly - check organization websites, member directories, event history. 6) Return valid JSON only. 7) Incorrect data is WORSE than missing data - accuracy over completeness.`;
