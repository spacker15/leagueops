---
phase: 09-public-results-site
plan: "03"
subsystem: public-results
tags: [realtime, supabase, live-scores, animation, accessibility, client-component]
dependency_graph:
  requires: [09-01]
  provides: [live-scores-client, connection-error-banner, score-flash-css]
  affects: [09-02, 09-04, 09-05]
tech_stack:
  added: []
  patterns: [supabase-realtime, render-props, react-useCallback, css-keyframe-animation]
key_files:
  created:
    - apps/public-results/src/app/e/[slug]/LiveScoresClient.tsx
    - apps/public-results/src/components/ConnectionErrorBanner.tsx
  modified:
    - apps/public-results/src/app/globals.css
decisions:
  - "scoreFlash CSS added to globals.css in this plan — Plan 01 adds it in parallel worktrees, but the worktree here was on an older branch without those changes"
  - "Render props pattern chosen for LiveScoresClient so all tabs (Schedule, Live, Bracket) can consume live data from one subscription without re-subscribing"
  - "5-second connection timeout triggers ConnectionErrorBanner — non-blocking, page content still renders"
  - "triggerFlash uses useCallback to stabilize identity for useEffect dependency array"
  - "timeoutRefs Map ensures rapid score updates on same game don't accumulate stale timeouts"
metrics:
  duration: "4 min"
  completed_date: "2026-03-25"
  tasks_completed: 1
  files_modified: 3
---

# Phase 9 Plan 03: LiveScoresClient — Realtime Subscription and Score Flash Summary

**One-liner:** Event-scoped Supabase Realtime channel with render props pattern, score flash animation via flashingIds Set, and ConnectionErrorBanner fallback after 5-second timeout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LiveScoresClient with Realtime subscription, score flash tracking, and ConnectionErrorBanner | 74af651 | apps/public-results/src/app/e/[slug]/LiveScoresClient.tsx, apps/public-results/src/components/ConnectionErrorBanner.tsx, apps/public-results/src/app/globals.css |

## What Was Built

### Task 1: LiveScoresClient + ConnectionErrorBanner + CSS

**`apps/public-results/src/app/globals.css`**: Added `@keyframes scoreFlash` (green-400 fade from 25% opacity to transparent over 600ms) and `.score-flash` class (600ms ease-out animation, 4px border-radius, 0 2px padding). This was not yet present in the worktree — added as a prerequisite deviation.

**`apps/public-results/src/components/ConnectionErrorBanner.tsx`**: Simple server component markup. Yellow warning card with `bg-yellow-900/20 border border-yellow-500/30` styling and "Live scores unavailable — reload to retry" text per UI-SPEC §5.3 and copywriting contract.

**`apps/public-results/src/app/e/[slug]/LiveScoresClient.tsx`**: Client component (`'use client'`) that:
- Subscribes to `live-scores-{eventId}` channel with `postgres_changes` filter on `games` table `UPDATE` events scoped to `event_id=eq.{eventId}` — one channel per page, not global (D-12)
- Tracks `liveGames` state starting from `initialGames` prop — updates scores in place when game is Live/Halftime, removes game from list when non-live
- Tracks `flashingIds` Set — adds game ID on score change, removes it 650ms later (slightly longer than 600ms animation)
- Uses `triggerFlash(gameId)` callback with per-game timeout tracking via `timeoutRefs` Map to prevent stale timeout accumulation
- Renders `ConnectionErrorBanner` after 5-second connection timeout if `SUBSCRIBED` status not received (D-14)
- Wraps output in `aria-live="polite"` for screen reader score announcement
- Passes `(liveGames, flashingIds)` as render props to `children` — consuming tabs apply `score-flash` CSS class when `flashingIds.has(game.id)`
- Cleans up channel + all flash timeouts on unmount

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added scoreFlash CSS to globals.css**
- **Found during:** Task 1 pre-flight
- **Issue:** Plan 03 plan notes scoreFlash CSS as a prerequisite from Plan 01, but the worktree branch did not include Plan 01's globals.css changes
- **Fix:** Added `@keyframes scoreFlash` and `.score-flash` class directly to globals.css in this plan
- **Files modified:** `apps/public-results/src/app/globals.css`
- **Commit:** 74af651

## Known Stubs

None — LiveScoresClient provides real data via Realtime subscription. ConnectionErrorBanner shows real error state. No hardcoded placeholder data.

## Self-Check: PASSED

- [x] `apps/public-results/src/app/e/[slug]/LiveScoresClient.tsx` exists and contains `'use client'`
- [x] LiveScoresClient.tsx contains `supabase.channel(\`live-scores-${eventId}\`)`
- [x] LiveScoresClient.tsx contains `postgres_changes`
- [x] LiveScoresClient.tsx contains `event_id=eq.`
- [x] LiveScoresClient.tsx contains `flashingIds`
- [x] LiveScoresClient.tsx contains `triggerFlash`
- [x] LiveScoresClient.tsx contains `aria-live`
- [x] LiveScoresClient.tsx contains `ConnectionErrorBanner`
- [x] `apps/public-results/src/components/ConnectionErrorBanner.tsx` contains "Live scores unavailable"
- [x] ConnectionErrorBanner.tsx contains `bg-yellow-900/20`
- [x] `apps/public-results/src/app/globals.css` contains `scoreFlash` keyframe and `.score-flash` class
- [x] TypeScript compiles clean (`npx tsc --noEmit` exits 0)
- [x] Commit 74af651 exists
