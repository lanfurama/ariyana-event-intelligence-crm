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

    const prompt = `You are a business research assistant. I need you to provide information about the following organization:

Organization Name: ${companyName}
${keyPersonInfo}
${cityInfo}

**CRITICAL: You MUST search and find contact information if missing:**

Please provide a comprehensive summary based on your knowledge about this organization. Include:

1. **Company Overview**: Brief description of what this organization does
2. **Contact Information** (SEARCH AND FIND if not provided):
   - Website URL (find official website)
   - Key contact person name (President, Director, Secretary General, Executive Director, etc.)
   - Key contact person title (e.g., "Secretary General", "President", "Executive Director")
   - Contact email (official email format: info@, contact@, or specific person's email)
   - Phone number (official phone number if available)
3. **Event History**: If this is an event organizer or association, mention any notable past events or conferences they have organized (include years and locations if known)
4. **Industry Context**: What industry or sector this organization operates in
5. **Recent Activity**: Any notable recent news or activities (if known)

**IMPORTANT**: Use your knowledge base to actively search for missing contact information. For international associations and organizations, common titles include "Secretary General", "President", "Executive Director", "Director of Events/Conferences". Try to find real contact details, not just generic formats.

If you don't have specific information about this organization, please state that clearly and provide general information about organizations of this type or name.

Format your response in a clear, structured way that would be useful for a sales team trying to reach out to this organization.`;

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
For THIS EVENT, if contact information is missing (keyPersonName, keyPersonTitle, keyPersonEmail, keyPersonPhone), you MUST use your knowledge to search and find this information:
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

Use your knowledge base and infer from organization names, types, event history, and common patterns. For international associations and organizations, common titles include "Secretary General", "President", "Executive Director", "Director of Events/Conferences".

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

