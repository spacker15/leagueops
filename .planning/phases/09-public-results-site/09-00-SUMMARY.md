---
phase: 09-public-results-site
plan: 00
subsystem: testing
tags: [vitest, public-results, test-infrastructure, groupBy, standings, bracket]

# Dependency graph
requires: []
provides:
  - Vitest 4.1.0 test infrastructure in apps/public-results with node environment and @/ path alias
  - groupBy utility in apps/public-results/src/lib/utils.ts (extracted from page.tsx inline function)
  - 5 test files covering groupBy, schedule filtering, standings computation, bracket shape, QR URL construction
  - 16 passing tests providing Nyquist-compliant verification baseline for Phase 9
affects: [09-01, 09-02, 09-03, 09-04, 09-05]

# Tech tracking
tech-stack:
  added: [vitest@4.1.0, @testing-library/react, @testing-library/jest-dom]
  patterns: [vi.mock for supabase singleton to prevent init errors in unit tests, inline type definitions for types not yet exported from data.ts]

key-files:
  created:
    - apps/public-results/vitest.config.ts
    - apps/public-results/src/lib/utils.ts
    - apps/public-results/src/__tests__/lib/utils.test.ts
    - apps/public-results/src/__tests__/lib/data.test.ts
    - apps/public-results/src/__tests__/lib/standings.test.ts
    - apps/public-results/src/__tests__/components/bracket-shape.test.ts
    - apps/public-results/src/__tests__/components/qr-url.test.ts
  modified:
    - apps/public-results/package.json

key-decisions:
  - "vi.mock('@/lib/supabase') required in standings.test.ts — supabase singleton initializes at import time causing 'supabaseUrl is required' error without env vars set"
  - "BracketRound type defined inline in bracket-shape.test.ts since Plan 01 will add it to data.ts; avoids cross-plan dependency in Wave 0"
  - "Standing interface uses abbreviated fields (w/l/t/gf/ga/gd/pts) not verbose names (wins/losses/etc) — tests adapted to match actual data.ts implementation"

patterns-established:
  - "Pattern 1: All subsequent plans use 'cd apps/public-results && npx vitest run' as verification step"
  - "Pattern 2: Supabase mock pattern for unit tests — vi.mock('@/lib/supabase', () => ({ supabase: {} })) prevents singleton init errors"

requirements-completed: [PUB-02, PUB-03, PUB-04, PUB-05]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 9 Plan 00: Public Results Test Infrastructure Summary

**Vitest 4.1.0 configured in apps/public-results with groupBy utility and 16 passing tests across 5 test files covering standings, schedule filtering, bracket shape, QR URL, and groupBy**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T01:13:01Z
- **Completed:** 2026-03-25T01:15:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Vitest 4.1.0 installed and configured in apps/public-results with node environment and @/ path alias
- groupBy utility created in utils.ts (pure function extracted from page.tsx inline function)
- 5 test files with 16 total tests all passing — covers standings computation, schedule filtering, bracket shape, QR URL construction, and groupBy

## Task Commits

Each task was committed atomically:

1. **Task 1: Install vitest, create vitest.config.ts, groupBy utility** - `d16959e` (chore)
2. **Task 2: Create 5 test stubs** - `9bd5b82` (test)

## Files Created/Modified

- `apps/public-results/vitest.config.ts` - Vitest config with node environment and @/ alias
- `apps/public-results/src/lib/utils.ts` - groupBy utility for reuse across plans
- `apps/public-results/src/__tests__/lib/utils.test.ts` - 3 groupBy tests
- `apps/public-results/src/__tests__/lib/data.test.ts` - 3 schedule filtering tests
- `apps/public-results/src/__tests__/lib/standings.test.ts` - 4 computeStandings tests
- `apps/public-results/src/__tests__/components/bracket-shape.test.ts` - 3 bracket shape tests
- `apps/public-results/src/__tests__/components/qr-url.test.ts` - 3 QR URL construction tests
- `apps/public-results/package.json` - Added vitest + testing-library dev dependencies

## Decisions Made

- vi.mock for supabase module required in standings.test.ts because the supabase singleton initializes at import time and throws "supabaseUrl is required" without env vars
- BracketRound type defined inline in bracket-shape.test.ts (Plan 01 will add to data.ts) to avoid cross-wave dependency
- Adapted standings test to use actual Standing interface field names (w/l/t/gf/ga/gd) rather than verbose names from plan spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added vi.mock for supabase to prevent singleton init error in standings test**

- **Found during:** Task 2 (Create test stubs)
- **Issue:** standings.test.ts imports from `@/lib/data` which imports `@/lib/supabase` which creates a Supabase client at module load — throws "supabaseUrl is required" in test environment
- **Fix:** Added `vi.mock('@/lib/supabase', () => ({ supabase: {} }))` at top of standings.test.ts before import
- **Files modified:** apps/public-results/src/**tests**/lib/standings.test.ts
- **Verification:** All 16 tests pass including the 4 standings tests
- **Committed in:** 9bd5b82 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for test correctness. No scope creep.

## Issues Encountered

- Standing interface uses abbreviated field names (w/l/t/gf/ga/gd/pts) in data.ts, not the verbose names (wins/losses/ties/points_for/points_against/goal_diff) in the plan spec — tests adapted to actual implementation

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Test infrastructure ready for all Phase 9 plans to use `cd apps/public-results && npx vitest run` in their verify steps
- groupBy utility available for import from `@/lib/utils` in all subsequent plans
- Supabase mock pattern established for any tests importing from `@/lib/data`

---

_Phase: 09-public-results-site_
_Completed: 2026-03-25_
