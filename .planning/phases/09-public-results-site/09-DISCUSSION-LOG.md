# Phase 9: Public Results Site - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 09-public-results-site
**Areas discussed:** Schedule views, Tournament brackets, Live score updates, QR codes & discovery

---

## Schedule Views

| Option                       | Description                                                                                    | Selected |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Sub-tabs within Schedule tab | Schedule tab gets toggle buttons: By Team / By Field / By Time. Reuses existing tab structure. | ✓        |
| Dropdown selector            | Single dropdown above schedule content. More compact, less visible.                            |          |
| Segmented control            | Pill-style segmented control. Modern feel, compact.                                            |          |

**User's choice:** Sub-tabs within Schedule tab
**Notes:** None

### Team View Filter

| Option                               | Description                                                                | Selected |
| ------------------------------------ | -------------------------------------------------------------------------- | -------- |
| Search box + scrollable team list    | Type-ahead search bar filtering teams, grouped by division. Tap to filter. | ✓        |
| Division dropdown then team dropdown | Two cascading dropdowns. More structured, two interactions.                |          |
| Flat alphabetical team list          | A-Z list, no division grouping.                                            |          |

**User's choice:** Search box + scrollable team list

### Field View Layout

| Option                         | Description                                                       | Selected |
| ------------------------------ | ----------------------------------------------------------------- | -------- |
| Field cards with game timeline | Each field gets a card with games in time order, grouped by date. | ✓        |
| Field selector + game list     | Pick field from dropdown, see its games one at a time.            |          |
| You decide                     | Claude picks.                                                     |          |

**User's choice:** Field cards with game timeline

### Time View Layout

| Option                    | Description                                                                      | Selected |
| ------------------------- | -------------------------------------------------------------------------------- | -------- |
| Grouped list by time slot | Games grouped under time headers. All fields/teams at that time. Phone-friendly. | ✓        |
| Visual timeline grid      | Hour-by-hour grid with fields as columns. Harder on mobile.                      |          |
| You decide                | Claude picks for mobile.                                                         |          |

**User's choice:** Grouped list by time slot

### Date Navigation

| Option                  | Description                                                   | Selected |
| ----------------------- | ------------------------------------------------------------- | -------- |
| Day tabs at top         | Horizontal day tabs (Day 1, Day 2). Tap to jump between days. | ✓        |
| Scroll through all days | Single long scrollable list grouped by date headers.          |          |
| You decide              | Claude picks.                                                 |          |

**User's choice:** Day tabs at top

---

## Tournament Brackets

### Bracket Format

| Option                    | Description                                           | Selected |
| ------------------------- | ----------------------------------------------------- | -------- |
| Single-elimination only   | Classic tournament bracket. 8 and 16 teams.           |          |
| Single-elim + consolation | Main bracket plus consolation for first-round losers. |          |
| Double-elimination        | Winners and losers brackets. More complex.            | ✓        |

**User's choice:** Double-elimination

### Mobile Rendering

| Option                            | Description                                                         | Selected |
| --------------------------------- | ------------------------------------------------------------------- | -------- |
| Horizontal scroll with pinch-zoom | Full bracket renders, users scroll and pinch. Classic bracket look. | ✓        |
| Round-by-round vertical cards     | Stacked round sections on mobile. No horizontal scroll.             |          |
| You decide                        | Claude picks.                                                       |          |

**User's choice:** Horizontal scroll with pinch-zoom

### Bracket Location

| Option               | Description                                                           | Selected |
| -------------------- | --------------------------------------------------------------------- | -------- |
| New 'Bracket' tab    | 5th tab alongside existing tabs. Only shows when bracket data exists. | ✓        |
| Inside Standings tab | Bracket below standings tables. Page gets long.                       |          |
| Separate page        | Dedicated /e/[slug]/bracket page.                                     |          |

**User's choice:** New 'Bracket' tab

### Data Model

| Option                  | Description                                                  | Selected |
| ----------------------- | ------------------------------------------------------------ | -------- |
| Model from scratch      | New tables for bracket rounds, matchups, seeds, progression. | ✓        |
| Derive from games table | Tag games as 'bracket' type, derive tree from results.       |          |
| You decide              | Claude determines.                                           |          |

**User's choice:** Model from scratch

### Double-Elimination Layout

| Option             | Description                                                  | Selected |
| ------------------ | ------------------------------------------------------------ | -------- |
| Stacked vertically | Winners on top, losers below. Easier mobile scroll.          | ✓        |
| Side-by-side       | Winners left, losers right. Classic but needs wide viewport. |          |
| Tabbed             | Toggle between Winners/Losers/Finals sub-tabs.               |          |

**User's choice:** Stacked vertically

### Bracket Live Scores

| Option                       | Description                                                                 | Selected |
| ---------------------------- | --------------------------------------------------------------------------- | -------- |
| Live scores in bracket cards | In-progress bracket games show updating scores. Same Realtime subscription. | ✓        |
| Final results only           | Bracket only shows completed results. In-progress shows "In Progress".      |          |
| You decide                   | Claude picks.                                                               |          |

**User's choice:** Live scores in bracket cards

---

## Live Score Updates

### Update Animation

| Option                                        | Description                                                        | Selected |
| --------------------------------------------- | ------------------------------------------------------------------ | -------- |
| Smooth score transitions with flash highlight | Score animates, card briefly flashes green. Subtle, no sound.      | ✓        |
| Full card refresh with 'Updated' badge        | Temporary UPDATED badge. More obvious, busier.                     |          |
| Score counter animation                       | Scores roll like a sports ticker. Flashy, potentially distracting. |          |

**User's choice:** Smooth score transitions with flash highlight

### Live Score Scope

| Option                             | Description                                                           | Selected |
| ---------------------------------- | --------------------------------------------------------------------- | -------- |
| Live scores everywhere they appear | All tabs get real-time updates. One Realtime subscription powers all. | ✓        |
| Live tab only                      | Only Live tab gets real-time. Others use ISR.                         |          |
| Live tab + Bracket tab             | Real-time on Live and Bracket only.                                   |          |

**User's choice:** Live scores everywhere they appear

### Live Tab Visibility

| Option                        | Description                                              | Selected |
| ----------------------------- | -------------------------------------------------------- | -------- |
| Always show, with empty state | Tab always visible. Shows next upcoming game when empty. | ✓        |
| Hide when empty               | Tab only appears with active games.                      |          |
| You decide                    | Claude picks.                                            |          |

**User's choice:** Always show, with empty state

---

## QR Codes & Discovery

### QR Generation Location

| Option                                 | Description                                                 | Selected |
| -------------------------------------- | ----------------------------------------------------------- | -------- |
| Admin-side generation + public display | Admin generates, public displays. Admin can download/print. | ✓        |
| Public-side only                       | Auto-generated on public event page. No admin involvement.  |          |
| Admin-side only                        | Admin generates/distributes. Not on public site.            |          |

**User's choice:** Admin-side generation + public display

### Team QR Target

| Option                                 | Description                                                 | Selected |
| -------------------------------------- | ----------------------------------------------------------- | -------- |
| Team's filtered schedule + live scores | QR links to /e/[slug]?tab=schedule&view=team&team=[id].     | ✓        |
| Dedicated team page                    | QR links to /e/[slug]/team/[id]. More polished, more pages. |          |
| You decide                             | Claude picks simplest approach.                             |          |

**User's choice:** Team's filtered schedule + live scores

### Homepage Discovery

| Option                   | Description                                                        | Selected |
| ------------------------ | ------------------------------------------------------------------ | -------- |
| Search bar + event cards | Add search/filter bar to existing event cards. Client-side filter. | ✓        |
| QR scan landing page     | Prominent "Scan QR Code" button. Search secondary.                 |          |
| Both equally prominent   | Split homepage with search and QR scan.                            |          |

**User's choice:** Search bar + event cards

---

## Claude's Discretion

- Loading skeleton design for schedule views and bracket rendering
- Exact bracket CSS implementation (connector lines, spacing, matchup card sizing)
- ISR revalidation timing for bracket data
- QR code library choice
- Error state handling for failed Realtime connections
- Exact empty state illustrations/messages
- Database index strategy for bracket queries

## Deferred Ideas

- **Follow a team (with login):** Parents can follow a team with optional auth. New capability beyond view-only scope — future phase.
