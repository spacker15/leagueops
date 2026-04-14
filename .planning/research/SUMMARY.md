# Research Summary

_Synthesized: 2026-03-22. Source documents: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md._

---

## Key Stack Decisions

| Concern                    | Decision                                                  | Rationale                                                                     |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Email                      | `resend ^3.5.0`                                           | Best DX, 3,000 emails/month free, native Vercel integration                   |
| Email templates            | `@react-email/components` + `react-email ^3.x`            | Maintainable TSX templates, consistent rendering across clients               |
| SMS                        | Twilio free trial → Telnyx production                     | Telnyx ~$0.004/SMS vs Twilio ~$0.0079; use plain `fetch`, no SDK              |
| Browser push               | `web-push ^3.6.x` in Edge Function + native `PushManager` | No third-party dependency, no app install required                            |
| Maps                       | `@vis.gl/react-google-maps ^1.4.0`                        | Official Google-backed wrapper; use server-side proxy to protect API key      |
| Input validation           | `zod ^3.23.x`                                             | Schema-first, TypeScript inference, composable; covers 40+ unvalidated routes |
| Rate limiting              | `@upstash/ratelimit ^2.x` + `@upstash/redis ^1.x`         | 10k req/day free, Vercel one-click integration                                |
| QR codes                   | `qrcode.react ^3.x`                                       | Lightweight SVG output; used in both public results and coach invite flows    |
| Bracket visualization      | Custom Tailwind CSS                                       | 8–16 team bracket is ~60 lines JSX; avoid abandoned library dependencies      |
| Responsive design          | Tailwind responsive prefixes (existing 3.4.4)             | No new library needed; `@dnd-kit` already supports `TouchSensor`              |
| Public site real-time      | Supabase Realtime (existing `^2.99.2`)                    | Already in main app; free, no additional library                              |
| Notification orchestration | Supabase Edge Functions + Database Webhooks               | Credentials stay in Supabase secrets; event-driven, no cold-start latency     |

**Do not add**: SendGrid (100 email/day limit), FCM (overkill for web push), OneSignal (third-party data sharing), Mapbox (not free at scale), Radix UI / Headless UI (creates parallel component system), Framer Motion (60 KB for animations achievable in 4 Tailwind lines), Turborepo/Nx (not justified for 2 apps), Stripe (out of scope).

---

## Table Stakes Features

These are non-negotiable for coach and parent adoption:

1. **Public scores visible without login** — parents must never create an account to see game times or scores.
2. **Schedule changes reflected in real time** — coaches checking stale schedules on tournament day is a crisis.
3. **Notifications reach coaches within minutes of a schedule or weather change** — email is the minimum; delay is unacceptable for safety alerts.
4. **Admin retains full authority over all schedule modifications** — no self-service rescheduling by coaches.
5. **Program leaders can register multiple teams in one session** without re-entering program information.
6. **Schedule viewable by team, by field, and by time slot** — all three views are expected by coaches and parents.
7. **Registration deadline enforced by the system**, not by the admin manually closing a form.
8. **Conflict detection warns but does not hard-block** — tournament directors regularly make intentional exceptions.

---

## Differentiators

What makes LeagueOps worth choosing over TourneyMachine (the incumbent):

1. **True real-time scores via Supabase Realtime** — all competitors poll (30–120 second lag); LeagueOps updates scores the instant they are entered.
2. **Weather-triggered automatic notifications** — the weather engine already exists; wiring it to notifications removes human latency during lightning/heat emergencies. No competitor does this.
3. **Structured schedule change request workflow with auto-suggest slots** — coaches submit a conflict + reason; the system and admin find the time. No tournament platform handles this cleanly. The auto-suggest (SCH-04) queries field + team + referee availability simultaneously — LeagueOps already has the engine infrastructure to do this.
4. **Coach self-registration links per team** — program leaders send a unique URL; coaches self-register scoped to their specific team. Reduces the data-entry burden on program leaders managing 5–10 coaches across multiple teams. No competitor does this for tournaments.
5. **Unified conflict detection** (referee + field + coach) surfaced in one Command Center view — no competitor combines all three; ArbiterSports does referee only, GotSoccer does coach only.
6. **QR code per team for parent lookups** — a poster or email QR takes a parent directly to their team's schedule and live scores, pre-filtered. No competitor has this as a first-class feature.
7. **Availability selection at registration** — program leaders flag which event dates each team can play; this flows into the scheduler as hard constraints, reducing downstream schedule change requests.
8. **Browser push via PWA** — SportsEngine requires their native app; LeagueOps push works in Safari 16.4+ and Chrome on Android with no app store install.

**Positioning**: LeagueOps is a **tournament day operations platform**, not a team communication tool (TeamSnap), a stat tracker (GameChanger), or a national sports org platform (SportsEngine). Build operations features first; public-facing and notification features extend their value outward.

---

## Architecture Highlights

### Notification System: Database-First Fan-Out

All notifications originate as rows in a `notification_queue` table. A Supabase Edge Function (`process-notifications`) triggered by a Database Webhook resolves recipients, reads preferences, fans out to email/SMS/push, and writes to `notification_log`. API routes and engines write to `notification_queue` and return immediately — no synchronous notification calls. Three supporting tables: `notification_queue`, `notification_preferences`, `notification_log`.

### Public Results Site: Hybrid ISR + Selective Realtime

Server-render the page skeleton with ISR (`revalidate = 30` for standings, `revalidate = 60` for completed results). A thin `LiveScoresClient.tsx` client component attaches a Supabase Realtime subscription scoped to `event_id=eq.{current}` for in-progress game updates only. Do not open a per-visitor WebSocket for the full page — Supabase free tier caps at 200 concurrent Realtime connections. Use SSE or polling for standings; reserve Realtime for live game scores.

### Schedule Change Request: Single-Route State Machine

States: `pending → under_review → approved → rescheduled` (or `denied`). All transitions go through a single `PATCH /api/schedule-change-requests/[id]/route.ts` that validates legal moves by role. Slot assignment (SCH-05) must be an atomic Supabase RPC (PostgreSQL transaction) — multi-step API calls will cause double-bookings under concurrent use.

### RLS: Event-Scoped Isolation via Helper Function

A `SECURITY DEFINER` function `user_event_ids()` returns the set of `event_id` values the calling user has a role in. All event-owned table policies use `event_id IN (SELECT user_event_ids())`. Public-results anon reads are granted via a separate `FOR SELECT TO anon` policy scoped to public data only (`events`, `games`, `teams`, `fields`). Sensitive tables (`ops_alerts`, `ops_log`, `user_roles`) have no anon policy.

### Google Maps: Server-Side API Proxy

The Maps API key must be server-only. All geocoding and autocomplete calls go through proxy routes (`/api/maps/autocomplete`, `/api/maps/geocode`). The client component `GooglePlacesInput.tsx` calls these proxies with 300ms debounce. This prevents key exposure via `NEXT_PUBLIC_*` variables.

### Multi-App Deployment: Two Vercel Projects, One Repo

Admin app and `apps/public-results/` are deployed as separate Vercel projects pointing to the same GitHub repo with different "Root Directory" settings. No Turborepo or Nx needed. No shared code between apps — both read Supabase directly.

---

## Critical Pitfalls

**P1 — RLS Migration on Live DB**: "Allow all" policies returning zero rows rather than errors cause silent breakage. The engines (`lib/engines/*.ts`) currently import the browser Supabase client (`@/supabase/client`) — if RLS is tightened before this is fixed, all engine queries will run as `anon` and return empty results. **Fix SEC-03 (engine client imports) before SEC-01 (RLS tightening).**

**P2 — Auth Retrofit**: 40+ routes have no `auth.getUser()` call. Token-gated public routes (`/api/join`, `/api/checkins`) must not receive auth guards. `persistSession: false` in `supabase/server.ts` means expired tokens return `null` silently rather than an error — engine polling stops working mid-event with no visible indication. **Categorize all routes before touching any; fix incrementally by group.**

**P3 — Hardcoded `event_id = 1`**: Approximately 60 locations across engines, components, and routes. The `loadAll` dependency array bug in `AppProvider` (CONCERNS.md §9) means event switching will show stale data even after hardcodes are removed. **Fix `loadAll` first; replace `?? 1` fallbacks with loading guards, never with constants.**

**P4 — Notification Loops**: The `ops_log` write-then-Realtime-subscribe pattern creates a ready-made loop vector. A single lightning event can generate thousands of SMS messages. **Implement deduplication with `notification_sent_at` (atomic set) before wiring any notification trigger. Add a hard SMS cap per event per hour.**

**P5 — Google Maps Billing**: The `NEXT_PUBLIC_OPENWEATHER_KEY` pattern (already present) demonstrates the key-exposure risk. An unrestricted Maps key exposed in the bundle will be billed for third-party usage. **Restrict the key by HTTP referrer in Google Cloud Console before the feature goes live. Set a billing alert at $10/month.**

**P6 — Rescheduling Edge Cases**: Concurrent approvals of two requests can offer the same slot to both. The field engine `resolved` bug (CONCERNS.md §12: `type === 'all' ? false : false`) means admins cannot verify a cleared slot. Time format inconsistency (`timestamptz` vs AM/PM strings) causes wrong overlap math. **Use a DB-level transaction (RPC) for slot assignment; fix the field engine bug first; normalize all `scheduled_time` to `timestamptz`.**

**P7 — QR Code Issues**: `CheckInTab.tsx` line 191 hardcodes `event_id=1` in QR URLs — scans for event 2 check in players from event 1 silently. Dark-theme QR codes (white-on-navy) fail consumer scanners. Coach invite tokens have no expiry or revocation in the current pattern. **Fix QR URL hardcode in SEC-04; always generate black-on-white SVG; set token expiry aligned with event registration deadline.**

**P8 — Public Site Connection Limits**: Supabase free tier caps at 200 concurrent Realtime connections. 200 parents with the results page open = free tier exhausted; new connections silently rejected. **Use SSE or polling (10–30s) for the public site; reserve Realtime WebSockets for admin app only. Scope any Realtime subscriptions to `event_id=eq.{id}`.**

---

## Recommended Build Order

### Phase 0 — Security Foundation (blocks everything else)

1. **SEC-03**: Refactor all engine modules to accept a Supabase client as a parameter (removes browser-client imports from server context).
2. **SEC-04**: Remove all `event_id = 1` hardcodes; fix `loadAll` dependency array; replace `?? 1` fallbacks with loading guards.
3. **SEC-02**: Add `auth.getUser()` to all write routes and engine trigger routes (categorize first; keep token-gated and public routes unauthenticated).
4. **SEC-01**: Deploy `user_event_ids()` helper, then replace "Allow all" RLS policies in layers (authenticated read first, then write restrictions, then event-scoping). Test in a Supabase branch before applying to production.

### Phase 1 — Event Creation Enhancements (no blockers; start in parallel with Phase 0)

- Google Maps server-side proxy routes + `GooglePlacesInput` component + venue columns migration.
- EVT-02: Shareable registration QR code in `EventSetupTab` (uses `qrcode.react`, no backend).

### Phase 2 — Registration Flow Enhancements (requires SEC-04)

1. DB migrations: `coaches`, `coach_teams`, `coach_invites`; `available_date_ids` on `team_registrations`; `registration_opens_at`/`closes_at` on `events`.
2. `lib/engines/coach-conflicts.ts` (pure engine, no UI dependency).
3. Coach invite API routes + `app/coach/[token]/page.tsx` (mirrors existing `app/join/[token]/` pattern).
4. `ProgramDashboard.tsx` enhancements: coaches section, availability selection, multi-team registration flow.

### Phase 3 — Schedule Change Request Workflow (requires SEC-04 + field engine bug fix)

1. `schedule_change_requests` table migration.
2. `lib/engines/schedule-change.ts` slot suggestion engine (pure TypeScript).
3. API routes: POST/GET for requests; PATCH for state transitions (single route); GET slots.
4. `ScheduleChangeRequestModal` (coach side) + `ScheduleChangeRequestsTab` (admin side).
5. Stub notification queue writes (wire fully in Phase 4).

### Phase 4 — Notification Service (requires SEC-03 + Phase 2/3 tables)

1. DB migrations: `notification_queue`, `notification_preferences`, `notification_log`.
2. VAPID key generation + `public/sw.js` service worker + `public/manifest.json`.
3. Edge Function `process-notifications` + Database Webhook configuration.
4. `NotificationSettingsPanel` component + `/api/notifications/preferences` route.
5. Wire queue writes into: lightning route, game PATCH, weather engine, schedule change state transitions.

### Phase 5 — Public Results Site Enhancements (requires SEC-01 for anon RLS verification)

1. `LiveScoresClient.tsx` with scoped Realtime subscription (use SSE/polling for standings).
2. `/e/[slug]/schedule` and `/e/[slug]/team/[teamId]` routes.
3. `/e/[slug]/bracket` (custom Tailwind CSS, defer if needed).
4. Add DB indexes: `games(event_id, game_date)`, `games(event_id, division)`.
5. Pre-compute standings with a PostgreSQL view.
6. Verify anon key can read `events`, `games`, `teams`, `fields` but NOT `ops_alerts`, `user_roles`, `ops_log`.

### Immediately startable (no blockers today)

- Phase 0 SEC-03 and SEC-04 (pure refactors).
- Phase 1 entirely (Maps proxy, QR code).
- `notification_queue` table migration (schema only, no functionality required yet).
- `LiveScoresClient.tsx` in public-results app (fully isolated from admin app).
- `lib/engines/schedule-change.ts` (pure TypeScript, no DB required to write the logic).

---

## Anti-Features

Deliberately do not build:

| Anti-Feature                                           | Reason                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Payment processing                                     | PCI scope, refund workflows, disputes; correctly out of scope                                        |
| In-platform parent/coach chat or messaging threads     | Scope creep; becomes a support burden; not a tournament operations tool                              |
| Custom registration form builder                       | 3-month project serving 5% of use cases; use a fixed well-designed form                              |
| Player/roster data on the public results page          | COPPA and youth privacy risk; show team names and scores only                                        |
| Auto-resolving schedule conflicts                      | Suggest only; admin confirms all changes; auto-resolution causes unintended cascading conflicts      |
| Coach-initiated time proposals in change requests      | Creates negotiation loops; coaches state conflict + reason, the system and admin find the time       |
| Native mobile app                                      | PWA is sufficient for tournament-day use; two codebases not justified at this scale                  |
| Waitlist management                                    | Spreadsheet-level complexity; not platform-level for current tournament sizes                        |
| Stat leaders and advanced analytics on the public page | Adds visual complexity without improving operations; defer to a separate analytics view              |
| Read receipts on admin alerts                          | Creates false accountability claims and generates support tickets                                    |
| Multi-step approval chains                             | One admin approval is sufficient for a weekend tournament; chains belong in season-long league tools |
| Open comment threads on schedule change requests       | Message threads on requests become arguments; accept text reason + admin notes only                  |
| Parent account creation requirement                    | Any friction between a parent and seeing their kid's schedule generates complaints to the director   |

---

_This document feeds into requirements and roadmap creation. All file references are relative to the LeagueOps monorepo root._
