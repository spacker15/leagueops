---
phase: 05-event-creation-enhancements
plan: 03
subsystem: ui
tags: [sharing, qr-code, registration, event-setup, qrcode.react]

# Dependency graph
requires:
  - phase: 05-02
    provides: "VenueAutocompleteInput wired into EventSetupTab and EventPicker; event slug and status fields available"
provides:
  - EVT-04 (registration link display with copy-to-clipboard)
  - EVT-05 (QR code rendering, preview modal, SVG/PNG download)
  - NEXT_PUBLIC_PUBLIC_RESULTS_URL env var pattern for cross-app domain routing
affects: [components/settings/EventSetupTab.tsx, .env.example, /e/[slug]/register route, RLS policies]

# Tech tracking
tech-stack:
  added: [qrcode.react (QRCodeSVG, QRCodeCanvas)]
  patterns:
    - hidden-canvas-always-mounted for PNG export via QRCodeCanvas ref
    - SVG download via XMLSerializer with XML declaration prepend
    - Cross-app URL routing via NEXT_PUBLIC_PUBLIC_RESULTS_URL env var instead of window.location.origin
    - Draft gate pattern: content blocked until event.status === 'active'
    - encodeURIComponent for mailto/sms share body construction

key-files:
  created: []
  modified:
    - components/settings/EventSetupTab.tsx
    - .env.example
    - app/e/[slug]/register/page.tsx
    - supabase/migrations/rls_migration.sql

key-decisions:
  - "Registration URL uses process.env.NEXT_PUBLIC_PUBLIC_RESULTS_URL instead of window.location.origin — /e/[slug]/register lives in apps/public-results, a separate Vercel deployment"
  - "window.location.origin fallback added for local dev when NEXT_PUBLIC_PUBLIC_RESULTS_URL is unset"
  - "/e/[slug]/register route added to main app (apps/leagueops) in addition to apps/public-results — required for correct routing in dev and integrated deployments"
  - "maybeSingle() used instead of single() for slug lookup — prevents crash when duplicate slugs exist during dev"
  - "Unique slug enforcement added to createEvent() — generates new slug on collision (up to 5 attempts)"
  - "RLS policies updated: owner_id fallback for events SELECT/UPDATE, event_admins INSERT order swapped (user_roles before event_admins)"

patterns-established:
  - "Draft gate: show locked placeholder when event.status !== 'active'"
  - "QR hidden canvas pattern: always mount QRCodeCanvas in a hidden div for reliable PNG export"
  - "Cross-app URL: use NEXT_PUBLIC_* env var for separate deployment domains, never window.location.origin"

requirements-completed: [EVT-04, EVT-05]

# Metrics
duration: ~45min
completed: 2026-03-23
---

# Phase 05 Plan 03: Sharing Tab with Registration Link and QR Code Summary

**Sharing tab added to EventSetupTab with registration URL display, QR code thumbnail + preview modal, SVG/PNG download, copy-to-clipboard, and email/SMS share buttons — plus 6 bug fixes discovered during UAT (RLS policies, slug uniqueness, route registration, URL fallback)**

## Performance

- **Duration:** ~45 min (including UAT and bug fixes)
- **Started:** 2026-03-23
- **Completed:** 2026-03-23
- **Tasks:** 2 (1 auto, 1 human-verify)
- **Files modified:** 4+

## Accomplishments

- Sharing tab visible in EventSetupTab navigation with draft-state gate blocking content until event is active
- Registration URL correctly points to `NEXT_PUBLIC_PUBLIC_RESULTS_URL/e/[slug]/register` (not admin app domain)
- QR code renders as 80px black-on-white SVG thumbnail with 256px preview modal, SVG and PNG download
- Copy link button with 2-second "COPIED" state and toast confirmation
- Email/Text share buttons pre-fill native apps with event name, date range, and registration URL
- 6 critical bug fixes applied during UAT to make the full flow functional end-to-end

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Sharing tab with registration link, QR code, and share buttons** - `57c405b` (feat)
2. **Task 2: Human verification** - approved by user (no code commit)

**Bug fixes during UAT:**

- `3449138` - fix(rls): add owner_id fallback to events SELECT/UPDATE policies
- `047c6b1` - fix(rls): allow authenticated users to insert new events
- `d1aed26` - fix(sharing): fallback to window.location.origin when PUBLIC_RESULTS_URL unset
- `d6f92d6` - feat(register): add /e/[slug]/register route to main app
- `97558b3` - fix(events): swap user_roles and event_admins insert order in createEvent
- `4f022e4` - fix(register): use maybeSingle() instead of single() for slug lookup
- `bd1656b` - fix(events): ensure unique slugs on event creation

## Files Created/Modified

- `components/settings/EventSetupTab.tsx` - Sharing tab UI: registration link, QR thumbnail, preview modal, SVG/PNG download, email/SMS share, draft gate
- `.env.example` - Added NEXT_PUBLIC_PUBLIC_RESULTS_URL env var documentation
- `app/e/[slug]/register/page.tsx` - /e/[slug]/register route added to main app (was only in apps/public-results)
- `supabase/migrations/rls_migration.sql` - RLS policy fixes for events SELECT/UPDATE/INSERT

## Decisions Made

- Registration URL uses `process.env.NEXT_PUBLIC_PUBLIC_RESULTS_URL` (not `window.location.origin`) because `/e/[slug]/register` lives in the separate `apps/public-results` Vercel deployment. A `window.location.origin` fallback was added for local dev when the env var is unset.
- `maybeSingle()` used instead of `single()` for slug lookup to prevent crash on duplicate slugs during development.
- Unique slug enforcement added to `createEvent()` with up to 5 collision-retry attempts.
- RLS policy fixes required to allow event creation flow to succeed: `owner_id` fallback added to SELECT/UPDATE policies; `event_admins` INSERT moved after `user_roles` INSERT to satisfy FK constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] RLS policy owner_id fallback for events SELECT/UPDATE**

- **Found during:** Task 2 (UAT — event loading failed for event owner)
- **Issue:** Events SELECT/UPDATE policies did not fall back to `owner_id` field — event owner could not load their own event if `user_roles` row was missing
- **Fix:** Added `OR owner_id = auth.uid()` clause to events SELECT and UPDATE RLS policies
- **Files modified:** supabase/migrations/rls_migration.sql
- **Commit:** 3449138

**2. [Rule 1 - Bug] event_admins INSERT order caused FK violation**

- **Found during:** Task 2 (UAT — event creation failed with FK error)
- **Issue:** `createEvent()` inserted into `event_admins` before `user_roles`, violating FK constraint on `event_admins.user_role_id`
- **Fix:** Swapped insert order so `user_roles` is inserted first, then `event_admins`
- **Files modified:** components/events/EventPicker.tsx
- **Commit:** 97558b3

**3. [Rule 2 - Missing Critical] Registration URL fallback for local dev**

- **Found during:** Task 2 (UAT — registration URL was empty string when env var unset)
- **Issue:** When `NEXT_PUBLIC_PUBLIC_RESULTS_URL` is not set, `registrationUrl` was empty, breaking the entire Sharing tab display
- **Fix:** Added `|| (typeof window !== 'undefined' ? window.location.origin : '')` fallback
- **Files modified:** components/settings/EventSetupTab.tsx
- **Commit:** d1aed26

**4. [Rule 3 - Blocking] /e/[slug]/register route missing from main app**

- **Found during:** Task 2 (UAT — visiting /e/[slug]/register returned 404 in main app)
- **Issue:** The route only existed in `apps/public-results`; navigating to registration URL from the sharing tab in the main app returned 404
- **Fix:** Added `app/e/[slug]/register/page.tsx` route to the main leagueops app
- **Files modified:** app/e/[slug]/register/page.tsx (created)
- **Commit:** d6f92d6

**5. [Rule 1 - Bug] single() crash on duplicate slugs**

- **Found during:** Task 2 (UAT — registration page crashed with "multiple rows returned" error)
- **Issue:** `single()` throws when multiple rows match; test data had duplicate slugs
- **Fix:** Replaced `single()` with `maybeSingle()` in slug lookup query
- **Files modified:** app/e/[slug]/register/page.tsx
- **Commit:** 4f022e4

**6. [Rule 2 - Missing Critical] Unique slug enforcement in createEvent()**

- **Found during:** Task 2 (UAT — slugs were not guaranteed unique, causing downstream 500s)
- **Issue:** Slug generation used `nanoid()` with no collision check; duplicate slugs caused data integrity issues
- **Fix:** Added slug uniqueness check with up to 5 retry attempts using different nanoid values
- **Files modified:** components/events/EventPicker.tsx
- **Commit:** bd1656b

---

**Total deviations:** 6 auto-fixed (2 bugs, 2 missing critical, 1 blocking, 1 missing critical)
**Impact on plan:** All fixes necessary for correct end-to-end event creation and registration flow. No scope creep — each fix directly enabled the Sharing tab to function as specified.

## Issues Encountered

- RLS policies from Phase 04 did not cover the `owner_id` path for event owners without explicit `user_roles` entries — discovered through UAT testing the full event creation + sharing flow
- Env var pattern (cross-app URL) requires explicit Vercel env var configuration per deployment; documented in `.env.example`

## User Setup Required

Set `NEXT_PUBLIC_PUBLIC_RESULTS_URL` in the main admin app Vercel deployment to the public-results deployment domain (e.g., `https://leagueops-results.vercel.app`). Without this, the sharing tab registration URL falls back to `window.location.origin` (admin app domain), which is a functional fallback for single-domain deployments but not the intended behavior.

## Next Phase Readiness

- Registration link and QR code complete — Phase 06 (Registration Flow Enhancements) can build on the `/e/[slug]/register` route now present in both apps
- Slug uniqueness enforced — safe for use as URL routing key
- RLS policies corrected — event creation flow reliable for authenticated users

## Known Stubs

None — registration URL uses real slug from database, QR renders real URL, all download paths functional.

## Self-Check

- `57c405b` — feat(05-03): add Sharing tab (Task 1 commit) — exists in git log
- `bd1656b` — fix(events): ensure unique slugs (last UAT fix) — exists in git log
- `components/settings/EventSetupTab.tsx` — modified with Sharing tab
- `.env.example` — modified with NEXT_PUBLIC_PUBLIC_RESULTS_URL

## Self-Check: PASSED

---

_Phase: 05-event-creation-enhancements_
_Completed: 2026-03-23_
