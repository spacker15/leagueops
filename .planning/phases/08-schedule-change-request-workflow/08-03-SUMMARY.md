---
phase: 08-schedule-change-request-workflow
plan: 03
subsystem: api
tags: [schedule-change, state-machine, notifications, realtime, rpc, supabase]

requires:
  - phase: 08-01
    provides: DB functions (getScheduleChangeRequests, insertScheduleChangeRequest, updateScheduleChangeRequestStatus), ScheduleChangeRequest types, schema Zod validators
  - phase: 08-02
    provides: generateSlotSuggestions engine from lib/engines/schedule-change.ts
  - phase: 07-01
    provides: insertNotification function from lib/notifications.ts
provides:
  - 4 API route files for the full schedule change request workflow backend
  - POST /api/schedule-change-requests — create request with admin notification
  - GET/PATCH /api/schedule-change-requests/[id] — fetch single + state machine transitions
  - GET /api/schedule-change-requests/[id]/slots — ranked slot suggestions via engine
  - POST /api/schedule-change-requests/[id]/reschedule — atomic reschedule via RPC + team notifications
  - Store integration with scheduleChangeRequests state + 3 actions + realtime subscription
affects: [08-04, frontend components consuming state.scheduleChangeRequests]

tech-stack:
  added: []
  patterns:
    - 'LEGAL_TRANSITIONS Record enforces state machine — illegal transitions return 400 with descriptive error'
    - 'Admin-only routes use maybeSingle() user_roles check — 403 if not admin'
    - 'Parallel Promise.all for slots route data fetching (games, fields, event_dates, team_registrations)'
    - 'RPC-first atomic reschedule — client never performs multi-step update directly'
    - 'Notifications fire at 3 trigger points: new request (admin/event scope), cancel/reschedule (both teams), deny (requester team)'

key-files:
  created:
    - app/api/schedule-change-requests/route.ts
    - app/api/schedule-change-requests/[id]/route.ts
    - app/api/schedule-change-requests/[id]/slots/route.ts
    - app/api/schedule-change-requests/[id]/reschedule/route.ts
  modified:
    - lib/store.tsx

key-decisions:
  - "Approved cancel requests immediately transition to 'completed' after updating all game statuses — no separate step needed"
  - "Reschedule route sets status to 'partially_complete' if some junction games still pending, 'completed' only when all resolved"
  - 'slots route is admin-only (same role check as PATCH) — coaches use the request form, not direct slot browsing'
  - "Store uses a separate Supabase channel ('schedule_change_requests') rather than adding to existing leagueops-realtime channel"

patterns-established:
  - "Inline Zod schema for reschedule body — not in schemas/ since it's route-local"

requirements-completed: [SCR-02, SCR-03, SCR-06, SCR-07, SCR-08]

duration: 10min
completed: 2026-03-24
---

# Phase 08 Plan 03: API Routes & Store Integration Summary

**4 API routes for full schedule change request workflow (state machine, slot suggestions, atomic RPC reschedule) + store with realtime subscription**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-24T18:38:18Z
- **Completed:** 2026-03-24T18:48:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- POST /api/schedule-change-requests creates request with junction rows and notifies admin (event-scoped notification)
- PATCH /api/schedule-change-requests/[id] enforces LEGAL_TRANSITIONS state machine (pending→under_review/denied, under_review→approved/denied), triggers cancel game updates + team notifications on approve, deny notification on deny
- GET /api/schedule-change-requests/[id]/slots fetches all required data in parallel and calls generateSlotSuggestions engine
- POST /api/schedule-change-requests/[id]/reschedule calls reschedule_game RPC atomically, determines completed vs partially_complete status, notifies both teams
- Store adds scheduleChangeRequests state with 3 actions (SET/ADD/UPDATE), loadAll integration, and event-scoped realtime channel

## Task Commits

1. **Task 1: API routes — CRUD, state machine, slots, reschedule** - `10f1251` (feat)
2. **Task 2: Store integration with scheduleChangeRequests state and realtime** - `ecde34a` (feat)

## Files Created/Modified

- `app/api/schedule-change-requests/route.ts` - GET list + POST create with admin notification
- `app/api/schedule-change-requests/[id]/route.ts` - GET single + PATCH state machine (LEGAL_TRANSITIONS, cancel game updates, deny notification)
- `app/api/schedule-change-requests/[id]/slots/route.ts` - GET slot suggestions via generateSlotSuggestions engine
- `app/api/schedule-change-requests/[id]/reschedule/route.ts` - POST atomic reschedule via supabase.rpc('reschedule_game') + team notifications
- `lib/store.tsx` - Added ScheduleChangeRequest type import, State field, 3 Action types, 3 reducer cases, loadAll integration, separate realtime channel

## Decisions Made

- Approved cancel requests immediately transition to `'completed'` after updating all game statuses (no intermediate state needed)
- Reschedule route uses `'partially_complete'` when some junction games are still pending, `'completed'` only when all resolved
- Slots route is admin-only (same role check as PATCH) — coaches use the request form UI, not direct slot browsing
- Store uses a separate Supabase channel `'schedule_change_requests'` rather than adding to the existing `leagueops-realtime` channel to keep concerns separate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 API routes are functional and TypeScript-clean
- Store has scheduleChangeRequests state ready for UI consumption in Plan 04
- Notifications fire at all workflow transition points per D-21

---

_Phase: 08-schedule-change-request-workflow_
_Completed: 2026-03-24_
