import { describe, expect, it } from 'vitest';
import { buildGeminiParseRfpPrompt, parseRfpExtraction } from './parseRfp';

describe('buildGeminiParseRfpPrompt', () => {
  it('embeds the email text, today anchor and the JSON contract', () => {
    const prompt = buildGeminiParseRfpPrompt('We need a hall for 300 people', '2026-07-17');
    expect(prompt).toContain('We need a hall for 300 people');
    expect(prompt).toContain("Today's date is 2026-07-17");
    expect(prompt).toContain('is_rfp');
    expect(prompt).toContain('YYYY-MM-DD');
    expect(prompt).toContain('theatre, classroom, banquet, cocktail, ushape, boardroom');
  });
});

describe('parseRfpExtraction', () => {
  it('parses a full extraction', () => {
    const result = parseRfpExtraction(
      JSON.stringify({
        is_rfp: true,
        company_name: 'ACME Corp',
        contact_name: 'Jane Doe',
        email: 'jane@acme.com',
        phone: '+84 900 111 222',
        event_type: 'conference',
        expected_guests: 300,
        preferred_date: '2026-11-05',
        layout: 'theatre',
        summary: 'Conference for 300 pax in November.',
      }),
    );
    expect(result).toEqual({
      is_rfp: true,
      company_name: 'ACME Corp',
      contact_name: 'Jane Doe',
      email: 'jane@acme.com',
      phone: '+84 900 111 222',
      event_type: 'conference',
      expected_guests: 300,
      preferred_date: '2026-11-05',
      layout: 'theatre',
      summary: 'Conference for 300 pax in November.',
    });
  });

  it('strips markdown fences', () => {
    const result = parseRfpExtraction('```json\n{"is_rfp": true, "company_name": "X"}\n```');
    expect(result.is_rfp).toBe(true);
    expect(result.company_name).toBe('X');
  });

  it('returns is_rfp false for unparseable garbage', () => {
    expect(parseRfpExtraction('sorry, I cannot help with that')).toEqual({ is_rfp: false });
    expect(parseRfpExtraction('')).toEqual({ is_rfp: false });
  });

  it('coerces is_rfp to strict boolean true only', () => {
    expect(parseRfpExtraction('{"is_rfp": "yes"}').is_rfp).toBe(false);
    expect(parseRfpExtraction('{"is_rfp": true}').is_rfp).toBe(true);
  });

  it('drops invalid email but keeps the rest', () => {
    const result = parseRfpExtraction(
      '{"is_rfp": true, "email": "not-an-email", "contact_name": "Bob"}',
    );
    expect(result.email).toBeUndefined();
    expect(result.contact_name).toBe('Bob');
  });

  it('rounds and validates guests, dropping non-positive values', () => {
    expect(parseRfpExtraction('{"is_rfp": true, "expected_guests": 249.6}').expected_guests).toBe(
      250,
    );
    expect(
      parseRfpExtraction('{"is_rfp": true, "expected_guests": -5}').expected_guests,
    ).toBeUndefined();
    expect(
      parseRfpExtraction('{"is_rfp": true, "expected_guests": "many"}').expected_guests,
    ).toBeUndefined();
  });

  it('drops malformed dates and unknown layouts', () => {
    const result = parseRfpExtraction(
      '{"is_rfp": true, "preferred_date": "next March", "layout": "auditorium"}',
    );
    expect(result.preferred_date).toBeUndefined();
    expect(result.layout).toBeUndefined();
  });

  it('lowercases known layouts', () => {
    expect(parseRfpExtraction('{"is_rfp": true, "layout": "Banquet"}').layout).toBe('banquet');
  });

  it('trims strings and omits empties', () => {
    const result = parseRfpExtraction('{"is_rfp": true, "company_name": "  ACME  ", "phone": " "}');
    expect(result.company_name).toBe('ACME');
    expect(result.phone).toBeUndefined();
  });
});
