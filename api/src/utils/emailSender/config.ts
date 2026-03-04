import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from project root (3 levels up from api/src/utils/emailSender)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

// ============================================================================
// Constants & Configuration
// ============================================================================

export const EMAIL_CONFIG = {
  HOST: process.env.EMAIL_HOST,
  PORT: Number(process.env.EMAIL_PORT || 587),
  USER: process.env.EMAIL_HOST_USER,
  PASSWORD: process.env.EMAIL_HOST_PASSWORD,
  FROM_EMAIL: process.env.DEFAULT_FROM_EMAIL || process.env.EMAIL_HOST_USER || '',
  FROM_NAME: 'Ariyana Convention Centre',
  DEFAULT_FROM: 'marketing@furamavietnam.com',
} as const;

export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  'vietnam': 'vi',
  'việt nam': 'vi',
  'thailand': 'th',
  'thái lan': 'th',
  'singapore': 'en',
  'malaysia': 'en',
  'indonesia': 'en',
  'philippines': 'en',
  'philippine': 'en',
  'united states': 'en',
  'usa': 'en',
  'us': 'en',
  'united kingdom': 'en',
  'uk': 'en',
  'australia': 'en',
  'new zealand': 'en',
  'canada': 'en',
  'china': 'zh',
  'chinese': 'zh',
  'taiwan': 'zh',
  'japan': 'ja',
  'korea': 'ko',
  'south korea': 'ko',
} as const;

export const TEMPLATE_VARIABLES = {
  COMPANY_NAME: '{{companyName}}',
  KEY_PERSON_NAME: '{{keyPersonName}}',
  KEY_PERSON_TITLE: '{{keyPersonTitle}}',
  CITY: '{{city}}',
  COUNTRY: '{{country}}',
  INDUSTRY: '{{industry}}',
} as const;
