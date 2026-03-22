# LeagueOps — Tournament Command Center

A production-ready, real-time tournament operations system for managing youth sports tournaments. Built with **Next.js 14 App Router**, **Supabase (PostgreSQL)**, and **Tailwind CSS**.

---

## Features

| Module                | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| **Dashboard**         | Live ESPN-style field command board with status, scores, refs, check-in progress |
| **Schedule**          | Multi-field schedule table with status cycling, filters, add-game modal          |
| **Player Check-In**   | Per-game check-in with duplicate detection and conflict alerts                   |
| **Rosters**           | CSV upload with preview/commit workflow, team roster viewer                      |
| **Refs & Volunteers** | Grid cards with click-to-toggle check-in, game assignment table                  |
| **Incidents**         | Incident log (8 types) + trainer/medical dispatch with status tracking           |
| **Weather**           | Conditions display + one-click lightning delay with 30-min countdown             |
| **Park Map**          | Drag-and-drop interactive field layout canvas                                    |
| **Scheduling Engine** | Generate balanced schedules from teams/divisions/fields, import to schedule      |
| **Operations Log**    | All actions timestamped and stored in DB, shown in real-time                     |

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Realtime)
- **Styling**: Tailwind CSS
- **Fonts**: Barlow Condensed, Barlow, Roboto Mono
- **Toast notifications**: react-hot-toast
- **Icons**: lucide-react
- **Deployment**: Vercel

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (for deployment)
- Git

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/leagueops.git
cd leagueops
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

#### a) Create a new Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `leagueops`, set a strong database password
3. Choose the region closest to you
4. Wait for it to provision (~2 minutes)

#### b) Run the database schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy the full contents of `supabase/schema.sql`
4. Click **Run** — this creates all 15 tables

#### c) Seed the database

1. Open another **New query** in the SQL Editor
2. Copy the full contents of `supabase/seed.sql`
3. Click **Run** — this populates 2 days of tournament data:
   - 1 event, 8 fields, 14 teams, 83 players
   - 28 games (15 Day 1, 13 Day 2)
   - 10 referees, 10 volunteers
   - Pre-seeded check-ins, incidents, ops log

#### d) Enable Realtime

In Supabase dashboard → **Database** → **Replication** → ensure these tables are enabled:

- `games`
- `player_checkins`
- `incidents`
- `ops_log`
- `weather_alerts`
- `medical_incidents`

The schema.sql already includes the `ALTER PUBLICATION` commands, but double-check in the UI.

#### e) Get your API keys

Go to **Project Settings** → **API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the full application loads with live tournament data.

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — LeagueOps Tournament Command Center"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/leagueops.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Click **Import Git Repository** → select `leagueops`
3. Framework preset auto-detects **Next.js** ✓

### 3. Add environment variables in Vercel

In the Vercel project settings → **Environment Variables**, add:

| Key                             | Value                                                            |
| ------------------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Your Supabase service role key                                   |
| `NEXT_PUBLIC_APP_URL`           | Your Vercel deployment URL (e.g. `https://leagueops.vercel.app`) |

### 4. Deploy

Click **Deploy** — Vercel builds and deploys automatically. Every `git push` to `main` triggers a redeploy.

---

## Google Maps Integration (Optional)

To enable the Park Map satellite view:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Maps JavaScript API**
3. Create an API key, restrict it to your domain
4. Add to `.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
   ```
5. In `components/parkmap/ParkMapTab.tsx`, replace the SVG canvas with the Google Maps component (starter code commented at bottom of file)

---

## Database Schema Overview

```
events
  └── event_dates (Day 1, Day 2, ...)
  └── fields (Field 1–8, drag-and-drop map positions)
  └── teams (14 teams across 4 divisions)
       └── players (83 players with numbers + positions)
  └── games (28 games, joined to fields + teams)
       └── ref_assignments → referees
       └── vol_assignments → volunteers
       └── player_checkins → players (with duplicate detection)
  └── referees (10 officials with grade levels)
  └── volunteers (10 volunteers with roles)
  └── incidents (8 incident types)
  └── medical_incidents (trainer dispatch + status workflow)
  └── weather_alerts (lightning delay protocol)
  └── ops_log (all actions timestamped)
```

---

## CSV Roster Upload Format

Upload → preview → **OK — COMMIT ROSTER** to write to the database.

---

## Key Workflows

### Lightning Delay Protocol

1. Weather tab → **⚡ TRIGGER LIGHTNING DELAY**
2. All active/scheduled games on current day → status `Delayed`
3. 30-minute countdown timer starts
4. Weather alert record written to DB
5. Operations log entry created
6. Click **LIFT LIGHTNING DELAY** to resume all fields

### Player Check-In

1. Check-In tab → select a game
2. Both team rosters load from DB
3. Click any player row to toggle check-in
4. If player already checked into another game at same time → **DUPLICATE ALERT** shown, check-in blocked
5. All check-ins persist to `player_checkins` table

### Scheduling Engine

1. Engine tab → add teams by division
2. Set games per team, duration, rest windows, available fields
3. **GENERATE SCHEDULE** → shows balanced matchup list
4. **IMPORT TO SCHEDULE** → writes all games to DB for current day

### Incident + Trainer Dispatch

1. Incidents tab → fill form → **LOG INCIDENT**
2. Written to `incidents` table, appears in right-panel monitor
3. For injuries → also fill trainer dispatch form → **DISPATCH TRAINER**
4. Written to `medical_incidents`, trainer can update status (Dispatched → On Site → Released → Resolved)
5. Both actions write to ops log with timestamps

---

## Project Structure

```
leagueops/
├── app/
│   ├── layout.tsx              # Root layout with fonts + providers
│   ├── page.tsx                # Entry point → AppShell
│   ├── globals.css             # Global styles
│   └── api/
│       ├── games/              # GET list, POST new, PATCH/DELETE by id
│       ├── fields/             # GET list, POST, PATCH by id
│       ├── teams/              # GET list, POST
│       ├── players/            # GET by team_id, POST (bulk)
│       ├── referees/           # GET list, POST, PATCH by id
│       ├── volunteers/         # GET list, POST, PATCH by id
│       ├── assignments/        # ref_assignments GET/POST/DELETE
│       ├── checkins/           # player_checkins GET/POST/DELETE
│       ├── incidents/          # GET list, POST
│       ├── medical/            # GET list, POST
│       ├── weather/            # GET list, POST
│       └── ops-log/            # GET list, POST
├── components/
│   ├── AppShell.tsx            # Main layout, tab routing
│   ├── TopBar.tsx              # Navigation bar
│   ├── StatusRow.tsx           # Game counts + date picker
│   ├── RightPanel.tsx          # Operations panels
│   ├── ui/index.tsx            # Shared UI primitives
│   ├── dashboard/DashboardTab.tsx
│   ├── schedule/ScheduleTab.tsx
│   ├── checkin/CheckInTab.tsx
│   ├── rosters/RostersTab.tsx
│   ├── refs/RefsTab.tsx
│   ├── incidents/IncidentsTab.tsx
│   ├── weather/WeatherTab.tsx
│   ├── parkmap/ParkMapTab.tsx
│   └── engine/EngineTab.tsx
├── lib/
│   ├── db.ts                   # All Supabase data access functions
│   ├── store.tsx               # React Context global state + actions
│   └── utils.ts                # Helpers, scheduling engine logic
├── types/index.ts              # All TypeScript interfaces
├── supabase/
│   ├── client.ts               # Browser Supabase client
│   ├── server.ts               # Server Supabase client
│   ├── schema.sql              # Full database schema
│   └── seed.sql                # Tournament seed data
└── public/                     # Static assets
```

---

## Seed Data Summary

| Entity         | Count                                                    |
| -------------- | -------------------------------------------------------- |
| Events         | 1 (Knights Lacrosse Summer Invitational 2025)            |
| Event dates    | 2 (Jun 14–15, 2025)                                      |
| Fields         | 8 (Field 1–6, Field 1A, Field 1B)                        |
| Teams          | 14 across U12, U14, U16, U12B                            |
| Players        | 83 with numbers and positions                            |
| Games          | 28 (15 Day 1, 13 Day 2)                                  |
| Referees       | 10 (Grade 5–8)                                           |
| Volunteers     | 10 (Score Table, Clock, Field Marshal, Operations, Gate) |
| Incidents      | 3 (injury, coach incident, spectator issue)              |
| Medical        | 1 (knee injury — Tara Bloom, released)                   |
| Weather Alerts | 1 (heat advisory)                                        |
| Ops Log        | 14 timestamped entries                                   |

---

## License

MIT — free for tournament use. Built for the Knights Lacrosse organization.
