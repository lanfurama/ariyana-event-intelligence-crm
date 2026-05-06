# Cleanup + Tooling Baseline — Design Spec

**Date:** 2026-05-06
**Status:** Draft (awaiting user review)
**Sub-project:** #1 of the broader codebase optimization roadmap (Strategy A: foundation-first)
**Owner:** lanfurama (solo)

---

## 1. Context

The Ariyana Event Intelligence CRM codebase (~22,661 LOC across ~95 TS/TSX files) is being optimized to be easier to maintain and upgrade. This document scopes the **first** sub-project: a tooling and cleanup baseline that introduces zero behavior changes while installing the safety rails everything else depends on.

This sub-project must complete before:

- #2 Test infra (Vitest needs lint config to align)
- #4 Refactor god files (refactoring without strict types is unsafe)
- #5 Layer-ize API
- #7 CI pipeline (CI runs the scripts defined here)

### Constraints

- Solo developer, commits straight to `main`, no PR review.
- No CI yet — pre-push hook is the only automated gate before remote.
- Strategy A (foundation-first) was chosen over pain-driven or architecture-first.

### Pain points addressed

| Symptom                                                             | Cause                                              | Fix in this spec                                     |
| ------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| 21 deleted files lingering in working tree                          | No discipline around cleanup                       | Section 3 — explicit deletion plan                   |
| `process.env.X` scattered, app crashes mid-request when key missing | No env validation                                  | Section 6 — Zod schema with fail-fast boot           |
| No way to detect type/lint regressions                              | No ESLint, no Prettier, near-empty `tsconfig.json` | Sections 4 & 5 — full strict TS + ESLint flat config |
| Inconsistent formatting drift over time                             | No formatter                                       | Section 4 — Prettier + lint-staged on pre-commit     |
| Type errors discovered only at runtime                              | Strict mode disabled                               | Section 5 — full strict, manual fix pass             |
| Risk of accidentally pushing broken code to `main`                  | No CI, no pre-push gate                            | Section 4 — pre-push hook runs `tsc --noEmit`        |

---

## 2. Goals & non-goals

### Goals

1. Working tree clean, `.gitignore` covers reasonable noise.
2. ESLint + Prettier installed, configured, and producing zero errors.
3. TypeScript `strict: true` plus selected stricter flags; `tsc --noEmit` exits 0.
4. Environment variables validated at server boot via Zod; fail-fast if invalid.
5. Pre-commit hook runs `lint-staged` (ESLint --fix + Prettier on changed files).
6. Pre-push hook runs `tsc --noEmit` (compensates for absence of CI).
7. README updated to reflect new setup commands; broken links removed.

### Non-goals (explicitly deferred to other sub-projects)

- Refactor god files such as `LeadsView.tsx` (1,714 LOC), `LeadDetail.tsx` (1,621 LOC), `gpt.ts` (1,088 LOC), `gemini.ts` (915 LOC) — sub-project #4.
- Test framework and tests — sub-project #2.
- Structured logger / error boundary / observability — sub-project #3.
- Layer-ization (routes → services → models) — sub-project #5.
- Migration runner — sub-project #6.
- CI pipeline (GitHub Actions) — sub-project #7.
- Bundle splitting / lazy loading — sub-project #9.
- Rewriting git history to purge CSV lead data (flagged here, addressed separately if needed).

---

## 3. Cleanup phase

### Files to delete (21 already in deleted state)

**Decision:** Delete outright. Git history preserves them; no `archive/` folder. Folders like `archive/` accumulate cruft and signal unresolved tech debt.

| Group               | Files                                                                                           | Rationale                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Old docs            | `EMAIL_REPORTS_SETUP.md`, `OPTIMIZATION_REPORT.md`, `TEST_EMAIL_REPORT.md`                      | Will be replaced in sub-project #10                               |
| Lead CSV data       | `Normal.csv`, `Portfolio_Database_with_Country.csv`, `Potential Lead for ACC_26Feb.csv`         | Customer data — must not live in working tree. **⚠ See Risk R1.** |
| One-off SQL imports | `database_schema.sql`, `scripts/import_*.sql` (7 files), `scripts/generate_*.{py,ts}` (5 files) | `migrations/` is the source of truth                              |
| Windows utility     | `fix-git-secrets.ps1`                                                                           | One-time tool, no longer needed                                   |
| Legacy template     | `html_templates/leads_2026FEB_ThaiACC_old.html`                                                 | Already suffixed `_old`                                           |

### `.gitignore` additions

Append to existing `.gitignore`:

```
# OS
.DS_Store

# Editor
.vscode/
.idea/

# Build / cache
dist/
coverage/
.turbo/
*.tsbuildinfo

# Logs
*.log
npm-debug.log*

# Data
*.csv
!env.example

# Local env overrides
.env.local
.env.*.local
```

### History audit (read-only — flag, do not act)

Run `git log --all --diff-filter=A --name-only -- '*.csv'`. If any CSV with real lead data appears in history, surface to user with separate spec for `git filter-repo` rewrite. Out of scope here.

---

## 4. Tooling stack

### New devDependencies

| Package                       | Version       | Role                                              |
| ----------------------------- | ------------- | ------------------------------------------------- |
| `eslint`                      | ^9            | Linter (flat config)                              |
| `typescript-eslint`           | ^8            | TypeScript parser + rules                         |
| `eslint-plugin-react`         | latest stable | React rules                                       |
| `eslint-plugin-react-hooks`   | latest stable | Exhaustive-deps, rules-of-hooks                   |
| `eslint-plugin-react-refresh` | latest stable | Vite HMR-safe export check                        |
| `eslint-config-prettier`      | latest        | Disable formatting rules ESLint would conflict on |
| `prettier`                    | ^3            | Formatter                                         |
| `husky`                       | ^9            | Git hooks                                         |
| `lint-staged`                 | ^15           | Run linters on staged files                       |

`zod` already exists in dependencies — reused for env validation (Section 6).

### Configuration files

| Path                 | Purpose                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `eslint.config.js`   | Flat config; ignores `dist/`, `node_modules/`, `api/v1/[...path].d.ts`                          |
| `.prettierrc.json`   | 2-space indent, single quote, trailing comma `all`, 100 col print width, semicolons on          |
| `.prettierignore`    | `node_modules/`, `dist/`, `coverage/`, generated files, `migrations/*.sql`                      |
| `.husky/pre-commit`  | `npx lint-staged`                                                                               |
| `.husky/pre-push`    | `npm run typecheck && npm run typecheck:api`                                                    |
| `.lintstagedrc.json` | `*.{ts,tsx}` → `eslint --fix` + `prettier --write`; `*.{json,md,css,html}` → `prettier --write` |

### `package.json` script additions

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "typecheck:api": "tsc --noEmit -p api/tsconfig.json",
    "prepare": "husky"
  }
}
```

### ESLint rule philosophy

Solo dev, format auto, ignore bikeshed.

- Base: `tseslint.configs.recommended` + `react-hooks/recommended` + `react-refresh/recommended`.
- **Not** enabling `recommended-type-checked` yet (slow, noisy on a not-yet-strict-clean codebase). Revisit after sub-project #4.
- `no-console: 'warn'` (`console.error` and `console.warn` allowed). This nudges toward the future structured logger from sub-project #3 without blocking.
- `@typescript-eslint/consistent-type-imports: 'error'` (auto-fix supplies `import type`) — pairs with `verbatimModuleSyntax`.
- No `import/order` rule yet (would balloon the diff; introduce in a later cosmetic pass).

### Prettier rationale

- Single source of formatting truth — ESLint has no formatting rules.
- Pre-commit auto-fix means humans never argue about commas.

### Hook strategy rationale

- **Pre-commit** is fast (`lint-staged` only touches staged files): formatting + lint --fix. **Blocks** commit if ESLint reports an error on the staged set.
- **Pre-push** runs `tsc --noEmit` (slower, full-project). Blocks pushing broken types to `main`. This is the safety net that compensates for the absence of CI.
- **No** test step in either hook (no tests exist yet — sub-project #2).

---

## 5. TypeScript strict migration

### Target `tsconfig.json` (root)

```jsonc
{
  "compilerOptions": {
    // ... existing options preserved ...

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
  },
}
```

`api/tsconfig.json` extends the root config so both share the same strict baseline; only `lib`, `types`, and `module` differ between browser and Node targets.

### Fix strategy

Estimated 300–800 errors will surface, concentrated in god files.

1. **Auto-fix wave.** ESLint `consistent-type-imports`, unused-vars (with `_` prefix to ignore), and Prettier-adjacent fixes resolve ~30–40% mechanically.
2. **Manual null/undefined wave.** Patterns:
   - `useState<T>()` lacking initializer → provide one or widen to `T | undefined`.
   - `.find()` / `Map.get()` → narrow with guard or `?? fallback`.
   - `process.env.X` is no longer a concern at this point: Section 6 (env validation) runs **before** strict mode is enabled in the rollout (see Section 7), so all consumers already use the typed `env.*` accessor.
3. **Strategic surrender on god files.** Where a clean fix would require restructuring (a job for sub-project #4), the rule is:
   - Use `// @ts-expect-error TODO(refactor): <one-line reason>` rather than `// @ts-ignore`.
   - Append the file:line and reason to a new `STRICT_DEBT.md` at repo root.
   - `STRICT_DEBT.md` becomes the input checklist for sub-project #4.

### Risk control on god files

User chose full strict despite no test coverage on `LeadsView.tsx` (1,714 LOC), `LeadDetail.tsx` (1,621 LOC), and others. Discipline:

- **Type-level edits only**: add `?`, `??`, type narrowing guards, safe assertions.
- **No logic refactoring** during this sub-project.
- Any fix that would change runtime behavior → use `@ts-expect-error` + `STRICT_DEBT.md` entry, defer to sub-project #4 where tests will be in place.

### Acceptance

- `npm run typecheck` exits 0.
- `npm run typecheck:api` exits 0.
- `npm run dev` and `npm run dev:api` still boot.
- Manual smoke test: open the app, navigate to Leads / Dashboard / Email Templates, confirm pages render.
- `STRICT_DEBT.md` exists if any `@ts-expect-error TODO(refactor)` markers were added; otherwise no file needed.

---

## 6. Environment validation with Zod

### New file: `api/src/config/env.ts`

```typescript
import { z } from 'zod';
import 'dotenv/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  VERTEX_AI_PROJECT_ID: z.string().optional(),
  VERTEX_AI_LOCATION: z.string().default('us-central1'),

  IMAP_HOST: z.string().optional(),
  IMAP_USER: z.string().optional(),
  IMAP_PASSWORD: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  PORT: z.coerce.number().int().positive().default(3000),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
```

> **Note:** This schema reflects the keys observed in `env.example` and current `process.env.*` usage. Any keys discovered during the refactor pass that are not in the schema must be added before merging — the rule is "schema is the contract, drift is forbidden."

### Refactor pass

`grep -rn 'process\.env\.' api/ services/ utils/` → replace each call site with `import { env } from '../config/env'` then `env.X`.

Only `api/src/config/env.ts` may read `process.env` directly.

### Frontend env (Vite)

Vite uses `import.meta.env.VITE_*`. Inspection so far suggests no frontend env vars are wired (correct posture — API keys must not reach the browser). If any are found during implementation, a parallel `src/config/env.ts` module with a separate Zod schema will be created.

### `env.example` synchronization

Update `env.example` to match the schema 1:1: every required key listed, every optional key commented out with example value. The schema in `env.ts` is the source of truth; `env.example` is a manual mirror reviewed during code review of this commit.

### Acceptance

- Booting `npm run dev:api` with a valid `.env` works as before.
- Booting with a missing required key fails with a readable error listing the offending fields, before any HTTP listener starts.
- `grep -rn 'process\.env\.' api/ services/ utils/ --include='*.ts'` returns only the line inside `api/src/config/env.ts`.

---

## 7. Rollout plan

Each step is a single commit, independently revertable. No long-lived branches.

| #   | Commit message                                     | Scope                                                                                                                                          | Risk                                                           | Verification                                                                                                              |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | `chore: cleanup legacy files and update gitignore` | Delete 21 files, update `.gitignore`                                                                                                           | Zero (already deleted in working tree)                         | `npm run dev` boots, `npm run dev:api` boots                                                                              |
| 2   | `chore: setup prettier`                            | Install, configure, run `npm run format` once on entire repo                                                                                   | Whitespace-only changes                                        | `git diff --stat` shows only formatting; app still runs                                                                   |
| 3   | `chore: setup eslint flat config`                  | Install, configure; do not fix yet                                                                                                             | Zero (config-only)                                             | `npm run lint` runs to completion (errors allowed at this step)                                                           |
| 4   | `fix: eslint auto-fix pass`                        | `npm run lint:fix`, plus manual fixes for non-auto cases that don't change behavior                                                            | Low — auto-fix is conservative                                 | `npm run lint` exits 0; manual smoke test of 2–3 main views                                                               |
| 5   | `feat(config): zod env validation`                 | Add `api/src/config/env.ts`, refactor all `process.env.*` consumers, sync `env.example`. Done **before** strict mode so step 7 sees typed env. | Medium — fail-fast may surface a key that was actually missing | `npm run dev:api` boots with current `.env`; deliberately remove a key, confirm fail-fast                                 |
| 6   | `chore: enable typescript strict mode`             | Update `tsconfig.json` and `api/tsconfig.json` only                                                                                            | Zero at runtime; build will break — that's expected            | `npm run dev` still boots (vite is permissive); `npm run typecheck` fails as expected                                     |
| 7   | `fix: typescript strict — type-level fixes`        | Manual fix pass; `STRICT_DEBT.md` for unfixable cases                                                                                          | **Highest** — touches god files                                | `npm run typecheck` and `npm run typecheck:api` exit 0; smoke test golden path (Leads view, Dashboard, send a test email) |
| 8   | `chore: setup husky and lint-staged`               | Install hooks, add `prepare` script                                                                                                            | Zero                                                           | Make a trivial commit, observe pre-commit running; attempt a push, observe pre-push running                               |
| 9   | `chore: update README`                             | Document new scripts, remove dead `SECURITY_CHECK.md` link                                                                                     | Zero                                                           | Read-through                                                                                                              |

### Total acceptance criteria

- [ ] `npm run lint` exits 0
- [ ] `npm run format:check` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm run typecheck:api` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run dev` boots and main routes render
- [ ] `npm run dev:api` boots with valid `.env`; fails fast with clear error on invalid `.env`
- [ ] Pre-commit hook fires on `git commit`; pre-push hook fires on `git push`
- [ ] Working tree clean (no leftover deleted files)
- [ ] `STRICT_DEBT.md` exists at repo root if any `@ts-expect-error TODO(refactor)` markers were added; otherwise omitted

### Rollback plan

Because commits land directly on `main`, `git revert <sha>` is the rollback for any single step. Steps 1–4 are config/format only. Step 7 (the type fix wave) carries the most risk; if a runtime regression is found post-merge, revert step 7 and reopen with smaller, file-scoped follow-up commits.

---

## 8. Risks and mitigations

| ID  | Risk                                                                                           | Likelihood | Impact         | Mitigation                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| R1  | CSV files contain real customer data; may exist in git history                                 | High       | High (privacy) | Out of scope here; flag to user with `git log --all` audit. Separate spec if confirmed.                                  |
| R2  | Strict TS forces unsafe fix on god file → silent runtime regression                            | Medium     | High           | Discipline: type-level edits only; `@ts-expect-error TODO(refactor)` for anything questionable; smoke test after step 6. |
| R3  | `exactOptionalPropertyTypes` produces a wave of errors on React props                          | Medium     | Medium         | Acceptable — fixable mechanically by changing `T                                                                         | undefined`to`T?`or vice versa. If volume is unmanageable, this single flag may be deferred (note in`STRICT_DEBT.md`). |
| R4  | Env validation reveals a key was always missing in someone's `.env`                            | Low        | Low            | That's the point — fail-fast is the desired behavior. Document in README.                                                |
| R5  | `noUnusedLocals` removes a parameter the framework reads by convention                         | Low        | Medium         | Use `_` prefix to opt out per-occurrence.                                                                                |
| R6  | Husky `prepare` script fails on a fresh `npm install` if `.git` is absent (e.g., Docker build) | Low        | Low            | `prepare` failures are non-fatal in npm; document workaround in README if it surfaces.                                   |

---

## 9. Open questions

None at this stage. All branching decisions answered during brainstorming:

- Solo dev → relaxed enforcement, no commitlint.
- Commits straight to `main` → pre-push runs typecheck.
- Full TS strict → accept higher upfront fix cost.
- Pre-commit balanced → lint-staged blocks ESLint errors on staged files only.
- Zod env validation → fail-fast at boot.
- Cleanup → delete outright, no `archive/` folder.

---

## 10. Next steps after approval

1. User reviews this spec and approves or requests changes.
2. Hand off to `writing-plans` skill to produce a step-by-step implementation plan derived from Section 7's rollout table.
3. Implementation per the plan.
4. On completion, this sub-project unblocks #2 (test infra) and #4 (refactor god files).
