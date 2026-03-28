---
status: draft
phase: '09'
phase_name: Public Results Site
created: 2026-03-24
tool: none
shadcn_initialized: false
---

# UI-SPEC: Phase 9 — Public Results Site

**Scope:** Visual and interaction contract for the `apps/public-results` Next.js app — homepage, event detail, schedule sub-views, bracket tab, live scores client, and QR code display. No login required. No player names (COPPA). Dark navy theme only.

---

## 1. Design System

**Tool:** None — manual Tailwind CSS tokens. No shadcn/ui. The `apps/public-results` app is a standalone Next.js app with its own `tailwind.config.js` (distinct from the admin app root config).

**Source:** Tokens extracted from `apps/public-results/src/app/e/[slug]/page.tsx`, `app/layout.tsx`, and root `tailwind.config.js`.

No shadcn gate applies — this is not a React/Next.js app with an interactive admin UI; it is a public read-only display site with established tokens.

---

## 2. Spacing Scale

**Scale:** 4-point base, 8-point standard increments. All values are multiples of 4.

| Token | px   | Usage                                                   |
| ----- | ---- | ------------------------------------------------------- |
| 1     | 4px  | Internal micro-gaps (dot indicators, tight leading)     |
| 2     | 8px  | Component internal padding (pill padding, icon gap)     |
| 3     | 12px | Card internal padding compact                           |
| 4     | 16px | Card padding standard (px-4)                            |
| 5     | 20px | Section vertical gap (space-y-5)                        |
| 6     | 24px | Section separation (space-y-6)                          |
| 8     | 32px | Content area padding-top (py-6 = 24px, max section gap) |
| 20    | 80px | Empty state vertical padding (py-20)                    |

**Touch targets:** Minimum 44px tall for all interactive tab links and day navigation buttons. Use `py-3` (12px top + bottom) plus content height to reach 44px minimum.

**Sub-view toggle buttons:** Use `py-2` (8px top + bottom) for the compact toggle row between tab bar and day navigation.

**Container:** `max-w-5xl mx-auto px-4` — fixed across all pages. No wider containers.

---

## 3. Typography

**Font families (established in layout):**

- `font-cond` = Barlow Condensed — all labels, headings, navigation, status text
- `font-mono` = Roboto Mono — all scores, stats, tabular numbers
- `font-sans` = Barlow — body copy only (rarely used on this site)

**Type scale — exactly 4 sizes:**

| Role                       | Size | Weight     | Font      | Line-Height | Tracking         | Usage                                                                                                              |
| -------------------------- | ---- | ---------- | --------- | ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Score / Stat large         | 18px | 700 (bold) | font-mono | 1.2         | —                | GameResultCard scores, StatPill values, schedule inline scores                                                     |
| Body / Card label          | 14px | 700 (bold) | font-cond | 1.4         | —                | Team names in GameResultCard, selected team header in ByTeamView, field name headers in ByFieldView                |
| Body small / Section label | 12px | 700 (bold) | font-cond | 1.4         | tracking-[.12em] | Team name in bracket card, event location, time group labels, round labels, format labels, status badges           |
| Micro label                | 10px | 700 (bold) | font-cond | 1.2         | tracking-[.15em] | Division group headings, field name under time, column headers, QR caption, seed numbers, tab labels, footer brand |

**All label text (12px and 10px roles):** UPPERCASE always. No mixed-case labels.

**Weights in use:** 400 (regular) and 700 (bold) only. Two weights total.

- `font-bold` (700) — all headings, labels, scores, team names, status badges
- `font-normal` (400) — body descriptors, secondary/muted text (event location text, association text, event page descriptors)

> Note: The existing codebase uses `font-black` (900) for uppercase label text. During implementation, replace all `font-black` and `font-[900]` occurrences in this phase's new components with `font-bold`. Do not change weight in unmodified existing components (ScheduleSection, StandingsSection, GameResultCard) unless they are being restructured as part of this phase.

---

## 4. Color Contract

**Theme:** Dark navy only. No light mode. No toggle.

### Focal Point

**Primary visual anchor:** GameResultCard score numerals (`font-mono text-[18px] font-bold`) on the Results and Live tabs. EventCard name text (`font-cond text-[14px] font-bold text-white`) on the Homepage. These are the dominant focal elements that draw the viewer's eye first within each primary view.

### 60 / 30 / 10 Split

| Role                        | Hex       | Tailwind                  | Usage                                                                                     |
| --------------------------- | --------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| **60% — Surface**           | `#020810` | `bg-surface` / direct hex | Page background, `<body>`                                                                 |
| **30% — Secondary surface** | `#081428` | `bg-[#081428]`            | Cards, event header, game rows, standings table, empty states                             |
| **10% — Accent**            | `#0B3D91` | `bg-[#0B3D91]` (navy)     | Active tab underline, active division filter pill background, hover border on event cards |

### Semantic Colors (reserved for specific states — do not generalize)

| Color                | Hex       | Tailwind          | Reserved For                                                                                                                                                                        |
| -------------------- | --------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live / Win green** | `#4ade80` | `text-green-400`  | Live game status text, win-indicator dot, Live tab count text when > 0, W column in standings, positive GD, in-progress score numerals, "Live" badge in bracket, animated pulse dot |
| **Scheduled blue**   | `#60a5fa` | `text-blue-400`   | "Scheduled" status text, event card name hover                                                                                                                                      |
| **Loss red**         | `#f87171` | `text-red-400`    | L column in standings                                                                                                                                                               |
| **Tie yellow**       | `#facc15` | `text-yellow-400` | T column in standings                                                                                                                                                               |
| **Brand red accent** | `#D62828` | `bg-[#D62828]`    | Header brand stripe (1px left border of wordmark) only — not used in content area                                                                                                   |
| **Muted / tertiary** | `#5a6e9a` | `text-[#5a6e9a]`  | All secondary text: field names, dates, division labels, association, empty states, tab inactive, column headers                                                                    |

### Border

| Role             | Hex                   | Usage                                                                             |
| ---------------- | --------------------- | --------------------------------------------------------------------------------- |
| Default border   | `#1a2d50`             | All card borders, table row dividers, tab bar bottom border, header/footer border |
| Live card border | `border-green-400/30` | Game cards that are in-progress (30% opacity green)                               |

### Score Flash Animation (D-13)

When a score updates via Realtime: apply `bg-green-400/20` background flash for 600ms via a CSS transition on the score numeral container. Use a `scoreFlash` CSS keyframe: opacity 0.2 → 0 over 600ms. Class added to score `<span>` on update, removed after animation completes.

```css
@keyframes scoreFlash {
  0% {
    background-color: rgba(74, 222, 128, 0.25);
  }
  100% {
    background-color: transparent;
  }
}
.score-flash {
  animation: scoreFlash 600ms ease-out forwards;
  border-radius: 4px;
  padding: 0 2px;
}
```

---

## 5. Component Inventory

All components listed here match the architecture from RESEARCH.md. Use exact class patterns from existing components as the baseline — only extend, never diverge.

### 5.1 Existing — Extend in Place

| Component        | File                    | Extension Required                                                     |
| ---------------- | ----------------------- | ---------------------------------------------------------------------- |
| EventCard        | `app/page.tsx`          | Wrap grid with `EventSearchFilter` client island for PUB-06 search     |
| GameResultCard   | `app/e/[slug]/page.tsx` | Add `scoreFlash` animation class toggle; no structural change          |
| StandingsSection | `app/e/[slug]/page.tsx` | None — use as-is                                                       |
| ScheduleSection  | `app/e/[slug]/page.tsx` | Replace with `ScheduleTabWithSubViews` (see §5.2)                      |
| LiveSection      | `app/e/[slug]/page.tsx` | Wrap with `LiveScoresClient` for Realtime; add "next game" empty state |
| Tab bar          | `app/e/[slug]/page.tsx` | Add "Bracket" tab (conditional on event having bracket data)           |
| Empty            | `app/e/[slug]/page.tsx` | None — use as-is                                                       |
| StatPill         | `app/e/[slug]/page.tsx` | None — use as-is                                                       |
| groupBy          | `app/e/[slug]/page.tsx` | Extract to `lib/utils.ts` for reuse across schedule sub-views          |

### 5.2 New Components

#### EventSearchFilter (client island)

```
Location: apps/public-results/src/components/EventSearchFilter.tsx
Type: 'use client'
```

- `<input>` with `placeholder="Search events or locations..."` in Barlow Condensed 12px, `text-white bg-[#081428] border border-[#1a2d50] rounded-lg px-3 py-2` — full width on mobile, max-w-sm on desktop
- Filters pre-loaded event list client-side (no API call)
- Filters on `event.name` and `event.location` (case-insensitive substring match)
- Clear button (`×`) appears when input has text — `text-[#5a6e9a] hover:text-white`
- No debounce needed (client-side array filter is instant)
- "No events match your search." empty state inside search results area (same Empty style)

#### ScheduleTabWithSubViews

```
Location: apps/public-results/src/components/schedule/ScheduleTabWithSubViews.tsx
Type: server component (reads searchParams passed from page)
```

Sub-view toggle row (D-01):

- Row: `flex items-center gap-1 mt-3 mb-4` below main tab bar
- Toggle buttons rendered as `<Link>` (not `<button>`) for shareability
- Active: `bg-[#0B3D91] text-white rounded-md px-3 py-2`
- Inactive: `text-[#5a6e9a] hover:text-white rounded-md px-3 py-2 transition-colors`
- Font: `font-cond text-[10px] font-bold tracking-[.1em] uppercase`
- Labels: "By Team" · "By Field" · "By Time"

Day navigation tabs (D-05):

- Row: `flex items-center gap-1 overflow-x-auto pb-1 mb-4 no-scrollbar`
- Each day: `<Link>` rendered as pill — same active/inactive style as toggle
- Labels: "Day 1", "Day 2", "Day 3" (derived from `event_dates` sorted chronologically)
- On mobile: horizontal scroll if more than 3 days, no truncation

#### ByTeamView (D-02)

```
Location: apps/public-results/src/components/schedule/ByTeamView.tsx
Type: server component
```

- Team type-ahead: `<input>` client island (inline `'use client'` wrapper or small island component)
- Type-ahead filters team list as user types — no server round-trip
- Team list: scrollable `<div className="space-y-1">` with division group headings
- Division group heading: `font-cond text-[10px] font-bold tracking-[.15em] text-[#5a6e9a] uppercase` (matches existing pattern)
- Team row: `bg-[#081428] border border-[#1a2d50] rounded-lg px-3 py-3` — clicking navigates to `?tab=schedule&view=team&team=[id]`
- Selected team header: team name in `font-cond text-[14px] font-bold text-white` + back link
- Game list: reuse existing game row pattern from ScheduleSection

#### ByFieldView (D-03)

```
Location: apps/public-results/src/components/schedule/ByFieldView.tsx
Type: server component
```

- One card per field: `bg-[#081428] border border-[#1a2d50] rounded-xl p-4`
- Field name header: `font-cond text-[12px] font-bold text-white` + game count badge in muted
- Games listed vertically in time order within field card — reuse game row inner layout
- Games separated by `border-b border-[#1a2d50]/40` dividers
- Empty field card (no games for selected day): not rendered — only fields with games appear

#### ByTimeView (D-04)

```
Location: apps/public-results/src/components/schedule/ByTimeView.tsx
Type: server component
```

- Group heading: `font-cond text-[12px] font-bold tracking-[.12em] text-[#5a6e9a] uppercase mb-2` — time slot label (e.g., "9:00 AM")
- Game rows under each time group: compact two-line layout (home team / away team with score)
- Field name shown as secondary line: `font-cond text-[10px] text-[#5a6e9a]` below division
- Layout: `space-y-6` between time groups, `space-y-2` within group

#### BracketTab container

```
Location: apps/public-results/src/components/bracket/BracketTab.tsx
Type: server component (data from page)
```

- Only rendered when `event.has_bracket === true` (or bracket data non-empty)
- Shows format label: "Single Elimination" or "Double Elimination" — `font-cond text-[10px] font-bold tracking-[.15em] text-[#5a6e9a] uppercase mb-4`
- Double-elimination: `<DoubleEliminationBracket>` (winners bracket on top, `mb-8` gap, then losers bracket)
- Single-elimination: `<SingleEliminationBracket>`
- Mobile scroll wrapper (D-10): `<div className="overflow-x-auto -mx-4 px-4">` — enables horizontal scroll + pinch-zoom at OS level

#### SingleEliminationBracket

```
Location: apps/public-results/src/components/bracket/SingleEliminationBracket.tsx
Type: server component (pure rendering)
```

- Layout: CSS flexbox row of round columns — `flex items-start gap-0`
- Each round column: `flex flex-col` with `justify-around` spacing determined by round depth (2^n spacing)
- Minimum rendered width: `min-w-[640px]` (ensures readability before horizontal scroll kicks in)
- Round label: `font-cond text-[10px] font-bold tracking-[.15em] text-[#5a6e9a] uppercase text-center mb-3`

#### DoubleEliminationBracket

```
Location: apps/public-results/src/components/bracket/DoubleEliminationBracket.tsx
Type: server component
```

- Stacked vertically (D-07): winners bracket first, then `<div className="mt-8 pt-8 border-t border-[#1a2d50]">` separator with "Losers Bracket" label, then grand final below losers
- Each bracket section uses same column/row layout as `SingleEliminationBracket`
- Minimum width: `min-w-[820px]` (double-elim is wider)

#### BracketMatchupCard

```
Location: apps/public-results/src/components/bracket/BracketMatchupCard.tsx
Type: server component (receives liveGames as prop for score overlay)
```

- Size: `w-40` (160px) fixed width, variable height
- Background: `bg-[#081428] border border-[#1a2d50] rounded-lg overflow-hidden`
- Team slot: two rows, each `px-3 py-2 border-b border-[#1a2d50]/50 last:border-0`
- Team name: `font-cond text-[12px] font-bold text-white truncate` — `text-[#5a6e9a]` for TBD seed
- Score: `font-mono text-[18px] font-bold text-white tabular-nums` — right-aligned
- Winner highlight: `bg-[#0B3D91]/20` background on winning team row
- Live indicator: `text-green-400` score + left border `border-l-2 border-green-400` on card when live (D-11)
- Connector lines: `border-r border-[#1a2d50]` right edge of card + `border-t border-[#1a2d50]` connecting to next round — pure CSS, no SVG
- Seed number: `font-cond text-[10px] text-[#5a6e9a] mr-1` prepended to team name slot

#### LiveScoresClient

```
Location: apps/public-results/src/app/e/[slug]/LiveScoresClient.tsx
Type: 'use client'
```

- Render props pattern: `children: (liveGames: PublicGame[]) => React.ReactNode`
- One Supabase Realtime channel per event page — `live-scores-{eventId}`
- Channel filter: `event_id=eq.{eventId}` on `games` table UPDATE events
- Error state: if channel subscription fails to connect within 5 seconds, render `<ConnectionErrorBanner>` (see §5.3)
- Score flash: when `setLiveGames` fires on a score change, add `score-flash` class to the affected score `<span>` via a `flashingScoreIds` state set

#### EventQRCode

```
Location: apps/public-results/src/components/EventQRCode.tsx
Type: 'use client' (qrcode.react requires browser)
```

- Uses `QRCodeSVG` from `qrcode.react`
- Dark theme: `fgColor="#FFFFFF"` (white QR modules) on `bgColor="#081428"` — consistent with existing admin QR pattern of black-on-white, but inverted for dark display. NOTE: for printable/scannable reliability, admin-side QR codes remain black-on-white (SVG download). Public display QR uses white-on-dark.
- Size: 128×128 for team QR inline on event page; 200×200 for event-level QR
- Caption below QR: `font-cond text-[10px] text-[#5a6e9a] text-center mt-2 uppercase tracking-wide` — "Scan to share" or team name
- Placed in event header card alongside StatPills; displayed in a `details`/expand pattern on mobile to not crowd header

### 5.3 Utility / Feedback Components

#### ConnectionErrorBanner

```
Rendered by: LiveScoresClient on subscription failure
```

- `bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-4 py-2`
- Text: `font-cond text-[10px] font-bold text-yellow-400 uppercase tracking-[.1em]` — "Live scores unavailable — reload to retry"
- Non-blocking: page content still renders; only this banner indicates degraded state
- Auto-dismiss: not auto-dismissed — stays visible until page reload

#### Loading skeleton (Claude's discretion)

Used for schedule sub-view content while day changes load (URL param navigation):

- Skeleton rows: `bg-[#1a2d50]/40 rounded-lg animate-pulse` at `h-14` height
- 4 skeleton rows shown
- Visible during Next.js navigation when `loading.tsx` is active (add `loading.tsx` to `e/[slug]/` route segment)

---

## 6. Layout & Responsive Behavior

**Container:** `max-w-5xl mx-auto px-4` — all pages. Fixed.

**Page structure:**

```
<header>  bg-[#081428] border-b border-[#1a2d50] — height 48px
<main>    max-w-5xl mx-auto px-4 py-6
<footer>  border-t border-[#1a2d50] mt-12 — "Powered by LeagueOps"
```

**Responsive breakpoints (Tailwind defaults):**

| Breakpoint       | Width   | Behavior                                                                |
| ---------------- | ------- | ----------------------------------------------------------------------- |
| default (mobile) | 0–639px | Single column, full-width cards, horizontal scroll for bracket/day tabs |
| sm               | 640px+  | Event grid 2-column (`grid-cols-2`)                                     |
| lg               | 1024px+ | Event grid 3-column (`grid-cols-3`)                                     |

**PUB-08 Mobile constraints:**

- No horizontal scrolling except: (a) bracket container (explicit `overflow-x-auto`, D-10), (b) day tabs row (if > 3 days)
- All schedule views (By Team, By Field, By Time) fit in single column at 375px
- Tab bar wraps via `flex-wrap` if > 5 tabs — never clips off-screen
- Game rows use `flex items-center gap-4` with `min-w-0` + `truncate` on team names

**Grid for standings table:** Table uses fixed column widths via `w-` classes; `px-2` on stat columns; `px-4` on Team column. Table container has `overflow-x-auto` to handle very small screens.

---

## 7. Navigation & Interaction Patterns

### Tab Navigation (established pattern — extend only)

URL pattern: `?tab=standings|schedule|results|live|bracket`

Active tab indicator: `h-[2px] bg-[#0B3D91]` absolutely positioned bottom of tab link.

Bracket tab: only rendered when `event.has_bracket === true`. Hidden otherwise — do not render a disabled/greyed tab.

### Schedule Sub-View Navigation (D-01)

URL pattern: `?tab=schedule&view=team|field|time&day=1&team=[id]`

Default: `view=team`, `day=1`. When `?view=team&team=[id]` is present, render single-team filtered view.

Sub-view toggle: row of `<Link>` components (shareable — not client-side buttons). Located between main tab bar and day navigation.

Day navigation: horizontal `<Link>` pill row, scrollable. `Day 1` = first `event_dates` row by `sort_order`. Active day: `bg-[#0B3D91] text-white`.

### Team type-ahead (D-02)

- Implemented as a client component wrapping the team list in ByTeamView
- Input: `autoFocus` when By Team view is active, `type="search"`, `aria-label="Search teams"`
- Filter logic: `team.name.toLowerCase().includes(query.toLowerCase())` — plain substring
- When `searchParams.team` is present (deep-link from QR code), skip search UI and render team's games directly with a "← All Teams" back link

### QR Code Sharing (D-18, D-20)

- Team QR URL: `{NEXT_PUBLIC_PUBLIC_RESULTS_URL}/e/[slug]?tab=schedule&view=team&team=[id]`
- Event QR URL: `{NEXT_PUBLIC_PUBLIC_RESULTS_URL}/e/[slug]`
- Display: collapsible `<details>` element on mobile ("Show QR Code" summary), expanded by default on desktop (`lg:block`)

---

## 8. Copywriting Contract

### CTAs

| Context                           | Label                           |
| --------------------------------- | ------------------------------- |
| Homepage search input placeholder | "Search events or locations..." |
| Team search input placeholder     | "Search teams..."               |
| Event card link (aria-label)      | "View results for {event.name}" |
| QR expand toggle                  | "Show QR Code"                  |

### Empty States

| Screen                                    | Copy                                               |
| ----------------------------------------- | -------------------------------------------------- |
| Homepage — no events                      | "No events available"                              |
| Homepage — search returns nothing         | "No events match your search."                     |
| Schedule — no games for selected day/team | "No games scheduled for this selection."           |
| By Field — no fields with games           | "No games scheduled on this date."                 |
| Live tab — no in-progress games           | "No games in progress right now."                  |
| Live tab — next game info sub-line        | "Next game: {time} on {field}" (if data available) |
| Standings — no standings data             | "No standings data yet."                           |
| Results — no completed games              | "No completed games yet."                          |
| Bracket tab — no bracket data             | Not shown — tab is hidden when no bracket data     |

### Error States

| Context                                   | Copy                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Live scores connection failure            | "Live scores unavailable — reload to retry"                                        |
| Event page not found (Next.js notFound()) | (handled by Next.js default not-found.tsx — no custom copy required in this phase) |
| Supabase fetch error on homepage          | Silently falls back to empty events list — "No events available" shown             |

### Status Badges (exact strings — case matters)

| Status      | Display     | Color          |
| ----------- | ----------- | -------------- |
| `Live`      | "LIVE"      | text-green-400 |
| `Halftime`  | "HALFTIME"  | text-green-400 |
| `Final`     | "FINAL"     | text-[#5a6e9a] |
| `Scheduled` | "SCHEDULED" | text-blue-400  |
| `Cancelled` | "CANCELLED" | text-red-400   |

### Bracket / Results Labels

| Context                         | Copy                 |
| ------------------------------- | -------------------- |
| Winners bracket section heading | "Winners Bracket"    |
| Losers bracket section heading  | "Losers Bracket"     |
| Grand final section heading     | "Grand Final"        |
| TBD team slot                   | "TBD" in muted color |
| Seeding label format            | "#1", "#2" etc.      |
| Live indicator in bracket card  | "LIVE" (green-400)   |

---

## 9. Animation & Motion

| Element                        | Animation                                       | Duration                 | Trigger                                 |
| ------------------------------ | ----------------------------------------------- | ------------------------ | --------------------------------------- |
| Score flash on Realtime update | `scoreFlash` keyframe (green-400 fade)          | 600ms ease-out           | `setLiveGames` fires with changed score |
| Live pulse dot                 | `animate-pulse` (Tailwind built-in, 1.5s cubic) | Continuous               | Game in Live/Halftime status            |
| Tab hover                      | `transition-colors`                             | 150ms (Tailwind default) | hover                                   |
| Event card hover border        | `transition-colors`                             | 150ms                    | hover                                   |
| Loading skeleton               | `animate-pulse`                                 | 1.5s (Tailwind default)  | While skeleton visible                  |

No entrance animations (fade-in, slide-in) — not warranted for a data display site. Keep motion minimal.

---

## 10. Accessibility

| Requirement         | Implementation                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Semantic headings   | `<h1>` for event name, implicit section headings via `font-cond uppercase` divs (acceptable — not landmark headings) |
| Tab navigation aria | All `<Link>` tab items include visible text; active state communicated by visual underline + color                   |
| Live region         | `LiveScoresClient` wraps score updates in `aria-live="polite"` region so screen readers announce score changes       |
| Search input        | `aria-label="Search teams"` and `aria-label="Search events or locations"` on both search inputs                      |
| QR code alt         | `QRCodeSVG` receives `aria-label="QR code for {team.name} schedule"` via component props                             |
| Bracket cards       | Each `BracketMatchupCard` has implicit row semantics; use `aria-label="{home} vs {away}"` on card container          |
| Color-only state    | Win/loss status is communicated by both color (green-400/red-400) AND a text label ("W"/"L") — not color alone       |
| Minimum tap target  | 44px height on all interactive elements via `py-3` (12px) + content height                                           |

---

## 11. Registry

**shadcn:** Not initialized. Not applicable.

**Third-party registry:** None.

**Packages:**

- `qrcode.react@4.2.0` — add to `apps/public-results/package.json` (already in root admin app; verified clean — no network access, no env reads, standard QR generation only)

---

## 12. Pre-Population Sources

| Field                                                                | Source                                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Color tokens (`#081428`, `#1a2d50`, `#5a6e9a`, `#0B3D91`, `#D62828`) | Extracted from `app/e/[slug]/page.tsx` and `tailwind.config.js` (codebase)                               |
| Font families (font-cond, font-mono)                                 | `tailwind.config.js` + layout.tsx (codebase)                                                             |
| Type scale consolidated to 4 sizes (10px, 12px, 14px, 18px)          | Extracted from existing components; collapsed per checker revision (2026-03-24)                          |
| Score flash animation (D-13)                                         | CONTEXT.md decision                                                                                      |
| Live subscription — one channel per page                             | CONTEXT.md D-12, RESEARCH.md Pattern 1                                                                   |
| Schedule sub-view URL params                                         | CONTEXT.md D-01–D-05, RESEARCH.md Pattern 2                                                              |
| Bracket layout (stacked, D-07)                                       | CONTEXT.md decision                                                                                      |
| Bracket mobile horizontal scroll (D-10)                              | CONTEXT.md decision                                                                                      |
| Bracket conditional tab (D-09)                                       | CONTEXT.md decision                                                                                      |
| Live tab always visible (D-15)                                       | CONTEXT.md decision                                                                                      |
| ISR revalidate timings (30s/60s)                                     | REQUIREMENTS.md PUB-07, ROADMAP.md scope notes                                                           |
| No player names (COPPA)                                              | ROADMAP.md scope notes (Out of Scope table)                                                              |
| QR URLs (D-18, D-20)                                                 | CONTEXT.md decisions                                                                                     |
| Homepage search client-side filter (D-19)                            | CONTEXT.md + ROADMAP.md scope notes                                                                      |
| Loading skeleton design                                              | Claude's discretion (specified in CONTEXT.md as discretion area)                                         |
| ConnectionErrorBanner                                                | Claude's discretion (specified in CONTEXT.md as discretion area)                                         |
| Score flash CSS keyframe details                                     | Claude's discretion (D-13 stated "smooth green flash" — spec provides exact implementation)              |
| ISR for bracket data (revalidate 60s)                                | Claude's discretion (specified in CONTEXT.md as discretion area) — set to 60s matching completed results |

### Checker Revisions Applied (2026-03-24)

| Issue                            | Fix Applied                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| >4 font sizes declared           | Collapsed 9 sizes (9–18px) to 4 sizes: 10px, 12px, 14px, 18px. All component specs updated to use only these 4.                     |
| 3 font weights (400/700/900)     | Reduced to 2 weights: 400 (regular) and 700 (bold). All `font-black`/`font-[900]` replaced with `font-bold` in new component specs. |
| py-2.5 (10px) not multiple of 4  | Replaced with `py-3` (12px) in touch target spec and ByTeamView team row.                                                           |
| py-1.5 (6px) not multiple of 4   | Replaced with `py-2` (8px) in sub-view toggle button active/inactive styles.                                                        |
| No explicit focal point declared | Added focal point statement in §4 Color Contract: score numerals (Results/Live) and EventCard name (Homepage).                      |

---

## 13. Out of Scope (this phase)

Per CONTEXT.md `<deferred>` and REQUIREMENTS.md Out of Scope:

- "Follow a team" optional auth — deferred to future phase
- Player names or roster data — permanently excluded (COPPA)
- Per-visitor WebSocket for standings or results — ISR only
- Multi-language support — out of scope
- Native app features

---

_Phase: 09-public-results-site_
_UI-SPEC created: 2026-03-24_
_UI-SPEC revised: 2026-03-24 (checker revision — typography collapsed, spacing fixed, focal point added)_
_Status: draft — ready for checker validation_
