import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent },
  })),
}));

beforeEach(() => {
  setEnv(VALID_ENV);
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createGeminiProvider', () => {
  it('passes prompt + model to the SDK and returns text', async () => {
    const { createGeminiProvider } = await import('./gemini');
    generateContent.mockResolvedValue({ text: 'hello world' });
    const provider = createGeminiProvider();
    const result = await provider.complete({ prompt: 'say hi', model: 'gemini-test' });
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-test', contents: 'say hi' }),
    );
    expect(result).toEqual({ text: 'hello world' });
  });

  it('uses default model when none provided', async () => {
    const { createGeminiProvider } = await import('./gemini');
    generateContent.mockResolvedValue({ text: 'default ok' });
    const provider = createGeminiProvider();
    await provider.complete({ prompt: 'p' });
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.5-flash-lite' }),
    );
  });

  it('wraps SDK errors in AiProviderError', async () => {
    const { createGeminiProvider } = await import('./gemini');
    const { AiProviderError } = await import('../errors');
    generateContent.mockRejectedValue(new Error('boom'));
    const provider = createGeminiProvider();
    await expect(provider.complete({ prompt: 'p' })).rejects.toBeInstanceOf(AiProviderError);
  });
});
