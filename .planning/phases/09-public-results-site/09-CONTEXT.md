# Phase 9: Public Results Site - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the public-facing results site (`apps/public-results`) with live scores, schedules, standings, brackets, and team QR codes — no login required for parents and spectators. The skeleton app already exists with event listing, event detail page (Standings/Schedule/Results/Live tabs), game result cards, standings tables, ISR caching, and Supabase anon client.

</domain>

<decisions>
## Implementation Decisions

### Schedule Views (PUB-02)

- **D-01:** Three schedule views (By Team, By Field, By Time) presented as sub-tabs within the Schedule tab — toggle row below the main tab bar
- **D-02:** "By Team" view has a type-ahead search bar at top filtering teams, with a scrollable team list grouped by division below. Tapping a team shows only their games
- **D-03:** "By Field" view shows field cards with game timelines — each field gets a card showing all games on that field in time order, grouped by date
- **D-04:** "By Time" view is a grouped list by time slot (e.g., "9:00 AM", "10:30 AM") showing all fields/teams at that time — phone-friendly, no visual grid
- **D-05:** Multi-day navigation uses horizontal day tabs at the top of the schedule section (Day 1, Day 2, etc.) — tap to jump between days

### Tournament Brackets (PUB-04)

- **D-06:** Support both single-elimination AND double-elimination bracket formats — not just single-elimination
- **D-07:** Double-elimination renders winners bracket on top, losers bracket below (stacked vertically) — not side-by-side
- **D-08:** Bracket data modeled from scratch — new tables/columns for bracket rounds, matchups, seeds, and progression (not derived from games table)
- **D-09:** Bracket appears as a new "Bracket" tab alongside existing Standings/Schedule/Results/Live tabs — only visible when event has bracket data
- **D-10:** On mobile, bracket uses horizontal scroll with pinch-zoom — renders at readable size, users scroll/zoom as needed
- **D-11:** Live scores show in bracket matchup cards with real-time updates via the same Realtime subscription — in-progress bracket games show updating scores with green "Live" indicator

### Live Score Updates (PUB-07)

- **D-12:** Supabase Realtime subscription scoped to `event_id` for in-progress game rows only — not a global subscription, not per-visitor WebSocket for standings
- **D-13:** Score change animation: smooth number transition with brief green flash highlight on the card — subtle but noticeable, no sound
- **D-14:** Live scores update everywhere games appear — Schedule tab, Standings tab, Bracket tab, and Live tab all powered by one Realtime subscription
- **D-15:** Live tab always visible in the tab bar even when no games are live — shows "No games in progress" empty state with next upcoming game time
- **D-16:** Standings and completed results continue using ISR (revalidate 30s for standings, 60s for results) per roadmap scope notes — Realtime reserved for in-progress games only

### QR Codes & Discovery (PUB-05, PUB-06)

- **D-17:** QR codes generated from admin side AND displayed on the public event page — admin can download/print, parents can share
- **D-18:** Team QR code links to `/e/[slug]?tab=schedule&view=team&team=[id]` — parent lands directly on their team's filtered schedule with live scores
- **D-19:** Homepage parent discovery uses a search/filter bar at the top filtering events by name or location — client-side filter on pre-loaded event list (no new API endpoint per scope notes)
- **D-20:** Event QR code links to `/e/[slug]` — direct to event overview page

### Claude's Discretion

- Loading skeleton design for schedule views and bracket rendering
- Exact bracket CSS implementation (connector lines, spacing, matchup card sizing)
- ISR revalidation timing for bracket data
- QR code library choice (e.g., qrcode.react or similar)
- Error state handling for failed Realtime connections
- Exact empty state illustrations/messages
- Database index strategy for bracket queries

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above and ROADMAP.md/REQUIREMENTS.md.

### Roadmap & Requirements

- `.planning/ROADMAP.md` — Phase 9 section with full success criteria (8 items), scope notes (Realtime connection limits, COPPA/privacy, deployment, DB indexes)
- `.planning/REQUIREMENTS.md` — PUB-01 through PUB-08 requirement definitions

### Existing Skeleton (read before building)

- `apps/public-results/src/app/page.tsx` — Homepage with event cards, ISR at 60s
- `apps/public-results/src/app/e/[slug]/page.tsx` — Event detail page with Standings/Schedule/Results/Live tabs, division filter, game cards, standings table
- `apps/public-results/src/lib/data.ts` — Data layer: getPublicEvents, getPublicGames, getPublicTeams, computeStandings
- `apps/public-results/src/lib/supabase.ts` — Singleton anon Supabase client

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **Event detail page** (`apps/public-results/src/app/e/[slug]/page.tsx`): Full tab system, division filter, StatPill, GameResultCard, Empty component — all reusable as-is or with minor extensions
- **Data layer** (`apps/public-results/src/lib/data.ts`): PublicEvent, PublicGame, PublicTeam, Standing types + query functions — extend with bracket queries
- **computeStandings()**: Pure function for standings calculation — already works, no changes needed
- **Design system tokens**: `bg-[#081428]`, `border-[#1a2d50]`, `text-[#5a6e9a]`, `font-cond`, `text-green-400` for live, `text-blue-400` for scheduled — all established
- **groupBy utility**: Generic groupBy function already in event page — reusable for schedule view grouping

### Established Patterns

- **ISR with revalidate**: Pages use `export const revalidate = N` for incremental static regeneration
- **Server Components**: Pages are async server components fetching data at render time
- **Tab navigation via URL params**: `?tab=standings&div=ALL` pattern already in place — extend with `&view=team&team=123` for schedule sub-views
- **Supabase anon client**: Read-only singleton client using `NEXT_PUBLIC_*` env vars
- **Dark navy theme**: Consistent across all existing components — no light mode

### Integration Points

- **Supabase Realtime**: New client-side subscription for live scores — needs a client component wrapper around server-rendered game cards
- **Bracket data model**: New tables in Supabase (`bracket_rounds`, `bracket_matchups` or similar) — needs migration
- **QR code generation**: Admin app needs QR generation UI; public app displays QR codes on event page
- **Separate Vercel deployment**: `apps/public-results` deploys as separate Vercel project pointing to same GitHub repo with different root directory

</code_context>

<specifics>
## Specific Ideas

- User wants a "follow a team" feature requiring optional login — deferred (see below), but the team QR code and URL param filtering provide the core "find my team fast" experience without auth
- Bracket must support double-elimination, not just single-elimination — this is more complex than the roadmap originally scoped
- Parent discovery is client-side filter (per scope notes) — not a new API endpoint

</specifics>

<deferred>
## Deferred Ideas

- **Follow a team (with login):** User wants parents to be able to follow a team, requiring optional auth on the public site. This is a new capability beyond view-only scope — belongs in a future phase or Phase 10 extension. The team QR code / URL param filtering gives the core "find my team" UX without auth.

</deferred>

---

_Phase: 09-public-results-site_
_Context gathered: 2026-03-24_
