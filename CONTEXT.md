# LeagueOps — Developer Context

> **Read this at the start of every Claude Code session.**
> This file contains everything needed to work on LeagueOps without re-explaining the project.

---

## Project Overview

LeagueOps is a real-time tournament operations platform for youth lacrosse (and other sports). It is a multi-tenant SaaS app where a super admin creates events (tournaments, seasons, clinics, leagues), and each event is a fully isolated workspace.

**Live URL:** https://leagueops.vercel.app  
**GitHub:** https://github.com/spacker15/leagueops  
**Supabase Project ID:** rzzzwrqbubptnlwfesjv  
**Supabase URL:** https://rzzzwrqbubptnlwfesjv.supabase.co

---

## Tech Stack

| Layer     | Technology                                   |
| --------- | -------------------------------------------- |
| Framework | Next.js 14 App Router                        |
| Database  | Supabase (PostgreSQL + Realtime)             |
| Auth      | Supabase Auth                                |
| Hosting   | Vercel (auto-deploy on push to main)         |
| Styling   | Tailwind CSS + custom CSS variables          |
| Fonts     | Barlow Condensed (UI), Roboto Mono (numbers) |
| State     | React Context (AppProvider + AuthProvider)   |

---

## Design System

**Color palette (defined in `tailwind.config.js` and `app/globals.css`):**

- Background: `#020810` (near-black)
- Card: `#081428` (dark navy)
- Border: `#1a2d50`
- Muted text: `#5a6e9a`
- Navy accent: `#0B3D91`
- Red accent: `#D62828`

**Typography:**

- All UI labels: `font-cond font-black tracking-[.12em] uppercase` (Barlow Condensed)
- Numbers/scores: `font-mono` (Roboto Mono)
- Standard text: `font-cond font-bold`

**Common class patterns:**

```
inp = 'w-full bg-[#081428] border border-[#1a2d50] text-white px-3 py-2.5 rounded-lg text-[13px] outline-none focus:border-blue-400'
lbl = 'font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'
```

**Status badges:** Use CSS classes `.badge-live`, `.badge-scheduled`, `.badge-halftime`, `.badge-final`, `.badge-delayed` (defined in `globals.css`).

---

## Architecture

### Multi-Event / Multi-Tenancy

- Each **event** (tournament, season, etc.) is a fully isolated workspace
- URL pattern: `leagueops.vercel.app/e/[slug]` (e.g. `/e/knights-lacrosse-2025`)
- Root `/` shows the **EventPicker** — a home screen listing all events
- `app/e/[slug]/page.tsx` is the dynamic event route
- The **AppProvider** receives `eventId` as a prop — all data queries are scoped to this ID
- **Super admin** (role = `super_admin`) sees all events and can create new ones
- **Admin / league_admin** see only events they're assigned to via `event_admins` table

### Authentication Flow

```
Login → page.tsx checks role:
  super_admin / admin / league_admin → EventPicker (/)
  referee → RefereePortal
  volunteer → VolunteerPortal
  program_leader (active) → ProgramDashboard
  program_leader (inactive) → PendingApprovalScreen

/e/[slug] → resolves slug → loads AppProvider(eventId) → AppShell
```

### Roles

| Role             | Access                                                  |
| ---------------- | ------------------------------------------------------- |
| `super_admin`    | Everything + create events                              |
| `admin`          | Full app for assigned events                            |
| `league_admin`   | Full app except Users tab                               |
| `referee`        | RefereePortal — self check-in + game roster             |
| `volunteer`      | VolunteerPortal — self check-in + game roster           |
| `program_leader` | ProgramDashboard — manage their program's teams/rosters |

---

## File Structure

```
app/
  page.tsx                    ← Root — auth routing → EventPicker or role portal
  layout.tsx                  ← AuthProvider wrapper only (no AppProvider)
  globals.css                 ← Design tokens, badge classes, scrollbar
  e/[slug]/page.tsx           ← Dynamic event route — resolves slug → AppShell
  register/page.tsx           ← Public program registration
  checkin/[token]/page.tsx    ← Public player QR check-in
  api/                        ← API routes (all use event_id param or hardcode 1)

components/
  AppShell.tsx                ← Main shell — nav + tab routing
  TopBar.tsx                  ← Grouped dropdown nav (SCHEDULE▾, GAME DAY▾, etc.)
  StatusRow.tsx               ← Game status counts + date nav
  RightPanel.tsx              ← Live sidebar (coverage bars, incidents, ops log)

  events/
    EventPicker.tsx           ← Home screen — event cards + create form (super admin)

  dashboard/DashboardTab.tsx  ← Field command board — scoreboard-style field cards
  schedule/ScheduleTab.tsx    ← Schedule with board/table view + conflict scan
  checkin/CheckInTab.tsx      ← Check-In + QR codes + player cards (combined)
  rosters/RostersTab.tsx      ← NFYLL format CSV import, team viewer, export
  refs/RefsTab.tsx            ← Drag-drop ref/vol assignment board
  conflicts/ConflictsTab.tsx  ← Field conflict engine + field blocks
  incidents/IncidentsTab.tsx  ← Smart dropdowns: field→game→team→player
  weather/WeatherTab.tsx      ← Weather engine + lightning/heat alerts
  parkmap/ParkMapTab.tsx      ← Interactive field map — drag/resize/rotate/color
  engine/
    EngineTab.tsx             ← Schedule generator
    CommandCenter.tsx         ← Phase 5 — unified ops center
  rules/RulesTab.tsx          ← 35 configurable rules (thresholds, flags)

  auth/
    LoginPage.tsx             ← Login form
    RefereePortal.tsx         ← Ref self-checkin + game roster tabs
    VolunteerPortal.tsx       ← Volunteer self-checkin + game roster tabs
    RegisterPage.tsx          ← Public program registration wizard
    UserManagement.tsx        ← Admin CRUD for users/roles
    QRCodesPanel.tsx          ← QR token management (legacy, merged into CheckInTab)

  programs/
    EventPicker.tsx           ← (see events/ above)
    ProgramDashboard.tsx      ← Program leader portal — teams, rosters
    ProgramApprovals.tsx      ← Admin — approve/reject programs + teams + form config
    PendingApprovalScreen.tsx ← Shown to unapproved program leaders
    RegistrationConfig.tsx    ← Admin — configure registration divisions + questions

  settings/
    EventSetupTab.tsx         ← Full event configuration (General/Schedule/Public/etc.)
    LeagueSettingsTab.tsx     ← Legacy — logo + colors (superseded by EventSetupTab)

lib/
  auth.tsx                    ← AuthContext, useAuth hook, AppRole types
  store.tsx                   ← AppProvider — loads all event data, realtime subscriptions
  db.ts                       ← All Supabase data access functions
  utils.ts                    ← Game status helpers, schedule generator
  engines/
    referee.ts                ← Referee conflict detection
    weather.ts                ← Weather engine (OpenWeatherMap + mock)
    field.ts                  ← Field conflict engine
    eligibility.ts            ← Player eligibility (play-down rule, multi-game approval)
    rules.ts                  ← Rules engine (load/cache event_rules)
    unified.ts                ← Phase 5 — runs all engines, creates ops_alerts

types/index.ts                ← All TypeScript interfaces
supabase/
  client.ts, server.ts        ← Supabase client setup
  schema.sql                  ← Original 15-table schema
  seed.sql                    ← Tournament seed data
  [migration].sql             ← Run these IN ORDER in Supabase SQL Editor
```

---

## Database — Key Tables

| Table                                 | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `events`                              | Core event config — sport, dates, settings, logo, colors |
| `event_dates`                         | Individual days within an event                          |
| `event_admins`                        | Which users manage which events                          |
| `fields`                              | Fields with map_x/y/w/h/rotation/color                   |
| `teams`                               | Teams per event                                          |
| `players`                             | Players per team — usa_lacrosse_number, home_division    |
| `games`                               | Games — field, time, status, score                       |
| `referees` / `volunteers`             | Staff records                                            |
| `ref_assignments` / `vol_assignments` | Game assignments                                         |
| `player_checkins`                     | Who is checked in to each game                           |
| `player_qr_tokens`                    | QR codes for player check-in                             |
| `multi_game_approvals`                | Pending approvals for players in 2+ games/day            |
| `eligibility_violations`              | Play-down rule violations                                |
| `incidents` / `medical_incidents`     | Incident log                                             |
| `weather_alerts`                      | Weather alerts                                           |
| `ops_log`                             | Realtime operations feed                                 |
| `ops_alerts`                          | Phase 5 — prioritized alerts from engines                |
| `shift_handoffs`                      | Shift handoff summaries                                  |
| `programs`                            | Program organizations (e.g. Fleming Island)              |
| `program_leaders`                     | User → program links                                     |
| `program_teams`                       | Program → team links per event                           |
| `team_registrations`                  | Team registration requests                               |
| `registration_divisions`              | Available divisions for registration                     |
| `registration_questions`              | Custom registration form questions                       |
| `user_roles`                          | User → role mapping per event                            |
| `event_rules`                         | 35 configurable rules per event                          |
| `sports`                              | Sports lookup table                                      |

**Important:** Most tables have `event_id` — all queries must be scoped to the active event. The store passes `eventId` as a prop from the URL slug resolution.

---

## SQL Migrations (run in this order)

1. `schema.sql` — base schema
2. `seed.sql` — seed data for event 1
3. `auth_migration.sql` — user_roles, QR tokens, portal_checkins
4. `phase1_migration.sql` — complexes, field_blocks, referee_availability
5. `phase3_migration.sql` — weather tables
6. `phase3b_rules.sql` — event_rules (35 default rules)
7. `phase4_migration.sql` — conflict engine tables
8. `player_cards.sql` — usa_lacrosse_number, birthdate on players
9. `player_eligibility.sql` — division_hierarchy, eligibility_violations, multi_game_approvals
10. `program_registration.sql` — programs, program_leaders, team_registrations
11. `registration_config.sql` — registration_divisions, registration_questions
12. `phase5_command_center.sql` — ops_alerts, shift_handoffs
13. `event_logo.sql` — logo_url, colors, park map columns on events
14. `event_setup.sql` — 40+ settings columns on events, sports table
15. `field_map_enhancements.sql` — rotation, color, opacity on fields
16. `multi_event.sql` — slug, owner_id, event_admins, super_admin role

---

## Navigation Structure (TopBar — GroupedNav)

```
DASHBOARD          → /dashboard (direct)
SCHEDULE ▾         → Schedule, Conflicts, Sched Engine
GAME DAY ▾         → Check-In & QR, Incidents, Weather
PEOPLE ▾           → Rosters, Refs & Vols, Park Map
⚡ COMMAND         → /command (direct)
ADMIN ▾            → Rules, Programs, Users, Settings
```

---

## Key Engines

### Referee Engine (`lib/engines/referee.ts`)

Detects: ref_double_booked, ref_unavailable, max_games_exceeded, missing_referee  
API: `POST /api/referee-engine { event_date_id }`

### Field Conflict Engine (`lib/engines/field.ts`)

Detects: field_overlap, field_blocked, schedule_cascade, missing_referee  
API: `POST /api/field-engine { event_date_id }`

### Weather Engine (`lib/engines/weather.ts`)

Uses OpenWeatherMap or mock data. Detects lightning, heat, wind.  
API: `POST /api/weather-engine { complex_id }`

### Eligibility Engine (`lib/engines/eligibility.ts`)

Rules: no play-down (players can't play below registered division), multi-game requires opposing coach approval.  
API: `POST /api/eligibility { action: 'check'|'approve'|'deny', ... }`

### Unified Engine (`lib/engines/unified.ts`)

Runs all three engines simultaneously, creates `ops_alerts`, escalates unresolved alerts.  
API called from Command Center "RUN ALL ENGINES" button.

---

## Player Check-In Flow

1. Admin clicks "GEN QR" in Check-In tab → tokens auto-generated for all players
2. Player cards show: jersey #, name, team, division, USA Lax #, QR code
3. QR → `leagueops.vercel.app/checkin/[token]` → player sees their games → taps to check in
4. Ref/volunteer can also tap player rows in list view or card view
5. 2nd game same day → eligibility engine creates approval request → ref/vol approves with optional coach name

---

## Program Registration Flow

1. Program director goes to `/register` → 3-step wizard (account → program → teams)
2. Creates Supabase Auth account + program record (status: pending) + team_registrations
3. Admin approves program → teams auto-created → program leader account activated
4. Program leader logs in → ProgramDashboard → manage teams, upload rosters, register more teams

---

## Recurring Issues / Gotchas

1. **`lib/auth.tsx` AppRole type** — must include `'super_admin' | 'admin' | 'league_admin' | 'referee' | 'volunteer' | 'player' | 'program_leader'`. Gets lost when auth.tsx isn't included in updates.

2. **`UserRole` interface** — must include `program_id: number | null` and `event_id: number | null`.

3. **Supabase joined table filters** — `eq('teams.event_id', 1)` on a join DOES NOT WORK in the JS client. Always fetch team IDs first, then use `.in('team_id', teamIds)`.

4. **Dropdown visibility** — inputs using `bg-white/5` (transparent) make `<option>` elements invisible. Always use a solid color like `bg-[#081428]`.

5. **Storage RLS** — the `program-assets` bucket needs an open RLS policy. If logo uploads fail with "row level security" error, run:

```sql
CREATE POLICY "Public access program-assets" ON storage.objects
FOR ALL USING (bucket_id = 'program-assets')
WITH CHECK (bucket_id = 'program-assets');
```

6. **`resetAllRules` in `lib/engines/rules.ts`** — the `.catch()` chain can break. Use explicit try/catch.

---

## Environment Variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://rzzzwrqbubptnlwfesjv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_APP_URL=https://leagueops.vercel.app
OPENWEATHER_API_KEY=<optional — weather engine uses mock if missing>
```

---

## What's NOT Built Yet (Backlog)

- [ ] Reports dashboard (game results, standings, stat leaders)
- [ ] Bracket / playoff draw system
- [ ] Stripe payments for program registration
- [ ] Pool standings auto-calculation
- [ ] Google Maps park map integration (embed works, satellite overlay WIP)
- [ ] Push notifications for alerts
- [ ] Multi-day event scheduling across date ranges
- [ ] Public-facing results page at `/e/[slug]/results`
