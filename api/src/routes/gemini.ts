import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { query } from '../config/database.js';
import { Lead } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const router = Router();

// Helper to get Gemini client
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }
  return new GoogleGenAI({ apiKey });
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
    const errorMessage = error.message || JSON.stringify(error);
    const retryMatch = errorMessage.match(/Please retry in ([\d.]+)s/i);
    if (retryMatch && retryMatch[1]) {
      return Math.ceil(parseFloat(retryMatch[1]));
    }
    
    // Check error.details
    if (error.details) {
      for (const detail of error.details) {
        if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
          const delayStr = detail.retryDelay;
          const secondsMatch = delayStr.match(/(\d+)s/);
          if (secondsMatch) {
            return parseInt(secondsMatch[1]);
          }
        }
      }
    }
    
    // Check error.error.details (nested structure from Google API)
    if (error.error?.details) {
      for (const detail of error.error.details) {
        if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
          const delayStr = detail.retryDelay;
          const secondsMatch = delayStr.match(/(\d+)s/);
          if (secondsMatch) {
            return parseInt(secondsMatch[1]);
          }
        }
      }
    }
    
    // Try parsing from error.error.message
    if (error.error?.message) {
      const errorMsg = error.error.message;
      const retryMatch = errorMsg.match(/Please retry in ([\d.]+)s/i);
      if (retryMatch && retryMatch[1]) {
        return Math.ceil(parseFloat(retryMatch[1]));
      }
    }
  } catch (e) {
    console.error('Error parsing retry delay:', e);
  }
  return null;
};

// POST /api/gemini/enrich - Enrich lead data
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const { companyName, keyPerson, city } = req.body;
    
    if (!companyName || companyName.trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const ai = getAiClient();
    const modelId = 'gemini-2.5-flash-lite';

    const keyPersonInfo = keyPerson && keyPerson.trim() ? `Key contact person: ${keyPerson}` : 'Key contact person: Not specified';
    const cityInfo = city && city.trim() ? `Located in: ${city}` : 'Location: Not specified';

    const prompt = `DATA ENRICHMENT TASK FOR MICE ORGANIZATION
==========================================

ORGANIZATION TO RESEARCH:
- Name: ${companyName}
${keyPersonInfo}
${cityInfo}

TASK: Research and provide factual data about this organization. Use your knowledge base to find real information.

REQUIRED RESEARCH AREAS:
-----------------------
1. COMPANY OVERVIEW:
   - Brief description of what this organization does
   - Industry/sector classification

2. CONTACT INFORMATION (CRITICAL - SEARCH AND FIND):
   - Website URL: Find official organization website
   - Key Contact Person Name: Search for President, Director, Secretary General, Executive Director, etc.
   - Key Contact Person Title: Find actual title (e.g., "Secretary General", "President", "Executive Director", "Director of Conferences")
   - Contact Email: Search for official email (info@, contact@, or person-specific format)
   - Phone Number: Find official phone number if available

3. EVENT HISTORY:
   - Notable past events/conferences organized
   - Years and locations of events
   - Event frequency and patterns

4. INDUSTRY CONTEXT:
   - Industry or sector classification
   - Type of organization (association, society, corporation, etc.)

5. RECENT ACTIVITY:
   - Notable recent news or activities
   - Upcoming events if known

RESEARCH GUIDELINES:
--------------------
- For international associations: Common titles include "Secretary General", "President", "Executive Director", "Director of Events/Conferences"
- Search for real contact details, not just generic formats
- Use official websites and verified sources
- If specific information is not available, provide general information about organizations of this type
- Be accurate - if uncertain about a detail, state that clearly

OUTPUT FORMAT:
--------------
Format your response in a clear, structured way useful for a sales team:
- Use clear headings for each section
- Provide specific details when available
- Note data sources or confidence level if relevant
- Include actionable contact information prominently`;

    console.log('🔵 [Gemini API] Enrich request for:', companyName);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        // Enable Google Search tool to find contact information
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || 'No results found.';
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || null;

    res.json({ text, grounding });
  } catch (error: any) {
    console.error('Error in enrich:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Enrichment failed',
      retryDelay,
      isRateLimit: error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED'),
    });
  }
});

// POST /api/gemini/draft-email - Draft sales email
router.post('/draft-email', async (req: Request, res: Response) => {
  try {
    const { leadName, leadCompany, leadTitle, eventContext } = req.body;

    if (!leadName || !leadCompany) {
      return res.status(400).json({ error: 'Lead name and company are required' });
    }

    const ai = getAiClient();
    const modelId = 'gemini-2.5-flash-lite';

    const prompt = `Write a personalized, professional sales email to ${leadName}, ${leadTitle} at ${leadCompany}.
  
  Context: I am representing 'Ariyana Convention Centre' in Danang, Vietnam.
  We want to host their next event: ${eventContext}.
  
  Highlight:
  - Oceanfront location
  - Large capacity (APEC venue)
  - Proximity to heritage sites
  
  Tone: Professional, warm, inviting.
  Format: JSON with 'subject' and 'body' fields.`;

    console.log('🔵 [Gemini API] Draft email request for:', leadName);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
          },
        },
      },
    });

    let result;
    try {
      const text = response.text || '';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON Parse Error', e);
      result = { subject: 'Error generating subject', body: response.text || '' };
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error in draft-email:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Email drafting failed',
      retryDelay,
      isRateLimit: error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED'),
    });
  }
});

// POST /api/gemini/chat - Chat assistant
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { history, message } = req.body;

    if (!message || !history) {
      return res.status(400).json({ error: 'Message and history are required' });
    }

    // Load ICCA Leads knowledge base
    console.log('📚 [Gemini API] Loading ICCA Leads knowledge base...');
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

    const ai = getAiClient();
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash-lite',
      history: history,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    console.log('🔵 [Gemini API] Chat request with ICCA Leads knowledge base');
    const response = await chat.sendMessage({ message });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Error in chat:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Chat failed',
      retryDelay,
      isRateLimit: error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED'),
    });
  }
});

// POST /api/gemini/analyze-video - Analyze video/image
router.post('/analyze-video', async (req: Request, res: Response) => {
  try {
    const { base64Data, mimeType } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Base64 data and mime type are required' });
    }

    const ai = getAiClient();
    const modelId = 'gemini-2.5-flash-lite';

    const prompt = `Bạn là Sales Intelligence Analyst cho Ariyana Convention Centre Đà Nẵng. Phân tích hình ảnh/video này để cung cấp insights cho sales team. Trả lời bằng tiếng Việt, tối đa 300 từ, tập trung vào thông tin có thể hành động được.

MỤC TIÊU SALES:
1. Nhận diện đối thủ cạnh tranh và điểm mạnh của họ
2. Xác định cơ hội cho Ariyana để giành được sự kiện tương tự
3. Đề xuất chiến lược pitch cụ thể

PHÂN TÍCH BẮT BUỘC:

A. NHẬN DIỆN SỰ KIỆN & VENUE:
- Tên sự kiện (HORECFEX, VITM, ITE HCMC, Food & Hotel Vietnam, PropVietnam, v.v.)
- Venue/địa điểm tổ chức (nếu có thể nhận diện)
- Loại sự kiện: Hội chợ thương mại / Triển lãm / Hội nghị / Sự kiện ngành
- Quy mô: Số lượng gian hàng, không gian, mật độ người tham dự

B. COMPETITIVE INTELLIGENCE (Quan trọng nhất):
- Điểm mạnh của venue đối thủ (vị trí, thiết kế, không gian, tiện ích)
- Điểm yếu/giới hạn có thể nhìn thấy
- Đặc điểm nổi bật thu hút khách hàng

C. SALES OPPORTUNITY:
- Loại khách hàng mục tiêu (ngành nghề, quy mô, budget ước tính)
- Tại sao sự kiện này phù hợp với Ariyana?
- Điểm khác biệt của Ariyana có thể highlight:
  * Vị trí biển (oceanfront), gần di sản UNESCO
  * Kinh nghiệm APEC 2017
  * Sức chứa lớn, cơ sở hạ tầng hiện đại

D. ACTIONABLE RECOMMENDATIONS:
- 2-3 pitch points cụ thể để sales team sử dụng khi tiếp cận khách hàng
- Timing/chiến lược tiếp cận (khi nào, cách nào)
- Đề xuất package hoặc dịch vụ phù hợp

Format: Trình bày rõ ràng theo 4 phần A, B, C, D. Tập trung vào insights có thể hành động, không chỉ mô tả.`;

    console.log('🔵 [Gemini API] Analyze video request');
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        temperature: 0.6,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1200,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Error in analyze-video:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Video analysis failed',
      retryDelay,
      isRateLimit: error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED'),
    });
  }
});

// GET /api/gemini/knowledge-base - Get ICCA Leads knowledge base summary
router.get('/knowledge-base', async (req: Request, res: Response) => {
  try {
    console.log('📚 [Gemini API] Knowledge base request');
    const knowledge = await getICCALeadsKnowledge();
    res.json({ knowledge });
  } catch (error: any) {
    console.error('Error in knowledge-base:', error);
    res.status(500).json({
      error: error.message || 'Failed to load knowledge base',
    });
  }
});

// POST /api/gemini/strategic-analysis - Strategic analysis
router.post('/strategic-analysis', async (req: Request, res: Response) => {
  try {
    const { leadsData } = req.body;

    if (!leadsData || leadsData.trim() === '') {
      return res.status(400).json({ error: 'Leads data is required' });
    }

    const ai = getAiClient();
    const modelId = 'gemini-2.5-flash-lite';

    const prompt = `EVENT ANALYSIS TASK
==================
You are analyzing ONE SPECIFIC EVENT from imported Excel/CSV data. Evaluate ONLY this event for Ariyana Convention Centre Danang.

INPUT DATA:
${leadsData}

STEP 1: EXTRACT EVENT NAME
---------------------------
Find the EVENT NAME in the input data. Check fields: "EVENT", "Event Name", "Event", "Series", "SERIES", "Event Series".
CRITICAL: Use the EXACT event name as "companyName" in JSON output. Do NOT use organization name or modify the name.

STEP 2: CALCULATE SCORES (Strict Rules)
----------------------------------------
Apply these exact scoring rules:

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
- openYear: **RESEARCH**: Year organization/event was established - search organization history, founding year, first event year
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
- localHostName: **RESEARCH MANDATORY**: Name of Local Host / Member - research local chapter/host name or member organization name. If event has been in Vietnam, find the local host. If not, research potential local host organization or member. Format: "Full Name" or "Organization Name" or "Name of Local Host / Member"
- localHostTitle: **RESEARCH**: Local host title/position (e.g., "President", "Secretary General", "Chairman", "Executive Director")
- localHostEmail: **RESEARCH MANDATORY**: Local host contact email - search organization website, contact pages, or member directory. Format: email address or empty string if not found
- localHostPhone: **RESEARCH MANDATORY**: Local host contact phone number - search organization website, contact pages. Format: phone number with country code or empty string if not found
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
List ONLY fields that are truly missing AFTER enrichment:
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
    "openYear": [number or null],
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
    "localHostName": "[string - RESEARCH MANDATORY: Name of Local Host / Member - MUST NOT BE EMPTY. Research local chapter/host name or member organization name]",
    "localHostTitle": "[string - RESEARCH MANDATORY: Local host title/position - MUST NOT BE EMPTY. Find actual title like 'President', 'Secretary General', 'Chairman']",
    "localHostEmail": "[string - RESEARCH MANDATORY: Local host contact email - MUST NOT BE EMPTY. Search organization website, contact pages, member directory]",
    "localHostPhone": "[string - RESEARCH MANDATORY: Local host contact phone - MUST NOT BE EMPTY. Search organization website, contact pages. Include country code]",
    "localHostOrganization": "[string - RESEARCH: Local host organization name (if different from international organization)]",
    "localHostWebsite": "[string - RESEARCH: Local host website URL]",
    "localStrengths": "[string - RESEARCH MANDATORY: Must include BOTH Strengths AND Weaknesses - MUST NOT BE EMPTY. Format: 'Strengths: [list]. Weaknesses: [list]']",
    "decisionMaker": "[string]",
    "decisionMakingProcess": "[string]",
    "keyBidCriteria": "[string]",
    "competitors": "[string]",
    "competitiveAnalysis": "[string]",
    "hostResponsibility": "[string]",
    "sponsors": "[string]",
    "layout": "[string - RESEARCH MANDATORY: Detailed event layout requirements - MUST NOT BE EMPTY. Format: 'Main plenary hall: [capacity] pax, [size] sqm; Breakout rooms: [number] rooms, [capacity range] pax each, [size range] sqm; Exhibition area: [number] booths, [size] sqm; Additional spaces: [details]']",
    "fitForAriyana": "[string]",
    "conferenceRegistration": "[string - RESEARCH MANDATORY: Registration website, fees, deadlines, process - MUST NOT BE EMPTY. Format: 'Registration Website: [URL]. Registration Fees: [details]. Deadlines: [dates]. Process: [description]. Contact: [email/phone]']",
    "opportunityScore": [0-100],
    "iccaQualified": "[string - RESEARCH: 'yes' or 'no' with explanation]"
  }
}]
\`\`\`

CRITICAL RESEARCH REQUIREMENTS:
1. **MANDATORY FIELDS TO RESEARCH** (MUST NOT BE EMPTY): 
   - infoOnLastUpcomingEvents: MUST provide last event AND upcoming event details with dates, locations, attendance
   - localHostName: MUST find Name of Local Host / Member
   - localHostEmail: MUST search for local host email
   - localHostPhone: MUST search for local host phone
   - localStrengths: MUST include BOTH Strengths AND Weaknesses for Vietnam
   - layout: MUST provide detailed layout specifications (plenary hall, breakout rooms, exhibition, etc.)
   - conferenceRegistration: MUST provide registration website, fees, deadlines, process
   - breakoutRooms, roomSizes, openYear, keyPersonEmail, keyPersonPhone, competitors, sponsors, iccaQualified
2. For breakoutRooms: Infer from event size (300-500 delegates = 5-7 rooms, 500-1000 = 8-12 rooms, 1000+ = 15+ rooms)
3. For roomSizes: Infer from event size (medium = "200-300 sqm main hall, 50-80 sqm breakout", large = "500-800 sqm main hall, 100-150 sqm breakout")
4. For openYear: Search organization founding year or first event year
5. For keyPersonEmail/Phone: Search organization website contact pages
6. For infoOnLastUpcomingEvents: MUST provide comprehensive details - last event: year, city, country, attendance; upcoming event: year, city, country, expected attendance. This is CRITICAL information.
7. For localHostName: Search for local chapter/host organization name or member name. Check organization website for local chapters, members, or host information.
8. For localHostEmail/Phone: Search organization website contact pages, member directories, local chapter pages for email and phone contact information.
9. For localStrengths: MUST analyze BOTH strengths (advantages Vietnam offers) AND weaknesses (challenges). Format: "Strengths: [list]. Weaknesses: [list]"
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
   - infoOnLastUpcomingEvents (last event + upcoming event details)
   - localHostName (Name of Local Host / Member)
   - localHostTitle (Title/Position of Local Host)
   - localHostEmail (contact email)
   - localHostPhone (contact phone)
   - localStrengths (Strengths AND Weaknesses)
   - layout (detailed layout specifications)
   - conferenceRegistration (registration details)

8. **VALIDATION CHECKLIST** - Before outputting JSON, verify ALL these fields are filled:
   ✓ localHostName: Is there a name? (If event in Vietnam, find actual host. If not, research potential host/member)
   ✓ localHostTitle: Is there a title? (Search for President, Secretary General, Chairman, etc.)
   ✓ localHostEmail: Is there an email? (Search organization website, contact pages, member directory)
   ✓ localHostPhone: Is there a phone? (Search organization website, contact pages)
   ✓ localStrengths: Does it include BOTH "Strengths:" AND "Weaknesses:"?
   ✓ layout: Does it include plenary hall, breakout rooms, exhibition area specifications?
   ✓ conferenceRegistration: Does it include website, fees, deadlines, process?
   ✓ infoOnLastUpcomingEvents: Does it include both last event AND upcoming event details?

If any field above is empty, you MUST research more thoroughly before outputting.`;

    console.log('🔵 [Gemini API] Strategic analysis request');
    console.log('📝 [Gemini API] Data length:', leadsData.length, 'characters');
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Error in strategic-analysis:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'Strategic analysis failed',
      retryDelay,
      isRateLimit: error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED'),
    });
  }
});

export default router;

