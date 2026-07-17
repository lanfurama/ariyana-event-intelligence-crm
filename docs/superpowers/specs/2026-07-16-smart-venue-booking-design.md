# Smart Venue Booking — Design Spec

**Date:** 2026-07-16
**Status:** Approved (user confirmed the 4 scope decisions in-session, 2026-07-16)
**Track:** Smart Convention Centre — new product track alongside the refactor roadmap (#1–#10)
**Owner:** lanfurama (solo)

---

## 1. Context

Ariyana Mail today is an email-marketing CRM: Audience (leads) → Email Studio (templates, single/bulk send, IMAP replies) → Enrichment (Vertex/Gemini) → scheduled VN manager reports. The venue itself — Ariyana Convention Centre — is only implied by the data (delegates counts, event history, ICCA imports).

This track extends the product into a **venue-rental platform**: manage the space inventory, track rental bookings on a per-venue calendar, produce quotes/proposals, and eventually let customers browse spaces and submit rental requests themselves ("smart convention centre"). The "smart" layer is AI: parse inbound RFP emails, suggest fitting spaces, draft proposals — all on integrations the codebase already has.

The 2026-07-16 audit found the "event intelligence" half of the codebase dead UI-side but **alive and reusable server-side**. This track deliberately resurrects those assets:

| Existing asset                                                    | Reused for                                        |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| `api/src/routes/eventBrief.ts` — DOCX generation (`docx` lib)     | Proposal / quote / BEO document export (Phase 2)  |
| Email Studio + `utils/emailSender` (templates, attachments, SMTP) | Proposal sending, confirmations, follow-ups       |
| `utils/imapService.ts` — reply matching                           | Inbound RFP email intake (Phase 4)                |
| `services/ai/prompts/` pattern (dual-provider builders + tests)   | `parseRfpEmail`, `suggestVenues`, `draftProposal` |
| `managerReportService` + node-cron                                | Booking stats in scheduled reports (Phase 5)      |
| `EventBrief` type, `utils/eventScoring.ts` (currently unwired)    | Event profile / opportunity scoring (later)       |
| Dashboard + `components/common/Stats.tsx` (dataviz method)        | Occupancy / revenue analytics (Phase 5)           |

### Constraints discovered in the audit (load-bearing for this design)

1. **No server-side auth exists.** No JWT/passwords/sessions; roles are a client-side gate only. Every `/api/v1/*` endpoint is publicly callable. Acceptable for the internal tool, **a hard blocker for any public customer-facing surface** — real auth is therefore a Phase 3 prerequisite, not an afterthought.
2. **Three Express bootstraps** mount routers independently: `api/src/server.ts` (`/api/*`), `api/v1/[...path].ts` (Vercel, `/api/v1/*`), `vite-plugin-api.ts` (dev, `/api/v1/*`). New routers must be registered in **all three**. In `vite-plugin-api.ts` the `routePaths` array is index-mapped and ends with `database.js` — inserting routes shifts the `query` index.
3. **No migration framework.** Numbered `.sql` files in `migrations/`, run via `runMigrationGeneric.ts` — a naive `;`-splitter (quote-aware, no dollar-quoting) that skips `COMMENT` statements and swallows "already exists" errors. Consequence: **no triggers, functions, or DO blocks** in migrations; idempotency via `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`.
4. **Cron only runs in `server.ts`** (standalone), not on Vercel. Scheduled booking automations must either reuse that or a Vercel Cron hitting an endpoint (Phase 4/5 concern).
5. Frontend has **no router, no state manager, no calendar/date library, no chart library**. Navigation is an `activeTab` switch in `App.tsx` + `Sidebar.tsx`. The established decomposition pattern is `components/LeadDetail/` (hook-per-concern + pure helpers + colocated tests).

## 2. Scope decisions (user-confirmed 2026-07-16)

1. **Internal-first.** Phases 0–2 build the internal tool (Sales/Director); the public portal is Phase 3.
2. **Customer requests need no account.** The public surface is a browse + request-form flow; Sales handles the rest in the CRM. Online payments/deposits are out of scope (future).
3. **Venue seed data is placeholder.** Seeded from public knowledge of Ariyana Convention Centre with round-number capacities/rates, clearly marked; the user corrects real figures in the Venues UI.
4. **New UI is English** (consistent with the current shell). The customer portal will be bilingual VN/EN when built (Phase 3).

## 3. Phase overview

| Phase | Deliverable                                                                                                                         | Est.          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **0** | **Data + API core: venues, bookings, spaces, quotes schema; venue/booking CRUD + availability endpoints; seeds; pure-helper tests** | ~2 sessions   |
| 1     | Internal UI: `bookings` tab — resource calendar (venue × day), booking list by status, BookingDetail drawer (LeadDetail pattern)    | ~3 sessions   |
| 2     | Quotes: builder UI, Director approval gate for discounts, DOCX proposal export, send via Email Studio                               | ~2 sessions   |
| 3     | Real auth (JWT + passwords + `requireRole`) **then** public portal (browse spaces, free/busy, request form → Lead + inquiry)        | ~3–4 sessions |
| 4     | Smart layer: AI RFP parsing from IMAP intake, venue suggestions, proposal drafts                                                    | ~2 sessions   |
| 5     | Analytics: occupancy %, pipeline value, funnel, seasonality on Dashboard; booking stats in manager reports                          | ~1–2 sessions |

Future (explicitly out of scope): online payment/deposit (VNPay), e-contract/e-signature, IoT (sensors, signage, wayfinding), multi-tenant.

**This spec details Phase 0.** Phases 1–5 get their own plan docs (and spec addenda if the design here proves insufficient) when they start.

## 4. Phase 0 — data model

New migration `migrations/013_venue_booking.sql`. All new DDL is complete in-repo (unlike the legacy base tables). Requires the `btree_gist` extension (equality on `varchar` inside a GiST exclusion constraint).

### Tables

**`venues`** — the space inventory:

```sql
id VARCHAR(255) PRIMARY KEY,            -- 'venue-grand-ballroom' (seeds) / 'venue-<ts>-<rand>' (runtime)
name VARCHAR(255) NOT NULL,
slug VARCHAR(255) NOT NULL UNIQUE,
floor VARCHAR(50),
area_sqm NUMERIC(8,1),
ceiling_height_m NUMERIC(4,1),
capacities JSONB NOT NULL DEFAULT '{}',    -- { theatre, classroom, banquet, cocktail, ushape, boardroom }
description TEXT,
images JSONB NOT NULL DEFAULT '[]',        -- string[] URLs (Phase 1+ uploads TBD)
base_rates JSONB NOT NULL DEFAULT '{}',    -- { hourly, half_day, full_day } in VND
amenities JSONB NOT NULL DEFAULT '[]',     -- string[]
is_active BOOLEAN NOT NULL DEFAULT true,
display_order INTEGER NOT NULL DEFAULT 0,
created_at / updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**`bookings`** — one rental/event (may span multiple spaces/days via `booking_spaces`):

```sql
id VARCHAR(255) PRIMARY KEY,
code VARCHAR(50) NOT NULL UNIQUE,          -- 'ARY-2026-0001'
lead_id VARCHAR(255) REFERENCES leads(id) ON DELETE SET NULL,   -- CRM link, optional
title VARCHAR(255) NOT NULL,
event_type VARCHAR(100),                   -- free text: conference / banquet / exhibition / ...
status VARCHAR(20) NOT NULL DEFAULT 'inquiry'
  CHECK (status IN ('inquiry','hold','quoted','confirmed','completed','cancelled')),
expected_guests INTEGER,
layout VARCHAR(50),
notes TEXT,
source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','portal','email_ai')),
created_by VARCHAR(255),                   -- username, informational (no server auth yet)
created_at / updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**`booking_spaces`** — venue × time-range lines under a booking:

```sql
id SERIAL PRIMARY KEY,
booking_id VARCHAR(255) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
venue_id VARCHAR(255) NOT NULL REFERENCES venues(id),            -- no CASCADE: venue delete is blocked if referenced
start_at TIMESTAMPTZ NOT NULL,             -- event time
end_at TIMESTAMPTZ NOT NULL,
setup_minutes INTEGER NOT NULL DEFAULT 0,
teardown_minutes INTEGER NOT NULL DEFAULT 0,
block_start_at TIMESTAMPTZ NOT NULL,       -- start_at - setup; maintained by BookingModel
block_end_at TIMESTAMPTZ NOT NULL,         -- end_at + teardown; maintained by BookingModel
booking_status VARCHAR(20) NOT NULL DEFAULT 'inquiry',           -- denormalized copy of bookings.status
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
CHECK (end_at > start_at), CHECK (block_start_at <= start_at), CHECK (block_end_at >= end_at)
```

**`quotes`** / **`quote_items`** — created now for schema stability; API + UI arrive in Phase 2:

```sql
quotes: id PK, booking_id FK CASCADE, version INT DEFAULT 1,
  status CHECK ('draft','sent','accepted','rejected','expired') DEFAULT 'draft',
  currency VARCHAR(10) DEFAULT 'VND', subtotal NUMERIC(14,0), discount_pct NUMERIC(5,2),
  vat_pct NUMERIC(5,2) DEFAULT 8, total NUMERIC(14,0), valid_until DATE, sent_at TIMESTAMP,
  notes TEXT, created_at / updated_at
quote_items: id SERIAL PK, quote_id FK CASCADE,
  kind CHECK ('venue','fnb','av','service','other') DEFAULT 'other',
  description VARCHAR(500) NOT NULL, quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(14,0) DEFAULT 0, amount NUMERIC(14,0) DEFAULT 0, sort_order INTEGER DEFAULT 0
```

Plus a global sequence `booking_code_seq` for booking codes, and indexes on `booking_spaces(booking_id)`, `booking_spaces(venue_id, block_start_at, block_end_at)`, `bookings(status)`, `bookings(lead_id)`, `quotes(booking_id)`, `quote_items(quote_id)`.

### Double-booking enforcement (the core invariant)

```sql
ALTER TABLE booking_spaces ADD CONSTRAINT booking_spaces_no_confirmed_overlap
  EXCLUDE USING gist (
    venue_id WITH =,
    tstzrange(block_start_at, block_end_at) WITH &&
  ) WHERE (booking_status = 'confirmed');
```

- **Hard block:** two `confirmed` bookings can never overlap on the same venue — enforced by Postgres itself, race-safe under concurrent writes (the constraint serializes competing confirms; the loser gets SQLSTATE `23P01`).
- **Soft block (warn, allow):** `hold` and `quoted` may overlap anything — multiple tentative options on the same date are normal MICE practice (1st/2nd option). The API returns these as `warnings`.
- **Non-blocking:** `inquiry`, `completed`, `cancelled`.
- Ranges are **half-open `[)`** — back-to-back bookings (one ends 12:00, next starts 12:00) do not conflict.
- The blocked range includes setup/teardown buffers.

### Design decisions and why

- **`TIMESTAMPTZ` for event times** (house style elsewhere is naive `TIMESTAMP`): Vercel serverless runs UTC while operations are Asia/Ho_Chi_Minh; naive timestamps would silently shift by 7 hours between environments. `created_at`-style audit columns stay `TIMESTAMP` per house style.
- **`block_start_at`/`block_end_at` are physical columns, not expressions in the constraint:** `timestamptz ± interval` is STABLE (not IMMUTABLE) in Postgres, so `tstzrange(start_at - make_interval(...), ...)` is illegal in an index/constraint expression. Physical columns computed by `BookingModel` keep the constraint expression immutable. `CHECK`s guarantee the block range envelopes the event range. (Generated columns hit the same immutability wall.)
- **`booking_status` denormalized onto `booking_spaces`:** exclusion constraints cannot reference another table. `BookingModel` syncs it in the same transaction as every `bookings.status` change; it is never written by any other path.
- **Booking code `ARY-YYYY-NNNN`** with `NNNN` from the global sequence (race-safe, no per-year reset — the year is informational, uniqueness comes from the sequence).
- **Money is `NUMERIC(14,0)` VND** (no decimals; totals can exceed int4). `pg` returns `NUMERIC` as strings — the model layer converts numeric fields to JS numbers so route payloads stay `number`-typed.
- **Venue deletion is guarded:** FK from `booking_spaces.venue_id` has no CASCADE; `DELETE /venues/:id` returns 409 when referenced, directing to `is_active = false` (history is never destroyed).

## 5. Phase 0 — API surface

Two new routers, registered in all three bootstraps, following house conventions (thin handlers, manual validation, try/catch per endpoint, `Model` classes own SQL, app-generated string ids).

**`/api/v1/venues`** (`api/src/routes/venues.ts`)

| Endpoint      | Behavior                                                                         |
| ------------- | -------------------------------------------------------------------------------- |
| `GET /`       | Active venues ordered by `display_order, name`; `?include_inactive=true` for all |
| `GET /:id`    | One venue or 404                                                                 |
| `POST /`      | Requires `name`; slug auto-derived (slugify) when absent; 409 on slug collision  |
| `PUT /:id`    | Partial update (LeadModel-style fieldMap)                                        |
| `DELETE /:id` | Hard delete; 409 with guidance if referenced by bookings                         |

**`/api/v1/bookings`** (`api/src/routes/bookings.ts`) — literal routes declared before `/:id`:

| Endpoint               | Behavior                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /`                | Bookings with aggregated `spaces` (`json_agg`); filters `status`, `venue_id`, `lead_id`, `from`, `to`, `search`                                        |
| `GET /availability`    | `?from&to[&venue_id]` (required window) → space blocks of `hold`/`quoted`/`confirmed` bookings with code/title/status — the calendar + portal feed     |
| `GET /check-conflicts` | `?venue_id&start_at&end_at[&setup_minutes&teardown_minutes&exclude_booking_id]` → `{ hard: [], soft: [] }` — pre-save warning UX                       |
| `GET /:id`             | Booking + spaces or 404                                                                                                                                |
| `POST /`               | `{ title, spaces: [{venue_id,start_at,end_at,setup_minutes?,teardown_minutes?}], ...fields }` → 201 `{ booking, warnings }`; `23P01` → 409 + conflicts |
| `PUT /:id`             | Partial fields; optional `spaces` = full replace; status change syncs `booking_spaces.booking_status`; same 409 mapping                                |
| `DELETE /:id`          | Cascades spaces (and quotes)                                                                                                                           |

`BookingModel.create`/`update` own their transactions via `getClient()` (BEGIN/COMMIT/ROLLBACK) — multi-row writes plus the status sync must be atomic. Everything else uses the shared `query()` helper like existing models.

**No auth on these endpoints** — deliberate parity with the rest of the API until Phase 3 introduces real auth for everything.

## 6. Phase 0 — pure helpers (the tested layer)

`api/src/utils/bookingHelpers.ts` — pure functions only, colocated `bookingHelpers.test.ts` (~30 cases), mirroring the `leadDetailHelpers` discipline:

```typescript
rangesOverlap(aStart, aEnd, bStart, bEnd): boolean        // half-open [) semantics
computeBlockRange(startAt, endAt, setupMin, teardownMin)  // → { blockStartAt, blockEndAt }
findSpaceConflicts(candidate, existing[])                 // → { hard: [], soft: [] } by status class
validateBookingSpacesPayload(spaces: unknown)             // → { ok, errors[], spaces[] } (ISO parse, end>start, buffers ≥ 0)
computeQuoteTotals(items, discountPct, vatPct)            // VND integer rounding; ready for Phase 2
formatBookingCode(year, seq)                              // 'ARY-2026-0042'
slugifyVenueName(name)                                    // 'Grand Ballroom' → 'grand-ballroom'
```

Status classes live here as exported constants (`HARD_BLOCK_STATUSES = ['confirmed']`, `SOFT_BLOCK_STATUSES = ['hold','quoted']`) so the model, routes, and future UI share one definition.

Models/routes get no unit tests (consistent with the codebase — no model/route tests exist); they are covered by the end-to-end smoke instead.

## 7. Seeds

Eight venues, deterministic ids (`venue-grand-ballroom`, `venue-summit-hall`, `venue-hoi-an-1`, `venue-hoi-an-2`, `venue-my-son-1`, `venue-my-son-2`, `venue-prefunction-foyer`, `venue-ariyana-lawn`), inserted with `ON CONFLICT (id) DO NOTHING`. **All capacities/rates are placeholder round numbers**; every description ends with "(placeholder figures — edit in the Venues UI)". No apostrophes/semicolons in seed strings (migration-runner quirk).

## 8. Test & verification strategy

- **Unit:** ~30 vitest cases on `bookingHelpers` (boundary overlap, buffer-induced conflicts, status classification, payload validation, VND rounding, code/slug formatting).
- **Gates:** `npm run typecheck`, `typecheck:api`, `npm test` green before every commit (pre-push enforces; run manually anyway).
- **End-to-end smoke (per milestone, curl against the dev server):** health → `GET /venues` returns 8 seeds → `POST /bookings` (hold) → `GET /availability` shows it → second overlapping booking `PUT` to `confirmed` twice → second confirm gets **409** → `GET /check-conflicts` reports the hold as soft → cleanup test bookings.
- Browser smoke is N/A until Phase 1 (no UI in Phase 0).

## 9. Rollout (Phase 0 = 4 commits)

| #   | Commit                                                                  | Scope                                                                                                           |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | `docs(superpowers): smart venue booking spec + phase 0 plan`            | This spec, the Phase 0 plan, CLAUDE.md roadmap/track entry                                                      |
| 2   | `feat(venues): migration 013 — venue booking schema + anti-double-book` | `013_venue_booking.sql` + seeds + `migrate:venue-booking` npm script; run on local DB                           |
| 3   | `feat(venues): booking pure helpers + tests`                            | `bookingHelpers.ts` + `bookingHelpers.test.ts`                                                                  |
| 4   | `feat(venues): venue/booking models + routes in all three bootstraps`   | Types, `VenueModel`, `BookingModel`, `routes/venues.ts`, `routes/bookings.ts`, 3 bootstraps + endpoint listings |

Each commit is independently revertable; the schema (commit 2) is additive and touches no existing table.

## 10. Risks

| ID  | Risk                                                                                             | Mitigation                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| R1  | `pg` returns `NUMERIC` as string → `area_sqm`/rates arrive as strings and break arithmetic later | Model layer normalizes numeric fields to `number`; helper tests pin `computeQuoteTotals` numeric behavior   |
| R2  | `CREATE EXTENSION btree_gist` needs superuser on some setups                                     | Local dev uses the owner role; documented fallback: run the statement once as superuser                     |
| R3  | Naive migration splitter mangles a statement                                                     | No dollar-quoting/triggers/DO blocks; no `;`/apostrophes in seed strings; verified by running the migration |
| R4  | `vite-plugin-api.ts` index shift breaks the `query` import (database.js is index-mapped last)    | Insert new routers before `database.js` and update its index in the same edit; smoke hits `/health` first   |
| R5  | Status-sync bug leaves `booking_spaces.booking_status` stale → constraint checks the wrong class | Sync is a single UPDATE inside the same transaction as the status write; smoke exercises hold→confirmed→409 |
| R6  | New endpoints are public like everything else                                                    | Accepted for the internal phase; Phase 3 gates the whole API before any public surface ships                |
| R7  | Timezone display bugs (TIMESTAMPTZ ↔ UI)                                                         | Phase 1 UI formats explicitly in Asia/Ho_Chi_Minh; API speaks ISO 8601 with offsets end-to-end              |

## 11. Next steps after Phase 0

1. Manual review of seeded venue data by the user (correct real capacities/rates in DB or wait for the Phase 1 Venues UI).
2. Phase 1 plan doc (`docs/superpowers/plans/2026-07-16-smart-venue-booking-phase1.md`) — calendar UI + BookingDetail drawer. Finish #4b Tasks 6–8 first so the LeadDetail pattern is complete before BookingDetail copies it.
3. Revisit this spec before Phase 3 to detail the auth design (it deserves its own spec).
