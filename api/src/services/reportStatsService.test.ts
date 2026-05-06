import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  default: { query: vi.fn() },
}));
vi.mock('../models/LeadModel.js', () => ({
  LeadModel: { getAll: vi.fn() },
}));
vi.mock('../models/EmailLogModel.js', () => ({
  EmailLogModel: { getAll: vi.fn() },
}));
vi.mock('../models/EmailReplyModel.js', () => ({
  EmailReplyModel: { getAll: vi.fn() },
}));

beforeEach(() => {
  setEnv(VALID_ENV);
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ReportStatsService.getPeriodBoundaries', () => {
  it('produces a daily window covering the same date 00:00..23:59', async () => {
    const { ReportStatsService } = await import('./reportStatsService');
    const ref = new Date('2026-03-15T10:30:00Z');
    const { start, end } = ReportStatsService.getPeriodBoundaries('daily', ref);
    expect(start.toDateString()).toBe(end.toDateString());
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);
  });

  it('weekly starts on Monday and ends on Sunday', async () => {
    const { ReportStatsService } = await import('./reportStatsService');
    const wednesday = new Date('2026-03-18T10:00:00'); // local date Wed
    const { start, end } = ReportStatsService.getPeriodBoundaries('weekly', wednesday);
    expect(start.getDay()).toBe(1); // Monday
    expect(end.getDay()).toBe(0); // Sunday
  });

  it('monthly spans 1st to last day of month', async () => {
    const { ReportStatsService } = await import('./reportStatsService');
    const ref = new Date('2026-02-15T10:00:00');
    const { start, end } = ReportStatsService.getPeriodBoundaries('monthly', ref);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(28); // Feb 2026 has 28 days
  });
});

describe('ReportStatsService.generateStats', () => {
  it('counts leads by status and returns top leads sorted by score', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { ReportStatsService } = await import('./reportStatsService');

    (LeadModel.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: '1',
        company_name: 'Hi',
        country: 'VN',
        industry: 'X',
        status: 'New',
        lead_score: 90,
        created_at: '2026-03-15',
      },
      {
        id: '2',
        company_name: 'Lo',
        country: 'VN',
        industry: 'X',
        status: 'Contacted',
        lead_score: 30,
        created_at: '2026-03-14',
      },
      {
        id: '3',
        company_name: 'Mid',
        country: 'VN',
        industry: 'X',
        status: 'Qualified',
        lead_score: 60,
        created_at: '2026-03-13',
      },
    ]);
    (EmailLogModel.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmailReplyModel.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const stats = await ReportStatsService.generateStats(
      new Date('2026-03-13'),
      new Date('2026-03-15T23:59:59'),
      'daily',
      2,
    );
    expect(stats.leads.total).toBe(3);
    expect(stats.leads.byStatus['New']).toBe(1);
    expect(stats.leads.byStatus['Contacted']).toBe(1);
    expect(stats.topLeads.map((l) => l.id)).toEqual(['1', '3']); // top 2 by score
  });

  it('returns 0% replyRate when no emails have been sent', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { ReportStatsService } = await import('./reportStatsService');
    (LeadModel.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmailLogModel.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmailReplyModel.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const stats = await ReportStatsService.generateStats(
      new Date('2026-03-01'),
      new Date('2026-03-31'),
      'monthly',
    );
    expect(stats.emails.replyRate).toBe(0);
    expect(stats.emails.sent).toBe(0);
  });
});
