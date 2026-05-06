# Test Infrastructure + Smoke Tests — Design Spec

**Date:** 2026-05-06
**Status:** Draft (awaiting user review)
**Sub-project:** #2 of the codebase optimization roadmap
**Owner:** lanfurama (solo)

---

## 1. Context

Sub-project #1 (cleanup + tooling baseline, completed in commits `d118e37..32bda5f`) installed ESLint, Prettier, full TypeScript strict, Zod env validation, and husky/lint-staged hooks. Sub-project #2 adds the missing layer: an automated test suite covering high-leverage logic.

The codebase has **zero tests today**. Sub-project #4 (refactor god files: `LeadsView.tsx` 1714 LOC, `LeadDetail.tsx` 1621 LOC, `EventModal.tsx` 651 LOC, etc.) cannot proceed safely without a regression net. This spec produces that net at the lowest viable cost.

### Constraints

- Solo developer, commits straight to `main`, no CI yet (sub-project #7).
- Existing pre-push hook runs `tsc --noEmit`. After this sub-project it will also run `npm test`.
- Strategy chosen during brainstorming: **smoke-test mỏng (option A)** — pure utilities + service contracts only. Component tests, real DB, real AI calls, and integration tests are explicitly deferred.

### Pain points addressed

| Symptom                                                                            | Cause                                           | Fix in this spec                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| No way to detect regression when refactoring god files                             | No test framework, no tests                     | Section 4 — Vitest + 60–70 test cases on critical pure logic                      |
| AI provider responses are typed loosely (`any`); breakage would surface at runtime | No contract tests on Gemini/OpenAI/Vertex calls | Section 4 — service-level tests with mocked SDKs verifying call shape and parsing |
| Env validation (sub-project #1) untested — silent regression possible              | No tests on the Zod schema                      | Section 4 — env.ts schema test cases (required, defaults, invalid coercion)       |
| Pre-push hook only checks types                                                    | Tests can't run yet                             | Section 5 — wire `npm test` into pre-push after type check                        |

---

## 2. Goals & non-goals

### Goals

1. Vitest installed and configured for the repo (root + api/ share one config).
2. Test helpers exist for the three repeating mock patterns: pg pool, AI SDKs, env reset.
3. ~60–70 deterministic test cases covering 7 high-leverage source files.
4. `npm test` exits 0 and runs in under 10 seconds (no real I/O).
5. Pre-push hook runs `npm test` after `npm run typecheck` and `npm run typecheck:api`.
6. README documents test commands and the rule of thumb for what to test.

### Non-goals (explicitly deferred)

- React component tests (deferred until sub-project #4 splits god files; testing 1714 LOC files is wasted effort).
- Real database integration (mock the pg pool at the model boundary; real DB integration belongs to sub-project #5 layer-ization or sub-project #7 CI).
- Real AI provider calls (would burn API quota; mock at SDK boundary).
- Real SMTP / IMAP integration (mock transporter factory).
- E2E or browser tests.
- Coverage thresholds (vanity metric for solo greenfield work; coverage report stays available via `npm run test:coverage` for ad-hoc inspection).
- Test for code that's about to be refactored anyway (god files in sub-project #4).

---

## 3. Architecture

### Framework choice: Vitest

- Already friction-free with Vite (sub-project #1 install pinned `vite@^6`).
- Runs in node and jsdom; we use **node only** for scope A.
- Jest-compatible API (`describe`, `it`, `expect`, `vi.mock`, `vi.fn`, `beforeEach`).
- Significantly faster than Jest on TS — uses the same esbuild pipeline as Vite.
- Built-in coverage via `@vitest/coverage-v8`.

### Single configuration

One `vitest.config.ts` at repo root covers both frontend and api/ tests:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'api/dist', '.husky', 'docs'],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

Single environment is fine because scope A includes no DOM-touching code. When sub-project #4 introduces component tests, add a project-style multi-environment config; that's out of scope here.

### Test file location: co-located

Each test sits next to its source as `<name>.test.ts`. For example:

- `api/src/utils/eventScoring.ts` → `api/src/utils/eventScoring.test.ts`
- `views/IntelligentDataView/scoringUtils.ts` → `views/IntelligentDataView/scoringUtils.test.ts`

Rationale: easier discovery (tests show up next to source in any file tree), easier rename refactors (move both together), no parallel folder hierarchy to maintain.

### Mocking strategy

The codebase has 4 boundaries that must NOT execute in tests. Each gets a defined pattern:

| Boundary                                          | Mock approach                                                                                                                                                                                                   | Helper file             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `pg.Pool` (database)                              | `vi.mock('pg', () => ({ default: { Pool: MockPool } }))` with a `MockPool` class that has a `query` `vi.fn()` we configure per test                                                                             | `tests/mocks/pg.ts`     |
| `@google/genai`, `@google/generative-ai` (Gemini) | `vi.mock(...)` returning a fake `GoogleGenAI` / `GoogleGenerativeAI` whose `getGenerativeModel` returns a `generateContent` `vi.fn()` we control                                                                | `tests/mocks/gemini.ts` |
| `openai` (GPT)                                    | `vi.mock('openai')` with chat completions `vi.fn()`                                                                                                                                                             | `tests/mocks/openai.ts` |
| `process.env`                                     | Helper `setEnv(overrides)` / `restoreEnv()` used in `beforeEach`/`afterEach`. Required because `env.ts` reads at module init, so the test must `vi.resetModules()` between cases when it cares about env shape. | `tests/helpers/env.ts`  |

`tests/setup.ts` registers global hooks: deterministic `Math.random` seed if any code under test uses it, default `process.env.NODE_ENV = 'test'`, restore after each test.

### Helpers vs framework

We deliberately do NOT install `vitest-mock-extended`. The mocks needed for scope A are simple enough that hand-rolled `vi.fn()` patterns are clearer and require no extra dependency.

---

## 4. Test targets

Seven files, ordered by ROI (highest first). Per the brainstorming decision, exactly these — adding more is out of scope.

### 4.1 `api/src/utils/eventScoring.ts` (406 LOC) — pure

Cases (~15):

- Phone validation: valid international, valid local, invalid (too short, contains letters, empty).
- Email validation: valid, invalid (missing @, missing TLD, malformed local part).
- Score calculation: known input → known score (3-4 representative scenarios from real data).
- Edge cases: empty string, null-ish inputs (`undefined`, `''`, whitespace), non-string types.

No mocks. Pure functions in/out.

### 4.2 `api/src/utils/dataQuality.ts` (465 LOC) — pure

Cases (~12):

- `detectDataIssues`: spot known data problems (missing fields, malformed phone, missing email).
- `calculateDataQualityScore`: monotonic — more issues → lower score; clamps to [0, 100].
- `extractOrganizationName` and `extractEventName`: known input strings → expected extracted name.
- Edge cases: empty row, all-null row, partially-filled row.

No mocks.

### 4.3 `views/IntelligentDataView/scoringUtils.ts` (402 LOC) — pure (frontend)

Frontend mirror of eventScoring. Tests should match cases in 4.1 where the logic is duplicated, plus any frontend-specific scoring.

Note for refactor: this duplication itself is a smell — sub-project #4 or #5 should consolidate these. The test exists here to lock in current behavior before that consolidation.

Cases (~10).

### 4.4 `api/src/config/env.ts` (67 LOC) — Zod schema

Cases (~6):

- All required keys present with valid values → parses successfully, `env` has expected types after coercion (numbers from string env, default values applied).
- Missing required key (e.g., `DB_HOST`) → `safeParse` returns `success: false` with that field in error.
- Invalid coercion (e.g., `DB_PORT=not-a-number`) → fail.
- Optional keys absent → parse succeeds, optional fields are `undefined`.
- `EMAIL_HOST_USER` invalid email → fail with email format error.
- `NODE_ENV` outside enum → fail.

Implementation note: because `env.ts` calls `process.exit(1)` on failure at module load, tests use `vi.resetModules()` and import dynamically inside each test. The `process.exit` is captured via `vi.spyOn(process, 'exit').mockImplementation(...)` to prevent the test runner from dying.

### 4.5 `utils/leadUtils.ts` + `utils/leadEnrichUtils.ts` (149 LOC combined) — pure (frontend)

Cases (~8) covering these specific exports:

- `leadUtils.mapLeadFromDB` (snake_case row → camelCase `Lead`): valid full row, missing optional fields, null-vs-undefined coercion.
- `leadUtils.mapLeadToDB` (camelCase → snake_case): round-trip via `mapLeadToDB(mapLeadFromDB(row))` preserves data.
- `leadEnrichUtils.isLeadMissingPersonInfo`: `true` for empty `keyPersonName`/`keyPersonEmail`, `false` when present, edge case `' '` (whitespace).
- `leadEnrichUtils.parseEnrichResponse`: well-formed AI response text → structured `ParsedEnrichContact`; malformed text → safe defaults; empty input → safe defaults.

### 4.6 `api/src/services/leadScoringService.ts` (210 LOC) — service with Gemini mock

Cases (~5):

- `scoreLead(lead)` with mocked Gemini returning a parseable score → returns numeric score in [0, 100].
- Mocked Gemini returns malformed JSON → service handles gracefully (catches, returns fallback or throws documented error).
- Mocked Gemini throws (rate limit / network) → service handles gracefully.
- Score request sends correct prompt shape (assert on the call args to `generateContent`).
- Mock pg pool: model-layer reads (LeadModel, EmailLogModel, EmailReplyModel) called with expected args.

### 4.7 `api/src/services/reportStatsService.ts` (223 LOC) — service with pg mock

Cases (~5):

- `getStats({ frequency: 'daily' })` with mocked `query` returning canned rows → returns expected stats shape.
- Date range computation: weekly produces Monday→Sunday range; monthly produces 1st→last.
- Empty result set → returns zeroed stats, no error.
- pg query throws → propagates / wraps appropriately.
- Switch case branches all reachable.

---

## 5. Tooling integration

### Package additions

| Package               | Role                                    |
| --------------------- | --------------------------------------- |
| `vitest`              | Test runner                             |
| `@vitest/coverage-v8` | Coverage report (no threshold enforced) |

No new types packages required (`@types/node` and `@types/react` already present from sub-project #1).

### Scripts

Append to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### Pre-push hook update

`.husky/pre-push`:

```sh
echo "Running typecheck before push (compensates for missing CI)..."
npm run typecheck && npm run typecheck:api && npm test
```

Tests must run after type checks because a broken type check produces flaky test output that masks the real cause.

### Pre-commit hook

Stays unchanged — `lint-staged` only. Rationale: `npm test` runs the full suite (~10s); on every commit that's friction the user explicitly opted out of in sub-project #1.

### README update

Add a "Testing" subsection documenting:

- `npm test` / `npm run test:watch` / `npm run test:coverage`
- Convention: co-located `*.test.ts`, mock at module boundary, no real I/O
- Pointer to `tests/mocks/` and `tests/helpers/` as starting templates

---

## 6. Rollout plan

Each step is one commit, independently revertable.

| #   | Commit                                                            | Scope                                                                                                  | Risk                     | Verification                                                                         |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------ |
| 1   | `chore: install vitest + config`                                  | Install vitest + @vitest/coverage-v8, create vitest.config.ts, tests/setup.ts, scripts in package.json | Zero                     | `npm test` runs to completion (no tests yet → "no test files found" or 0 tests pass) |
| 2   | `chore(tests): add helpers (mockPg, mockGemini, mockOpenai, env)` | Create `tests/mocks/{pg,gemini,openai}.ts` and `tests/helpers/env.ts`                                  | Zero                     | `npm test` still exits 0                                                             |
| 3   | `test: eventScoring.ts`                                           | ~15 cases on pure scoring functions                                                                    | Low                      | `npm test` passes; tests cover phone/email/scoring branches                          |
| 4   | `test: dataQuality.ts`                                            | ~12 cases on validation/quality scoring                                                                | Low                      | `npm test` passes                                                                    |
| 5   | `test: scoringUtils.ts (frontend)`                                | ~10 cases mirroring 4.1 patterns                                                                       | Low                      | `npm test` passes                                                                    |
| 6   | `test(config): env.ts zod schema`                                 | ~6 cases on required/optional/coerce/enum                                                              | Low                      | `npm test` passes                                                                    |
| 7   | `test: leadUtils + leadEnrichUtils`                               | ~8 cases                                                                                               | Low                      | `npm test` passes                                                                    |
| 8   | `test: leadScoringService + reportStatsService`                   | ~10 cases with mocked Gemini and mocked pg                                                             | Medium (mock complexity) | `npm test` passes; AI/DB never called for real                                       |
| 9   | `chore: wire pre-push test gate + README`                         | Update `.husky/pre-push`, append README test section                                                   | Zero                     | Trigger pre-push manually, observe typecheck → tests in order                        |

### Total acceptance criteria

- [ ] `npm test` exits 0 with ~60–70 cases passing
- [ ] `npm run test:coverage` runs without error (coverage report generated, no threshold check)
- [ ] All tests complete in under 10 seconds total
- [ ] Pre-push hook runs typecheck → typecheck:api → tests; any failure blocks push
- [ ] No real network/DB/AI/SMTP/IMAP calls during `npm test` (verifiable by running with no `.env`)
- [ ] README documents test conventions
- [ ] Working tree clean

### Rollback plan

Each test commit is isolated. If a test commit introduces a flake or false positive, `git revert <sha>` removes it cleanly. The infrastructure commits (1, 2, 9) are config-only and trivially revertable.

---

## 7. Risks and mitigations

| ID  | Risk                                                                                           | Likelihood          | Impact                                         | Mitigation                                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Test discovers a real bug in pure utility code (e.g., scoring edge case that returns `NaN`)    | Medium              | Low — actually a win                           | When found, document in commit message; don't fix in the test PR (keeps test commits behavior-neutral). Open follow-up.                                                                                                                                                                         |
| R2  | Mock setup for Gemini/OpenAI doesn't match real SDK shape exactly                              | Medium              | Low — caught at first integration test failure | Verify mock shape against real SDK types (`@google/genai` types are typed; lean on TS to keep mock honest).                                                                                                                                                                                     |
| R3  | env.ts test triggers actual `process.exit(1)` during run                                       | High if not handled | High (test runner dies)                        | Use `vi.spyOn(process, 'exit').mockImplementation(() => {})` and `vi.resetModules()` per test. Documented in §4.4.                                                                                                                                                                              |
| R4  | Frontend `scoringUtils.ts` and api `eventScoring.ts` diverge silently because test cases drift | Medium              | Medium                                         | Tests for both reference the SAME canonical cases (define once in `tests/fixtures/scoring.ts`, import into both test files).                                                                                                                                                                    |
| R5  | `npm test` becomes slow as the suite grows                                                     | Low                 | Low                                            | Vitest parallel by default; if it ever exceeds 30s, split via `--project` configs.                                                                                                                                                                                                              |
| R6  | Mocking pg.Pool collides with `dotenv/config` side effects in env.ts at import time            | Medium              | Medium                                         | Standard pattern: at the top of any test file that imports `env.ts`, call `vi.mock('dotenv', () => ({ default: { config: vi.fn() } }))`. Vitest hoists `vi.mock` above imports automatically. The `tests/helpers/env.ts` helper exports a ready-made `mockDotenv()` to keep call sites uniform. |

---

## 8. Open questions

None at this stage. Brainstorming resolved:

- Scope = option A (pure utilities + service contracts).
- Framework = Vitest.
- File location = co-located.
- Mocking = at module boundary, hand-rolled `vi.fn()`.
- Pre-push integration = yes.
- Coverage threshold = no.

---

## 9. Next steps after approval

1. User reviews this spec and approves or requests changes.
2. Hand off to `writing-plans` skill to produce a step-by-step implementation plan from §6's rollout table.
3. Implement plan; on completion this sub-project unblocks #4 (refactor god files).
