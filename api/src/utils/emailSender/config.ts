import { env } from '../../config/env.js';

// ============================================================================
// Constants & Configuration
// ============================================================================

export const EMAIL_CONFIG = {
  HOST: env.EMAIL_HOST,
  PORT: env.EMAIL_PORT,
  USER: env.EMAIL_HOST_USER,
  PASSWORD: env.EMAIL_HOST_PASSWORD,
  FROM_EMAIL: env.DEFAULT_FROM_EMAIL,
  FROM_NAME: 'Ariyana Convention Centre',
  DEFAULT_FROM: 'marketing@furamavietnam.com',
} as const;

export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  vietnam: 'vi',
  'việt nam': 'vi',
  thailand: 'th',
  'thái lan': 'th',
  singapore: 'en',
  malaysia: 'en',
  indonesia: 'en',
  philippines: 'en',
  philippine: 'en',
  'united states': 'en',
  usa: 'en',
  us: 'en',
  'united kingdom': 'en',
  uk: 'en',
  australia: 'en',
  'new zealand': 'en',
  canada: 'en',
  china: 'zh',
  chinese: 'zh',
  taiwan: 'zh',
  japan: 'ja',
  korea: 'ko',
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
