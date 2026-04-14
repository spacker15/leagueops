# Phase 4: RLS & Database Security - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 04-rls-database-security
**Areas discussed:** Policy granularity, user_event_ids() design, Migration & testing strategy, Public table anon access

---

## Policy Granularity

### Q1: How should RLS policies be structured per table?

| Option                    | Description                                                 | Selected |
| ------------------------- | ----------------------------------------------------------- | -------- |
| Per-operation policies    | Separate SELECT, INSERT, UPDATE, DELETE policies per table. | ✓        |
| Combined FOR ALL policies | Single policy per role per table.                           |          |
| You decide                | Claude picks.                                               |          |

**User's choice:** Per-operation policies
**Notes:** None

### Q2: Should sensitive tables have any anon access?

| Option                  | Description                                 | Selected |
| ----------------------- | ------------------------------------------- | -------- |
| No anon access          | Zero policies for anon on sensitive tables. | ✓        |
| Read-only anon for some | Allow anon SELECT on ops_log.               |          |
| You decide              | Claude picks.                               |          |

**User's choice:** No anon access
**Notes:** None

---

## user_event_ids() Design

### Q1: How should user_event_ids() resolve event access?

| Option                          | Description                                  | Selected |
| ------------------------------- | -------------------------------------------- | -------- |
| Direct user_roles lookup        | Query user_roles WHERE user_id = auth.uid(). | ✓        |
| user_roles + program membership | Also include events via programs table.      |          |
| You decide                      | Claude picks.                                |          |

**User's choice:** Direct user_roles lookup
**Notes:** None

### Q2: Handle case where user has no roles?

| Option                 | Description                             | Selected |
| ---------------------- | --------------------------------------- | -------- |
| Empty set = no access  | Returns empty array, zero rows visible. | ✓        |
| Fallback to all events | Fail-open, return all events.           |          |
| You decide             | Claude picks.                           |          |

**User's choice:** Empty set = no access
**Notes:** None

---

## Migration & Testing Strategy

### Q1: How should the RLS migration be staged?

| Option                          | Description                                 | Selected |
| ------------------------------- | ------------------------------------------- | -------- |
| Supabase branch + layered apply | Branch, apply in layers, smoke test each.   | ✓        |
| Single migration, branch test   | One big SQL, test on branch, apply to prod. |          |
| You decide                      | Claude picks.                               |          |

**User's choice:** Supabase branch + layered apply
**Notes:** None

### Q2: Rollback plan?

| Option               | Description                                                   | Selected |
| -------------------- | ------------------------------------------------------------- | -------- |
| Revert to Allow all  | Keep DROP + CREATE ready. Phase 3 auth guards protect routes. | ✓        |
| Disable RLS entirely | ALTER TABLE DISABLE ROW LEVEL SECURITY.                       |          |
| You decide           | Claude picks.                                                 |          |

**User's choice:** Revert to Allow all
**Notes:** None

---

## Public Table Anon Access

### Q1: Which tables should anon users SELECT from?

| Option                                  | Description                                 | Selected |
| --------------------------------------- | ------------------------------------------- | -------- |
| events, games, teams, fields, divisions | Minimal set for public results. No PII.     | ✓        |
| All event-owned tables                  | Broader access including players, referees. |          |
| You decide                              | Claude picks minimal set.                   |          |

**User's choice:** events, games, teams, fields, divisions
**Notes:** None

### Q2: Should anon SELECT be event-scoped or open?

| Option                       | Description                                          | Selected |
| ---------------------------- | ---------------------------------------------------- | -------- |
| Open SELECT on public tables | All rows visible. No sensitive data in these tables. | ✓        |
| Scoped by event slug/ID      | Complex for anon with no session.                    |          |
| You decide                   | Claude picks.                                        |          |

**User's choice:** Open SELECT on public tables
**Notes:** None

---

## Claude's Discretion

- Exact SQL syntax for policies and helper function
- Order of table lockdown within each layer
- Additional tables needing RLS discovery
- Supabase branch naming
- Smoke test query design

## Deferred Ideas

None — discussion stayed within phase scope.
