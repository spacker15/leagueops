---
phase: 02-hardcode-removal-event-context
plan: 03
subsystem: store
tags: [sec-04, sec-05, realtime, event-scoping, dependency-arrays, react-hooks]
dependency_graph:
  requires: [02-00]
  provides: [event-scoped-store, realtime-filters, currentDateRef-pattern]
  affects: [lib/store.tsx, __tests__/lib/store.test.tsx]
tech_stack:
  added: []
  patterns:
    [currentDateRef-pattern, useRef-for-stable-closure, non-null-assertion-in-guarded-callbacks]
key_files:
  created: []
  modified:
    - lib/store.tsx
    - __tests__/lib/store.test.tsx
decisions:
  - 'currentDateRef pattern prevents reconnect storm -- realtime dep array is [eventId] ONLY, date read from ref'
  - 'eventId! non-null assertions in callbacks are safe -- callbacks only called when app is fully initialized'
  - 'eventId ?? 0 in context value satisfies ContextValue eventId: number interface'
  - 'const eid = eventId inside useEffect closures provides TypeScript narrowing after null guard'
metrics:
  duration: '5 min'
  completed: '2026-03-22'
  tasks: 2
  files: 2
---

# Phase 02 Plan 03: Store.tsx Dependency Array Fixes and Realtime Event Scoping Summary

Event-scoped AppProvider with correct dependency arrays, realtime filters scoped to `event_id=eq.${eventId}`, and `currentDateRef` pattern preventing channel reconnect storms on date tab switches.

## Tasks Completed

| Task | Name                                                                          | Commit           | Files                        |
| ---- | ----------------------------------------------------------------------------- | ---------------- | ---------------------------- |
| 1    | Fix store.tsx -- remove default, dep arrays, realtime filters, currentDateRef | 5abb045, 41237be | lib/store.tsx                |
| 2    | Convert store tests from test.fails() to passing tests                        | d787459          | **tests**/lib/store.test.tsx |

## What Was Built

**Task 1: lib/store.tsx (8 dependency array fixes)**

Fix 1 -- Removed `eventId = 1` default from AppProvider signature. `eventId` is now `eventId?: number` with no default.

Fix 2 -- `loadAll` useEffect now has `if (!eventId) return` guard and dep array `[eventId]`. Fires on mount and re-fires when the active event changes.

Fix 3 -- Games reload useEffect has `if (!currentDate || !eventId) return` guard and dep array `[currentDate, eventId]`.

Fix 4 -- Added `currentDateRef` pattern (REVIEW FIX #3): `useRef(currentDate)` + sync effect. Realtime useEffect dep array is `[eventId]` ONLY. Games callback reads `currentDateRef.current` instead of closing over `currentDate`. Prevents channel teardown/recreation on every date tab switch.

Fix 5 -- `addLog` useCallback dep array: `[eventId]`

Fix 6 -- `refreshGames` useCallback dep array: `[currentDate, eventId]`

Fix 7 -- `triggerLightning` useCallback full dep audit: `[currentDate, eventId, addLog, refreshGames]`

Fix 8 -- `liftLightning` useCallback full dep audit: `[currentDate, eventId, state.weatherAlerts, addLog, refreshGames]`

All realtime `postgres_changes` listeners now include `filter: event_id=eq.${eventId}`.

**Task 2: **tests**/lib/store.test.tsx**

Converted all 4 `test.fails()` calls to regular `test()`. All pass:

- SEC-04: loadAll re-fires when eventId changes from 1 to 2
- SEC-05: realtime subscription includes event_id=eq.1 filter
- SEC-05: realtime channel torn down and rebuilt when eventId changes
- SEC-04: null guard -- loadAll does not call getEvent when eventId is undefined

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type errors from removing eventId default**

- **Found during:** Task 1 verification (`npm run type-check`)
- **Issue:** Removing `eventId = 1` default made `eventId` type `number | undefined`. All db function calls (which expect `number`) and the ContextValue interface (`eventId: number`) became type errors (10 total).
- **Fix:**
  - Used `const eid = eventId` narrowing inside useEffect closures (after null guard TypeScript doesn't narrow automatically)
  - Added `eventId!` non-null assertions in useCallback bodies (addLog, refreshGames, triggerLightning, liftLightning, addField) -- callbacks are only called when app is fully initialized
  - Used `eventId ?? 0` in context value to satisfy `ContextValue.eventId: number`
- **Files modified:** lib/store.tsx
- **Commit:** 41237be

## Key Decisions

1. **currentDateRef pattern (REVIEW FIX #3):** Realtime dep array is `[eventId]` ONLY. This prevents channel teardown/recreation when switching date tabs during a tournament -- a reconnect storm that would cause brief subscription gaps.

2. **eventId! non-null assertions:** Callbacks are exposed via context and can only be called by UI components that render after the app is loaded (eventId is defined). The assertions are semantically correct.

3. **eventId ?? 0 in context value:** 0 is not a valid event ID in production. Consumers receiving 0 won't get wrong data -- the store won't have loaded any data for 0 and the loading state will be true. The ContextValue interface remains `eventId: number` for backward compatibility.

4. **const eid = eventId narrowing:** TypeScript does not narrow `const` captures from an `if (!eventId) return` guard in the outer scope when accessed from a nested async function. Using `const eid = eventId` after the guard provides the narrowing TypeScript needs.

## Verification Results

- `npx vitest run __tests__/lib/store.test.tsx`: 4/4 tests pass
- `npm run type-check`: exits 0, no errors
- `grep -c "event_id=eq" lib/store.tsx`: 1 (the filter string `event_id=eq.${eid}`)
- `grep -c "currentDateRef" lib/store.tsx`: 4 (declaration, sync effect, ref assignment, usage in games callback)
- No empty dep arrays that close over eventId remain

## Known Stubs

None. All data paths are wired.

## Self-Check: PASSED

Files confirmed:

- lib/store.tsx: FOUND
- **tests**/lib/store.test.tsx: FOUND

Commits confirmed:

- 5abb045: FOUND (feat(02-03): fix store.tsx...)
- 41237be: FOUND (fix(02-03): resolve TypeScript errors...)
- d787459: FOUND (test(02-03): convert store.test.tsx...)
