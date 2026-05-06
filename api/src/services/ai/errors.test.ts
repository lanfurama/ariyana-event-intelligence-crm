import { describe, expect, it } from 'vitest';
import { AiProviderError, extractRetryDelay } from './errors';

describe('AiProviderError', () => {
  it('captures provider, cause, and message', () => {
    const cause = new Error('rate limited');
    const err = new AiProviderError('gemini', cause, 'Gemini failed');
    expect(err.provider).toBe('gemini');
    expect(err.cause).toBe(cause);
    expect(err.message).toBe('Gemini failed');
    expect(err).toBeInstanceOf(Error);
  });

  it('supports openai as provider', () => {
    const err = new AiProviderError('openai', new Error('x'), 'OpenAI failed');
    expect(err.provider).toBe('openai');
  });
});

describe('extractRetryDelay', () => {
  it('returns null for plain Error objects without rate-limit info', () => {
    expect(extractRetryDelay(new Error('plain error'))).toBe(null);
  });

  it('extracts seconds from a "Please retry in Xs" message', () => {
    const err = new Error('Quota exceeded. Please retry in 12.5s');
    expect(extractRetryDelay(err)).toBe(13); // ceil(12.5)
  });

  it('extracts retry delay from a Gemini-shaped 429 error (top-level details)', () => {
    const err = {
      details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' }],
    };
    expect(extractRetryDelay(err)).toBe(30);
  });

  it('extracts from nested error.error.details', () => {
    const err = {
      error: {
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '45s' }],
      },
    };
    expect(extractRetryDelay(err)).toBe(45);
  });

  it('extracts from error.error.message', () => {
    const err = { error: { message: 'You exceeded the quota. Please retry in 7.2s' } };
    expect(extractRetryDelay(err)).toBe(8); // ceil(7.2)
  });

  it('returns null when no retry info is anywhere', () => {
    expect(extractRetryDelay({ details: [{ '@type': 'something else' }] })).toBe(null);
  });
});
