<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Yfs1wMDaCWebViQbPgpx_rw6r7R_H7b9

## Run Locally

**Prerequisites:** Node.js and PostgreSQL

### Setup Steps:

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp env.example .env
   ```

   Edit `.env` file với API keys và database credentials của bạn:

   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=ariyana_crm
   DB_USER=your_username
   DB_PASSWORD=your_password

   # API Keys (BACKEND ONLY - never expose to frontend)
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   ⚠️ **IMPORTANT:** Never commit `.env` file to Git! It's already in `.gitignore`.

3. **Create database:**

   ```sql
   CREATE DATABASE ariyana_crm;
   ```

4. **Run the app:**

   ```bash
   # Frontend (Vite dev server with serverless API proxy)
   npm run dev

   # Standalone backend (alternative — runs Express directly on PORT)
   npm run dev:api
   ```

5. **Daily development scripts:**

   ```bash
   npm run lint           # ESLint check (warnings allowed; errors block)
   npm run lint:fix       # ESLint auto-fix
   npm run format         # Prettier write
   npm run format:check   # Prettier verify only
   npm run typecheck      # tsc --noEmit (root)
   npm run typecheck:api  # tsc --noEmit (api/)
   npm run build          # Production build
   npm test               # Run all tests once
   npm run test:watch     # Re-run tests on file changes
   npm run test:coverage  # Run tests with coverage report
   ```

   The pre-commit hook runs `lint-staged` automatically (ESLint --fix +
   Prettier on staged files; blocks on lint errors). The pre-push hook
   runs `typecheck` + `typecheck:api` + `test` — this compensates for the
   absence of CI. To bypass in an emergency: `--no-verify` (use sparingly).

   Some pre-existing tech debt is documented in `STRICT_DEBT.md`. Each
   entry is scheduled for a specific future sub-project.

### Testing conventions

- Co-located `*.test.ts` files next to the source they cover.
- Mock at the module boundary (`vi.mock('pg')`, `vi.mock('@google/generative-ai')`, etc.).
  Reusable mocks live in `tests/mocks/`; helpers in `tests/helpers/`.
- Tests must run with no real DB, no real AI provider calls, no real SMTP/IMAP.
  The pre-push hook runs `npm test` after typecheck — broken tests block push.
- Component tests (React Testing Library) are deferred until sub-project #4
  splits the god files.

### Source layout: AI provider abstraction

Backend AI calls live under `api/src/services/ai/`:

- `providers/{gemini,openai}.ts` — thin SDK wrappers (provider-agnostic
  `complete()` interface). Currently scaffolded; route handlers still call
  the SDKs directly because each endpoint has provider-specific config
  (Google Search tools, json_object mode, system messages). The wrappers are
  ready for future use when those concerns are normalized.
- `prompts/<operation>.ts` — one module per business operation. Exports prompt
  builders (often one per provider) and parsers / system message constants.
  Examples: `enrich`, `draftEmail`, `chat`, `strategicAnalysis`,
  `extractOrganizations`, `checkEventEligibility`, `analyzeVideo`.
- `errors.ts`, `knowledge.ts`, `types.ts` — shared infrastructure
  (`AiProviderError`, `extractRetryDelay`, `getICCALeadsKnowledge`, request
  shapes).

Route handlers in `api/src/routes/{gpt,gemini}.ts` are thin HTTP wrappers.
To add a new AI endpoint, create the prompt module + test, then wire it in
the appropriate route file.

### Security Notes:

- ✅ All API keys are stored in `.env` file (not committed to Git)
- ✅ Backend API routes use environment variables only
- ✅ Frontend calls backend APIs, never directly uses API keys
- ✅ Database credentials are in `.env` file only
- ✅ Environment variables validated at boot via `api/src/config/env.ts`
  (Zod schema). Missing/invalid keys cause fail-fast with a clear error.
