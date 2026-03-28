---
phase: 09-public-results-site
plan: '01'
subsystem: public-results
tags: [database, migration, data-layer, bracket, standings, css, qr-code]
dependency_graph:
  requires: [09-00]
  provides: [bracket-tables, standings-view, data-layer-extensions, score-flash-css, qrcode-react]
  affects: [09-02, 09-03, 09-04, 09-05]
tech_stack:
  added: [qrcode.react@^3.2.0]
  patterns: [postgresql-view, lateral-join, rls-policies, supabase-typed-queries]
key_files:
  created:
    - supabase/phase9_bracket_migration.sql
  modified:
    - apps/public-results/src/lib/data.ts
    - apps/public-results/src/app/globals.css
    - apps/public-results/package.json
    - apps/public-results/package-lock.json
decisions:
  - 'standings_by_division implemented as PostgreSQL view with LATERAL joins — satisfies ROADMAP criterion 3 (sourced from view, not computed client-side)'
  - 'qrcode.react pinned at ^3.2.0 (satisfies ^3.x range per ROADMAP; resolves to 3.2.0 on install)'
  - 'getPublicBracket returns {format: null, rounds: []} on error or empty — safe default for UI components'
  - 'getPublicStandings orders by division, then wins desc, then goal_diff desc — consistent with lacrosse tournament display conventions'
metrics:
  duration: '2 min'
  completed_date: '2026-03-24'
  tasks_completed: 2
  files_modified: 5
---

# Phase 9 Plan 01: Foundation — Bracket Tables, Data Layer, CSS, and Package Install Summary

**One-liner:** PostgreSQL bracket tables and standings_by_division view, typed Supabase query functions for brackets/standings/fields/dates, scoreFlash CSS animation, and qrcode.react ^3.x installed — unblocks all Phase 9 UI work.

## Tasks Completed

| Task | Name                                                                       | Commit  | Files                                                                                                            |
| ---- | -------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | DB migration SQL + qrcode.react install + scoreFlash CSS                   | 6d9f92e | supabase/phase9_bracket_migration.sql, apps/public-results/package.json, apps/public-results/src/app/globals.css |
| 2    | Extend data layer with bracket queries, event dates, fields, and standings | e91bccc | apps/public-results/src/lib/data.ts                                                                              |

## What Was Built

### Task 1: Foundation artifacts

- **`supabase/phase9_bracket_migration.sql`**: Complete migration with `bracket_rounds` and `bracket_matchups` tables (with FK constraints and self-referential advancement fields), `standings_by_division` PostgreSQL view using LATERAL joins for correct win/loss/tie/goals calculation, `GRANT SELECT` to anon and authenticated roles, all RLS policies (anon read, auth read/write for both tables), and 5 performance indexes (bracket event/round, games event_date/division).
- **`apps/public-results/package.json`**: qrcode.react ^3.2.0 added to dependencies.
- **`apps/public-results/src/app/globals.css`**: `@keyframes scoreFlash` and `.score-flash` class appended — used by live score update animations in Plans 02/03.

### Task 2: Data layer extensions

- **`apps/public-results/src/lib/data.ts`**: Added 5 new interfaces (`PublicEventDate`, `PublicField`, `BracketRound`, `BracketMatchup`, `ViewStanding`) and 4 new async query functions (`getPublicEventDates`, `getPublicFields`, `getPublicStandings`, `getPublicBracket`). Updated `PublicEvent` with `has_bracket?: boolean`. Updated `getPublicEvents` and `getPublicEventBySlug` select strings to include `has_bracket`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates foundational data layer with no UI rendering. All functions return typed data or throw on error. No hardcoded placeholder data.

## Self-Check: PASSED

- [x] `supabase/phase9_bracket_migration.sql` exists with all required content
- [x] `apps/public-results/src/lib/data.ts` exports all 5 new interfaces and 4 new query functions
- [x] `apps/public-results/src/app/globals.css` contains `@keyframes scoreFlash` and `.score-flash`
- [x] `apps/public-results/package.json` contains `qrcode.react` at `^3.2.0`
- [x] `apps/public-results/src/lib/utils.ts` confirmed from Plan 09-00 (groupBy utility)
- [x] `npx tsc --noEmit` exits 0
- [x] `npx vitest run` — 16/16 tests pass (5 test files)
- [x] Commit 6d9f92e exists (Task 1)
- [x] Commit e91bccc exists (Task 2)
