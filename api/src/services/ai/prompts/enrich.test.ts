import { describe, expect, it } from 'vitest';
import {
  buildGeminiEnrichPrompt,
  buildOpenaiEnrichPrompt,
  parseOpenaiEnrichResponse,
  OPENAI_ENRICH_SYSTEM_MESSAGE,
} from './enrich';

describe('buildGeminiEnrichPrompt', () => {
  it('includes the company name', () => {
    const prompt = buildGeminiEnrichPrompt({ companyName: 'Acme Corp' });
    expect(prompt).toContain('Acme Corp');
  });

  it('emits "Not specified" placeholders for missing optional fields', () => {
    const prompt = buildGeminiEnrichPrompt({ companyName: 'Acme' });
    expect(prompt).toContain('Key contact person: Not specified');
    expect(prompt).toContain('Location: Not specified');
  });

  it('includes optional keyPerson and city when provided', () => {
    const prompt = buildGeminiEnrichPrompt({
      companyName: 'Acme',
      keyPerson: 'Lan',
      city: 'Hanoi',
    });
    expect(prompt).toContain('Lan');
    expect(prompt).toContain('Hanoi');
  });

  it('mentions Google Search and KEY PERSON CONTACT format requirements', () => {
    const prompt = buildGeminiEnrichPrompt({ companyName: 'Acme' });
    expect(prompt).toContain('Google Search');
    expect(prompt).toContain('**KEY PERSON CONTACT:**');
  });
});

describe('buildOpenaiEnrichPrompt', () => {
  it('includes the company name', () => {
    const prompt = buildOpenaiEnrichPrompt({ companyName: 'Beta Inc' });
    expect(prompt).toContain('Beta Inc');
  });

  it('omits optional context lines when not provided', () => {
    const prompt = buildOpenaiEnrichPrompt({ companyName: 'Beta' });
    // The "Known Contact" / "City" lines should be empty (template emits empty
    // string when args missing).
    expect(prompt).not.toContain('Known Contact:');
    expect(prompt).not.toContain('- City:');
  });

  it('includes optional keyPerson and city when provided', () => {
    const prompt = buildOpenaiEnrichPrompt({
      companyName: 'Beta',
      keyPerson: 'Tom',
      city: 'Ho Chi Minh',
    });
    expect(prompt).toContain('Known Contact: Tom');
    expect(prompt).toContain('City: Ho Chi Minh');
  });

  it('includes the JSON schema fields the GPT response is expected to fill', () => {
    const prompt = buildOpenaiEnrichPrompt({ companyName: 'Beta' });
    expect(prompt).toContain('"website"');
    expect(prompt).toContain('"keyPersonEmail"');
    expect(prompt).toContain('"localStrengthsWeaknesses"');
    expect(prompt).toContain('"layoutEvent"');
  });
});

describe('parseOpenaiEnrichResponse', () => {
  it('parses well-formed JSON', () => {
    const out = parseOpenaiEnrichResponse('{"website":"https://acme.example","industry":"MICE"}');
    expect(out.website).toBe('https://acme.example');
    expect(out.industry).toBe('MICE');
  });

  it('returns {} parsed from "{}" when given empty string', () => {
    expect(parseOpenaiEnrichResponse('')).toEqual({});
  });

  it('falls back to { researchSummary } when JSON parsing fails', () => {
    const out = parseOpenaiEnrichResponse('not json at all');
    expect(out.researchSummary).toBe('not json at all');
  });
});

describe('OPENAI_ENRICH_SYSTEM_MESSAGE', () => {
  it('is a non-empty string mentioning MICE accuracy rules', () => {
    expect(OPENAI_ENRICH_SYSTEM_MESSAGE.length).toBeGreaterThan(100);
    expect(OPENAI_ENRICH_SYSTEM_MESSAGE).toContain('MICE');
    expect(OPENAI_ENRICH_SYSTEM_MESSAGE).toContain('NEVER guess');
  });
});
