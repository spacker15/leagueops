---
phase: 07-notification-infrastructure
plan: "03"
subsystem: notifications
tags: [push-notifications, service-worker, web-push, api-routes, client-helpers]
dependency_graph:
  requires:
    - 07-01 (push_subscriptions table, PushSubscriptionRow type)
  provides:
    - public/sw.js (service worker for push event reception and notification display)
    - app/api/push/subscribe/route.ts (POST endpoint to save PushSubscription to DB)
    - app/api/push/unsubscribe/route.ts (POST endpoint to remove PushSubscription from DB)
    - lib/push.ts (client-side push subscription lifecycle helpers)
  affects:
    - 07-04 (notification preferences UI can wire subscribeToPush/unsubscribeFromPush)
tech_stack:
  added: []
  patterns:
    - Service worker push event handler with timestamp-based collapse window
    - VAPID key-based push subscription via PushManager API
    - urlBase64ToUint8Array VAPID key conversion (returns ArrayBuffer for TS compat)
key_files:
  created:
    - public/sw.js
    - app/api/push/subscribe/route.ts
    - app/api/push/unsubscribe/route.ts
    - lib/push.ts
  modified: []
decisions:
  - "urlBase64ToUint8Array returns ArrayBuffer (not Uint8Array) to satisfy TypeScript strict PushSubscriptionOptionsInit.applicationServerKey type"
  - "sw.js uses recentPushTimestamps array for in-memory 60s window tracking — service worker scope persists across push events"
  - "subscribeToPush checks Notification.permission === denied before prompting per D-09 to never re-prompt denied users"
metrics:
  duration: 2 min
  completed: "2026-03-24T12:49:20Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 7 Plan 03: Push Notification Infrastructure Summary

**One-liner:** Service worker push handler with 3+/60s collapse logic, auth-guarded subscribe/unsubscribe API routes for push_subscriptions table management, and client-side push helper with VAPID key subscription, permission checking, and browser lifecycle management.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Service worker and push API routes | 5f3c345 | public/sw.js, app/api/push/subscribe/route.ts, app/api/push/unsubscribe/route.ts |
| 2 | Client-side push subscription helper | 621f623 + 9bd6206 | lib/push.ts |

## What Was Built

### Service Worker (`public/sw.js`)

Plain JavaScript service worker (not TypeScript — service workers run in browser context, not Node):

- **Push event handler** — receives push events, parses JSON payload, shows native browser notification
- **Collapse logic (D-11)** — maintains `recentPushTimestamps` array in-memory; filters to last 60 seconds; when 3+ arrive within window, collapses to summary: "N new alerts — Tap to view". Uses `tag: 'collapsed-summary'` so browser replaces previous summary instead of stacking
- **Individual notification (D-10)** — shows `data.title` + `data.body` for first 1-2 pushes in window
- **Notification click handler** — closes notification, opens `data.url` in new window via `clients.openWindow()`

### Subscribe API Route (`app/api/push/subscribe/route.ts`)

POST endpoint:
- Auth guards via `supabase.auth.getUser()` — returns 401 if unauthenticated
- Validates `endpoint`, `keys.p256dh`, `keys.auth` in request body — returns 400 if invalid
- Upserts to `push_subscriptions` table with `onConflict: 'user_id,endpoint'` — prevents duplicates per Plan 01 schema
- Uses `try/catch` error handling per CLAUDE.md (not `.catch()` chains)

### Unsubscribe API Route (`app/api/push/unsubscribe/route.ts`)

POST endpoint:
- Auth guards via `supabase.auth.getUser()` — returns 401 if unauthenticated
- Validates `endpoint` in request body — returns 400 if missing
- Deletes matching row from `push_subscriptions` scoped to `user_id` + `endpoint`
- Uses `try/catch` error handling per CLAUDE.md

### Client Push Helper (`lib/push.ts`)

`'use client'` module with full push subscription lifecycle:

- **`urlBase64ToUint8Array(base64String)`** — converts VAPID public key from base64url to `ArrayBuffer` for `pushManager.subscribe()`. Returns `ArrayBuffer` (not `Uint8Array`) to satisfy TypeScript strict `applicationServerKey` type
- **`isPushSupported()`** — checks `serviceWorker in navigator && PushManager in window && Notification in window`
- **`getPushPermission()`** — returns current `NotificationPermission` or `'unsupported'`
- **`subscribeToPush()`** — full lifecycle: check support → check not denied → register `/sw.js` → check existing subscription → request permission → subscribe with VAPID key → POST to `/api/push/subscribe`
- **`unsubscribeFromPush()`** — removes from server via `/api/push/unsubscribe` then calls `subscription.unsubscribe()`

## Verification

All acceptance criteria passed:
- `public/sw.js` contains `self.addEventListener('push'` handler
- `public/sw.js` contains `recentPushTimestamps` array
- `public/sw.js` contains collapse check `recentPushTimestamps.length >= 3`
- `public/sw.js` contains `self.addEventListener('notificationclick'` handler
- `public/sw.js` contains `clients.openWindow`
- `app/api/push/subscribe/route.ts` exports POST, auth-guards with `supabase.auth.getUser()`, uses `push_subscriptions` upsert with `onConflict: 'user_id,endpoint'`
- `app/api/push/unsubscribe/route.ts` exports POST, auth-guards, deletes from `push_subscriptions`
- Both API routes use `try/catch` per CLAUDE.md
- `lib/push.ts` has `'use client'` directive
- `lib/push.ts` exports all 5 functions: `subscribeToPush`, `unsubscribeFromPush`, `urlBase64ToUint8Array`, `isPushSupported`, `getPushPermission`
- `lib/push.ts` checks `Notification.permission === 'denied'` before prompting
- `lib/push.ts` uses `navigator.serviceWorker.register('/sw.js')`
- `lib/push.ts` references `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `lib/push.ts` calls `fetch('/api/push/subscribe')` and `fetch('/api/push/unsubscribe')`
- `npx tsc --noEmit` passes (no new errors outside pre-existing Deno Edge Function file)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed urlBase64ToUint8Array return type**
- **Found during:** Task 2 post-implementation type check
- **Issue:** `Uint8Array<ArrayBufferLike>` not assignable to `applicationServerKey` (`string | BufferSource | null | undefined`) — TypeScript strict error TS2322
- **Fix:** Changed return type from `Uint8Array` to `ArrayBuffer`, added `.buffer as ArrayBuffer` cast
- **Files modified:** lib/push.ts
- **Commit:** 9bd6206

## Known Stubs

None — all exports are fully implemented. `subscribeToPush` and `unsubscribeFromPush` perform real browser Push API operations and server calls.

## Self-Check

Verified files exist:
- `public/sw.js` — created
- `app/api/push/subscribe/route.ts` — created
- `app/api/push/unsubscribe/route.ts` — created
- `lib/push.ts` — created

Verified commits exist:
- 5f3c345 — feat(07-03): service worker push handler and push subscribe/unsubscribe API routes
- 621f623 — feat(07-03): client-side push subscription helper
- 9bd6206 — fix(07-03): fix urlBase64ToUint8Array return type for TypeScript strict compat
