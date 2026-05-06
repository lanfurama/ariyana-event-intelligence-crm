# EventModal Refactor — Design Spec

**Date:** 2026-05-06
**Status:** Draft (awaiting user review)
**Sub-project:** #4c (decomposed from the original #4 god-file refactor; warm-up for the bigger #4b/#4d that follow)
**Owner:** lanfurama (solo)

---

## 1. Context

`views/IntelligentDataView/EventModal.tsx` is 641 LOC and currently carries `// @ts-nocheck`, meaning it is effectively untyped JavaScript inside a TypeScript codebase. It is the smallest of the god-adjacent files identified during sub-project #1 and is a deliberately chosen warm-up for the larger React refactors (`#4b LeadDetail.tsx` 1998 LOC, `#4d LeadsView.tsx` 1914 LOC) — same pattern, smaller blast radius.

### Current shape of the file

- **Lines 1-19:** imports, `EventModalProps` interface (with `any` types).
- **Lines 21-213:** the `EventModal` component, dominated by a single ~190-LOC `useMemo` block that derives four values: `dataObj`, `relatedData`, `categories`, `statistics`. The block does field parsing, cross-sheet lookups, categorization, and statistics aggregation. None of it touches React state.
- **Lines 215-640:** the JSX render, a stack of nine visual sections inside one big modal container — Modal Header, Summary Statistics, Related Organizations, Related Contacts, Other Editions, Data Quality Issues, All Event Data Table, Raw Data details, Modal Footer.
- **Line 1:** `// @ts-nocheck` marker, an entry in `STRICT_DEBT.md` carried since sub-project #1.

The file violates several boundary principles at once:

- Pure data derivation is mixed with rendering.
- Nine independent visual sections share one component scope.
- All the props types are `any`, so downstream callers get no help from the compiler.

### Pain points addressed

| Symptom                                                        | Cause                                                    | Fix in this spec                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| EventModal is `@ts-nocheck` — no type safety                   | Structural untyped data flow + many `any` shapes         | Section 3 — extract pure data function with proper types; restore strict on the file |
| 641 LOC, 9 sections, hard to navigate                          | Monolithic component                                     | Section 3 — split into ~7 small sub-components                                       |
| Pure data logic untestable inside a React component            | Logic embedded in `useMemo`                              | Section 3 — extract to `eventModalData.ts`, ~15 unit tests                           |
| Refactor risk untracked — no behavioral test net for this view | No component tests at all (sub-project #2 deferred them) | Section 4 — pure-function tests + manual smoke test of the modal in the browser      |

---

## 2. Goals & non-goals

### Goals

1. `views/IntelligentDataView/EventModal.tsx` reduced to a thin orchestration container under 100 LOC.
2. Pure data function `extractEventModalData(event, allExcelData)` extracted to its own file with ~15 unit tests.
3. Seven sub-components (`ModalHeader`, `SummaryStatistics`, `RelatedOrganizations`, `RelatedContacts`, `OtherEditions`, `DataQualityIssues`, `AllEventDataTable`) each under 100 LOC, each rendering JSX from typed props.
4. `// @ts-nocheck` removed from EventModal and its sub-components.
5. `STRICT_DEBT.md` updated: EventModal entry resolved.
6. Total tests: 142 → ~157.
7. All existing gates remain green throughout the rollout.

### Non-goals

- Visual / UX changes. JSX moves verbatim; CSS classes preserved.
- Component-level rendering tests (React Testing Library is still deferred — see sub-project #2 scope).
- Touching parent `IntelligentDataView.tsx` or sibling files (`EventList.tsx`, `EventModal` callers).
- Refactor `LeadDetail.tsx` or `LeadsView.tsx` — those are #4b and #4d.
- Adding new modal features (close on backdrop click, keyboard Esc, etc.) — out of scope.
- Reworking `EventModalProps`'s upstream callers. The new typed props must accept the same callsite shape; if upstream needs updating, do it in a follow-up.

---

## 3. Architecture

### File structure (target)

```
views/IntelligentDataView/
├── EventModal.tsx                        # ~80 LOC — orchestration container
└── EventModal/
    ├── eventModalData.ts                 # Pure: extractEventModalData(event, allExcelData)
    ├── eventModalData.test.ts            # ~15 cases
    ├── ModalHeader.tsx                   # ~30 LOC
    ├── SummaryStatistics.tsx             # ~50 LOC
    ├── RelatedOrganizations.tsx          # ~40 LOC
    ├── RelatedContacts.tsx               # ~85 LOC (largest sub-component, has nested table)
    ├── OtherEditions.tsx                 # ~35 LOC
    ├── DataQualityIssues.tsx             # ~50 LOC
    └── AllEventDataTable.tsx             # ~100 LOC (categorized table)
```

The folder name `EventModal/` (alongside `EventModal.tsx`) is the conventional React pattern for "container plus its dedicated sub-components." Tests for the pure function live next to it.

### Layer responsibilities

**`eventModalData.ts`** — pure derivation. No React, no hooks. Signature:

```typescript
export interface EventInput {
  name: string;
  data: string;
  id?: string;
  dataQualityScore?: number;
  issues?: DataIssue[];
  rawData?: Record<string, unknown>;
}

export interface EventModalData {
  dataObj: Record<string, unknown>;
  relatedData: {
    organizations: Record<string, string>[];
    contacts: Record<string, string>[];
    otherEditions: Record<string, string>[];
    suppliers: Record<string, string>[];
  };
  categories: Record<string, Record<string, unknown>>;
  statistics: {
    totalEditions: number;
    locations: Set<string>;
    countries: Set<string>;
    cities: Set<string>;
  };
}

export function extractEventModalData(
  event: EventInput | null,
  allExcelData: string,
): EventModalData;
```

When `event` is null, returns the empty default. The function's body is the current `useMemo` body, moved verbatim with `any` replaced by `unknown` and with proper return type.

**Sub-components** (`ModalHeader`, etc.) — each receives only the props it needs:

```typescript
// e.g. SummaryStatistics
interface SummaryStatisticsProps {
  statistics: EventModalData['statistics'];
}
```

No internal state, no API calls, no shared mutation. JSX moves verbatim from the corresponding region of the original file. Closures over outer-scope variables are replaced with explicit props.

**`EventModal.tsx` (container)** — composes sub-components:

```typescript
export const EventModal: React.FC<EventModalProps> = ({ event, allExcelData, onClose }) => {
  const data = useMemo(() => extractEventModalData(event, allExcelData), [event, allExcelData]);
  if (!event) return null;
  return (
    <div className="fixed inset-0 ...">
      <div className="bg-white rounded-xl ...">
        <ModalHeader event={event} onClose={onClose} />
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <SummaryStatistics statistics={data.statistics} />
            <RelatedOrganizations organizations={data.relatedData.organizations} />
            <RelatedContacts contacts={data.relatedData.contacts} />
            <OtherEditions otherEditions={data.relatedData.otherEditions} />
            <DataQualityIssues issues={event.issues ?? []} qualityScore={event.dataQualityScore} />
            <AllEventDataTable categories={data.categories} dataObj={data.dataObj} />
            <details className="bg-slate-50 ...">{/* Raw debug — kept inline */}</details>
          </div>
        </div>
        {/* Modal Footer kept inline — small (~10 LOC), one button */}
      </div>
    </div>
  );
};
```

Two sections stay inline because they are small (each ~10 LOC) and not worth their own file: the `<details>` raw-data debug block, and the modal footer.

### Type safety restoration

After the split:

- `EventModalProps` keeps the same shape but uses precise types instead of `any`. The `event.issues` and `event.rawData` fields adopt `DataIssue[]` and `Record<string, unknown>` respectively.
- Each sub-component's props are inferred from `EventModalData`. No `any` allowed anywhere in the new code.
- `// @ts-nocheck` is removed in the final commit, only after all sub-components are typed and the container compiles cleanly under strict mode.

If an `any` is genuinely required (e.g., a cell value from a heterogeneous Excel row), use `unknown` and narrow at the use site.

### What about `EventModalProps`'s `event.issues: any[]`?

The `dataQuality.ts` module already defines `DataIssue`:

```typescript
export interface DataIssue {
  severity: 'critical' | 'warning' | 'info';
  field: string;
  message: string;
}
```

The new types import it. Upstream callers that produce `event` objects already shape `issues` correctly today; the type tightening is observation-only.

---

## 4. Test strategy

### Pure function tests (~15 cases) — `eventModalData.test.ts`

Target every behavior the current `useMemo` produces:

- `extractEventModalData(null, '')` → returns the empty default shape with empty Sets and empty arrays.
- `event.rawData` populated → `dataObj` mirrors the rawData (excluding `_sheet`), preserving values.
- `event.rawData` missing but `event.data` present → `dataObj` parsed from `"key: value, key: value"` format.
- Empty `data` string → `dataObj` is empty.
- `relatedData.organizations`: a row in `allExcelData` whose sheet name contains `"org"` and matching `SERIESID` ends up in `organizations`.
- `relatedData.contacts`: rows from `"Contacts"` sheet matching by ECODE.
- `relatedData.otherEditions`: rows tagged as editions with the same series.
- `relatedData.suppliers`: rows tagged as suppliers.
- Statistics — `totalEditions` equals `relatedData.otherEditions.length + 1`.
- Statistics — `cities`, `countries`, `locations` Sets aggregated across current event + other editions.
- Categorization — known field keys land in their expected category bucket.
- Categorization — unknown field keys land in a fallback bucket.
- Edge — `event` with no `rawData` and malformed `data` string → returns reasonable empty/partial state without throwing.
- Edge — `allExcelData` empty → `relatedData` arrays all empty.
- Edge — `allExcelData` with non-matching rows → all `relatedData` arrays empty.

### Sub-component tests

Out of scope for this sub-project. Same reasoning as sub-project #2: component tests require Testing Library + jsdom configuration, which the codebase has not adopted yet. Adding it now would expand 4c beyond its warm-up purpose. A future "frontend test infra" sub-project will introduce that framework and write tests for these sub-components.

### Manual smoke test (per rollout step)

After each commit:

- `npm run dev` (or `npm run dev:api` if backend changes are involved — none expected here)
- Open the app in a browser, navigate to the Intelligent Data view, click an event row to open the modal
- Verify the same content appears as before (header text, statistics card values, contacts list, other editions, data quality issues, full table)
- Inspect the DevTools console for new red errors compared to baseline
- Close the modal — confirm the X button still works

The smoke test is the only safety net for visual regressions until proper component tests exist. Run it explicitly after every commit; do not batch.

---

## 5. Rollout plan

Eight commits, each independently revertable.

| #   | Commit                                                           | Scope                                                                                                                                                                                                                                                                                                                                                                          | Risk                                                       | Verification                               |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------ |
| 1   | `feat(view): extract eventModalData pure function`               | Create `EventModal/eventModalData.ts` and `eventModalData.test.ts`. EventModal still uses inline `useMemo` — no caller change yet.                                                                                                                                                                                                                                             | Zero                                                       | `npm test` adds ~15 cases; all pass        |
| 2   | `refactor(view): EventModal uses extractEventModalData`          | Inside `EventModal.tsx`, replace the inline `useMemo` body with a call to `extractEventModalData`.                                                                                                                                                                                                                                                                             | Low                                                        | `npm test` still passes; manual smoke test |
| 3   | `refactor(view): extract ModalHeader sub-component`              | Move header JSX into `EventModal/ModalHeader.tsx`.                                                                                                                                                                                                                                                                                                                             | Low                                                        | Smoke test                                 |
| 4   | `refactor(view): extract SummaryStatistics + DataQualityIssues`  | Two unrelated sections grouped into one commit because both are small and self-contained.                                                                                                                                                                                                                                                                                      | Low                                                        | Smoke test                                 |
| 5   | `refactor(view): extract RelatedOrganizations + RelatedContacts` | Related-data sections (largest single sub-component is RelatedContacts with its nested table).                                                                                                                                                                                                                                                                                 | Low                                                        | Smoke test                                 |
| 6   | `refactor(view): extract OtherEditions + AllEventDataTable`      | Last two large sections. After this, only the `<details>` raw-data block and the modal frame remain in EventModal.tsx.                                                                                                                                                                                                                                                         | Low                                                        | Smoke test                                 |
| 7   | `refactor(view): restore TS strict on EventModal`                | Remove `// @ts-nocheck`. Run `npm run typecheck`, fix each surfaced error with proper types (replace `any` with concrete types from `eventModalData.ts`; narrow `unknown` at use sites with explicit checks; never re-introduce `any` or `@ts-nocheck`). If a single error genuinely requires a logic fix, stop and surface it for review rather than papering over with `as`. | **Medium** — strict mode may surface real shape mismatches | `npm run typecheck` exits 0; smoke test    |
| 8   | `docs: STRICT_DEBT.md (EventModal resolved)`                     | Strike out the EventModal row in the "Files with `@ts-nocheck`" table.                                                                                                                                                                                                                                                                                                         | Zero                                                       | Read-through                               |

### Total acceptance criteria

- [ ] `npm test` passes with ~157 cases
- [ ] `EventModal.tsx` < 100 LOC
- [ ] No `@ts-nocheck` anywhere in `views/IntelligentDataView/EventModal*`
- [ ] `STRICT_DEBT.md` no longer lists EventModal
- [ ] All gates green: `lint`, `format:check`, `typecheck`, `typecheck:api`, `build`
- [ ] Manual modal smoke test passes (run by user, since CLI session cannot click buttons)
- [ ] Working tree clean

### Rollback plan

Each commit is one (sub-)component or one infrastructure change. If a commit introduces a regression, `git revert <sha>` returns just that section to its inline form. Highest-risk commit is step 7 (TS strict restoration); if it fails, revert that one commit and the file goes back to `@ts-nocheck` while the underlying split is preserved.

---

## 6. Risks and mitigations

| ID  | Risk                                                                                                                                                  | Likelihood | Impact                                         | Mitigation                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | A sub-component implicitly relied on closure over a variable in EventModal's outer scope; after extraction, prop wiring is incomplete                 | Medium     | Medium                                         | Each extraction commit's smoke test catches missing data immediately. Revert the single commit if any field disappears in the modal.      |
| R2  | `useMemo` semantics change after extraction (e.g., new identity per render breaks downstream `===` checks)                                            | Low        | Low                                            | The new function is a pure value producer; `useMemo` keeps the same dependency array, so identity stability matches the original.         |
| R3  | TS strict surfaces a real bug (e.g., `event.issues` could actually be undefined where the original code assumed array)                                | Medium     | Medium — but a positive: it's a real bug found | When R3 happens, do not paper over with `as`; fix the upstream caller or default to `[]`. Document the discovered case in commit message. |
| R4  | Sub-component file count adds folder noise                                                                                                            | Low        | Low                                            | The folder is one level deep and groups related files together; matches the React community pattern.                                      |
| R5  | The pure data function tests cement current quirky behavior (e.g., a partial-match `SERIESNAME` substring of length 20) before it can be reconsidered | Medium     | Low                                            | Tests document existing behavior. Improvements to the matching heuristics belong to a later sub-project, not this refactor.               |

---

## 7. Open questions

None. Brainstorming resolved:

- Folder structure: container at `EventModal.tsx`, sub-components in `EventModal/` (alongside, not inside, `EventModal.tsx`).
- Pure function naming: `extractEventModalData(event, allExcelData)`.
- Test scope: pure function only; component tests deferred.
- Visual changes: none.
- TS strict restoration: in the final commit (step 7), one commit dedicated to type cleanup.

---

## 8. Next steps after approval

1. User reviews this spec and approves or requests changes.
2. Hand off to `writing-plans` skill for the bite-sized step-by-step plan.
3. Implement; on completion, this unblocks #4b (`LeadDetail.tsx` 1998 LOC, the next and biggest `@ts-nocheck` god file).
