# Cleanup + Tooling Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install a tooling and cleanup baseline (Prettier, ESLint flat config, full TypeScript strict, Zod env validation, husky/lint-staged hooks) and clean the working tree, with zero behavior changes, in 9 independently-revertable commits.

**Architecture:** Each commit is a self-contained, low-risk change. Order matters — env validation runs before strict mode so the strict-fix wave sees typed `env.*` instead of `process.env.*`. The pre-push hook compensates for the absence of CI by running `tsc --noEmit` before code reaches `main`.

**Tech Stack:** ESLint v9 (flat config) + typescript-eslint v8 + Prettier v3 + Husky v9 + lint-staged v15 + Zod (already in deps) + TypeScript ~5.8 + Node + Vite + React 19.

**Source spec:** `docs/superpowers/specs/2026-05-06-cleanup-tooling-baseline-design.md`

**Working directory:** `/Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm` — working directly on `main` (solo dev, no worktree).

---

## File Map

| Path                             | Status               | Responsibility                                                                                                |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `.gitignore`                     | modify               | OS, editor, build output, CSV data, env locals                                                                |
| `.prettierrc.json`               | create               | Prettier formatting rules (single source of formatting truth)                                                 |
| `.prettierignore`                | create               | Skip generated/legacy files from Prettier                                                                     |
| `eslint.config.js`               | create               | Flat-config ESLint (logic rules only, no formatting)                                                          |
| `.lintstagedrc.json`             | create               | Map staged file globs to lint+format commands                                                                 |
| `.husky/pre-commit`              | create               | Run `lint-staged`                                                                                             |
| `.husky/pre-push`                | create               | Run `tsc --noEmit` for both root and api                                                                      |
| `package.json`                   | modify               | Add devDeps + scripts (`lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `typecheck:api`, `prepare`) |
| `tsconfig.json`                  | modify               | Add full strict flags                                                                                         |
| `api/tsconfig.json`              | modify               | Add the new strict flags missing here (already has `strict: true`)                                            |
| `api/src/config/env.ts`          | create               | Zod schema validating all env vars at boot, fail-fast on invalid                                              |
| `env.example`                    | modify               | Synchronize 1:1 with the Zod schema                                                                           |
| `README.md`                      | modify               | Document new scripts; remove dead `SECURITY_CHECK.md` link                                                    |
| `STRICT_DEBT.md`                 | create (conditional) | Only if Task 7 inserts any `@ts-expect-error TODO(refactor)` markers                                          |
| 21 deleted files (working tree)  | delete               | Listed in spec §3                                                                                             |
| All consumers of `process.env.X` | modify               | Replace with `import { env } from '...config/env'` then `env.X`                                               |

---

## Pre-flight

- [ ] **Confirm working tree state**

```bash
cd /Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm
git status --short
git log --oneline -5
```

Expected: 21 deleted files visible. Latest commit is the design spec (`2d42a83 docs: add cleanup + tooling baseline design spec`).

- [ ] **Confirm `.env` exists locally**

```bash
test -f .env && echo "exists" || echo "MISSING — create from env.example before Task 5"
```

If missing, copy `env.example` to `.env` and fill in real values before starting Task 5. Without a valid `.env`, Task 5's verification will not work.

---

## Task 1: Cleanup legacy files + .gitignore

**Files:**

- Delete: 21 files already in deleted state (see spec §3 table). Verify via `git status`.
- Modify: `.gitignore`

- [ ] **Step 1: Stage all 21 deletions**

```bash
git add -u
git status --short
```

Expected: 21 lines starting with `D ` become `D ` in the staged column. Specifically:

- `EMAIL_REPORTS_SETUP.md`
- `Normal.csv`
- `OPTIMIZATION_REPORT.md`
- `Portfolio_Database_with_Country.csv`
- `Potential Lead for ACC_26Feb.csv`
- `TEST_EMAIL_REPORT.md`
- `database_schema.sql`
- `fix-git-secrets.ps1`
- `html_templates/leads_2026FEB_ThaiACC_old.html`
- `scripts/generate_acc_thai_import_sql.py`
- `scripts/generate_hpny2026_import_sql.py`
- `scripts/generate_import_sql.py`
- `scripts/generate_normal_leads_sql.py`
- `scripts/generate_summer_beach_2026_leads_sql.ts`
- `scripts/import_acc_thai_leads_2026feb.sql`
- `scripts/import_corp_dmc_leads.sql`
- `scripts/import_corp_dmc_leads_2026_generated.sql`
- `scripts/import_corp_dmc_leads_generated.sql`
- `scripts/import_hpny2026_postcard_leads.sql`
- `scripts/import_normal_leads_generated.sql`
- `scripts/import_summer_beach_2026_leads.sql`

- [ ] **Step 2: Append additions to `.gitignore`**

Read the current `.gitignore`. The existing file already covers `.env`, `node_modules`, `dist`, `*.log`, `.DS_Store`, `.vscode/*` (with exception), `.idea`, `*.zip`. Append the new sections at the end:

```
# Build / cache
coverage/
.turbo/
*.tsbuildinfo

# Data files (CSV must never be committed; lead data is private)
*.csv
```

(Note: `*.env` exclusion via existing `*.env` pattern already covers `.env`, but `!env.example` re-allows the example template. The CSV pattern is the new addition.)

- [ ] **Step 3: Stage and verify clean diff**

```bash
git add .gitignore
git diff --cached --stat
```

Expected: `.gitignore` change + 21 deletions, no other files touched.

- [ ] **Step 4: Verify dev server still boots**

```bash
npm run dev &
sleep 6 && curl -sf http://localhost:3000/ > /dev/null && echo "OK" || echo "FAIL"
kill %1 2>/dev/null
```

Expected: `OK`.

- [ ] **Step 5: Verify api still boots (if .env exists)**

```bash
test -f .env && (npm run dev:api &) && sleep 5 && curl -sf http://localhost:3001/health > /dev/null 2>&1 && echo "OK" || echo "skipped or no health endpoint — manual check"
pkill -f 'tsx watch' 2>/dev/null
```

If no `/health` endpoint exists, just confirm the process started without error in the terminal.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: cleanup legacy files and update gitignore

Remove 21 legacy files (CSVs, one-off SQL imports, old docs, Windows
utility, _old html template). Git history preserves them. Add .gitignore
patterns for coverage/, .turbo/, *.tsbuildinfo, and *.csv to prevent
future accidental commits of customer data.

Sub-project #1, step 1/9.
EOF
)"
```

---

## Task 2: Setup Prettier

**Files:**

- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json` (add devDep + scripts)

- [ ] **Step 1: Install Prettier**

```bash
npm install --save-dev --save-exact prettier@^3
```

Expected: `prettier` appears in `devDependencies`. Pin exact for reproducible formatting.

- [ ] **Step 2: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
node_modules
dist
dist-ssr
coverage
*.tsbuildinfo
package-lock.json
api/package-lock.json

# Generated by Vercel
.vercel

# SQL migrations are formatted by hand and reviewed
migrations/*.sql

# HTML email templates have specific whitespace requirements
html_templates/

# Vite serverless adapter type declaration is generated
api/v1/[...path].d.ts
```

- [ ] **Step 4: Add scripts to `package.json`**

In the `scripts` block, add after `preview`:

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 5: Run format on entire repo**

```bash
npm run format
```

Expected: Many files reformatted, no errors. The diff will be large but whitespace-only.

- [ ] **Step 6: Verify app still works**

```bash
npm run dev &
sleep 6 && curl -sf http://localhost:3000/ > /dev/null && echo "OK" || echo "FAIL"
kill %1 2>/dev/null
```

Expected: `OK`. If `FAIL`, Prettier should never break code — investigate before committing.

- [ ] **Step 7: Verify format check passes**

```bash
npm run format:check
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .prettierrc.json .prettierignore
git add -u
git commit -m "$(cat <<'EOF'
chore: setup prettier

Install Prettier v3 with project conventions (single quotes, trailing
commas, 100 col, semicolons). Add format/format:check scripts. Apply
to entire repo in this commit so future diffs stay focused on logic
changes only. SQL migrations and html_templates excluded.

Sub-project #1, step 2/9.
EOF
)"
```

---

## Task 3: Setup ESLint flat config (no fixes yet)

**Files:**

- Create: `eslint.config.js`
- Modify: `package.json`

- [ ] **Step 1: Install ESLint and plugins**

```bash
npm install --save-dev eslint@^9 @eslint/js typescript-eslint@^8 \
  eslint-plugin-react eslint-plugin-react-hooks \
  eslint-plugin-react-refresh eslint-config-prettier \
  globals
```

Expected: All packages added to `devDependencies`.

- [ ] **Step 2: Create `eslint.config.js` (root, flat config)**

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-ssr/**',
      'coverage/**',
      '.vercel/**',
      'api/v1/[...path].d.ts',
      'api/dist/**',
      '*.config.js',
      '*.config.ts',
      'vite-plugin-api.ts',
    ],
  },

  // Frontend (React + browser)
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['api/**'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '19' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'react/prop-types': 'off', // using TS
    },
  },

  // Backend (Node)
  {
    files: ['api/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      'no-console': 'off', // server logs via console for now (sub-project #3 will replace)
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Disable formatting rules that would fight Prettier — keep this LAST
  prettierConfig,
);
```

- [ ] **Step 3: Add scripts to `package.json`**

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix"
```

- [ ] **Step 4: Run lint to confirm config loads**

```bash
npm run lint || true
```

Expected: ESLint executes (may report many errors — that's fine, do not fix in this commit). If config fails to parse, fix before committing. The non-zero exit is expected.

- [ ] **Step 5: Capture baseline error count for the next task**

```bash
npm run lint 2>&1 | tail -5
```

Note the error/warning counts in your head — Task 4 should reduce them substantially.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: setup eslint flat config

Install ESLint v9 with typescript-eslint v8, React, hooks, and refresh
plugins. Two project sections (browser + node). Formatting rules
disabled via eslint-config-prettier. Existing lint errors will be
addressed in the next commit.

Sub-project #1, step 3/9.
EOF
)"
```

---

## Task 4: ESLint auto-fix pass

**Files:** Many — whatever ESLint touches.

- [ ] **Step 1: Run ESLint --fix**

```bash
npm run lint:fix || true
```

Expected: Auto-fixable issues resolved (notably `consistent-type-imports` adding `import type {...}`). May still report errors.

- [ ] **Step 2: Inspect remaining errors**

```bash
npm run lint
```

Two outcomes:

**(a) Exit 0:** Skip to Step 4.
**(b) Errors remain:** Continue to Step 3.

- [ ] **Step 3: Resolve remaining errors manually**

For each remaining error, apply the smallest fix that does not change behavior:

| Error rule                                       | Standard fix                                                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-unused-vars` (var unused) | Delete the variable, OR prefix with `_` if it's a function arg required by signature                                                                                                              |
| `react-hooks/exhaustive-deps`                    | Add the missing dep, OR if the omission is intentional, document with a single-line comment explaining why and add an `// eslint-disable-next-line react-hooks/exhaustive-deps` immediately above |
| `react-hooks/rules-of-hooks`                     | This is almost always a real bug — fix the hook call so it runs unconditionally at the top level                                                                                                  |
| `no-console` (frontend)                          | Replace with `console.warn` / `console.error` if it's an actual warning/error, otherwise delete the log                                                                                           |
| `react/no-unescaped-entities`                    | Replace `'` with `&apos;` etc., or wrap text in `{...}`                                                                                                                                           |

For any error where the fix is non-obvious or might change behavior, add `// eslint-disable-next-line <rule>` with a one-line comment explaining why it's safe.

- [ ] **Step 4: Re-run lint until clean**

```bash
npm run lint
```

Expected: Exit 0.

- [ ] **Step 5: Verify formatting still clean (auto-fix can sometimes desync)**

```bash
npm run format
```

- [ ] **Step 6: Verify dev server boots and main routes render**

```bash
npm run dev &
sleep 6
# Manually open http://localhost:3000/ in browser, click into Leads view, Dashboard, Email Templates.
# Confirm no console errors.
kill %1 2>/dev/null
```

Expected: All three routes render without runtime errors.

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: eslint auto-fix pass

Run eslint --fix across the repo and resolve remaining errors with
smallest non-behavioral changes. Notable change: type-only imports now
use `import type` (consistent-type-imports), aligning with the
verbatimModuleSyntax flag we'll enable in step 6.

Sub-project #1, step 4/9.
EOF
)"
```

---

## Task 5: Zod env validation

**Files:**

- Create: `api/src/config/env.ts`
- Modify: every file that reads `process.env.X` (excluding the new env.ts itself, vite config, dotenv setup)
- Modify: `env.example` (synchronize with schema)

- [ ] **Step 1: Enumerate every `process.env.X` consumer**

```bash
grep -rn 'process\.env\.' \
  --include='*.ts' --include='*.tsx' \
  api/ services/ utils/ hooks/ components/ views/ \
  2>/dev/null | grep -v 'api/src/config/env.ts' \
  | tee /tmp/process-env-callsites.txt
```

Expected: A list of file:line:match. Keep `/tmp/process-env-callsites.txt` open while editing.

Also enumerate every distinct env var actually referenced:

```bash
grep -rho 'process\.env\.[A-Z_]\+' \
  --include='*.ts' --include='*.tsx' \
  api/ services/ utils/ hooks/ components/ views/ \
  2>/dev/null | sort -u
```

Expected: A unique list. Compare against the schema in Step 2 — if any keys appear in code that are NOT in the schema below, ADD them to the schema before continuing.

- [ ] **Step 2: Create `api/src/config/env.ts`**

```typescript
import { z } from 'zod';
import 'dotenv/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // CORS (optional — vite-plugin-api proxies in dev, only used by standalone server)
  CORS_ORIGIN: z.string().url().optional(),

  // AI providers
  GEMINI_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),

  // Vertex AI (optional — only needed for event intelligence enrichment)
  VERTEX_AI_API_KEY: z.string().optional(),
  VERTEX_AI_PROJECT_ID: z.string().optional(),
  VERTEX_AI_ENDPOINT_ID: z.string().optional(),
  VERTEX_AI_LOCATION: z.string().default('europe-west4'),
  VERTEX_AI_SERVICE_ACCOUNT_PATH: z.string().optional(),

  // Outgoing email (SMTP)
  EMAIL_HOST: z.string().min(1),
  EMAIL_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_HOST_USER: z.string().email(),
  EMAIL_HOST_PASSWORD: z.string().min(1),
  DEFAULT_FROM_EMAIL: z.string().email(),

  // Incoming email (IMAP)
  EMAIL_IMAP_HOST: z.string().min(1),
  EMAIL_IMAP_PORT: z.coerce.number().int().positive().default(993),

  // Optional integrations
  GOOGLE_TRANSLATE_API_KEY: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
```

> **Note:** If Step 1's grep revealed env keys not listed above, add them to the schema before saving the file.

- [ ] **Step 3: Refactor each call site from `/tmp/process-env-callsites.txt`**

For each file in the list, replace `process.env.X` with `env.X`. Two cases:

**(a) Inside `api/src/**/\*.ts`:\*\*

```typescript
// Before
const apiKey = process.env.GEMINI_API_KEY;

// After
import { env } from '../config/env'; // adjust relative path
// ...
const apiKey = env.GEMINI_API_KEY;
```

**(b) Outside `api/src/` (e.g., `services/`, `utils/`):**

These run in the **frontend** bundle (Vite). They MUST NOT import from `api/src/` or that backend code ships to the browser. If a frontend file genuinely needs an env var, it's wrong — frontend code only sees `import.meta.env.VITE_*`. Inspect each such file:

- If the `process.env.X` is in dead/server-only code that somehow ended up in `services/` or `utils/`, move it to `api/src/`.
- If it's a frontend file that should never have read server env, the read is a bug — replace with the correct frontend mechanism (a backend API call) and document in `STRICT_DEBT.md` if the fix is non-trivial.

If you find no `process.env.*` in non-`api/src/` paths after running Step 1's grep, no action needed — proceed.

- [ ] **Step 4: Verify only `env.ts` reads `process.env`**

```bash
grep -rn 'process\.env\.' \
  --include='*.ts' --include='*.tsx' \
  api/ services/ utils/ hooks/ components/ views/ \
  2>/dev/null
```

Expected: Only matches inside `api/src/config/env.ts`. If any other file appears, return to Step 3.

- [ ] **Step 5: Synchronize `env.example` with the schema**

Open `env.example` and ensure every required field in the Zod schema has a corresponding line. Required keys must have an `=value` placeholder. Optional keys should be commented out with `# `. Add a header comment at the top:

```
# Synchronized with api/src/config/env.ts (Zod schema is source of truth).
# Required keys are uncommented. Optional keys are prefixed with `# `.
```

Verify:

```bash
diff <(grep -oE '^[A-Z_]+(?==)' env.example | sort -u) \
     <(grep -oE '[A-Z_]+: z\.' api/src/config/env.ts | awk -F: '{print $1}' | tr -d ' ' | sort -u)
```

(Don't worry if the diff command isn't perfect — this is a manual review aid, not a gate.)

- [ ] **Step 6: Verify api boots with current `.env`**

```bash
npm run dev:api
```

Expected: Server starts cleanly. Press Ctrl+C after confirming.

- [ ] **Step 7: Verify fail-fast on missing key**

```bash
# Temporarily rename one required key in .env
sed -i.bak 's/^GEMINI_API_KEY=/GEMINI_API_KEY_DISABLED=/' .env
npm run dev:api
# Expected: Process exits with "Invalid environment variables: GEMINI_API_KEY: [...]"
# Restore:
mv .env.bak .env
npm run dev:api
# Expected: Boots cleanly. Ctrl+C after.
```

- [ ] **Step 8: Verify frontend dev server still works**

```bash
npm run dev &
sleep 6 && curl -sf http://localhost:3000/ > /dev/null && echo "OK" || echo "FAIL"
kill %1 2>/dev/null
```

Expected: `OK`.

- [ ] **Step 9: Commit**

```bash
git add api/src/config/env.ts env.example
git add -u
git commit -m "$(cat <<'EOF'
feat(config): zod env validation with fail-fast boot

Add api/src/config/env.ts as the single source for environment access.
Zod schema validates all keys at boot; the server exits with a clear
error listing missing/invalid fields rather than crashing later mid-
request. Refactor every `process.env.X` consumer to import from this
module.

Sync env.example with the schema. Done before strict mode (next steps)
so the type-fix wave sees typed `env.*` instead of `string | undefined`
process.env reads.

Sub-project #1, step 5/9.
EOF
)"
```

---

## Task 6: Enable TypeScript strict mode (config only)

**Files:**

- Modify: `tsconfig.json`
- Modify: `api/tsconfig.json`

- [ ] **Step 1: Update root `tsconfig.json`**

Merge these into `compilerOptions` (preserve all existing options):

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

- [ ] **Step 2: Update `api/tsconfig.json`**

The api config already has `"strict": true`. Add the same additional flags:

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

- [ ] **Step 3: Add typecheck scripts to `package.json`**

```json
"typecheck": "tsc --noEmit",
"typecheck:api": "tsc --noEmit -p api/tsconfig.json"
```

- [ ] **Step 4: Run typecheck — errors are EXPECTED here**

```bash
npm run typecheck 2>&1 | tail -20
npm run typecheck:api 2>&1 | tail -20
```

Expected: BOTH commands fail with type errors. Note approximate counts. Do **not** fix in this commit — that's Task 7.

- [ ] **Step 5: Verify dev server still boots (Vite tolerates TS errors)**

```bash
npm run dev &
sleep 6 && curl -sf http://localhost:3000/ > /dev/null && echo "OK" || echo "FAIL"
kill %1 2>/dev/null
```

Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json api/tsconfig.json package.json
git commit -m "$(cat <<'EOF'
chore: enable typescript strict mode

Turn on full strict family plus noUncheckedIndexedAccess,
noImplicitOverride, noFallthroughCasesInSwitch, noUnusedLocals,
noUnusedParameters, exactOptionalPropertyTypes, verbatimModuleSyntax.
Add typecheck scripts. Errors expected — fix wave is the next commit.

Sub-project #1, step 6/9.
EOF
)"
```

---

## Task 7: TypeScript strict — type-level fixes

**Files:** Many — every file the type checker complains about.

> **Discipline (from spec §5):** Only type-level edits — adding `?`, `??`, narrowing guards, safe assertions. **No logic refactoring.** If a clean fix would require restructuring (typically a god file), use `// @ts-expect-error TODO(refactor): <reason>` and add an entry to `STRICT_DEBT.md`. The god files (`LeadsView.tsx`, `LeadDetail.tsx`, `gpt.ts`, `gemini.ts`, `Dashboard.tsx`, `excelImport.ts`, `EmailTemplatesView.tsx`, `EmailReportsView.tsx`) are highest risk — be conservative.

- [ ] **Step 1: Capture baseline error list**

```bash
npm run typecheck 2>&1 | tee /tmp/strict-errors-root.log
npm run typecheck:api 2>&1 | tee /tmp/strict-errors-api.log
```

Skim both logs to spot patterns. Common categories follow.

- [ ] **Step 2: Fix Pattern A — undefined from indexed access (`noUncheckedIndexedAccess`)**

```typescript
// Before
const first = items[0];
first.id; // TS2532: 'first' is possibly 'undefined'

// After (option 1: guard)
const first = items[0];
if (!first) return null;
first.id;

// After (option 2: nullish coalesce default)
const first = items[0] ?? defaultItem;

// After (option 3: assertion ONLY when index is provably valid)
const first = items[0]!; // safe: items.length > 0 verified above
```

- [ ] **Step 3: Fix Pattern B — undefined from `.find()` / `Map.get()` (`strictNullChecks`)**

```typescript
// Before
const lead = leads.find((l) => l.id === id);
return lead.name; // TS18048

// After
const lead = leads.find((l) => l.id === id);
if (!lead) throw new Error(`Lead ${id} not found`);
return lead.name;
```

- [ ] **Step 4: Fix Pattern C — `useState` without initializer (`strictNullChecks`)**

```typescript
// Before
const [user, setUser] = useState<User>(); // T inferred as undefined

// After (option 1: explicit nullable)
const [user, setUser] = useState<User | null>(null);

// After (option 2: explicit undefined)
const [user, setUser] = useState<User | undefined>(undefined);
```

- [ ] **Step 5: Fix Pattern D — `exactOptionalPropertyTypes` mismatches**

```typescript
// Before — fails when passing { name: undefined } to { name?: string }
type Props = { name?: string };
const props: Props = { name: someVar }; // someVar: string | undefined

// After (option 1: narrow caller)
const props: Props = someVar !== undefined ? { name: someVar } : {};

// After (option 2: widen type)
type Props = { name?: string | undefined };
```

If `exactOptionalPropertyTypes` becomes overwhelmingly noisy on this codebase (>100 errors after fixing other categories), it's acceptable to disable JUST this one flag in `tsconfig.json` and document in `STRICT_DEBT.md`. Other strict flags must remain on.

- [ ] **Step 6: Fix Pattern E — unused vars/params (`noUnusedLocals`/`noUnusedParameters`)**

```typescript
// Before
function handler(req, res, next) {
  res.send('ok');
} // 'next' unused

// After
function handler(_req, res, _next) {
  res.send('ok');
}
// Or just delete the unused param if signature allows
```

- [ ] **Step 7: Fix Pattern F — `verbatimModuleSyntax` (type imports)**

ESLint already auto-fixed most of these in Task 4 via `consistent-type-imports`. Anything left:

```typescript
// Before
import { User } from './types'; // imported but used only as a type

// After
import type { User } from './types';
```

- [ ] **Step 8: Strategic surrender — log to STRICT_DEBT.md**

For any error where the clean fix would require restructuring (typical signs: a god-file function with deeply nested conditionals, a callback chain that lost its type along the way, an `any` from an external API that needs proper schema work):

1. Insert `// @ts-expect-error TODO(refactor): <one-line reason>` immediately above the offending line.
2. Append to (or create) `STRICT_DEBT.md` at repo root:

```markdown
# Strict Mode Debt

Entries are inputs for sub-project #4 (refactor god files). Each must be
resolved when the surrounding code is restructured. Do NOT remove
@ts-expect-error markers without a real fix.

| File:Line               | Reason                                                               | Sub-project |
| ----------------------- | -------------------------------------------------------------------- | ----------- |
| views/LeadsView.tsx:412 | Callback returns `any` from gptService — needs typed response schema | #4          |
| ...                     | ...                                                                  | ...         |
```

- [ ] **Step 9: Re-run typecheck**

```bash
npm run typecheck
npm run typecheck:api
```

Expected: BOTH exit 0.

- [ ] **Step 10: Re-run lint and format check**

```bash
npm run lint
npm run format:check
```

Expected: BOTH exit 0. (If `consistent-type-imports` reports new issues, run `npm run lint:fix` and re-check.)

- [ ] **Step 11: Smoke test golden path**

```bash
npm run dev &
# Manually open http://localhost:3000/
# - Login (if applicable)
# - Open Leads view, click a lead, verify detail panel renders
# - Open Dashboard, verify charts/stats render
# - Open Email Templates, verify list renders
# - Check browser DevTools console — no new red errors compared to baseline
kill %1 2>/dev/null
```

Expected: All four routes render without runtime errors.

- [ ] **Step 12: Smoke test api**

```bash
npm run dev:api &
sleep 5
# Hit a few existing endpoints with curl, e.g.:
curl -sf http://localhost:3001/api/v1/leads -H 'Cookie: <existing session>' | head -c 200
# Expected: JSON or 401 — both fine, just confirming server responds
kill %1 2>/dev/null
```

- [ ] **Step 13: Commit**

If `STRICT_DEBT.md` was created or modified, include it.

```bash
git add -u
test -f STRICT_DEBT.md && git add STRICT_DEBT.md
git commit -m "$(cat <<'EOF'
fix: typescript strict — type-level fixes

Type-only edits across the codebase to satisfy strict mode:
guards/narrowing for indexed access and find(), explicit nullable
useState, exactOptionalPropertyTypes adjustments, _-prefix for
intentionally unused params, type-only imports.

Where clean fixes would require structural refactoring (god files),
@ts-expect-error TODO(refactor) markers point to STRICT_DEBT.md
entries — those are inputs for sub-project #4.

Sub-project #1, step 7/9.
EOF
)"
```

---

## Task 8: Setup husky + lint-staged

**Files:**

- Create: `.husky/pre-commit`
- Create: `.husky/pre-push`
- Create: `.lintstagedrc.json`
- Modify: `package.json`

- [ ] **Step 1: Install husky and lint-staged**

```bash
npm install --save-dev husky@^9 lint-staged@^15
```

- [ ] **Step 2: Add `prepare` script and run it**

In `package.json` scripts:

```json
"prepare": "husky"
```

Then run:

```bash
npm run prepare
```

Expected: `.husky/` directory created.

- [ ] **Step 3: Create `.husky/pre-commit`**

```sh
npx lint-staged
```

Make executable:

```bash
chmod +x .husky/pre-commit
```

- [ ] **Step 4: Create `.husky/pre-push`**

```sh
echo "Running typecheck before push (compensates for missing CI)..."
npm run typecheck && npm run typecheck:api
```

```bash
chmod +x .husky/pre-push
```

- [ ] **Step 5: Create `.lintstagedrc.json`**

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css,html,yml,yaml}": ["prettier --write"]
}
```

- [ ] **Step 6: Test pre-commit hook end-to-end**

```bash
# Make a trivial change with bad formatting on purpose
echo "// trailing-space-test " >> README.md
git add README.md
git commit -m "test: hook trigger"
# Expected: lint-staged runs, prettier fixes the trailing space, commit succeeds.
# Verify file was reformatted:
git show HEAD --stat
git show HEAD -- README.md
# Then revert the test commit:
git reset --hard HEAD~1
```

- [ ] **Step 7: Test pre-push hook (without actually pushing)**

```bash
# Simulate by running the hook script directly:
.husky/pre-push
```

Expected: typecheck runs and passes.

To deliberately fail it (sanity check it would block):

```bash
# Add a known bad type to a sandbox file, run hook, confirm fail, then revert.
# (Skip if you trust the script.)
```

- [ ] **Step 8: Commit**

```bash
git add .husky/pre-commit .husky/pre-push .lintstagedrc.json package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: setup husky and lint-staged

Pre-commit runs lint-staged (eslint --fix + prettier on staged files
only) and blocks the commit if lint errors remain. Pre-push runs the
full typecheck for both root and api — this is the safety gate that
compensates for the absence of CI on this solo project.

Sub-project #1, step 8/9.
EOF
)"
```

---

## Task 9: Update README

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Read current README**

```bash
cat README.md
```

Note the dead link to `SECURITY_CHECK.md` at the end of the Security Notes section.

- [ ] **Step 2: Update README**

Apply two changes:

**(a) Replace the "Run the app" section** with one that reflects the new scripts:

````markdown
4. **Run the app:**

   ```bash
   # Frontend (Vite dev server with serverless API proxy)
   npm run dev

   # Standalone backend (alternative — runs Express directly on PORT)
   npm run dev:api
   ```
````

5. **Daily development scripts:**

   ```bash
   npm run lint           # ESLint check
   npm run lint:fix       # ESLint auto-fix
   npm run format         # Prettier write
   npm run format:check   # Prettier verify only
   npm run typecheck      # tsc --noEmit (root)
   npm run typecheck:api  # tsc --noEmit (api/)
   npm run build          # Production build
   ```

   Pre-commit hook runs `lint-staged` automatically (ESLint --fix +
   Prettier on staged files, blocks on lint errors). Pre-push hook runs
   the full typecheck. To bypass in an emergency: `--no-verify` (do so
   sparingly).

```

**(b) Remove the dead link.** In the Security Notes block, replace the line:

```

- ✅ See [SECURITY_CHECK.md](SECURITY_CHECK.md) for detailed security audit

```

with:

```

- ✅ Environment variables validated at boot via `api/src/config/env.ts` (Zod schema). Missing/invalid keys cause fail-fast with a clear error.

````

- [ ] **Step 3: Run prettier on README**

```bash
npm run format
````

- [ ] **Step 4: Verify the README renders sensibly**

```bash
head -60 README.md
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
chore: update README for tooling baseline

Document new lint/format/typecheck scripts, husky hook behavior, and
how to bypass when needed. Replace dead SECURITY_CHECK.md reference
with a pointer to the Zod env validation.

Sub-project #1, step 9/9. Closes the cleanup + tooling baseline.
EOF
)"
```

---

## Final verification

- [ ] **Run all checks**

```bash
npm run lint
npm run format:check
npm run typecheck
npm run typecheck:api
npm run build
```

Expected: ALL exit 0.

- [ ] **Working tree clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Boot smoke test**

```bash
npm run dev &
sleep 6 && curl -sf http://localhost:3000/ > /dev/null && echo "frontend OK" || echo "FAIL"
kill %1 2>/dev/null

npm run dev:api &
sleep 5 && echo "api boot OK (Ctrl+C to stop)" || echo "FAIL"
pkill -f 'tsx watch' 2>/dev/null
```

- [ ] **Hook smoke test**

```bash
# Trivial commit triggers pre-commit:
echo "" >> README.md && git add README.md && git commit -m "test" && git reset --hard HEAD~1
# Expected: hook ran, commit succeeded, then was reverted.
```

- [ ] **Total acceptance from spec §7**

Run through the spec's "Total acceptance criteria" checklist. Everything must check off.

- [ ] **Push to remote**

```bash
git push origin main
```

The pre-push hook runs `tsc --noEmit` for both root and api. Push succeeds only if both pass.

---

## Rollback notes

Each commit is independently revertable:

```bash
git revert <sha>
```

Highest-risk commit is Task 7 (TS strict fixes) — it touches the most files. If a runtime regression surfaces post-merge, revert Task 7 and reopen with smaller, file-scoped follow-ups.

After rollback, restart from Task 7 with whatever lessons were learned — do not undo Tasks 1–6 unless a specific bug demands it.

---

## Out of scope (do not do here — these have their own sub-projects)

- Refactor god files (`LeadsView.tsx`, etc.) — sub-project #4
- Test framework + tests — sub-project #2
- Structured logger — sub-project #3
- Layer-ize routes/services/models — sub-project #5
- Migration runner — sub-project #6
- GitHub Actions CI — sub-project #7
- Bundle splitting / lazy loading — sub-project #9
- Documentation polish (ADR, contributing) — sub-project #10
- Rewrite git history to scrub CSV lead data — flagged in spec, separate decision
