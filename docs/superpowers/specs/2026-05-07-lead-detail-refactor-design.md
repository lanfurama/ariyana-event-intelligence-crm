# LeadDetail Refactor — Design Spec

**Date:** 2026-05-07
**Status:** Draft (awaiting user review)
**Sub-project:** #4b — the largest remaining `@ts-nocheck` god file. EventModal (#4c) was the warm-up; this is the main event.
**Owner:** lanfurama (solo)

---

## 1. Context

`components/LeadDetail.tsx` is **1998 LOC** and carries `// @ts-nocheck`, meaning it is effectively untyped JavaScript inside a strict-TypeScript codebase. It is the largest single file in the repo and one of two outstanding god files (the other being `views/LeadsView.tsx` 1914 LOC, which is sub-project #4d).

Unlike EventModal — a pure derivation-and-render container — LeadDetail is **stateful, side-effectful, and split across three independent concerns** (a slide-over panel with three tabs). Refactoring it requires decomposing both the JSX _and_ the surrounding state/effects, which is structurally harder than EventModal's "extract pure function + split JSX" pattern.

### Current shape of the file

| Lines       | Section                  | Notes                                                                                                                                                                                                       |
| ----------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-37        | Imports + props          | `// @ts-nocheck` on line 1. Props are typed (`Lead`, `User`, callbacks) but body uses `any` heavily.                                                                                                        |
| 38-74       | 21 `useState` calls      | Three concern-groups: edit/general (3), enrich (8 incl. `researchResults`), email (10).                                                                                                                     |
| 76-90       | 2 `useEffect` hooks      | Sync prop → `editedLead`; load email-tab data when tab opens.                                                                                                                                               |
| 92-216      | Loaders + small handlers | `loadEmailTemplates` (~90 LOC, includes inline placeholder substitution), `loadEmailReplies`, `handleCheckInbox`, `handleInputChange`, `handleSaveChanges`.                                                 |
| 219-240     | 2 countdown `useEffect`s | Rate-limit countdowns for enrichment and email.                                                                                                                                                             |
| 242-615     | Pure helpers             | `extractDomain` (~16 LOC), `verifyEmail` (~40 LOC), `parseResearchResult` (~310 LOC of regex parsing) — all pure, all currently inside the component closure.                                               |
| 616-960     | Stateful handlers        | `handleEnrich` (~88 LOC, calls Gemini/Vertex), `handleApprove/RejectEmail`, `handleSaveEnrichment`, `handleTemplateChange` (~50 LOC), `handleDraftEmail`, `handleFileUpload`, `handleSendEmail` (~100 LOC). |
| 961-1020    | Render frame             | Slide-over panel header + tab nav (Info / Enrich / Email).                                                                                                                                                  |
| 1021-~1370  | Info tab JSX             | Lead details fields, edit mode, save/cancel, optionally email-replies preview.                                                                                                                              |
| ~1372-~1657 | Enrich tab JSX           | Enrichment form, AI research output, approval UI.                                                                                                                                                           |
| ~1658-1998  | Email tab JSX            | Template picker, draft editor (code/preview toggle), attachments, send, replies list.                                                                                                                       |

The file violates several boundary principles at once:

- Three independent concerns (info/edit, enrichment, email) live in one component scope sharing 21 `useState` calls.
- Pure parsing logic (`parseResearchResult` is 310 LOC of regex) is locked inside a React component, untestable.
- All shapes that flow through enrichment results are typed as `any`, defeating downstream inference.
- `handleSendEmail` and `handleEnrich` mix HTTP, state updates, and toast/alert side effects in single ~100-LOC functions.

### Pain points addressed

| Symptom                                                                | Cause                                                              | Fix in this spec                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| LeadDetail is `@ts-nocheck` — no type safety                           | Structural untyped data flow + many `any` shapes from AI responses | Section 3 — typed pure helpers + typed custom hooks; restore strict on the file                           |
| 1998 LOC, three concerns intermixed                                    | Monolithic component                                               | Section 3 — three custom hooks + three tab components + a thin orchestrator                               |
| Pure parsers (~370 LOC) untestable inside a React component            | Logic embedded in component closure                                | Section 3 — extract to `leadDetailHelpers.ts`, ~25 unit tests                                             |
| State updates from one tab can leak into another via shared `useState` | All state at component top level                                   | Section 3 — each tab's state encapsulated in its own custom hook                                          |
| Refactor risk untracked — no behavioral test net for this view         | No component tests at all (sub-project #2 deferred them)           | Section 4 — pure-helper tests + custom-hook tests via `@testing-library/react-hooks`-style + manual smoke |

---

## 2. Goals & non-goals

### Goals

1. `components/LeadDetail.tsx` reduced to a thin orchestration container under 100 LOC.
2. Three pure helpers (`extractDomain`, `verifyEmail`, `parseResearchResult`) and one helper for template placeholder substitution (`applyTemplatePlaceholders`) extracted to `leadDetailHelpers.ts` with ~25 unit tests.
3. Three custom hooks (`useLeadEdit`, `useLeadEnrichment`, `useLeadEmail`) each encapsulate one tab's state, effects, and handlers. Each hook accepts only the props it needs and exposes a typed interface.
4. Three tab components (`LeadInfoTab`, `LeadEnrichTab`, `LeadEmailTab`) consume their hook + render JSX from typed props. Each under ~300 LOC.
5. `// @ts-nocheck` removed from `LeadDetail.tsx` and its sub-files.
6. `STRICT_DEBT.md` updated: `LeadDetail.tsx` row resolved.
7. Total tests: ~156 → ~181 (baseline + 25 new helper tests).
8. All existing gates remain green throughout the rollout (`lint`, `format:check`, `typecheck`, `typecheck:api`, `test`, `build`).

### Non-goals

- Visual / UX changes. JSX moves verbatim; CSS classes preserved.
- React Testing Library setup for component rendering tests — still deferred to a future "frontend test infra" sub-project. This refactor uses pure-function tests + manual browser smoke tests.
- Touching parent `LeadsView.tsx` or other callers. Props shape stays the same.
- Refactor `LeadsView.tsx` (1914 LOC) — that's #4d.
- Replacing the AI service abstraction (`VertexAiService`, `GeminiService`) — that's part of the AI provider abstraction, already separately scaffolded.
- Changing the tab UX (e.g., URL-routed tabs, lazy-mounted tabs) — out of scope.
- Improving the `parseResearchResult` regex heuristics — tests cement _current_ behavior; quality improvements belong to a later sub-project.
- Reworking `handleSendEmail`'s side-effect chain (alert → state → reload) into a notification system — out of scope.

---

## 3. Architecture

### File structure (target)

```
components/
├── LeadDetail.tsx                           # ~80 LOC — orchestration container (frame, tabs, hook composition)
└── LeadDetail/
    ├── leadDetailHelpers.ts                 # Pure: extractDomain, verifyEmail, parseResearchResult, applyTemplatePlaceholders
    ├── leadDetailHelpers.test.ts            # ~25 cases
    ├── useLeadEdit.ts                       # Custom hook — info tab state + handlers
    ├── useLeadEnrichment.ts                 # Custom hook — enrich tab state + handlers + countdown effect
    ├── useLeadEmail.ts                      # Custom hook — email tab state + handlers + countdown effect
    ├── LeadInfoTab.tsx                      # ~250 LOC
    ├── LeadEnrichTab.tsx                    # ~250 LOC
    └── LeadEmailTab.tsx                     # ~300 LOC (largest — template picker, draft editor, attachments, replies)
```

This mirrors the EventModal pattern (container at one level, sub-files in a sibling folder) but adds custom hooks because LeadDetail is genuinely stateful per tab.

### Layer responsibilities

**`leadDetailHelpers.ts`** — pure functions only. No React, no hooks, no `console.log`. Each function signature is typed end-to-end. Targets:

```typescript
export function extractDomain(website: string | null | undefined): string | null;

export type EmailVerification =
  | { status: 'auto-approved'; reason: string }
  | { status: 'pending'; reason: string }
  | { status: 'rejected'; reason: string };

export function verifyEmail(
  email: string,
  companyWebsite: string | null | undefined,
): EmailVerification;

export interface ResearchResult {
  name?: string;
  title?: string;
  email?: string;
}

export function parseResearchResult(text: string): ResearchResult;

export function applyTemplatePlaceholders(template: string, lead: Lead): string;
```

The current code's `console.log` debug statements inside parsers are removed during extraction (they cluttered the parser; if needed, callers can log).

**`useLeadEdit(lead, onSave)`** — info tab state:

```typescript
export function useLeadEdit(lead: Lead, onSave: (l: Lead) => void) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead>(lead);
  useEffect(() => setEditedLead(lead), [lead]);
  const handleInputChange = (field: keyof Lead, value: Lead[keyof Lead]) => { ... };
  const handleSaveChanges = () => { onSave(editedLead); setIsEditing(false); };
  return { isEditing, setIsEditing, editedLead, handleInputChange, handleSaveChanges };
}
```

**`useLeadEnrichment(lead, editedLead)`** — enrich tab state:

```typescript
export function useLeadEnrichment(lead: Lead, editedLead: Lead) {
  // Enrichment form inputs, AI result, parsed researchResults, rate-limit countdown.
  // Handlers: handleEnrich, handleApproveEmail, handleRejectEmail, handleSaveEnrichment.
  // The countdown useEffect lives here.
  return {
    /* ~12 state values + 4 handlers */
  };
}
```

**`useLeadEmail(lead)`** — email tab state:

```typescript
export function useLeadEmail(lead: Lead) {
  // Templates, drafted email, attachments, replies, sending state, rate-limit, view mode.
  // Handlers: loadEmailTemplates, loadEmailReplies, handleTemplateChange, handleDraftEmail,
  //   handleFileUpload, handleSendEmail, handleCheckInbox.
  // Countdown useEffect + tab-open data-load useEffect both live here.
  return {
    /* ~13 state values + 7 handlers */
  };
}
```

Each hook returns a typed object. The container composes them and passes the right slice to each tab component.

**Tab components** — receive only what they render:

```typescript
interface LeadInfoTabProps {
  lead: Lead;
  user: User;
  edit: ReturnType<typeof useLeadEdit>;
}

export const LeadInfoTab: React.FC<LeadInfoTabProps> = ({ lead, user, edit }) => {
  /* JSX */
};
```

Same shape for `LeadEnrichTab` and `LeadEmailTab`. JSX moves verbatim from the corresponding region of the original file. References to outer-scope variables become explicit prop or hook destructures.

**`LeadDetail.tsx` (container)**:

```typescript
export const LeadDetail: React.FC<Props> = ({ lead, onClose, onSave, user }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'enrich' | 'email'>('info');
  const edit = useLeadEdit(lead, onSave);
  const enrichment = useLeadEnrichment(lead, edit.editedLead);
  const email = useLeadEmail(lead);
  const canEdit = user.role === 'Director' || user.role === 'Sales';

  return (
    <SlideOver onClose={onClose}>
      <Header lead={lead} onClose={onClose} />
      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} canEdit={canEdit} />
      <div className="p-3 flex-1 overflow-y-auto">
        {activeTab === 'info' && <LeadInfoTab lead={lead} user={user} edit={edit} />}
        {activeTab === 'enrich' && <LeadEnrichTab lead={lead} edit={edit} enrichment={enrichment} />}
        {activeTab === 'email' && canEdit && <LeadEmailTab lead={lead} email={email} />}
      </div>
    </SlideOver>
  );
};
```

The frame (`SlideOver`, `Header`, `Tabs`) may stay inline in `LeadDetail.tsx` if each is small (~15 LOC). Promote to sub-components only if extraction makes the orchestrator clearer.

### Type safety restoration

After the split:

- All `any[]` (notably `attachments`, `enrichResult.grounding`) become concrete types or `unknown` narrowed at use sites.
- `parseResearchResult` returns a typed `ResearchResult` instead of `{ name?, title?, email? }` inferred ad-hoc.
- AI response shapes get explicit interfaces in `leadDetailHelpers.ts` if needed for `handleEnrich`'s callback path. If the AI service itself returns `any`, the boundary cast happens at the hook level (`useLeadEnrichment`), not deep in helper code.
- `// @ts-nocheck` is removed in the final commit, only after all sub-files are typed and the container compiles cleanly under strict mode.

If a single error genuinely requires a logic fix (e.g., `editedLead.website` could legitimately be undefined where the original code assumed string), default sensibly with `?? ''` or a guard — never re-introduce `any` or `@ts-nocheck`.

### Why custom hooks instead of just splitting JSX?

EventModal had no state — its `useMemo` was a pure derivation, easy to extract to a function. LeadDetail has 21 `useState`s and 4 `useEffect`s, with state cluster boundaries that exactly mirror the tab boundaries. Splitting only the JSX would leave all the state/handlers in the orchestrator, defeating the purpose of the split.

Custom hooks are the React-idiomatic way to encapsulate stateful logic. They make each tab's concern testable in isolation (with a future hook test framework) and let each tab file focus on rendering rather than lifecycle.

### Why not Context or Redux?

The hooks return values consumed by exactly one tab each. There is no cross-tab shared state beyond `lead` (passed as prop) and `editedLead` (used by enrichment hook to read current company name during AI calls). Context or Redux would add indirection without removing complexity. Plain function calls and explicit prop passing are clearer.

The one cross-hook dependency (`useLeadEnrichment` reads `edit.editedLead`) is a deliberate prop, not magic — it makes the data flow visible in the orchestrator.

---

## 4. Test strategy

### Pure helper tests (~25 cases) — `leadDetailHelpers.test.ts`

`extractDomain` (~5 cases):

- Bare hostname (`'example.com'`) → `'example.com'`.
- `https://www.example.com/path` → `'example.com'`.
- Empty / null / undefined → `null`.
- URL with port, query, hash → strips to hostname.
- Malformed input falls back to regex extraction (or `null` if no match).

`verifyEmail` (~6 cases):

- Email domain matches company website domain → `'auto-approved'`.
- Email domain matches `editedLead.website` fallback when no company website → `'auto-approved'`.
- `gmail.com` / `googlemail.com` → `'pending'` with the gmail reason.
- Other domain not matching → `'pending'`.
- Empty email → `'rejected'`.
- Invalid email format (no `@`) → `'rejected'`.

`parseResearchResult` (~10 cases):

- Structured "KEY PERSON CONTACT" block → returns name, title, email.
- "Not found" / "Not available" placeholders → fields omitted.
- Generic emails (`info@`, `contact@`, etc.) filtered out.
- Multiple person emails — name match prefers email containing name parts.
- Email with trailing punctuation cleaned.
- Format variants: dashes, bullets, no header, different spacing.
- Empty / unstructured text → empty `ResearchResult`.
- Text with only an email, no name/title → returns just `{ email }`.
- Text with name and title but no email → returns `{ name, title }`.
- Edge — text exactly at boundary of regex patterns.

`applyTemplatePlaceholders` (~4 cases):

- All `{{var}}` placeholders replaced.
- Legacy `[Var Name]` placeholders replaced (current behavior).
- Missing lead field → empty string substitution.
- No placeholders in template → returned verbatim.

### Hook tests

Out of scope for this sub-project. Custom hook tests need `@testing-library/react` (or `react-hooks-testing-library`) which the codebase has not adopted yet. Adding it now would expand 4b beyond its primary purpose. A future "frontend test infra" sub-project will introduce that framework and write tests for these hooks.

The hook extractions are protected only by manual browser smoke tests (per Section 5) until then.

### Component tests

Same reasoning as hooks — out of scope. Manual smoke is the only safety net for visual regressions.

### Manual smoke test (per rollout step)

After each commit, with `npm run dev` running:

1. Open the app, log in.
2. Navigate to the Leads view, click a lead row to open the slide-over.
3. **Info tab:** verify all fields render. Click "Edit Info" (if Director/Sales role), change a field, click "Save Changes" — verify the change persists.
4. **Enrich tab:** verify the form pre-fills with company name / key person / city. Click "Enrich" (real Gemini call — verify AI result appears).
5. **Email tab:** verify templates load, default template auto-selects, draft pre-fills with placeholder substitutions. Switch templates — verify draft updates. Toggle code/preview view. Verify replies list loads.
6. Close the slide-over with the X button — verify it closes cleanly.
7. Re-open with a different lead — verify state resets correctly (no stale data from previous lead).
8. Inspect DevTools console for new red errors compared to baseline.

The smoke test is the only safety net for visual + behavioral regressions until proper component tests exist. **Run it explicitly after every commit; do not batch.** Skipping smoke tests defeats the entire rollout's risk model.

---

## 5. Rollout plan

Fifteen commits, each independently revertable. Plan groups closely-related extractions into single commits to keep the count manageable, but never bundles unrelated changes.

| #   | Commit                                                   | Scope                                                                                                                                                                                                                                                                                                                           | Risk                                                        | Verification                       |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| 1   | `feat(component): extract leadDetailHelpers + tests`     | Create `LeadDetail/leadDetailHelpers.ts` with `extractDomain`, `verifyEmail`, `parseResearchResult`, `applyTemplatePlaceholders`; add ~25 unit tests. LeadDetail.tsx still uses inline copies.                                                                                                                                  | Zero (additive only)                                        | `npm test` adds ~25 cases; pass    |
| 2   | `refactor(component): LeadDetail uses leadDetailHelpers` | Inside `LeadDetail.tsx`, replace inline `extractDomain` / `verifyEmail` / `parseResearchResult` with imports from helpers. Remove the inline placeholder substitution loop in `loadEmailTemplates` in favor of `applyTemplatePlaceholders(template.subject, lead)` and `applyTemplatePlaceholders(template.body, lead)`.        | Low                                                         | Smoke test (info + email tabs)     |
| 3   | `refactor(component): extract useLeadEdit hook`          | Move `isEditing`, `editedLead`, the prop-sync `useEffect`, `handleInputChange`, `handleSaveChanges` into `LeadDetail/useLeadEdit.ts`. Replace in container with `const edit = useLeadEdit(lead, onSave)` and update consumer JSX to use `edit.*`.                                                                               | Low                                                         | Smoke test info-tab edit flow      |
| 4   | `refactor(component): extract useLeadEnrichment hook`    | Move all 7 enrichment `useState`s, the rate-limit countdown `useEffect`, and the four enrichment handlers (`handleEnrich`, `handleApproveEmail`, `handleRejectEmail`, `handleSaveEnrichment`) into `useLeadEnrichment.ts`. The hook accepts `(lead, editedLead)`. Replace in container.                                         | Medium — `handleEnrich` is ~88 LOC and calls AI services    | Smoke test enrich tab end-to-end   |
| 5   | `refactor(component): extract useLeadEmail hook`         | Move all 10 email `useState`s, the email-tab data-load `useEffect`, the email rate-limit countdown `useEffect`, and the seven email handlers (`loadEmailTemplates`, `loadEmailReplies`, `handleCheckInbox`, `handleTemplateChange`, `handleDraftEmail`, `handleFileUpload`, `handleSendEmail`) into `useLeadEmail.ts`.          | Medium — `handleSendEmail` is ~100 LOC                      | Smoke test email tab end-to-end    |
| 6   | `refactor(component): extract LeadInfoTab`               | Move info-tab JSX (lines ~1021–1370) into `LeadDetail/LeadInfoTab.tsx`. Props: `{ lead, user, edit }`.                                                                                                                                                                                                                          | Low                                                         | Smoke test info tab                |
| 7   | `refactor(component): extract LeadEnrichTab`             | Move enrich-tab JSX (~1372–1657) into `LeadEnrichTab.tsx`. Props: `{ lead, edit, enrichment }`.                                                                                                                                                                                                                                 | Low                                                         | Smoke test enrich tab              |
| 8   | `refactor(component): extract LeadEmailTab`              | Move email-tab JSX (~1658–1998) into `LeadEmailTab.tsx`. Props: `{ lead, email }`.                                                                                                                                                                                                                                              | Low                                                         | Smoke test email tab               |
| 9   | `refactor(component): restore TS strict on LeadDetail`   | Remove `// @ts-nocheck` from `LeadDetail.tsx` and any sub-files that still have it. Run `npm run typecheck`. Fix each surfaced error with proper types. Replace `any` with concrete types from `leadDetailHelpers.ts` and the AI response shapes. Narrow `unknown` at use sites. **Never** re-introduce `any` or `@ts-nocheck`. | **Highest** — strict mode may surface real shape mismatches | `npm run typecheck` exits 0; smoke |
| 10  | `docs: STRICT_DEBT.md (LeadDetail resolved)`             | Strike out the `LeadDetail.tsx` row in the "Files with `@ts-nocheck`" table; move to "Resolved" section.                                                                                                                                                                                                                        | Zero                                                        | Read-through                       |

If steps 6/7/8 are larger or trickier than expected, each may split into two commits (header-section + body-section). The point is small commits, not exactly ten — adapt as needed.

### Total acceptance criteria

- [ ] `npm test` passes with ~181 cases (baseline 156 + 25 helper tests)
- [ ] `LeadDetail.tsx` < 100 LOC
- [ ] No `@ts-nocheck` anywhere in `components/LeadDetail*`
- [ ] `STRICT_DEBT.md` no longer lists `LeadDetail.tsx`
- [ ] All gates green: `lint`, `format:check`, `typecheck`, `typecheck:api`, `test`, `build`
- [ ] Manual smoke test passes for all three tabs (info edit, enrich, email send) — run by user
- [ ] Working tree clean
- [ ] No new `any` introduced; AI response boundary `any` (if needed) lives only at the hook layer with a comment explaining why

### Rollback plan

Each commit is one extraction. If a commit introduces a regression, `git revert <sha>` returns just that piece to its prior form. The highest-risk commit is step 9 (TS strict restoration); if it fails, revert that one and the file goes back to `@ts-nocheck` while the structural split is preserved.

If steps 4 or 5 (hook extractions) introduce a regression that's hard to spot, revert and re-attempt with smaller scopes (extract one handler at a time instead of the whole hook).

### Estimated session count

This is **not** a one-day refactor. Plan for:

- Session 1: Steps 1–2 (helpers + container uses helpers).
- Session 2: Steps 3–4 (useLeadEdit + useLeadEnrichment hooks).
- Session 3: Steps 5 (useLeadEmail hook — large).
- Session 4: Steps 6–8 (three tab components).
- Session 5: Steps 9–10 (TS strict restore + docs).

Five sessions is the realistic estimate; faster is possible but increases regression risk because manual smoke is the only test net.

---

## 6. Risks and mitigations

| ID  | Risk                                                                                                                                  | Likelihood | Impact                                    | Mitigation                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | A handler implicitly closes over a state value from another tab's cluster; after hook split, the dependency is missing                | Medium     | Medium                                    | The orchestrator passes cross-hook deps explicitly (e.g., `useLeadEnrichment(lead, edit.editedLead)`). Smoke test catches missing data.                                           |
| R2  | `useEffect` dependency arrays change semantics after extraction (e.g., a stable callback becomes new each render)                     | Medium     | Medium                                    | Wrap handlers in `useCallback` only where the original code's behavior depends on stable identity. Otherwise leave as-is.                                                         |
| R3  | TS strict surfaces a real bug (e.g., `enrichResult.grounding` is `any`-typed at runtime, code assumes shape)                          | Medium     | Medium — but a positive: a real bug found | When R3 happens, do not paper over with `as`; fix the upstream caller or add a runtime guard. Document the discovered case in commit message.                                     |
| R4  | `parseResearchResult` extraction loses behavior because `console.log` calls had a side effect on debugging that's no longer available | Low        | Low                                       | The logs are pure debugging output; removal is intentional. If needed, callers can wrap and log.                                                                                  |
| R5  | The pure helper tests cement quirky regex behavior of `parseResearchResult` before it can be reconsidered                             | High       | Low                                       | Tests document existing behavior. Improvements to AI parsing belong to a later sub-project, not this refactor.                                                                    |
| R6  | Custom hook extraction introduces a new render cycle / different state batching, causing a subtle UX bug                              | Low        | Medium                                    | React 19 batches all updates by default. Hooks don't change this. Smoke test catches behavioral changes.                                                                          |
| R7  | Manual smoke test is skipped because the user is impatient; a regression ships                                                        | Medium     | High                                      | The plan explicitly enforces "smoke after every commit; do not batch." If user pushes back, revisit cadence rather than skipping verification.                                    |
| R8  | Refactor takes longer than estimated 5 sessions, leading to a half-finished branch                                                    | Medium     | Medium                                    | Each commit is shippable on its own (file still works because all changes are additive until the final strict-restore step). No long-lived branch needed; commits land on `main`. |
| R9  | The cross-hook prop (`editedLead` flowing into `useLeadEnrichment`) gets the wrong value because of stale closure or misread          | Low        | High — enrichment uses wrong company name | Test by editing a field then immediately running enrich; verify the enrich payload reflects the edit.                                                                             |
| R10 | The 10-commit count understates reality because step 5 (`useLeadEmail`) includes `handleSendEmail` (~100 LOC of side effects)         | Medium     | Low                                       | Spec acknowledges this — step 5 may split into 5a (state + simple handlers) and 5b (`handleSendEmail` alone). Adapt during execution.                                             |

---

## 7. Open questions

1. **Should `SlideOver` / `Header` / `Tabs` be extracted as sub-components?** They are ~15 LOC each and currently inline. The EventModal pattern kept similar small frames inline. **Tentative answer: keep inline** — promoting them adds folder noise without clear benefit. Revisit if the orchestrator file grows past 100 LOC.

2. **Should the email-replies preview block (currently shown inside the info tab section per the JSX scan) actually live in the email tab?** The current code's JSX structure is unclear here. **Tentative answer: defer to step 6** — when extracting `LeadInfoTab`, examine the JSX more carefully. If the replies preview is genuinely info-tab content, leave it. If misplaced, move it as part of step 8.

3. **Should `useLeadEmail` split further?** It encapsulates 10 state values and 7 handlers. **Tentative answer: keep as one** — they are all "the email-sending workflow." Splitting `useEmailTemplates` from `useEmailReplies` from `useEmailComposition` would over-decompose and make the orchestrator wire them back together.

4. **Should we add `react-hooks-testing-library` now?** **Tentative answer: no, defer to a future sub-project** — adding test infra mid-refactor expands scope. The pure helpers cover the most error-prone logic (parsing, verification); hooks are mostly state plumbing.

These questions are flagged for user review before the writing-plans phase.

---

## 8. Next steps after approval

1. User reviews this spec and approves or requests changes.
2. Hand off to `superpowers:writing-plans` skill for the bite-sized step-by-step plan.
3. Implement per the plan over ~5 sessions.
4. On completion, this clears the largest `@ts-nocheck` debt. The remaining structural debt (`#4d LeadsView.tsx`, `#4 excelImport.ts` god file) can be tackled with the same playbook.
