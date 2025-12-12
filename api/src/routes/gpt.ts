import { Router, Request, Response } from 'express';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { query } from '../config/database.js';
import { Lead } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const router = Router();

// Helper to get OpenAI client
const getAiClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }
  return new OpenAI({ apiKey });
};

// Helper: Load ICCA Leads data from database and format as knowledge base
const getICCALeadsKnowledge = async (): Promise<string> => {
  try {
    // Get all leads from database
    const result = await query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 500', []);
    const leads: Lead[] = result.rows;

    if (leads.length === 0) {
      return 'No ICCA Leads data available in the database yet.';
    }

    // Group leads by industry and country for better organization
    const byIndustry: Record<string, Lead[]> = {};
    const byCountry: Record<string, Lead[]> = {};
    const highPriorityLeads: Lead[] = [];
    const vietnamLeads: Lead[] = [];

    leads.forEach(lead => {
      // Group by industry
      const industry = lead.industry || 'Unknown';
      if (!byIndustry[industry]) byIndustry[industry] = [];
      byIndustry[industry].push(lead);

      // Group by country
      const country = lead.country || 'Unknown';
      if (!byCountry[country]) byCountry[country] = [];
      byCountry[country].push(lead);

      // High priority: has Vietnam events or high delegate count
      if (lead.vietnam_events > 0 || (lead.number_of_delegates && lead.number_of_delegates >= 300)) {
        highPriorityLeads.push(lead);
      }

      // Vietnam-related leads
      if (lead.vietnam_events > 0) {
        vietnamLeads.push(lead);
      }
    });

    // Build knowledge base text
    let knowledge = `\n=== ICCA LEADS KNOWLEDGE BASE ===\n\n`;
    knowledge += `Total Leads in Database: ${leads.length}\n`;
    knowledge += `High Priority Leads (Vietnam events or 300+ delegates): ${highPriorityLeads.length}\n`;
    knowledge += `Leads with Vietnam Event History: ${vietnamLeads.length}\n\n`;

    // Industry breakdown
    knowledge += `Industry Distribution:\n`;
    Object.entries(byIndustry).slice(0, 10).forEach(([industry, industryLeads]) => {
      knowledge += `- ${industry}: ${industryLeads.length} leads\n`;
    });
    knowledge += `\n`;

    // Country breakdown
    knowledge += `Top Countries:\n`;
    Object.entries(byCountry)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([country, countryLeads]) => {
        knowledge += `- ${country}: ${countryLeads.length} leads\n`;
      });
    knowledge += `\n`;

    // High priority leads summary
    if (highPriorityLeads.length > 0) {
      knowledge += `High Priority Leads (Top 20):\n`;
      highPriorityLeads.slice(0, 20).forEach((lead, idx) => {
        knowledge += `${idx + 1}. ${lead.company_name} (${lead.industry || 'N/A'}, ${lead.country || 'N/A'})`;
        if (lead.vietnam_events > 0) knowledge += ` - ${lead.vietnam_events} Vietnam event(s)`;
        if (lead.number_of_delegates) knowledge += ` - ${lead.number_of_delegates} delegates`;
        if (lead.key_person_name) knowledge += ` - Contact: ${lead.key_person_name}`;
        knowledge += `\n`;
      });
      knowledge += `\n`;
    }

    // Vietnam leads details
    if (vietnamLeads.length > 0) {
      knowledge += `Leads with Vietnam Event History (Top 15):\n`;
      vietnamLeads.slice(0, 15).forEach((lead, idx) => {
        knowledge += `${idx + 1}. ${lead.company_name}`;
        knowledge += ` - ${lead.vietnam_events} Vietnam event(s)`;
        if (lead.past_events_history) knowledge += ` - History: ${lead.past_events_history.substring(0, 100)}`;
        if (lead.key_person_email) knowledge += ` - Email: ${lead.key_person_email}`;
        knowledge += `\n`;
      });
      knowledge += `\n`;
    }

    // Key patterns and insights
    knowledge += `Key Patterns:\n`;
    const avgDelegates = leads
      .filter(l => l.number_of_delegates)
      .reduce((sum, l) => sum + (l.number_of_delegates || 0), 0) / 
      leads.filter(l => l.number_of_delegates).length || 0;
    if (avgDelegates > 0) {
      knowledge += `- Average delegate count: ${Math.round(avgDelegates)}\n`;
    }
    const totalVietnamEvents = leads.reduce((sum, l) => sum + l.vietnam_events, 0);
    knowledge += `- Total Vietnam events across all leads: ${totalVietnamEvents}\n`;
    const leadsWithEmail = leads.filter(l => l.key_person_email).length;
    knowledge += `- Leads with contact email: ${leadsWithEmail} (${Math.round(leadsWithEmail / leads.length * 100)}%)\n`;
    knowledge += `\n`;

    knowledge += `=== END OF ICCA LEADS KNOWLEDGE BASE ===\n\n`;
    knowledge += `IMPORTANT: When answering questions about leads, organizations, or market analysis, use this knowledge base to provide accurate, data-driven insights. Reference specific leads, industries, or patterns from this data when relevant.\n`;

    return knowledge;
  } catch (error: any) {
    console.error('Error loading ICCA Leads knowledge:', error);
    return 'ICCA Leads data is currently unavailable. Please try again later.';
  }
};

// Helper: Extract retry delay from rate limit error
const extractRetryDelay = (error: any): number | null => {
  try {
    if (error.status === 429) {
      // Check for retry-after header
      if (error.headers?.['retry-after']) {
        return parseInt(error.headers['retry-after']);
      }
      // Default retry after 60 seconds
      return 60;
    }
  } catch (e) {
    console.error('Error parsing retry delay:', e);
  }
  return null;
};

// POST /api/gpt/extract-organizations - Extract organization names using GPT-4o mini with Research Tools
router.post('/extract-organizations', async (req: Request, res: Response) => {
  try {
    const { data, summary } = req.body;

    if (!data || data.trim() === '') {
      return res.status(400).json({ error: 'Data is required' });
    }

    const openai = getAiClient();

    const systemPrompt = `You are an expert data analyst specializing in extracting organization names from structured and unstructured data.

Your task: Extract ONLY the organization/company names (not event names, not contact names, not venue names).

IMPORTANT RULES:
1. Extract ONLY organization/company names (e.g., "International Society for Prosthetics and Orthotics")
2. DO NOT extract event names (e.g., "World Congress of...", "Annual Meeting of...", "Workshop on...")
3. DO NOT extract venue names, contact names, or other entities
4. If data is from multiple sheets, prioritize the "Organizations" or "Orgs" sheet
5. Each organization should appear only once in the result
6. Be smart: If you see "World Congress of International Society for Prosthetics and Orthotics", extract "International Society for Prosthetics and Orthotics" (the organization), not "World Congress of..." (the event)

Output a JSON array of organization names ONLY.`;

    const userPrompt = `Extract organization names from this data:

${data}

${summary ? `File Summary: ${JSON.stringify(summary, null, 2)}` : ''}

Return a JSON object with this structure:
{
  "organizations": [
    {
      "name": "Organization Name 1",
      "rowIndex": 1,
      "sourceField": "Org Name"
    }
  ]
}`;

    console.log('🟢 [GPT API] Extract organizations request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for accuracy
      // Note: GPT-4o mini supports function calling but doesn't have built-in web search
      // For production, integrate with web search API (Tavily, Serper, etc.) for research capabilities
      // The model will use its extensive training data knowledge
    });

    let result;
    try {
      const content = response.choices[0]?.message?.content || '{}';
      result = JSON.parse(content);
    } catch (e) {
      console.error('JSON Parse Error in extract-organizations:', e);
      result = { organizations: [] };
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error in extract-organizations:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Failed to extract organizations',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// POST /api/gpt/strategic-analysis - Strategic analysis using GPT-4o mini with Research Tools
router.post('/strategic-analysis', async (req: Request, res: Response) => {
  try {
    const { leadsData } = req.body;

    if (!leadsData || leadsData.trim() === '') {
      return res.status(400).json({ error: 'Leads data is required' });
    }

    const openai = getAiClient();

    const prompt = `You are analyzing a SPECIFIC EVENT that was imported from Excel/CSV file. Your task is to evaluate THIS EXACT EVENT and determine how suitable it is for Ariyana Convention Centre Danang.

**CRITICAL: YOU ARE EVALUATING THE EVENT PROVIDED BELOW, NOT SEARCHING FOR NEW EVENTS**

The event data below is ONE EVENT from a list of imported events. Your job is to:
1. Analyze THIS event's potential for Ariyana Convention Centre
2. Score it based on suitability criteria
3. Enrich missing information about THIS event
4. DO NOT search for or suggest other events - evaluate ONLY the event provided

Data:
${leadsData}

**CRITICAL: EXTRACT THE EVENT NAME FROM THE DATA ABOVE**

Look for the EVENT NAME in the data above. It might be in fields like:
- "EVENT", "Event Name", "Event", "Series", "SERIES", "Event Series"
- Or it might be the main title/name field in the data

**THE EVENT NAME YOU FIND ABOVE MUST BE USED EXACTLY AS THE "companyName" FIELD IN YOUR JSON OUTPUT**

**IMPORTANT INSTRUCTIONS:**
1. **MANDATORY**: The "companyName" field in your JSON output MUST be the EXACT EVENT NAME from the input data above
   - DO NOT use organization name
   - DO NOT use a different event name
   - DO NOT use a shortened or modified version
   - USE THE EXACT EVENT NAME AS IT APPEARS IN THE DATA
   
2. Example: If the data shows "ASEAN Law Association Annual Conference", then companyName MUST be "ASEAN Law Association Annual Conference" (NOT "ASEAN Law Association" or "ALA")

3. You are evaluating THIS EVENT's suitability, not finding organizations or other events

4. This event is from a list of imported events - your job is to score and rank THIS SPECIFIC EVENT

5. Focus on: Does THIS event fit Ariyana? What's the opportunity score for THIS event?

6. **VALIDATION**: Before outputting JSON, verify that companyName matches the event name from the input data exactly

**CRITICAL DATA ENRICHMENT REQUIREMENT:**

1. **Contact Information Enrichment:**
For THIS EVENT, if contact information is missing (keyPersonName, keyPersonTitle, keyPersonEmail, keyPersonPhone), you MUST use your knowledge and research capabilities to search and find this information:
- **keyPersonName**: Search for the organization's key contact person (President, Director, Secretary General, Executive Director, etc.)
- **keyPersonTitle**: Find their actual title (e.g., "Secretary General", "President", "Executive Director", "Director of Conferences")
- **keyPersonEmail**: Search for official contact email (info@, contact@, or specific person's email format)
- **keyPersonPhone**: Find the organization's official phone number if available
- **website**: Find the official website URL

2. **Event Brief Enrichment (CRITICAL - Output format like Event Brief template):**
For THIS EVENT, research and provide comprehensive Event Brief information:
- **Event Name & Series**: Full event name with year, event series name
- **Industry**: Industry/sector of the event (Medical, Technology, Legal, etc.)
- **Average Attendance**: Average number of attendees/delegates across all editions
- **Event Details**: Open year (when established), frequency (annually/biennially), rotation area & pattern
- **Event Specifications**: Duration, preferred months, preferred venue type, breakout rooms needed, room sizes
- **Event History**: Detailed history of past events (years, locations, attendance), info on last/upcoming events
- **Delegates Profile**: Who attends (doctors, scientists, professionals, etc.)
- **International Organization**: Full name, website, organization profile
- **Local Host Information**: If known, especially for Vietnam events - name, title, organization, website
- **Local Strengths & Weaknesses**: Context about local market, especially for Vietnam
- **Bidding Information**: 
  - Decision maker (who decides: local host, international board, DMC, etc.)
  - Decision making process (how decisions are made)
  - Key bid criteria (what matters: capacity, connectivity, location, etc.)
  - Competitors (venues they've used before)
  - Competitive analysis
  - Host responsibility (who organizes)
- **Sponsors**: Known sponsors or typical sponsors for this type of event
- **Layout**: Typical event layout requirements (main hall, breakout rooms, exhibition area, etc.)
- **Fit for Ariyana**: Why this event fits Ariyana Convention Centre (capacity match, location advantages, facilities)
- **Opportunity Score**: 0-100 score for how good this opportunity is for Ariyana

Use your extensive knowledge base and infer from organization names, types, event history, and common patterns. For international associations and organizations, common titles include "Secretary General", "President", "Executive Director", "Director of Events/Conferences".

DO NOT leave these fields as null if you can reasonably find or infer the information. Only mark as null if you truly cannot find any information.

Scoring (0-100 total):
- History (0-25): 25 if VN events>=1, 15 if SEA, else 0
- Region (0-25): 25 if name has "ASEAN/Asia/Pacific", 15 if Asian location, else 0
- Contact (0-25): 25 if email+phone, 15 if email only, else 0
- Delegates (0-25): 25 if >=500, 20 if >=300, 10 if >=100, else 0

Output format:

PART A: Event Evaluation Summary
Provide a brief summary of this event's suitability for Ariyana Convention Centre.

PART B: Scoring Breakdown
- Total Score: [0-100]
- History Score: [0-25] - Has this event been held in Vietnam or Southeast Asia?
- Region Score: [0-25] - Is this event likely to rotate to Asia/Vietnam?
- Contact Score: [0-25] - Do we have contact information?
- Delegates Score: [0-25] - Event size and potential impact

PART C: Next Steps
What should be the next action for pursuing this event?

PART C: JSON array (wrap in \`\`\`json\`\`\`)
[{
  "companyName": "String (REQUIRED - MUST be the EXACT EVENT NAME from input data above. DO NOT use organization name. DO NOT modify or shorten the event name. Use the event name exactly as it appears in the EVENT/Series/Event Name field from the input data)",
  "industry": "String (infer if missing)",
  "country": "String (infer if missing)",
  "city": "String (infer if missing)",
  "website": "String (SEARCH and find official website if not in data)",
  "keyPersonName": "String (SEARCH for President/Director/Secretary if missing - try to provide)",
  "keyPersonTitle": "String (SEARCH for actual title like 'Secretary General', 'President', 'Executive Director' - try to provide)",
  "keyPersonEmail": "String (SEARCH for official contact email format - try to provide)",
  "keyPersonPhone": "String (SEARCH for official phone number if available - try to provide)",
  "vietnamEvents": 0,
  "totalEvents": 1,
  "numberOfDelegates": null,
  "totalScore": 0-100,
  "historyScore": 0-25,
  "regionScore": 0-25,
  "contactScore": 0-25,
  "delegatesScore": 0-25,
  "problems": ["Missing email", "No phone", "Unclear industry", "Missing location", "No website", "No contact person", "Incomplete event history"],
  "notes": "Brief insights. If you enriched data, note: '[AI Enriched: Contact info found via knowledge base]'",
  "pastEventsHistory": "2023: City, Country; 2022: City, Country",
  "nextStepStrategy": "Action plan",
  "status": "New",
  "eventBrief": {
    "eventName": "String (Full event name with year, e.g., 'The Asia Pacific Society of Cardiovascular and Interventional Radiology 2025 (APSCVIR 2025)')",
    "eventSeries": "String (Event series name without year)",
    "industry": "String (Industry/sector of the event, e.g., 'Medical', 'Technology', 'Legal', infer from organization name and event type)",
    "averageAttendance": "Number (Average number of attendees/delegates, infer from numberOfDelegates or pastEventsHistory)",
    "openYear": "Number (Year organization/event was established, infer from history if available)",
    "frequency": "String (e.g., 'annually', 'biennially', 'triennially', infer from pastEventsHistory)",
    "rotationArea": "String (e.g., 'APAC', 'Global', 'Asia Pacific', infer from pastEventsHistory and organization name)",
    "rotationPattern": "String (Describe rotation pattern if known, e.g., 'Rotates between Asian countries')",
    "duration": "String (Typical event duration, e.g., '3 days', '5 days', infer from typical industry patterns)",
    "preferredMonths": "String (Preferred months for event, e.g., 'March-June', infer from pastEventsHistory)",
    "preferredVenue": "String (Preferred venue type, e.g., 'Hotel with convention facilities', 'Convention Centre', infer from event size)",
    "breakoutRooms": "String (Number of breakout rooms needed, e.g., '5-7', infer from event size and industry)",
    "roomSizes": "String (Size range of rooms needed, e.g., '50 - 800 pax', infer from numberOfDelegates)",
    "infoOnLastUpcomingEvents": "String (Information about last event and upcoming events, dates, locations, attendance)",
    "eventHistory": "String (Detailed event history with years, locations, attendance numbers if available)",
    "delegatesProfile": "String (Profile of delegates, e.g., 'Doctors & scientists', 'Industry professionals', infer from industry)",
    "internationalOrganisationName": "String (Full name of the international organization, research and provide)",
    "internationalOrganisationWebsite": "String (Official website of the international organization, research and provide)",
    "organizationProfile": "String (Description of the international organization, research and provide)",
    "localHostName": "String (Name of local host/member if known, especially for Vietnam events)",
    "localHostTitle": "String (Title of local host)",
    "localHostOrganization": "String (Local host organization name)",
    "localHostWebsite": "String (Local host website if known)",
    "localStrengths": "String (Local strengths and context, especially for Vietnam)",
    "decisionMaker": "String (Who makes the decision, e.g., 'Local host', 'International board', 'DMC', infer from organization structure)",
    "decisionMakingProcess": "String (How decisions are made, e.g., 'Local host work with DMC, DMC sorting venues & have site inspection')",
    "keyBidCriteria": "String (Key criteria for venue selection, e.g., 'Venue capacity & breakout rooms, Connectivity')",
    "competitors": "String (Known competitors or venues they've used before)",
    "competitiveAnalysis": "String (Analysis of competitive landscape)",
    "hostResponsibility": "String (Who is responsible for organizing, e.g., 'Organising Committee, responsible for selection of destination, venue and event plan')",
    "sponsors": "String (Known sponsors or typical sponsors for this type of event)",
    "layout": "String (Typical event layout requirements, e.g., 'Main plenary hall + 5 breakout rooms + exhibition area')",
    "fitForAriyana": "String (Why this event fits Ariyana Convention Centre - capacity, location, facilities match)",
    "opportunityScore": "Number (0-100, how good is this opportunity for Ariyana)"
  }
}]

CRITICAL: 
- Include "problems" array listing ONLY fields that are truly missing AFTER your search/enrichment attempt
- If you found and filled in keyPersonPhone or keyPersonTitle, DO NOT include "Missing keyPersonPhone" or "No keyPersonTitle" in problems array
- Be specific about what you found vs what's missing (e.g., "Missing keyPersonEmail" only if you truly couldn't find it)
- Prioritize accuracy - use your knowledge to find real contact information when possible`;

    console.log('🟢 [GPT API] Strategic analysis request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert international sales director with deep knowledge of MICE industry and research capabilities.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      // Note: GPT-4o mini supports function calling but doesn't have built-in web search
      // For production, integrate with web search API (Tavily, Serper, etc.) for research capabilities
      // For now, model uses its training data which includes extensive knowledge up to training cutoff
    });

    // Handle tool calls if any
    let finalResponse = response.choices[0]?.message?.content || '';
    
    // If model requested tool use, we would need to handle it here
    // For now, OpenAI's function calling will be handled by the model internally
    // In production, you might want to implement actual web search integration

    res.json({ text: finalResponse });
  } catch (error: any) {
    console.error('Error in strategic-analysis:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Strategic analysis failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// POST /api/gpt/enrich - Data enrichment using Research Tools
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const { companyName, keyPerson, city } = req.body;

    if (!companyName || companyName.trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const openai = getAiClient();

    const prompt = `
You are a research assistant helping to enrich lead data for a MICE (Meetings, Incentives, Conferences, Exhibitions) sales team.

Organization Name: ${companyName}
Key Person: ${keyPerson || 'Not provided'}
City: ${city || 'Not provided'}

**CRITICAL: You MUST actively research and find comprehensive information:**

Please research and provide detailed information about:

**1. BASIC INFORMATION & LEADERSHIP:**
- Official website URL
- Key contact person name (President, Director, CEO, Executive Director, etc.)
- Key contact person title
- Contact email (official email: info@, contact@, or specific person's email)
- Phone number (official phone number if available)
- Industry classification
- Year founded/established

**IMPORTANT - LEADERSHIP POSITIONS:**
For international associations, congresses, and federations, please actively search for these KEY leadership positions:
- **Secretary General** - This is a critical position. Search for current or recent Secretary General name (e.g., "Dr. John Smith", "Prof. Jane Doe")
- **Organizing Chairman** or **Congress President** - Person leading the organizing committee for recent/upcoming events
- These positions are often listed on the organization's website under "About Us", "Leadership", "Executive Committee", or "Contact"
- Check recent conference websites, newsletters, or announcements for these names

**2. EVENT INFORMATION:**
- Recent events or conferences they organized (with years and locations)
- Typical event frequency (annual, biennial, etc.)
- Average attendance/delegates count
- Typical event duration (number of days)
- Preferred months for events
- Rotation pattern (if they rotate between regions/countries)
- Info on last/upcoming events (specific dates, locations, themes if known)
- Delegates profile: Who typically attends? (e.g., "Medical professionals, researchers, industry representatives from 50+ countries")

**3. SPONSORS & PARTNERSHIPS:**
IMPORTANT: Try to categorize sponsors by tier/level:
- Diamond/Platinum Sponsors: Highest tier, major financial supporters (list company names)
- Gold Sponsors: Significant supporters (list company names)
- Silver Sponsors: Medium-level supporters (list company names)  
- Bronze/Standard Sponsors: Basic supporters (list company names)
- Exhibition Partners: Companies with exhibition booths (list company names)
- Institutional Partners: Universities, UN, WHO, government bodies (list names)
- Media Partners: Media organizations (list names)

Format as: "Tier: Company1, Company2, Company3"
Example: "Gold: Pfizer, Johnson & Johnson; Silver: Novartis, Roche"

**4. CONFERENCE LOGISTICS:**
- Conference registration information:
  - Registration website/portal
  - Typical registration fees (if public)
  - Early bird deadlines
  - Member vs non-member rates
- Event layout and format:
  - Typical venue requirements (hotel, convention center, etc.)
  - Number of breakout rooms needed (specific number if known, e.g., "8-10 rooms")
  - Size of rooms needed (e.g., "200-300 sqm main hall, 50-80 sqm breakout rooms")
  - Exhibition space requirements (sqm)
  - Special facilities (labs, demo areas, etc.)

**5. ICCA QUALIFICATION:**
- Is this organization ICCA qualified? (ICCA = International Congress and Convention Association)
- Do they meet ICCA criteria:
  - At least 50 participants
  - Minimum 3 countries represented
  - Regular rotation between at least 3 countries
  - Organized on a regular basis
- Are they listed in ICCA database?

**6. DECISION MAKING:**
- Who makes bidding decisions? (Board, Committee, Local Chapter)
- Typical bidding timeline (how far in advance)
- Key criteria for venue selection

**7. LOCAL HOST ANALYSIS (If event has been held in specific countries/regions):**
- Local Strengths: 
  - What are the local host's organizational strengths?
  - What makes the local host/member organization strong? (e.g., "Most active medical organization in Vietnam")
  - Local venue/destination advantages
  - Government or institutional support
  
- Local Weaknesses:
  - Challenges the local host may face
  - Market maturity (e.g., "Country not yet exposed to large international conferences")
  - Infrastructure limitations
  - Experience level with international events

**IMPORTANT**: 
- Actively search for missing information using your knowledge base
- For international associations, look for common organizational structures
- Try to find real contact details, not just generic formats
- Provide specific dates, numbers, and names when available
- If information is not available, leave the field empty (do not use "Not available" or "N/A")

**OUTPUT FORMAT:**
Return a JSON object with the following structure (search exhaustively for Secretary General and Organizing Chairman):
{
  "website": "official website URL",
  "industry": "industry classification",
  "keyPersonName": "name of key contact person",
  "keyPersonTitle": "title of key contact",
  "keyPersonEmail": "contact email",
  "keyPersonPhone": "contact phone",
  "openYear": "year founded/established",
  "frequency": "event frequency (annual, biennial, etc)",
  "duration": "typical event duration (e.g., '3-5 days')",
  "preferredMonth": "preferred months for events (e.g., 'May-October', 'Q3')",
  "rotationPattern": "rotation pattern between locations",
  "upcomingEvents": "info on last/upcoming events with dates and locations",
  "delegatesProfile": "profile of typical attendees/delegates (who attends, from where, professional background)",
  "organizingChairman": "FULL NAME of current/recent Organizing Chairman or Congress President (CRITICAL - search exhaustively)",
  "secretaryGeneral": "FULL NAME of current Secretary General (CRITICAL - this is essential for international associations, search exhaustively on website/leadership pages)",
  "sponsors": "sponsors categorized by tier (format: 'Diamond: Company1, Company2; Gold: Company3, Company4')",
  "breakoutRooms": "number of breakout rooms needed (e.g., '8-10 rooms')",
  "roomSizes": "size requirements for rooms (e.g., '200-300 sqm main hall, 50-80 sqm breakout')",
  "layoutEvent": "venue requirements and layout details",
  "conferenceRegistration": "registration information (website, fees, deadlines)",
  "iccaQualified": "yes/no - is ICCA qualified with explanation",
  "decisionMaker": "who makes bidding decisions (e.g., 'Board of Directors', 'Local Organizing Committee')",
  "competitors": "competing destinations or venues",
  "numberOfDelegates": "typical attendance number (number only, e.g., 500)",
  "localStrengthsWeaknesses": "local host strengths and weaknesses analysis (format: 'Strengths: [list]. Weaknesses: [list]')",
  "researchSummary": "brief summary of findings for reference"
}

**CRITICAL FIELDS TO PRIORITIZE:**
1. secretaryGeneral - Search organization's leadership, executive committee, about us pages
2. organizingChairman - Search recent congress/conference organizers
3. website - Official domain
4. keyPersonEmail - Contact email

If you cannot find information after thorough search, leave the field EMPTY (empty string ""), do NOT use "Not available", "N/A", or "Unknown".

Only include fields where you have actual information. Leave fields empty if no information is found.`;

    console.log('🟢 [GPT API] Data enrichment request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using GPT-4o-mini for better rate limits
      messages: [
        { 
          role: 'system', 
          content: `You are an expert researcher specializing in MICE (Meetings, Incentives, Conferences, Exhibitions) industry research with access to extensive knowledge about international associations, conferences, and events up to October 2023.

RESEARCH CAPABILITIES:
- You have detailed knowledge of major international associations and their conferences
- You know typical organizational structures (Presidents, Secretary Generals, Executive Directors)
- You understand ICCA qualification criteria and common patterns
- You can infer typical venue requirements based on event type and size
- You have knowledge of major conference sponsors and industry patterns

RESEARCH STRATEGY:
1. PRIORITIZE finding Secretary General and Organizing Chairman - these are CRITICAL fields
   - For Secretary General: Check leadership pages, executive committee, "About Us" sections
   - Look for patterns like "Secretary General: Dr. [Name]" or "SG: Prof. [Name]"
   - Secretary General is often the primary administrative officer of international associations
2. Use your knowledge of similar organizations to infer missing details
3. Apply industry standards when specific information is unavailable
4. For international associations, search your knowledge base for:
   - Official websites (typically .org, .com, or country-specific domains)
   - Common email patterns (info@, secretariat@, contact@)
   - Typical organizational structures and titles
   - Historical event patterns and locations
   - Leadership directories and organizational charts
5. Provide specific, actionable information rather than generic statements
6. If you find information, provide it; if genuinely unavailable, leave the field EMPTY (not "N/A" or "Unknown")

OUTPUT: Return ONLY valid JSON with researched fields. No explanations outside JSON.` 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for maximum accuracy and consistency
      max_tokens: 2500, // Increased for more detailed research
    });

    const content = response.choices[0]?.message?.content || '{}';
    let enrichedData = {};
    
    try {
      enrichedData = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse GPT response as JSON:', e);
      enrichedData = { researchSummary: content };
    }

    res.json({ 
      text: JSON.stringify(enrichedData, null, 2), 
      research: enrichedData 
    });
  } catch (error: any) {
    console.error('Error in enrich:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Data enrichment failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// POST /api/gpt/draft-email - Email drafting
router.post('/draft-email', async (req: Request, res: Response) => {
  try {
    const { leadName, leadCompany, leadTitle, eventContext } = req.body;

    if (!leadName || !leadCompany) {
      return res.status(400).json({ error: 'Lead name and company are required' });
    }

    const openai = getAiClient();

    const prompt = `
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert sales email writer specializing in MICE industry outreach.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const email = JSON.parse(content);

    res.json({ subject: email.subject || '', body: email.body || '' });
  } catch (error: any) {
    console.error('Error in draft-email:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Email drafting failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// POST /api/gpt/chat - Chat assistant
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { history, message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Load ICCA Leads knowledge base
    console.log('📚 [GPT API] Loading ICCA Leads knowledge base...');
    const iccaKnowledge = await getICCALeadsKnowledge();

    // Build enhanced system instruction with ICCA Leads knowledge
    const systemInstruction = `You are a helpful sales assistant for Ariyana Convention Centre in Danang, Vietnam. You help the sales team analyze leads, suggest strategies, and answer questions about the MICE industry in Vietnam.

Your knowledge base includes data from ICCA (International Congress and Convention Association) Leads that have been imported and analyzed. Use this data to provide accurate, data-driven insights.

${iccaKnowledge}

When answering questions:
1. Reference specific leads, organizations, or patterns from the ICCA Leads knowledge base when relevant
2. Provide statistics and insights based on the actual data in the knowledge base
3. Suggest strategies based on patterns you observe in the leads data
4. Help identify high-potential leads based on criteria like Vietnam event history, delegate counts, and industry
5. Answer questions about market trends, industry distribution, and geographic patterns using the knowledge base

Always be specific and data-driven in your responses. If you reference a lead or organization, use the actual information from the knowledge base.`;

    const openai = getAiClient();

    const messages: any[] = [
      { role: 'system', content: systemInstruction }
    ];

    // Convert history format if needed
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.role || 'user',
          content: msg.content || msg.text || ''
        });
      });
    }

    messages.push({ role: 'user', content: message });

    console.log('🟢 [GPT API] Chat request with ICCA Leads knowledge base');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content || '';

    res.json({ text });
  } catch (error: any) {
    console.error('Error in chat:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Chat failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// Research edition-specific leadership (chairman, secretary)
router.post('/research-edition', async (req: Request, res: Response) => {
  try {
    const { eventName, edition, year, city, country } = req.body;

    if (!eventName) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const prompt = `
Research the specific leadership for this conference edition:

**Event:** ${eventName}
**Edition:** ${edition || 'N/A'}
**Year:** ${year || 'N/A'}
**Location:** ${[city, country].filter(Boolean).join(', ') || 'N/A'}

Find the SPECIFIC leadership for THIS edition only (not general organization leadership):

1. **Organizing Chairman** or **Congress President** for this specific edition
   - Search for: "[Year] [Event] organizing chairman", "congress president"
   - Look for names in conference programs, proceedings, announcements
   
2. **Secretary General** for this specific edition (if different from organization level)
   - Some editions have edition-specific secretaries

**CRITICAL:**
- Return names ONLY if you find specific information for THIS edition
- If information is not available for this specific edition, return empty string
- Do NOT return organization-level leadership unless confirmed for this edition
- Prefer specific names over generic titles

Return JSON:
{
  "organizingChairman": "Full name of organizing chairman for this edition (empty if not found)",
  "secretaryGeneral": "Full name of secretary for this edition (empty if not found)",
  "confidence": "high/medium/low - your confidence in the accuracy"
}
`;

    const openai = getAiClient();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a research assistant specializing in finding historical conference leadership information. Be conservative - only return names if you have specific information for the requested edition.' 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    let researchData = {};
    
    try {
      researchData = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse GPT response:', e);
      researchData = {};
    }

    res.json({ 
      success: true,
      data: researchData 
    });

  } catch (error: any) {
    console.error('Edition research error:', error);
    res.status(500).json({ 
      error: 'Failed to research edition leadership',
      message: error.message 
    });
  }
});

export default router;

