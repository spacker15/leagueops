---
phase: 04-rls-database-security
plan: 01
subsystem: database
tags: [postgres, rls, row-level-security, supabase, security, multi-tenant]

requires: []

provides:
  - "supabase/rls_migration.sql: complete RLS migration with user_event_ids() function, 51 DROP statements, and 206 CREATE POLICY statements covering 48 application tables"
  - "user_event_ids() SECURITY DEFINER function that returns event IDs for the authenticated user"
  - "Per-operation authenticated SELECT/INSERT/UPDATE/DELETE policies for all event-scoped tables"
  - "Anon SELECT policies for 6 public tables (events, event_dates, fields, teams, games, registration_divisions)"
  - "Commented ROLLBACK block to restore permissive policies if needed"

affects:
  - 04-02-PLAN (branch deployment and smoke testing)
  - All application tables — app queries will fail without active user_roles rows after deployment

tech-stack:
  added: []
  patterns:
    - "user_event_ids() SECURITY DEFINER pattern: central helper function reads user_roles, used in all event-scoped USING clauses"
    - "Per-operation policy naming: auth_select_{table}, auth_insert_{table}, auth_update_{table}, auth_delete_{table}, anon_select_{table}"
    - "EXISTS join pattern for indirect event scoping (ref_assignments -> games, referee_availability -> referees, registration_answers -> team_registrations)"
    - "DROP POLICY IF EXISTS before CREATE POLICY for idempotent migrations"

key-files:
  created:
    - supabase/rls_migration.sql
  modified: []

key-decisions:
  - "division_timing table (from division_timing.sql) added to migration — not in RESEARCH.md inventory but found in file scan with Allow all on division_timing policy"
  - "sports table (event_setup.sql) excluded — reference lookup table with no event_id and no sensitive data; RLS not needed"
  - "payments tables (registration_fees, team_payments, payment_entries) excluded — already have proper service_role policies from payments.sql"
  - "players uses direct event_id scoping (added by player_eligibility.sql) — not the indirect teams join originally listed"
  - "field_blocks uses direct event_id scoping (added by phase4_migration.sql) — not the indirect fields join originally listed"
  - "Rollback block included as commented SQL — restores exact original policy names per D-07"

patterns-established:
  - "user_event_ids() is the single source of truth for event access — call it in every USING/WITH CHECK clause"
  - "INSERT policies use only WITH CHECK; UPDATE uses both USING and WITH CHECK; DELETE uses only USING"
  - "Sensitive tables (ops_log, ops_alerts) get zero anon policies — Postgres deny-by-default returns empty rows"

requirements-completed:
  - SEC-01

duration: 12min
completed: 2026-03-23
---

# Phase 4 Plan 01: RLS Migration SQL Summary

**user_event_ids() SECURITY DEFINER function plus 206 per-operation RLS policies replacing all permissive Allow-all policies across 48 Supabase tables**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-23T14:09:05Z
- **Completed:** 2026-03-23T14:21:00Z
- **Tasks:** 2 (written as one atomic file)
- **Files modified:** 1

## Accomplishments

- Created `supabase/rls_migration.sql` with complete RLS migration ready for branch deployment
- `user_event_ids()` SECURITY DEFINER function with STABLE, SET search_path = public, reading user_roles with is_active and event_id IS NOT NULL filters
- 51 DROP POLICY IF EXISTS statements covering all permissive policies including non-standard names (schedule_rules_all, weekly_overrides_all, Allow all on field_divisions, etc.)
- 206 CREATE POLICY statements: 50 auth SELECT + 50 auth INSERT + 50 auth UPDATE + 50 auth DELETE + 6 anon SELECT
- EXISTS join pattern for 5 indirectly-scoped tables (ref_assignments, vol_assignments, player_checkins, referee_availability, registration_answers)
- Commented ROLLBACK block restoring original policy names for every table

## Task Commits

1. **Task 1 + Task 2: Create complete rls_migration.sql** - `d4a2053` (feat) — Both tasks written atomically to the same file

## Files Created/Modified

- `supabase/rls_migration.sql` — Complete RLS migration: user_event_ids() function, DROP statements for all 48 permissive policies, per-operation authenticated policies for all tables, anon SELECT for 6 public tables, commented rollback block

## Decisions Made

- `division_timing` table discovered during file scan (not in RESEARCH.md table inventory) — included with `"Allow all on division_timing"` DROP and 4 auth policies using direct event_id scoping
- `sports` table (event_setup.sql) excluded — no event_id, no sensitive data, just a reference list
- `payments` tables excluded — already have proper `auth read` and `service all` policies from payments.sql, no "Allow all" to replace
- Both tasks written as one atomic SQL file since they produce a single artifact; committed together

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added division_timing table to migration**
- **Found during:** Task 1 (reading all SQL files for exact policy names)
- **Issue:** `division_timing` table (from division_timing.sql) has `"Allow all on division_timing"` policy but was not listed in RESEARCH.md's table inventory
- **Fix:** Added DROP POLICY for `"Allow all on division_timing"` and 4 auth policies (SELECT/INSERT/UPDATE/DELETE) using direct event_id scoping
- **Files modified:** supabase/rls_migration.sql
- **Verification:** grep confirms "division_timing" present in DROP and all 4 CREATE POLICY statements
- **Committed in:** d4a2053

---

**Total deviations:** 1 auto-fixed (missing table — Rule 2)
**Impact on plan:** Necessary for completeness — division_timing would have retained its permissive policy without this fix. No scope creep.

## Issues Encountered

None — all SQL files read cleanly, exact policy names extracted, no blocking issues.

## User Setup Required

None — this plan creates the SQL file only. Deployment to Supabase branch is Plan 02.

## Next Phase Readiness

- `supabase/rls_migration.sql` is ready for Plan 02 branch deployment
- Plan 02 will: create a Supabase branch, apply rls_migration.sql, run smoke tests (multi-user isolation check, anon select on sensitive tables, anon select on public tables)
- Key risk: players and field_blocks use direct event_id scoping — smoke tests should verify these are working (player_eligibility.sql adds event_id to players; phase4_migration.sql adds and backfills event_id on field_blocks for existing rows)

---
*Phase: 04-rls-database-security*
*Completed: 2026-03-23*
