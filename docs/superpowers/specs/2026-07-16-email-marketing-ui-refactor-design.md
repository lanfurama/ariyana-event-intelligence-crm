# Design: Email-Marketing Refocus + Full UI Refactor

**Date:** 2026-07-16
**Status:** Approved (owner directive: "rà soát toàn bộ luồng chức năng… tóm gọn lại thành công cụ email marketing chuyên nghiệp, refactor toàn bộ giao diện")

## 1. Problem

The product ships as an "Event Intelligence CRM" but is used, daily and in production,
as an **email-outreach tool** (939 leads, 1,035 sent emails, VN+EN templates, scheduled
manager reports). The UI does not match reality:

- Navigation carries two dead-weight features (Video Analysis, AI Assistant) and a
  misleading identity ("Event Intelligence System").
- ~1,100 LOC of orphaned event-intelligence UI (`views/IntelligentDataView/` subtree:
  EventList, EventModal + 7 children, EventFilters, FileUploadSection,
  BatchAnalysisControls, EmptyState, ScoringCriteriaPanel) is exported but never
  rendered. Backend routers `/excel-import`, `/csv-import`, `/event-brief`, most of
  `/gemini/*`, `/gpt/*` have no callers.
- Styling is **Tailwind via CDN** (runtime compile, no purge, internet-dependent) with
  tokens defined inline in `index.html`. Brand gold `#C5A059` is used in 2 views; the
  rest use stock `indigo`/`blue`. Glassmorphism utilities are half-abandoned. The
  noise-texture overlay 404s on every page (13 console errors).
- Email — the actual core — is scattered: send lives in 3 places, templates behind a
  generic "Email" tab, the variables help panel shoves the template list below the fold.

## 2. Goals / non-goals

**Goals**

1. Re-center the app's IA on the email-marketing funnel: Audience → Campaign (bulk or
   1-1 send) → Replies → Reports.
2. One coherent design system: build-time Tailwind, semantic tokens on the Ariyana
   gold/navy brand, shared UI primitives.
3. Remove dead/off-mission frontend code (event-intelligence subtree, Video Analysis,
   AI Chat, dead service functions).
4. Fix visible defects along the way (noise 404, favicon 404, misaligned search box,
   truncated template names, inconsistent nav labels).

**Non-goals (deferred, documented)**

- No backend route/service changes. Dead routers stay (removal is a later sub-project).
- No new campaign engine (server-side batch endpoint `/leads/send-emails` stays unused).
- No auth hardening. No i18n framework.
- LeadDetail Tasks 6–10 of sub-project #4b (JSX tab extraction + strict mode) are NOT
  executed here; LeadDetail gets a consistency restyle only. #4b resumes after.

## 3. New information architecture

| Nav item (label)  | Tab id (unchanged) | View                          | Roles          |
| ----------------- | ------------------ | ----------------------------- | -------------- |
| Dashboard         | `dashboard`        | Dashboard (command center)    | all            |
| Audience          | `leads`            | LeadsView (leads + bulk send) | all            |
| Enrichment        | `intelligent`      | IntelligentDataView           | Director       |
| Email Studio      | `email`            | EmailView (Templates/Reports) | Director/Sales |
| — (user block) →  | `profile`          | UserProfileView               | all            |

Removed from nav + codebase: `analysis` (VideoAnalysisView), `chat` (ChatAssistant).
`App.tsx` migrates stale saved tabs (`analysis`/`chat` → `dashboard`). Tab ids,
localStorage keys (`ariyana_activeTab`), and role gates are preserved.

In-view titles are renamed to match nav labels (nav "Audience" → H1 "Audience", etc.).
Brand line becomes "Ariyana Mail" + "Email Marketing Suite" (sidebar header),
`<title>` "Ariyana Mail — Email Marketing CRM".

## 4. Design system

**Delivery:** `tailwindcss@3.4` + PostCSS + autoprefixer (build-time; CDN script and
`aistudiocdn` importmap removed from `index.html`). v3.4 matches the CDN's utility
surface → zero class-rename risk. Config in `tailwind.config.js`; content globs cover
`index.html`, root `*.tsx`, `components/**`, `views/**`, `hooks/**`.

**Dynamic-class audit rule:** template-literal classNames (`bg-${x}`) break purge.
Before switching, grep and convert every dynamic class construction to full-literal
lookup maps (LeadsView colored avatars, StatusBadge, etc.).

**Tokens (`tailwind.config.js`):**

- `brand` (gold) scale: 50 `#FAF6EE` … 400 `#D4B578` / **500 `#C5A059`** / 600 `#A9853F`
  … 900 `#4A3813` — primary actions, active nav, focus.
- `navy` scale: **900 `#0F172A`** base for sidebar/dark surfaces, plus 700/800 hovers.
- Neutrals: Tailwind `slate` (page bg `slate-50`, borders `slate-200`, text `slate-900/600/400`).
- Semantic (status): success `emerald`, warning `amber`, danger `rose`, info `sky`.
  Lead status mapping: New→sky, Contacted→amber, Qualified→violet, Won→emerald, Lost→slate.
- Type: Inter (Google Fonts, kept). Scale: page title `text-2xl font-bold tracking-tight`,
  section `text-sm font-semibold uppercase tracking-wide text-slate-500`, body `text-sm`.
- Shape/elevation: cards `rounded-xl border border-slate-200 bg-white shadow-sm`;
  no glassmorphism (`.glass*` deleted); noise overlay deleted; gradients only on the
  login hero and stat accents.

**Primitives (`components/ui/`):** `Button` (primary/secondary/ghost/danger, sm/md),
`Card` (+ CardHeader), `Badge`, `PageHeader` (title/subtitle/actions), `EmptyState`,
`Field` wrappers (Label + Input/Select/Textarea styles as class constants). Views adopt
primitives opportunistically — full adoption is not a gate.

**Charts (Dashboard):** follow dataviz-skill rules — single accent (brand gold) with
neutral support, direct labels, no purple rainbow. Render the currently-orphaned
`EmailActivityChart` (sent-per-day) as the hero chart.

## 5. Per-view scope

- **Sidebar:** grouped nav (MAIN: Dashboard/Audience/Email Studio; INTELLIGENCE:
  Enrichment), brand header "Ariyana Mail", footer user block → opens Profile, Sign Out.
  Gold-on-navy active state kept (brand), width bumped w-48→w-56 and `App.tsx` margin
  matched (fixes the current w-48 vs ml-52 16px drift).
- **Dashboard:** KPI row (Total audience, Emails sent, Replies, Reply rate) + email
  activity chart + top templates + geo distribution. Time filter kept. Template
  insights modal restyled.
- **LeadsView ("Audience"):** header/stat strip/filters/search restyled to tokens
  (fix detached search icon), card list → tighter rows, brand accents; Bulk Send +
  Add Lead modals restyled. No logic changes.
- **EmailView ("Email Studio"):** sub-tabs Templates | Reports restyled; Templates
  list becomes the primary content with the variables guide collapsed into a
  toggleable help panel; template cards show language/leadType/attachment badges.
  Reports (VN) restyled to tokens; chrome labels normalized to EN (report email
  content stays VN — it is sent content, not chrome).
- **IntelligentDataView ("Enrichment"):** restyle table + research modal to tokens.
- **LeadDetail:** drawer restyled (header, tabs, buttons, badges) — classNames only,
  no structural change (file is `@ts-nocheck`; #4b continues separately).
- **LoginView:** navy hero, gold accent, "Ariyana Mail" identity.
- **UserProfileView:** tokens pass.

## 6. Deletions

Frontend only:

- `views/VideoAnalysisView.tsx`, `components/ChatAssistant.tsx` + their `App.tsx`
  cases/imports + `services/geminiService.analyzeVideoContent` /
  `services/gptService.sendChatMessage` etc. (dead after view removal — remove the
  whole dead function set in gpt/gemini services where no live caller remains;
  keep `draftSalesEmail` (live) and error helpers).
- `views/IntelligentDataView/` orphans: `EventList.tsx`, `EventModal.tsx`,
  `EventModal/` (all children + `eventModalData.ts` + test), `EventFilters.tsx`,
  `BatchAnalysisControls.tsx`, `EmptyState.tsx`, `FileUploadSection.tsx`,
  `ScoringCriteriaPanel.tsx`, `scoringUtils.ts` (+ test), barrel exports pruned.
- `leadScoringApi` from `services/apiService.ts` (no caller).
- `constants.ts`: `EMAIL_TEMPLATES` seed if unreferenced after cleanup (verify first).
- `.glass*` utilities from `index.css`; noise overlay from `App.tsx`.

Backend untouched. `chat_messages` data untouched.

## 7. Risks & mitigations

| Risk                                                | Mitigation                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| Purge misses runtime-built class names              | Pre-migration grep for `` className={` `` + `${`; literal maps + safelist |
| Tailwind version drift CDN→3.4                      | Same major; visual smoke per view at 1280/375                              |
| Deleting a "dead" file that something imports       | typecheck + `npm test` + grep each file before delete                      |
| LeadDetail is `@ts-nocheck` (no compiler net)       | className-only edits; Playwright smoke on all 3 tabs                       |
| Saved tab `analysis`/`chat` in users' localStorage  | migration effect in `App.tsx`                                              |

## 8. Verification per milestone

`npm run typecheck && npm run typecheck:api && npm test && npm run build` + Playwright
smoke (login → each nav tab → key modals) at 1280px, spot-check 375px. Commit per
milestone (foundation / shell+cleanup / dashboard / email studio / audience+rest / docs).
