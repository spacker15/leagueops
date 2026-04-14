# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**LeagueOps** — Real-time tournament/season operations platform for youth lacrosse (extensible to other sports). Multi-tenant SaaS where each event (tournament, season, league, clinic) is a fully isolated workspace. Admins manage scheduling, scoring, referees, volunteers, weather, field conflicts, and program registration in real time.

- **Live:** https://leagueops.vercel.app
- **GitHub:** https://github.com/spacker15/leagueops
- **Supabase Project ID:** `rzzzwrqbubptnlwfesjv`

### Constraints

- Stack is locked: **Next.js 14 App Router + Supabase + Vercel** — no changes
- Keep third-party services free/cheap (free tiers, Supabase Edge Functions)
- Maintain existing dark theme (Barlow Condensed, navy/red palette)
- Auth via Supabase Auth with role-based access through `user_roles` table
- Every DB query must be scoped with `.eq('event_id', eventId)` — never hardcode event IDs
- Auto-approve all program and team registrations (no manual approval step)

## Build & Dev Commands

```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # Production build (what Vercel runs)
npm run lint             # ESLint check
npm run lint:fix         # ESLint autofix
npm run format           # Prettier write
npm run format:check     # Prettier check (CI uses this)
npm run type-check       # tsc --noEmit
npm run test             # Vitest run (single pass)
npm run test:watch       # Vitest interactive
npm run test:coverage    # Vitest with coverage
npm run db:seed          # Seed Supabase via npx tsx supabase/seed.ts
```

**Public results sub-app** (separate Next.js app):

```bash
cd apps/public-results && npm run dev   # Port 3001
```

**Pre-commit hook** (Husky + lint-staged): auto-runs Prettier on staged files.

**Common build failures on Vercel:**

- `prefer-const` lint errors — use `const` unless reassigned
- `StatusBadge` only accepts `status` prop (no `size`)
- Hooks must be called before any early returns (`if (!x) return null` goes AFTER all hooks)
- Root `tsconfig.json` excludes `apps/` — the sub-app has its own tsconfig

## Tech Stack

| Layer     | Technology                                                                      |
| --------- | ------------------------------------------------------------------------------- |
| Framework | Next.js 14.2.4 (App Router)                                                     |
| Language  | TypeScript 5.4.5 (strict-ish, `noEmit`)                                         |
| UI        | React 18.3.1, Tailwind CSS 3.4.4, lucide-react icons                            |
| Fonts     | Barlow (`font-sans`), Barlow Condensed (`font-cond`), Roboto Mono (`font-mono`) |
| Database  | Supabase (Postgres + Realtime + Auth)                                           |
| State     | React Context + `useReducer` (AppProvider), AuthProvider                        |
| DnD       | @dnd-kit/core + sortable                                                        |
| Dates     | date-fns 3.6.0                                                                  |
| Toast     | react-hot-toast 2.4.1                                                           |
| Testing   | Vitest 4.1.0, @testing-library/react                                            |
| Linting   | ESLint 8 (next/core-web-vitals), Prettier 3.8                                   |
| Deploy    | Vercel (production auto-deploys from `main`)                                    |

## Architecture

### Data Hierarchy

```
Event (tournament/season/league)
  ├── Programs (organizations like "Riptide", "Hammerhead")
  │     └── Teams (grouped by division within a program)
  ├── Divisions (1/2 Grade, 3/4 Grade, etc.)
  ├── Fields (assigned to divisions)
  ├── Event Dates (game days)
  ├── Games (scheduled on fields, between teams)
  ├── Referees & Volunteers
  └── Schedule Rules (configurable per-event)
```

### App Layers

```
Browser → AppShell (tab router) → Tab Components → useApp() / useAuth()
                                                        ↓
                                              lib/store.tsx (useReducer)
                                                        ↓
                                              lib/db.ts (60+ Supabase functions)
                                                        ↓
                                              Supabase (Postgres + Realtime)

API Routes (app/api/**) → lib/engines/* → Supabase
```

### Key Files

| File                                | Purpose                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `lib/store.tsx`                     | Global state: useReducer, realtime subscriptions, all actions             |
| `lib/auth.tsx`                      | AuthProvider: session, user, roles (multi-role support), derived booleans |
| `lib/db.ts`                         | 60+ data access functions (get/insert/update/toggle patterns)             |
| `types/index.ts`                    | All TypeScript interfaces matching Supabase schema                        |
| `components/ui/index.tsx`           | Shared UI kit: Btn, Modal, Card, StatusBadge, FormField, etc.             |
| `components/AppShell.tsx`           | Main layout with sidebar tab routing                                      |
| `lib/engines/schedule.ts`           | Schedule generation engine (rule-driven)                                  |
| `lib/engines/schedule-rules.ts`     | Rule evaluator: loads rules from DB, evaluates matchups/slots             |
| `lib/engines/schedule-validator.ts` | Post-generation validation engine                                         |
| `lib/engines/unified.ts`            | Runs all engines (referee, field, weather, eligibility) together          |

### Engine System

Nine engines under `lib/engines/`:

- **schedule.ts** — Generates round-robin schedules per division, rule-driven via `schedule_rules` table
- **schedule-rules.ts** — Loads/caches rules, evaluates matchup and slot constraints
- **schedule-validator.ts** — Validates generated schedules against all rules
- **referee.ts** — Detects referee scheduling conflicts
- **field.ts** — Detects field double-bookings
- **weather.ts** — Lightning delays, heat index, wind advisories
- **eligibility.ts** — Player age/roster eligibility checks
- **rules.ts** — Event-level rules (card accumulation, mercy rule)
- **unified.ts** — Orchestrates all engines for a game day

### Schedule Rules System

Rules are stored in `schedule_rules` table (not hardcoded). Each rule has:

- `scope`: global, division, program, team, week, season
- `type`: constraint or preference
- `conditions`: JSON with rule-specific parameters
- `priority`: higher = evaluated first; more specific scopes override general

Resolution order: season → global → division → program → team → weekly overrides → admin override.

Weekly overrides stored in `weekly_overrides` table. Audit trail in `schedule_audit_log`.

### State Management

- **AppProvider** (`lib/store.tsx`): `useReducer` with discriminated union actions (`SET_GAMES`, `UPDATE_GAME`, `ADD_INCIDENT`, etc.)
- Initial load: `Promise.all()` fetches all entities in parallel
- Realtime: Supabase channel subscriptions on games, incidents, ops_log, weather_alerts, medical_incidents, player_checkins
- Optimistic updates: dispatch state change immediately, then call DB
- **AuthProvider** (`lib/auth.tsx`): Multi-role support via `userRoles` array; `userRole` = first role for backward compat; boolean flags (`isAdmin`, `isCoach`, etc.) check across ALL roles

### Routing

Client-side tab routing in AppShell — no Next.js page files per tab. Key tabs:

- dashboard, schedule, checkin, rosters, refs, conflicts, incidents, weather, parkmap
- Admin-only: fields, rules, users, programs, payments, settings, qrcodes

Token-gated public pages: `/join/[token]` (ref/vol registration), `/checkin/[token]` (player check-in), `/register` (program registration)

## Conventions

### File Naming

- Components: **PascalCase** (`DashboardTab.tsx`, `StatusBadge.tsx`)
- Lib/utils: **camelCase** (`db.ts`, `store.tsx`, `auth.tsx`)
- Engines: **camelCase** under `lib/engines/`
- Directories: **lowercase**
- Tests: `__tests__/<path>/<file>.test.ts`

### Imports

- Path alias: `@/` → project root (`@/lib/db`, `@/components/ui`)
- Type-only: `import type { Game } from '@/types'`
- DB namespace: `import * as db from '@/lib/db'`
- UI barrel: `import { Btn, Modal, Card } from '@/components/ui'`
- Named exports preferred over default exports

### TypeScript

- Union string literals for status types: `type GameStatus = 'Scheduled' | 'Live' | 'Final' | ...`
- Interfaces for DB rows match Supabase column names exactly
- Joined relations are optional: `field?: Field`, `referees?: Referee[]`
- Insert types: `Omit<T, 'id' | 'created_at'>`
- Update types: `Partial<T>`

### DB Functions (`lib/db.ts`)

- `get<Entity>(eventId)` — list all
- `get<Entity>By<X>` — filtered
- `insert<Entity>` — create
- `update<Entity>` — update
- `toggle<Entity>Checkin` — boolean flip
- Each function creates its own Supabase client: `const sb = createClient()`
- Returns `data ?? []` for lists, `data ?? null` for singles

### Store Actions

- `SET_*` for wholesale replacement
- `UPDATE_*` for single-item mutation
- `ADD_*` for appending
- `DELETE_*` for removal
- All use discriminated unions: `{ type: 'SET_GAMES'; payload: Game[] }`

### Component Patterns

- All interactive components start with `'use client'`
- Use `useApp()` for state/actions, `useAuth()` for role checks
- Local state for UI concerns (modals, forms, selections)
- Feedback via `toast.success()` / `toast.error()`

## Design System

### Colors (Tailwind tokens)

| Token          | Hex       | Usage            |
| -------------- | --------- | ---------------- |
| `surface`      | `#020810` | Page background  |
| `surface-card` | `#081428` | Card backgrounds |
| `border`       | `#1a2d50` | All borders      |
| `muted`        | `#5a6e9a` | Secondary text   |
| `navy`         | `#0B3D91` | Primary actions  |
| `red`          | `#D62828` | Danger/alerts    |

### Typography

- Labels: `font-cond font-black tracking-[.12em] uppercase`
- Bold text: `font-cond font-bold`
- Numbers/scores: `font-mono`
- Small labels: `font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase`

### Status Badges (CSS classes in globals.css)

`badge-live` (green), `badge-scheduled` (blue), `badge-starting` (orange), `badge-halftime` (yellow), `badge-final` (gray), `badge-delayed` (red), `badge-suspended` (rose)

### UI Kit (`components/ui/index.tsx`)

- `Btn` — variant: primary/danger/success/ghost/outline; size: sm/md/lg
- `Modal` — backdrop + dialog with title/footer
- `Card` — `bg-surface-card` bordered container
- `StatusBadge` — game status pill (accepts `status` prop only)
- `FormField`, `Input`, `Select`, `Textarea` — form primitives
- `Select` must always use `bg-[#040e24]` (never transparent — known gotcha)

## Known Gotchas

1. **Supabase joined filters don't work**: `.eq('teams.event_id', 1)` silently fails. Fetch IDs first, then `.in('team_id', ids)`.
2. **Select transparency**: `<Select>` with transparent bg shows unreadable white-on-white options. Always use solid `bg-[#040e24]`.
3. **Hooks before guards**: Early returns like `if (!eventId) return null` must come AFTER all `useState`/`useEffect`/`useCallback` calls.
4. **Use try/catch not .catch()**: `.catch()` chains can silently swallow errors in engine functions.
5. **Event scoping**: Never hardcode event IDs. Always use `state.event?.id` or the `eventId` from context.
6. **Vercel build strictness**: Vercel enforces ESLint errors as build failures. `prefer-const` and unused variables will break deploys.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY       # Server-side only
NEXT_PUBLIC_APP_URL             # http://localhost:3000 (dev)
OPENWEATHER_API_KEY             # Weather engine
GOOGLE_MAPS_API_KEY             # Venue search (server-side proxy)
```

## Supabase

### Client Setup

- Browser: `supabase/client.ts` → `createBrowserClient()`
- Server: `supabase/server.ts` → `createClient()` (SSR-safe with cookies)

### Realtime Tables

games, player_checkins, incidents, ops_log, weather_alerts, medical_incidents

### Migrations

SQL files in `supabase/` directory (not a standard migrations folder). Key files:

- `schema.sql` — base schema
- `seed.sql` — dev seed data
- `schedule_rules_system.sql` — rules engine tables
- `season_game_days.sql`, `division_timing.sql`, `multi_role.sql` — feature migrations

Apply via Supabase MCP tool `apply_migration` or direct SQL execution.
