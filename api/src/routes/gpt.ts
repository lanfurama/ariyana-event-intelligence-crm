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

    const systemPrompt = `Extract organization names only. Not events, venues, or contacts. One per org.`;

    const userPrompt = `Extract organizations from: ${data}${summary ? `\nSummary: ${JSON.stringify(summary)}` : ''}

Return: {"organizations": [{"name": "Org Name", "rowIndex": 1, "sourceField": "Field"}]}`;

    console.log('🟢 [GPT API] Extract organizations request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for maximum accuracy - no hallucination
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

    const prompt = `EVENT ANALYSIS FOR ARIYANA CONVENTION CENTRE DANANG
====================================================

TASK: Analyze ONE SPECIFIC EVENT from imported data. Evaluate suitability and enrich missing information.

INPUT DATA:
${leadsData}

STEP 1: EXTRACT EVENT NAME
---------------------------
Find EVENT NAME in input data (check: "EVENT", "Event Name", "Series", "SERIES").
CRITICAL: Use EXACT event name as "companyName". Do NOT use organization name or modify name.

STEP 2: CALCULATE SCORES (Apply Exact Rules)
---------------------------------------------
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

**CRITICAL PRIORITY FIELDS** (MUST RESEARCH - DO NOT LEAVE EMPTY):
1. keyPersonPhone: **MANDATORY RESEARCH** - Search organization website contact pages, "Contact Us" sections, phone directories. Format: +[country code] [number] or [country code] [number]
2. localStrengths: **MANDATORY RESEARCH** - Analyze Vietnam market for this event type. Format: "Strengths: [list]. Weaknesses: [list]"
3. layout: **MANDATORY RESEARCH** - Infer from event type, size, industry standards. Format: "Main hall (X pax) + Y breakout rooms (Z pax each) + [other spaces]"

REQUIRED TOP-LEVEL FIELDS:
- companyName: EXACT event name from input (REQUIRED, never empty)
- industry: Infer from event name/organization type or research organization
- country: Extract from location or infer from organization headquarters
- city: Extract from location or infer from organization headquarters
- website: **RESEARCH**: Search for official organization/event website URL
- keyPersonName: **RESEARCH**: Search for President/Director/Secretary General/Executive Director name
- keyPersonTitle: **RESEARCH**: Find actual title (e.g., "Secretary General", "President", "Executive Director")
- keyPersonEmail: **RESEARCH**: Search for official email (info@, contact@, or person-specific format like firstname.lastname@org-domain)
- keyPersonPhone: **MANDATORY RESEARCH** - Search organization website contact pages, phone directories, "Contact Us" sections. DO NOT leave empty unless truly unavailable.
- numberOfDelegates: Extract from TOTATTEND/REGATTEND fields or infer from event size/history
- vietnamEvents: Count events in Vietnam from pastEventsHistory
- totalEvents: Count total events from pastEventsHistory
- pastEventsHistory: Format "YEAR: City, Country; YEAR: City, Country"

EVENT BRIEF FIELDS (MUST RESEARCH COMPREHENSIVELY):
- eventName: Full name with year
- eventSeries: Series name without year
- industry: Same as top-level
- averageAttendance: Average from numberOfDelegates/history
- openYear: **RESEARCH**: Year organization/event was established - search organization history, founding year, first event year
- frequency: "annually", "biennially", "triennially", "irregular" - infer from pastEventsHistory
- rotationArea: "APAC", "Global", "Asia Pacific", etc. - infer from pastEventsHistory
- rotationPattern: Describe rotation pattern if known from history
- duration: Typical duration (e.g., "3 days", "5 days") - infer from industry standards or history
- preferredMonths: Preferred months from history (e.g., "March-June")
- preferredVenue: Venue type preference - infer from event size and type
- breakoutRooms: **RESEARCH**: Number of breakout rooms needed - infer from event size (e.g., "5-7 rooms" for 300-500 delegates, "8-12 rooms" for 500-1000 delegates, "15+ rooms" for 1000+ delegates)
- roomSizes: **RESEARCH**: Size specifications - infer from event size (e.g., "200-300 sqm main hall, 50-80 sqm breakout rooms" for medium events, "500-800 sqm main hall, 100-150 sqm breakout" for large events)
- infoOnLastUpcomingEvents: Last and upcoming event details with dates, locations, attendance
- eventHistory: Detailed history with years, locations, attendance numbers
- delegatesProfile: Who attends (e.g., "Doctors & scientists", "Industry professionals", "Researchers")
- internationalOrganisationName: Full organization name - research official name
- internationalOrganisationWebsite: Organization website URL - research official website
- organizationProfile: Organization description - research organization background, mission, scope
- localHostName: Local host name (if Vietnam event) - research local chapter/host
- localHostTitle: Local host title
- localHostOrganization: Local host organization name
- localHostWebsite: Local host website URL
- localStrengths: **MANDATORY RESEARCH** - Local market strengths & weaknesses for Vietnam. Analyze why Vietnam is suitable, what advantages/disadvantages Vietnam offers. Format: "Strengths: [list 3-5 advantages]. Weaknesses: [list 2-3 disadvantages]". Example: "Strengths: Growing economy, strategic location in SEA, modern infrastructure (APEC 2017 host), competitive costs, beautiful destinations, rich cultural heritage. Weaknesses: Limited international connectivity compared to Singapore/Thailand, visa requirements for some countries, language barriers."
- decisionMaker: Who decides venue (e.g., "Local host", "International board", "DMC")
- decisionMakingProcess: How decisions are made (e.g., "Local host works with DMC, DMC sorts venues and conducts site inspection")
- keyBidCriteria: Key venue selection criteria (e.g., "Venue capacity & breakout rooms, Connectivity, Location accessibility")
- competitors: **RESEARCH**: Known competing venues/destinations - research where similar events have been held (e.g., "Competitors: Singapore, Thailand, Malaysia venues. Past venues: Marina Bay Sands, Bangkok Convention Centre")
- competitiveAnalysis: **RESEARCH**: Competitive landscape analysis - compare Vietnam/Danang with competing destinations
- hostResponsibility: Who organizes (e.g., "Organising Committee, responsible for selection of destination, venue and event plan")
- sponsors: **RESEARCH**: Known or typical sponsors for this type of event - research past sponsors or typical sponsors in this industry (e.g., "Diamond: Company1; Gold: Company2; Silver: Company3" or "Typical sponsors: Medical device companies, pharmaceutical companies")
- layout: **MANDATORY RESEARCH** - Event layout requirements. Infer from event type, size, and industry standards. Format: "Main plenary hall (X pax) + Y breakout rooms (Z pax each) + [exhibition area/poster area/networking space]". Example: "Main plenary hall (500 pax) + 5 breakout rooms (50-100 pax each) + exhibition area (20 booths)" or "Main hall (800 pax) + 8 breakout rooms (80-120 pax each) + poster area + networking space". DO NOT leave empty - always provide layout based on event size.
- fitForAriyana: Why event fits Ariyana (capacity match, location advantages, facilities)
- opportunityScore: 0-100 opportunity score
- iccaQualified: **RESEARCH**: "yes" or "no" with brief explanation - check if event meets ICCA qualification criteria (international association meetings, rotating conferences, significant international participation)

STEP 4: VALIDATE PROBLEMS
--------------------------
List ONLY fields truly missing AFTER enrichment:
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
    "openYear": [number or null],
    "frequency": "[string]",
    "rotationArea": "[string]",
    "rotationPattern": "[string]",
    "duration": "[string]",
    "preferredMonths": "[string]",
    "preferredVenue": "[string]",
    "breakoutRooms": "[string]",
    "roomSizes": "[string]",
    "infoOnLastUpcomingEvents": "[string]",
    "eventHistory": "[string]",
    "delegatesProfile": "[string]",
    "internationalOrganisationName": "[string]",
    "internationalOrganisationWebsite": "[string]",
    "organizationProfile": "[string]",
    "localHostName": "[string]",
    "localHostTitle": "[string]",
    "localHostOrganization": "[string]",
    "localHostWebsite": "[string]",
    "localStrengths": "[string]",
    "decisionMaker": "[string]",
    "decisionMakingProcess": "[string]",
    "keyBidCriteria": "[string]",
    "competitors": "[string]",
    "competitiveAnalysis": "[string]",
    "hostResponsibility": "[string]",
    "sponsors": "[string - RESEARCH: Known or typical sponsors]",
    "layout": "[string - RESEARCH: Event layout requirements]",
    "fitForAriyana": "[string]",
    "opportunityScore": [0-100],
    "iccaQualified": "[string - RESEARCH: 'yes' or 'no' with explanation]"
  }
}]
\`\`\`

CRITICAL RESEARCH REQUIREMENTS (MANDATORY - DO NOT SKIP):
1. **HIGHEST PRIORITY - MUST RESEARCH**: keyPersonPhone, localStrengths, layout
   - keyPersonPhone: Search organization website, contact pages, phone directories. Format: +[country code] [number]
   - localStrengths: Analyze Vietnam market. Format: "Strengths: [list]. Weaknesses: [list]"
   - layout: Infer from event size. Format: "Main hall (X pax) + Y breakout rooms + [spaces]"

2. **MANDATORY FIELDS TO RESEARCH**: breakoutRooms, roomSizes, openYear, keyPersonEmail, competitors, sponsors, iccaQualified
3. For breakoutRooms: Infer from event size (300-500 delegates = 5-7 rooms, 500-1000 = 8-12 rooms, 1000+ = 15+ rooms)
4. For roomSizes: Infer from event size (medium = "200-300 sqm main hall, 50-80 sqm breakout", large = "500-800 sqm main hall, 100-150 sqm breakout")
5. For openYear: Search organization founding year or first event year
6. For keyPersonEmail/Phone: Search organization website contact pages, "Contact Us" sections
7. For localStrengths: Analyze Vietnam market advantages and disadvantages - MUST provide analysis
8. For competitors: Research where similar events have been held - list specific venues/cities
9. For sponsors: Research past sponsors or typical sponsors in this industry - list specific companies or types
10. For layout: Infer from event type, size, and industry standards - MUST provide detailed layout
11. For iccaQualified: Check if event meets ICCA criteria (international association, rotating, significant international participation)

CRITICAL OUTPUT REQUIREMENTS:
1. companyName = EXACT event name from input
2. Strings use "" for empty (never null)
3. Numbers use 0 or null (never empty string)
4. problems array = ONLY truly missing fields AFTER research
5. JSON must be valid and parseable
6. Note enrichment in "notes" field: List all researched fields (e.g., "[AI Enriched: breakoutRooms, roomSizes, openYear, email, phone, localStrengths, competitors, sponsors, layout, iccaQualified]")`;

    console.log('🟢 [GPT API] Strategic analysis request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: 'MICE sales analyst. Evaluate events for Ariyana Convention Centre. Return factual data only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
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

    const prompt = `DATA ENRICHMENT TASK FOR MICE ORGANIZATION
==========================================

ORGANIZATION TO RESEARCH:
- Name: ${companyName}
${keyPerson ? `- Known Contact: ${keyPerson}` : ''}
${city ? `- City: ${city}` : ''}

TASK: Research and provide factual data about this organization. Use empty string "" if information is not found (never null for strings).

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
   - layoutEvent: Venue layout requirements

5. BUSINESS INTELLIGENCE:
   - sponsors: Sponsor information (format: "Diamond: Company1; Gold: Company2; Silver: Company3")
   - conferenceRegistration: Registration details (website, fees, deadlines)
   - iccaQualified: "yes" or "no" with brief explanation
   - competitors: Competing venues/destinations
   - decisionMaker: Who makes venue decisions
   - localStrengthsWeaknesses: Format "Strengths: [list]. Weaknesses: [list]"
   - delegatesProfile: Profile of typical delegates

6. RESEARCH SUMMARY:
   - researchSummary: Brief summary of research findings and data sources

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
  "localStrengthsWeaknesses": "[string or empty string]",
  "researchSummary": "[string or empty string]"
}

CRITICAL REQUIREMENTS:
1. All string fields must be strings (use "" for empty, never null)
2. All number fields must be numbers (use null for missing, never empty string)
3. Research thoroughly - use knowledge base to find real information
4. Be accurate - if uncertain, use empty string rather than guessing
5. JSON must be valid and parseable`;

    console.log('🟢 [GPT API] Data enrichment request');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1', // Using GPT-5.1 for better capabilities
      messages: [
        { 
          role: 'system', 
          content: `MICE industry researcher. Find factual data only. Priority: Secretary General, Organizing Chairman, website, email. Return JSON only. Empty string if not found.` 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_completion_tokens: 1500, // Optimized for concise responses
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
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: 'You are an expert sales email writer specializing in MICE industry outreach.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for accurate, factual email content
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
    const systemInstruction = `Sales assistant for Ariyana Convention Centre Danang. Use ICCA Leads data for accurate insights.

${iccaKnowledge}

Rules: Reference specific leads/data. Provide stats from knowledge base. Suggest strategies based on patterns. Identify high-potential leads (Vietnam history, delegates, industry). Be data-driven and specific.`;

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
      model: 'gpt-5.1',
      messages,
      temperature: 0, // Zero temperature for accurate, factual responses based on knowledge base
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

// POST /api/gpt/check-event-eligibility - Check event eligibility before analysis
router.post('/check-event-eligibility', async (req: Request, res: Response) => {
  try {
    const { eventName, eventData, pastEventsHistory } = req.body;

    if (!eventName || eventName.trim() === '') {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const openai = getAiClient();
    const currentYear = new Date().getFullYear();
    const fiveYearsAgo = currentYear - 5;

    const prompt = `EVENT ELIGIBILITY CHECK FOR ARIYANA CONVENTION CENTRE
==================================================

EVENT TO CHECK:
- Event Name: ${eventName}
${eventData ? `- Event Data: ${eventData.substring(0, 1000)}` : ''}
${pastEventsHistory ? `- Past Events History: ${pastEventsHistory}` : ''}

TASK: Check 3 critical eligibility criteria for this event:

1. VIETNAM HISTORY CHECK:
   - Has this event been held in Vietnam before?
   - Check past events history for Vietnam locations (Ho Chi Minh City, Hanoi, Danang, etc.)
   - Return: true if event has been held in Vietnam, false otherwise

2. ICCA QUALIFIED CHECK:
   - Is this event ICCA (International Congress and Convention Association) qualified?
   - ICCA qualified events are typically:
     * International association meetings
     * Rotating conferences with international participation
     * Events with significant international delegate attendance
     * Events listed in ICCA database
   - Return: true if ICCA qualified, false otherwise

3. RECENT ACTIVITY CHECK (Last 5 Years):
   - Has this event occurred within the last 5 years (${fiveYearsAgo}-${currentYear})?
   - Check the most recent event year from pastEventsHistory
   - If no history provided, infer from event name/pattern
   - Return: true if event occurred in last 5 years, false if older or unknown

OUTPUT FORMAT:
Return valid JSON object:
{
  "eventName": "${eventName}",
  "hasVietnamHistory": true/false,
  "vietnamHistoryDetails": "Brief description of Vietnam events if any",
  "isICCAQualified": true/false,
  "iccaQualifiedReason": "Brief explanation why qualified or not",
  "hasRecentActivity": true/false,
  "mostRecentYear": [year number or null],
  "yearsSinceLastEvent": [number or null],
  "isEligible": true/false,
  "eligibilityReason": "Overall eligibility assessment and reason",
  "recommendation": "proceed" or "skip" or "review"
}

CRITICAL:
- Be factual and conservative - only return true if you have clear evidence
- If uncertain, return false and explain in reason fields
- Use your knowledge base to check ICCA qualification standards
- Check event history carefully for Vietnam locations`;

    console.log('🟢 [GPT API] Checking event eligibility:', eventName);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert MICE industry analyst specializing in ICCA-qualified events and Vietnam market analysis. Provide factual, conservative assessments based on event data and industry knowledge.' 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for factual accuracy
      max_completion_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    let eligibilityData = {};
    
    try {
      eligibilityData = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse GPT eligibility response as JSON:', e);
      // Return default conservative response
      eligibilityData = {
        eventName: eventName,
        hasVietnamHistory: false,
        vietnamHistoryDetails: 'Unable to verify',
        isICCAQualified: false,
        iccaQualifiedReason: 'Unable to verify ICCA qualification',
        hasRecentActivity: false,
        mostRecentYear: null,
        yearsSinceLastEvent: null,
        isEligible: false,
        eligibilityReason: 'Unable to verify eligibility criteria',
        recommendation: 'review'
      };
    }

    res.json({ 
      success: true,
      data: eligibilityData 
    });
  } catch (error: any) {
    console.error('Error in check-event-eligibility:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Event eligibility check failed',
      retryDelay,
      isRateLimit: error.status === 429 || error.message?.includes('rate limit'),
    });
  }
});

// Research edition-specific leadership (chairman, secretary)
// TEMPORARILY DISABLED: AI Research for Organizing Chairman and Secretary General
router.post('/research-edition', async (req: Request, res: Response) => {
  try {
    const { eventName, edition, year, city, country } = req.body;

    if (!eventName) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    // TEMPORARILY DISABLED: Return empty data without calling GPT API
    res.json({ 
      success: true,
      data: {
        organizingChairman: '',
        secretaryGeneral: '',
        confidence: 'low'
      }
    });

    /* DISABLED AI RESEARCH CODE - Keep for reference
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
      model: 'gpt-5.1',
      messages: [
        { 
          role: 'system', 
          content: 'You are a research assistant specializing in finding historical conference leadership information. Be conservative - only return names if you have specific information for the requested edition.' 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_completion_tokens: 500,
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
    */

  } catch (error: any) {
    console.error('Edition research error:', error);
    res.status(500).json({ 
      error: 'Failed to research edition leadership',
      message: error.message 
    });
  }
});

export default router;

