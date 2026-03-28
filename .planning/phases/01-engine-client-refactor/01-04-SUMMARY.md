---
phase: 01
plan: 04
title: 'Client-Side Migration'
subsystem: 'components/engine'
tags: ['client-migration', 'fetch-api', 'security', 'engine']
dependency_graph:
  requires: ['01-01', '01-02', '01-03']
  provides: ['CommandCenter uses fetch instead of direct engine imports']
  affects: ['components/engine/CommandCenter.tsx', 'components/weather/WeatherTab.tsx']
tech_stack:
  added: []
  patterns: ['fetch() for server-side engine operations from client components']
key_files:
  created: []
  modified:
    - 'components/engine/CommandCenter.tsx'
decisions:
  - 'WeatherTab.tsx verified safe — pure function imports from weather engine require no changes'
  - 'handleGenerateHandoff uses handoffData.summary ?? handoffData to handle both placeholder and final string response shapes'
metrics:
  duration: '5 min'
  completed: '2026-03-22T20:29:05Z'
  tasks_completed: 2
  files_modified: 1
---

# Phase 1 Plan 04: Client-Side Migration Summary

## One-liner

Replaced direct engine imports in CommandCenter.tsx with fetch() calls to /api/unified-engine, /api/unified-engine/resolve, and /api/shift-handoff; verified WeatherTab.tsx pure-function imports are safe.

## What Was Built

### Task 1 — Replace direct engine imports in CommandCenter.tsx with API fetch calls

Removed the value import `{ runUnifiedEngine, resolveAlert, generateShiftHandoff }` from `@/lib/engines/unified`. The `import type { OpsAlert }` is retained (type-only imports are erased at build time and safe in client bundles).

Three handler functions were updated:

- `handleRunAll()`: now POSTs to `/api/unified-engine` with `{ event_date_id }`. Checks `response.ok`, throws `error` from JSON body on failure, surfaces via `toast.error`.
- `handleResolve()`: now POSTs to `/api/unified-engine/resolve` with `{ alert_id, resolved_by, note }`. Same error pattern.
- `handleGenerateHandoff()`: now POSTs to `/api/shift-handoff` with `{ created_by }`. Reads `handoffData.summary ?? handoffData` to handle both the current placeholder response shape and the final string return from `generateShiftHandoff`.

### Task 2 — Verify WeatherTab.tsx pure-function imports are still valid

`WeatherTab.tsx` imports only:

- `conditionIcon`, `windDirection`, `evaluateAlerts`, `calcHeatIndex`, `THRESHOLDS` — all pure computation functions with no DB access
- `type WeatherReading`, `type WeatherAlert` — type-only imports

No DB-accessing functions (e.g., `runWeatherEngine`, `getLatestReading`) are imported. Weather scans and lightning operations already use `fetch('/api/weather-engine', ...)` and `fetch('/api/lightning', ...)`. No code changes were required.

## Verification

- `CommandCenter.tsx` has zero non-type imports from `@/lib/engines/*`
- All 3 engine operations in `CommandCenter.tsx` go through API routes
- `WeatherTab.tsx` pure function imports verified as safe (no DB exposure)
- `npm run type-check` passes with no errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The API routes themselves (created in Plan 01-02) still have TODO placeholder responses pending Plan 01-03 wire-up. This is expected and intentional — Plan 01-03 removes those placeholders. The `CommandCenter.tsx` changes are correct regardless; once Plan 01-03 completes, the full flow will work end-to-end.

## Self-Check

- [x] `components/engine/CommandCenter.tsx` modified (no non-type engine imports remain)
- [x] `npm run type-check` passes
- [x] Task 1 commit: `0c592c0`
- [x] Task 2 commit: `95c5caf`
