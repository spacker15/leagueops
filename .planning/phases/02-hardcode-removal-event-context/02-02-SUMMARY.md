---
phase: 02-hardcode-removal-event-context
plan: '02'
subsystem: api-routes
tags: [hardcode-removal, event-id, security, rules-cache]
dependency_graph:
  requires: [02-01]
  provides: [SEC-04-api-routes]
  affects: [all-api-consumers, rules-engine-cache]
tech_stack:
  added: []
  patterns: [required-param-validation, cache-invalidation-on-mutation]
key_files:
  created: []
  modified:
    - app/api/field-engine/route.ts
    - app/api/rules/route.ts
    - app/api/rules/changes/route.ts
    - app/api/lightning/route.ts
    - app/api/admin/create-user/route.ts
    - app/api/conflicts/route.ts
    - app/api/eligibility/route.ts
    - app/api/fields/route.ts
    - app/api/incidents/route.ts
    - app/api/medical/route.ts
    - app/api/ops-log/route.ts
    - app/api/referees/route.ts
    - app/api/registration-fees/route.ts
    - app/api/team-payments/route.ts
    - app/api/teams/route.ts
    - app/api/volunteers/route.ts
    - app/api/weather/route.ts
decisions:
  - "Engine routes (referee, weather, unified) were already updated in Plan 01 -- only field-engine GET needed the ?? '1' fix"
  - 'eligibility GET guards are path-scoped: allPending path requires event_id, gameId path does not'
  - 'invalidateRulesCache called in 3 locations: PATCH (update), POST reset_one, POST reset_all'
  - 'admin/create-user: event_id is now required -- callers must pass event_id explicitly; no default to event 1'
metrics:
  duration: '3 min'
  completed_date: '2026-03-22'
  tasks_completed: 2
  files_modified: 17
requirements_addressed: [SEC-04]
---

# Phase 02 Plan 02: API Route Hardcode Removal Summary

All `?? '1'` and `?? 1` event_id fallbacks eliminated from 17 API route files; rules cache now evicted on every PATCH/POST mutation; `invalidateRulesCache` wired in 3 mutation paths.

## Tasks Completed

| Task | Name                                                       | Commit  | Files                         |
| ---- | ---------------------------------------------------------- | ------- | ----------------------------- |
| 1    | Fix engine API routes (4 routes)                           | 4a3b3b6 | app/api/field-engine/route.ts |
| 2    | Fix data API routes (16 routes), wire invalidateRulesCache | 5d78d5a | 16 data route files           |

## What Was Built

### Task 1: Engine API Routes

Only `app/api/field-engine/route.ts` GET handler required changes -- the referee-engine, weather-engine, and unified-engine routes were fully updated in Plan 01 (all already had proper event_id guards and updated engine call signatures).

Fixed: `field-engine` GET handler replaced `searchParams.get('event_id') ?? '1'` with required validation returning 400.

### Task 2: Data API Routes

**Pattern A (12 GET routes with searchParams):** Replaced `searchParams.get('event_id') ?? '1'` with required guard returning 400 in:

- conflicts, fields, incidents, medical, ops-log, referees, registration-fees, team-payments, teams, volunteers, weather, rules/changes

**Pattern B (3 routes with body params and multiple locations):**

- `rules/route.ts`: GET guard added; PATCH now requires event_id and calls `invalidateRulesCache(event_id)` after update; POST `event_id = 1` default removed with required guard, `invalidateRulesCache` called after both `reset_one` and `reset_all` mutations; literal `event_id: 1` in PATCH audit log inserts replaced with the body variable
- `lightning/route.ts`: required event_id guard added; all 5 `?? 1` fallbacks removed from liftLightningDelay call, games update, lightning_events insert, weather_alerts insert, ops_log insert
- `admin/create-user/route.ts`: event_id required guard added after email/password/role check; 2 `event_id ?? 1` usages in role insert and ops_log replaced with body variable

**Review fix #4 (MEDIUM):** `invalidateRulesCache` was imported but never called -- now called in 3 mutation paths (PATCH update, POST reset_one, POST reset_all). Ensures 30-second TTL cache is evicted after admin rule edits.

**Review fix #5 (MEDIUM):** Verified previously-unchecked routes have no hardcoded event_id fallbacks:

- games/route.ts -- clean
- games/[id]/route.ts -- clean
- players/route.ts -- clean
- checkins/route.ts -- clean
- assignments/route.ts -- clean
- payment-entries/route.ts -- clean

## Deviations from Plan

### Auto-fixed Issues

None.

### Plan Adjustments

**1. Engine routes already updated**

- Found during: Task 1
- Issue: Plan 01 already updated referee-engine, weather-engine, and unified-engine POST handlers with event_id guards and updated signatures. Only field-engine GET was outstanding.
- Resolution: Only field-engine GET modified in Task 1 (1 file instead of 4)
- Impact: Same outcome, fewer changes needed

**2. eligibility GET uses scoped guards instead of single top-level guard**

- Found during: Task 2
- Issue: eligibility GET has three paths -- allPending (needs eventId), gameId (does not need eventId), default (returns []). A single top-level guard would break the gameId path.
- Resolution: Applied scoped guards -- allPending path requires event_id; gameId path passes without it; default path requires event_id to avoid empty scattershot query

## Known Stubs

None -- all routes now query with explicit event_id from caller. No stub values remain.

## Self-Check: PASSED

- app/api/field-engine/route.ts -- modified, no ?? '1' remaining
- app/api/rules/route.ts -- 3 invalidateRulesCache calls confirmed
- All 16 data routes -- zero ?? '1' or ?? 1 matches in grep
- TypeScript type-check -- exits 0
- Commits 4a3b3b6 and 5d78d5a exist in git log
