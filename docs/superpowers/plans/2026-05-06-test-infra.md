# Test Infrastructure + Smoke Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Vitest, write ~60–70 deterministic test cases on 7 high-leverage source files (no real I/O), wire `npm test` into the pre-push hook, and document conventions — providing the regression net required before sub-project #4 refactors god files.

**Architecture:** Single Vitest config with `node` environment. Co-located `*.test.ts` files. Mocks for `pg`, `@google/generative-ai`, `@google/genai`, `openai`, `nodemailer`, `dotenv` live in `tests/mocks/`. Helpers in `tests/helpers/`. No real network/DB/AI calls during `npm test`.

**Tech Stack:** Vitest v3 + @vitest/coverage-v8 + existing TypeScript ~5.8 + Zod (already in deps).

**Source spec:** `docs/superpowers/specs/2026-05-06-test-infra-design.md`

**Working directory:** `/Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm` — directly on `main` (solo dev).

---

## File Map

| Path                                             | Status | Responsibility                                                                                              |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------- |
| `package.json`                                   | modify | Add Vitest devDeps + `test`, `test:watch`, `test:coverage` scripts                                          |
| `vitest.config.ts`                               | create | Vitest configuration: node env, globs, alias, setupFiles                                                    |
| `tests/setup.ts`                                 | create | Global hooks (NODE_ENV='test', restore env after each)                                                      |
| `tests/mocks/pg.ts`                              | create | `MockPool` class + helper to register `vi.mock('pg')`                                                       |
| `tests/mocks/gemini.ts`                          | create | Mocks for `@google/generative-ai` and `@google/genai`                                                       |
| `tests/mocks/openai.ts`                          | create | Mock for `openai` SDK                                                                                       |
| `tests/helpers/env.ts`                           | create | `setEnv` / `restoreEnv` helpers + `mockDotenv()` for env.test.ts                                            |
| `api/src/utils/eventScoring.test.ts`             | create | ~15 cases on `calculateEventScore`, `formatEventHistory`                                                    |
| `api/src/utils/dataQuality.test.ts`              | create | ~12 cases on `detectDataIssues`, `calculateDataQualityScore`, `extractOrganizationName`, `extractEventName` |
| `views/IntelligentDataView/scoringUtils.test.ts` | create | ~10 cases on the 7 frontend exports                                                                         |
| `api/src/config/env.test.ts`                     | create | ~6 cases on Zod schema                                                                                      |
| `utils/leadUtils.test.ts`                        | create | ~4 cases on `mapLeadFromDB`/`mapLeadToDB`                                                                   |
| `utils/leadEnrichUtils.test.ts`                  | create | ~4 cases on `isLeadMissingPersonInfo`, `parseEnrichResponse`                                                |
| `api/src/services/leadScoringService.test.ts`    | create | ~5 cases with mocked Gemini and mocked models                                                               |
| `api/src/services/reportStatsService.test.ts`    | create | ~5 cases with mocked models                                                                                 |
| `.husky/pre-push`                                | modify | Append `&& npm test` after typecheck commands                                                               |
| `README.md`                                      | modify | Add Testing subsection                                                                                      |
| `eslint.config.js`                               | modify | Add ignore pattern for `tests/` (don't lint test helpers strictly) — only if needed after Task 2            |

---

## Pre-flight

- [ ] **Confirm we're on main and clean**

```bash
cd /Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm
git status
git log --oneline -3
```

Expected: clean working tree, top commit is `9d3fb8d docs: add test infra + smoke tests design spec` (or later if any follow-ups landed).

- [ ] **Confirm gates still green from sub-project #1**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run format:check > /dev/null && echo "format ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
```

If any fail, stop and investigate before proceeding — the test infra builds on top of these.

---

## Task 1: Install Vitest + minimal config

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Install Vitest and coverage provider**

```bash
npm install --save-dev vitest@^3 @vitest/coverage-v8@^3
```

Expected: both packages added to `devDependencies`.

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'dist-ssr', 'api/dist', '.husky', 'docs', '.vercel'],
    setupFiles: ['./tests/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

`clearMocks: true` resets `vi.fn().mock.calls` between tests; `restoreMocks: true` restores spied originals after each test. Both prevent leaks across test files.

- [ ] **Step 3: Create `tests/setup.ts`**

```typescript
import { afterEach, beforeAll } from 'vitest';

beforeAll(() => {
  // Default for tests; individual cases can override before importing modules under test.
  process.env.NODE_ENV = 'test';
});

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore env between tests so one test's setEnv() can't leak into the next.
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (process.env[key] !== value) {
      process.env[key] = value;
    }
  }
});
```

- [ ] **Step 4: Add scripts to `package.json`**

In the `scripts` block, after `typecheck:api`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
```

- [ ] **Step 5: Verify Vitest runs**

```bash
npm test 2>&1 | tail -10
```

Expected: Vitest runs and reports "No test files found, exiting with code 0" or similar (acceptable — no tests yet). It must NOT crash on config errors.

If "No test files" causes a non-zero exit on this Vitest version, add `passWithNoTests: true` to `vitest.config.ts` test block. Re-run.

- [ ] **Step 6: Verify other gates still pass**

```bash
npm run lint > /dev/null && npm run format:check > /dev/null && npm run typecheck > /dev/null && echo "all ok"
```

Expected: `all ok`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts
git commit -m "$(cat <<'EOF'
chore: install vitest + minimal config

Add Vitest v3 and @vitest/coverage-v8 with a single node-environment
config and a setup file that snapshots/restores process.env between
tests. Co-located *.test.ts files under root and api/ are matched.

Sub-project #2, step 1/9.
EOF
)"
```

---

## Task 2: Test helpers and mocks

**Files:**

- Create: `tests/mocks/pg.ts`
- Create: `tests/mocks/gemini.ts`
- Create: `tests/mocks/openai.ts`
- Create: `tests/helpers/env.ts`

- [ ] **Step 1: Create `tests/mocks/pg.ts`**

```typescript
import { vi } from 'vitest';

/**
 * MockPool is a minimal stand-in for pg.Pool used in tests.
 * Tests configure `query` per case via `pool.query.mockResolvedValueOnce(...)`.
 */
export class MockPool {
  query = vi.fn();
  on = vi.fn();
  connect = vi.fn().mockResolvedValue({
    query: vi.fn(),
    release: vi.fn(),
  });
  end = vi.fn().mockResolvedValue(undefined);
}

/**
 * Call this at the top of any test file that imports a module which loads pg.
 * Vitest hoists vi.mock above imports, so this MUST be inside the calling
 * test file (not re-exported helpers, due to hoisting semantics).
 *
 * Usage:
 *   vi.mock('pg', () => import('../../tests/mocks/pg').then((m) => m.makePgMock()));
 *
 * Or simpler: use the inline pattern shown in tests/helpers/env.ts.
 */
export function makePgMock() {
  const pool = new MockPool();
  return {
    default: { Pool: vi.fn(() => pool) },
    Pool: vi.fn(() => pool),
    __pool: pool, // expose for assertions
  };
}
```

- [ ] **Step 2: Create `tests/mocks/gemini.ts`**

```typescript
import { vi } from 'vitest';

/**
 * Mock for `@google/generative-ai` (used by leadScoringService.ts).
 *
 * Usage at top of a test file:
 *   vi.mock('@google/generative-ai', () => import('../../tests/mocks/gemini').then((m) => m.makeGenAiMock()));
 *
 * Then in your test:
 *   import { __generateContent } from './your-module-under-test';
 *   __generateContent.mockResolvedValueOnce({ response: { text: () => '{"score":80,...}' } });
 */
export function makeGenAiMock() {
  const generateContent = vi.fn();
  const getGenerativeModel = vi.fn(() => ({ generateContent }));
  return {
    GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel })),
    __generateContent: generateContent,
  };
}

/**
 * Mock for `@google/genai` (used by api/src/routes/gemini.ts and excelImport.ts).
 * Different SDK from @google/generative-ai despite the similar name.
 */
export function makeGenAi2Mock() {
  const generateContent = vi.fn();
  return {
    GoogleGenAI: vi.fn(() => ({
      models: { generateContent },
    })),
    Type: {
      OBJECT: 'object',
      STRING: 'string',
      NUMBER: 'number',
      ARRAY: 'array',
    },
    __generateContent: generateContent,
  };
}
```

- [ ] **Step 3: Create `tests/mocks/openai.ts`**

```typescript
import { vi } from 'vitest';

/**
 * Mock for `openai` SDK (used by api/src/routes/gpt.ts).
 *
 * Usage at top of a test file:
 *   vi.mock('openai', () => import('../../tests/mocks/openai').then((m) => m.makeOpenaiMock()));
 */
export function makeOpenaiMock() {
  const create = vi.fn();
  const OpenAI = vi.fn(() => ({
    chat: { completions: { create } },
  }));
  return {
    default: OpenAI,
    __create: create,
  };
}
```

- [ ] **Step 4: Create `tests/helpers/env.ts`**

```typescript
import { vi } from 'vitest';

/**
 * Minimum complete env set for env.ts to parse successfully.
 * Tests that exercise the schema can spread this and override fields.
 */
export const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_NAME: 'test_db',
  DB_USER: 'test_user',
  DB_PASSWORD: 'test_password',
  GEMINI_API_KEY: 'test-gemini-key',
  OPENAI_API_KEY: 'test-openai-key',
  EMAIL_HOST: 'smtp.example.com',
  EMAIL_HOST_USER: 'tester@example.com',
  EMAIL_HOST_PASSWORD: 'password',
  DEFAULT_FROM_EMAIL: 'from@example.com',
};

/**
 * Set process.env to exactly the provided values (clears unset keys among VALID_ENV first).
 * Pair with the global afterEach in tests/setup.ts which restores original env.
 */
export function setEnv(values: Record<string, string | undefined>): void {
  for (const key of Object.keys(VALID_ENV)) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * dotenv mock factory. Use as:
 *   vi.mock('dotenv', () => makeDotenvMock());
 * Place at top of test files that import api/src/config/env.ts.
 */
export function makeDotenvMock() {
  return {
    default: { config: vi.fn() },
    config: vi.fn(),
  };
}
```

- [ ] **Step 5: Verify everything still parses**

```bash
npm run typecheck > /dev/null && echo "typecheck ok"
npm test 2>&1 | tail -3
```

Expected: typecheck passes, `npm test` reports no test files (still acceptable).

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "$(cat <<'EOF'
chore(tests): add mocks and helpers

Reusable mocks for pg.Pool, @google/generative-ai, @google/genai,
openai, and an env helper with a known-good VALID_ENV constant.
makeDotenvMock() prevents env.ts from re-reading the real .env during
schema tests.

Sub-project #2, step 2/9.
EOF
)"
```

---

## Task 3: Test `api/src/utils/eventScoring.ts`

**Files:**

- Create: `api/src/utils/eventScoring.test.ts`

**Behavior under test (read the source first):** `eventScoring.ts` exports two functions:

- `calculateEventScore(eventName, eventData, editions, relatedContacts, criteria?)` returns `EventScore { totalScore, historyScore, regionScore, contactScore, delegatesScore, notes, problems }`. Total is 0–100; each component 0–25.
- `formatEventHistory(editions)` returns a `;`-joined human-readable history string.

Internal helpers (`isValidEmail`, `isValidPhone`, `calculateHistoryScore`, etc.) are NOT exported — test them indirectly via `calculateEventScore`.

- [ ] **Step 1: Write the test file**

```typescript
// api/src/utils/eventScoring.test.ts
import { describe, expect, it } from 'vitest';
import { calculateEventScore, formatEventHistory } from './eventScoring';

describe('calculateEventScore', () => {
  describe('history score', () => {
    it('returns 25 when at least one edition is in Vietnam', () => {
      const result = calculateEventScore('Generic Event', {}, [{ COUNTRY: 'Vietnam' }]);
      expect(result.historyScore).toBe(25);
    });

    it('returns 25 when COUNTRY uses lowercase or VN code', () => {
      const a = calculateEventScore('X', {}, [{ country: 'vietnam' }]);
      const b = calculateEventScore('X', {}, [{ COUNTRY: 'VN' }]);
      expect(a.historyScore).toBe(25);
      expect(b.historyScore).toBe(25);
    });

    it('returns 15 when an edition is in another SEA country', () => {
      const result = calculateEventScore('X', {}, [{ COUNTRY: 'Thailand' }]);
      expect(result.historyScore).toBe(15);
    });

    it('returns 0 with no editions', () => {
      const result = calculateEventScore('X', {}, []);
      expect(result.historyScore).toBe(0);
    });

    it('returns 0 with editions but no SEA countries', () => {
      const result = calculateEventScore('X', {}, [{ COUNTRY: 'Germany' }]);
      expect(result.historyScore).toBe(0);
    });
  });

  describe('region score', () => {
    it('returns 25 when name contains a regional keyword', () => {
      for (const name of [
        'ASEAN Summit',
        'Asia Forum',
        'Pacific Conference',
        'APAC Expo',
        'Eastern Trade',
      ]) {
        expect(calculateEventScore(name, {}, []).regionScore).toBe(25);
      }
    });

    it('returns 15 when an edition is in an Asian country (no regional keyword in name)', () => {
      const result = calculateEventScore('Generic Conference', {}, [{ COUNTRY: 'Japan' }]);
      expect(result.regionScore).toBe(15);
    });

    it('does not false-positive United Kingdom into "kingdom"-like Asian match', () => {
      const result = calculateEventScore('Trade Show', {}, [{ COUNTRY: 'United Kingdom' }]);
      expect(result.regionScore).toBe(0);
    });
  });

  describe('contact score', () => {
    it('returns 25 when both email and phone are valid', () => {
      const result = calculateEventScore(
        'X',
        { keyPersonEmail: 'a@b.com', keyPersonPhone: '+84 901 234 567' },
        [],
      );
      expect(result.contactScore).toBe(25);
    });

    it('returns 15 when only valid email is present', () => {
      const result = calculateEventScore('X', { Email: 'a@b.com' }, []);
      expect(result.contactScore).toBe(15);
    });

    it('returns 0 with invalid email and no other contact fields', () => {
      const result = calculateEventScore('X', { Email: 'not-an-email' }, []);
      expect(result.contactScore).toBe(0);
    });

    it('falls back to relatedContacts when eventData is sparse', () => {
      const result = calculateEventScore('X', {}, [], [{ Email: 'rep@firm.com' }]);
      expect(result.contactScore).toBe(15);
    });
  });

  describe('delegates score', () => {
    it('returns 25 for editions averaging 500+ delegates', () => {
      const result = calculateEventScore('X', {}, [{ TOTATTEND: 600 }, { TOTATTEND: 700 }]);
      expect(result.delegatesScore).toBe(25);
    });

    it('returns 0 when no edition has a delegate field', () => {
      const result = calculateEventScore('X', {}, [{ Year: 2024 }]);
      expect(result.delegatesScore).toBe(0);
    });
  });

  describe('totals and metadata', () => {
    it('returns totalScore as the sum of components', () => {
      const result = calculateEventScore(
        'Asia Conference',
        { keyPersonEmail: 'a@b.com', keyPersonPhone: '+84 901 234 567' },
        [{ COUNTRY: 'Vietnam', TOTATTEND: 600 }],
      );
      // history 25 + region 25 + contact 25 + delegates 25 = 100
      expect(result.totalScore).toBe(100);
    });

    it('records "Missing contact information" problem when contactScore is 0', () => {
      const result = calculateEventScore('X', {}, []);
      expect(result.problems).toContain('Missing contact information');
    });

    it('respects criteria flags (turning off region zeroes regionScore)', () => {
      const result = calculateEventScore('Asia Conference', {}, [], [], {
        region: false,
        history: false,
        contact: false,
        delegates: false,
      });
      expect(result.regionScore).toBe(0);
      expect(result.totalScore).toBe(0);
    });
  });
});

describe('formatEventHistory', () => {
  it('returns "" for empty or missing editions', () => {
    expect(formatEventHistory([])).toBe('');
    expect(formatEventHistory(undefined as unknown as any[])).toBe('');
  });

  it('joins year, city, country, and delegate count', () => {
    const out = formatEventHistory([
      { Year: '2023', City: 'Hanoi', Country: 'Vietnam', TOTATTEND: '500' },
    ]);
    expect(out).toBe('2023: Hanoi, Vietnam (500 delegates)');
  });

  it('joins multiple editions with "; "', () => {
    const out = formatEventHistory([
      { Year: '2022', Country: 'Thailand' },
      { Year: '2023', Country: 'Vietnam' },
    ]);
    expect(out).toBe('2022: Thailand; 2023: Vietnam');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- api/src/utils/eventScoring.test.ts
```

Expected: ~15 cases pass. If any fail, the failure documents real current behavior — investigate to determine whether the expectation in the test was wrong, or whether a real bug exists. If a real bug, leave the test as-is (FAILING) and write a follow-up issue/note rather than masking the bug.

If a real bug is detected: stop, surface to user, do not mark this commit as complete until decided.

- [ ] **Step 3: Commit**

```bash
git add api/src/utils/eventScoring.test.ts
git commit -m "$(cat <<'EOF'
test: eventScoring.ts (api utilities)

15 cases covering history/region/contact/delegates score components,
total score sum, problem messages, criteria flag respect, and
formatEventHistory. All tests are pure — no mocks needed.

Sub-project #2, step 3/9.
EOF
)"
```

---

## Task 4: Test `api/src/utils/dataQuality.ts`

**Files:**

- Create: `api/src/utils/dataQuality.test.ts`

**Exports under test:** `detectDataIssues(orgData, orgName)`, `calculateDataQualityScore(orgData, issues)`, `extractOrganizationName(row)`, `extractEventName(row)`.

- [ ] **Step 1: Write the test file**

```typescript
// api/src/utils/dataQuality.test.ts
import { describe, expect, it } from 'vitest';
import {
  detectDataIssues,
  calculateDataQualityScore,
  extractOrganizationName,
  extractEventName,
} from './dataQuality';

describe('detectDataIssues', () => {
  it('flags missing organization name as critical', () => {
    const issues = detectDataIssues({}, '');
    expect(issues.find((i) => i.field === 'name')?.severity).toBe('critical');
  });

  it('flags single critical "Missing all contact information" when no email/phone/name', () => {
    const issues = detectDataIssues({}, 'Acme Corp');
    expect(
      issues.some(
        (i) => i.severity === 'critical' && i.message.includes('Missing all contact information'),
      ),
    ).toBe(true);
  });

  it('flags missing email as critical when other contact fields exist', () => {
    const issues = detectDataIssues({ keyPersonName: 'Lan', keyPersonPhone: '0901234567' }, 'Acme');
    const emailIssue = issues.find((i) => i.field === 'email');
    expect(emailIssue?.severity).toBe('critical');
  });

  it('flags missing location as critical when both country and city absent', () => {
    const issues = detectDataIssues({ keyPersonEmail: 'a@b.com' }, 'Acme');
    expect(issues.find((i) => i.field === 'location')?.severity).toBe('critical');
  });

  it('returns no issues for the (rare) fully-populated org', () => {
    const issues = detectDataIssues(
      {
        keyPersonName: 'Lan',
        keyPersonEmail: 'a@b.com',
        keyPersonPhone: '0901234567',
        country: 'Vietnam',
        city: 'Hanoi',
        industry: 'MICE',
        website: 'https://example.com',
        numberOfDelegates: 200,
        totalEvents: 5,
      },
      'Acme Corp',
    );
    expect(issues).toEqual([]);
  });
});

describe('calculateDataQualityScore', () => {
  it('returns 100 for empty issues + bonuses applied', () => {
    const orgData = {
      keyPersonName: 'Lan',
      keyPersonEmail: 'a@b.com',
      keyPersonPhone: '0901234567',
      country: 'Vietnam',
      city: 'Hanoi',
      website: 'https://example.com',
    };
    // Bonuses: contact (5) + location (5) + website (3) but capped at 100
    expect(calculateDataQualityScore(orgData, [])).toBe(100);
  });

  it('penalizes critical issues by 15 each', () => {
    const issues = [
      { severity: 'critical' as const, field: 'name', message: '' },
      { severity: 'critical' as const, field: 'contact', message: '' },
    ];
    const score = calculateDataQualityScore({}, issues);
    expect(score).toBe(70); // 100 - 15 - 15
  });

  it('penalizes warning by 5 and info by 2', () => {
    const issues = [
      { severity: 'warning' as const, field: 'phone', message: '' },
      { severity: 'info' as const, field: 'delegates', message: '' },
    ];
    expect(calculateDataQualityScore({}, issues)).toBe(93); // 100 - 5 - 2
  });

  it('clamps score to [0, 100]', () => {
    const tenCritical = Array.from({ length: 10 }, () => ({
      severity: 'critical' as const,
      field: 'x',
      message: '',
    }));
    expect(calculateDataQualityScore({}, tenCritical)).toBe(0);
  });
});

describe('extractOrganizationName', () => {
  it('prefers ORGNAME', () => {
    expect(extractOrganizationName({ ORGNAME: 'Acme Corp', Name: 'Other' })).toBe('Acme Corp');
  });

  it('falls back to Company Name when ORGNAME absent', () => {
    expect(extractOrganizationName({ 'Company Name': 'Beta Inc' })).toBe('Beta Inc');
  });

  it('returns null when nothing meaningful is present', () => {
    expect(extractOrganizationName({ id: 1, _sheet: 'data' })).toBe(null);
  });
});

describe('extractEventName', () => {
  it('prefers SeriesName (ICCA editions sheet grouping key)', () => {
    expect(
      extractEventName({ SeriesName: 'World Conference', 'Event Name': 'Should be ignored' }),
    ).toBe('World Conference');
  });

  it('falls back to Event Name', () => {
    expect(extractEventName({ 'Event Name': 'Local Summit' })).toBe('Local Summit');
  });

  it('skips edition-specific fields like ECODE in fallback search', () => {
    expect(extractEventName({ ECODE: 'XYZ-2023' })).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- api/src/utils/dataQuality.test.ts
```

Expected: 12 cases pass. If `detectDataIssues` returns issues for the "fully-populated" case, the test in step 1 (last case in describe block) needs adjustment to reflect actual behavior — the source treats `industry`, `delegates`, `events` as expected fields, so providing them all should produce zero issues. If the source still emits an info issue for one of them, update the assertion to allow that specific info-level entry.

- [ ] **Step 3: Commit**

```bash
git add api/src/utils/dataQuality.test.ts
git commit -m "$(cat <<'EOF'
test: dataQuality.ts (api utilities)

12 cases covering issue severity classification, score arithmetic and
clamping, organization name priority (ORGNAME > Company Name > fallback),
and event name priority (SeriesName for ICCA editions grouping).

Sub-project #2, step 4/9.
EOF
)"
```

---

## Task 5: Test `views/IntelligentDataView/scoringUtils.ts`

**Files:**

- Create: `views/IntelligentDataView/scoringUtils.test.ts`

**Exports under test:** `calculateHistoryScore`, `calculateRegionScore`, `isValidEmail`, `isValidPhone`, `calculateContactScore`, `calculateDelegatesScore`, `formatEventHistory`.

**Important:** `calculateDelegatesScore` here is the FRONTEND version with the Ariyana sweet-spot model (200–800 → 25), which differs from the api version. Lock in the actual current behavior.

- [ ] **Step 1: Write the test file**

```typescript
// views/IntelligentDataView/scoringUtils.test.ts
import { describe, expect, it } from 'vitest';
import {
  calculateHistoryScore,
  calculateRegionScore,
  calculateContactScore,
  calculateDelegatesScore,
  isValidEmail,
  isValidPhone,
  formatEventHistory,
} from './scoringUtils';

describe('isValidEmail', () => {
  it('accepts well-formed emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects empty and malformed', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts a Vietnamese phone with formatting', () => {
    expect(isValidPhone('+84 (901) 234-567')).toBe(true);
  });

  it('rejects strings with fewer than 7 digits', () => {
    expect(isValidPhone('123')).toBe(false);
  });

  it('rejects strings containing letters', () => {
    expect(isValidPhone('+84-call-me')).toBe(false);
  });
});

describe('calculateHistoryScore', () => {
  it('returns 25 when an edition city contains "hanoi"', () => {
    expect(calculateHistoryScore([{ CITY: 'Hanoi' }])).toBe(25);
  });

  it('returns 15 for SEA-but-not-Vietnam', () => {
    expect(calculateHistoryScore([{ COUNTRY: 'Thailand' }])).toBe(15);
  });
});

describe('calculateRegionScore', () => {
  it('returns 25 when the event name contains "Asia"', () => {
    expect(calculateRegionScore('Asia Pacific Forum', [])).toBe(25);
  });

  it('returns 15 when an edition is in Japan', () => {
    expect(calculateRegionScore('Trade Show', [{ COUNTRY: 'Japan' }])).toBe(15);
  });
});

describe('calculateContactScore', () => {
  it('returns 25 with both email and phone valid in eventData', () => {
    expect(calculateContactScore({ Email: 'a@b.com', Phone: '0901234567' }, [])).toBe(25);
  });

  it('returns 0 when neither eventData nor relatedContacts have valid contact info', () => {
    expect(calculateContactScore({}, [])).toBe(0);
  });
});

describe('calculateDelegatesScore (frontend Ariyana sweet-spot)', () => {
  it('returns 25 for average in [200, 800] (Ariyana sweet spot)', () => {
    expect(calculateDelegatesScore([{ TOTATTEND: 250 }, { TOTATTEND: 350 }])).toBe(25);
  });

  it('returns 20 for the wider acceptable band (150-200 or 800-1000)', () => {
    expect(calculateDelegatesScore([{ TOTATTEND: 175 }])).toBe(20);
    expect(calculateDelegatesScore([{ TOTATTEND: 900 }])).toBe(20);
  });

  it('returns 0 for very small (<100) or very large (>1500) events', () => {
    expect(calculateDelegatesScore([{ TOTATTEND: 50 }])).toBe(0);
    expect(calculateDelegatesScore([{ TOTATTEND: 2000 }])).toBe(0);
  });
});

describe('formatEventHistory', () => {
  it('appends "DISTINCT COUNTRIES" summary', () => {
    const out = formatEventHistory([
      { Year: '2022', Country: 'Thailand' },
      { Year: '2023', Country: 'Vietnam' },
    ]);
    expect(out).toMatch(/DISTINCT COUNTRIES: 2 \(/);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- views/IntelligentDataView/scoringUtils.test.ts
```

Expected: ~10 cases pass.

- [ ] **Step 3: Commit**

```bash
git add views/IntelligentDataView/scoringUtils.test.ts
git commit -m "$(cat <<'EOF'
test: scoringUtils.ts (frontend scoring)

10 cases on the 7 frontend exports. Locks in the Ariyana sweet-spot
delegates score model (200-800 → 25, etc.) which differs from the api
eventScoring.ts model and is a known divergence flagged in
STRICT_DEBT.md for sub-project #5 consolidation.

Sub-project #2, step 5/9.
EOF
)"
```

---

## Task 6: Test `api/src/config/env.ts`

**Files:**

- Create: `api/src/config/env.test.ts`

**Special handling:** `env.ts` calls `process.exit(1)` on schema failure at module load. Tests must (a) mock `dotenv` so the file does not re-read the real `.env` and (b) spy on `process.exit` so the test runner does not die. Each case calls `vi.resetModules()` so the dynamic `import()` re-evaluates the module against the freshly-set env.

- [ ] **Step 1: Write the test file**

```typescript
// api/src/config/env.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

describe('env schema', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    exitSpy = vi
      .spyOn(process, 'exit')
      // Throw instead of exiting so we can assert on it.
      .mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit:${code}`);
      });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('parses successfully with all required fields', async () => {
    setEnv(VALID_ENV);
    const mod = await import('./env');
    expect(mod.env.DB_HOST).toBe('localhost');
    expect(mod.env.GEMINI_API_KEY).toBe('test-gemini-key');
  });

  it('coerces numeric strings to numbers and applies defaults', async () => {
    setEnv({ ...VALID_ENV, DB_PORT: '6543' });
    const mod = await import('./env');
    expect(mod.env.DB_PORT).toBe(6543);
    expect(mod.env.PORT).toBe(3001); // default
    expect(mod.env.VERTEX_AI_LOCATION).toBe('europe-west4'); // default
    expect(mod.env.VERTEX_AI_MODEL).toBe('gemini-2.5-pro'); // default
  });

  it('exits with 1 when a required field is missing', async () => {
    const env = { ...VALID_ENV };
    delete (env as any).DB_HOST;
    setEnv(env);
    await expect(import('./env')).rejects.toThrow('process.exit:1');
    expect(errSpy).toHaveBeenCalled();
  });

  it('exits when EMAIL_HOST_USER is not a valid email', async () => {
    setEnv({ ...VALID_ENV, EMAIL_HOST_USER: 'not-an-email' });
    await expect(import('./env')).rejects.toThrow('process.exit:1');
  });

  it('exits when NODE_ENV is outside the enum', async () => {
    setEnv({ ...VALID_ENV, NODE_ENV: 'staging' });
    await expect(import('./env')).rejects.toThrow('process.exit:1');
  });

  it('treats VERCEL/VERCEL_URL/Vertex AI keys as optional', async () => {
    setEnv(VALID_ENV); // none of those are set
    const mod = await import('./env');
    expect(mod.env.VERCEL).toBeUndefined();
    expect(mod.env.VERCEL_URL).toBeUndefined();
    expect(mod.env.VERTEX_AI_API_KEY).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- api/src/config/env.test.ts
```

Expected: 6 cases pass.

If the dynamic `import()` is cached across tests despite `vi.resetModules()`, switch to `await vi.importActual<typeof import('./env')>('./env')` or change the strategy to a fresh-vitest-process-per-case using `// @vitest-environment node` directive — should not be needed in practice on Vitest v3.

- [ ] **Step 3: Commit**

```bash
git add api/src/config/env.test.ts
git commit -m "$(cat <<'EOF'
test(config): env.ts zod schema

6 cases: full valid parse, numeric coercion + defaults, missing
required field → process.exit(1), invalid email format, NODE_ENV
enum violation, optional fields absent.

dotenv is mocked so env.ts does not re-read the real .env. process.exit
is spied to throw rather than killing the test runner.

Sub-project #2, step 6/9.
EOF
)"
```

---

## Task 7: Test `utils/leadUtils.ts` and `utils/leadEnrichUtils.ts`

**Files:**

- Create: `utils/leadUtils.test.ts`
- Create: `utils/leadEnrichUtils.test.ts`

- [ ] **Step 1: Write `utils/leadUtils.test.ts`**

```typescript
// utils/leadUtils.test.ts
import { describe, expect, it } from 'vitest';
import { mapLeadFromDB, mapLeadToDB } from './leadUtils';
import type { Lead } from '../types';

describe('mapLeadFromDB', () => {
  it('maps snake_case DB row to camelCase Lead', () => {
    const lead = mapLeadFromDB({
      id: 'l1',
      company_name: 'Acme',
      industry: 'MICE',
      country: 'Vietnam',
      city: 'Hanoi',
      website: 'https://acme.example',
      key_person_name: 'Lan',
      key_person_title: 'Director',
      key_person_email: 'lan@acme.example',
      key_person_phone: '0901234567',
      total_events: 3,
      vietnam_events: 1,
      status: 'New',
    });
    expect(lead.companyName).toBe('Acme');
    expect(lead.keyPersonEmail).toBe('lan@acme.example');
    expect(lead.totalEvents).toBe(3);
    expect(lead.vietnamEvents).toBe(1);
  });

  it('falls back to camelCase keys when snake_case absent', () => {
    const lead = mapLeadFromDB({
      id: 'l2',
      companyName: 'Beta',
      industry: 'Tech',
      country: 'Singapore',
      city: 'SG',
      keyPersonName: 'Tom',
      status: 'Contacted',
    });
    expect(lead.companyName).toBe('Beta');
    expect(lead.keyPersonName).toBe('Tom');
  });

  it('defaults missing fields to empty string or 0', () => {
    const lead = mapLeadFromDB({
      id: 'l3',
      industry: 'X',
      country: 'Y',
      city: 'Z',
      status: 'New',
    });
    expect(lead.website).toBe('');
    expect(lead.totalEvents).toBe(0);
  });
});

describe('mapLeadToDB round-trip', () => {
  it('preserves identity when piping through both directions', () => {
    const dbRow = {
      id: 'l1',
      company_name: 'Acme',
      industry: 'MICE',
      country: 'Vietnam',
      city: 'Hanoi',
      website: 'https://acme.example',
      key_person_name: 'Lan',
      key_person_title: 'Director',
      key_person_email: 'lan@acme.example',
      key_person_phone: '0901234567',
      key_person_linkedin: 'https://linkedin.com/in/lan',
      total_events: 3,
      vietnam_events: 1,
      notes: 'hot lead',
      status: 'New' as const,
    };
    const camelLead: Lead = mapLeadFromDB(dbRow);
    const back = mapLeadToDB(camelLead);
    // Each snake_case key should re-appear with the same logical value
    expect(back.company_name).toBe(dbRow.company_name);
    expect(back.key_person_email).toBe(dbRow.key_person_email);
    expect(back.total_events).toBe(dbRow.total_events);
  });
});
```

- [ ] **Step 2: Write `utils/leadEnrichUtils.test.ts`**

```typescript
// utils/leadEnrichUtils.test.ts
import { describe, expect, it } from 'vitest';
import { isLeadMissingPersonInfo, parseEnrichResponse } from './leadEnrichUtils';
import type { Lead } from '../types';

const baseLead = {
  id: 'l1',
  companyName: 'Acme',
  industry: 'MICE',
  country: 'Vietnam',
  city: 'Hanoi',
  website: '',
  keyPersonName: 'Lan',
  keyPersonTitle: '',
  keyPersonEmail: 'lan@acme.example',
  keyPersonPhone: '+84 901 234 567',
  keyPersonLinkedIn: '',
  totalEvents: 0,
  vietnamEvents: 0,
  notes: '',
  status: 'New' as const,
} satisfies Lead;

describe('isLeadMissingPersonInfo', () => {
  it('returns false when name + non-generic email + phone all present', () => {
    expect(isLeadMissingPersonInfo(baseLead)).toBe(false);
  });

  it('returns true when email is generic (info@)', () => {
    expect(isLeadMissingPersonInfo({ ...baseLead, keyPersonEmail: 'info@acme.example' })).toBe(
      true,
    );
  });

  it('returns true when phone is empty whitespace', () => {
    expect(isLeadMissingPersonInfo({ ...baseLead, keyPersonPhone: '   ' })).toBe(true);
  });

  it('returns true when name is missing', () => {
    expect(isLeadMissingPersonInfo({ ...baseLead, keyPersonName: '' })).toBe(true);
  });
});

describe('parseEnrichResponse', () => {
  it('extracts name, title, email, phone from a typical KEY PERSON CONTACT block', () => {
    const text = [
      '### **2. KEY PERSON CONTACT:**',
      '- **Name**: Kunchit Judprasong',
      '- **Title**: Conference Director',
      '- **Email**: kunchit@example.com',
      '- **Phone**: +66 2 123 4567',
    ].join('\n');
    const out = parseEnrichResponse(text);
    expect(out.keyPersonName).toBe('Kunchit Judprasong');
    expect(out.keyPersonEmail).toBe('kunchit@example.com');
    expect(out.keyPersonTitle).toBe('Conference Director');
    expect(out.keyPersonPhone).toBe('+66 2 123 4567');
  });

  it('rejects "Not Found" placeholder values', () => {
    const text = ['**KEY PERSON CONTACT:**', '- Name: Not Found', '- Email: Not Found'].join('\n');
    const out = parseEnrichResponse(text);
    expect(out.keyPersonName).toBeUndefined();
    expect(out.keyPersonEmail).toBeUndefined();
  });

  it('rejects an email value missing "@"', () => {
    const text = '**KEY PERSON CONTACT:**\n- Email: contactus';
    expect(parseEnrichResponse(text).keyPersonEmail).toBeUndefined();
  });

  it('returns empty object for empty or non-string input', () => {
    expect(parseEnrichResponse('')).toEqual({});
    expect(parseEnrichResponse(undefined as unknown as string)).toEqual({});
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- utils/leadUtils.test.ts utils/leadEnrichUtils.test.ts
```

Expected: 8 cases pass total (4 + 4).

- [ ] **Step 4: Commit**

```bash
git add utils/leadUtils.test.ts utils/leadEnrichUtils.test.ts
git commit -m "$(cat <<'EOF'
test: leadUtils + leadEnrichUtils (frontend utilities)

leadUtils: snake_case ↔ camelCase mapping and round-trip identity.
leadEnrichUtils: generic-email rejection, AI-response parsing for
multiple markdown styles, "Not Found" placeholder handling.

Sub-project #2, step 7/9.
EOF
)"
```

---

## Task 8: Service tests (`leadScoringService` + `reportStatsService`)

**Files:**

- Create: `api/src/services/leadScoringService.test.ts`
- Create: `api/src/services/reportStatsService.test.ts`

These services touch the Gemini SDK and the model layer (which in turn touches pg). Mock everything at the module boundary.

- [ ] **Step 1: Write `leadScoringService.test.ts`**

```typescript
// api/src/services/leadScoringService.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

// Mock the Gemini SDK BEFORE importing the service.
const generateContent = vi.fn();
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({ generateContent })),
  })),
}));

// Mock the data models the service consumes.
vi.mock('../models/LeadModel.js', () => ({
  LeadModel: {
    getById: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('../models/EmailLogModel.js', () => ({
  EmailLogModel: { getByLeadId: vi.fn() },
}));
vi.mock('../models/EmailReplyModel.js', () => ({
  EmailReplyModel: { getByLeadId: vi.fn() },
}));

// Required so env.ts schema parses at import time (service imports env).
beforeEach(() => {
  setEnv(VALID_ENV);
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LeadScoringService.calculateLeadScore', () => {
  it('returns parsed score and clamps it to [0, 100]', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { LeadScoringService } = await import('./leadScoringService');

    (LeadModel.getById as any).mockResolvedValue({
      id: 'l1',
      company_name: 'Acme',
      industry: 'MICE',
      country: 'Vietnam',
      key_person_name: 'Lan',
      status: 'New',
    });
    (EmailLogModel.getByLeadId as any).mockResolvedValue([]);
    (EmailReplyModel.getByLeadId as any).mockResolvedValue([]);

    generateContent.mockResolvedValue({
      response: {
        text: () =>
          '{"score": 120, "factors": {"emailEngagement": 25, "eventHistory": 25, "contactQuality": 25, "companySize": 25}, "reasoning": "ok"}',
      },
    });

    const result = await LeadScoringService.calculateLeadScore('l1');
    expect(result.score).toBe(100); // clamped from 120
    expect(result.factors.emailEngagement).toBe(25);
  });

  it('throws "Lead not found" when LeadModel.getById returns null', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { LeadScoringService } = await import('./leadScoringService');
    (LeadModel.getById as any).mockResolvedValue(null);
    await expect(LeadScoringService.calculateLeadScore('missing')).rejects.toThrow(
      'Lead not found',
    );
  });

  it('throws "Failed to calculate lead score" on malformed AI JSON', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { LeadScoringService } = await import('./leadScoringService');

    (LeadModel.getById as any).mockResolvedValue({
      id: 'l1',
      company_name: 'X',
      industry: 'Y',
      country: 'Z',
      key_person_name: 'P',
      status: 'New',
    });
    (EmailLogModel.getByLeadId as any).mockResolvedValue([]);
    (EmailReplyModel.getByLeadId as any).mockResolvedValue([]);

    generateContent.mockResolvedValue({
      response: { text: () => 'not json at all' },
    });

    await expect(LeadScoringService.calculateLeadScore('l1')).rejects.toThrow(
      'Failed to calculate lead score',
    );
  });

  it('sends a prompt that mentions the lead company name', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { LeadScoringService } = await import('./leadScoringService');

    (LeadModel.getById as any).mockResolvedValue({
      id: 'l1',
      company_name: 'Acme Corp',
      industry: 'MICE',
      country: 'Vietnam',
      key_person_name: 'Lan',
      status: 'New',
    });
    (EmailLogModel.getByLeadId as any).mockResolvedValue([]);
    (EmailReplyModel.getByLeadId as any).mockResolvedValue([]);
    generateContent.mockResolvedValue({
      response: {
        text: () =>
          '{"score": 50, "factors": {"emailEngagement": 5, "eventHistory": 0, "contactQuality": 20, "companySize": 25}, "reasoning": "x"}',
      },
    });

    await LeadScoringService.calculateLeadScore('l1');
    const promptArg = generateContent.mock.calls[0]?.[0] as string;
    expect(promptArg).toContain('Acme Corp');
    expect(promptArg).toContain('MICE');
  });
});

describe('LeadScoringService.getScoreDistribution', () => {
  it('classifies leads by lead_score thresholds', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { LeadScoringService } = await import('./leadScoringService');
    (LeadModel.getAll as any).mockResolvedValue([
      { lead_score: 90 }, // high
      { lead_score: 50 }, // medium
      { lead_score: 20 }, // low
      { lead_score: null }, // unscored
      { lead_score: undefined }, // unscored
    ]);

    const dist = await LeadScoringService.getScoreDistribution();
    expect(dist).toEqual({ high: 1, medium: 1, low: 1, unscored: 2 });
  });
});
```

- [ ] **Step 2: Write `reportStatsService.test.ts`**

```typescript
// api/src/services/reportStatsService.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  default: { query: vi.fn() },
}));
vi.mock('../models/LeadModel.js', () => ({
  LeadModel: { getAll: vi.fn() },
}));
vi.mock('../models/EmailLogModel.js', () => ({
  EmailLogModel: { getAll: vi.fn() },
}));
vi.mock('../models/EmailReplyModel.js', () => ({
  EmailReplyModel: { getAll: vi.fn() },
}));

beforeEach(() => {
  setEnv(VALID_ENV);
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ReportStatsService.getPeriodBoundaries', () => {
  it('produces a daily window covering the same date 00:00..23:59', async () => {
    const { ReportStatsService } = await import('./reportStatsService');
    const ref = new Date('2026-03-15T10:30:00Z');
    const { start, end } = ReportStatsService.getPeriodBoundaries('daily', ref);
    expect(start.toDateString()).toBe(end.toDateString());
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);
  });

  it('weekly starts on Monday and ends on Sunday', async () => {
    const { ReportStatsService } = await import('./reportStatsService');
    const wednesday = new Date('2026-03-18T10:00:00'); // local date Wed
    const { start, end } = ReportStatsService.getPeriodBoundaries('weekly', wednesday);
    expect(start.getDay()).toBe(1); // Monday
    expect(end.getDay()).toBe(0); // Sunday
  });

  it('monthly spans 1st to last day of month', async () => {
    const { ReportStatsService } = await import('./reportStatsService');
    const ref = new Date('2026-02-15T10:00:00');
    const { start, end } = ReportStatsService.getPeriodBoundaries('monthly', ref);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(28); // Feb 2026 has 28 days
  });
});

describe('ReportStatsService.generateStats', () => {
  it('counts leads by status and returns top leads sorted by score', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { ReportStatsService } = await import('./reportStatsService');

    (LeadModel.getAll as any).mockResolvedValue([
      {
        id: '1',
        company_name: 'Hi',
        country: 'VN',
        industry: 'X',
        status: 'New',
        lead_score: 90,
        created_at: '2026-03-15',
      },
      {
        id: '2',
        company_name: 'Lo',
        country: 'VN',
        industry: 'X',
        status: 'Contacted',
        lead_score: 30,
        created_at: '2026-03-14',
      },
      {
        id: '3',
        company_name: 'Mid',
        country: 'VN',
        industry: 'X',
        status: 'Qualified',
        lead_score: 60,
        created_at: '2026-03-13',
      },
    ]);
    (EmailLogModel.getAll as any).mockResolvedValue([]);
    (EmailReplyModel.getAll as any).mockResolvedValue([]);

    const stats = await ReportStatsService.generateStats(
      new Date('2026-03-13'),
      new Date('2026-03-15T23:59:59'),
      'daily',
      2,
    );
    expect(stats.leads.total).toBe(3);
    expect(stats.leads.byStatus['New']).toBe(1);
    expect(stats.leads.byStatus['Contacted']).toBe(1);
    expect(stats.topLeads.map((l) => l.id)).toEqual(['1', '3']); // top 2 by score
  });

  it('returns 0% replyRate when no emails have been sent', async () => {
    const { LeadModel } = await import('../models/LeadModel.js');
    const { EmailLogModel } = await import('../models/EmailLogModel.js');
    const { EmailReplyModel } = await import('../models/EmailReplyModel.js');
    const { ReportStatsService } = await import('./reportStatsService');
    (LeadModel.getAll as any).mockResolvedValue([]);
    (EmailLogModel.getAll as any).mockResolvedValue([]);
    (EmailReplyModel.getAll as any).mockResolvedValue([]);
    const stats = await ReportStatsService.generateStats(
      new Date('2026-03-01'),
      new Date('2026-03-31'),
      'monthly',
    );
    expect(stats.emails.replyRate).toBe(0);
    expect(stats.emails.sent).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- api/src/services/leadScoringService.test.ts api/src/services/reportStatsService.test.ts
```

Expected: ~10 cases pass.

If any case fails because the `vi.mock(...)` of a model returns wrongly-shaped data, inspect the actual model's exports and adjust the mock. The mocks declared above match the source code as observed.

- [ ] **Step 4: Commit**

```bash
git add api/src/services/leadScoringService.test.ts api/src/services/reportStatsService.test.ts
git commit -m "$(cat <<'EOF'
test: leadScoringService + reportStatsService (with mocks)

leadScoringService: 5 cases including score clamping at 100, missing
lead handling, malformed AI JSON, prompt content assertion, and score
distribution buckets — Gemini SDK and all data models mocked.

reportStatsService: 5 cases on getPeriodBoundaries (daily/weekly/
monthly) and generateStats (status counts, top leads by score, zero
replyRate when no emails) — all data models mocked.

No real DB or AI calls during these tests.

Sub-project #2, step 8/9.
EOF
)"
```

---

## Task 9: Wire pre-push hook + README update

**Files:**

- Modify: `.husky/pre-push`
- Modify: `README.md`

- [ ] **Step 1: Update `.husky/pre-push`**

Replace the file contents with:

```sh
echo "Running typecheck before push (compensates for missing CI)..."
npm run typecheck && npm run typecheck:api && npm test
```

- [ ] **Step 2: Verify the hook still passes locally**

```bash
.husky/pre-push 2>&1 | tail -20
```

Expected: typecheck → typecheck:api → vitest summary all pass. If `npm test` fails, stop here and resolve before committing.

- [ ] **Step 3: Update `README.md`**

In the "Daily development scripts" block, add the test commands. After the existing block:

````markdown
```bash
npm test                # Run all tests once
npm run test:watch      # Re-run tests on file changes
npm run test:coverage   # Run tests with coverage report
```
````

````

Then add a new subsection right before "Security Notes":

```markdown
### Testing conventions

- Co-located `*.test.ts` files next to the source they cover.
- Mock at the module boundary (`vi.mock('pg')`, `vi.mock('@google/generative-ai')`, etc.). Reusable mocks live in `tests/mocks/`; helpers in `tests/helpers/`.
- Tests must run with no real DB, no real AI provider calls, no real SMTP/IMAP. The pre-push hook runs `npm test` after typecheck — broken tests block push.
- Component tests (React Testing Library) are deferred until sub-project #4 splits the god files.
````

- [ ] **Step 4: Format and verify**

```bash
npm run format
npm run lint > /dev/null && echo "lint ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm test 2>&1 | tail -3
```

Expected: all clean; test summary shows ~60–70 cases passing.

- [ ] **Step 5: Commit**

```bash
git add .husky/pre-push README.md
git commit -m "$(cat <<'EOF'
chore: wire test gate into pre-push and document conventions

Pre-push now runs typecheck → typecheck:api → npm test in sequence.
Any failure blocks the push, completing the safety gate role of
sub-project #2.

README documents test commands and conventions: co-located *.test.ts,
mock at module boundary, no real I/O, component tests deferred to #4.

Sub-project #2, step 9/9. Closes the test infra baseline.
EOF
)"
```

---

## Final verification

- [ ] **Run all gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run format:check > /dev/null && echo "format ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm run build > /dev/null && echo "build ok"
npm test 2>&1 | tail -5
```

Expected: all gates pass; test summary shows ~60–70 cases, exits 0, completes in well under 10 seconds.

- [ ] **Verify no real I/O during tests**

Rename `.env` temporarily and run:

```bash
mv .env .env.bak
npm test 2>&1 | tail -10
mv .env.bak .env
```

Expected: tests still pass. If any test fails because env was missing, that test is doing real I/O in disguise — fix before this sub-project closes.

- [ ] **Push to remote**

```bash
git push origin main
```

The pre-push hook runs typecheck + typecheck:api + tests. Push succeeds only if all pass.

---

## Rollback notes

Each test commit (3–8) is isolated. If any introduces a flake, `git revert <sha>` removes it. Infrastructure commits (1, 2, 9) are config-only — trivially revertable.

---

## Out of scope (do not do here)

- Real DB integration tests — sub-project #5 or #7
- Component tests for god files — sub-project #4 (after split)
- Real AI provider calls — never (mock at boundary)
- E2E / browser tests — sub-project #9 if at all
- Coverage threshold enforcement — never (vanity metric)
- Additional test files beyond the 8 listed — out of scope; proposed in a follow-up if a regression surfaces in a different file
