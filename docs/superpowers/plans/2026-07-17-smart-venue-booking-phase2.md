# Smart Venue Booking — Phase 2 Implementation Plan (quotes + DOCX proposals)

**Spec:** `docs/superpowers/specs/2026-07-16-smart-venue-booking-design.md` (§3 Phase 2; quotes schema landed in P0 migration 013)
**Scope:** versioned quotes per booking, DOCX proposal export, send-by-email through the existing send pipeline. No new tables.

## Decisions

- **Totals are computed server-side only** (`computeQuoteTotals` in `api/src/utils/bookingHelpers.ts`, already unit-tested). The frontend keeps a tiny display-mirror in `quoteHelpers.ts` for the live preview; persisted numbers always come from the server response.
- **Quote versioning:** `version = MAX(version)+1` per booking inside the create transaction. Editing a quote updates in place; a "new version" is just a new quote on the same booking.
- **DOCX endpoint** `GET /api/v1/quotes/:id/docx` reuses the `eventBrief.ts` docx pattern (same lib, same streaming headers). English document per the track's language decision.
- **Send-by-email reuses `POST /leads/send-email`** — the frontend fetches the DOCX as a data-URL and passes it as a base64 attachment, exactly like LeadDetail file uploads. Requires the booking to be linked to a lead with `keyPersonEmail`; the send also flips the quote to `sent` (+`sent_at`) and lands in `email_logs`, so IMAP reply matching covers proposals for free. No new backend send code.
- **Discount approval gate is client-side** (like every role gate until Phase 3 auth): Sales cannot save `discount_pct > 15`; Director can. Threshold constant lives in `quoteHelpers.ts`.
- **UI shape:** `BookingDetail` grows tabs (Details | Quotes) — the growth path the P1 drawer was designed for, mirroring LeadDetail's tab pattern. `QuotesTab` + `useQuotes` hook live in `components/BookingDetail/`.

## Tasks

| #   | Commit-sized task                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | This plan + `QuoteModel` (transactional create/update with items, versioning, server totals) + `routes/quotes.ts` CRUD + registration in all three bootstraps. |
| 2   | `GET /quotes/:id/docx` — proposal document (branding header, client/event/schedule tables, items table, totals block, validity + notes).                       |
| 3   | Frontend: `quotesApi` + `Quote`/`QuoteItem` types (snake_case) + `quoteHelpers.ts` (+tests: totals mirror, draft↔payload, validation, discount threshold).     |
| 4   | `BookingDetail` tabs + `QuotesTab` (version list + line-item editor + live totals + Download DOCX + Send proposal) + `useQuotes` hook.                         |
| 5   | Gates + smoke + CLAUDE.md track update.                                                                                                                        |

## Verification

- Unit: `quoteHelpers` (~15 cases); suite grows from 298.
- API smoke (script vs dev server): create booking → create quote (totals match `computeQuoteTotals`) → update items (totals recomputed) → `GET /:id/docx` returns `application/vnd.openxmlformats…` bytes starting with `PK` → versioning increments → delete cascade.
- UI smoke (Playwright): Quotes tab lists versions, editor computes live totals, discount >15% blocked for Sales / allowed for Director, DOCX download link present. **Real email send is NOT exercised** (SMTP is live) — the send path reuses the already-smoked `/leads/send-email` route.

## Left for later phases

- Quote acceptance portal / e-signature (P3+ territory).
- Proposal email template in Email Studio (today: default subject/body composed in the drawer).
