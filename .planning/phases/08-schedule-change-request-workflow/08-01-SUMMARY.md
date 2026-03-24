---
phase: 08-schedule-change-request-workflow
plan: "01"
subsystem: schedule-change-requests
tags: [database, types, schemas, db-functions, css, foundation]
dependency_graph:
  requires: []
  provides: [schedule_change_requests table, schedule_change_request_games table, ScheduleChangeRequest types, Zod schemas, CRUD functions, badge CSS classes]
  affects: [types/index.ts, lib/db.ts, app/globals.css]
tech_stack:
  added: [reschedule_game RPC function, schedule_change_requests realtime]
  patterns: [BIGSERIAL PK, RLS with user_event_ids(), SECURITY DEFINER atomic RPC, Record<GameStatus> exhaustive maps]
key_files:
  created:
    - supabase/phase8_schedule_change.sql
    - schemas/schedule-change-requests.ts
  modified:
    - types/index.ts
    - lib/db.ts
    - app/globals.css
    - lib/utils.ts
    - components/ui/index.tsx
decisions:
  - "GameStatus 'Cancelled' requires updating all Record<GameStatus, string> exhaustive maps in lib/utils.ts and components/ui/index.tsx"
  - "reschedule_game uses SECURITY DEFINER with atomic conflict check — checks field availability before updating games and junction table"
  - "insertScheduleChangeRequest inserts request first then junction rows — sequential inserts to satisfy FK constraint on request_id"
metrics:
  duration: "8 min"
  completed: "2026-03-24"
  tasks_completed: 2
  files_modified: 7
---

# Phase 8 Plan 01: Database Foundation and Types Summary

**One-liner:** PostgreSQL migration with schedule_change_requests tables + atomic reschedule_game RPC, TypeScript interfaces, Zod validation schemas, and 9 CSS badge classes for the schedule change request workflow.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Database migration and TypeScript types | 53a8e47 | supabase/phase8_schedule_change.sql, types/index.ts, lib/utils.ts, components/ui/index.tsx |
| 2 | Zod schemas, db.ts CRUD functions, and CSS badge classes | 8cd6947 | schemas/schedule-change-requests.ts, lib/db.ts, app/globals.css |

## What Was Built

### Database (supabase/phase8_schedule_change.sql)
- Updated `games_status_check` constraint to include `'Cancelled'`
- `schedule_change_requests` table with all required columns, status CHECK, and FK constraints to events, auth.users, teams
- `schedule_change_request_games` junction table with UNIQUE(request_id, game_id) and FK to fields
- 5 indexes for fast event/status/team/request/game lookups
- RLS policies: auth SELECT, auth INSERT (submitted_by = auth.uid()), admin UPDATE on both tables
- `reschedule_game` atomic SECURITY DEFINER function: conflict detection + games UPDATE + junction UPDATE in one transaction
- Realtime enabled on schedule_change_requests

### Types (types/index.ts)
- `GameStatus` extended with `'Cancelled'`
- `RequestStatus`, `RequestGameStatus`, `RequestType`, `RequestReasonCategory` union types
- `ScheduleChangeRequest` interface with all DB columns + optional joins (team, games)
- `ScheduleChangeRequestGame` interface with all DB columns + optional game join

### Schemas (schemas/schedule-change-requests.ts)
- `createScheduleChangeRequestSchema`: validates team_id, request_type, reason_category, reason_details, game_ids (min 1)
- `updateScheduleChangeRequestSchema`: validates status (under_review/approved/denied) and admin_notes
- Exported inferred types `CreateScheduleChangeRequest` and `UpdateScheduleChangeRequest`

### DB Functions (lib/db.ts)
- `getScheduleChangeRequests(eventId)`: selects with joined schedule_change_request_games and teams, ordered by created_at desc
- `insertScheduleChangeRequest(request, gameIds)`: inserts request row then junction rows
- `updateScheduleChangeRequestStatus(id, status, adminNotes?, reviewedBy?)`: updates status + sets reviewed_at when approved/denied
- `updateScheduleChangeRequestGameStatus(id, status)`: updates single junction row status

### CSS (app/globals.css)
- `.badge-cancelled` for game status display in StatusBadge
- 8 `.badge-request-*` classes: pending, under_review, approved, denied, rescheduled, cancelled, partially_complete, completed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 'Cancelled' to Record<GameStatus, string> exhaustive maps**
- **Found during:** Task 1 — tsc verification
- **Issue:** Adding `'Cancelled'` to `GameStatus` union caused TypeScript errors in `lib/utils.ts` (`statusColor`, `statusBg` functions) and `components/ui/index.tsx` (`STATUS_CLASS` map) — all use `Record<GameStatus, string>` which requires exhaustive coverage
- **Fix:** Added `Cancelled: 'text-muted'` to statusColor, `Cancelled: 'bg-gray-800/50 text-gray-400'` to statusBg, and `Cancelled: 'badge-cancelled'` to STATUS_CLASS
- **Files modified:** lib/utils.ts, components/ui/index.tsx
- **Commit:** 53a8e47 (included in Task 1 commit)

## Verification

- `npx tsc --noEmit` exits 0 — no TypeScript errors
- `grep -c "schedule_change_requests" supabase/phase8_schedule_change.sql` returns 18
- `grep -c "badge-request-" app/globals.css` returns 8
- `grep "ScheduleChangeRequest" types/index.ts` returns interface declarations

## Known Stubs

None — all CRUD functions are fully implemented with real Supabase queries.

## Self-Check: PASSED

- supabase/phase8_schedule_change.sql exists with "CREATE TABLE IF NOT EXISTS schedule_change_requests" ✓
- types/index.ts contains "export interface ScheduleChangeRequest" ✓
- schemas/schedule-change-requests.ts contains "createScheduleChangeRequestSchema" ✓
- lib/db.ts contains "getScheduleChangeRequests" ✓
- app/globals.css contains ".badge-request-pending" ✓
- Commits 53a8e47 and 8cd6947 exist ✓
