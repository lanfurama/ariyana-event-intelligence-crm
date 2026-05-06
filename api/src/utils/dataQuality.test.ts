import { describe, expect, it } from 'vitest';
import {
  detectDataIssues,
  calculateDataQualityScore,
  extractOrganizationName,
  extractEventName,
} from './dataQuality';

describe('detectDataIssues', () => {
  it('flags missing organization name as critical', () => {
    const issues = detectDataIssues({}, '');
    expect(issues.find((i) => i.field === 'name')?.severity).toBe('critical');
  });

  it('flags single critical "Missing all contact information" when no email/phone/name', () => {
    const issues = detectDataIssues({}, 'Acme Corp');
    expect(
      issues.some(
        (i) => i.severity === 'critical' && i.message.includes('Missing all contact information'),
      ),
    ).toBe(true);
  });

  it('flags missing email as critical when other contact fields exist', () => {
    const issues = detectDataIssues({ keyPersonName: 'Lan', keyPersonPhone: '0901234567' }, 'Acme');
    const emailIssue = issues.find((i) => i.field === 'email');
    expect(emailIssue?.severity).toBe('critical');
  });

  it('flags missing location as critical when both country and city absent', () => {
    const issues = detectDataIssues({ keyPersonEmail: 'a@b.com' }, 'Acme');
    expect(issues.find((i) => i.field === 'location')?.severity).toBe('critical');
  });

  it('returns no issues for the (rare) fully-populated org', () => {
    const issues = detectDataIssues(
      {
        keyPersonName: 'Lan',
        keyPersonEmail: 'a@b.com',
        keyPersonPhone: '0901234567',
        country: 'Vietnam',
        city: 'Hanoi',
        industry: 'MICE',
        website: 'https://example.com',
        numberOfDelegates: 200,
        totalEvents: 5,
      },
      'Acme Corp',
    );
    expect(issues).toEqual([]);
  });
});

describe('calculateDataQualityScore', () => {
  it('returns 100 for empty issues + bonuses applied', () => {
    const orgData = {
      keyPersonName: 'Lan',
      keyPersonEmail: 'a@b.com',
      keyPersonPhone: '0901234567',
      country: 'Vietnam',
      city: 'Hanoi',
      website: 'https://example.com',
    };
    // Bonuses: contact (5) + location (5) + website (3) but capped at 100
    expect(calculateDataQualityScore(orgData, [])).toBe(100);
  });

  it('penalizes critical issues by 15 each', () => {
    const issues = [
      { severity: 'critical' as const, field: 'name', message: '' },
      { severity: 'critical' as const, field: 'contact', message: '' },
    ];
    const score = calculateDataQualityScore({}, issues);
    expect(score).toBe(70); // 100 - 15 - 15
  });

  it('penalizes warning by 5 and info by 2', () => {
    const issues = [
      { severity: 'warning' as const, field: 'phone', message: '' },
      { severity: 'info' as const, field: 'delegates', message: '' },
    ];
    expect(calculateDataQualityScore({}, issues)).toBe(93); // 100 - 5 - 2
  });

  it('clamps score to [0, 100]', () => {
    const tenCritical = Array.from({ length: 10 }, () => ({
      severity: 'critical' as const,
      field: 'x',
      message: '',
    }));
    expect(calculateDataQualityScore({}, tenCritical)).toBe(0);
  });
});

describe('extractOrganizationName', () => {
  it('prefers ORGNAME', () => {
    expect(extractOrganizationName({ ORGNAME: 'Acme Corp', Name: 'Other' })).toBe('Acme Corp');
  });

  it('falls back to Company Name when ORGNAME absent', () => {
    expect(extractOrganizationName({ 'Company Name': 'Beta Inc' })).toBe('Beta Inc');
  });

  it('returns null when nothing meaningful is present', () => {
    expect(extractOrganizationName({ id: 1, _sheet: 'data' })).toBe(null);
  });
});

describe('extractEventName', () => {
  it('prefers SeriesName (ICCA editions sheet grouping key)', () => {
    expect(
      extractEventName({ SeriesName: 'World Conference', 'Event Name': 'Should be ignored' }),
    ).toBe('World Conference');
  });

  it('falls back to Event Name', () => {
    expect(extractEventName({ 'Event Name': 'Local Summit' })).toBe('Local Summit');
  });

  it('skips edition-specific fields like ECODE in fallback search', () => {
    expect(extractEventName({ ECODE: 'XYZ-2023' })).toBe(null);
  });
});
