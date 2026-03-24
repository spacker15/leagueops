---
phase: 08-schedule-change-request-workflow
plan: 02
subsystem: api
tags: [schedule, rescheduling, slot-suggestion, conflict-detection, pure-typescript, vitest, date-fns]

requires:
  - phase: 08-schedule-change-request-workflow
    provides: Phase 8 context and types (Game, Field, EventDate from types/index.ts)

provides:
  - Pure TypeScript slot suggestion engine (lib/engines/schedule-change.ts)
  - generateSlotSuggestions function with field/team conflict detection and proximity scoring
  - SlotSuggestion interface exported for use by API routes and UI components
  - 13 unit tests covering all engine behaviors

affects:
  - 08-03 (API route that calls generateSlotSuggestions)
  - 08-04 (Admin UI that consumes SlotSuggestion[] from API)

tech-stack:
  added: []
  patterns:
    - "Pure engine pattern: no Supabase client — accepts pre-fetched data, returns typed results"
    - "TDD: failing test committed before implementation (RED → GREEN)"
    - "Raw Date arithmetic for overlap math (getTime()) + date-fns for calendar-level comparisons"

key-files:
  created:
    - lib/engines/schedule-change.ts
    - __tests__/lib/engines/schedule-change.test.ts
  modified: []

key-decisions:
  - "overlaps() uses raw Date getTime() arithmetic per plan spec — only isSameDay/isAfter/differenceInCalendarDays use date-fns"
  - "teamAvailability empty array means all dates available (consistent with team_registrations schema from 06-01)"
  - "Field conflicts are hard filters (skip slot entirely); team conflicts are soft (mark availability false but include slot)"
  - "getCandidateTimes steps 08:00–18:00 by max(gameDurationMin, 60) min to ensure ≥1hr slots"
  - "Test fix: blocking game set needed 18:00 entry since candidate times include 18:00 and boundary check is exclusive"

patterns-established:
  - "Engine pattern: pure function, pre-fetched inputs, no Supabase dependency"
  - "Scoring: proximity points (100/50/25) + availability points (20 per team)"

requirements-completed: [SCR-04, SCR-05]

duration: 2min
completed: 2026-03-24
---

# Phase 8 Plan 02: Slot Suggestion Engine Summary

**Pure TypeScript slot suggestion engine with field/team conflict detection and proximity-based scoring (same-day +100, adjacent +50, 2-day +25, per-team availability +20 each)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T12:52:56Z
- **Completed:** 2026-03-24T12:55:16Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Built `generateSlotSuggestions` returning up to 5 ranked `SlotSuggestion` objects sorted by score descending
- Field conflict detection hard-filters slots (no double-booking suggestions ever returned)
- Team conflict detection soft-filters: marks `homeTeamAvailable`/`awayTeamAvailable` false but still includes slot for admin awareness
- Proximity scoring: same-day +100, 1-day +50, 2-day +25, plus +20 per team with the event date in their availability list
- Candidate times generated 08:00–18:00 in gameDuration steps (min 60 min)
- 13 unit tests with vi.useFakeTimers() to freeze "now" for deterministic future-date filtering

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing tests** - `3dc25a3` (test)
2. **Task 2: GREEN — implementation + test fix** - `c45f56b` (feat)

_Note: TDD tasks committed as test → feat. The test file was updated in the feat commit to correct a boundary condition in the blocking game set (needed 18:00 entry since getCandidateTimes includes 18:00 as a valid start time)._

## Files Created/Modified

- `lib/engines/schedule-change.ts` — Pure TypeScript slot suggestion engine; exports `generateSlotSuggestions` and `SlotSuggestion`
- `__tests__/lib/engines/schedule-change.test.ts` — 13 unit tests covering all behavioral specs from the plan

## Decisions Made

- `overlaps()` uses raw `Date.getTime()` arithmetic — only date-level functions (`isSameDay`, `isAfter`, `differenceInCalendarDays`) use date-fns, per plan spec
- `teamAvailability` empty array for a team means all dates available (consistent with Phase 6 team_registrations schema)
- Field conflicts are hard filters; team conflicts are soft (slot still returned, availability flags reflect reality)
- `getCandidateTimes` steps by `max(gameDurationMin, 60)` to guarantee at least hourly slots

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed boundary condition in field-conflict test**
- **Found during:** Task 2 (GREEN phase — running tests)
- **Issue:** Test generating blocking games only covered 08:00–17:00. `getCandidateTimes` includes 18:00 as a valid start; the 17:00 game ends at 18:00 (exclusive), so 18:00 candidate had no field conflict
- **Fix:** Added '18:00' to the blocking games time array in the test
- **Files modified:** `__tests__/lib/engines/schedule-change.test.ts`
- **Verification:** All 13 tests pass after fix
- **Committed in:** `c45f56b` (Task 2 commit)

**2. [Rule 1 - Bug] Added missing `afterEach` import for vi.useRealTimers()**
- **Found during:** Task 2 (type-check phase — `npx tsc --noEmit`)
- **Issue:** `afterEach` used in test but not imported from vitest
- **Fix:** Added `afterEach` to the vitest named import
- **Files modified:** `__tests__/lib/engines/schedule-change.test.ts`
- **Verification:** `npx tsc --noEmit` returns no errors
- **Committed in:** `c45f56b` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in test file, not engine)
**Impact on plan:** Both fixes were in the test file only. Engine implementation required no corrections.

## Issues Encountered

None beyond the two test-file corrections above.

## Known Stubs

None — the engine is fully wired. `generateSlotSuggestions` accepts real data and returns real results; no hardcoded or mocked values in the production code.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `generateSlotSuggestions` and `SlotSuggestion` are ready to import in the Phase 8 API route (08-03)
- The function signature matches the plan spec exactly: `game, allGames, fields, eventDates, teamAvailability, gameDurationMin`
- Type checking passes cleanly (`npx tsc --noEmit`)

---
*Phase: 08-schedule-change-request-workflow*
*Completed: 2026-03-24*
