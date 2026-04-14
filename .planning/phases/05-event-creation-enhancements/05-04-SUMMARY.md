---
phase: 05-event-creation-enhancements
plan: '04'
subsystem: ui
tags: [next.js, public-results, routing, placeholder]

# Dependency graph
requires:
  - phase: 05-01
    provides: getPublicEventBySlug function and slug/status fields on Event interface
  - phase: 05-03
    provides: Sharing tab that generates registration URLs and QR codes
provides:
  - /e/[slug]/register route in apps/public-results that returns 200 (not 404) for valid slugs
  - 404 via notFound() for invalid slugs
  - Placeholder page with event name, location, logo, and "Registration Coming Soon" message
affects:
  - phase 06 (Registration Flow Enhancements) — this route will be replaced by full registration wizard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Server component async page following sibling /e/[slug]/page.tsx pattern'
    - 'ISR with revalidate = 30 for public-results pages'
    - 'notFound() for invalid slug 404 handling'

key-files:
  created:
    - apps/public-results/src/app/e/[slug]/register/page.tsx
  modified: []

key-decisions:
  - 'Server component (async) matching the sibling event page pattern — no client-side state needed'
  - "revalidate = 30 matching the sibling page's ISR strategy"
  - 'getPublicEventBySlug used to verify slug validity before rendering — invalid slugs return notFound()'
  - 'Placeholder messaging defers full registration to Phase 6 Registration Flow Enhancements'

patterns-established:
  - 'Placeholder registration route: lookup slug → 404 if missing → render coming-soon UI'

requirements-completed: [EVT-04, EVT-06]

# Metrics
duration: 1min
completed: 2026-03-23
---

# Phase 5 Plan 04: Register Route Placeholder Summary

**Next.js server component placeholder at /e/[slug]/register that resolves slugs via getPublicEventBySlug, showing event details and "Registration Coming Soon" — prevents 404 on QR code scan links from the Sharing tab**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-23T16:42:14Z
- **Completed:** 2026-03-23T16:43:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created /e/[slug]/register route that resolves to a page instead of 404 for valid event slugs
- Invalid slugs correctly return a 404 via notFound()
- Page displays event name, location, optional logo, and "Registration Coming Soon" message
- Links back to the main event details page at /e/[slug]

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /e/[slug]/register placeholder page** - `6e7e83a` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/public-results/src/app/e/[slug]/register/page.tsx` - Registration route placeholder; server component with ISR revalidate=30, notFound() on invalid slug, "Registration Coming Soon" message

## Decisions Made

- Server component (async) matching the sibling event page pattern — no client-side state needed for this placeholder
- revalidate = 30 matching the sibling /e/[slug]/page.tsx ISR strategy
- Uses getPublicEventBySlug to verify slug validity — invalid slugs return notFound() (404)
- "Registration Coming Soon" message is explicit about placeholder status; full wizard is Phase 6

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EVT-04 and EVT-06 requirements are now satisfied: registration URLs from the Sharing tab QR codes resolve to a real page
- Phase 6 (Registration Flow Enhancements) can replace this placeholder with the full registration wizard at the same route

---

_Phase: 05-event-creation-enhancements_
_Completed: 2026-03-23_
