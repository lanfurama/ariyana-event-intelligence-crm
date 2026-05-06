import { describe, expect, it } from 'vitest';
import {
  buildGeminiStrategicAnalysisPrompt,
  buildOpenaiStrategicAnalysisPrompt,
  OPENAI_STRATEGIC_ANALYSIS_SYSTEM_MESSAGE,
} from './strategicAnalysis';

const SAMPLE_LEADS = '<<<SAMPLE-LEADS-DATA-PLACEHOLDER>>>';

describe('buildGeminiStrategicAnalysisPrompt', () => {
  it('embeds the leadsData input verbatim', () => {
    const prompt = buildGeminiStrategicAnalysisPrompt({ leadsData: SAMPLE_LEADS });
    expect(prompt).toContain(SAMPLE_LEADS);
  });

  it('lists the 8 mandatory fields', () => {
    const prompt = buildGeminiStrategicAnalysisPrompt({ leadsData: '' });
    for (const field of [
      'openYear',
      'localHostName',
      'localHostTitle',
      'localHostEmail',
      'localHostPhone',
      'localStrengths',
      'layout',
      'conferenceRegistration',
    ]) {
      expect(prompt).toContain(field);
    }
  });

  it('mentions Ariyana Convention Centre Danang', () => {
    const prompt = buildGeminiStrategicAnalysisPrompt({ leadsData: '' });
    expect(prompt).toContain('Ariyana Convention Centre Danang');
  });

  it('returns a string longer than 10k characters (it is a very large prompt)', () => {
    const prompt = buildGeminiStrategicAnalysisPrompt({ leadsData: '' });
    expect(prompt.length).toBeGreaterThan(10_000);
  });
});

describe('buildOpenaiStrategicAnalysisPrompt', () => {
  it('embeds the leadsData input verbatim', () => {
    const prompt = buildOpenaiStrategicAnalysisPrompt({ leadsData: SAMPLE_LEADS });
    expect(prompt).toContain(SAMPLE_LEADS);
  });

  it('mentions accuracy as paramount', () => {
    const prompt = buildOpenaiStrategicAnalysisPrompt({ leadsData: '' });
    expect(prompt).toContain('Accuracy is paramount');
  });
});

describe('OPENAI_STRATEGIC_ANALYSIS_SYSTEM_MESSAGE', () => {
  it('mentions MICE industry analyst role', () => {
    expect(OPENAI_STRATEGIC_ANALYSIS_SYSTEM_MESSAGE).toContain('MICE industry analyst');
  });
});
