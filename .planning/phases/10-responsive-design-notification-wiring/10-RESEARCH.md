# Phase 10: Responsive Design & Notification Wiring - Research

**Researched:** 2026-03-25
**Domain:** Tailwind CSS responsive layout, @dnd-kit TouchSensor, notification queue wiring
**Confidence:** HIGH

## Summary

Phase 10 is a polish and integration phase — no new infrastructure, only wiring. The notification infrastructure (Phase 7) is fully built: `insertNotification()` is ready, `ALERT_TYPE_ROLES` constants are defined, and the Edge Function processor is in place. The schedule change notification routes are already mostly complete from Phase 8 — `POST /api/schedule-change-requests` notifies admin on new submissions; `PATCH …/[id]` notifies teams on cancel/deny/approve; `POST …/[id]/reschedule` notifies both teams. The only genuine gaps in NOT-03 are verifying coverage completeness and adding direct-cancel notifications for admin-initiated game cancellations outside the request workflow.

The responsive work is Tailwind-only — no new libraries needed. `DashboardTab` uses `grid-cols-[repeat(auto-fill,minmax(260px,1fr))]` which causes horizontal scrolling at 375px. `AppShell` is a `flex flex-col` with `RightPanel` as a fixed `w-72` sibling — it needs `hidden lg:block` + mobile bottom drawer state added to `AppShell`. `TopBar` needs a hamburger branch for `< md`. For drag-drop, `DndContext` in `RefsTab` currently uses no `sensors` prop — TouchSensor needs to be configured via `useSensors()`.

**Primary recommendation:** Implement in waves: (1) responsive layouts + hamburger nav, (2) RightPanel bottom drawer, (3) touch drag-drop, (4) NOT-02 weather notifications, (5) NOT-03 verification/gaps, (6) NOT-04 admin alerts.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mobile Navigation (MOB-04)**

- D-01: TopBar collapses to a hamburger menu on screens below `md` (768px). Hamburger icon opens a slide-out drawer from the left with all nav groups expanded vertically. Matches existing TopBar dropdown pattern with minimal restructuring.
- D-02: On desktop (md+), TopBar remains unchanged — horizontal nav groups with dropdowns.
- D-03: Active tab highlighted in mobile drawer. Tapping a tab closes the drawer and navigates.

**RightPanel Mobile Behavior (MOB-02)**

- D-04: RightPanel hidden on screens below `lg` (1024px). On lg+, visible as current fixed sidebar.
- D-05: On mobile/tablet, RightPanel converts to a bottom drawer — slides up from the bottom with a drag handle.
- D-06: Bottom drawer triggered by a floating action button (FAB) or status bar indicator showing current weather/alert status.
- D-07: Drawer content is the same RightPanel component — no separate mobile-only component needed, just wrapped in a drawer container.

**Responsive Layouts (MOB-01)**

- D-08: Dashboard field cards use `grid-cols-1` on small screens, existing auto-fill grid on larger screens.
- D-09: Schedule table/board views get horizontal scroll on mobile with sticky first column.
- D-10: Check-In tab renders single-column on mobile — stacked cards instead of side-by-side panels.
- D-11: All modal dialogs become full-screen on mobile (`sm:max-w-lg` pattern — full width below sm breakpoint).

**Touch Drag-Drop (MOB-03)**

- D-12: Configure @dnd-kit with both MouseSensor and TouchSensor via `useSensors()` in RefsTab.
- D-13: TouchSensor activation: 200ms delay, 5px tolerance — prevents accidental drags while scrolling.
- D-14: Draggable elements already have `touchAction: 'none'` style — verify this persists.

**Weather Alert Notifications (NOT-02)**

- D-15: Wire `insertNotification()` calls in the weather API route (`app/api/weather-engine/route.ts`) after the engine returns alerts. Not inside the engine itself.
- D-16: Each weather alert type generates one `notification_queue` entry. Alert type: `weather_alert`, scope: `field` for field-specific or `event` for event-wide alerts.
- D-17: Dedup key uses complexId + alert type — prevents duplicate notifications within the 5-minute dedup window.

**Schedule Change Notifications (NOT-03)**

- D-18: Verify and complete: new request → admin notified, approved/rescheduled → both teams notified, denied → requester notified.
- D-19: Ensure game cancellation notifications also fire — cancelled games should notify both teams' coaches/program leaders.

**Admin Ops Alert Notifications (NOT-04)**

- D-20: Wire admin alert notifications for: referee no-shows, registration deadline warnings, and ops issues surfaced by the unified engine.
- D-21: Referee no-show: when a game transitions to "Live" or "Starting" and has no assigned referee, insert `notification_queue` entry with alert_type `admin_alert`.
- D-22: Registration deadline warning: when event's `registration_closes_at` is within 48 hours and open registrations exist, notify admin.

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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                        | Research Support                                                                    |
| ------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| MOB-01 | Admin app main views (Dashboard, Schedule, Check-In) usable on phone screens       | DashboardTab grid fix, ScheduleTab sticky scroll, CheckInTab single-column stacking |
| MOB-02 | RightPanel converts to bottom drawer on mobile                                     | AppShell state + conditional render, CSS transform transition for drawer            |
| MOB-03 | Touch interactions work for drag-drop features                                     | @dnd-kit TouchSensor + MouseSensor via useSensors() in RefsTab                      |
| MOB-04 | Navigation adapts for mobile                                                       | TopBar hamburger branch below md, NAV_GROUPS reuse for drawer items                 |
| NOT-02 | Weather alerts trigger notifications to affected coaches/program leaders           | Weather API route POST handler gap identified — no insertNotification calls yet     |
| NOT-03 | Schedule change notifications sent when games rescheduled or cancelled             | Phase 8 already wired most paths; scope verification documented below               |
| NOT-04 | Admin alert notifications for referee no-shows, registration deadlines, ops issues | insertNotification in game status handler + dashboard/cron check                    |

</phase_requirements>

## Standard Stack

### Core

| Library       | Version   | Purpose                                                          | Why Standard                        |
| ------------- | --------- | ---------------------------------------------------------------- | ----------------------------------- |
| Tailwind CSS  | 3.4.4     | Responsive layout with `sm:`, `md:`, `lg:` prefixes              | Already installed, project-standard |
| @dnd-kit/core | ^6.1.0    | DnD with TouchSensor/MouseSensor                                 | Already installed, RefsTab uses it  |
| lucide-react  | installed | Hamburger icon (Menu), X (close), GripHorizontal (drawer handle) | Already project-standard            |

### No New Libraries Needed

This phase uses only existing project dependencies. TouchSensor is already in `@dnd-kit/core` — it just needs to be imported and configured.

**Installation:** None required.

**Version verification:** @dnd-kit/core ^6.1.0 — confirmed from package.json. TouchSensor and MouseSensor are exports of `@dnd-kit/core` since v4.

## Architecture Patterns

### Recommended Project Structure

No new files/folders needed for responsive work. New files:

```
app/api/games/[id]/status/route.ts   # If referee no-show check placed here (NOT-04 D-21)
```

All other changes are modifications to existing files.

### Pattern 1: Tailwind Responsive Prefix Stack

**What:** Apply mobile-first layout changes using Tailwind breakpoint prefixes on existing class strings.
**When to use:** Every layout change in MOB-01, MOB-02, MOB-04.
**Example — Dashboard grid fix (D-08):**

```tsx
// Before (causes horizontal scroll at 375px):
<div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">

// After:
<div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
```

**Example — AppShell RightPanel hide on mobile (D-04):**

```tsx
// RightPanel in AppShell (line 163):
<RightPanel onNavigate={setActiveTab} />
// Wrap with visibility:
<div className="hidden lg:block">
  <RightPanel onNavigate={setActiveTab} />
</div>
```

**Example — Modal full-screen on mobile (D-11):**

```tsx
// Modal in components/ui/index.tsx:
// Add to dialog container:
className = 'w-full sm:max-w-lg mx-auto'
```

### Pattern 2: @dnd-kit TouchSensor Configuration (MOB-03)

**What:** Add `useSensors` with both MouseSensor and TouchSensor to DndContext in RefsTab.
**When to use:** Any drag-drop with touch support requirement.
**Example:**

```tsx
// Source: @dnd-kit/core official docs
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

// Inside RefsTab component (before DndContext):
const sensors = useSensors(
  useSensor(MouseSensor),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,      // D-13: 200ms delay
      tolerance: 5,    // D-13: 5px tolerance
    },
  })
)

// On DndContext (currently has no sensors prop at line 1158):
<DndContext
  sensors={sensors}
  collisionDetection={pointerWithin}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
```

**Critical:** `touchAction: 'none'` is already set on DraggablePerson (line 93 of RefsTab.tsx) — verified.

### Pattern 3: Bottom Drawer for RightPanel (MOB-02)

**What:** A CSS-transform-driven bottom sheet in AppShell, conditionally shown, containing the existing RightPanel component.
**When to use:** Mobile/tablet breakpoints below `lg`.
**Example:**

```tsx
// In AppShell.tsx — add state:
const [drawerOpen, setDrawerOpen] = useState(false)

// Mobile FAB (outside main flex container, fixed position):
<button
  className="lg:hidden fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-navy flex items-center justify-center shadow-xl"
  onClick={() => setDrawerOpen(true)}
>
  {/* Weather status icon or cloud icon */}
</button>

// Backdrop + Drawer:
{drawerOpen && (
  <div className="lg:hidden fixed inset-0 z-50">
    <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
    <div
      className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-surface-card border-t border-border"
      style={{ maxHeight: '80vh', overflowY: 'auto' }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>
      <RightPanel onNavigate={(tab) => { setActiveTab(tab); setDrawerOpen(false) }} />
    </div>
  </div>
)}
```

### Pattern 4: Hamburger Nav Drawer (MOB-04)

**What:** Conditional render in TopBar — hamburger button below `md`, full nav at `md+`.
**When to use:** Mobile navigation below 768px breakpoint.
**Example:**

```tsx
// In TopBar.tsx — add state:
const [mobileOpen, setMobileOpen] = useState(false)

// In header JSX:
{/* Mobile hamburger — shown below md */}
<button className="md:hidden flex items-center px-4 h-full" onClick={() => setMobileOpen(true)}>
  <Menu size={20} className="text-white" />
</button>

{/* Desktop nav — hidden below md */}
<nav ref={navRef} className="hidden md:flex flex-1">
  {/* existing nav groups */}
</nav>

{/* Mobile slide-out drawer */}
{mobileOpen && (
  <div className="md:hidden fixed inset-0 z-50">
    <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
    <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#030d20] border-r border-border overflow-y-auto">
      {/* NAV_GROUPS reuse — vertically stacked */}
      {visibleGroups.map((group) => (
        /* render all items flat or grouped */
      ))}
    </div>
  </div>
)}
```

### Pattern 5: insertNotification Call in Weather Route (NOT-02)

**What:** After `runWeatherEngine()` returns `result.alerts`, iterate and insert notifications.
**When to use:** Each weather engine run that produces active alerts.
**Example:**

```tsx
// In app/api/weather-engine/route.ts POST handler — after line 47:
const result = await runWeatherEngine(...)

// Wire NOT-02: one notification per alert type
for (const alert of result.alerts) {
  const scopeIsField = alert.type !== 'lightning' // lightning is event-wide
  await insertNotification(
    Number(event_id),
    'weather_alert',
    scopeIsField ? 'field' : 'event',
    scopeIsField ? null : null, // field scope_id TBD per alert
    {
      title: alert.title,
      summary: alert.description,
      detail: `Complex ${complex_id} — ${alert.type}`,
      cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=weather`,
    }
  )
}
```

Note: `insertNotification` is a `'use server'` function — it can be called from API routes directly because API routes are server-side. Confirmed by Phase 8 routes importing and calling it.

### Pattern 6: Referee No-Show Notification (NOT-04 D-21)

**What:** When a game status changes to "Live" or "Starting", check if any referee is assigned. If not, insert an admin_alert notification.
**Where:** Two viable options per Claude's discretion:

- Option A: In the game status update handler in `lib/store.tsx` (client-side `updateGameStatus` action — cannot call server function directly)
- Option B: In the games API route PATCH handler (server-side — preferred for notification insert)
- Option C: Create a dedicated `app/api/games/[id]/status/route.ts` or wire into existing games PATCH route

**Recommended:** Wire into existing game update path in `lib/db.ts` is wrong (no server context). Best approach: add a check in the unified engine run (which already runs on game days) or create a lightweight check triggered from the dashboard load. Per D-21, the game status transition is the trigger — but since `updateGameStatus` in `lib/store.tsx` calls `lib/db.ts` which calls Supabase directly from browser, a server-side API route interceptor is the right pattern.

### Pattern 7: NOT-03 Coverage Map

**What:** What is and isn't already wired for schedule change notifications.

**Already wired (Phase 8):**

- `POST /api/schedule-change-requests` — notifies admin (event scope) on new request submission ✓
- `PATCH /api/schedule-change-requests/[id]` — notifies team on cancel approval (both teams) ✓
- `PATCH /api/schedule-change-requests/[id]` — notifies team on deny ✓
- `PATCH /api/schedule-change-requests/[id]` — notifies team on change_opponent approval ✓
- `POST /api/schedule-change-requests/[id]/reschedule` — notifies both teams on reschedule ✓

**NOT yet wired (Phase 10 gap):**

- Admin-initiated direct game cancellation (setting `status = 'Cancelled'` outside request workflow) — no notification fires
- The `approved` transition for `reschedule` request type (pending → approved state, before actual reschedule) — no team notification on approval acknowledgment

**D-19 scope:** The cancel-through-request path IS wired (see line 157 in `[id]/route.ts`). The gap is direct game cancellation by admin from DashboardTab or ScheduleTab.

### Anti-Patterns to Avoid

- **Modifying `lib/engines/weather.ts` directly for notifications:** Engines are pure functions per project convention (D-15). All side effects including `insertNotification` calls go in API routes.
- **Using `pointerSensor` only:** PointerEvents API has iOS Safari issues for drag-drop. Using dedicated MouseSensor + TouchSensor is the @dnd-kit-recommended approach for cross-platform.
- **Calling `insertNotification` from client components:** It is a `'use server'` function — can only be called from server-side (API routes, Server Components, Server Actions). The game status change trigger needs a server-side path.
- **No `touchAction: 'none'` on drag items:** Already set in DraggablePerson — must not be removed.
- **Hamburger menu using `display: none` on nav groups individually:** Instead hide the entire `<nav>` at mobile. The existing `NAV_GROUPS` array drives both desktop and mobile drawer.

## Don't Hand-Roll

| Problem                 | Don't Build                 | Use Instead                                | Why                                                                                         |
| ----------------------- | --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Touch drag-drop         | Custom touch event handlers | @dnd-kit TouchSensor                       | Already handles iOS momentum scroll disambiguation, pointer capture, activation constraints |
| Notification dedup      | Custom timestamp comparison | Phase 7 `dedup_key` STORED column in DB    | Computed column + 5-min window already enforced at DB level                                 |
| Bottom drawer animation | Custom JS animation         | CSS `transform: translateY` + `transition` | No JS animation library needed for simple slide-up                                          |
| Slide-out nav drawer    | Complex routing/state       | State bool + fixed overlay pattern         | One `useState` + Tailwind fixed positioning is sufficient                                   |

## Common Pitfalls

### Pitfall 1: Hooks Before Early Returns

**What goes wrong:** Adding `useState([drawerOpen, setDrawerOpen])` after an `if (!eventId) return null` causes a React hooks error.
**Why it happens:** AppShell.tsx has `if (state.loading) return (...)` at line 103, after the existing hooks. New hooks must be added before this guard.
**How to avoid:** Add all new hooks (drawer state, hamburger state) at the top of the component function, before any conditional returns.
**Warning signs:** "React Hook called conditionally" TypeScript/runtime error.

### Pitfall 2: insertNotification is 'use server' — Cannot Call from Browser

**What goes wrong:** Attempting to call `insertNotification` from `lib/store.tsx` (client component) or from `updateGameStatus` in `lib/db.ts` fails silently or throws.
**Why it happens:** `lib/notifications.ts` has `'use server'` directive. Server functions cannot be imported and called from client-side code at runtime.
**How to avoid:** All `insertNotification` calls must be in API routes (NOT-02, NOT-04). For game status-change notifications (NOT-04 D-21), route through a server API endpoint.
**Warning signs:** "Cannot call server function from client" or silent no-op.

### Pitfall 3: Weather Notification Storms

**What goes wrong:** Weather engine runs every 5 minutes — 12 runs/hour × many coaches = hundreds of duplicate notifications.
**Why it happens:** Without dedup, each engine run fires new notifications.
**How to avoid:** Phase 7 already handles this via the `dedup_key` STORED computed column (Phase 7 D-13, `DEDUP_WINDOW_MS = 5 minutes`). The dedup key should incorporate `complexId + alertType` per D-17. The DB will reject duplicate inserts within the window.
**Warning signs:** Coaches reporting multiple identical notifications within minutes.

### Pitfall 4: Schedule Horizontal Overflow at 375px

**What goes wrong:** `grid-cols-[repeat(auto-fill,minmax(260px,1fr))]` collapses to `260px` minimum — at 375px viewport, cards are narrower than min so they overflow.
**Why it happens:** `minmax(260px, 1fr)` means each column is at least 260px. At 375px container width (minus padding), a single 260px+ column still overflows.
**How to avoid:** D-08 fix: `grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]` — single column below `sm:` (640px).
**Warning signs:** Horizontal scrollbar visible in Chrome DevTools mobile view at 375px.

### Pitfall 5: RightPanel Creates Double-Render

**What goes wrong:** Rendering RightPanel both in the sidebar (hidden on mobile) AND in the drawer creates two live instances both subscribing to weather data.
**Why it happens:** D-07 says "same RightPanel component" — if rendered in both locations simultaneously, both mount.
**How to avoid:** Use conditional rendering — either the sidebar OR the drawer renders RightPanel at a time. `hidden lg:block` hides the sidebar from view but it still mounts. Better: `hidden lg:flex` on sidebar wrapper + do not render drawer version until `drawerOpen === true`.
**Warning signs:** Double Supabase queries for weather readings.

### Pitfall 6: DndContext sensors prop is missing — drag works on desktop but not mobile

**What goes wrong:** `DndContext` in RefsTab has no `sensors` prop (confirmed at line 1158). Without TouchSensor, drag-drop does not work on iOS/Android.
**Why it happens:** `@dnd-kit` defaults to pointer-based sensors which have browser-specific issues on touch devices.
**How to avoid:** Add `useSensors(useSensor(MouseSensor), useSensor(TouchSensor, {...}))` and pass to `sensors` prop on `DndContext`.
**Warning signs:** Drag works on desktop Chrome but not on iOS Safari or Android Chrome.

### Pitfall 7: TopBar Hamburger — Close on Outside Click

**What goes wrong:** The existing `useEffect` in TopBar closes dropdown on outside click by checking `navRef` containment. If the hamburger drawer is part of a portal/fixed overlay outside `navRef`, the outside-click handler closes the drawer on every touch.
**Why it happens:** Fixed overlays are not inside `navRef`.
**How to avoid:** Track hamburger state separately (`mobileOpen`) from `openGroup`. The existing `mousedown` handler only affects `openGroup` — add a separate handler or exclude mobile drawer from the check.
**Warning signs:** Mobile drawer immediately closes after opening.

## Code Examples

### @dnd-kit TouchSensor Import and useSensors

```typescript
// Source: @dnd-kit/core package (installed at ^6.1.0)
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  pointerWithin,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'

// In component:
const sensors = useSensors(
  useSensor(MouseSensor),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
)

// On DndContext:
<DndContext sensors={sensors} collisionDetection={pointerWithin} ...>
```

### Weather Notification Wiring (NOT-02)

```typescript
// In app/api/weather-engine/route.ts POST handler
// After: const result = await runWeatherEngine(...)

import { insertNotification } from '@/lib/notifications'

// Fire one notification per alert (dedup handles storms)
for (const alert of result.alerts) {
  await insertNotification(
    Number(event_id),
    'weather_alert',
    'event', // event-wide scope for weather
    null, // scope_id null for event scope
    {
      title: alert.title,
      summary: alert.description,
      detail: `Complex ID ${complex_id} — ${alert.type} detected`,
      cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=weather`,
    }
  )
}
```

### Registration Deadline Check (NOT-04 D-22)

```typescript
// Can be triggered from dashboard load — check on the server side
// In a new API route or within existing event settings query:
const fortyEightHoursFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
const { data: closingEvents } = await supabase
  .from('events')
  .select('id, registration_closes_at')
  .eq('id', eventId)
  .lte('registration_closes_at', fortyEightHoursFromNow)
  .gte('registration_closes_at', new Date().toISOString())
  .single()

if (closingEvent) {
  await insertNotification(eventId, 'admin_alert', 'event', null, {
    title: 'Registration closing soon',
    summary: `Registration closes in less than 48 hours`,
    detail: `Closes at ${closingEvent.registration_closes_at}`,
    cta_url: `${process.env.NEXT_PUBLIC_APP_URL}?tab=settings`,
  })
}
```

## State of the Art

| Old Approach                 | Current Approach             | When Changed                | Impact                         |
| ---------------------------- | ---------------------------- | --------------------------- | ------------------------------ |
| PointerSensor only (dnd-kit) | MouseSensor + TouchSensor    | @dnd-kit v6+ recommendation | Reliable iOS Safari support    |
| Window-level CSS for mobile  | Tailwind responsive prefixes | Tailwind v3+                | Co-located, no extra CSS files |
| JS-animated drawers          | CSS transform transitions    | Current standard            | No JS animation library needed |

**Deprecated/outdated:**

- `PointerSensor` alone: @dnd-kit docs recommend using platform-specific sensors (MouseSensor + TouchSensor) instead of PointerSensor for production apps that need iOS Safari support. PointerEvents API is inconsistent on iOS.

## Open Questions

1. **Game status update path for NOT-04 D-21 (referee no-show)**
   - What we know: `updateGameStatus` in `lib/store.tsx` calls `lib/db.ts` `updateGame()` directly — both are client-side. `insertNotification` is `'use server'` and cannot be called from client code.
   - What's unclear: Is there an existing API route for game status updates that the planner should target, or does one need to be created?
   - Recommendation: Check if `app/api/games/` route exists. If not, add a small `PATCH /api/games/[id]` route for status updates, then migrate the DashboardTab status change to use this route — enabling server-side `insertNotification` calls. Alternatively, wrap the check in a separate `POST /api/notifications/referee-check` that the client calls after status change.

2. **`registration_closes_at` field existence**
   - What we know: CONTEXT.md D-22 references it. Not confirmed in `types/index.ts` from reading.
   - What's unclear: Does the `events` table have a `registration_closes_at` column, or does this need to be added as part of this phase?
   - Recommendation: Planner should include a task to verify the column exists in schema and types before wiring the deadline check. If absent, a migration + type update is needed first.

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — phase uses only existing Supabase, Tailwind, and installed npm packages)

## Validation Architecture

### Test Framework

| Property           | Value                             |
| ------------------ | --------------------------------- |
| Framework          | Vitest 4.1.0                      |
| Config file        | `vitest.config.ts` (project root) |
| Quick run command  | `npm run test`                    |
| Full suite command | `npm run test:coverage`           |

### Phase Requirements → Test Map

| Req ID | Behavior                                                    | Test Type           | Automated Command                                                   | File Exists? |
| ------ | ----------------------------------------------------------- | ------------------- | ------------------------------------------------------------------- | ------------ |
| MOB-01 | Dashboard grid renders single-column at mobile width        | unit (component)    | `npx vitest run __tests__/components/DashboardTab.test.tsx`         | ❌ Wave 0    |
| MOB-02 | RightPanel drawer toggles open/closed in AppShell           | unit (component)    | `npx vitest run __tests__/components/AppShell.test.tsx`             | ❌ Wave 0    |
| MOB-03 | RefsTab DndContext has sensors prop with TouchSensor        | unit (component)    | `npx vitest run __tests__/components/RefsTab.test.tsx`              | ❌ Wave 0    |
| MOB-04 | TopBar renders hamburger below md, full nav at md+          | unit (component)    | `npx vitest run __tests__/components/TopBar.test.tsx`               | ❌ Wave 0    |
| NOT-02 | Weather API route calls insertNotification for each alert   | unit (api)          | `npx vitest run __tests__/app/api/weather-engine.test.ts`           | ❌ Wave 0    |
| NOT-03 | Reschedule route notifies both teams                        | unit (api)          | `npx vitest run __tests__/app/api/schedule-change-requests.test.ts` | ❌ Wave 0    |
| NOT-04 | Admin alert fired for referee no-show on game status change | unit (api or store) | `npx vitest run __tests__/app/api/games-status.test.ts`             | ❌ Wave 0    |

Note: Component render tests for responsive classes are limited in jsdom — they can verify className strings but cannot simulate actual viewport widths. Assertion pattern: check that the className string includes `grid-cols-1` and `sm:grid-cols-[repeat...]` rather than simulating a 375px viewport.

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/components/DashboardTab.test.tsx` — MOB-01 grid class assertion
- [ ] `__tests__/components/AppShell.test.tsx` — MOB-02 drawer state
- [ ] `__tests__/components/RefsTab.test.tsx` — MOB-03 sensors prop
- [ ] `__tests__/components/TopBar.test.tsx` — MOB-04 hamburger/nav conditional
- [ ] `__tests__/app/api/weather-engine.test.ts` — NOT-02 insertNotification call
- [ ] `__tests__/app/api/games-status.test.ts` — NOT-04 referee no-show trigger

Existing: `__tests__/app/api/` directory exists (structure confirmed). `__tests__/components/` exists with `SharingSection.test.tsx` and `VenueAutocompleteInput.test.tsx` as reference patterns.

## Sources

### Primary (HIGH confidence)

- Direct file reads: `components/AppShell.tsx`, `components/TopBar.tsx`, `components/RightPanel.tsx` — exact current structure confirmed
- Direct file reads: `components/refs/RefsTab.tsx` — confirmed no sensors prop, touchAction: none present
- Direct file reads: `components/dashboard/DashboardTab.tsx` — confirmed `grid-cols-[repeat(auto-fill,minmax(260px,1fr))]`
- Direct file reads: `lib/notifications.ts`, `lib/notification-constants.ts` — confirmed insertNotification signature
- Direct file reads: `app/api/schedule-change-requests/route.ts`, `[id]/route.ts`, `[id]/reschedule/route.ts` — NOT-03 coverage map
- Direct file reads: `lib/engines/unified.ts`, `app/api/weather-engine/route.ts` — confirmed no notification calls
- `package.json` — @dnd-kit/core ^6.1.0 confirmed, TouchSensor in core package

### Secondary (MEDIUM confidence)

- @dnd-kit/core v6 docs pattern for useSensors + TouchSensor/MouseSensor — established API, stable since v4
- Tailwind CSS 3.x responsive prefix behavior — project already uses sm:/md:/lg: extensively

### Tertiary (LOW confidence)

- None for this phase — all findings are from direct codebase inspection

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — confirmed from package.json and existing code
- Architecture: HIGH — all patterns derived from reading actual source files
- Pitfalls: HIGH — derived from actual code inspection (e.g., sensors prop absence confirmed, hooks ordering in AppShell confirmed, 'use server' constraint confirmed)
- Notification coverage: HIGH — all 3 route files read line-by-line

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable Tailwind/dnd-kit APIs; notification schema unchanged)
