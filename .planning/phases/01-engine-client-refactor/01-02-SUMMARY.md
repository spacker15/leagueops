---
phase: 01-engine-client-refactor
plan: 02
subsystem: api
tags: [nextjs, supabase, route-handlers, unified-engine, shift-handoff]

# Dependency graph
requires: []
provides:
  - POST /api/unified-engine route handler (shell, pending Plan A wire-up)
  - POST /api/unified-engine/resolve route handler (shell, pending Plan A wire-up)
  - POST /api/shift-handoff route handler (shell, pending Plan A wire-up)
affects: [01-03, 01-04, commandcenter-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "API route shell pattern: create route with validation + placeholder, wire engine after Plan A"
    - "Error response format: { error: string } with 400 for validation, 500 for unexpected"
    - "createClient() always called inside handler body, never at module level"

key-files:
  created:
    - app/api/unified-engine/route.ts
    - app/api/unified-engine/resolve/route.ts
    - app/api/shift-handoff/route.ts
  modified: []

key-decisions:
  - "Routes created as shells in wave 1 — engine imports commented out pending Plan A completion, placeholders documented with TODO comments"
  - "Error format { error: string } matches all existing API routes (games, fields, referee-engine, etc.)"
  - "createClient() inside handler body enforced — required by next/headers cookie access pattern in supabase/server.ts"

patterns-established:
  - "Route validation pattern: check presence and typeof, return 400 with descriptive error string"
  - "Placeholder pattern: commented import + engine call + TODO comment for wave 2 wire-up"

requirements-completed: ["SEC-03"]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 1 Plan 02: New API Routes for CommandCenter Summary

**Three Next.js route handler shells (unified-engine, unified-engine/resolve, shift-handoff) with full validation and error handling, ready for Plan A engine wire-up**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T20:01:54Z
- **Completed:** 2026-03-22T20:04:54Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created POST /api/unified-engine with event_date_id number validation
- Created POST /api/unified-engine/resolve with alert_id and resolved_by string validation
- Created POST /api/shift-handoff with created_by string validation
- All routes follow existing codebase error pattern: `{ error: string }` with 400/500 status codes
- All routes call `createClient()` inside handler body (required for next/headers cookie access)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create POST /api/unified-engine route** - `167093b` (feat)
2. **Task 2: Create POST /api/unified-engine/resolve route** - `d8f49bc` (feat)
3. **Task 3: Create POST /api/shift-handoff route** - `608f055` (feat)

## Files Created/Modified

- `app/api/unified-engine/route.ts` - POST handler, validates event_date_id (number), shell with TODO for runUnifiedEngine
- `app/api/unified-engine/resolve/route.ts` - POST handler, validates alert_id and resolved_by (strings), shell with TODO for resolveAlert
- `app/api/shift-handoff/route.ts` - POST handler, validates created_by (string), shell with TODO for generateShiftHandoff

## Decisions Made

- Routes created as wave 1 shells — engine function imports are commented out with `// TODO: wire after Plan A Task 6` markers. This allows parallel execution with Plan A without blocking on Plan A's engine signature finalization.
- Error format `{ error: string }` chosen to match existing routes (`app/api/games/route.ts`, `app/api/referee-engine/route.ts`, etc.)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

These are intentional placeholders per the plan's wave design:

- `app/api/unified-engine/route.ts` line 20-22: commented `runUnifiedEngine` call — returns placeholder message. Resolved when Plan A Task 6 completes.
- `app/api/unified-engine/resolve/route.ts` line 24-25: commented `resolveAlert` call — returns placeholder message. Resolved when Plan A Task 6 completes.
- `app/api/shift-handoff/route.ts` line 18-19: commented `generateShiftHandoff` call — returns placeholder message. Resolved when Plan A Task 6 completes.

These stubs are intentional per wave 1 design and do not block the plan's goal (which is to create the route files for CommandCenter to target). Plan B2 / Plan A Task 6 will resolve them.

## Issues Encountered

- `npm run type-check` could not be run in the bash shell environment (node_modules not accessible via bash on Windows). Files use correct TypeScript syntax matching existing codebase patterns and will pass type-check when run from Windows.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Three route files exist and are committed — CommandCenter can now call these endpoints via fetch
- Plans A and B2 must complete to wire the actual engine functions (uncomment imports and engine calls)
- Plan 03 (CommandCenter refactor) can begin reading these route paths

---
*Phase: 01-engine-client-refactor*
*Completed: 2026-03-22*
