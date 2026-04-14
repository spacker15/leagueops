# Architecture Research

Research milestone: integration architecture for the six feature areas in LeagueOps Active requirements, targeted at the existing Next.js 14 App Router + Supabase + Vercel stack.

---

## Notification Service Design

### Overview

The notification system must serve three classes of event: weather alerts (NOT-01), schedule changes (NOT-02), and admin ops alerts (NOT-03). It must deliver through email (NOT-04), SMS (NOT-05), and browser push (NOT-06) without a dedicated notification server — Supabase Edge Functions are the right execution host for all three channels.

### Core Design: Database-First Fan-Out

The most reliable pattern for this stack is a **database-driven outbox**. Every notification originates as a row in a `notification_queue` table. A Supabase Edge Function processes the queue and fans out to delivery channels. This separates trigger logic (what happened) from delivery logic (how to reach people) and gives a natural audit trail.

```
Trigger source (weather engine / schedule engine / unified engine)
  → INSERT INTO notification_queue (type, payload, recipient_ids)
  → Supabase Database Webhook → Edge Function: process-notifications
      → Email channel: Resend free tier (100 emails/day free, then $0.001/email)
      → SMS channel: Twilio free trial OR Supabase's built-in Auth SMS provider
      → Push channel: Web Push (VAPID keys, no third-party cost)
```

### Table: `notification_queue`

```sql
CREATE TABLE notification_queue (
  id           BIGSERIAL PRIMARY KEY,
  event_id     BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type         TEXT NOT NULL, -- 'weather_alert' | 'schedule_change' | 'admin_alert'
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  payload      JSONB DEFAULT '{}',           -- structured context (game_id, old_time, new_field, etc.)
  recipient_scope TEXT NOT NULL DEFAULT 'admins', -- 'admins' | 'coaches' | 'all_teams' | 'team:{id}'
  channels     TEXT[] NOT NULL DEFAULT ARRAY['email'], -- ['email','sms','push']
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'sent' | 'failed'
  attempts     INT DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  sent_at      TIMESTAMPTZ
);
CREATE INDEX ON notification_queue(status, created_at);
CREATE INDEX ON notification_queue(event_id);
```

### Table: `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id     BIGINT REFERENCES events(id) ON DELETE CASCADE, -- NULL = global preference
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled   BOOLEAN DEFAULT FALSE,
  push_enabled  BOOLEAN DEFAULT FALSE,
  phone         TEXT,
  push_subscription JSONB,  -- Web Push subscription object from browser
  UNIQUE(user_id, event_id)
);
```

### Table: `notification_log`

```sql
CREATE TABLE notification_log (
  id           BIGSERIAL PRIMARY KEY,
  queue_id     BIGINT REFERENCES notification_queue(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,
  status       TEXT NOT NULL, -- 'sent' | 'failed' | 'bounced'
  provider_id  TEXT,          -- Resend message ID, Twilio SID, etc.
  sent_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Edge Function: `process-notifications`

Lives at `supabase/functions/process-notifications/index.ts`. Triggered by a Supabase Database Webhook on INSERT to `notification_queue`. The function:

1. Reads the `recipient_scope` to resolve the target `user_id` list (query `user_roles` filtered by `event_id` and scope)
2. Reads each user's `notification_preferences` for the event
3. For each user × channel combination, calls the appropriate provider SDK
4. Writes a row to `notification_log` per delivery attempt
5. Updates `notification_queue.status` to `sent` or `failed`

Webhook configuration: Supabase → Database → Webhooks → trigger on `INSERT` on `notification_queue WHERE status = 'pending'`.

### Email Channel: Resend

Resend has a free tier of 100 emails/day and a developer plan at $0.001/email beyond that. It is DKIM/SPF-ready out of the box and is the lowest-friction option for edge function usage. The Edge Function calls `https://api.resend.com/emails` directly via `fetch` — no Node.js SDK needed in the Deno environment.

Environment variable: `RESEND_API_KEY` (server-only, set in Supabase Dashboard → Edge Functions → Secrets).

### SMS Channel: Twilio or Free Alternative

Twilio is the most reliable free-trial option — $15.50 trial credit, enough for hundreds of SMS messages before requiring billing. The Edge Function calls the Twilio REST API via `fetch`. For truly free SMS at scale, consider **Vonage** (similar free tier) or route through the admin's email-to-SMS gateway (`number@carrier.com`) as a zero-cost fallback. This should be an opt-in preference since SMS is the most costly channel.

Environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.

### Push Channel: Web Push (VAPID)

Browser push requires no third-party service cost. The stack:

- Generate VAPID key pair once (store public key in `NEXT_PUBLIC_VAPID_KEY`, private key in `VAPID_PRIVATE_KEY` as a Supabase secret)
- Browser calls `serviceWorker.pushManager.subscribe()` in a client component — the resulting `PushSubscription` JSON is saved to `notification_preferences.push_subscription`
- Edge Function calls the Web Push protocol (`POST` to the subscription endpoint) using the `web-push` Deno library or raw VAPID JWT construction
- A Service Worker in `public/sw.js` handles `push` events and shows the notification via `self.registration.showNotification()`

For PWA compatibility, the main app needs `public/manifest.json` (already implied by responsive/PWA direction in MOB-01) and `<link rel="manifest">` in `app/layout.tsx`.

### Integration Points with Existing Engines

The notification system is a **subscriber to engine outputs**, not a replacement for them. The integration hooks are:

| Existing Engine                  | Trigger Event                                       | Notification Type                          |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| `lib/engines/weather.ts`         | Lightning detected (sets `lightning_events` record) | `weather_alert` to all coaches/admins      |
| `lib/engines/weather.ts`         | Heat index threshold exceeded                       | `weather_alert` to admins                  |
| `lib/engines/unified.ts`         | `ops_alerts` INSERT (severity = critical)           | `admin_alert` to admins                    |
| `app/api/games/[id]/route.ts`    | Game `scheduled_time` or `field_id` PATCH           | `schedule_change` to affected team coaches |
| Schedule change request workflow | Request status changes to `approved`                | `schedule_change` to coaches of both teams |

The practical integration is: after the engine writes its result (a `lightning_events` row, an `ops_alerts` row, or a game PATCH), the API route handler also writes a row to `notification_queue`. The Edge Function then handles delivery asynchronously. **Do not call the Edge Function synchronously from the API route** — write to the queue and return immediately.

Example in `app/api/lightning/route.ts` (after existing lightning trigger logic):

```typescript
await sb.from('notification_queue').insert({
  event_id: eventId,
  type: 'weather_alert',
  title: 'Lightning Delay Active',
  body: 'All games have been suspended. Lightning detected in the area.',
  recipient_scope: 'all_teams',
  channels: ['email', 'push'],
})
```

### Component Boundary Summary

- **Trigger**: existing API routes and engines — they write to `notification_queue`, nothing else
- **Processing**: `supabase/functions/process-notifications/` — reads queue, resolves recipients, calls providers, logs results
- **Opt-in UI**: new `NotificationSettingsPanel` component — lets users subscribe to push, toggle channels, save phone number — calls new `app/api/notifications/preferences/route.ts`
- **Admin view**: new section in `RightPanel` or `CommandCenter` showing recent `notification_log` rows for the current event

---

## Public Results Site Architecture

### Current State

`apps/public-results/` is already a functional standalone Next.js 14 app on port 3001. It reads from the same Supabase project (anon key only, read-only). The `[slug]/page.tsx` uses ISR with `revalidate = 30`. It currently has: standings, results (final games), live games tab. It uses the same design token palette as the admin app.

### What Stays: Separate `apps/public-results` App

The separate-app approach is correct and should be kept. Reasons:

- No auth context — the admin app's `AuthProvider` should never run on public pages
- Different Vercel deployment URL (can be `results.leagueops.app` vs `leagueops.vercel.app`)
- Different caching strategy: ISR with short revalidation vs always-fresh for admin
- Avoids exposing any admin API routes to public traffic

### Deployment: Vercel Monorepo Configuration

Both apps should deploy from the same GitHub repo. Add `vercel.json` to the root for monorepo routing:

```json
{
  "projects": [
    { "root": ".", "name": "leagueops-admin" },
    { "root": "apps/public-results", "name": "leagueops-public" }
  ]
}
```

Or configure two separate Vercel projects pointing to the same GitHub repo with different "Root Directory" settings in the Vercel dashboard — this is simpler and already how it's structured with the separate `package.json`.

### Real-Time Updates for Public Site (PUB-06)

ISR at 30s is the current model — it works but has a 30-second lag. For live score updates visible to parents, two approaches:

**Option A: Client-side Supabase Realtime (recommended for this stack)**
Add a `LiveScoresClient.tsx` client component within the server-rendered page. The server component handles the initial render (standings, results), and the client component attaches a Supabase Realtime subscription scoped to the current event:

```typescript
// apps/public-results/src/components/LiveScoresClient.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function LiveScoresClient({ eventId }: { eventId: number }) {
  const [liveGames, setLiveGames] = useState(initialGames)

  useEffect(() => {
    const channel = supabase
      .channel(`public-results-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          setLiveGames((prev) => prev.map((g) => (g.id === payload.new.id ? payload.new : g)))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId])
}
```

**Option B: Keep ISR, reduce to 10s revalidation**
Simpler — no client JS on public pages, good for SEO and parent-facing performance. Tradeoff: 10s lag on score updates. `export const revalidate = 10`.

Recommendation: Option A for live game scores only (it's a thin client component), Option B for standings and completed results. The `[slug]/page.tsx` becomes a hybrid: server-rendered skeleton passed to a client component that subscribes for live-score updates.

### Additional Pages to Build (PUB-01 through PUB-05)

The existing `[slug]/page.tsx` handles standings, results, and live scores. New pages needed:

| Requirement                         | Route                     | Implementation                                                       |
| ----------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| PUB-02: Schedule by team/field/time | `/e/[slug]/schedule`      | Server component, reads `games` joined with teams/fields/event_dates |
| PUB-04: Bracket visualization       | `/e/[slug]/bracket`       | Client component — bracket rendering is interactive                  |
| PUB-05: Team search / QR            | `/e/[slug]/team/[teamId]` | Server component, renders team schedule and roster                   |

PUB-05 (QR code for parents to find team) integrates with EVT-02 (shareable registration link). The QR code encodes `https://results.leagueops.app/e/{slug}/team/{teamId}`. No new infrastructure needed — existing `player_qr_tokens` tokens can redirect to the public results team page.

### Component Boundaries

- `apps/public-results/src/lib/data.ts` — all DB reads (already exists, extend with `getPublicSchedule`, `getPublicBracket`, `getTeamGames`)
- `apps/public-results/src/lib/supabase.ts` — anon client (read-only, already exists)
- `apps/public-results/src/components/LiveScoresClient.tsx` — new: client component for realtime game state
- `apps/public-results/src/app/e/[slug]/` — add nested routes for schedule, team, bracket
- No shared code between the admin app and public-results app — both read from Supabase directly

---

## Schedule Change Request State Machine

### State Model

The schedule change request workflow (SCH-01 through SCH-06) is a state machine with four states:

```
pending → under_review → approved → rescheduled
                       ↘ denied
```

- `pending`: coach/program leader submitted a conflict request
- `under_review`: admin has opened and is reviewing the request
- `approved`: admin approved the concept; system generates alternative slot suggestions
- `denied`: admin rejected the request with a reason
- `rescheduled`: admin confirmed a specific alternative slot; game record updated

### Database Schema

```sql
CREATE TABLE schedule_change_requests (
  id               BIGSERIAL PRIMARY KEY,
  event_id         BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  game_id          BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  requested_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id       BIGINT REFERENCES programs(id) ON DELETE SET NULL,
  request_type     TEXT NOT NULL CHECK (request_type IN ('reschedule', 'cancel')),
  reason           TEXT NOT NULL,
  preferred_date   DATE,
  preferred_time   TEXT,
  preferred_notes  TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'rescheduled')),
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  admin_note       TEXT,
  denial_reason    TEXT,
  suggested_slots  JSONB,  -- array of {field_id, event_date_id, time, score} from slot-finder
  chosen_slot      JSONB,  -- the slot the admin picked
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON schedule_change_requests(event_id, status);
CREATE INDEX ON schedule_change_requests(game_id);
CREATE INDEX ON schedule_change_requests(requested_by);
```

### API Routes

All state transitions go through a single `PATCH /api/schedule-change-requests/[id]/route.ts`. The route reads the requested `status` transition and validates it is a legal move before applying it. This keeps the state machine in one place.

```typescript
// Allowed transitions per caller role:
// program_leader/coach: pending → (initial creation only via POST)
// admin: pending → under_review, under_review → approved, under_review → denied, approved → rescheduled
```

| Method | Route                                                  | Purpose                                              |
| ------ | ------------------------------------------------------ | ---------------------------------------------------- |
| POST   | `app/api/schedule-change-requests/route.ts`            | Coach submits new request                            |
| GET    | `app/api/schedule-change-requests/route.ts`            | Admin lists all for event; coach sees own            |
| PATCH  | `app/api/schedule-change-requests/[id]/route.ts`       | State transition + admin actions                     |
| GET    | `app/api/schedule-change-requests/[id]/slots/route.ts` | Returns auto-suggested slots for an approved request |

### Slot Suggestion Engine (SCH-04)

The slot suggestion logic runs when an admin approves a request. It finds alternative game slots by:

1. Loading all games for the event on the requested date (or all remaining dates if no preference)
2. Running the same time-overlap logic from `lib/engines/field.ts` (`timeToMinutes()`) to find open field windows
3. Checking that neither team has another game in adjacent windows (using `lib/engines/referee.ts` travel buffer approach)
4. Scoring each open slot by: proximity to original time, field availability score, and whether it avoids referee conflicts
5. Returning top 3–5 scored suggestions as JSON stored in `suggested_slots`

This logic belongs in `lib/engines/schedule-change.ts` — a new engine module following the same pattern as existing engines. It is called from `app/api/schedule-change-requests/[id]/slots/route.ts`.

### Notification Integration

Each state transition writes to `notification_queue`:

- `pending` → created: notify admin (admin_alert, `recipient_scope: 'admins'`)
- `approved` → slots generated: notify requesting coach (schedule_change, `recipient_scope: 'team:{program_id}'`)
- `denied`: notify requesting coach with denial reason
- `rescheduled`: notify both teams' coaches (schedule_change, `recipient_scope: 'team:{home_team_id}'` + `recipient_scope: 'team:{away_team_id}'`)

### UI Components

- `ScheduleChangeRequestModal` — coach-facing: select game, choose type, write reason, submit — rendered inside `ProgramDashboard`
- `ScheduleChangeRequestsTab` — admin-facing: new admin tab (fits in `TopBar` under an "Operations" or "Schedule" group) showing all requests with status badges and action buttons
- State machine transitions driven by `Btn` click → `PATCH` → optimistic UI update

---

## RLS & Auth Architecture

### Current State

All tables have `CREATE POLICY "Allow all" ON ... FOR ALL USING (true)` — the database is entirely open to the anon key. Auth is enforced only at the application layer. This must change before scaling to multiple events with multiple orgs.

### Target RLS Architecture: Event-Scoped Isolation

The core invariant to enforce at the DB layer: **a user can only read/write rows belonging to events they have a role in**. The mechanism is a join through `user_roles`.

#### Helper Function

Add a stable security-definer function that avoids N+1 policy evaluations:

```sql
CREATE OR REPLACE FUNCTION user_event_ids()
RETURNS SETOF BIGINT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT DISTINCT event_id FROM user_roles
  WHERE user_id = auth.uid()
    AND is_active = TRUE
    AND event_id IS NOT NULL;
$$;
```

This function is called once per query by RLS policies to get the caller's allowed event IDs. Marking it `STABLE SECURITY DEFINER` prevents repeated lookups and bypasses recursive RLS on `user_roles` itself.

#### Policy Patterns by Table Type

**Event-owned tables** (`games`, `fields`, `teams`, `event_dates`, `referees`, `volunteers`, etc.):

```sql
-- DROP existing "Allow all" first
DROP POLICY IF EXISTS "Allow all" ON games;

-- Read: authenticated users scoped to their events
CREATE POLICY "event_read" ON games
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- Write: only admins/league_admins for the event
CREATE POLICY "event_write" ON games
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT ur.event_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'league_admin')
        AND ur.is_active = TRUE
    )
  );

-- Same pattern for UPDATE and DELETE
```

**Public read tables** (`events` — event listing is public for the public-results site):

```sql
CREATE POLICY "public_read" ON events
  FOR SELECT TO anon, authenticated
  USING (true);  -- events list is public

CREATE POLICY "admin_write" ON events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );
```

**Program-owned tables** (`programs`, `program_teams`, `team_registrations`):

```sql
-- Program leaders read/write their own program
CREATE POLICY "program_leader_own" ON programs
  FOR ALL TO authenticated
  USING (
    id IN (
      SELECT program_id FROM program_leaders WHERE user_id = auth.uid()
    )
  );

-- Admins see all programs
CREATE POLICY "admin_all" ON programs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

**User roles table** (already has correct policies from `auth_migration.sql` — keep them):

```sql
-- "Users can read own role" USING (auth.uid() = user_id)  -- keep
-- "Admins can manage roles" -- keep
```

**Ops/alert tables** (`ops_alerts`, `ops_log`, `operational_conflicts`) — admin read/write, service role for engine writes:

```sql
CREATE POLICY "admin_read" ON ops_alerts
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- Engine writes go through API routes that use service role key
-- No INSERT policy needed for authenticated — engines run server-side
```

#### Multi-Tenant Event Isolation Summary

| Access Pattern                  | Enforcement Mechanism                                                       |
| ------------------------------- | --------------------------------------------------------------------------- |
| Admin reads event data          | RLS `event_id IN (user_event_ids())` — only events in their `user_roles`    |
| Program leader reads team data  | RLS via `program_leaders` join                                              |
| Public reads event list/results | Anon key + public policy on `events`, `games`, `teams` (read-only subset)   |
| Engine writes (server-side)     | Service role key bypasses RLS — engines run in API routes or Edge Functions |
| Cross-event data access         | Impossible — `user_event_ids()` only returns events the user has a role in  |

#### API Route Auth Hardening (SEC-02)

Every API route must add this auth check at the top of the handler:

```typescript
const sb = createServerClient(...)  // existing pattern
const { data: { user } } = await sb.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// For admin-only routes, also check role:
const { data: roleData } = await sb
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .eq('event_id', eventId)
  .eq('is_active', true)
  .single()
if (!roleData || !['admin','league_admin'].includes(roleData.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

This is the same pattern already in `app/api/admin/create-user/route.ts` — replicate it across all 40+ routes as part of SEC-02.

---

## Registration Flow Architecture

### Coach Registration Flow (REG-03 + REG-04 + REG-05)

#### Data Model Extensions Needed

```sql
-- Coaches table (separate from referees — different role, different certification)
CREATE TABLE coaches (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL if not yet registered
  program_id      BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  certifications  TEXT[],  -- ['US Lacrosse Level 1', 'First Aid', etc.]
  is_head_coach   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON coaches(program_id);
CREATE INDEX ON coaches(email);

-- Coach-team junction (one coach can coach multiple teams)
CREATE TABLE coach_teams (
  id         BIGSERIAL PRIMARY KEY,
  coach_id   BIGINT NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  team_id    BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(coach_id, team_id, event_id)
);

-- Self-registration invite links for coaches (mirrors existing registration_invites pattern)
CREATE TABLE coach_invites (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  program_id  BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  team_id     BIGINT REFERENCES teams(id) ON DELETE SET NULL,  -- NULL = any team in program
  token       TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  coach_name  TEXT,   -- pre-filled if program leader knows who they're inviting
  coach_email TEXT,   -- pre-filled
  is_active   BOOLEAN DEFAULT TRUE,
  expires_at  TIMESTAMPTZ,
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Self-Registration Flow (REG-04)

The coach self-registration flow mirrors the existing referee/volunteer join flow (`app/join/[token]/`):

```
Program leader generates invite link in ProgramDashboard
  → POST /api/coach-invites → inserts coach_invites row → returns token URL
  → Program leader shares link: https://leagueops.vercel.app/coach/[token]

Coach opens link:
  → app/coach/[token]/page.tsx (Server Component)
  → Validates token from coach_invites (not expired, not used)
  → Renders CoachJoinClient (Client Component)

Coach submits form (name, email, certifications, creates account if needed):
  → POST /api/coach-invites/[token]/register
  → Creates auth user (or links existing)
  → Creates coaches row
  → Creates coach_teams row for the designated team
  → Marks invite used
  → Creates user_roles row with role='coach'
```

This reuses the same page + `*Client.tsx` server/client split already established for `app/join/[token]/`.

#### Coach Conflict Detection (REG-05)

When a program leader adds a coach to a team (or when a coach self-registers), check:

1. Does this coach already have a role for another team in the same division on the same event date? → Flag as a division conflict
2. Does this coach coach two teams that play each other? → Flag as a direct conflict

This logic belongs in `lib/engines/coach-conflicts.ts` following the same engine pattern. It is called from the registration API route before finalizing the insert, and the result is returned to the UI for confirmation or hard block.

#### Program Registration Enhancements (REG-01, REG-02, REG-06)

**REG-01** (Admin defines schedule/dates before registration opens): Add `registration_opens_at` and `registration_closes_at` columns to `events`. The program registration wizard checks these dates before allowing step 1.

**REG-02** (Team availability selection): Add `available_date_ids` BIGINT[] column to `team_registrations`. The second step of the wizard renders checkboxes for each `event_date` row.

**REG-06** (Register multiple teams in one session): The existing wizard handles one team at a time. Extend step 2 to allow adding N team rows before final submit. Store them as a session in `useState` until final submission fires multiple `team_registrations` inserts in a single `Promise.all`.

#### Shareable Registration Link + QR Code (EVT-02)

Each event already has a `slug`. The registration entry URL is:

```
https://leagueops.vercel.app/register?event={slug}
```

Add `event_slug` awareness to `RegisterPage.tsx` to pre-select the event. Generate a QR code client-side using the `qrcode` npm package (no API call needed) targeting this URL. Display it in `EventSetupTab.tsx` for admins to download/share.

### Google Maps Integration (EVT-01)

The Google Maps Places API (New) supports address autocomplete and lat/lng lookup. The correct pattern for Next.js App Router:

**Server-side API key** — the Maps API key must stay server-only (`GOOGLE_MAPS_API_KEY`, not `NEXT_PUBLIC_*`). All geocoding requests go through a proxy route:

```
app/api/maps/autocomplete/route.ts  → calls Places API (Autocomplete)
app/api/maps/geocode/route.ts       → calls Geocoding API (place_id → lat/lng/address)
```

**Client component** `GooglePlacesInput.tsx` — a controlled input that calls `/api/maps/autocomplete` as the user types (debounced 300ms), displays a dropdown of suggestions, and on selection calls `/api/maps/geocode` to resolve the full address + coordinates. This is the same pattern used by Next.js applications that cannot expose Maps API keys.

**Data stored on events table**:

```sql
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_place_id TEXT,
  ADD COLUMN IF NOT EXISTS venue_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS venue_lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS venue_address TEXT;
```

The `complexes` table already has `lat` and `lng` columns used by the weather engine. For the initial implementation, populating `events.venue_lat/lng` and copying those values to the primary complex record on event creation is sufficient. For multi-complex events, the park map editor (`ParkMapTab`) is the right place to set per-complex coordinates.

**EVT-01 Build Steps**:

1. Add `app/api/maps/autocomplete/route.ts` (server proxy)
2. Add `app/api/maps/geocode/route.ts` (server proxy)
3. Add `GooglePlacesInput.tsx` to `components/settings/`
4. Update `EventSetupTab.tsx` to use `GooglePlacesInput` in the location field
5. Add migration for `venue_place_id`, `venue_lat`, `venue_lng`, `venue_address` columns

---

## Build Order Dependencies

The six feature areas have dependencies between them. The recommended build sequence respects those dependencies and front-loads security fixes that unblock everything else.

### Phase 0 — Security Foundation (Must complete before any new features ship)

These are not new features but are prerequisites for the RLS architecture to work:

1. **SEC-03**: Fix all engines to use server-side Supabase client (accept `supabaseClient` as parameter, or import `@/supabase/server` factory). Unblocks all engine-based features including notifications.
2. **SEC-04**: Remove all `event_id = 1` hardcodes — pass `eventId` as a parameter throughout. Required before multi-event notification scoping.
3. **SEC-01**: Replace "Allow all" RLS policies with event-scoped policies (as designed above). Deploy the `user_event_ids()` helper function first.
4. **SEC-02**: Add `auth.getUser()` checks to all 40+ API routes. Can be done in batches — start with write routes (games, assignments, lightning).

### Phase 1 — Google Maps + Event Enhancements (No dependencies on other new features)

1. `app/api/maps/autocomplete/route.ts` + `geocode/route.ts`
2. `GooglePlacesInput` component
3. `EventSetupTab` integration
4. Database migration for venue columns
5. EVT-02: Shareable link + QR code display in `EventSetupTab` (uses `qrcode` package, no backend needed)

**Duration estimate**: 2–3 days. No new tables beyond venue columns. No notification integration needed.

### Phase 2 — Registration Flow Enhancements (Depends on Phase 0 SEC-04 for event scoping)

Build order within this phase:

1. Database migrations: `coaches`, `coach_teams`, `coach_invites` tables; venue columns on `events`; `available_date_ids` on `team_registrations`; `registration_opens_at`/`registration_closes_at` on `events`
2. `lib/engines/coach-conflicts.ts` — pure engine, no UI dependency
3. `app/api/coach-invites/route.ts` — POST to create invite, GET to list
4. `app/api/coach-invites/[token]/route.ts` — GET to validate, POST to register
5. `app/coach/[token]/page.tsx` + `CoachJoinClient.tsx` — mirrors existing join flow
6. `ProgramDashboard.tsx` enhancements — add coaches section, availability selection, multi-team flow
7. REG-01 (date gating) + REG-06 (multi-team) can be built in parallel once migrations are applied

**Dependency**: Phase 0 SEC-04 (event_id hardcode removal) must complete first so registration wizard correctly scopes to the selected event.

### Phase 3 — Schedule Change Request Workflow (Depends on Phase 0 + existing schedule engine)

Build order:

1. Database migration: `schedule_change_requests` table
2. `lib/engines/schedule-change.ts` — slot suggestion engine (pure, depends on `lib/engines/field.ts` time logic — no new external dependencies)
3. `app/api/schedule-change-requests/route.ts` (POST, GET)
4. `app/api/schedule-change-requests/[id]/route.ts` (PATCH — state transitions)
5. `app/api/schedule-change-requests/[id]/slots/route.ts` (GET — slot suggestions)
6. `ScheduleChangeRequestModal` in `ProgramDashboard` (coach side)
7. `ScheduleChangeRequestsTab` or admin section in `CommandCenter` (admin side)
8. Notification queue writes in each state transition handler (requires Phase 4 queue table to exist — can stub/skip writes until Phase 4 is deployed)

**Dependency**: Notifications are desirable at step 8 but not required for the workflow to function. The state machine can ship without notifications and notifications can be wired in after Phase 4 deploys.

### Phase 4 — Notification Service (Depends on Phase 0 SEC-03 + database tables from Phases 2 and 3)

Build order:

1. Database migrations: `notification_queue`, `notification_preferences`, `notification_log` tables
2. VAPID key generation (one-time setup) + `public/sw.js` Service Worker
3. Supabase Edge Function: `supabase/functions/process-notifications/index.ts`
4. Database Webhook configured in Supabase Dashboard
5. `app/api/notifications/preferences/route.ts` — CRUD for user preferences
6. `NotificationSettingsPanel` component — push subscription, channel toggles
7. Wire notification queue writes into existing API routes (lightning, game PATCH, weather engine)
8. Wire notification queue writes into schedule change request state transitions (Phase 3 step 8)

**Dependency**: Phase 0 SEC-03 must complete so engines run server-side and can safely be co-located with server-only environment variables (Resend key, Twilio creds). VAPID private key must be a Supabase Edge Function secret, not a Next.js env var.

### Phase 5 — Public Results Site Enhancements (Mostly independent)

Build order:

1. `LiveScoresClient.tsx` — realtime game updates in public app (no admin app dependency)
2. `/e/[slug]/schedule` route + `getPublicSchedule()` data function
3. `/e/[slug]/team/[teamId]` route — team detail page
4. `/e/[slug]/bracket` route — bracket visualization (most complex, can defer)
5. RLS verification: confirm anon key can read `events`, `games`, `teams`, `fields` but NOT `ops_log`, `ops_alerts`, `user_roles`, payment tables

**Dependency**: Phase 0 SEC-01 (RLS rollout) must be done carefully so public anon-key reads still work on the subset of tables the public app needs. The RLS design above keeps `events`, `games`, and `teams` readable by `anon` via a `public_read` policy — this must be verified before Phase 5 ships.

### Dependency Graph Summary

```
Phase 0 (Security)
  ├── SEC-03 (engine client fix) ──→ Phase 4 (Notifications)
  ├── SEC-04 (event_id removal)  ──→ Phase 2 (Registration), Phase 3 (Schedule Change)
  └── SEC-01 (RLS rollout)       ──→ Phase 5 (Public Results — anon read verification)

Phase 1 (Maps + QR)              ─── Independent, can start immediately

Phase 2 (Registration Flow)      ──→ Phase 3 (coaches must exist before conflict detection)

Phase 3 (Schedule Change)        ──→ Phase 4 step 8 (notification wiring, deferrable)

Phase 4 (Notifications)          ─── Integrates into all phases after Phase 0
```

### What Can Start Immediately (No Blockers)

- Phase 1 entirely (Maps API proxy, EVT-02 QR codes)
- Phase 0 SEC-03 and SEC-04 (pure refactors, no new features)
- `notification_queue` table migration (schema change, no functionality required)
- `LiveScoresClient.tsx` in public-results app (completely isolated)
- `lib/engines/schedule-change.ts` (pure TypeScript, no DB required to write the logic)
