---
phase: 09-public-results-site
plan: "02"
subsystem: public-results
tags: [schedule, sub-views, search, client-island, server-component]
dependency_graph:
  requires: [09-01]
  provides: [schedule-tab-container, team-search-input, by-team-view, by-field-view, by-time-view]
  affects: [09-03]
tech_stack:
  added: []
  patterns: [server-component, client-island, url-searchparam-routing, groupBy-utility]
key_files:
  created:
    - apps/public-results/src/components/schedule/ScheduleTabWithSubViews.tsx
    - apps/public-results/src/components/schedule/TeamSearchInput.tsx
    - apps/public-results/src/components/schedule/ByTeamView.tsx
    - apps/public-results/src/components/schedule/ByFieldView.tsx
    - apps/public-results/src/components/schedule/ByTimeView.tsx
  modified: []
decisions:
  - "ScheduleTabWithSubViews is a pure server component — reads view/activeDay/teamId/divFilter as props (from page searchParams) and conditionally renders the correct sub-view"
  - "TeamSearchInput is the only 'use client' component — keeps client JS minimal; rest of schedule is server-rendered"
  - "Day navigation row only renders when event has more than 1 date — avoids empty row for single-day events"
  - "ByTeamView uses two modes: team list (TeamSearchInput island) when teamId is null, single-team filtered mode when teamId is set"
  - "formatTime in ByTimeView handles HH:MM:SS or HH:MM formats from Supabase and outputs 12-hour AM/PM display"
metrics:
  duration: "2 min"
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_modified: 5
---

# Phase 9 Plan 02: Schedule Sub-Views Summary

**One-liner:** Five schedule components (ScheduleTabWithSubViews container, TeamSearchInput client island, ByTeamView/ByFieldView/ByTimeView server components) implementing three parent-facing schedule views with day navigation and type-ahead team search.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ScheduleTabWithSubViews container + day navigation + TeamSearchInput | c5c0af2 | apps/public-results/src/components/schedule/ScheduleTabWithSubViews.tsx, apps/public-results/src/components/schedule/TeamSearchInput.tsx |
| 2 | ByTeamView, ByFieldView, and ByTimeView sub-view components | 17339f9 | apps/public-results/src/components/schedule/ByTeamView.tsx, apps/public-results/src/components/schedule/ByFieldView.tsx, apps/public-results/src/components/schedule/ByTimeView.tsx |

## What Was Built

### Task 1: Container and search components
- **`ScheduleTabWithSubViews.tsx`**: Server component container with sub-view toggle row (By Team / By Field / By Time as `<Link>` components with active/inactive pill styles), day navigation pills (horizontal scroll for multi-day events), games filtered by activeDay then by divFilter, conditional rendering of the three sub-views. URL pattern: `?tab=schedule&view=team|field|time&day=N&div=X`.
- **`TeamSearchInput.tsx`**: `'use client'` component with `type="search"` input, `aria-label="Search teams"`, `autoFocus`, inline `useState` for query, client-side `groupBy` division grouping, team rows as `<Link>` components linking to `?tab=schedule&view=team&team=${id}`, clear (×) button when input has text, empty state "No teams match your search."

### Task 2: Sub-view components
- **`ByTeamView.tsx`**: Server component with two modes: (1) team list mode renders `<TeamSearchInput>` client island; (2) single-team mode renders "← All Teams" back link, team name header, and filtered game rows using `GameRow` helper component. Game rows reuse the existing card pattern (time + field, home/away teams with scores, status badge).
- **`ByFieldView.tsx`**: Server component grouping games by `game.field?.name ?? 'Unassigned'` with `groupBy`, sorted alphabetically, only fields with games rendered. Each field card: `rounded-xl p-4` with field name header + game count, games separated by `divide-y divide-[#1a2d50]/40` dividers. Empty state: "No games scheduled on this date."
- **`ByTimeView.tsx`**: Server component grouping games by `scheduled_time`, sorted chronologically. `formatTime()` converts `HH:MM:SS` to `9:00 AM` format. Time group heading in 12px bold uppercase, games as two-line home/away cards with `space-y-6` between groups. Empty state: "No games scheduled for this selection."

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all five components receive real data via props from the parent page component and render it fully. No hardcoded placeholder data.

## Self-Check: PASSED

- [x] `ScheduleTabWithSubViews.tsx` contains "export", "ByTeamView", "ByFieldView", "ByTimeView"
- [x] `ScheduleTabWithSubViews.tsx` contains "?tab=schedule&view="
- [x] `ScheduleTabWithSubViews.tsx` contains "Day " (day navigation labels)
- [x] `TeamSearchInput.tsx` contains "'use client'"
- [x] `TeamSearchInput.tsx` contains "aria-label" and "Search teams"
- [x] `TeamSearchInput.tsx` contains "useState"
- [x] `ByTeamView.tsx` contains "ByTeamView", "teamId", "All Teams"
- [x] `ByFieldView.tsx` contains "ByFieldView", "groupBy", "rounded-xl"
- [x] `ByTimeView.tsx` contains "ByTimeView", "groupBy", "space-y-6"
- [x] All three sub-view files import from "@/lib/data"
- [x] `ByTeamView.tsx` contains "TeamSearchInput" import
- [x] TypeScript compiles clean (npx tsc --noEmit exits 0)
- [x] Commit c5c0af2 exists (Task 1)
- [x] Commit 17339f9 exists (Task 2)
