---
phase: 10-responsive-design-notification-wiring
plan: '00'
subsystem: testing
tags: [vitest, notifications, tdd, wave-0, not-02, not-03, not-04]

# Dependency graph
requires:
  - phase: 07-notification-infrastructure
    provides: insertNotification function in lib/notifications.ts, notification_queue DB table, AlertType and NotificationScope types
provides:
  - Failing test stubs for NOT-02 weather alert notification wiring (weather-engine route)
  - Failing test stubs for NOT-03 direct game cancellation notification gap (games PATCH route)
  - Failing test stubs for NOT-04 admin alerts for referee no-show and registration deadline (games PATCH route)
affects: [10-03-notification-wiring-implementation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'vi.resetModules() + vi.doMock() per test for isolated dynamic imports of route handlers'
    - "Red-phase TDD stubs: tests assert insertNotification was called but route doesn't call it yet"

key-files:
  created:
    - __tests__/app/api/weather-engine-notifications.test.ts
    - __tests__/app/api/games-status-notifications.test.ts
    - __tests__/app/api/schedule-change-notifications.test.ts
  modified: []

key-decisions:
  - 'vi.resetModules() used per test (not beforeEach) to allow vi.doMock() to take effect for dynamic route imports'
  - 'weather-engine route mocks @/supabase/server (no lib/ prefix); games route mocks @/lib/supabase/server — paths differ per existing route implementations'
  - 'One test passes (does not throw) confirming non-fatal notification requirement; 5 tests fail confirming insertNotification not yet wired'

patterns-established:
  - 'Wave 0 test stubs: use vi.resetModules()+vi.doMock() inside each it() for fresh module state with dynamic imports'

requirements-completed: [NOT-02, NOT-03, NOT-04]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 10 Plan 00: Notification Wiring Test Stubs Summary

**Wave 0 TDD red-phase stubs for all three notification wiring tasks (NOT-02, NOT-03, NOT-04) — 6 tests across 3 files asserting insertNotification call contracts that Plan 10-03 will fulfill.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T12:56:11Z
- **Completed:** 2026-03-25T12:58:32Z
- **Tasks:** 1 completed
- **Files modified:** 3 created

## Accomplishments

- Created `weather-engine-notifications.test.ts` (NOT-02): 3 tests assert insertNotification called per alert with event scope for lightning
- Created `games-status-notifications.test.ts` (NOT-04): 2 tests assert admin_alert fired for referee no-show and registration deadline proximity
- Created `schedule-change-notifications.test.ts` (NOT-03 gap): 1 test asserts schedule_change fired to both teams on direct game cancellation
- All 5 behavior-asserting tests fail (red) correctly; 1 non-fatal error resilience test passes as expected

## Task Commits

1. **Task 1: Create test stubs for NOT-02, NOT-03, NOT-04 notification wiring** - `d3af4fe` (test)

**Plan metadata:** [pending — created in final commit step]

## Files Created/Modified

- `__tests__/app/api/weather-engine-notifications.test.ts` — NOT-02 stubs: insertNotification called per weather alert, event scope for lightning, non-fatal on DB error
- `__tests__/app/api/games-status-notifications.test.ts` — NOT-04 stubs: admin_alert for referee no-show (Live status with no game_referees), registration deadline warning within 48h
- `__tests__/app/api/schedule-change-notifications.test.ts` — NOT-03 gap stubs: schedule_change to both home_team_id and away_team_id on Cancelled status

## Test Results (Red State)

```
Test Files  3 failed (3)
Tests       5 failed | 1 passed (6)
```

- 5 failing: assert insertNotification called with correct args (not yet wired in route handlers)
- 1 passing: `does not throw when insertNotification fails` — 200 response maintained (will remain green after Plan 10-03 wraps calls in try/catch)

## Key Implementation Notes for Plan 10-03

**Weather engine route** (`app/api/weather-engine/route.ts`):

- After `runWeatherEngine()` returns results, iterate `result.alerts`
- Call `insertNotification(eventId, 'weather_alert', scope, scopeId, payload)` per alert
- Lightning/severe alerts → scope: `'event'`, scopeId: `null`
- Heat/wind field-specific alerts → scope: `'field'`, scopeId: `fieldId`
- Wrap in try/catch — notification failures must not affect 200 response

**Games PATCH route** (`app/api/games/[id]/route.ts`):

- After successful game update, check updated game status
- If status === `'Live'`: query `game_referees` table — if empty, fire admin_alert
- Check event's `registration_closes_at`: if within 48h and open registrations exist, fire admin_alert
- If status === `'Cancelled'`: fire schedule_change to both `home_team_id` and `away_team_id`

## Deviations from Plan

None — plan executed exactly as written. Note: `vi.resetModules()` was placed inside each `it()` block (not `beforeEach`) because vi.doMock() must be called after resetModules() but before the dynamic import, requiring per-test isolation rather than shared setup.

## Self-Check: PASSED

- `__tests__/app/api/weather-engine-notifications.test.ts` — FOUND
- `__tests__/app/api/games-status-notifications.test.ts` — FOUND
- `__tests__/app/api/schedule-change-notifications.test.ts` — FOUND
- Commit `d3af4fe` — FOUND (test(10-00): add failing test stubs)
