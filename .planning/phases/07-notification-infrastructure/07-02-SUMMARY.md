---
phase: 07-notification-infrastructure
plan: "02"
subsystem: notifications
tags: [deno, edge-function, supabase, resend, web-push, notifications, email, push]

requires:
  - phase: 07-notification-infrastructure/07-01
    provides: "notification_queue, notification_preferences, notification_log, push_subscriptions tables; NotificationQueueRow types; lib/notifications.ts constants"
provides:
  - supabase/functions/process-notifications/index.ts (complete Deno Edge Function for notification processing)
affects:
  - phase 10 (notification wiring — triggers that insert into notification_queue)
  - supabase deployment (needs Database Webhook configured on notification_queue INSERT)

tech-stack:
  added: []
  patterns:
    - Deno Edge Function with npm: import prefix for all dependencies
    - Deno.env.get() for environment variables (never process.env)
    - Deno.serve(async (req) => {...}) entry point pattern
    - Atomic claim via UPDATE WHERE IS NULL to prevent double-processing
    - Storm cap enforcement via count query before fan-out
    - Role-based recipient resolution via user_roles table queries (all event-scoped)
    - Delivery fan-out: iterate recipients, check preferences, deliver, log each attempt
    - Exponential backoff retry scheduling stored in next_retry_at column

key-files:
  created:
    - supabase/functions/process-notifications/index.ts
  modified: []

key-decisions:
  - "Email HTML built inline as template literal (not react-email render in Deno) — react-email components cannot be imported from Next.js app into Deno Edge Function"
  - "resolveRecipients returns Set<string> deduplicated user IDs — handles cases where user has multiple roles"
  - "VAPID setup at module level with null guards — if keys missing push is skipped gracefully, not a fatal error"
  - "Resend client instantiated per-invocation from env key — null if key not set, email attempts log as failed"
  - "anyFailed tracks whether ANY delivery attempt failed across ALL recipients — drives retry scheduling"
  - "Return HTTP 200 even on unhandled errors (outer try/catch) — prevents Database Webhook retry storm"

patterns-established:
  - "Pattern: Deno Edge Function entry point uses Deno.serve() not deprecated import { serve }"
  - "Pattern: All DB queries inside Edge Function use .eq('event_id', eventId) per CLAUDE.md event scoping mandate"
  - "Pattern: notification_log insert batched — all logEntries collected during fan-out, single insert at end"

requirements-completed: [NOT-01, NOT-05, NOT-06, NOT-08]

duration: 2min
completed: "2026-03-24"
---

# Phase 7 Plan 02: Process-Notifications Edge Function Summary

**Deno Edge Function implementing the full notification processing pipeline: webhook payload parsing, 5-minute dedup, atomic claim, 50/event/hour storm cap, role-based recipient resolution, Resend email delivery, web-push delivery, notification_log tracking, and exponential backoff retry scheduling (1min/5min/15min) with permanent failure after 3 retries.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T12:47:37Z
- **Completed:** 2026-03-24T12:49:17Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Complete Deno TypeScript Edge Function (567 lines) ready for deployment to Supabase
- Implements all 4 processing stages: dedup check, atomic claim, storm cap, recipient resolution
- Email fan-out via Resend SDK with event-branded inline HTML template (navy #0B3D91 header, dark #020810 background, CTA button)
- Push fan-out via web-push `sendNotification` to all stored push_subscriptions per user
- Every delivery attempt (email + push, success + failure) written to notification_log
- Retry scheduling: exponential backoff 1min → 5min → 15min per D-15, permanent 'failed' status after MAX_RETRIES=3

## Task Commits

Each task was committed atomically:

1. **Task 1: Create process-notifications Edge Function** - `b3f68ad` (feat)

## Files Created/Modified

- `supabase/functions/process-notifications/index.ts` - Complete Deno Edge Function for notification processing; 567 lines

## Decisions Made

- Email HTML constructed as inline template literal rather than using react-email render — the Edge Function runs in Deno and cannot import the AlertEmail component from the Next.js app. Styling values match the email template contract from D-05 (background #020810, header accent #0B3D91, navy CTA button with 8px border-radius).
- `resolveRecipients` uses a `Set<string>` to collect user IDs — handles users with multiple roles in the same event (e.g., an admin who is also a coach) without duplicating log entries or sending double emails.
- VAPID keys checked at module level; if missing, push delivery is silently skipped (no error thrown). This allows the function to work in environments where only email is configured.
- `anyFailed` is a boolean tracking whether ANY delivery across ALL recipients failed. This is intentional: if 1 of 20 recipients failed email delivery, we retry the full batch via the queue mechanism. Partial success is acknowledged in notification_log but the queue row still retries.
- Outer try/catch returns HTTP 200 on all unhandled errors — Database Webhook retry storms would compound failures, so we absorb errors and log to console.error.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all delivery logic is fully implemented. Resend API calls are real (not mocked). web-push `sendNotification` calls are real. notification_log inserts are real. The function is ready for deployment to Supabase Edge Functions.

## User Setup Required

The following environment variables must be configured as Supabase Edge Function secrets before deployment:

- `RESEND_API_KEY` — Resend API key from resend.com dashboard
- `VAPID_PUBLIC_KEY` — VAPID public key (generate once via web-push CLI: `npx web-push generate-vapid-keys`)
- `VAPID_PRIVATE_KEY` — VAPID private key (pair with VAPID_PUBLIC_KEY)
- `RESEND_FROM_EMAIL` — Sender address (e.g., `LeagueOps <alerts@yourdomain.com>`). Defaults to `LeagueOps <onboarding@resend.dev>` for testing.
- `APP_URL` — Production app URL for push notification click-through (e.g., `https://leagueops.vercel.app`)

A Database Webhook must be configured in the Supabase dashboard:
- Table: `notification_queue`
- Events: `INSERT`
- Target: `process-notifications` Edge Function URL

Deploy command: `supabase functions deploy process-notifications`

## Next Phase Readiness

- Edge Function is complete and self-contained — no Next.js dependencies
- Requires Supabase deployment + Database Webhook configuration (manual step)
- Phase 10 (notification wiring) can insert into notification_queue using `lib/notifications.ts` `insertNotification()` helper from Plan 01 — the Edge Function will automatically process these inserts
- The `VAPID_PUBLIC_KEY` will also be needed by the Next.js app for the push subscription component (Plan 03/04 of this phase)

---

## Self-Check

### Files Exist
- `supabase/functions/process-notifications/index.ts` — FOUND (567 lines)

### Commits Exist
- `b3f68ad` — feat(07-02): add process-notifications Supabase Edge Function — FOUND

## Self-Check: PASSED

---
*Phase: 07-notification-infrastructure*
*Completed: 2026-03-24*
