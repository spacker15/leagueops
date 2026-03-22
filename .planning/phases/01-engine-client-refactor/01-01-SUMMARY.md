---
phase: 01-engine-client-refactor
plan: "01"
subsystem: api
tags: [supabase, engines, security, refactor, typescript]

# Dependency graph
requires: []
provides:
  - All 6 engine modules (rules, referee, field, weather, eligibility, unified) accept injected SupabaseClient
  - No engine file imports from @/supabase/client
  - OPENWEATHER_API_KEY is server-only (NEXT_PUBLIC_ removed)
  - field-engine resolved-conflicts bug fixed (type=all returns all conflicts)
  - unified.ts uses direct function imports instead of fetch('/api/...')
affects:
  - 02-hardcode-removal-event-context
  - 03-api-auth-validation
  - any plan that touches engine modules or their callers

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Engine functions accept sb: SupabaseClient as a parameter — never call createClient() internally"
    - "createClient() from supabase/server is always called inside Route Handler function body"
    - "Server-only env vars use plain names (OPENWEATHER_API_KEY), never NEXT_PUBLIC_ prefix"
    - "Sub-engine orchestration uses direct function imports, not fetch('/api/...')"
    - "try/catch around sub-engine calls in unified engine per CLAUDE.md Gotcha #6"

key-files:
  created: []
  modified:
    - "lib/engines/rules.ts"
    - "lib/engines/referee.ts"
    - "lib/engines/field.ts"
    - "lib/engines/weather.ts"
    - "lib/engines/eligibility.ts"
    - "lib/engines/unified.ts"
    - "app/api/field-engine/route.ts"
    - "app/api/weather-engine/route.ts"
    - "app/api/eligibility/route.ts"
    - "app/api/lightning/route.ts"
    - "app/api/referee-engine/route.ts"
    - "components/engine/CommandCenter.tsx"

key-decisions:
  - "Weather engine not called from runUnifiedEngine — complexId not available in unified scope. Weather runs separately per-complex from weather-engine API route."
  - "CommandCenter.tsx (client component) passes createClient() from @/supabase/client to unified engine calls. Full server-side migration of CommandCenter deferred to Plan B2."
  - "Rules cache (_cache) retained as-is; added comment documenting serverless isolation behavior for Phase 2 multi-event work."
  - "API routes updated to pass sb alongside engine function signature changes — fixes all type errors caused by refactor."

patterns-established:
  - "Engine injection pattern: all engine modules receive sb: SupabaseClient as parameter, never instantiate their own client"
  - "Route handler pattern: createClient() called at start of Route Handler function body, sb passed to all engine/db calls"

requirements-completed: ["SEC-03", "SEC-06"]

# Metrics
duration: 19min
completed: 2026-03-22
---

# Phase 1 Plan 01: Core Engine Refactor Summary

**All 6 engine modules refactored to accept injected SupabaseClient, NEXT_PUBLIC_OPENWEATHER_KEY renamed to server-only OPENWEATHER_API_KEY, field-engine resolved-conflicts bug fixed, and unified.ts replaced fetch('/api/...') calls with direct function imports.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-22T20:02:25Z
- **Completed:** 2026-03-22T20:21:44Z
- **Tasks:** 7 (+ 1 auto-fix deviation)
- **Files modified:** 12

## Accomplishments

- Removed all `import { createClient } from '@/supabase/client'` from engine files — 6 files cleaned
- Added `import type { SupabaseClient } from '@supabase/supabase-js'` and `sb` parameter to all DB-accessing functions
- Fixed the `field-engine` resolved-conflicts bug: `type=all` now returns all conflicts; `type=open` correctly filters `resolved=false`
- Renamed `NEXT_PUBLIC_OPENWEATHER_KEY` to `OPENWEATHER_API_KEY` throughout engine and route files (SEC-06)
- Replaced `fetch('/api/referee-engine')` and `fetch('/api/field-engine')` in `unified.ts` with direct imports using `try/catch`
- Added serverless cache documentation comment in `rules.ts` for Phase 2 multi-event awareness
- `npm run type-check` passes with zero errors; `npm run test` passes (13 tests)

## Task Commits

1. **Task 1: Refactor rules.ts** - `192c3c4` (feat)
2. **Task 2: Refactor referee.ts** - `d2f3f11` (feat)
3. **Task 3: Refactor field.ts + fix resolved-conflicts bug** - `8a3f264` (feat)
4. **Task 4: Refactor weather.ts + rename OpenWeather key** - `e44804a` (feat)
5. **Task 5: Refactor eligibility.ts** - `778e05b` (feat)
6. **Task 6: Refactor unified.ts + replace fetch() with direct imports** - `ebd30e9` (feat)
7. **Task 7 + Deviation fix: Verification + API route/CommandCenter callers** - `8fd9c1d` (fix)

## Files Created/Modified

- `lib/engines/rules.ts` - Removed createClient import; all functions accept sb parameter; cache comment added
- `lib/engines/referee.ts` - Removed createClient import; runRefereeEngine, findAvailableRefs, clearStaleConflicts accept sb
- `lib/engines/field.ts` - Removed createClient import; all 4 functions accept sb; getSchedulingRules(sb) call updated
- `lib/engines/weather.ts` - Removed createClient import; 5 DB functions accept sb; NEXT_PUBLIC_OPENWEATHER_KEY renamed
- `lib/engines/eligibility.ts` - Removed createClient import; all 5 exported functions accept sb as last parameter
- `lib/engines/unified.ts` - Removed createClient import; direct engine imports; try/catch around sub-engine calls; sb injected
- `app/api/field-engine/route.ts` - Fixed resolved-conflicts bug; sb passed to engine calls; createClient() in handler body
- `app/api/weather-engine/route.ts` - sb passed to all engine calls; createClient() in handler body
- `app/api/eligibility/route.ts` - sb passed to all eligibility engine calls
- `app/api/lightning/route.ts` - sb passed to checkLightningStatus and liftLightningDelay
- `app/api/referee-engine/route.ts` - sb passed to runRefereeEngine and findAvailableRefs
- `components/engine/CommandCenter.tsx` - createClient() passed as sb to unified engine calls

## Decisions Made

- **Weather in unified engine:** `complexId` is not available in `runUnifiedEngine`'s scope, so weather engine continues to be triggered separately per-complex from the weather-engine API route. Documented with a comment in the code.
- **CommandCenter client component:** Since CommandCenter is `'use client'`, it cannot use the server-side createClient. Passes browser `createClient()` as `sb`. Full server-side migration deferred to Plan B2.
- **API routes updated as deviation:** Four API route files and CommandCenter.tsx had type errors because they called engines without `sb`. Updated as part of Task 7 verification (Rule 3 — blocking issues directly caused by the refactor).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated API route callers to pass sb parameter**

- **Found during:** Task 7 (Verification grep + type-check)
- **Issue:** `npm run type-check` revealed that 4 API routes and `CommandCenter.tsx` still called engine functions without the new required `sb` parameter, causing type errors that would break the build.
- **Fix:** Updated `app/api/eligibility/route.ts`, `app/api/lightning/route.ts`, `app/api/referee-engine/route.ts`, and `components/engine/CommandCenter.tsx` to instantiate `createClient()` inside each handler and pass it as `sb` to engine calls.
- **Files modified:** 4 API routes + CommandCenter.tsx
- **Verification:** `npm run type-check` passes with zero errors after fix
- **Committed in:** `8fd9c1d` (Task 7 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** The fix was necessary for the type-check to pass. All caller sites updated consistently. No scope creep — only files that directly called the refactored engine functions were touched.

## Issues Encountered

- `npm run type-check` initially failed because `tsc` was not in PATH (Windows environment). Resolved by running `npm install` first to restore `node_modules`, then using `npm run type-check` which invokes the local TypeScript binary via npm scripts.

## Known Stubs

None — all engine refactors are complete wiring changes with no placeholder data or stub patterns introduced.

## Next Phase Readiness

- All engine modules are ready for Phase 2 (hardcode removal and event context injection). The `sb` injection pattern is established — Phase 2 just needs to add `eventId` parameter alongside `sb`.
- The serverless cache comment in `rules.ts` documents the Phase 2 multi-event work needed (keying cache by eventId).
- No blockers for Phase 2 or Phase 3 work.

---
*Phase: 01-engine-client-refactor*
*Completed: 2026-03-22*
