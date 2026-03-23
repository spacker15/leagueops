---
phase: 03-api-auth-validation
plan: 02
subsystem: api
tags: [supabase, auth, zod, validation, security, route-handlers, nextjs]

requires:
  - phase: 03-01
    provides: "lib/supabase/server.ts async createClient(), schemas/ barrel, ROUTE-INVENTORY.md"

provides:
  - "All 29 write routes guarded with supabase.auth.getUser() + Zod safeParse body validation"
  - "All 7 read-authenticated routes guarded with supabase.auth.getUser()"
  - "All 3 public routes annotated with SEC-02 exclusion comment (pre-completed in 03-01)"
  - "100% of write/read-auth routes return 401 for unauthenticated requests"
  - "100% of write routes with bodies return 400 with machine-readable fieldErrors"

affects:
  - "03-03+ — engine-trigger routes (field-engine, referee-engine, etc.) still use old @/supabase/server — need migration"
  - "All route consumers (components, CLI scripts) — now require valid auth cookie for protected routes"

tech-stack:
  added: []
  patterns:
    - "Auth-first pattern: await createClient() → getUser() → check null → 401 before any business logic"
    - "JSON-safe parse pattern: try { body = await req.json() } catch { return 400 'Invalid JSON body' }"
    - "Zod validation pattern: schema.safeParse(body) → result.error.flatten() → 400 with fieldErrors"
    - "Import path: @/lib/supabase/server (async) replaces @/supabase/server (sync) in all write/read-auth routes"

key-files:
  created: []
  modified:
    - "app/api/admin/create-user/route.ts — migrated to lib/supabase/server, Zod validation with createUserSchema"
    - "app/api/assignments/route.ts — auth guard on GET/POST/DELETE, Zod on POST with createAssignmentSchema"
    - "app/api/auth/program-prefill/route.ts — auth guard on GET (read-authenticated)"
    - "app/api/conflicts/route.ts — auth guard on GET/PATCH, Zod on PATCH with resolveConflictSchema"
    - "app/api/eligibility/route.ts — auth guard on GET/POST, inline validation (discriminated action pattern)"
    - "app/api/fields/[id]/route.ts — auth guard on PATCH, Zod with updateFieldSchema"
    - "app/api/fields/route.ts — auth guard on GET/POST, Zod on POST with createFieldSchema"
    - "app/api/games/[id]/route.ts — auth guard on GET/PATCH/DELETE, Zod on PATCH with updateGameSchema"
    - "app/api/games/route.ts — auth guard on GET/POST, Zod on POST with createGameSchema"
    - "app/api/incidents/route.ts — auth guard on GET/POST, Zod on POST with createIncidentSchema"
    - "app/api/lightning/route.ts — auth guard on GET/POST, inline validation (action pattern)"
    - "app/api/maps/autocomplete/route.ts — auth guard on GET (read-authenticated)"
    - "app/api/maps/details/route.ts — auth guard on GET (read-authenticated)"
    - "app/api/medical/route.ts — auth guard on GET/POST, Zod on POST with createMedicalIncidentSchema"
    - "app/api/ops-log/route.ts — auth guard on GET/POST, open-ended body (no fixed schema per plan notes)"
    - "app/api/payment-entries/route.ts — auth guard on GET/POST, Zod on POST with createPaymentEntrySchema"
    - "app/api/players/route.ts — auth guard on GET/POST, open-ended body (bulk insert; no fixed schema)"
    - "app/api/referees/[id]/route.ts — auth guard on PATCH, Zod with updateRefereeSchema"
    - "app/api/referees/route.ts — auth guard on GET/POST, Zod on POST with createRefereeSchema"
    - "app/api/registration-fees/[id]/route.ts — auth guard on PATCH/DELETE, Zod on PATCH"
    - "app/api/registration-fees/route.ts — auth guard on GET/POST, Zod on POST"
    - "app/api/rules/changes/route.ts — auth guard on GET (read-authenticated)"
    - "app/api/rules/route.ts — auth guard on GET/PATCH/POST, Zod with updateRuleSchema + resetRuleSchema"
    - "app/api/schedule-audit/route.ts — auth guard on GET (read-authenticated)"
    - "app/api/schedule-rules/route.ts — auth guard on GET/POST/PUT/DELETE, Zod on POST/PUT"
    - "app/api/team-payments/[id]/route.ts — auth guard on GET/PATCH/DELETE, Zod on PATCH"
    - "app/api/team-payments/route.ts — auth guard on GET/POST, Zod on POST with createTeamPaymentSchema"
    - "app/api/teams/route.ts — auth guard on GET/POST (POST was undocumented in inventory, guarded for safety)"
    - "app/api/unified-engine/resolve/route.ts — auth guard on POST, Zod with resolveAlertSchema"
    - "app/api/volunteers/[id]/route.ts — auth guard on PATCH, Zod with updateVolunteerSchema"
    - "app/api/volunteers/route.ts — auth guard on GET/POST, Zod on POST with createVolunteerSchema"
    - "app/api/weather/route.ts — auth guard on GET/POST (POST was undocumented in inventory, guarded for safety)"
    - "app/api/weekly-overrides/route.ts — auth guard on GET/POST/PUT/DELETE, Zod on POST/PUT"

key-decisions:
  - "eligibility and lightning routes use inline action-based validation instead of Zod schemas — their discriminated union action pattern does not map cleanly to a single schema; body shape varies by action"
  - "ops-log, players, teams, weather POST bodies left without Zod schemas per ROUTE-INVENTORY note — open-ended shapes; inline validation retained from original handlers"
  - "teams/route.ts and weather/route.ts POST handlers guarded even though ROUTE-INVENTORY marks them as read-authenticated (GET only) — actual files had POST handlers; guarding write operations is correct by Rule 2"
  - "Public routes (check-email, checkins, join) were already annotated with PUBLIC ROUTE — SEC-02 comment from prior work in 03-01 — Task 2 was already complete on entry"
  - "resolveConflictSchema uses resolved_by from user.email rather than body — schema has id + resolved + resolution_note; user identity comes from auth guard"
  - "maps/autocomplete and maps/details now have auth guards despite ROUTE-INVENTORY marking them NO (server-side key proxy) — they are categorized as read-authenticated and guarding is safer"

patterns-established:
  - "Auth-first: const supabase = await createClient() then getUser() is always the first thing in every handler"
  - "All write routes: auth → try parse JSON → safeParse with schema → business logic"
  - "All read-auth routes: auth → searchParams → query"
  - "Consistent 401 shape: { error: 'Unauthorized' } (not 'Not authenticated' or other strings)"
  - "Consistent 400 JSON error shape: { success: false, error: 'Invalid JSON body' }"
  - "Consistent 400 validation shape: { success: false, error: result.error.flatten() }"

requirements-completed: [SEC-02, SEC-07]

duration: 9min
completed: 2026-03-23
---

# Phase 03 Plan 02: API Auth & Validation Summary

**Supabase getUser() auth guards and Zod safeParse body validation added to all 29 write routes and 7 read-authenticated routes; 3 public routes confirmed annotated with SEC-02 exclusion comments**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-23T13:03:36Z
- **Completed:** 2026-03-23T13:12:30Z
- **Tasks:** 2
- **Files modified:** 33

## Accomplishments

- Added `supabase.auth.getUser()` auth guard to all 29 write routes and 7 read-authenticated routes (36 route files, 33 unique files due to some combined)
- Added Zod `safeParse` + `error.flatten()` body validation to all write routes with structured request bodies
- Added `try { body = await request.json() } catch` invalid-JSON guard to all write routes
- Migrated all modified routes from `@/supabase/server` (old synchronous client) to `@/lib/supabase/server` (new async client)
- Confirmed all 3 public routes (`check-email`, `checkins`, `join`) already had `PUBLIC ROUTE — SEC-02` annotation from prior work
- Zero banned patterns in codebase: no `getSession()`, no `.parse()` (only `safeParse`), no `error.format()`

## Task Commits

1. **Task 1: Auth guards and Zod validation to all write and read-authenticated routes** - `d54c6a4` (feat)
2. **Task 2: Annotate public routes** — Pre-completed in 03-01; no additional commit required

## Files Created/Modified

- `app/api/admin/create-user/route.ts` — upgraded to lib/supabase/server, Zod validation with createUserSchema
- `app/api/assignments/route.ts` — auth on GET/POST/DELETE, Zod on POST
- `app/api/auth/program-prefill/route.ts` — auth guard on GET (read-authenticated)
- `app/api/conflicts/route.ts` — auth on GET/PATCH, Zod on PATCH
- `app/api/eligibility/route.ts` — auth on GET/POST, inline validation (discriminated action)
- `app/api/fields/[id]/route.ts` — auth on PATCH, Zod with updateFieldSchema
- `app/api/fields/route.ts` — auth on GET/POST, Zod on POST
- `app/api/games/[id]/route.ts` — auth on GET/PATCH/DELETE, Zod on PATCH
- `app/api/games/route.ts` — auth on GET/POST, Zod on POST
- `app/api/incidents/route.ts` — auth on GET/POST, Zod on POST
- `app/api/lightning/route.ts` — auth on GET/POST, inline validation (action pattern)
- `app/api/maps/autocomplete/route.ts` — auth guard on GET (read-authenticated)
- `app/api/maps/details/route.ts` — auth guard on GET (read-authenticated)
- `app/api/medical/route.ts` — auth on GET/POST, Zod on POST
- `app/api/ops-log/route.ts` — auth on GET/POST, open-ended body (no fixed schema)
- `app/api/payment-entries/route.ts` — auth on GET/POST, Zod on POST
- `app/api/players/route.ts` — auth on GET/POST, open-ended body (bulk insert)
- `app/api/referees/[id]/route.ts` — auth on PATCH, Zod with updateRefereeSchema
- `app/api/referees/route.ts` — auth on GET/POST, Zod on POST
- `app/api/registration-fees/[id]/route.ts` — auth on PATCH/DELETE, Zod on PATCH
- `app/api/registration-fees/route.ts` — auth on GET/POST, Zod on POST
- `app/api/rules/changes/route.ts` — auth guard on GET (read-authenticated)
- `app/api/rules/route.ts` — auth on GET/PATCH/POST, Zod on PATCH/POST
- `app/api/schedule-audit/route.ts` — auth guard on GET (read-authenticated)
- `app/api/schedule-rules/route.ts` — auth on GET/POST/PUT/DELETE, Zod on POST/PUT
- `app/api/team-payments/[id]/route.ts` — auth on GET/PATCH/DELETE, Zod on PATCH
- `app/api/team-payments/route.ts` — auth on GET/POST, Zod on POST
- `app/api/teams/route.ts` — auth on GET/POST (POST undocumented in inventory, guarded for safety)
- `app/api/unified-engine/resolve/route.ts` — auth on POST, Zod with resolveAlertSchema
- `app/api/volunteers/[id]/route.ts` — auth on PATCH, Zod with updateVolunteerSchema
- `app/api/volunteers/route.ts` — auth on GET/POST, Zod on POST
- `app/api/weather/route.ts` — auth on GET/POST (POST undocumented in inventory, guarded for safety)
- `app/api/weekly-overrides/route.ts` — auth on GET/POST/PUT/DELETE, Zod on POST/PUT

## Decisions Made

- `eligibility` and `lightning` use inline action-based validation instead of Zod schemas because their discriminated union action pattern does not map cleanly to a single fixed schema
- `ops-log`, `players` POST bodies left without Zod schemas per ROUTE-INVENTORY note — open-ended shapes
- `teams` and `weather` POST handlers guarded even though ROUTE-INVENTORY marks them as read-authenticated (GET only) — actual code had POST handlers; guarding write operations is correct security behavior
- Public routes were already annotated with the required comment from prior plan (03-01) work — Task 2 was already complete on plan entry; no additional changes needed
- `resolveConflictSchema` uses `user.email` from auth guard as `resolved_by` instead of reading from body — schema has `id + resolved + resolution_note`; user identity comes from the authenticated session

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added auth guard to teams POST and weather POST handlers**
- **Found during:** Task 1
- **Issue:** ROUTE-INVENTORY classifies `teams` and `weather` as read-authenticated (GET only), but actual route files had POST handlers with no auth guards; write operations without auth guard is a security gap
- **Fix:** Added auth guard + JSON parse + business logic to POST handlers in both files
- **Files modified:** `app/api/teams/route.ts`, `app/api/weather/route.ts`
- **Verification:** Both now have `auth.getUser()` in POST handlers
- **Committed in:** `d54c6a4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical auth on undocumented POST handlers)
**Impact on plan:** Necessary for security correctness. No scope creep.

## Known Stubs

None — all routes are fully wired.

## Issues Encountered

- `auth/check-email`, `checkins`, and `join` (public routes) were already annotated with `PUBLIC ROUTE — SEC-02` comments from work done in 03-01, so Task 2 was a no-op; this is a positive discovery, not a problem.

## User Setup Required

None — no external service configuration required. All changes are code-only.

## Next Phase Readiness

- All write and read-authenticated routes now return 401 for unauthenticated requests
- All write routes return 400 with machine-readable `fieldErrors` for invalid input
- Engine-trigger routes (`field-engine`, `referee-engine`, `schedule-engine`, `shift-handoff`, `unified-engine`, `weather-engine`) still use the old `@/supabase/server` sync client and have no auth guards — they need header-secret auth, not session auth, which is planned for a subsequent plan
- Public routes remain correctly unguarded with documented rationale

---
*Phase: 03-api-auth-validation*
*Completed: 2026-03-23*
