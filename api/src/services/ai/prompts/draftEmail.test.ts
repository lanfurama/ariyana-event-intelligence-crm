import { describe, expect, it } from 'vitest';
import {
  buildGeminiDraftEmailPrompt,
  buildOpenaiDraftEmailPrompt,
  parseGeminiDraftEmailResponse,
  OPENAI_DRAFT_EMAIL_SYSTEM_MESSAGE,
} from './draftEmail';

const baseArgs = {
  leadName: 'Lan Nguyen',
  leadCompany: 'Acme Events',
  leadTitle: 'Director',
  eventContext: 'Annual Tech Conference 2027',
};

describe('buildGeminiDraftEmailPrompt', () => {
  it('includes lead name, company, title, event context', () => {
    const prompt = buildGeminiDraftEmailPrompt(baseArgs);
    expect(prompt).toContain('Lan Nguyen');
    expect(prompt).toContain('Acme Events');
    expect(prompt).toContain('Director');
    expect(prompt).toContain('Annual Tech Conference 2027');
  });

  it('mentions Ariyana Convention Centre', () => {
    expect(buildGeminiDraftEmailPrompt(baseArgs)).toContain('Ariyana Convention Centre');
  });
});

describe('buildOpenaiDraftEmailPrompt', () => {
  it('includes lead details', () => {
    const prompt = buildOpenaiDraftEmailPrompt(baseArgs);
    expect(prompt).toContain('Lan Nguyen');
    expect(prompt).toContain('Acme Events');
  });

  it('uses "Not provided" for missing optional fields', () => {
    const prompt = buildOpenaiDraftEmailPrompt({ leadName: 'X', leadCompany: 'Y' });
    expect(prompt).toContain('Title: Not provided');
    expect(prompt).toContain('Event Context: Not provided');
  });
});

describe('parseGeminiDraftEmailResponse', () => {
  it('parses well-formed JSON', () => {
    const out = parseGeminiDraftEmailResponse('{"subject":"Hi","body":"Hello there"}');
    expect(out).toEqual({ subject: 'Hi', body: 'Hello there' });
  });

  it('strips markdown code fences', () => {
    const out = parseGeminiDraftEmailResponse('```json\n{"subject":"Hi","body":"Hello"}\n```');
    expect(out).toEqual({ subject: 'Hi', body: 'Hello' });
  });

  it('returns the fallback shape on parse error', () => {
    const out = parseGeminiDraftEmailResponse('not json');
    expect(out.subject).toBe('Error generating subject');
    expect(out.body).toBe('not json');
  });
});

describe('OPENAI_DRAFT_EMAIL_SYSTEM_MESSAGE', () => {
  it('mentions MICE industry', () => {
    expect(OPENAI_DRAFT_EMAIL_SYSTEM_MESSAGE).toContain('MICE');
  });
});
