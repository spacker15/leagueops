---
phase: 06-registration-flow-enhancements
plan: 01
subsystem: registration
tags: [schema, types, engine, coach-conflicts, tdd]
dependency_graph:
  requires: []
  provides: [phase6-schema, coach-types, coach-conflicts-engine]
  affects: [schedule-engine, registration-flow]
tech_stack:
  added: []
  patterns: [engine-pattern, tdd-red-green, mockSb-chain]
key_files:
  created:
    - supabase/phase6_registration.sql
    - lib/engines/coach-conflicts.ts
    - __tests__/lib/engines/coach-conflicts.test.ts
  modified:
    - types/index.ts
decisions:
  - "TeamRegistration interface added to types/index.ts — was missing despite table existing in schema since program_registration.sql"
  - "primary_color and logo_url added as optional fields to Event interface — required by CoachInvite.events Pick type and already referenced in Phase 5 sharing"
metrics:
  duration: 8 min
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_changed: 4
---

# Phase 6 Plan 01: Foundation — Schema Migration + Coach Conflicts Engine Summary

**One-liner:** Phase 6 database schema (4 tables, 2 ALTER TABLE), TypeScript interfaces (5 new), and coach conflict detection engine with 5 passing unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema migration + TypeScript types | 9d260e7 | supabase/phase6_registration.sql, types/index.ts |
| 2 | Coach conflicts engine with tests | 7082ad8 | lib/engines/coach-conflicts.ts, __tests__/lib/engines/coach-conflicts.test.ts |

## What Was Built

### Task 1: Schema Migration + TypeScript Types

Created `supabase/phase6_registration.sql` with all Phase 6 schema changes in a single file:
- `coaches` table — individual coach records (no auth account required), indexed on email
- `coach_teams` table — links coaches to team_registrations within an event, with role and added_by tracking
- `coach_invites` table — program-scoped invite tokens for coach self-registration, scoped per program+event
- `coach_conflicts` table — materialized conflict flags for coaches on multiple teams
- `ALTER TABLE team_registrations` — adds `available_date_ids JSONB` column for REG-02
- `ALTER TABLE events` — adds `registration_opens_at`, `registration_closes_at`, `registration_open` columns for REG-01

Added TypeScript interfaces to `types/index.ts`:
- `TeamRegistration` — DB row type matching the existing table (was missing)
- `Coach` — coach record with optional phone and certifications
- `CoachTeam` — link table with role/added_by unions, joined coach and team_registration
- `CoachInvite` — invite token with joined programs and events
- `CoachConflict` — materialized conflict record with joined coach
- Extended `Event` with `registration_opens_at?`, `registration_closes_at?`, `registration_open?`, `primary_color?`, `logo_url?`

### Task 2: Coach Conflicts Engine with Tests

Created `lib/engines/coach-conflicts.ts`:
- `detectCoachConflicts(eventId, sb)` — queries coach_teams grouped by coach_id, returns all coaches with >1 team as conflicts with their team_ids, team_names, and all conflicting [minId, maxId] pairs
- `getConflictingTeamPairs(eventId, sb)` — wraps detectCoachConflicts, returns `Set<string>` of `"minId-maxId"` strings for direct use in schedule engine slot assignment loop

Created `__tests__/lib/engines/coach-conflicts.test.ts` with 5 passing tests:
- Test 1: Clean result when no coaches share teams
- Test 2: Conflict detected when coach on 2+ teams, correct team_ids array
- Test 3: getConflictingTeamPairs returns Set with "minId-maxId" ordering
- Test 4: Empty coach_teams handled gracefully
- Test 5: Multiple coaches each on multiple teams returns all distinct conflicts (3+1=4 pairs)

## Verification

- `grep "CREATE TABLE" supabase/phase6_registration.sql` → 4 tables found
- `grep "export interface Coach" types/index.ts` → 4 matches (Coach, CoachTeam, CoachInvite, CoachConflict)
- `npx vitest run __tests__/lib/engines/coach-conflicts.test.ts` → 5/5 passed
- `npm run type-check` → 0 errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added TeamRegistration interface to types/index.ts**
- **Found during:** Task 1
- **Issue:** CoachTeam interface references `TeamRegistration` in its joined relation. The table exists in supabase/program_registration.sql but no corresponding TypeScript interface was in types/index.ts
- **Fix:** Added `TeamRegistration` interface matching the table schema before the Phase 6 interfaces
- **Files modified:** types/index.ts
- **Commit:** 9d260e7

**2. [Rule 2 - Missing] Added primary_color and logo_url to Event interface**
- **Found during:** Task 1
- **Issue:** `CoachInvite.events` uses `Pick<Event, 'name' | 'primary_color' | 'logo_url' | 'registration_closes_at' | 'registration_open'>` — primary_color and logo_url were missing from the Event interface
- **Fix:** Added `primary_color?: string | null` and `logo_url?: string | null` as optional fields on the Event interface
- **Files modified:** types/index.ts
- **Commit:** 9d260e7

## Known Stubs

None — all interfaces and engine functions are fully implemented and wired.

## Self-Check: PASSED

- supabase/phase6_registration.sql: FOUND
- lib/engines/coach-conflicts.ts: FOUND
- __tests__/lib/engines/coach-conflicts.test.ts: FOUND
- types/index.ts updated: FOUND (export interface Coach confirmed)
- Commit 9d260e7: FOUND
- Commit 7082ad8: FOUND
