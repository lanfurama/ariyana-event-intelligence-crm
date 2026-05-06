import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from project root, regardless of CWD or module location.
// In Vercel, env vars are set in the dashboard and there's no .env file —
// dotenv silently does nothing in that case, which is fine.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback: also try CWD-relative .env

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // CORS (optional — only the standalone server uses it; vite-plugin-api proxies in dev)
  CORS_ORIGIN: z.string().optional(),

  // AI providers
  GEMINI_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),

  // Vertex AI (optional — feature-gated)
  VERTEX_AI_API_KEY: z.string().optional(),
  VERTEX_AI_PROJECT_ID: z.string().optional(),
  VERTEX_AI_ENDPOINT_ID: z.string().optional(),
  VERTEX_AI_LOCATION: z.string().default('europe-west4'),
  VERTEX_AI_MODEL: z.string().default('gemini-2.5-pro'),
  VERTEX_AI_SERVICE_ACCOUNT_PATH: z.string().optional(),

  // Outgoing email (SMTP)
  EMAIL_HOST: z.string().min(1),
  EMAIL_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_HOST_USER: z.string().email(),
  EMAIL_HOST_PASSWORD: z.string().min(1),
  DEFAULT_FROM_EMAIL: z.string().email(),

  // Incoming email (IMAP) — host is optional because imapService.ts auto-detects from EMAIL_HOST_USER domain
  EMAIL_IMAP_HOST: z.string().optional(),
  EMAIL_IMAP_PORT: z.coerce.number().int().positive().default(993),

  // Optional integrations
  GOOGLE_TRANSLATE_API_KEY: z.string().optional(),

  // Vercel platform (auto-set in production, absent in dev)
  VERCEL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
