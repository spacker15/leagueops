---
phase: 02-hardcode-removal-event-context
plan: 04
subsystem: components
tags: [hardcode-removal, event-context, security, multi-event]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [zero-hardcoded-event-id-in-components]
  affects: [all-tab-components, portals, register-flow]
tech_stack:
  added: []
  patterns: [useApp()-eventId, userRole.event_id-portals, Suspense-useSearchParams]
key_files:
  created: []
  modified:
    - components/engine/CommandCenter.tsx
    - components/programs/ProgramApprovals.tsx
    - components/auth/RegisterPage.tsx
    - components/programs/RegistrationConfig.tsx
    - components/auth/RefereePortal.tsx
    - components/auth/VolunteerPortal.tsx
    - components/programs/ProgramDashboard.tsx
    - components/schedule/ScheduleTab.tsx
    - components/rules/RulesTab.tsx
    - components/checkin/CheckInTab.tsx
    - components/incidents/IncidentsTab.tsx
    - components/engine/EngineTab.tsx
    - components/payments/PaymentsTab.tsx
    - components/AppShell.tsx
    - components/auth/UserManagement.tsx
    - components/refs/RefsTab.tsx
    - components/settings/LeagueSettingsTab.tsx
    - components/weather/WeatherTab.tsx
decisions:
  - "AppShell does NOT return null when eventId undefined -- stays visible per D-01; passes eventId to children"
  - "RegisterPage uses inner-component pattern: RegisterPageInner uses useSearchParams, exported RegisterPage wraps in Suspense"
  - "Portal components (Referee, Volunteer, ProgramDashboard) use userRole.event_id as portalEventId"
  - "CommandCenter guards on both eventId and currentDate -- uses currentDate.id directly (D-02)"
  - "eventSlug D-05 fix not applicable -- CheckInTab QR URLs already use token-based path /checkin/${token}, not event-ID-based path"
  - "Pre-existing referee-engine integration test failures confirmed pre-existing before this plan"
metrics:
  duration: 45 min
  completed_date: "2026-03-22"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 18
---

# Phase 02 Plan 04: Component Hardcode Removal Summary

Final layer of hardcode removal -- all 18 component files now use dynamic eventId from appropriate context source. Zero hardcoded event_id = 1 references remain in production code.

## Tasks Completed

### Task 1: Fix high-count components (7 files)

- **CommandCenter.tsx**: Destructured `eventId` from `useApp()`, added `if (!eventId) return null` guard, added `if (!currentDate) return null` guard (D-02), replaced `currentDate?.id ?? 1` with `currentDate.id`, replaced all `event_id: 1` in fetch bodies and Supabase queries, passed `eventId` through `FieldCard` and `GameRow` inner components, updated `HandoffHistory` to accept and use `eventId`
- **ProgramApprovals.tsx**: Added `useApp()` import, destructured `eventId`, added null guard, replaced 5 instances of `event_id: 1`
- **RegistrationConfig.tsx**: Added `useApp()` import, destructured `eventId`, added guard in `load()`, replaced 4 instances of `event_id: 1`
- **RegisterPage.tsx**: Split into `RegisterPageInner` (uses `useSearchParams()`, reads `event_id` from URL query param) and exported `RegisterPage` (wraps in `<Suspense fallback={null}>`). Replaced 5 instances of `event_id: 1`. Null guard if no event_id in URL.
- **RefereePortal.tsx**: Used `userRole?.event_id` as `portalEventId`, added null guard, replaced 2 direct instances plus updated `ApprovalsPanel` to accept `eventId` prop and use it in eligibility fetch
- **VolunteerPortal.tsx**: Same pattern as RefereePortal -- 3 instances replaced
- **ProgramDashboard.tsx**: `userRole?.event_id` as `portalEventId`, null guard, 1 instance replaced

**Commit:** `4642879`

### Task 2: Fix remaining 11 components (11 files)

- **AppShell.tsx**: Destructured `eventId`, removed `(state.event as any)` casts, passes `eventId` to `EventSetupTab`. **NO null guard** per D-01 -- AppShell stays visible during loading.
- **ScheduleTab.tsx**: `eventId` null guard, replaced `event_id=1` in field-engine fetch URL, `event_id: 1` in addGame, and ops-log entry. Also fixed `QuickRescheduleBtn` inner component to destructure `eventId`.
- **RulesTab.tsx**: Added `useApp()` import, `eventId` null guard, replaced all 3 URL params with template literals
- **CheckInTab.tsx**: `eventId` null guard, updated `ensureTokens()` to accept `eventId` param, replaced eligibility fetch URL
- **IncidentsTab.tsx**: `eventId` null guard, replaced both `event_id: 1` in logIncident and dispatchTrainer payloads
- **EngineTab.tsx**: `eventId` null guard, replaced `event_id: 1` in addGame
- **PaymentsTab.tsx**: Replaced `state.event?.id ?? 1` with `eventId` from `useApp()`, added null guard
- **UserManagement.tsx**: Replaced `(state.event as any)?.id ?? 1` with `eventId` from `useApp()`, added null guard
- **RefsTab.tsx**: `eventId` null guard, replaced `event_id: 1` in ops-log, removed duplicate local `eventId` variable in `copyInviteLink`
- **LeagueSettingsTab.tsx**: Added `useApp()` import, replaced `event_id: 1` in ops-log insert
- **WeatherTab.tsx**: `eventId` null guard, replaced `state.event?.id ?? 1` in lightning trigger body

**Commit:** `c827673`

### Type-error fixes

After type-check revealed two errors: `FieldCard` and `QuickRescheduleBtn` needed `eventId` prop threading. Fixed both.

**Commit:** `b41a9f9`

### Task 3: Final sweep and type-check

**Checkpoint -- awaiting user verification.**

## Verification Results

### Hardcode Grep Sweep

All 4 patterns return zero matches across production code:

1. `event_id.*: 1\b` -- zero matches
2. `?? 1\b` -- zero matches (remaining `?? 15`, `?? 10000`, `?? 160` are legitimate non-event-id fallbacks)
3. `EVENT_ID` -- zero matches
4. `event_id=1[^0-9]` -- zero matches

### TypeScript Compilation

`npm run type-check` exits 0 -- no errors.

### Test Suite

`npm run test` -- 2 tests fail in `__tests__/app/api/referee-engine.integration.test.ts`. **Confirmed pre-existing**: same 2 tests fail on commit before this plan's changes. Not caused by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] eventId not in scope for FieldCard and GameRow inner components**
- **Found during:** Type-check after Task 2
- **Issue:** CommandCenter's `FieldCard` and `GameRow` are standalone functions outside the main component scope. `eventId` from `useApp()` was not accessible.
- **Fix:** Passed `eventId` as explicit prop through `FieldCard` (which passes to `GameRow`).
- **Files modified:** `components/engine/CommandCenter.tsx`
- **Commit:** `b41a9f9`

**2. [Rule 1 - Bug] QuickRescheduleBtn in ScheduleTab needed its own eventId destructuring**
- **Found during:** Type-check after Task 2
- **Issue:** `QuickRescheduleBtn` is a standalone function that uses `useApp()` but didn't destructure `eventId`.
- **Fix:** Added `eventId` to destructuring in `QuickRescheduleBtn`.
- **Files modified:** `components/schedule/ScheduleTab.tsx`
- **Commit:** `b41a9f9`

**3. [Scope] D-05 QR URL slug fix not applicable**
- **Issue:** Plan specified changing QR URLs from `/checkin/1/${token}` to `/checkin/${eventSlug}/${token}`. Actual code already uses pure token-based URLs: `/checkin/${token}`. No numeric event ID in QR URL path. Also, `Event` interface has no `slug` field.
- **Fix:** `event_id: 1` in `ensureTokens()` upsert was replaced with `eventId` (the real fix). QR URL path unchanged as it's already dynamic.
- **Impact:** QR URLs are correct -- no event_id hardcode in them. The eventSlug requirement was based on incorrect assumption about the URL structure.

## Known Stubs

None -- all event_id references are now dynamic. No placeholders or hardcoded fallbacks remain.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/02-hardcode-removal-event-context/02-04-SUMMARY.md` -- FOUND
- Commit `4642879` (Task 1) -- FOUND
- Commit `c827673` (Task 2) -- FOUND
- Commit `b41a9f9` (type-error fixes) -- FOUND
- All 18 component files modified -- VERIFIED
- Zero hardcoded event_id: 1 across all 4 grep patterns -- VERIFIED
- TypeScript type-check exits 0 -- VERIFIED
- AppShell contains no `return null` -- VERIFIED
