# Smart Venue Booking — Phase 1 Implementation Plan (internal UI)

**Spec:** `docs/superpowers/specs/2026-07-16-smart-venue-booking-design.md` (§3 Phase 1)
**Scope:** internal Bookings UI on top of the Phase 0 API. No backend changes.
**Pattern:** BookingDetail copies the completed `components/LeadDetail/` shape — state in hooks, JSX presentational, pure helpers colocated with tests. No new god files.

## Decisions

- **Frontend booking/venue types stay snake_case** (like `EmailReply`), mirroring API JSON 1:1 — no `mapLeadFromDB`-style mapping layer to drift.
- **No date-fns.** Week math is ~6 tiny pure functions in `calendarHelpers.ts` with tests; zero new deps (the chat-level plan mentioned date-fns — hand-rolled is more consistent with the repo and testable).
- **Day boundaries are browser-local time** (operations are Asia/Ho_Chi_Minh and the tool is internal); API speaks ISO with offsets either way.
- **Nav:** new sidebar section "Venue" → tab id `bookings`, visible to all roles (like Audience); create/edit gated by `canEdit` (Director/Sales), Viewer gets a read-only drawer via `<fieldset disabled>`.
- **Calendar shows hold/quoted/confirmed** (the `/availability` semantics); the List shows all statuses.
- **Conflict UX:** soft warnings from `POST /bookings` surface after create; a "Check conflicts" button in the drawer runs `GET /check-conflicts` per space row on demand; a `23P01` 409 renders as the drawer error banner.

## Tasks

| #   | Commit-sized task                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | `fix(api-client)`: apiCall chokes on 204 empty bodies (breaks every delete) — prerequisite.                                                                                                                              |
| 1   | This plan + `types.ts` (`BookingStatus`, `Venue`, `BookingSpace`, `Booking`) + `services/apiService.ts` (`venuesApi`, `bookingsApi`, availability/conflict/payload types).                                               |
| 2   | `views/BookingsView/calendarHelpers.ts` + tests: week math (Mon start), half-open block↔day overlap, VND + time formatting, status tone/label maps.                                                                      |
| 3   | Nav wiring (Sidebar "Venue" section, App.tsx lazy route) + `views/BookingsView.tsx` (week nav, Calendar/List toggle) + `useBookingsData` + `BookingsCalendar` (venue × day grid, click block/cell) + `BookingsList`.     |
| 4   | `components/BookingDetail/` — `bookingDetailHelpers` (+tests: datetime-local conversions, draft validation, draft↔payload), `useBookingForm` hook (create/update/delete, warnings, 409), `LeadPicker`, drawer component. |
| 5   | Gates + browser smoke end-to-end + CLAUDE.md track update.                                                                                                                                                               |

## Verification

- Unit: calendarHelpers (~20 cases) + bookingDetailHelpers (~15 cases); suite grows from 264.
- Gates per commit: `typecheck`, `typecheck:api`, `test` (hooks are not active in this environment — run manually).
- Browser smoke (Playwright, live DB): Bookings tab renders 8 venue rows × 7 days; create a hold from an empty cell → block appears; overlapping second hold → warning; confirm the first → OK; confirm the second → 409 in drawer; delete both; list filter chips work.

## Left for a later P1 session

- LeadDetail: show the lead's bookings (info tab block) + "New booking from lead" shortcut.
- Venues management UI (edit placeholder capacities/rates in-app; today: PUT /venues or SQL).
- Calendar month view (week view ships first).
