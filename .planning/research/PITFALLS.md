# Pitfalls Research

Research into common failure modes when adding the planned features to an existing live application. Grounded in the actual LeagueOps codebase — references specific files, tables, and patterns where relevant.

---

## P1: RLS Migration on Live Database

### The Problem

LeagueOps currently has `USING (true) WITH CHECK (true)` "Allow all" policies on every core table (`supabase/schema.sql` lines 254–268 and `supabase/auth_migration.sql`). Replacing these with real policies on a live database is one of the most dangerous migrations possible: a policy that is too restrictive silently returns zero rows instead of an error, causing components to appear broken with no obvious reason.

The specific risk here is that LeagueOps has **two Supabase clients in play simultaneously**: the browser client (anon key) that all client-side queries use via `lib/db.ts`, and the server client (cookie-based session) used in API routes. If you write RLS policies that only pass for `authenticated` users, every browser-client query will break immediately because the browser client authenticates as the Supabase `anon` role unless the user's JWT is forwarded correctly.

There is a further complication: `supabase/server.ts` sets `persistSession: false`. This means the server client does not automatically refresh expired tokens between requests (CONCERNS.md §25). If a policy requires `auth.uid()` and the token has expired, the server-side query returns no rows rather than an error — silent breakage again.

### Warning Signs

- API routes suddenly return empty arrays for queries that worked minutes before.
- Components show "no data" states (e.g., empty schedule, no teams) without any network error in the console.
- The Supabase dashboard shows queries completing successfully with 0 rows rather than failing.
- Engine runs return no conflicts even when conflicts exist — this is particularly dangerous for safety engines (weather, field conflict).
- The unified engine at `lib/engines/unified.ts` uses the browser Supabase client (`import { createClient } from '@/supabase/client'`). If RLS is tightened and the browser client is not authenticated as the right role, all five engine modules will silently query as `anon` and return empty results.

### Prevention Strategy

**Test policies in a branch database, never directly on the live Supabase project.** Supabase branching (preview branches) or a staging project with a copy of production data is the correct environment for RLS work.

Write policies in layers, not all at once:

1. Start with the most permissive real policy: `auth.role() = 'authenticated'` (any logged-in user can read). Verify nothing breaks.
2. Add write restrictions: require `auth.uid()` to match an `admin` or `league_admin` role in `user_roles`. Verify mutations still work from the admin shell.
3. Add event-scoping: rows can only be read if `event_id` matches an event the user has a role in. Verify the engine layer is using the correct client before this step — the browser-client engines will break here if not fixed first.

**Fix SEC-03 (engine client mismatch) before SEC-01 (RLS).** All five engine modules import `@/supabase/client` (the browser client) but are called from server-side API routes. If you tighten RLS before fixing this, the engines will query as `anon` and return empty results. The fix is to refactor engine functions to accept a Supabase client parameter so the API route can pass in the server client.

Use Supabase's `EXPLAIN` or the Dashboard query inspector to verify that policies are evaluating correctly and that `auth.uid()` is non-null for server-side calls.

Do not use the service role key as a workaround in production routes. It bypasses RLS entirely and defeats the purpose of the migration.

### Phase

**Security phase (SEC-01 through SEC-03) — must be sequenced:** SEC-03 (fix engine clients) → SEC-02 (add auth to API routes) → SEC-01 (tighten RLS). Running SEC-01 first will break the app before the other fixes are in place.

---

## P2: Auth Retrofit Risks

### The Problem

40+ API routes have no `auth.getUser()` call. Only `app/api/admin/create-user/route.ts` and `app/api/auth/program-prefill/route.ts` check auth. Adding auth checks to all routes in a live app carries several specific risks:

**Silent breakage in background processes.** LeagueOps has client-side polling patterns (the unified engine is called from `CommandCenter`, the weather engine is called periodically). These calls originate from the browser and carry the session cookie. If the auth check is added correctly using the server client (`supabase/server.ts`), these will work. If the server client's `persistSession: false` causes an expired token to return `null` for the user, the route starts returning 401 to the front end with no visible indication to the operator running the event.

**The `as any` event ID fallback will mask auth errors.** Multiple components fall back to event 1 silently: `(state.event as any)?.id ?? 1` (CONCERNS.md §18, `AppShell.tsx` line 151, `UserManagement.tsx` line 27). If an auth check fails mid-session and the component re-renders with null state, it will silently operate against event 1 rather than surfacing an error. This is especially dangerous during an active tournament.

**Engine routes are not stateless.** Engine API routes like `/api/referee-engine`, `/api/field-engine`, and `/api/weather-engine` write to `operational_conflicts`, `ops_alerts`, `conflict_engine_runs`, and `lightning_events`. If an auth check starts returning 401 mid-event (expired token, intermittent session issue), these writes stop happening silently. Ops alerts stop being generated; the Command Center appears fine but is receiving no new conflict data.

**The `join` and `checkin` routes are intentionally public.** `app/api/join/route.ts` (referee/volunteer self-registration via invite token) and `app/checkin/[token]/page.tsx` (QR player check-in) are designed to work without a logged-in session. Adding blanket auth middleware will break these flows. Each route must be evaluated individually.

### Warning Signs

- Referee/volunteer self-registration links stop working after the auth retrofit.
- QR check-in at the field starts returning errors — very high-impact on tournament day.
- The Command Center shows stale conflicts that never update.
- Browser console shows intermittent 401s from engine poll calls.
- `addLog()` calls start failing (they call `/api/ops-log`), causing the ops log feed to go silent.

### Prevention Strategy

**Categorize routes before touching any of them:**

| Category           | Example Routes                                                    | Auth Required                         |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------- |
| Admin-only writes  | `/api/games` POST, `/api/fields` POST, `/api/lightning`           | Yes — `admin` or `league_admin` role  |
| Public token-gated | `/api/join`, `/api/checkins` (QR path)                            | No — validate invite/QR token instead |
| Engine triggers    | `/api/referee-engine`, `/api/field-engine`, `/api/weather-engine` | Yes — authenticated operator          |
| Read-only public   | `/api/weather` GET (for public results)                           | No, or anon-safe                      |

Add auth checks incrementally — one route group per deployment, with testing between each group. Do not batch-add auth to all 40+ routes in one commit.

Add a test helper that calls each route with an expired/missing token and verifies the response is a clean 401 (not a 500 or empty 200).

Fix the `persistSession: false` behavior (CONCERNS.md §25) or add explicit token refresh logic before adding auth checks that depend on `auth.getUser()` returning non-null.

For the public-results app (`apps/public-results/`), confirm it only ever reads via the anon key and that no auth check is accidentally added to its data-fetch paths.

### Phase

**Security phase (SEC-02) — after SEC-03, before SEC-01.** Auth on routes is the prerequisite for meaningful RLS because RLS policies reference `auth.uid()`, which is only populated when a valid session is passed. If routes don't pass the session, `auth.uid()` is null in all RLS checks.

---

## P3: Hardcoded ID Removal

### The Problem

`event_id = 1` appears in approximately 60 locations across engines, components, and API routes (CONCERNS.md §2). Removing these is not a search-and-replace operation — each hardcode must be replaced with the correct event ID from the correct source, which differs by context:

- **Engine modules** (`lib/engines/*.ts`) — currently called from API routes that receive `event_id` in the request body. Each engine needs to accept the event ID as a parameter.
- **UI components** — should read from `useApp()` which exposes `eventId`. But `AppProvider` has a bug: `loadAll()` does not list `eventId` in its dependency array (CONCERNS.md §9), so event switching doesn't trigger a data reload.
- **API routes** — should read `event_id` from the authenticated session or the request body, never default to 1.
- **`app/api/rules/route.ts`** — hardcodes `event_id: 1` in the default row insert (lines 60, 70, 83). New events will get rules seeded for event 1 instead of the actual event.
- **`app/api/lightning/route.ts`** — falls back to `event_id ?? 1`. If the caller doesn't send an `event_id`, lightning delay is applied to event 1 regardless of which event is active.

The insidious failure mode is that after fixing some of the 60 locations, a mix of "fixed" and "still hardcoded" code will coexist. An admin creating a second event will see correct data in some tabs and stale event-1 data in others, with no error shown anywhere.

There is also an unsafe fallback pattern spread through components: `(state.event as any)?.id ?? 1`. During a page load race condition (event not yet loaded), this will silently query event 1. After the hardcodes are removed, this fallback becomes the new hardcode vector.

### Warning Signs

- Second event is created but its schedule tab shows games from event 1.
- Lightning delay triggered in event 2 affects event 1's games.
- Rules engine seeds incorrect event ID in the `event_rules` table when a new event is configured.
- QR codes generated for event 2 contain `/checkin/[token]` URLs that resolve to players from event 1 (the `CheckInTab` hardcodes `event_id=1` in the URL at line 191).
- `unified.ts` runs weather check for `complex_id: 1` at an event that uses complex 2 — no weather alerts are generated for active fields.

### Prevention Strategy

**Do not remove hardcodes without first fixing the `loadAll` dependency array bug** (CONCERNS.md §9). Switching events must reliably trigger a data reload, or the correct event ID will be in the store but stale data from event 1 will be displayed.

Create a tracking document (or use grep) listing all 60+ locations before touching any of them. Check off each location as it is fixed and verified. Do not mark a location fixed until the behavior is tested with a second event that has data distinct from event 1.

Replace the `?? 1` fallback pattern with a proper loading guard: render a loading skeleton when `eventId` is null rather than querying with a default. A hardcoded fallback to 1 will always be wrong when a second event is active.

For engines, refactor to accept `eventId` as a function parameter rather than a module-level constant. The API route should extract `event_id` from the verified request body (validated, not caller-trusted) and pass it through. Never read `event_id` from a module-level constant inside an engine that is shared across multiple HTTP requests.

Run the full set of engines against a second test event and confirm `operational_conflicts` rows are scoped to that event, not event 1.

### Phase

**Security phase (SEC-04) — can run in parallel with SEC-02, but must complete before any multi-event features are exposed to real users.** SEC-04 is a prerequisite for every feature in the Active backlog that touches event data.

---

## P4: Notification System Gotchas

### The Problem

LeagueOps plans email (NOT-04), SMS (NOT-05), and browser push (NOT-06) notifications. Each channel has distinct failure modes.

#### SMS (NOT-05)

Budget constraint says "free/cheap provider" and lists Supabase Edge Functions as the mechanism. The realistic free-tier options (Twilio trial, Vonage sandbox, Telnyx free credits) all have hard limits that are inadequate for tournament day:

- Twilio trial: ~$15 USD credit, roughly 500 SMS messages. A single weather alert to 100 coaches = 100 messages. Trials cannot send to numbers that have not verified with Twilio first.
- Vonage sandbox: only whitelisted numbers can receive messages.
- Telnyx free tier: requires a real phone number purchase ($1–2/month) and has usage caps.

The true cost risk is not the provider's free tier but an SMS loop. If a notification triggers a database change, which triggers a Supabase webhook, which triggers another notification — a tournament with 50 games could generate thousands of SMS messages in minutes. LeagueOps's existing pattern of writing to `ops_log` on every action, and subscribing to `ops_log` changes via Realtime, creates a ready-made accidental loop vector.

Phone number format is also a pitfall. If coaches self-register (REG-03, REG-04), their phone numbers are typed freeform. E.164 format (`+15551234567`) is required by every SMS provider; `555-123-4567`, `(555) 123-4567`, and `5551234567` will all fail silently or return provider errors that are hard to surface back to the admin.

#### Email (NOT-04)

Supabase's built-in auth emails use the configured SMTP relay. For transactional notification emails (weather alerts, schedule changes), a separate email provider is needed. The free-tier options:

- **Resend**: 100 emails/day, 3,000/month on free tier. Sufficient for small tournaments.
- **SendGrid**: 100 emails/day free. Domain authentication (SPF/DKIM) required to avoid spam folder routing.
- **Postmark**: no free tier for transactional — only a 100-message trial.

The deliverability risk: emails sent from an unverified domain go to spam. If the `FROM` address is `noreply@leagueops.vercel.app` without SPF/DKIM records on `vercel.app` (which you cannot add because you do not own the zone), 100% of notification emails will land in spam. The domain `leagueops.vercel.app` cannot have custom DNS records.

Weather alert emails for lightning delays are safety-critical. If they land in spam on tournament day, the notification system provides false safety assurance.

#### Browser Push (NOT-06)

Push notifications require a Service Worker and VAPID keys (Web Push Protocol). The PWA compatibility requirement implies a service worker already exists or needs to be added. Next.js 14 App Router does not have first-class service worker support — it requires a custom `public/sw.js` and registration logic that survives Next.js's aggressive client-side routing.

The specific failure modes:

- iOS Safari requires iOS 16.4+ for Web Push and only works when the site is added to the Home Screen. Parents at a tournament viewing the public results site on Safari will not receive push notifications unless they have added the site to their Home Screen and are on a supported iOS version.
- Push subscriptions expire. When a user's push subscription endpoint becomes invalid (device reset, browser reset), push sends silently fail. The notification system needs dead-subscription cleanup logic.
- Browser push from a Next.js Vercel deployment requires the service worker file to be served from the root path. Vercel's edge caching can serve a stale service worker for hours after a deployment, causing the push registration to use the old VAPID key.

#### Rate Limiting / Cost Loop Risk

The most dangerous general pitfall: notifications are triggered by database events. The pattern `weather alert → write to ops_log → realtime fires → notification sent → admin acknowledges → write to ops_log → ...` can cause notification storms. A single lightning event could generate dozens of duplicate notifications if the acknowledgement write triggers the same notification condition.

### Warning Signs

- SMS provider dashboard shows message count spiking during testing.
- Test emails are received in spam (use mail-tester.com to diagnose).
- Browser push console shows `DOMException: Registration failed` or `Push subscription has unsubscribed or expired`.
- Ops log grows faster than expected during a notification test — potential loop.
- Phone number validation errors appear silently in Edge Function logs but not in the admin UI.

### Prevention Strategy

**SMS**: Normalize phone numbers to E.164 at registration time, not at send time. Add a `phone_normalized` column and validate on input. Implement a hard SMS cap per event per hour (e.g., 500 messages/hour) enforced in the Edge Function. Use a deduplication key: before sending an SMS for alert X, check if an SMS for alert X was already sent in the last 15 minutes.

**Email**: Use a custom domain with proper SPF/DKIM records. Do not use `leagueops.vercel.app` as the sender domain. Resend is the most practical free option for this scale. Test deliverability to Gmail and Yahoo before tournament day using mail-tester.com. For safety-critical alerts (lightning), consider in-app + email, not email alone.

**Push**: Gate push behind a feature flag. Do not ship push notifications to production until the service worker lifecycle is tested across Chrome, Firefox, and Safari (iOS). Use a push library like `web-push` on the server side that handles subscription expiry and dead-endpoint cleanup automatically.

**Anti-loop**: Add a `notification_sent_at` timestamp to alert records. Only send a notification if `notification_sent_at IS NULL` and set it atomically with the send. Use Supabase Edge Functions with idempotency keys rather than Realtime webhooks to avoid multi-trigger scenarios.

### Phase

**Notifications phase (NOT-01 through NOT-06) — after security hardening is complete.** Sending notifications requires knowing which user to notify, which requires auth (SEC-01/02) and correct event scoping (SEC-04) to be working first. Start with email (lowest risk), then SMS with hard caps, then push as a stretch goal.

---

## P5: Google Maps API Costs

### The Problem

Google Maps Platform has no permanent free tier for the Maps JavaScript API or Places API. The free credit is $200/month, which Google provides to all accounts. Beyond $200:

- Maps JavaScript API: $7 per 1,000 loads
- Places Autocomplete: $2.83 per 1,000 requests
- Geocoding API: $5 per 1,000 requests

For EVT-01 (venue lookup when creating events), the use case is low-volume: admins create events infrequently. 10 event creations per month × 20 autocomplete requests per creation = 200 API calls. This is trivially within the free credit.

The cost risk is not the planned usage — it is accidental misuse:

1. **Unrestricted API key on a public page.** If the Maps API key is placed in a `NEXT_PUBLIC_` environment variable (as the OpenWeather key already is — CONCERNS.md §6), it is visible in the page source. Anyone can extract it and use it for their own Maps requests billed to the LeagueOps account.

2. **Places Autocomplete on every keystroke.** If the venue search input fires an autocomplete request on every `onChange` event, a single admin typing "Jacksonville" generates ~10 API calls. If the input is shown to multiple users simultaneously or if there is a test environment with frequent event creation, costs accumulate.

3. **Embedded map on the public results site.** PUB-01 through PUB-06 include a public results site visible to all parents. If a map showing the venue location is added to the public event page, the Maps JavaScript API billing model charges per map load. 500 parents loading the results page = 500 map loads = $3.50. At a large tournament with 5,000 page loads over a weekend, that is $35 from a single event — within the free credit for that month, but cumulative over a season.

4. **No billing alert configured.** The most common Google Maps billing disaster is discovering a $300 charge at the end of the month. Google allows setting billing alerts at any threshold.

### Warning Signs

- API key appears in the browser's network request headers or in the JavaScript bundle (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`).
- Places Autocomplete requests visible in the browser's Network tab on every keypress without debouncing.
- Google Cloud Console shows maps or geocoding requests from IP ranges that are not the Vercel deployment.
- Monthly Google Cloud billing report shows Maps usage > 200 requests unexpectedly.

### Prevention Strategy

**Restrict the API key by HTTP referrer.** In the Google Cloud Console, add an HTTP referrer restriction: `leagueops.vercel.app/*`. This prevents the key from being used by third parties even if it is extracted from the page source.

**Separate keys by use.** Create one key restricted to the admin domain for event creation (Maps JavaScript + Places APIs), and a separate key for the public results site (Maps JavaScript only, read-only embedded map). Apply separate billing quotas to each.

**Debounce autocomplete.** Fire the Places Autocomplete API call no more than once every 300ms of idle input. Use the Places Autocomplete Session Token pattern to bundle prediction and place detail lookups into a single billing event per user session.

**Use static maps for display, not interactive maps.** For the public results site venue location display, use the Static Maps API ($2 per 1,000 requests) instead of the JavaScript Maps API ($7 per 1,000 loads). Better yet, link to Google Maps externally (zero API cost).

**Set a billing alert at $10/month.** In Google Cloud Console, add a budget alert at $10 to catch any unexpected usage before it becomes a real bill.

**Consider an alternative for geocoding only.** For EVT-01, the only true requirement is converting an address to lat/lng for weather monitoring. The OpenStreetMap Nominatim API is free for low-volume geocoding and requires no API key. Use it for the save step (storing lat/lng when event is created); reserve Google Maps for the user-facing search input where the UX is worth the API cost.

### Phase

**Event Creation Enhancements phase (EVT-01) — key restriction and debouncing must be implemented before the feature goes live, not as a follow-up.** API key exposure is a day-one concern.

---

## P6: Schedule Rescheduling Edge Cases

### The Problem

The schedule change request workflow (SCH-01 through SCH-06) adds a state machine to game records: a game can be requested for reschedule, approved, auto-suggested an alternative slot, and confirmed. Each state transition has edge cases that can corrupt the live schedule.

**Double-booking from concurrent approvals.** If two schedule change requests are approved in rapid succession, the auto-suggestion engine (SCH-04) could offer the same open slot to both. If an admin approves both before either is committed, two games will be scheduled on the same field at the same time. The field conflict engine will catch this, but only on the next engine run — not atomically at approval time.

**The existing field conflict bug exacerbates this.** `app/api/field-engine/route.ts` line 64 has the bug `type === 'all' ? false : false` (CONCERNS.md §12), meaning the "all conflicts" view never returns resolved conflicts. After a reschedule, the admin cannot verify the old slot was cleared by viewing resolved conflicts.

**Game duration assumptions.** The rescheduling engine must know game duration to check if a proposed slot has enough time before the next game on that field. The duration comes from `game_duration_min` in the rules engine. If rules are not configured for the event (no `event_rules` row), `getSchedulingRules()` returns a default — but the default may not match the actual event format (e.g., a 45-minute game being rescheduled into a 60-minute slot grid). The hardcoded `event_id = 1` in `app/api/rules/route.ts` means new events may not have rules seeded at all.

**Late-day rescheduling.** If a game is requested for reschedule at 2 PM for a game scheduled at 3 PM, the suggestion engine must only offer slots that are both open and in the future. Suggesting a 1 PM slot on the same day is technically available but logistically impossible. The engine needs a "not before now + setup buffer" constraint.

**Multi-team impact.** A single rescheduled game affects two teams. Notification (SCH-06) must reach both teams' coaches. If either coach is coaching multiple teams (a conflict that REG-05 should flag but may not catch all cases), they may receive duplicate or contradictory notifications.

**Game status consistency.** During a live event, games have statuses like `live`, `halftime`, `suspended`. A schedule change request for a game that is already in `live` status must be rejected immediately — you cannot reschedule a game that is in progress. The SCH-01 intake form must check game status, not just game time.

**Time zone collisions.** The existing time parsing in engines uses `timeToMinutes()` with regex on AM/PM strings (CONCERNS.md §17). If `scheduled_time` in the database is stored as a timezone-aware timestamp for one game and a naive time string for another (due to different insertion paths), the overlap check for "is this slot free?" will produce wrong answers without any error.

### Warning Signs

- Field conflict engine reports a new overlap immediately after a reschedule approval.
- Two games appear on the same field at the same time in the schedule board view.
- A coach receives a "your game has been rescheduled" notification but the schedule shows the original time.
- A `live` or `halftime` game appears in the list of games eligible for schedule change requests.
- A suggested reschedule slot has a start time in the past relative to the current clock.

### Prevention Strategy

**Use a database transaction for slot assignment.** When the admin confirms a rescheduled slot (SCH-05), the slot claim and game update must be a single atomic operation. The safest implementation is a Supabase PostgreSQL function (RPC call) that takes a game ID and new time/field, locks the relevant rows, checks for conflicts, and updates atomically — all inside a transaction. Do not implement this as a multi-step API call sequence.

**Run the field conflict engine immediately after any reschedule confirmation** and surface any new conflicts to the admin before closing the approval modal. Do not rely on the next scheduled engine run.

**Fix the field engine `resolved` filter bug** (CONCERNS.md §12) before implementing rescheduling, so the admin has a reliable view of what is resolved and what is new.

**Filter out ineligible games at the request intake step.** Only games with `status = 'scheduled'` and `scheduled_time > now() + 30 minutes` (configurable buffer) should appear as options for schedule change requests.

**De-duplicate suggestions.** When generating alternative slots (SCH-04), mark each suggested slot as "reserved pending confirmation" in memory or in a short-lived database record. Expire reservations after 10 minutes if not confirmed. This prevents the same slot from being offered to two concurrent requests.

**Normalize all `scheduled_time` values to the same format** during the SEC-04 / hardcode removal phase. Decide on ISO 8601 UTC strings stored as `timestamptz` in PostgreSQL — never store times as AM/PM strings in the database.

### Phase

**Schedule Change Request phase (SCH-01 through SCH-06) — after SEC-04 (hardcode removal) and after the field engine `resolved` bug is fixed.** The rescheduling engine is unsafe to ship on top of broken engine infrastructure.

---

## P7: QR Code / Registration Link Issues

### The Problem

LeagueOps already uses QR codes for player check-in (`app/checkin/[token]/page.tsx`) and plans to add shareable registration QR codes per event (EVT-02) and coach self-registration links (REG-04). There are distinct pitfall categories for each.

#### Player Check-In QR (existing)

The `NEXT_PUBLIC_APP_URL` environment variable is used as the base URL for QR code generation (INTEGRATIONS.md). On Vercel, this is `https://leagueops.vercel.app`. If a preview deployment URL is used (e.g., `https://leagueops-abc123.vercel.app`), QR codes generated in that environment embed the preview URL. Coaches who print QR codes from a preview or staging environment will have non-functional codes on tournament day.

`CheckInTab.tsx` line 191 hardcodes `event_id=1` in the QR check-in URL. This means QR codes for players in event 2 still embed `event_id=1`. When the code is scanned, the check-in page loads event 1's player data, not event 2's. This is a silent data integrity failure — the scan appears to succeed but records the check-in against the wrong event.

#### Event Registration QR (EVT-02)

The event registration QR code links to the public registration page with a slug or token that identifies the event. The risks:

- **Link permanence.** If the event slug changes after the QR is distributed (flyers printed, emails sent), the QR is broken. The slug must be treated as immutable once the QR is generated and distributed.
- **QR image format.** QR codes need high-contrast printing. If the dark-theme app generates a dark-background QR (white QR on navy background), many consumer QR scanners fail. Generate QR codes with standard black-on-white styling regardless of the app's dark theme.
- **Sharing via iMessage / WhatsApp.** Social platforms resize images on upload. A 300×300 pixel QR code shared as a JPEG attachment may be compressed enough to become unscannable. Recommend SVG export or minimum 600×600 pixel PNG.

#### Coach Self-Registration Links (REG-04)

The coach self-registration link embeds a token tied to a specific program and event. The token grants the ability to register as a coach for that program without going through admin-initiated user creation.

- **Token expiry.** If the token has no expiry, a coach registration link distributed for an event remains valid indefinitely. A link shared publicly by accident allows anyone to register as a coach for that program at any future event.
- **Token reuse.** If the token is single-use and the coach clicks the link on two devices (mobile then desktop), the second click invalidates the first registration attempt. The token must either be session-bound or allow re-entry until the registration is submitted.
- **Token tied to wrong event.** The `registration_invites` table in `supabase/registration_invites.sql` already has an invite token pattern for refs/volunteers. If the same pattern is reused for coach registration but the `event_id` is hardcoded as 1 (per the current codebase pattern), coach registrations will be attached to event 1.
- **No revocation.** If a coach link is sent to the wrong email, there is no mechanism in the current schema to revoke a specific invite token without deleting it. The admin UI should show all outstanding coach invite tokens and allow revocation.

### Warning Signs

- QR codes scanned at the field open a 404 or "event not found" page.
- Player check-in via QR shows the wrong player name (event-1 player listed when scanning event-2 code).
- Coach registration links work in development but 404 in production (environment URL mismatch).
- Printed QR codes fail to scan under field lighting conditions (low contrast from dark theme).
- Coach self-registration tokens still work 6 months after the event.

### Prevention Strategy

**Explicitly set `NEXT_PUBLIC_APP_URL` in Vercel's production environment** and add a CI/CD check that warns if QR codes are generated when `NODE_ENV !== 'production'` or when the app URL does not match the production domain.

**Fix the `event_id=1` hardcode in `CheckInTab.tsx` line 191** as part of SEC-04. QR token generation must use the current event's ID, not a constant.

**Always generate QR codes as black-on-white SVG or high-resolution PNG** with no transparency and no dark background. Use a library like `qrcode` (npm) which generates standard-format codes, not a custom renderer.

**Set token expiry on all invite-style tokens.** For event registration QR codes, a 90-day expiry is reasonable (covers the registration window before an event). For coach self-registration links, align expiry with the event's registration deadline. Store `expires_at` in the token table and check it server-side at `app/join/[token]/page.tsx`.

**Add a token revocation UI.** Show admins the list of outstanding invite tokens with the ability to delete them. The delete cascades the invite row; subsequent requests with that token return 404 immediately.

### Phase

**EVT-02 (event registration QR) — Event Creation Enhancements phase. REG-04 (coach self-registration) — Registration Flow Enhancements phase.** Both require SEC-04 (hardcode removal) to be complete first. The `CheckInTab` QR URL fix is part of SEC-04 and should not wait for the EVT/REG phases.

---

## P8: Public Site Performance

### The Problem

The public results site (`apps/public-results/`) is a separate Next.js app with 30-second ISR revalidation. It is currently a skeleton but will grow to include live scores (PUB-01), standings (PUB-03), and real-time updates via Supabase Realtime (PUB-06). Each of these features introduces performance risks on a site that must handle parents and spectators — a user population that is 10× the size of the admin user population and arrives in bursts (between games, at halftime).

**ISR cache stampede.** With `revalidate = 30`, when the cache expires, the first request triggers a re-fetch while subsequent requests wait for the revalidated page. At a large tournament where 200 parents refresh the standings page simultaneously after a game ends, 200 requests hit the stale cache and only one triggers revalidation — this is handled correctly by Next.js. However, if Supabase is slow to respond (network latency, cold query on a large table), all 200 requests will wait for that single slow rebuild. The revalidation timeout should be chosen based on how often scores actually change, not minimized for freshness.

**Supabase Realtime connection limits.** Supabase free tier allows 200 concurrent Realtime connections. If 200 parents have the public results page open simultaneously and each page opens a Realtime subscription (PUB-06), the free tier limit is hit. New connections will be rejected silently. Parents will see scores that do not update without any error indicator.

**Unscoped real-time subscriptions.** The main app's `lib/store.tsx` already has unscoped subscriptions (CONCERNS.md §10). The public results app must not repeat this pattern. Each visitor subscribing to `games` with no filter would receive every game change from every event — unnecessary data transfer and connection overhead.

**Query performance without indexes.** The public results page will need queries like "games by event, ordered by time" and "standings by division." If `games` and `teams` do not have indexes on `event_id` and `division`, these queries will do full table scans. At small scale (one event, 50 games), this is unnoticeable. At five events running simultaneously with 300 games each, full scans become a problem.

**Standings calculation cost.** Computing win/loss records (PUB-03) requires aggregating game results. If this is done on every page request with a complex JOIN rather than a pre-computed view or materialized query, it will be slow under load. Supabase does not have materialized view auto-refresh without an external trigger.

### Warning Signs

- Public results page load times exceed 3 seconds during peak post-game refresh traffic.
- Supabase dashboard shows Realtime connection count approaching 200 (free tier limit).
- Standings show stale win/loss records that do not update even 30+ seconds after a game ends.
- Supabase dashboard shows slow queries on the `games` table without an index scan.
- 503 errors on the public results app during peak traffic (Vercel serverless function cold starts + slow DB queries combined).

### Prevention Strategy

**Use SSE or polling for the public site, not WebSocket Realtime.** Rather than opening a Supabase Realtime WebSocket connection per visitor (which counts toward the 200-connection limit), use Next.js Route Handlers with a short polling interval (10–30 seconds) or Server-Sent Events. This keeps the update latency acceptable while not consuming Realtime connection slots that the admin app needs.

**Add a `filter` to any Realtime subscription used on the public site.** Scope to `event_id=eq.[current_event_id]` to avoid receiving cross-event noise. This is the same fix needed for the main app (CONCERNS.md §10).

**Increase ISR revalidation to 60 seconds for standings** (scores change at most every few minutes). Use on-demand ISR (`revalidatePath()`) triggered by a webhook when a game status changes to `final`. This gives instant updates when a game ends without polling overhead.

**Pre-compute standings with a database view.** Create a PostgreSQL view that computes wins, losses, and point differentials from the `games` table. The view is cheap to query and avoids repeated aggregation logic in application code. Refresh-on-read performance is acceptable at the data volumes LeagueOps will see.

**Add indexes for public query patterns.** Before the public site goes live, add: `CREATE INDEX ON games(event_id, game_date);` and `CREATE INDEX ON games(event_id, division);`. Run `EXPLAIN ANALYZE` on the top three query patterns from the public site and verify index scans are used.

### Phase

**Public Results phase (PUB-01 through PUB-06) — after SEC-01/SEC-04 are complete.** The public site must query scoped, RLS-secured data. Building it before RLS is in place means the public site will read from open tables, which is acceptable temporarily but must not be deployed to production in that state.

---

## Prevention Summary

| Pitfall                 | Single Most Important Prevention                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1: RLS Migration       | Fix engine client imports (SEC-03) before tightening any policy — silent empty-result failures will happen otherwise                                                                 |
| P2: Auth Retrofit       | Categorize every route as auth-required vs. token-gated vs. public before touching any — one broken route on tournament day causes visible failures                                  |
| P3: Hardcode Removal    | Fix the `loadAll` dependency array bug first, or event switching will show stale data even after hardcodes are removed                                                               |
| P4: Notification Costs  | Implement deduplication with `notification_sent_at` before wiring any notification trigger — notification loops are the most expensive mistake                                       |
| P5: Google Maps Billing | Restrict the API key by HTTP referrer in the Google Cloud Console before the key is deployed — the $200/month free credit disappears in one leak incident                            |
| P6: Rescheduling Engine | Use a database-level transaction (Supabase RPC) for slot assignment — multi-step API calls are not atomic and will cause double-bookings under concurrent use                        |
| P7: QR Codes            | Set `NEXT_PUBLIC_APP_URL` correctly in production Vercel environment and generate black-on-white codes only — both are easier to get right once than to fix after flyers are printed |
| P8: Public Site         | Use polling/SSE instead of per-visitor Realtime WebSockets — Supabase free tier's 200-connection limit will be hit at any real tournament                                            |

### Sequencing Dependencies

The pitfalls are not independent. The required implementation order is:

```
SEC-03 (fix engine clients)
    → SEC-02 (add auth to routes)
        → SEC-01 (tighten RLS)
            → SEC-04 (remove hardcodes) — can overlap with SEC-01/02
                → EVT-01/02 (Google Maps, registration QR)
                → REG-01 through REG-06 (registration enhancements)
                → SCH-01 through SCH-06 (rescheduling) — after field engine bug fix
                    → NOT-01 through NOT-06 (notifications) — after auth + event scoping
                        → PUB-01 through PUB-06 (public site) — last; reads secured data
```

Any feature that writes to event-scoped data (notifications, rescheduling) that ships before SEC-04 is complete will use or produce data scoped to event 1, silently corrupting the multi-event model.

---

_Research completed: 2026-03-22. Based on codebase analysis in `/planning/codebase/` and project requirements in `/planning/PROJECT.md`._
