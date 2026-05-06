import { describe, expect, it } from 'vitest';
import {
  buildOpenaiCheckEventEligibilityPrompt,
  parseCheckEventEligibilityResponse,
  defaultCheckEventEligibilityResponse,
  OPENAI_CHECK_EVENT_ELIGIBILITY_SYSTEM_MESSAGE,
} from './checkEventEligibility';

const baseArgs = {
  eventName: 'World Heart Federation Congress',
  currentYear: 2026,
  fiveYearsAgo: 2021,
};

describe('buildOpenaiCheckEventEligibilityPrompt', () => {
  it('includes the event name', () => {
    expect(buildOpenaiCheckEventEligibilityPrompt(baseArgs)).toContain(
      'World Heart Federation Congress',
    );
  });

  it('includes the current and 5-years-ago year', () => {
    const prompt = buildOpenaiCheckEventEligibilityPrompt(baseArgs);
    expect(prompt).toContain('2021-2026');
  });

  it('truncates eventData to 1000 chars when provided', () => {
    const long = 'x'.repeat(2000);
    const prompt = buildOpenaiCheckEventEligibilityPrompt({ ...baseArgs, eventData: long });
    expect(prompt).toContain('x'.repeat(1000));
    expect(prompt).not.toContain('x'.repeat(1001));
  });

  it('omits eventData and pastEventsHistory lines when not provided', () => {
    const prompt = buildOpenaiCheckEventEligibilityPrompt(baseArgs);
    expect(prompt).not.toContain('- Event Data:');
    expect(prompt).not.toContain('- Past Events History:');
  });
});

describe('parseCheckEventEligibilityResponse', () => {
  it('parses a valid response', () => {
    const json = JSON.stringify({
      eventName: 'X',
      hasVietnamHistory: true,
      vietnamHistoryDetails: 'Vietnam 2024',
      isICCAQualified: true,
      iccaQualifiedReason: 'meets criteria',
      hasRecentActivity: true,
      mostRecentYear: 2024,
      yearsSinceLastEvent: 2,
      isEligible: true,
      eligibilityReason: 'all criteria met',
      recommendation: 'proceed',
    });
    const out = parseCheckEventEligibilityResponse(json, 'X');
    expect(out.isEligible).toBe(true);
    expect(out.recommendation).toBe('proceed');
  });

  it('returns the default conservative shape on malformed JSON', () => {
    const out = parseCheckEventEligibilityResponse('not json', 'X');
    expect(out.eventName).toBe('X');
    expect(out.isEligible).toBe(false);
    expect(out.recommendation).toBe('review');
  });
});

describe('defaultCheckEventEligibilityResponse', () => {
  it('echoes the eventName argument', () => {
    expect(defaultCheckEventEligibilityResponse('Foo').eventName).toBe('Foo');
  });
});

describe('OPENAI_CHECK_EVENT_ELIGIBILITY_SYSTEM_MESSAGE', () => {
  it('mentions ICCA-qualified events', () => {
    expect(OPENAI_CHECK_EVENT_ELIGIBILITY_SYSTEM_MESSAGE).toContain('ICCA');
  });
});
