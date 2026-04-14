---
phase: 06-registration-flow-enhancements
plan: 05
subsystem: registration
tags: [coach-invites, registration-window, schedule-engine, coach-conflicts, admin-ui]
dependency_graph:
  requires: [06-01, 06-02, 06-03, 06-04]
  provides: [coach-invite-api, registration-window-enforcement, schedule-coach-conflicts, coach-conflict-badges]
  affects: [program-leader-portal, registration-flow, schedule-generation, admin-programs-view]
tech_stack:
  added: []
  patterns: [upsert-on-conflict, slot-level-constraint, registration-window-check]
key_files:
  created:
    - app/api/coach-invite/route.ts
    - components/programs/ProgramLeaderDashboard.tsx
  modified:
    - app/e/[slug]/register/page.tsx
    - lib/engines/schedule.ts
    - components/programs/ProgramApprovals.tsx
decisions:
  - onConflict: 'program_id,event_id' used for coach_invites upsert — one invite row per program per event, regenerate updates token in place
  - Coach conflicts are slot-level constraints only — two teams sharing a coach CAN play each other, just not simultaneously with other shared-coach teams (per Pitfall 1)
  - Registration window check evaluates registration_open boolean first (manual override), then date window fields
  - ProgramLeaderDashboard.tsx is a new dedicated component separate from existing ProgramDashboard.tsx
metrics:
  duration: 15 min
  completed_date: "2026-03-24"
  tasks_completed: 3
  files_created: 2
  files_modified: 3
---

# Phase 6 Plan 05: Integration Layer — Coach Invites, Registration Window, Schedule Engine Summary

**One-liner:** Coach invite link API with QR codes, registration window enforcement blocking the register page, and schedule engine slot-level coach conflict wiring.

## Tasks Completed

| #   | Task                                                                    | Commit  | Files                                                                         |
| --- | ----------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| 1   | Program leader portal coach section + invite API                        | c1d0f56 | app/api/coach-invite/route.ts, components/programs/ProgramLeaderDashboard.tsx |
| 2   | Registration window enforcement + schedule engine coach conflict wiring | 9918541 | app/e/[slug]/register/page.tsx, lib/engines/schedule.ts                       |
| 3   | Coach conflict badges in admin view + final wiring                      | a392444 | components/programs/ProgramApprovals.tsx                                      |

## What Was Built

### Task 1: Coach Invite API + Program Leader Dashboard

**`app/api/coach-invite/route.ts`** — Authenticated REST API:

- `POST` — Generates or regenerates coach invite link via upsert on `(program_id, event_id)`. Verifies user is program_leader for the given program. Sets `expires_at` from event's `registration_closes_at`. Returns `{ token, inviteUrl }`.
- `DELETE` — Revokes by setting `is_active = false` (no delete). Same auth check.

**`components/programs/ProgramLeaderDashboard.tsx`** — New portal dashboard component:

- Fetches team registrations, coaches (via `coach_teams`), event dates, invite status
- GENERATE INVITE LINK button + invite display with copy + QR thumbnail (80x80)
- QR modal with `QRCodeSVG bgColor="#FFFFFF" fgColor="#000000"` per Phase 5 black-on-white pattern
- SVG and PNG download from QR modal
- REVOKE LINK confirmation modal with "Revoke Coach Invite Link?" title
- Per-team coach list with avatar initials, certifications pill, role pill
- Team availability display (maps available_date_ids to event date labels, falls back to "Available all dates")

### Task 2: Registration Window Enforcement + Schedule Engine

**`app/e/[slug]/register/page.tsx`** — Full window enforcement:

- Fetches `registration_opens_at`, `registration_closes_at`, `registration_open`
- Closed manual: "Registration is currently closed. Contact the event organizer for details."
- Before window: "Registration opens {MMMM d, yyyy}"
- After window: "Registration closed on {MMMM d, yyyy}"
- Open: Renders Register Now button linking to `${NEXT_PUBLIC_APP_URL}/register?event_id=...`
- Card uses `bg-[#081428]` background per UI-SPEC

**`lib/engines/schedule.ts`** — Coach conflict slot-level constraints:

- Imports `getConflictingTeamPairs` from `./coach-conflicts`
- Loads `coachConflictPairs` Set before slot assignment loop
- `teamsShareCoach(teamA, teamB)` helper using min/max key pattern
- `coachConflictInSlot` check: any game in same date+time slot involving teams sharing a coach with current matchup → skip this slot
- Correctly placed in the slot assignment inner loop, NOT in `filteredMatchups` (per Pitfall 1)

### Task 3: Coach Conflict Badges in Admin View

**`components/programs/ProgramApprovals.tsx`** — Admin program management:

- Added `conflictsByTeam` state (`Map<teamId, {coachName, otherTeamIds}[]>`)
- Fetches `coach_conflicts` where `resolved=false` in parallel with other data
- Builds lookup map from conflict rows
- Yellow `<Pill variant="yellow">COACH CONFLICT</Pill>` badge on affected teams
- `aria-label` for accessibility: "Coach conflict: {coachName} also assigned to other teams"
- Click-to-expand inline conflict description

## Decisions Made

| Decision                                              | Rationale                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| upsert with `onConflict: 'program_id,event_id'`       | Updates token in-place; UNIQUE constraint means one invite per program per event per Pitfall 5                                  |
| Coach conflicts at slot-level only                    | Two teams sharing a coach can still play each other — constraint only prevents simultaneous scheduling per Pitfall 1 / RESEARCH |
| `registration_open=false` checked first               | Manual admin override takes precedence over date-based window                                                                   |
| ProgramLeaderDashboard separate from ProgramDashboard | Different role/scope — keeps components focused and avoids bloating existing dashboard                                          |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to live Supabase queries.

## Self-Check: PASSED

All created files confirmed present. All task commits (c1d0f56, 9918541, a392444) confirmed in git history. npm run type-check exits 0.
