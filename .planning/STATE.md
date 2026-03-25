---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 09
stopped_at: Completed 09-04-PLAN.md
last_updated: "2026-03-25T01:26:19.812Z"
progress:
  total_phases: 10
  completed_phases: 8
  total_plans: 40
  completed_plans: 37
---

# Project State: LeagueOps

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)
**Core value:** Tournament day operations must work reliably in real time — live scoring, field status, weather alerts, and referee assignments must be accurate and instant so that admins can run events from a single screen.
**Current focus:** Phase 09 — public-results-site

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

**Last session:** 2026-03-25T01:26:19.809Z
**Stopped at:** Completed 09-04-PLAN.md
**Plans completed:** 01-01 (Core Engine Refactor) — 7 tasks, 12 files, 19 min; 01-02 (New API Routes for CommandCenter) — 3 tasks, 3 files, 3 min; 05-01 (Phase 5 Foundation) — 2 tasks, 6 files, 2 min

## Performance Metrics

| Phase                                         | Plan   | Duration | Tasks    | Files |
| --------------------------------------------- | ------ | -------- | -------- | ----- |
| 01-engine-client-refactor                     | 01     | 19 min   | 7        | 12    |
| 01-engine-client-refactor                     | 02     | 3 min    | 3        | 3     |
| Phase 01-engine-client-refactor P01           | 19     | 7 tasks  | 12 files |
| Phase 01-engine-client-refactor P04           | 5      | 2 tasks  | 1 files  |
| Phase 01-engine-client-refactor P03           | 2      | 5 tasks  | 3 files  |
| Phase 01-engine-client-refactor P05           | 7      | 7 tasks  | 9 files  |
| Phase 02-hardcode-removal-event-context P00   | 2      | 1 tasks  | 1 files  |
| Phase 02-hardcode-removal-event-context P01   | 9      | 2 tasks  | 17 files |
| Phase 02-hardcode-removal-event-context P02   | 3 min  | 2 tasks  | 17 files |
| Phase 02-hardcode-removal-event-context P03   | 5 min  | 2 tasks  | 2 files  |
| Phase 02-hardcode-removal-event-context P04   | 45 min | 3 tasks  | 18 files |
| Phase 03-api-auth-validation P01              | 5 min  | 2 tasks  | 17 files |
| Phase 03-api-auth-validation P03              | 2 min  | 2 tasks  | 9 files  |
| Phase 03-api-auth-validation P02              | 9 min  | 2 tasks  | 33 files |
| Phase 04-rls-database-security P01            | 4 min  | 2 tasks  | 1 files  |
| Phase 04-rls-database-security P02            | 8 min  | 2 tasks  | 1 files  |
| Phase 05-event-creation-enhancements P00      | 1 min  | 1 tasks  | 2 files  |
| Phase 05-event-creation-enhancements P01      | 2 min  | 2 tasks  | 6 files  |
| Phase 05-event-creation-enhancements P02      | 2 min  | 2 tasks  | 2 files  |
| Phase 05-event-creation-enhancements P04      | 1 min  | 1 tasks  | 1 files  |
| Phase 05-event-creation-enhancements P03      | 45 min | 2 tasks  | 4 files  |
| Phase 06-registration-flow-enhancements P01   | 8 min  | 2 tasks  | 4 files  |
| Phase 06-registration-flow-enhancements P04   | 8 min  | 2 tasks  | 3 files  |
| Phase 06-registration-flow-enhancements P02   | 4 min  | 1 tasks  | 2 files  |
| Phase 06-registration-flow-enhancements P03   | 15 min | 1 tasks  | 1 files  |
| Phase 06-registration-flow-enhancements P05   | 15 min | 3 tasks  | 5 files  |
| Phase 07-notification-infrastructure P01      | 3 min  | 2 tasks  | 6 files  |
| Phase 07-notification-infrastructure P03      | 2 min  | 2 tasks  | 4 files  |
| Phase 07-notification-infrastructure P02      | 2 min  | 1 tasks  | 1 files  |
| Phase 07-notification-infrastructure P04      | 5 min  | 2 tasks  | 7 files  |
| Phase 08-schedule-change-request-workflow P02 | 2 min  | 2 tasks  | 2 files  |
| Phase 08-schedule-change-request-workflow P01 | 8 min  | 2 tasks  | 7 files  |
| Phase 08-schedule-change-request-workflow P03 | 10 min | 2 tasks  | 5 files  |
| Phase 08-schedule-change-request-workflow P04 | 6 min  | 2 tasks  | 3 files  |
| Phase 08-schedule-change-request-workflow P05 | 4 min  | 2 tasks  | 5 files  |
| Phase 09-public-results-site P00 | 2 min | 2 tasks | 8 files |
| Phase 09-public-results-site P01 | 2 min | 2 tasks | 5 files |
| Phase 09-public-results-site P03 | 4 min | 1 tasks | 3 files |
| Phase 09-public-results-site P04 | 2min | 2 tasks | 4 files |

## Decisions Log

| Phase-Plan | Decision                                                                                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01-01      | Weather engine not called from runUnifiedEngine — complexId not available in unified scope; weather runs per-complex from weather-engine API route                                                                                |
| 01-01      | CommandCenter.tsx (client component) passes browser createClient() as sb — full server-side migration deferred to Plan B2                                                                                                         |
| 01-01      | Rules cache (\_cache) retained; serverless isolation documented for Phase 2 multi-event work                                                                                                                                      |
| 01-02      | Route shells created in wave 1 with commented engine imports — wire-up deferred to Plan A Task 6 completion                                                                                                                       |
| 01-02      | Error format `{ error: string }` with 400/500 status codes matches all existing API routes in the codebase                                                                                                                        |
| 01-02      | createClient() always called inside handler body — required by next/headers cookie access pattern                                                                                                                                 |
| 01-03      | alert_id validated as number in resolve route — matches resolveAlert(alertId: number) engine signature                                                                                                                            |
| 01-03      | Tasks 1-4 (existing engine routes) were pre-completed in Plan 01-01 — no additional changes required                                                                                                                              |
| 01-04      | WeatherTab.tsx pure-function imports verified safe — conditionIcon, windDirection, evaluateAlerts, calcHeatIndex, THRESHOLDS require no DB access                                                                                 |
| 01-04      | CommandCenter.tsx client-to-API migration complete — all engine operations now go through fetch() to API routes                                                                                                                   |
| 01-05      | Shared \_mockSb.ts excluded from vitest via \_mock\*.ts glob pattern in exclude array to prevent no-suite error                                                                                                                   |
| 01-05      | Integration test uses inline vi.fn() in vi.mock() factory to avoid Vitest hoisting-before-initialization errors                                                                                                                   |
| 02-00      | All 4 store test cases use test.fails() -- suite stays green while documenting broken dep arrays and missing realtime filters that Plan 03 will fix                                                                               |
| 02-02      | Engine routes (referee, weather, unified) were already updated in Plan 01 -- only field-engine GET needed the ?? '1' fix                                                                                                          |
| 02-02      | invalidateRulesCache called in 3 locations: PATCH update, POST reset_one, POST reset_all -- ensures cache eviction on every mutation path                                                                                         |
| 02-02      | eligibility GET uses scoped event_id guards per code path -- allPending requires it, gameId path does not                                                                                                                         |
| 02-03      | currentDateRef pattern prevents reconnect storm -- realtime dep array is [eventId] ONLY, date read from ref                                                                                                                       |
| 02-03      | eventId! non-null assertions in callbacks safe -- callbacks only called when app is fully initialized                                                                                                                             |
| 02-03      | eventId ?? 0 in context value satisfies ContextValue eventId: number; const eid = eventId in useEffect provides TS narrowing                                                                                                      |
| 02-04      | AppShell does NOT return null when eventId undefined -- passes eventId to children per D-01; individual tabs handle own null guards                                                                                               |
| 02-04      | RegisterPage uses inner-component Suspense pattern for useSearchParams -- review fix #2 addressed                                                                                                                                 |
| 02-04      | Portal components use userRole.event_id as portalEventId (referee, volunteer, program_leader portals outside AppProvider)                                                                                                         |
| 02-04      | D-05 QR URL slug fix not applicable -- CheckInTab QR URLs already use token-based /checkin/${token} path, no hardcoded event_id in path                                                                                           |
| 03-01      | lib/supabase/server.ts placed at lib/ (no src/ dir); async await cookies() pattern for Next.js 15 compatibility                                                                                                                   |
| 03-01      | Engine-trigger routes categorized separately from write routes — engines need header secret auth not user session auth                                                                                                            |
| 03-01      | schemas/ at project root — consistent with lib/, types/, components/ structure (no src/ prefix in this project)                                                                                                                   |
| 03-03      | Engine-trigger GET handlers excluded from rate limiting — only POST triggers expensive engine operations; GET serves cached reads                                                                                                 |
| 03-03      | publicRatelimit sliding window used for all public routes — allows event-day burst tolerance better than fixed window                                                                                                             |
| 03-02      | eligibility and lightning routes use inline action-based validation instead of Zod schemas — discriminated union pattern does not map to a single schema                                                                          |
| 03-02      | teams POST and weather POST handlers guarded even though ROUTE-INVENTORY marks them read-authenticated (GET only) — actual files had undocumented POST handlers                                                                   |
| 03-02      | Public routes (check-email, checkins, join) were already annotated with PUBLIC ROUTE — SEC-02 comments from 03-01 — Task 2 was a no-op on entry                                                                                   |
| 04-01      | division_timing table added to RLS migration — discovered during file scan with "Allow all on division_timing" policy, not listed in RESEARCH.md                                                                                  |
| 04-01      | players and field_blocks use direct event_id scoping (columns added by later migrations) rather than indirect JOIN pattern                                                                                                        |
| 04-01      | payments/sports tables excluded from RLS migration — already have proper service_role policies or are reference-only data                                                                                                         |
| 04-02      | Layer 4 anon policies already complete in rls*migration.sql from 04-01 — verified 6 correct anon_select*\* policies, no append needed                                                                                             |
| 04-02      | Standalone rls_rollback.sql created (not inline comment) — covers DROP all 206 policies + DROP FUNCTION user_event_ids() + restore exact original policy names                                                                    |
| 04-02      | Migration deployment deferred — no Supabase credentials in execution env; apply via SQL Editor at supabase.com/dashboard or MCP tools; rollback staged                                                                            |
| 05-00      | Used it.todo() pattern for pending stubs — vitest treats todos as skipped keeping suite green while documenting test contract                                                                                                     |
| 05-00      | Created **tests**/components/ directory following existing **tests**/app/ and **tests**/lib/ pattern                                                                                                                              |
| 05-01      | VenueAutocompleteInput uses onLocationChange + onVenueSelect callbacks so parent owns state                                                                                                                                       |
| 05-01      | slug and status added as optional fields to Event interface -- needed by Plan 03 Sharing tab                                                                                                                                      |
| 05-01      | Component silently fails on details fetch error -- no toast dependency, caller handles UX                                                                                                                                         |
| 05-02      | handleVenueSelect() in EventPicker owns all venue state updates -- delegates to VenueAutocompleteInput for search/select UX                                                                                                       |
| 05-02      | Complex update in EventSetupTab uses .is('lat', null).limit(1) filter to avoid overwriting manually-set complex coordinates                                                                                                       |
| 05-02      | CheckCircle kept in EventPicker lucide imports -- still used for copy event code feedback (unrelated to venue)                                                                                                                    |
| 05-03      | Registration URL uses NEXT_PUBLIC_PUBLIC_RESULTS_URL env var instead of window.location.origin -- /e/[slug]/register lives in separate apps/public-results Vercel deployment; window.location.origin fallback added for local dev |
| 05-03      | maybeSingle() used instead of single() for slug lookup to prevent crash on duplicate slugs; unique slug enforcement added to createEvent() with up to 5 collision-retry attempts                                                  |
| 05-03      | RLS policy fixes: owner_id fallback added to events SELECT/UPDATE policies; event_admins INSERT moved after user_roles INSERT to satisfy FK constraint                                                                            |
| 06-03      | detectCoachConflicts wrapped in try/catch — non-fatal; conflict detection failure must not block registration submission                                                                                                          |
| 06-03      | available_date_ids: [] (empty array) means all dates available — consistent with team_registrations schema from 06-01                                                                                                             |
| 06-03      | Additional Coaches section collapsed by default; copy-from-team-1 deep copies additionalCoaches array to avoid shared references                                                                                                  |
| 07-01      | dedup_key as STORED computed column eliminates application-level key generation — always consistent, indexed for fast dedup lookups                                                                                               |
| 07-01      | emails/ placed at project root following react-email convention — keeps templates separate from UI components                                                                                                                     |
| 07-01      | notification_queue RLS has no permissive policies (service role only) — notification_preferences, log, push_subscriptions use user-scoped policies                                                                                |
| 07-02      | Email HTML built inline as template literal (not react-email render in Deno) — react-email components cannot be imported from Next.js app into Deno Edge Function                                                                 |
| 07-02      | Return HTTP 200 on all unhandled errors in Edge Function outer try/catch — prevents Database Webhook retry storm                                                                                                                  |
| 07-03      | urlBase64ToUint8Array returns ArrayBuffer (not Uint8Array) for TypeScript strict PushSubscriptionOptionsInit.applicationServerKey compat                                                                                          |
| 07-03      | sw.js uses in-memory recentPushTimestamps for 60s window — service worker scope persists across push events without DB overhead                                                                                                   |
| 07-03      | subscribeToPush checks Notification.permission === denied before prompting per D-09 to never re-prompt denied users                                                                                                               |
| 07-04      | userRoleNames cast to string[] for ALERT_TYPE_ROLES includes() comparison — avoids TS2345 AppRole vs string mismatch                                                                                                              |
| 07-04      | NotificationDropdown uses inline style keyframe for fadeSlideDown — avoids global CSS dependency while meeting 150ms animation contract                                                                                           |
| 07-04      | PushPermissionModal double-checks getPushPermission() before render — D-09 Pitfall 4 guard even when parent also checks                                                                                                           |
| 08-01      | GameStatus 'Cancelled' requires updating all Record<GameStatus, string> exhaustive maps in lib/utils.ts and components/ui/index.tsx                                                                                               |
| 08-01      | reschedule_game uses SECURITY DEFINER with atomic conflict check before updating games and junction table                                                                                                                         |
| 08-01      | insertScheduleChangeRequest inserts request first then junction rows to satisfy FK constraint on request_id                                                                                                                       |
| 08-02      | overlaps() uses raw Date.getTime() arithmetic — date-fns only for calendar-level isSameDay/isAfter/differenceInCalendarDays per plan spec                                                                                         |
| 08-02      | Field conflicts are hard filters (slot skipped); team conflicts are soft (slot included with homeTeamAvailable/awayTeamAvailable=false)                                                                                           |
| 08-02      | teamAvailability empty array means all dates available — consistent with Phase 6 team_registrations schema                                                                                                                        |
| 08-03      | Approved cancel requests immediately transition to 'completed' after updating all game statuses — no intermediate state needed                                                                                                    |
| 08-03      | Reschedule route uses 'partially_complete' when some junction games still pending, 'completed' only when all resolved                                                                                                             |
| 08-03      | Store uses separate 'schedule_change_requests' Supabase channel rather than adding to leagueops-realtime channel to keep concerns separate                                                                                        |
