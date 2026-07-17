# Smart Venue Booking — Phase 3 Implementation Plan (real auth + public portal)

**Spec:** `docs/superpowers/specs/2026-07-16-smart-venue-booking-design.md` (§3 Phase 3; the security prerequisite flagged since kickoff)
**Scope:** server-side authentication for the ENTIRE existing API, then a public no-auth surface for customer booking requests.

## Decisions

- **bcryptjs + jsonwebtoken** (both pure-JS — serverless-safe on Vercel, no native builds on Windows). Deps added to BOTH package.json trees like every backend dep.
- **Migration 014** adds `users.password_hash` and seeds every user with the default password `Ariyana@2026` (bcrypt cost 10, hash embedded in SQL — hashes are not secrets). **Users must change it via Profile → Change password.**
- **`JWT_SECRET`** joins the Zod env schema as optional-with-insecure-dev-default + loud boot warning; must be set in production. Token TTL 7d, sent as `Authorization: Bearer`.
- **Secure by default via mount order** in all three bootstraps: `/auth` (public login) → `app.use(requireAuth)` + `app.use(viewerReadOnly)` → every other router. A future router added below the guard is automatically protected.
- **Server-side role policy (mirrors the client gates):** Viewer is read-only everywhere; `/email-reports` is Director-only; users router lets anyone read, self-PUT own profile (role field stripped — no self-escalation), Director for everything else. Finer per-route policies can come later.
- **Frontend:** login becomes username+password (the old user-list dropdown dies — it needed an authenticated API). `apiCall` attaches the Bearer token and force-logs-out on 401; the four direct-fetch sites (gemini, vertex, quote DOCX fetch/download) get the same header. Token lives in localStorage next to the user (XSS tradeoff accepted for the internal tool; httpOnly-cookie + CSRF is a later hardening).
- **Public portal API `/public/*`** (mounted above the guard): sanitized venue list (NO rates), free/busy availability (venue + blocked ranges only — no code/title/status), and `POST /public/booking-request` → Lead (+source note) + Booking (`inquiry`, `source: 'portal'`, zero-or-one space). Honeypot field + naive per-IP rate limit + fire-and-forget email notification to `DEFAULT_FROM_EMAIL`.
- **Portal page `book.html`** — a second Vite entry (multi-page build), standalone React tree (no sidebar/auth): venue cards, week free/busy glance, request form, success screen. English-only MVP; VN/EN toggle is a logged follow-up.

## Tasks

| #   | Commit-sized task                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | This plan + deps + migration 014 + env JWT_SECRET + middleware/auth + routes/auth + UserModel hardening + 3-bootstrap guard.   |
| 2   | Frontend auth: LoginView form, useAuth token, apiCall Bearer + 401 auto-logout, direct-fetch patches, Profile change-password. |
| 3   | `routes/publicPortal.ts` (+ registration above the guard in all three bootstraps).                                             |
| 4   | `book.html` + portal React entry + vite multi-page input.                                                                      |
| 5   | Gates + CLAUDE.md track update.                                                                                                |

## Verification

- API smoke: no-token 401 everywhere; bad login 401; good login → token; Viewer write 403 but self-profile PUT 200; Sales passes authz into validation (400 not 403); email-reports 403 for non-Director; no `password_hash` in any response; change-password roundtrip.
- UI smoke: login wrong/right, app fully functional post-auth (leads, bookings, quotes DOCX download via authenticated blob), portal request → appears in CRM as Lead + inquiry booking.

## Left for later

- httpOnly-cookie sessions + CSRF, login rate limiting / lockout, audit log.
- Per-route granular permissions beyond the Viewer/Director broad strokes.
- Portal VN/EN toggle; portal styling pass with real venue photos.
