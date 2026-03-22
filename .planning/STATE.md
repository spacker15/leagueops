---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 02
stopped_at: Completed 02-04-PLAN.md (Component Hardcode Removal) - user verified
last_updated: "2026-03-22T23:08:50.558Z"
progress:
  total_phases: 10
  completed_phases: 2
  total_plans: 10
  completed_plans: 10
---

# Project State: LeagueOps

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)
**Core value:** Tournament day operations must work reliably in real time — live scoring, field status, weather alerts, and referee assignments must be accurate and instant so that admins can run events from a single screen.
**Current focus:** Phase 02 — Hardcode Removal & Event Context

## Phase Progress

| Phase | Name                                    | Status      |
| ----- | --------------------------------------- | ----------- |
| 1     | Engine Client Refactor                  | not_started |
| 2     | Hardcode Removal & Event Context        | not_started |
| 3     | API Auth & Validation                   | not_started |
| 4     | RLS & Database Security                 | not_started |
| 5     | Event Creation Enhancements             | not_started |
| 6     | Registration Flow Enhancements          | not_started |
| 7     | Notification Infrastructure             | not_started |
| 8     | Schedule Change Request Workflow        | not_started |
| 9     | Public Results Site                     | not_started |
| 10    | Responsive Design & Notification Wiring | not_started |

## Active Context

**Last session:** 2026-03-22T23:08:50.554Z
**Stopped at:** Completed 02-04-PLAN.md (Component Hardcode Removal) - user verified
**Plans completed:** 01-01 (Core Engine Refactor) — 7 tasks, 12 files, 19 min; 01-02 (New API Routes for CommandCenter) — 3 tasks, 3 files, 3 min

## Performance Metrics

| Phase                               | Plan | Duration | Tasks    | Files |
| ----------------------------------- | ---- | -------- | -------- | ----- |
| 01-engine-client-refactor           | 01   | 19 min   | 7        | 12    |
| 01-engine-client-refactor           | 02   | 3 min    | 3        | 3     |
| Phase 01-engine-client-refactor P01 | 19   | 7 tasks  | 12 files |
| Phase 01-engine-client-refactor P04 | 5    | 2 tasks  | 1 files  |
| Phase 01-engine-client-refactor P03 | 2    | 5 tasks  | 3 files  |
| Phase 01-engine-client-refactor P05 | 7    | 7 tasks  | 9 files  |
| Phase 02-hardcode-removal-event-context P00 | 2 | 1 tasks | 1 files |
| Phase 02-hardcode-removal-event-context P01 | 9 | 2 tasks | 17 files |
| Phase 02-hardcode-removal-event-context P02 | 3 min | 2 tasks | 17 files |
| Phase 02-hardcode-removal-event-context P03 | 5 min | 2 tasks | 2 files |
| Phase 02-hardcode-removal-event-context P04 | 45 min | 3 tasks | 18 files |

## Decisions Log

| Phase-Plan | Decision                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01-01      | Weather engine not called from runUnifiedEngine — complexId not available in unified scope; weather runs per-complex from weather-engine API route |
| 01-01      | CommandCenter.tsx (client component) passes browser createClient() as sb — full server-side migration deferred to Plan B2                          |
| 01-01      | Rules cache (\_cache) retained; serverless isolation documented for Phase 2 multi-event work                                                       |
| 01-02      | Route shells created in wave 1 with commented engine imports — wire-up deferred to Plan A Task 6 completion                                        |
| 01-02      | Error format `{ error: string }` with 400/500 status codes matches all existing API routes in the codebase                                         |
| 01-02      | createClient() always called inside handler body — required by next/headers cookie access pattern                                                  |
| 01-03      | alert_id validated as number in resolve route — matches resolveAlert(alertId: number) engine signature                                             |
| 01-03      | Tasks 1-4 (existing engine routes) were pre-completed in Plan 01-01 — no additional changes required                                               |
| 01-04      | WeatherTab.tsx pure-function imports verified safe — conditionIcon, windDirection, evaluateAlerts, calcHeatIndex, THRESHOLDS require no DB access  |
| 01-04      | CommandCenter.tsx client-to-API migration complete — all engine operations now go through fetch() to API routes                                    |
| 01-05      | Shared \_mockSb.ts excluded from vitest via \_mock\*.ts glob pattern in exclude array to prevent no-suite error                                    |
| 01-05      | Integration test uses inline vi.fn() in vi.mock() factory to avoid Vitest hoisting-before-initialization errors                                    |
| 02-00      | All 4 store test cases use test.fails() -- suite stays green while documenting broken dep arrays and missing realtime filters that Plan 03 will fix |
| 02-02      | Engine routes (referee, weather, unified) were already updated in Plan 01 -- only field-engine GET needed the ?? '1' fix |
| 02-02      | invalidateRulesCache called in 3 locations: PATCH update, POST reset_one, POST reset_all -- ensures cache eviction on every mutation path |
| 02-02      | eligibility GET uses scoped event_id guards per code path -- allPending requires it, gameId path does not |
| 02-03      | currentDateRef pattern prevents reconnect storm -- realtime dep array is [eventId] ONLY, date read from ref |
| 02-03      | eventId! non-null assertions in callbacks safe -- callbacks only called when app is fully initialized |
| 02-03      | eventId ?? 0 in context value satisfies ContextValue eventId: number; const eid = eventId in useEffect provides TS narrowing |
| 02-04      | AppShell does NOT return null when eventId undefined -- passes eventId to children per D-01; individual tabs handle own null guards |
| 02-04      | RegisterPage uses inner-component Suspense pattern for useSearchParams -- review fix #2 addressed |
| 02-04      | Portal components use userRole.event_id as portalEventId (referee, volunteer, program_leader portals outside AppProvider) |
| 02-04      | D-05 QR URL slug fix not applicable -- CheckInTab QR URLs already use token-based /checkin/${token} path, no hardcoded event_id in path |
