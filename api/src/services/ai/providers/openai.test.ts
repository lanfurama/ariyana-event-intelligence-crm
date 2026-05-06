import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

const create = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: { completions: { create } },
  })),
}));

beforeEach(() => {
  setEnv(VALID_ENV);
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createOpenaiProvider', () => {
  it('sends the prompt as a user message and returns content', async () => {
    const { createOpenaiProvider } = await import('./openai');
    create.mockResolvedValue({ choices: [{ message: { content: 'hi back' } }] });
    const provider = createOpenaiProvider();
    const result = await provider.complete({ prompt: 'say hi' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'say hi' }],
      }),
    );
    expect(result).toEqual({ text: 'hi back' });
  });

  it('uses default model gpt-4o-mini', async () => {
    const { createOpenaiProvider } = await import('./openai');
    create.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
    const provider = createOpenaiProvider();
    await provider.complete({ prompt: 'p' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4o-mini' }));
  });

  it('wraps SDK errors in AiProviderError', async () => {
    const { createOpenaiProvider } = await import('./openai');
    const { AiProviderError } = await import('../errors');
    create.mockRejectedValue(new Error('rate limit'));
    const provider = createOpenaiProvider();
    await expect(provider.complete({ prompt: 'p' })).rejects.toBeInstanceOf(AiProviderError);
  });
});
