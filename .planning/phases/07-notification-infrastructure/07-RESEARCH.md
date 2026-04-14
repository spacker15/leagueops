# Phase 7: Notification Infrastructure - Research

**Researched:** 2026-03-24
**Domain:** Supabase Edge Functions, Resend email, Web Push API, react-email, notification queue architecture
**Confidence:** HIGH (core stack) / MEDIUM (Edge Function + web-push interplay in Deno)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Notification preferences live in a user profile dropdown accessed via a bell icon in the top nav. Not tied to a specific event — global user preferences.
- **D-02:** Preferences organized by alert type: Weather alerts, Schedule changes, Admin alerts, Registration updates. Each type has a channel toggle (email ON/OFF, push ON/OFF). Maps to `ops_alerts.alert_type` categories.
- **D-03:** Preferences panel is role-aware — show only relevant alert types per role. Admins see all 4 types; coaches see weather + schedule; program leaders see registration + schedule.
- **D-04:** Bell icon in top nav shows red unread count badge. Click opens dropdown with recent notifications list + link to full preferences panel.
- **D-05:** Emails are event-branded — header with event name + logo (`events.logo_url`), navy background accent (`#0B3D91`), footer with event details.
- **D-06:** Each email includes a "View in App" primary CTA button linking to the relevant page.
- **D-07:** Email content is 3-5 lines max — essential info + context. Quick to scan on a phone at the field.
- **D-08:** Email templates built with `@react-email/components` + `react-email ^3.x`. Sent via Resend (3,000/month free tier).
- **D-09:** Push permission prompt fires after first meaningful action. Never on first page load.
- **D-10:** Push notification content: title (alert type) + 1-line summary + event icon. Click opens relevant app page.
- **D-11:** Push notifications collapse when 3+ fire within 60 seconds — summary notification.
- **D-12:** Service worker at `public/sw.js`. VAPID keys in Supabase secrets.
- **D-13:** Deduplication window: 5 minutes. Same alert type + same scope = suppressed.
- **D-14:** Storm cap: 50 notifications per event per hour. After cap, entries logged but not delivered.
- **D-15:** Retry policy: 3 retries with exponential backoff (1min, 5min, 15min). After 3 failures, mark failed in `notification_log`.
- **D-16:** Edge Function `process-notifications` triggered by Database Webhook on `notification_queue` inserts.
- **D-17:** Recipients resolved by role-based mapping per alert type.
- **D-18:** Weather alerts affecting specific fields resolve to affected teams only via game lookup.

### Claude's Discretion

- `notification_queue`, `notification_preferences`, `notification_log` table schema design
- Edge Function internal architecture (single function vs. per-channel)
- VAPID key generation approach
- Notification bell dropdown component styling details
- Push notification batching implementation (service worker vs. Edge Function side)
- `react-email` template component structure
- Retry scheduling mechanism within Edge Function

### Deferred Ideas (OUT OF SCOPE)

- SMS delivery channel (deferred to v2 per SMS-01)
- Notification history page with full searchable log
- Admin dashboard for notification delivery metrics/failures
- Scheduled/delayed notifications (e.g., "reminder 1 hour before game")
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                                                | Research Support                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| NOT-01 | Notification queue table receives entries from engines and workflows — processed asynchronously via Supabase Edge Function | Database schema design + Edge Function webhook pattern                 |
| NOT-05 | Email delivery via Resend (3,000/month free tier)                                                                          | Resend SDK v6.9.4 + react-email integration pattern                    |
| NOT-06 | Browser push notifications via Web Push API (no app install required)                                                      | VAPID + service worker pattern from official Next.js PWA guide         |
| NOT-07 | Users can set notification preferences (which channels, which alert types)                                                 | `notification_preferences` table + NotificationSettingsPanel component |
| NOT-08 | Deduplication prevents notification storms                                                                                 | Dedup logic in Edge Function + storm cap implementation                |

</phase_requirements>

---

## Summary

Phase 7 builds the complete notification pipeline for LeagueOps: database tables feed an asynchronous Edge Function processor that delivers to email (Resend) and browser push (Web Push API). The project has no existing Edge Functions, no service worker, and no push notification infrastructure — everything is greenfield.

The technology choices are well-established. Resend + react-email is the dominant Next.js email stack in 2025-2026. Web Push via the `web-push` npm package with VAPID keys is the standard approach for browser push without requiring native app installation. Supabase Edge Functions (Deno TypeScript) are triggered via Database Webhooks, receiving a structured INSERT payload (`{ type, table, schema, record, old_record }`). The `process-notifications` Edge Function uses the Supabase service role client (`SUPABASE_SERVICE_ROLE_KEY`) to bypass RLS for recipient resolution and queue management.

The key architectural challenge is that the Edge Function must implement deduplication, storm cap, recipient resolution, retry scheduling, and fan-out to two channels — all within a single atomic operation triggered on every `notification_queue` INSERT. The recommended approach is a single Edge Function with internal channel dispatch (not separate per-channel functions), using optimistic lock patterns (`UPDATE ... WHERE notification_sent_at IS NULL`) to enforce atomic deduplication.

**Primary recommendation:** Single `process-notifications` Edge Function with internal channel dispatch. Store push subscriptions in a `push_subscriptions` table (one row per user+browser). Fan out email via Resend SDK and push via `web-push` npm package. Use `notification_sent_at IS NULL` guard for deduplication atomicity.

---

## Standard Stack

### Core

| Library                   | Version           | Purpose                                                                | Why Standard                                                                                |
| ------------------------- | ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `resend`                  | 6.9.4 (verified)  | Email delivery SDK                                                     | Official Resend Node.js/Deno SDK; `react` parameter accepts React Email components directly |
| `@react-email/components` | 1.0.10 (verified) | Email template primitives (Html, Body, Section, Button, Text, Img, Hr) | Standard react-email component library                                                      |
| `react-email`             | 5.2.10 (verified) | Local preview server + render utilities                                | Dev tooling; preview emails at localhost:3001 before sending                                |
| `@react-email/render`     | 2.0.4 (verified)  | Convert React Email component to HTML string                           | Required when passing HTML string to Resend (not the `react:` shortcut)                     |
| `web-push`                | 3.6.7 (verified)  | Send Web Push messages to browser subscriptions with VAPID auth        | Standard Node.js web-push library; works in Deno via `npm:web-push` import                  |

### Supporting

| Library           | Version | Purpose                       | When to Use                                   |
| ----------------- | ------- | ----------------------------- | --------------------------------------------- |
| `@types/web-push` | latest  | TypeScript types for web-push | Install as devDependency alongside `web-push` |

### Alternatives Considered

| Instead of                              | Could Use                                     | Tradeoff                                                                                                                                          |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web-push` npm in Edge Function         | `jsr:@negrel/webpush` (Deno-native)           | The Deno-native library is less battle-tested; `web-push` via `npm:` prefix works in Deno and is the ecosystem standard                           |
| Single `process-notifications` function | Separate `send-email` + `send-push` functions | Single function avoids double webhook configuration, keeps dedup logic centralized, and reduces deployment overhead                               |
| `@react-email/render` HTML string       | Resend `react:` parameter                     | The `react:` shortcut is simpler but has caused compatibility issues with Next.js 14 server boundaries; use `@react-email/render` for reliability |

**Installation (project):**

```bash
npm install resend @react-email/components @react-email/render web-push
npm install --save-dev @types/web-push react-email
```

**Version verification:** All versions confirmed via `npm view [package] version` on 2026-03-24.

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/
├── functions/
│   └── process-notifications/
│       └── index.ts          # Edge Function (Deno TypeScript)
├── phase7_notifications.sql  # Migration: notification_queue, notification_preferences, notification_log, push_subscriptions
emails/
├── AlertEmail.tsx            # react-email template (event-branded)
├── components/
│   └── EventHeader.tsx       # Reusable header with logo + event name
components/
└── notifications/
    ├── NotificationBell.tsx          # Bell icon + unread badge (TopBar slot)
    ├── NotificationDropdown.tsx      # Recent notifications dropdown
    ├── NotificationSettingsPanel.tsx # Per-type, per-channel preference toggles
    └── NotificationToggleRow.tsx     # Single row: alert type + email/push toggles
app/
└── api/
    └── push/
        ├── subscribe/route.ts     # POST: save PushSubscription to DB
        └── unsubscribe/route.ts   # POST: remove PushSubscription from DB
public/
└── sw.js                          # Service worker: receives push events
```

### Pattern 1: Supabase Edge Function (Deno) Structure

**What:** Deno TypeScript function invoked via HTTP. Receives webhook payload, dispatches to channels.
**When to use:** For all server-side notification processing triggered by DB events.

```typescript
// Source: Supabase official docs + trigger.dev webhook guide
// supabase/functions/process-notifications/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // Database webhook payload structure for INSERT
  const payload = await req.json()
  const record = payload.record // The inserted notification_queue row

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ... process record, resolve recipients, fan out to channels
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

**Key Deno import rules:**

- Use `npm:` prefix for npm packages: `import { createClient } from 'npm:@supabase/supabase-js@2'`
- Use `npm:web-push` for the web-push library
- Environment variables via `Deno.env.get('KEY')` (NOT `process.env`)
- Built-in `fetch()` available natively — no node-fetch needed

### Pattern 2: Database Webhook Payload (INSERT)

**What:** JSON payload structure sent by Supabase Database Webhook to the Edge Function.

```typescript
// Source: Supabase database webhooks docs + trigger.dev guide
type InsertPayload = {
  type: 'INSERT'
  table: string // 'notification_queue'
  schema: string // 'public'
  record: {
    id: number
    event_id: number
    alert_type: string
    scope: string // 'event' | 'team' | 'field'
    scope_id: number | null
    payload: Record<string, unknown>
    created_at: string
    notification_sent_at: string | null
    // ... other columns
  }
  old_record: null
}
```

### Pattern 3: Atomic Deduplication (Optimistic Lock)

**What:** Prevent double-delivery for duplicate queue entries using a single UPDATE with WHERE guard.
**When to use:** At the start of every Edge Function invocation before any delivery work.

```typescript
// Source: Standard SQL optimistic lock pattern
// Claim the row atomically — only one invocation wins
const { data: claimed, error } = await supabase
  .from('notification_queue')
  .update({ notification_sent_at: new Date().toISOString() })
  .eq('id', record.id)
  .is('notification_sent_at', null) // Only succeeds if not yet claimed
  .select()
  .single()

if (!claimed || error) {
  // Another invocation already claimed this row — stop processing
  return new Response(JSON.stringify({ skipped: true }), { status: 200 })
}
```

### Pattern 4: Resend Email from Edge Function

**What:** Send templated email from Deno using Resend SDK.

```typescript
// Source: Resend official docs (resend.com/docs/send-with-nextjs) + Supabase Edge Function guide
import { Resend } from 'npm:resend'
import { render } from 'npm:@react-email/render'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

// Option A: Pass HTML string (most reliable in Deno context)
const html = await render(AlertEmail({ alertType, eventName, summary, ctaUrl, logoUrl }))

const { data, error } = await resend.emails.send({
  from: 'LeagueOps <alerts@your-verified-domain.com>',
  to: recipientEmail,
  subject: `[${eventName}] ${alertTitle}`,
  html,
})
```

**Critical:** `from` address must use a Resend-verified domain. `onboarding@resend.dev` is test-only.

### Pattern 5: Service Worker Push Event Handler

**What:** Handle incoming push messages and show notifications. Collapse logic for storms.
**File location:** `public/sw.js` (served at root scope)

```javascript
// Source: Next.js official PWA guide (nextjs.org/docs/app/guides/progressive-web-apps, 2026-03-20)
let recentPushTimestamps = []

self.addEventListener('push', function (event) {
  if (!event.data) return

  const data = event.data.json()
  const now = Date.now()

  // Collapse: 3+ pushes within 60 seconds = summary
  recentPushTimestamps = recentPushTimestamps.filter((t) => now - t < 60000)
  recentPushTimestamps.push(now)

  let title, body, url
  if (recentPushTimestamps.length >= 3) {
    title = `New Alerts — ${data.eventName}`
    body = `${recentPushTimestamps.length} new alerts — Tap to view`
    url = data.appUrl
  } else {
    title = data.title
    body = data.body
    url = data.url
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: data.icon || '/icon.png',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

### Pattern 6: Push Subscription Save (Next.js API Route)

**What:** Client sends PushSubscription to server; server saves to `push_subscriptions` table.

```typescript
// Source: Next.js official PWA guide (nextjs.org/docs/app/guides/progressive-web-apps)
// app/api/push/subscribe/route.ts
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription: PushSubscription = await req.json()
  await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: (subscription as any).keys?.p256dh,
      auth: (subscription as any).keys?.auth,
    },
    { onConflict: 'user_id, endpoint' }
  )

  return Response.json({ ok: true })
}
```

### Pattern 7: Client Push Subscription Registration

**What:** Register service worker and subscribe to push notifications after first meaningful action.

```typescript
// Source: Next.js official PWA guide
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

async function subscribeToPush(eventName: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (Notification.permission === 'denied') return // Don't re-prompt denied

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  })
  const existing = await registration.pushManager.getSubscription()
  if (existing) return // Already subscribed

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  })

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  })
}
```

### Pattern 8: VAPID Key Generation (one-time setup)

```bash
# Source: Next.js official PWA guide
npm install -g web-push
web-push generate-vapid-keys
# Output:
# Public Key: <base64url>
# Private Key: <base64url>
```

Store in:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — env var (public, exposed to browser for `applicationServerKey`)
- `VAPID_PRIVATE_KEY` — env var (private, never expose)
- Both keys also stored as Supabase Edge Function secrets for use in `process-notifications`

### Pattern 9: Sending Push from Edge Function

```typescript
// Source: web-push npm docs + Deno npm: import pattern
import webpush from 'npm:web-push'

webpush.setVapidDetails(
  'mailto:alerts@leagueops.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

await webpush.sendNotification(
  {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  },
  JSON.stringify({
    title: alertTitle,
    body: summary,
    icon: logoUrl,
    url: ctaUrl,
    eventName,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  })
)
```

### Pattern 10: react-email Template (Deno-Compatible)

```typescript
// Source: Resend docs + react-email docs
// emails/AlertEmail.tsx
import { Html, Body, Section, Text, Button, Img, Hr } from 'npm:@react-email/components'

interface AlertEmailProps {
  eventName: string
  logoUrl: string | null
  alertType: string
  summary: string
  detail: string
  ctaUrl: string
  ctaLabel?: string
}

export function AlertEmail({ eventName, logoUrl, alertType, summary, detail, ctaUrl, ctaLabel = 'View in App' }: AlertEmailProps) {
  return (
    <Html>
      <Body style={{ backgroundColor: '#020810', fontFamily: 'sans-serif', color: '#ffffff', maxWidth: '600px', margin: '0 auto' }}>
        {/* Event header */}
        <Section style={{ backgroundColor: '#0B3D91', padding: '20px 24px' }}>
          {logoUrl && <Img src={logoUrl} alt={eventName} height={40} />}
          <Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', margin: '8px 0 0' }}>{eventName}</Text>
        </Section>
        {/* Content */}
        <Section style={{ padding: '24px' }}>
          <Text style={{ fontSize: '12px', color: '#5a6e9a', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{alertType}</Text>
          <Text style={{ fontSize: '18px', fontWeight: 'bold', margin: '8px 0' }}>{summary}</Text>
          <Text style={{ fontSize: '16px', color: '#c0c8d8', lineHeight: '1.5' }}>{detail}</Text>
          <Button href={ctaUrl} style={{ backgroundColor: '#0B3D91', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', display: 'inline-block', marginTop: '16px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
            {ctaLabel}
          </Button>
        </Section>
        <Hr style={{ borderColor: '#1a2d50' }} />
        <Section style={{ padding: '12px 24px' }}>
          <Text style={{ fontSize: '12px', color: '#5a6e9a' }}>{eventName} · Powered by LeagueOps</Text>
        </Section>
      </Body>
    </Html>
  )
}
```

### Anti-Patterns to Avoid

- **Using `process.env` in Edge Functions:** Use `Deno.env.get()` — `process.env` is undefined in Deno.
- **Importing `next/headers` in Edge Functions:** Edge Functions are Deno, not Next.js. No `cookies()`, no `headers()` from Next.js — read from the `req` object directly.
- **Hardcoding event IDs:** Every DB query must use `.eq('event_id', eventId)` per CLAUDE.md mandate.
- **Calling `navigator.serviceWorker.register()` on first page load:** Per D-09, trigger only after first meaningful action (schedule view, command center open).
- **Not checking `Notification.permission` before prompting:** Always check `Notification.permission !== 'denied'` before showing the prompt — re-prompting denied users is ignored by browsers anyway but wastes UX.
- **Using `single()` for push subscription lookup:** Use `maybeSingle()` — user may not have subscribed yet.
- **Non-null assertions on webhook `record` fields:** Database Webhooks send typed records; validate fields before use.

---

## Don't Hand-Roll

| Problem                    | Don't Build                          | Use Instead                                         | Why                                                                                                                                                    |
| -------------------------- | ------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Email HTML generation      | Custom template strings              | `@react-email/components` + `@react-email/render`   | Email clients are extremely inconsistent; react-email handles table-based layouts, Outlook compatibility, and inline styles                            |
| Push notification delivery | Direct HTTP to push service endpoint | `web-push` npm package                              | Push service communication uses HTTP Encrypted Content Encoding; rolling this manually requires crypto key exchange, VAPID JWT signing — multiple RFCs |
| VAPID key generation       | Crypto key generation from scratch   | `web-push generate-vapid-keys` CLI                  | VAPID requires EC P-256 key pairs in URL-safe base64; use the CLI tool                                                                                 |
| Deduplication atomicity    | Application-level check-then-update  | SQL `UPDATE ... WHERE notification_sent_at IS NULL` | Application-level read-check-write has race conditions; single-statement UPDATE is atomic at the Postgres level                                        |
| Push subscription storage  | Local storage or in-memory           | `push_subscriptions` DB table                       | Subscriptions must survive server restarts and be retrievable for all user devices/browsers                                                            |

**Key insight:** Email rendering and push message encryption are both areas with substantial hidden complexity — protocol compliance, browser vendor differences, and cryptographic requirements make hand-rolled solutions brittle.

---

## Database Schema Design

### Recommended Tables (Claude's Discretion)

#### `notification_queue`

```sql
CREATE TABLE notification_queue (
  id                   BIGSERIAL PRIMARY KEY,
  event_id             BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  alert_type           TEXT NOT NULL,   -- 'weather_alert' | 'schedule_change' | 'admin_alert' | 'registration_update'
  scope                TEXT NOT NULL,   -- 'event' | 'team' | 'field'
  scope_id             BIGINT,          -- team_id or field_id when scoped
  payload              JSONB NOT NULL,  -- { title, summary, detail, cta_url }
  dedup_key            TEXT GENERATED ALWAYS AS (
                         alert_type || '::' || scope || '::' || COALESCE(scope_id::TEXT, 'null') || '::' || event_id::TEXT
                       ) STORED,
  notification_sent_at TIMESTAMPTZ,     -- NULL = not yet processed; SET atomically to claim
  retry_count          INT NOT NULL DEFAULT 0,
  next_retry_at        TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'suppressed')),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Deduplication index: fast lookup for 5-minute window check
CREATE INDEX idx_notif_queue_dedup ON notification_queue (dedup_key, created_at DESC);
CREATE INDEX idx_notif_queue_event  ON notification_queue (event_id);
CREATE INDEX idx_notif_queue_status ON notification_queue (status);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
```

#### `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,   -- 'weather_alert' | 'schedule_change' | 'admin_alert' | 'registration_update'
  email_on   BOOLEAN NOT NULL DEFAULT TRUE,
  push_on    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, alert_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
-- RLS: user can only read/write their own preferences
CREATE POLICY "Users manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### `notification_log`

```sql
CREATE TABLE notification_log (
  id              BIGSERIAL PRIMARY KEY,
  queue_id        BIGINT NOT NULL REFERENCES notification_queue(id) ON DELETE CASCADE,
  event_id        BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'push')),
  status          TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'suppressed')),
  error_message   TEXT,
  delivered_at    TIMESTAMPTZ DEFAULT NOW(),
  read_at         TIMESTAMPTZ,    -- NULL = unread (for bell badge count)
  title           TEXT,
  summary         TEXT
);

CREATE INDEX idx_notif_log_user   ON notification_log (user_id, delivered_at DESC);
CREATE INDEX idx_notif_log_event  ON notification_log (event_id);
CREATE INDEX idx_notif_log_unread ON notification_log (user_id) WHERE read_at IS NULL;

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
-- RLS: user reads own log; service role writes
CREATE POLICY "Users read own notification log"
  ON notification_log FOR SELECT
  USING (auth.uid() = user_id);
```

#### `push_subscriptions`

```sql
CREATE TABLE push_subscriptions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- RLS: user manages own subscriptions; service role reads all for delivery
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Common Pitfalls

### Pitfall 1: Supabase Database Webhook Fires Multiple Times

**What goes wrong:** If `process-notifications` takes more than a few seconds (multiple recipients, retry logic), Supabase may retry the webhook, resulting in duplicate deliveries.
**Why it happens:** Database Webhooks retry on non-2xx responses or timeouts. Fast 200 responses prevent retries.
**How to avoid:** Return `200 OK` immediately after claiming the row with the atomic UPDATE. Do all delivery work in the same invocation but ensure the dedup claim (atomic UPDATE) is the very first operation. If the claim fails (row already claimed), return 200 immediately without doing any work.
**Warning signs:** Users reporting duplicate emails or push notifications within seconds of each other.

### Pitfall 2: `process.env` Not Available in Edge Functions

**What goes wrong:** `process.env.RESEND_API_KEY` returns `undefined` in Deno, causing silent failures.
**Why it happens:** Deno uses `Deno.env.get()`, not Node.js `process.env`.
**How to avoid:** Use `Deno.env.get('KEY')` consistently in all Edge Function code. The project has both Next.js API routes (use `process.env`) and Edge Functions (use `Deno.env.get`) — keep them separate.
**Warning signs:** All notifications silently fail; Edge Function logs show undefined API key errors.

### Pitfall 3: react-email `react:` Parameter Fails in Some Contexts

**What goes wrong:** Passing `react: AlertEmail({...})` to `resend.emails.send()` works in some environments but fails with RSC boundary errors in others.
**Why it happens:** react-email uses legacy `react-dom/server` APIs that conflict with Next.js 14 RSC context.
**How to avoid:** Use `@react-email/render` to convert the template to HTML string first, then pass `html: htmlString` to Resend. This is the reliable cross-context pattern.
**Warning signs:** Build errors about `renderToStaticMarkup` or react-dom/server during email sends.

### Pitfall 4: Push Permission Re-Prompt on Every Page Load

**What goes wrong:** Calling `subscribeToPush()` on component mount triggers repeated permission requests.
**Why it happens:** Developer forgets to check `Notification.permission` and existing subscription state.
**How to avoid:** Always check `Notification.permission !== 'denied'` AND `registration.pushManager.getSubscription()` before prompting. Per D-09: trigger only after first meaningful action (schedule tab opened, command center opened).
**Warning signs:** Users see permission prompt immediately on login.

### Pitfall 5: Safari iOS Push Requires Installed PWA (Pre-Safari 16.4)

**What goes wrong:** Push notifications don't work on iPhone/iPad unless the user has added the app to their home screen.
**Why it happens:** Safari iOS < 16.4 did not support the Web Push API in browser context. Safari 16.4+ supports it per the success criteria.
**How to avoid:** Per D-06 of the CONTEXT.md, target is "Safari 16.4+ (iOS)" which does support Web Push in the browser without home screen installation. No action needed for the target browsers. Add a graceful fallback for unsupported browsers — check `'PushManager' in window` before attempting subscription.
**Warning signs:** iOS users report push never arrives; test on physical device with iOS 16.4+.

### Pitfall 6: `notification_queue` Rows Inserted Without Triggering Webhook

**What goes wrong:** Direct DB inserts (e.g., from seed scripts, SQL editor) do not trigger the Database Webhook.
**Why it happens:** Database Webhooks trigger on Postgres `NOTIFY` events, which are generated by `pg_net` — direct SQL execution in the SQL editor does trigger webhooks, but seed data inserted with `supabase db seed` may use transactions that behave differently.
**How to avoid:** Test webhook trigger explicitly — insert a test row via the Supabase Dashboard > Table Editor and confirm the Edge Function is called in the Function logs.
**Warning signs:** Queue rows accumulate with `status = 'pending'` but Edge Function is never called.

### Pitfall 7: Storm Cap Bypass via Rapid Inserts

**What goes wrong:** If 51 notifications are inserted simultaneously, all 51 Edge Function invocations try to process before any have had a chance to check the hourly count.
**Why it happens:** Race condition in the storm cap check.
**How to avoid:** Use a Postgres function/trigger for pre-insert storm cap enforcement — check hourly count BEFORE inserting into `notification_queue`. Alternatively, use a `SELECT COUNT(*) FOR UPDATE` advisory lock in the Edge Function. The simpler pre-insert approach is recommended: create a Postgres trigger that sets `status = 'suppressed'` on insert if the hourly cap is exceeded, then the Edge Function sees `status = 'suppressed'` and skips delivery immediately.
**Warning signs:** Users receive 50+ notifications during a weather event.

### Pitfall 8: Supabase Client in Edge Function Violates CLAUDE.md Event Scoping

**What goes wrong:** Queries in Edge Function omit `event_id` scope, pulling data from all events.
**Why it happens:** Service role client bypasses RLS; every query must manually include `.eq('event_id', ...)`.
**How to avoid:** Per CLAUDE.md: "Every DB query must be scoped with `.eq('event_id', eventId)`." The `event_id` is available in the `notification_queue` record payload — always carry it through every query.
**Warning signs:** Recipients from the wrong event receive notifications.

---

## Edge Function Internal Architecture (Claude's Discretion)

**Recommended: Single function with internal dispatch**

The `process-notifications` Edge Function should:

1. **Receive** the `notification_queue` INSERT payload
2. **Check dedup window** (5-minute window for same `dedup_key`)
3. **Claim atomically** (UPDATE `notification_sent_at` WHERE NULL)
4. **Check storm cap** (count hourly deliveries for event_id)
5. **Resolve recipients** per `alert_type` + `scope` using role-based mapping (D-17/D-18)
6. **Load preferences** for each recipient from `notification_preferences`
7. **Fan out by channel:**
   - For each recipient where `email_on = true`: call Resend
   - For each recipient where `push_on = true`: fetch `push_subscriptions`, call `web-push`
8. **Write `notification_log`** with delivery status for each recipient+channel
9. **Handle retries** via `retry_count` + `next_retry_at` fields (3 retries: 1min, 5min, 15min)

**Retry mechanism:** The Edge Function cannot schedule its own future invocations. Use a separate Supabase scheduled function (cron via `pg_cron` or a daily Vercel cron route) that periodically queries `notification_queue WHERE status = 'pending' AND next_retry_at <= NOW() AND retry_count < 3` and reprocesses them.

**Alternative for retries (simpler):** Accept that failed notifications on first attempt are logged as failed and visible to admins (per CONTEXT.md deferred: admin dashboard for metrics). Given the tournament-day use case, a failed push notification is less critical than email — and Resend is highly reliable. Skip retry complexity in v1; rely on Resend's own internal retry.

---

## Code Examples

### Setting Up Edge Function Secrets

```bash
# Source: Supabase Edge Functions docs
# Run via Supabase CLI (supabase CLI must be installed separately)
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
```

**Note:** Supabase CLI is not installed in the current environment (confirmed by `command -v supabase` check). Secrets can also be set via: Supabase Dashboard > Project > Edge Functions > Secrets. The MCP tool `apply_migration` in the project can also handle this.

### Dedup Window Check

```typescript
// Source: SQL pattern — check for recent identical notification
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
const { data: recent } = await supabase
  .from('notification_queue')
  .select('id')
  .eq('dedup_key', record.dedup_key)
  .neq('id', record.id)
  .gte('created_at', fiveMinutesAgo)
  .not('notification_sent_at', 'is', null)
  .limit(1)
  .maybeSingle()

if (recent) {
  await supabase.from('notification_queue').update({ status: 'suppressed' }).eq('id', record.id)
  return new Response(JSON.stringify({ suppressed: 'dedup' }), { status: 200 })
}
```

### Recipient Resolution (Coaches for Weather Alert)

```typescript
// Source: Pattern derived from schema.sql + user_roles + games tables
// Per D-18: weather alerts on specific fields → resolve affected team coaches
async function resolveRecipientsForWeatherAlert(
  supabase: SupabaseClient,
  eventId: number,
  fieldId: number | null
): Promise<string[]> {
  // Returns user_id[] (UUID)
  if (!fieldId) {
    // Broadcast: all admins + coaches for this event
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('event_id', eventId)
      .in('role', ['admin', 'coach'])
    return (roles ?? []).map((r) => r.user_id)
  }

  // Targeted: find teams playing on this field, then their coaches
  const { data: games } = await supabase
    .from('games')
    .select('home_team_id, away_team_id')
    .eq('event_id', eventId)
    .eq('field_id', fieldId)
    .in('status', ['Scheduled', 'Live'])

  const teamIds = [...new Set((games ?? []).flatMap((g) => [g.home_team_id, g.away_team_id]))]

  const { data: coaches } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('role', 'coach')
    .in('team_id', teamIds)

  return (coaches ?? []).map((r) => r.user_id)
}
```

### Unread Count for Bell Badge

```typescript
// Source: Supabase Realtime + notification_log table pattern
// Real-time subscription for unread count — mirrors CommandCenter ops_alerts pattern
const channel = supabase
  .channel(`notification-log-${user.id}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notification_log',
      filter: `user_id=eq.${user.id}`,
    },
    (payload) => {
      setUnreadCount((prev) => prev + 1)
    }
  )
  .subscribe()
```

---

## State of the Art

| Old Approach                                                           | Current Approach                                           | When Changed                    | Impact                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"` | `Deno.serve(async (req) => {...})`                         | Supabase 2024                   | Built-in Deno.serve is the current standard; old import pattern is deprecated    |
| FCM/APNs per-platform push                                             | Web Push API with VAPID (cross-platform)                   | Safari 16.4 (March 2023)        | All major browsers now support Web Push without native app; no need for Firebase |
| `resend.emails.send({ react: Template({}) })`                          | `resend.emails.send({ html: await render(Template({})) })` | react-email v2+ with Next.js 14 | `react:` shortcut causes RSC boundary issues; HTML string is more reliable       |

**Deprecated/outdated:**

- `https://deno.land/std@0.168.0/http/server.ts` serve import: use `Deno.serve()` built-in
- `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` in Edge Functions: use `npm:@supabase/supabase-js@2`

---

## Open Questions

1. **Resend domain verification**
   - What we know: Resend requires a verified domain to send from custom addresses; `onboarding@resend.dev` works only for test delivery to the account owner's email.
   - What's unclear: Whether a LeagueOps Resend account has already been created and a domain verified.
   - Recommendation: The plan should include a task to verify the sending domain in Resend. Until then, test delivery works; production delivery to arbitrary recipients requires domain DNS records.

2. **Edge Function deployment method without Supabase CLI**
   - What we know: Supabase CLI is not installed in the current execution environment. Edge Functions can also be created/deployed via: Supabase Dashboard > Edge Functions (manually paste code), or via the MCP Supabase tool (`apply_migration` may not deploy Edge Functions).
   - What's unclear: Whether the MCP tools available to this project support Edge Function deployment.
   - Recommendation: Plan should include explicit task to deploy Edge Function via Supabase Dashboard (copy/paste `index.ts` content). Flag as manual step.

3. **`pg_net` availability for Database Webhooks**
   - What we know: Supabase Database Webhooks use the `pg_net` extension. This is enabled by default on Supabase hosted projects.
   - What's unclear: Whether the project's Supabase instance has `pg_net` enabled (it should by default).
   - Recommendation: Plan Wave 0 should include a verification step: `SELECT * FROM pg_extension WHERE extname = 'pg_net'`.

---

## Environment Availability

| Dependency                       | Required By              | Available     | Version  | Fallback                                                                  |
| -------------------------------- | ------------------------ | ------------- | -------- | ------------------------------------------------------------------------- |
| Node.js                          | npm installs, local dev  | Yes           | v24.14.0 | —                                                                         |
| npm                              | Package installation     | Yes           | 11.9.0   | —                                                                         |
| Supabase CLI                     | Edge Function deployment | No            | —        | Deploy via Supabase Dashboard (manual copy/paste)                         |
| `resend` npm package             | NOT-05 email delivery    | Not installed | —        | Install: `npm install resend`                                             |
| `@react-email/components` npm    | NOT-05 email templates   | Not installed | —        | Install: `npm install @react-email/components`                            |
| `@react-email/render` npm        | NOT-05 HTML rendering    | Not installed | —        | Install: `npm install @react-email/render`                                |
| `react-email` npm                | Dev email preview        | Not installed | —        | Install: `npm install --save-dev react-email`                             |
| `web-push` npm                   | NOT-06 push delivery     | Not installed | —        | Install: `npm install web-push && npm install --save-dev @types/web-push` |
| Resend account + verified domain | NOT-05 production email  | Unknown       | —        | Create at resend.com; test delivery works with onboarding@resend.dev      |
| VAPID key pair                   | NOT-06 push VAPID auth   | Not generated | —        | Generate once: `npx web-push generate-vapid-keys`                         |

**Missing dependencies with no fallback:**

- Resend account + verified domain (required for production email delivery to arbitrary recipients)
- VAPID key pair (required to deploy push notifications)

**Missing dependencies with fallback:**

- Supabase CLI: deploy Edge Function manually via Dashboard

---

## Validation Architecture

### Test Framework

| Property           | Value                       |
| ------------------ | --------------------------- |
| Framework          | Vitest 4.1.0                |
| Config file        | `vitest.config.ts` (exists) |
| Quick run command  | `npm run test`              |
| Full suite command | `npm run test:coverage`     |

### Phase Requirements → Test Map

| Req ID | Behavior                                                                | Test Type                                       | Automated Command                                                                       | File Exists? |
| ------ | ----------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------------ |
| NOT-01 | `notification_queue` INSERT triggers Edge Function invocation           | smoke (manual — cannot invoke Deno from Vitest) | Manual: insert row, check Edge Function logs                                            | N/A          |
| NOT-01 | Queue row with `notification_sent_at IS NULL` is claimed atomically     | unit                                            | `npm run test -- __tests__/lib/notifications.test.ts`                                   | No — Wave 0  |
| NOT-05 | Resend `emails.send()` called with correct payload shape                | unit (mock Resend)                              | `npm run test -- __tests__/lib/notifications.test.ts`                                   | No — Wave 0  |
| NOT-06 | `subscribeToPush()` checks `Notification.permission` before prompting   | unit                                            | `npm run test -- __tests__/components/notifications/NotificationBell.test.tsx`          | No — Wave 0  |
| NOT-06 | Service worker `push` event handler shows notification                  | manual (service workers not testable in jsdom)  | Manual: Chrome DevTools > Application > Service Workers > Push                          | N/A          |
| NOT-07 | `NotificationSettingsPanel` renders role-filtered alert types for coach | unit                                            | `npm run test -- __tests__/components/notifications/NotificationSettingsPanel.test.tsx` | No — Wave 0  |
| NOT-07 | Preference save persists to `notification_preferences` table            | unit (mock Supabase)                            | `npm run test -- __tests__/components/notifications/NotificationSettingsPanel.test.tsx` | No — Wave 0  |
| NOT-08 | Dedup check suppresses second notification within 5-minute window       | unit                                            | `npm run test -- __tests__/lib/notifications.test.ts`                                   | No — Wave 0  |
| NOT-08 | Storm cap (50/hour) marks entries as suppressed                         | unit                                            | `npm run test -- __tests__/lib/notifications.test.ts`                                   | No — Wave 0  |

### Sampling Rate

- **Per task commit:** `npm run test -- __tests__/lib/notifications.test.ts __tests__/components/notifications/`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/lib/notifications.test.ts` — covers NOT-01 (queue claim atomicity), NOT-05 (Resend call shape), NOT-08 (dedup + storm cap logic)
- [ ] `__tests__/components/notifications/NotificationBell.test.tsx` — covers NOT-06 (permission check before subscribe prompt)
- [ ] `__tests__/components/notifications/NotificationSettingsPanel.test.tsx` — covers NOT-07 (role filtering, preference save)
- [ ] `__tests__/components/notifications/` directory must be created

---

## Project Constraints (from CLAUDE.md)

| Directive                                                                   | Impact on Phase 7                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Stack locked: Next.js 14 App Router + Supabase + Vercel                     | Edge Functions must be Supabase (not Vercel Functions), email via Resend                         |
| Keep third-party services free/cheap                                        | Resend 3,000/month free tier (confirmed by D-08); no paid push service (Web Push API is free)    |
| Dark theme: Barlow Condensed, navy/red palette                              | `NotificationBell`, `NotificationDropdown`, `NotificationSettingsPanel` must use existing tokens |
| Every DB query scoped `.eq('event_id', eventId)`                            | Edge Function queries must carry `event_id` from queue record through all lookups                |
| `prefer-const` — use const unless reassigned                                | All Edge Function variables use `const`                                                          |
| Hooks before guards                                                         | `NotificationBell` must call all hooks before `if (!user) return null`                           |
| `Select` must use `bg-[#040e24]`                                            | Not directly applicable (no `<Select>` in notification components)                               |
| Use `try/catch` not `.catch()`                                              | Edge Function error handling uses try/catch blocks                                               |
| Never hardcode event IDs                                                    | Recipient resolution always uses `event_id` from queue row                                       |
| Vercel enforces ESLint errors as build failures                             | `prefer-const`, unused variables will break deploys                                              |
| Server Supabase client: async `createClient()` from `@/lib/supabase/server` | API routes (`/api/push/subscribe`) use the async server client pattern                           |
| Components: PascalCase; Lib: camelCase                                      | `NotificationBell.tsx`, `notifications.ts` in lib/                                               |
| Named exports preferred                                                     | Export `function NotificationBell()`, not `export default`                                       |
| Feedback via `toast.success()` / `toast.error()`                            | Preferences save: `toast.success('Preferences saved')`                                           |

---

## Sources

### Primary (HIGH confidence)

- Next.js official PWA guide — `nextjs.org/docs/app/guides/progressive-web-apps` (last updated 2026-03-20) — full Web Push implementation with VAPID, service worker, subscription management
- Resend official docs — `resend.com/docs/send-with-nextjs` — Resend SDK patterns, `emails.send()` API
- Supabase Database Webhooks docs — `supabase.com/docs/guides/database/webhooks` — INSERT payload structure (`type`, `table`, `schema`, `record`, `old_record`)
- npm registry — `npm view [package] version` — verified all package versions on 2026-03-24

### Secondary (MEDIUM confidence)

- trigger.dev Supabase Database Webhooks guide — `trigger.dev/docs/guides/frameworks/supabase-edge-functions-database-webhooks` — Edge Function handler pattern receiving webhook payload (`payload.record`)
- Supabase GitHub examples — `github.com/supabase/supabase/blob/master/.../select-from-table-with-auth-rls/index.ts` — confirmed `npm:@supabase/supabase-js@2` import pattern for Deno
- Supabase community discussion on service role key — answeroverflow.com — confirmed `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` pattern

### Tertiary (LOW confidence — flag for validation)

- `jsr:@negrel/webpush` as Deno-native alternative to `npm:web-push` — single source, less community validation; recommend `npm:web-push` instead

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified via npm registry; Web Push API verified via official Next.js docs
- Database schema: MEDIUM — schema design is Claude's discretion per CONTEXT.md; patterns follow project conventions but are new tables
- Edge Function architecture: MEDIUM — Deno patterns verified via official Supabase examples; `npm:web-push` in Deno not directly confirmed in official Supabase docs (confirmed via community sources)
- Pitfalls: HIGH — derived from verified docs + known project patterns (CLAUDE.md)

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable packages; web-push VAPID spec is stable; Resend API stable)
