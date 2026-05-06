import { describe, expect, it } from 'vitest';
import {
  buildOpenaiExtractOrganizationsPrompt,
  parseExtractOrganizationsResponse,
  OPENAI_EXTRACT_ORGANIZATIONS_SYSTEM_MESSAGE,
} from './extractOrganizations';

describe('buildOpenaiExtractOrganizationsPrompt', () => {
  it('embeds the data in the prompt', () => {
    const prompt = buildOpenaiExtractOrganizationsPrompt({ data: 'foo bar' });
    expect(prompt).toContain('foo bar');
  });

  it('includes the summary when provided', () => {
    const prompt = buildOpenaiExtractOrganizationsPrompt({
      data: 'X',
      summary: { rowCount: 5 },
    });
    expect(prompt).toContain('Summary');
    expect(prompt).toContain('rowCount');
  });

  it('omits the Summary line when no summary provided', () => {
    const prompt = buildOpenaiExtractOrganizationsPrompt({ data: 'X' });
    expect(prompt).not.toContain('Summary');
  });
});

describe('parseExtractOrganizationsResponse', () => {
  it('parses a valid response', () => {
    const result = parseExtractOrganizationsResponse(
      '{"organizations":[{"name":"Acme","rowIndex":1,"sourceField":"OrgName"}]}',
    );
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0]?.name).toBe('Acme');
  });

  it('returns empty array on malformed JSON', () => {
    expect(parseExtractOrganizationsResponse('not json')).toEqual({ organizations: [] });
  });

  it('returns empty array if organizations field is missing', () => {
    expect(parseExtractOrganizationsResponse('{}')).toEqual({ organizations: [] });
  });
});

describe('OPENAI_EXTRACT_ORGANIZATIONS_SYSTEM_MESSAGE', () => {
  it('is a non-empty constant', () => {
    expect(OPENAI_EXTRACT_ORGANIZATIONS_SYSTEM_MESSAGE.length).toBeGreaterThan(20);
  });
});
