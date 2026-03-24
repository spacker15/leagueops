---
phase: 07-notification-infrastructure
plan: "01"
subsystem: notifications
tags: [database, migration, types, email, react-email, resend, web-push]
dependency_graph:
  requires: []
  provides:
    - supabase/phase7_notifications.sql
    - types/index.ts (NotificationQueueRow, NotificationPreference, NotificationLogEntry, PushSubscriptionRow)
    - lib/notifications.ts (ALERT_TYPES, NOTIFICATION_CHANNELS, ALERT_TYPE_ROLES, STORM_CAP, DEDUP_WINDOW_MS, insertNotification)
    - emails/AlertEmail.tsx
    - emails/components/EventHeader.tsx
  affects: []
tech_stack:
  added:
    - resend@6.9.4 (email delivery)
    - "@react-email/components@1.0.10" (email template components)
    - "@react-email/render" (server-side email rendering)
    - web-push@3.6.7 (browser push notifications)
    - react-email (dev — email template dev server)
    - "@types/web-push" (dev — TypeScript types for web-push)
  patterns:
    - GENERATED ALWAYS AS STORED column for dedup_key (Postgres computed column)
    - react-email functional component pattern for email templates
    - use server directive on notification helper for Next.js App Router
key_files:
  created:
    - supabase/phase7_notifications.sql
    - lib/notifications.ts
    - emails/AlertEmail.tsx
    - emails/components/EventHeader.tsx
  modified:
    - types/index.ts (appended Phase 7 notification types)
    - package.json (added 6 new packages)
decisions:
  - "4 notification tables use RLS enabled with no permissive policies on notification_queue (service role only) — user-scoped policies on preferences, log, and push_subscriptions"
  - "dedup_key as STORED computed column eliminates application-level key generation — always consistent, indexed for fast dedup lookups"
  - "insertNotification uses lib/supabase/server.ts createClient() — follows existing server-side pattern, requires await"
  - "emails/ placed at project root (not under app/ or components/) — react-email convention, keeps email templates separate from UI components"
metrics:
  duration: 3 min
  completed: "2026-03-24T12:45:01Z"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 7 Plan 01: Notification Infrastructure Foundation Summary

**One-liner:** Notification queue schema (4 tables with RLS + dedup_key STORED column), TypeScript types, shared lib/notifications.ts constants and insertNotification helper, and react-email AlertEmail template with navy event branding.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Install packages and create database migration | f4fe1c0 | supabase/phase7_notifications.sql, package.json |
| 2 | TypeScript types, notification helper lib, and email template | 70b9e07 | types/index.ts, lib/notifications.ts, emails/AlertEmail.tsx, emails/components/EventHeader.tsx |

## What Was Built

### Database Migration (`supabase/phase7_notifications.sql`)

Four tables with full RLS and indexes:

1. **notification_queue** — Core queue for all outbound notifications. `dedup_key` is a STORED computed column (`alert_type::scope::scope_id::event_id`) — no application logic needed to generate it. Status lifecycle: `pending → processing → delivered/failed/suppressed`. No permissive RLS policies — service role access only.

2. **notification_preferences** — Per-user, per-alert-type toggles for email and push channels. `UNIQUE (user_id, alert_type)` enforces one row per user per type. RLS: users manage their own rows only.

3. **notification_log** — Delivery audit trail with `read_at` for unread badge count. Indexes on `(user_id, delivered_at DESC)` and partial index on `user_id WHERE read_at IS NULL` for efficient unread queries. RLS: SELECT for own rows only.

4. **push_subscriptions** — Browser push endpoint storage. `UNIQUE (user_id, endpoint)` prevents duplicate registrations. RLS: users manage own subscriptions.

### TypeScript Types (`types/index.ts`)

Appended 4 interfaces and 4 type aliases matching the DB schema exactly:
- `AlertType`, `NotificationScope`, `NotificationChannel`, `NotificationStatus` union types
- `NotificationQueueRow`, `NotificationPreference`, `NotificationLogEntry`, `PushSubscriptionRow` interfaces

### Notification Helper (`lib/notifications.ts`)

Server-only module (`'use server'`) providing:
- `ALERT_TYPES` — display metadata for all 4 alert types
- `ALERT_TYPE_ROLES` — role-based visibility map (D-03)
- `STORM_CAP = 50` — max notifications per event per hour (D-14)
- `DEDUP_WINDOW_MS = 5 * 60 * 1000` — 5-minute dedup window (D-13)
- `insertNotification()` — queue insert helper returning `NotificationQueueRow | null`

### Email Templates

- `emails/AlertEmail.tsx` — Full react-email template with event branding, navy CTA (`#0B3D91`), "View in App" default label, dark background (`#020810`)
- `emails/components/EventHeader.tsx` — Reusable header with logo (if present) + event name on navy background

## Verification

All acceptance criteria passed:
- 4 CREATE TABLE statements in migration SQL
- 4 ENABLE ROW LEVEL SECURITY statements
- `dedup_key TEXT GENERATED ALWAYS AS` present
- `notification_sent_at TIMESTAMPTZ` present
- `UNIQUE (user_id, alert_type)` for preferences
- `UNIQUE (user_id, endpoint)` for push_subscriptions
- All 6 npm packages installed (resend, @react-email/components, @react-email/render, web-push, @types/web-push, react-email)
- `npx tsc --noEmit` passes with no new errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports are fully implemented. `insertNotification()` calls Supabase directly and returns a real DB row.

## Self-Check

Verified files exist:
- `supabase/phase7_notifications.sql` — created
- `lib/notifications.ts` — created
- `emails/AlertEmail.tsx` — created
- `emails/components/EventHeader.tsx` — created
- `types/index.ts` — modified (NotificationQueueRow appended)

Verified commits exist:
- f4fe1c0 — feat(07-01): install notification packages and create DB migration
- 70b9e07 — feat(07-01): add notification types, helpers, and email templates
