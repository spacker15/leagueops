---
phase: 06-registration-flow-enhancements
plan: 03
subsystem: ui
tags: [registration, coaches, availability, supabase, react, forms]

# Dependency graph
requires:
  - phase: 06-registration-flow-enhancements
    provides: '06-01 built schema tables (coaches, coach_teams, coach_conflicts, event_dates, available_date_ids column) and detectCoachConflicts engine'
provides:
  - 'Extended RegisterPage Step 3 with additional coaches section (collapsible, add/delete rows)'
  - 'Date availability checkboxes with Available All Dates toggle per team'
  - 'Team count indicator (Team N of M) in each team card header'
  - 'Copy from Team 1 button for teams at index 1+'
  - 'Form submission saves head/assistant coaches to coaches + coach_teams tables'
  - 'Form submission saves available_date_ids to team_registrations'
  - 'Coach conflict detection runs after all coach inserts on submission'
affects: [06-registration-flow-enhancements, admin-programs-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Collapsible section pattern with per-index expanded state map (Record<number, boolean>)'
    - 'Toggle switch with role=switch aria-checked for accessibility'
    - 'Deep copy array pattern for copyFromTeam1 (spread objects in .map)'

key-files:
  created: []
  modified:
    - components/auth/RegisterPage.tsx

key-decisions:
  - 'detectCoachConflicts wrapped in try/catch — non-fatal, conflict detection failure must not block registration submission'
  - 'Available All Dates = true stores empty array (available_date_ids: []) to team_registrations — semantics: empty = all dates'
  - 'Additional Coaches section collapsed by default — expands on toggle icon or ADD COACH click when list is empty'
  - 'Copy from Team 1 only available for teams at index 1+ — replaces head coach, additional coaches, and availability state'

patterns-established:
  - 'coachSectionExpanded: Record<number, boolean> — per-team-index toggle map pattern for Step 3 expandable sections'
  - 'formatEventDate uses toLocaleDateString with Intl options — avoids date-fns dependency in client components'

requirements-completed: [REG-02, REG-03, REG-08]

# Metrics
duration: 15min
completed: 2026-03-24
---

# Phase 6 Plan 03: Registration Step 3 Expansion Summary

**Step 3 wizard expanded with collapsible additional coaches, date availability toggle/checkboxes, team counter, copy-from-team-1 button, and full Supabase persistence of coaches/availability on submission**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-24T17:31:16Z
- **Completed:** 2026-03-24T17:46:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `additionalCoaches`, `availableAllDates`, `availableDateIds` fields to `TeamEntry` state shape and `defaultTeam` factory
- Fetches `event_dates` from Supabase on mount (alongside divisions and questions) and stores in component state
- Team card header shows "Team N of M" count indicator per D-18
- Collapsible "ADDITIONAL COACHES" section per team: add rows with name/email/phone/certifications fields, delete rows with Trash2 icon, expand/collapse via ChevronDown/ChevronUp toggle
- "Available All Dates" toggle (role="switch", aria-checked, navy when ON / gray when OFF); individual date checkboxes appear when OFF with validation warning if none selected
- "COPY FROM TEAM 1" button for teams at index 1+ — deep copies head coach fields, additionalCoaches array, and availability state
- Updated `validateTeams` to block submission if any team has toggle OFF and no dates selected
- Form submission inserts head coach to `coaches` + `coach_teams` (role: 'head') and each additional coach (role: 'assistant', added_by: 'program_leader')
- Saves `available_date_ids` array to `team_registrations` (empty array = all dates)
- Calls `detectCoachConflicts` after all inserts and upserts results to `coach_conflicts` table

## Task Commits

1. **Task 1: Extend RegisterPage Step 3 with coaches + availability + multi-team UX** - `aff4cca` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `components/auth/RegisterPage.tsx` - Extended Step 3 with all new UI sections and persistence logic

## Decisions Made

- `detectCoachConflicts` wrapped in try/catch — non-fatal; conflict detection failure must not block registration submission
- `available_date_ids: []` (empty array) means "available all dates" — consistent with team_registrations schema design from 06-01
- Additional Coaches section collapsed by default to keep the form clean for the common case (no extra coaches)
- Copy from Team 1 does a deep copy of additionalCoaches array (spread per object) to avoid shared references

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - type-check and lint passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REG-02 (date availability), REG-03 (add coaches in wizard), and REG-08 (multi-team session) are all satisfied
- Coach conflict data is now written to `coach_conflicts` table on each registration submission
- Phase 6 Plan 04 (coach self-registration) can proceed; the coaches + coach_teams tables are populated

## Self-Check: PASSED

- `components/auth/RegisterPage.tsx` — FOUND
- Commit `aff4cca` — FOUND
