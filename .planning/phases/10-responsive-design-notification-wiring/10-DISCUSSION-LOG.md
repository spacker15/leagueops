# Phase 10: Responsive Design & Notification Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 10-responsive-design-notification-wiring
**Areas discussed:** Mobile navigation, RightPanel mobile, Touch drag-drop, Weather notification trigger
**Mode:** --auto (all decisions auto-selected using recommended defaults)

---

## Mobile Navigation

| Option                               | Description                                                                  | Selected |
| ------------------------------------ | ---------------------------------------------------------------------------- | -------- |
| Hamburger menu with slide-out drawer | Collapse TopBar to hamburger on mobile, slide-out drawer with all nav groups | ✓        |
| Bottom tab bar                       | Replace top nav with iOS-style bottom tabs on mobile                         |          |
| Collapsible top nav                  | Keep nav at top but auto-collapse groups into overflow menu                  |          |

**User's choice:** [auto] Hamburger menu with slide-out drawer (recommended default)
**Notes:** Matches existing TopBar dropdown pattern, minimal restructuring, standard SaaS pattern

---

## RightPanel Mobile Behavior

| Option                    | Description                                        | Selected |
| ------------------------- | -------------------------------------------------- | -------- |
| Bottom drawer with handle | Slides up from bottom, drag handle, FAB trigger    | ✓        |
| Overlay modal             | Full-screen modal triggered by a button            |          |
| Hidden with status bar    | Hide completely, show weather status in a thin bar |          |

**User's choice:** [auto] Bottom drawer with handle (recommended default)
**Notes:** Matches roadmap success criteria SC-2 explicitly ("bottom drawer on mobile"), keeps weather/incidents accessible

---

## Touch Drag-Drop Activation

| Option                     | Description                                              | Selected |
| -------------------------- | -------------------------------------------------------- | -------- |
| 200ms delay, 5px tolerance | Standard mobile threshold — prevents scroll interference | ✓        |
| No delay, immediate        | Fastest activation but conflicts with scrolling          |          |
| Long press (500ms+)        | Very deliberate but slower for power users               |          |

**User's choice:** [auto] 200ms delay, 5px tolerance (recommended default)
**Notes:** Standard @dnd-kit mobile pattern, prevents accidental drags while scrolling

---

## Weather Notification Trigger Location

| Option                | Description                                                      | Selected |
| --------------------- | ---------------------------------------------------------------- | -------- |
| Weather API route     | Insert notification after engine returns alerts in route handler | ✓        |
| Inside weather engine | Add insertNotification calls directly in engine module           |          |
| Both engine + route   | Engine queues, route confirms and dispatches                     |          |

**User's choice:** [auto] Weather API route (recommended default)
**Notes:** Keeps engine pure (no side effects), follows Phase 8 pattern where schedule change route handles notifications

---

## Claude's Discretion

- Bottom drawer animation and handle styling
- Hamburger menu icon placement and animation
- FAB design for mobile RightPanel trigger
- Schedule table sticky column breakpoint
- Referee no-show detection placement
- Registration deadline check mechanism
- Mobile button sizing and touch targets

## Deferred Ideas

None — discussion stayed within phase scope
