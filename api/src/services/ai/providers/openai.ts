import OpenAI from 'openai';
import { env } from '../../../config/env.js';
import type { AiCompletionRequest, AiCompletionResponse } from '../types.js';
import { AiProviderError } from '../errors.js';

/**
 * Thin wrapper around the openai SDK. Exposes `complete()` returning
 * provider-agnostic AiCompletionResponse.
 */
export function createOpenaiProvider() {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
      try {
        const response = await client.chat.completions.create({
          model: req.model ?? 'gpt-4o-mini',
          messages: [{ role: 'user', content: req.prompt }],
          ...(req.responseSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: 'response',
                    schema: req.responseSchema as Record<string, unknown>,
                    strict: false,
                  },
                },
              }
            : {}),
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          ...(req.maxOutputTokens !== undefined ? { max_tokens: req.maxOutputTokens } : {}),
        });
        const text = response.choices[0]?.message?.content ?? '';
        return { text };
      } catch (cause) {
        throw new AiProviderError('openai', cause, 'OpenAI provider call failed');
      }
    },
  };
}
