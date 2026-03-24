---
phase: 06-registration-flow-enhancements
plan: 04
subsystem: registration
tags: [coach, self-registration, token-flow, ratelimit, conflict-detection]

dependency_graph:
  requires:
    - phase: 06-01
      provides: coach-conflicts-engine, coach-types, phase6-schema
  provides:
    - coach-token-server-page
    - coach-join-client-form
    - coach-api-route
  affects: [registration-flow, coach-management]

tech-stack:
  added: []
  patterns: [token-gated-public-page, server-component-token-validation, public-rate-limited-api]

key-files:
  created:
    - app/coach/[token]/page.tsx
    - app/coach/[token]/CoachJoinClient.tsx
    - app/api/coach/route.ts
  modified: []

key-decisions:
  - "Token is NOT marked used on POST — per-program link allows multiple coaches to self-register (D-05). is_active is revocation flag only."
  - "lib/supabase/server (async createClient) used for server component; @/supabase/server (sync) used for existing join/page.tsx but new coach pages follow async pattern per Phase 3"
  - "Conflict detection failure is non-fatal — coach registration succeeds, conflict upsert wrapped in try/catch to avoid blocking registration on DB errors"

patterns-established:
  - "Coach token server page mirrors join/[token] pattern: server validates token + registration window, passes context to client component"
  - "Select elements always use bg-[#040e24] per CLAUDE.md gotcha #2 to prevent white-on-white options"

requirements-completed: [REG-04, REG-05]

duration: 8min
completed: "2026-03-24"
---

# Phase 6 Plan 04: Coach Self-Registration Token Flow Summary

**Server component + client form + rate-limited API for /coach/[token] coach self-registration, with conflict detection on POST.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-24T11:01:00Z
- **Completed:** 2026-03-24T11:09:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `/coach/[token]` server component that validates coach invite tokens from `coach_invites` table, checking `is_active`, `expires_at`, `registration_opens_at`, `registration_closes_at`, and `registration_open`
- Built branded error page with Clock/XCircle icons for expired/used/invalid/closed tokens (no form shown — D-04)
- Created `CoachJoinClient.tsx` client form with name, email, phone, certifications, team dropdown, success state
- Created `app/api/coach/route.ts` with GET (validate) and POST (submit) handlers, both rate-limited as public route
- POST inserts into `coaches` + `coach_teams` tables then runs `detectCoachConflicts` and upserts conflicts to `coach_conflicts`

## Task Commits

1. **Task 1: Coach token server page + expired/error states** - `0a96b8d` (feat)
2. **Task 2: Coach self-registration client form + API route** - `9272bd4` (feat)

## Files Created/Modified

- `app/coach/[token]/page.tsx` — Server component validates coach_invites token, checks date window, shows error or passes to CoachJoinClient
- `app/coach/[token]/CoachJoinClient.tsx` — Client form: name, email, phone, certifications, team select (bg-[#040e24]), success state
- `app/api/coach/route.ts` — PUBLIC ROUTE GET+POST with publicRatelimit, coaches+coach_teams insert, detectCoachConflicts

## Decisions Made

- Token NOT marked used on POST (per-program link per D-05, multiple coaches can self-register on same link)
- Used `@/lib/supabase/server` (async pattern) for both server component and API route, consistent with Phase 3 conventions
- Conflict detection failure wrapped in try/catch — non-fatal, registration already committed to DB

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

A pre-existing type error in `components/auth/RegisterPage.tsx` (from a parallel agent's changes — missing `additionalCoaches`, `availableAllDates`, `availableDateIds` in a `setTeams` call) was discovered during type-check. This is out of scope for this plan and logged here for awareness. My coach files introduce no new type errors.

## Next Phase Readiness

- `/coach/[token]` self-registration flow complete (REG-04, REG-05)
- Coach invite generation (admin creates coach_invites rows with token) is required for end-to-end flow — likely in a companion plan
- `coach_conflicts` table will be populated automatically when coaches register on overlapping teams

---
*Phase: 06-registration-flow-enhancements*
*Completed: 2026-03-24*
