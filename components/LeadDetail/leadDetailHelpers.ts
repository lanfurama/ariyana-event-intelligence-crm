import type { Lead } from '../../types';

export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    let url = website.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '').toLowerCase();
  } catch {
    const match = website.match(/(?:https?:\/\/)?(?:www\.)?([^/]+)/);
    return match && match[1] ? match[1].toLowerCase() : null;
  }
}

export type EmailVerification =
  | { status: 'auto-approved'; reason: string }
  | { status: 'pending'; reason: string }
  | { status: 'rejected'; reason: string };

export function verifyEmail(
  email: string,
  companyWebsite: string | null | undefined,
): EmailVerification {
  if (!email) {
    return { status: 'rejected', reason: 'No email provided' };
  }

  const emailLower = email.toLowerCase().trim();
  const emailDomain = emailLower.split('@')[1];

  if (!emailDomain) {
    return { status: 'rejected', reason: 'Invalid email format' };
  }

  const companyDomain = extractDomain(companyWebsite);
  if (companyDomain && emailDomain === companyDomain) {
    return {
      status: 'auto-approved',
      reason: `Domain matches company website (${emailDomain})`,
    };
  }

  if (emailDomain === 'gmail.com' || emailDomain === 'googlemail.com') {
    return {
      status: 'pending',
      reason: 'Gmail address - requires manual review',
    };
  }

  return {
    status: 'pending',
    reason: `Domain ${emailDomain} - requires manual review`,
  };
}

export interface ResearchResult {
  name?: string;
  title?: string;
  email?: string;
}

/**
 * Parses an AI research result text into structured key-person info.
 * Body moved verbatim from LeadDetail.tsx (lines 312-613). Behavior unchanged.
 *
 * Two adaptations vs the original:
 *   1. The 4 `console.log(...)` debug calls are stripped — callers may wrap
 *      and log inputs/outputs themselves if needed.
 *   2. The original closed over `enrichKeyPerson` (component state); this
 *      version takes it as the optional `fallbackKeyPerson` parameter so the
 *      function is pure. Callers pass `enrichKeyPerson` explicitly.
 */
export function parseResearchResult(text: string, fallbackKeyPerson?: string): ResearchResult {
  const result: ResearchResult = {};

  // First, try to parse structured format from prompt (more flexible patterns)
  const structuredPatterns = [
    // Pattern 1: Standard format with KEY PERSON CONTACT
    /KEY PERSON CONTACT:[\s\S]*?Name:\s*([^\n]+)[\s\S]*?Title:\s*([^\n]+)[\s\S]*?Email:\s*([^\n]+)/i,
    // Pattern 2: With dashes or bullets
    /KEY PERSON CONTACT:[\s\S]*?Name:\s*([^\n]+)[\s\S]*?Title:\s*([^\n]+)[\s\S]*?Email:\s*([^\n]+)/i,
    // Pattern 3: Without KEY PERSON CONTACT header
    /Name:\s*([^\n]+)[\s\S]*?Title:\s*([^\n]+)[\s\S]*?Email:\s*([^\n]+)/i,
    // Pattern 4: With different spacing
    /Name\s*:\s*([^\n]+)[\s\S]*?Title\s*:\s*([^\n]+)[\s\S]*?Email\s*:\s*([^\n]+)/i,
  ];

  for (const pattern of structuredPatterns) {
    const structuredMatch = text.match(pattern);

    if (structuredMatch) {
      const name = structuredMatch[1]?.trim();
      const title = structuredMatch[2]?.trim();
      const email = structuredMatch[3]?.trim();

      // Check if not "Not found"
      if (
        name &&
        name.toLowerCase() !== 'not found' &&
        name.length > 0 &&
        !name.toLowerCase().includes('not available')
      ) {
        result.name = name;
      }
      if (
        title &&
        title.toLowerCase() !== 'not found' &&
        title.length > 0 &&
        !title.toLowerCase().includes('not available')
      ) {
        result.title = title;
      }
      if (
        email &&
        email.toLowerCase() !== 'not found' &&
        email.includes('@') &&
        !email.toLowerCase().includes('not available')
      ) {
        // Clean email (remove any trailing punctuation or text)
        const cleanEmail = email.replace(/[^\w@.-]+$/, '').trim();
        if (cleanEmail.includes('@')) {
          result.email = cleanEmail;
        }
      }
      // (continue to try to find missing fields in subsequent passes)
    }
  }

  // Extract all emails from text (more comprehensive)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const allEmails = text.match(emailRegex) || [];

  if (allEmails.length > 0) {
    // Filter out generic emails like info@, contact@, noreply@
    const personEmails = allEmails.filter((e) => {
      const local = e.split('@')[0].toLowerCase();
      return ![
        'info',
        'contact',
        'noreply',
        'no-reply',
        'admin',
        'webmaster',
        'support',
        'web',
        'mail',
        'hello',
        'general',
      ].includes(local);
    });

    // If we have a name, try to find email that matches the name
    if (result.name && personEmails.length > 0) {
      const nameWords = result.name.toLowerCase().split(/\s+/);
      const matchingEmail = personEmails.find((email) => {
        const emailLocal = email.split('@')[0].toLowerCase();
        return nameWords.some((word) => emailLocal.includes(word) || word.includes(emailLocal));
      });
      if (matchingEmail) {
        result.email = matchingEmail;
      } else {
        result.email = personEmails[0];
      }
    } else if (personEmails.length > 0) {
      result.email = personEmails[0];
    } else if (allEmails.length > 0) {
      // Use first email if no person-specific found
      result.email = allEmails[0];
    }
  }

  // Important titles/keywords for key persons
  const importantTitles = [
    'sales',
    'marketing',
    'business development',
    'bd',
    'revenue',
    'commercial',
    'director',
    'manager',
    'head',
    'lead',
    'vp',
    'vice president',
    'president',
    'ceo',
    'cmo',
    'cso',
    'chief',
    'executive',
    'coordinator',
    'specialist',
    'account manager',
    'client relations',
    'partnership',
    'outreach',
    'engagement',
    'events',
    'conference',
    'meeting',
    'secretary general',
    'organizing',
  ];

  // Try multiple patterns to extract name and title
  const patterns = [
    // Pattern 1: "Name, Title" (e.g., "John Smith, Sales Director")
    new RegExp(
      `([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)\\s*[,;]\\s*([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)`,
      'gi',
    ),
    // Pattern 2: "Title Name" (e.g., "Sales Director John Smith")
    new RegExp(
      `([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)`,
      'gi',
    ),
    // Pattern 3: "Name is Title" (e.g., "John Smith is Sales Director")
    new RegExp(
      `([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)\\s+(?:is|as|the|serves as)\\s+([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)`,
      'gi',
    ),
    // Pattern 4: "Name - Title" (e.g., "John Smith - Sales Director")
    new RegExp(
      `([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)\\s*[-–—]\\s*([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)`,
      'gi',
    ),
    // Pattern 5: "Name (Title)" (e.g., "John Smith (Sales Director)")
    new RegExp(
      `([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)\\s*\\(([^)]*(?:${importantTitles.join('|')})[^)]*)\\)`,
      'gi',
    ),
  ];

  let bestMatch: { name?: string; title?: string } | null = null;

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      let name = '';
      let title = '';

      // Extract based on pattern type
      if (pattern.source.includes('Name.*Title') || pattern.source.includes('Name.*Title')) {
        name = match[1]?.trim() || '';
        title = match[2]?.trim() || '';
      } else if (pattern.source.includes('Title.*Name')) {
        title = match[1]?.trim() || '';
        name = match[2]?.trim() || '';
      } else {
        name = match[1]?.trim() || '';
        title = match[2]?.trim() || '';
      }

      // Validate
      if (name && title) {
        const nameWords = name.split(/\s+/).filter((w) => w.length > 0);
        const titleLower = title.toLowerCase();
        const hasImportantTitle = importantTitles.some((keyword) => titleLower.includes(keyword));

        // More lenient: accept if name has at least 2 words and title seems relevant
        if (nameWords.length >= 2 && (hasImportantTitle || title.length > 5)) {
          // Check if name looks valid (starts with capital letters)
          if (nameWords.every((w) => /^[A-Z]/.test(w.trim()))) {
            bestMatch = { name, title };
            break;
          }
        }
      }
    }
    if (bestMatch) break;
  }

  if (bestMatch) {
    result.name = bestMatch.name;
    result.title = bestMatch.title;

    // Try to find email near this name/title match
    if (!result.email && result.name) {
      const nameEscaped = result.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Find text around the name (within 200 characters)
      const nameIndex = text.search(new RegExp(nameEscaped, 'i'));
      if (nameIndex !== -1) {
        const contextStart = Math.max(0, nameIndex - 100);
        const contextEnd = Math.min(text.length, nameIndex + result.name.length + 200);
        const context = text.substring(contextStart, contextEnd);

        // Find email in this context
        const contextEmails = context.match(emailRegex);
        if (contextEmails && contextEmails.length > 0) {
          const personEmails = contextEmails.filter((e) => {
            const local = e.split('@')[0].toLowerCase();
            return ![
              'info',
              'contact',
              'noreply',
              'no-reply',
              'admin',
              'webmaster',
              'support',
              'web',
              'mail',
              'hello',
              'general',
            ].includes(local);
          });
          if (personEmails.length > 0) {
            result.email = personEmails[0];
          } else {
            result.email = contextEmails[0];
          }
        }
      }
    }
  }

  // If we have key person name from input, use it
  if (fallbackKeyPerson && fallbackKeyPerson.trim() && !result.name) {
    result.name = fallbackKeyPerson.trim();
    // Try to find title associated with this name
    const nameEscaped = fallbackKeyPerson.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const namePattern = new RegExp(
      `(${nameEscaped})\\s*[,;]\\s*([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)`,
      'i',
    );
    const match = text.match(namePattern);
    if (match && match[2]) {
      result.title = match[2].trim();
    }

    // Try to find email near this name
    if (!result.email) {
      const nameIndex = text.search(new RegExp(nameEscaped, 'i'));
      if (nameIndex !== -1) {
        const contextStart = Math.max(0, nameIndex - 100);
        const contextEnd = Math.min(text.length, nameIndex + fallbackKeyPerson.length + 200);
        const context = text.substring(contextStart, contextEnd);

        const contextEmails = context.match(emailRegex);
        if (contextEmails && contextEmails.length > 0) {
          const personEmails = contextEmails.filter((e) => {
            const local = e.split('@')[0].toLowerCase();
            return ![
              'info',
              'contact',
              'noreply',
              'no-reply',
              'admin',
              'webmaster',
              'support',
              'web',
              'mail',
              'hello',
              'general',
            ].includes(local);
          });
          if (personEmails.length > 0) {
            result.email = personEmails[0];
          } else {
            result.email = contextEmails[0];
          }
        }
      }
    }
  }

  return result;
}

/**
 * Applies common email-template placeholders against a lead.
 * Supports both {{variable}} and [Variable Name] formats per the original
 * code in LeadDetail.tsx loadEmailTemplates (lines 130-144).
 */
export function applyTemplatePlaceholders(template: string, lead: Lead): string {
  let out = template;
  out = out.replace(/\{\{companyName\}\}/g, lead.companyName ?? '');
  out = out.replace(/\{\{keyPersonName\}\}/g, lead.keyPersonName ?? '');
  out = out.replace(/\{\{keyPersonTitle\}\}/g, lead.keyPersonTitle ?? '');
  out = out.replace(/\{\{city\}\}/g, lead.city ?? '');
  out = out.replace(/\{\{country\}\}/g, lead.country ?? '');
  out = out.replace(/\{\{industry\}\}/g, lead.industry ?? '');
  out = out.replace(/\[Company Name\]/g, lead.companyName ?? '');
  out = out.replace(/\[Key Person Name\]/g, lead.keyPersonName ?? '');
  return out;
}
