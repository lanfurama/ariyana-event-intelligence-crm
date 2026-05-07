# Claude Project Context — Ariyana Event Intelligence CRM

> Loaded automatically by Claude Code at session start. Keep tight (~200 lines). For full architecture details see README.md; for refactor specs see `docs/superpowers/`.

## Project

Event-intelligence CRM with React 19 + TS strict frontend (Vite), Express + Postgres backend (`api/`), and AI integrations (Gemini + Vertex + OpenAI). Solo dev. Active codebase optimization (sub-projects #1–#10) — see roadmap below.

## Conventions

- **Solo dev, commits straight to `main`.** No PRs, no review.
- **No CI yet (sub-project #7).** Pre-push hook runs `npm run typecheck && npm run typecheck:api && npm test` — that's the only gate. Never bypass with `--no-verify` unless explicitly authorized.
- **Pre-commit hook** runs `lint-staged` (ESLint --fix + Prettier on staged files). Blocks on lint errors.
- **No React Testing Library yet.** Component tests are deferred until a future "frontend test infra" sub-project. For UI changes, manual browser smoke is the only safety net — run after every commit, do not batch.
- **Pure helpers + custom hooks** are the testable layers in the frontend. Tests live alongside source: `*.test.ts`.
- **TS strict** is on except for `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (deferred to sub-project #5 — see `STRICT_DEBT.md`).
- Daily scripts: `npm run lint | lint:fix | format | format:check | typecheck | typecheck:api | build | test | test:watch | test:coverage`.

## Where things live

- `STRICT_DEBT.md` — canonical tracker for `@ts-nocheck` / `@ts-expect-error` markers + deferred TS flags. Update its "Resolved" section when clearing markers.
- `docs/superpowers/specs/YYYY-MM-DD-<name>-design.md` — design specs (immutable once written).
- `docs/superpowers/plans/YYYY-MM-DD-<name>.md` — step-by-step implementation plans.
- `api/src/services/ai/` — AI provider abstraction (prompts in `prompts/`, scaffolded providers in `providers/`).
- `views/IntelligentDataView/EventModal/` — exemplar of refactor pattern (sub-project #4c done).

## Refactor roadmap status (as of 2026-05-07)

| Sub-project                                           | Status         | Notes                                                                     |
| ----------------------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| #1 Cleanup + tooling baseline                         | ✅ done        | Prettier, ESLint flat, TS strict, Zod env, husky                          |
| #2 Test infra                                         | ✅ done        | Vitest, 183 tests across 20 files                                         |
| #3 Structured logger / observability                  | pending        |                                                                           |
| #4b Refactor `components/LeadDetail.tsx`              | 🔄 in progress | 1998 LOC `@ts-nocheck`. Plan in 10 commits / ~5 sessions. Task 1/10 done. |
| #4c Refactor `views/.../EventModal.tsx`               | ✅ done        | Template for #4b. 7 sub-components + tested pure data fn.                 |
| #4d Refactor `views/LeadsView.tsx` (1914 LOC)         | pending        | Same playbook as #4b.                                                     |
| #4 Refactor `api/src/routes/excelImport.ts` (973 LOC) | pending        | God file with 2 markers.                                                  |
| #5 API layer-ization + type normalization             | pending        | 5 markers remain (imap×2, excelImport×2 — also #4, managerReport).        |
| #6 node-cron v4 migration                             | pending        | 1 marker (`scheduledReportsJob.ts`).                                      |
| #7 GitHub Actions CI                                  | pending        | Replaces pre-push hook.                                                   |
| #9 Bundle splitting / lazy loading                    | pending        |                                                                           |
| #10 Documentation polish                              | pending        |                                                                           |
| AI provider abstraction (out-of-band)                 | ✅ done        | Prompts extracted to `services/ai/prompts/`. Providers scaffolded.        |

## Currently active: #4b LeadDetail refactor

- **Spec:** `docs/superpowers/specs/2026-05-07-lead-detail-refactor-design.md`
- **Plan:** `docs/superpowers/plans/2026-05-07-lead-detail-refactor.md` (10 tasks)
- **Approach:** Tab + custom hook decomposition (different from EventModal's pure-derive pattern because LeadDetail is genuinely stateful per-tab — 21 useStates split across 3 tab concerns).
- **Target structure:** `LeadDetail.tsx` <100 LOC orchestrator + `LeadDetail/{leadDetailHelpers, useLeadEdit, useLeadEnrichment, useLeadEmail, LeadInfoTab, LeadEnrichTab, LeadEmailTab}`.

### Done

| Task   | Commit    | Notes                                                                           |
| ------ | --------- | ------------------------------------------------------------------------------- |
| Task 1 | `188bcfb` | Extract pure helpers + 27 tests. `LeadDetail.tsx` itself untouched (next step). |

### Next session

1. **Browser smoke** to confirm baseline — Task 1 didn't touch `LeadDetail.tsx`, so this is pre-Task-2 sanity.
2. **Task 2:** swap inline helpers in `LeadDetail.tsx` for imports + replace inline placeholder substitution with `applyTemplatePlaceholders`. Then browser smoke (Info + Enrich + Email tabs).
3. **Task 3:** extract `useLeadEdit` hook. Smoke info-tab edit flow.

After Task 3, the riskier hook extractions (Task 4 `useLeadEnrichment`, Task 5 `useLeadEmail` — large) and JSX extractions (Tasks 6–8) follow. Task 9 is the highest-risk: restoring TS strict on the file. Task 10 closes with `STRICT_DEBT.md` update.

## Important decisions log

### LeadDetail refactor (2026-05-07)

- **Tab + hooks vs section-only split.** EventModal split JSX into sub-components and was done. LeadDetail has 21 `useState`s clustered by tab — splitting only JSX would leave all state in the orchestrator. Custom hooks encapsulate per-tab state cleanly. Spec §3.
- **`parseResearchResult` adds `fallbackKeyPerson` param.** The original closed over component state `enrichKeyPerson`. Pure version makes the dependency explicit. Plan said "verbatim copy" — adapted during execution because verbatim wouldn't compile. Commit `188bcfb`.
- **`verifyEmail` signature simplified.** Original's `|| editedLead.website` fallback inside the function was dead code — the only caller already passed `editedLead.website` explicitly. Removed.
- **Buggy parser behavior characterized as tests, not fixed.** Two tests assert that the 5-pattern fallback can override the structured-block name/title with adjacent title-keyword text. Improvements deferred per spec §6 R5; this refactor is structural, not behavioral.

### Strict-debt cleanup (2026-05-07)

- **`docx` shading: bug fix, not type-only.** `val: 'clear'` was being silently ignored at runtime (`createShading` destructures `{ fill, color, type }`, never reads `val`). Fixed to `type: ShadingType.CLEAR`. Commit `feb21c7`.
- **`EmailTemplateAttachment.template_id` made optional.** Smallest change that solves the type error: server fills the field on create/update; frontend never reads it. Cleaner than the `Omit<..., 'template_id'>` payload type the original marker suggested.
- **`vite.config.ts` typed config const.** Extracted async function to a `UserConfigFnPromise`-typed const so TS picks the correct `defineConfig` overload — no marker, no override.
- **`emailReplies.ts` typed payload.** `null` → `undefined` / omit. The model's `|| null` fallback already handles undefined optional fields at insert time, so behavior unchanged.

### Tooling / pattern decisions (older)

- **Pre-push hook is the CI substitute** (chosen during sub-project #1). No external CI yet. Solo + commits-on-main means this is the only gate.
- **Cleanup outright over `archive/` folder.** Decided in sub-project #1 — git history preserves deleted files; folders accumulate cruft.
- **Type-level edits only during strict-mode wave.** No logic refactoring. Where structural changes were needed, `@ts-expect-error TODO(refactor)` markers + `STRICT_DEBT.md` entries (sub-project #1 discipline).
- **AI provider abstraction: prompts extracted, providers scaffolded.** Route handlers still call SDKs directly because endpoints have provider-specific config (Google Search tools, json_object mode, system messages). Wrappers ready for future when those concerns normalize.
