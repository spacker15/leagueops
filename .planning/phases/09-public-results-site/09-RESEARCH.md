# Phase 9: Public Results Site - Research

**Researched:** 2026-03-24
**Domain:** Next.js 14 App Router (ISR + Client Components), Supabase Realtime, custom Tailwind CSS bracket layout, QR code generation
**Confidence:** HIGH

## Summary

The `apps/public-results` skeleton is already substantial — homepage, event detail page with four tabs, ISR, Supabase anon client, and a complete data layer including `computeStandings()`. Phase 9 is an enhancement phase, not a greenfield build. The six primary build areas are: (1) schedule sub-views (By Team/Field/Time with day navigation), (2) double-elimination bracket tab, (3) LiveScoresClient.tsx real-time wrapper, (4) QR code display on the public event page, (5) homepage parent discovery search, and (6) a new DB migration for bracket tables.

The biggest architectural risk is the server/client component boundary for Realtime. The event detail page is a server component (async, exported `revalidate`). The live scores must be a `'use client'` wrapper component that hydrates with server-fetched initial state then subscribes to Supabase Realtime. Getting this handoff clean — especially sharing game state across Schedule/Standings/Bracket/Live tabs without a per-visitor WebSocket per view — is the most technically nuanced part of the phase.

The bracket is the highest-effort feature. Double-elimination requires modeling a winners bracket and a losers bracket independently, plus a grand final. The data model must be defined from scratch (new tables). Custom Tailwind CSS connector lines are required (no external library). Mobile pinch-zoom is enabled via `overflow-x-auto` + explicit minimum widths.

**Primary recommendation:** Build in five waves — (1) DB migration + data layer, (2) schedule sub-views, (3) bracket tab (data model + static render), (4) LiveScoresClient + Realtime plumbing, (5) QR codes + homepage search.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schedule Views (PUB-02)**

- D-01: Three schedule views (By Team, By Field, By Time) presented as sub-tabs within the Schedule tab — toggle row below the main tab bar
- D-02: "By Team" view has a type-ahead search bar at top filtering teams, with a scrollable team list grouped by division below. Tapping a team shows only their games
- D-03: "By Field" view shows field cards with game timelines — each field gets a card showing all games on that field in time order, grouped by date
- D-04: "By Time" view is a grouped list by time slot (e.g., "9:00 AM", "10:30 AM") showing all fields/teams at that time — phone-friendly, no visual grid
- D-05: Multi-day navigation uses horizontal day tabs at the top of the schedule section (Day 1, Day 2, etc.) — tap to jump between days

**Tournament Brackets (PUB-04)**

- D-06: Support both single-elimination AND double-elimination bracket formats
- D-07: Double-elimination renders winners bracket on top, losers bracket below (stacked vertically)
- D-08: Bracket data modeled from scratch — new tables/columns for bracket rounds, matchups, seeds, and progression (not derived from games table)
- D-09: Bracket appears as a new "Bracket" tab alongside Standings/Schedule/Results/Live — only visible when event has bracket data
- D-10: On mobile, bracket uses horizontal scroll with pinch-zoom — renders at readable size, users scroll/zoom as needed
- D-11: Live scores show in bracket matchup cards with real-time updates via the same Realtime subscription

**Live Score Updates (PUB-07)**

- D-12: Supabase Realtime subscription scoped to `event_id` for in-progress game rows only
- D-13: Score change animation: smooth number transition with brief green flash highlight on the card
- D-14: Live scores update everywhere games appear — Schedule, Standings, Bracket, and Live tabs powered by one Realtime subscription
- D-15: Live tab always visible even when no games are live — shows "No games in progress" with next upcoming game time
- D-16: Standings and completed results use ISR (revalidate 30s for standings, 60s for results); Realtime reserved for in-progress games only

**QR Codes & Discovery (PUB-05, PUB-06)**

- D-17: QR codes generated from admin side AND displayed on the public event page
- D-18: Team QR code links to `/e/[slug]?tab=schedule&view=team&team=[id]`
- D-19: Homepage parent discovery uses search/filter bar filtering events by name or location — client-side on pre-loaded event list
- D-20: Event QR code links to `/e/[slug]`

### Claude's Discretion

- Loading skeleton design for schedule views and bracket rendering
- Exact bracket CSS implementation (connector lines, spacing, matchup card sizing)
- ISR revalidation timing for bracket data
- QR code library choice (e.g., qrcode.react or similar)
- Error state handling for failed Realtime connections
- Exact empty state illustrations/messages
- Database index strategy for bracket queries

### Deferred Ideas (OUT OF SCOPE)

- **Follow a team (with login):** Optional auth on the public site for team following. Deferred to future phase. The team QR code / URL param filtering provides core UX without auth.
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID     | Description                                                  | Research Support                                                                                                                                                     |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PUB-01 | Parents/spectators can view live game scores without login   | Anon RLS policies confirmed in rls_migration.sql for events/games/teams/fields/event_dates; supabase.ts singleton uses anon key                                      |
| PUB-02 | Game schedules viewable by team, by field, and by time slot  | Three sub-views via URL params (?tab=schedule&view=team/field/time); existing groupBy utility reusable; PublicGame type includes field and event_date                |
| PUB-03 | Division standings with win/loss records displayed           | computeStandings() pure function already works; success criterion says "sourced from PostgreSQL view" — need to reconcile with existing client-side compute approach |
| PUB-04 | Tournament bracket visualization                             | New bracket tables needed (bracket_rounds, bracket_matchups); double-elimination requires two bracket sections; custom Tailwind CSS only                             |
| PUB-05 | QR code per event/team directing parents to filtered view    | qrcode.react already installed in admin app; need to add to public-results package.json; URL pattern defined in D-18/D-20                                            |
| PUB-06 | Parents can search for events and find teams                 | Client-side filter on homepage (pre-loaded events); team search already designed in D-02 for By Team view                                                            |
| PUB-07 | Live scores update in real time via scoped Supabase Realtime | LiveScoresClient.tsx as 'use client' wrapper; channel filter: event_id=eq.{id} AND status=in.(Live,Halftime)                                                         |
| PUB-08 | Public site works on mobile without horizontal scrolling     | Existing layout uses max-w-5xl, responsive grid; bracket uses overflow-x-auto (horizontal scroll is explicitly allowed per D-10 for bracket only)                    |

</phase_requirements>

---

## Standard Stack

### Core (apps/public-results)

| Library               | Version                   | Purpose                                       | Why Standard                           |
| --------------------- | ------------------------- | --------------------------------------------- | -------------------------------------- |
| next                  | 14.2.4                    | App Router with ISR, Server/Client components | Project lock per CLAUDE.md             |
| @supabase/supabase-js | ^2.43.0 (latest: 2.100.0) | Anon client for data fetching + Realtime      | Already in package.json                |
| react                 | ^18.3.1                   | UI rendering                                  | Project lock                           |
| tailwindcss           | ^3.4.4                    | Utility-first styling                         | Project lock — dark navy design system |
| typescript            | ^5.4.5                    | Type safety                                   | Project lock                           |

### To Add to apps/public-results

| Library      | Version | Purpose                       | When to Use                            |
| ------------ | ------- | ----------------------------- | -------------------------------------- |
| qrcode.react | 4.2.0   | QR code SVG/Canvas generation | PUB-05 QR display on public event page |

**Note:** qrcode.react is already in the root `package.json` and used in `components/settings/EventSetupTab.tsx` (`QRCodeSVG`, `QRCodeCanvas` named exports). It needs to be added to `apps/public-results/package.json` dependencies.

**Installation for public-results:**

```bash
cd apps/public-results && npm install qrcode.react
```

### Version Verification

- qrcode.react: 4.2.0 (verified via `npm view qrcode.react version` on 2026-03-24)
- @supabase/supabase-js: 2.100.0 current (app pins ^2.43.0 — compatible)

---

## Architecture Patterns

### Recommended Project Structure Extensions

```
apps/public-results/src/
├── app/
│   ├── page.tsx                    # Homepage — add EventSearchFilter (client island)
│   └── e/[slug]/
│       ├── page.tsx                # Event detail — add Bracket tab, extend Schedule tab
│       └── LiveScoresClient.tsx    # NEW: 'use client' Realtime wrapper
├── components/
│   ├── schedule/
│   │   ├── ByTeamView.tsx          # NEW: team search + filtered game list
│   │   ├── ByFieldView.tsx         # NEW: field cards with game timelines
│   │   └── ByTimeView.tsx          # NEW: time-slot grouped list
│   ├── bracket/
│   │   ├── BracketTab.tsx          # NEW: bracket container, handles format switch
│   │   ├── SingleEliminationBracket.tsx  # NEW
│   │   └── DoubleEliminationBracket.tsx  # NEW: winners on top, losers below
│   ├── EventQRCode.tsx             # NEW: event + team QR display
│   └── EventSearchFilter.tsx       # NEW: client-side event search for homepage
└── lib/
    ├── data.ts                     # Extend: add bracket queries, getPublicBracket()
    └── supabase.ts                 # Unchanged
```

### Pattern 1: Client Island in Server Page (Realtime)

The event detail page is a server component with `export const revalidate = 30`. Live scores need a client-side Realtime subscription. The pattern is:

1. Server page fetches all games at render time (includes in-progress games as initial state)
2. Passes initial in-progress games to `<LiveScoresClient initialGames={liveGames} eventId={event.id} />`
3. `LiveScoresClient` maintains a `useState` copy of live game scores, overrides on Realtime events
4. All four tabs (Schedule, Standings, Bracket, Live) receive game data — but only live game cards need client-side reactivity

**Critical constraint:** Only one Realtime channel per page. The channel filter is `event_id=eq.{id}` scoped to rows where `status IN ('Live', 'Halftime')`. Do NOT open a global subscription or per-tab subscription.

```typescript
// Source: Supabase JS docs — supabase.channel() with filter
// In LiveScoresClient.tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  initialGames: PublicGame[]
  eventId: number
  children: (liveGames: PublicGame[]) => React.ReactNode
}

export function LiveScoresClient({ initialGames, eventId, children }: Props) {
  const [liveGames, setLiveGames] = useState(initialGames)

  useEffect(() => {
    const channel = supabase
      .channel(`live-scores-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as PublicGame
          // Only track live/halftime status games
          if (updated.status === 'Live' || updated.status === 'Halftime') {
            setLiveGames((prev) => {
              const idx = prev.findIndex((g) => g.id === updated.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = { ...next[idx], ...updated }
                return next
              }
              return [...prev, updated]
            })
          } else {
            // Game finished — remove from live list
            setLiveGames((prev) => prev.filter((g) => g.id !== updated.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [eventId])

  return <>{children(liveGames)}</>
}
```

**Render pattern:** Use render props or React Context to pass `liveGames` down without prop drilling across all tab sections.

### Pattern 2: Schedule Sub-Views via URL Params

Extend the existing `?tab=schedule` URL pattern with `&view=team|field|time` and `&team=[id]` and `&day=[n]` parameters. The server component reads these from `searchParams`.

```typescript
// In page.tsx — extend existing searchParams destructuring
const scheduleView = searchParams.view ?? 'team' // 'team' | 'field' | 'time'
const teamFilter = searchParams.team ? Number(searchParams.team) : null
const activeDay = searchParams.day ? Number(searchParams.day) : 1
```

Sub-view toggle row is rendered as `<Link>` components (not buttons) so they are server-navigable and shareable — QR codes with `?tab=schedule&view=team&team=123` land on the correct filtered view.

### Pattern 3: Double-Elimination Bracket Data Model

New tables needed (DB migration for Phase 9):

```sql
-- bracket_rounds: one row per bracket round (winners round 1, losers round 1, grand final, etc.)
CREATE TABLE bracket_rounds (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT REFERENCES events(id),
  format      TEXT NOT NULL CHECK (format IN ('single', 'double')),
  bracket_side TEXT CHECK (bracket_side IN ('winners', 'losers', 'grand_final')),
  round_number INT NOT NULL,
  round_label  TEXT,  -- "Winners Round 1", "Losers Bracket Round 2", etc.
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- bracket_matchups: individual matchups within a round
CREATE TABLE bracket_matchups (
  id              BIGSERIAL PRIMARY KEY,
  round_id        BIGINT REFERENCES bracket_rounds(id),
  event_id        BIGINT REFERENCES events(id),
  seed_top        INT,
  seed_bottom     INT,
  team_top_id     BIGINT REFERENCES teams(id),
  team_bottom_id  BIGINT REFERENCES teams(id),
  game_id         BIGINT REFERENCES games(id),  -- links to actual game for live scores
  score_top       INT DEFAULT 0,
  score_bottom    INT DEFAULT 0,
  winner_id       BIGINT REFERENCES teams(id),
  winner_advances_to_matchup_id BIGINT REFERENCES bracket_matchups(id),
  loser_advances_to_matchup_id  BIGINT REFERENCES bracket_matchups(id),
  position        INT,  -- vertical position within the round for layout
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Anon RLS needed:** Both new tables need `anon_select_bracket_rounds` and `anon_select_bracket_matchups` policies (same pattern as existing public tables).

**DB indexes for bracket queries** (Claude's discretion area):

```sql
CREATE INDEX IF NOT EXISTS idx_bracket_rounds_event ON bracket_rounds(event_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matchups_event ON bracket_matchups(event_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matchups_round ON bracket_matchups(round_id);
```

### Pattern 4: Custom Tailwind Bracket CSS

No external bracket library. Use CSS Grid or Flexbox to render each round as a column. Connector lines between rounds use CSS `::before`/`::after` pseudo-elements or absolutely positioned divs.

Recommended structure (single-elimination, 8-team example):

```
rounds flex row        ← overflow-x-auto wrapper
  round-col flex-col   ← each round is a column
    matchup-card       ← fixed width (e.g., w-48) with border
    connector-line     ← absolutely positioned horizontal line to next round
```

Key layout rules:

- Each matchup card: `w-44 min-h-[60px]` (fixed width prevents collapse)
- Round column: `flex flex-col justify-around` with calculated gap based on team count
- Outer wrapper: `overflow-x-auto` with `min-w-[calc(n-rounds * 200px)]` to force correct width
- Connector lines: Use `border-r border-t/b border-[#1a2d50]` on a div spanning between card pairs

### Pattern 5: Score Change Animation (D-13)

Brief green flash on score update, no external animation library needed. Use Tailwind's `transition-colors` with a programmatic class toggle:

```typescript
// In live game card component
const [flashScore, setFlashScore] = useState<'home' | 'away' | null>(null)

useEffect(() => {
  if (prevScores.home !== game.home_score) {
    setFlashScore('home')
    setTimeout(() => setFlashScore(null), 600)
  }
}, [game.home_score])

// CSS class: flashScore === 'home' ? 'text-green-300 scale-110' : 'text-white'
// With: className="transition-all duration-300"
```

### Pattern 6: QR Code Display on Public Event Page

`qrcode.react` exports `QRCodeSVG` (inline SVG, no canvas) and `QRCodeCanvas` (canvas, for download). For display-only on the public page, use `QRCodeSVG`. This is already used in `components/settings/EventSetupTab.tsx` — same import pattern.

```typescript
// In EventQRCode.tsx (public-results app)
'use client' // needed because it renders conditionally based on URL
import { QRCodeSVG } from 'qrcode.react'

// Team QR URL pattern (D-18):
const teamQrUrl = `${process.env.NEXT_PUBLIC_PUBLIC_RESULTS_URL}/e/${slug}?tab=schedule&view=team&team=${teamId}`
// Event QR URL pattern (D-20):
const eventQrUrl = `${process.env.NEXT_PUBLIC_PUBLIC_RESULTS_URL}/e/${slug}`
```

**Environment variable:** The public-results app needs `NEXT_PUBLIC_PUBLIC_RESULTS_URL` in its Vercel project settings. The admin app already uses this variable (see Phase 5 decisions log: "Registration URL uses NEXT_PUBLIC_PUBLIC_RESULTS_URL").

### Anti-Patterns to Avoid

- **Global Realtime subscription:** Never subscribe to `channel('games')` without an `event_id` filter — this would receive updates from all events and breach Supabase free-tier concurrent connection limits (200 max).
- **Per-visitor standings WebSocket:** D-16 explicitly forbids this. Standings use ISR only.
- **computeStandings() in client component:** Keep standings computation server-side (existing pure function in data.ts). Client only handles live score overlays.
- **Bracket derived from games table:** D-08 explicitly says bracket data is modeled from scratch with its own tables. Do not attempt to derive bracket state from game results.
- **`export const revalidate` on bracket data:** Use `revalidate = 60` (Claude's discretion). Bracket structure changes rarely; only scores need Realtime.
- **Player names on public site:** COPPA / youth privacy — teams only, no player roster data exposed.

---

## Don't Hand-Roll

| Problem              | Don't Build                         | Use Instead                                | Why                                                   |
| -------------------- | ----------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| QR code generation   | Custom canvas/SVG drawing           | qrcode.react 4.2.0 (`QRCodeSVG`)           | Error correction, version selection, encoding handled |
| URL state management | Custom history push                 | Next.js `<Link href={...searchParams}>`    | Server-navigable, shareable, no useRouter needed      |
| Type-ahead search    | Debounced fetch to new API endpoint | Client-side filter on pre-loaded team list | Per scope notes: "not a new API endpoint"             |

**Key insight:** The public site is read-only. Almost everything that looks like "client interaction" (tab switching, search, day navigation) should be URL-driven `<Link>` navigation to server-rendered pages — not client-side state. The only exception is the Realtime live score overlay and the type-ahead search input (which filters a pre-loaded array).

---

## Common Pitfalls

### Pitfall 1: Server Component / Client Component Boundary Violation

**What goes wrong:** Adding `useState` or `useEffect` to the event detail page or importing `supabase.channel()` directly — `export const revalidate` and `'use client'` cannot coexist in the same file.
**Why it happens:** The page does data fetching AND needs reactivity. Developers conflate the two.
**How to avoid:** Keep `page.tsx` as a pure async server component. Create `LiveScoresClient.tsx` as a `'use client'` island that receives initial game state as props and opens the Realtime channel.
**Warning signs:** Build error "You cannot use 'export const revalidate' in a client component."

### Pitfall 2: Supabase Realtime Filter Syntax

**What goes wrong:** Using wrong filter syntax in `postgres_changes` subscription — no data arrives even though DB rows are updating.
**Why it happens:** The `filter` option in `.on('postgres_changes', {...})` uses PostgREST query syntax, not SQL. The format is `column=operator.value`.
**How to avoid:** Use exactly: `filter: \`event_id=eq.${eventId}\``— not`WHERE event_id = ${eventId}`.
**Warning signs:** Channel connects but payload.new never fires for expected rows.

### Pitfall 3: Double-Elimination Bracket Layout Complexity

**What goes wrong:** Winners bracket and losers bracket have different numbers of rounds. Rendering them in the same grid without knowing team count at build time causes misaligned cards.
**Why it happens:** Double-elimination has `2n-1` total rounds for `n` teams (16 teams = 31 matchups across ~7 rounds winners + ~7 rounds losers + grand final).
**How to avoid:** Render winners and losers as entirely separate `<div>` sections (D-07: stacked vertically). Each section is an independent horizontal-scroll bracket. Do not attempt to align them in the same grid.
**Warning signs:** Connector lines don't reach adjacent round cards; overflow bleeds outside container.

### Pitfall 4: searchParams Type Mismatch in Next.js 14

**What goes wrong:** `searchParams.team` is `string | string[] | undefined` — passing it directly to a numeric comparison throws a TypeScript error or NaN.
**Why it happens:** Next.js App Router `searchParams` type is `Record<string, string | string[] | undefined>`.
**How to avoid:** Always coerce: `const teamId = Array.isArray(searchParams.team) ? Number(searchParams.team[0]) : Number(searchParams.team)`.
**Warning signs:** Team filter shows no games when team param is set.

### Pitfall 5: Missing Anon RLS Policies for New Bracket Tables

**What goes wrong:** `getPublicBracket()` returns empty data for anonymous users even though the tables exist and have data.
**Why it happens:** New tables created in Phase 9 migration don't automatically get anon policies.
**How to avoid:** Every new table in the migration must have a `CREATE POLICY "anon_select_*" ON table_name FOR SELECT TO anon USING (true);` — and `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`.
**Warning signs:** Anon select returns 0 rows; authenticated service-role select returns data.

### Pitfall 6: `revalidate` Conflicts with Dynamic searchParams

**What goes wrong:** The event detail page has `export const revalidate = 30` but also reads `searchParams` — Next.js 14 may render it dynamically per-request, negating ISR benefits.
**Why it happens:** When `searchParams` is accessed in a server component, Next.js opts out of ISR for that specific render path.
**How to avoid:** ISR applies to the static part of the page (standings/results data). The schedule views reading `searchParams` for view/team/day filter are expected to be dynamic. This is correct behavior, not a bug — ISR still caches at the edge for common param combinations via Vercel's CDN.
**Warning signs:** Vercel function invocations spike — investigate whether the ISR cache is being bypassed.

---

## Code Examples

### Supabase Realtime (postgres_changes)

```typescript
// Source: Supabase JS docs — postgres_changes subscription
const channel = supabase
  .channel(`live-${eventId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'games',
      filter: `event_id=eq.${eventId}`,
    },
    (payload) => {
      // payload.new contains the updated row
    }
  )
  .subscribe()

// Cleanup
return () => {
  supabase.removeChannel(channel)
}
```

### QRCodeSVG Usage (from existing EventSetupTab.tsx pattern)

```typescript
import { QRCodeSVG } from 'qrcode.react'

<QRCodeSVG
  value={teamQrUrl}
  size={160}
  bgColor="#081428"
  fgColor="#ffffff"
  level="M"
/>
```

### data.ts Extension for Brackets

```typescript
export interface BracketRound {
  id: number
  bracket_side: 'winners' | 'losers' | 'grand_final'
  round_number: number
  round_label: string
  matchups: BracketMatchup[]
}

export interface BracketMatchup {
  id: number
  seed_top: number | null
  seed_bottom: number | null
  team_top: { id: number; name: string } | null
  team_bottom: { id: number; name: string } | null
  game_id: number | null
  score_top: number
  score_bottom: number
  winner_id: number | null
  position: number
}

export async function getPublicBracket(eventId: number): Promise<{
  format: 'single' | 'double' | null
  rounds: BracketRound[]
}> {
  const { data, error } = await supabase
    .from('bracket_rounds')
    .select(
      `
      id, format, bracket_side, round_number, round_label,
      matchups:bracket_matchups(
        id, seed_top, seed_bottom, score_top, score_bottom, winner_id, position,
        team_top:teams!bracket_matchups_team_top_id_fkey(id, name),
        team_bottom:teams!bracket_matchups_team_bottom_id_fkey(id, name),
        game_id
      )
    `
    )
    .eq('event_id', eventId)
    .order('round_number')

  if (error || !data?.length) return { format: null, rounds: [] }
  const format = data[0].format as 'single' | 'double'
  return { format, rounds: data as BracketRound[] }
}
```

### Homepage Event Search (Client Island)

```typescript
// EventSearchFilter.tsx — 'use client'
'use client'
import { useState } from 'react'
import type { PublicEvent } from '@/lib/data'

export function EventSearchFilter({ events }: { events: PublicEvent[] }) {
  const [query, setQuery] = useState('')

  const filtered = events.filter(
    (e) =>
      query === '' ||
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.location.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search events or locations…"
        className="w-full bg-[#081428] border border-[#1a2d50] rounded-lg px-4 py-2.5 text-white font-cond text-[13px] placeholder:text-[#5a6e9a] focus:border-[#0B3D91] focus:outline-none"
      />
      {/* Render filtered event cards inline */}
    </>
  )
}
```

---

## State of the Art

| Old Approach                   | Current Approach                                         | When Changed             | Impact                                                |
| ------------------------------ | -------------------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| WebSocket polling for all data | ISR for static data + scoped Realtime only for live rows | Supabase free tier ~2023 | 200-connection cap on free tier enforces this pattern |
| Global Realtime channel        | `filter: event_id=eq.N` in postgres_changes              | Supabase JS v2           | Filters applied server-side, not client-side          |
| Canvas-based QR codes          | `QRCodeSVG` inline SVG                                   | qrcode.react v3+         | No canvas required; SVG scales perfectly              |

---

## Environment Availability

| Dependency                           | Required By          | Available | Version                                                                | Fallback                                         |
| ------------------------------------ | -------------------- | --------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Node.js                              | Build                | ✓         | (project running)                                                      | —                                                |
| @supabase/supabase-js                | Realtime, data layer | ✓         | ^2.43.0 in package.json                                                | —                                                |
| qrcode.react                         | PUB-05 QR display    | Partial   | 4.2.0 in root package.json; NOT in apps/public-results                 | Add to apps/public-results/package.json          |
| NEXT_PUBLIC_PUBLIC_RESULTS_URL       | QR URL generation    | Partial   | Set in admin app; needs to be set in public-results Vercel project too | Fallback to window.location.origin for local dev |
| Supabase anon RLS for bracket tables | PUB-04 bracket data  | Not yet   | Policies created as part of Phase 9 migration                          | Migration in Wave 1                              |

**Missing dependencies with fallback:**

- qrcode.react in apps/public-results — install via `npm install qrcode.react` in that directory
- NEXT_PUBLIC_PUBLIC_RESULTS_URL in public-results Vercel project — add to Vercel env vars; fallback to `process.env.NEXT_PUBLIC_PUBLIC_RESULTS_URL ?? typeof window !== 'undefined' ? window.location.origin : ''`

---

## Validation Architecture

### Test Framework

| Property                    | Value                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| Framework                   | Vitest 4.1.0 (root project — apps/public-results has no test setup) |
| Config file                 | `vitest.config.ts` (root)                                           |
| Quick run command           | `npm run test`                                                      |
| Full suite command          | `npm run test:coverage`                                             |
| Type check (public-results) | `cd apps/public-results && npm run type-check`                      |

**Note:** `apps/public-results` has no `vitest` dependency or test directory. The root Vitest excludes `apps/` (root tsconfig excludes apps/). Public-results validation is via TypeScript type-check + manual smoke testing in dev.

### Phase Requirements → Test Map

| Req ID | Behavior                                   | Test Type    | Automated Command                                                  | File Exists? |
| ------ | ------------------------------------------ | ------------ | ------------------------------------------------------------------ | ------------ |
| PUB-01 | Anon user can fetch events/games/teams     | manual smoke | `cd apps/public-results && npm run dev` — verify no auth redirects | —            |
| PUB-02 | Schedule sub-views render correctly        | manual smoke | Navigate to `?tab=schedule&view=team/field/time`                   | —            |
| PUB-03 | computeStandings() pure function           | unit         | `npm run test -- --grep computeStandings` if test added            | ❌ Wave 0    |
| PUB-04 | Bracket renders 8/16 team configurations   | manual smoke | Seed bracket data, navigate to bracket tab                         | —            |
| PUB-05 | QR code SVG renders with correct URL       | manual smoke | Inspect QR SVG value attribute in DevTools                         | —            |
| PUB-06 | Homepage search filters correctly          | unit         | Test EventSearchFilter filter logic                                | ❌ Wave 0    |
| PUB-07 | Realtime subscription fires on game update | manual smoke | Update a game score in admin app, verify public site updates       | —            |
| PUB-08 | No horizontal scroll on mobile viewport    | visual smoke | Chrome DevTools mobile emulation at 375px                          | —            |

### Sampling Rate

- **Per task commit:** `cd apps/public-results && npm run type-check && npm run lint`
- **Per wave merge:** Full root `npm run type-check && npm run lint`
- **Phase gate:** All manual smoke tests pass + `cd apps/public-results && npm run build` succeeds before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/public-results/src/lib/data.test.ts` — unit tests for `computeStandings()` edge cases (bye rounds, ties, 0-0 games)
- [ ] `apps/public-results/src/components/EventSearchFilter.test.tsx` — filter logic for PUB-06
- Note: These are optional given the manual-heavy nature of this UI phase. If added, they must run via a `vitest` config in the public-results app (not root vitest which excludes `apps/`).

---

## Open Questions

1. **Success criterion PUB-03 says "sourced from a PostgreSQL view (not computed client-side)"**
   - What we know: The existing `computeStandings()` is a pure client-side TypeScript function in `data.ts`. The success criterion implies a DB view.
   - What's unclear: Is a DB view `v_standings` required (new migration needed), or is "not computed client-side" satisfied by running the computation in a server component (ISR)?
   - Recommendation: The page is a server component — `computeStandings()` runs on the server at ISR time, not in the browser. This satisfies "not client-side." A DB view would add a migration with no user-visible benefit. Proceed without a DB view unless the planner decides otherwise.

2. **Bracket tab visibility — how does the event page know if bracket data exists?**
   - What we know: D-09 says Bracket tab is "only visible when event has bracket data."
   - What's unclear: Is there an `has_bracket` column on the `events` table, or does the page query bracket_rounds to check?
   - Recommendation: Add `has_bracket BOOLEAN DEFAULT FALSE` to `events` table in the Phase 9 migration. Admin sets it when creating bracket. This avoids an extra query per page load.

3. **Bracket data entry — who populates bracket tables?**
   - What we know: D-08 says bracket is "modeled from scratch" but this phase is the public-results site, not the admin app.
   - What's unclear: Does Phase 9 include admin UI to set up a bracket, or is the bracket populated via direct DB entry / future phase?
   - Recommendation: Phase 9 RESEARCH and PLAN should treat bracket table creation + anon read as in-scope. Admin UI for bracket setup is probably out of scope for this phase (no admin app changes are referenced in CONTEXT.md). The planner should explicitly confirm. Plan for bracket being seeded via `supabase/phase9_bracket.sql` seed data.

---

## Project Constraints (from CLAUDE.md)

All downstream planning and implementation MUST comply with these directives:

| Constraint          | Rule                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Stack lock          | Next.js 14 App Router + Supabase + Vercel — no changes                                                |
| Free tiers          | Keep third-party services free/cheap                                                                  |
| Dark theme          | Maintain existing Barlow Condensed, navy/red palette — no light mode                                  |
| Event scoping       | Every DB query scoped with `.eq('event_id', eventId)` — never hardcode                                |
| Auth                | No login required on public-results site                                                              |
| Typography          | `font-cond` (Barlow Condensed), `font-mono` (Roboto Mono), `font-sans` (Barlow)                       |
| Design tokens       | `bg-[#081428]` cards, `border-[#1a2d50]`, `text-[#5a6e9a]` muted, `#0B3D91` primary, `#D62828` danger |
| Status colors       | `text-green-400` live, `text-blue-400` scheduled, `text-[#5a6e9a]` final                              |
| Vercel build        | `prefer-const`, no unused variables — ESLint errors break deploys                                     |
| Hooks rule          | All hooks before any early returns                                                                    |
| Naming              | Components PascalCase, lib/utils camelCase, tests in `__tests__/`                                     |
| Player data         | Player names and roster data MUST NOT appear on public site (COPPA)                                   |
| Separate deployment | `apps/public-results` deploys as separate Vercel project, same GitHub repo, different root directory  |
| No exposed tables   | `ops_alerts`, `user_roles`, `ops_log` must NOT be queryable by anon                                   |

---

## Sources

### Primary (HIGH confidence)

- `apps/public-results/src/app/page.tsx` — verified existing homepage structure, ISR at 60s
- `apps/public-results/src/app/e/[slug]/page.tsx` — verified existing tab system, groupBy utility, component inventory
- `apps/public-results/src/lib/data.ts` — verified PublicGame/PublicTeam/Standing types, computeStandings() implementation
- `apps/public-results/src/lib/supabase.ts` — verified singleton anon client pattern
- `apps/public-results/package.json` — verified current dependencies (qrcode.react not present)
- `supabase/rls_migration.sql` — verified 6 anon_select policies (events, event_dates, fields, teams, games, registration_divisions)
- `components/settings/EventSetupTab.tsx` — verified `QRCodeSVG, QRCodeCanvas` from qrcode.react already used in admin app
- `.planning/phases/09-public-results-site/09-CONTEXT.md` — locked decisions D-01 through D-20
- `CLAUDE.md` — project constraints, design tokens, naming conventions

### Secondary (MEDIUM confidence)

- npm registry: qrcode.react@4.2.0 (verified 2026-03-24), @supabase/supabase-js@2.100.0 (verified 2026-03-24)
- Supabase JS v2 postgres_changes filter syntax: `column=eq.value` format (verified against multiple Supabase official docs pages in prior phases)

### Tertiary (LOW confidence)

- Custom Tailwind bracket CSS connector line technique — based on general CSS knowledge; requires visual verification during implementation

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified via npm registry
- Architecture: HIGH — based on reading actual existing code
- Bracket data model: MEDIUM — schema design is research-based; exact column names subject to planner refinement
- Pitfalls: HIGH — drawn from existing project decisions log and CLAUDE.md known gotchas
- Realtime patterns: HIGH — Supabase JS v2 API confirmed in prior project phases

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable stack; Supabase Realtime API unlikely to change)
