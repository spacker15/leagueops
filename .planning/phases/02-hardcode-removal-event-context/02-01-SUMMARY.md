---
phase: 02-hardcode-removal-event-context
plan: 01
subsystem: engine-layer
tags: [hardcode-removal, event-scoping, multi-event, security]
dependency_graph:
  requires: []
  provides: [eventId-parameterized-engines, per-event-rules-cache]
  affects:
    [
      lib/engines/rules.ts,
      lib/engines/referee.ts,
      lib/engines/field.ts,
      lib/engines/weather.ts,
      lib/engines/unified.ts,
    ]
tech_stack:
  added: []
  patterns: [eventId-first-param, per-event-Map-cache]
key_files:
  created: []
  modified:
    - lib/engines/rules.ts
    - lib/engines/referee.ts
    - lib/engines/field.ts
    - lib/engines/weather.ts
    - lib/engines/unified.ts
    - __tests__/lib/engines/rules.test.ts
    - __tests__/lib/engines/referee.test.ts
    - __tests__/lib/engines/field.test.ts
    - __tests__/lib/engines/weather.test.ts
    - __tests__/lib/engines/unified.test.ts
    - app/api/referee-engine/route.ts
    - app/api/field-engine/route.ts
    - app/api/weather-engine/route.ts
    - app/api/unified-engine/route.ts
    - app/api/unified-engine/resolve/route.ts
    - app/api/shift-handoff/route.ts
    - vitest.config.ts
decisions:
  - 'eventId added as required parameter (no default) to all 5 engine entry-points — enforces explicit event scoping at call sites'
  - 'updateRule/resetRule/resetAllRules also received eventId to eliminate EVENT_ID from rules.ts audit logging'
  - 'API routes updated to require event_id in request body for all engine routes — callers must supply context'
  - 'vitest.config.ts exclusion extended to .claude directory to prevent parallel worktree test contamination'
  - 'generateShiftHandoff and applyResolutionAction in unified.ts also parameterized — they wrote event_id: 1 to ops_log and shift_handoffs'
metrics:
  duration: 9 min
  completed: 2026-03-22
  tasks: 2
  files: 17
---

# Phase 02 Plan 01: Engine eventId Parameterization Summary

Parameterized all five engine entry-point functions with `eventId: number` and replaced every `const EVENT_ID = 1` / `.eq('event_id', 1)` with the dynamic parameter. Fixed the rules cache to be keyed per-event using a `Map<number, {map, time}>` instead of a global variable. All 53 engine tests pass; TypeScript compiles clean.

## Tasks Completed

| #   | Task                                                                   | Commit  | Files Changed                                                               |
| --- | ---------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| 1   | Parameterize rules.ts with eventId and fix cache                       | c79d743 | lib/engines/rules.ts, **tests**/lib/engines/rules.test.ts, vitest.config.ts |
| 2   | Parameterize referee.ts, field.ts, weather.ts, unified.ts with eventId | 6e25176 | 4 engine files, 4 test files, 6 API route files                             |

## What Was Built

Per-event engine isolation: every DB query in every engine is now scoped to the `eventId` passed at call time. The rules cache uses `Map<number, {map: Record<string, string>; time: number}>` keyed by eventId, preventing rule contamination between events. All API routes that trigger engines now require `event_id` in the request body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Extended eventId parameterization to updateRule/resetRule/resetAllRules**

- **Found during:** Task 1
- **Issue:** updateRule and resetRule still wrote `event_id: EVENT_ID` (= 1) to rule_changes and ops_log audit tables
- **Fix:** Added `eventId: number` parameter to updateRule, resetRule, resetAllRules; replaced hardcoded EVENT_ID in insert payloads
- **Files modified:** lib/engines/rules.ts, **tests**/lib/engines/rules.test.ts

**2. [Rule 2 - Missing functionality] Extended eventId to generateShiftHandoff and applyResolutionAction**

- **Found during:** Task 2 (unified.ts replacement-all pass)
- **Issue:** generateShiftHandoff wrote `event_id: 1` to shift_handoffs table; applyResolutionAction wrote `event_id: 1` to ops_log
- **Fix:** Added `eventId: number` to both function signatures and their internal inserts
- **Files modified:** lib/engines/unified.ts, app/api/shift-handoff/route.ts

**3. [Rule 3 - Blocking] Fixed vitest config to exclude .claude worktrees**

- **Found during:** Task 1 verification
- **Issue:** Vitest picked up test files from parallel agent worktrees (.claude/worktrees/agent-a8ba72ab/) which had old signatures — test failures not from our code
- **Fix:** Added `.claude` to vitest exclude list
- **Files modified:** vitest.config.ts

**4. [Rule 2 - Missing functionality] Extended eventId to all engine-calling API routes**

- **Found during:** Task 2 (TypeScript type check)
- **Issue:** referee-engine, field-engine, weather-engine, unified-engine, resolve, shift-handoff routes called engines without passing eventId — would fail at runtime
- **Fix:** Updated all 6 API routes to extract `event_id` from request body and pass to engine functions
- **Files modified:** 6 app/api/ route files

## Known Stubs

None — all eventId parameters are wired through from API request body to engine queries.

## Self-Check: PASSED

All key files exist. Both commits (c79d743, 6e25176) confirmed in git log. 53 engine tests pass. TypeScript compiles clean.
