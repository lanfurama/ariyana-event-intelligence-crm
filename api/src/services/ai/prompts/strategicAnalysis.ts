/**
 * /strategic-analysis operation — analyze ONE event and produce a structured
 * evaluation with embedded JSON. Both providers receive a leadsData blob;
 * Gemini's prompt is research-oriented; OpenAI's is accuracy-focused.
 *
 * Both handlers return raw text (the JSON is embedded inside a markdown block
 * within the response). No parser exported — the route handlers pass the
 * text through to the client unchanged.
 */

export interface StrategicAnalysisArgs {
  leadsData: string;
}

/**
 * Gemini prompt. Moved verbatim from api/src/routes/gemini.ts:414-754.
 */
export function buildGeminiStrategicAnalysisPrompt(args: StrategicAnalysisArgs): string {
  const { leadsData } = args;
  return `EVENT ANALYSIS TASK
==================
You are analyzing ONE SPECIFIC EVENT from imported Excel/CSV data. Evaluate ONLY this event for Ariyana Convention Centre Danang.

⚠️ CRITICAL MANDATORY FIELDS - MUST BE RESEARCHED AND FILLED:
---------------------------------------------------------------
The following fields are ABSOLUTELY REQUIRED and MUST NOT be empty. You MUST research thoroughly and provide comprehensive information. If any field is empty after research, you MUST add it to the problems array.

1. **openYear** (Open Year):
   - MUST research and find the year the organization/event was established
   - Search: organization founding year, first event year, organization history, "established in", "founded in", "since [year]"
   - Format: [number] (e.g., 1995, 2000, 2010)
   - If empty, add "Missing openYear" to problems array

2. **localHostName** (Name of Local Host / Member):
   - MUST find the name of Local Host / Member organization or person
   - If event has been in Vietnam: find the actual local host name
   - If event has NOT been in Vietnam: research potential local host/member organization name
   - Search: organization website for "local chapter", "member", "host", "Vietnam chapter", "[country] chapter"
   - Format: "Full Name" or "Organization Name"
   - If empty, add "Missing localHostName" to problems array

3. **localHostTitle** (Title of Local Host):
   - MUST find the title/position of the Local Host
   - Search: organization website, member directory, local chapter pages for titles like "President", "Secretary General", "Chairman", "Executive Director", "Director"
   - Format: "President" or "Secretary General" or "Chairman" etc.
   - If empty, add "Missing localHostTitle" to problems array

4. **localHostEmail** (Email of Local Host):
   - MUST search for local host contact email
   - Search: organization website contact pages, member directory, local chapter pages, "[country] contact"
   - Format: email address (e.g., "info@organization.org" or "president@organization.org")
   - If empty, add "Missing localHostEmail" to problems array

5. **localHostPhone** (Phone of Local Host):
   - MUST search for local host contact phone number
   - Search: organization website contact pages, member directory, local chapter pages
   - Format: phone number with country code (e.g., "+84 123 456 7890")
   - If empty, add "Missing localHostPhone" to problems array

6. **localStrengths** (Local Strengths & Weaknesses):
   - MUST analyze BOTH strengths AND weaknesses for Vietnam market
   - Format: "Strengths: [3-5 advantages]. Weaknesses: [2-3 challenges]"
   - This field is CRITICAL for understanding Vietnam's competitive position
   - If empty, add "Missing localStrengths" to problems array

7. **layout** (Layout Event):
   - MUST provide detailed event layout specifications
   - Format: "Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [poster area, networking space, registration area, catering areas, etc.]"
   - Include ALL space requirements: plenary hall, breakout rooms, exhibition, poster sessions, networking areas, registration, catering
   - This field is CRITICAL for venue matching
   - If empty, add "Missing layout" to problems array

8. **conferenceRegistration** (Conference Registration):
   - MUST include registration website URL, fees, deadlines, process, contact
   - Format: "Registration Website: [URL]. Registration Fees: [details]. Deadlines: [early bird date, regular deadline]. Process: [description]. Contact: [email/phone]"
   - Search event website for registration page, fees structure, deadlines, early bird dates, registration process, contact information
   - This field is CRITICAL for understanding event logistics
   - If empty, add "Missing conferenceRegistration" to problems array

INPUT DATA:
${leadsData}

STEP 1: EXTRACT EVENT NAME
---------------------------
Find the EVENT NAME in the input data. Check fields: "EVENT", "Event Name", "Event", "Series", "SERIES", "Event Series".
CRITICAL: Use the EXACT event name as "companyName" in JSON output. Do NOT use organization name or modify the name.

STEP 2: CALCULATE SCORES (Strict Rules)
----------------------------------------
Apply these exact scoring rules (NOTE: Backend scoring engine will recalculate scores automatically, but you should calculate them here for the report):

History Score (0-25):
- 25 points: Event has been held in Vietnam (vietnamEvents >= 1)
- 15 points: Event has been held in Southeast Asia (Thailand, Singapore, Malaysia, Indonesia, Philippines, Cambodia, Laos, Myanmar)
- 0 points: No Vietnam/SEA history

Region Score (0-25):
- 25 points: Event name contains "ASEAN", "Asia", "Pacific", "Eastern", "APAC", "Asian"
- 15 points: Event locations are primarily in Asian countries
- 0 points: No regional indicators

Contact Score (0-25):
- 25 points: Has both email (keyPersonEmail) AND phone (keyPersonPhone)
- 15 points: Has email (keyPersonEmail) only
- 0 points: Missing both email and phone

Delegates Score (0-25):
- 25 points: numberOfDelegates >= 500
- 20 points: numberOfDelegates >= 300
- 10 points: numberOfDelegates >= 100
- 0 points: numberOfDelegates < 100 or null

Total Score = History Score + Region Score + Contact Score + Delegates Score (0-100)

STEP 3: ENRICH MISSING DATA (CRITICAL - RESEARCH ALL FIELDS)
-------------------------------------------------------------
**MANDATORY**: You MUST actively research and fill ALL fields below. Use your knowledge base to find real information. Only use empty string "" if you truly cannot find any information after thorough research.

REQUIRED FIELDS (must provide, use empty string "" if truly not found):
- companyName: EXACT event name from input (REQUIRED, never empty)
- industry: Infer from event name, organization type, or event category
- country: Extract from event location data or infer from organization
- city: Extract from event location data or infer from organization
- website: **RESEARCH**: Search for official organization/event website URL
- keyPersonName: **RESEARCH**: Search for President/Director/Secretary General/Executive Director name
- keyPersonTitle: **RESEARCH**: Search for actual title (e.g., "Secretary General", "President")
- keyPersonEmail: **RESEARCH**: Search for official email (info@, contact@, or person-specific format)
- keyPersonPhone: **RESEARCH**: Search for official phone number from organization website
- numberOfDelegates: Extract from TOTATTEND/REGATTEND fields or infer from event size
- vietnamEvents: Count events in Vietnam from pastEventsHistory
- totalEvents: Count total events from pastEventsHistory
- pastEventsHistory: Format as "YEAR: City, Country; YEAR: City, Country"

EVENT BRIEF FIELDS (MUST RESEARCH COMPREHENSIVELY):
- eventName: Full event name with year
- eventSeries: Series name without year
- industry: Same as top-level industry
- averageAttendance: Average from numberOfDelegates or history
- openYear: **⚠️ RESEARCH MANDATORY**: Year organization/event was established - MUST search organization history, founding year, first event year, "established in", "founded in", "since [year]". This field is CRITICAL and must NOT be empty. If empty, add "Missing openYear" to problems array.
- frequency: "annually", "biennially", "triennially", or "irregular" - infer from pastEventsHistory
- rotationArea: "APAC", "Global", "Asia Pacific", "Regional", etc. - infer from pastEventsHistory
- rotationPattern: Describe rotation pattern if known from history
- duration: Typical duration (e.g., "3 days", "5 days") - infer from industry standards
- preferredMonths: Preferred months from history (e.g., "March-June")
- preferredVenue: Venue type preference - infer from event size
- breakoutRooms: **RESEARCH**: Number of breakout rooms needed - infer from event size (300-500 delegates = "5-7 rooms", 500-1000 = "8-12 rooms", 1000+ = "15+ rooms")
- roomSizes: **RESEARCH**: Size range - infer from event size (medium = "200-300 sqm main hall, 50-80 sqm breakout rooms", large = "500-800 sqm main hall, 100-150 sqm breakout")
- infoOnLastUpcomingEvents: **RESEARCH MANDATORY**: MUST provide comprehensive details about last event AND upcoming event(s). Format: "Last Event: [Year] - [City, Country] - [Attendance] delegates - [Key details]. Upcoming Event: [Year] - [City, Country] - [Expected attendance] - [Key details]". Include dates, locations, attendance numbers, and any relevant information. This field is CRITICAL and must NOT be empty.
- eventHistory: Detailed history with years, locations, attendance numbers
- delegatesProfile: Who attends (e.g., "Doctors & scientists", "Industry professionals")
- internationalOrganisationName: Full organization name - research official name
- internationalOrganisationWebsite: Organization website URL - research official website
- organizationProfile: Organization description - research organization background
- localHostName: **⚠️ RESEARCH MANDATORY**: Name of Local Host / Member - MUST research local chapter/host name or member organization name. If event has been in Vietnam, find the actual local host. If not, research potential local host organization or member. Search organization website for "local chapter", "member", "host", "Vietnam chapter", "[country] chapter". Format: "Full Name" or "Organization Name". This field is CRITICAL and must NOT be empty. If empty, add "Missing localHostName" to problems array.
- localHostTitle: **⚠️ RESEARCH MANDATORY**: Local host title/position - MUST find actual title. Search organization website, member directory, local chapter pages for "President", "Secretary General", "Chairman", "Executive Director", "Director". Format: "President" or "Secretary General" etc. This field is CRITICAL and must NOT be empty. If empty, add "Missing localHostTitle" to problems array.
- localHostEmail: **⚠️ RESEARCH MANDATORY**: Local host contact email - MUST search organization website, contact pages, member directory, local chapter pages, "[country] contact". Format: email address (e.g., "info@organization.org"). This field is CRITICAL and must NOT be empty. If empty, add "Missing localHostEmail" to problems array.
- localHostPhone: **⚠️ RESEARCH MANDATORY**: Local host contact phone number - MUST search organization website, contact pages, member directory, local chapter pages. Format: phone number with country code (e.g., "+84 123 456 7890"). This field is CRITICAL and must NOT be empty. If empty, add "Missing localHostPhone" to problems array.
- localHostOrganization: **RESEARCH**: Local host organization name (if different from international organization)
- localHostWebsite: **RESEARCH**: Local host website URL
- localStrengths: **RESEARCH MANDATORY**: Local market strengths & weaknesses for Vietnam - MUST include BOTH strengths AND weaknesses. Format: "Strengths: [list 3-5 key advantages Vietnam offers for this event, e.g., Growing economy, strategic location in SEA, modern infrastructure, competitive costs, skilled workforce]. Weaknesses: [list 2-3 challenges, e.g., Limited international connectivity compared to Singapore/Thailand, visa requirements, language barriers]". This field is CRITICAL and must analyze Vietnam's suitability comprehensively.
- decisionMaker: Who decides venue (e.g., "Local host", "International board")
- decisionMakingProcess: How decisions are made
- keyBidCriteria: Key venue selection criteria
- competitors: **RESEARCH**: Known competing venues/destinations - research where similar events have been held (e.g., "Competitors: Singapore, Thailand venues. Past venues: Marina Bay Sands, Bangkok Convention Centre")
- competitiveAnalysis: **RESEARCH**: Competitive landscape analysis - compare Vietnam with competing destinations
- hostResponsibility: Who organizes
- sponsors: **RESEARCH**: Known or typical sponsors for this type of event - research past sponsors or typical sponsors (e.g., "Diamond: Company1; Gold: Company2" or "Typical sponsors: Medical device companies")
- layout: **RESEARCH MANDATORY**: Event layout requirements - MUST provide detailed layout specifications. Format: "Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [poster area, networking space, registration area, etc.]". Include all space requirements: plenary hall, breakout rooms, exhibition, poster sessions, networking areas, registration, catering areas. This field is CRITICAL for venue matching.
- fitForAriyana: Why event fits Ariyana (capacity, location, facilities)
- conferenceRegistration: **RESEARCH MANDATORY**: Conference registration details - MUST include registration website URL, registration fees (if available), registration deadlines, early bird dates, registration process, and contact information for registration inquiries. Format: "Registration Website: [URL]. Registration Fees: [details]. Deadlines: [early bird date, regular deadline]. Process: [description]. Contact: [email/phone]". This field is CRITICAL for understanding event logistics.
- opportunityScore: 0-100 opportunity score
- iccaQualified: **RESEARCH**: "yes" or "no" with brief explanation - check if event meets ICCA qualification criteria

STEP 4: VALIDATE PROBLEMS ARRAY
--------------------------------
List ONLY fields that are truly missing AFTER enrichment. **CRITICAL**: You MUST add problems for mandatory fields if they are empty:

MANDATORY FIELD VALIDATION (MUST CHECK ALL):
- "Missing openYear" - if openYear field is empty or null (must be a number)
- "Missing localHostName" - if localHostName field is empty or doesn't contain a name
- "Missing localHostTitle" - if localHostTitle field is empty or doesn't contain a title
- "Missing localHostEmail" - if localHostEmail field is empty or doesn't contain an email address
- "Missing localHostPhone" - if localHostPhone field is empty or doesn't contain a phone number
- "Missing localStrengths" - if localStrengths field is empty or doesn't include BOTH "Strengths:" AND "Weaknesses:"
- "Missing layout" - if layout field is empty or doesn't include plenary hall, breakout rooms, and exhibition specifications
- "Missing conferenceRegistration" - if conferenceRegistration field is empty or doesn't include website, fees, deadlines, and process

OTHER FIELDS (only if not found after research):
- "Missing keyPersonEmail" - only if email not found
- "Missing keyPersonPhone" - only if phone not found
- "Missing keyPersonName" - only if name not found
- "Missing website" - only if website not found
- "Missing industry" - only if cannot infer
- "Missing location" - only if country/city cannot be determined
- "No numberOfDelegates data" - only if truly unavailable
- "Incomplete event history" - only if history is incomplete

DO NOT list problems for fields you successfully enriched.

STEP 5: OUTPUT FORMAT
---------------------
Output MUST follow this exact structure:

PART A: Event Evaluation Summary
[Brief 2-3 sentence summary of event suitability]

PART B: Scoring Breakdown
- Total Score: [calculated total]
- History Score: [calculated] - [explanation]
- Region Score: [calculated] - [explanation]
- Contact Score: [calculated] - [explanation]
- Delegates Score: [calculated] - [explanation]

PART C: Next Steps
[Action plan for pursuing this event]

PART C: JSON Output
\`\`\`json
[{
  "companyName": "[EXACT event name from input - REQUIRED]",
  "industry": "[string or empty string]",
  "country": "[string or empty string]",
  "city": "[string or empty string]",
  "website": "[string or empty string]",
  "keyPersonName": "[string or empty string]",
  "keyPersonTitle": "[string or empty string]",
  "keyPersonEmail": "[string or empty string]",
  "keyPersonPhone": "[string or empty string]",
  "vietnamEvents": [number],
  "totalEvents": [number],
  "numberOfDelegates": [number or null],
  "totalScore": [0-100],
  "historyScore": [0-25],
  "regionScore": [0-25],
  "contactScore": [0-25],
  "delegatesScore": [0-25],
  "problems": ["array of missing fields"],
  "notes": "[Brief insights. If enriched: '[AI Enriched: fields found]']",
  "pastEventsHistory": "[YEAR: City, Country; YEAR: City, Country]",
  "nextStepStrategy": "[Action plan]",
  "status": "New",
  "eventBrief": {
    "eventName": "[string]",
    "eventSeries": "[string]",
    "industry": "[string]",
    "averageAttendance": [number],
    "openYear": [number or null - ⚠️ MANDATORY: Must research organization founding year or first event year. If empty, add "Missing openYear" to problems array],
    "frequency": "[string]",
    "rotationArea": "[string]",
    "rotationPattern": "[string]",
    "duration": "[string]",
    "preferredMonths": "[string]",
    "preferredVenue": "[string]",
    "breakoutRooms": "[string]",
    "roomSizes": "[string]",
    "infoOnLastUpcomingEvents": "[string - RESEARCH MANDATORY: MUST NOT BE EMPTY. Format: 'Last Event: [Year] - [City, Country] - [Attendance] delegates - [Key details]. Upcoming Event: [Year] - [City, Country] - [Expected attendance] - [Key details]']",
    "eventHistory": "[string]",
    "delegatesProfile": "[string]",
    "internationalOrganisationName": "[string]",
    "internationalOrganisationWebsite": "[string]",
    "organizationProfile": "[string]",
    "localHostName": "[string - ⚠️ MANDATORY: Name of Local Host / Member - MUST NOT BE EMPTY. Research local chapter/host name or member organization name. If event in Vietnam, find actual host. If not, research potential host/member. If empty, add 'Missing localHostName' to problems array]",
    "localHostTitle": "[string - ⚠️ MANDATORY: Local host title/position - MUST NOT BE EMPTY. Find actual title like 'President', 'Secretary General', 'Chairman', 'Executive Director'. If empty, add 'Missing localHostTitle' to problems array]",
    "localHostEmail": "[string - ⚠️ MANDATORY: Local host contact email - MUST NOT BE EMPTY. Search organization website, contact pages, member directory, local chapter pages. Format: email address. If empty, add 'Missing localHostEmail' to problems array]",
    "localHostPhone": "[string - ⚠️ MANDATORY: Local host contact phone - MUST NOT BE EMPTY. Search organization website, contact pages, member directory. Format: phone with country code. If empty, add 'Missing localHostPhone' to problems array]",
    "localHostOrganization": "[string - RESEARCH: Local host organization name (if different from international organization)]",
    "localHostWebsite": "[string - RESEARCH: Local host website URL]",
    "localStrengths": "[string - ⚠️ MANDATORY: Must include BOTH Strengths AND Weaknesses - MUST NOT BE EMPTY. Format: 'Strengths: [3-5 advantages Vietnam offers for this event, e.g., Growing economy, strategic location in SEA, modern infrastructure, competitive costs, skilled workforce]. Weaknesses: [2-3 challenges, e.g., Limited international connectivity compared to Singapore/Thailand, visa requirements, language barriers]'. If empty, add 'Missing localStrengths' to problems array]",
    "decisionMaker": "[string]",
    "decisionMakingProcess": "[string]",
    "keyBidCriteria": "[string]",
    "competitors": "[string]",
    "competitiveAnalysis": "[string]",
    "hostResponsibility": "[string]",
    "sponsors": "[string]",
    "layout": "[string - ⚠️ MANDATORY: Detailed event layout requirements - MUST NOT BE EMPTY. Format: 'Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [poster area, networking space, registration area, catering areas, etc.]'. Must include ALL: plenary hall, breakout rooms, exhibition, poster sessions, networking areas, registration, catering. If empty, add 'Missing layout' to problems array]",
    "fitForAriyana": "[string]",
    "conferenceRegistration": "[string - ⚠️ MANDATORY: Registration website, fees, deadlines, process - MUST NOT BE EMPTY. Format: 'Registration Website: [URL]. Registration Fees: [details including early bird, regular, student rates if available]. Deadlines: [early bird date, regular deadline, late registration deadline]. Process: [description of registration steps]. Contact: [email/phone for registration inquiries]'. Must include website URL, fees structure, deadlines, registration process, and contact information. If empty, add 'Missing conferenceRegistration' to problems array]",
    "opportunityScore": [0-100],
    "iccaQualified": "[string - RESEARCH: 'yes' or 'no' with explanation]"
  }
}]
\`\`\`

CRITICAL RESEARCH REQUIREMENTS:
1. **MANDATORY FIELDS TO RESEARCH** (MUST NOT BE EMPTY):
   - openYear: MUST research organization founding year or first event year - search "established in", "founded in", "since [year]", organization history
   - localHostName: MUST find Name of Local Host / Member - search "local chapter", "member", "host", "Vietnam chapter", "[country] chapter"
   - localHostTitle: MUST find Local Host title - search for "President", "Secretary General", "Chairman", "Executive Director" in member directory or local chapter pages
   - localHostEmail: MUST search for local host email - check organization website contact pages, member directory, local chapter pages
   - localHostPhone: MUST search for local host phone - check organization website contact pages, member directory, local chapter pages
   - localStrengths: MUST include BOTH Strengths AND Weaknesses for Vietnam
   - layout: MUST provide detailed layout specifications (plenary hall, breakout rooms, exhibition, etc.)
   - conferenceRegistration: MUST provide registration website, fees, deadlines, process
   - infoOnLastUpcomingEvents: MUST provide last event AND upcoming event details with dates, locations, attendance
   - breakoutRooms, roomSizes, keyPersonEmail, keyPersonPhone, competitors, sponsors, iccaQualified
2. For breakoutRooms: Infer from event size (300-500 delegates = 5-7 rooms, 500-1000 = 8-12 rooms, 1000+ = 15+ rooms)
3. For roomSizes: Infer from event size (medium = "200-300 sqm main hall, 50-80 sqm breakout", large = "500-800 sqm main hall, 100-150 sqm breakout")
4. For openYear: ⚠️ MANDATORY - MUST search organization founding year or first event year. Search: organization website "About" page, "History" page, "established in", "founded in", "since [year]", Wikipedia, organization profile. This is CRITICAL and must NOT be empty.
5. For keyPersonEmail/Phone: Search organization website contact pages
6. For infoOnLastUpcomingEvents: MUST provide comprehensive details - last event: year, city, country, attendance; upcoming event: year, city, country, expected attendance. This is CRITICAL information.
7. For localHostName: ⚠️ MANDATORY - MUST search for local chapter/host organization name or member name. Check organization website for "local chapter", "member", "host", "Vietnam chapter", "[country] chapter", member directory, local chapters page. If event has been in Vietnam, find actual host. If not, research potential host/member organization. This is CRITICAL and must NOT be empty.
8. For localHostTitle: ⚠️ MANDATORY - MUST find Local Host title. Search organization website, member directory, local chapter pages for titles like "President", "Secretary General", "Chairman", "Executive Director", "Director". This is CRITICAL and must NOT be empty.
9. For localHostEmail: ⚠️ MANDATORY - MUST search organization website contact pages, member directories, local chapter pages, "[country] contact" for email address. Format: email address (e.g., "info@organization.org"). This is CRITICAL and must NOT be empty.
10. For localHostPhone: ⚠️ MANDATORY - MUST search organization website contact pages, member directories, local chapter pages for phone number. Format: phone with country code (e.g., "+84 123 456 7890"). This is CRITICAL and must NOT be empty.
11. For localStrengths: ⚠️ MANDATORY - MUST analyze BOTH strengths (advantages Vietnam offers) AND weaknesses (challenges). Format: "Strengths: [3-5 advantages]. Weaknesses: [2-3 challenges]". This is CRITICAL and must NOT be empty.
10. For layout: MUST provide detailed specifications: plenary hall capacity and size, number and capacity of breakout rooms, exhibition area size and booth count, additional spaces (poster, networking, registration, catering)
11. For conferenceRegistration: Search event website for registration page, fees, deadlines, early bird dates, registration process, contact information
12. For competitors: Research where similar events have been held
13. For sponsors: Research past sponsors or typical sponsors in this industry
14. For iccaQualified: Check if event meets ICCA criteria (international association, rotating, significant international participation)

CRITICAL OUTPUT REQUIREMENTS:
1. companyName MUST be the EXACT event name from input data
2. All string fields must be strings (use "" for empty, never null)
3. All number fields must be numbers (use 0 or null, never empty string)
4. problems array must list ONLY truly missing fields AFTER research
5. JSON MUST be valid and parseable
6. Include enrichment notes in "notes" field: List all researched fields (e.g., "[AI Enriched: infoOnLastUpcomingEvents, localHostName, localHostEmail, localHostPhone, localStrengths, layout, conferenceRegistration, breakoutRooms, roomSizes, openYear, email, phone, competitors, sponsors, iccaQualified]")
7. **CRITICAL**: The following fields MUST be researched and filled comprehensively - they are MANDATORY and should NOT be empty unless truly unavailable after thorough research:
   - openYear (organization founding year or first event year)
   - localHostName (Name of Local Host / Member)
   - localHostTitle (Title/Position of Local Host)
   - localHostEmail (contact email)
   - localHostPhone (contact phone)
   - localStrengths (Strengths AND Weaknesses)
   - layout (detailed layout specifications)
   - conferenceRegistration (registration details)
   - infoOnLastUpcomingEvents (last event + upcoming event details)

8. **VALIDATION CHECKLIST** - Before outputting JSON, verify ALL these fields are filled:
   ✓ localHostName: Is there a name? (If event in Vietnam, find actual host. If not, research potential host/member)
   ✓ localHostTitle: Is there a title? (Search for President, Secretary General, Chairman, etc.)
   ✓ localHostEmail: Is there an email? (Search organization website, contact pages, member directory)
   ✓ localHostPhone: Is there a phone? (Search organization website, contact pages)
   ⚠️ **CRITICAL MANDATORY FIELDS** - These MUST be filled or added to problems array:
   ✓ openYear: Is there a number (year)? (If NO → add "Missing openYear" to problems)
   ✓ localHostName: Is there a name? (If event in Vietnam, find actual host. If not, research potential host/member. If NO → add "Missing localHostName" to problems)
   ✓ localHostTitle: Is there a title? (Search for President, Secretary General, Chairman, etc. If NO → add "Missing localHostTitle" to problems)
   ✓ localHostEmail: Is there an email? (Search organization website, contact pages, member directory. If NO → add "Missing localHostEmail" to problems)
   ✓ localHostPhone: Is there a phone? (Search organization website, contact pages. If NO → add "Missing localHostPhone" to problems)
   ✓ localStrengths: Does it include BOTH "Strengths:" AND "Weaknesses:"? (If NO → add "Missing localStrengths" to problems)
   ✓ layout: Does it include plenary hall capacity/size, breakout rooms number/capacity/size, exhibition area booths/size, and additional spaces? (If NO → add "Missing layout" to problems)
   ✓ conferenceRegistration: Does it include website URL, fees, deadlines, process, and contact? (If NO → add "Missing conferenceRegistration" to problems)
   ✓ infoOnLastUpcomingEvents: Does it include both last event AND upcoming event details?

**FINAL CHECK**: Before outputting JSON, verify that ALL mandatory fields are NOT empty:
- openYear (must be a number)
- localHostName (must have a name)
- localHostTitle (must have a title)
- localHostEmail (must have an email)
- localHostPhone (must have a phone)
- localStrengths (must include BOTH Strengths AND Weaknesses)
- layout (must include detailed specifications)
- conferenceRegistration (must include website, fees, deadlines, process)

If ANY of these fields is empty or incomplete, you MUST:
1. Research more thoroughly using the search strategies provided
2. Add the corresponding "Missing [field]" to the problems array
3. Only output JSON after ensuring these fields are filled or properly flagged in problems array`;
}

/**
 * OpenAI prompt. Moved verbatim from api/src/routes/gpt.ts:226-571.
 * Differs from Gemini variant in tone (accuracy-focused) and exact phrasing.
 */
export function buildOpenaiStrategicAnalysisPrompt(args: StrategicAnalysisArgs): string {
  const { leadsData } = args;
  return `EVENT ANALYSIS FOR ARIYANA CONVENTION CENTRE DANANG
====================================================

⚠️ CRITICAL ACCURACY REQUIREMENT:
You MUST provide ONLY FACTUAL, VERIFIED information. NEVER guess, invent, or hallucinate data.
If information is not available after thorough research, use empty string "" for strings or null for numbers.
Incorrect data is WORSE than missing data. Accuracy is paramount.

TASK: Analyze ONE SPECIFIC EVENT from imported data. Evaluate suitability and enrich missing information with ACCURATE, VERIFIED data only.

⚠️ CRITICAL MANDATORY FIELDS - MUST BE RESEARCHED AND FILLED:
---------------------------------------------------------------
The following fields are ABSOLUTELY REQUIRED and MUST NOT be empty. You MUST research thoroughly and provide comprehensive information. If any field is empty after research, you MUST add it to the problems array.

1. **openYear** (Open Year):
   - MUST research and find the year the organization/event was established
   - Search: organization founding year, first event year, organization history, "established in", "founded in", "since [year]"
   - Format: [number] (e.g., 1995, 2000, 2010)
   - If empty, add "Missing openYear" to problems array

2. **localHostName** (Name of Local Host / Member):
   - MUST find the name of Local Host / Member organization or person
   - If event has been in Vietnam: find the actual local host name
   - If event has NOT been in Vietnam: research potential local host/member organization name
   - Search: organization website for "local chapter", "member", "host", "Vietnam chapter", "[country] chapter"
   - Format: "Full Name" or "Organization Name"
   - If empty, add "Missing localHostName" to problems array

3. **localHostTitle** (Title of Local Host):
   - MUST find the title/position of the Local Host
   - Search: organization website, member directory, local chapter pages for titles like "President", "Secretary General", "Chairman", "Executive Director", "Director"
   - Format: "President" or "Secretary General" or "Chairman" etc.
   - If empty, add "Missing localHostTitle" to problems array

4. **localHostEmail** (Email of Local Host):
   - MUST search for local host contact email
   - Search: organization website contact pages, member directory, local chapter pages, "[country] contact"
   - Format: email address (e.g., "info@organization.org" or "president@organization.org")
   - If empty, add "Missing localHostEmail" to problems array

5. **localHostPhone** (Phone of Local Host):
   - MUST search for local host contact phone number
   - Search: organization website contact pages, member directory, local chapter pages
   - Format: phone number with country code (e.g., "+84 123 456 7890")
   - If empty, add "Missing localHostPhone" to problems array

6. **localStrengths** (Local Strengths & Weaknesses):
   - MUST analyze BOTH strengths AND weaknesses for Vietnam market
   - Format: "Strengths: [3-5 advantages]. Weaknesses: [2-3 challenges]"
   - This field is CRITICAL for understanding Vietnam's competitive position
   - If empty, add "Missing localStrengths" to problems array

7. **layout** (Layout Event):
   - MUST provide detailed event layout specifications
   - Format: "Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [poster area, networking space, registration area, catering areas, etc.]"
   - Include ALL space requirements: plenary hall, breakout rooms, exhibition, poster sessions, networking areas, registration, catering
   - This field is CRITICAL for venue matching
   - If empty, add "Missing layout" to problems array

8. **conferenceRegistration** (Conference Registration):
   - MUST include registration website URL, fees, deadlines, process, contact
   - Format: "Registration Website: [URL]. Registration Fees: [details]. Deadlines: [early bird date, regular deadline]. Process: [description]. Contact: [email/phone]"
   - Search event website for registration page, fees structure, deadlines, early bird dates, registration process, contact information
   - This field is CRITICAL for understanding event logistics
   - If empty, add "Missing conferenceRegistration" to problems array

INPUT DATA:
${leadsData}

STEP 1: EXTRACT EVENT NAME
---------------------------
Find EVENT NAME in input data (check: "EVENT", "Event Name", "Series", "SERIES").
CRITICAL: Use EXACT event name as "companyName". Do NOT use organization name or modify name.

STEP 2: CALCULATE SCORES (Apply Exact Rules)
---------------------------------------------
NOTE: Backend scoring engine will recalculate scores automatically, but you should calculate them here for the report.
History Score (0-25):
- 25: vietnamEvents >= 1
- 15: Events in Southeast Asia (Thailand, Singapore, Malaysia, Indonesia, Philippines, Cambodia, Laos, Myanmar)
- 0: No Vietnam/SEA history

Region Score (0-25):
- 25: Name contains "ASEAN", "Asia", "Pacific", "Eastern", "APAC", "Asian"
- 15: Locations primarily in Asian countries
- 0: No regional indicators

Contact Score (0-25):
- 25: Has keyPersonEmail AND keyPersonPhone
- 15: Has keyPersonEmail only
- 0: Missing both

Delegates Score (0-25):
- 25: numberOfDelegates >= 500
- 20: numberOfDelegates >= 300
- 10: numberOfDelegates >= 100
- 0: numberOfDelegates < 100 or null

Total Score = Sum of all scores (0-100)

STEP 3: ENRICH MISSING DATA (CRITICAL - RESEARCH ALL FIELDS)
-------------------------------------------------------------
**MANDATORY**: You MUST actively research and fill ALL fields below. Use your knowledge base to find real information. Only use empty string "" if you truly cannot find any information after thorough research.

REQUIRED TOP-LEVEL FIELDS:
- companyName: EXACT event name from input (REQUIRED, never empty)
- industry: Infer from event name/organization type or research organization
- country: Extract from location or infer from organization headquarters
- city: Extract from location or infer from organization headquarters
- website: **RESEARCH**: Search for official organization/event website URL
- keyPersonName: **RESEARCH**: Search for President/Director/Secretary General/Executive Director name
- keyPersonTitle: **RESEARCH**: Find actual title (e.g., "Secretary General", "President", "Executive Director")
- keyPersonEmail: **RESEARCH**: Search for official email (info@, contact@, or person-specific format like firstname.lastname@org-domain)
- keyPersonPhone: **RESEARCH**: Search for official phone number from organization website or contact pages
- numberOfDelegates: Extract from TOTATTEND/REGATTEND fields or infer from event size/history
- vietnamEvents: Count events in Vietnam from pastEventsHistory
- totalEvents: Count total events from pastEventsHistory
- pastEventsHistory: Format "YEAR: City, Country; YEAR: City, Country"

EVENT BRIEF FIELDS (MUST RESEARCH COMPREHENSIVELY):
- eventName: Full name with year
- eventSeries: Series name without year
- industry: Same as top-level
- averageAttendance: Average from numberOfDelegates/history
- openYear: **⚠️ RESEARCH MANDATORY**: Year organization/event was established - MUST search organization history, founding year, first event year, "established in", "founded in", "since [year]". This field is CRITICAL and must NOT be empty. If empty, add "Missing openYear" to problems array.
- frequency: "annually", "biennially", "triennially", "irregular" - infer from pastEventsHistory
- rotationArea: "APAC", "Global", "Asia Pacific", etc. - infer from pastEventsHistory
- rotationPattern: Describe rotation pattern if known from history
- duration: Typical duration (e.g., "3 days", "5 days") - infer from industry standards or history
- preferredMonths: Preferred months from history (e.g., "March-June")
- preferredVenue: Venue type preference - infer from event size and type
- breakoutRooms: **RESEARCH**: Number of breakout rooms needed - infer from event size (e.g., "5-7 rooms" for 300-500 delegates, "8-12 rooms" for 500-1000 delegates, "15+ rooms" for 1000+ delegates)
- roomSizes: **RESEARCH**: Size specifications - infer from event size (e.g., "200-300 sqm main hall, 50-80 sqm breakout rooms" for medium events, "500-800 sqm main hall, 100-150 sqm breakout" for large events)
- infoOnLastUpcomingEvents: **RESEARCH MANDATORY**: MUST provide comprehensive details about last event AND upcoming event(s). Format: "Last Event: [Year] - [City, Country] - [Attendance] delegates - [Key details]. Upcoming Event: [Year] - [City, Country] - [Expected attendance] - [Key details]". Include dates, locations, attendance numbers, and any relevant information. This field is CRITICAL and must NOT be empty.
- eventHistory: Detailed history with years, locations, attendance numbers
- delegatesProfile: Who attends (e.g., "Doctors & scientists", "Industry professionals", "Researchers")
- internationalOrganisationName: Full organization name - research official name
- internationalOrganisationWebsite: Organization website URL - research official website
- organizationProfile: Organization description - research organization background, mission, scope
- localHostName: **⚠️ RESEARCH MANDATORY**: Name of Local Host / Member - MUST research local chapter/host name or member organization name. If event has been in Vietnam, find the actual local host. If not, research potential local host organization or member. Search organization website for "local chapter", "member", "host", "Vietnam chapter", "[country] chapter". Format: "Full Name" or "Organization Name". This field is CRITICAL and must NOT be empty. If empty, add "Missing localHostName" to problems array.
- localHostTitle: **⚠️ RESEARCH MANDATORY**: Local host title/position - MUST find actual title. Search organization website, member directory, local chapter pages for "President", "Secretary General", "Chairman", "Executive Director", "Director". Format: "President" or "Secretary General" etc. This field is CRITICAL and must NOT be empty. If empty, add "Missing localHostTitle" to problems array.
- localHostEmail: **⚠️ RESEARCH MANDATORY**: Local host contact email - MUST search organization website, contact pages, member directory, local chapter pages, "[country] contact". Format: email address (e.g., "info@organization.org"). This field is CRITICAL and must NOT be empty. If empty, add "Missing localHostEmail" to problems array.
- localHostPhone: **⚠️ RESEARCH MANDATORY**: Local host contact phone number - MUST search organization website, contact pages, member directory, local chapter pages. Format: phone number with country code (e.g., "+84 123 456 7890"). This field is CRITICAL and must NOT be empty. If empty, add "Missing localHostPhone" to problems array.
- localHostOrganization: **RESEARCH**: Local host organization name (if different from international organization)
- localHostWebsite: **RESEARCH**: Local host website URL
- localStrengths: **RESEARCH MANDATORY**: Local market strengths & weaknesses for Vietnam - MUST include BOTH strengths AND weaknesses. Format: "Strengths: [list 3-5 key advantages Vietnam offers for this event, e.g., Growing economy, strategic location in SEA, modern infrastructure, competitive costs, skilled workforce]. Weaknesses: [list 2-3 challenges, e.g., Limited international connectivity compared to Singapore/Thailand, visa requirements, language barriers]". This field is CRITICAL and must analyze Vietnam's suitability comprehensively.
- decisionMaker: Who decides venue (e.g., "Local host", "International board", "DMC")
- decisionMakingProcess: How decisions are made (e.g., "Local host works with DMC, DMC sorts venues and conducts site inspection")
- keyBidCriteria: Key venue selection criteria (e.g., "Venue capacity & breakout rooms, Connectivity, Location accessibility")
- competitors: **RESEARCH**: Known competing venues/destinations - research where similar events have been held (e.g., "Competitors: Singapore, Thailand, Malaysia venues. Past venues: Marina Bay Sands, Bangkok Convention Centre")
- competitiveAnalysis: **RESEARCH**: Competitive landscape analysis - compare Vietnam/Danang with competing destinations
- hostResponsibility: Who organizes (e.g., "Organising Committee, responsible for selection of destination, venue and event plan")
- sponsors: **RESEARCH**: Known or typical sponsors for this type of event - research past sponsors or typical sponsors in this industry (e.g., "Diamond: Company1; Gold: Company2; Silver: Company3" or "Typical sponsors: Medical device companies, pharmaceutical companies")
- layout: **RESEARCH MANDATORY**: Event layout requirements - MUST provide detailed layout specifications. Format: "Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [poster area, networking space, registration area, etc.]". Include all space requirements: plenary hall, breakout rooms, exhibition, poster sessions, networking areas, registration, catering areas. This field is CRITICAL for venue matching.
- fitForAriyana: Why event fits Ariyana (capacity match, location advantages, facilities)
- conferenceRegistration: **RESEARCH MANDATORY**: Conference registration details - MUST include registration website URL, registration fees (if available), registration deadlines, early bird dates, registration process, and contact information for registration inquiries. Format: "Registration Website: [URL]. Registration Fees: [details]. Deadlines: [early bird date, regular deadline]. Process: [description]. Contact: [email/phone]". This field is CRITICAL for understanding event logistics.
- opportunityScore: 0-100 opportunity score
- iccaQualified: **RESEARCH**: "yes" or "no" with brief explanation - check if event meets ICCA qualification criteria (international association meetings, rotating conferences, significant international participation)

STEP 4: VALIDATE PROBLEMS
--------------------------
List ONLY fields truly missing AFTER enrichment. **CRITICAL**: You MUST add problems for mandatory fields if they are empty:

MANDATORY FIELD VALIDATION (MUST CHECK ALL):
- "Missing openYear" - if openYear field is empty or null (must be a number)
- "Missing localHostName" - if localHostName field is empty or doesn't contain a name
- "Missing localHostTitle" - if localHostTitle field is empty or doesn't contain a title
- "Missing localHostEmail" - if localHostEmail field is empty or doesn't contain an email address
- "Missing localHostPhone" - if localHostPhone field is empty or doesn't contain a phone number
- "Missing localStrengths" - if localStrengths field is empty or doesn't include BOTH "Strengths:" AND "Weaknesses:"
- "Missing layout" - if layout field is empty or doesn't include plenary hall, breakout rooms, and exhibition specifications
- "Missing conferenceRegistration" - if conferenceRegistration field is empty or doesn't include website, fees, deadlines, and process

OTHER FIELDS (only if not found after research):
- "Missing keyPersonEmail" (only if not found)
- "Missing keyPersonPhone" (only if not found)
- "Missing keyPersonName" (only if not found)
- "Missing website" (only if not found)
- "Missing industry" (only if cannot infer)
- "Missing location" (only if cannot determine)
- "No numberOfDelegates data" (only if unavailable)
- "Incomplete event history" (only if incomplete)

DO NOT list problems for successfully enriched fields.

STEP 5: OUTPUT FORMAT
---------------------
Output structure:

PART A: Event Evaluation Summary
[2-3 sentence summary]

PART B: Scoring Breakdown
- Total Score: [number]
- History Score: [number] - [explanation]
- Region Score: [number] - [explanation]
- Contact Score: [number] - [explanation]
- Delegates Score: [number] - [explanation]

PART C: Next Steps
[Action plan]

PART C: JSON Output
\`\`\`json
[{
  "companyName": "[EXACT event name - REQUIRED]",
  "industry": "[string or empty string]",
  "country": "[string or empty string]",
  "city": "[string or empty string]",
  "website": "[string or empty string]",
  "keyPersonName": "[string or empty string]",
  "keyPersonTitle": "[string or empty string]",
  "keyPersonEmail": "[string or empty string]",
  "keyPersonPhone": "[string or empty string]",
  "vietnamEvents": [number],
  "totalEvents": [number],
  "numberOfDelegates": [number or null],
  "totalScore": [0-100],
  "historyScore": [0-25],
  "regionScore": [0-25],
  "contactScore": [0-25],
  "delegatesScore": [0-25],
  "problems": ["array"],
  "notes": "[Brief. If enriched: '[AI Enriched: fields]']",
  "pastEventsHistory": "[YEAR: City, Country; ...]",
  "nextStepStrategy": "[Action plan]",
  "status": "New",
  "eventBrief": {
    "eventName": "[string]",
    "eventSeries": "[string]",
    "industry": "[string]",
    "averageAttendance": [number],
    "openYear": [number or null - ⚠️ MANDATORY: Must research organization founding year or first event year. If empty, add "Missing openYear" to problems array],
    "frequency": "[string]",
    "rotationArea": "[string]",
    "rotationPattern": "[string]",
    "duration": "[string]",
    "preferredMonths": "[string]",
    "preferredVenue": "[string]",
    "breakoutRooms": "[string]",
    "roomSizes": "[string]",
    "infoOnLastUpcomingEvents": "[string - RESEARCH MANDATORY: MUST NOT BE EMPTY. Format: 'Last Event: [Year] - [City, Country] - [Attendance] delegates - [Key details]. Upcoming Event: [Year] - [City, Country] - [Expected attendance] - [Key details]']",
    "eventHistory": "[string]",
    "delegatesProfile": "[string]",
    "internationalOrganisationName": "[string]",
    "internationalOrganisationWebsite": "[string]",
    "organizationProfile": "[string]",
    "localHostName": "[string - ⚠️ MANDATORY: Name of Local Host / Member - MUST NOT BE EMPTY. Research local chapter/host name or member organization name. If event in Vietnam, find actual host. If not, research potential host/member. If empty, add 'Missing localHostName' to problems array]",
    "localHostTitle": "[string - ⚠️ MANDATORY: Local host title/position - MUST NOT BE EMPTY. Find actual title like 'President', 'Secretary General', 'Chairman', 'Executive Director'. If empty, add 'Missing localHostTitle' to problems array]",
    "localHostEmail": "[string - ⚠️ MANDATORY: Local host contact email - MUST NOT BE EMPTY. Search organization website, contact pages, member directory, local chapter pages. Format: email address. If empty, add 'Missing localHostEmail' to problems array]",
    "localHostPhone": "[string - ⚠️ MANDATORY: Local host contact phone - MUST NOT BE EMPTY. Search organization website, contact pages, member directory. Format: phone with country code. If empty, add 'Missing localHostPhone' to problems array]",
    "localHostOrganization": "[string - RESEARCH: Local host organization name (if different from international organization)]",
    "localHostWebsite": "[string - RESEARCH: Local host website URL]",
    "localStrengths": "[string - ⚠️ MANDATORY: Must include BOTH Strengths AND Weaknesses - MUST NOT BE EMPTY. Format: 'Strengths: [3-5 advantages Vietnam offers for this event, e.g., Growing economy, strategic location in SEA, modern infrastructure, competitive costs, skilled workforce]. Weaknesses: [2-3 challenges, e.g., Limited international connectivity compared to Singapore/Thailand, visa requirements, language barriers]'. If empty, add 'Missing localStrengths' to problems array]",
    "decisionMaker": "[string]",
    "decisionMakingProcess": "[string]",
    "keyBidCriteria": "[string]",
    "competitors": "[string]",
    "competitiveAnalysis": "[string]",
    "hostResponsibility": "[string]",
    "sponsors": "[string - RESEARCH: Known or typical sponsors]",
    "layout": "[string - ⚠️ MANDATORY: Detailed event layout requirements - MUST NOT BE EMPTY. Format: 'Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [poster area, networking space, registration area, catering areas, etc.]'. Must include ALL: plenary hall, breakout rooms, exhibition, poster sessions, networking areas, registration, catering. If empty, add 'Missing layout' to problems array]",
    "fitForAriyana": "[string]",
    "conferenceRegistration": "[string - ⚠️ MANDATORY: Registration website, fees, deadlines, process - MUST NOT BE EMPTY. Format: 'Registration Website: [URL]. Registration Fees: [details including early bird, regular, student rates if available]. Deadlines: [early bird date, regular deadline, late registration deadline]. Process: [description of registration steps]. Contact: [email/phone for registration inquiries]'. Must include website URL, fees structure, deadlines, registration process, and contact information. If empty, add 'Missing conferenceRegistration' to problems array]",
    "opportunityScore": [0-100],
    "iccaQualified": "[string - RESEARCH: 'yes' or 'no' with explanation]"
  }
}]
\`\`\`

CRITICAL RESEARCH REQUIREMENTS:
1. **MANDATORY FIELDS TO RESEARCH** (MUST NOT BE EMPTY):
   - openYear: MUST research organization founding year or first event year - search "established in", "founded in", "since [year]", organization history
   - localHostName: MUST find Name of Local Host / Member - search "local chapter", "member", "host", "Vietnam chapter", "[country] chapter"
   - localHostTitle: MUST find Local Host title - search for "President", "Secretary General", "Chairman", "Executive Director" in member directory or local chapter pages
   - localHostEmail: MUST search for local host email - check organization website contact pages, member directory, local chapter pages
   - localHostPhone: MUST search for local host phone - check organization website contact pages, member directory, local chapter pages
   - localStrengths: MUST include BOTH Strengths AND Weaknesses for Vietnam
   - layout: MUST provide detailed layout specifications (plenary hall, breakout rooms, exhibition, etc.)
   - conferenceRegistration: MUST provide registration website, fees, deadlines, process
   - infoOnLastUpcomingEvents: MUST provide last event AND upcoming event details with dates, locations, attendance
   - breakoutRooms, roomSizes, keyPersonEmail, keyPersonPhone, competitors, sponsors, iccaQualified
2. For breakoutRooms: Infer from event size (300-500 delegates = 5-7 rooms, 500-1000 = 8-12 rooms, 1000+ = 15+ rooms)
3. For roomSizes: Infer from event size (medium = "200-300 sqm main hall, 50-80 sqm breakout", large = "500-800 sqm main hall, 100-150 sqm breakout")
4. For openYear: ⚠️ MANDATORY - MUST search organization founding year or first event year. Search: organization website "About" page, "History" page, "established in", "founded in", "since [year]", Wikipedia, organization profile. This is CRITICAL and must NOT be empty.
5. For keyPersonEmail/Phone: Search organization website contact pages
6. For infoOnLastUpcomingEvents: MUST provide comprehensive details - last event: year, city, country, attendance; upcoming event: year, city, country, expected attendance. This is CRITICAL information.
7. For localHostName: ⚠️ MANDATORY - MUST search for local chapter/host organization name or member name. Check organization website for "local chapter", "member", "host", "Vietnam chapter", "[country] chapter", member directory, local chapters page. If event has been in Vietnam, find actual host. If not, research potential host/member organization. This is CRITICAL and must NOT be empty.
8. For localHostTitle: ⚠️ MANDATORY - MUST find Local Host title. Search organization website, member directory, local chapter pages for titles like "President", "Secretary General", "Chairman", "Executive Director", "Director". This is CRITICAL and must NOT be empty.
9. For localHostEmail: ⚠️ MANDATORY - MUST search organization website contact pages, member directories, local chapter pages, "[country] contact" for email address. Format: email address (e.g., "info@organization.org"). This is CRITICAL and must NOT be empty.
10. For localHostPhone: ⚠️ MANDATORY - MUST search organization website contact pages, member directories, local chapter pages for phone number. Format: phone with country code (e.g., "+84 123 456 7890"). This is CRITICAL and must NOT be empty.
11. For localStrengths: ⚠️ MANDATORY - MUST analyze BOTH strengths (advantages Vietnam offers) AND weaknesses (challenges). Format: "Strengths: [3-5 advantages]. Weaknesses: [2-3 challenges]". This is CRITICAL and must NOT be empty.
10. For layout: MUST provide detailed specifications: plenary hall capacity and size, number and capacity of breakout rooms, exhibition area size and booth count, additional spaces (poster, networking, registration, catering)
11. For conferenceRegistration: Search event website for registration page, fees, deadlines, early bird dates, registration process, contact information
12. For competitors: Research where similar events have been held
13. For sponsors: Research past sponsors or typical sponsors in this industry
14. For iccaQualified: Check if event meets ICCA criteria (international association, rotating, significant international participation)

CRITICAL OUTPUT REQUIREMENTS:
1. companyName = EXACT event name from input
2. Strings use "" for empty (never null)
3. Numbers use 0 or null (never empty string)
4. problems array = ONLY truly missing fields AFTER research
5. JSON must be valid and parseable
6. Note enrichment in "notes" field: List all researched fields (e.g., "[AI Enriched: infoOnLastUpcomingEvents, localHostName, localHostEmail, localHostPhone, localStrengths, layout, conferenceRegistration, breakoutRooms, roomSizes, openYear, email, phone, competitors, sponsors, iccaQualified]")
7. **CRITICAL**: The following fields MUST be researched and filled comprehensively - they are MANDATORY and should NOT be empty unless truly unavailable after thorough research:
   - openYear (organization founding year or first event year)
   - localHostName (Name of Local Host / Member)
   - localHostTitle (Title/Position of Local Host)
   - localHostEmail (contact email)
   - localHostPhone (contact phone)
   - localStrengths (Strengths AND Weaknesses)
   - layout (detailed layout specifications)
   - conferenceRegistration (registration details)
   - infoOnLastUpcomingEvents (last event + upcoming event details)

8. **VALIDATION CHECKLIST** - Before outputting JSON, verify ALL these fields are filled:
   ✓ localHostName: Is there a name? (If event in Vietnam, find actual host. If not, research potential host/member)
   ✓ localHostTitle: Is there a title? (Search for President, Secretary General, Chairman, etc.)
   ✓ localHostEmail: Is there an email? (Search organization website, contact pages, member directory)
   ✓ localHostPhone: Is there a phone? (Search organization website, contact pages)
   ⚠️ **CRITICAL MANDATORY FIELDS** - These MUST be filled or added to problems array:
   ✓ openYear: Is there a number (year)? (If NO → add "Missing openYear" to problems)
   ✓ localHostName: Is there a name? (If event in Vietnam, find actual host. If not, research potential host/member. If NO → add "Missing localHostName" to problems)
   ✓ localHostTitle: Is there a title? (Search for President, Secretary General, Chairman, etc. If NO → add "Missing localHostTitle" to problems)
   ✓ localHostEmail: Is there an email? (Search organization website, contact pages, member directory. If NO → add "Missing localHostEmail" to problems)
   ✓ localHostPhone: Is there a phone? (Search organization website, contact pages. If NO → add "Missing localHostPhone" to problems)
   ✓ localStrengths: Does it include BOTH "Strengths:" AND "Weaknesses:"? (If NO → add "Missing localStrengths" to problems)
   ✓ layout: Does it include plenary hall capacity/size, breakout rooms number/capacity/size, exhibition area booths/size, and additional spaces? (If NO → add "Missing layout" to problems)
   ✓ conferenceRegistration: Does it include website URL, fees, deadlines, process, and contact? (If NO → add "Missing conferenceRegistration" to problems)
   ✓ infoOnLastUpcomingEvents: Does it include both last event AND upcoming event details?

**FINAL CHECK**: Before outputting JSON, verify that ALL mandatory fields are NOT empty:
- openYear (must be a number)
- localHostName (must have a name)
- localHostTitle (must have a title)
- localHostEmail (must have an email)
- localHostPhone (must have a phone)
- localStrengths (must include BOTH Strengths AND Weaknesses)
- layout (must include detailed specifications)
- conferenceRegistration (must include website, fees, deadlines, process)

If ANY of these fields is empty or incomplete, you MUST:
1. Research more thoroughly using the search strategies provided
2. Add the corresponding "Missing [field]" to the problems array
3. Only output JSON after ensuring these fields are filled or properly flagged in problems array`;
}

/**
 * OpenAI system message for /strategic-analysis. Moved from gpt.ts:580.
 */
export const OPENAI_STRATEGIC_ANALYSIS_SYSTEM_MESSAGE =
  'You are an expert MICE industry analyst specializing in event research and analysis. CRITICAL RULES: 1) Only provide FACTUAL, VERIFIED information from your knowledge base. 2) NEVER guess or invent data. 3) If information is not available, use empty string "" for strings or null for numbers. 4) Be precise and accurate - incorrect data is worse than missing data. 5) Research thoroughly using your training data knowledge. 6) Follow all format requirements exactly.';
