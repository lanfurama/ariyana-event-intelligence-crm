import { describe, expect, it } from 'vitest';
import {
  extractDomain,
  verifyEmail,
  parseResearchResult,
  applyTemplatePlaceholders,
} from './leadDetailHelpers';
import type { Lead } from '../../types';

describe('extractDomain', () => {
  it('returns hostname for bare domain', () => {
    expect(extractDomain('example.com')).toBe('example.com');
  });

  it('strips protocol, www, and path', () => {
    expect(extractDomain('https://www.example.com/path?q=1')).toBe('example.com');
  });

  it('returns null for empty/null/undefined', () => {
    expect(extractDomain('')).toBeNull();
    expect(extractDomain(null)).toBeNull();
    expect(extractDomain(undefined)).toBeNull();
  });

  it('handles URL with port and hash', () => {
    expect(extractDomain('https://app.example.com:8080/x#y')).toBe('app.example.com');
  });

  it('lowercases the hostname (URL constructor normalizes)', () => {
    expect(extractDomain('EXAMPLE.COM')).toBe('example.com');
  });
});

describe('verifyEmail', () => {
  it('auto-approves when email domain matches company website domain', () => {
    expect(verifyEmail('john@acme.com', 'https://acme.com')).toEqual({
      status: 'auto-approved',
      reason: 'Domain matches company website (acme.com)',
    });
  });

  it('returns pending for gmail addresses', () => {
    expect(verifyEmail('john@gmail.com', 'https://acme.com')).toEqual({
      status: 'pending',
      reason: 'Gmail address - requires manual review',
    });
  });

  it('returns pending for googlemail addresses', () => {
    const r = verifyEmail('john@googlemail.com', null);
    expect(r.status).toBe('pending');
  });

  it('returns pending for non-matching, non-gmail domain', () => {
    const r = verifyEmail('john@other.com', 'https://acme.com');
    expect(r.status).toBe('pending');
    expect(r.reason).toContain('other.com');
  });

  it('returns rejected for empty email', () => {
    expect(verifyEmail('', null)).toEqual({
      status: 'rejected',
      reason: 'No email provided',
    });
  });

  it('returns rejected for email with no @', () => {
    expect(verifyEmail('not-an-email', null)).toEqual({
      status: 'rejected',
      reason: 'Invalid email format',
    });
  });
});

describe('parseResearchResult', () => {
  it('returns empty object for empty input', () => {
    expect(parseResearchResult('')).toEqual({});
  });

  it('extracts email from structured KEY PERSON CONTACT block', () => {
    // Structured patterns 1-4 correctly capture name="John Smith" / title="Sales Director",
    // BUT the 5-pattern fallback's Pattern 2 then matches across the Title/Email lines
    // and overrides result.name with "Title: Sales" + result.title with "Director\n      Email".
    // This is buggy current behavior preserved for the refactor; improvements are
    // out of scope (spec §6 R5). Email extraction is unaffected and remains correct.
    const text = `
      KEY PERSON CONTACT:
      Name: John Smith
      Title: Sales Director
      Email: john.smith@acme.com
    `;
    const r = parseResearchResult(text);
    expect(r.email).toBe('john.smith@acme.com');
  });

  it('omits fields marked "Not found" or "Not available"', () => {
    const text = `
      KEY PERSON CONTACT:
      Name: Not found
      Title: Not Available
      Email: john@acme.com
    `;
    const r = parseResearchResult(text);
    expect(r.name).toBeUndefined();
    expect(r.title).toBeUndefined();
    expect(r.email).toBe('john@acme.com');
  });

  it('extracts email from structured format without KEY PERSON CONTACT header', () => {
    // Same fallback override as the previous test — name/title get corrupted by
    // the 5-pattern fallback. Only email survives intact.
    const text = `
      Name: Jane Doe
      Title: Marketing Manager
      Email: jane@acme.com
    `;
    const r = parseResearchResult(text);
    expect(r.email).toBe('jane@acme.com');
  });

  it('filters out generic emails (info@, support@) when no other emails present', () => {
    const text = 'Contact us: info@acme.com or support@acme.com';
    const r = parseResearchResult(text);
    // After filtering generics, no person emails remain. The function falls
    // through to `else if (allEmails.length > 0) { result.email = allEmails[0]; }`
    // — so it returns the first generic email anyway.
    expect(r.email).toBe('info@acme.com');
  });

  it('prefers a person email over generics', () => {
    const text = 'Contact info@acme.com or jane.doe@acme.com directly';
    const r = parseResearchResult(text);
    expect(r.email).toBe('jane.doe@acme.com');
  });

  it('cleans trailing punctuation from email in structured block', () => {
    const text = `
      KEY PERSON CONTACT:
      Name: John
      Title: Director
      Email: john@acme.com.
    `;
    const r = parseResearchResult(text);
    expect(r.email).toBe('john@acme.com');
  });

  it('returns empty for unstructured text with no email', () => {
    const text = 'This company makes widgets in California.';
    expect(parseResearchResult(text)).toEqual({});
  });

  it('returns just email when only an email is present', () => {
    const text = 'Reach out at jane@acme.com please';
    const r = parseResearchResult(text);
    expect(r.email).toBe('jane@acme.com');
    expect(r.name).toBeUndefined();
  });

  it('handles spacing variants in field names (Name : value)', () => {
    const text = 'Name : Bob Smith\nTitle : CEO\nEmail : bob@acme.com';
    const r = parseResearchResult(text);
    expect(r.name).toBe('Bob Smith');
    expect(r.title).toBe('CEO');
  });

  it('uses fallbackKeyPerson when no name found in text', () => {
    const text = 'Some unstructured marketing copy with no clear contact info.';
    const r = parseResearchResult(text, 'Alice Wong');
    expect(r.name).toBe('Alice Wong');
  });

  it('does not override a name found in text with fallbackKeyPerson', () => {
    const text = `
      KEY PERSON CONTACT:
      Name: John Smith
      Title: Director
      Email: js@acme.com
    `;
    const r = parseResearchResult(text, 'Alice Wong');
    expect(r.name).toBe('John Smith');
  });
});

describe('applyTemplatePlaceholders', () => {
  const lead = {
    id: 'L1',
    companyName: 'ACME',
    keyPersonName: 'John',
    keyPersonTitle: 'CEO',
    city: 'Hanoi',
    country: 'Vietnam',
    industry: 'SaaS',
  } as Lead;

  it('replaces all {{var}} placeholders', () => {
    const out = applyTemplatePlaceholders('Hi {{keyPersonName}} at {{companyName}}', lead);
    expect(out).toBe('Hi John at ACME');
  });

  it('replaces legacy [Var Name] placeholders', () => {
    const out = applyTemplatePlaceholders('Hello [Key Person Name] of [Company Name]', lead);
    expect(out).toBe('Hello John of ACME');
  });

  it('substitutes empty string for missing lead fields', () => {
    const sparse = { ...lead, city: undefined } as unknown as Lead;
    expect(applyTemplatePlaceholders('City: {{city}}', sparse)).toBe('City: ');
  });

  it('returns template verbatim when no placeholders match', () => {
    expect(applyTemplatePlaceholders('Plain text', lead)).toBe('Plain text');
  });
});
