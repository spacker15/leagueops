# Phase 1: Engine Client Refactor - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor all 6 engine modules to accept an injected server-side Supabase client instead of importing the browser client. Move the OpenWeather API key to a server-only environment variable. Fix the field-engine resolved-conflicts bug. Add unit tests for all engines. No UI changes, no schema changes.

</domain>

<decisions>
## Implementation Decisions

### Client Injection Pattern

- **D-01:** All engine functions receive a `SupabaseClient` as a function parameter — no factory pattern, no module-level setter.
- **D-02:** All 6 engines are refactored: `referee.ts`, `weather.ts`, `field.ts`, `eligibility.ts`, `unified.ts`, and `rules.ts` (cache layer included for consistency).

### Backward Compatibility

- **D-03:** Engines run server-side only (API routes). Client-side code (store.tsx, components) must call API routes instead of importing engines directly. No dual-mode fallback to browser client.
- **D-04:** Any existing client-side engine imports must be replaced with API route calls during this phase.

### Field Engine Bug Fix

- **D-05:** Fix the `type === 'all' ? false : false` bug in `field.ts` during this phase — both branches are identical, preventing resolved conflicts from being fetched. Needed before Phase 8 slot suggestions.

### Testing

- **D-06:** Add unit tests for each engine module with a mocked Supabase client. The refactor to function parameter injection makes this straightforward.

### OpenWeather API Key

- **D-07:** Rename `NEXT_PUBLIC_OPENWEATHER_KEY` to `OPENWEATHER_API_KEY` (server-only). Update all references in `weather.ts` and any API routes.

### Claude's Discretion

- Test file organization and naming (follow existing `__tests__/` conventions)
- Mock strategy details (mock Supabase client shape)
- Order of engine refactoring (dependency-safe sequence)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Engine Modules (all need refactoring)

- `lib/engines/referee.ts` — Referee conflict detection engine
- `lib/engines/field.ts` — Field conflict detection engine (contains the resolved bug)
- `lib/engines/weather.ts` — Weather monitoring engine (contains NEXT_PUBLIC key reference)
- `lib/engines/eligibility.ts` — Player eligibility engine
- `lib/engines/unified.ts` — Unified engine that orchestrates all sub-engines
- `lib/engines/rules.ts` — Rules cache engine

### Supabase Client Files

- `supabase/client.ts` — Browser-side Supabase client (currently imported by all engines)
- `supabase/server.ts` — Server-side Supabase client (engines should use this via injection)

### API Routes That Call Engines

- `app/api/referee-engine/route.ts` — Calls referee engine
- `app/api/field-engine/route.ts` — Calls field engine
- `app/api/weather-engine/route.ts` — Calls weather engine
- `app/api/eligibility/route.ts` — Calls eligibility engine

### Codebase Analysis

- `.planning/codebase/CONCERNS.md` — Documents the engine client issue (P0) and field engine bug (P2)
- `.planning/codebase/ARCHITECTURE.md` — Engine layer architecture and data flow

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `supabase/server.ts` — Server-side client creator already exists; engines should receive instances created from this
- `vitest.config.ts` + `vitest.setup.ts` — Test infrastructure already configured with path aliases
- Existing test in `__tests__/` — Follow the same conventions for new engine tests

### Established Patterns

- All `lib/db.ts` functions instantiate a fresh `createClient()` per call — engines currently follow the same anti-pattern
- API routes use `createServerClient` from `@supabase/ssr` for server-side auth
- `useApp()` actions wrap API calls with optimistic dispatches

### Integration Points

- `lib/store.tsx` — Currently imports engines directly for some operations (lightning trigger, etc.) — these must be redirected to API routes
- All 4 engine API routes (`referee-engine`, `field-engine`, `weather-engine`, `eligibility`) — Must pass server client to engine functions
- `unified.ts` — Orchestrates sub-engines, so it must pass its received client down to each sub-engine call

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard refactoring approach with function parameter injection.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 01-engine-client-refactor_
_Context gathered: 2026-03-22_
