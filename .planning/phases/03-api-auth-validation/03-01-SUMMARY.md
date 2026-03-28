---
phase: 03-api-auth-validation
plan: 01
subsystem: infra
tags: [supabase, upstash, redis, ratelimit, zod, validation, schemas]

requires: []
provides:
  - 'lib/supabase/server.ts — async createClient() for Route Handlers (Next.js 15 compatible)'
  - 'lib/ratelimit.ts — engineRatelimit (fixedWindow 10/60s) and publicRatelimit (slidingWindow 30/60s)'
  - 'schemas/ — 11 domain schema files with Zod validation + TypeScript types for all write routes'
  - 'schemas/index.ts — barrel file exporting all schemas'
  - 'ROUTE-INVENTORY.md — 42 routes categorized as write/read-authenticated/public/engine-trigger'
  - '@upstash/ratelimit, @upstash/redis, zod installed'
affects:
  - '03-02 — uses createClient(), ratelimit instances, and schema barrel in every route modification'
  - '03-03 through 03-N — all plans building on these shared utilities'

tech-stack:
  added:
    - '@upstash/ratelimit ^2.x — sliding/fixed window rate limiting via Upstash Redis'
    - '@upstash/redis ^1.x — Redis client for Upstash'
    - 'zod ^3.x — runtime schema validation with TypeScript inference'
  patterns:
    - 'async createClient() pattern: await cookies() before createServerClient() for Next.js 15 async headers API'
    - 'Redis.fromEnv() for zero-config Upstash credential loading'
    - 'Schema barrel pattern: domain schemas in schemas/*.ts, re-exported from schemas/index.ts'
    - 'z.infer<typeof schema> co-export pattern: schema constant + TypeScript type from same file'

key-files:
  created:
    - 'lib/supabase/server.ts — async Supabase server client for Route Handlers'
    - 'lib/ratelimit.ts — engineRatelimit and publicRatelimit instances'
    - 'schemas/index.ts — barrel re-exporting all domain schemas'
    - 'schemas/admin.ts — createUserSchema for /api/admin/create-user'
    - 'schemas/assignments.ts — ref assignment create/delete schemas'
    - 'schemas/conflicts.ts — resolveConflictSchema for /api/conflicts PATCH'
    - 'schemas/engines.ts — all engine trigger schemas (schedule, referee, field, weather, unified, shift-handoff)'
    - 'schemas/fields.ts — field create/update schemas'
    - 'schemas/games.ts — game create/update schemas'
    - 'schemas/incidents.ts — incident and medical incident create schemas'
    - 'schemas/payments.ts — team payment and payment entry schemas'
    - 'schemas/referees.ts — referee create/update schemas'
    - 'schemas/registration-fees.ts — registration fee create/update schemas'
    - 'schemas/rules.ts — rule update/reset, schedule rule, weekly override schemas'
    - 'schemas/volunteers.ts — volunteer create/update schemas'
    - '.planning/phases/03-api-auth-validation/ROUTE-INVENTORY.md — 42 routes categorized'
  modified:
    - 'package.json — added @upstash/ratelimit, @upstash/redis, zod'
    - '.env.example — added UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN'

key-decisions:
  - 'lib/supabase/server.ts placed at lib/ (not src/lib/) — project has no src/ directory; consistent with existing lib/ structure'
  - 'Existing supabase/server.ts (old sync cookies API) retained — plans 03-02+ will migrate callers to lib/supabase/server.ts gradually'
  - 'schemas/ at project root — no src/ directory exists; mirrors location of lib/, types/, components/ at root level'
  - 'engine-trigger routes categorized separately from write — engines are internal-trigger not user-facing mutations, requiring different auth pattern (header secret vs session)'
  - 'Public routes (join, checkins, auth/check-email) get rate limiting not auth guards — intentionally unauthenticated by design'

patterns-established:
  - 'Auth guard pattern: await createClient() → getUser() → check null → return 401'
  - 'Zod validation pattern: schema.safeParse(body) → check success → use parsed data'
  - 'Rate limit pattern: ratelimit.limit(identifier) → check success → return 429 with Retry-After'

requirements-completed: [SEC-02, SEC-07, SEC-08]

duration: 5min
completed: 2026-03-23
---

# Phase 03 Plan 01: Dependencies, Infrastructure & Route Inventory Summary

**@upstash/ratelimit + @upstash/redis + zod installed; async Supabase server client, rate limiter pair, and 11 Zod schema domain files created; 42 API routes catalogued by category in ROUTE-INVENTORY.md**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T12:54:46Z
- **Completed:** 2026-03-23T12:59:44Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Installed @upstash/ratelimit, @upstash/redis, zod (supabase packages were already present)
- Created `lib/supabase/server.ts` with async `createClient()` using `await cookies()` — Next.js 15 compatible
- Created `lib/ratelimit.ts` exporting `engineRatelimit` (fixedWindow 10/60s) and `publicRatelimit` (slidingWindow 30/60s)
- Catalogued all 42 API routes in ROUTE-INVENTORY.md with category, auth guard status, schema, and rate limit requirements
- Created 11 Zod domain schema files covering all write/engine-trigger route bodies
- Barrel file `schemas/index.ts` exports all schemas and co-located TypeScript types via `z.infer<>`

## Task Commits

1. **Task 1: Install dependencies and create Supabase server client + Ratelimit utilities** - `c0426e2` (chore)
2. **Task 2: Create route inventory and Zod schema barrel file** - `548e5f2` (feat)

## Files Created/Modified

- `lib/supabase/server.ts` — async createClient() using await cookies() + createServerClient from @supabase/ssr
- `lib/ratelimit.ts` — Ratelimit instances: engineRatelimit (fixed) and publicRatelimit (sliding)
- `schemas/index.ts` — barrel file with 24 export statements
- `schemas/admin.ts` — createUserSchema (email, password, role, event_id)
- `schemas/assignments.ts` — createAssignmentSchema, deleteAssignmentSchema
- `schemas/conflicts.ts` — resolveConflictSchema
- `schemas/engines.ts` — 7 engine trigger schemas
- `schemas/fields.ts` — createFieldSchema, updateFieldSchema
- `schemas/games.ts` — createGameSchema, updateGameSchema
- `schemas/incidents.ts` — createIncidentSchema, createMedicalIncidentSchema
- `schemas/payments.ts` — createTeamPaymentSchema, updateTeamPaymentSchema, createPaymentEntrySchema
- `schemas/referees.ts` — createRefereeSchema, updateRefereeSchema
- `schemas/registration-fees.ts` — createRegistrationFeeSchema, updateRegistrationFeeSchema
- `schemas/rules.ts` — updateRuleSchema, resetRuleSchema, createScheduleRuleSchema, updateScheduleRuleSchema, createWeeklyOverrideSchema, updateWeeklyOverrideSchema
- `schemas/volunteers.ts` — createVolunteerSchema, updateVolunteerSchema
- `.planning/phases/03-api-auth-validation/ROUTE-INVENTORY.md` — 42 routes categorized
- `package.json` / `package-lock.json` — new dependencies
- `.env.example` — UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN added

## Decisions Made

- `lib/supabase/server.ts` placed at `lib/` (not `src/lib/`) — project has no `src/` directory; mirrors existing `lib/` structure
- Existing `supabase/server.ts` (old synchronous cookies API) retained — plans 03-02+ will migrate route callers to new `lib/supabase/server.ts` async version
- `schemas/` directory at project root — consistent with `lib/`, `types/`, `components/` all at root level
- Engine-trigger routes categorized separately from write routes — engines have a different auth pattern (header secret vs user session)
- Public routes (join, checkins, auth/check-email) get rate limiting not auth guards — these routes are intentionally unauthenticated by design (token-gated invite flows, registration preflight)

## Deviations from Plan

None — plan executed exactly as written. The only structural adaptation was using `lib/` instead of `src/lib/` because the project has no `src/` directory, which is a factual correction not a deviation.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration:**

- **UPSTASH_REDIS_REST_URL** — Create a Redis database at [console.upstash.com](https://console.upstash.com), copy the REST URL
- **UPSTASH_REDIS_REST_TOKEN** — Copy the REST token from the same database
- Add both to `.env.local` and Vercel environment variables before deploying plans that use `engineRatelimit` or `publicRatelimit`

Rate limiting will throw at runtime if these variables are missing. The ratelimit utilities are only imported by routes after Phase 03 hardening — no runtime impact until plans 03-02+ wire them in.

## Next Phase Readiness

- `createClient()` from `lib/supabase/server.ts` is ready for all Route Handlers in Phase 03
- `engineRatelimit` and `publicRatelimit` ready to import in route files
- All 42 routes are categorized — plans 03-02+ can work systematically through write, engine-trigger, and public categories
- Schema barrel is ready to import for Zod body validation in all write routes

---

_Phase: 03-api-auth-validation_
_Completed: 2026-03-23_
