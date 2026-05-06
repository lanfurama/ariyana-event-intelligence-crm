import { describe, expect, it } from 'vitest';
import { buildGeminiChatSystemInstruction, buildOpenaiChatSystemInstruction } from './chat';

describe('buildGeminiChatSystemInstruction', () => {
  it('embeds the ICCA knowledge text into the system instruction', () => {
    const out = buildGeminiChatSystemInstruction('---FAKE-ICCA-DATA---');
    expect(out).toContain('---FAKE-ICCA-DATA---');
  });

  it('mentions Ariyana Convention Centre and Danang', () => {
    const out = buildGeminiChatSystemInstruction('');
    expect(out).toContain('Ariyana Convention Centre');
    expect(out).toContain('Danang');
  });

  it('lists the 5-rule answering guidance', () => {
    const out = buildGeminiChatSystemInstruction('');
    expect(out).toContain('When answering questions:');
    expect(out).toContain('1. Reference specific leads');
  });
});

describe('buildOpenaiChatSystemInstruction', () => {
  it('embeds the ICCA knowledge text', () => {
    const out = buildOpenaiChatSystemInstruction('---FAKE---');
    expect(out).toContain('---FAKE---');
  });

  it('is more condensed than the Gemini version', () => {
    const empty = '';
    const gemini = buildGeminiChatSystemInstruction(empty);
    const openai = buildOpenaiChatSystemInstruction(empty);
    expect(openai.length).toBeLessThan(gemini.length);
  });
});
