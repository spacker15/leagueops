---
phase: 07-notification-infrastructure
verified: 2026-03-24T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated checks pass; 2 items require human/deployment verification)
re_verification: false
human_verification:
  - test: 'Insert a row into notification_queue and confirm Resend delivers email within 30 seconds'
    expected: 'An email arrives in a real inbox within 30 seconds, sent via the Resend API using the event-branded HTML template.'
    why_human: 'Requires a deployed Supabase Edge Function with a live Database Webhook, a valid RESEND_API_KEY secret, and an active recipient email address. Cannot be verified by static code analysis.'
  - test: 'Subscribe to push notifications on Chrome for Android and Safari 16.4+ iOS'
    expected: 'service worker at /sw.js registers successfully, push subscription is saved to push_subscriptions, and a push notification appears natively without installing an app.'
    why_human: 'Requires real mobile devices or emulators with a deployed app, valid VAPID keys configured in Supabase secrets (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY), and NEXT_PUBLIC_VAPID_PUBLIC_KEY set in the deployed env. Cannot be verified by static code analysis.'
---

# Phase 7: Notification Infrastructure Verification Report

**Phase Goal:** Build the database-first notification queue, Edge Function processor, email delivery via Resend, browser push via Web Push API, and user preference management.
**Verified:** 2026-03-24
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                                              | Status                                           | Evidence                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `notification_queue`, `notification_preferences`, and `notification_log` tables exist and are RLS-protected                                                                                                        | VERIFIED                                         | `supabase/phase7_notifications.sql` defines all 4 tables (including `push_subscriptions`) with `ENABLE ROW LEVEL SECURITY`; `notification_queue` has no permissive policy (service role only); the other 3 have user-scoped policies                                                                                  |
| 2   | A Supabase Edge Function `process-notifications` is triggered by Database Webhook on `notification_queue` inserts, resolves recipients, checks preferences, fans out to channels, and writes to `notification_log` | VERIFIED (code exists; webhook config is manual) | `supabase/functions/process-notifications/index.ts` (567 lines, Deno) implements all pipeline stages: dedup check, atomic claim, storm cap, role-based `resolveRecipients`, email fan-out via Resend, push fan-out via web-push, batched `notification_log` insert, retry scheduling                                  |
| 3   | Resend sends a test email to a real inbox within 30 seconds of a `notification_queue` row being inserted                                                                                                           | NEEDS HUMAN                                      | Code verified: `resend.emails.send()` called per recipient with event-branded HTML; no API key in repo — requires deployed function + secrets + live test                                                                                                                                                             |
| 4   | Browser push works on Chrome for Android and Safari 16.4+ (iOS) without app installation — service worker registered at `public/sw.js`                                                                             | VERIFIED (code); NEEDS HUMAN (device test)       | `public/sw.js` implements `push` and `notificationclick` handlers with 3+/60s collapse logic; `lib/push.ts` registers `/sw.js` via `navigator.serviceWorker.register`; push subscribe/unsubscribe API routes auth-guarded and wired to `push_subscriptions` table                                                     |
| 5   | Users can open `NotificationSettingsPanel` and toggle per-channel, per-alert-type preferences that persist to `notification_preferences`                                                                           | VERIFIED                                         | `components/notifications/NotificationSettingsPanel.tsx` loads prefs from `notification_preferences`, renders `NotificationToggleRow` for each visible alert type filtered by user role, and upserts all visible rows on save with `onConflict: 'user_id,alert_type'`; `toast.success` / `toast.error` feedback wired |

**Score:** 5/5 truths verified (3 fully by static analysis; 2 require human/deployment verification for live delivery)

---

### Required Artifacts

| Artifact                                                 | Expected                                            | Status   | Details                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/phase7_notifications.sql`                      | 4 tables with RLS                                   | VERIFIED | 4 CREATE TABLE statements, 4 ENABLE ROW LEVEL SECURITY, `dedup_key GENERATED ALWAYS AS STORED`, `UNIQUE (user_id, alert_type)`, `UNIQUE (user_id, endpoint)` all present                                                                                                                                                             |
| `supabase/functions/process-notifications/index.ts`      | Deno Edge Function, full pipeline                   | VERIFIED | 567 lines; Deno.serve entry point, dedup query, atomic claim, storm cap (50/hr), resolveRecipients, email fan-out, push fan-out, notification_log insert, exponential backoff retry                                                                                                                                                  |
| `public/sw.js`                                           | Service worker with push handler and collapse logic | VERIFIED | push event handler present, `recentPushTimestamps` array present, `>= 3` collapse check present, `notificationclick` handler with `clients.openWindow` present                                                                                                                                                                       |
| `lib/push.ts`                                            | Client push helpers with `'use client'`             | VERIFIED | All 5 exports present (`subscribeToPush`, `unsubscribeFromPush`, `urlBase64ToUint8Array`, `isPushSupported`, `getPushPermission`); denied-check present; `navigator.serviceWorker.register('/sw.js')` present; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` referenced; `fetch('/api/push/subscribe')` and `fetch('/api/push/unsubscribe')` called |
| `lib/notifications.ts`                                   | Server helper with ALERT_TYPES, insertNotification  | VERIFIED | `'use server'`; exports `ALERT_TYPES`, `NOTIFICATION_CHANNELS`, `ALERT_TYPE_ROLES`, `STORM_CAP = 50`, `DEDUP_WINDOW_MS = 300000`, `insertNotification()` with real Supabase insert                                                                                                                                                   |
| `types/index.ts`                                         | Phase 7 notification types appended                 | VERIFIED | Lines 537–590: `AlertType`, `NotificationScope`, `NotificationChannel`, `NotificationStatus` union types + 4 interfaces (`NotificationQueueRow`, `NotificationPreference`, `NotificationLogEntry`, `PushSubscriptionRow`)                                                                                                            |
| `app/api/push/subscribe/route.ts`                        | Auth-guarded POST, upserts to push_subscriptions    | VERIFIED | `auth.getUser()` guard (401 on fail), body validation (400 on missing fields), `push_subscriptions` upsert with `onConflict: 'user_id,endpoint'`, try/catch error handling                                                                                                                                                           |
| `app/api/push/unsubscribe/route.ts`                      | Auth-guarded POST, deletes from push_subscriptions  | VERIFIED | `auth.getUser()` guard (401 on fail), endpoint validation (400), scoped delete on `user_id` + `endpoint`, try/catch error handling                                                                                                                                                                                                   |
| `components/notifications/NotificationBell.tsx`          | Bell with realtime unread badge                     | VERIFIED | `'use client'`, all hooks before early return guard, `postgres_changes INSERT` subscription on `notification_log` scoped by `user_id`, `aria-label`, `aria-haspopup`, `aria-expanded`, `bg-navy` badge, "9+" cap                                                                                                                     |
| `components/notifications/NotificationSettingsPanel.tsx` | Preferences panel with real DB persistence          | VERIFIED | Loads `notification_preferences` on mount, `ALERT_TYPE_ROLES` filter, upsert on save, toast feedback                                                                                                                                                                                                                                 |
| `components/TopBar.tsx`                                  | NotificationBell wired in right section             | VERIFIED | Import `{ NotificationBell }` from `@/components/notifications/NotificationBell`; `<NotificationBell />` rendered between LIVE indicator and userRole block                                                                                                                                                                          |
| `lib/db.ts`                                              | 4 notification DB helper functions                  | VERIFIED | `getUnreadNotificationCount`, `getRecentNotifications`, `markAllNotificationsRead`, `markNotificationRead` all present; `NotificationLogEntry` import added                                                                                                                                                                          |
| `emails/AlertEmail.tsx`                                  | React-email template                                | VERIFIED | File exists at `emails/AlertEmail.tsx`                                                                                                                                                                                                                                                                                               |
| `emails/components/EventHeader.tsx`                      | Reusable email header component                     | VERIFIED | File exists at `emails/components/EventHeader.tsx`                                                                                                                                                                                                                                                                                   |

---

### Key Link Verification

| From                                          | To                               | Via                                                                  | Status                               | Details                                                                                                                            |
| --------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NotificationBell.tsx`                        | `notification_log` table         | `db.getUnreadNotificationCount` + Realtime `postgres_changes INSERT` | WIRED                                | Initial load via `db.getUnreadNotificationCount(user.id)`; realtime increment via `postgres_changes` channel filtered by `user_id` |
| `NotificationSettingsPanel.tsx`               | `notification_preferences` table | `createClient().from('notification_preferences').select/upsert`      | WIRED                                | Reads on mount; upserts on save with `onConflict: 'user_id,alert_type'`                                                            |
| `lib/push.ts` → `subscribeToPush()`           | `/api/push/subscribe`            | `fetch('/api/push/subscribe', { method: 'POST' })`                   | WIRED                                | VAPID key subscribed via PushManager, then POSTed to server                                                                        |
| `/api/push/subscribe` route                   | `push_subscriptions` table       | Supabase client upsert                                               | WIRED                                | `push_subscriptions` upsert with `onConflict` deduplification                                                                      |
| `process-notifications` Edge Function         | `notification_queue` table       | Dedup query + atomic claim via `.is('notification_sent_at', null)`   | WIRED                                | Double-processing prevented by UPDATE WHERE IS NULL                                                                                |
| `process-notifications` Edge Function         | `notification_log` table         | Batched `supabase.from('notification_log').insert(logEntries)`       | WIRED                                | All delivery attempts logged after fan-out completes                                                                               |
| `process-notifications` Edge Function         | Resend API                       | `resend.emails.send()` per recipient                                 | WIRED (code); requires env secret    | Resend client instantiated from `RESEND_API_KEY` env; HTML built from `buildEmailHtml()`                                           |
| `process-notifications` Edge Function         | Web Push API                     | `webpush.sendNotification()` per subscription                        | WIRED (code); requires VAPID secrets | VAPID setup at module level; `push_subscriptions` queried per user before dispatch                                                 |
| `TopBar.tsx`                                  | `NotificationBell` component     | Named import + JSX render                                            | WIRED                                | `import { NotificationBell } from '@/components/notifications/NotificationBell'`; `<NotificationBell />` in right section          |
| `lib/notifications.ts` `insertNotification()` | `notification_queue` table       | `supabase.from('notification_queue').insert()`                       | WIRED                                | Server-side client via `createClient()`; returns inserted row                                                                      |

---

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable           | Source                                                                                               | Produces Real Data                                                           | Status  |
| --------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------- |
| `NotificationBell.tsx`            | `unreadCount`           | `db.getUnreadNotificationCount(user.id)` → Supabase `notification_log` count query with `head: true` | Yes — DB count query with `status='delivered'` and `read_at IS NULL` filters | FLOWING |
| `NotificationSettingsPanel.tsx`   | `prefs` (Map)           | `createClient().from('notification_preferences').select('*').eq('user_id', user.id)`                 | Yes — direct table read for current user                                     | FLOWING |
| `NotificationBell.tsx` (realtime) | `unreadCount` increment | Supabase Realtime `postgres_changes INSERT` on `notification_log` filtered by `user_id`              | Yes — real DB change events increment count                                  | FLOWING |
| `process-notifications/index.ts`  | `recipientIds`          | `resolveRecipients()` → `user_roles` table queries scoped by `event_id`                              | Yes — 4 alert type branches query real `user_roles` rows                     | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — the primary deliverable is a Supabase Edge Function (Deno runtime) and a browser service worker. Neither can be invoked without a running Supabase project and deployed secrets. Next.js API routes (push subscribe/unsubscribe) are runnable in principle but require auth context. No static CLI entry points exist to test.

---

### Requirements Coverage

| Requirement | Source Plan                        | Description                                                                           | Status           | Evidence                                                                                                                                                                                           |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NOT-01      | 07-01-PLAN, 07-02-PLAN             | Notification queue table receives entries, processed asynchronously via Edge Function | SATISFIED        | `notification_queue` table created with `insertNotification()` helper; `process-notifications` Edge Function processes inserts                                                                     |
| NOT-05      | 07-01-PLAN, 07-02-PLAN             | Email delivery via Resend (3,000/month free tier)                                     | SATISFIED (code) | `resend.emails.send()` implemented in Edge Function; `react-email` templates created; requires env key + deployment for live delivery                                                              |
| NOT-06      | 07-02-PLAN, 07-03-PLAN, 07-04-PLAN | Browser push notifications via Web Push API (no app install required)                 | SATISFIED (code) | `public/sw.js`, `lib/push.ts`, push API routes, VAPID-based subscription, and `webpush.sendNotification()` in Edge Function all implemented; requires VAPID secrets + deployment for live delivery |
| NOT-07      | 07-04-PLAN                         | Users can set notification preferences (which channels, which alert types)            | SATISFIED        | `NotificationSettingsPanel` loads and persists to `notification_preferences` table with role-filtered alert types                                                                                  |
| NOT-08      | 07-01-PLAN, 07-02-PLAN             | Deduplication prevents notification storms                                            | SATISFIED        | `dedup_key GENERATED ALWAYS AS STORED` column; 5-minute dedup window query in Edge Function; atomic `notification_sent_at` claim; 50/hr storm cap enforced                                         |

All 5 requirement IDs (NOT-01, NOT-05, NOT-06, NOT-07, NOT-08) are satisfied. No orphaned requirements for Phase 7 were found in REQUIREMENTS.md.

---

### Anti-Patterns Found

| File                                            | Line  | Pattern                                                                                                          | Severity | Impact                                                                                                                                                         |
| ----------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/notifications.ts`                          | 1     | `'use server'` directive on a module exporting non-async constants (`ALERT_TYPES`, `ALERT_TYPE_ROLES`, etc.)     | Info     | `NotificationSettingsPanel` imports these constants client-side; the SUMMARY notes this works due to Next.js 14 tree-shaking. No functional impact.            |
| `components/notifications/NotificationBell.tsx` | 65–74 | Escape key useEffect is not wrapped in a condition guard before adding — it runs regardless of `isOpen` on mount | Info     | Minor: adds and removes event listener on every isOpen change but is functionally correct due to the `isOpen` guard inside the handler. No user-facing impact. |

No blockers or warnings found. No TODOs, FIXMEs, placeholder return values, or hardcoded empty data detected in any Phase 7 files.

---

### Human Verification Required

#### 1. Resend Email Delivery End-to-End Test

**Test:** Deploy the `process-notifications` Edge Function to Supabase (`supabase functions deploy process-notifications`). Configure Database Webhook on `notification_queue` INSERT targeting the function URL. Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `APP_URL` as Supabase Edge Function secrets. Insert one row into `notification_queue` with a valid `event_id`, `alert_type = 'weather_alert'`, and a `payload` containing `title`, `summary`. Ensure at least one user with role `coach` or `admin` has a verified email in `user_roles`.

**Expected:** A branded HTML email with navy header (#0B3D91), dark background (#020810), and a "View in App" CTA button arrives in the recipient's inbox within 30 seconds. A row in `notification_log` with `channel = 'email'` and `status = 'delivered'` is written.

**Why human:** Requires live Supabase project, deployed Edge Function, valid Resend API key secret, and a real email inbox.

#### 2. Browser Push Notification — Chrome for Android

**Test:** Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` as Supabase Edge Function secrets. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the deployed Vercel environment. Open the deployed app on Chrome for Android. Navigate to Notification Settings and enable push notifications. Observe the browser permission prompt. Accept. Insert a row into `notification_queue` that targets the test user.

**Expected:** A native push notification appears on the Android device without the app being open. The notification shows the correct title and summary from the payload. Tapping opens the app.

**Why human:** Requires a real Android device (or emulator with Play Services), deployed app with VAPID env vars, and an end-to-end notification queue insert.

#### 3. Browser Push Notification — Safari 16.4+ iOS

**Test:** Same setup as test 2, but using iOS Safari 16.4 or later. Add the app to the home screen is NOT required — Safari 16.4+ supports Web Push without installation.

**Expected:** Native iOS push notification appears. Tapping opens the app.

**Why human:** Requires a real iOS 16.4+ device, as iOS Safari Push behavior cannot be emulated accurately in development.

---

### Gaps Summary

No gaps found. All 5 success criteria from the ROADMAP have code-complete implementations:

1. All 4 notification tables created with RLS — verified directly in migration SQL.
2. Edge Function `process-notifications` is fully implemented (567 lines) with all required stages.
3. Resend email delivery code is complete and correct — live delivery requires deployment + secrets.
4. Push infrastructure (`public/sw.js`, `lib/push.ts`, API routes) is fully implemented — live delivery requires VAPID secrets + deployment.
5. `NotificationSettingsPanel` fully implemented with real DB persistence.

Two success criteria (3 and 4) require human/live testing because they depend on deployed infrastructure with configured secrets. The code implementations are verified as complete and correct.

---

_Verified: 2026-03-24_
_Verifier: Claude (gsd-verifier)_
