# Phase 4: RLS & Database Security - Research

**Researched:** 2026-03-23
**Domain:** Supabase Row Level Security — PostgreSQL SECURITY DEFINER functions, per-operation policies, event-scoped multi-tenant access control
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Per-operation policies — separate SELECT, INSERT, UPDATE, DELETE policies per table. Allows anon SELECT-only while authenticated users get full CRUD.
**D-02:** Sensitive tables (`ops_alerts`, `ops_log`, `user_roles`) have zero anon policies. Anonymous queries return empty results. No exceptions.
**D-03:** Direct `user_roles` table lookup: `SELECT DISTINCT event_id FROM user_roles WHERE user_id = auth.uid()`. Simple, matches existing multi-role system.
**D-04:** `SECURITY DEFINER` function — runs with elevated privileges to access `user_roles` regardless of caller's RLS context.
**D-05:** Empty set = no access. If a user has no rows in `user_roles`, the function returns an empty array and all event-scoped queries return zero rows. Fail-closed.
**D-06:** Supabase branch + layered apply. Create a branch via MCP tools. Apply RLS in layers: 1) `user_event_ids()` function, 2) authenticated read policies, 3) write policies, 4) anon policies. Smoke test each layer on the branch before promoting to production.
**D-07:** Rollback plan: revert to "Allow all" policies. Keep DROP + CREATE statements ready. Safe since Phase 3 auth guards already protect API routes at the application layer.
**D-08:** Public tables for anon SELECT: `events`, `games`, `teams`, `fields`, `divisions`. Enough for Phase 9 public results site. No player PII, no ops data, no user roles exposed.
**D-09:** Open SELECT on public tables — anon can see all rows across all events. No event scoping for anon. Public results site needs to browse events, and these tables contain no sensitive data.

### Claude's Discretion

- Exact SQL syntax for policies and helper function
- Order of table lockdown within each layer
- Which additional tables from later migrations need RLS (beyond the 15 in schema.sql)
- Supabase branch naming convention
- Smoke test query design

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | All core database tables have proper RLS policies replacing "Allow all" — scoped by event_id via `user_event_ids()` helper function | Full table inventory (47 tables across all migrations), helper function design (D-03/D-04/D-05), layered migration strategy (D-06), rollback plan (D-07) |
</phase_requirements>

---

## Summary

This phase replaces all permissive "Allow all" RLS policies across the entire LeagueOps database with proper event-scoped policies. The database has grown to approximately 47 tables spread across schema.sql and 15+ migration files — the schema.sql's 15 tables are just the starting point. Every migration file adds at least one table with an "Allow all" policy.

The core mechanism is a `user_event_ids()` SECURITY DEFINER function that reads directly from `user_roles` and returns the set of event IDs accessible to the current authenticated user. This function is then referenced in USING clauses of authenticated-user policies. Anonymous access is granted only to genuinely public, non-sensitive tables (`events`, `games`, `teams`, `fields`, `event_dates`, `divisions`).

The `user_roles` table already has proper non-permissive policies from `auth_migration.sql` — it is the one table in the schema that does NOT need to be replaced. The phase must handle tables with no `event_id` column (referencing through parent joins), indirect event ownership (e.g., `ref_assignments` → `games.event_id`), and tables that are event-agnostic by design (e.g., `programs`, `seasons`).

**Primary recommendation:** Build the migration as a single SQL file that (1) drops all "Allow all" policies, (2) creates `user_event_ids()`, (3) creates per-operation policies per table in the prescribed layer order, applied to a Supabase branch for smoke testing before production promotion.

---

## Standard Stack

### Core

| Library/Tool | Purpose | Why Standard |
|--------------|---------|--------------|
| PostgreSQL RLS (`CREATE POLICY`) | Row-level access control | Native Supabase/Postgres feature, zero latency overhead |
| `SECURITY DEFINER` functions | Elevated-privilege helper for policy expressions | Required when the helper must bypass the caller's own RLS context |
| `auth.uid()` | Get current user UUID inside policies | Supabase built-in, available in all policy expressions |
| Supabase MCP `create_branch` | Create isolated branch for migration staging | Available in project per CONTEXT.md |
| Supabase MCP `apply_migration` | Apply SQL migration to a branch or production | Available in project per CONTEXT.md |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SECURITY DEFINER function | Inline subquery in every USING clause | Function is DRY and allows caching; inline subquery is verbose and harder to maintain |
| Per-operation policies | Single `FOR ALL` policy | `FOR ALL` cannot give anon SELECT + authenticated CRUD without two separate policies |

---

## Complete Table Inventory

This is the definitive list of all tables requiring RLS policy replacement. Derived from reading every `.sql` file in `supabase/`.

### Group A: Public Tables — anon SELECT open, authenticated CRUD scoped by event_id

These tables contain no PII or ops data. Per D-08/D-09, anon can SELECT all rows (no event filter).

| Table | event_id column | Direct? | Notes |
|-------|----------------|---------|-------|
| `events` | `id` (IS the event) | n/a — anon sees all | Public: event metadata, no sensitive cols |
| `event_dates` | `event_id` | direct | Public: schedule dates |
| `fields` | `event_id` | direct | Public: field names/locations |
| `teams` | `event_id` | direct | Public: team names, division, association, color |
| `games` | `event_id` | direct | Public: schedule and scores |
| `registration_divisions` | `event_id` | direct | Public: available divisions per event |

### Group B: Authenticated Event-Scoped Tables — no anon access

These tables have a direct `event_id` column. USING clause: `event_id IN (SELECT user_event_ids())`.

| Table | event_id column | Source SQL |
|-------|----------------|------------|
| `referees` | `event_id` | schema.sql |
| `volunteers` | `event_id` | schema.sql |
| `incidents` | `event_id` | schema.sql |
| `medical_incidents` | `event_id` | schema.sql |
| `weather_alerts` | `event_id` | schema.sql |
| `ops_log` | `event_id` | schema.sql + phase5 |
| `complexes` | `event_id` | phase1_migration.sql |
| `operational_conflicts` | `event_id` | phase1_migration.sql |
| `weather_readings` | `event_id` | phase3_migration.sql |
| `lightning_events` | `event_id` | phase3_migration.sql |
| `heat_events` | `event_id` | phase3_migration.sql |
| `event_rules` | `event_id` | phase3b_rules.sql |
| `rule_changes` | `event_id` | phase3b_rules.sql |
| `schedule_snapshots` | `event_id` | phase4_migration.sql |
| `conflict_engine_runs` | `event_id` | phase4_migration.sql |
| `ops_alerts` | `event_id` | phase5_command_center.sql |
| `shift_handoffs` | `event_id` | phase5_command_center.sql |
| `schedule_rules` | `event_id` | schedule_rules_system.sql |
| `weekly_overrides` | `event_id` | schedule_rules_system.sql |
| `schedule_audit_log` | `event_id` | schedule_rules_system.sql |
| `division_hierarchy` | `event_id` | player_eligibility.sql |
| `eligibility_violations` | `event_id` | player_eligibility.sql |
| `multi_game_approvals` | `event_id` | player_eligibility.sql |
| `registration_questions` | `event_id` | registration_config.sql |
| `season_game_days` | `event_id` | season_game_days.sql |
| `field_divisions` | `event_id` | division_color_field_divisions.sql |
| `event_admins` | `event_id` | multi_event.sql |
| `player_qr_tokens` | `event_id` | auth_migration.sql |
| `qr_checkin_log` | `event_id` | auth_migration.sql |
| `portal_checkins` | `event_id` | auth_migration.sql |
| `registration_invites` | `event_id` | registration_invites.sql |

### Group C: Indirectly Event-Scoped Tables — event_id through parent join

These tables have no direct `event_id` column; they join through a parent that does.

| Table | Indirect path | Source SQL |
|-------|--------------|------------|
| `players` | `teams.event_id` | schema.sql (has `event_id` column added later in player_eligibility.sql — can use direct) |
| `ref_assignments` | `games.event_id` via `game_id` | schema.sql |
| `vol_assignments` | `games.event_id` via `game_id` | schema.sql |
| `player_checkins` | `games.event_id` via `game_id` | schema.sql |
| `referee_availability` | `referees.event_id` via `referee_id` | phase1_migration.sql |
| `field_blocks` | `fields.event_id` via `field_id` (also has direct `event_id` from phase4_migration.sql) | phase1_migration.sql |
| `program_teams` | `event_id` | program_registration.sql (direct — belongs in Group B) |
| `team_registrations` | `event_id` | program_registration.sql (direct — belongs in Group B) |
| `registration_answers` | `team_registrations.event_id` via `team_reg_id` | registration_config.sql |

**Note on `players`:** `player_eligibility.sql` added `event_id` column to `players` — can scope directly. Use `event_id IN (SELECT user_event_ids())` rather than the join.

**Note on `field_blocks`:** `phase4_migration.sql` added `event_id` column and backfilled it. Can use direct scoping.

### Group D: Sensitive Tables — zero anon policies (D-02)

| Table | Sensitivity | Current State |
|-------|-------------|---------------|
| `ops_alerts` | Internal engine alerts, ops intelligence | "Allow all" — must be locked |
| `ops_log` | Operations log messages | "Allow all" — must be locked |
| `user_roles` | Auth/role system | Already has proper policies — DO NOT REPLACE |

### Group E: Event-Agnostic Tables — no event_id, need design decision

| Table | Description | Recommended Policy |
|-------|-------------|-------------------|
| `programs` | Organizations independent of events | Authenticated can SELECT all; INSERT/UPDATE scoped to their own program (via program_leaders); admin can manage all |
| `program_leaders` | User→Program links | Users can SELECT own rows; admin can SELECT all |
| `seasons` | League seasons — no event_id, no user link | Authenticated can SELECT; admin-only for writes |

### Group F: Already Has Proper Policies — DO NOT TOUCH

| Table | Existing Policies |
|-------|-------------------|
| `user_roles` | "Users can read own role" (SELECT WHERE user_id = auth.uid()) + "Admins can manage roles" |

---

## Architecture Patterns

### Pattern 1: SECURITY DEFINER Helper Function

```sql
-- Source: Supabase RLS documentation + D-03/D-04/D-05
CREATE OR REPLACE FUNCTION user_event_ids()
RETURNS SETOF BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT event_id
  FROM user_roles
  WHERE user_id = auth.uid()
    AND is_active = TRUE
    AND event_id IS NOT NULL;
$$;
```

**Key properties:**
- `STABLE` — tells Postgres the function returns the same result within a query, enabling plan optimization
- `SECURITY DEFINER` — runs as the function owner (postgres/service role), bypasses caller's RLS on `user_roles`
- `SET search_path = public` — security best practice to prevent search_path injection
- Returns `SETOF BIGINT` — works with `IN (SELECT user_event_ids())` pattern
- `is_active = TRUE` — respects account suspension without policy changes
- `event_id IS NOT NULL` — excludes global admin rows that have no event_id

### Pattern 2: Drop Before Recreate

Every table needs its existing "Allow all" policy dropped before new policies are created.

```sql
-- Drop the permissive policy first
DROP POLICY IF EXISTS "Allow all" ON events;
-- Some tables use different policy names — cover all variants:
DROP POLICY IF EXISTS "Allow all on registration_invites" ON registration_invites;
DROP POLICY IF EXISTS "schedule_rules_all" ON schedule_rules;
DROP POLICY IF EXISTS "weekly_overrides_all" ON weekly_overrides;
DROP POLICY IF EXISTS "schedule_audit_log_all" ON schedule_audit_log;
```

**Important:** Policy names are not uniform across migrations. Always use `DROP POLICY IF EXISTS` with the exact name used in the CREATE statement. Check each SQL file.

### Pattern 3: Layer 1 — Authenticated Read Policies (event-scoped)

```sql
-- Standard event-scoped read for authenticated users
CREATE POLICY "auth_select_[table]" ON [table]
  FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT user_event_ids()));
```

### Pattern 4: Layer 2 — Authenticated Write Policies

```sql
-- Write policies require both USING (for existing rows) and WITH CHECK (for new rows)
CREATE POLICY "auth_insert_[table]" ON [table]
  FOR INSERT
  TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_[table]" ON [table]
  FOR UPDATE
  TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_[table]" ON [table]
  FOR DELETE
  TO authenticated
  USING (event_id IN (SELECT user_event_ids()));
```

### Pattern 5: Layer 3 — Anon Read Policies (public tables only)

```sql
-- Per D-09: open anon SELECT, no event filter, no sensitive columns
CREATE POLICY "anon_select_events" ON events
  FOR SELECT
  TO anon
  USING (true);

-- Same pattern for: event_dates, fields, teams, games, registration_divisions
```

### Pattern 6: Indirect Event-Scope (join-through)

For tables without direct `event_id`, join through parent:

```sql
-- ref_assignments: event scope via game
CREATE POLICY "auth_select_ref_assignments" ON ref_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = ref_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );
```

### Pattern 7: Rollback Wrapper

Each migration layer should include commented-out rollback statements:

```sql
-- ROLLBACK: restore permissive access
-- DROP POLICY IF EXISTS "auth_select_games" ON games;
-- DROP POLICY IF EXISTS "anon_select_games" ON games;
-- CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);
```

### Recommended Migration File Structure

```
supabase/
└── rls_migration.sql    # Single file, applied in one transaction per layer
```

```sql
-- ==========================================================
-- RLS Migration: Phase 4
-- Apply to branch first, smoke test, then promote to prod
-- ==========================================================

-- LAYER 0: Deploy user_event_ids() helper
-- LAYER 1: Drop all "Allow all" policies
-- LAYER 2: Authenticated read policies
-- LAYER 3: Authenticated write policies
-- LAYER 4: Anon read policies (public tables)
-- ROLLBACK BLOCK (commented): restore "Allow all" per table
```

### Anti-Patterns to Avoid

- **Skipping `DROP POLICY IF EXISTS`:** Postgres will error if a policy name already exists on a table. Always drop first.
- **Using `FOR ALL` instead of per-operation policies:** `FOR ALL` with `TO authenticated` blocks anon SELECT even when you want it. Per D-01, use per-operation policies.
- **Forgetting `WITH CHECK` on INSERT/UPDATE:** `USING` only applies to existing rows being read/updated/deleted. `WITH CHECK` applies to the row being written. Both are required for UPDATE.
- **Omitting `SET search_path = public` on SECURITY DEFINER functions:** Leaves the function vulnerable to search_path injection.
- **Using `STABLE` incorrectly:** `user_event_ids()` should be `STABLE` (same result per query). Do not use `VOLATILE` (defeats caching) or `IMMUTABLE` (result changes when user_roles changes).
- **Applying to production before branch test:** With 47 tables, a missed policy blocks a feature invisibly. Always branch-test first.
- **Replacing `user_roles` policies:** The existing proper policies on `user_roles` are correct. Do NOT drop them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event-scoped access checking | Per-policy subquery repeated 47x | `user_event_ids()` SECURITY DEFINER function | DRY, cacheable per query, single source of truth |
| Branch testing | Manual SQL apply to production | Supabase MCP `create_branch` + `apply_migration` | Isolated, reversible, smoke-testable without prod risk |
| Policy existence checks | Custom migration scripts | `DROP POLICY IF EXISTS` before each `CREATE POLICY` | Idempotent, safe to re-run |
| Anon blocking on sensitive tables | Custom middleware checks | Absence of anon policy (RLS default deny) | When RLS is enabled and no policy matches, Postgres returns zero rows — this IS the secure default |

**Key insight:** With RLS enabled and no matching policy, Postgres returns zero rows — it does NOT error. This is the "deny by default" behavior. Sensitive tables require no anon policy at all; simply don't create one.

---

## Common Pitfalls

### Pitfall 1: Policy Name Collisions

**What goes wrong:** `CREATE POLICY "Allow all" ON games` fails because the policy already exists.
**Why it happens:** Multiple migration files use the exact same policy name "Allow all" across different tables.
**How to avoid:** Always `DROP POLICY IF EXISTS "Allow all" ON [table]` before creating new policies. Also check for variant names in migration files: `"Allow all on registration_invites"`, `"schedule_rules_all"`, `"weekly_overrides_all"`, `"schedule_audit_log_all"`.
**Warning signs:** `ERROR: policy "Allow all" for table "games" already exists`

### Pitfall 2: Forgetting Tables from Migration Files

**What goes wrong:** Tables added in later migrations (phase3_migration, phase5_command_center, etc.) retain "Allow all" because only schema.sql's 15 tables were targeted.
**Why it happens:** The 15 tables in schema.sql are the most visible; migration tables are scattered across 15+ files.
**How to avoid:** Use the complete table inventory in this document. There are approximately 47 tables total. Verify against a `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename` query on the branch.
**Warning signs:** Security audit shows some tables still returning rows for unrelated users after migration.

### Pitfall 3: Broken Realtime Subscriptions

**What goes wrong:** After applying RLS, Supabase Realtime subscriptions return empty results or throw policy errors.
**Why it happens:** Realtime uses the anon key by default for `supabase_realtime` publication unless the client is authenticated. After RLS tightens, authenticated clients' subscriptions must match a SELECT policy.
**How to avoid:** Test realtime subscriptions explicitly in the smoke test — log into the app as a test user and verify that `games`, `ops_log`, `weather_alerts`, `medical_incidents`, `player_checkins`, `incidents`, `operational_conflicts`, `multi_game_approvals`, `eligibility_violations` all receive events.
**Warning signs:** AppProvider's realtime callbacks stop firing after RLS migration; store stays stale.

### Pitfall 4: programs Table Has No event_id

**What goes wrong:** `programs` table has no `event_id` — cannot scope by `user_event_ids()`. Attempting `programs.event_id IN (SELECT user_event_ids())` causes a column-not-found error.
**Why it happens:** Programs are organization-level entities that exist independently of events. They link to events through `program_teams`.
**How to avoid:** Use `authenticated` read (all programs visible) + write scoped to programs the user leads (via `program_leaders` join). See Architecture Patterns for the correct policy.
**Warning signs:** Migration fails with `column programs.event_id does not exist`.

### Pitfall 5: user_roles Recursion Risk

**What goes wrong:** A policy on `user_roles` that calls `user_event_ids()` (which reads `user_roles`) creates infinite recursion.
**Why it happens:** `user_event_ids()` is SECURITY DEFINER and bypasses RLS, so it reads `user_roles` without triggering its own RLS policies — no recursion. But if someone adds a policy that calls `user_event_ids()` on `user_roles` directly, the SECURITY DEFINER bypass prevents recursion at the cost of unexpected behavior.
**How to avoid:** Leave `user_roles` policies exactly as they are from `auth_migration.sql`. Do not add or modify them in this phase.
**Warning signs:** Infinite loop or max recursion depth error when querying `user_roles`.

### Pitfall 6: INSERT/UPDATE Policies Missing WITH CHECK

**What goes wrong:** Users can read only their events but can INSERT rows with any `event_id`.
**Why it happens:** INSERT policies only use `WITH CHECK`; `USING` is ignored for INSERT. UPDATE uses both — `USING` determines which rows can be updated, `WITH CHECK` validates the new row values.
**How to avoid:** Always include `WITH CHECK (event_id IN (SELECT user_event_ids()))` on INSERT and UPDATE policies.
**Warning signs:** User with access to Event A can successfully INSERT a row with `event_id = B` (event they don't own).

### Pitfall 7: Smoke Test Must Include Multi-User Isolation Check

**What goes wrong:** Migration appears to work when tested as a single user, but cross-event data leakage persists because the test user has access to all events.
**Why it happens:** If the test account has rows in `user_roles` for both Event A and Event B, `user_event_ids()` returns both, and the policy doesn't reveal the bug.
**How to avoid:** Create two test users on the branch — User A with access to Event 1 only, User B with access to Event 2 only. Query as User A and confirm Event 2 rows are invisible. This is the canonical isolation smoke test.
**Warning signs:** Security test passes but uses only one user account.

---

## Code Examples

### Complete `user_event_ids()` Function

```sql
-- Source: D-03, D-04, D-05 from CONTEXT.md + Postgres SECURITY DEFINER docs
CREATE OR REPLACE FUNCTION user_event_ids()
RETURNS SETOF BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT event_id
  FROM user_roles
  WHERE user_id = auth.uid()
    AND is_active = TRUE
    AND event_id IS NOT NULL;
$$;

-- Grant execute to all authenticated and anon (anon calls will return empty set since auth.uid() = null)
GRANT EXECUTE ON FUNCTION user_event_ids() TO authenticated, anon;
```

### Policy Block for a Standard Event-Scoped Table (e.g., `incidents`)

```sql
DROP POLICY IF EXISTS "Allow all" ON incidents;

-- Layer 2: Authenticated reads
CREATE POLICY "auth_select_incidents" ON incidents
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- Layer 3: Authenticated writes
CREATE POLICY "auth_insert_incidents" ON incidents
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_incidents" ON incidents
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_incidents" ON incidents
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- No anon policy — sensitive table per D-02
```

### Policy Block for a Public Table (e.g., `games`)

```sql
DROP POLICY IF EXISTS "Allow all" ON games;

-- Layer 2: Authenticated reads (event-scoped)
CREATE POLICY "auth_select_games" ON games
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- Layer 3: Authenticated writes
CREATE POLICY "auth_insert_games" ON games
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_games" ON games
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_games" ON games
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- Layer 4: Anon read — open, all events per D-09
CREATE POLICY "anon_select_games" ON games
  FOR SELECT TO anon
  USING (true);
```

### Policy Block for Indirect-Scope Table (e.g., `ref_assignments`)

```sql
DROP POLICY IF EXISTS "Allow all" ON ref_assignments;

CREATE POLICY "auth_select_ref_assignments" ON ref_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = ref_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_insert_ref_assignments" ON ref_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = ref_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

-- UPDATE and DELETE follow same EXISTS pattern
```

### Canonical Isolation Smoke Test

```sql
-- Run on branch as User A (access to event_id=1 only):
SELECT COUNT(*) FROM games WHERE event_id = 2;  -- Must return 0

-- Run on branch as User B (access to event_id=2 only):
SELECT COUNT(*) FROM games WHERE event_id = 1;  -- Must return 0

-- Run as anon (no auth):
SELECT COUNT(*) FROM ops_alerts;    -- Must return 0 (sensitive, no anon policy)
SELECT COUNT(*) FROM user_roles;    -- Must return 0 (sensitive, no anon policy)
SELECT COUNT(*) FROM games;         -- Must return all games (public anon policy)
SELECT COUNT(*) FROM events;        -- Must return all events (public anon policy)
```

### Policy Names Requiring Non-Standard DROP

These tables use policy names other than "Allow all" — must be dropped by exact name:

```sql
DROP POLICY IF EXISTS "schedule_rules_all" ON schedule_rules;
DROP POLICY IF EXISTS "weekly_overrides_all" ON weekly_overrides;
DROP POLICY IF EXISTS "schedule_audit_log_all" ON schedule_audit_log;
DROP POLICY IF EXISTS "Allow all on registration_invites" ON registration_invites;
DROP POLICY IF EXISTS "Allow all on season_game_days" ON season_game_days;
DROP POLICY IF EXISTS "Allow all on field_divisions" ON field_divisions;
```

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Supabase MCP `create_branch` | D-06 branch testing | Per CONTEXT.md | Available as MCP tool per project setup |
| Supabase MCP `apply_migration` | D-06 branch testing | Per CONTEXT.md | Available as MCP tool per project setup |
| `supabase/` SQL files | Migration source | Confirmed present | 28 files inventoried |

No missing dependencies. This phase is database-only — no npm installs, no runtime services required beyond the existing Supabase project.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| SEC-01 | `user_event_ids()` returns correct event IDs per user | manual-only | — | Requires live Supabase branch; no unit test viable for SECURITY DEFINER DB function |
| SEC-01 | Authenticated user sees only their event's rows | manual-only | — | Requires two live user accounts on branch; smoke test SQL above |
| SEC-01 | Anon gets zero rows from sensitive tables | manual-only | — | Requires branch with anon key test |
| SEC-01 | Anon SELECT works on public tables | manual-only | — | Requires branch with anon key test |
| SEC-01 | Realtime subscriptions still deliver events post-RLS | manual-only | — | Launch app, verify AppProvider store receives realtime updates |

**Justification for manual-only:** All SEC-01 behaviors require a live Supabase database with real auth sessions and real RLS enforcement. Vitest unit tests mock the Supabase client and cannot exercise actual row-level security policies. The smoke tests defined above (run on the branch before production promotion) ARE the test suite for this phase.

### Wave 0 Gaps

None — no new test files needed. Validation is via branch smoke tests, not automated Vitest suite. Existing test suite (`npm run test`) covers engine and store logic, not database policy behavior.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Impact on This Phase |
|------------|---------------------|
| Stack locked: Next.js 14 + Supabase + Vercel | Database-only phase — no stack impact |
| Auth via Supabase Auth with `user_roles` table | Confirmed: `user_event_ids()` reads from `user_roles` directly |
| Every DB query must be scoped with `.eq('event_id', eventId)` | App-layer scoping already in place; RLS adds DB-layer enforcement |
| Keep third-party services free/cheap | Supabase branches are a paid feature — confirm project tier supports branches before wave 1 |
| Auto-approve all program and team registrations | No impact on RLS policy design; `team_registrations` still needs event-scoped policies |
| Supabase Project ID: `rzzzwrqbubptnlwfesjv` | Use when calling MCP tools |

**Supabase branch availability:** The CONTEXT.md says MCP tools are available, but Supabase branches are a Supabase Pro feature. If the project is on the free tier, D-06 cannot be followed exactly. The rollback strategy (D-07) still applies, and the smoke tests can be run by applying the migration to a local Supabase instance or by accepting production risk with the rollback script ready. This should be confirmed before execution.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `FOR ALL USING (true)` — permissive default | Per-operation policies with role-specific grants | Blocks anon writes, allows anon reads on public tables only |
| No helper function — inline per-policy | Shared `user_event_ids()` SECURITY DEFINER | DRY, cacheable, single change point for access logic |

**Deprecated in this phase:**
- All "Allow all" policies (15 in schema.sql + ~32 in migrations) — replaced by scoped per-operation policies

---

## Open Questions

1. **Supabase branch availability on current plan**
   - What we know: CONTEXT.md says `apply_migration` and `create_branch` MCP tools are available
   - What's unclear: Whether the project is on Supabase Pro (branches require Pro tier)
   - Recommendation: Confirm in Wave 0. If free tier, run smoke tests against local Supabase (`supabase start`) or apply to production with rollback script staged and ready.

2. **`programs` table write policy design**
   - What we know: `programs` has no `event_id`; it's org-level. Program leaders are linked via `program_leaders` table.
   - What's unclear: Should program_leaders write to their own program only? Should any authenticated user be able to create a new program?
   - Recommendation: Authenticated SELECT all programs (needed for registration search); INSERT open to authenticated (self-registration flow); UPDATE scoped to users who are in `program_leaders` for that program. Admin-only DELETE.

3. **`seasons` table policy**
   - What we know: `seasons` has no `event_id` and no user linkage at all — it's a top-level entity.
   - What's unclear: Only admins should create seasons, but it's unclear how to scope by admin role without querying `user_roles`.
   - Recommendation: Authenticated SELECT all; authenticated INSERT/UPDATE/DELETE (admin enforcement via app layer, Phase 3 auth guards). This is acceptable since application-layer auth is already in place per Phase 3.

---

## Sources

### Primary (HIGH confidence)

- Schema inventory: All 28 files in `supabase/` directory read directly — authoritative for table list and current policy state
- CONTEXT.md decisions D-01 through D-09 — user-locked architecture decisions
- `supabase/auth_migration.sql` — existing `user_roles` policy pattern (the correct model for what this phase builds)
- `supabase/storage_rls.sql` — per-operation policy naming pattern used in project

### Secondary (MEDIUM confidence)

- CLAUDE.md architectural documentation — confirms `user_roles` table structure, multi-role support, event scoping requirement
- PostgreSQL documentation on SECURITY DEFINER, `STABLE`, `SET search_path` — standard Postgres behavior, HIGH confidence by training but no Context7 lookup performed for this phase (pure SQL, no library API involved)

### Tertiary (LOW confidence)

- Supabase branch availability on free vs Pro plan — not verified; flagged as open question

---

## Metadata

**Confidence breakdown:**
- Table inventory: HIGH — derived from direct file reads of all SQL migrations
- Helper function design: HIGH — matches locked decisions and standard Postgres SECURITY DEFINER patterns
- Policy SQL syntax: HIGH — standard Postgres RLS syntax unchanged for years
- Supabase branch availability: LOW — not verified against current plan tier

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (Supabase RLS syntax is stable; 30-day window appropriate)
