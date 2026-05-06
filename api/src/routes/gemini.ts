import type { Request, Response } from 'express';
import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import type { Lead } from '../types/index.js';
import { buildGeminiEnrichPrompt } from '../services/ai/prompts/enrich.js';
import {
  buildGeminiDraftEmailPrompt,
  parseGeminiDraftEmailResponse,
} from '../services/ai/prompts/draftEmail.js';
import { buildGeminiChatSystemInstruction } from '../services/ai/prompts/chat.js';
import { buildGeminiStrategicAnalysisPrompt } from '../services/ai/prompts/strategicAnalysis.js';
import { GEMINI_ANALYZE_VIDEO_PROMPT } from '../services/ai/prompts/analyzeVideo.js';

const router = Router();

// Helper to get Gemini client
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
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

    leads.forEach((lead) => {
      // Group by industry
      const industry = lead.industry || 'Unknown';
      if (!byIndustry[industry]) byIndustry[industry] = [];
      byIndustry[industry].push(lead);

      // Group by country
      const country = lead.country || 'Unknown';
      if (!byCountry[country]) byCountry[country] = [];
      byCountry[country].push(lead);

      // High priority: has Vietnam events or high delegate count
      if (
        lead.vietnam_events > 0 ||
        (lead.number_of_delegates && lead.number_of_delegates >= 300)
      ) {
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
    Object.entries(byIndustry)
      .slice(0, 10)
      .forEach(([industry, industryLeads]) => {
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
        if (lead.past_events_history)
          knowledge += ` - History: ${lead.past_events_history.substring(0, 100)}`;
        if (lead.key_person_email) knowledge += ` - Email: ${lead.key_person_email}`;
        knowledge += `\n`;
      });
      knowledge += `\n`;
    }

    // Key patterns and insights
    knowledge += `Key Patterns:\n`;
    const avgDelegates =
      leads
        .filter((l) => l.number_of_delegates)
        .reduce((sum, l) => sum + (l.number_of_delegates || 0), 0) /
        leads.filter((l) => l.number_of_delegates).length || 0;
    if (avgDelegates > 0) {
      knowledge += `- Average delegate count: ${Math.round(avgDelegates)}\n`;
    }
    const totalVietnamEvents = leads.reduce((sum, l) => sum + l.vietnam_events, 0);
    knowledge += `- Total Vietnam events across all leads: ${totalVietnamEvents}\n`;
    const leadsWithEmail = leads.filter((l) => l.key_person_email).length;
    knowledge += `- Leads with contact email: ${leadsWithEmail} (${Math.round((leadsWithEmail / leads.length) * 100)}%)\n`;
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
    const prompt = buildGeminiEnrichPrompt({ companyName, keyPerson, city });

    console.log('🔵 [Gemini API] Enrich request for:', companyName);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
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
    const prompt = buildGeminiDraftEmailPrompt({ leadName, leadCompany, leadTitle, eventContext });

    console.log('🔵 [Gemini API] Draft email request for:', leadName);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
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

    const result = parseGeminiDraftEmailResponse(response.text || '');
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
    const systemInstruction = buildGeminiChatSystemInstruction(iccaKnowledge);

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

    console.log('🔵 [Gemini API] Analyze video request');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          { text: GEMINI_ANALYZE_VIDEO_PROMPT },
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
    const prompt = buildGeminiStrategicAnalysisPrompt({ leadsData });

    console.log('🔵 [Gemini API] Strategic analysis request');
    console.log('📝 [Gemini API] Data length:', leadsData.length, 'characters');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
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
