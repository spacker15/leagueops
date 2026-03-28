---
phase: 10-responsive-design-notification-wiring
plan: '03'
subsystem: notification-wiring
tags: [notifications, weather, schedule-change, admin-alerts, api-routes]
dependency_graph:
  requires: [10-00, phase-7-notification-infrastructure, phase-8-schedule-change-requests]
  provides: [NOT-02, NOT-03, NOT-04]
  affects: [app/api/weather-engine, app/api/games, app/api/schedule-change-requests]
tech_stack:
  added: []
  patterns:
    [insertNotification-non-fatal-try-catch, event-scope-weather-alerts, referee-noshow-detection]
key_files:
  created: []
  modified:
    - app/api/weather-engine/route.ts
    - app/api/games/[id]/route.ts
    - app/api/schedule-change-requests/route.ts
    - app/api/schedule-change-requests/[id]/route.ts
    - app/api/schedule-change-requests/[id]/reschedule/route.ts
    - schemas/games.ts
decisions:
  - 'D-16 weather scope: all alerts use event scope since WeatherAlert has no field_id; future field-level data can upgrade non-lightning alerts to field scope'
  - 'registration deadline check only fires on status=Scheduled transitions to avoid spam during game day scoring'
  - 'Starting and Halftime added to updateGameSchema enum — were missing, causing TS error on referee no-show check'
metrics:
  duration: '8 min'
  completed: '2026-03-25'
  tasks: 2
  files: 6
requirements: [NOT-02, NOT-03, NOT-04]
---

# Phase 10 Plan 03: Notification Wiring Summary

**One-liner:** Wired insertNotification calls into weather engine, game PATCH handler, and schedule-change-request routes to connect Phase 7 notification infrastructure to actual trigger sources.

## Tasks Completed

| Task | Name                                                  | Commit  | Key Files                                                                          |
| ---- | ----------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| 1    | Weather alert + cancellation + admin notifications    | 72d4d38 | app/api/weather-engine/route.ts, app/api/games/[id]/route.ts, schemas/games.ts     |
| 2    | Complete NOT-03 schedule change notification coverage | 485827e | app/api/schedule-change-requests/route.ts, [id]/route.ts, [id]/reschedule/route.ts |

## What Was Built

### Task 1: Weather, Cancellation, and Admin Notifications

**NOT-02 — Weather alert notifications (app/api/weather-engine/route.ts):**

- Added `insertNotification` loop after `runWeatherEngine` call — iterates `result.alerts` array
- D-16 scope logic: `isEventWide` flag distinguishes lightning/severe_weather (event-wide) from other types; all alerts currently use `event` scope since `WeatherAlert` has no `field_id`
- All notification calls wrapped in per-alert try/catch (non-fatal — weather engine response is not blocked)

**NOT-03 gap — Direct game cancellation (app/api/games/[id]/route.ts):**

- When PATCH sets `status='Cancelled'`, fires `schedule_change` notification to both `home_team_id` and `away_team_id`
- Uses `game_date` and `scheduled_time` from updated game row for notification content

**NOT-04 D-21 — Referee no-show alert (app/api/games/[id]/route.ts):**

- When game goes `Live` or `Starting`, queries `game_referees` table for assigned refs
- If no refs found, fires `admin_alert` with title "Referee No-Show"

**NOT-04 D-22 — Registration deadline warning (app/api/games/[id]/route.ts):**

- On `status='Scheduled'` transitions, fetches event's `registration_closes_at`
- Guards with optional chain (`evt?.registration_closes_at`) — field is optional in types
- Only fires if closes within 48 hours AND `team_registrations` with `status='pending'` exist

### Task 2: NOT-03 Schedule Change Notification Completeness

Verified existing coverage and filled gaps:

- **POST route:** Admin notified on new request (was already wired, added try/catch)
- **PATCH [id] — denied:** Requester notified (was already wired, added try/catch)
- **PATCH [id] — approved + cancel:** Both teams notified (was already wired, added try/catch)
- **PATCH [id] — approved + change_opponent:** Requester notified (was already wired, added try/catch)
- **PATCH [id] — approved + reschedule:** NEW — added notification "Schedule Change Request Approved" to requester team
- **POST reschedule sub-route:** Both teams notified on actual game move (was already wired, added inner try/catch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing status values in updateGameSchema enum**

- **Found during:** Task 1 — TypeScript error TS2367: comparison between `result.data.status` (schema-inferred type) and `'Starting'` had no overlap
- **Issue:** `updateGameSchema` only listed `['Scheduled', 'Live', 'Final', 'Delayed', 'Suspended', 'Cancelled']` — missing `'Starting'` and `'Halftime'` which are valid `GameStatus` values
- **Fix:** Added `'Starting'` and `'Halftime'` to the status enum in `schemas/games.ts`
- **Files modified:** schemas/games.ts
- **Commit:** 72d4d38

## Test Results

All 6 Wave 0 test stubs (from 10-00) are now green:

- `__tests__/app/api/weather-engine-notifications.test.ts` — 3 tests passed
- `__tests__/app/api/games-status-notifications.test.ts` — 2 tests passed
- `__tests__/app/api/schedule-change-notifications.test.ts` — 1 test passed

TypeScript: `npx tsc --noEmit` passes with no errors.
ESLint: `npm run lint` passes with warnings only (all pre-existing, not from this plan).

## Known Stubs

None — all notification paths are wired to the live `insertNotification` function which inserts to `notification_queue`. The Phase 7 Edge Function and delivery channels (email + push) are already in production.

## Self-Check: PASSED

Files exist:

- app/api/weather-engine/route.ts — FOUND
- app/api/games/[id]/route.ts — FOUND
- app/api/schedule-change-requests/[id]/route.ts — FOUND

Commits exist:

- 72d4d38 — FOUND
- 485827e — FOUND
