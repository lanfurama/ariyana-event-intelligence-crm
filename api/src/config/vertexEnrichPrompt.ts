/**
 * Prompt template for lead/key-person enrichment.
 * Kept separate for easy tuning without touching route logic.
 */
export function buildEnrichPrompt(companyName: string, keyPerson: string, city: string): string {
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

TASK: Research and provide factual data about this organization. Use your knowledge to find real, verified information.

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
1. COMPANY OVERVIEW: Brief description, industry/sector classification.

2. KEY PERSON CONTACT INFORMATION (HIGHEST PRIORITY - SEARCH THOROUGHLY):
   Search for: Key Person FULL NAME, TITLE, EMAIL, PHONE.
   Only include a key person if you can find BOTH a clear name AND a clear title. If you cannot find both, state "Key person information not found" clearly.

3. ORGANIZATION CONTACT: Website URL, general contact email, phone if available.

4. EVENT HISTORY: Notable past events, years and locations, event frequency.

5. INDUSTRY CONTEXT: Industry or sector, type of organization.

OUTPUT FORMAT:
--------------
Format your response in a clear, structured way. CRITICAL: For KEY PERSON information, use this EXACT format:

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

Use clear headings for other sections. Always include the KEY PERSON CONTACT section with the exact format above, even if information is not found.`;
}
