---
phase: 08-schedule-change-request-workflow
plan: '05'
subsystem: requests-ui
tags: [admin-ui, requests, schedule-change, workflow]
dependency_graph:
  requires: ['08-03', '08-04']
  provides: ['admin-requests-tab', 'request-card-review-workflow']
  affects: ['AppShell', 'TopBar']
tech_stack:
  added: []
  patterns: ['inline-expand card pattern', 'status-grouped list', 'radiogroup slot selection']
key_files:
  created:
    - components/requests/RequestCard.tsx
    - components/requests/ScheduleChangeRequestsTab.tsx
  modified:
    - components/AppShell.tsx
    - components/TopBar.tsx
    - app/page.tsx
decisions:
  - 'TopBar NAV_GROUPS updated to add requests under ADMIN group — badge count passed as prop from AppShell'
  - 'Deep link support via useEffect reading ?tab= query param in page.tsx — supports notification CTAs per D-23'
  - 'completedCollapsed defaults to true when > 5 completed requests per D-13'
metrics:
  duration: '4 min'
  completed: 2026-03-24
  tasks_completed: 2
  files_changed: 5
---

# Phase 08 Plan 05: Admin Requests Tab UI Summary

**One-liner:** Admin Requests tab with status-grouped request list, inline approve/deny workflow, per-game slot suggestion panel, and AppShell/TopBar integration with pending count badge.

## What Was Built

### Task 1: RequestCard component (4b6ed63)

Created `components/requests/RequestCard.tsx` — the core admin review card with:

- **Header row**: team name, request type pill (blue=reschedule, red=cancel), request status badge, submitted-at timestamp
- **Games sub-list**: each game in the request shown with date/time/field/opponent/status
- **Reason row**: reason category pill + optional details text
- **Admin notes row**: displayed only when present
- **Action row** (pending or under_review only):
  - "Mark Under Review" (pending only) → PATCH status
  - "Approve Request" → opens approve expansion
  - "Deny Request" → opens deny expansion
- **Deny expansion**: optional notes textarea + Confirm Deny / Go Back buttons
- **Approve expansion (cancel type)**: inline confirmation "Cancel this game? This cannot be undone." + Yes, Cancel Game / Go Back
- **Approve expansion (reschedule type)**: per-game slot selection panels
  - Slot suggestion panel: `bg-[#0a1a3a]` container, loading/error/empty states
  - Slot rows with `role="radiogroup"` accessibility, home/away team availability pills
  - Selected slot: `bg-[#0B3D91]/20 border border-[#0B3D91]/40` highlight
  - Confirm Reschedule → POST /reschedule endpoint

### Task 2: ScheduleChangeRequestsTab and AppShell integration (f2740bc)

Created `components/requests/ScheduleChangeRequestsTab.tsx`:

- Three status sections: PENDING, UNDER REVIEW, COMPLETED / DENIED
- Completed section collapsed by default if > 5 items
- Empty state: "No schedule change requests yet."
- Guards: `if (!eventId) return null`, `if (!isAdmin) return null`

Updated `components/AppShell.tsx`:

- Added `'requests'` to `TabName` union
- Added `{ id: 'requests', label: 'Requests', adminOnly: true }` to `ALL_TABS`
- `pendingRequestCount` computed from `state.scheduleChangeRequests`
- Passed to `TopBar` as `pendingRequestCount` prop
- Tab content: `{activeTab === 'requests' && <ScheduleChangeRequestsTab />}`

Updated `components/TopBar.tsx`:

- Added `'requests'` to ADMIN group's items (at top)
- New `pendingRequestCount?: number` prop
- Badge rendered inline on "REQUESTS" item in ADMIN dropdown when count > 0

Updated `app/page.tsx`:

- Added `useEffect` to read `?tab=` URL query param for deep links from notifications

## Checkpoint Status

**Task 3 (human-verify):** Awaiting human verification of the complete end-to-end workflow.

## Deviations from Plan

**1. [Rule 2 - Enhancement] Deep link URL param reading added to page.tsx**

- **Found during:** Task 2 review of deep link requirement (D-23)
- **Issue:** Plan required verifying `?tab=requests` deep link support — page.tsx had no URL param reading
- **Fix:** Added `useEffect` to read `window.location.search` for `?tab=` param, stored in `deepLinkTab` state, passed as `initialTab` to AppShell
- **Files modified:** app/page.tsx
- **Commit:** f2740bc

**2. [Rule 2 - Enhancement] TopBar receives pendingRequestCount as prop (not inline in AppShell)**

- **Found during:** Task 2 — TopBar uses static NAV_GROUPS, not the `tabs` prop for rendering
- **Issue:** The plan showed badge code in AppShell tab rendering, but the actual tab nav is in TopBar's static NAV_GROUPS
- **Fix:** Added `pendingRequestCount` prop to TopBar, added 'requests' to ADMIN dropdown items, rendered badge inline in dropdown item label
- **Files modified:** components/TopBar.tsx, components/AppShell.tsx

## Self-Check

**Created files:**

- [x] components/requests/RequestCard.tsx
- [x] components/requests/ScheduleChangeRequestsTab.tsx

**Modified files:**

- [x] components/AppShell.tsx
- [x] components/TopBar.tsx
- [x] app/page.tsx

**Commits:**

- [x] 4b6ed63 — Task 1 RequestCard
- [x] f2740bc — Task 2 ScheduleChangeRequestsTab + AppShell integration

## Self-Check: PASSED
