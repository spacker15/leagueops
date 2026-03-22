<!-- GSD:project-start source:PROJECT.md -->
## Project

**LeagueOps**

LeagueOps is a real-time tournament operations platform for youth lacrosse (and other sports). It is a multi-tenant SaaS app where a super admin creates events (tournaments, seasons, clinics, leagues), and each event is a fully isolated workspace. Admins manage scheduling, scoring, referees, volunteers, weather monitoring, field conflicts, and program registration — all in real time.

**Live URL:** https://leagueops.vercel.app
**GitHub:** https://github.com/spacker15/leagueops

**Core Value:** Tournament day operations must work reliably in real time — live scoring, field status, weather alerts, and referee assignments must be accurate and instant so that admins can run events from a single screen.

### Constraints

- **Budget**: Keep third-party services free/cheap — use free tiers, Supabase Edge Functions where possible
- **Timeline**: Event is already live — security fixes are highest priority
- **Stack**: Next.js 14 App Router + Supabase + Vercel — no stack changes
- **Auth**: Supabase Auth — all role-based access through existing user_roles table
- **Design**: Maintain existing dark theme design system (Barlow Condensed, navy/red palette)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Language & Runtime
- **Language**: TypeScript `^5.4.5` (strict mode, `noEmit`, target `es2017`)
- **Runtime**: Node.js (via Next.js)
- **JSX**: React with `preserve` transform (handled by Next.js compiler)
## Framework
- **Next.js** `14.2.4` — App Router, React Server Components, Route Handlers
## Frontend
- **React** `^18.3.1` with `react-dom ^18.3.1`
- **React Context** — two custom providers:
- **react-hot-toast** `^2.4.1` — toast notifications, rendered globally in `app/layout.tsx`
## Styling
- **Tailwind CSS** `^3.4.4`
- **PostCSS** `^8.4.38` with `autoprefixer ^10.4.19`
- **tailwind-merge** `^2.3.0` — conditional class merging utility
- **clsx** `^2.1.1` — conditional className construction
## Fonts
- **Barlow** (weights 400, 500, 600) — `--font-barlow`
- **Barlow Condensed** (weights 400, 600, 700, 800, 900) — `--font-barlow-condensed`
- **Roboto Mono** (weights 400, 500) — `--font-roboto-mono`
## UI Components & Libraries
- **lucide-react** `^0.395.0` — icon library
- **@dnd-kit/core** `^6.1.0` — drag-and-drop primitives
- **@dnd-kit/sortable** `^8.0.0` — sortable drag-and-drop
- **@dnd-kit/utilities** `^3.2.2` — dnd-kit helper utilities
- **date-fns** `^3.6.0` — date formatting and arithmetic
## Database Client
- **@supabase/supabase-js** `^2.99.2` — Supabase JS client
- **@supabase/ssr** `^0.9.0` — SSR-safe Supabase helpers
## Path Aliases
- `@/*` → project root (e.g., `@/lib/db`, `@/supabase/client`, `@/types`)
- Configured in both `tsconfig.json` and `vitest.config.ts`
## Testing
- **Vitest** `^4.1.0` — test runner
- **@testing-library/react** `^16.3.2`
- **@testing-library/jest-dom** `^6.9.1` (imported in `vitest.setup.ts`)
- **@testing-library/user-event** `^14.6.1`
- **@vitejs/plugin-react** `^6.0.1` — Vite React transform for Vitest
- **@playwright/cli** `^0.1.1` — end-to-end test CLI (installed, not yet configured)
- Test files: `**/__tests__/**/*.{ts,tsx}` and `**/*.{test,spec}.{ts,tsx}`
## Linting & Formatting
- **ESLint** `^8.57.1`
- **Prettier** `^3.8.1`
- **eslint-config-prettier** `^10.1.8` — disables formatting rules that conflict with Prettier
- **eslint-config-next** `14.2.4`
## Git Hooks
- **Husky** `^9.1.7` — git hooks manager
- **lint-staged** `^16.4.0` — runs Prettier on staged files
## Build & Scripts
- `npm run dev` — `next dev`
- `npm run build` — `next build`
- `npm run start` — `next start`
- `npm run lint` — `next lint`
- `npm run lint:fix` — `next lint --fix`
- `npm run format` — `prettier --write .`
- `npm run format:check` — `prettier --check .`
- `npm run type-check` — `tsc --noEmit`
- `npm run test` — `vitest run`
- `npm run test:watch` — `vitest`
- `npm run test:coverage` — `vitest run --coverage`
- `npm run db:seed` — `npx tsx supabase/seed.ts`
## TypeScript Configuration
- **`tsconfig.json`** (root — main app)
- **`tsx`** `^4.15.5` — TypeScript executor for scripts (used by `db:seed`)
## Sub-Application: `apps/public-results`
- **Config**: `apps/public-results/package.json`, `apps/public-results/tsconfig.json`
- **Port**: `3001` (dev and start scripts use `-p 3001`)
- **Dependencies**: `@supabase/supabase-js ^2.43.0`, `next`, `react`, `react-dom`, `clsx`, Tailwind CSS stack
- Excluded from root `tsconfig.json` and Vitest config
## Directory Structure (key paths)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Language & Framework
- **TypeScript** (strict mode off, but explicit types expected on all function signatures and interfaces)
- **Next.js 14 App Router** — all page files live under `app/`, all reusable components under `components/`
- All interactive components begin with `'use client'` as the first line
- Server components are the exception, not the rule — most files are client components
## File & Directory Naming
- Component files: **PascalCase** (e.g., `AppShell.tsx`, `DashboardTab.tsx`, `StatusBadge.tsx`)
- Library/utility files: **camelCase** (e.g., `utils.ts`, `db.ts`, `store.tsx`, `auth.tsx`)
- Engine files under `lib/engines/`: **camelCase** (e.g., `referee.ts`, `weather.ts`, `field.ts`)
- Directories: **lowercase** (e.g., `components/dashboard/`, `components/auth/`, `lib/engines/`)
- Test files: `__tests__/<module-path>/<file>.test.ts` (mirrors source structure)
- The single shared UI component barrel: `components/ui/index.tsx`
- All TypeScript types centralized in `types/index.ts`
## Import Conventions
- Path alias `@/` maps to the project root (configured in `vitest.config.ts` and `tsconfig.json`)
- Type-only imports use `import type { ... }` syntax consistently
- `* as db` namespace import is used for the database layer: `import * as db from '@/lib/db'`
- Named exports are preferred over default exports for all components and utilities
- Barrel re-exports are used for the UI kit: `import { StatusBadge, Modal, Btn } from '@/components/ui'`
## TypeScript Usage
### Type Definitions
- **Union string literals** for enums: `type GameStatus = 'Scheduled' | 'Starting' | 'Live' | 'Halftime' | 'Final' | 'Delayed'`
- **Interfaces** for all database row types (match Supabase schema column names)
- Joined relations are optional fields on the parent interface: `field?: Field`, `referees?: Referee[]`
- `Omit<T, 'id' | 'created_at' | ...>` used in action signatures when inserting new records
- `Partial<T>` used for update functions that accept a subset of fields
- Inline `import('@/types').Field` is used when importing inside callback types to avoid circular issues
### Context Typing
### Record<> Lookups
## Naming Conventions
### Variables & Functions
- **camelCase** for variables, functions, and React hooks
- **PascalCase** for React components, interfaces, and type aliases
- **SCREAMING_SNAKE_CASE** for module-level constants (e.g., `NAV_GROUPS`, `STATUS_CLASS`, `ROLE_BADGE`, `ALL_TABS`)
- Hook names begin with `use` (e.g., `useApp`, `useAuth`)
- Context variables shortened: `AuthCtx`, `Ctx` (not `AuthContext`, `AppContext`)
### Action Naming in Store
- `set` prefix for wholesale replacement: `SET_LOADING`, `SET_GAMES`, `SET_REFEREES`
- `update` prefix for single-item mutation: `UPDATE_GAME`, `UPDATE_REF`, `UPDATE_FIELD`
- `add` prefix for appending: `ADD_GAME`, `ADD_INCIDENT`, `ADD_OPS_LOG`
- `delete` prefix for removal: `DELETE_FIELD`
- Reducer actions use discriminated unions: `{ type: 'ACTION_TYPE'; payload: T }`
### Database Functions (`lib/db.ts`)
- `get<Entity>(eventId)` — fetch list: `getFields`, `getTeams`, `getReferees`
- `get<Entity>By<Criterion>` — filtered fetch: `getGamesByDate`
- `insert<Entity>` — create: `insertGame`, `insertField`, `insertIncident`
- `update<Entity><Property>` — targeted update: `updateGameStatus`, `updateFieldMap`, `updateFieldName`
- `toggle<Entity>Checkin` — boolean flip: `toggleRefCheckin`, `toggleVolCheckin`
- All db functions instantiate a fresh Supabase client per call: `const sb = createClient()`
- Functions return `data ?? []` for lists, `data ?? null` for single rows, `void` for mutations
## Component Patterns
### Tab Components
- Use `useApp()` to access state and actions from the store
- Use `useAuth()` for role-based rendering
- Keep local UI state (`useState`) for modal open/close, form inputs, selected items
- Use `toast.success(...)` / `toast.error(...)` from `react-hot-toast` for user feedback
### Shell & Layout
### Loading State
### Modals
### UI Kit (`components/ui/index.tsx`)
| Component | Purpose |
|---|---|
| `StatusBadge` | Renders game status as a pill using CSS badge classes |
| `Btn` | Button with `variant` (`primary`/`danger`/`success`/`ghost`/`outline`) and `size` (`sm`/`md`/`lg`) |
| `FormField` | Label + children wrapper |
| `Input` | Styled `<input>` with shared base class |
| `Select` | Styled `<select>` — always use solid `bg-[#040e24]`, never transparent (see Gotcha #4 in CONTEXT.md) |
| `Textarea` | Styled `<textarea>` |
| `Card` | `bg-surface-card` bordered container |
| `SectionHeader` | Uppercase condensed label with bottom border |
| `Modal` | Backdrop modal with title bar and optional footer |
| `CoverageBar` | Progress bar for ref/vol coverage stats |
| `Avatar` | Initials circle with color variant |
| `Pill` | Small colored tag |
### `cn()` Utility
## State Management
### Global State: AppProvider (`lib/store.tsx`)
- Uses `useReducer` with a typed `Action` discriminated union
- State covers: event, eventDates, fields, teams, games, referees, volunteers, incidents, medicalIncidents, weatherAlerts, opsLog, lightningActive, lightningSecondsLeft, loading
- Initial load: `Promise.all([...])` fetches all entities in parallel in a `loadAll()` async function inside `useEffect`
- Games reload on `currentDate` change via a separate `useEffect`
- Real-time updates: Supabase `channel('leagueops-realtime')` with `postgres_changes` listeners — all set up in a single `useEffect` returning cleanup `sb.removeChannel(sub)`
- Actions wrapped in `useCallback` with explicit dependency arrays
- Optimistic updates: dispatch the state change immediately, then call db function (or call db then dispatch for creates)
### Auth State: AuthProvider (`lib/auth.tsx`)
- `useEffect` gets initial session, then subscribes to `onAuthStateChange`
- `loadUserRole(userId)` fetches the first active row from `user_roles` after auth
- Exposes derived booleans: `isAdmin`, `isLeagueAdmin`, `isReferee`, `isVolunteer`, `canManage`
## Error Handling
- Supabase calls destructure `{ data, error }` but errors are generally not surfaced — `data ?? []` / `data ?? null` fallbacks are used
- User-facing errors shown via `toast.error(...)` from `react-hot-toast`
- Context hooks throw synchronously if used outside their provider: `throw new Error('useApp must be used within AppProvider')`
- CONTEXT.md notes: use explicit `try/catch` for engine functions — `.catch()` chains can silently break (see Gotcha #6)
- Supabase joined table filters with `.eq('teams.event_id', 1)` do NOT work in the JS client — always fetch IDs first, then use `.in('team_id', teamIds)` (see Gotcha #3)
## Tailwind Patterns
### Design Tokens (custom colors in `tailwind.config.js`)
### Typography Classes
- All UI labels: `font-cond font-black tracking-[.12em] uppercase` (Barlow Condensed via `.font-cond` CSS class)
- Standard bold text: `font-cond font-bold`
- Numbers and scores: `font-mono` (Roboto Mono)
- Common label pattern: `font-cond text-[10px] font-black tracking-[.12em] text-muted uppercase block mb-1.5`
### Common Class Patterns (from CONTEXT.md)
### Status Badge Classes (defined in `app/globals.css`)
- `.badge-live` — green pill
- `.badge-scheduled` — blue pill
- `.badge-starting` — orange pill
- `.badge-halftime` — yellow pill
- `.badge-final` — gray pill
- `.badge-delayed` — red pill
- `.badge-suspended` — rose pill
### Animation Classes (defined in `app/globals.css`)
- `.live-dot` — pulsing ring animation for live indicators
- `.lightning-flash` — flashing red border for lightning delay state
- `.tab-content` — standard `padding: 12px 14px` for tab main area
### Opacity / Alpha Variants
### Grid Layouts
### Section Headers
## Design System Patterns (from CONTEXT.md)
### Color Palette
| Token | Hex | Usage |
|---|---|---|
| `#020810` | surface | Page background |
| `#081428` | card | Card/panel backgrounds |
| `#1a2d50` | border | All borders |
| `#5a6e9a` | muted | Secondary text, labels |
| `#0B3D91` | navy | Primary action color |
| `#D62828` | red | Danger/alert color |
### CSS Custom Properties (`app/globals.css`)
### Global Scrollbar
### Select Option Background
## Linting & Formatting
- **ESLint**: `eslint-config-next` + `eslint-config-prettier`
- **Prettier**: auto-format via `npm run format` or `npm run format:check`
- **Husky + lint-staged**: pre-commit hook runs Prettier on all `*.{ts,tsx,js,jsx,json,css,md}` files
- **Type checking**: `npm run type-check` runs `tsc --noEmit`
- Scripts: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run type-check`
## Multi-Event / Event Scoping
- Every Supabase query must be scoped with `.eq('event_id', eventId)`
- `eventId` flows from URL slug resolution in `app/e/[slug]/page.tsx` → `AppProvider` prop
- Never hardcode `event_id: 1` in new code (legacy code uses this — being migrated)
- `AppProvider` accepts `eventId?: number` defaulting to `1` for backward compatibility
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Overview
## Architectural Pattern
- Global layout and font loading (`app/layout.tsx`)
- API route handlers (`app/api/**/route.ts`) using Server Components / Route Handlers
- Token-gated public pages (`app/join/[token]/` and `app/checkin/[token]/`) that use server-side data fetching at the page level and hand off to client components
- The register page (`app/register/page.tsx`)
## Layers
```
```
## Entry Points
### Primary Application (`app/`)
### Token-gated Public Pages
### Public Results App (`apps/public-results/`)
- `apps/public-results/src/app/layout.tsx` — root layout
- `apps/public-results/src/app/page.tsx` — event listing page
- `apps/public-results/src/app/e/[slug]/page.tsx` — per-event standings/results page (server component, `revalidate = 30`)
## Routing Structure
### Main App (Client-side tab routing)
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
### API Routes (Next.js Route Handlers)
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
## Context Providers
### `AuthProvider` (`lib/auth.tsx`)
- `user` — Supabase `User | null`
- `session` — Supabase `Session | null`
- `userRole` — `UserRole | null` (loaded from `user_roles` table on sign-in)
- `loading` — boolean
- `signIn(email, password)` → `{ error: string | null }`
- `signOut()`
- `isAdmin`, `isLeagueAdmin`, `isReferee`, `isVolunteer` — boolean convenience flags
- `canManage` — `isAdmin || isLeagueAdmin`
### `AppProvider` (`lib/store.tsx`)
- `state` — full `State` object (see State Management below)
- `currentDate` — derived `EventDate | null` from `state.eventDates[state.currentDateIdx]`
- `todayGames` — `state.games` (games for the current date)
- Action functions (see State Management below)
- `eventId` — the current event's numeric ID
## State Management
### Structure
```typescript
```
### Initialization
### Real-time Subscriptions
- `ops_log` → dispatches `ADD_OPS_LOG`
- `incidents` → re-fetches and dispatches `SET_INCIDENTS`
- `games` → re-fetches by current date and dispatches `SET_GAMES`
- `medical_incidents` → re-fetches and dispatches `SET_MEDICAL`
### Lightning Timer
### Actions Exposed via `useApp()`
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
## Engine Layer
### Rules Engine (`lib/engines/rules.ts`)
### Referee Engine (`lib/engines/referee.ts`)
### Field Conflict Engine (`lib/engines/field.ts`)
### Weather Engine (`lib/engines/weather.ts`)
- Lightning: `conditions_code` 200–232 or `lightning_detected` within radius
- Heat: advisory (95°F HI), warning (103°F), emergency (113°F) using Rothfusz equation
- Wind: advisory (25 mph), suspension (40 mph)
- Rain: heavy rain codes 502+
### Eligibility Engine (`lib/engines/eligibility.ts`)
### Unified Engine (`lib/engines/unified.ts`)
## Data Flow
### Read Path (initial load)
```
```
### Write Path (user action)
```
```
### Real-time Path
```
```
### API Route Path (engine trigger)
```
```
### Server-rendered Token Pages
```
```
## Supabase Integration
### Client Configuration
### Realtime Tables
### Row-Level Security
## UI Shell Layout
```
```
## Design System
### Typography
- `--font-barlow` → used as `font-sans` (body text)
- `--font-barlow-condensed` → used as `font-cond` (labels, badges, UI chrome)
- `--font-roboto-mono` → used as `font-mono` (scores, times, data)
### Color Tokens (Tailwind config)
- `surface` — deep navy `#020810` (page background)
- `surface-card` — card background
- `surface-panel` — sidebar background
- `navy` / `navy-light` — primary button color
- `red` — alert/danger `#D62828`
- `muted` — subdued text `#5a6e9a`
- `border` — `#1a2d50`
### Shared UI Components (`components/ui/index.tsx`)
- `StatusBadge` — game status with CSS class mapping
- `Btn` — button with `variant` (primary/danger/success/ghost/outline) and `size` (sm/md/lg)
- `FormField`, `Input`, `Select`, `Textarea` — form primitives
- `Card`, `SectionHeader` — layout primitives
- `Modal` — backdrop + dialog with title/footer slots
- `CoverageBar` — labeled progress bar with color thresholds
- `Avatar` — initials avatar with color variants
- `Pill` — small colored badge (blue/green/red/yellow/gray)
## Multi-Application Structure
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
