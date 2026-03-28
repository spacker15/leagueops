# Phase 8: Schedule Change Request Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 08-schedule-change-request-workflow
**Areas discussed:** Request submission UX, Admin review workflow, Slot suggestion engine, Notification triggers, State machine details, Cancellation flow, Request filtering/sorting, Coach game selection UX

---

## Request Submission UX

| Option                | Description                                                                 | Selected |
| --------------------- | --------------------------------------------------------------------------- | -------- |
| Game card action      | Add a 'Request Change' button on individual game cards in the schedule view | ✓        |
| Dedicated tab/section | Add a 'Change Requests' section in the program leader portal                |          |
| Both                  | Game card + portal section                                                  |          |

**User's choice:** Game card action
**Notes:** Most contextual entry point — coach is already looking at the game.

---

| Option                     | Description                                    | Selected |
| -------------------------- | ---------------------------------------------- | -------- |
| Single game per request    | Each request targets one game                  |          |
| Multiple games per request | Coach can select multiple games in one request | ✓        |

**User's choice:** Multiple games per request
**Notes:** Common scenario: "team can't make Saturday" affects multiple games.

---

| Option            | Description                                       | Selected |
| ----------------- | ------------------------------------------------- | -------- |
| Preset + freetext | Dropdown with common reasons plus free text field | ✓        |
| Freetext only     | Just a text area                                  |          |
| You decide        | Claude picks                                      |          |

**User's choice:** Preset + freetext
**Notes:** Structured data helps admin prioritize and filter.

---

| Option                             | Description                            | Selected |
| ---------------------------------- | -------------------------------------- | -------- |
| Coach chooses cancel or reschedule | Coach states intent explicitly         | ✓        |
| Always reschedule intent           | Every request assumed to be reschedule |          |

**User's choice:** Coach chooses cancel or reschedule
**Notes:** Matches SCR-01 requirement spec.

---

| Option                | Description                                          | Selected |
| --------------------- | ---------------------------------------------------- | -------- |
| Existing ScheduleTab  | Same tab as admins, role-filtered                    |          |
| Program leader portal | Schedule view inside ProgramLeaderDashboard          |          |
| Both views            | Request Change button in both ScheduleTab and portal | ✓        |

**User's choice:** Both views

---

| Option                   | Description                              | Selected |
| ------------------------ | ---------------------------------------- | -------- |
| Yes, in the modal/portal | Coach sees past requests with status     | ✓        |
| No, notification only    | Coach submits and waits for notification |          |

**User's choice:** Yes, in the modal/portal

---

| Option             | Description                                 | Selected |
| ------------------ | ------------------------------------------- | -------- |
| One reason for all | Single reason applies to all selected games | ✓        |
| Per-game reasons   | Each selected game gets its own reason      |          |

**User's choice:** One reason for all
**Notes:** Most multi-game requests are date-level unavailability anyway.

---

| Option                      | Description                    | Selected |
| --------------------------- | ------------------------------ | -------- |
| Program leader only         | Only program leader can submit |          |
| Any coach on team           | Any assigned coach can submit  |          |
| Program leader + head coach | Both can submit                | ✓        |

**User's choice:** Program leader + head coach
**Notes:** Middle ground — prevents conflicting requests while not bottlenecking on one person.

---

## Admin Review Workflow

| Option                    | Description                                       | Selected |
| ------------------------- | ------------------------------------------------- | -------- |
| New tab in AppShell       | Dedicated 'Requests' tab with pending count badge | ✓        |
| Section in Command Center | Panel inside CommandCenter/opsAlerts view         |          |
| Section in Schedule tab   | Panel/drawer inside ScheduleTab                   |          |

**User's choice:** New tab in AppShell

---

| Option            | Description                                        | Selected |
| ----------------- | -------------------------------------------------- | -------- |
| Full detail cards | Card shows team, games, reason, type, status, date | ✓        |
| Compact list rows | Table-style rows, click to expand                  |          |
| You decide        | Claude picks                                       |          |

**User's choice:** Full detail cards

---

| Option                 | Description                                    | Selected |
| ---------------------- | ---------------------------------------------- | -------- |
| Inline actions on card | Approve/Deny buttons on card, expand for slots | ✓        |
| Detail modal workflow  | Click request opens full modal with actions    |          |

**User's choice:** Inline actions on card

---

| Option                                  | Description                                        | Selected |
| --------------------------------------- | -------------------------------------------------- | -------- |
| Optional notes on deny, none on approve | Deny encourages reason note, approve proceeds fast | ✓        |
| Optional notes on both                  | Both have optional notes field                     |          |
| Required notes on both                  | Must enter note for every decision                 |          |

**User's choice:** Optional notes on deny, none on approve

---

## Slot Suggestion Engine

| Option                   | Description                                             | Selected |
| ------------------------ | ------------------------------------------------------- | -------- |
| Ranked list with details | Numbered list of 3-5 slots with availability indicators | ✓        |
| Calendar-style grid      | Mini calendar with highlighted slots                    |          |
| You decide               | Claude picks                                            |          |

**User's choice:** Ranked list with details

---

| Option                            | Description                              | Selected |
| --------------------------------- | ---------------------------------------- | -------- |
| Field + team + referee            | Full availability check                  |          |
| Field + team only                 | No referee check, assign refs separately | ✓        |
| Field + team + availability dates | Include team registration availability   |          |

**User's choice:** Field + team only

---

| Option        | Description                                 | Selected |
| ------------- | ------------------------------------------- | -------- |
| One at a time | Admin processes each game individually      | ✓        |
| All at once   | Engine finds compatible slots for all games |          |

**User's choice:** One at a time

---

| Option     | Description           | Selected |
| ---------- | --------------------- | -------- |
| Up to 5    | Top 5 available slots | ✓        |
| Up to 3    | Keep it tight         |          |
| You decide | Claude picks          |          |

**User's choice:** Up to 5

---

## Notification Triggers

| Option                      | Description                                       | Selected |
| --------------------------- | ------------------------------------------------- | -------- |
| New request + final outcome | Submit→admin, rescheduled→teams, denied→requester | ✓        |
| Every state change          | Notify on all transitions                         |          |
| Final outcome only          | Only rescheduled/denied                           |          |

**User's choice:** New request + final outcome

---

| Option               | Description                                    | Selected |
| -------------------- | ---------------------------------------------- | -------- |
| Both teams           | Home and away coaches/program leaders notified | ✓        |
| All teams + referees | Both teams and assigned referees               |          |
| Requesting team only | Only the submitter                             |          |

**User's choice:** Both teams

---

| Option           | Description                                              | Selected |
| ---------------- | -------------------------------------------------------- | -------- |
| Yes, deep link   | Email/push CTA links to specific request in Requests tab | ✓        |
| Link to tab only | Link goes to Requests tab without highlighting           |          |

**User's choice:** Yes, deep link

---

## State Machine Details

| Option                   | Description                                     | Selected |
| ------------------------ | ----------------------------------------------- | -------- |
| Per-game status tracking | Each game has own status, request aggregates    | ✓        |
| All-or-nothing           | Request stays approved until all games resolved |          |
| Request = container only | Request tracks overall, games stored separately |          |

**User's choice:** Per-game status tracking

---

| Option                  | Description                        | Selected |
| ----------------------- | ---------------------------------- | -------- |
| Forward-only            | Strictly forward state transitions | ✓        |
| Allow revert to pending | Admin can send back to pending     |          |

**User's choice:** Forward-only

---

## Cancellation Flow

| Option                       | Description                               | Selected |
| ---------------------------- | ----------------------------------------- | -------- |
| Status change to 'Cancelled' | Game stays in DB with Cancelled status    | ✓        |
| Soft delete (hidden)         | deleted_at timestamp, filtered from views |          |
| Hard delete                  | Row deleted                               |          |

**User's choice:** Status change to 'Cancelled'

---

| Option                         | Description                                 | Selected |
| ------------------------------ | ------------------------------------------- | -------- |
| Approve = confirm cancellation | Cancel requests skip slot suggestion        | ✓        |
| Approve then confirm           | Extra confirmation step before cancellation |          |

**User's choice:** Approve = confirm cancellation

---

## Request Filtering/Sorting

| Option             | Description                                                | Selected |
| ------------------ | ---------------------------------------------------------- | -------- |
| Status sections    | Grouped by status: Pending, Under Review, Completed/Denied | ✓        |
| Chronological feed | Single reverse-chronological list with filter buttons      |          |
| You decide         | Claude picks                                               |          |

**User's choice:** Status sections

---

## Coach Game Selection UX

| Option                          | Description                                            | Selected |
| ------------------------------- | ------------------------------------------------------ | -------- |
| Checkbox list of upcoming games | List with checkboxes, date/time/field/opponent per row | ✓        |
| Mini calendar with game dots    | Calendar view, click dates to select                   |          |
| Single game pre-selected        | Pre-selected from card, add more via dropdown          |          |

**User's choice:** Checkbox list of upcoming games

---

| Option           | Description                         | Selected |
| ---------------- | ----------------------------------- | -------- |
| Yes, pre-checked | Game from card pre-checked in modal | ✓        |
| No, start fresh  | Always start with no selections     |          |

**User's choice:** Yes, pre-checked

---

## Claude's Discretion

- Database table schema design (schedule_change_requests, schedule_change_request_games)
- State machine validation logic implementation
- Slot suggestion ranking algorithm internals
- PostgreSQL RPC function design for atomic rescheduling
- UI component styling details
- Pending count badge implementation
- Game "Cancelled" status visual treatment

## Deferred Ideas

- Coach-initiated time proposals (roadmap explicitly excludes this)
- Open comment threads on requests (roadmap explicitly excludes this)
- Referee availability in slot suggestions
- Bulk approve/deny for multiple requests
- Request analytics/reporting
