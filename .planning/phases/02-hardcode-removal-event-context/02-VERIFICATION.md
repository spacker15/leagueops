---
phase: 02-hardcode-removal-event-context
verified: 2026-03-22T19:30:00Z
status: gaps_found
score: 12/13 must-haves verified
re_verification: false
gaps:
  - truth: 'Full test suite passes (npm run test exits 0)'
    status: failed
    reason: '2 tests fail in __tests__/app/api/referee-engine.integration.test.ts — the test was written for the old 2-argument runRefereeEngine(eventDateId, sb) signature but the route now calls runRefereeEngine(eventDateId, eventId, sb) after Plan 02 changes. Test sends no event_id so gets a 400 (not the 500 it expects), and asserts the old 2-arg call signature.'
    artifacts:
      - path: '__tests__/app/api/referee-engine.integration.test.ts'
        issue: 'Test 1 sends { event_date_id: 42 } without event_id — now gets 400 and asserts runRefereeEngine(42, mockSb) which is the old 2-arg call. Test 3 sends { event_date_id: 1 } without event_id — gets 400 not 500.'
    missing:
      - 'Update test 1 to send { event_date_id: 42, event_id: 1 } and assert runRefereeEngine(42, 1, mockSb)'
      - 'Update test 3 to send { event_date_id: 1, event_id: 1 } so it reaches the engine and can return 500'
human_verification:
  - test: 'Switch events in the running app and verify data isolation'
    expected: 'After switching to a different event workspace, all displayed data (games, teams, referees, incidents) reloads and reflects only the newly selected event. No data from the previous event bleeds through.'
    why_human: 'Cannot verify runtime behavior of the realtime teardown/resubscribe cycle or the loadAll re-fire without a running app with multiple events in the database.'
  - test: 'Navigate to /register?event_id=2 and verify the page does not blank on initial load'
    expected: 'RegisterPage loads with a Suspense fallback briefly, then shows the registration form scoped to event 2. No hydration errors in the browser console.'
    why_human: 'useSearchParams + Suspense boundary behavior requires a browser render to confirm — cannot verify statically.'
  - test: 'Open the app, wait for initial load, then switch date tabs rapidly'
    expected: 'No reconnect storms in the browser network tab — the WebSocket connection to Supabase Realtime is NOT torn down and recreated when switching date tabs. Only switching events should reconnect.'
    why_human: 'The currentDateRef pattern prevents reconnect storms but this can only be confirmed by observing network traffic in DevTools.'
---

# Phase 02: Hardcode Removal & Event Context Verification Report

**Phase Goal:** Eliminate all ~60 hardcoded `event_id = 1` references and fix the `loadAll` dependency array bug so the app correctly isolates data per event when switching workspaces.
**Verified:** 2026-03-22T19:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                              | Status   | Evidence                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Zero `EVENT_ID` constants remain in any engine file                                | VERIFIED | `grep -rn "EVENT_ID" lib/engines/` returns zero matches                                                                                                                        |
| 2   | All engine entry-point functions accept `eventId` as a required parameter          | VERIFIED | All 5 engine files contain `eventId: number` in signatures; confirmed in referee.ts:86, field.ts:79, weather.ts:89, unified.ts:48, rules.ts:47                                 |
| 3   | Rules cache is keyed per-event, not global                                         | VERIFIED | `_cacheByEvent = new Map<number, ...>()` at rules.ts:14; `invalidateRulesCache` exported at rules.ts:63                                                                        |
| 4   | All API routes return 400 when event_id is missing                                 | VERIFIED | All 16 data routes and 4 engine routes have `if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })`                                          |
| 5   | No API route file contains `?? '1'` or `?? 1` as event_id fallback                 | VERIFIED | Full grep across all production API files returns zero matches                                                                                                                 |
| 6   | Rules cache is invalidated after POST/PATCH mutations in rules route               | VERIFIED | `invalidateRulesCache(` called 3 times in app/api/rules/route.ts (lines 63, 131, 161)                                                                                          |
| 7   | `loadAll` re-fires when eventId prop changes                                       | VERIFIED | store.tsx line 255: `}, [eventId])` dep array; null guard at line 211; store test "SEC-04: loadAll re-fires" passes                                                            |
| 8   | Realtime subscriptions include `event_id` filter on each postgres_changes listener | VERIFIED | store.tsx line 281: `const filter = \`event_id=eq.${eid}\`` applied to all 4 listeners; 1 occurrence confirmed                                                                 |
| 9   | Realtime channel torn down and recreated when eventId changes                      | VERIFIED | store.tsx realtime dep array `[eventId]` at line 311; `sb.removeChannel(sub)` in cleanup; store test "SEC-05: channel torn down" passes                                        |
| 10  | Realtime channel does NOT tear down on date change alone (currentDateRef pattern)  | VERIFIED | `currentDateRef = useRef(currentDate)` at store.tsx:262; dep array is `[eventId]` ONLY — not `[eventId, currentDate]`                                                          |
| 11  | `AppProvider` no longer defaults `eventId` to 1                                    | VERIFIED | store.tsx line 202-205: `function AppProvider({ children, eventId }: { children: React.ReactNode; eventId?: number })` — no `= 1` default                                      |
| 12  | No component file contains hardcoded `event_id: 1`, `?? 1`, or `event_id = 1`      | VERIFIED | Full grep across all component files returns zero matches; components use `useApp()` eventId, `userRole?.event_id`, or URL params                                              |
| 13  | Full test suite passes                                                             | FAILED   | 2 tests fail in `__tests__/app/api/referee-engine.integration.test.ts` — stale test not updated to match new 3-argument `runRefereeEngine(eventDateId, eventId, sb)` signature |

**Score: 12/13 truths verified**

---

### Required Artifacts

| Artifact                                               | Expected                                                                     | Status   | Details                                                                                                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `__tests__/lib/store.test.tsx`                         | Behavioral test scaffold for SEC-04 and SEC-05                               | VERIFIED | 197 lines, 4 tests, all pass; no `test.fails()` remaining                                                                                              |
| `lib/engines/rules.ts`                                 | Per-event rules cache and eventId-parameterized convenience functions        | VERIFIED | `_cacheByEvent` Map at line 14; `getRules(eventId, sb)` at line 47; `invalidateRulesCache` at line 63                                                  |
| `lib/engines/referee.ts`                               | Referee engine with eventId param                                            | VERIFIED | `eventId: number` at line 86; no `EVENT_ID` constant                                                                                                   |
| `lib/engines/field.ts`                                 | Field engine with eventId param                                              | VERIFIED | `eventId: number` at line 79; `getSchedulingRules(eventId, sb)` at line 85                                                                             |
| `lib/engines/weather.ts`                               | Weather engine with eventId param                                            | VERIFIED | `eventId: number` at line 89                                                                                                                           |
| `lib/engines/unified.ts`                               | Unified engine passing eventId to sub-engines                                | VERIFIED | `eventId: number` at line 48; calls `runRefereeEngine(eventDateId, eventId, sb)` and `runFieldConflictEngine(eventDateId, eventId, sb)` at lines 67-68 |
| `app/api/referee-engine/route.ts`                      | Referee engine trigger with eventId forwarding                               | VERIFIED | 400 guard present; `runRefereeEngine(Number(event_date_id), Number(event_id), sb)`                                                                     |
| `app/api/rules/route.ts`                               | Rules CRUD with dynamic event_id and cache invalidation                      | VERIFIED | `invalidateRulesCache` called 3 times; 400 guards present                                                                                              |
| `lib/store.tsx`                                        | Event-scoped AppProvider with correct dependency arrays and realtime filters | VERIFIED | `event_id=eq.${eid}` filter; `currentDateRef`; `[eventId]` dep arrays; no `eventId = 1` default                                                        |
| `components/engine/CommandCenter.tsx`                  | CommandCenter with dynamic eventId and eventDateId guard                     | VERIFIED | `if (!currentDate) return null` at line 61; `event_id: eventId` in fetch payloads                                                                      |
| `components/auth/RegisterPage.tsx`                     | RegisterPage reading event_id from URL with Suspense boundary                | VERIFIED | `Suspense` at line 1368; `useSearchParams` at line 4; `searchParams.get('event_id')` at line 79                                                        |
| `components/checkin/CheckInTab.tsx`                    | QR URLs using event slug                                                     | VERIFIED | `eventSlug` present; no `/checkin/1/` or `event_id=1` in QR URL                                                                                        |
| `components/auth/RefereePortal.tsx`                    | Portal with userRole.event_id                                                | VERIFIED | `const portalEventId = userRole?.event_id` at line 34                                                                                                  |
| `components/AppShell.tsx`                              | AppShell passing eventId down without null guard                             | VERIFIED | `const { state, eventId } = useApp()` at line 59; no `return null`; passes `eventId` to children                                                       |
| `__tests__/app/api/referee-engine.integration.test.ts` | Integration test matching current 3-arg route signature                      | STUB     | Test uses old 2-arg `runRefereeEngine(42, mockSb)` assertion; test body sends no `event_id` field — causes 400 not expected 200/500                    |

---

### Key Link Verification

| From                                  | To                                | Via                                                           | Status   | Details                                                                             |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `__tests__/lib/store.test.tsx`        | `lib/store.tsx`                   | `import { AppProvider }`                                      | VERIFIED | Import confirmed; all 4 tests pass                                                  |
| `lib/engines/unified.ts`              | `lib/engines/referee.ts`          | `runRefereeEngine(eventDateId, eventId, sb)`                  | VERIFIED | Line 67: `runRefereeEngine(eventDateId, eventId, sb)`                               |
| `lib/engines/unified.ts`              | `lib/engines/field.ts`            | `runFieldConflictEngine(eventDateId, eventId, sb)`            | VERIFIED | Line 68: `runFieldConflictEngine(eventDateId, eventId, sb)`                         |
| `lib/engines/field.ts`                | `lib/engines/rules.ts`            | `getSchedulingRules(eventId, sb)`                             | VERIFIED | Line 85: `const rules = await getSchedulingRules(eventId, sb)`                      |
| `app/api/referee-engine/route.ts`     | `lib/engines/referee.ts`          | `runRefereeEngine(eventDateId, eventId, sb)`                  | VERIFIED | Route confirmed; integration test FAILS due to stale assertion                      |
| `app/api/field-engine/route.ts`       | `lib/engines/field.ts`            | `runFieldConflictEngine(eventDateId, eventId, sb)`            | VERIFIED | 400 guard present; confirmed via grep                                               |
| `app/api/weather-engine/route.ts`     | `lib/engines/weather.ts`          | `runWeatherEngine(complexId, apiKey, eventId, sb)`            | VERIFIED | 400 guard present; confirmed via grep                                               |
| `app/api/unified-engine/route.ts`     | `lib/engines/unified.ts`          | `runUnifiedEngine(event_date_id, event_id, sb)`               | VERIFIED | Line 25: `runUnifiedEngine(event_date_id, event_id, sb)`                            |
| `app/api/rules/route.ts`              | `lib/engines/rules.ts`            | `invalidateRulesCache(event_id) after mutations`              | VERIFIED | 3 calls to `invalidateRulesCache(Number(event_id))`                                 |
| `lib/store.tsx`                       | supabase realtime                 | `channel('leagueops-realtime').on({ filter: event_id=eq.N })` | VERIFIED | `const filter = \`event_id=eq.${eid}\`` applied to all 4 listeners                  |
| `lib/store.tsx`                       | `lib/db`                          | `loadAll calls db functions with eventId`                     | VERIFIED | `[eventId]` dep array at line 255; null guard at line 211                           |
| `components/engine/CommandCenter.tsx` | `app/api/referee-engine/route.ts` | `fetch with event_id in body`                                 | VERIFIED | Line 146: `body: JSON.stringify({ event_date_id: eventDateId, event_id: eventId })` |
| `components/checkin/CheckInTab.tsx`   | QR code URL                       | `eventSlug in URL path`                                       | VERIFIED | `eventSlug` present in component                                                    |
| `components/auth/RegisterPage.tsx`    | URL search params                 | `useSearchParams().get('event_id') wrapped in Suspense`       | VERIFIED | Line 79: `searchParams.get('event_id')`; Suspense at line 1368                      |

---

### Data-Flow Trace (Level 4)

Not applicable for this phase. Phase 02 targets hardcode removal and wiring correctness, not dynamic data rendering components. The key data flows verified are: API routes correctly forwarding `eventId` to engine functions, store correctly re-firing `loadAll` with new `eventId`, and realtime subscriptions filtering by `eventId`.

---

### Behavioral Spot-Checks

| Behavior                                     | Command                                                               | Result               | Status |
| -------------------------------------------- | --------------------------------------------------------------------- | -------------------- | ------ |
| store.test.tsx — all 4 behavioral tests pass | `npx vitest run __tests__/lib/store.test.tsx`                         | 4/4 passed           | PASS   |
| All 6 engine test files pass (53 tests)      | `npx vitest run __tests__/lib/engines/`                               | 53/53 passed         | PASS   |
| referee-engine integration test              | `npx vitest run __tests__/app/api/referee-engine.integration.test.ts` | 2/3 failed           | FAIL   |
| Full test suite                              | `npx vitest run`                                                      | 71/73 passed, 2 fail | FAIL   |

---

### Requirements Coverage

| Requirement | Source Plan(s)                    | Description                                                                                                      | Status    | Evidence                                                                                                                                                                                            |
| ----------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-04      | 02-00, 02-01, 02-02, 02-03, 02-04 | All hardcoded `event_id = 1` references (~60 locations) replaced with dynamic event_id from context/props/params | SATISFIED | Zero matches across all 4 tightened grep patterns; `[eventId]` dep arrays in store; all engine signatures parameterized                                                                             |
| SEC-05      | 02-00, 02-03, 02-04               | Real-time subscriptions scoped to current event_id                                                               | SATISFIED | `event_id=eq.${eid}` filter on all 4 realtime listeners; `[eventId]` dep array ensures teardown/resubscribe on event switch; `currentDateRef` prevents reconnect storms; 2 passing behavioral tests |

Both requirements are satisfied by the implementation evidence. The failing integration test does not affect the requirement satisfaction determination — SEC-04 and SEC-05 correctness is verified by the store behavioral tests, grep patterns, and manual code inspection.

---

### Anti-Patterns Found

| File                                                   | Line | Pattern                                                                           | Severity | Impact                                                 |
| ------------------------------------------------------ | ---- | --------------------------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| `__tests__/app/api/referee-engine.integration.test.ts` | 49   | `expect(runRefereeEngine).toHaveBeenCalledWith(42, mockSb)` — old 2-arg signature | Warning  | Test suite does not exit 0; false failure signal in CI |
| `__tests__/app/api/referee-engine.integration.test.ts` | 77   | `body: JSON.stringify({ event_date_id: 1 })` — no `event_id` in body              | Warning  | Route returns 400 not 500; test assertion fails        |

No anti-patterns found in production code (lib/, app/api/, components/).

---

### Human Verification Required

#### 1. Event Switching Data Isolation

**Test:** In the running app, with two events configured in the database, switch the active workspace from Event A to Event B using the event selector.
**Expected:** All displayed data (games schedule, teams list, referees, incidents, weather alerts) reloads and shows only Event B data. No Event A data remains visible. The network tab shows Supabase realtime WebSocket disconnects the old subscription and creates a new channel.
**Why human:** Cannot verify runtime React state transitions, realtime WebSocket channel lifecycle, or cross-event data bleed without a running app connected to a live database with multiple seeded events.

#### 2. RegisterPage Suspense Behavior

**Test:** Navigate to `/register?event_id=2` in a browser. Observe the page during initial load.
**Expected:** Page renders without hydration errors. A brief loading state (Suspense fallback) may appear, then the registration form displays. Browser console shows no warnings about `useSearchParams` needing a Suspense boundary.
**Why human:** Next.js 14 App Router Suspense boundary behavior for `useSearchParams` can only be confirmed in a full browser render — static analysis cannot verify that the Suspense boundary correctly wraps the streaming boundary.

#### 3. Date Tab Switch — No Reconnect Storm

**Test:** Open the app, wait for full load, then click through date tabs (Day 1 → Day 2 → Day 3) rapidly while watching the browser DevTools Network tab filtered to WebSocket traffic.
**Expected:** No new WebSocket connections or channel resubscriptions when switching date tabs. The `leagueops-realtime` channel stays open throughout. Only switching to a different event should trigger channel teardown and recreation.
**Why human:** The `currentDateRef` pattern is designed to prevent this — but reconnect storm prevention can only be confirmed by observing real WebSocket traffic in DevTools, not via static code analysis.

---

### Gaps Summary

**1 gap blocking test suite green:**

The integration test `__tests__/app/api/referee-engine.integration.test.ts` was written during Phase 01 for the old 2-argument `runRefereeEngine(eventDateId, sb)` signature. Phase 02 (Plan 02) updated the route to require `event_id` in the body and call `runRefereeEngine(eventDateId, eventId, sb)` with 3 arguments. The integration test was not updated to match.

The SUMMARY.md for Plan 04 claims this is a "pre-existing" failure (from before Plan 04's changes), which is technically true — it was already broken after Plan 02's route changes. However, it is NOT pre-existing relative to the phase as a whole: it is a gap introduced by Plan 02 that no subsequent plan repaired.

**Fix required:**

- In test 1: Change request body to `{ event_date_id: 42, event_id: 1 }` and update the assertion to `expect(runRefereeEngine).toHaveBeenCalledWith(42, 1, mockSb)`
- In test 3: Change request body to `{ event_date_id: 1, event_id: 1 }` so it reaches the engine and can simulate a 500 error

This is a narrow fix — approximately 4 lines changed in one test file.

---

_Verified: 2026-03-22T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
