# Phase 3: API Auth & Validation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add authentication checks and Zod request validation to all 42 API routes, and apply Upstash rate limiting to engine-trigger and public-facing endpoints. No UI changes, no schema changes, no new features.

</domain>

<decisions>
## Implementation Decisions

### Auth Guard Pattern
- **D-01:** Shared `requireAuth()` helper function in `lib/` — routes call it at the top, it returns the authenticated user or responds with 401. One-line auth check per route.
- **D-02:** Auth-only — the helper verifies the user is logged in. Role-based checks (e.g., admin-only) stay inline in individual routes where needed. No role DB query in the guard.
- **D-03:** Public routes documented via a `PUBLIC_ROUTES` array exported from the auth helper file. Each public route has a comment explaining why it's public. Single source of truth.
- **D-04:** Expired/invalid JWTs return `{ error: 'unauthorized', message: 'Session expired or invalid' }` with 401 status. No silent empty results, no redirects.

### Zod Schema Organization
- **D-05:** All validation schemas in a single `lib/validations.ts` file, exported by name (e.g., `createGameSchema`, `updateFieldSchema`).
- **D-06:** Every POST/PATCH/DELETE body gets a Zod schema — full body validation, even for simple payloads. Consistent approach across all routes.
- **D-07:** GET route query parameters keep existing manual checks — Zod applies to request bodies only.

### Rate Limiting Strategy
- **D-08:** Rate limit engine-trigger routes (weather-engine, referee-engine, schedule-engine, field-engine, unified-engine) and all public-facing routes (join, checkins, public-results). Authenticated write routes are not rate-limited.
- **D-09:** Thresholds: engine routes 10 req/min per IP, public routes 30 req/min per IP.
- **D-10:** Packages: `@upstash/ratelimit ^2.x` and `@upstash/redis ^1.x` (approved in scope notes).
- **D-11:** Rate-limited requests return 429 Too Many Requests with `Retry-After` header and JSON error body.

### Error Response Format
- **D-12:** Standard error shape: `{ error: '<code>', message: '<human-readable>' }`. Machine-readable error code + human message. Matches existing route patterns.
- **D-13:** Zod validation failures return 400 with `{ error: 'validation_error', message: 'Invalid request body', details: [{ field: '<name>', message: '<issue>' }] }`. Field-level error details included for debugging.

### Claude's Discretion
- Route categorization order (write, read, public, engine-trigger)
- Exact helper function signature and error handling internals
- Whether to batch small route changes or handle one-by-one
- Upstash Redis configuration details (region, key naming)
- Zod schema naming conventions within `lib/validations.ts`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in ROADMAP.md Phase 3 section.

### Requirements
- `.planning/REQUIREMENTS.md` — SEC-02 (auth checks), SEC-07 (Zod validation), SEC-08 (rate limiting)

### Existing patterns
- `app/api/admin/create-user/route.ts` — One of 2 routes with existing auth guard (reference implementation)
- `app/api/games/route.ts` — Typical route pattern (no auth, no validation — represents the majority)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/server.ts` — `createClient()` already used in all routes for server-side Supabase access
- `lib/auth.tsx` — AuthProvider with multi-role support via `userRoles` array; role booleans (`isAdmin`, `isCoach`, etc.) — client-side only, but models the role check pattern

### Established Patterns
- Routes follow consistent structure: `createClient()` → query params/body extraction → Supabase query → JSON response
- Error responses already use `{ error: string }` pattern in most routes — D-12 formalizes this
- `app/api/admin/create-user/route.ts` already calls `auth.getUser()` — the pattern to extend

### Integration Points
- All 42 routes under `app/api/` need modification (auth + validation)
- Engine routes: `weather-engine`, `referee-engine`, `schedule-engine`, `field-engine`, `unified-engine` — need both auth and rate limiting
- Public routes: `join`, `checkins`, `auth/check-email`, `auth/program-prefill` — rate limiting only, no auth
- New dependencies: `zod`, `@upstash/ratelimit`, `@upstash/redis` must be installed

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

*Phase: 03-api-auth-validation*
*Context gathered: 2026-03-23*
