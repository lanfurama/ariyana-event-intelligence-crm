# AI Provider Abstraction — Design Spec

**Date:** 2026-05-06
**Status:** Draft (awaiting user review)
**Sub-project:** #4a (decomposed from the original #4 god-file refactor; see "Scope context" below)
**Owner:** lanfurama (solo)

---

## 1. Context

### Scope context: why #4 was decomposed

The original sub-project #4 in the roadmap bundled three independent refactors (`LeadsView.tsx`, `LeadDetail.tsx`, "AI provider abstraction") into a single 5–7-day estimate covering ~5500 LOC. That is too large for a single spec to drive cleanly. Decomposed into:

- **#4a** (this spec): AI provider abstraction — extract prompts + provider clients from `gpt.ts` (1085 LOC) and `gemini.ts` (916 LOC) into a service layer.
- **#4b**: Refactor `LeadDetail.tsx` (1998 LOC, currently `@ts-nocheck`).
- **#4c**: Refactor `EventModal.tsx` (641 LOC, currently `@ts-nocheck`).
- **#4d**: Refactor `LeadsView.tsx` (1914 LOC).

Order: 4a → 4c → 4b → 4d (rationale: 4a unblocks AI consumers; 4c is small warm-up for the refactor pattern; 4b restores type safety on a currently-untyped god file; 4d is the last and biggest).

### Current state

`api/src/routes/gpt.ts` (1085 LOC) and `api/src/routes/gemini.ts` (916 LOC) are HTTP route handlers that mix three concerns:

1. Express request validation and response shaping.
2. SDK client construction (`new OpenAI({...})` / `new GoogleGenAI({...})`).
3. Multi-hundred-line inline prompt templates plus their JSON response parsers.

The two files implement four logically-equivalent endpoints (`/enrich`, `/draft-email`, `/chat`, `/strategic-analysis`) — different prompt wording, same business intent and same output shape. Plus three GPT-only (`/extract-organizations`, `/check-event-eligibility`, `/research-edition`) and two Gemini-only (`/analyze-video`, `/knowledge-base`).

Three other consumers also call AI SDKs directly: `excelImport.ts`, `leadScoringService.ts`, `vertex.ts`. They are **out of scope here** — addressing them is left for a later pass once this pattern stabilizes.

### Pain points addressed

| Symptom                                                                                  | Cause                                                                   | Fix in this spec                                                              |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Two 1000-LOC route files are unreadable; navigating to a single endpoint takes scrolling | Prompt strings (often >100 lines each) live inline in the route handler | §3 — extract each operation into its own `services/ai/prompts/<op>.ts` module |
| Hard to compare GPT vs Gemini behavior side-by-side for the same business op             | Each prompt is buried in its provider's route file                      | §3 — co-locate provider prompts inside one module per operation               |
| SDK client construction is boilerplate copy-paste at the top of each route file          | No shared provider wrapper                                              | §3 — `services/ai/providers/{gemini,openai}.ts`                               |
| Output parsers (regex / JSON.parse / fallback handling) are duplicated per endpoint      | Each handler implements its own parsing                                 | §3 — parser becomes a single export per operation, used by both providers     |
| Refactoring god files (#4b/#4d) needs the route layer to be navigable first              | Today the routes are the second-and-third largest source files          | This sub-project                                                              |

---

## 2. Goals & non-goals

### Goals

1. `gpt.ts` and `gemini.ts` reduce to thin HTTP route handlers (target: each under 300 LOC).
2. Every business operation has its own `services/ai/prompts/<op>.ts` module exporting prompt builder(s) and a parser.
3. Provider SDK construction is encapsulated in `services/ai/providers/{gemini,openai}.ts`.
4. ~30–40 new test cases bring the total to ~110–120 (started at 78 in sub-project #2).
5. Zero behavior change observable from the API — same routes, same request shape, same response shape.
6. `npm run typecheck:api`, `npm run lint`, `npm test` all exit 0 throughout the rollout.

### Non-goals (explicitly deferred)

- Refactoring god React components (`LeadDetail`, `LeadsView`, `EventModal`) — those are #4b/#4c/#4d.
- Refactoring `excelImport.ts`, `leadScoringService.ts`, `vertex.ts` to consume the new abstraction. They keep their current direct-SDK pattern. A follow-up sub-project will revisit once 4a is stable.
- Adding new providers (e.g., Anthropic Claude). Vertex stays on raw `fetch`, unchanged.
- Adding rate-limit, retry, request-id propagation, or structured logging — that is sub-project #3 (logger/observability).
- Unifying the route paths under a single `/api/v1/ai/:provider/:op` mount. Backward compatibility with existing frontend callers is preserved by leaving `/api/v1/gemini/*` and `/api/v1/gpt/*` exactly as today.
- Changing prompt content. Prompts are extracted **verbatim** into modules. Any improvement to prompt wording is a separate decision tracked in a later issue, not done as part of this code move.
- Component tests, real DB tests, real AI calls — same exclusions as sub-project #2.

---

## 3. Architecture

### File map

```
api/src/services/ai/
├── types.ts                          # AiCompletionRequest, AiCompletionResponse, AiProviderError
├── providers/
│   ├── gemini.ts                     # wraps @google/genai SDK
│   └── openai.ts                     # wraps openai SDK
└── prompts/
    ├── enrich.ts                     # SHARED op (4 of these)
    ├── draftEmail.ts
    ├── chat.ts
    ├── strategicAnalysis.ts
    ├── extractOrganizations.ts       # GPT-only
    ├── checkEventEligibility.ts
    ├── researchEdition.ts
    ├── analyzeVideo.ts               # Gemini-only
    └── knowledgeBase.ts
```

### Layer responsibilities

**Provider** (`services/ai/providers/*.ts`): Thin SDK wrapper. Knows exactly one SDK. Exposes a function such as:

```typescript
// providers/gemini.ts
export function createGeminiProvider() {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return {
    complete(opts: {
      prompt: string;
      model?: string;
      responseSchema?: unknown;
      temperature?: number;
    }): Promise<{ text: string }>;
  };
}
```

The provider **does not know about business operations** (enrich, chat, etc.). It is replaceable: any other Gemini SDK could be swapped in by editing this one file. The OpenAI provider mirrors this shape exactly — same return type, same options keys (with `responseSchema` translated to OpenAI's JSON-mode tool format internally). Same arguments work for both providers from the route's perspective.

**Prompt module** (`services/ai/prompts/<op>.ts`): One module per business operation. Pure — no SDK, no HTTP. For the four shared operations, the module exports two prompt builders (one per provider) **and** a single shared parser:

```typescript
// prompts/enrich.ts
export interface EnrichArgs {
  companyName: string;
  keyPerson?: string;
  city?: string;
}

export interface EnrichResult {
  website?: string;
  keyPersonName?: string;
  keyPersonTitle?: string;
  keyPersonEmail?: string;
  // ... (matches the existing /enrich response shape)
}

export function buildGeminiEnrichPrompt(args: EnrichArgs): string {
  /* the prompt text moved verbatim from gemini.ts */
}

export function buildOpenaiEnrichPrompt(args: EnrichArgs): string {
  /* the prompt text moved verbatim from gpt.ts */
}

export function parseEnrichResponse(text: string): EnrichResult {
  /* the parser logic moved from whichever route currently has it (or merged
     if the two routes had near-identical parsers — common case) */
}
```

For the five single-provider operations, the module just exports one prompt builder and a parser.

**Route handler** (`routes/{gpt,gemini}.ts`): Stays where it is, but each handler shrinks from ~100–200 LOC to ~10–15 LOC of HTTP plumbing:

```typescript
router.post('/enrich', async (req, res) => {
  try {
    const args = req.body as EnrichArgs; // (validation rules unchanged)
    if (!args.companyName?.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    const provider = createGeminiProvider();
    const prompt = buildGeminiEnrichPrompt(args);
    const { text } = await provider.complete({ prompt, model: 'gemini-2.5-flash-lite' });
    const result = parseEnrichResponse(text);
    return res.json(result);
  } catch (error) {
    console.error('[enrich] Error:', error);
    return res.status(500).json({ error: 'Enrichment failed' });
  }
});
```

### Type contract

```typescript
// types.ts
export interface AiCompletionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  responseSchema?: unknown; // SDK-specific schema (Type.OBJECT for Gemini, JSON-mode tool for OpenAI)
  maxOutputTokens?: number;
}

export interface AiCompletionResponse {
  text: string;
  // future: tokens, finishReason — not added until sub-project #3 (observability)
}

export class AiProviderError extends Error {
  constructor(
    public readonly provider: 'gemini' | 'openai',
    public readonly cause: unknown,
    message: string,
  ) {
    super(message);
  }
}
```

The provider-specific schema field stays loosely typed (`unknown`) — each prompt module owns the schema for its own operation, and providers pass it through to their SDK.

### What "shared" means

The four operations duplicated across `gpt.ts` and `gemini.ts` are **business-shared, not text-shared**. Inspection during scoping showed the actual prompt text differs in wording and emphasis between the two providers (each has been hand-tuned to its model's strengths). What IS shared:

- The output JSON shape (so `parseEnrichResponse` works for both providers' outputs)
- The input args
- The endpoint contract

The module exports **two** prompt-builder functions plus **one** parser. We do not attempt to make a single prompt that works for both providers.

---

## 4. Migration approach per endpoint

For each endpoint, the migration is mechanical:

1. Read the current route handler. Identify three blocks: validation, prompt + SDK call, response parsing.
2. Create the prompt module file. Move the prompt string verbatim into a `buildXxxPrompt(args)` function. Move the parser into `parseXxxResponse(text)`.
3. If the operation is shared between providers, repeat (2) for the other side, ending with two builder functions and one parser (or two parsers if their behavior was genuinely different — verify before merging).
4. In the route handler: import the prompt module + the provider, replace the body with the thin pattern shown in §3.
5. Add a test file for the prompt module (`prompts/enrich.test.ts`).
6. Run `npm run typecheck:api` + `npm test`. Then start the dev server and call the endpoint with a real request payload to verify response shape did not change.
7. Commit.

**Mechanical safety rule:** Prompts are moved verbatim. Whitespace, exact wording, JSON schema fields, examples — all preserved as-is. If a prompt has typos or odd phrasing, the typos travel with it. Any "while I'm here" cleanup is a separate commit, gated by the user's approval.

### Test strategy per prompt module

Each prompt module gets a focused test:

- `buildXxxPrompt(args)` returns a string that contains the relevant args (assertion: `expect(prompt).toContain(args.companyName)`).
- `parseXxxResponse(text)` correctly extracts well-formed AI output (use a representative real response captured during scoping, redacted).
- `parseXxxResponse(malformedText)` returns the documented fallback (empty object, partial result, or thrown error — whichever the current code does).
- Edge cases: empty args, missing optional args, response with extra fields.

Provider modules get one happy-path + one error-path test each:

- `provider.complete({ prompt: 'hello' })` invokes the mocked SDK with the correct shape.
- A thrown SDK error becomes a typed `AiProviderError`.

Estimated new test count: ~30–40 cases across 11 files.

---

## 5. Tooling & integration

### No new dependencies

All needed pieces exist:

- `@google/genai` and `openai` SDKs are already in deps.
- `zod` (for any args validation) is already in deps — though we keep validation as-is for this pass (minimal change).
- Vitest + helpers from sub-project #2 — reused.

### Test mocks

Sub-project #2's `tests/mocks/gemini.ts` already has `makeGenAi2Mock()` for `@google/genai` and `tests/mocks/openai.ts` has `makeOpenaiMock()`. These get used directly. No new mocks needed.

### Pre-push hook

Already runs `typecheck` + `typecheck:api` + `test`. No changes needed.

### Prettier/ESLint

The new files conform to existing rules. No config changes.

---

## 6. Rollout plan

Each step is one commit, independently revertable. Endpoints with the most complex prompts go in their own commits to keep diffs reviewable.

| #   | Commit                                                  | Scope                                                                                                                                        | Risk       | Verification                                                                                                                  |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | `feat(ai): scaffold provider + types modules`           | Create `types.ts`, `providers/gemini.ts`, `providers/openai.ts` with their tests. Nothing in routes yet imports them.                        | Zero       | `npm test` adds ~6 tests; existing 78 still pass                                                                              |
| 2   | `refactor(ai): extract enrich prompt module`            | `prompts/enrich.ts` with two builders + one parser; `gpt.ts` and `gemini.ts` `/enrich` handlers refactored to use it.                        | **Medium** | Smoke: POST `/api/v1/gemini/enrich` and `/api/v1/gpt/enrich` with a known company; verify response shape matches pre-refactor |
| 3   | `refactor(ai): extract draftEmail prompt module`        | Same pattern for `/draft-email`.                                                                                                             | Medium     | Smoke each endpoint                                                                                                           |
| 4   | `refactor(ai): extract chat prompt module`              | Same pattern for `/chat`.                                                                                                                    | Medium     | Smoke each endpoint                                                                                                           |
| 5   | `refactor(ai): extract strategicAnalysis prompt module` | Same pattern for `/strategic-analysis`.                                                                                                      | Medium     | Smoke each endpoint                                                                                                           |
| 6   | `refactor(ai): extract GPT-only prompts`                | `extractOrganizations.ts`, `checkEventEligibility.ts`, `researchEdition.ts` — single-provider modules; gpt.ts route handlers thinned.        | Low        | Smoke 3 GPT endpoints                                                                                                         |
| 7   | `refactor(ai): extract Gemini-only prompts`             | `analyzeVideo.ts`, `knowledgeBase.ts`.                                                                                                       | Low        | Smoke 2 Gemini endpoints                                                                                                      |
| 8   | `refactor(ai): final cleanup of gpt.ts and gemini.ts`   | Remove dead imports, dead helpers, unused inline regex / utility functions left over after all extractions.                                  | Low        | `npm run lint`, `npm test`, smoke 1 endpoint per file                                                                         |
| 9   | `docs: update STRICT_DEBT.md and README`                | If any `@ts-expect-error` markers in AI files were resolvable as a side-effect, mark resolved. README pointer to `services/ai/` if relevant. | Zero       | Read-through                                                                                                                  |

### Total acceptance

- [ ] `npm test` passes with ~110–120 cases (78 baseline + ~30–40 new)
- [ ] `gpt.ts` < 300 LOC; `gemini.ts` < 300 LOC
- [ ] `services/ai/prompts/` contains exactly 9 modules + their tests
- [ ] `services/ai/providers/` contains exactly 2 modules + their tests
- [ ] Manual smoke test of one endpoint per route file confirms response shape unchanged
- [ ] `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run typecheck:api`, `npm run build` all exit 0
- [ ] Pre-push hook (typecheck + typecheck:api + test) passes
- [ ] Working tree clean

### Rollback plan

Each commit is one endpoint's worth of refactor (commits 2–7) or scaffolding (commits 1, 8, 9). If any commit introduces a regression: `git revert <sha>` returns just that endpoint to the inline pattern. The next commits stay in place.

If commit 1 (scaffolding) needs to be reverted, all subsequent prompt modules get orphaned imports — revert those too. This is the only fan-out scenario.

---

## 7. Risks and mitigations

| ID  | Risk                                                                                                                      | Likelihood | Impact | Mitigation                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Prompt extracted with subtle whitespace difference (one trailing space lost) → AI output drifts                           | Medium     | Medium | Use raw-text triple-backtick literals in TS; copy via the IDE's clipboard, not by retyping. Diff before commit: `wc -c` on extracted prompt vs original block in route file.                                                         |
| R2  | Parser merge across providers conflates different fallback behaviors → one provider silently degrades                     | Medium     | High   | When both routes had a parser, **diff the two implementations** before merging. If they differ in any branch, keep both as `parseGeminiEnrichResponse` / `parseOpenaiEnrichResponse`. The shared module accommodates either pattern. |
| R3  | Provider mock from sub-project #2 doesn't match the actual SDK return shape closely enough; tests pass but reality breaks | Low        | High   | Each prompt-module commit includes a manual smoke test against the dev API server (rollout §6 mandates this).                                                                                                                        |
| R4  | A prompt encodes secrets / customer-specific text that should not move to a service module                                | Very Low   | High   | Read each prompt before extracting. Confirm it contains no PII, API keys, or internal-only context. (Spot check during scoping showed only domain prompts about MICE / event venues — clean.)                                        |
| R5  | Increasing the test count from 78 → ~120 makes `npm test` exceed the "<10s" target from sub-project #2                    | Low        | Low    | Vitest parallelizes by default. If it slows: split tests into project groups using vitest's `--project` option. Out of scope unless triggered.                                                                                       |
| R6  | The 9 prompt modules + 2 provider modules + tests = ~22 new files; adds folder noise                                      | Low        | Low    | The folder structure in §3 is intentional — domain (prompts) separated from infrastructure (providers) separated from contract (types). Each file has one responsibility.                                                            |

---

## 8. Open questions

None at this stage. Brainstorming resolved:

- Decompose original #4 into 4a/4b/4c/4d (this spec is 4a only).
- Single AI service folder under `api/src/services/ai/`.
- Per-operation prompt module with provider-specific builders + shared parser.
- Verbatim prompt extraction (no rewording).
- Out of scope: excelImport, leadScoringService, vertex.ts; route-path unification; new providers.

---

## 9. Next steps after approval

1. User reviews this spec; approve or request changes.
2. Hand off to `writing-plans` skill to expand §6's rollout into bite-sized step-by-step commits.
3. Implement; on completion, this unblocks #4b (refactor `LeadDetail.tsx`) and #4c (refactor `EventModal.tsx`).
