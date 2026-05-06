import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

// Mock the Gemini SDK BEFORE importing the service.
const generateContent = vi.fn();
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({ generateContent })),
  })),
}));

// Mock the data models the service consumes.
vi.mock('../models/LeadModel.js', () => ({
  LeadModel: {
    getById: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('../models/EmailLogModel.js', () => ({
  EmailLogModel: { getByLeadId: vi.fn() },
}));
vi.mock('../models/EmailReplyModel.js', () => ({
  EmailReplyModel: { getByLeadId: vi.fn() },
}));

// Required so env.ts schema parses at import time (service imports env).
beforeEach(() => {
  setEnv(VALID_ENV);
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LeadScoringService.calculateLeadScore', () => {
  it('returns parsed score and clamps it to [0, 100]', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { LeadScoringService } = await import('./leadScoringService');

    (LeadModel.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'l1',
      company_name: 'Acme',
      industry: 'MICE',
      country: 'Vietnam',
      key_person_name: 'Lan',
      status: 'New',
    });
    (EmailLogModel.getByLeadId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmailReplyModel.getByLeadId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    generateContent.mockResolvedValue({
      response: {
        text: () =>
          '{"score": 120, "factors": {"emailEngagement": 25, "eventHistory": 25, "contactQuality": 25, "companySize": 25}, "reasoning": "ok"}',
      },
    });

    const result = await LeadScoringService.calculateLeadScore('l1');
    expect(result.score).toBe(100); // clamped from 120
    expect(result.factors.emailEngagement).toBe(25);
  });

  it('throws "Lead not found" when LeadModel.getById returns null', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { LeadScoringService } = await import('./leadScoringService');
    (LeadModel.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(LeadScoringService.calculateLeadScore('missing')).rejects.toThrow(
      'Lead not found',
    );
  });

  it('throws "Failed to calculate lead score" on malformed AI JSON', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { LeadScoringService } = await import('./leadScoringService');

    (LeadModel.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'l1',
      company_name: 'X',
      industry: 'Y',
      country: 'Z',
      key_person_name: 'P',
      status: 'New',
    });
    (EmailLogModel.getByLeadId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmailReplyModel.getByLeadId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    generateContent.mockResolvedValue({
      response: { text: () => 'not json at all' },
    });

    await expect(LeadScoringService.calculateLeadScore('l1')).rejects.toThrow(
      'Failed to calculate lead score',
    );
  });

  it('sends a prompt that mentions the lead company name', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { LeadScoringService } = await import('./leadScoringService');

    (LeadModel.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'l1',
      company_name: 'Acme Corp',
      industry: 'MICE',
      country: 'Vietnam',
      key_person_name: 'Lan',
      status: 'New',
    });
    (EmailLogModel.getByLeadId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmailReplyModel.getByLeadId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          '{"score": 50, "factors": {"emailEngagement": 5, "eventHistory": 0, "contactQuality": 20, "companySize": 25}, "reasoning": "x"}',
      },
    });

    await LeadScoringService.calculateLeadScore('l1');
    const promptArg = generateContent.mock.calls[0]?.[0] as string;
    expect(promptArg).toContain('Acme Corp');
    expect(promptArg).toContain('MICE');
  });
});

describe('LeadScoringService.getScoreDistribution', () => {
  it('classifies leads by lead_score thresholds', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { LeadScoringService } = await import('./leadScoringService');
    (LeadModel.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      { lead_score: 90 }, // high
      { lead_score: 50 }, // medium
      { lead_score: 20 }, // low
      { lead_score: null }, // unscored
      { lead_score: undefined }, // unscored
    ]);

    const dist = await LeadScoringService.getScoreDistribution();
    expect(dist).toEqual({ high: 1, medium: 1, low: 1, unscored: 2 });
  });
});
