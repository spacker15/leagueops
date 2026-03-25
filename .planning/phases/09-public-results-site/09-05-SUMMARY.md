---
phase: 09-public-results-site
plan: 05
subsystem: ui
tags: [public-results, integration, realtime, qrcode, schedule, bracket, standings, nextjs]

# Dependency graph
requires:
  - phase: 09-02
    provides: ScheduleTabWithSubViews, ByTeamView, ByFieldView, ByTimeView, TeamSearchInput
  - phase: 09-03
    provides: LiveScoresClient, ConnectionErrorBanner
  - phase: 09-04
    provides: BracketTab, SingleEliminationBracket, DoubleEliminationBracket, BracketMatchupCard
  - phase: 09-01
    provides: getPublicStandings, getPublicBracket, getPublicEventDates, ViewStanding, BracketRound
provides:
  - EventSearchFilter client island (name/location filter with clear button and empty state)
  - EventQRCode component (black-on-white QR for scanner compatibility, event and team URLs)
  - loading.tsx route skeleton (animate-pulse during route transitions)
  - Fully integrated event page with all 5 tabs, LiveScoresClient, searchParams, QR header
  - Homepage with EventSearchFilter replacing static event grid
  - StandingsSection sourced from PostgreSQL view via getPublicStandings
  - LiveSectionEnhanced with next-game info when no live games
  - GameResultCard with score-flash animation class for Realtime updates
affects: []

# Tech tracking
tech-stack:
  added:
    - qrcode.react (QRCodeSVG component for team and event QR codes)
    - Supabase Proxy lazy-init pattern (prevents crash when env vars absent at build time)
  patterns:
    - LiveScoresClient render props with 2-arg children (liveGames, flashingIds)
    - PostgreSQL view-backed standings (standings_by_division) replacing client-side computation
    - EventSearchFilter as client island wrapping server-fetched event list
    - ISR revalidate = 30 on event page, revalidate = 60 on homepage

key-files:
  created:
    - apps/public-results/src/components/EventSearchFilter.tsx
    - apps/public-results/src/components/EventQRCode.tsx
    - apps/public-results/src/app/e/[slug]/loading.tsx
  modified:
    - apps/public-results/src/app/e/[slug]/page.tsx
    - apps/public-results/src/app/page.tsx
    - apps/public-results/src/lib/supabase.ts

key-decisions:
  - "Supabase client rewritten as lazy Proxy singleton to prevent build-time crash when NEXT_PUBLIC_SUPABASE_URL is absent — was a pre-existing bug that blocked npm run build"
  - "EventCard moved inside EventSearchFilter (client component) to keep component tree consistent — server page.tsx no longer defines EventCard"
  - "QR display: black-on-white (bgColor #FFFFFF, fgColor #000000) in white container for maximum scanner compatibility per plan spec (overrides UI-SPEC white-on-dark variant)"
  - "StandingsSection columns changed to match ViewStanding schema (wins/losses/ties/points_for/points_against/goal_diff) removing GP and PTS from old computeStandings-based approach"

requirements-completed: [PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06]

# Metrics
duration: 15min
completed: 2026-03-25
---

# Phase 9 Plan 05: Final Integration Summary

**Public results site is feature-complete: all Wave 1-4 components wired into working pages with LiveScoresClient realtime subscription, view-backed standings, QR sharing, homepage search, and loading skeleton.**

## Performance

- **Duration:** ~15 min
- **Started:** ~2026-03-25T01:20:00Z
- **Completed:** 2026-03-25T01:35:30Z
- **Tasks:** 3 completed
- **Files modified:** 6
- **Files created:** 3

## Accomplishments

### Task 1: EventSearchFilter, EventQRCode, and loading skeleton (commit 985e6ad)

Created `EventSearchFilter.tsx` (client component):
- Inline `useState` for query string — no API calls, pure client-side filter
- Filters `event.name` and `event.location` (case-insensitive substring)
- Clear button (`×`) appears when query has text, `aria-label="Clear search"`
- Empty state: "No events match your search." in muted uppercase 12px
- Event grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- `EventCard` component defined inside file with `aria-label="View results for {event.name}"`

Created `EventQRCode.tsx` (client component):
- `QRCodeSVG` from qrcode.react with `bgColor="#FFFFFF"` / `fgColor="#000000"` (black-on-white)
- White container wrapper `bg-white rounded-lg p-2` for scanner contrast
- Event URL: `{baseUrl}/e/{slug}` — team URL: `{baseUrl}/e/{slug}?tab=schedule&view=team&team={id}`
- Caption: "Scan for {teamName}" or "Scan to share"
- Uses `NEXT_PUBLIC_PUBLIC_RESULTS_URL` env var with `window.location.origin` fallback

Created `loading.tsx` (route segment skeleton):
- Animated header skeleton with logo and text placeholders
- Tab bar skeleton (4 items)
- Content skeleton (4 rows at h-14)
- All using `bg-[#1a2d50]/40 animate-pulse`

### Task 2: Wire components into event detail page (commit 1b39c89)

Major rewrite of `apps/public-results/src/app/e/[slug]/page.tsx`:
- `export const revalidate = 30` preserved (D-16)
- Extended `searchParams` to include `view`, `day`, `team`
- Data fetching: `Promise.all` with `getPublicGames`, `getPublicTeams`, `getPublicEventDates`, `getPublicBracket`, `getPublicStandings`
- Standings from `getPublicStandings` → `groupBy(viewStandings, s => s.division)` — no `computeStandings`
- Bracket tab: conditional on `event.has_bracket && bracket.format`
- EventQRCode in header: `hidden lg:block` for desktop, `details/summary` for mobile
- `LiveScoresClient` wraps all tab content with 2-arg render props `(currentLiveGames, flashingIds)`
- `ScheduleTabWithSubViews` receives `eventDates`, `view`, `activeDay`, `teamId`
- `BracketTab` receives `bracket`, `liveGameIds`, `liveScores`, `flashingIds`
- Removed: `ScheduleSection`, `groupBy` (now from `@/lib/utils`), `computeStandings`
- `LiveSectionEnhanced` shows "Next game: {time} on {field}" when no live games
- `GameResultCard` updated with optional `flashingIds` prop, adds `score-flash` class

### Task 3: Wire homepage + build verification (commit 737c751)

Updated `apps/public-results/src/app/page.tsx`:
- Replaced static event grid with `<EventSearchFilter events={events} />` client island
- Removed `EventCard` function (now inside EventSearchFilter)
- Removed `formatDateRange` (now inside EventSearchFilter)
- `revalidate = 60` preserved

**Deviation: Auto-fixed pre-existing build crash (Rule 1 - Bug)**
- `apps/public-results/src/lib/supabase.ts` created client at module level with `createClient(url!, key!)`
- Without env vars, `createClient` threw before Next.js ISR could run the `try/catch` in page.tsx
- Fix: lazy Proxy singleton — client only created on first method call, not at module import time
- `npm run build` now passes without environment variables (Vercel-ready)
- All 16 vitest tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy Supabase client initialization to fix build crash**
- **Found during:** Task 3 build verification
- **Issue:** `supabase.ts` called `createClient(url!, key!)` at module level. When `NEXT_PUBLIC_SUPABASE_URL` is undefined, this throws synchronously before any `try/catch` in page.tsx can catch it. Result: `npm run build` always failed with "supabaseUrl is required"
- **Fix:** Rewrote `supabase.ts` to use a lazy Proxy singleton — client is created on first access, not import
- **Files modified:** `apps/public-results/src/lib/supabase.ts`
- **Commit:** 737c751

## Known Stubs

None. All data sources are wired:
- Standings: `getPublicStandings` → `standings_by_division` PostgreSQL view
- Live scores: LiveScoresClient → Supabase Realtime subscription
- Bracket: `getPublicBracket` → `bracket_rounds` + `bracket_matchups` tables
- Schedule: `getPublicEventDates` + `getPublicGames` → ScheduleTabWithSubViews sub-views
- QR codes: `NEXT_PUBLIC_PUBLIC_RESULTS_URL` env var → `window.location.origin` fallback

## Self-Check

### Created files exist:
- apps/public-results/src/components/EventSearchFilter.tsx: FOUND
- apps/public-results/src/components/EventQRCode.tsx: FOUND
- apps/public-results/src/app/e/[slug]/loading.tsx: FOUND

### Commits exist:
- 985e6ad: Task 1 (EventSearchFilter, EventQRCode, loading skeleton)
- 1b39c89: Task 2 (event page integration)
- 737c751: Task 3 (homepage + build fix)

## Self-Check: PASSED
