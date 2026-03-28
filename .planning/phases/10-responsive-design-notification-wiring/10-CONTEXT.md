# Phase 10: Responsive Design & Notification Wiring - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the admin app fully usable on phones and tablets at the field (responsive layouts, bottom drawer for RightPanel, touch drag-drop, mobile navigation), and wire the notification triggers for weather alerts (NOT-02), schedule changes (NOT-03), and admin ops alerts (NOT-04) into the Phase 7 notification infrastructure. This is the final polish and integration phase — all major features are functional after Phase 9.

Requirements: MOB-01, MOB-02, MOB-03, MOB-04, NOT-02, NOT-03, NOT-04

</domain>

<decisions>
## Implementation Decisions

### Mobile Navigation (MOB-04)

- **D-01:** TopBar collapses to a hamburger menu on screens below `md` (768px). Hamburger icon opens a slide-out drawer from the left with all nav groups expanded vertically. Matches existing TopBar dropdown pattern with minimal restructuring.
- **D-02:** On desktop (md+), TopBar remains unchanged — horizontal nav groups with dropdowns.
- **D-03:** Active tab highlighted in mobile drawer. Tapping a tab closes the drawer and navigates.

### RightPanel Mobile Behavior (MOB-02)

- **D-04:** RightPanel hidden on screens below `lg` (1024px). On lg+, visible as current fixed sidebar.
- **D-05:** On mobile/tablet, RightPanel converts to a bottom drawer — slides up from the bottom with a drag handle. Does not overlap the top nav.
- **D-06:** Bottom drawer triggered by a floating action button (FAB) or status bar indicator showing current weather/alert status. Tapping opens the drawer.
- **D-07:** Drawer content is the same RightPanel component (weather + incidents) — no separate mobile-only component needed, just wrapped in a drawer container.

### Responsive Layouts (MOB-01)

- **D-08:** Dashboard field cards use `grid-cols-1` on small screens, existing auto-fill grid on larger screens. No horizontal scrolling at 375px.
- **D-09:** Schedule table/board views get horizontal scroll on mobile with sticky first column (team name visible while scrolling game slots).
- **D-10:** Check-In tab renders single-column on mobile — stacked cards instead of side-by-side panels.
- **D-11:** All modal dialogs become full-screen on mobile (`sm:max-w-lg` pattern — full width below sm breakpoint).

### Touch Drag-Drop (MOB-03)

- **D-12:** Configure @dnd-kit with both MouseSensor and TouchSensor via `useSensors()` in RefsTab.
- **D-13:** TouchSensor activation: 200ms delay, 5px tolerance — prevents accidental drags while scrolling.
- **D-14:** Draggable elements already have `touchAction: 'none'` style — verify this persists.

### Weather Alert Notifications (NOT-02)

- **D-15:** Wire `insertNotification()` calls in the weather API route (`app/api/weather-engine/route.ts`) after the engine returns alerts. Not inside the engine itself — keeps engine pure.
- **D-16:** Each weather alert type (lightning delay, heat advisory, wind advisory, field closure) generates one notification_queue entry. Alert type: `weather_alert`, scope: `field` for field-specific or `event` for event-wide alerts.
- **D-17:** Dedup key uses complexId + alert type — prevents duplicate notifications when weather engine re-runs within the 5-minute dedup window (Phase 7 D-13).

### Schedule Change Notifications (NOT-03)

- **D-18:** Schedule change request notifications already partially wired in Phase 8 (`app/api/schedule-change-requests/route.ts` has insertNotification calls). Verify and complete: new request → admin notified, approved/rescheduled → both teams notified, denied → requester notified.
- **D-19:** Ensure game cancellation notifications also fire — cancelled games should notify both teams' coaches/program leaders.

### Admin Ops Alert Notifications (NOT-04)

- **D-20:** Wire admin alert notifications for: referee no-shows (detected in unified engine), registration deadline warnings (cron-based or event-date-driven check), and ops issues surfaced by the unified engine.
- **D-21:** Referee no-show detection: when a game transitions to "Live" or "Starting" and has no assigned referee, insert a `notification_queue` entry with alert_type `admin_alert`.
- **D-22:** Registration deadline warning: when event's `registration_closes_at` is within 48 hours and open registrations exist, notify admin. This can be triggered during the daily unified engine run or via a lightweight check in the dashboard load.

### Claude's Discretion

- Bottom drawer animation and handle styling
- Hamburger menu icon placement and animation
- FAB design for mobile RightPanel trigger
- Exact breakpoint for schedule table sticky column
- Referee no-show detection placement (game status change handler vs unified engine)
- Registration deadline check frequency and trigger mechanism
- Whether to add swipe-to-dismiss on mobile drawer
- Mobile-specific button sizing adjustments
- Touch target size increases (44px minimum)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Layout & Navigation (responsive restructuring targets)

- `components/AppShell.tsx` — Main layout: flex column, RightPanel sidebar, tab routing
- `components/TopBar.tsx` — Nav groups with dropdowns, needs hamburger collapse
- `components/RightPanel.tsx` — Fixed w-72 sidebar with weather + incidents

### Key Views Needing Responsive Work

- `components/dashboard/DashboardTab.tsx` — Field cards grid, auto-fill pattern
- `components/schedule/ScheduleTab.tsx` — Schedule board/table views
- `components/checkin/CheckInTab.tsx` — Check-in interface
- `components/refs/RefsTab.tsx` — Drag-drop referee assignment (@dnd-kit)

### Notification Infrastructure (Phase 7 — wire into these)

- `lib/notifications.ts` — `insertNotification()` helper function signature
- `lib/notification-constants.ts` — Alert types, scopes, role mappings
- `supabase/functions/process-notifications/index.ts` — Edge Function processor with recipient resolution
- `supabase/phase7_notifications.sql` — Queue, preferences, log table schemas

### Notification Trigger Sources

- `app/api/weather-engine/route.ts` — Weather engine API route (wire NOT-02 here)
- `lib/engines/weather.ts` — Weather engine with alert detection (pure engine, don't modify)
- `app/api/schedule-change-requests/route.ts` — Already has partial insertNotification calls (verify NOT-03)
- `lib/engines/unified.ts` — Unified engine for ops alerts (wire NOT-04 referee no-show detection)

### Prior Phase Context

- `.planning/phases/07-notification-infrastructure/07-CONTEXT.md` — All notification infrastructure decisions (D-01 through D-18)
- `.planning/phases/08-schedule-change-request-workflow/08-CONTEXT.md` — Schedule change notification triggers (D-21 through D-23)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`insertNotification()`** (`lib/notifications.ts`): Ready-to-use helper for queueing notifications. Accepts eventId, alertType, scope, scopeId, payload object.
- **`notification-constants.ts`**: ALERT_TYPE_ROLES mapping for recipient resolution. Already defines weather_alert, schedule_change, admin_alert categories.
- **Tailwind responsive prefixes**: Standard breakpoints available (sm: 640, md: 768, lg: 1024). No custom breakpoints needed.
- **`@dnd-kit` TouchSensor**: Available in the installed package — just needs to be imported and configured in RefsTab.
- **Existing modal patterns**: Modal component from `components/ui/index.tsx` can be adapted for mobile drawer.

### Established Patterns

- **Notification insertion**: Phase 8 schedule change route uses `insertNotification(eventId, 'schedule_change', 'team', teamId, {...})` — follow same pattern for weather and admin alerts.
- **Engine → API route → DB**: Engines are pure functions; API routes handle DB writes and side effects like notifications.
- **TopBar dropdown groups**: NAV_GROUPS array defines nav structure — can be reused for mobile drawer menu items.
- **`touchAction: 'none'`**: Already set on draggable elements in RefsTab — good foundation for touch support.

### Integration Points

- **AppShell flex layout**: RightPanel visibility controlled here — add `hidden lg:flex` class and mobile drawer state.
- **TopBar**: Needs conditional render — hamburger on mobile, full nav on desktop.
- **Weather API route POST handler**: Insert notification calls after `runWeatherEngine()` returns alerts.
- **Unified engine API route**: Insert admin alert notification for referee no-shows.
- **Game status update handler**: Wire referee no-show check when game goes Live/Starting.

</code_context>

<specifics>
## Specific Ideas

- RightPanel bottom drawer should show a summary indicator when collapsed (e.g., weather icon + "Clear" or lightning icon + "Delay" on the FAB)
- Mobile nav drawer should preserve the grouped structure from TopBar (Dashboard, Schedule, Game Day, People, Command, Reports, Admin) for familiarity
- Weather notification emails should include the specific alert details (lightning distance, heat index value, wind speed) — not just "weather alert"
- Schedule change notifications for cancelled games should clearly state "CANCELLED" in the notification title, not just "schedule change"
- Admin referee no-show alert should include the game details (field, time, teams) so admin can act immediately from the notification

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 10-responsive-design-notification-wiring_
_Context gathered: 2026-03-25_
