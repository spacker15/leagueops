# Phase 8: Schedule Change Request Workflow - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the end-to-end schedule change request flow: coach/program leader submission via game card action, admin review in a dedicated Requests tab, auto-slot suggestion engine, atomic rescheduling via PostgreSQL RPC, cancellation handling, and notification triggers wired to Phase 7 infrastructure. Covers SCR-01 through SCR-08.

</domain>

<decisions>
## Implementation Decisions

### Request Submission UX

- **D-01:** "Request Change" button appears on individual game cards in both ScheduleTab (for coaches in the main app) and ProgramLeaderDashboard (for program leaders in their portal). Most contextual entry point — coach is already looking at the game.
- **D-02:** Coaches can select multiple games in a single request (e.g., "team unavailable June 15"). All selected games share one reason and request type. Multi-game requests are common for date-level unavailability.
- **D-03:** Reason field uses preset dropdown (Coach conflict, Team conflict, Weather concern, Venue issue, Other) plus a free text details field. Structured data helps admin prioritize and filter.
- **D-04:** Coach chooses cancel vs reschedule intent when submitting. Gives admin clear signal of what the team needs.
- **D-05:** Both program leaders and head coaches can submit schedule change requests for their team's games. Prevents bottleneck on a single person while limiting to authorized roles.
- **D-06:** Coaches/program leaders can see status of their submitted requests (pending, under_review, approved, denied, rescheduled). Small status badge on affected games + "My Requests" visibility in the portal.

### Coach Game Selection UX

- **D-07:** Modal shows a checkbox list of the team's upcoming (future) games. Each row: date, time, field, opponent, division. Coach checks the games they need changed.
- **D-08:** When opened from a game card's "Request Change" button, that specific game is pre-checked in the modal. Coach can add more games if needed.

### Admin Review Workflow

- **D-09:** New dedicated "Requests" tab in AppShell alongside Dashboard, Schedule, etc. Tab badge shows pending request count. Visible only to admins.
- **D-10:** Full detail cards in the Requests tab. Each card shows: team name, game(s) affected with date/time/field/opponent, reason category + notes, request type (cancel/reschedule), status badge, submitted date.
- **D-11:** Inline approve/deny actions directly on each request card. On approve (reschedule): expands inline to show slot suggestions. On approve (cancel): game is immediately cancelled. On deny: opens small notes field for denial reason.
- **D-12:** Optional notes on deny, no notes required on approve. Keeps approve flow fast; deny requires explanation for requester.

### Request Filtering/Sorting

- **D-13:** Admin Requests tab grouped by status sections: Pending first, then Under Review, then recent Completed/Denied. Pending count shown in tab badge. Most urgent items at top.

### State Machine

- **D-14:** Per-game status tracking within multi-game requests. Each game has its own status (pending/rescheduled/cancelled/denied). Request-level status reflects aggregate: "partially_complete" until all games resolved, then "completed".
- **D-15:** State machine is strictly forward-only: pending → under_review → approved → rescheduled (or denied at any point). No going backwards. Matches SCR-08.

### Cancellation Flow

- **D-16:** Cancelled games get status changed to "Cancelled" — game stays in database, visible in schedule with muted/strikethrough styling. Preserves history.
- **D-17:** When request type is "cancel" and admin clicks Approve, the game is immediately cancelled. No slot suggestion step — cancel requests skip slot suggestion entirely.

### Slot Suggestion Engine

- **D-18:** Ranked list of up to 5 best alternative slots. Each shows: date, time, field, and availability status for both teams. Green/yellow/red indicators. Admin clicks one to confirm.
- **D-19:** Slot suggestions check field + team availability (no referee availability check). Referee assignment handled separately after reschedule.
- **D-20:** For multi-game requests, admin processes games one at a time. Slot suggestions generated per individual game. Avoids complex multi-game constraint solving.

### Notification Triggers

- **D-21:** Three notification trigger points: 1) New request submitted → admin notified (in-app + email). 2) Request approved/rescheduled → both teams notified. 3) Request denied → requester notified.
- **D-22:** Both home and away teams' coaches/program leaders get notified when a game is rescheduled or cancelled. The opponent needs to know their game moved too.
- **D-23:** Admin notification for new requests includes a deep link CTA to the specific request in the Requests tab. Matches Phase 7 D-06 email pattern.

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

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schedule & Games (core data this phase modifies)

- `supabase/schema.sql` — `games` table with status, scheduled_time, field_id, team references
- `lib/engines/schedule.ts` — Schedule generation engine with ScheduleGame type and conflict detection
- `lib/engines/field.ts` — Field conflict engine with overlap detection (field_overlap, field_blocked types)
- `lib/engines/schedule-rules.ts` — Schedule rules evaluator, timing helpers, coach conflict integration
- `components/schedule/ScheduleTab.tsx` — Main schedule view where "Request Change" button will appear

### Notification Infrastructure (Phase 7 — wire into this)

- `lib/notifications.ts` — `insertNotification()` helper, ALERT_TYPES (includes `schedule_change`), ALERT_TYPE_ROLES
- `supabase/functions/process-notifications/index.ts` — Edge Function that processes queue entries
- `types/index.ts` — AlertType, NotificationScope, NotificationQueueRow types

### Auth & Roles (permission checks for who can submit/review)

- `lib/auth.tsx` — AuthProvider with role checks (isAdmin, canManage)
- `supabase/schema.sql` — `user_roles` table with role column and team_id for coach-team linking

### Existing UI Patterns (reuse for new components)

- `components/ui/index.tsx` — Modal, Btn, StatusBadge, Card, FormField, Input, Select, Textarea
- `lib/store.tsx` — AppProvider with useReducer pattern, real-time subscriptions
- `components/engine/CommandCenter.tsx` — Existing ops alerts pattern (for reference on request card design)

### Program Leader Portal (second entry point for requests)

- `components/programs/ProgramLeaderDashboard.tsx` — Program leader view where "Request Change" also appears

### Coach Conflicts Engine (constraint data for slot suggestion)

- `lib/engines/coach-conflicts.ts` — Coach conflict detection, `getConflictingTeamPairs()` used in schedule engine

### API Route Patterns

- `lib/supabase/server.ts` — Server-side Supabase client (async createClient())
- `schemas/` — Zod validation schemas directory (Phase 3 pattern)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **Modal component** (`components/ui/index.tsx`): Shared modal for ScheduleChangeRequestModal — same props pattern (open, onClose, title, children, footer).
- **StatusBadge component**: Can be used for request status display (pending, under_review, approved, etc.).
- **insertNotification()** (`lib/notifications.ts`): Ready-to-use helper for queue entries. `schedule_change` alert type already defined.
- **Field engine** (`lib/engines/field.ts`): Overlap detection logic can inform slot suggestion — check if proposed slot conflicts with existing games on same field.
- **Schedule engine** (`lib/engines/schedule.ts`): ScheduleGame type and conflict detection patterns reusable for slot validation.
- **Zod validation schemas** (`schemas/`): Pattern for API route request validation established in Phase 3.
- **Server-side Supabase client**: `createClient()` from `@/lib/supabase/server` for all API routes.

### Established Patterns

- **Engine pattern**: `(client: SupabaseClient, eventId: number)` signature for `schedule-change.ts`
- **Tab pattern**: Each tab is a named export from `components/<feature>/<FeatureName>Tab.tsx`, uses `useApp()` and `useAuth()`
- **API route pattern**: Auth check → Zod validation → business logic → response. Rate limiting on public routes.
- **Game status types**: `GameStatus = 'Scheduled' | 'Starting' | 'Live' | 'Halftime' | 'Final' | 'Delayed'` — will need to add `'Cancelled'`
- **Toast feedback**: `react-hot-toast` for success/error messages on mutations
- **Real-time subscriptions**: Channel-based postgres_changes listeners in AppProvider

### Integration Points

- **AppShell.tsx**: Add 'requests' to TabName union for new Requests tab
- **ScheduleTab.tsx**: Add "Request Change" button on game cards (role-gated to coaches/program leaders)
- **ProgramLeaderDashboard.tsx**: Add "Request Change" button on team game listings
- **types/index.ts**: Add ScheduleChangeRequest, ScheduleChangeRequestGame types, extend GameStatus with 'Cancelled'
- **lib/store.tsx**: Add schedule change request state + real-time subscription
- **lib/db.ts**: Add CRUD functions for schedule_change_requests
- **API routes**: New `app/api/schedule-change-requests/` routes (CRUD + state machine PATCH)
- **Supabase RPC**: New PostgreSQL function for atomic game rescheduling

</code_context>

<specifics>
## Specific Ideas

- Game card "Request Change" button is the primary entry point — coach is already looking at the affected game
- Multi-game requests with shared reason match real-world pattern: "we can't make Saturday" affects multiple games
- Per-game status tracking within multi-game requests gives admin flexibility to process incrementally
- Slot suggestion ranking: same day > adjacent days > any open slot within event dates
- Cancel requests skip slot suggestion entirely — approve = immediate cancellation
- Forward-only state machine keeps the workflow simple and auditable
- Pending count badge on Requests tab gives admin awareness without leaving their current view
- Deep-link notifications match Phase 7 pattern and get admin to the right screen fast

</specifics>

<deferred>
## Deferred Ideas

- Coach-initiated time proposals (coaches suggest specific alternative times) — per roadmap Scope Notes, coaches state conflict + reason only
- Open comment threads on requests — per roadmap Scope Notes, text reason + admin notes only
- Referee availability check in slot suggestions — can be added later without architectural changes
- Bulk approve/deny actions for multiple requests — add if admin volume warrants it
- Request analytics/reporting dashboard — track request volume, reasons, resolution time

</deferred>

---

_Phase: 08-schedule-change-request-workflow_
_Context gathered: 2026-03-24_
