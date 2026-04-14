---
phase: 08-schedule-change-request-workflow
plan: '04'
subsystem: schedule-change-request-ui
tags: [ui, modal, coach, program-leader, schedule-change, game-card]
dependency_graph:
  requires: [08-01, lib/store.tsx scheduleChangeRequests state from 08-03]
  provides:
    [
      ScheduleChangeRequestModal component,
      Request Change button in ScheduleTab,
      Request Change button in ProgramLeaderDashboard,
    ]
  affects:
    [
      components/schedule/ScheduleChangeRequestModal.tsx,
      components/schedule/ScheduleTab.tsx,
      components/programs/ProgramLeaderDashboard.tsx,
    ]
tech_stack:
  added: []
  patterns:
    [
      Modal with checkbox game list,
      role-gated button,
      badge-request-* CSS classes,
      aria-pressed toggle,
      CalendarX lucide icon,
    ]
key_files:
  created:
    - components/schedule/ScheduleChangeRequestModal.tsx
  modified:
    - components/schedule/ScheduleTab.tsx
    - components/programs/ProgramLeaderDashboard.tsx
decisions:
  - 'ScheduleBoardView and GameCard receive SCR props as parameters rather than using useAuth() inside GameCard — keeps GameCard pure and avoids hook call inside a non-top-level component'
  - 'ProgramLeaderDashboard loads teams/games/pending IDs directly from Supabase (not useApp store) since it is a portal component outside AppProvider'
  - 'Cancelled game uses opacity-50 on both tr row (table view) and card container + isFinal check merged — prevents duplicate opacity stacking'
  - 'scrTeamId state tracks which team opened the SCR modal in ProgramLeaderDashboard since PL may have multiple teams'
metrics:
  duration: '6 min'
  completed: '2026-03-24'
  tasks_completed: 2
  files_modified: 3
---

# Phase 8 Plan 04: Coach/PL Submission UI Summary

**One-liner:** ScheduleChangeRequestModal with game checkbox list + pre-selection, reason/type form, and POST API submit; "Request Change" button wired into ScheduleTab game cards and ProgramLeaderDashboard team game rows with status badges and cancelled game styling.

## Tasks Completed

| Task | Name                                                     | Commit  | Files                                                                               |
| ---- | -------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| 1    | ScheduleChangeRequestModal component                     | c0af83a | components/schedule/ScheduleChangeRequestModal.tsx                                  |
| 2    | Game card "Request Change" button + request status badge | 15a2458 | components/schedule/ScheduleTab.tsx, components/programs/ProgramLeaderDashboard.tsx |

## What Was Built

### ScheduleChangeRequestModal (components/schedule/ScheduleChangeRequestModal.tsx)

- `'use client'` modal using shared `Modal`, `Btn`, `FormField`, `Select`, `Textarea` from UI kit
- Props: `open`, `onClose`, `preSelectedGameId`, `teamId`, `teamGames: Game[]`
- State: `selectedGameIds: Set<number>`, `requestType`, `reasonCategory`, `reasonDetails`, `submitting`
- Pre-selects game when opened from game card (D-08)
- AFFECTED GAMES section: scrollable checkbox list (`max-h-[200px]`), filtered to future games, `accent-[#0B3D91]` checkboxes
- What do you need? toggle: Reschedule / Cancel Game with `aria-pressed` accessibility
- Reason dropdown with `bg-[#040e24]` (known gotcha per CLAUDE.md) and 5 preset categories
- Optional details textarea with placeholder "Describe the conflict or issue..."
- Submit calls `POST /api/schedule-change-requests?event_id=...` with toast feedback
- Focus management via `containerRef.focus()` on open; Escape key handler

### ScheduleTab modifications

- Imports: `useAuth`, `ScheduleChangeRequestModal`, `CalendarX` from lucide-react, `ScheduleChangeRequest` type
- SCR modal state: `scrModalOpen`, `scrPreSelectedGameId`
- Derived: `teamId` from `userRole.team_id`, `teamGames` filtered from `state.games`, `pendingRequestGameIds` from `state.scheduleChangeRequests`
- Table view: "Request Change" button (role-gated, disabled when pending, shows "Request pending" tooltip), badge-request-\* status badge, cancelled row opacity-50 + line-through on time
- Board view: `GameCard` and `ScheduleBoardView` receive `pendingRequestGameIds`, `scheduleChangeRequests`, `userRole`, `onRequestChange` props
- `GameCard`: Request Change button rendered below action buttons; request status badge above action buttons; cancelled games show `opacity-50` and skip action buttons
- SCR modal rendered at bottom of ScheduleTab return, conditional on `teamId`

### ProgramLeaderDashboard modifications

- Imports: `CalendarX`, `ScheduleChangeRequestModal`, `Game` type
- New state: `programTeams`, `programGames`, `pendingGameIds`, `scrModalOpen`, `scrPreSelectedGameId`, `scrTeamId`
- Extended `loadData()`: queries `teams` by `program_id` and `event_id`; queries `games` for those team IDs; queries `schedule_change_requests` for pending/under_review status to build `pendingGameIds`
- Team cards: UPCOMING GAMES section added — each game row shows time, opponent, and "Request Change" Btn (disabled when pending, hidden for cancelled games, line-through on cancelled time)
- SCR modal: conditional on `scrTeamId`, passes correct `teamId` and filtered `teamGames`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified. Minor structural decision: `GameCard` receives SCR props as parameters rather than calling `useAuth()` internally, which would break React rules (hooks in nested non-top-level component functions technically still works but is cleaner this way).

## Verification

- `npx tsc --noEmit` exits 0
- `grep -r "ScheduleChangeRequestModal" components/` returns 7 matches (definition + 2 imports + multiple render sites)
- `grep "Request Change" components/schedule/ScheduleTab.tsx` returns match
- `grep "Request Change" components/programs/ProgramLeaderDashboard.tsx` returns match

## Known Stubs

None — all functionality is wired to real API endpoints and real data sources.

## Self-Check: PASSED

- components/schedule/ScheduleChangeRequestModal.tsx exists and contains "Request Schedule Change" ✓
- components/schedule/ScheduleTab.tsx contains "ScheduleChangeRequestModal" import ✓
- components/schedule/ScheduleTab.tsx contains "Request Change" text ✓
- components/programs/ProgramLeaderDashboard.tsx contains "ScheduleChangeRequestModal" import ✓
- components/programs/ProgramLeaderDashboard.tsx contains "Request Change" text ✓
- Commits c0af83a and 15a2458 exist ✓
- tsc --noEmit exits 0 ✓
