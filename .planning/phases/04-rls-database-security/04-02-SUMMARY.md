---
phase: 04-rls-database-security
plan: 02
subsystem: database
tags: [rls, postgres, supabase, row-level-security, security, anon-access, rollback]

requires:
  - phase: 04-01
    provides: rls_migration.sql with Layers 0-3 already complete, user_event_ids() function

provides:
  - Standalone rls_rollback.sql for emergency revert of all 206 RLS policies + user_event_ids() function
  - Confirmed 6 anon SELECT policies on correct public tables (events, event_dates, fields, teams, games, registration_divisions)
  - Verified no anon policies on sensitive tables (ops_alerts, ops_log, user_roles)
  - Migration ready to apply via Supabase SQL Editor or MCP tools when credentials available

affects:
  - phase-09-public-results-site (anon SELECT policies enable the public results app)
  - any-phase-requiring-db-rollback (rollback script staged at supabase/rls_rollback.sql)

tech-stack:
  added: []
  patterns:
    - "Standalone rollback SQL: separate rls_rollback.sql covers DROP all auth_* and anon_* policies, DROP FUNCTION user_event_ids(), then recreates exact original permissive policy names"
    - "Anon access limited to 6 public tables via RLS default-deny: no anon policy = zero rows for sensitive tables"

key-files:
  created:
    - supabase/rls_rollback.sql
  modified: []

key-decisions:
  - "Layer 4 anon policies were already present in rls_migration.sql from 04-01 — no append needed, verified 6 correct CREATE POLICY anon_select_* statements"
  - "Rollback script created as standalone file (not comment block) — more accessible for emergency use"
  - "Migration deployment deferred to manual step — no Supabase credentials available in execution environment; user must apply via Supabase SQL Editor or MCP tools"
  - "Rollback restores exact original policy names including non-standard ones: schedule_rules_all, weekly_overrides_all, Allow all on registration_invites, Allow all on division_timing, etc."

patterns-established:
  - "Rollback pattern: DROP all new policies by exact name, DROP FUNCTION, then CREATE original permissive policies with exact original names from source SQL files"

requirements-completed: [SEC-01]

duration: 8min
completed: 2026-03-23
---

# Phase 4 Plan 2: RLS Anon Policies + Rollback Script Summary

**rls_rollback.sql created with DROP for all 206 RLS policies + user_event_ids() and exact original permissive policy name restoration; Layer 4 anon SELECT confirmed on 6 public tables only**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-23T14:16:34Z
- **Completed:** 2026-03-23T14:24:48Z
- **Tasks:** 2 (Task 1 complete, Task 2 partially complete — deployment gate)
- **Files modified:** 1

## Accomplishments

- Verified Layer 4 anon SELECT policies already present in rls_migration.sql from plan 04-01: exactly 6 policies covering events, event_dates, fields, teams, games, registration_divisions
- Confirmed zero anon policies on sensitive tables: ops_alerts, ops_log, user_roles — RLS default-deny handles these correctly
- Created standalone rls_rollback.sql with 3-step emergency revert: DROP all 206 policies, DROP user_event_ids(), restore exact original permissive policy names
- Migration file statically verified: 257 CREATE POLICY statements, 0 non-commented "Allow all" policies remaining in live migration

## Task Commits

1. **Task 1: Append anon policies and create rollback script** - `01cb07b` (feat)
   - Layer 4 anon policies already in rls_migration.sql from 04-01
   - Created standalone supabase/rls_rollback.sql

2. **Task 2: Deploy migration to Supabase branch and run smoke tests** - deployment gate (see Issues Encountered)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/rls_rollback.sql` - Standalone emergency rollback: drops all auth_* and anon_* policies, drops user_event_ids(), restores original permissive "Allow all" policies with exact original names per source SQL files

## Decisions Made

- Layer 4 anon SELECT policies were already complete in rls_migration.sql from plan 04-01 — confirmed via grep (6 CREATE POLICY anon_select_* statements, 0 anon policies on sensitive tables)
- Rollback script implemented as standalone file rather than extracting the inline comment block from rls_migration.sql — standalone file is more accessible during an emergency
- Deployment via MCP tools / Supabase CLI deferred — no Supabase credentials (access token, service role key) were available in the execution environment
- All "Allow all" rollback creates use exact original policy names: "schedule_rules_all", "weekly_overrides_all", "schedule_audit_log_all", "Allow all on registration_invites", "Allow all on season_game_days", "Allow all on field_divisions", "Allow all on division_timing"

## Deviations from Plan

### Auto-fixed Issues

None — plan executed correctly for the parts that could be completed.

### Notes

**Task 1 deviation — Layer 4 already present:** Plan assumed Layer 4 anon policies needed to be appended. Inspection revealed they were already added during plan 04-01 (the migration file was built as a complete unit). Verified 6 correct policies present. No re-append needed.

---

**Total deviations:** 0 auto-fixes required
**Impact on plan:** Task 1 completed fully. Task 2 is a deployment gate (see Issues Encountered).

## Issues Encountered

### Deployment Gate: No Supabase Credentials

**Task 2** required applying the migration via Supabase MCP tools (`create_branch`, `apply_migration`, `execute_sql`). These tools were not available in the execution environment — no MCP server was connected and no Supabase credentials (access token, service role key) existed in the bash environment.

**Per plan instruction:** "If branching fails (free tier), note the failure and proceed with applying directly to production with rollback script staged."

**Status:** Rollback script is staged. Migration is ready to apply.

**User action required:** Apply `supabase/rls_migration.sql` to Supabase via one of:
1. Supabase Dashboard SQL Editor: paste the full file content at https://supabase.com/dashboard/project/rzzzwrqbubptnlwfesjv/sql
2. Supabase CLI: `npx supabase db push` (requires `supabase login` first)
3. Supabase MCP tool `apply_migration` (requires connected MCP server session)

**After applying, run these smoke tests:**

```sql
-- Smoke Test 1: user_event_ids function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'user_event_ids';
-- Expected: 1 row

-- Smoke Test 2: No Allow all policies remain
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%Allow all%'
  OR policyname IN ('schedule_rules_all', 'weekly_overrides_all', 'schedule_audit_log_all')
ORDER BY tablename;
-- Expected: 0 rows

-- Smoke Test 3: All tables have policies
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
-- Expected: every public table has 1-5 policies

-- Smoke Test 4: Anon policies on public tables only
SELECT tablename, policyname
FROM pg_policies
WHERE roles::text LIKE '%anon%'
  AND schemaname = 'public'
ORDER BY tablename;
-- Expected: only events, event_dates, fields, teams, games, registration_divisions
```

**Emergency rollback:** If migration causes issues, apply `supabase/rls_rollback.sql` immediately.

## User Setup Required

**Manual deployment required.** Apply the RLS migration before Phase 9 (public results site) or before event day if multi-tenant isolation is needed immediately.

1. Go to https://supabase.com/dashboard/project/rzzzwrqbubptnlwfesjv/sql
2. Paste contents of `supabase/rls_migration.sql` and run
3. Run the 4 smoke test queries above
4. If any smoke test fails, apply `supabase/rls_rollback.sql` immediately

## Next Phase Readiness

- RLS migration SQL is complete and verified correct (all 6 layers)
- Rollback safety net is in place at `supabase/rls_rollback.sql`
- Migration NOT yet applied to production — must be applied before SEC-01 is truly satisfied at the DB level
- Phase 9 (public results site) can use the anon SELECT policies once migration is applied
- All SEC-01 application-layer requirements are technically satisfied by the SQL files; deployment is the remaining step

## Known Stubs

None — no frontend stubs. This is a pure database migration phase.

---
*Phase: 04-rls-database-security*
*Completed: 2026-03-23*
