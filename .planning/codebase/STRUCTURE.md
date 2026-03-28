# LeagueOps — Directory Structure

## Top-Level Layout

```
leagueops/
├── app/                        # Next.js App Router (primary application)
├── apps/                       # Additional standalone apps
│   └── public-results/         # Public tournament results viewer
├── components/                 # React components (feature + shell)
├── lib/                        # Business logic, state, engines
├── supabase/                   # DB schema, migrations, clients
├── types/                      # Shared TypeScript types
├── public/                     # Static assets
├── __tests__/                  # Vitest test files
├── .planning/                  # Planning and architecture docs
├── .github/workflows/ci.yml    # GitHub Actions CI config
├── .husky/pre-commit            # Lint-staged pre-commit hook
├── next.config.js              # Next.js configuration
├── tailwind.config.js          # Tailwind + custom design tokens
├── tsconfig.json               # TypeScript config (path aliases)
├── postcss.config.js           # PostCSS (autoprefixer)
├── vitest.config.ts            # Vitest test runner config
├── vitest.setup.ts             # Vitest global setup (jest-dom)
├── .eslintrc.json              # ESLint (next + prettier)
├── .prettierrc                 # Prettier formatting rules
├── .prettierignore             # Prettier ignore patterns
├── .env.example                # Required environment variable template
├── package.json                # Dependencies and npm scripts
└── next-env.d.ts               # Next.js TypeScript declarations
```

---

## `app/` — Next.js App Router

The App Router root. All files here either define route segments or global configuration.

```
app/
├── layout.tsx                  # Root layout — AuthProvider, Toaster, fonts
├── page.tsx                    # Root page — role-based auth routing (client component)
├── globals.css                 # Global CSS — Tailwind directives, custom utility classes
├── register/
│   └── page.tsx                # User registration page
├── join/
│   └── [token]/
│       ├── page.tsx            # Server Component — validates invite token, renders JoinClient
│       └── JoinClient.tsx      # Client Component — referee/volunteer self-registration form
├── checkin/
│   └── [token]/
│       ├── page.tsx            # Server Component — validates QR token, fetches player data
│       └── QRCheckinClient.tsx # Client Component — player self-check-in via QR scan
└── api/                        # API Route Handlers (all use supabase/server.ts)
    ├── admin/
    │   └── create-user/
    │       └── route.ts        # POST — admin creates user account
    ├── assignments/
    │   └── route.ts            # POST/DELETE — ref and volunteer game assignments
    ├── auth/
    │   ├── check-email/
    │   │   └── route.ts        # GET — check if email is already registered
    │   └── program-prefill/
    │       └── route.ts        # GET — pre-fill data for program registration
    ├── checkins/
    │   └── route.ts            # POST/DELETE — player check-in/out for games
    ├── conflicts/
    │   └── route.ts            # GET — open operational conflicts for an event
    ├── eligibility/
    │   └── route.ts            # POST — check player eligibility for a game
    ├── field-engine/
    │   └── route.ts            # POST — run field conflict engine for an event date
    ├── fields/
    │   ├── route.ts            # GET/POST — list fields, create field
    │   └── [id]/
    │       └── route.ts        # PATCH/DELETE — update or delete a field
    ├── games/
    │   ├── route.ts            # GET/POST — list games by event/date, create game
    │   └── [id]/
    │       └── route.ts        # PATCH/DELETE — update or delete a game
    ├── incidents/
    │   └── route.ts            # GET/POST — incident log entries
    ├── join/
    │   └── route.ts            # POST — process referee/volunteer registration
    ├── lightning/
    │   └── route.ts            # POST — trigger or lift lightning delay
    ├── medical/
    │   └── route.ts            # GET/POST/PATCH — trainer/medical incident records
    ├── ops-log/
    │   └── route.ts            # GET/POST — operations log entries
    ├── payment-entries/
    │   └── route.ts            # Payment entry records
    ├── players/
    │   └── route.ts            # GET/POST — player records
    ├── referee-engine/
    │   └── route.ts            # POST — run referee engine; GET — find available refs
    ├── referees/
    │   ├── route.ts            # GET/POST — list referees, create referee
    │   └── [id]/
    │       └── route.ts        # PATCH — update referee
    ├── registration-fees/
    │   ├── route.ts            # Registration fee configuration
    │   └── [id]/
    │       └── route.ts        # Per-fee operations
    ├── rules/
    │   ├── route.ts            # GET — load event rules
    │   └── changes/
    │       └── route.ts        # GET — rule change audit log
    ├── team-payments/
    │   ├── route.ts            # Team payment records
    │   └── [id]/
    │       └── route.ts        # Per-team payment operations
    ├── teams/
    │   └── route.ts            # GET/POST — team records
    ├── volunteers/
    │   ├── route.ts            # GET/POST — list volunteers, create volunteer
    │   └── [id]/
    │       └── route.ts        # PATCH — update volunteer
    ├── weather/
    │   └── route.ts            # GET — weather alerts for an event
    └── weather-engine/
        └── route.ts            # POST — run weather engine for a complex
```

---

## `components/` — React Components

Organized by feature domain. All are client components (`'use client'`) unless noted. Consume state from `useApp()` and `useAuth()`.

```
components/
├── AppShell.tsx                # Main operator shell — tab state, layout (TopBar + StatusRow + main + RightPanel)
├── TopBar.tsx                  # Horizontal nav bar — grouped menus with dropdowns, user badge, sign out
├── StatusRow.tsx               # Live status bar — game status counts, date selector tabs
├── RightPanel.tsx              # Persistent sidebar — coverage bars, incident monitor, ops log, conflicts
│
├── ui/
│   └── index.tsx               # Shared UI primitives: StatusBadge, Btn, FormField, Input, Select, Textarea,
│                               #   Card, SectionHeader, Modal, CoverageBar, Avatar, Pill
│
├── auth/
│   ├── LoginPage.tsx           # Email/password login form
│   ├── RegisterPage.tsx        # New user registration form
│   ├── UserManagement.tsx      # Admin tab: manage user accounts and roles
│   ├── QRCodesPanel.tsx        # Admin tab: generate and display QR codes for players
│   ├── RefereePortal.tsx       # Role-specific view for referee users
│   └── VolunteerPortal.tsx     # Role-specific view for volunteer users
│
├── checkin/
│   └── CheckInTab.tsx          # Game check-in: scan QR, player check-in, eligibility checks
│
├── conflicts/
│   └── ConflictsTab.tsx        # Operational conflicts viewer with resolution actions
│
├── dashboard/
│   └── DashboardTab.tsx        # Field board — overview of all fields and current game status
│
├── engine/
│   ├── CommandCenter.tsx       # ⚡ Command Center — unified engine control, ops alerts, shift handoffs
│   └── EngineTab.tsx           # Schedule generator engine — auto-generate game schedules
│
├── events/
│   └── EventPicker.tsx         # Event selection / creation screen (shown before AppShell)
│
├── fields/
│   └── FieldsTab.tsx           # Field management — create, edit, delete fields; complex management
│
├── incidents/
│   └── IncidentsTab.tsx        # Incident log, medical/trainer dispatch, medical status tracking
│
├── parkmap/
│   └── ParkMapTab.tsx          # Visual drag-and-drop park/field map editor
│
├── payments/
│   └── PaymentsTab.tsx         # Payment tracking — registration fees, team payment status
│
├── programs/
│   ├── ProgramDashboard.tsx    # Dashboard for program_leader role users
│   ├── ProgramApprovals.tsx    # Admin tab: approve/reject program leader accounts
│   ├── RegistrationConfig.tsx  # Program registration configuration
│   └── PendingApprovalScreen.tsx # Screen shown to inactive program leaders awaiting approval
│
├── refs/
│   └── RefsTab.tsx             # Referees and volunteers: check-in, assignment, availability
│
├── reports/
│   └── ReportsTab.tsx          # Reports: export/view event statistics and summaries
│
├── rosters/
│   └── RostersTab.tsx          # Team roster management: import from Excel, view/edit players
│
├── rules/
│   └── RulesTab.tsx            # Event rules management: view, override, reset rules by category
│
├── schedule/
│   └── ScheduleTab.tsx         # Schedule view/edit: game list, status updates, score entry
│
├── settings/
│   ├── EventSetupTab.tsx       # Event configuration: dates, name, location, logo
│   └── LeagueSettingsTab.tsx   # League-level settings
│
└── weather/
    └── WeatherTab.tsx          # Weather monitoring: run engine, view readings, manage delays
```

---

## `lib/` — Business Logic

```
lib/
├── auth.tsx                    # AuthProvider context + useAuth hook
│                               # Manages Supabase session, loads user_roles row
├── store.tsx                   # AppProvider context + useApp hook
│                               # useReducer state + all action functions + real-time subscriptions
├── db.ts                       # All Supabase data access functions (client-side)
│                               # Grouped by entity: events, fields, teams, players, games,
│                               #   referees, volunteers, checkins, incidents, medical,
│                               #   weather, ops_log, complexes, field_blocks, conflicts
├── utils.ts                    # Utility functions: cn() (clsx+twMerge), logTypeColor()
│
└── engines/
    ├── rules.ts                # Rules engine — DB-backed rules with 30s in-memory cache
    │                           # Exports: loadRules(), getRules(), getRule(), getRuleNum(),
    │                           #   getRuleBool(), getWeatherThresholds(), getRefereeRules(),
    │                           #   getSchedulingRules(), updateRule(), resetRule()
    ├── referee.ts              # Referee conflict engine — detects double-booking, unavailability,
    │                           #   missing refs, max games exceeded
    │                           # Exports: runRefereeEngine(), findAvailableRefs()
    ├── field.ts                # Field conflict engine — detects overlaps, blocks, cascades
    │                           # Exports: runFieldConflictEngine(), applyResolution(), runFullConflictScan()
    ├── weather.ts              # Weather monitoring engine — OpenWeatherMap + thresholds
    │                           # Exports: runWeatherEngine(), evaluateAlerts(), calcHeatIndex(),
    │                           #   getMockWeather(), getLatestReading(), getReadingHistory(),
    │                           #   checkLightningStatus(), liftLightningDelay(),
    │                           #   windDirection(), conditionIcon()
    ├── eligibility.ts          # Player eligibility engine — play-down rules + multi-game approval
    │                           # Exports: checkPlayerEligibility(), approveMultiGame(),
    │                           #   denyMultiGame(), getPendingApprovals(), getAllPendingApprovals()
    └── unified.ts              # Unified engine — orchestrates referee + field + weather engines
                                # Exports: runUnifiedEngine(), resolveAlert(), generateShiftHandoff()
```

---

## `types/` — TypeScript Types

```
types/
└── index.ts                    # All application types in one file
```

Types are organized in sections within `types/index.ts`:

**Enum/union types:** `GameStatus`, `Division`, `IncidentType`, `VolunteerRole`, `InjuryType`, `MedicalStatus`, `LogType`

**Core DB row types** (match Supabase schema exactly): `Event`, `EventDate`, `Field`, `Team`, `Player`, `Game`, `Referee`, `RefAssignment`, `Volunteer`, `VolAssignment`, `PlayerCheckin`, `Incident`, `MedicalIncident`, `WeatherAlert`, `OpsLogEntry`

**UI/derived types:** `FieldBoardCard`, `StatusCounts`, `CoverageStats`, `SchedulingEngineInput`, `GeneratedGame`, `RosterRow`

**Phase 1 types** (complexes, field blocks, conflicts): `Complex`, `FieldBlock`, `FieldBlockReason`, `Season`, `RefereeAvailability`, `ConflictType`, `ConflictSeverity`, `ResolutionOption`, `OperationalConflict`

**Phase 3 types** (weather engine): `WeatherReading`, `LightningEvent`, `HeatProtocolLevel`

**Payment types:** `PaymentStatus`, `PaymentMethod`, `RegistrationFee`, `TeamPayment`, `PaymentEntry`, `WeatherEngineResult`

---

## `supabase/` — Database

```
supabase/
├── client.ts                   # Browser Supabase client (createBrowserClient from @supabase/ssr)
├── server.ts                   # SSR Supabase client (createServerClient, reads from cookies)
│
├── schema.sql                  # Complete baseline schema — all tables, indexes, RLS, realtime
├── seed.sql                    # Seed data for development
│
└── migrations (applied in order):
    ├── phase1_migration.sql     # Complexes, field_blocks, ref_availability, operational_conflicts
    ├── phase3_migration.sql     # Weather engine tables (weather_readings, lightning_events, etc.)
    ├── phase3b_rules.sql        # event_rules table, rule_changes table
    ├── phase4_migration.sql     # Field conflict engine tables (conflict_engine_runs)
    ├── phase5_command_center.sql # ops_alerts, shift_handoffs tables
    ├── multi_event.sql          # Multi-event support changes
    ├── event_setup.sql          # Event setup/configuration fields
    ├── event_logo.sql           # Logo URL field on events
    ├── field_map_enhancements.sql # map_rotation, map_color, map_opacity, map_shape on fields
    ├── payments.sql             # registration_fees, team_payments, payment_entries tables
    ├── player_cards.sql         # player_qr_tokens table for QR check-in
    ├── player_eligibility.sql   # eligibility_violations, multi_game_approvals tables
    ├── program_registration.sql # programs table, registration_invites, program_leader role
    ├── registration_config.sql  # Registration configuration fields
    ├── registration_invites.sql # Invite token management
    ├── ref_requirements.sql     # Referee requirements per game/division
    ├── add_coach_role.sql       # Coach role and team association fields
    ├── auth_migration.sql       # user_roles table, auth integration
    └── storage_rls.sql          # Supabase Storage bucket RLS policies
```

---

## `apps/public-results/` — Public Results Viewer

A standalone Next.js application. Not imported by the root app. Has its own dependencies and configuration.

```
apps/public-results/
├── next.config.js              # Next.js config for the sub-app
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.example                # Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
└── src/
    ├── app/
    │   ├── layout.tsx          # Root layout for public app
    │   ├── page.tsx            # Event listing page
    │   ├── not-found.tsx       # 404 page
    │   ├── globals.css
    │   └── e/
    │       └── [slug]/
    │           └── page.tsx    # Event results page (ISR, revalidate=30)
    └── lib/
        ├── supabase.ts         # Supabase client for public-results (read-only)
        └── data.ts             # Data fetching: getPublicEventBySlug(), getPublicGames(),
                                #   getPublicTeams(), computeStandings()
```

---

## `public/` — Static Assets

```
public/
└── roster-template.xlsx        # Excel roster import template (downloadable by users)
```

---

## `__tests__/` — Tests

```
__tests__/
└── lib/
    └── utils.test.ts           # Tests for lib/utils.ts utility functions
```

Test stack: **Vitest** + **@testing-library/react** + **@testing-library/jest-dom** + **jsdom**.

---

## Key File Locations Quick Reference

| Purpose                   | File                          |
| ------------------------- | ----------------------------- |
| Application entry point   | `app/page.tsx`                |
| Root layout + providers   | `app/layout.tsx`              |
| Auth context              | `lib/auth.tsx`                |
| Global app state          | `lib/store.tsx`               |
| All Supabase queries      | `lib/db.ts`                   |
| Shared types              | `types/index.ts`              |
| Shared UI primitives      | `components/ui/index.tsx`     |
| Main shell                | `components/AppShell.tsx`     |
| Top navigation            | `components/TopBar.tsx`       |
| Right sidebar             | `components/RightPanel.tsx`   |
| Rules engine              | `lib/engines/rules.ts`        |
| Referee conflict engine   | `lib/engines/referee.ts`      |
| Field conflict engine     | `lib/engines/field.ts`        |
| Weather engine            | `lib/engines/weather.ts`      |
| Player eligibility engine | `lib/engines/eligibility.ts`  |
| Unified engine            | `lib/engines/unified.ts`      |
| Browser Supabase client   | `supabase/client.ts`          |
| Server Supabase client    | `supabase/server.ts`          |
| DB schema                 | `supabase/schema.sql`         |
| Tailwind config + tokens  | `tailwind.config.js`          |
| TypeScript path aliases   | `tsconfig.json` (`@/` → root) |

---

## Naming Conventions

### Files

- **Page components**: `page.tsx` (required by App Router)
- **Client components alongside server pages**: `[Name]Client.tsx` (e.g., `JoinClient.tsx`, `QRCheckinClient.tsx`)
- **Feature tab components**: `[Feature]Tab.tsx` (e.g., `ScheduleTab.tsx`, `RefsTab.tsx`)
- **Layout/chrome components**: descriptive noun (e.g., `AppShell.tsx`, `TopBar.tsx`, `RightPanel.tsx`)
- **Auth/role-specific views**: `[Role]Portal.tsx`, `[Name]Page.tsx`
- **API routes**: `route.ts` (required by App Router)
- **Engine modules**: kebab-case in `lib/engines/` (e.g., `referee.ts`, `field.ts`)

### Exports

- Context providers: `export function [Name]Provider`
- Context hooks: `export function use[Name]`
- DB functions: `export async function [verb][Entity]` (e.g., `getGames`, `insertGame`, `updateGameStatus`)
- Engine functions: `export async function run[Engine]Engine`

### TypeScript

- Interface names: PascalCase matching the entity name (e.g., `Game`, `Referee`, `WeatherAlert`)
- Union type names: PascalCase with descriptive suffix (e.g., `GameStatus`, `LogType`, `ConflictSeverity`)
- Component prop interfaces: `interface Props` (local to the file) or `interface [Name]Props`

### CSS / Tailwind

- Custom utility classes defined in `app/globals.css`
- Font utility aliases: `font-cond` (Barlow Condensed), `font-sans` (Barlow), `font-mono` (Roboto Mono)
- Color token aliases: `bg-surface`, `bg-surface-card`, `bg-surface-panel`, `text-muted`, `border-border`, `bg-navy`, `bg-red`
- Custom badge classes: `badge-scheduled`, `badge-live`, `badge-final`, etc.
- Custom animation: `lightning-flash`, `live-dot`
