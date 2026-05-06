import { vi } from 'vitest';

/**
 * Mock for `@google/generative-ai` (used by leadScoringService.ts).
 *
 * Usage at top of a test file:
 *   vi.mock('@google/generative-ai', () => import('../../tests/mocks/gemini').then((m) => m.makeGenAiMock()));
 *
 * Then in your test:
 *   import { __generateContent } from './your-module-under-test';
 *   __generateContent.mockResolvedValueOnce({ response: { text: () => '{"score":80,...}' } });
 */
export function makeGenAiMock() {
  const generateContent = vi.fn();
  const getGenerativeModel = vi.fn(() => ({ generateContent }));
  return {
    GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel })),
    __generateContent: generateContent,
  };
}

/**
 * Mock for `@google/genai` (used by api/src/routes/gemini.ts and excelImport.ts).
 * Different SDK from @google/generative-ai despite the similar name.
 */
export function makeGenAi2Mock() {
  const generateContent = vi.fn();
  return {
    GoogleGenAI: vi.fn(() => ({
      models: { generateContent },
    })),
    Type: {
      OBJECT: 'object',
      STRING: 'string',
      NUMBER: 'number',
      ARRAY: 'array',
    },
    __generateContent: generateContent,
  };
}
