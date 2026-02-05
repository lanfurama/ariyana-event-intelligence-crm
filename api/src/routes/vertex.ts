import { Router, Request, Response } from 'express';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import { buildEnrichPrompt } from '../config/vertexEnrichPrompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const router = Router();

const VERTEX_MODEL = process.env.VERTEX_AI_MODEL ?? 'gemini-2.5-pro';

function getVertexConfig() {
  const apiKey = process.env.VERTEX_AI_API_KEY;
  const projectId = process.env.VERTEX_AI_PROJECT_ID;
  const location = process.env.VERTEX_AI_LOCATION ?? 'europe-west4';

  if (!apiKey || !projectId) {
    throw new Error(
      'VERTEX_AI_API_KEY and VERTEX_AI_PROJECT_ID are required. Set them in .env.'
    );
  }
  return { apiKey, projectId, location };
}

/**
 * POST /enrich
 * Body: { companyName: string, keyPerson?: string, city?: string }
 * Returns: { text: string } - raw model response containing KEY PERSON CONTACT block.
 */
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const { companyName, keyPerson, city } = req.body as {
      companyName?: string;
      keyPerson?: string;
      city?: string;
    };

    if (!companyName || String(companyName).trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const { apiKey, projectId, location } = getVertexConfig();
    const prompt = buildEnrichPrompt(
      String(companyName).trim(),
      keyPerson ? String(keyPerson).trim() : '',
      city ? String(city).trim() : ''
    );

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${VERTEX_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.error?.message || data?.error?.status || response.statusText || 'Vertex AI request failed';
      console.error('[Vertex enrich] API error:', response.status, message);
      return res.status(response.status >= 500 ? 502 : 400).json({
        error: message,
        isRateLimit:
          response.status === 429 ||
          String(message).includes('429') ||
          String(message).includes('RESOURCE_EXHAUSTED'),
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No results found.';
    res.json({ text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Enrichment failed';
    console.error('[Vertex enrich] Error:', error);
    res.status(500).json({ error: message });
  }
});

export default router;
