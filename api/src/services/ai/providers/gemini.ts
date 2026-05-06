import { GoogleGenAI } from '@google/genai';
import { env } from '../../../config/env.js';
import type { AiCompletionRequest, AiCompletionResponse } from '../types.js';
import { AiProviderError } from '../errors.js';

/**
 * Thin wrapper around the @google/genai SDK. Exposes `complete()` returning
 * provider-agnostic AiCompletionResponse. Knows nothing about business ops.
 */
export function createGeminiProvider() {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  return {
    async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
      try {
        const result = await ai.models.generateContent({
          model: req.model ?? 'gemini-2.5-flash-lite',
          contents: req.prompt,
          ...(req.responseSchema
            ? {
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: req.responseSchema as object,
                },
              }
            : {}),
        });
        const text = result.text ?? '';
        return { text };
      } catch (cause) {
        throw new AiProviderError('gemini', cause, 'Gemini provider call failed');
      }
    },
  };
}
