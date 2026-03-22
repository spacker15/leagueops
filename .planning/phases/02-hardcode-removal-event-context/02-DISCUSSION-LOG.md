# Phase 2: Hardcode Removal & Event Context - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 02-hardcode-removal-event-context
**Areas discussed:** Loading fallbacks, Realtime scoping, QR code URLs, Migration order

---

## Loading Fallbacks

| Option                 | Description                                                                                                  | Selected |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Null render            | Return null early — component renders nothing until eventId available. Simplest, avoids flash of loading UI. | ✓        |
| Spinner per component  | Each component shows its own loading spinner. More visual feedback but many spinners across ~20 components.  |          |
| Full-page loading gate | Block entire app shell until eventId resolves. Prevents partial renders but feels slower.                    |          |

**User's choice:** Null render
**Notes:** None

---

## Realtime Scoping

| Option                   | Description                                                                                     | Selected |
| ------------------------ | ----------------------------------------------------------------------------------------------- | -------- |
| Teardown and resubscribe | Remove old channel, create new with event_id filter on switch. Clean isolation, matches SEC-05. | ✓        |
| Client-side filter only  | Keep global subscription, filter incoming events client-side. Simpler but unnecessary traffic.  |          |
| Per-table channels       | Separate channel per table with event_id filter. More granular but more subscriptions.          |          |

**User's choice:** Teardown and resubscribe
**Notes:** None

---

## QR Code URLs

| Option           | Description                                                                                       | Selected |
| ---------------- | ------------------------------------------------------------------------------------------------- | -------- |
| Event slug       | e.g., /checkin/summer-tournament-2026/[token]. Human-readable, consistent with /e/[slug] pattern. | ✓        |
| Numeric event ID | e.g., /checkin/42/[token]. Simpler but opaque.                                                    |          |

**User's choice:** Event slug
**Notes:** None

---

## Migration Order

| Option          | Description                                                                   | Selected |
| --------------- | ----------------------------------------------------------------------------- | -------- |
| Layer-by-layer  | Engines → API routes → Store/realtime → Components. Dependency-safe ordering. | ✓        |
| By feature area | Group by feature: scheduling, auth, etc. More cohesive but cross-layer deps.  |          |
| Claude decides  | Let Claude pick the most dependency-safe ordering.                            |          |

**User's choice:** Layer-by-layer
**Notes:** None

---

## Claude's Discretion

- Exact grouping of components into sub-plans
- Whether to batch small API route changes
- loadAll dependency fix placement

## Deferred Ideas

None
