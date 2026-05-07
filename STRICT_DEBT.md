# Strict Mode Debt

Created during sub-project #1 (cleanup + tooling baseline). Each entry must be
resolved during the indicated future sub-project. **Do NOT remove `@ts-nocheck`
or `@ts-expect-error TODO(refactor)` markers without a real fix.**

## Deferred TypeScript flags

These flags from the original spec were turned off because the cleanup cost
outweighed the benefit at this stage:

| Flag                         | Reason                                                                                                                                                                              | Resolve in                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `noUnusedLocals`             | ESLint already enforces this with auto-fix and `_` ignore patterns. Keeping both is redundant; ESLint handles it better.                                                            | — (intentional, won't re-enable)                                                              |
| `noUnusedParameters`         | Same as above.                                                                                                                                                                      | — (intentional, won't re-enable)                                                              |
| `noUncheckedIndexedAccess`   | Caused 2700+ cascading errors mostly from `req.params.x` (typed as `string \| undefined`). Real bug-catching value is real but requires API-layer normalization first.              | Re-enable in sub-project #5 (API layer-ization) after request validation middleware is added. |
| `exactOptionalPropertyTypes` | Caused ~17 cascading errors at exact-vs-optional boundaries (object literal builds passing through ad-hoc shapes). Each fix would need to touch both call site and type definition. | Re-enable in sub-project #5 once API/DB types are unified.                                    |

## Files with `@ts-nocheck`

| File                                   | Reason                                                                           | Resolve in                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `components/LeadDetail.tsx` (1998 LOC) | God file with 21+ strict-mode errors requiring structural changes to fix safely. | Sub-project #4b (refactor god files). Split into smaller components, then remove `@ts-nocheck`. |

**Resolved:**

- ~~`views/IntelligentDataView/EventModal.tsx`~~ — resolved in sub-project #4c (commits `b868dfc..2ec016b`). Split into 7 sub-components + a tested `extractEventModalData` pure function; `@ts-nocheck` removed.

## Per-line `@ts-expect-error TODO(refactor)`

| File:Line                                                              | Reason                                                                                                | Resolve in                                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `api/src/routes/excelImport.ts:~507` and `~539` (`organizationName`)   | `eventsMap` value type is inferred too narrowly; `organizationName` isn't part of the inferred shape. | Sub-project #4 — `excelImport.ts` is a god file (810 LOC); extract types when splitting. |
| `api/src/services/managerReportService.ts:~546` (`weekday: 'numeric'`) | `'numeric'` isn't a valid weekday option in standard `DateTimeFormat`, but works at runtime.          | Sub-project #5 — replace with proper week-number calculation.                            |
| `api/src/services/scheduledReportsJob.ts:~28` (`scheduled: true`)      | node-cron v4 changed `TaskOptions`; `scheduled` was removed.                                          | Sub-project #6 — migrate to current node-cron API (`cron.schedule` + `.start()`).        |
| `api/src/utils/imapService.ts:~126` and `~315` (mailparser callback)   | mailparser typings reject async callbacks; switching to its promise-based API would be cleaner.       | Sub-project #5 — migrate to promise-based simpleParser.                                  |

**Resolved:**

- ~~`api/src/routes/emailReplies.ts:~102`~~ — typed payload as `EmailReply`; replaced `null` fields with `undefined` / omission.
- ~~`api/src/routes/eventBrief.ts:~42` (`val: 'clear'`)~~ — switched to `type: ShadingType.CLEAR` (the property `val` was being silently ignored at runtime; `type` is the documented docx field).
- ~~`views/EmailTemplatesView.tsx:~233` and `~244` (`attachments`)~~ — made `EmailTemplateAttachment.template_id` optional in frontend `types.ts` (server fills on create/update; frontend never reads it).
- ~~`vite.config.ts:~5` (`defineConfig`)~~ — extracted async config to a `UserConfigFnPromise`-typed const so the correct `defineConfig` overload is selected.

## Manual castings to flag for review

These places do NOT have `@ts-expect-error` but represent legacy data shape concerns:

| File:Line                      | Note                                                                                                                                         | Resolve in                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `hooks/useLeads.ts:~63`        | Backend may return either camelCase or snake_case lead rows; we cast to `any` and check both. The proper fix is unifying the response shape. | Sub-project #5 — API normalization.             |
| `api/src/routes/vertex.ts:~83` | `await response.json()` returns `unknown`; we cast to `any` to access `data.error.message` etc.                                              | Sub-project #5 — Zod-parse Vertex AI responses. |

---

When refactoring during a later sub-project, search for `TODO(refactor)` and
remove markers as the underlying cause is fixed. The presence of any marker
after sub-project #5 indicates incomplete migration work.
