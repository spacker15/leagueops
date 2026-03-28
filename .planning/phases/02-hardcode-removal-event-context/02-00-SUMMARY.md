---
phase: 02-hardcode-removal-event-context
plan: '00'
subsystem: store/testing
tags: [testing, behavioral-scaffold, nyquist, sec-04, sec-05]
dependency_graph:
  requires: []
  provides: [store-behavioral-test-scaffold]
  affects: [lib/store.tsx]
tech_stack:
  added: []
  patterns: [test.fails-scaffold, vi.mock-module-mock, react-testing-library]
key_files:
  created:
    - __tests__/lib/store.test.tsx
  modified: []
decisions:
  - All 4 test cases use test.fails() because current store has broken dep arrays and no realtime filters -- suite stays green while documenting expected behaviors
  - Null guard test (SEC-04) converted to test.fails() because current store defaults eventId=1 and calls getEvent even when undefined is passed
metrics:
  duration: 2 min
  completed: '2026-03-22T22:23:53Z'
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 02 Plan 00: Store Behavioral Test Scaffold Summary

Vitest behavioral scaffold for `lib/store.tsx` using `test.fails()` to document SEC-04 (loadAll re-fires on eventId change) and SEC-05 (realtime filter scoping and channel teardown).

## Tasks Completed

| Task | Name                                  | Commit  | Files                          |
| ---- | ------------------------------------- | ------- | ------------------------------ |
| 1    | Create store behavioral test scaffold | 6285c22 | `__tests__/lib/store.test.tsx` |

## What Was Built

Created `__tests__/lib/store.test.tsx` with 4 behavioral tests that document the expected post-fix behavior of `lib/store.tsx`. All 4 tests use `test.fails()` so the suite exits 0 now (Wave 0), while clearly expressing what Plan 03 must implement:

1. **SEC-04 loadAll re-fire** — documents that `loadAll` useEffect dep array `[]` must become `[eventId]`
2. **SEC-05 realtime filter** — documents that each `.on('postgres_changes', ...)` call must include `filter: 'event_id=eq.{eventId}'`
3. **SEC-05 channel teardown** — documents that the realtime useEffect dep array `[currentDate]` must become `[eventId, currentDate]`
4. **SEC-04 null guard** — documents that `loadAll` must not fire when `eventId` is undefined

**Mock strategy:**

- `@/lib/db` — all functions return empty arrays/null via `vi.mock`
- `@/supabase/client` — `createClient()` returns a stub with `channel()`, `on()`, `subscribe()`, `removeChannel()` as `vi.fn()` stubs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] All 4 tests use test.fails() instead of just 3**

- **Found during:** Task 1 verification run
- **Issue:** The 4th test (SEC-04 null guard) was written as a regular `test()` expecting `getEvent` not to be called. The test failed because the current store defaults `eventId=1` and always calls `getEvent(1)` regardless of `undefined` input. The plan acknowledged "either outcome is acceptable."
- **Fix:** Converted the 4th test to `test.fails()` so the entire suite exits 0 as required by acceptance criteria. Added a comment documenting that Plan 03 will implement the guard.
- **Files modified:** `__tests__/lib/store.test.tsx`
- **Commit:** 6285c22

## Self-Check: PASSED

- [x] `__tests__/lib/store.test.tsx` exists
- [x] Commit 6285c22 verified in git log
- [x] `npx vitest run __tests__/lib/store.test.tsx` exits 0 (4 expected fail)
- [x] File contains `import { AppProvider, useApp } from '@/lib/store'`
- [x] File contains 4 `test.fails()` calls
- [x] File contains `event_id=eq.1`
- [x] File contains `SEC-04` and `SEC-05` in test names
- [x] File contains `vi.mock('@/lib/db')`
- [x] File contains `vi.mock('@/supabase/client')`
