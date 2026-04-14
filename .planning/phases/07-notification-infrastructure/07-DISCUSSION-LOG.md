# Phase 7: Notification Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 07-notification-infrastructure
**Areas discussed:** Notification preferences UX, Email template design, Browser push experience, Queue processing rules, Recipient resolution

---

## Notification Preferences UX

| Option                              | Description                                                                           | Selected |
| ----------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| User profile dropdown               | Bell icon in top nav opens panel/dropdown with preferences. Accessible from any page. | ✓        |
| Event settings tab                  | New 'Notifications' tab inside EventSetupTab. Per-event preferences.                  |          |
| Both — global + per-event overrides | Global defaults in profile, per-event overrides in event settings.                    |          |

**User's choice:** User profile dropdown
**Notes:** Not tied to a specific event — global user preferences.

| Option                  | Description                                                                                   | Selected |
| ----------------------- | --------------------------------------------------------------------------------------------- | -------- |
| By alert type           | Toggle per alert type: Weather, Schedule, Admin, Registration. Maps to ops_alerts.alert_type. | ✓        |
| By channel only         | Simple: toggle Email ON/OFF, Push ON/OFF. All types go to enabled channels.                   |          |
| Matrix — type x channel | Full control: for each alert type, choose which channels.                                     |          |

**User's choice:** By alert type

| Option                       | Description                                            | Selected |
| ---------------------------- | ------------------------------------------------------ | -------- |
| Yes — role-filtered          | Show only relevant alert types per role. Less clutter. | ✓        |
| No — same panel for everyone | All users see all alert types regardless of role.      |          |

**User's choice:** Yes — role-filtered

| Option                                  | Description                                                                                      | Selected |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Bell with unread count badge + dropdown | Red badge shows unread count. Click opens dropdown with recent notifications + preferences link. | ✓        |
| Bell opens preferences only             | Bell just opens settings. No notification list/inbox.                                            |          |
| You decide                              | Claude picks based on existing nav layout.                                                       |          |

**User's choice:** Bell with unread count badge + dropdown

---

## Email Template Design

| Option                     | Description                                                            | Selected |
| -------------------------- | ---------------------------------------------------------------------- | -------- |
| Event-branded              | Header with event name + logo, navy accent, footer with event details. | ✓        |
| Platform-branded           | LeagueOps branding on every email. Consistent but less personal.       |          |
| Minimal — plain text style | Clean text-only. No logos. Universal client support.                   |          |

**User's choice:** Event-branded

| Option                     | Description                                               | Selected |
| -------------------------- | --------------------------------------------------------- | -------- |
| Yes — 'View in App' button | Primary CTA linking to relevant page. Navy styled button. | ✓        |
| Link in text only          | Links in body text. No styled buttons.                    |          |
| No links                   | Informational only.                                       |          |

**User's choice:** Yes — 'View in App' button

| Option                   | Description                                                              | Selected |
| ------------------------ | ------------------------------------------------------------------------ | -------- |
| Essential info + context | Alert type, affected teams/fields, what happened, what to do. 3-5 lines. | ✓        |
| Full detail              | Complete info including all affected games, times. Longer.               |          |
| Headline only            | One-line summary. Fastest scan but less useful.                          |          |

**User's choice:** Essential info + context

---

## Browser Push Experience

| Option                        | Description                                                                 | Selected |
| ----------------------------- | --------------------------------------------------------------------------- | -------- |
| After first meaningful action | Prompt after first action (view schedule, open command center). Contextual. | ✓        |
| On login with explanation     | Custom banner after login explaining value. Dismiss-able.                   |          |
| Manual opt-in only            | Never auto-prompt. Users enable from preferences.                           |          |

**User's choice:** After first meaningful action

| Option                              | Description                                                          | Selected |
| ----------------------------------- | -------------------------------------------------------------------- | -------- |
| Title + 1-line summary + event icon | Title: alert type, Body: summary, Icon: event logo. Click opens app. | ✓        |
| Title + full detail                 | More text in push body. All info without opening app.                |          |
| Title only                          | Just alert type as title. Minimal.                                   |          |

**User's choice:** Title + 1-line summary + event icon

| Option                        | Description                                              | Selected |
| ----------------------------- | -------------------------------------------------------- | -------- |
| Yes — collapse into summary   | 3+ within 60 seconds collapse into summary notification. | ✓        |
| No — individual notifications | Each alert separate. More granular but noisier.          |          |
| You decide                    | Claude picks batching strategy.                          |          |

**User's choice:** Yes — collapse into summary

---

## Queue Processing Rules

| Option     | Description                                                             | Selected |
| ---------- | ----------------------------------------------------------------------- | -------- |
| 5 minutes  | Same type + scope within 5 min suppressed. Covers rapid engine re-runs. | ✓        |
| 15 minutes | Wider window. More aggressive suppression.                              |          |
| 1 minute   | Tight window. Only catches race condition duplicates.                   |          |

**User's choice:** 5 minutes

| Option                       | Description                                   | Selected |
| ---------------------------- | --------------------------------------------- | -------- |
| 50 notifications/event/hour  | Reasonable cap for 20-30 team tournaments.    | ✓        |
| 100 notifications/event/hour | Higher cap for large tournaments.             |          |
| 25 notifications/event/hour  | Conservative. May suppress legitimate alerts. |          |

**User's choice:** 50 notifications/event/hour

| Option                             | Description                                       | Selected |
| ---------------------------------- | ------------------------------------------------- | -------- |
| 3 retries with exponential backoff | 1min, 5min, 15min. After 3 failures, mark failed. | ✓        |
| 1 retry after 5 minutes            | Single retry. Simpler.                            |          |
| No retries — fire and forget       | Try once. Log failure. Simplest.                  |          |

**User's choice:** 3 retries with exponential backoff

---

## Recipient Resolution

| Option                                 | Description                                                           | Selected |
| -------------------------------------- | --------------------------------------------------------------------- | -------- |
| Role-based per alert type              | Type->roles mapping. Weather->admins+coaches, Schedule->coaches, etc. | ✓        |
| Explicit recipient list in queue entry | Caller writes user IDs. Edge Function just delivers.                  |          |
| Broadcast to all event users           | Everyone gets everything. Users filter via preferences.               |          |

**User's choice:** Role-based per alert type

| Option               | Description                                                  | Selected |
| -------------------- | ------------------------------------------------------------ | -------- |
| Affected teams only  | Resolve games on affected fields, notify those team coaches. | ✓        |
| All coaches in event | Any weather alert notifies all coaches.                      |          |
| You decide           | Claude picks based on data model.                            |          |

**User's choice:** Affected teams only

---

## Claude's Discretion

- Table schema design for notification_queue, notification_preferences, notification_log
- Edge Function internal architecture
- VAPID key generation approach
- Notification bell dropdown component styling
- Push batching implementation details
- react-email template component structure
- Retry scheduling mechanism

## Deferred Ideas

- SMS delivery channel (deferred to v2)
- Notification history page with searchable log
- Admin dashboard for delivery metrics
- Scheduled/delayed notifications
