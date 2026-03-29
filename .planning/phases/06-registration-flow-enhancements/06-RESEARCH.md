# Phase 6: Registration Flow Enhancements - Research

**Researched:** 2026-03-23
**Domain:** Registration wizard extensions, token-based invite flows, coach conflict detection engine, multi-date picker, schedule constraint integration
**Confidence:** HIGH

## Summary

Phase 6 builds on top of a mature, well-structured codebase. The five core sub-systems are: (1) registration wizard expansion in `RegisterPage.tsx`, (2) token-gated coach self-registration at `app/coach/[token]`, (3) a new `coach-conflicts.ts` engine following existing engine conventions, (4) registration window enforcement added to the events table and `/e/[slug]/register` route, and (5) program leader portal additions in `ProgramLeaderDashboard.tsx`. Every pattern required already exists elsewhere in the codebase — this phase is additive, not architecturally novel.

The token-based invite pattern is fully established via `app/join/[token]` + `app/api/join/route.ts`. The coach invite flow replicates this verbatim: new `coach_invites` table (separate from `registration_invites` to avoid type coupling), new `app/coach/[token]/page.tsx` server component, `app/coach/[token]/CoachClient.tsx` form, and `app/api/coach/route.ts` GET+POST. The `event_dates` table already exists in `schema.sql` — no migration needed for that table. The schema does need: `available_date_ids JSONB` on `team_registrations`; `registration_opens_at`, `registration_closes_at`, `registration_open` on `events`; and new `coaches`, `coach_invites`, `coach_conflicts` tables.

The coach-conflicts engine integrates into schedule generation by filtering matchups before slot assignment. The schedule engine already has a `filteredMatchups` step in `generateSchedule()` that calls `evaluateMatchupRules()` — the coach conflict engine adds a pre-filter pass on the same `allMatchups` array before that step.

**Primary recommendation:** Build in dependency order — schema migration first (Wave 0), then `coach-conflicts.ts` engine (pure TS, testable immediately), then wizard UI changes, then coach invite token flow, then schedule engine wiring. Each layer is independently testable.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Coach Registration UX**

- D-01: Expand existing Step 3 ("teams") in the registration wizard. Keep head coach fields, add an "Additional Coaches" section per team. Coach invite link generation is separate (in program leader portal, not during wizard).
- D-02: Coach self-registration follows existing `app/join/[token]` pattern — create `app/coach/[token]/page.tsx`. Simple form: name, email, phone, certifications text field, team dropdown (pre-filtered to program's teams). No account creation required.
- D-03: Coach info collected: name, email, phone, certifications (free text, e.g., "US Lacrosse Level 2").
- D-04: Expired/used coach invite links show friendly error page with event branding. No form displayed.

**Coach Invite Links**

- D-05: Program leaders generate coach invite links from their own portal dashboard (not admin-generated). Per-program link — coach selects team from dropdown during self-registration.
- D-06: Program leaders can revoke an existing invite link (deactivates token) and regenerate a new one. Simple toggle/button in coach section.
- D-07: Coach invite tokens expire at event's registration close date. When registration is manually toggled off, invites also become invalid.

**Coach Conflicts**

- D-08: Coach conflict detection runs on coach assignment — whenever a coach is added to a team (during wizard, coach self-registration, or admin manual add). Conflict flag written to DB immediately.
- D-09: Conflicts surfaced as warning badges in Command Center on affected teams. No inline warning during registration.
- D-10: Coach conflicts integrate with schedule generation as hard constraints. `lib/engines/coach-conflicts.ts` reads `coach_conflicts` table and provides constraints to schedule engine (same pattern as field conflicts).

**Team Availability Dates**

- D-11: Admin defines event schedule dates via multi-date picker in EventSetupTab General tab. Individual dates stored as records in `event_dates` table.
- D-12: Program leaders select per-team availability in Step 3 as checkbox list. "Available all dates" toggle at top (default ON). Stored as `available_date_ids` JSONB on `team_registrations`.

**Registration Window Enforcement**

- D-13: Add `registration_opens_at` (TIMESTAMPTZ) and `registration_closes_at` (TIMESTAMPTZ) columns to `events` table. Both nullable.
- D-14: Add manual `registration_open` BOOLEAN toggle to `events` table. Manual toggle takes precedence over dates.
- D-15: Registration date pickers and manual toggle live in the existing General tab of EventSetupTab.
- D-16: When registration is closed, `/e/[slug]/register` shows informational page with event branding. No form fields visible.
- D-17: Sharing tab shows green/red status badge ("Registration Open" / "Registration Closed") next to registration link.

**Multi-Team Registration**

- D-18: Add "Copy from Team 1" button for coach fields and availability dates across teams. Also add team count indicator ("Team 3 of 5").

**Program Leader Portal**

- D-19: Each team card/row in program leader dashboard gets a "Coaches" section with assigned coaches, coach count, "Generate Invite Link" button. Invite link copyable with QR code.
- D-20: Program leaders can see team availability selections and coach assignments in portal after registration.

### Claude's Discretion

- Database table design for `coaches`, `coach_teams`, `coach_invites`, `event_dates`, `coach_conflicts`
- Multi-date picker component choice (custom vs library)
- Exact styling of coach section in program leader portal
- QR code size for coach invite links
- Migration file naming and ordering
- Coach conflicts engine internal implementation details
- Whether to reuse existing `registration_invites` table pattern or create new `coach_invites` table

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                            | Research Support                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| REG-01 | Admin defines event schedule dates before registration opens                                           | `event_dates` table already exists in schema.sql — admin UI in EventSetupTab General tab; multi-date picker writes to this table                 |
| REG-02 | Program leader can select team availability during registration — all dates or specific dates per team | `available_date_ids JSONB` column added to `team_registrations`; Step 3 of `RegisterPage.tsx` extended with checkbox list                        |
| REG-03 | Program leader can add coaches directly to a team with name, email, phone, certifications              | Step 3 of wizard extended with "Additional Coaches" section; `coaches` + `coach_teams` tables capture the data                                   |
| REG-04 | System generates a unique coach self-registration link per program                                     | New `coach_invites` table with token; program leader portal generates via API; `crypto.randomUUID()` pattern from existing code                  |
| REG-05 | Coach can self-register via link — selects team, provides name, email, phone, certifications           | `app/coach/[token]/page.tsx` + `CoachClient.tsx`; mirrors `app/join/[token]` pattern exactly                                                     |
| REG-06 | System detects when same coach email is assigned to multiple teams and flags conflict                  | `coach-conflicts.ts` engine runs on every coach insertion; writes to `coach_conflicts` table; conflict detection by email match                  |
| REG-07 | Coach conflicts surfaced to admin during schedule generation as hard constraints                       | `coach-conflicts.ts` engine integrated into `generateSchedule()` in `lib/engines/schedule.ts`; reads `coach_conflicts` as pre-filter on matchups |
| REG-08 | Program leader can register one or many teams in a single registration session                         | `RegisterPage.tsx` already supports multi-team; D-18 adds "Copy from Team 1" and team counter improvements                                       |

</phase_requirements>

---

## Standard Stack

### Core

| Library             | Version  | Purpose                                | Why Standard                       |
| ------------------- | -------- | -------------------------------------- | ---------------------------------- |
| Next.js App Router  | 14.2.4   | Server components + API routes         | Locked — project constraint        |
| Supabase JS         | existing | DB, auth, storage                      | Locked — project constraint        |
| React               | 18.3.1   | UI rendering                           | Locked                             |
| TypeScript          | 5.4.5    | Type safety                            | Locked                             |
| Tailwind CSS        | 3.4.4    | Styling                                | Locked — dark theme established    |
| qrcode.react        | ^3.x     | QR code rendering for invite links     | Already installed (Phase 5)        |
| react-hot-toast     | 2.4.1    | User feedback toasts                   | Already installed, used throughout |
| date-fns            | 3.6.0    | Date arithmetic for window enforcement | Already installed                  |
| crypto.randomUUID() | native   | Token generation                       | Used in existing engines           |

### Supporting

| Library         | Version  | Purpose                          | When to Use    |
| --------------- | -------- | -------------------------------- | -------------- |
| lucide-react    | existing | Icons for coach/calendar UI      | All icon needs |
| @/components/ui | internal | Btn, Modal, FormField primitives | All form UI    |

### Alternatives Considered

| Instead of                | Could Use                                       | Tradeoff                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom multi-date picker  | react-day-picker or similar                     | Custom fits dark theme better; existing EventSetupTab doesn't use any date-picker library — building inline avoids new dependency                                                        |
| New `coach_invites` table | Extend `registration_invites` with type='coach' | Separate table cleaner: `registration_invites` is event-scoped; coach invites are program-scoped (not per-event per se); separate table avoids polluting existing token validation logic |

**Installation:** No new packages required. All dependencies already in package.json.

---

## Architecture Patterns

### Recommended Project Structure

New files this phase adds:

```
app/
├── coach/
│   └── [token]/
│       ├── page.tsx          # Server component — token validation
│       └── CoachClient.tsx   # Client form component
├── api/
│   └── coach/
│       └── route.ts          # GET (validate token) + POST (submit registration)

lib/
└── engines/
    └── coach-conflicts.ts    # Pure TS coach conflict engine

supabase/
└── phase6_registration.sql   # Single migration for all Phase 6 schema

__tests__/
└── lib/
    └── engines/
        └── coach-conflicts.test.ts
```

Modifications to existing files:

```
components/auth/RegisterPage.tsx        # Step 3: additional coaches + availability
components/settings/EventSetupTab.tsx   # General tab: registration window + dates
                                         # Sharing tab: registration status badge
components/programs/ProgramLeaderDashboard.tsx  # Coach section per team + invite link
lib/engines/schedule.ts                  # Wire coach conflict pre-filter into generateSchedule()
types/index.ts                           # New interface types for coaches, coach_invites, etc.
```

### Pattern 1: Token-Based Invite Flow (coach self-registration)

**What:** Server component validates token from DB, passes event context to client form. Client posts to API route. Token is single-use, marked is_used=true on successful submission.
**When to use:** All public, unauthenticated registration flows.

```typescript
// app/coach/[token]/page.tsx — mirrors app/join/[token]/page.tsx exactly
import { createClient } from '@/supabase/server'
import { CoachClient } from './CoachClient'

export default async function CoachPage({ params }: { params: { token: string } }) {
  const sb = createClient()

  const { data: invite } = await sb
    .from('coach_invites')
    .select(`
      program_id, event_id, is_active, expires_at,
      programs(name),
      events(name, primary_color, logo_url, registration_closes_at, registration_open)
    `)
    .eq('token', params.token)
    .single()

  // Check: missing, inactive, or expired
  const now = new Date()
  const isExpired = invite?.expires_at ? new Date(invite.expires_at) < now : false
  const regClosed = invite?.events
    ? (invite.events as any).registration_open === false
    : false

  if (!invite || !invite.is_active || isExpired || regClosed) {
    return <ExpiredPage event={invite?.events} />
  }

  // Load teams for this program+event so coach can select team
  const { data: teams } = await sb
    .from('team_registrations')
    .select('id, team_name, division')
    .eq('program_id', invite.program_id)
    .eq('event_id', invite.event_id)
    .eq('status', 'approved')

  return (
    <CoachClient
      token={params.token}
      programId={invite.program_id}
      eventName={(invite.events as any)?.name ?? 'Event'}
      primaryColor={(invite.events as any)?.primary_color ?? '#0B3D91'}
      logoUrl={(invite.events as any)?.logo_url ?? null}
      teams={teams ?? []}
    />
  )
}
```

### Pattern 2: Coach Conflicts Engine

**What:** Pure TypeScript engine following existing engine signature. Accepts `eventId` + injected Supabase client. Queries `coaches`, `coach_teams`, returns conflicting team-pair arrays. Called at assignment time to write to `coach_conflicts` table.
**When to use:** On every coach assignment (wizard submission, self-registration POST, admin add). Also called by schedule engine to load hard constraints.

```typescript
// lib/engines/coach-conflicts.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CoachConflict {
  coach_id: number
  coach_email: string
  coach_name: string
  team_ids: number[] // teams sharing this coach
  team_names: string[]
}

export interface CoachConflictResult {
  conflicts: CoachConflict[]
  conflictingPairs: [number, number][] // team pairs that cannot be simultaneous
  clean: boolean
}

export async function detectCoachConflicts(
  eventId: number,
  sb: SupabaseClient
): Promise<CoachConflictResult> {
  // Load all coach<->team assignments for this event
  const { data: assignments } = await sb
    .from('coach_teams')
    .select('coach_id, team_id, coaches(name, email), teams(name)')
    .eq('event_id', eventId)

  // Group by coach_id — any coach with >1 team is a conflict
  // Return conflicting pairs for schedule engine consumption
}

// Called by schedule engine before matchup filtering
export async function getConflictingTeamPairs(
  eventId: number,
  sb: SupabaseClient
): Promise<Set<string>> {
  const result = await detectCoachConflicts(eventId, sb)
  const blocked = new Set<string>()
  for (const [a, b] of result.conflictingPairs) {
    blocked.add(`${Math.min(a, b)}-${Math.max(a, b)}`)
  }
  return blocked
}
```

### Pattern 3: Registration Window Enforcement

**What:** `/e/[slug]/register` page is a server component that reads `registration_opens_at`, `registration_closes_at`, `registration_open` from events and shows a closed/not-yet-open page instead of the wizard.
**When to use:** All public registration entry points.

```typescript
// app/e/[slug]/register/page.tsx (new file — registration was previously query-param based)
export default async function RegisterPage({ params }: { params: { slug: string } }) {
  const sb = createClient()
  const { data: event } = await sb
    .from('events')
    .select('id, name, logo_url, primary_color, registration_opens_at, registration_closes_at, registration_open')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!event) return <NotFound />

  const now = new Date()
  const manualOff = event.registration_open === false
  const beforeOpen = event.registration_opens_at && new Date(event.registration_opens_at) > now
  const afterClose = event.registration_closes_at && new Date(event.registration_closes_at) < now

  if (manualOff || beforeOpen || afterClose) {
    return <RegistrationClosedPage event={event} reason={manualOff ? 'manual' : beforeOpen ? 'not_yet' : 'expired'} />
  }

  return <RegisterPageClient eventId={event.id} />
}
```

**IMPORTANT:** The existing registration entry is `RegisterPage.tsx` rendered client-side with `?event_id=` query param. The `/e/[slug]/register` route is a NEW server component wrapping the existing wizard. The wizard itself (`RegisterPage.tsx`) requires minimal changes — the window check happens in the server wrapper.

### Pattern 4: Multi-Date Picker for Event Dates

**What:** Custom inline checkbox-grid of dates in EventSetupTab General tab. Admin picks start/end date range for the event (already stored), then individually checks which days within that range are actual play days.
**When to use:** Event setup when configuring a tournament that skips days (e.g., day 1 setup, day 2 off, days 3-4 play).

```typescript
// Inline within EventSetupTab — no new library
// Grid of dates between event.start_date and event.end_date
// Each date: checkbox + day label + day number
// Saves as upsert to event_dates table

const dateRange = eachDayOfInterval({
  start: parseISO(event.start_date),
  end: parseISO(event.end_date),
})
// date-fns already installed — eachDayOfInterval, parseISO, format available
```

### Pattern 5: Schedule Engine Coach Conflict Pre-Filter

**What:** In `generateSchedule()`, before `filteredMatchups`, add a coach conflict blocking check. Teams sharing a coach cannot be scheduled simultaneously — the engine must avoid placing them in the same time slot, not just block the matchup entirely.
**When to use:** Schedule generation only.

The correct integration point is NOT filtering matchups (same as rule-based filtering) but rather the slot assignment loop — when placing a game, check if any placed game in the same slot uses a team that shares a coach with the current matchup.

```typescript
// In generateSchedule(), after loading teams, add:
const coachConflictPairs = await getConflictingTeamPairs(eventId, sb)

// In slot assignment inner loop (around line 420+):
function teamsShareCoach(homeId: number, awayId: number): boolean {
  const key = `${Math.min(homeId, awayId)}-${Math.max(homeId, awayId)}`
  return coachConflictPairs.has(key)
}

// When evaluating a slot, skip if any game already placed in same slot has a shared coach
const coachConflictInSlot = placedInThisSlot.some(
  (placed) =>
    teamsShareCoach(placed.home_team_id, matchup.home) ||
    teamsShareCoach(placed.home_team_id, matchup.away) ||
    teamsShareCoach(placed.away_team_id, matchup.home) ||
    teamsShareCoach(placed.away_team_id, matchup.away)
)
if (coachConflictInSlot) continue
```

### Anti-Patterns to Avoid

- **Filtering matchups for coach conflicts (wrong integration point):** Coach conflicts are a slot-level constraint, not a matchup-level constraint. Two teams sharing a coach can still PLAY each other — they just can't play simultaneously with OTHER teams sharing that coach. Filter at slot assignment, not matchup generation.
- **Marking invite is_used on GET validation:** Only mark is_used=true on successful POST submission. GET validation in the server component just checks is_active and expiry. This matches the `app/join` pattern.
- **Hardcoding event IDs anywhere:** Every DB query needs `.eq('event_id', eventId)` or `.eq('program_id', programId)` — never hardcode.
- **Calling createClient() at module scope:** Must be inside handler body (Next.js 15 cookies() pattern — per existing decisions log 03-01).
- **Returning null before hooks:** All useState/useEffect must be declared before any early returns in client components (CLAUDE.md known gotcha #3).
- **Select with transparent bg:** Always `bg-[#040e24]` on Select elements (CLAUDE.md known gotcha #2).

---

## Don't Hand-Roll

| Problem                                    | Don't Build           | Use Instead                                       | Why                                                               |
| ------------------------------------------ | --------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| Token generation                           | Custom token scheme   | `crypto.randomUUID()`                             | Already used in codebase; collision-resistant UUID                |
| QR code rendering                          | Custom canvas drawing | `qrcode.react QRCodeSVG` + `QRCodeCanvas`         | Already installed Phase 5; established black-on-white pattern     |
| Date arithmetic for window enforcement     | Manual date parsing   | `date-fns` parseISO, isAfter, isBefore            | Already installed; handles timezone edge cases                    |
| Date range iteration for multi-date picker | Manual loop           | `date-fns eachDayOfInterval`                      | Clean, already available                                          |
| Form toast feedback                        | Custom toast          | `react-hot-toast toast.success() / toast.error()` | Consistent with all other forms                                   |
| Rate limiting on public routes             | Custom counter        | `publicRatelimit` from `@/lib/ratelimit`          | Already wired in `/api/join` — identical pattern for `/api/coach` |

**Key insight:** Every primitive this phase needs is already installed. The only new "library" code is `coach-conflicts.ts` — pure business logic, no dependencies.

---

## Schema — New Tables and Migrations

This section is critical because schema must be correct before any other work.

### New Tables Required

```sql
-- coaches: individual coach records (not tied to auth.users — no account required)
CREATE TABLE IF NOT EXISTS coaches (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  certifications  TEXT,              -- free text, e.g. "US Lacrosse Level 2"
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coaches_email ON coaches(email);

-- coach_teams: links coaches to team_registrations within an event
CREATE TABLE IF NOT EXISTS coach_teams (
  id                    BIGSERIAL PRIMARY KEY,
  coach_id              BIGINT NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  team_registration_id  BIGINT NOT NULL REFERENCES team_registrations(id) ON DELETE CASCADE,
  event_id              BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role                  TEXT DEFAULT 'assistant'
    CHECK (role IN ('head', 'assistant')),
  added_by              TEXT DEFAULT 'program_leader'
    CHECK (added_by IN ('program_leader', 'self_registration', 'admin')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, team_registration_id)
);
CREATE INDEX IF NOT EXISTS idx_coach_teams_event   ON coach_teams(event_id);
CREATE INDEX IF NOT EXISTS idx_coach_teams_coach   ON coach_teams(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_teams_team_reg ON coach_teams(team_registration_id);

-- coach_invites: program-scoped invite tokens for coach self-registration
CREATE TABLE IF NOT EXISTS coach_invites (
  id          BIGSERIAL PRIMARY KEY,
  program_id  BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  expires_at  TIMESTAMPTZ,          -- set to registration_closes_at on creation
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, event_id)      -- one active invite per program per event
);
CREATE INDEX IF NOT EXISTS idx_coach_invites_token   ON coach_invites(token);
CREATE INDEX IF NOT EXISTS idx_coach_invites_program ON coach_invites(program_id);

-- coach_conflicts: materialized conflict flags, written on every coach assignment
CREATE TABLE IF NOT EXISTS coach_conflicts (
  id          BIGSERIAL PRIMARY KEY,
  coach_id    BIGINT NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_ids    BIGINT[] NOT NULL,    -- array of team_registration_ids with this coach
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved    BOOLEAN DEFAULT FALSE,
  UNIQUE(coach_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_coach_conflicts_event ON coach_conflicts(event_id);
```

### Modifications to Existing Tables

```sql
-- team_registrations: add availability date selection
ALTER TABLE team_registrations
  ADD COLUMN IF NOT EXISTS available_date_ids JSONB DEFAULT '[]'::jsonb;
-- available_date_ids stores array of event_dates.id values: [1, 2, 3]
-- Empty array OR null means "available all dates"

-- events: add registration window enforcement columns
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_opens_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_open      BOOLEAN DEFAULT TRUE;
-- registration_open = TRUE means open (default)
-- registration_open = FALSE = manually closed (overrides dates)
-- NULL dates = no automatic window enforcement
```

### NOTE: event_dates table already exists

The `event_dates` table is already defined in `supabase/schema.sql` (lines 24-31):

```sql
CREATE TABLE IF NOT EXISTS event_dates (
  id         BIGSERIAL PRIMARY KEY,
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  label      TEXT NOT NULL,
  day_number INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

No migration needed for this table. The multi-date picker UI in EventSetupTab simply writes to this existing table.

### Migration File

Consolidate into: `supabase/phase6_registration.sql`

---

## Common Pitfalls

### Pitfall 1: Coach Conflict Engine — Wrong Integration Point in Schedule

**What goes wrong:** Filtering coach-conflicting teams out of allMatchups (preventing them from ever playing each other) rather than preventing simultaneous scheduling.
**Why it happens:** The existing `filteredMatchups` pattern removes matchups based on rules — it's tempting to add coach conflict filtering there.
**How to avoid:** Coach conflicts are slot-level constraints. In the slot assignment loop, when evaluating whether matchup X can go into a given time slot, check whether any other game already placed in that SAME time slot involves a coach-sharing team. The matchup itself is allowed — just not simultaneously.
**Warning signs:** Test cases where two teams sharing a coach never play each other at all.

### Pitfall 2: Token Expiry — Two Sources of Truth

**What goes wrong:** `coach_invites.is_active` is the DB flag but `expires_at` is also checked. If only one is checked in the server component, expired-but-active tokens slip through (or vice versa).
**Why it happens:** The existing `registration_invites` table only has `is_active` (no `expires_at`). The coach invite flow adds `expires_at` for date-based expiry.
**How to avoid:** Server component checks BOTH: `is_active = true` AND `expires_at > now()`. The API route POST also double-checks both. Revoking a link flips `is_active = false`.
**Warning signs:** Coach can register after registration closes if only `is_active` is checked.

### Pitfall 3: `registration_open` Boolean Default and NULL handling

**What goes wrong:** When `registration_open` is NULL (unset for old events before migration), the enforcement logic may treat it as "closed" or throw an error.
**Why it happens:** Adding a BOOLEAN column with no DEFAULT to existing rows leaves NULLs.
**How to avoid:** Migration specifies `DEFAULT TRUE` so all existing rows get TRUE. Enforcement logic should treat `NULL` as open: `registration_open !== false`.
**Warning signs:** All pre-existing events show "Registration Closed" after migration.

### Pitfall 4: `available_date_ids` — Null vs Empty Array vs Full Coverage

**What goes wrong:** The availability selection has three states: (a) "available all dates" toggle ON = JSONB `[]` or NULL, (b) explicitly checked all dates = array with all IDs, (c) checked some dates = partial array. Schedule engine must interpret `[]` or NULL as "no constraint."
**Why it happens:** The "available all dates" default means the happy-path stores an empty array, which is not the same as "no dates available."
**How to avoid:** Establish clear convention: `available_date_ids = []` or `NULL` = available all dates. Schedule engine reads this as no restriction. Only non-empty arrays are treated as constraints.
**Warning signs:** Teams with "available all dates" checked are being excluded from schedule slots.

### Pitfall 5: `UNIQUE(program_id, event_id)` on coach_invites — Revoke Flow

**What goes wrong:** Program leader tries to regenerate invite link but the unique constraint blocks inserting a new token while the old one exists (even if is_active=false).
**Why it happens:** UNIQUE constraint is on (program_id, event_id), not on active tokens only.
**How to avoid:** Revoke+regenerate flow uses `UPDATE ... SET token = randomUUID(), is_active = true` rather than DELETE+INSERT. One row per program per event, updated in place.
**Warning signs:** "duplicate key" errors when generating a second invite link.

### Pitfall 6: Supabase Joined Filter Gotcha

**What goes wrong:** Filtering on a joined table's column fails silently. E.g., trying to filter coach_invites through a join on events to check registration window.
**Why it happens:** Supabase joined column filters don't work (CLAUDE.md known gotcha #1).
**How to avoid:** Fetch IDs first, then use `.in()` on the base table. Or fetch the row and validate in application code.

---

## Code Examples

Verified patterns from codebase inspection:

### Token Route Pattern (from `app/join/[token]/page.tsx`)

```typescript
// Server component — validate token, pass to client
const { data: invite } = await sb
  .from('coach_invites')
  .select('program_id, event_id, is_active, expires_at, programs(name), events(name, primary_color, logo_url)')
  .eq('token', params.token)
  .single()

if (!invite || !invite.is_active || new Date(invite.expires_at!) < new Date()) {
  return <ExpiredErrorUI />
}
```

### API Route Rate Limiting Pattern (from `app/api/join/route.ts`)

```typescript
// Public route — always rate limit
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
const { success } = await publicRatelimit.limit(ip)
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

### Dark Theme Input Pattern (from `app/join/[token]/JoinClient.tsx`)

```typescript
const inp =
  'w-full bg-[#030d20] border border-[#1a2d50] text-white px-4 py-3 rounded-xl text-[14px] outline-none focus:border-blue-400 transition-colors placeholder-[#3a4e6a]'
const lbl =
  'font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'
```

### QR Code Pattern (from `EventSetupTab.tsx`)

```typescript
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
// Always black-on-white for scanner compatibility:
<QRCodeSVG value={url} size={128} bgColor="#FFFFFF" fgColor="#000000" />
```

### Copy-Coach Pattern (existing in `RegisterPage.tsx`)

```typescript
function copyCoachToAll(fromIdx: number) {
  const src = teams[fromIdx]
  setTeams((prev) =>
    prev.map((t, i) =>
      i === fromIdx
        ? t
        : { ...t, coachName: src.coachName, coachEmail: src.coachEmail, coachPhone: src.coachPhone }
    )
  )
}
// D-18 extends this to also copy availability dates and additional coaches array
```

### date-fns Date Range for Multi-Date Picker

```typescript
import { eachDayOfInterval, parseISO, format, isWeekend } from 'date-fns'

const allDates = eachDayOfInterval({
  start: parseISO(event.start_date),
  end: parseISO(event.end_date),
})
// Render as checkbox grid, check = included in event_dates table
```

### Engine Signature Convention (from `lib/engines/field.ts`)

```typescript
export async function runFieldConflictEngine(
  eventId: number,
  complexId: number,
  sb: SupabaseClient
): Promise<FieldEngineResult>

// Coach conflicts engine follows same pattern:
export async function detectCoachConflicts(
  eventId: number,
  sb: SupabaseClient
): Promise<CoachConflictResult>
```

---

## State of the Art

| Old Approach                        | Current Approach                             | When Changed  | Impact                                          |
| ----------------------------------- | -------------------------------------------- | ------------- | ----------------------------------------------- |
| Hardcoded event_id = 1              | Dynamic event_id from context/params         | Phase 2       | All queries must use eventId variable           |
| Browser createClient() in engines   | Injected SupabaseClient parameter            | Phase 1/3     | Coach conflicts engine must accept sb parameter |
| Static registration link            | Slug-based `/e/[slug]/register` route        | Phase 5       | Coach invite URL uses same base URL approach    |
| Single `is_active` flag for invites | `is_active` + `expires_at` for coach invites | Phase 6 (new) | Two-condition check required                    |

**Deprecated/outdated:**

- Manual approval step for program/team registrations: CLAUDE.md states "Auto-approve all program and team registrations (no manual approval step)." The existing `status` CHECK constraint includes 'pending' for backward compat but new registrations should set `status = 'approved'` immediately.

---

## Open Questions

1. **Where exactly does the `/e/[slug]/register` route live?**
   - What we know: `app/join/[token]/page.tsx` exists. Phase 5 established slug-based routing. The existing `RegisterPage.tsx` is a client component used at `/register?event_id=X`.
   - What's unclear: Is there currently an `app/e/[slug]/register/` directory at all? The Glob search returned no results for `app/e/**/*.tsx`. The existing registration may still be `?event_id=` param only.
   - Recommendation: Create `app/e/[slug]/register/page.tsx` as a new server component wrapper. Keep existing `RegisterPage.tsx` client component intact — just wrap it. The `NEXT_PUBLIC_PUBLIC_RESULTS_URL` env var pattern from Phase 5 means the public-results sub-app hosts `/e/[slug]` routes, but registration is main app — confirm directory structure at implementation start.

2. **Does `coach_invites` need a UNIQUE constraint allowing only ONE invite per program per event, or can there be a history of revoked tokens?**
   - What we know: D-06 says "revoke and regenerate." The revoke+regenerate flow recommended above UPDATEs in-place.
   - What's unclear: Whether admin wants an audit trail of previous tokens.
   - Recommendation: UNIQUE(program_id, event_id) + UPDATE in place. No audit trail needed per CONTEXT.md — keeps schema simple.

3. **Does the coach conflict badge in Command Center require a new tab or a badge overlay on existing teams view?**
   - What we know: D-09 says "warning badges in Command Center on affected teams in the admin's team/program management view."
   - What's unclear: Which specific tab/component hosts the "program management view" — it's likely the Programs tab in AppShell.
   - Recommendation: Badge overlay on team rows in the Programs tab. Planner should read the Programs tab component to confirm structure.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 is purely code + schema changes. No external tools, services, or CLIs beyond the project's existing stack are required. All dependencies (Supabase, Node.js, npm) already verified operational in prior phases.

---

## Validation Architecture

### Test Framework

| Property           | Value                                 |
| ------------------ | ------------------------------------- |
| Framework          | Vitest 4.1.0 + @testing-library/react |
| Config file        | `vitest.config.ts` (project root)     |
| Quick run command  | `npm run test -- coach-conflicts`     |
| Full suite command | `npm run test`                        |

### Phase Requirements → Test Map

| Req ID | Behavior                                                          | Test Type         | Automated Command                   | File Exists?                                              |
| ------ | ----------------------------------------------------------------- | ----------------- | ----------------------------------- | --------------------------------------------------------- |
| REG-01 | event_dates written correctly on date selection                   | unit              | `npm run test -- event-dates`       | ❌ Wave 0                                                 |
| REG-02 | available_date_ids saved as JSONB array                           | unit (data layer) | `npm run test -- team-registration` | ❌ Wave 0                                                 |
| REG-03 | coaches + coach_teams inserted on wizard submit                   | unit              | `npm run test -- register-page`     | ❌ Wave 0                                                 |
| REG-04 | coach_invite token generated, stored, unique per program+event    | unit              | `npm run test -- coach-invite`      | ❌ Wave 0                                                 |
| REG-05 | CoachClient POST submits coach data + marks invite used           | unit              | `npm run test -- coach-client`      | ❌ Wave 0                                                 |
| REG-06 | detectCoachConflicts returns conflicts for shared email           | unit              | `npm run test -- coach-conflicts`   | ❌ Wave 0                                                 |
| REG-07 | generateSchedule respects coach conflict pairs as slot constraint | unit              | `npm run test -- schedule`          | ✅ `__tests__/lib/engines/` (no coach-conflicts test yet) |
| REG-08 | multi-team wizard session preserves all teams                     | unit              | `npm run test -- register-page`     | ❌ Wave 0                                                 |

### Sampling Rate

- **Per task commit:** `npm run test -- coach-conflicts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/lib/engines/coach-conflicts.test.ts` — covers REG-06, REG-07 (engine unit tests using `_mockSb` pattern)
- [ ] `__tests__/components/RegisterPageCoaches.test.tsx` — covers REG-03, REG-08 (wizard Step 3 extension)
- [ ] `__tests__/app/api/coach-route.test.ts` — covers REG-04, REG-05 (POST handler logic)

---

## Project Constraints (from CLAUDE.md)

The planner MUST ensure all tasks comply with these directives:

| Directive                                               | Impact on Phase 6                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Stack locked: Next.js 14 App Router + Supabase + Vercel | No new frameworks; all routing via App Router                                           |
| Dark theme: Barlow Condensed, navy/red palette          | All new UI components use established color tokens and font classes                     |
| Auth via Supabase Auth + user_roles table               | Coach self-registration does NOT create auth accounts (D-02 confirmed)                  |
| Every DB query scoped with `.eq('event_id', eventId)`   | coach_teams, coach_conflicts, coach_invites all need event_id scoping                   |
| Auto-approve all program and team registrations         | New team_registrations insert with `status = 'approved'` directly                       |
| ESLint errors = Vercel build failures                   | `prefer-const` everywhere; no unused variables                                          |
| Hooks before guards in client components                | All useState/useEffect before any early returns                                         |
| Select elements: `bg-[#040e24]` (never transparent)     | Team dropdown in CoachClient must use this background                                   |
| createClient() inside handler body, not module scope    | All API routes and server components follow this                                        |
| Supabase joined column filters fail silently            | Don't filter coach_invites by events columns in a join — fetch and validate in app code |
| StatusBadge only accepts `status` prop                  | Registration status badges must not pass size prop                                      |
| QR codes: always black-on-white                         | `bgColor="#FFFFFF" fgColor="#000000"` on all coach invite QR codes                      |
| Apply migrations via Supabase MCP tool or SQL Editor    | Phase 6 migration SQL deployed via `apply_migration`, not CLI                           |

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `app/join/[token]/page.tsx`, `app/api/join/route.ts`, `components/auth/RegisterPage.tsx`, `lib/engines/schedule.ts`, `lib/engines/field.ts`, `supabase/schema.sql`, `supabase/program_registration.sql`, `supabase/registration_invites.sql`, `supabase/add_coach_role.sql`, `supabase/coach_team_link.sql`, `supabase/event_setup.sql`, `types/index.ts`, `CLAUDE.md`
- `06-CONTEXT.md` — locked decisions D-01 through D-20

### Secondary (MEDIUM confidence)

- `__tests__/lib/engines/field.test.ts` — verified `_mockSb` pattern and test structure for coach-conflicts test
- `.planning/STATE.md` — verified Phase 5 completion, slug-based routing established

### Tertiary (LOW confidence)

- None — all findings backed by direct file inspection

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified against package.json and existing imports
- Architecture patterns: HIGH — all patterns verified against live codebase files
- Schema design: HIGH — existing tables inspected; new tables follow established conventions
- Schedule engine integration: HIGH — read `generateSchedule()` source; identified exact integration point
- Pitfalls: HIGH — derived from direct codebase inspection and CLAUDE.md known gotchas

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable codebase — schema and engine patterns unlikely to change)
