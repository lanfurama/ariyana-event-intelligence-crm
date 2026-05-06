import { describe, expect, it } from 'vitest';
import { GEMINI_ANALYZE_VIDEO_PROMPT } from './analyzeVideo';

describe('GEMINI_ANALYZE_VIDEO_PROMPT', () => {
  it('is a non-empty Vietnamese prompt', () => {
    expect(GEMINI_ANALYZE_VIDEO_PROMPT.length).toBeGreaterThan(500);
    expect(GEMINI_ANALYZE_VIDEO_PROMPT).toContain('Sales Intelligence Analyst');
  });

  it('mentions Ariyana Convention Centre', () => {
    expect(GEMINI_ANALYZE_VIDEO_PROMPT).toContain('Ariyana Convention Centre');
  });

  it('lists the 4 analysis sections (A, B, C, D)', () => {
    expect(GEMINI_ANALYZE_VIDEO_PROMPT).toContain('A. NHẬN DIỆN');
    expect(GEMINI_ANALYZE_VIDEO_PROMPT).toContain('B. COMPETITIVE');
    expect(GEMINI_ANALYZE_VIDEO_PROMPT).toContain('C. SALES OPPORTUNITY');
    expect(GEMINI_ANALYZE_VIDEO_PROMPT).toContain('D. ACTIONABLE');
  });
});
