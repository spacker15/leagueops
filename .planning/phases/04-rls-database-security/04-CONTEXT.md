# Phase 4: RLS & Database Security - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the `user_event_ids()` helper function and replace all "Allow all" RLS policies with proper event-scoped row-level security, tested against a Supabase branch before production. No UI changes, no new features.

</domain>

<decisions>
## Implementation Decisions

### Policy Granularity
- **D-01:** Per-operation policies — separate SELECT, INSERT, UPDATE, DELETE policies per table. Allows anon SELECT-only while authenticated users get full CRUD.
- **D-02:** Sensitive tables (`ops_alerts`, `ops_log`, `user_roles`) have zero anon policies. Anonymous queries return empty results. No exceptions.

### user_event_ids() Design
- **D-03:** Direct `user_roles` table lookup: `SELECT DISTINCT event_id FROM user_roles WHERE user_id = auth.uid()`. Simple, matches existing multi-role system.
- **D-04:** `SECURITY DEFINER` function — runs with elevated privileges to access `user_roles` regardless of caller's RLS context.
- **D-05:** Empty set = no access. If a user has no rows in `user_roles`, the function returns an empty array and all event-scoped queries return zero rows. Fail-closed.

### Migration & Testing Strategy
- **D-06:** Supabase branch + layered apply. Create a branch via MCP tools. Apply RLS in layers: 1) `user_event_ids()` function, 2) authenticated read policies, 3) write policies, 4) anon policies. Smoke test each layer on the branch before promoting to production.
- **D-07:** Rollback plan: revert to "Allow all" policies. Keep DROP + CREATE statements ready. Safe since Phase 3 auth guards already protect API routes at the application layer.

### Public Table Anon Access
- **D-08:** Public tables for anon SELECT: `events`, `games`, `teams`, `fields`, `divisions`. Enough for Phase 9 public results site. No player PII, no ops data, no user roles exposed.
- **D-09:** Open SELECT on public tables — anon can see all rows across all events. No event scoping for anon. Public results site needs to browse events, and these tables contain no sensitive data.

### Claude's Discretion
- Exact SQL syntax for policies and helper function
- Order of table lockdown within each layer
- Which additional tables from later migrations need RLS (beyond the 15 in schema.sql)
- Supabase branch naming convention
- Smoke test query design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SEC-01 (RLS policies replacing "Allow all")

### Existing schema
- `supabase/schema.sql` — Base schema with 15 "Allow all" policies and `ENABLE ROW LEVEL SECURITY` statements
- `supabase/storage_rls.sql` — Reference for existing RLS pattern (storage bucket policies)

### Prior phase context
- `.planning/phases/03-api-auth-validation/03-CONTEXT.md` — Auth guard pattern (D-01 through D-04) — application-layer auth already in place

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/storage_rls.sql` — Existing RLS policy pattern for storage bucket (per-role, per-operation)
- `lib/auth.tsx` — Multi-role system with `userRoles` array — mirrors the `user_roles` table that `user_event_ids()` will query

### Established Patterns
- All 15 event-owned tables already have `ENABLE ROW LEVEL SECURITY` — just need policy replacement
- `user_roles` table has `user_id` and `event_id` columns — direct lookup for `user_event_ids()`
- Additional tables from later migrations (programs, schedule_rules, divisions, etc.) may not have RLS enabled at all — need discovery

### Integration Points
- `user_event_ids()` function deployed to Supabase Postgres — used in USING/WITH CHECK clauses
- Supabase MCP tools (`apply_migration`, `create_branch`) available for branch testing
- Phase 9 (public results) depends on anon SELECT policies created here

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-rls-database-security*
*Context gathered: 2026-03-23*
