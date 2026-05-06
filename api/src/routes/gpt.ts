import type { Request, Response } from 'express';
import { Router } from 'express';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { extractRetryDelay } from '../services/ai/errors.js';
import { getICCALeadsKnowledge } from '../services/ai/knowledge.js';
import {
  buildOpenaiEnrichPrompt,
  parseOpenaiEnrichResponse,
  OPENAI_ENRICH_SYSTEM_MESSAGE,
} from '../services/ai/prompts/enrich.js';
import {
  buildOpenaiDraftEmailPrompt,
  OPENAI_DRAFT_EMAIL_SYSTEM_MESSAGE,
} from '../services/ai/prompts/draftEmail.js';
import { buildOpenaiChatSystemInstruction } from '../services/ai/prompts/chat.js';
import {
  buildOpenaiStrategicAnalysisPrompt,
  OPENAI_STRATEGIC_ANALYSIS_SYSTEM_MESSAGE,
} from '../services/ai/prompts/strategicAnalysis.js';
import {
  buildOpenaiExtractOrganizationsPrompt,
  parseExtractOrganizationsResponse,
  OPENAI_EXTRACT_ORGANIZATIONS_SYSTEM_MESSAGE,
} from '../services/ai/prompts/extractOrganizations.js';
import {
  buildOpenaiCheckEventEligibilityPrompt,
  parseCheckEventEligibilityResponse,
  OPENAI_CHECK_EVENT_ELIGIBILITY_SYSTEM_MESSAGE,
} from '../services/ai/prompts/checkEventEligibility.js';

const router = Router();

// Helper to get OpenAI client
const getAiClient = () => {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
};

// POST /api/gpt/extract-organizations - Extract organization names using GPT-4o mini with Research Tools
router.post('/extract-organizations', async (req: Request, res: Response) => {
  try {
    const { data, summary } = req.body;

    if (!data || data.trim() === '') {
      return res.status(400).json({ error: 'Data is required' });
    }

    const openai = getAiClient();
    const userPrompt = buildOpenaiExtractOrganizationsPrompt({ data, summary });

    console.log('🟢 [GPT API] Extract organizations request');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: OPENAI_EXTRACT_ORGANIZATIONS_SYSTEM_MESSAGE },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for maximum accuracy - no hallucination
    });

    const result = parseExtractOrganizationsResponse(response.choices[0]?.message?.content || '{}');

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

    const prompt = buildOpenaiStrategicAnalysisPrompt({ leadsData });

    console.log('🟢 [GPT API] Strategic analysis request');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: OPENAI_STRATEGIC_ANALYSIS_SYSTEM_MESSAGE },
        { role: 'user', content: prompt },
      ],
      temperature: 0, // Zero temperature for maximum accuracy and consistency
      max_tokens: 4000, // Ensure sufficient tokens for comprehensive analysis
    });

    // Handle tool calls if any
    const finalResponse = response.choices[0]?.message?.content || '';

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
    const prompt = buildOpenaiEnrichPrompt({ companyName, keyPerson, city });

    console.log('🟢 [GPT API] Data enrichment request');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using GPT-4o-mini for cost efficiency (60-90% cheaper than GPT-4o)
      messages: [
        { role: 'system', content: OPENAI_ENRICH_SYSTEM_MESSAGE },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for maximum accuracy
      max_tokens: 2000, // Sufficient tokens for comprehensive research data
    });

    const enrichedData = parseOpenaiEnrichResponse(response.choices[0]?.message?.content || '{}');

    res.json({
      text: JSON.stringify(enrichedData, null, 2),
      research: enrichedData,
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
    const prompt = buildOpenaiDraftEmailPrompt({ leadName, leadCompany, leadTitle, eventContext });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: OPENAI_DRAFT_EMAIL_SYSTEM_MESSAGE },
        { role: 'user', content: prompt },
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
    const systemInstruction = buildOpenaiChatSystemInstruction(iccaKnowledge);

    const openai = getAiClient();

    const messages: any[] = [{ role: 'system', content: systemInstruction }];

    // Convert history format if needed
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.role || 'user',
          content: msg.content || msg.text || '',
        });
      });
    }

    messages.push({ role: 'user', content: message });

    console.log('🟢 [GPT API] Chat request with ICCA Leads knowledge base');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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

    const prompt = buildOpenaiCheckEventEligibilityPrompt({
      eventName,
      eventData,
      pastEventsHistory,
      currentYear,
      fiveYearsAgo,
    });

    console.log('🟢 [GPT API] Checking event eligibility:', eventName);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: OPENAI_CHECK_EVENT_ELIGIBILITY_SYSTEM_MESSAGE },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // Zero temperature for factual accuracy
      max_completion_tokens: 500,
    });

    const eligibilityData = parseCheckEventEligibilityResponse(
      response.choices[0]?.message?.content || '{}',
      eventName,
    );

    res.json({
      success: true,
      data: eligibilityData,
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
        confidence: 'low',
      },
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
      message: error.message,
    });
  }
});

export default router;
