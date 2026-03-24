# Phase 7: Notification Infrastructure - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the database-first notification queue, Supabase Edge Function processor, email delivery via Resend, browser push via Web Push API, user notification preferences, and in-app notification bell with unread tracking. Covers NOT-01, NOT-05, NOT-06, NOT-07, NOT-08. Delivery triggers (weather alerts, schedule changes, admin alerts) are wired in Phase 10 — this phase builds the infrastructure they plug into.

</domain>

<decisions>
## Implementation Decisions

### Notification Preferences UX
- **D-01:** Notification preferences live in a user profile dropdown accessed via a bell icon in the top nav. Not tied to a specific event — global user preferences.
- **D-02:** Preferences are organized by alert type: Weather alerts, Schedule changes, Admin alerts, Registration updates. Each type has a channel toggle (email ON/OFF, push ON/OFF). Maps to `ops_alerts.alert_type` categories.
- **D-03:** Preferences panel is role-aware — show only relevant alert types per role. Admins see all types; coaches see weather + schedule; program leaders see registration + schedule.
- **D-04:** Bell icon in top nav shows red unread count badge. Click opens dropdown with recent notifications list + link to full preferences panel. Standard notification bell pattern.

### Email Template Design
- **D-05:** Emails are event-branded — header with event name + logo (from `events` table), navy background accent (#0B3D91), footer with event details. Each tournament's emails look like they come from that event.
- **D-06:** Each email includes a "View in App" primary CTA button (navy styled) linking to the relevant page (e.g., schedule page for schedule changes, command center for weather alerts).
- **D-07:** Email content is essential info + context: alert type, affected teams/fields, what happened, what to do next. 3-5 lines max. Quick to scan on a phone at the field.
- **D-08:** Email templates built with `@react-email/components` + `react-email ^3.x`. Sent via Resend (3,000/month free tier).

### Browser Push Experience
- **D-09:** Push permission prompt fires after user's first meaningful action (views schedule, opens command center). Context message: "Get alerts about this event?" with event name. Never on first page load.
- **D-10:** Push notification content: title (alert type) + 1-line summary + event icon/logo. Click opens relevant app page. E.g., Title: "Lightning Delay", Body: "Fields 1-3 suspended — estimated 30 min delay".
- **D-11:** Push notifications collapse when 3+ fire within 60 seconds — summary notification: "3 new alerts for [Event Name]". Prevents buzzing phones during weather events.
- **D-12:** Service worker at `public/sw.js` handles push reception. VAPID keys generated once and stored in Supabase secrets.

### Queue Processing Rules
- **D-13:** Deduplication window: 5 minutes. Same alert type + same scope (event/team/field) within 5 minutes = suppressed. Prevents duplicate alerts from rapid engine re-runs.
- **D-14:** Storm cap: 50 notifications per event per hour. After cap, queue entries are logged but not delivered until next hour window.
- **D-15:** Retry policy: 3 retries with exponential backoff (1min, 5min, 15min). After 3 failures, mark as failed in `notification_log`. Admin can see failed deliveries.
- **D-16:** Edge Function `process-notifications` triggered by Database Webhook on `notification_queue` inserts.

### Recipient Resolution
- **D-17:** Recipients resolved by role-based mapping per alert type. Weather alerts -> all admins + coaches of affected teams. Schedule changes -> coaches of affected teams. Registration updates -> program leaders. Admin alerts -> admins only.
- **D-18:** For weather alerts affecting specific fields, resolve to affected teams only — look up games on affected fields, resolve to team coaches/program leaders. Not broadcast to all event coaches.

### Claude's Discretion
- `notification_queue`, `notification_preferences`, `notification_log` table schema design
- Edge Function internal architecture (single function vs. per-channel)
- VAPID key generation approach
- Notification bell dropdown component styling details
- Push notification batching implementation (service worker vs. Edge Function side)
- `react-email` template component structure
- Retry scheduling mechanism within Edge Function

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Alert System (notification queue builds on this)
- `lib/engines/unified.ts` — Unified engine that writes to `ops_alerts` table. Notification queue entries will originate from same alert flows.
- `components/engine/CommandCenter.tsx` — Reads `ops_alerts`, subscribes to real-time changes. Notification bell may follow similar pattern.

### Auth & Roles (recipient resolution depends on this)
- `supabase/schema.sql` — `user_roles` table with role column (AppRole enum) and team_id for coach-team linking
- `supabase/add_coach_role.sql` — Coach role definition
- `lib/supabase/server.ts` — Server-side Supabase client pattern (async `createClient()`)

### Event Context (email branding + field resolution)
- `supabase/schema.sql` — `events` table with `name`, `logo_url`, `primary_color`
- `supabase/event_setup.sql` — Extended event fields
- `types/index.ts` — Event interface with all fields

### Existing UI Patterns
- `components/settings/EventSetupTab.tsx` — Settings tab pattern (for notification preferences panel reference)
- Top nav bar component (for bell icon placement)

### Schedule/Field Data (affected team resolution)
- `supabase/schema.sql` — `games` table linking teams to fields and time slots
- `lib/engines/field.ts` — Field conflict engine pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ops_alerts` table and real-time subscription pattern** — CommandCenter already subscribes to ops_alerts changes. Notification bell can use same Supabase real-time pattern.
- **`qrcode.react`** — Already installed (Phase 5), not directly relevant but shows pattern of adding new packages.
- **`react-hot-toast`** — Existing toast notification pattern for in-app feedback.
- **Dark theme input pattern** — `bg-[#081428] border border-[#1a2d50] text-white` established in Phase 5/6.
- **Engine pattern** — All engines accept `(client, eventId)` signature. Notification queue inserts should follow same convention.

### Established Patterns
- **Server-side Supabase client** — `createClient()` from `@/lib/supabase/server` (async pattern from Phase 3)
- **Rate limiting** — `publicRatelimit` and `authedRatelimit` from Upstash (Phase 3). Edge Function may use similar pattern.
- **Token-based routes** — `app/join/[token]` and `app/coach/[token]` patterns for public-facing pages.

### Integration Points
- **Top nav bar** — Bell icon placement for notification dropdown
- **`ops_alerts` table** — Notification queue entries originate when engines write alerts
- **Supabase Edge Functions** — No existing Edge Functions in the project — this is greenfield
- **`public/sw.js`** — No existing service worker — needs to be created for push notifications
- **Resend** — New integration — add `resend` package

</code_context>

<specifics>
## Specific Ideas

- Notification bell in top nav follows standard SaaS notification pattern (Slack, GitHub style)
- Event-branded emails make tournaments feel professional — logo + colors from events table
- Push notification collapse at 3+ within 60s specifically targets weather storm scenarios where multiple field alerts fire simultaneously
- Role-filtered preferences mean coaches don't see "Admin alerts" toggle they'd never receive anyway
- 50/event/hour storm cap balances cost (Resend free tier = 3,000/month) with tournament-day reality

</specifics>

<deferred>
## Deferred Ideas

- SMS delivery channel (NOT in v1 — deferred to v2 per roadmap Scope Notes)
- Notification history page with full searchable log
- Admin dashboard for notification delivery metrics/failures
- Scheduled/delayed notifications (e.g., "reminder 1 hour before game")

</deferred>

---

*Phase: 07-notification-infrastructure*
*Context gathered: 2026-03-24*
