import { describe, expect, it } from 'vitest';
import { isLeadMissingPersonInfo, parseEnrichResponse } from './leadEnrichUtils';
import type { Lead } from '../types';

const baseLead = {
  id: 'l1',
  companyName: 'Acme',
  industry: 'MICE',
  country: 'Vietnam',
  city: 'Hanoi',
  website: '',
  keyPersonName: 'Lan',
  keyPersonTitle: '',
  keyPersonEmail: 'lan@acme.example',
  keyPersonPhone: '+84 901 234 567',
  keyPersonLinkedIn: '',
  totalEvents: 0,
  vietnamEvents: 0,
  notes: '',
  status: 'New' as const,
} satisfies Lead;

describe('isLeadMissingPersonInfo', () => {
  it('returns false when name + non-generic email + phone all present', () => {
    expect(isLeadMissingPersonInfo(baseLead)).toBe(false);
  });

  it('returns true when email is generic (info@)', () => {
    expect(isLeadMissingPersonInfo({ ...baseLead, keyPersonEmail: 'info@acme.example' })).toBe(
      true,
    );
  });

  it('returns true when phone is empty whitespace', () => {
    expect(isLeadMissingPersonInfo({ ...baseLead, keyPersonPhone: '   ' })).toBe(true);
  });

  it('returns true when name is missing', () => {
    expect(isLeadMissingPersonInfo({ ...baseLead, keyPersonName: '' })).toBe(true);
  });
});

describe('parseEnrichResponse', () => {
  it('extracts name, title, email, phone from a typical KEY PERSON CONTACT block', () => {
    const text = [
      '### **2. KEY PERSON CONTACT:**',
      '- **Name**: Kunchit Judprasong',
      '- **Title**: Conference Director',
      '- **Email**: kunchit@example.com',
      '- **Phone**: +66 2 123 4567',
    ].join('\n');
    const out = parseEnrichResponse(text);
    expect(out.keyPersonName).toBe('Kunchit Judprasong');
    expect(out.keyPersonEmail).toBe('kunchit@example.com');
    expect(out.keyPersonTitle).toBe('Conference Director');
    expect(out.keyPersonPhone).toBe('+66 2 123 4567');
  });

  it('rejects "Not Found" placeholder values', () => {
    const text = ['**KEY PERSON CONTACT:**', '- Name: Not Found', '- Email: Not Found'].join('\n');
    const out = parseEnrichResponse(text);
    expect(out.keyPersonName).toBeUndefined();
    expect(out.keyPersonEmail).toBeUndefined();
  });

  it('rejects an email value missing "@"', () => {
    const text = '**KEY PERSON CONTACT:**\n- Email: contactus';
    expect(parseEnrichResponse(text).keyPersonEmail).toBeUndefined();
  });

  it('returns empty object for empty or non-string input', () => {
    expect(parseEnrichResponse('')).toEqual({});
    expect(parseEnrichResponse(undefined as unknown as string)).toEqual({});
  });
});
