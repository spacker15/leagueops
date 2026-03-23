---
phase: 04-rls-database-security
verified: 2026-03-23T15:00:00Z
status: gaps_found
score: 9/11 must-haves verified
re_verification: false
gaps:
  - truth: "RLS migration is deployed to a Supabase branch for testing"
    status: failed
    reason: "No Supabase credentials were available during plan execution. Branch creation and apply_migration were skipped. The SQL files are complete but not applied anywhere. No smoke test results exist."
    artifacts:
      - path: "supabase/rls_migration.sql"
        issue: "File is complete and correct SQL — but not yet deployed to any Supabase environment (branch or production)"
    missing:
      - "Manual deployment: paste supabase/rls_migration.sql into Supabase Dashboard SQL Editor at https://supabase.com/dashboard/project/rzzzwrqbubptnlwfesjv/sql and run"
      - "After applying, run the 4 smoke test queries documented in 04-02-SUMMARY.md"
  - truth: "Smoke test queries confirm event isolation between users"
    status: failed
    reason: "Smoke tests were not run — deployment gate (no credentials) blocked Task 2 of Plan 02. No pg_policies query results exist to confirm correctness at the DB level."
    artifacts: []
    missing:
      - "Run Smoke Test 1: SELECT routine_name FROM information_schema.routines WHERE routine_name = 'user_event_ids' — expect 1 row"
      - "Run Smoke Test 2: SELECT policyname FROM pg_policies WHERE policyname LIKE '%Allow all%' — expect 0 rows"
      - "Run Smoke Test 3: SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename — expect all tables present"
      - "Run Smoke Test 4: SELECT tablename, policyname FROM pg_policies WHERE roles::text LIKE '%anon%' AND schemaname = 'public' — expect only 6 public tables"
human_verification:
  - test: "Apply supabase/rls_migration.sql to Supabase Dashboard SQL Editor"
    expected: "No SQL errors on execution"
    why_human: "Requires Supabase credentials and a live DB connection — cannot be done programmatically in this environment"
  - test: "Run all 4 smoke test queries after deployment and verify expected row counts"
    expected: "1 row for user_event_ids function, 0 rows for Allow-all policies, all 48 tables have at least 1 policy, only 6 tables in anon policy results"
    why_human: "Requires live Supabase connection with pg_policies access"
---

# Phase 4: RLS & Database Security Verification Report

**Phase Goal:** Deploy the `user_event_ids()` helper function and replace all "Allow all" RLS policies with proper event-scoped row-level security, tested against a Supabase branch before production.
**Verified:** 2026-03-23T15:00:00Z
**Status:** gaps_found — SQL artifacts complete and correct; deployment and smoke tests not yet executed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `user_event_ids()` SECURITY DEFINER function exists and returns event IDs for authenticated users | VERIFIED | `CREATE OR REPLACE FUNCTION user_event_ids()` at line 26 with `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, reads `user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND event_id IS NOT NULL` |
| 2 | All ~47 Allow-all policies are dropped from every table | VERIFIED | 50 `DROP POLICY IF EXISTS` statements covering all source SQL files including non-standard names (schedule_rules_all, weekly_overrides_all, Allow all on division_timing, etc.); user_roles NOT touched |
| 3 | Every event-scoped table has authenticated SELECT/INSERT/UPDATE/DELETE policies using user_event_ids() | VERIFIED | 200 auth_* policies: 50 SELECT + 50 INSERT + 50 UPDATE + 50 DELETE; all use `event_id IN (SELECT user_event_ids())` or `id IN (SELECT user_event_ids())` for events table |
| 4 | Indirectly scoped tables use EXISTS join pattern | VERIFIED | ref_assignments, vol_assignments, player_checkins join through games; referee_availability joins through referees; registration_answers joins through team_registrations — all 5 confirmed at lines 377-429 |
| 5 | user_roles table policies are NOT touched | VERIFIED | grep for `DROP POLICY.*user_roles` and `CREATE POLICY.*user_roles` returns no matches; user_roles appears only in function body (`FROM user_roles`) and header comments |
| 6 | Anonymous users can SELECT from public tables (events, games, teams, fields, event_dates, registration_divisions) | VERIFIED | Exactly 6 `CREATE POLICY "anon_select_*"` statements covering the 6 correct tables, all `FOR SELECT TO anon USING (true)` |
| 7 | Anonymous users get zero rows from sensitive tables (ops_alerts, ops_log, user_roles) | VERIFIED | No anon_select policy for ops_alerts, ops_log, or user_roles — RLS default-deny applies; confirmed via grep returning no matches |
| 8 | A rollback script exists that restores Allow all policies for emergency revert | VERIFIED | `supabase/rls_rollback.sql` exists (413 lines); contains Step 1 (DROP all auth_* and anon_* policies), Step 2 (`DROP FUNCTION IF EXISTS user_event_ids()`), Step 3 (recreate exact original policy names including non-standard names) |
| 9 | programs UPDATE uses program_leaders scope check | VERIFIED | `auth_update_programs` uses `EXISTS (SELECT 1 FROM program_leaders pl WHERE pl.program_id = programs.id AND pl.user_id = auth.uid())` at lines 1243-1252 |
| 10 | RLS migration is deployed to a Supabase branch for testing | FAILED | No Supabase credentials available during execution; `create_branch` and `apply_migration` were not called; SQL files are ready but not applied |
| 11 | Smoke test queries confirm event isolation between users | FAILED | Deployment gate blocked all smoke tests; no pg_policies query results exist |

**Score:** 9/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/rls_migration.sql` | Complete RLS migration with helper function, policy drops, and authenticated + anon policies | VERIFIED | 1,647 lines; 50 DROP statements; 200 auth_* CREATE POLICY; 6 anon_select CREATE POLICY; commented rollback block |
| `supabase/rls_rollback.sql` | Emergency rollback to Allow all policies | VERIFIED | 413 lines; 3-step structure; DROP all new policies, DROP FUNCTION, restore exact original permissive policy names |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `supabase/rls_migration.sql` | `user_roles` table | `FROM user_roles WHERE user_id = auth.uid()` | VERIFIED | Pattern found at line 34-37 with is_active and event_id IS NOT NULL filters |
| `supabase/rls_migration.sql` | Supabase branch | `apply_migration` MCP tool | NOT WIRED | No MCP credentials available; deployment was not performed |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces SQL migration files only, with no runtime frontend or API routes. There is no application data flow to trace.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| rls_migration.sql has 50+ DROP statements | `grep -c "DROP POLICY IF EXISTS" rls_migration.sql` (live block) | 50 | PASS |
| rls_migration.sql has 200+ CREATE POLICY (auth_*) | `head -1333 ... grep -c "^CREATE POLICY"` | 206 total (200 auth + 6 anon) | PASS |
| Exactly 6 anon_select policies | `grep "^CREATE POLICY.*anon_select"` | 6 policies on correct tables | PASS |
| No anon policy on sensitive tables | `grep "anon.*ops_alerts\|anon.*ops_log\|anon.*user_roles"` | 0 matches | PASS |
| user_roles not targeted by DROP or CREATE POLICY | `grep "DROP POLICY.*user_roles\|CREATE POLICY.*user_roles"` | 0 matches | PASS |
| SECURITY DEFINER present exactly once (live) | `grep "SECURITY DEFINER" rls_migration.sql` | 2 matches (1 comment, 1 keyword) | PASS |
| GRANT EXECUTE present | `grep "GRANT EXECUTE"` | 1 match: `TO authenticated, anon` | PASS |
| No active Allow all CREATE POLICY in migration body | `head -1333 ... grep "CREATE POLICY.*Allow all"` | 0 matches | PASS |
| rls_rollback.sql exists | file system check | 413 lines | PASS |
| rls_rollback.sql has DROP FUNCTION | `grep "DROP FUNCTION"` | `DROP FUNCTION IF EXISTS user_event_ids()` at line 326 | PASS |
| Smoke tests executed | deployment check | Not run — no credentials | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | 04-01-PLAN.md, 04-02-PLAN.md | All core database tables have proper RLS policies replacing "Allow all" — scoped by event_id via `user_event_ids()` helper function | PARTIAL | SQL artifacts are complete and correct. user_event_ids() function defined, 50 DROP statements, 206 CREATE POLICY statements covering 48 tables. Requirement is NOT yet fully satisfied because the migration has not been applied to the database — it exists only as a file on disk. Full satisfaction requires deployment. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No placeholder comments, empty implementations, or stub patterns detected. The SQL is substantive with real policy logic throughout.

### Human Verification Required

#### 1. Deploy Migration to Supabase

**Test:** Go to https://supabase.com/dashboard/project/rzzzwrqbubptnlwfesjv/sql, paste the full contents of `supabase/rls_migration.sql`, and execute.
**Expected:** No SQL errors. All statements succeed.
**Why human:** Requires Supabase credentials and live DB connection not available in the automated execution environment.

#### 2. Smoke Test 1 — Function Exists

**Test:** Run `SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_name = 'user_event_ids';`
**Expected:** 1 row returned.
**Why human:** Requires live Supabase connection.

#### 3. Smoke Test 2 — No Allow-All Policies Remain

**Test:** Run `SELECT schemaname, tablename, policyname FROM pg_policies WHERE policyname LIKE '%Allow all%' OR policyname IN ('schedule_rules_all', 'weekly_overrides_all', 'schedule_audit_log_all') ORDER BY tablename;`
**Expected:** 0 rows returned (all permissive policies replaced).
**Why human:** Requires live Supabase connection.

#### 4. Smoke Test 3 — All Tables Have Policies

**Test:** Run `SELECT tablename, COUNT(*) as policy_count FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename;`
**Expected:** All 48 application tables appear with at least 1 policy each.
**Why human:** Requires live Supabase connection.

#### 5. Smoke Test 4 — Anon Access Limited to Public Tables

**Test:** Run `SELECT tablename, policyname FROM pg_policies WHERE roles::text LIKE '%anon%' AND schemaname = 'public' ORDER BY tablename;`
**Expected:** Only 6 rows: events, event_dates, fields, teams, games, registration_divisions.
**Why human:** Requires live Supabase connection.

### Gaps Summary

The SQL artifacts are complete, correct, and ready for deployment. Both files (`supabase/rls_migration.sql` and `supabase/rls_rollback.sql`) pass all automated content checks:

- `user_event_ids()` function: correctly defined with SECURITY DEFINER, STABLE, SET search_path, reads user_roles with is_active and event_id filters, grants execute to authenticated and anon
- 50 DROP POLICY IF EXISTS statements covering all 48 tables and all non-standard policy names
- 206 CREATE POLICY statements: 200 auth_* (50 per operation) + 6 anon_select
- All 5 indirectly-scoped tables use the EXISTS join pattern
- programs UPDATE scoped to program_leaders; user_roles never touched
- Rollback script is complete with exact original policy names

The two failed truths share a single root cause: the deployment step (Plan 02 Task 2) was skipped because no Supabase credentials were available in the execution environment. This is a deployment gate, not a code gap. The SQL cannot be verified at the database level until it is applied.

**Action required:** Apply `supabase/rls_migration.sql` via the Supabase Dashboard SQL Editor, then run the 4 smoke test queries to close the gaps. If any smoke test fails, apply `supabase/rls_rollback.sql` immediately.

---

_Verified: 2026-03-23T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
