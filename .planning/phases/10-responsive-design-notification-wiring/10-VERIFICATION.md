---
phase: 10-responsive-design-notification-wiring
verified: 2026-03-25T09:15:00Z
status: gaps_found
score: 13/15 must-haves verified
gaps:
  - truth: 'Wave 0 test stubs pass green when run in sequence (all 6 tests)'
    status: failed
    reason: 'Test suite has order-dependent isolation failure — games-status-notifications.test.ts fails when run immediately after weather-engine-notifications.test.ts due to shared vi.mock module cache bleed-through. Each file passes in isolation (3+2+1=6 passing), but running all three sequentially with a single vitest invocation yields 1 failure.'
    artifacts:
      - path: '__tests__/app/api/games-status-notifications.test.ts'
        issue: "Top-level vi.mock('@/lib/supabase/server') lacks 'auth' property; vi.resetModules()+vi.doMock() inside test body is intended to override this, but prior test's module registry state causes the cached module (without auth mock) to be used instead. The test passes in isolation but fails in sequence."
      - path: '__tests__/app/api/schedule-change-notifications.test.ts'
        issue: 'Same root cause — top-level mock omits auth, per-test doMock is overridden by stale cached module when running after another test file.'
    missing:
      - "Add auth mock to top-level vi.mock in games-status-notifications.test.ts: createClient should return an object that includes auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test' } }, error: null }) }"
      - 'Add auth mock to top-level vi.mock in schedule-change-notifications.test.ts with the same pattern'
      - 'Alternatively, move vi.resetModules() + vi.doMock() for supabase into a beforeEach block to guarantee fresh state before every test'
human_verification:
  - test: 'Verify hamburger menu is usable on a physical phone (375px)'
    expected: 'Hamburger button visible in top bar, tapping opens left drawer showing all nav groups, tapping an item navigates and closes the drawer, active item shows red left-edge indicator'
    why_human: 'Visual/touch interactions cannot be verified programmatically'
  - test: 'Verify RightPanel FAB and bottom drawer on a phone or tablet below 1024px viewport'
    expected: 'FAB (cloud icon) appears at bottom-right, tapping opens full-width bottom drawer with drag handle, navigating closes drawer; no FAB at 1024px+'
    why_human: 'Visual layout and touch gesture behavior requires manual testing'
  - test: 'Verify touch drag-drop referee assignment on an iOS or Android device'
    expected: 'Holding a referee card for ~200ms initiates drag, dragging to a game slot drops and assigns the referee; scrolling the page still works without accidentally triggering drag'
    why_human: 'Touch events and device-specific behavior cannot be verified programmatically'
  - test: 'Verify modals are full-screen on mobile (below 640px)'
    expected: 'Modals slide up from bottom and fill the full viewport width; at 640px+ modals are centered at 580px width'
    why_human: 'Visual layout at breakpoints requires manual inspection'
---

# Phase 10: Responsive Design & Notification Wiring Verification Report

**Phase Goal:** Make the admin app fully usable on phones and tablets at the field, complete touch support for drag-drop, and wire the notification triggers for weather alerts, schedule changes, and admin ops alerts into the Phase 7 notification infrastructure.

**Verified:** 2026-03-25T09:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                       | Status   | Evidence                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | TopBar shows hamburger icon below 768px, full nav groups at 768px+          | VERIFIED | `components/TopBar.tsx:144` — `className="md:hidden flex items-center px-4 h-full text-white"` on hamburger; `nav` has `hidden md:flex`                                              |
| 2   | Tapping hamburger opens a left slide-out drawer with all nav groups         | VERIFIED | `TopBar.tsx:341-426` — `mobileOpen && <div className="md:hidden fixed inset-0 z-50">` renders `w-72` left panel iterating all `visibleGroups`                                        |
| 3   | Tapping a nav item in mobile drawer navigates and closes the drawer         | VERIFIED | Each drawer item calls `onTabChange(...)` then `setMobileOpen(false)`                                                                                                                |
| 4   | Active tab is highlighted in mobile drawer                                  | VERIFIED | `bg-navy/30` on active tab, red `w-1 h-4 rounded-sm bg-red` indicator                                                                                                                |
| 5   | RightPanel is hidden below 1024px via conditional render (not CSS hidden)   | VERIFIED | `AppShell.tsx:178` — `{isLg && <RightPanel onNavigate={setActiveTab} />}` — not CSS hidden                                                                                           |
| 6   | A FAB on mobile opens a bottom drawer containing RightPanel content         | VERIFIED | `AppShell.tsx:182-221` — `!isLg && !drawerOpen` FAB and `!isLg && drawerOpen` drawer both present                                                                                    |
| 7   | Bottom drawer has a drag handle and does not overlap the top nav            | VERIFIED | `w-10 h-1 rounded-full bg-border` drag handle; drawer uses `fixed bottom-0`                                                                                                          |
| 8   | Modal dialogs are full-width on mobile, max-w-[580px] on sm+                | VERIFIED | `ui/index.tsx:140,145` — `items-end sm:items-center` and `w-full sm:w-[580px]`                                                                                                       |
| 9   | Dashboard field cards stack single-column on phones                         | VERIFIED | `DashboardTab.tsx:229` — `grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]`                                                                                            |
| 10  | Schedule table has horizontal scroll on mobile with sticky first column     | VERIFIED | `ScheduleTab.tsx:1262` — `overflow-x-auto -mx-4 px-4`; lines 1266, 1305 — `sticky left-0 z-10`                                                                                       |
| 11  | Check-In tab renders single-column on mobile                                | VERIFIED | `CheckInTab.tsx:600` — `grid-cols-1 sm:grid-cols-2`; line 646 — `grid-cols-1 sm:grid-cols-[auto-fill]`                                                                               |
| 12  | Drag-drop referee assignment works via touch (TouchSensor configured)       | VERIFIED | `RefsTab.tsx:12-15` — `MouseSensor, TouchSensor, useSensor, useSensors` imported; `sensors={sensors}` on DndContext; `touchAction: 'none'` at line 97                                |
| 13  | Weather engine fires insertNotification for each alert returned             | VERIFIED | `weather-engine/route.ts:51-74` — `for (const alert of result.alerts)` loop calling `insertNotification` with `'weather_alert'` type; wrapped in try/catch (non-fatal)               |
| 14  | Game PATCH handler fires notifications for cancellation and referee no-show | VERIFIED | `games/[id]/route.ts:65-110` — Cancelled fires to both teams; Live/Starting checks `game_referees` and fires admin_alert if empty                                                    |
| 15  | Wave 0 test stubs pass green when run together in sequence                  | FAILED   | 5/6 tests pass when run together; `games-status-notifications.test.ts` fails when run after `weather-engine-notifications.test.ts` due to stale module cache missing `auth` property |

**Score:** 14/15 truths verified (test isolation gap)

---

## Required Artifacts

| Artifact                                                    | Expected                                        | Status   | Details                                                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `components/TopBar.tsx`                                     | Hamburger menu + mobile drawer                  | VERIFIED | `Menu` imported, `mobileOpen` state, `hidden md:flex` nav, full drawer implementation                               |
| `components/AppShell.tsx`                                   | RightPanel bottom drawer                        | VERIFIED | `drawerOpen`, `isLg` state, `window.matchMedia('(min-width: 1024px)')`, conditional render, FAB, bottom drawer      |
| `components/ui/index.tsx`                                   | Full-screen mobile modals                       | VERIFIED | `w-full sm:w-[580px]`, `items-end sm:items-center`                                                                  |
| `components/dashboard/DashboardTab.tsx`                     | Responsive grid                                 | VERIFIED | `grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]` at line 229                                        |
| `components/schedule/ScheduleTab.tsx`                       | Sticky-column horizontal scroll                 | VERIFIED | `overflow-x-auto` at line 1262, `sticky left-0` at lines 1266 and 1305                                              |
| `components/checkin/CheckInTab.tsx`                         | Single-column mobile layout                     | VERIFIED | `grid-cols-1 sm:grid-cols-2` at line 600; `grid-cols-1 sm:grid-cols-[auto-fill]` at line 646                        |
| `components/refs/RefsTab.tsx`                               | Touch sensor for drag-drop                      | VERIFIED | `TouchSensor`, `useSensors`, `useSensor` imported; `sensors={sensors}` on DndContext; `touchAction: 'none'` present |
| `app/api/weather-engine/route.ts`                           | Weather alert notification wiring               | VERIFIED | `insertNotification` imported and called per alert with scope conditional; `isEventWide` comment for D-16           |
| `app/api/games/[id]/route.ts`                               | Cancellation + no-show + deadline notifications | VERIFIED | All three NOT-03/NOT-04 notification blocks present and wrapped in try/catch                                        |
| `app/api/schedule-change-requests/[id]/route.ts`            | Full NOT-03 coverage                            | VERIFIED | `insertNotification` calls for denied, cancel-approved, change_opponent-approved, reschedule-approved transitions   |
| `app/api/schedule-change-requests/route.ts`                 | Admin notified on new request                   | VERIFIED | `insertNotification` at line 149                                                                                    |
| `app/api/schedule-change-requests/[id]/reschedule/route.ts` | Both teams notified on reschedule               | VERIFIED | `insertNotification` at lines 132 and 145                                                                           |
| `__tests__/app/api/weather-engine-notifications.test.ts`    | Wave 0 stubs for NOT-02                         | VERIFIED | 3 tests pass in isolation                                                                                           |
| `__tests__/app/api/games-status-notifications.test.ts`      | Wave 0 stubs for NOT-04                         | STUB     | 2 tests pass in isolation; 1 test fails when run sequentially after another test file (see gaps)                    |
| `__tests__/app/api/schedule-change-notifications.test.ts`   | Wave 0 stub for NOT-03 gap                      | PARTIAL  | 1 test passes in isolation; fails when run sequentially after another test file                                     |

---

## Key Link Verification

| From                                     | To                         | Via                                                     | Status | Details                                                                                                                              |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `TopBar.tsx`                             | `AppShell.tsx`             | `onTabChange` callback closes mobile drawer             | WIRED  | `setMobileOpen(false)` called in every drawer item onClick before `onTabChange`                                                      |
| `AppShell.tsx`                           | `RightPanel.tsx`           | Conditional render on `isLg` — one instance only        | WIRED  | `{isLg && <RightPanel .../>}` and `{!isLg && drawerOpen && <...><RightPanel .../>}`                                                  |
| `weather-engine/route.ts`                | `lib/notifications.ts`     | `insertNotification` import and call                    | WIRED  | `import { insertNotification } from '@/lib/notifications'` at line 5; called at line 63                                              |
| `games/[id]/route.ts`                    | `lib/notifications.ts`     | `insertNotification` for admin_alert                    | WIRED  | Import at line 4; called at lines 69, 78, 100, 140                                                                                   |
| `games/[id]/route.ts`                    | `team_registrations` table | Check for pending registrations before deadline warning | WIRED  | `.from('team_registrations').select('id').eq('event_id',...).eq('status','pending').limit(1)` at line 132-138                        |
| `schedule-change-requests/[id]/route.ts` | `lib/notifications.ts`     | Full state transition coverage                          | WIRED  | Import at line 4; calls for denied (line 219), reschedule-approved (109), change_opponent-approved (130), cancel-approved (174, 187) |
| `refs/RefsTab.tsx`                       | `@dnd-kit/core`            | `useSensors` with `MouseSensor + TouchSensor`           | WIRED  | `useSensors(useSensor(MouseSensor), useSensor(TouchSensor, {delay:200, tolerance:5}))` at lines 501-507                              |

---

## Data-Flow Trace (Level 4)

| Artifact                  | Data Variable               | Source                                              | Produces Real Data        | Status  |
| ------------------------- | --------------------------- | --------------------------------------------------- | ------------------------- | ------- |
| `weather-engine/route.ts` | `result.alerts`             | `runWeatherEngine()` — real API/DB call             | Yes — live weather engine | FLOWING |
| `games/[id]/route.ts`     | `data` (updated game row)   | Supabase `.update().select().single()`              | Yes — real DB row         | FLOWING |
| `lib/notifications.ts`    | `notification_queue` insert | `insertNotification` → `from('notification_queue')` | Yes — real DB write       | FLOWING |
| `AppShell.tsx`            | `isLg` / `drawerOpen`       | `window.matchMedia` + `useState`                    | Yes — real viewport query | FLOWING |

---

## Behavioral Spot-Checks

| Behavior                              | Command                                                                  | Result                                | Status |
| ------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- | ------ |
| TypeScript compiles                   | `npx tsc --noEmit`                                                       | No output (exit 0)                    | PASS   |
| ESLint check                          | `npm run lint`                                                           | No errors output (exit 0)             | PASS   |
| Weather test file alone               | `npx vitest run __tests__/app/api/weather-engine-notifications.test.ts`  | 3 passed                              | PASS   |
| Games status test file alone          | `npx vitest run __tests__/app/api/games-status-notifications.test.ts`    | 2 passed                              | PASS   |
| Schedule change test file alone       | `npx vitest run __tests__/app/api/schedule-change-notifications.test.ts` | 1 passed                              | PASS   |
| All 3 test files together (sequenced) | `npx vitest run [all three]`                                             | 1 failed (games-status after weather) | FAIL   |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                     | Status    | Evidence                                                                                                                   |
| ----------- | ----------- | --------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| MOB-01      | 10-02       | Dashboard, Schedule, Check-In usable on phone screens           | SATISFIED | `grid-cols-1 sm:` prefixes on all card grids; `overflow-x-auto` + `sticky left-0` on schedule table                        |
| MOB-02      | 10-01       | RightPanel converts to bottom drawer on mobile                  | SATISFIED | `AppShell.tsx` — `isLg && <RightPanel>` sidebar + `!isLg && drawerOpen` bottom drawer; single instance always              |
| MOB-03      | 10-02       | Touch interactions for drag-drop (RefsTab TouchSensor)          | SATISFIED | `TouchSensor` + `useSensors` configured; `touchAction: 'none'` on draggable                                                |
| MOB-04      | 10-01       | Navigation adapts for mobile (hamburger + drawer)               | SATISFIED | `TopBar.tsx` — hamburger button `md:hidden`, slide-out drawer with all nav groups                                          |
| NOT-02      | 10-03       | Weather alerts trigger notifications to coaches/program leaders | SATISFIED | `weather-engine/route.ts:51-74` — `insertNotification` called for each alert in loop                                       |
| NOT-03      | 10-03       | Schedule change notifications sent to affected teams            | SATISFIED | Schedule change request routes fully covered; direct game cancellation gap filled in `games/[id]/route.ts:65-88`           |
| NOT-04      | 10-03       | Admin alerts for referee no-shows, registration deadlines       | SATISFIED | `games/[id]/route.ts:91-151` — no-show check on Live/Starting; deadline warning on Scheduled with 48h + pending regs guard |

---

## Anti-Patterns Found

| File                                                      | Line  | Pattern                                                                                                                                                                                           | Severity | Impact                                                                                                   |
| --------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `__tests__/app/api/games-status-notifications.test.ts`    | 10-11 | Top-level `vi.mock('@/lib/supabase/server')` returns `{ from: mockFrom }` with no `auth` property; per-test `vi.doMock` override is overridden by stale module cache when file runs after another | Warning  | Test passes in isolation but fails in sequence — test suite is order-dependent                           |
| `__tests__/app/api/schedule-change-notifications.test.ts` | 10-11 | Same top-level mock omits `auth`                                                                                                                                                                  | Warning  | Same issue — passes alone, fails after weather-engine test file                                          |
| `app/api/weather-engine/route.ts`                         | 58-59 | `isEventWide` variable computed but immediately voided (`void isEventWide`) — all alerts currently use event scope regardless                                                                     | Info     | Intentional technical debt; future field-level weather data will use this for field scope. Non-blocking. |

---

## Human Verification Required

### 1. Mobile Navigation Drawer

**Test:** On a physical device or browser DevTools at 375px viewport, open the app, tap the hamburger icon in the top bar.
**Expected:** Left slide-out drawer opens with all nav groups (DASHBOARD, SCHEDULE, GAME DAY, PEOPLE, COMMAND, REPORTS, ADMIN if admin). Tap an item — drawer closes and correct tab renders.
**Why human:** Touch events and slide-out animation cannot be verified programmatically.

### 2. RightPanel FAB and Bottom Drawer

**Test:** At viewport width below 1024px, verify no RightPanel sidebar is visible. Tap the Cloud FAB at bottom-right.
**Expected:** Bottom drawer slides up with weather/incident RightPanel content and a drag handle. Tapping a link in the drawer navigates and closes the drawer. At 1024px+ the FAB disappears and RightPanel shows as a sidebar.
**Why human:** Conditional rendering at CSS breakpoints and touch gesture behavior requires manual verification.

### 3. Touch Drag-Drop (RefsTab)

**Test:** On a touch device (or iOS/Android simulator), open Refs & Vols tab. Long-press a referee card for ~200ms, then drag to a game assignment slot.
**Expected:** Drag activates after 200ms hold (not on scroll), referee card follows finger, drops onto the target slot and assigns. Normal page scrolling still works without accidentally dragging.
**Why human:** TouchSensor device-specific behavior and scroll conflict must be verified on real touch hardware.

### 4. Responsive Modal

**Test:** At 375px viewport, trigger any modal dialog (e.g., edit a game, open a settings form).
**Expected:** Modal fills the full viewport width and slides up from the bottom. At 640px+ the modal is centered at 580px max-width.
**Why human:** Visual breakpoint behavior requires visual inspection.

---

## Gaps Summary

One gap was found, all in the test infrastructure — not in the production code:

**Test isolation failure (medium severity):** The Wave 0 test stubs in `games-status-notifications.test.ts` and `schedule-change-notifications.test.ts` use a top-level `vi.mock` for `@/lib/supabase/server` that returns a client without an `auth` property. The per-test `vi.resetModules()` + `vi.doMock()` pattern is intended to replace this, but when these files run after `weather-engine-notifications.test.ts` in the same Vitest worker process, the module cache contains the weather test's version of the mock (also without `auth`). The result is that the `supabase.auth.getUser()` call in the games route throws `Cannot read properties of undefined`.

**Root cause:** The top-level `vi.mock` factory for `@/lib/supabase/server` in both failing test files is missing the `auth` mock. A simple fix: add `auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }) }` to the `createClient` return value in the top-level mock of each file.

**Production impact:** None — all implementation wiring in route handlers is correct and fully present. This gap is test infrastructure only.

---

_Verified: 2026-03-25T09:15:00Z_
_Verifier: Claude (gsd-verifier)_
