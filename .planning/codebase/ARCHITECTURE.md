# LeagueOps — Architecture

## Overview

LeagueOps is a real-time tournament operations management system built on **Next.js 14 App Router**. It is structured as a monorepo with two applications: the primary admin/ops shell (`/`) and a separate public-facing results site (`apps/public-results/`). The backend is entirely Supabase (PostgreSQL + Auth + Realtime), accessed directly from the browser via the Supabase JS SDK. There is no standalone API server; Next.js API routes serve as thin orchestration wrappers around engine logic.

---

## Architectural Pattern

**Client-heavy SPA inside Next.js App Router.** The root page (`app/page.tsx`) is a `'use client'` component that renders the entire application based on auth state. Once an event is selected, all state is held in a React Context + `useReducer` store, and all mutations flow through that store's action functions. The App Router is used primarily for:

- Global layout and font loading (`app/layout.tsx`)
- API route handlers (`app/api/**/route.ts`) using Server Components / Route Handlers
- Token-gated public pages (`app/join/[token]/` and `app/checkin/[token]/`) that use server-side data fetching at the page level and hand off to client components
- The register page (`app/register/page.tsx`)

---

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer                                                   │
│  components/**/*.tsx  — feature tabs, shell chrome, portals │
│  components/ui/index.tsx — shared primitives                │
├─────────────────────────────────────────────────────────────┤
│  State Layer                                                │
│  lib/auth.tsx   — AuthProvider + useAuth hook               │
│  lib/store.tsx  — AppProvider + useApp hook (useReducer)    │
├─────────────────────────────────────────────────────────────┤
│  Data Access Layer                                          │
│  lib/db.ts  — all Supabase query functions (client-side)    │
├─────────────────────────────────────────────────────────────┤
│  Engine Layer                                               │
│  lib/engines/referee.ts    — ref conflict detection         │
│  lib/engines/field.ts      — field conflict detection       │
│  lib/engines/weather.ts    — weather monitoring + alerts    │
│  lib/engines/eligibility.ts — player eligibility rules      │
│  lib/engines/rules.ts      — rules cache + typed accessors  │
│  lib/engines/unified.ts    — orchestrates all engines       │
├─────────────────────────────────────────────────────────────┤
│  API Route Layer                                            │
│  app/api/**/route.ts — thin HTTP wrappers over engines/db   │
├─────────────────────────────────────────────────────────────┤
│  Supabase Backend                                           │
│  supabase/client.ts — browser Supabase client               │
│  supabase/server.ts — SSR Supabase client (cookies)         │
│  supabase/*.sql     — schema migrations                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Entry Points

### Primary Application (`app/`)

**`app/layout.tsx`** — Root layout. Wraps all pages in `AuthProvider` (from `lib/auth.tsx`) and renders the global `Toaster`. Loads three Google Fonts as CSS variables: `--font-barlow`, `--font-barlow-condensed`, `--font-roboto-mono`.

**`app/page.tsx`** — Root page (client component). Acts as the application router. Logic:
1. Shows loading spinner while `useAuth()` resolves
2. Unauthenticated → renders `<LoginPage />`
3. Role `referee` → renders `<RefereePortal />`
4. Role `volunteer` → renders `<VolunteerPortal />`
5. Role `program_leader` + inactive → `<PendingApprovalScreen />`, active → `<ProgramDashboard />`
6. Role `admin` / `league_admin` with no event selected → renders `<EventPicker />`
7. Role `admin` / `league_admin` with event selected → wraps in `<AppProvider eventId={id}>` and renders `<AppShell />`

### Token-gated Public Pages

**`app/join/[token]/page.tsx`** — Server Component. Validates invite token from `registration_invites` table via SSR Supabase client. Renders `<JoinClient />` (client component) on success, error card on invalid/expired token. Used for referee/volunteer self-registration.

**`app/checkin/[token]/page.tsx`** — Server Component. Validates QR token from `player_qr_tokens` table. Passes player data and game list to `<QRCheckinClient />` (client component). Used for player self-check-in via scanned QR code.

**`app/register/page.tsx`** — Registration form page.

### Public Results App (`apps/public-results/`)

A separate Next.js application at `apps/public-results/`. Entry points:
- `apps/public-results/src/app/layout.tsx` — root layout
- `apps/public-results/src/app/page.tsx` — event listing page
- `apps/public-results/src/app/e/[slug]/page.tsx` — per-event standings/results page (server component, `revalidate = 30`)

---

## Routing Structure

### Main App (Client-side tab routing)
The main operator shell does **not** use URL-based routing. Navigation is managed by `activeTab` state in `AppShell`. The `TabName` union type defines all valid tabs:

| Tab ID | Component | Admin Only |
|--------|-----------|-----------|
| `dashboard` | `DashboardTab` | No |
| `schedule` | `ScheduleTab` | No |
| `checkin` | `CheckInTab` | No |
| `rosters` | `RostersTab` | No |
| `refs` | `RefsTab` | No |
| `conflicts` | `ConflictsTab` | No |
| `incidents` | `IncidentsTab` | No |
| `weather` | `WeatherTab` | No |
| `parkmap` | `ParkMapTab` | No |
| `fields` | `FieldsTab` | Yes |
| `command` | `CommandCenter` | No |
| `engine` | `EngineTab` | No |
| `rules` | `RulesTab` | Yes |
| `users` | `UserManagement` | Yes |
| `programs` | `ProgramApprovals` | Yes |
| `payments` | `PaymentsTab` | Yes |
| `settings` | `EventSetupTab` | Yes |
| `reports` | `ReportsTab` | No |
| `qrcodes` | `QRCodesPanel` | Yes |

Tab visibility is filtered by the user's role and by the event's `role_permissions` JSON field. Admin-only tabs require `isAdmin === true`.

### API Routes (Next.js Route Handlers)

All routes under `app/api/` use the **server-side** Supabase client (`supabase/server.ts`).

| Route | Methods | Purpose |
|-------|---------|---------|
| `app/api/games/route.ts` | GET, POST | List games by event/date; create game |
| `app/api/games/[id]/route.ts` | PATCH, DELETE | Update/delete specific game |
| `app/api/fields/route.ts` | GET, POST | List/create fields |
| `app/api/fields/[id]/route.ts` | PATCH, DELETE | Update/delete field |
| `app/api/referees/route.ts` | GET, POST | List/create referees |
| `app/api/referees/[id]/route.ts` | PATCH | Update referee |
| `app/api/volunteers/route.ts` | GET, POST | List/create volunteers |
| `app/api/volunteers/[id]/route.ts` | PATCH | Update volunteer |
| `app/api/teams/route.ts` | GET, POST | List/create teams |
| `app/api/players/route.ts` | GET, POST | List/create players |
| `app/api/assignments/route.ts` | POST, DELETE | Ref/vol game assignments |
| `app/api/checkins/route.ts` | POST, DELETE | Player check-in/out |
| `app/api/incidents/route.ts` | GET, POST | Incident log |
| `app/api/medical/route.ts` | GET, POST, PATCH | Medical/trainer incidents |
| `app/api/conflicts/route.ts` | GET | Open operational conflicts |
| `app/api/ops-log/route.ts` | GET, POST | Operations log entries |
| `app/api/weather/route.ts` | GET | Weather alerts |
| `app/api/lightning/route.ts` | POST | Trigger/lift lightning delay |
| `app/api/rules/route.ts` | GET | Event rules |
| `app/api/rules/changes/route.ts` | GET | Rule change audit log |
| `app/api/payments/` | — | Payment tracking |
| `app/api/registration-fees/` | — | Fee configuration |
| `app/api/team-payments/` | — | Per-team payment records |
| `app/api/payment-entries/route.ts` | — | Payment entry records |
| `app/api/referee-engine/route.ts` | POST, GET | Run referee conflict engine; find available refs |
| `app/api/field-engine/route.ts` | POST | Run field conflict engine |
| `app/api/weather-engine/route.ts` | POST | Run weather engine for a complex |
| `app/api/eligibility/route.ts` | POST | Check player eligibility |
| `app/api/join/route.ts` | POST | Referee/volunteer self-registration via invite |
| `app/api/auth/check-email/route.ts` | GET | Check if email already registered |
| `app/api/auth/program-prefill/route.ts` | GET | Program data for registration prefill |
| `app/api/admin/create-user/route.ts` | POST | Admin user creation |

### Public Results Routes

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Server Component | List all public events |
| `/e/[slug]` | Server Component | Event standings, results, live scores |

---

## Context Providers

### `AuthProvider` (`lib/auth.tsx`)

Wraps the entire application (in `app/layout.tsx`). Manages Supabase Auth session state using `onAuthStateChange`. Exposes via `useAuth()`:

- `user` — Supabase `User | null`
- `session` — Supabase `Session | null`
- `userRole` — `UserRole | null` (loaded from `user_roles` table on sign-in)
- `loading` — boolean
- `signIn(email, password)` → `{ error: string | null }`
- `signOut()`
- `isAdmin`, `isLeagueAdmin`, `isReferee`, `isVolunteer` — boolean convenience flags
- `canManage` — `isAdmin || isLeagueAdmin`

Role type union: `'admin' | 'league_admin' | 'referee' | 'volunteer' | 'player' | 'program_leader' | 'coach'`

### `AppProvider` (`lib/store.tsx`)

Wraps `AppShell` after an event is selected (in `app/page.tsx`). Receives `eventId` as a prop and scopes all data to that event. Exposes via `useApp()`:

- `state` — full `State` object (see State Management below)
- `currentDate` — derived `EventDate | null` from `state.eventDates[state.currentDateIdx]`
- `todayGames` — `state.games` (games for the current date)
- Action functions (see State Management below)
- `eventId` — the current event's numeric ID

---

## State Management

### Structure

`AppProvider` uses React's `useReducer` with the following state shape:

```typescript
interface State {
  event: Event | null
  eventDates: EventDate[]
  currentDateIdx: number       // index into eventDates
  fields: Field[]
  teams: Team[]
  games: Game[]                // games for currentDate only
  referees: Referee[]
  volunteers: Volunteer[]
  incidents: Incident[]
  medicalIncidents: MedicalIncident[]
  weatherAlerts: WeatherAlert[]
  opsLog: OpsLogEntry[]
  lightningActive: boolean
  lightningSecondsLeft: number // countdown seconds (default 1800 = 30 min)
  loading: boolean
}
```

### Initialization

On mount, `AppProvider` fires `Promise.all()` over 10 parallel DB queries (event, event dates, fields, teams, referees, volunteers, incidents, medical, weather, ops log) and dispatches a single `INIT` action. Games are loaded separately when `currentDate` changes.

### Real-time Subscriptions

`AppProvider` opens a single Supabase Realtime channel (`'leagueops-realtime'`) subscribed to `postgres_changes` on four tables:
- `ops_log` → dispatches `ADD_OPS_LOG`
- `incidents` → re-fetches and dispatches `SET_INCIDENTS`
- `games` → re-fetches by current date and dispatches `SET_GAMES`
- `medical_incidents` → re-fetches and dispatches `SET_MEDICAL`

The `RightPanel` component opens additional per-event subscriptions on `operational_conflicts` independently.

### Lightning Timer

When `lightningActive` is true, a `setInterval` fires `TICK_LIGHTNING` every second, decrementing `lightningSecondsLeft` to zero.

### Actions Exposed via `useApp()`

All actions are `useCallback`-memoized. They follow the pattern: call `lib/db.ts`, dispatch an optimistic update, optionally call `addLog`.

| Action | Description |
|--------|-------------|
| `changeDate(idx)` | Switch the active event date index |
| `refreshGames()` | Re-fetch games from DB for current date |
| `updateGameStatus(gameId, status)` | Update game status + log |
| `updateGameScore(gameId, home, away)` | Update scores optimistically |
| `addGame(game)` | Insert game, refresh, log |
| `toggleRefCheckin(refId)` | Toggle referee check-in |
| `toggleVolCheckin(volId)` | Toggle volunteer check-in |
| `logIncident(incident)` | Insert incident, dispatch, log |
| `dispatchTrainer(incident)` | Insert medical incident, dispatch, log |
| `updateMedicalStatus(id, status)` | Update medical incident status |
| `triggerLightning()` | Activate lightning delay (suspends all games, creates weather alert) |
| `liftLightning()` | Clear lightning delay (resumes games, resolves alerts) |
| `addLog(message, type)` | Write to ops_log |
| `updateFieldMap(fieldId, x, y)` | Optimistic field position update |
| `updateFieldFull(fieldId, props)` | Optimistic multi-property field update |
| `updateFieldName(fieldId, name)` | Update field name |
| `updateFieldDetails(fieldId, props)` | Update field metadata |
| `addField(name, number, division?, complexId?)` | Create new field |
| `deleteField(fieldId)` | Delete field |

---

## Engine Layer

Engines are pure TypeScript modules in `lib/engines/`. They are invoked either directly by API route handlers or by the unified engine, never by UI components directly.

### Rules Engine (`lib/engines/rules.ts`)

Loads `event_rules` rows from Supabase. Uses a 30-second in-memory module-level cache (`_cache`). Provides typed convenience getters: `getWeatherThresholds()`, `getRefereeRules()`, `getSchedulingRules()`. Rules can be updated with audit logging via `updateRule()` and reset via `resetRule()` / `resetAllRules()`.

### Referee Engine (`lib/engines/referee.ts`)

Exposed via `POST /api/referee-engine`. Detects four conflict types by analyzing all ref assignments for an `event_date_id`:
1. `missing_referee` — game with no ref assigned
2. `ref_double_booked` — ref assigned to overlapping games (true overlap) or insufficient travel buffer
3. `ref_unavailable` — assigned outside declared availability window
4. `max_games_exceeded` — assigned more than `max_games_per_day`

Writes results to `operational_conflicts` (clears stale first). Also exposes `findAvailableRefs()` for replacement suggestions via `GET /api/referee-engine`.

### Field Conflict Engine (`lib/engines/field.ts`)

Exposed via `POST /api/field-engine`. Detects four conflict types by scanning all field/game combinations:
1. `field_overlap` — two games on same field overlapping in time
2. `field_blocked` — game scheduled during a `field_blocks` record
3. `schedule_cascade` — live/halftime game about to delay the next game
4. `missing_referee` — cross-check: game has fewer refs than `refs_per_game` rule

Pulls `game_duration_min` and `buffer_min` from the rules engine. Logs runs to `conflict_engine_runs`. Can apply resolutions directly via `applyResolution()`.

### Weather Engine (`lib/engines/weather.ts`)

Exposed via `POST /api/weather-engine`. Per-complex monitoring using OpenWeatherMap API (or mock data when no API key). Evaluates:
- Lightning: `conditions_code` 200–232 or `lightning_detected` within radius
- Heat: advisory (95°F HI), warning (103°F), emergency (113°F) using Rothfusz equation
- Wind: advisory (25 mph), suspension (40 mph)
- Rain: heavy rain codes 502+

Auto-triggers game delays and creates `lightning_events` records. Results stored in `weather_readings`. Provides helpers: `evaluateAlerts()`, `calcHeatIndex()`, `getLatestReading()`, `checkLightningStatus()`, `liftLightningDelay()`.

### Eligibility Engine (`lib/engines/eligibility.ts`)

Exposed via `POST /api/eligibility`. Two rules enforced:
1. **Play-down prevention** — player's registered division sets the floor (age and gender checked)
2. **Multi-game approval** — playing a 2nd+ game per day requires opposing coach approval

Creates `eligibility_violations` records for play-downs and `multi_game_approvals` records for multi-game requests. Approvals can be granted or denied via `approveMultiGame()` / `denyMultiGame()`.

### Unified Engine (`lib/engines/unified.ts`)

Exposed via `POST /api/field-engine` (called internally) and used by `CommandCenter`. Runs referee, field, and weather engines in parallel via `Promise.allSettled()`. Merges results into `ops_alerts` table entries with severity, resolution suggestions, and auto-actionable `resolution_action` + `resolution_params`. Escalates aging unresolved alerts to `critical` severity. Generates shift handoff reports via `generateShiftHandoff()`.

---

## Data Flow

### Read Path (initial load)

```
AppProvider.useEffect → lib/db.ts functions → supabase/client.ts (browser client)
→ Supabase PostgreSQL → State via dispatch(INIT)
```

### Write Path (user action)

```
UI component → useApp() action → lib/db.ts mutation → Supabase
                              → dispatch(optimistic update)
                              → addLog() → Supabase ops_log
```

### Real-time Path

```
Supabase Postgres Replication → Supabase Realtime WS
→ AppProvider channel handler → dispatch(action)
→ React re-render
```

### API Route Path (engine trigger)

```
UI component → fetch('/api/engine-name', POST)
→ app/api/.../route.ts (server, uses supabase/server.ts)
→ lib/engines/*.ts → supabase/client.ts
→ operational_conflicts / ops_alerts table
→ Response JSON → UI updates state
```

### Server-rendered Token Pages

```
Browser → app/checkin/[token]/page.tsx (Server Component)
→ supabase/server.ts (cookie-based SSR client)
→ Validates token, fetches player data
→ Renders <QRCheckinClient /> with props
→ Client hydrates, further mutations via fetch('/api/checkins')
```

---

## Supabase Integration

### Client Configuration

**Browser client** (`supabase/client.ts`): `createBrowserClient` from `@supabase/ssr`. Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Created fresh on each call (no singleton — SSR-safe pattern).

**Server client** (`supabase/server.ts`): `createServerClient` from `@supabase/ssr`. Reads/writes cookies from `next/headers`. Used exclusively in Server Components and Route Handlers. `persistSession: false` because sessions are managed client-side.

### Realtime Tables

The schema enables Supabase Realtime publication on: `games`, `player_checkins`, `incidents`, `ops_log`, `weather_alerts`, `medical_incidents`.

### Row-Level Security

RLS is enabled on all tables with permissive "Allow all" policies (appropriate for single-org/trusted-operator deployment). Auth is enforced at the application layer via role checks in `useAuth()`.

---

## UI Shell Layout

When the full application renders (admin/league_admin, event selected):

```
┌─────────────────────────────────── 48px ──────────────────────┐
│ TopBar — wordmark + grouped nav dropdowns + user badge        │
├────────────────────────────────────────────────────────────────┤
│ StatusRow — live game status counts, date selector            │
├───────────────────────────────────────┬───────────── 288px ───┤
│ <main>                                │ RightPanel            │
│ Active tab component renders here     │ - Ref Coverage        │
│ (flex-1, overflow-y-auto)             │ - Vol Coverage        │
│                                       │ - Incident Monitor    │
│                                       │ - Ref Conflicts       │
│                                       │ - Weather/Lightning   │
│                                       │ - Trainer/Medical     │
│                                       │ - Operations Log      │
└───────────────────────────────────────┴───────────────────────┘
```

`TopBar` uses grouped navigation with dropdown menus (`NAV_GROUPS`). Each group can be a direct tab link or a dropdown containing multiple tab items. The `ADMIN` group is conditionally rendered based on `isAdmin`.

`RightPanel` is a persistent sidebar (288px) that reads from `useApp()` state and opens its own Supabase Realtime subscription for `operational_conflicts`.

---

## Design System

### Typography

Three font families loaded as CSS variables in `app/layout.tsx`:
- `--font-barlow` → used as `font-sans` (body text)
- `--font-barlow-condensed` → used as `font-cond` (labels, badges, UI chrome)
- `--font-roboto-mono` → used as `font-mono` (scores, times, data)

### Color Tokens (Tailwind config)

Custom colors defined in `tailwind.config.js`:
- `surface` — deep navy `#020810` (page background)
- `surface-card` — card background
- `surface-panel` — sidebar background
- `navy` / `navy-light` — primary button color
- `red` — alert/danger `#D62828`
- `muted` — subdued text `#5a6e9a`
- `border` — `#1a2d50`

### Shared UI Components (`components/ui/index.tsx`)

Primitive components exported from a single index:
- `StatusBadge` — game status with CSS class mapping
- `Btn` — button with `variant` (primary/danger/success/ghost/outline) and `size` (sm/md/lg)
- `FormField`, `Input`, `Select`, `Textarea` — form primitives
- `Card`, `SectionHeader` — layout primitives
- `Modal` — backdrop + dialog with title/footer slots
- `CoverageBar` — labeled progress bar with color thresholds
- `Avatar` — initials avatar with color variants
- `Pill` — small colored badge (blue/green/red/yellow/gray)

---

## Multi-Application Structure

The repository contains two Next.js applications:

**Root application** (`/`) — Tournament Command Center. Full auth, admin shell, all engine integrations. Uses `supabase/client.ts` and `supabase/server.ts`.

**Public Results app** (`apps/public-results/`) — Read-only public tournament results. Independent Next.js app with its own `next.config.js`, `tailwind.config.js`, and `package.json`. Uses only its own `src/lib/supabase.ts` and `src/lib/data.ts`. No auth — reads only public event data. Server-rendered with 30-second ISR revalidation.
