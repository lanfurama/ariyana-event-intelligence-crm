# Smart Venue Booking — Phase 4 Implementation Plan (smart layer)

**Spec:** `docs/superpowers/specs/2026-07-16-smart-venue-booking-design.md` (§3 Phase 4)
**Scope:** AI-assisted RFP intake + deterministic venue suggestions inside the existing booking flow. No schema changes.

## Decisions

- **AI is reserved for unstructured text.** Parsing a pasted RFP email (Gemini, existing `prompts/` pattern) is an LLM job; _venue suggestion is not_ — capacity-fit + free/busy is arithmetic, so it ships as a pure tested helper (instant, free, deterministic). The chat-plan wording "AI gợi ý phòng" is intentionally downgraded to algorithmic suggestion.
- **Intake is paste-first, IMAP later.** The spec's "extend check-inbox to auto-parse unmatched mail" touches the delicate IMAP path; the MVP delivers the same value with Sales pasting the email into an **AI Intake** modal. Auto-IMAP intake is a logged follow-up.
- **`prompts/parseRfp.ts`** follows the house dual-part shape: `buildGeminiParseRfpPrompt(emailText, todayIso)` (today injected for date normalization → deterministic tests) + `parseRfpExtraction(text)` (fence-stripping, safe JSON parse, field coercion: guests → positive int, date → `YYYY-MM-DD`, layout → known list, garbage → `is_rfp: false`).
- **`POST /gemini/parse-rfp`** uses the existing flash-lite + `responseMimeType: application/json` + `responseSchema` pattern from `/draft-email`.
- **Shared creation service:** the public portal's lead-dedup + inquiry-creation logic moves to `services/bookingRequestService.ts`, reused by `POST /public/booking-request` (unchanged behavior) and a new authed `POST /bookings/intake` (no honeypot/rate-limit — it sits behind the JWT guard).
- **Suggest venues panel** lives in the BookingDetail drawer (state in `useBookingForm`): reads guests/layout/first-space window from the draft, fetches availability for that window, ranks smallest-adequate-and-free first.

## Tasks

| #   | Commit-sized task                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | This plan + `prompts/parseRfp.ts` (+tests) + `bookingRequestService` extraction + `/bookings/intake` + `/gemini/parse-rfp` endpoint. |
| 2   | `venueFitHelpers.ts` (+tests) + `handleSuggestVenues` in `useBookingForm` + suggestions panel in the drawer.                         |
| 3   | `geminiService.parseRfp` + `bookingsApi.intake` + `AiIntakeModal` in BookingsView + UI smoke (one real Gemini call).                 |
| 4   | Gates + CLAUDE.md track update.                                                                                                      |

## Verification

- Unit: parseRfp parser/builder (~10 cases) + venueFit (~8 cases); suite grows from 310.
- Public portal API smoke re-run (behavior unchanged after the service extraction).
- UI smoke: paste a sample RFP → Gemini extracts fields → editable form → Create inquiry → booking + lead in CRM (then cleaned up); Suggest venues ranks the seeded rooms sensibly for 300 pax theatre and marks busy rooms.

## Left for later

- IMAP auto-intake (unmatched inbound mail → parse → draft inquiry for review).
- AI-polished proposal email body (P2 template stays static for now).
- Suggestion scoring beyond capacity/free (price fit, floor adjacency, multi-room splits).
