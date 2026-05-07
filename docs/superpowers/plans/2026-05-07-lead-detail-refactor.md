# LeadDetail Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `components/LeadDetail.tsx` (1998 LOC, currently `@ts-nocheck`) into a thin orchestration container under 100 LOC plus four tested pure helpers, three custom hooks, and three typed tab components — removing `@ts-nocheck` and adding ~25 unit tests.

**Architecture:** Pure parsing logic lives in `LeadDetail/leadDetailHelpers.ts` (no React, fully testable). State/effects for each tab are encapsulated in custom hooks (`useLeadEdit`, `useLeadEnrichment`, `useLeadEmail`). Tab JSX moves into dedicated tab components. The container composes the hooks and passes typed slices to each tab. JSX moves verbatim — no UI changes.

**Tech Stack:** React 19 + TypeScript ~5.8 strict, Vitest v3, Tailwind CSS, lucide-react icons, fetch-based API client (`services/apiService.ts`), Gemini/Vertex AI services.

**Source spec:** `docs/superpowers/specs/2026-05-07-lead-detail-refactor-design.md`

**Working directory:** `/Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm` — directly on `main` (solo dev).

**Estimated cadence:** 10 commits across ~5 sessions. Manual browser smoke after every commit (no component test infra). Do not batch.

---

## File Map

### New files

| Path                                              | Status | Responsibility                                                                                   |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `components/LeadDetail/leadDetailHelpers.ts`      | create | Pure: `extractDomain`, `verifyEmail`, `parseResearchResult`, `applyTemplatePlaceholders` + types |
| `components/LeadDetail/leadDetailHelpers.test.ts` | create | ~25 unit tests on the four pure helpers                                                          |
| `components/LeadDetail/useLeadEdit.ts`            | create | Custom hook — info tab state (isEditing, editedLead) + handlers                                  |
| `components/LeadDetail/useLeadEnrichment.ts`      | create | Custom hook — enrich tab state + AI handlers + countdown effect                                  |
| `components/LeadDetail/useLeadEmail.ts`           | create | Custom hook — email tab state + template/draft/send handlers + countdown effect                  |
| `components/LeadDetail/LeadInfoTab.tsx`           | create | Info tab JSX (lead fields, edit mode, save/cancel)                                               |
| `components/LeadDetail/LeadEnrichTab.tsx`         | create | Enrich tab JSX (form, AI result, approval UI)                                                    |
| `components/LeadDetail/LeadEmailTab.tsx`          | create | Email tab JSX (template picker, draft editor, attachments, replies)                              |

### Modified files

| Path                        | Status | Responsibility after this sub-project                                   |
| --------------------------- | ------ | ----------------------------------------------------------------------- |
| `components/LeadDetail.tsx` | modify | Thin orchestration container under 100 LOC; no `@ts-nocheck`            |
| `STRICT_DEBT.md`            | modify | Move `LeadDetail.tsx` row from "Files with `@ts-nocheck`" to "Resolved" |

Callers of `LeadDetail` import via the default export path `'./LeadDetail'` which resolves to the `.tsx` file (TypeScript prefers files over same-named folders), so no caller updates are needed.

---

## Pre-flight

- [ ] **Confirm clean state and gates green**

```bash
cd /Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm
git status
git log --oneline -3
npm run lint > /dev/null && echo "lint ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm test 2>&1 | tail -3
```

Expected: clean working tree; top commit is `b4025bc docs: add LeadDetail refactor design spec` (or later); all gates pass; 156 tests pass.

- [ ] **Read the spec end-to-end before starting**

```bash
cat docs/superpowers/specs/2026-05-07-lead-detail-refactor-design.md | head -200
```

The spec defines the architecture decisions, particularly why custom hooks are used (not just JSX splits) and what each hook owns. Do not proceed without understanding §3 (Architecture) and §4 (Test strategy).

---

## Task 1: Extract pure helpers + tests

**Files:**

- Create: `components/LeadDetail/leadDetailHelpers.ts`
- Create: `components/LeadDetail/leadDetailHelpers.test.ts`

This task lands new files; `LeadDetail.tsx` still uses inline copies of the helpers. The wire-up is Task 2.

- [ ] **Step 1: Read the four sources from `LeadDetail.tsx`**

```bash
sed -n '243,258p' components/LeadDetail.tsx   # extractDomain (~16 LOC)
sed -n '261,301p' components/LeadDetail.tsx   # verifyEmail (~40 LOC)
sed -n '305,615p' components/LeadDetail.tsx   # parseResearchResult (~310 LOC)
sed -n '129,144p' components/LeadDetail.tsx   # template placeholder substitution (subject + body)
```

Note: `parseResearchResult` is large (~310 LOC of regex). Copy verbatim — do not rewrite or simplify. The plan will test it as-is.

The "template placeholder" code is currently inline in `loadEmailTemplates` (around lines 130-145). Extract it into `applyTemplatePlaceholders(template: string, lead: Lead): string` that runs all the `{{var}}` and `[Var Name]` replacements once.

- [ ] **Step 2: Create `components/LeadDetail/leadDetailHelpers.ts`**

```typescript
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
 * Moved verbatim from LeadDetail.tsx (lines 305-615). Behavior unchanged.
 *
 * The original had `console.log` debug statements; those are removed here.
 * Callers may wrap this function and log inputs/outputs themselves if needed.
 *
 * The 4 structured patterns + email-extraction fallback + name-match heuristic
 * + title-extraction fallback are all preserved exactly as before — including
 * any quirks. Improvements to the heuristics belong to a later sub-project.
 */
export function parseResearchResult(text: string): ResearchResult {
  // COPY THE ENTIRE BODY of the original parseResearchResult function from
  // components/LeadDetail.tsx lines 312-614 verbatim into here.
  //
  // Only changes:
  //   1. Remove all `console.log(...)` calls inside the function.
  //   2. Replace the inferred return type with the explicit `ResearchResult`
  //      declared above.
  //   3. The local `result: { name?: string; ... }` declaration becomes
  //      `const result: ResearchResult = {};`.
  //
  // Do not refactor or simplify the regex patterns or filtering logic.
  // The tests in the next step assume the original behavior.
  throw new Error('replace with verbatim copy from LeadDetail.tsx:312-614');
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
```

> ⚠ Step 2 leaves `parseResearchResult` as a `throw new Error(...)` placeholder. **Do not commit yet.** Step 3 below replaces it with the verbatim body copied from the source.

- [ ] **Step 3: Replace the `parseResearchResult` placeholder with the source body**

Open `components/LeadDetail.tsx`, copy lines 312-614 (the entire body inside the `parseResearchResult` function — from the first `const result: { name?: ... } = {};` through the final `return result;`). Paste over the `throw new Error(...)` line in `leadDetailHelpers.ts`.

Then in the new file:

1. Change the local `const result: { name?: string; title?: string; email?: string } = {};` to `const result: ResearchResult = {};`.
2. Delete every `console.log(...)` call in the function body. Count them with `grep -c 'console\.log' components/LeadDetail.tsx` against the source range to estimate how many were removed.
3. Verify all closing braces still match.

- [ ] **Step 4: Create `components/LeadDetail/leadDetailHelpers.test.ts`**

```typescript
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

  it('falls back to regex extraction when URL parsing fails', () => {
    // Input that URL constructor would reject without protocol prepended.
    // The function prepends https:// then parses; if still bad, regex fallback.
    expect(extractDomain('   ')).toBeNull(); // whitespace fails the regex
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

  it('extracts name, title, email from structured KEY PERSON CONTACT block', () => {
    const text = `
      KEY PERSON CONTACT:
      Name: John Smith
      Title: Sales Director
      Email: john.smith@acme.com
    `;
    const r = parseResearchResult(text);
    expect(r.name).toBe('John Smith');
    expect(r.title).toBe('Sales Director');
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

  it('handles structured format without KEY PERSON CONTACT header', () => {
    const text = `
      Name: Jane Doe
      Title: Marketing Manager
      Email: jane@acme.com
    `;
    const r = parseResearchResult(text);
    expect(r.name).toBe('Jane Doe');
    expect(r.email).toBe('jane@acme.com');
  });

  it('filters out generic emails (info@, contact@, etc.)', () => {
    const text = 'Contact us: info@acme.com or support@acme.com';
    const r = parseResearchResult(text);
    expect(r.email).toBeUndefined();
  });

  it('extracts a person email when present alongside generic ones', () => {
    const text = 'Contact info@acme.com or jane.doe@acme.com directly';
    const r = parseResearchResult(text);
    expect(r.email).toBe('jane.doe@acme.com');
  });

  it('cleans trailing punctuation from email', () => {
    const text = 'Email: john@acme.com.';
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
    const text = 'Name : Bob\nTitle : CEO\nEmail : bob@acme.com';
    const r = parseResearchResult(text);
    expect(r.name).toBe('Bob');
    expect(r.title).toBe('CEO');
  });
});

describe('applyTemplatePlaceholders', () => {
  const lead: Lead = {
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
    const sparse = { ...lead, city: undefined } as Lead;
    expect(applyTemplatePlaceholders('City: {{city}}', sparse)).toBe('City: ');
  });

  it('returns template verbatim when no placeholders match', () => {
    expect(applyTemplatePlaceholders('Plain text', lead)).toBe('Plain text');
  });
});
```

- [ ] **Step 5: Run the new tests**

```bash
npm test -- components/LeadDetail/leadDetailHelpers.test.ts 2>&1 | tail -15
```

Expected: ~25 cases pass.

If a `parseResearchResult` test fails, the most common cause is that Step 3's verbatim copy missed a brace or pasted partially. Re-read the source range and re-copy. Do **not** modify the function body to make tests pass — the tests assert original behavior.

- [ ] **Step 6: Run all gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm test 2>&1 | tail -3
```

Expected: lint and typecheck pass; total tests = 156 + ~25 = ~181.

> ⚠ `LeadDetail.tsx` still has `@ts-nocheck`, so its inline duplicates of these helpers won't fail typecheck. The new file's strict types must be clean.

- [ ] **Step 7: Commit**

```bash
git add components/LeadDetail/leadDetailHelpers.ts components/LeadDetail/leadDetailHelpers.test.ts
git commit -m "$(cat <<'EOF'
feat(component): extract leadDetailHelpers + tests

Create components/LeadDetail/leadDetailHelpers.ts with extractDomain,
verifyEmail, parseResearchResult, applyTemplatePlaceholders. Bodies
copied verbatim from LeadDetail.tsx (lines 243-615 for the parsers,
130-144 for the placeholder replacer). The console.log debug calls
inside parseResearchResult are removed; behavior otherwise unchanged.

Add ~25 unit tests covering extractDomain edge cases, verifyEmail
status branches, parseResearchResult structured/unstructured inputs,
and applyTemplatePlaceholders modern + legacy placeholder formats.

LeadDetail.tsx still uses inline copies; wire-up follows in Task 2.

Sub-project #4b, step 1/10.
EOF
)"
```

---

## Task 2: `LeadDetail.tsx` uses `leadDetailHelpers`

**Files:**

- Modify: `components/LeadDetail.tsx` (lines 130-145, 243-258, 261-301, 305-614)

- [ ] **Step 1: Add the helpers import**

Near the top of `components/LeadDetail.tsx`, after the existing imports, add:

```typescript
import {
  extractDomain,
  verifyEmail,
  parseResearchResult,
  applyTemplatePlaceholders,
} from './LeadDetail/leadDetailHelpers';
```

- [ ] **Step 2: Delete the four inline helper definitions**

Remove these blocks from `LeadDetail.tsx`:

- The inline `const extractDomain = ...` (lines ~243-258).
- The inline `const verifyEmail = ...` (lines ~261-301).
- The inline `const parseResearchResult = ...` (lines ~305-614).

After deletion the file should be ~310 LOC shorter.

The existing call sites (`extractDomain(...)`, `verifyEmail(...)`, `parseResearchResult(...)`) inside the component body now resolve to the imports — no changes at use sites.

- [ ] **Step 3: Replace the inline placeholder substitution loop with `applyTemplatePlaceholders`**

In `loadEmailTemplates` (around line 124-146), the original code does ~15 sequential `subject = subject.replace(...)` and `body = body.replace(...)` calls. Replace that whole block with:

```typescript
const subject = applyTemplatePlaceholders(template.subject, lead);
const body = applyTemplatePlaceholders(template.body, lead);
```

Verify by grepping that no `\{\{companyName\}\}` literals remain in `LeadDetail.tsx`:

```bash
grep -c '{{companyName}}' components/LeadDetail.tsx
```

Expected: `0`.

- [ ] **Step 4: Verify the file shrank as expected**

```bash
wc -l components/LeadDetail.tsx
```

Expected: file is now ~1670 LOC (down from 1998; ~310 lines for parseResearchResult + ~55 for the other helpers + ~15 for placeholder replacements removed).

- [ ] **Step 5: Run gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm test 2>&1 | tail -3
```

> ⚠ `LeadDetail.tsx` still has `@ts-nocheck`, so typecheck won't catch a typo at the call sites. Step 6's manual smoke is the safety net here.

- [ ] **Step 6: Manual smoke test (CRITICAL — DO NOT SKIP)**

```bash
npm run dev &
sleep 5
echo "Open http://localhost:3000 → Leads view → click a lead. Test:"
echo "  Info tab: verify all fields display."
echo "  Enrich tab: click Enrich, wait for AI result, verify the parsed name/title/email appear correctly."
echo "  Email tab: verify a template loads and placeholders are substituted (e.g. {{companyName}} becomes the real name)."
# Visual verification by user
kill %1 2>/dev/null
```

> ⚠ The CLI cannot click buttons. The user must run this smoke test in a real browser. If the enrich result no longer parses correctly OR if email placeholders show literal `{{companyName}}` text, revert this commit and re-do the helper extraction.

- [ ] **Step 7: Commit**

```bash
git add components/LeadDetail.tsx
git commit -m "$(cat <<'EOF'
refactor(component): LeadDetail uses leadDetailHelpers

Replace the four inline helper definitions (extractDomain, verifyEmail,
parseResearchResult ~310 LOC, and the inline {{var}}/[Var] substitution
loop) with imports from leadDetailHelpers. LeadDetail.tsx is now ~1670
LOC. Behavior unchanged.

Sub-project #4b, step 2/10.
EOF
)"
```

---

## Task 3: Extract `useLeadEdit` hook

**Files:**

- Create: `components/LeadDetail/useLeadEdit.ts`
- Modify: `components/LeadDetail.tsx`

Encapsulates the info tab's edit-mode state.

- [ ] **Step 1: Create `components/LeadDetail/useLeadEdit.ts`**

```typescript
import { useEffect, useState } from 'react';
import type { Lead } from '../../types';

export function useLeadEdit(lead: Lead, onSave: (l: Lead) => void) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead>(lead);

  // Sync local edit state when the prop lead changes (e.g. user opened a different lead)
  useEffect(() => {
    setEditedLead(lead);
  }, [lead]);

  const handleInputChange = <K extends keyof Lead>(field: K, value: Lead[K]) => {
    setEditedLead((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = () => {
    onSave(editedLead);
    setIsEditing(false);
  };

  return {
    isEditing,
    setIsEditing,
    editedLead,
    setEditedLead, // exposed for useLeadEnrichment to write the AI-found key person back
    handleInputChange,
    handleSaveChanges,
  };
}
```

- [ ] **Step 2: Wire it into `LeadDetail.tsx`**

At the top of the component body (just after the existing `useState` block but before the enrich/email state), add:

```typescript
import { useLeadEdit } from './LeadDetail/useLeadEdit';

// ...inside the component:
const edit = useLeadEdit(lead, onSave);
// destructure for backward compatibility with existing JSX:
const { isEditing, setIsEditing, editedLead, handleInputChange, handleSaveChanges } = edit;
```

Then **delete** these from the original component:

- The three `useState`s for `isEditing`, `editedLead`, plus the prop-sync `useEffect` (the part that does `setEditedLead(lead)` and the three `setEnrich*` calls — leave the three `setEnrich*` lines in place but split that effect into two: one for edit, one for enrich. Actually — simpler: KEEP the `setEnrich*` calls in the original `useEffect`, just remove the `setEditedLead(lead)` line because the hook now owns that).
- The two handlers `handleInputChange`, `handleSaveChanges`.

Verify the original `useEffect` near line 77 now looks like:

```typescript
useEffect(() => {
  setEnrichCompanyName(lead.companyName || '');
  setEnrichKeyPerson(lead.keyPersonName || '');
  setEnrichCity(lead.city || '');
}, [lead]);
```

(The `setEditedLead(lead)` line is gone — moved into `useLeadEdit`.)

- [ ] **Step 3: Run gates and smoke**

```bash
npm run lint > /dev/null && npm run typecheck > /dev/null && npm test 2>&1 | tail -3
```

Then run the dev server and verify the info-tab edit flow:

1. Open a lead.
2. Click "Edit Info".
3. Change the company name field.
4. Click "Save Changes" — verify the change persists in the list.
5. Open the same lead again — verify the new name shows.
6. Open a _different_ lead — verify the form resets to the new lead's values (this proves the prop-sync effect works).

- [ ] **Step 4: Commit**

```bash
git add components/LeadDetail/useLeadEdit.ts components/LeadDetail.tsx
git commit -m "$(cat <<'EOF'
refactor(component): extract useLeadEdit hook

Encapsulate info-tab edit state (isEditing, editedLead) + prop-sync
effect + handleInputChange + handleSaveChanges into useLeadEdit hook.
Container destructures for backward compat with existing JSX (which
still references the local names). Tab-component extraction in Task 6
will replace that with prop drilling.

Sub-project #4b, step 3/10.
EOF
)"
```

---

## Task 4: Extract `useLeadEnrichment` hook

**Files:**

- Create: `components/LeadDetail/useLeadEnrichment.ts`
- Modify: `components/LeadDetail.tsx`

Encapsulates all enrichment-tab state, the rate-limit countdown, and the four AI-related handlers.

- [ ] **Step 1: Read the source ranges**

```bash
sed -n '43,57p' components/LeadDetail.tsx     # 7 enrichment useStates
sed -n '219,228p' components/LeadDetail.tsx   # rate-limit countdown useEffect
sed -n '616,749p' components/LeadDetail.tsx   # handleEnrich + handleApprove/RejectEmail + handleSaveEnrichment
```

- [ ] **Step 2: Create `components/LeadDetail/useLeadEnrichment.ts`**

```typescript
import { useEffect, useState } from 'react';
import type { Lead } from '../../types';
import * as VertexAiService from '../../services/vertexAiService';
import * as GeminiService from '../../services/geminiService';
import { leadsApi } from '../../services/apiService';
import { mapLeadFromDB } from '../../utils/leadUtils';
import { parseResearchResult, verifyEmail } from './leadDetailHelpers';

interface ResearchResults {
  name?: string;
  title?: string;
  email?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'auto-approved';
  verificationReason?: string;
}

export function useLeadEnrichment(lead: Lead, editedLead: Lead) {
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ text: string; grounding: unknown } | null>(
    null,
  );
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [enrichCompanyName, setEnrichCompanyName] = useState(lead.companyName || '');
  const [enrichKeyPerson, setEnrichKeyPerson] = useState(lead.keyPersonName || '');
  const [enrichCity, setEnrichCity] = useState(lead.city || '');
  const [researchResults, setResearchResults] = useState<ResearchResults | null>(null);

  // Sync form when prop lead changes
  useEffect(() => {
    setEnrichCompanyName(lead.companyName || '');
    setEnrichKeyPerson(lead.keyPersonName || '');
    setEnrichCity(lead.city || '');
  }, [lead]);

  // Countdown for rate limit
  useEffect(() => {
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0) {
      setRateLimitCountdown(null);
    }
  }, [rateLimitCountdown]);

  // COPY THE BODIES of handleEnrich / handleApproveEmail / handleRejectEmail /
  // handleSaveEnrichment from LeadDetail.tsx (lines 616-749) verbatim into
  // these locals. Adjust three things:
  //   1. Replace `editedLead.website` references with `editedLead.website` (unchanged, but
  //      verify it still resolves — the hook receives editedLead as a parameter).
  //   2. Replace `parseResearchResult(...)` calls — they already point to the helper.
  //   3. Replace `verifyEmail(...)` calls similarly.
  //   4. Where the original calls `setResearchResults({ ..., verificationStatus, verificationReason })`,
  //      keep that — `verifyEmail` returns `{ status, reason }` so map: status → verificationStatus,
  //      reason → verificationReason.

  const handleEnrich = async () => {
    /* verbatim from LeadDetail.tsx ~616-704 */
    throw new Error('replace with verbatim copy');
  };
  const handleApproveEmail = () => {
    /* verbatim ~705-731 */
    throw new Error('replace with verbatim copy');
  };
  const handleRejectEmail = () => {
    /* verbatim ~732-736 */
    throw new Error('replace with verbatim copy');
  };
  const handleSaveEnrichment = async () => {
    /* verbatim ~737-749 */
    throw new Error('replace with verbatim copy');
  };

  return {
    enrichLoading,
    enrichResult,
    rateLimitCountdown,
    enrichCompanyName,
    setEnrichCompanyName,
    enrichKeyPerson,
    setEnrichKeyPerson,
    enrichCity,
    setEnrichCity,
    researchResults,
    handleEnrich,
    handleApproveEmail,
    handleRejectEmail,
    handleSaveEnrichment,
  };
}
```

- [ ] **Step 3: Replace the four `throw new Error(...)` placeholders with the verbatim handler bodies**

Open `LeadDetail.tsx` and copy the four function bodies (the `{...}` content of `handleEnrich`, `handleApproveEmail`, `handleRejectEmail`, `handleSaveEnrichment`) into the corresponding placeholders. Do not refactor; preserve `setEnrichLoading`, `setEnrichResult`, `setRateLimitCountdown`, `setResearchResults` calls verbatim — they now resolve to the hook's local setters.

If a handler references `editedLead.companyName` or similar, that's fine — `editedLead` is a hook parameter.

If a handler references `setEditedLead` (which does happen in `handleSaveEnrichment` to update the lead with the AI-found key person), pass it through. Two options:

- **Option A (preferred):** make the hook signature `useLeadEnrichment(lead, editedLead, setEditedLead)` and accept the setter.
- **Option B:** return an `enrichmentResult` value from the hook and let the orchestrator wire `setEditedLead(...)` at the call site.

Pick Option A for simplicity. Update the function signature accordingly.

- [ ] **Step 4: Wire it into `LeadDetail.tsx`**

```typescript
import { useLeadEnrichment } from './LeadDetail/useLeadEnrichment';

// In the component, after `const edit = useLeadEdit(...)`:
const enrichment = useLeadEnrichment(lead, edit.editedLead, edit.setEditedLead);
// (setEditedLead must be exposed from useLeadEdit — add it to the return if missing)

// Backward compat destructure for existing JSX:
const {
  enrichLoading,
  enrichResult,
  rateLimitCountdown,
  enrichCompanyName,
  setEnrichCompanyName,
  enrichKeyPerson,
  setEnrichKeyPerson,
  enrichCity,
  setEnrichCity,
  researchResults,
  handleEnrich,
  handleApproveEmail,
  handleRejectEmail,
  handleSaveEnrichment,
} = enrichment;
```

Then **delete** from the original component:

- The 7 enrichment `useState`s.
- The rate-limit countdown `useEffect`.
- The 3 `setEnrich*` calls inside the prop-sync `useEffect` (the hook now owns this — the prop-sync effect inside the original component becomes empty and can be deleted entirely).
- The four handlers `handleEnrich`, `handleApproveEmail`, `handleRejectEmail`, `handleSaveEnrichment`.

`useLeadEdit` already exposes `setEditedLead` (added in Task 3). Verify by `grep "setEditedLead" components/LeadDetail/useLeadEdit.ts` — should match the return object line.

- [ ] **Step 5: Verify `LeadDetail.tsx` shrank**

```bash
wc -l components/LeadDetail.tsx
```

Expected: ~1450-1500 LOC (down from ~1670; ~150-200 LOC of state + handlers moved out).

- [ ] **Step 6: Run gates and smoke**

```bash
npm run lint > /dev/null && npm run typecheck > /dev/null && npm test 2>&1 | tail -3
```

Browser smoke test the enrich tab end-to-end:

1. Open a lead, click the Enrich tab.
2. Verify the form pre-fills with company name / key person / city.
3. Modify a field, click "Enrich".
4. Wait for the AI response (this is a real Gemini/Vertex call — needs a live network + API key).
5. Verify the AI result text displays, and the parsed key person info appears.
6. Click "Approve" if a key-person email was found — verify the lead is updated.
7. Trigger a rate limit (rapid click) — verify the countdown UI works.

- [ ] **Step 7: Commit**

```bash
git add components/LeadDetail/useLeadEnrichment.ts components/LeadDetail/useLeadEdit.ts components/LeadDetail.tsx
git commit -m "$(cat <<'EOF'
refactor(component): extract useLeadEnrichment hook

Move all 7 enrichment useStates, the rate-limit countdown useEffect,
the prop-sync effect for enrich form fields, and the four handlers
(handleEnrich ~88 LOC, handleApprove/RejectEmail, handleSaveEnrichment)
into useLeadEnrichment(lead, editedLead, setEditedLead). The hook owns
the AI service calls. setEditedLead is exposed from useLeadEdit so the
hook can write the AI-found key person back to the edit state.

Sub-project #4b, step 4/10.
EOF
)"
```

---

## Task 5: Extract `useLeadEmail` hook

**Files:**

- Create: `components/LeadDetail/useLeadEmail.ts`
- Modify: `components/LeadDetail.tsx`

The largest hook. Encapsulates email-tab state, the data-load effect, the rate-limit countdown, and the seven email handlers (`loadEmailTemplates`, `loadEmailReplies`, `handleCheckInbox`, `handleTemplateChange`, `handleDraftEmail`, `handleFileUpload`, `handleSendEmail`).

> ⚠ This task is large. If after Step 3 the hook file exceeds ~400 LOC and feels unwieldy, split into 5a (state + simple handlers) and 5b (`handleSendEmail` only). The spec §6 (R10) anticipates this.

- [ ] **Step 1: Read the source ranges**

```bash
sed -n '60,72p' components/LeadDetail.tsx     # 10 email useStates
sed -n '85,90p' components/LeadDetail.tsx     # email-tab data-load useEffect
sed -n '92,207p' components/LeadDetail.tsx    # loadEmailTemplates + loadEmailReplies + handleCheckInbox
sed -n '231,240p' components/LeadDetail.tsx   # email rate-limit useEffect
sed -n '751,960p' components/LeadDetail.tsx   # handleTemplateChange + handleDraftEmail + handleFileUpload + handleSendEmail
```

- [ ] **Step 2: Create `components/LeadDetail/useLeadEmail.ts` (skeleton)**

```typescript
import { useEffect, useState } from 'react';
import type { Lead, EmailTemplate, EmailReply } from '../../types';
import { emailTemplatesApi, emailLogsApi, emailRepliesApi } from '../../services/apiService';
import { applyTemplatePlaceholders } from './leadDetailHelpers';

interface AttachmentItem {
  name: string;
  size: number;
  type: string;
  file_data?: string;
  is_link?: boolean;
  fromTemplate?: boolean;
}

export function useLeadEmail(lead: Lead, activeTab: 'info' | 'enrich' | 'email') {
  const [emailLoading, setEmailLoading] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState<{ subject: string; body: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [emailCC, setEmailCC] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [emailRateLimitCountdown, setEmailRateLimitCountdown] = useState<number | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [emailBodyViewMode, setEmailBodyViewMode] = useState<'code' | 'preview'>('preview');
  const [emailReplies, setEmailReplies] = useState<EmailReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [checkingInbox, setCheckingInbox] = useState(false);

  // Email rate-limit countdown
  useEffect(() => {
    if (emailRateLimitCountdown !== null && emailRateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setEmailRateLimitCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (emailRateLimitCountdown === 0) {
      setEmailRateLimitCountdown(null);
    }
  }, [emailRateLimitCountdown]);

  // Auto-load templates and replies when email tab opens
  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailTemplates();
      loadEmailReplies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, lead.id]);

  const loadEmailTemplates = async () => {
    /* COPY VERBATIM from LeadDetail.tsx ~92-181, then:
       - Replace the inline placeholder substitution loop with:
         const subject = applyTemplatePlaceholders(template.subject, lead);
         const body = applyTemplatePlaceholders(template.body, lead);
    */
    throw new Error('replace with verbatim copy');
  };

  const loadEmailReplies = async () => {
    /* COPY VERBATIM from LeadDetail.tsx ~183-193 */
    throw new Error('replace with verbatim copy');
  };

  const handleCheckInbox = async () => {
    /* COPY VERBATIM from LeadDetail.tsx ~195-207 */
    throw new Error('replace with verbatim copy');
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    /* COPY VERBATIM from LeadDetail.tsx ~751-803, applying same
       applyTemplatePlaceholders substitution as in loadEmailTemplates */
    throw new Error('replace with verbatim copy');
  };

  const handleDraftEmail = async () => {
    /* COPY VERBATIM from LeadDetail.tsx ~804-833 */
    throw new Error('replace with verbatim copy');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    /* COPY VERBATIM from LeadDetail.tsx ~834-855 */
    throw new Error('replace with verbatim copy');
  };

  const handleSendEmail = async () => {
    /* COPY VERBATIM from LeadDetail.tsx ~856-960 */
    throw new Error('replace with verbatim copy');
  };

  return {
    emailLoading,
    draftedEmail,
    setDraftedEmail,
    emailSent,
    selectedTemplate,
    setSelectedTemplate,
    emailCC,
    setEmailCC,
    attachments,
    setAttachments,
    emailRateLimitCountdown,
    emailTemplates,
    loadingTemplates,
    emailBodyViewMode,
    setEmailBodyViewMode,
    emailReplies,
    loadingReplies,
    checkingInbox,
    loadEmailTemplates,
    loadEmailReplies,
    handleCheckInbox,
    handleTemplateChange,
    handleDraftEmail,
    handleFileUpload,
    handleSendEmail,
  };
}
```

- [ ] **Step 3: Replace the seven `throw new Error(...)` placeholders with verbatim handler bodies**

For each handler, copy the body from `LeadDetail.tsx` and paste over the throw statement. Verify:

- All `set*` calls resolve to the hook's local setters (no leftover references to top-level component setters).
- The `applyTemplatePlaceholders` substitution replaces the inline `.replace(...)` loops in `loadEmailTemplates` and `handleTemplateChange`.
- No `console.log` calls are stripped — they were originally for debugging email loading and are still useful for now (sub-project #3 will replace with structured logger).

- [ ] **Step 4: Wire it into `LeadDetail.tsx`**

```typescript
import { useLeadEmail } from './LeadDetail/useLeadEmail';

// In the component, after `const enrichment = useLeadEnrichment(...)`:
const email = useLeadEmail(lead, activeTab);

// Backward compat destructure for existing JSX:
const {
  emailLoading,
  draftedEmail,
  setDraftedEmail,
  emailSent,
  selectedTemplate,
  setSelectedTemplate,
  emailCC,
  setEmailCC,
  attachments,
  setAttachments,
  emailRateLimitCountdown,
  emailTemplates,
  loadingTemplates,
  emailBodyViewMode,
  setEmailBodyViewMode,
  emailReplies,
  loadingReplies,
  checkingInbox,
  loadEmailTemplates,
  loadEmailReplies,
  handleCheckInbox,
  handleTemplateChange,
  handleDraftEmail,
  handleFileUpload,
  handleSendEmail,
} = email;
```

Then **delete** from the original component:

- The 10 email `useState`s.
- The two email-related `useEffect`s (data-load on tab open + rate-limit countdown).
- The seven email handlers + `loadEmailTemplates` + `loadEmailReplies` definitions.

After this, the component body should consist of: `activeTab` state, `useLeadEdit`, `useLeadEnrichment`, `useLeadEmail`, `canEdit` boolean, the destructure shims, then the JSX.

- [ ] **Step 5: Verify `LeadDetail.tsx` shrank**

```bash
wc -l components/LeadDetail.tsx
```

Expected: ~1080-1100 LOC (down from ~1450; ~350 LOC of state + 7 handlers moved out).

- [ ] **Step 6: Run gates and smoke**

```bash
npm run lint > /dev/null && npm run typecheck > /dev/null && npm test 2>&1 | tail -3
```

Browser smoke test the email tab end-to-end:

1. Open a lead, click the Email tab.
2. Verify templates load (the auto-select picks a default template).
3. Verify the draft pre-fills with placeholder substitutions.
4. Switch templates — verify the draft updates.
5. Toggle code/preview view.
6. Upload a file attachment — verify it appears in the list.
7. Click "Send Email" — verify it sends (use a test address) and the success state appears.
8. Click "Check Inbox" — verify it triggers the IMAP fetch and shows new replies.
9. Trigger an email rate limit — verify the countdown UI works.

- [ ] **Step 7: Commit**

```bash
git add components/LeadDetail/useLeadEmail.ts components/LeadDetail.tsx
git commit -m "$(cat <<'EOF'
refactor(component): extract useLeadEmail hook

Move all 10 email useStates, the email-tab data-load useEffect, the
email rate-limit countdown useEffect, and the seven handlers
(loadEmailTemplates, loadEmailReplies, handleCheckInbox,
handleTemplateChange, handleDraftEmail, handleFileUpload,
handleSendEmail ~100 LOC) into useLeadEmail(lead, activeTab).
The hook auto-loads templates and replies when activeTab === 'email'.
Inline placeholder substitution replaced with applyTemplatePlaceholders.

Sub-project #4b, step 5/10.
EOF
)"
```

---

## Task 6: Extract `LeadInfoTab`

**Files:**

- Create: `components/LeadDetail/LeadInfoTab.tsx`
- Modify: `components/LeadDetail.tsx` (the JSX block currently `{activeTab === 'info' && (...)}` around lines 1021-1370 of the original — line numbers have shifted after Tasks 1-5).

- [ ] **Step 1: Locate the info-tab JSX in the current `LeadDetail.tsx`**

```bash
grep -n "activeTab === 'info'" components/LeadDetail.tsx
grep -n "activeTab === 'enrich'" components/LeadDetail.tsx
```

The info tab is the JSX between the first two `activeTab ===` matches.

- [ ] **Step 2: Create `components/LeadDetail/LeadInfoTab.tsx`**

```typescript
import type React from 'react';
import { Edit2, X, Check, Lock, ExternalLink } from 'lucide-react';
import type { Lead, User } from '../../types';
import { StatusBadge, InfoItem, EditField, EditTextArea } from '../common';
import type { useLeadEdit } from './useLeadEdit';

interface LeadInfoTabProps {
  lead: Lead;
  user: User;
  edit: ReturnType<typeof useLeadEdit>;
}

export const LeadInfoTab: React.FC<LeadInfoTabProps> = ({ lead, user, edit }) => {
  const { isEditing, setIsEditing, editedLead, handleInputChange, handleSaveChanges } = edit;
  const canEdit = user.role === 'Director' || user.role === 'Sales';

  return (
    // PASTE THE JSX BLOCK from LeadDetail.tsx, the entire content of the
    // {activeTab === 'info' && ( ... )} expression — the contents inside the
    // parentheses, NOT the wrapper expression itself. The outer wrapper
    // <div className="space-y-4"> stays as the new return root.
    //
    // Do not modify any tailwind classes. Do not change the JSX structure.
    // Only adjustment: every reference to `isEditing`, `editedLead`,
    // `handleInputChange`, `handleSaveChanges`, `canEdit` is now a destructured
    // local — same names, no renaming required.
    null as never
  );
};
```

- [ ] **Step 3: Replace the placeholder body with the verbatim JSX**

In `LeadDetail.tsx`, locate the line `{activeTab === 'info' && (` and the matching `)}`. Copy everything between the opening `(` and the closing `)`. Paste it as the body of the `return (...)` in `LeadInfoTab.tsx`, replacing the `null as never` line.

After paste, verify:

- The outer JSX root is the original `<div className="space-y-4">`.
- All icon imports referenced in the JSX (`Edit2`, `X`, `Check`, `Lock`, `ExternalLink`, etc.) are imported at the top of `LeadInfoTab.tsx`.
- `StatusBadge`, `InfoItem`, `EditField`, `EditTextArea` are imported from `../common`.

- [ ] **Step 4: Replace the JSX in `LeadDetail.tsx` with the component call**

In `LeadDetail.tsx`, replace the entire `{activeTab === 'info' && (...)}` block with:

```tsx
{
  activeTab === 'info' && <LeadInfoTab lead={lead} user={user} edit={edit} />;
}
```

Add the import:

```typescript
import { LeadInfoTab } from './LeadDetail/LeadInfoTab';
```

- [ ] **Step 5: Run gates and smoke**

```bash
npm run lint > /dev/null && npm run typecheck > /dev/null && npm test 2>&1 | tail -3
```

Browser smoke: open a lead, info tab. Compare with a screenshot from before the refactor (or from memory) — every field, button, and badge should be identical.

- [ ] **Step 6: Commit**

```bash
git add components/LeadDetail/LeadInfoTab.tsx components/LeadDetail.tsx
git commit -m "$(cat <<'EOF'
refactor(component): extract LeadInfoTab

Move info-tab JSX (~350 LOC: lead details, edit-mode toggle, save/cancel,
fields grid) into LeadInfoTab.tsx. Props: lead, user, edit. JSX moves
verbatim — no UI changes. Container becomes a thin tab dispatcher for
the info tab.

Sub-project #4b, step 6/10.
EOF
)"
```

---

## Task 7: Extract `LeadEnrichTab`

**Files:**

- Create: `components/LeadDetail/LeadEnrichTab.tsx`
- Modify: `components/LeadDetail.tsx`

- [ ] **Step 1: Locate the enrich-tab JSX**

```bash
grep -n "activeTab === 'enrich'" components/LeadDetail.tsx
grep -n "activeTab === 'email'" components/LeadDetail.tsx
```

The enrich tab is the JSX between these two markers.

- [ ] **Step 2: Create `components/LeadDetail/LeadEnrichTab.tsx`**

```typescript
import type React from 'react';
import { Search, Loader2, CheckCircle, X } from 'lucide-react';
import type { Lead } from '../../types';
import type { useLeadEdit } from './useLeadEdit';
import type { useLeadEnrichment } from './useLeadEnrichment';

interface LeadEnrichTabProps {
  lead: Lead;
  edit: ReturnType<typeof useLeadEdit>;
  enrichment: ReturnType<typeof useLeadEnrichment>;
}

export const LeadEnrichTab: React.FC<LeadEnrichTabProps> = ({ lead, edit, enrichment }) => {
  const {
    enrichLoading,
    enrichResult,
    rateLimitCountdown,
    enrichCompanyName,
    setEnrichCompanyName,
    enrichKeyPerson,
    setEnrichKeyPerson,
    enrichCity,
    setEnrichCity,
    researchResults,
    handleEnrich,
    handleApproveEmail,
    handleRejectEmail,
    handleSaveEnrichment,
  } = enrichment;

  return (
    // PASTE THE JSX BLOCK from LeadDetail.tsx, the entire content of the
    // {activeTab === 'enrich' && ( ... )} expression body. Outer root is the
    // original <div className="space-y-3">.
    //
    // References to enrichment state and handlers resolve to the destructured
    // locals above — same names, no renaming.
    null as never
  );
};
```

- [ ] **Step 3: Paste the verbatim enrich-tab JSX**

In `LeadDetail.tsx`, locate the line `{activeTab === 'enrich' && (` and the matching `)}`. Copy everything between the opening `(` and the closing `)`. Paste it as the body of the `return (...)` in `LeadEnrichTab.tsx`, replacing the `null as never` line.

After paste, verify:

- The outer JSX root is the original `<div className="space-y-3">`.
- All icon imports referenced in the JSX (`Search`, `Loader2`, `CheckCircle`, `X`, etc.) are imported at the top of `LeadEnrichTab.tsx`.
- All references to enrichment state and handlers resolve to the destructured locals — same names, no renaming.

- [ ] **Step 4: Replace in `LeadDetail.tsx`**

```tsx
import { LeadEnrichTab } from './LeadDetail/LeadEnrichTab';

// Replace the {activeTab === 'enrich' && (...)} block with:
{
  activeTab === 'enrich' && <LeadEnrichTab lead={lead} edit={edit} enrichment={enrichment} />;
}
```

- [ ] **Step 5: Run gates and smoke**

```bash
npm run lint > /dev/null && npm run typecheck > /dev/null && npm test 2>&1 | tail -3
```

Browser smoke: open a lead, enrich tab. Run an enrichment end-to-end. Verify form fields, AI result display, approve/reject buttons all behave identically.

- [ ] **Step 6: Commit**

```bash
git add components/LeadDetail/LeadEnrichTab.tsx components/LeadDetail.tsx
git commit -m "$(cat <<'EOF'
refactor(component): extract LeadEnrichTab

Move enrich-tab JSX (~280 LOC: form, AI result display, parsed
person/title/email cards, approve/reject buttons, rate-limit countdown
UI) into LeadEnrichTab.tsx. Props: lead, edit, enrichment. JSX moves
verbatim.

Sub-project #4b, step 7/10.
EOF
)"
```

---

## Task 8: Extract `LeadEmailTab`

**Files:**

- Create: `components/LeadDetail/LeadEmailTab.tsx`
- Modify: `components/LeadDetail.tsx`

The largest tab component. Includes template picker, draft editor with code/preview toggle, attachments UI, send button, and replies list.

- [ ] **Step 1: Locate the email-tab JSX**

```bash
grep -n "activeTab === 'email'" components/LeadDetail.tsx
```

The email tab is everything from this match to the closing `)}` (which is near the end of the JSX, before the modal frame's closing tags).

- [ ] **Step 2: Create `components/LeadDetail/LeadEmailTab.tsx`**

```typescript
import type React from 'react';
import { Mail, Loader2, Save, Plus } from 'lucide-react';
import type { Lead } from '../../types';
import type { useLeadEmail } from './useLeadEmail';

interface LeadEmailTabProps {
  lead: Lead;
  email: ReturnType<typeof useLeadEmail>;
}

export const LeadEmailTab: React.FC<LeadEmailTabProps> = ({ lead, email }) => {
  const {
    emailLoading,
    draftedEmail,
    setDraftedEmail,
    emailSent,
    selectedTemplate,
    setSelectedTemplate,
    emailCC,
    setEmailCC,
    attachments,
    setAttachments,
    emailRateLimitCountdown,
    emailTemplates,
    loadingTemplates,
    emailBodyViewMode,
    setEmailBodyViewMode,
    emailReplies,
    loadingReplies,
    checkingInbox,
    handleCheckInbox,
    handleTemplateChange,
    handleDraftEmail,
    handleFileUpload,
    handleSendEmail,
  } = email;

  return (
    // PASTE THE JSX BLOCK from LeadDetail.tsx, the entire content of the
    // {activeTab === 'email' && canEdit && ( ... )} expression body.
    //
    // The `canEdit` check stays in the orchestrator (so this component is
    // only rendered when canEdit is true; no need to re-check inside).
    null as never
  );
};
```

- [ ] **Step 3: Paste the verbatim email-tab JSX**

In `LeadDetail.tsx`, locate the line `{activeTab === 'email' && canEdit && (` and the matching `)}`. Copy everything between the opening `(` and the closing `)`. Paste it as the body of the `return (...)` in `LeadEmailTab.tsx`, replacing the `null as never` line.

After paste, verify:

- All icon imports referenced in the JSX (`Mail`, `Loader2`, `Save`, `Plus`, plus any others used in the email-tab JSX such as form/upload icons) are imported at the top of `LeadEmailTab.tsx`.
- All references to email state and handlers resolve to the destructured locals — same names, no renaming.
- The `canEdit` check stays in the orchestrator (so this component is only rendered when canEdit is true; no need to re-check inside).

- [ ] **Step 4: Replace in `LeadDetail.tsx`**

```tsx
import { LeadEmailTab } from './LeadDetail/LeadEmailTab';

// Replace the {activeTab === 'email' && canEdit && (...)} block with:
{
  activeTab === 'email' && canEdit && <LeadEmailTab lead={lead} email={email} />;
}
```

After this, the orchestrator JSX should consist of: the slide-over wrapper, header, tab nav, and three one-line tab dispatches. Plus the destructure shims (which can now be removed — see Step 5).

- [ ] **Step 5: Remove the destructure shims**

After Tasks 6/7/8, the orchestrator no longer needs `const { isEditing, ... } = edit;` etc. — those names were only there for backward compat with the inline JSX. Delete the three destructure blocks. The orchestrator now passes hooks as props (`edit={edit}`, `enrichment={enrichment}`, `email={email}`).

- [ ] **Step 6: Verify `LeadDetail.tsx` is now under 100 LOC**

```bash
wc -l components/LeadDetail.tsx
```

Expected: 70-100 LOC. Contents: imports, props interface, the component declaration, `useState` for `activeTab`, three hook calls, `canEdit`, the JSX (slide-over frame + header + tab nav + three tab dispatches).

- [ ] **Step 7: Run gates and smoke**

```bash
npm run lint > /dev/null && npm run typecheck > /dev/null && npm test 2>&1 | tail -3
```

Full smoke test all three tabs. This is the last stop before strict-mode restoration.

- [ ] **Step 8: Commit**

```bash
git add components/LeadDetail/LeadEmailTab.tsx components/LeadDetail.tsx
git commit -m "$(cat <<'EOF'
refactor(component): extract LeadEmailTab

Move email-tab JSX (~340 LOC: template picker, draft editor with
code/preview toggle, attachments list/upload, CC field, send button,
replies list, check-inbox button, rate-limit countdown UI) into
LeadEmailTab.tsx. Props: lead, email. JSX moves verbatim.

Container is now ~80 LOC orchestrator: tab state + 3 hook calls + JSX
frame + 3 one-line tab dispatches. Backward-compat destructure shims
removed.

Sub-project #4b, step 8/10.
EOF
)"
```

---

## Task 9: Restore TS strict on `LeadDetail`

**Files:**

- Modify: `components/LeadDetail.tsx` — remove `// @ts-nocheck`
- Modify: any sub-file that has lingering `any` types
- Modify: `tests/setup.ts` if global type extensions need updating

> **Highest-risk task.** Strict mode may surface real shape mismatches from the AI service responses. Do not paper over with `as`, `as any`, or `// @ts-expect-error`.

- [ ] **Step 1: Remove the `@ts-nocheck` line**

Open `components/LeadDetail.tsx`. Delete the leading `// @ts-nocheck — TODO(refactor): ...` comment block (the first three lines).

- [ ] **Step 2: Run typecheck and inspect errors**

```bash
npm run typecheck 2>&1 | grep -E '(LeadDetail|useLeadE|leadDetailHelpers)' | head -40
```

Expected error categories (handle each):

**Category A — `any` types in props or returns:**

If `useLeadEnrichment.ts` has `enrichResult: { text: string; grounding: any }`, change to `grounding: unknown`. Narrow at use sites.

If a handler parameter is `(error: any)` (from try/catch), change to `(error: unknown)` and narrow with `error instanceof Error ? error.message : String(error)`.

**Category B — Lead field nullability:**

Lead fields like `companyName`, `keyPersonName`, etc. may be typed as `string | undefined` or `string | null`. Where the original code did `lead.companyName || ''`, that's already safe; TS should accept it. If a stricter access fails, add `?? ''`.

**Category C — Hook return-type inference:**

`ReturnType<typeof useLeadEdit>` etc. should infer cleanly. If TS complains the inferred type is too wide, add an explicit return-type annotation to the hook function:

```typescript
export function useLeadEdit(
  lead: Lead,
  onSave: (l: Lead) => void,
): {
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  editedLead: Lead;
  setEditedLead: (l: Lead) => void;
  handleInputChange: <K extends keyof Lead>(field: K, value: Lead[K]) => void;
  handleSaveChanges: () => void;
} {
  /* ... */
}
```

**Category D — Attachment shape:**

The `attachments: any[]` from the original becomes `AttachmentItem[]` (defined in `useLeadEmail.ts`). If `LeadEmailTab.tsx` JSX does `attachment.is_link` or `attachment.fromTemplate`, those fields must be on `AttachmentItem`. Verify by reading `useLeadEmail.ts`'s `AttachmentItem` definition matches the JSX's accesses.

**Category E — AI service response shape:**

`VertexAiService.enrichWebsite(...)` and `GeminiService.enrichWebsite(...)` likely return `Promise<any>` or a specific shape. Inspect the service:

```bash
grep -A 10 "export.*enrichWebsite" services/vertexAiService.ts services/geminiService.ts
```

If the return type is `any`, the boundary cast happens once at the hook level (`useLeadEnrichment`'s `handleEnrich`). Add a comment explaining why `any` is unavoidable here:

```typescript
// AI service returns unstructured grounding metadata; the runtime shape varies
// between Vertex and Gemini and is best handled as `unknown` until extracted to
// a typed AI provider interface (see services/ai/ scaffold).
const result = await VertexAiService.enrichWebsite(...) as { text: string; grounding: unknown };
```

This is the only acceptable `as` cast in the entire refactor — and only at the AI boundary.

- [ ] **Step 3: Iterate until typecheck passes**

Re-run `npm run typecheck` after each fix. Continue until exit 0.

If a fix would require changing actual logic (e.g., a regex pattern truly returns `string | undefined` where the code assumed `string`), default with `?? ''` or guard with `if (!x) return;` — preserve original runtime behavior.

> **Hard rule:** No `// @ts-nocheck`, no `// @ts-ignore`, no `// @ts-expect-error` (other than markers already in `STRICT_DEBT.md` for OTHER sub-projects). The boundary `as` at the AI service call is the only exception.

- [ ] **Step 4: Run all gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run format:check > /dev/null && echo "format ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm run build > /dev/null && echo "build ok"
npm test 2>&1 | tail -3
```

All must pass.

- [ ] **Step 5: Full smoke test**

This is the final regression check. Open a lead and exercise every tab:

- **Info:** edit a field, save, verify persistence.
- **Enrich:** run enrichment, verify result parses, click approve, verify lead update.
- **Email:** load templates, verify substitutions, switch templates, attach a file, send to a test address, check inbox for replies.
- Open a different lead, verify state resets cleanly.
- Inspect DevTools console — no new red errors.

If any regression appears, **revert this commit** (`git reset --hard HEAD~1`) and investigate which `any → unknown` change broke a runtime assumption. Then re-attempt with a more targeted fix.

- [ ] **Step 6: Commit**

```bash
git add components/LeadDetail.tsx components/LeadDetail/
git commit -m "$(cat <<'EOF'
refactor(component): restore TS strict on LeadDetail (remove @ts-nocheck)

Tighten types across LeadDetail.tsx and all sub-files: any → unknown
on AI service response (with a single boundary cast + explanation),
attachment list typed via AttachmentItem, error handlers narrowed via
instanceof, hook return types inferred cleanly. No new @ts-expect-error
or @ts-nocheck. No logic changes.

Sub-project #4b, step 9/10.
EOF
)"
```

---

## Task 10: Update `STRICT_DEBT.md`

**Files:**

- Modify: `STRICT_DEBT.md`

- [ ] **Step 1: Edit `STRICT_DEBT.md`**

Open `STRICT_DEBT.md`. In the "Files with `@ts-nocheck`" section, remove the `components/LeadDetail.tsx` row.

After removal, the table should be empty. Replace the empty table with:

```markdown
## Files with `@ts-nocheck`

(none currently — all god-file `@ts-nocheck` markers resolved)
```

In the "Resolved" subsection at the bottom of the file, append:

```markdown
- ~~`components/LeadDetail.tsx`~~ — resolved in sub-project #4b. Split into 3 custom hooks (`useLeadEdit`, `useLeadEnrichment`, `useLeadEmail`) + 3 tab components + tested pure helpers (`leadDetailHelpers.ts` with ~25 unit tests); `@ts-nocheck` removed.
```

- [ ] **Step 2: Verify gates one more time**

```bash
npm run lint > /dev/null && npm run format:check > /dev/null && npm run typecheck > /dev/null && npm run typecheck:api > /dev/null && npm run build > /dev/null && npm test 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add STRICT_DEBT.md
git commit -m "$(cat <<'EOF'
docs: STRICT_DEBT.md — LeadDetail resolved

Remove components/LeadDetail.tsx from the @ts-nocheck list (the file
no longer carries the marker). The "Files with @ts-nocheck" section
is now empty — all god-file @ts-nocheck debt is resolved.

Sub-project #4b, step 10/10. Closes the LeadDetail refactor.
EOF
)"
```

---

## Final verification

- [ ] **All gates green**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run format:check > /dev/null && echo "format ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm run build > /dev/null && echo "build ok"
npm test 2>&1 | tail -5
```

Expected: all pass; ~181 tests; under 10 seconds.

- [ ] **File size and structure**

```bash
wc -l components/LeadDetail.tsx
ls -la components/LeadDetail/
```

Expected: `LeadDetail.tsx` < 100 LOC; folder contains:

- `leadDetailHelpers.ts`
- `leadDetailHelpers.test.ts`
- `useLeadEdit.ts`
- `useLeadEnrichment.ts`
- `useLeadEmail.ts`
- `LeadInfoTab.tsx`
- `LeadEnrichTab.tsx`
- `LeadEmailTab.tsx`

- [ ] **No `@ts-nocheck` anywhere in LeadDetail scope**

```bash
grep -rn '@ts-nocheck' components/LeadDetail*
```

Expected: no output.

- [ ] **No new `any` introduced (boundary cast excepted)**

```bash
grep -rn ': any\| as any\|<any>' components/LeadDetail.tsx components/LeadDetail/
```

Expected: at most one match — the AI service boundary cast in `useLeadEnrichment.ts`. Anywhere else, replace with `unknown` and narrow at use site.

- [ ] **Full modal smoke test (browser)**

Run the dev server and walk through all three tabs end-to-end on at least one real lead with rich data. Confirm visual + behavioral parity with the pre-refactor version.

- [ ] **Push to remote**

```bash
git push origin main
```

The pre-push hook runs `npm run typecheck && npm run typecheck:api && npm test`. Push succeeds only if all pass.

---

## Rollback notes

Each commit touches one logical extraction:

- **Task 1:** pure helpers + tests, additive only. Zero behavior risk.
- **Task 2:** swap inline helpers for imports. Revert → returns to inline copies (still works).
- **Tasks 3-5:** custom hook extractions. Revert one → that concern's state returns to the orchestrator.
- **Tasks 6-8:** tab JSX extractions. Revert one → that tab's JSX returns inline.
- **Task 9:** TS strict restoration. If a runtime regression surfaces post-merge, revert → file returns to `@ts-nocheck` while the structural split is preserved.
- **Task 10:** docs only.

The riskiest steps are Tasks 4, 5, and 9. If any introduces a regression that's hard to spot in smoke testing, revert and re-attempt with smaller scope (e.g., split useLeadEmail into two hooks, or fix strict errors file-by-file).

---

## Out of scope

- Visual / UX changes — the slide-over and all three tabs look identical post-refactor.
- Component rendering tests — frontend test infra is a future sub-project.
- Custom-hook tests via `react-hooks-testing-library` — same future sub-project.
- Touching `views/LeadsView.tsx` (sub-project #4d) or other callers.
- Replacing `VertexAiService` / `GeminiService` with the AI provider abstraction — separately scaffolded; this refactor uses them as-is.
- Improving `parseResearchResult` regex heuristics — tests cement existing behavior.
- Restructuring `handleSendEmail`'s side-effect chain (alert → state → reload) into a notification system.
- Adding URL-routed tabs or lazy-mounted tabs.
