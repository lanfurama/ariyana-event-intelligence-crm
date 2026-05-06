import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

describe('env schema', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    exitSpy = vi
      .spyOn(process, 'exit')
      // Throw instead of exiting so we can assert on it.
      .mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`process.exit:${code}`);
      }) as unknown as ReturnType<typeof vi.spyOn>;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('parses successfully with all required fields', async () => {
    setEnv(VALID_ENV);
    const mod = await import('./env');
    expect(mod.env.DB_HOST).toBe('localhost');
    expect(mod.env.GEMINI_API_KEY).toBe('test-gemini-key');
  });

  it('coerces numeric strings to numbers and applies defaults', async () => {
    setEnv({ ...VALID_ENV, DB_PORT: '6543' });
    const mod = await import('./env');
    expect(mod.env.DB_PORT).toBe(6543);
    expect(mod.env.PORT).toBe(3001); // default
    expect(mod.env.VERTEX_AI_LOCATION).toBe('europe-west4'); // default
    expect(mod.env.VERTEX_AI_MODEL).toBe('gemini-2.5-pro'); // default
  });

  it('exits with 1 when a required field is missing', async () => {
    const env = { ...VALID_ENV };
    delete (env as Record<string, string | undefined>).DB_HOST;
    setEnv(env);
    await expect(import('./env')).rejects.toThrow('process.exit:1');
    expect(errSpy).toHaveBeenCalled();
  });

  it('exits when EMAIL_HOST_USER is not a valid email', async () => {
    setEnv({ ...VALID_ENV, EMAIL_HOST_USER: 'not-an-email' });
    await expect(import('./env')).rejects.toThrow('process.exit:1');
  });

  it('exits when NODE_ENV is outside the enum', async () => {
    setEnv({ ...VALID_ENV, NODE_ENV: 'staging' });
    await expect(import('./env')).rejects.toThrow('process.exit:1');
  });

  it('treats VERCEL/VERCEL_URL/Vertex AI keys as optional', async () => {
    setEnv(VALID_ENV); // none of those are set
    const mod = await import('./env');
    expect(mod.env.VERCEL).toBeUndefined();
    expect(mod.env.VERCEL_URL).toBeUndefined();
    expect(mod.env.VERTEX_AI_API_KEY).toBeUndefined();
  });
});
