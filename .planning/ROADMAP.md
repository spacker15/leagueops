---
project: LeagueOps
phases: 10
requirements_mapped: 50
created: 2026-03-22
---

# Roadmap: LeagueOps

## Overview

| Phase | Name                             | Requirements                                                   | UI       | Depends On                |
| ----- | -------------------------------- | -------------------------------------------------------------- | -------- | ------------------------- |
| 1     | Engine Client Refactor           | 5/5                                                            | Complete | 2026-03-22                |
| 2     | Hardcode Removal & Event Context | 5/5 | Complete   | 2026-03-22 |
| 3     | API Auth & Validation            | 3/3 | Complete   | 2026-03-23 |
| 4     | RLS & Database Security          | 1/2 | In Progress|  |
| 5     | Event Creation Enhancements      | 5/5 | Complete   | 2026-03-24 |
| 6     | Registration Flow Enhancements   | 5/5 | Complete   | 2026-03-24 |
| 7     | Notification Infrastructure      | NOT-01, NOT-05, NOT-06, NOT-07, NOT-08                         | yes      | Phase 1, Phase 4          |
| 8     | Schedule Change Request Workflow | SCR-01, SCR-02, SCR-03, SCR-04, SCR-05, SCR-06, SCR-07, SCR-08 | yes      | Phase 6, Phase 7          |
| 9     | Public Results Site              | PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, PUB-07, PUB-08 | yes      | Phase 4                   |
| 10    | Responsive Design                | MOB-01, MOB-02, MOB-03, MOB-04, NOT-02, NOT-03, NOT-04         | yes      | Phase 7, Phase 8, Phase 9 |

---

## Phase 1: Engine Client Refactor

**Goal:** Replace browser-side Supabase client imports inside all engine modules with an injected server-side client so engines work correctly in API route context.
**Requirements:** SEC-03, SEC-06
**UI hint:** no
**Depends on:** none

### Success Criteria

1. All five engine modules (`referee.ts`, `weather.ts`, `field.ts`, `eligibility.ts`, `unified.ts`) accept a `SupabaseClient` parameter and do not import `@/supabase/client`.
2. Calling any engine from an API route returns actual data rows (not empty array) when a valid JWT is present.
3. The OpenWeather API key is no longer prefixed `NEXT_PUBLIC_` and does not appear in any client bundle.
4. Unified engine continues to run all sub-engines and write `ops_alerts` correctly with the injected client.
5. No existing API route behavior changes from a user-facing perspective.

### Scope Notes

- Pure refactor — no schema changes, no new UI.
- SEC-06 is bundled here because it follows the same server-side pattern: move key to `WEATHER_API_KEY`, update all server-side references.
- Do not touch RLS yet — that is Phase 4. The engine refactor is a prerequisite for RLS being safe to enable.
- The `field-engine` resolved bug (`type === 'all' ? false : false`) should be fixed here as a correctness fix alongside the refactor; it will be needed before Phase 8 slot suggestion works.

---

## Phase 2: Hardcode Removal & Event Context

**Goal:** Eliminate all ~60 hardcoded `event_id = 1` references and fix the `loadAll` dependency array bug so the app correctly isolates data per event when switching workspaces.
**Requirements:** SEC-04, SEC-05
**UI hint:** no
**Depends on:** Phase 1
**Plans:** 5/5 plans complete

Plans:

- [x] 02-00-PLAN.md — Wave 0: Store behavioral test scaffolding (SEC-04, SEC-05)
- [x] 02-01-PLAN.md — Engine eventId parameter injection (referee, weather, field, unified, rules)
- [x] 02-02-PLAN.md — API route hardcode removal (~19 routes, 400 guards)
- [x] 02-03-PLAN.md — Store loadAll/realtime dependency fixes (SEC-05)
- [x] 02-04-PLAN.md — Component hardcode removal (~18 files, QR slug, portals)

### Success Criteria

1. No `event_id = 1`, `eventId = 1`, or `?? 1` constant fallbacks remain in engines, components, or API routes (verified by grep).
2. Switching from Event A to Event B in the UI shows Event B data within one render cycle — no stale data bleed from the previous event.
3. `loadAll` in `lib/store.tsx` includes `eventId` in its dependency array; no ESLint exhaustive-deps warning on that hook.
4. Real-time subscriptions attach a `event_id=eq.{currentEventId}` filter and resubscribe when the active event changes (SEC-05).
5. QR code URLs in `CheckInTab.tsx` use the dynamic event slug, not a hardcoded event ID.
6. Switching events with no assigned role shows an empty / access-denied state rather than Event 1 data.

### Scope Notes

- This phase touches the most files (~60 locations). Work incrementally by group: engines first, then API routes, then components.
- Replace every `?? 1` fallback with a loading guard (spinner or null render) — never with a different constant.
- SEC-05 (realtime subscription scoping) is included here because the subscription filter depends on having dynamic event context working.
- Do not write RLS policies yet — that is Phase 4.

---

## Phase 3: API Auth & Validation

**Goal:** Add authentication checks and Zod request validation to all API routes, and apply rate limiting to high-frequency engine trigger and public-facing endpoints.
**Requirements:** SEC-02, SEC-07, SEC-08
**UI hint:** no
**Depends on:** Phase 2

### Success Criteria

1. Every API route that writes data (POST/PATCH/DELETE) calls `auth.getUser()` and returns `401` for unauthenticated requests.
2. Intentionally public routes (`/api/join`, `/api/checkins`, `/api/public-results/*`) are explicitly excluded from auth guards and documented in a comment.
3. All request bodies parsed with Zod schemas — malformed requests return `400` with a machine-readable error, not a 500.
4. Weather-engine, referee-engine trigger routes, and all public-results API endpoints have Upstash rate limiting applied.
5. An expired or invalid JWT returns a consistent `401` error (not a silent empty result) due to `persistSession: false` behavior being handled explicitly.

### Scope Notes

- Categorize all routes first before modifying any: write, read, public, engine-trigger. One route category at a time to avoid regressions.
- SEC-07 (Zod validation) and SEC-08 (rate limiting) are bundled here — they share the same "touch every route" effort with SEC-02.
- Upstash Redis free tier: 10k requests/day. Apply rate limiting only to engine-trigger routes and public endpoints, not to authenticated write routes.
- `@upstash/ratelimit ^2.x` and `@upstash/redis ^1.x` are the approved packages.

---

## Phase 4: RLS & Database Security

**Goal:** Deploy the `user_event_ids()` helper function and replace all "Allow all" RLS policies with proper event-scoped row-level security, tested against a Supabase branch before production.
**Requirements:** SEC-01
**UI hint:** no
**Depends on:** Phase 1, Phase 2
**Plans:** 1/2 plans executed

Plans:

- [x] 04-01-PLAN.md — user_event_ids() function, drop all permissive policies, create authenticated policies
- [x] 04-02-PLAN.md — Anon public table policies, rollback script, branch deploy and smoke tests

### Success Criteria

1. `user_event_ids()` `SECURITY DEFINER` function exists in production and returns the correct set of event IDs for each user.
2. All event-owned tables enforce `event_id IN (SELECT user_event_ids())` on reads and writes — verified by querying as a user with access to Event A, confirming Event B rows are invisible.
3. Sensitive tables (`ops_alerts`, `ops_log`, `user_roles`) have no anon policy — anonymous reads return zero rows.
4. Public tables (`events`, `games`, `teams`, `fields`) have a `FOR SELECT TO anon` policy scoped to public data (no sensitive columns).
5. RLS migration was applied to a Supabase branch and smoke-tested before production promotion.

### Scope Notes

- Must apply after Phase 1 (engine client fix) and Phase 2 (event context fix) — enabling RLS before those are done causes silent empty-result bugs.
- Apply RLS in three layers: authenticated reads first, then write restrictions, then anon policies.
- The anon read policies here unblock Phase 9 (public results site) — Phase 9 depends on Phase 4 for this reason.
- Use a Supabase branch for staging the migration. The `apply_migration` and `create_branch` MCP tools are available for this.

---

## Phase 5: Event Creation Enhancements

**Goal:** Add Google Maps venue search to the event creation flow and generate shareable registration QR codes per event.
**Requirements:** EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-06
**UI hint:** yes
**Depends on:** Phase 3
**Plans:** 5/5 plans complete

Plans:
- [x] 05-00-PLAN.md — Wave 0: Test stub scaffolding (EVT-01 through EVT-06)
- [x] 05-01-PLAN.md — Foundation: migration, types, package install, route fix, VenueAutocompleteInput component
- [x] 05-02-PLAN.md — Wire VenueAutocompleteInput into EventPicker + EventSetupTab
- [x] 05-03-PLAN.md — Sharing tab with registration link, QR code, and share buttons
- [x] 05-04-PLAN.md — Registration route placeholder in apps/public-results (/e/[slug]/register)

### Success Criteria

1. Admin can type a venue name in the event creation form and see autocomplete suggestions sourced from the Google Maps Places API.
2. Selecting a venue saves `lat`, `lng`, `address`, and `place_id` to the event record — not just a text string.
3. The Google Maps API key is never present in any client-side bundle; all calls route through `/api/maps/autocomplete` and `/api/maps/geocode`.
4. Each event has a unique registration URL (`/register/[eventSlug]`) displayed in the Event Setup tab.
5. A QR code for that URL is rendered and downloadable from the Event Setup tab as a black-on-white SVG.
6. Registration link/QR includes the event slug for direct routing — scanning routes to the correct event's registration wizard.

### Scope Notes

- `@vis.gl/react-google-maps ^1.4.0` is the approved Maps package. Add it only in Phase 5.
- `qrcode.react ^3.x` is the approved QR package — add it here (also used in Phase 9).
- EVT-03 (server-side API key proxy) is a prerequisite sub-task within this phase, not a separate phase.
- Add a billing alert in Google Cloud Console at $10/month and restrict the key by HTTP referrer before go-live.
- Venue columns migration: add `venue_address TEXT`, `venue_lat FLOAT8`, `venue_lng FLOAT8`, `venue_place_id TEXT` to the `events` table.

---

## Phase 6: Registration Flow Enhancements

**Goal:** Build coach management (direct add + self-registration links), team availability selection, multi-team registration, and registration date enforcement into the program registration system.
**Requirements:** REG-01, REG-02, REG-03, REG-04, REG-05, REG-06, REG-07, REG-08
**UI hint:** yes
**Depends on:** Phase 2, Phase 4
**Plans:** 5/5 plans complete

Plans:
- [x] 06-01-PLAN.md — Foundation: schema migration, TypeScript types, coach conflicts engine (REG-06, REG-07)
- [x] 06-02-PLAN.md — Admin event setup: MultiDatePicker, registration window controls, status badge (REG-01)
- [x] 06-03-PLAN.md — Registration wizard Step 3: additional coaches, availability dates, multi-team UX (REG-02, REG-03, REG-08)
- [x] 06-04-PLAN.md — Coach self-registration token flow: server page, client form, API route (REG-04, REG-05)
- [x] 06-05-PLAN.md — Integration: program leader portal, registration enforcement, schedule engine wiring (REG-04, REG-07)

### Success Criteria

1. Admin can set `registration_opens_at` and `registration_closes_at` on an event; the system enforces these dates — the registration wizard blocks access outside the window.
2. Program leader can select per-team availability (all dates or specific dates) during registration; selections are saved to `team_registrations.available_date_ids`.
3. Program leader can add coaches directly to a team with name, email, phone, and certifications within the registration wizard.
4. Admin can generate a coach self-registration invite link per program; coaches follow the link and self-register scoped to their team.
5. Coach invite tokens expire at the event's registration close date and are single-use (revocable).
6. When the same coach email is assigned to multiple teams, a conflict flag is written to the database and surfaced to the admin in the Command Center.
7. Schedule generation engine reads coach conflict constraints as hard constraints — teams with shared coaches cannot be scheduled simultaneously.
8. Program leader can add multiple teams in a single registration session without re-entering program information.

### Scope Notes

- Schema additions: `coaches`, `coach_teams`, `coach_invites` tables; `available_date_ids JSONB` on `team_registrations`; `registration_opens_at`/`registration_closes_at` on `events`.
- Coach self-registration link follows the same pattern as `app/join/[token]/` — create `app/coach/[token]/page.tsx`.
- `lib/engines/coach-conflicts.ts` is a pure TypeScript engine with no UI dependency — write it early in this phase.
- REG-07 (coach conflicts as schedule engine constraints) requires `lib/engines/coach-conflicts.ts` to be wired into the schedule generation call.
- QR codes for coach invite links use `qrcode.react` (already added in Phase 5).
- Dark-theme QR codes must always be generated as black-on-white to pass consumer scanner compatibility.

---

## Phase 7: Notification Infrastructure

**Goal:** Build the database-first notification queue, Edge Function processor, email delivery via Resend, browser push via Web Push API, and user preference management.
**Requirements:** NOT-01, NOT-05, NOT-06, NOT-07, NOT-08
**UI hint:** yes
**Depends on:** Phase 1, Phase 4
**Plans:** 4 plans

Plans:
- [ ] 07-01-PLAN.md — Foundation: packages, migration, types, helpers, email template (NOT-01, NOT-05, NOT-08)
- [ ] 07-02-PLAN.md — Edge Function: process-notifications with dedup, storm cap, recipient resolution, email/push delivery (NOT-01, NOT-05, NOT-06, NOT-08)
- [ ] 07-03-PLAN.md — Push infrastructure: service worker, push API routes, client subscription helper (NOT-06)
- [ ] 07-04-PLAN.md — Notification UI: bell, dropdown, settings panel, toggle rows, push permission modal (NOT-07, NOT-06)

### Success Criteria

1. `notification_queue`, `notification_preferences`, and `notification_log` tables exist and are RLS-protected.
2. A Supabase Edge Function `process-notifications` is triggered by Database Webhook on `notification_queue` inserts — it resolves recipients, checks preferences, fans out to channels, and writes to `notification_log`.
3. Resend sends a test email to a real inbox within 30 seconds of a `notification_queue` row being inserted.
4. Browser push notifications work on Chrome for Android and Safari 16.4+ (iOS) without app installation — service worker registered at `public/sw.js`.
5. Users can open `NotificationSettingsPanel` and toggle per-channel, per-alert-type preferences that persist to `notification_preferences`.
6. Deduplication is enforced: inserting a duplicate notification queue entry within the dedup window does not trigger a second delivery (atomic `notification_sent_at` set).
7. A hard cap of N SMS messages per event per hour is enforced (prevents notification storms).

### Scope Notes

- NOT-02 (weather alerts), NOT-03 (schedule change notifications), and NOT-04 (admin alerts) are delivery triggers — they are wired in Phase 10 once the notification tables and Edge Function are in place. They are NOT in scope for this phase.
- VAPID key generation for web push must happen before deploying `sw.js` — generate once and store in Supabase secrets.
- Email templates use `@react-email/components` + `react-email ^3.x` (add in this phase).
- The `notification_queue` table migration can be applied earlier as a schema-only step — it has no blockers from Phase 1 onward.
- Do not implement SMS in v1 — it is deferred to v2 (SMS-01). The Edge Function architecture accommodates it later.

---

## Phase 8: Schedule Change Request Workflow

**Goal:** Build the end-to-end schedule change request flow: coach submission, admin review, auto-slot suggestion, atomic rescheduling, and notification triggers.
**Requirements:** SCR-01, SCR-02, SCR-03, SCR-04, SCR-05, SCR-06, SCR-07, SCR-08
**UI hint:** yes
**Depends on:** Phase 6, Phase 7

### Success Criteria

1. Coach or program leader can open `ScheduleChangeRequestModal`, select affected game(s), choose a reason and cancel vs reschedule, and submit — a `schedule_change_requests` row is created in `pending` state.
2. Admin sees incoming requests in `ScheduleChangeRequestsTab` and can move them to `under_review`, `approved`, or `denied`.
3. When admin approves a request, the system queries field + team + referee availability simultaneously and returns available alternative slots within 5 seconds.
4. Admin selects a slot from the suggestion list and confirms — the game is rescheduled via a PostgreSQL RPC (atomic transaction) with no double-booking risk.
5. State machine enforces legal transitions only: `pending → under_review → approved → rescheduled` (or `denied`) — illegal transitions return `400`.
6. All affected teams receive a notification queue entry when a game is rescheduled or cancelled (wired to Phase 7 infrastructure).
7. A request cannot be approved if the field engine still shows a conflict on the proposed slot (field engine resolved bug must be fixed — see Phase 1).

### Scope Notes

- Single state machine route: `PATCH /api/schedule-change-requests/[id]/route.ts` validates legal state transitions by role.
- Slot suggestion engine: `lib/engines/schedule-change.ts` — pure TypeScript, no DB required to write the logic. Can be written and unit tested before the DB migration lands.
- Slot assignment must be a Supabase RPC (PostgreSQL transaction) — multi-step API calls will cause double-bookings under concurrent use.
- Time format normalization: all `scheduled_time` must be `timestamptz` before overlap math is reliable (fix as part of SCR-06 migration).
- Coach-initiated time proposals are explicitly out of scope — coaches state conflict + reason only; admin and system find the time.
- Open comment threads on requests are out of scope — accept text reason + admin notes only.

---

## Phase 9: Public Results Site

**Goal:** Build the public-facing results site (apps/public-results) with live scores, schedules, standings, brackets, and team QR codes — no login required for parents and spectators.
**Requirements:** PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, PUB-07, PUB-08
**UI hint:** yes
**Depends on:** Phase 4

### Success Criteria

1. Parents can navigate to the public results site and view live game scores, team schedule, and division standings without creating an account.
2. Three schedule views are available: by team, by field, and by time slot — all usable on a phone screen without horizontal scrolling.
3. Division standings display win/loss records sourced from a PostgreSQL view (not computed client-side).
4. Tournament bracket renders correctly for 8- and 16-team brackets using custom Tailwind CSS (no external bracket library).
5. Each event/team has a QR code that takes a parent directly to that team's filtered schedule and live scores view.
6. Live game scores update in real time via Supabase Realtime WebSocket (`LiveScoresClient.tsx`) — connection is scoped to `event_id=eq.{current}` not a global subscription.
7. Standings and completed results use ISR (`revalidate = 30` for standings, `revalidate = 60` for completed results) — not a per-visitor WebSocket.
8. The public site does not expose `ops_alerts`, `user_roles`, or `ops_log` data — verified by attempting anonymous queries against those tables.

### Scope Notes

- Phase 4 (RLS with anon policies on public tables) is a hard dependency — the public site will return empty data without it.
- Do not open a per-visitor Realtime WebSocket for full-page updates — Supabase free tier caps at 200 concurrent connections. Reserve Realtime for in-progress game score rows only.
- Player names and roster data must NOT appear on the public site (COPPA / youth privacy).
- The `apps/public-results` skeleton already exists as a separate Next.js app. Deploy as a separate Vercel project pointing to the same GitHub repo with a different root directory setting.
- DB indexes to add: `games(event_id, game_date)`, `games(event_id, division)` for standings query performance.
- Parent search (PUB-06) is a client-side filter on pre-loaded team list — not a new API endpoint.

---

## Phase 10: Responsive Design & Notification Wiring

**Goal:** Make the admin app fully usable on phones and tablets at the field, complete touch support for drag-drop, and wire the notification triggers for weather alerts, schedule changes, and admin ops alerts into the Phase 7 notification infrastructure.
**Requirements:** MOB-01, MOB-02, MOB-03, MOB-04, NOT-02, NOT-03, NOT-04
**UI hint:** yes
**Depends on:** Phase 7, Phase 8, Phase 9

### Success Criteria

1. Dashboard, Schedule, and Check-In views render without horizontal scrolling on a 375px-wide phone screen.
2. RightPanel converts to a bottom drawer on mobile — slides up from the bottom with a handle, does not overlap the nav.
3. Drag-drop referee assignment works via touch on iOS Safari and Chrome for Android (`@dnd-kit` TouchSensor configured).
4. Navigation is accessible on mobile — either collapses to a hamburger or switches to a bottom tab bar.
5. Weather alert notifications (lightning delay, field closure, game suspension) trigger a `notification_queue` entry that is delivered to affected coaches within 2 minutes of the weather engine firing.
6. Schedule change notifications are sent to all affected team contacts when a game is rescheduled or cancelled (wired from Phase 8 SCR-07).
7. Admin receives in-app and email alerts for referee no-shows, registration deadline warnings, and ops issues surfaced by the unified engine.

### Scope Notes

- MOB-01 through MOB-04 use Tailwind responsive prefixes (`sm:`, `md:`) — no new UI libraries.
- `@dnd-kit` already includes `TouchSensor` — configure it in the existing referee assignment drag-drop setup.
- NOT-02, NOT-03, NOT-04 are notification triggers (not new infrastructure) — they wire `notification_queue` writes into existing engine outputs and workflow state transitions. The notification infrastructure (Phase 7) must be complete first.
- This is the final polish and integration phase. All major features are functional after Phase 9; Phase 10 is about field usability and closing the notification loop.

---

_Last updated: 2026-03-24_
