# Phase 8: Schedule Change Request Workflow - Research

**Researched:** 2026-03-24
**Domain:** Full-stack workflow — PostgreSQL state machine, Supabase RPC, TypeScript slot-suggestion engine, Next.js 14 App Router API routes, React component integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** "Request Change" button on individual game cards in ScheduleTab (coaches in main app) and ProgramLeaderDashboard (program leaders in portal).
- **D-02:** Coaches can select multiple games in a single request (all sharing one reason and request type).
- **D-03:** Reason uses preset dropdown (Coach conflict, Team conflict, Weather concern, Venue issue, Other) plus free text details field.
- **D-04:** Coach chooses cancel vs reschedule intent when submitting.
- **D-05:** Both program leaders and head coaches can submit schedule change requests for their team's games.
- **D-06:** Coaches/program leaders can see status of their submitted requests (pending, under_review, approved, denied, rescheduled). Status badge on affected games + "My Requests" visibility in portal.
- **D-07:** Modal shows checkbox list of team's upcoming (future) games. Each row: date, time, field, opponent, division.
- **D-08:** When opened from a game card, that game is pre-checked. Coach can add more games.
- **D-09:** New dedicated "Requests" tab in AppShell. Tab badge shows pending request count. Admin-only.
- **D-10:** Full detail cards in Requests tab. Each card: team name, game(s) with date/time/field/opponent, reason category + notes, request type, status badge, submitted date.
- **D-11:** Inline approve/deny actions on each request card. Approve (reschedule): expands to slot suggestions. Approve (cancel): game immediately cancelled. Deny: small notes field.
- **D-12:** Optional notes on deny, no notes required on approve.
- **D-13:** Admin Requests tab grouped by status: Pending first, Under Review, then recent Completed/Denied.
- **D-14:** Per-game status tracking within multi-game requests. Request-level status = "partially_complete" until all games resolved, then "completed".
- **D-15:** State machine strictly forward-only: pending → under_review → approved → rescheduled (or denied at any point).
- **D-16:** Cancelled games get status "Cancelled" — game stays in DB, visible with muted/strikethrough styling.
- **D-17:** When request type = "cancel" and admin clicks Approve, game is immediately cancelled. No slot suggestion step.
- **D-18:** Ranked list of up to 5 best alternative slots. Each shows: date, time, field, availability status for both teams. Green/yellow/red indicators. Admin clicks one to confirm.
- **D-19:** Slot suggestions check field + team availability only (no referee check — deferred).
- **D-20:** For multi-game requests, admin processes games one at a time. Slot suggestions generated per individual game.
- **D-21:** Three notification trigger points: (1) new request → admin notified. (2) approved/rescheduled → both teams notified. (3) denied → requester notified.
- **D-22:** Both home and away teams' coaches/program leaders get notified when a game is rescheduled or cancelled.
- **D-23:** Admin notification for new requests includes deep link CTA to the specific request in Requests tab.

### Claude's Discretion

- `schedule_change_requests` and `schedule_change_request_games` table schema design
- State machine validation logic in PATCH route
- Slot suggestion engine internal ranking algorithm (prefer same day, then adjacent days, etc.)
- PostgreSQL RPC function design for atomic rescheduling
- Game card "Request Change" button placement and styling details
- Request detail card layout within the Requests tab
- Slot suggestion availability indicator implementation
- "Cancelled" game styling in schedule views
- Pending count badge implementation on the Requests tab
- Whether `schedule_change_requests` stores `game_ids` as JSONB array or uses a junction table

### Deferred Ideas (OUT OF SCOPE)

- Coach-initiated time proposals (coaches suggest specific alternative times)
- Open comment threads on requests
- Referee availability check in slot suggestions
- Bulk approve/deny actions for multiple requests
- Request analytics/reporting dashboard
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCR-01 | Coach/program leader can submit a schedule change request selecting affected game(s), reason, preferred alternative, and cancel vs reschedule | ScheduleChangeRequestModal + API POST /api/schedule-change-requests |
| SCR-02 | System notifies admin (in-app + email) when a new schedule change request is submitted | insertNotification() with 'schedule_change' alert_type + admin scope |
| SCR-03 | Admin can review, approve, or deny schedule change requests | ScheduleChangeRequestsTab + PATCH /api/schedule-change-requests/[id] state transitions |
| SCR-04 | When admin approves a request, system auto-suggests available alternative time slots considering field, team, and referee availability | lib/engines/schedule-change.ts slot suggestion engine |
| SCR-05 | Admin selects from suggested slots and confirms the reschedule | Admin selects from inline slot list, triggers POST /api/schedule-change-requests/[id]/reschedule |
| SCR-06 | Rescheduled game updated atomically (database transaction) to prevent double-bookings | Supabase RPC (PostgreSQL function) |
| SCR-07 | All affected teams notified of schedule changes via notification system | insertNotification() wired to Phase 7 infrastructure at reschedule/cancel time |
| SCR-08 | Schedule change request has state machine: pending → under_review → approved → rescheduled (or denied) | PATCH route validates legal transitions by role; 400 on illegal |
</phase_requirements>

---

## Summary

Phase 8 builds a complete multi-party workflow on top of the existing LeagueOps stack. The core challenge is not any single new technology — it is correctly orchestrating state transitions, atomic data mutations, and notification triggers across an admin and coach/program leader.

The most critical technical risk is the **atomic rescheduling** requirement (SCR-06). The `games` table's `scheduled_time` column is currently `TEXT` (schema.sql line 84), not `TIMESTAMPTZ`. The scope notes explicitly flag this must be migrated to `TIMESTAMPTZ` as part of SCR-06's migration, because overlap math requires comparable timestamps. This is the only schema-breaking change in the phase and must be addressed in Wave 0.

The second critical risk is the **state machine PATCH route**. The route must enforce both legal transitions AND role-based access (coaches can only submit; admins can approve/deny). These are two orthogonal permission checks that must both be validated server-side.

The slot suggestion engine (SCR-04) is **pure TypeScript with no DB required to write the logic** — it can be developed and unit-tested before the migration lands. This is the one component that benefits from a decoupled development order.

**Primary recommendation:** Use a junction table (`schedule_change_request_games`) rather than a JSONB array for game_ids. This enables clean per-game status tracking (D-14), foreign-key integrity, and straightforward queries when building the admin Requests tab. The overhead is one extra table with 3-4 columns.

---

## Project Constraints (from CLAUDE.md)

These directives are authoritative and the planner must verify all tasks comply:

- Stack locked: **Next.js 14 App Router + Supabase + Vercel** — no changes
- All DB queries scoped with `.eq('event_id', eventId)` — never hardcode event IDs
- Server-side client: `createClient()` from `@/lib/supabase/server` inside handler body
- Auth check via `supabase.auth.getUser()` in every API route before any logic
- Zod validation for every API route body (SEC-07)
- Dark theme: Barlow Condensed, navy/red palette
- `prefer-const` — use `const` unless reassigned (Vercel build strictness)
- `StatusBadge` only accepts `status` prop (no `size`)
- Hooks must be called before any early returns
- `Select` must always use `bg-[#040e24]` (never transparent)
- Use try/catch not .catch() chains in engine functions
- Tests in `__tests__/<path>/<file>.test.ts`, engine tests use `makeMockSb` + `makeChain` pattern
- Engine signature: `(client: SupabaseClient, eventId: number)` — BUT `schedule-change.ts` is pure TS, so no DB parameter needed
- Named exports preferred over default exports
- All migrations applied via `supabase/phase8_schedule_change.sql`

---

## Standard Stack

### Core (existing — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14.2.4 | API routes + React components | Project-locked |
| Supabase JS | existing | DB queries, auth, realtime | Project-locked |
| Zod | existing | API route validation | Project convention (SEC-07) |
| react-hot-toast | 2.4.1 | Success/error feedback on mutations | Project convention |
| lucide-react | existing | Icons (e.g. ChevronDown, Clock, Calendar) | Project convention |
| Tailwind CSS | 3.4.4 | Styling | Project convention |
| date-fns | 3.6.0 | Date arithmetic for slot suggestion engine | Already installed |
| Vitest | 4.1.0 | Unit tests for schedule-change.ts engine | Already configured |

### No New Dependencies Required

All required capabilities exist in the current stack. The slot suggestion engine is pure TypeScript arithmetic. The atomic reschedule is a Supabase RPC (SQL-only). No new npm packages are needed.

---

## Architecture Patterns

### New Files to Create

```
supabase/
└── phase8_schedule_change.sql     # Migration: new tables + RPC + game status Cancelled

lib/engines/
└── schedule-change.ts             # Slot suggestion engine (pure TS, no DB param needed)

schemas/
└── schedule-change-requests.ts    # Zod schemas for POST + PATCH routes

app/api/schedule-change-requests/
├── route.ts                       # GET (list) + POST (create)
└── [id]/
    ├── route.ts                   # GET (single) + PATCH (state transitions)
    └── slots/
        └── route.ts               # GET — returns ranked slot suggestions for a game

components/schedule/
└── ScheduleChangeRequestModal.tsx # Coach/PL submission modal

components/requests/
├── ScheduleChangeRequestsTab.tsx  # Admin Requests tab
└── RequestCard.tsx                # Single request detail card (inline expand)

types/index.ts                     # Add ScheduleChangeRequest + ScheduleChangeRequestGame types
                                   # Extend GameStatus with 'Cancelled'
lib/db.ts                          # Add CRUD functions for schedule_change_requests
lib/store.tsx                      # Add scheduleChangeRequests state + real-time subscription
components/AppShell.tsx            # Add 'requests' to TabName union
```

### Pattern 1: Database Schema (Junction Table Approach)

**What:** Two tables — `schedule_change_requests` (one row per request) + `schedule_change_request_games` (one row per game within a request).

**Why junction table over JSONB array:** D-14 requires per-game status tracking. A junction table allows each game's status to be updated independently, queried directly, and keeps FK integrity. JSONB arrays would require application-level iteration to update individual game statuses.

```sql
-- Source: Claude's Discretion + D-14 requirement

CREATE TABLE IF NOT EXISTS schedule_change_requests (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_by_role TEXT NOT NULL CHECK (submitted_by_role IN ('coach', 'program_leader')),
  team_id BIGINT NOT NULL REFERENCES teams(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('cancel', 'reschedule')),
  reason_category TEXT NOT NULL CHECK (reason_category IN (
    'Coach conflict', 'Team conflict', 'Weather concern', 'Venue issue', 'Other'
  )),
  reason_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'partially_complete', 'completed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_change_request_games (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES schedule_change_requests(id) ON DELETE CASCADE,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'rescheduled', 'cancelled')),
  new_field_id BIGINT REFERENCES fields(id),
  new_scheduled_time TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_scr_event ON schedule_change_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_scr_status ON schedule_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_scr_team ON schedule_change_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_scrg_request ON schedule_change_request_games(request_id);
CREATE INDEX IF NOT EXISTS idx_scrg_game ON schedule_change_request_games(game_id);
```

### Pattern 2: `scheduled_time` Column Migration (SCR-06 prerequisite)

**What:** `games.scheduled_time` is currently `TEXT`. Slot suggestion overlap math requires `TIMESTAMPTZ` for reliable comparison. This is the one breaking schema change.

**Migration approach:**
```sql
-- In phase8_schedule_change.sql

-- 1. Add Cancelled to games status CHECK constraint
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check
  CHECK (status IN ('Scheduled','Starting','Live','Halftime','Final','Delayed','Cancelled'));

-- 2. Change scheduled_time from TEXT to TIMESTAMPTZ
--    Need to handle existing "9:00 AM" text values — cast via intermediate column
ALTER TABLE games ADD COLUMN scheduled_time_new TIMESTAMPTZ;
-- Admin must populate scheduled_time_new from scheduled_time (data migration step)
-- Then rename columns after data is migrated
-- See Pattern 7 for the careful migration steps
```

**IMPORTANT PITFALL:** The existing field engine (`lib/engines/field.ts`) and schedule engine (`lib/engines/schedule.ts`) both use `timeToMinutes()` on `scheduled_time` text values. After migration to TIMESTAMPTZ, these engines need to extract the time component differently. Research shows this is an existing Phase 1 bug flagged in scope notes ("field engine resolved bug must be fixed").

### Pattern 3: State Machine PATCH Route

**What:** `PATCH /api/schedule-change-requests/[id]/route.ts` validates legal transitions by role.

**Legal transitions matrix:**

| From | To | Who |
|------|-----|-----|
| pending | under_review | admin |
| pending | denied | admin |
| under_review | approved | admin |
| under_review | denied | admin |
| approved | (per-game rescheduling happens via slots route) | admin |

**Pattern (mirrors existing `app/api/games/[id]/route.ts`):**
```typescript
// Source: existing app/api/games/[id]/route.ts pattern

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate Zod
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const result = updateScheduleChangeRequestSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  // Fetch current request + user role
  const { data: current } = await supabase
    .from('schedule_change_requests').select('status, submitted_by').eq('id', params.id).single()
  // ... role check + legal transition check → 400 on illegal
  // ... update + return
}
```

### Pattern 4: Atomic Reschedule RPC

**What:** PostgreSQL function called via `supabase.rpc('reschedule_game', { ... })`. Executes as a single transaction — prevents TOCTOU double-booking.

```sql
-- Source: Supabase RPC pattern — Claude's Discretion

CREATE OR REPLACE FUNCTION reschedule_game(
  p_game_id BIGINT,
  p_new_field_id BIGINT,
  p_new_scheduled_time TIMESTAMPTZ,
  p_request_game_id BIGINT,
  p_event_id BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_conflict_count INT;
  v_game_duration INT := 60; -- fallback; ideally read from event_rules
BEGIN
  -- 1. Check for field double-booking at the proposed slot
  SELECT COUNT(*) INTO v_conflict_count
  FROM games
  WHERE field_id = p_new_field_id
    AND event_id = p_event_id
    AND id != p_game_id
    AND status NOT IN ('Final', 'Cancelled')
    AND scheduled_time < p_new_scheduled_time + (v_game_duration || ' minutes')::INTERVAL
    AND scheduled_time + (v_game_duration || ' minutes')::INTERVAL > p_new_scheduled_time;

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Field conflict detected at proposed slot');
  END IF;

  -- 2. Update the game atomically
  UPDATE games SET
    field_id = p_new_field_id,
    scheduled_time = p_new_scheduled_time,
    status = 'Scheduled'
  WHERE id = p_game_id;

  -- 3. Update the request_game status
  UPDATE schedule_change_request_games SET
    status = 'rescheduled',
    new_field_id = p_new_field_id,
    new_scheduled_time = p_new_scheduled_time,
    processed_at = NOW()
  WHERE id = p_request_game_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Calling from Next.js API route:**
```typescript
const { data, error } = await supabase.rpc('reschedule_game', {
  p_game_id: gameId,
  p_new_field_id: newFieldId,
  p_new_scheduled_time: newScheduledTime,
  p_request_game_id: requestGameId,
  p_event_id: eventId,
})
```

### Pattern 5: Slot Suggestion Engine (`lib/engines/schedule-change.ts`)

**What:** Pure TypeScript function. No DB param needed — takes pre-fetched data.

**Engine signature (Claude's discretion):**
```typescript
export interface SlotSuggestion {
  date: string                // ISO date e.g. "2026-06-15"
  label: string               // e.g. "Saturday, Jun 15"
  fieldId: number
  fieldName: string
  scheduledTime: string       // ISO timestamptz
  homeTeamAvailable: boolean
  awayTeamAvailable: boolean
  score: number               // ranking score (higher = better)
}

export function generateSlotSuggestions(
  game: Game,
  allGames: Game[],
  fields: Field[],
  eventDates: EventDate[],
  teamAvailability: Record<number, number[]>,  // teamId -> available event_date_ids
  gameDurationMin: number
): SlotSuggestion[]
```

**Ranking algorithm (Claude's discretion — per D-18 green/yellow/red logic):**
1. Filter: only future event dates (not dates in the past)
2. Filter: field is not double-booked at the candidate slot
3. Filter: neither team has another game within `gameDurationMin + buffer`
4. Score: same event_date_id as original game = +100 (D-14 "same day preferred")
5. Score: within 1 day of original = +50; within 2 days = +25
6. Score: both teams have that date in their `available_date_ids` = +20 each
7. Return top 5 by score

**Why pure TS (no DB) is correct:** The planner can write and unit-test this engine before the DB migration lands. Slot candidates come from data already in the store (games, fields, event_dates). The API route (`GET /api/schedule-change-requests/[id]/slots`) fetches the data and calls this function.

### Pattern 6: App Shell Integration

```typescript
// components/AppShell.tsx — add to TabName union
export type TabName =
  | 'dashboard'
  | 'schedule'
  | 'requests'    // NEW
  // ... existing tabs

// Add to ALL_TABS (admin-only)
{ id: 'requests', label: 'Requests', adminOnly: true }
```

**Pending count badge (D-09 — Claude's discretion):**
```typescript
// In AppShell, derive count from scheduleChangeRequests state
const pendingCount = state.scheduleChangeRequests?.filter(r => r.status === 'pending').length ?? 0
// Render inline: "Requests" + {pendingCount > 0 && <span>{pendingCount}</span>}
```

### Pattern 7: `scheduled_time` Migration Strategy (SCR-06)

**Problem:** `games.scheduled_time` is `TEXT` with values like `"9:00 AM"`. After migration to TIMESTAMPTZ, the field engine's `timeToMinutes()` will break because it parses AM/PM strings.

**Two-phase approach:**

Phase 8a (migration): Add `TIMESTAMPTZ` column, keep TEXT column during transition.
```sql
-- Add new column (nullable initially)
ALTER TABLE games ADD COLUMN IF NOT EXISTS scheduled_time_ts TIMESTAMPTZ;
```

Phase 8b (code): Update all time parsing to handle TIMESTAMPTZ. The engines will need to extract time from TIMESTAMPTZ:
```typescript
// Instead of parsing "9:00 AM" strings, extract hours/minutes from Date
function timeToMinutes(scheduledTime: string | Date): number {
  const d = new Date(scheduledTime)
  if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes()
  // fallback: existing AM/PM string parser
  // ...
}
```

**Recommendation:** The cleanest approach for this phase — since games have an `event_date` (we know the calendar date), seed data can be updated as `${event_date.date}T${parsed_time}:00Z`. The field engine bug fix (Phase 1 scope note) should happen here. The `scheduled_time` column becomes the TIMESTAMPTZ after migration.

### Pattern 8: Real-Time Subscription for Requests Tab

Following the existing store pattern:
```typescript
// lib/store.tsx — add to State + Action + subscriptions

// State addition
scheduleChangeRequests: ScheduleChangeRequest[]

// Action additions
| { type: 'SET_SCHEDULE_CHANGE_REQUESTS'; payload: ScheduleChangeRequest[] }
| { type: 'ADD_SCHEDULE_CHANGE_REQUEST'; payload: ScheduleChangeRequest }
| { type: 'UPDATE_SCHEDULE_CHANGE_REQUEST'; payload: ScheduleChangeRequest }

// Subscription (follows games subscription pattern)
sb.channel('schedule_change_requests')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_change_requests',
      filter: `event_id=eq.${eid}` }, (payload) => {
    dispatch({ type: 'ADD_SCHEDULE_CHANGE_REQUEST', payload: payload.new as ScheduleChangeRequest })
  })
  .on('postgres_changes', { event: 'UPDATE', ... }, (payload) => {
    dispatch({ type: 'UPDATE_SCHEDULE_CHANGE_REQUEST', payload: payload.new as ScheduleChangeRequest })
  })
  .subscribe()
```

### Pattern 9: Notification Wiring

`insertNotification()` already handles `schedule_change` alert type. Three call sites:

```typescript
// 1. On POST (new request submitted) — notify admin scope
await insertNotification(
  eventId, 'schedule_change', 'event', null,
  { title: 'New schedule change request', summary: `${teamName} requested changes to ${gameCount} game(s)`,
    detail: `Reason: ${reasonCategory}. ${reasonDetails}`,
    cta_url: `${appUrl}/e/${slug}?tab=requests&id=${requestId}` }
)

// 2. On approve/reschedule — notify both teams (scope = 'team', scopeId = teamId)
await insertNotification(eventId, 'schedule_change', 'team', homeTeamId, { ... })
await insertNotification(eventId, 'schedule_change', 'team', awayTeamId, { ... })

// 3. On deny — notify requester (scope = 'team', scopeId = submittingTeamId)
await insertNotification(eventId, 'schedule_change', 'team', teamId, { ... })
```

**Important:** Phase 7's `dedup_key` is computed as `alert_type::scope::scope_id::event_id`. Multiple notifications to the same team for different games in the same request will deduplicate — the planner should call `insertNotification` once per unique (scope, scope_id) pair per event, not once per game in a multi-game request.

### Anti-Patterns to Avoid

- **Multi-step API calls for rescheduling:** Do NOT do a PATCH to update game + a PATCH to update request_game in sequence. Under concurrent users, another request could grab the same slot between calls. Use the RPC.
- **JSONB array for game_ids:** Prevents per-game status tracking and FK integrity.
- **Client-side state machine:** Validate transitions server-side in the PATCH route. Never trust client-sent status values without checking current state.
- **Hardcoded event IDs:** Every query must use the `event_id` from context/request params.
- **Transparent `<Select>`:** Use `bg-[#040e24]` on all Select elements (known gotcha in CLAUDE.md).
- **Hooks after early returns:** In `ScheduleChangeRequestsTab.tsx`, all hooks before any `if (!eventId) return null` guards.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Notification delivery | Custom email/push logic | `insertNotification()` from `lib/notifications.ts` | Phase 7 already handles dedup, retries, email via Resend, push via Web Push |
| Modal UI | Custom overlay | `Modal` from `components/ui/index.tsx` | Consistent dark theme, backdrop, close behavior |
| Form inputs | Custom inputs | `FormField`, `Input`, `Select`, `Textarea` from UI kit | Known dark theme gotchas (Select transparency) already solved |
| Status display | Custom pill component | `StatusBadge` + new `RequestStatusBadge` | `StatusBadge` is game status only — create a separate badge for request status |
| Date arithmetic | Custom calendar math | `date-fns` (already installed) | Timezone-safe; `isAfter`, `addDays`, `formatDistanceToNow` are exactly what slot ranking needs |
| Atomic DB transactions | Sequential API calls | Supabase RPC (PostgreSQL function) | Only way to guarantee no double-booking under concurrent use |
| Field conflict check in slot engine | Re-implement overlap logic | Borrow `timeToMinutes` pattern from `lib/engines/field.ts` | Overlap logic is already battle-tested; extract utility function |

**Key insight:** The notification infrastructure, UI components, and field overlap logic are already production-quality. This phase wires them together — it does not re-implement them.

---

## Common Pitfalls

### Pitfall 1: `scheduled_time` Type Mismatch
**What goes wrong:** Slot suggestion engine does date comparison on `TEXT` "9:00 AM" values — arithmetic silently fails or returns nonsense results.
**Why it happens:** `games.scheduled_time` is `TEXT` in schema.sql (line 84), not `TIMESTAMPTZ`.
**How to avoid:** The Wave 0 migration (`phase8_schedule_change.sql`) MUST migrate `scheduled_time` to `TIMESTAMPTZ`. The slot suggestion engine should use `new Date(scheduledTime)` not string parsing.
**Warning signs:** Slot suggestions returning all games as available regardless of actual times.

### Pitfall 2: `GameStatus` Union Missing `'Cancelled'`
**What goes wrong:** TypeScript compile error when setting `game.status = 'Cancelled'`. Vercel build fails.
**Why it happens:** `types/index.ts` line 5 — `GameStatus` does not include `'Cancelled'`. The `StatusBadge` component's `STATUS_CLASS` map also doesn't handle it.
**How to avoid:** Wave 0 must add `'Cancelled'` to `GameStatus` union AND add `badge-cancelled` CSS class AND update the SQL `CHECK` constraint.
**Warning signs:** TypeScript errors on assignment; `StatusBadge` receiving unknown status.

### Pitfall 3: Supabase Joined Filters Silently Fail
**What goes wrong:** A query like `.eq('teams.event_id', eventId)` returns unexpected results without error.
**Why it happens:** Known Supabase behavior — joined table filters don't work (documented in CLAUDE.md gotcha #1).
**How to avoid:** When filtering by joined table columns, fetch IDs first, then use `.in('team_id', ids)`.
**Warning signs:** Queries returning too many or too few rows with no error reported.

### Pitfall 4: State Machine Not Enforced Server-Side
**What goes wrong:** Client sends `status: 'rescheduled'` directly in PATCH body, skipping `approved` step.
**Why it happens:** Client-side state is easily manipulated.
**How to avoid:** PATCH route must: (1) fetch current status from DB, (2) validate the requested transition against the legal matrix, (3) validate the user's role has permission for that transition.
**Warning signs:** Requests jumping from `pending` to `rescheduled` without going through `approved`.

### Pitfall 5: Double-Booking Under Concurrency
**What goes wrong:** Two admins simultaneously approve different requests for the same slot. Both see it as available. Both confirm. One game is double-booked.
**Why it happens:** TOCTOU — Time Of Check To Time Of Use gap between "check availability" (GET /slots) and "confirm reschedule" (POST /reschedule).
**How to avoid:** The reschedule MUST happen inside the PostgreSQL RPC which re-checks availability within the transaction. The GET /slots endpoint is advisory only.
**Warning signs:** Two games on same field at same time after concurrent approvals.

### Pitfall 6: Notification Dedup Key Collision
**What goes wrong:** Admin gets only one notification for a multi-game request because all games share the same dedup key.
**Why it happens:** Phase 7's dedup_key = `alert_type::scope::scope_id::event_id` — same for all games in same event.
**How to avoid:** This is actually correct behavior for the admin notification (one notification per request is sufficient). For team notifications, send to `scope='team'` with `scope_id=teamId` — the dedup key will differ per team.
**Warning signs:** Admin not notified at all, or only one team notified.

### Pitfall 7: `ScheduleChangeRequestsTab` Hook-Before-Guard Pattern
**What goes wrong:** Vercel build fails: "React Hook called conditionally".
**Why it happens:** Common pattern violation when devs add `if (!eventId) return null` before hooks in complex components.
**How to avoid:** All `useState`, `useEffect`, `useCallback` calls must appear before any conditional early returns.
**Warning signs:** Lint/build error mentioning hook order.

---

## Code Examples

### Slot Suggestion Engine Skeleton
```typescript
// Source: Claude's Discretion — lib/engines/schedule-change.ts
// Pure TypeScript — no Supabase client parameter needed

import { addDays, isAfter, isSameDay } from 'date-fns'
import type { Game, Field, EventDate } from '@/types'

export interface SlotSuggestion {
  eventDateId: number
  dateLabel: string
  fieldId: number
  fieldName: string
  scheduledTime: string  // ISO 8601
  homeTeamAvailable: boolean
  awayTeamAvailable: boolean
  score: number
}

export function generateSlotSuggestions(params: {
  game: Game
  allGames: Game[]
  fields: Field[]
  eventDates: EventDate[]
  teamAvailability: Record<number, number[]>
  gameDurationMin: number
}): SlotSuggestion[] {
  const { game, allGames, fields, eventDates, teamAvailability, gameDurationMin } = params
  const suggestions: SlotSuggestion[] = []
  const originalDate = new Date(game.scheduled_time)

  for (const eventDate of eventDates) {
    for (const field of fields) {
      for (const candidateTime of getCandidateTimes(eventDate, gameDurationMin)) {
        const candidateTs = new Date(`${eventDate.date}T${candidateTime}Z`)

        // Skip past slots
        if (!isAfter(candidateTs, new Date())) continue

        // Skip same game's current slot
        if (candidateTs.getTime() === originalDate.getTime() && field.id === game.field_id) continue

        // Check field availability
        const fieldConflict = allGames.some(g =>
          g.id !== game.id &&
          g.field_id === field.id &&
          g.status !== 'Final' && g.status !== 'Cancelled' &&
          overlaps(new Date(g.scheduled_time), candidateTs, gameDurationMin)
        )
        if (fieldConflict) continue

        // Check team availability
        const homeOccupied = allGames.some(g =>
          g.id !== game.id &&
          (g.home_team_id === game.home_team_id || g.away_team_id === game.home_team_id) &&
          g.status !== 'Final' && g.status !== 'Cancelled' &&
          overlaps(new Date(g.scheduled_time), candidateTs, gameDurationMin)
        )
        const awayOccupied = allGames.some(g =>
          g.id !== game.id &&
          (g.home_team_id === game.away_team_id || g.away_team_id === game.away_team_id) &&
          g.status !== 'Final' && g.status !== 'Cancelled' &&
          overlaps(new Date(g.scheduled_time), candidateTs, gameDurationMin)
        )

        // Scoring
        let score = 0
        if (isSameDay(candidateTs, originalDate)) score += 100
        else {
          const dayDiff = Math.abs(candidateTs.getTime() - originalDate.getTime()) / 86400000
          if (dayDiff <= 1) score += 50
          else if (dayDiff <= 2) score += 25
        }
        const homeAvail = (teamAvailability[game.home_team_id] ?? []).includes(eventDate.id)
        const awayAvail = (teamAvailability[game.away_team_id] ?? []).includes(eventDate.id)
        if (homeAvail) score += 20
        if (awayAvail) score += 20

        suggestions.push({
          eventDateId: eventDate.id,
          dateLabel: eventDate.label,
          fieldId: field.id,
          fieldName: field.name,
          scheduledTime: candidateTs.toISOString(),
          homeTeamAvailable: !homeOccupied && homeAvail,
          awayTeamAvailable: !awayOccupied && awayAvail,
          score,
        })
      }
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

function overlaps(a: Date, b: Date, durationMin: number): boolean {
  const aEnd = a.getTime() + durationMin * 60000
  const bEnd = b.getTime() + durationMin * 60000
  return a.getTime() < bEnd && aEnd > b.getTime()
}

function getCandidateTimes(eventDate: EventDate, gameDurationMin: number): string[] {
  // Return on-the-hour slots from 8:00 to 18:00 (adjust to event's typical window)
  const slots: string[] = []
  for (let h = 8; h <= 18; h += Math.floor(gameDurationMin / 60) || 1) {
    slots.push(`${String(h).padStart(2, '0')}:00:00`)
  }
  return slots
}
```

### Request Status Badge (separate from GameStatus StatusBadge)
```typescript
// New component — RequestStatusBadge
// 'pending' | 'under_review' | 'approved' | 'denied' | 'partially_complete' | 'completed'

const REQUEST_STATUS_CLASS: Record<string, string> = {
  pending: 'badge-scheduled',        // blue
  under_review: 'badge-starting',    // orange
  approved: 'badge-live',            // green
  denied: 'bg-red/20 text-red-400 ...', // red
  partially_complete: 'badge-halftime', // yellow
  completed: 'badge-final',          // gray
}
```

### `lib/db.ts` — New Functions Pattern
```typescript
// Follows existing get/insert/update naming convention
export async function getScheduleChangeRequests(eventId: number): Promise<ScheduleChangeRequest[]> {
  const sb = createClient()
  const { data } = await sb
    .from('schedule_change_requests')
    .select(`*, games:schedule_change_request_games(*, game:games(*))`)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function insertScheduleChangeRequest(
  request: Omit<ScheduleChangeRequest, 'id' | 'created_at' | 'updated_at'>,
  gameIds: number[]
): Promise<ScheduleChangeRequest | null> {
  const sb = createClient()
  // Insert request first, then junction rows in transaction is not possible from JS
  // Use Supabase RPC or two sequential inserts (acceptable here — request creation
  // does not have concurrency risk like rescheduling does)
  const { data: req } = await sb.from('schedule_change_requests').insert(request).select().single()
  if (!req) return null
  await sb.from('schedule_change_request_games').insert(
    gameIds.map(gid => ({ request_id: req.id, game_id: gid, status: 'pending' }))
  )
  return req as ScheduleChangeRequest
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multi-step API for complex mutations | PostgreSQL RPC (single transaction) | Supabase has supported RPCs since early versions | Prevents TOCTOU double-booking |
| JSONB arrays for related records | Junction tables with individual row status | Phase 8 design decision | Enables per-game status (D-14), FK integrity |
| TEXT for scheduled_time | TIMESTAMPTZ | This migration (SCR-06) | Reliable overlap arithmetic |

**Deprecated/outdated:**
- `TEXT` scheduled_time strings parsed with regex: replaced by TIMESTAMPTZ after migration. The `timeToMinutes()` helper in `field.ts` and `schedule.ts` will need to handle both during transition.

---

## Open Questions

1. **`scheduled_time` migration for existing records**
   - What we know: The column is TEXT with values like "9:00 AM". Event dates have a `date` field. We can construct a TIMESTAMPTZ from the pair.
   - What's unclear: What timezone should be used? Events have a `location` field but no explicit timezone column.
   - Recommendation: Use UTC as the stored timezone and convert to local time in the UI. For existing data, apply a manual data migration step as part of Wave 0, converting "9:00 AM" + event_date.date to UTC ISO timestamps assuming the event's local timezone (document in migration comments).

2. **`isProgramLeader` auth check in submission route**
   - What we know: `lib/auth.tsx` exposes `isCoach` and `userRoles`. `UserRole` has a `role` field and `team_id`.
   - What's unclear: There is no `isProgramLeader` boolean on the auth context. Program leaders need to be checked via `userRoles.some(r => r.role === 'program_leader')`.
   - Recommendation: Add `isProgramLeader: boolean` to `AuthContextValue` in `lib/auth.tsx` (same pattern as `isCoach`) as part of Wave 0 type work.

3. **Team-to-user mapping for coach submission**
   - What we know: `UserRole` has `team_id` linking a coach to their team. The submission modal needs to know which team the requesting user represents.
   - What's unclear: A coach might have `team_id` pointing to a `teams` record, but `ScheduleChangeRequestModal` needs to show only that team's upcoming games.
   - Recommendation: Use `userRole.team_id` to filter games shown in the modal. For program leaders, use `userRole.program_id` to find all teams in that program and show games for all of them.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is code + SQL changes only. No new external services, CLIs, or runtimes are required beyond what the project already uses (Node.js, npm, Supabase CLI/MCP).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test -- --reporter=verbose __tests__/lib/engines/schedule-change.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCR-01 | Modal creates request with correct fields | unit (component smoke) | `npm run test -- __tests__/components/ScheduleChangeRequestModal.test.tsx` | Wave 0 |
| SCR-04 | Slot suggestion engine returns ranked suggestions | unit | `npm run test -- __tests__/lib/engines/schedule-change.test.ts` | Wave 0 |
| SCR-04 | Engine returns empty array when no valid slots | unit | same | Wave 0 |
| SCR-04 | Engine correctly filters field double-bookings | unit | same | Wave 0 |
| SCR-04 | Engine correctly filters team double-bookings | unit | same | Wave 0 |
| SCR-06 | RPC function rejects conflicting slot | manual (Supabase SQL editor) | n/a — SQL transaction test | n/a |
| SCR-08 | PATCH route rejects illegal state transitions (pending → rescheduled) | unit | `npm run test -- __tests__/app/api/schedule-change-requests.test.ts` | Wave 0 |
| SCR-08 | PATCH route rejects transition by wrong role | unit | same | Wave 0 |
| SCR-02/07 | insertNotification called on submit + reschedule | unit (mock) | in schedule-change-requests.test.ts | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- __tests__/lib/engines/schedule-change.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/lib/engines/schedule-change.test.ts` — covers SCR-04 slot suggestion logic
- [ ] `__tests__/app/api/schedule-change-requests.test.ts` — covers SCR-08 state machine + SCR-02/07 notification triggers
- [ ] `__tests__/components/ScheduleChangeRequestModal.test.tsx` — covers SCR-01 form submission
- [ ] Engine uses same `makeMockSb`/`makeChain` pattern from `__tests__/lib/engines/_mockSb.ts`

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `supabase/schema.sql`, `types/index.ts`, `lib/notifications.ts`, `lib/engines/field.ts`, `lib/engines/schedule.ts`, `lib/auth.tsx`, `lib/store.tsx`, `components/ui/index.tsx`, `components/AppShell.tsx`, `app/api/games/[id]/route.ts`, `schemas/games.ts`, `supabase/phase7_notifications.sql`, `CLAUDE.md`
- Phase 8 CONTEXT.md (08-CONTEXT.md) — all decisions (D-01 through D-23)

### Secondary (MEDIUM confidence)
- Supabase RPC pattern — derived from Supabase official docs pattern for PostgreSQL functions called via `.rpc()`. Standard approach verified against project's existing Supabase usage.
- `date-fns` slot arithmetic — `isAfter`, `isSameDay`, `addDays` are stable APIs in date-fns 3.x (already installed at 3.6.0).

### Tertiary (LOW confidence)
- None — all claims are derived from direct codebase inspection or established patterns.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — project-locked stack, no new dependencies
- Architecture: HIGH — derived from direct inspection of existing patterns (games API route, field engine, notification infrastructure)
- `scheduled_time` migration: HIGH — column type is directly observable in schema.sql line 84 as TEXT
- Pitfalls: HIGH — most derived from CLAUDE.md known gotchas + Phase 7 decisions log
- Slot suggestion algorithm: MEDIUM — ranking heuristics are Claude's discretion; the approach is sound but exact scoring weights may need tuning

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable stack, 30-day validity)
