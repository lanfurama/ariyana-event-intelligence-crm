import type { Request, Response } from 'express';
import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';
import { extractRetryDelay } from '../services/ai/errors.js';
import { getICCALeadsKnowledge } from '../services/ai/knowledge.js';
import { buildGeminiEnrichPrompt } from '../services/ai/prompts/enrich.js';
import {
  buildGeminiDraftEmailPrompt,
  parseGeminiDraftEmailResponse,
} from '../services/ai/prompts/draftEmail.js';
import { buildGeminiChatSystemInstruction } from '../services/ai/prompts/chat.js';
import { buildGeminiParseRfpPrompt, parseRfpExtraction } from '../services/ai/prompts/parseRfp.js';
import { buildGeminiStrategicAnalysisPrompt } from '../services/ai/prompts/strategicAnalysis.js';
import { GEMINI_ANALYZE_VIDEO_PROMPT } from '../services/ai/prompts/analyzeVideo.js';

const router = Router();

// Helper to get Gemini client
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
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

// POST /api/gemini/parse-rfp - extract a structured booking request from pasted email text
router.post('/parse-rfp', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > 20000) {
      return res.status(400).json({ error: 'text is too long (max 20000 characters)' });
    }

    const ai = getAiClient();
    const todayIso = new Date().toISOString().slice(0, 10);
    const prompt = buildGeminiParseRfpPrompt(text, todayIso);

    console.log('🔵 [Gemini API] Parse RFP request');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_rfp: { type: Type.BOOLEAN },
            company_name: { type: Type.STRING },
            contact_name: { type: Type.STRING },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            event_type: { type: Type.STRING },
            expected_guests: { type: Type.NUMBER },
            preferred_date: { type: Type.STRING },
            layout: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
        },
      },
    });

    res.json(parseRfpExtraction(response.text || ''));
  } catch (error: any) {
    console.error('Error in parse-rfp:', error);
    const retryDelay = extractRetryDelay(error);
    res.status(500).json({
      error: error.message || 'RFP parsing failed',
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
