import { vi } from 'vitest';

/**
 * Mock for `openai` SDK (used by api/src/routes/gpt.ts).
 *
 * Usage at top of a test file:
 *   vi.mock('openai', () => import('../../tests/mocks/openai').then((m) => m.makeOpenaiMock()));
 */
export function makeOpenaiMock() {
  const create = vi.fn();
  const OpenAI = vi.fn(() => ({
    chat: { completions: { create } },
  }));
  return {
    default: OpenAI,
    __create: create,
  };
}
