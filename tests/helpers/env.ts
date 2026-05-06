import { vi } from 'vitest';

/**
 * Minimum complete env set for env.ts to parse successfully.
 * Tests that exercise the schema can spread this and override fields.
 */
export const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_NAME: 'test_db',
  DB_USER: 'test_user',
  DB_PASSWORD: 'test_password',
  GEMINI_API_KEY: 'test-gemini-key',
  OPENAI_API_KEY: 'test-openai-key',
  EMAIL_HOST: 'smtp.example.com',
  EMAIL_HOST_USER: 'tester@example.com',
  EMAIL_HOST_PASSWORD: 'password',
  DEFAULT_FROM_EMAIL: 'from@example.com',
};

/**
 * Set process.env to exactly the provided values (clears unset keys among VALID_ENV first).
 * Pair with the global afterEach in tests/setup.ts which restores original env.
 */
export function setEnv(values: Record<string, string | undefined>): void {
  for (const key of Object.keys(VALID_ENV)) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * dotenv mock factory. Use as:
 *   vi.mock('dotenv', () => makeDotenvMock());
 * Place at top of test files that import api/src/config/env.ts.
 */
export function makeDotenvMock() {
  return {
    default: { config: vi.fn() },
    config: vi.fn(),
  };
}
