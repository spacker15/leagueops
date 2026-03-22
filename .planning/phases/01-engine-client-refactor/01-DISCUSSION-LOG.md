# Phase 1: Engine Client Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 01-engine-client-refactor
**Areas discussed:** Client injection pattern, Backward compatibility, Field-engine bug fix scope, Testing approach

---

## Client Injection Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Function parameter | Each engine function takes a `supabase` param — simplest, explicit, easy to test with mocks | ✓ |
| Factory pattern | createEngine(supabase) returns an object with methods — more OOP, groups related functions | |
| You decide | Claude picks the best approach based on the codebase patterns | |

**User's choice:** Function parameter
**Notes:** None — straightforward choice aligned with existing codebase patterns.

### Rules Engine Inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, refactor all 6 | Consistent pattern across all engines including rules.ts | ✓ |
| Skip rules.ts | It's a cache layer, not a compute engine — leave it for now | |
| You decide | Claude evaluates whether rules.ts needs the same treatment | |

**User's choice:** Yes, refactor all 6
**Notes:** Consistency preferred across all engine modules.

---

## Backward Compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| API routes only | Engines only run server-side — client code calls API routes instead. Cleaner, more secure. | ✓ |
| Dual mode | Accept optional client param — falls back to browser client if none passed. More flexible but keeps the old pattern. | |
| You decide | Claude evaluates which engine call sites exist and picks the safest approach | |

**User's choice:** API routes only
**Notes:** No dual-mode fallback. All client-side engine calls must be redirected to API routes.

---

## Field-Engine Bug Fix Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix now | Fix alongside the refactor — it's needed before Phase 8 slot suggestions and it's a one-line fix | ✓ |
| Defer to Phase 8 | Leave the bug for now, fix when schedule change requests need it | |

**User's choice:** Fix now
**Notes:** One-line fix, no reason to defer.

---

## Testing Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Add tests | Write unit tests for each engine with mocked Supabase client — the refactor makes them testable | ✓ |
| Skip tests | Just refactor, no tests — faster but riskier on a live app | |
| Minimal tests only | Test the injection pattern works (client is used, not imported) but skip logic tests | |

**User's choice:** Add tests
**Notes:** Full unit tests for all engines with mocked Supabase client.

---

## Claude's Discretion

- Test file organization and naming
- Mock strategy details
- Order of engine refactoring

## Deferred Ideas

None — discussion stayed within phase scope.
