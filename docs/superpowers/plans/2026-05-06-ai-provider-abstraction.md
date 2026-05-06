# AI Provider Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract prompts, SDK client wrappers, and shared helpers out of the two 1000-LOC route files (`api/src/routes/gpt.ts`, `api/src/routes/gemini.ts`) into a 3-layer service module under `api/src/services/ai/`, with zero behavior change and ~30–40 new test cases.

**Architecture:** Three layers. **Provider** (`services/ai/providers/`) wraps each SDK. **Prompt** (`services/ai/prompts/`) holds one module per business operation, exporting prompt builders + a parser. **Route handlers** become thin HTTP wrappers that wire request → prompt → provider → parse → response. Prompts are moved verbatim — no rewording.

**Tech Stack:** Same as the rest of the api: TypeScript ~5.8 strict, Express, `@google/genai` SDK, `openai` SDK, Vitest v3, Zod (already used at the env layer; not introducing it to routes here).

**Source spec:** `docs/superpowers/specs/2026-05-06-ai-provider-abstraction-design.md`

**Working directory:** `/Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm` — directly on `main` (solo dev).

---

## File Map

### New files (under `api/src/services/ai/`)

| Path                                                   | Status | Responsibility                                                                                            |
| ------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------- |
| `api/src/services/ai/types.ts`                         | create | `AiCompletionRequest`, `AiCompletionResponse` types                                                       |
| `api/src/services/ai/errors.ts`                        | create | `AiProviderError` class + `extractRetryDelay` helper (currently duplicated in both routes)                |
| `api/src/services/ai/knowledge.ts`                     | create | `getICCALeadsKnowledge()` (currently duplicated in both routes, ~120 LOC each)                            |
| `api/src/services/ai/providers/gemini.ts`              | create | Wraps `@google/genai`. `createGeminiProvider()` returns `{ complete(opts) }`                              |
| `api/src/services/ai/providers/openai.ts`              | create | Wraps `openai`. `createOpenaiProvider()` returns `{ complete(opts) }`                                     |
| `api/src/services/ai/prompts/enrich.ts`                | create | `buildGeminiEnrichPrompt`, `buildOpenaiEnrichPrompt`, `parseEnrichResponse`, `EnrichArgs`, `EnrichResult` |
| `api/src/services/ai/prompts/draftEmail.ts`            | create | Same shape as `enrich.ts` for `/draft-email`                                                              |
| `api/src/services/ai/prompts/chat.ts`                  | create | Same shape for `/chat`                                                                                    |
| `api/src/services/ai/prompts/strategicAnalysis.ts`     | create | Same shape for `/strategic-analysis` (large prompts ~400 LOC each)                                        |
| `api/src/services/ai/prompts/extractOrganizations.ts`  | create | GPT-only — exports one prompt builder + parser                                                            |
| `api/src/services/ai/prompts/checkEventEligibility.ts` | create | GPT-only                                                                                                  |
| `api/src/services/ai/prompts/researchEdition.ts`       | create | GPT-only                                                                                                  |
| `api/src/services/ai/prompts/analyzeVideo.ts`          | create | Gemini-only                                                                                               |
| `api/src/services/ai/prompts/knowledgeBase.ts`         | create | Gemini-only — thin wrapper exposing `getICCALeadsKnowledge` to the route                                  |
| `api/src/services/ai/providers/gemini.test.ts`         | create | Provider unit tests                                                                                       |
| `api/src/services/ai/providers/openai.test.ts`         | create | Provider unit tests                                                                                       |
| `api/src/services/ai/errors.test.ts`                   | create | `extractRetryDelay` tests                                                                                 |
| `api/src/services/ai/prompts/<op>.test.ts` × 9         | create | One test file per prompt module                                                                           |

### Modified files

| Path                       | Status | Responsibility after this sub-project                                  |
| -------------------------- | ------ | ---------------------------------------------------------------------- |
| `api/src/routes/gpt.ts`    | modify | < 300 LOC. Each handler becomes ~10–15 LOC of HTTP plumbing            |
| `api/src/routes/gemini.ts` | modify | < 300 LOC. Same shape                                                  |
| `STRICT_DEBT.md`           | modify | Strike out any markers resolved as a side-effect (verify after Task 8) |
| `README.md`                | modify | One-line pointer to `services/ai/` in conventions section (Task 9)     |

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

Expected: working tree clean; top commit is `9bc7faf docs: add AI provider abstraction design spec` (or later); all gates pass; 78 tests pass.

- [ ] **Confirm `.env` exists and has both AI keys**

```bash
grep -c '^GEMINI_API_KEY=' .env && grep -c '^OPENAI_API_KEY=' .env
```

Expected: `1` then `1`. Both keys must be present for manual smoke tests.

---

## Task 1: Scaffold types, errors, knowledge, providers

**Files:**

- Create: `api/src/services/ai/types.ts`
- Create: `api/src/services/ai/errors.ts`
- Create: `api/src/services/ai/errors.test.ts`
- Create: `api/src/services/ai/knowledge.ts`
- Create: `api/src/services/ai/providers/gemini.ts`
- Create: `api/src/services/ai/providers/gemini.test.ts`
- Create: `api/src/services/ai/providers/openai.ts`
- Create: `api/src/services/ai/providers/openai.test.ts`

This task creates the new module skeleton. None of it is wired up to the routes yet — the routes still work with their inline code. Tasks 2–7 wire each endpoint over.

- [ ] **Step 1: Read the source for `extractRetryDelay`**

Open `api/src/routes/gemini.ts` lines 136–184 (the `extractRetryDelay` function). Confirm it is identical to `api/src/routes/gpt.ts` lines 136–<wherever it ends, before the first router.post>:

```bash
sed -n '136,184p' api/src/routes/gemini.ts > /tmp/retry_gemini.txt
# Find the end of extractRetryDelay in gpt.ts:
grep -n '^const extractRetryDelay\|^const \|^router\.' api/src/routes/gpt.ts | head -10
# Then copy the same range:
sed -n '136,XXXp' api/src/routes/gpt.ts > /tmp/retry_gpt.txt
diff /tmp/retry_gemini.txt /tmp/retry_gpt.txt
```

Expected: identical, OR small differences. If different, the canonical extraction is the one used by both endpoints — pick whichever is more general; the loser's behavior moves to STRICT_DEBT.md as a follow-up.

- [ ] **Step 2: Create `api/src/services/ai/types.ts`**

```typescript
/**
 * Provider-agnostic shapes for AI completion requests/responses.
 * Each provider in services/ai/providers/ accepts AiCompletionRequest and
 * returns AiCompletionResponse.
 */
export interface AiCompletionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  /**
   * SDK-specific schema. Gemini accepts a Type.OBJECT structure; OpenAI
   * accepts a JSON Schema for response_format. Each provider passes this
   * through to its SDK without interpretation.
   */
  responseSchema?: unknown;
  maxOutputTokens?: number;
}

export interface AiCompletionResponse {
  text: string;
}
```

- [ ] **Step 3: Create `api/src/services/ai/errors.ts`**

Copy the body of `extractRetryDelay` verbatim from `api/src/routes/gemini.ts:136-184`. The file becomes:

```typescript
/**
 * Error type wrapping provider SDK errors with provider attribution.
 */
export class AiProviderError extends Error {
  constructor(
    public readonly provider: 'gemini' | 'openai',
    public readonly cause: unknown,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Extract retry-after delay (seconds) from a provider rate-limit error.
 * Moved verbatim from api/src/routes/{gemini,gpt}.ts.
 */
export const extractRetryDelay = (error: unknown): number | null => {
  // <BODY OF extractRetryDelay COPIED FROM api/src/routes/gemini.ts LINE 136-184>
  // The original parameter type was `any`; preserve that here for now and
  // tighten in a later sub-project if useful.
};
```

When copying, preserve the `any` type if the original used it. If TS strict complains, use `error: unknown` and add type narrowing inside.

- [ ] **Step 4: Create `api/src/services/ai/errors.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { AiProviderError, extractRetryDelay } from './errors';

describe('AiProviderError', () => {
  it('captures provider, cause, and message', () => {
    const cause = new Error('rate limited');
    const err = new AiProviderError('gemini', cause, 'Gemini failed');
    expect(err.provider).toBe('gemini');
    expect(err.cause).toBe(cause);
    expect(err.message).toBe('Gemini failed');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('extractRetryDelay', () => {
  it('returns null for non-rate-limit errors', () => {
    expect(extractRetryDelay(new Error('plain'))).toBe(null);
    expect(extractRetryDelay(null)).toBe(null);
    expect(extractRetryDelay(undefined)).toBe(null);
  });

  it('extracts retry delay from a Gemini-shaped 429 error', () => {
    // Use the exact error shape that the original function checks for.
    // Copy the test fixture from a representative case the function handles.
    // If the function handles a `{ error: { details: [{ retryDelay: '30s' }] } }`
    // shape, build that:
    const err = {
      error: {
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' }],
      },
    };
    expect(extractRetryDelay(err)).toBe(30);
  });
});
```

If the second test does not match the function's actual logic, adjust the fixture to a real shape after reading the function body. The point is one happy path + null cases.

- [ ] **Step 5: Create `api/src/services/ai/knowledge.ts`**

Copy `getICCALeadsKnowledge` verbatim from `api/src/routes/gemini.ts:16-135`:

```typescript
/**
 * Loads ICCA leads knowledge base text used as context for AI prompts.
 * Moved verbatim from api/src/routes/{gemini,gpt}.ts.
 *
 * No tests in this commit — this function reads from disk, which is real I/O.
 * Tests belong to sub-project #5 (layer-ization) where it can be properly
 * abstracted behind a fs interface.
 */
export const getICCALeadsKnowledge = async (): Promise<string> => {
  // <BODY COPIED FROM api/src/routes/gemini.ts LINES 16-135>
};
```

- [ ] **Step 6: Create `api/src/services/ai/providers/gemini.ts`**

```typescript
import { GoogleGenAI } from '@google/genai';
import { env } from '../../../config/env.js';
import type { AiCompletionRequest, AiCompletionResponse } from '../types';
import { AiProviderError } from '../errors';

/**
 * Thin wrapper around the @google/genai SDK. Exposes `complete()` returning
 * provider-agnostic AiCompletionResponse. Knows nothing about business ops.
 */
export function createGeminiProvider() {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  return {
    async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
      try {
        const result = await ai.models.generateContent({
          model: req.model ?? 'gemini-2.5-flash-lite',
          contents: req.prompt,
          ...(req.responseSchema
            ? {
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: req.responseSchema as object,
                },
              }
            : {}),
        });
        const text = result.text ?? '';
        return { text };
      } catch (cause) {
        throw new AiProviderError('gemini', cause, 'Gemini provider call failed');
      }
    },
  };
}
```

- [ ] **Step 7: Create `api/src/services/ai/providers/gemini.test.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent },
  })),
}));

beforeEach(() => {
  setEnv(VALID_ENV);
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createGeminiProvider', () => {
  it('passes prompt + model to the SDK and returns text', async () => {
    const { createGeminiProvider } = await import('./gemini');
    generateContent.mockResolvedValue({ text: 'hello world' });
    const provider = createGeminiProvider();
    const result = await provider.complete({ prompt: 'say hi', model: 'gemini-test' });
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-test', contents: 'say hi' }),
    );
    expect(result).toEqual({ text: 'hello world' });
  });

  it('uses default model when none provided', async () => {
    const { createGeminiProvider } = await import('./gemini');
    generateContent.mockResolvedValue({ text: 'default ok' });
    const provider = createGeminiProvider();
    await provider.complete({ prompt: 'p' });
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.5-flash-lite' }),
    );
  });

  it('wraps SDK errors in AiProviderError', async () => {
    const { createGeminiProvider } = await import('./gemini');
    const { AiProviderError } = await import('../errors');
    generateContent.mockRejectedValue(new Error('boom'));
    const provider = createGeminiProvider();
    await expect(provider.complete({ prompt: 'p' })).rejects.toBeInstanceOf(AiProviderError);
  });
});
```

- [ ] **Step 8: Create `api/src/services/ai/providers/openai.ts`**

```typescript
import OpenAI from 'openai';
import { env } from '../../../config/env.js';
import type { AiCompletionRequest, AiCompletionResponse } from '../types';
import { AiProviderError } from '../errors';

/**
 * Thin wrapper around the openai SDK. Exposes `complete()` returning
 * provider-agnostic AiCompletionResponse.
 */
export function createOpenaiProvider() {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
      try {
        const response = await client.chat.completions.create({
          model: req.model ?? 'gpt-4o-mini',
          messages: [{ role: 'user', content: req.prompt }],
          ...(req.responseSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: 'response',
                    schema: req.responseSchema,
                    strict: false,
                  },
                },
              }
            : {}),
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          ...(req.maxOutputTokens !== undefined ? { max_tokens: req.maxOutputTokens } : {}),
        });
        const text = response.choices[0]?.message?.content ?? '';
        return { text };
      } catch (cause) {
        throw new AiProviderError('openai', cause, 'OpenAI provider call failed');
      }
    },
  };
}
```

- [ ] **Step 9: Create `api/src/services/ai/providers/openai.test.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEnv, VALID_ENV, makeDotenvMock } from '../../../../../tests/helpers/env';

vi.mock('dotenv', () => makeDotenvMock());

const create = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: { completions: { create } },
  })),
}));

beforeEach(() => {
  setEnv(VALID_ENV);
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createOpenaiProvider', () => {
  it('sends the prompt as a user message and returns content', async () => {
    const { createOpenaiProvider } = await import('./openai');
    create.mockResolvedValue({ choices: [{ message: { content: 'hi back' } }] });
    const provider = createOpenaiProvider();
    const result = await provider.complete({ prompt: 'say hi' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'say hi' }],
      }),
    );
    expect(result).toEqual({ text: 'hi back' });
  });

  it('wraps SDK errors in AiProviderError', async () => {
    const { createOpenaiProvider } = await import('./openai');
    const { AiProviderError } = await import('../errors');
    create.mockRejectedValue(new Error('rate limit'));
    const provider = createOpenaiProvider();
    await expect(provider.complete({ prompt: 'p' })).rejects.toBeInstanceOf(AiProviderError);
  });
});
```

- [ ] **Step 10: Verify gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm test 2>&1 | tail -3
```

Expected: lint ok, typecheck:api ok, ~78 + 6 (errors.test) + 3 (gemini.test) + 2 (openai.test) = ~89 tests passing.

If typecheck complains about unused imports (because the new files aren't yet referenced from anywhere), that's fine — they will be consumed in Tasks 2–7.

- [ ] **Step 11: Commit**

```bash
git add api/src/services/ai/
git commit -m "$(cat <<'EOF'
feat(ai): scaffold provider + types + shared helper modules

Create the api/src/services/ai/ folder with:
- types.ts: AiCompletionRequest/Response shapes
- errors.ts: AiProviderError + extractRetryDelay (moved verbatim)
- knowledge.ts: getICCALeadsKnowledge (moved verbatim, no tests yet — disk I/O)
- providers/gemini.ts: thin @google/genai wrapper, complete() interface
- providers/openai.ts: thin openai wrapper, complete() interface

Tests for errors and providers (mocked SDKs). Routes still use their
inline code — wiring follows in subsequent commits.

Sub-project #4a, step 1/9.
EOF
)"
```

---

## Task 2: Extract `/enrich` prompt module

**Files:**

- Create: `api/src/services/ai/prompts/enrich.ts`
- Create: `api/src/services/ai/prompts/enrich.test.ts`
- Modify: `api/src/routes/gemini.ts` (lines 185–324)
- Modify: `api/src/routes/gpt.ts` (lines 599–762)

**Source ranges to extract:**

- `gemini.ts:185-324` — Gemini `/enrich` handler (140 LOC)
- `gpt.ts:599-762` — GPT `/enrich` handler (164 LOC)

- [ ] **Step 1: Read both `/enrich` handlers and identify the prompt blocks**

```bash
sed -n '185,324p' api/src/routes/gemini.ts > /tmp/gemini_enrich.txt
sed -n '599,762p' api/src/routes/gpt.ts > /tmp/gpt_enrich.txt
```

Identify in each:

- The validation block (`if (!companyName...)` etc.)
- The prompt template literal (multiline backtick string)
- The SDK call (`ai.models.generateContent(...)` or `openai.chat.completions.create(...)`)
- The response parsing (text → JSON, fallback handling)

- [ ] **Step 2: Create `api/src/services/ai/prompts/enrich.ts`**

Skeleton:

````typescript
/**
 * /enrich operation — research and fill in missing organization data.
 * Called by both gpt.ts and gemini.ts; same input/output, provider-tuned prompts.
 */

export interface EnrichArgs {
  companyName: string;
  keyPerson?: string;
  city?: string;
}

/**
 * Output shape — must match the response shape that today's routes
 * return to the frontend. Read both routes' parsers and union the fields
 * they output, marking each as optional unless always present.
 */
export interface EnrichResult {
  // <FIELDS DERIVED FROM CURRENT PARSER OUTPUT IN BOTH ROUTES>
  // Common ones to expect: website, keyPersonName, keyPersonTitle,
  // keyPersonEmail, keyPersonPhone, industry, etc.
  [key: string]: unknown;
}

/**
 * Build the Gemini prompt. Moved verbatim from gemini.ts:185-324
 * (the part inside the template-literal const `prompt = `...``).
 */
export function buildGeminiEnrichPrompt(args: EnrichArgs): string {
  const { companyName, keyPerson, city } = args;
  const keyPersonInfo =
    keyPerson && keyPerson.trim()
      ? `Key contact person: ${keyPerson}`
      : 'Key contact person: Not specified';
  const cityInfo = city && city.trim() ? `Located in: ${city}` : 'Location: Not specified';

  return `<PROMPT BODY COPIED VERBATIM FROM api/src/routes/gemini.ts BETWEEN
THE BACKTICKS THAT START AT THE 'const prompt = `...' STATEMENT AND END
AT THE CLOSING BACKTICK>`;
}

/**
 * Build the OpenAI prompt. Moved verbatim from gpt.ts:599-762.
 */
export function buildOpenaiEnrichPrompt(args: EnrichArgs): string {
  const { companyName, keyPerson, city } = args;
  return `<PROMPT BODY COPIED VERBATIM FROM api/src/routes/gpt.ts BETWEEN
THE BACKTICKS OF ITS `const prompt = `...`` STATEMENT>`;
}

/**
 * Parse the AI response text into EnrichResult. Both providers return JSON
 * that matches this shape. Moved from whichever route had the more complete
 * parser; if they differ, prefer the one from gemini.ts (currently more recent).
 */
export function parseEnrichResponse(text: string): EnrichResult {
  // <PARSER LOGIC COPIED FROM gemini.ts /enrich handler — typically:
  //   - regex-strip ```json...``` fences
  //   - JSON.parse the result
  //   - return parsed object
  // Include the same fallback (empty object on error) the original used.>
}
````

When copying the prompt bodies, **preserve every character** including whitespace, indentation inside the template literal, and backslash escapes. Diff against the original block before committing.

- [ ] **Step 3: Create `api/src/services/ai/prompts/enrich.test.ts`**

````typescript
import { describe, expect, it } from 'vitest';
import { buildGeminiEnrichPrompt, buildOpenaiEnrichPrompt, parseEnrichResponse } from './enrich';

describe('buildGeminiEnrichPrompt', () => {
  it('includes the company name in the prompt', () => {
    const prompt = buildGeminiEnrichPrompt({ companyName: 'Acme Corp' });
    expect(prompt).toContain('Acme Corp');
  });

  it('handles missing optional args without breaking', () => {
    const prompt = buildGeminiEnrichPrompt({ companyName: 'Acme' });
    expect(prompt).toContain('Acme');
    // The original handler emits "Not specified" placeholders for missing fields
    expect(prompt).toContain('Not specified');
  });

  it('includes optional keyPerson when provided', () => {
    const prompt = buildGeminiEnrichPrompt({ companyName: 'Acme', keyPerson: 'Lan' });
    expect(prompt).toContain('Lan');
  });
});

describe('buildOpenaiEnrichPrompt', () => {
  it('includes the company name', () => {
    const prompt = buildOpenaiEnrichPrompt({ companyName: 'Beta Inc' });
    expect(prompt).toContain('Beta Inc');
  });
});

describe('parseEnrichResponse', () => {
  it('parses a well-formed JSON response', () => {
    const text = '{"website": "https://acme.example", "keyPersonName": "Lan"}';
    const out = parseEnrichResponse(text);
    expect(out.website).toBe('https://acme.example');
    expect(out.keyPersonName).toBe('Lan');
  });

  it('strips markdown JSON fences (```json...```)', () => {
    const text = '```json\n{"website": "https://acme.example"}\n```';
    const out = parseEnrichResponse(text);
    expect(out.website).toBe('https://acme.example');
  });

  it('returns an empty object for malformed JSON', () => {
    expect(parseEnrichResponse('definitely not json')).toEqual({});
  });
});
````

If the original parser in gemini.ts has different fallback behavior (e.g., throws instead of returning `{}`), update the last test to reflect the actual behavior.

- [ ] **Step 4: Refactor `gemini.ts /enrich` to use the new module**

Open `api/src/routes/gemini.ts`. Replace the entire `router.post('/enrich', ...)` block (lines 185–324) with a thin handler:

```typescript
import { createGeminiProvider } from '../services/ai/providers/gemini.js';
import {
  buildGeminiEnrichPrompt,
  parseEnrichResponse,
  type EnrichArgs,
} from '../services/ai/prompts/enrich.js';

router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const args = req.body as EnrichArgs;
    if (!args.companyName || args.companyName.trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }
    const provider = createGeminiProvider();
    const prompt = buildGeminiEnrichPrompt(args);
    const { text } = await provider.complete({ prompt, model: 'gemini-2.5-flash-lite' });
    const result = parseEnrichResponse(text);
    return res.json(result);
  } catch (error: unknown) {
    console.error('[gemini/enrich] Error:', error);
    return res.status(500).json({ error: 'Enrichment failed' });
  }
});
```

If the original handler had additional behavior (rate-limit retry, logging fields, etc.) preserve it. Reference the original at gemini.ts:185-324 and translate behavior, not literal code.

- [ ] **Step 5: Refactor `gpt.ts /enrich` to use the new module**

In `api/src/routes/gpt.ts`, replace lines 599–762 with:

```typescript
import { createOpenaiProvider } from '../services/ai/providers/openai.js';
import {
  buildOpenaiEnrichPrompt,
  parseEnrichResponse,
  type EnrichArgs,
} from '../services/ai/prompts/enrich.js';

router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const args = req.body as EnrichArgs;
    if (!args.companyName || args.companyName.trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }
    const provider = createOpenaiProvider();
    const prompt = buildOpenaiEnrichPrompt(args);
    const { text } = await provider.complete({ prompt, model: 'gpt-4o-mini' });
    const result = parseEnrichResponse(text);
    return res.json(result);
  } catch (error: unknown) {
    console.error('[gpt/enrich] Error:', error);
    return res.status(500).json({ error: 'Enrichment failed' });
  }
});
```

- [ ] **Step 6: Run gates and tests**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm test 2>&1 | tail -3
```

Expected: ~89 + 7 = ~96 tests passing.

- [ ] **Step 7: Manual smoke test**

In a separate terminal:

```bash
npm run dev:api &
sleep 5
# Hit Gemini /enrich
curl -s -X POST http://localhost:3001/api/v1/gemini/enrich \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"Test Corp","city":"Hanoi"}' | head -c 500
# Hit GPT /enrich
curl -s -X POST http://localhost:3001/api/v1/gpt/enrich \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"Test Corp","city":"Hanoi"}' | head -c 500
pkill -f 'tsx watch'
```

Expected: both endpoints return a JSON object (the AI's actual content varies, but the SHAPE should match what the frontend expected pre-refactor). If a 500 error appears, inspect the server logs in the dev:api output.

- [ ] **Step 8: Commit**

```bash
git add api/src/services/ai/prompts/enrich.ts api/src/services/ai/prompts/enrich.test.ts api/src/routes/gemini.ts api/src/routes/gpt.ts
git commit -m "$(cat <<'EOF'
refactor(ai): extract /enrich prompt to services/ai/prompts/enrich.ts

Move enrich prompt builders (Gemini + OpenAI variants) and the shared
parser into a dedicated module. gemini.ts and gpt.ts /enrich handlers
become thin HTTP wrappers (~15 LOC each). Behavior unchanged: same
input shape, same response shape, same model selection.

Sub-project #4a, step 2/9.
EOF
)"
```

---

## Task 3: Extract `/draft-email` prompt module

**Files:**

- Create: `api/src/services/ai/prompts/draftEmail.ts`
- Create: `api/src/services/ai/prompts/draftEmail.test.ts`
- Modify: `api/src/routes/gemini.ts` (lines 325–390)
- Modify: `api/src/routes/gpt.ts` (lines 763–816)

**Source ranges to extract:**

- `gemini.ts:325-390` — Gemini `/draft-email` (66 LOC)
- `gpt.ts:763-816` — GPT `/draft-email` (54 LOC)

- [ ] **Step 1: Read both `/draft-email` handlers**

```bash
sed -n '325,390p' api/src/routes/gemini.ts
sed -n '763,816p' api/src/routes/gpt.ts
```

Identify the request body shape (lead fields used in the prompt), the prompt text, and the response parsing.

- [ ] **Step 2: Create `api/src/services/ai/prompts/draftEmail.ts`**

```typescript
/**
 * /draft-email operation — generate an outreach email for a lead.
 * Both gpt.ts and gemini.ts implement this with provider-tuned prompts;
 * output shape is shared.
 */

export interface DraftEmailArgs {
  // <COPY FIELDS USED FROM `req.body` IN gemini.ts:325-390 AND gpt.ts:763-816.
  // Typically: lead company name, key person, email, country, industry, etc.>
}

export interface DraftEmailResult {
  subject: string;
  body: string;
  // <ADD ANY OTHER FIELDS THE ORIGINAL HANDLERS RETURN>
}

export function buildGeminiDraftEmailPrompt(args: DraftEmailArgs): string {
  return `<PROMPT BODY VERBATIM FROM gemini.ts:325-390>`;
}

export function buildOpenaiDraftEmailPrompt(args: DraftEmailArgs): string {
  return `<PROMPT BODY VERBATIM FROM gpt.ts:763-816>`;
}

export function parseDraftEmailResponse(text: string): DraftEmailResult {
  // <PARSER LOGIC. If the original returned { subject, body }, preserve that.>
}
```

- [ ] **Step 3: Create `api/src/services/ai/prompts/draftEmail.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import {
  buildGeminiDraftEmailPrompt,
  buildOpenaiDraftEmailPrompt,
  parseDraftEmailResponse,
} from './draftEmail';

// Build a minimal valid args object based on the DraftEmailArgs interface.
const baseArgs = {
  // <FILL WITH PLACEHOLDER VALUES MATCHING THE INTERFACE>
} as Parameters<typeof buildGeminiDraftEmailPrompt>[0];

describe('buildGeminiDraftEmailPrompt', () => {
  it('includes the company name in the prompt', () => {
    // Replace 'Acme' with whatever the company-name-equivalent field is.
    const prompt = buildGeminiDraftEmailPrompt({ ...baseArgs /* companyName: */ /* 'Acme' */ });
    expect(prompt).toContain('Acme');
  });
});

describe('buildOpenaiDraftEmailPrompt', () => {
  it('includes the company name in the prompt', () => {
    const prompt = buildOpenaiDraftEmailPrompt({ ...baseArgs /* companyName: */ /* 'Beta' */ });
    expect(prompt).toContain('Beta');
  });
});

describe('parseDraftEmailResponse', () => {
  it('parses a JSON response with subject and body', () => {
    const text = '{"subject": "Test Subject", "body": "Test body"}';
    const out = parseDraftEmailResponse(text);
    expect(out.subject).toBe('Test Subject');
    expect(out.body).toBe('Test body');
  });

  it('returns sensible defaults for malformed JSON', () => {
    // Match the actual fallback in the source.
    const out = parseDraftEmailResponse('not json');
    expect(out).toEqual(
      expect.objectContaining({ subject: expect.any(String), body: expect.any(String) }),
    );
  });
});
```

- [ ] **Step 4: Refactor `gemini.ts /draft-email`**

Replace lines 325–390 with the thin pattern:

```typescript
import {
  buildGeminiDraftEmailPrompt,
  parseDraftEmailResponse,
  type DraftEmailArgs,
} from '../services/ai/prompts/draftEmail.js';

router.post('/draft-email', async (req: Request, res: Response) => {
  try {
    const args = req.body as DraftEmailArgs;
    // <PRESERVE THE EXACT VALIDATION FROM THE ORIGINAL — typically a check
    // that lead.companyName or similar required field is present>
    const provider = createGeminiProvider();
    const prompt = buildGeminiDraftEmailPrompt(args);
    const { text } = await provider.complete({ prompt, model: '<MODEL FROM ORIGINAL>' });
    const result = parseDraftEmailResponse(text);
    return res.json(result);
  } catch (error: unknown) {
    console.error('[gemini/draft-email] Error:', error);
    return res.status(500).json({ error: 'Email draft failed' });
  }
});
```

- [ ] **Step 5: Refactor `gpt.ts /draft-email`**

Replace lines 763–816 with:

```typescript
import {
  buildOpenaiDraftEmailPrompt,
  parseDraftEmailResponse,
  type DraftEmailArgs,
} from '../services/ai/prompts/draftEmail.js';

router.post('/draft-email', async (req: Request, res: Response) => {
  try {
    const args = req.body as DraftEmailArgs;
    // <ORIGINAL VALIDATION>
    const provider = createOpenaiProvider();
    const prompt = buildOpenaiDraftEmailPrompt(args);
    const { text } = await provider.complete({ prompt, model: '<MODEL FROM ORIGINAL>' });
    const result = parseDraftEmailResponse(text);
    return res.json(result);
  } catch (error: unknown) {
    console.error('[gpt/draft-email] Error:', error);
    return res.status(500).json({ error: 'Email draft failed' });
  }
});
```

- [ ] **Step 6: Verify gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm test 2>&1 | tail -3
```

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev:api &
sleep 5
curl -s -X POST http://localhost:3001/api/v1/gemini/draft-email \
  -H 'Content-Type: application/json' \
  -d '<MINIMAL VALID BODY MATCHING DraftEmailArgs>' | head -c 500
curl -s -X POST http://localhost:3001/api/v1/gpt/draft-email \
  -H 'Content-Type: application/json' \
  -d '<MINIMAL VALID BODY>' | head -c 500
pkill -f 'tsx watch'
```

- [ ] **Step 8: Commit**

```bash
git add api/src/services/ai/prompts/draftEmail.ts api/src/services/ai/prompts/draftEmail.test.ts api/src/routes/gemini.ts api/src/routes/gpt.ts
git commit -m "$(cat <<'EOF'
refactor(ai): extract /draft-email prompt to services/ai/prompts/draftEmail.ts

Same pattern as enrich: provider-specific builders + shared parser.
gemini.ts and gpt.ts /draft-email handlers become thin wrappers.
Behavior unchanged.

Sub-project #4a, step 3/9.
EOF
)"
```

---

## Task 4: Extract `/chat` prompt module

**Files:**

- Create: `api/src/services/ai/prompts/chat.ts`
- Create: `api/src/services/ai/prompts/chat.test.ts`
- Modify: `api/src/routes/gemini.ts` (lines 391–442)
- Modify: `api/src/routes/gpt.ts` (lines 817–873)

Follow the same 8-step pattern as Task 3 with these adjustments:

- [ ] **Step 1: Read both `/chat` handlers**

```bash
sed -n '391,442p' api/src/routes/gemini.ts
sed -n '817,873p' api/src/routes/gpt.ts
```

`/chat` typically takes a conversation history (`messages` array) and a system context. Note this — the args interface will differ from enrich.

- [ ] **Step 2: Create `api/src/services/ai/prompts/chat.ts`**

```typescript
/**
 * /chat operation — multi-turn conversation with the AI assistant.
 */

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

export interface ChatArgs {
  messages: ChatMessage[];
  // <ADD ANY OTHER FIELDS USED, e.g. system context, lead context>
}

export interface ChatResult {
  reply: string;
  // <ADD OTHER FIELDS RETURNED BY THE ORIGINAL HANDLERS>
}

export function buildGeminiChatPrompt(args: ChatArgs): string {
  return `<PROMPT BODY VERBATIM FROM gemini.ts:391-442>`;
}

export function buildOpenaiChatPrompt(args: ChatArgs): string {
  return `<PROMPT BODY VERBATIM FROM gpt.ts:817-873>`;
}

export function parseChatResponse(text: string): ChatResult {
  // <PARSER LOGIC. /chat often just returns text directly without JSON parsing.>
}
```

- [ ] **Step 3: Create `api/src/services/ai/prompts/chat.test.ts`**

Three cases:

- `buildGeminiChatPrompt` with one user message includes that message
- `buildOpenaiChatPrompt` with one user message includes that message
- `parseChatResponse` extracts the reply from a representative response shape

- [ ] **Step 4-5: Refactor route handlers**

Replace gemini.ts:391-442 and gpt.ts:817-873 with thin wrappers (same shape as Task 3 step 4-5).

- [ ] **Step 6-7: Verify and smoke test**

Smoke test payload:

```bash
curl -s -X POST http://localhost:3001/api/v1/gemini/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}' | head -c 500
```

- [ ] **Step 8: Commit**

```bash
git add api/src/services/ai/prompts/chat.ts api/src/services/ai/prompts/chat.test.ts api/src/routes/gemini.ts api/src/routes/gpt.ts
git commit -m "refactor(ai): extract /chat prompt to services/ai/prompts/chat.ts

Sub-project #4a, step 4/9."
```

---

## Task 5: Extract `/strategic-analysis` prompt module

**Files:**

- Create: `api/src/services/ai/prompts/strategicAnalysis.ts`
- Create: `api/src/services/ai/prompts/strategicAnalysis.test.ts`
- Modify: `api/src/routes/gemini.ts` (lines 538–915)
- Modify: `api/src/routes/gpt.ts` (lines 206–598)

**WARNING:** This is the largest single task. The two handlers together are ~770 LOC, with the prompt itself spanning hundreds of lines on each side. Allow extra time for careful copy-paste and diff.

Follow Task 3's 8-step pattern. Specific notes:

- [ ] **Step 1: Read both handlers**

```bash
sed -n '538,915p' api/src/routes/gemini.ts > /tmp/gemini_strat.txt
sed -n '206,598p' api/src/routes/gpt.ts > /tmp/gpt_strat.txt
wc -l /tmp/*_strat.txt
```

- [ ] **Step 2: Create `api/src/services/ai/prompts/strategicAnalysis.ts`**

Skeleton same as enrich.ts. Both prompts are large; extract them VERBATIM. After extraction, verify with character-count diff:

```bash
# After creating the file:
node -e "import('./api/src/services/ai/prompts/strategicAnalysis.js').then(m => console.log(m.buildGeminiStrategicAnalysisPrompt({ /* args */ }).length))"
# Compare to:
sed -n '<original-prompt-start>,<original-prompt-end>p' api/src/routes/gemini.ts | wc -c
```

The lengths should match within ~10 characters (small diff from indentation in the function vs route file is OK; large diff means content was lost).

- [ ] **Steps 3–8:** Same pattern. Smoke test payload is whatever `/strategic-analysis` accepts (look at the request body deserialization in the original handler).

```bash
git add api/src/services/ai/prompts/strategicAnalysis.ts api/src/services/ai/prompts/strategicAnalysis.test.ts api/src/routes/gemini.ts api/src/routes/gpt.ts
git commit -m "refactor(ai): extract /strategic-analysis prompt to services/ai/prompts/strategicAnalysis.ts

Largest single extraction (~770 LOC across both routes). Prompts moved
verbatim, character-count diff verified.

Sub-project #4a, step 5/9."
```

---

## Task 6: Extract GPT-only prompt modules

**Files:**

- Create: `api/src/services/ai/prompts/extractOrganizations.ts` + test
- Create: `api/src/services/ai/prompts/checkEventEligibility.ts` + test
- Create: `api/src/services/ai/prompts/researchEdition.ts` + test
- Modify: `api/src/routes/gpt.ts` (lines 153–205, 874–994, 995–1085)

Three single-provider modules. Each exports one builder (`buildOpenaiXxxPrompt`) and one parser. No `buildGemini*Prompt` since these endpoints don't exist on gemini.ts.

Per module, follow this compressed flow (each is one mini-commit if you prefer, but the plan groups them into one Task 6 commit since the patterns are identical):

- [ ] **Step 1: extractOrganizations** (gpt.ts:153-205)
  - Read source
  - Create `prompts/extractOrganizations.ts` with `ExtractOrganizationsArgs`, `ExtractOrganizationsResult`, `buildOpenaiExtractOrganizationsPrompt`, `parseExtractOrganizationsResponse`
  - Create `extractOrganizations.test.ts` with: prompt contains expected keyword; parser handles well-formed and malformed JSON
  - Refactor gpt.ts:153-205 to thin wrapper

- [ ] **Step 2: checkEventEligibility** (gpt.ts:874-994)
  - Same pattern. Module name: `checkEventEligibility`.

- [ ] **Step 3: researchEdition** (gpt.ts:995-1085)
  - Same pattern. Module name: `researchEdition`.

- [ ] **Step 4: Run gates and tests**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm test 2>&1 | tail -3
```

Expected: ~96 + 6 (extractOrgs) + 5 (checkEventEligibility) + 5 (researchEdition) = ~112 tests.

- [ ] **Step 5: Smoke test all three GPT-only endpoints**

```bash
npm run dev:api &
sleep 5
# extract-organizations
curl -s -X POST http://localhost:3001/api/v1/gpt/extract-organizations \
  -H 'Content-Type: application/json' \
  -d '<MINIMAL BODY>' | head -c 300
# check-event-eligibility
curl -s -X POST http://localhost:3001/api/v1/gpt/check-event-eligibility \
  -H 'Content-Type: application/json' \
  -d '<MINIMAL BODY>' | head -c 300
# research-edition
curl -s -X POST http://localhost:3001/api/v1/gpt/research-edition \
  -H 'Content-Type: application/json' \
  -d '<MINIMAL BODY>' | head -c 300
pkill -f 'tsx watch'
```

- [ ] **Step 6: Commit**

```bash
git add api/src/services/ai/prompts/extractOrganizations.ts \
        api/src/services/ai/prompts/extractOrganizations.test.ts \
        api/src/services/ai/prompts/checkEventEligibility.ts \
        api/src/services/ai/prompts/checkEventEligibility.test.ts \
        api/src/services/ai/prompts/researchEdition.ts \
        api/src/services/ai/prompts/researchEdition.test.ts \
        api/src/routes/gpt.ts
git commit -m "$(cat <<'EOF'
refactor(ai): extract GPT-only prompt modules (3)

Move /extract-organizations, /check-event-eligibility, /research-edition
prompts and parsers from gpt.ts into dedicated modules. gpt.ts route
handlers become thin wrappers.

Sub-project #4a, step 6/9.
EOF
)"
```

---

## Task 7: Extract Gemini-only prompt modules

**Files:**

- Create: `api/src/services/ai/prompts/analyzeVideo.ts` + test
- Create: `api/src/services/ai/prompts/knowledgeBase.ts` + test
- Modify: `api/src/routes/gemini.ts` (lines 443–523, 524–537)

Two single-provider modules.

- [ ] **Step 1: analyzeVideo** (gemini.ts:443-523)
  - Read source
  - Create `prompts/analyzeVideo.ts` with builder + parser
  - Create test with one prompt-content assertion + one parser case
  - Refactor gemini.ts:443-523 to thin wrapper

- [ ] **Step 2: knowledgeBase** (gemini.ts:524-537)
  - This endpoint is small (14 LOC). Likely just returns the result of `getICCALeadsKnowledge()` (now in `services/ai/knowledge.ts`).
  - Create `prompts/knowledgeBase.ts`:

  ```typescript
  /**
   * /knowledge-base — return the ICCA leads knowledge text. Not really a "prompt"
   * since it has no AI call; placed here for symmetry with other gemini ops.
   */
  import { getICCALeadsKnowledge } from '../knowledge.js';

  export async function getKnowledgeBase(): Promise<{ knowledge: string }> {
    const knowledge = await getICCALeadsKnowledge();
    return { knowledge };
  }
  ```

  - Create `knowledgeBase.test.ts`:

  ```typescript
  import { describe, expect, it, vi } from 'vitest';

  vi.mock('../knowledge', () => ({
    getICCALeadsKnowledge: vi.fn().mockResolvedValue('mocked knowledge text'),
  }));

  describe('getKnowledgeBase', () => {
    it('wraps the knowledge string in an object', async () => {
      const { getKnowledgeBase } = await import('./knowledgeBase');
      const result = await getKnowledgeBase();
      expect(result.knowledge).toBe('mocked knowledge text');
    });
  });
  ```

  - Refactor gemini.ts:524-537:

  ```typescript
  import { getKnowledgeBase } from '../services/ai/prompts/knowledgeBase.js';

  router.get('/knowledge-base', async (_req: Request, res: Response) => {
    try {
      const result = await getKnowledgeBase();
      return res.json(result);
    } catch (error: unknown) {
      console.error('[gemini/knowledge-base] Error:', error);
      return res.status(500).json({ error: 'Knowledge base load failed' });
    }
  });
  ```

- [ ] **Step 3: Verify and smoke test**

```bash
npm run lint > /dev/null && npm run typecheck:api > /dev/null && npm test 2>&1 | tail -3

npm run dev:api &
sleep 5
curl -s http://localhost:3001/api/v1/gemini/knowledge-base | head -c 300
curl -s -X POST http://localhost:3001/api/v1/gemini/analyze-video \
  -H 'Content-Type: application/json' \
  -d '<MINIMAL BODY>' | head -c 300
pkill -f 'tsx watch'
```

- [ ] **Step 4: Commit**

```bash
git add api/src/services/ai/prompts/analyzeVideo.ts \
        api/src/services/ai/prompts/analyzeVideo.test.ts \
        api/src/services/ai/prompts/knowledgeBase.ts \
        api/src/services/ai/prompts/knowledgeBase.test.ts \
        api/src/routes/gemini.ts
git commit -m "$(cat <<'EOF'
refactor(ai): extract Gemini-only prompt modules (2)

Move /analyze-video and /knowledge-base from gemini.ts into dedicated
modules. /knowledge-base now delegates to services/ai/knowledge.ts
(the source of truth for the ICCA leads knowledge text).

Sub-project #4a, step 7/9.
EOF
)"
```

---

## Task 8: Final cleanup of `gpt.ts` and `gemini.ts`

**Files:**

- Modify: `api/src/routes/gpt.ts`
- Modify: `api/src/routes/gemini.ts`

After Tasks 2–7, the route files should be ~200–300 LOC each, but they likely have:

- Unused imports (the old SDK imports, dotenv, etc.)
- Dead helper functions still in place (`getAiClient`, the inline `getICCALeadsKnowledge`, the inline `extractRetryDelay`)
- Unused regex constants used only by old prompts

This task removes all of that.

- [ ] **Step 1: Inspect both files for dead code**

```bash
wc -l api/src/routes/gemini.ts api/src/routes/gpt.ts
grep -n '^const \|^function \|^async function ' api/src/routes/gemini.ts
grep -n '^const \|^function \|^async function ' api/src/routes/gpt.ts
```

- [ ] **Step 2: Remove from `gemini.ts`**

Delete:

- The local `getAiClient` (lines ~11-15) — replaced by `createGeminiProvider` in service.
- The local `getICCALeadsKnowledge` (lines ~16-135) — moved to `services/ai/knowledge.ts`.
- The local `extractRetryDelay` (lines ~136-184) — moved to `services/ai/errors.ts`.
- The original `import { GoogleGenAI, Type }` if no longer used (the route now imports `createGeminiProvider`).
- Any other unused imports flagged by ESLint.

Run `npm run lint:fix` to auto-fix the import-removal cases. Manual cleanup for anything ESLint cannot fix.

- [ ] **Step 3: Remove from `gpt.ts`**

Same dead-code list:

- Local `getAiClient` (lines ~11-15)
- Local `getICCALeadsKnowledge` (lines ~16-135)
- Local `extractRetryDelay` (lines ~136-...)
- Unused `OpenAI` import if no longer referenced

`npm run lint:fix`.

- [ ] **Step 4: Verify line counts**

```bash
wc -l api/src/routes/gemini.ts api/src/routes/gpt.ts
```

Expected: each well under 300 LOC. Likely 150–250 each. If still over 300, look for additional dead code missed.

- [ ] **Step 5: Run all gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run format:check > /dev/null && echo "format ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm run build > /dev/null && echo "build ok"
npm test 2>&1 | tail -3
```

Expected: all pass; ~115–120 tests.

- [ ] **Step 6: Final smoke test — one endpoint per route**

```bash
npm run dev:api &
sleep 5
curl -s -X POST http://localhost:3001/api/v1/gemini/enrich \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"Smoke Test Corp"}' | head -c 200
echo
curl -s -X POST http://localhost:3001/api/v1/gpt/enrich \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"Smoke Test Corp"}' | head -c 200
pkill -f 'tsx watch'
```

- [ ] **Step 7: Commit**

```bash
git add api/src/routes/gemini.ts api/src/routes/gpt.ts
git commit -m "$(cat <<'EOF'
refactor(ai): remove dead code from gpt.ts and gemini.ts

After all prompt modules are extracted, the route files no longer
need local copies of getAiClient, getICCALeadsKnowledge, or
extractRetryDelay. Remove them along with their now-unused imports.

Each route file is now under 300 LOC, containing only thin HTTP
wrappers that delegate to services/ai/.

Sub-project #4a, step 8/9.
EOF
)"
```

---

## Task 9: Update STRICT_DEBT.md and README

**Files:**

- Modify: `STRICT_DEBT.md`
- Modify: `README.md`

- [ ] **Step 1: Audit STRICT_DEBT.md for resolved markers**

Search for any `@ts-expect-error TODO(refactor)` markers in files that were modified during 4a:

```bash
grep -n '@ts-expect-error' api/src/routes/gpt.ts api/src/routes/gemini.ts api/src/services/ai/ -r
```

If any of the markers listed in `STRICT_DEBT.md` for those files are now gone (because the surrounding code was refactored), strike them through or remove them in `STRICT_DEBT.md`. If markers remain, leave them.

- [ ] **Step 2: Add a pointer to `services/ai/` in README**

In `README.md`, in the "Testing conventions" section (after the existing bullets), add:

```markdown
### Source layout: AI provider abstraction

Backend AI calls live under `api/src/services/ai/`:

- `providers/{gemini,openai}.ts` — thin SDK wrappers
- `prompts/<operation>.ts` — one module per business operation
  (enrich, draftEmail, chat, strategicAnalysis, plus single-provider ones)
- `errors.ts`, `knowledge.ts`, `types.ts` — shared infrastructure

Route handlers in `api/src/routes/{gpt,gemini}.ts` are thin HTTP
wrappers. To add a new AI endpoint, create a prompt module + test, then
wire it in the appropriate route file. Same pattern for adding a new
provider.
```

- [ ] **Step 3: Verify all gates one final time**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run format:check > /dev/null && echo "format ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm run build > /dev/null && echo "build ok"
npm test 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add STRICT_DEBT.md README.md
git commit -m "$(cat <<'EOF'
docs: update STRICT_DEBT.md and README for #4a completion

Remove any TODO markers resolved as a side-effect of the AI
extraction. Add README pointer to the new services/ai/ layout
so future contributors know where prompts and providers live.

Sub-project #4a, step 9/9. Closes the AI provider abstraction.
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

Expected: all pass; ~115–120 tests in well under 10 seconds.

- [ ] **Verify route file sizes**

```bash
wc -l api/src/routes/gpt.ts api/src/routes/gemini.ts
```

Expected: each < 300 LOC.

- [ ] **Verify directory structure**

```bash
find api/src/services/ai -type f | sort
```

Expected: 11 source files (types, errors, knowledge, 2 providers, 9 prompt modules) + 11 test files (errors, 2 providers, 8 prompt modules — knowledgeBase optional). Total ~22 files.

- [ ] **Manual end-to-end smoke**

Open the frontend in a browser (http://localhost:3000 after `npm run dev`). Trigger a real AI-using flow (e.g., click "Enrich" on a lead). Verify the request completes and the data populates as before.

- [ ] **Push to remote**

```bash
git push origin main
```

The pre-push hook runs typecheck + typecheck:api + tests; push succeeds only if all pass.

---

## Rollback notes

Each task is one (or for Task 6, three sub-) commit, isolated to one operation:

- **Tasks 2–5, 7**: each touches one prompt module + at most two route handlers. Revert one commit → that one endpoint returns to inline code.
- **Task 6**: three GPT endpoints in one commit. If only one is broken, follow up with a forward-fix commit rather than reverting all three.
- **Task 8 (cleanup)**: zero behavior risk — just removing dead code. If something breaks, the missing import is in the diff.

Highest-risk commits are Tasks 2 and 5 (the largest prompt extractions). If a regression is discovered post-merge, revert that one commit and the routes return to their inline state.

---

## Out of scope (do not do here)

- Refactor `excelImport.ts`, `leadScoringService.ts`, `vertex.ts` — they keep their direct-SDK pattern. Migration is a separate sub-project after 4a stabilizes.
- Refactor god React components (`LeadDetail`, `LeadsView`, `EventModal`) — those are #4b/#4c/#4d.
- Add new providers (Anthropic, etc.) — out of scope.
- Rate limiting, retry, structured logging, request tracing — sub-project #3.
- Unifying `/api/v1/gpt/*` and `/api/v1/gemini/*` under a single mount path — would break frontend; out of scope.
- Improving prompt content — extraction is verbatim; rewording is a separate decision.
