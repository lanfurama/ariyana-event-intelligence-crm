# Smart Venue Booking — Phase 0 Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-16-smart-venue-booking-design.md` (§4–§9)
**Scope:** data model + API core only. No frontend changes in this phase.

---

## Task 1 — Spec + plan + CLAUDE.md (docs commit)

- Write the design spec and this plan.
- CLAUDE.md: add the track to the roadmap table + a "Smart venue booking" track section (user decisions, phase status, key technical decisions).
- **Verify:** read-through; prettier via pre-commit.
- **Commit:** `docs(superpowers): smart venue booking spec + phase 0 plan`

## Task 2 — Migration 013 + seeds

Create `migrations/013_venue_booking.sql`, statement order:

1. `CREATE EXTENSION IF NOT EXISTS btree_gist;`
2. `CREATE TABLE IF NOT EXISTS venues (...)` per spec §4.
3. `CREATE SEQUENCE IF NOT EXISTS booking_code_seq START 1;`
4. `CREATE TABLE IF NOT EXISTS bookings (...)`, `booking_spaces (...)`, `quotes (...)`, `quote_items (...)`.
5. Indexes (`IF NOT EXISTS`): `booking_spaces(booking_id)`, `booking_spaces(venue_id, block_start_at, block_end_at)`, `bookings(status)`, `bookings(lead_id)`, `quotes(booking_id)`, `quote_items(quote_id)`.
6. `ALTER TABLE booking_spaces ADD CONSTRAINT booking_spaces_no_confirmed_overlap EXCLUDE USING gist (venue_id WITH =, tstzrange(block_start_at, block_end_at) WITH &&) WHERE (booking_status = 'confirmed');`
7. Seed 8 venues (`ON CONFLICT (id) DO NOTHING`, multi-row INSERT, placeholder figures, no `'`/`;` inside strings).
8. `COMMENT ON TABLE ...` for psql users (runner skips these).

Also: `api/package.json` script `"migrate:venue-booking": "tsx src/scripts/runMigrationGeneric.ts 013_venue_booking.sql"`.

- **Migration-runner constraints:** no dollar-quoting / triggers / DO blocks; full-line `--` comments only are stripped; re-runs are safe ("already exists" swallowed + `IF NOT EXISTS`/`ON CONFLICT`).
- **Verify:** run `npm run migrate:venue-booking` (from `api/`) against the local DB — all statements OK; re-run — all skipped/no-op. If `CREATE EXTENSION` fails with a permission error, run it once as superuser and re-run the migration.
- **Commit:** `feat(venues): migration 013 — venue booking schema + anti-double-book`

## Task 3 — Pure helpers + tests

Create `api/src/utils/bookingHelpers.ts` (pure — no pg, no express, no Date.now):

- `HARD_BLOCK_STATUSES = ['confirmed']`, `SOFT_BLOCK_STATUSES = ['hold', 'quoted']` (exported consts).
- `rangesOverlap(aStart, aEnd, bStart, bEnd)` — half-open `[)`: `aStart < bEnd && bStart < aEnd`.
- `computeBlockRange(startAt, endAt, setupMinutes, teardownMinutes)` → `{ blockStartAt, blockEndAt }` (minute arithmetic).
- `findSpaceConflicts(candidate, existing)` → `{ hard, soft }`; candidate = `{ venueId, blockStartAt, blockEndAt }`; existing rows carry `venue_id`, `block_start_at`, `block_end_at`, `booking_status`, `booking_id`; supports `excludeBookingId`.
- `validateBookingSpacesPayload(spaces)` → `{ ok, errors, spaces }` — array non-empty, `venue_id` string, ISO dates parseable, `end_at > start_at`, buffers integers ≥ 0 (default 0).
- `computeQuoteTotals(items, discountPct, vatPct)` → `{ subtotal, discountAmount, vatAmount, total }`, VND integers (`Math.round` per line + per aggregate).
- `formatBookingCode(year, seq)` → `ARY-2026-0042` (pad 4, no truncation past 9999).
- `slugifyVenueName(name)` — lowercase, diacritics stripped, non-alnum → `-`, trim/collapse dashes.

Create `api/src/utils/bookingHelpers.test.ts` (~30 cases): boundary overlap (touching ranges don't conflict), buffers creating conflicts, status classification incl. `excludeBookingId`, payload validation failures, VND rounding, code formatting (seq 1 / 42 / 12345), slug with Vietnamese diacritics.

- **Verify:** `npm test` — new cases pass, total count rises from the 227 baseline.
- **Commit:** `feat(venues): booking pure helpers + tests`

## Task 4 — Types, models, routes, bootstraps

1. `api/src/types/index.ts`: `BookingStatus`, `BookingSource`, `QuoteStatus`, `QuoteItemKind`, `VenueCapacities`, `VenueRates`, `Venue`, `Booking`, `BookingSpace`, `BookingWithSpaces`, `Quote`, `QuoteItem` (snake_case fields, house style).
2. `api/src/models/VenueModel.ts` — `getAll(includeInactive?)`, `getById`, `create`, `update` (fieldMap pattern), `delete`; normalize `NUMERIC` strings → numbers on the way out.
3. `api/src/models/BookingModel.ts` — `getAll(filters)` with `json_agg` spaces; `getById`; `create(booking, spaces)` and `update(id, fields, spaces?)` owning transactions via `getClient()` (insert/replace spaces with computed block ranges + `booking_status` sync in the same transaction); `delete`; `getSpacesInWindow(from, to, venueId?, statuses?)`; `nextCode(client)` via `booking_code_seq`.
4. `api/src/routes/venues.ts`, `api/src/routes/bookings.ts` per spec §5. Literal routes (`/availability`, `/check-conflicts`) **before** `/:id`. Map pg error `23P01` → 409 `{ error, conflicts }`, `23505` (slug/code) → 409, FK violation on venue delete → 409.
5. Register in all three bootstraps + their root endpoint listings:
   - `api/src/server.ts`: imports + `app.use('/api/venues', ...)`, `app.use('/api/bookings', ...)`.
   - `api/v1/[...path].ts`: imports + `app.use('/venues', ...)`, `app.use('/bookings', ...)`.
   - `vite-plugin-api.ts`: add `./api/src/routes/venues.js`, `./api/src/routes/bookings.js` to `routePaths` **before** `database.js`; update the index-mapped assignments (`database.js` becomes index 16 → `query = routes[16].query`); `app.use` both.

- **Verify:** `npm run typecheck && npm run typecheck:api && npm test` all green.
- **Commit:** `feat(venues): venue/booking models + routes in all three bootstraps`

## Task 5 — End-to-end smoke (no commit unless fixups)

With `npm run dev` running (vite + API middleware on `/api/v1`):

1. `GET /api/v1/health` → `database: connected`.
2. `GET /api/v1/venues` → 8 seeded venues, ordered.
3. `POST /api/v1/bookings` → hold on `venue-grand-ballroom`, response 201 with code `ARY-…` and empty `warnings`.
4. `GET /api/v1/bookings/availability?from=…&to=…` → shows the hold block (buffers included).
5. `POST` a second overlapping booking (hold) → 201 **with warnings** (soft conflict).
6. `PUT` booking 1 → `confirmed` → 200. `PUT` booking 2 → `confirmed` → **409** with conflicts payload.
7. `GET /api/v1/bookings/check-conflicts?...` for a third overlapping window → booking 1 in `hard`, booking 2 in `soft`.
8. `DELETE` both test bookings → availability window empty again.

Record results; fix + `fix(venues): …` commit only if something breaks.

---

## Acceptance criteria (Phase 0 done)

- [ ] Migration runs clean and re-runs as a no-op on the local DB
- [ ] 8 seed venues visible via `GET /api/v1/venues`
- [ ] Confirmed-overlap insert/update rejected by Postgres (409 surfaced with conflict details)
- [ ] Hold overlap allowed and reported as `warnings` / soft conflicts
- [ ] `typecheck`, `typecheck:api`, `test` green; test count > 227 baseline
- [ ] Routers live in all three bootstraps (dev `/api/v1/*`, standalone `/api/*`, Vercel `/api/v1/*`)
- [ ] CLAUDE.md tracks the new track; working tree clean
