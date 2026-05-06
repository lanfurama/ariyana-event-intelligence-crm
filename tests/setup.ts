import { afterEach, beforeAll } from 'vitest';

beforeAll(() => {
  // Default for tests; individual cases can override before importing modules under test.
  process.env.NODE_ENV = 'test';
});

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore env between tests so one test's setEnv() can't leak into the next.
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (process.env[key] !== value) {
      process.env[key] = value;
    }
  }
});
