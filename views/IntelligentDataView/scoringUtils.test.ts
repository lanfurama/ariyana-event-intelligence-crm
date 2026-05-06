import { describe, expect, it } from 'vitest';
import {
  calculateHistoryScore,
  calculateRegionScore,
  calculateContactScore,
  calculateDelegatesScore,
  isValidEmail,
  isValidPhone,
  formatEventHistory,
} from './scoringUtils';

describe('isValidEmail', () => {
  it('accepts well-formed emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects empty and malformed', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts a Vietnamese phone with formatting', () => {
    expect(isValidPhone('+84 (901) 234-567')).toBe(true);
  });

  it('rejects strings with fewer than 7 digits', () => {
    expect(isValidPhone('123')).toBe(false);
  });

  it('rejects strings containing letters', () => {
    expect(isValidPhone('+84-call-me')).toBe(false);
  });
});

describe('calculateHistoryScore', () => {
  it('returns 25 when an edition city contains "hanoi"', () => {
    expect(calculateHistoryScore([{ CITY: 'Hanoi' }])).toBe(25);
  });

  it('returns 15 for SEA-but-not-Vietnam', () => {
    expect(calculateHistoryScore([{ COUNTRY: 'Thailand' }])).toBe(15);
  });
});

describe('calculateRegionScore', () => {
  it('returns 25 when the event name contains "Asia"', () => {
    expect(calculateRegionScore('Asia Pacific Forum', [])).toBe(25);
  });

  it('returns 15 when an edition is in Japan', () => {
    expect(calculateRegionScore('Trade Show', [{ COUNTRY: 'Japan' }])).toBe(15);
  });
});

describe('calculateContactScore', () => {
  it('returns 25 with both email and phone valid in eventData', () => {
    expect(calculateContactScore({ Email: 'a@b.com', Phone: '0901234567' }, [])).toBe(25);
  });

  it('returns 0 when neither eventData nor relatedContacts have valid contact info', () => {
    expect(calculateContactScore({}, [])).toBe(0);
  });
});

describe('calculateDelegatesScore (frontend Ariyana sweet-spot)', () => {
  it('returns 25 for average in [200, 800] (Ariyana sweet spot)', () => {
    expect(calculateDelegatesScore([{ TOTATTEND: 250 }, { TOTATTEND: 350 }])).toBe(25);
  });

  it('returns 20 for the wider acceptable band (150-200 or 800-1000)', () => {
    expect(calculateDelegatesScore([{ TOTATTEND: 175 }])).toBe(20);
    expect(calculateDelegatesScore([{ TOTATTEND: 900 }])).toBe(20);
  });

  it('returns 0 for very small (<100) or very large (>1500) events', () => {
    expect(calculateDelegatesScore([{ TOTATTEND: 50 }])).toBe(0);
    expect(calculateDelegatesScore([{ TOTATTEND: 2000 }])).toBe(0);
  });
});

describe('formatEventHistory', () => {
  it('appends "DISTINCT COUNTRIES" summary', () => {
    const out = formatEventHistory([
      { Year: '2022', Country: 'Thailand' },
      { Year: '2023', Country: 'Vietnam' },
    ]);
    expect(out).toMatch(/DISTINCT COUNTRIES: 2 \(/);
  });
});
