import { describe, expect, it } from 'vitest';
import { calculateEventScore, formatEventHistory } from './eventScoring';

describe('calculateEventScore', () => {
  describe('history score', () => {
    it('returns 25 when at least one edition is in Vietnam', () => {
      const result = calculateEventScore('Generic Event', {}, [{ COUNTRY: 'Vietnam' }]);
      expect(result.historyScore).toBe(25);
    });

    it('returns 25 when COUNTRY uses lowercase or VN code', () => {
      const a = calculateEventScore('X', {}, [{ country: 'vietnam' }]);
      const b = calculateEventScore('X', {}, [{ COUNTRY: 'VN' }]);
      expect(a.historyScore).toBe(25);
      expect(b.historyScore).toBe(25);
    });

    it('returns 15 when an edition is in another SEA country', () => {
      const result = calculateEventScore('X', {}, [{ COUNTRY: 'Thailand' }]);
      expect(result.historyScore).toBe(15);
    });

    it('returns 0 with no editions', () => {
      const result = calculateEventScore('X', {}, []);
      expect(result.historyScore).toBe(0);
    });

    it('returns 0 with editions but no SEA countries', () => {
      const result = calculateEventScore('X', {}, [{ COUNTRY: 'Germany' }]);
      expect(result.historyScore).toBe(0);
    });
  });

  describe('region score', () => {
    it('returns 25 when name contains a regional keyword', () => {
      for (const name of [
        'ASEAN Summit',
        'Asia Forum',
        'Pacific Conference',
        'APAC Expo',
        'Eastern Trade',
      ]) {
        expect(calculateEventScore(name, {}, []).regionScore).toBe(25);
      }
    });

    it('returns 15 when an edition is in an Asian country (no regional keyword in name)', () => {
      const result = calculateEventScore('Generic Conference', {}, [{ COUNTRY: 'Japan' }]);
      expect(result.regionScore).toBe(15);
    });

    it('does not false-positive United Kingdom into "kingdom"-like Asian match', () => {
      const result = calculateEventScore('Trade Show', {}, [{ COUNTRY: 'United Kingdom' }]);
      expect(result.regionScore).toBe(0);
    });
  });

  describe('contact score', () => {
    it('returns 25 when both email and phone are valid', () => {
      const result = calculateEventScore(
        'X',
        { keyPersonEmail: 'a@b.com', keyPersonPhone: '+84 901 234 567' },
        [],
      );
      expect(result.contactScore).toBe(25);
    });

    it('returns 15 when only valid email is present', () => {
      const result = calculateEventScore('X', { Email: 'a@b.com' }, []);
      expect(result.contactScore).toBe(15);
    });

    it('returns 0 with invalid email and no other contact fields', () => {
      const result = calculateEventScore('X', { Email: 'not-an-email' }, []);
      expect(result.contactScore).toBe(0);
    });

    it('falls back to relatedContacts when eventData is sparse', () => {
      const result = calculateEventScore('X', {}, [], [{ Email: 'rep@firm.com' }]);
      expect(result.contactScore).toBe(15);
    });
  });

  describe('delegates score', () => {
    it('returns 25 for editions averaging 500+ delegates', () => {
      const result = calculateEventScore('X', {}, [{ TOTATTEND: 600 }, { TOTATTEND: 700 }]);
      expect(result.delegatesScore).toBe(25);
    });

    it('returns 0 when no edition has a delegate field', () => {
      const result = calculateEventScore('X', {}, [{ Year: 2024 }]);
      expect(result.delegatesScore).toBe(0);
    });
  });

  describe('totals and metadata', () => {
    it('returns totalScore as the sum of components', () => {
      const result = calculateEventScore(
        'Asia Conference',
        { keyPersonEmail: 'a@b.com', keyPersonPhone: '+84 901 234 567' },
        [{ COUNTRY: 'Vietnam', TOTATTEND: 600 }],
      );
      // history 25 + region 25 + contact 25 + delegates 25 = 100
      expect(result.totalScore).toBe(100);
    });

    it('records "Missing contact information" problem when contactScore is 0', () => {
      const result = calculateEventScore('X', {}, []);
      expect(result.problems).toContain('Missing contact information');
    });

    it('respects criteria flags (turning off region zeroes regionScore)', () => {
      const result = calculateEventScore('Asia Conference', {}, [], [], {
        region: false,
        history: false,
        contact: false,
        delegates: false,
      });
      expect(result.regionScore).toBe(0);
      expect(result.totalScore).toBe(0);
    });
  });
});

describe('formatEventHistory', () => {
  it('returns "" for empty or missing editions', () => {
    expect(formatEventHistory([])).toBe('');
    expect(formatEventHistory(undefined as unknown as unknown[])).toBe('');
  });

  it('joins year, city, country, and delegate count', () => {
    const out = formatEventHistory([
      { Year: '2023', City: 'Hanoi', Country: 'Vietnam', TOTATTEND: '500' },
    ]);
    expect(out).toBe('2023: Hanoi, Vietnam (500 delegates)');
  });

  it('joins multiple editions with "; "', () => {
    const out = formatEventHistory([
      { Year: '2022', Country: 'Thailand' },
      { Year: '2023', Country: 'Vietnam' },
    ]);
    expect(out).toBe('2022: Thailand; 2023: Vietnam');
  });
});
