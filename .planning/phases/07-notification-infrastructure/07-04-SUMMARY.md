---
phase: 07-notification-infrastructure
plan: "04"
subsystem: notifications
tags: [notification-ui, bell-icon, realtime, supabase-realtime, push-modal, accessibility]
dependency_graph:
  requires:
    - 07-01 (notification_log table, NotificationLogEntry type, NotificationPreference type)
    - 07-03 (subscribeToPush, getPushPermission from lib/push.ts)
  provides:
    - components/notifications/NotificationBell.tsx (bell icon with realtime unread badge)
    - components/notifications/NotificationDropdown.tsx (recent notifications list)
    - components/notifications/NotificationSettingsPanel.tsx (per-type per-channel toggles)
    - components/notifications/NotificationToggleRow.tsx (accessible toggle switch row)
    - components/notifications/PushPermissionModal.tsx (push permission prompt modal)
  affects:
    - components/TopBar.tsx (NotificationBell wired in right section)
    - lib/db.ts (4 notification DB helpers added)
tech_stack:
  added:
    - date-fns formatDistanceToNow (already installed — relative timestamp display)
  patterns:
    - Supabase Realtime postgres_changes INSERT subscription for unread count increment
    - Map<AlertType, {email_on, push_on}> for local preference state management
    - hooks-before-guards pattern throughout (all hooks before early return)
key_files:
  created:
    - components/notifications/NotificationBell.tsx
    - components/notifications/NotificationDropdown.tsx
    - components/notifications/NotificationSettingsPanel.tsx
    - components/notifications/NotificationToggleRow.tsx
    - components/notifications/PushPermissionModal.tsx
  modified:
    - components/TopBar.tsx (import + <NotificationBell /> insertion)
    - lib/db.ts (NotificationLogEntry import + 4 notification helper functions)
decisions:
  - "NotificationSettingsPanel imports ALERT_TYPES/ALERT_TYPE_ROLES from lib/notifications.ts which is 'use server' — Next.js 14 allows importing non-async server module constants into client components as tree-shaken data; build passes with no errors"
  - "userRoleNames cast to string[] for ALERT_TYPE_ROLES includes() comparison — ALERT_TYPE_ROLES values are string[], not AppRole[] — cast avoids TS2345 type error"
  - "NotificationDropdown uses inline <style> keyframe for fadeSlideDown animation — avoids global CSS dependency while meeting the 150ms ease-out animation contract"
  - "PushPermissionModal early-returns null if permission already granted/denied — double-check per D-09 Pitfall 4 even though parent should also check"
metrics:
  duration: 5 min
  completed: "2026-03-24T12:57:00Z"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 7 Plan 04: Notification UI Summary

**One-liner:** Notification bell with Supabase Realtime unread badge, dropdown with recent notifications and mark-all-read, role-filtered settings panel with accessible toggle switches persisting to notification_preferences, and push permission modal with event-name context.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | NotificationBell, NotificationDropdown, and TopBar wiring | ee42527 | components/notifications/NotificationBell.tsx, components/notifications/NotificationDropdown.tsx, components/TopBar.tsx, lib/db.ts |
| 2 | NotificationSettingsPanel, NotificationToggleRow, and PushPermissionModal | 5ec193f | components/notifications/NotificationSettingsPanel.tsx, components/notifications/NotificationToggleRow.tsx, components/notifications/PushPermissionModal.tsx |

## What Was Built

### Notification DB Helpers (`lib/db.ts`)

Four functions appended at end of file (Phase 7 section):
- `getUnreadNotificationCount(userId)` — count query with `head: true` for efficiency, filters `status='delivered'` and `read_at IS NULL`
- `getRecentNotifications(userId)` — last 20 delivered notifications ordered by `delivered_at DESC`
- `markAllNotificationsRead(userId)` — bulk update `read_at` for all unread
- `markNotificationRead(notificationId)` — single notification read mark

`NotificationLogEntry` type import added to lib/db.ts imports.

### NotificationBell (`components/notifications/NotificationBell.tsx`)

`'use client'` component with full accessibility and realtime support:
- **Hooks first** — `useState`, `useEffect` (×3), `useRef` (×2), `useCallback` before `if (!user) return null` guard
- **Initial load** — fetches unread count via `db.getUnreadNotificationCount(user.id)` on mount
- **Realtime subscription** — `postgres_changes INSERT` on `notification_log` filtered by `user_id=eq.${user.id}` increments count without re-fetch
- **Outside-click** — `mousedown` handler closes dropdown, returns focus to bell button
- **Keyboard** — Escape closes dropdown, returns focus to bell
- **Accessibility** — `aria-label` with unread count, `aria-haspopup="true"`, `aria-expanded={isOpen}`
- **Badge** — `bg-navy` pill with `font-mono text-[10px] font-black text-white`, max display "9+"
- **Colors** — `text-muted` at rest, `text-white` when open (per UI-SPEC)
- **Touch target** — `p-3` wrapper = 48px minimum

### NotificationDropdown (`components/notifications/NotificationDropdown.tsx`)

`'use client'` dropdown with notification list:
- **Dimensions** — `w-80 max-h-[400px] overflow-y-auto` per UI-SPEC
- **Colors** — `bg-[#061428] border border-[#1a2d50] rounded-b-xl shadow-2xl z-50`
- **Animation** — `fadeSlideDown` keyframe (opacity 0→1, translateY -4px→0) over 150ms ease-out
- **Header** — "NOTIFICATIONS" label + "Mark all read" ghost link
- **Items** — unread items `bg-surface-card`, read items `bg-transparent`, relative timestamps via `date-fns/formatDistanceToNow`
- **Empty state** — "No notifications yet" with helper text at 80px height
- **Footer** — "Notification Settings" link
- **ARIA** — `role="menu"` on container, `role="menuitem"` on items and buttons

### TopBar integration (`components/TopBar.tsx`)

`<NotificationBell />` inserted between LIVE indicator and `{userRole && ...}` block in the right section. Import added as named import from `@/components/notifications/NotificationBell`.

### NotificationToggleRow (`components/notifications/NotificationToggleRow.tsx`)

Accessible toggle switch row for a single alert type:
- **Layout** — flex row: left = label (`font-cond text-[13px] font-black text-white`) + description (`text-[12px] text-muted`), right = Email toggle + Push toggle stacked with labels
- **Toggle switch** — `w-10 h-5 rounded-full` background (`bg-navy` on, `bg-[#1a2d50]` off), `w-4 h-4 rounded-full bg-white` thumb, `translate-x-[22px]` / `translate-x-0.5`
- **Animation** — `transition-transform duration-150 motion-reduce:transition-none`
- **Accessibility** — `role="switch"`, `aria-checked={enabled}`, `aria-label="{label} {channel} notifications"`

### NotificationSettingsPanel (`components/notifications/NotificationSettingsPanel.tsx`)

Role-filtered preferences panel:
- **Hooks first** — `useState` (prefs, saving), `useEffect` (load prefs) before `if (!user) return null`
- **Role filtering** — `ALERT_TYPE_ROLES` map from `lib/notifications.ts` filters `ALERT_TYPES` to only types where user's roles match
- **Load** — fetches `notification_preferences` for current user on mount, builds `Map<AlertType, {email_on, push_on}>`
- **Save** — upserts all visible alert types with `onConflict: 'user_id,alert_type'`; `toast.success('Preferences saved')` on success; `toast.error('Could not save preferences. Try again.')` on failure
- **Layout** — `SectionHeader` + `Card` per alert type + `Btn primary` "Save Preferences" at bottom-right

### PushPermissionModal (`components/notifications/PushPermissionModal.tsx`)

Push permission prompt per D-09:
- **Controlled** — `isOpen` prop from parent (parent decides when to show, not this component)
- **Double-check** — early returns null if `getPushPermission()` is already 'granted' or 'denied'
- **Event name** — uses `state.event?.name || 'your event'` from `useApp()`
- **Enable handler** — calls `subscribeToPush()`, shows success/denied/generic error toasts
- **ARIA** — `aria-describedby` on body paragraph per UI-SPEC accessibility requirements
- **Copywriting** — "Get Event Alerts" title, "Enable Notifications" / "Not Now" buttons per UI-SPEC

## Verification

All acceptance criteria passed:
- NotificationBell exports named `NotificationBell` with `'use client'`
- All hooks before early return guard (CLAUDE.md compliance)
- `aria-label`, `aria-haspopup`, `aria-expanded` on bell button
- `p-3` touch target, `text-muted`/`text-white` state colors, `bg-navy` badge
- `postgres_changes` realtime subscription
- NotificationDropdown `w-80 max-h-[400px]`, `bg-[#061428]`, `role="menu"`, `role="menuitem"`
- "Mark all read", "No notifications yet", "Notification Settings" texts
- TopBar imports and uses `<NotificationBell />`
- lib/db.ts has all 4 notification helper functions + `NotificationLogEntry` import
- NotificationToggleRow `role="switch"`, `aria-checked`, `bg-navy`/`bg-[#1a2d50]`, `w-10 h-5`/`w-4 h-4`, `transition-transform duration-150`
- NotificationSettingsPanel `ALERT_TYPE_ROLES`, `notification_preferences`, "Save Preferences", toast messages
- PushPermissionModal "Get Event Alerts", "Enable Notifications", "Not Now", `subscribeToPush`, "Notifications blocked"
- TypeScript type check passes with no new errors (pre-existing Deno Edge Function errors excluded)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript TS2345 type error in NotificationSettingsPanel**
- **Found during:** TypeScript check after Task 2 implementation
- **Issue:** `ALERT_TYPE_ROLES[at.value]` is `string[]` but `userRoleNames` is `AppRole[]` — `Array<AppRole>.includes(string)` causes TS2345
- **Fix:** Cast `userRoleNames` elements to `string` via `.map((r) => r.role as string)`
- **Files modified:** components/notifications/NotificationSettingsPanel.tsx
- **Commit:** 5ec193f (included in same commit)

## Known Stubs

None — all components are fully implemented with real data sources:
- `NotificationBell` reads from `notification_log` via realtime subscription
- `NotificationDropdown` fetches real notifications from DB
- `NotificationSettingsPanel` loads and saves real preferences to `notification_preferences`
- `PushPermissionModal` calls real `subscribeToPush()` from lib/push.ts

## Self-Check: PASSED

Verified files exist:
- `components/notifications/NotificationBell.tsx` — created
- `components/notifications/NotificationDropdown.tsx` — created
- `components/notifications/NotificationSettingsPanel.tsx` — created
- `components/notifications/NotificationToggleRow.tsx` — created
- `components/notifications/PushPermissionModal.tsx` — created
- `components/TopBar.tsx` — modified (NotificationBell wired)
- `lib/db.ts` — modified (notification helpers added)

Verified commits exist:
- ee42527 — feat(07-04): NotificationBell, NotificationDropdown, TopBar wiring, and db notification helpers
- 5ec193f — feat(07-04): NotificationSettingsPanel, NotificationToggleRow, and PushPermissionModal
