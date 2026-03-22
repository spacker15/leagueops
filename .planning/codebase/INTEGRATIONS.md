# LeagueOps — External Integrations

## Database: Supabase (PostgreSQL)

**Package**: `@supabase/supabase-js ^2.99.2`, `@supabase/ssr ^0.9.0`

Supabase is the sole database and backend-as-a-service. It provides PostgreSQL, Auth, Realtime, and Storage.

### Connection

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project endpoint (public, used in both browser and server clients) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon (public) key — used by all client-side queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — bypasses RLS; used in admin/server-only operations |

- Browser client: `supabase/client.ts` — `createBrowserClient`
- Server client: `supabase/server.ts` — `createServerClient` with `next/headers` cookie store
- Sub-app (`apps/public-results`) uses its own `.env.example` pointing to the same Supabase project with anon-only access

### Database Schema

All tables are defined across multiple SQL migration files in `supabase/`:

**Core tables** (`supabase/schema.sql`):
- `events`, `event_dates`
- `fields`
- `teams`, `players`
- `games`
- `referees`, `ref_assignments`
- `volunteers`, `vol_assignments`
- `player_checkins`
- `incidents`, `medical_incidents`
- `weather_alerts`
- `ops_log`

**Phase 1 migration** (`supabase/phase1_migration.sql`):
- `complexes` — venue groupings with GPS coordinates for weather monitoring
- `field_blocks` — field unavailability windows
- `seasons`
- `referee_availability` — per-referee date/time availability windows
- `operational_conflicts` — conflict detection log (referee double-booking, field overlaps, etc.)

**Auth & Roles** (`supabase/auth_migration.sql`):
- `user_roles` — links `auth.users` UUIDs to app roles (`admin`, `league_admin`, `referee`, `volunteer`, `player`, `program_leader`, `coach`)
- `player_qr_tokens` — unique QR scan tokens per player per event
- `qr_checkin_log` — audit log of every QR scan attempt
- `portal_checkins` — ref/volunteer self-check-in audit log

**Payments** (`supabase/payments.sql`):
- `registration_fees` — fee config per event/division
- `team_payments` — per-team payment record with status (`pending`, `partial`, `paid`, `waived`, `refunded`)
- `payment_entries` — individual payment audit entries (check, cash, bank transfer, waived)

**Program Registration** (`supabase/program_registration.sql`):
- `programs` — organizations/clubs registering teams (with approval workflow)
- `program_leaders` — links users to programs
- `program_teams` — links programs to their teams per event
- `team_registrations` — team registration requests pending admin review

**Other migrations**:
- `supabase/add_coach_role.sql` — adds `coach` to `user_roles_role_check`
- `supabase/event_logo.sql` — logo URL column on `events`
- `supabase/event_setup.sql` — event setup helpers
- `supabase/field_map_enhancements.sql` — `map_rotation`, `map_color`, `map_opacity`, `map_shape` on `fields`
- `supabase/multi_event.sql` — multi-event support columns
- `supabase/phase3_migration.sql`, `phase3b_rules.sql`, `phase4_migration.sql`, `phase5_command_center.sql`
- `supabase/player_cards.sql`, `player_eligibility.sql`
- `supabase/ref_requirements.sql`
- `supabase/registration_config.sql`
- `supabase/registration_invites.sql` — invite link tokens for ref/volunteer self-registration
- `supabase/storage_rls.sql` — Storage bucket policies

### Row Level Security

- **Most tables**: permissive "Allow all" policy (designed for single-org internal use; comment notes auth can be added for production)
- **Payment tables**: `authenticated` role for reads, `service_role` for writes
- **`user_roles`**: users can read their own role; admins can manage all roles

### Supabase Realtime

Real-time PostgreSQL change subscriptions are enabled on the following tables (via `ALTER PUBLICATION supabase_realtime`):
- `games`
- `player_checkins`
- `incidents`
- `ops_log`
- `weather_alerts`
- `medical_incidents`
- `complexes`
- `field_blocks`
- `operational_conflicts`
- `programs`

The global store (`lib/store.tsx`) subscribes to `games`, `incidents`, `medical_incidents`, and `ops_log` via `sb.channel('leagueops-realtime')` using `postgres_changes`.

### Supabase Storage

Bucket: **`program-assets`** (public bucket)

Policies (`supabase/storage_rls.sql`):
- Public read access (`TO public`)
- Authenticated users can insert, update, delete

Used for: program/club logo uploads and photos.

### Supabase Auth

- Supabase's built-in email/password auth (`signInWithPassword`)
- Auth state managed via `lib/auth.tsx` (`AuthProvider`)
- `onAuthStateChange` listener used for session sync
- `user_roles` table extends auth.users with application-specific roles
- `persistSession: false` on the server client to avoid cookie conflicts

---

## Weather: OpenWeatherMap API

**Endpoint used**: `https://api.openweathermap.org/data/2.5/weather` (Current Weather API)

Referenced in code comments as "One Call API 3.0" but the actual HTTP call in `lib/engines/weather.ts` uses the `/data/2.5/weather` endpoint.

| Variable | Usage |
|---|---|
| `OPENWEATHER_API_KEY` | Server-side API key (used in `app/api/weather-engine/route.ts`) |
| `NEXT_PUBLIC_OPENWEATHER_KEY` | Optional public key fallback (used in `lib/engines/weather.ts`) |

**Behavior**:
- Fetches live weather per `complexes.lat` / `complexes.lng`
- Falls back to mock data (realistic Jacksonville June weather) if no API key or GPS coordinates are missing
- Caches responses for 5 minutes via `{ next: { revalidate: CACHE_MINUTES * 60 } }`
- Weather readings stored to `weather_readings` table in Supabase
- Lightning detection uses OWM condition codes 200–232 (thunderstorm group)
- Rain detection uses OWM condition codes 500–531

**Auto-actions triggered**:
- Lightning within configurable radius → sets all field games to `Delayed`, inserts `lightning_events` record
- Heat index thresholds → advisory (95°F), warning (103°F), emergency (113°F)
- High wind thresholds → advisory (25 mph), suspend (40 mph)

**Route**: `app/api/weather-engine/route.ts` (POST to run engine, GET for latest reading or history)

---

## Google Fonts

Loaded via Next.js `next/font/google` — no external API key required. Fonts are fetched at build time and self-hosted.

Fonts loaded in `app/layout.tsx`:
- **Barlow** — primary sans-serif
- **Barlow Condensed** — display/condensed headers
- **Roboto Mono** — monospace/data display

---

## Planned / Referenced Integrations

### Vercel (Deployment target)

The sub-app `.env.example` (`apps/public-results/.env.example`) references `NEXT_PUBLIC_MAIN_APP_URL=https://leagueops.vercel.app`, indicating Vercel as the deployment platform. No Vercel-specific configuration files (e.g., `vercel.json`) were found in the repository.

### Payments (Internal only — no payment processor)

The payments system (`supabase/payments.sql`, `app/api/payment-entries/route.ts`) tracks check, cash, bank transfer, and waived payments manually. There is no Stripe, PayPal, or other payment gateway integration. Payment recording is entirely internal.

### QR Code Check-In

Player QR check-in uses tokens stored in `player_qr_tokens`. The `NEXT_PUBLIC_APP_URL` environment variable is used for generating QR code URLs (e.g., `http://localhost:3000` in development). No external QR generation service is called — QR codes are derived from the app URL + token.

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Base URL for QR code generation and redirect links |

---

## API Routes Summary

All routes are Next.js Route Handlers under `app/api/`:

| Route | Purpose |
|---|---|
| `app/api/admin/` | Admin user management (create user, check email, program prefill) |
| `app/api/assignments/` | Referee/volunteer game assignments |
| `app/api/auth/` | Auth helpers (check-email, create-user, join) |
| `app/api/checkins/` | Player check-in operations |
| `app/api/conflicts/` | Operational conflict detection and resolution |
| `app/api/eligibility/` | Player eligibility checking |
| `app/api/field-engine/` | Field availability engine |
| `app/api/fields/` | Field CRUD |
| `app/api/games/` | Game CRUD and status updates |
| `app/api/incidents/` | Incident logging |
| `app/api/join/` | Referee/volunteer self-registration via invite token |
| `app/api/lightning/` | Lightning delay management |
| `app/api/medical/` | Medical incident dispatch and status |
| `app/api/ops-log/` | Operations log entries |
| `app/api/payment-entries/` | Payment entry recording with auto-rollup to `team_payments` |
| `app/api/players/` | Player roster management |
| `app/api/referee-engine/` | Referee assignment optimization engine |
| `app/api/referees/` | Referee CRUD and check-in |
| `app/api/registration-fees/` | Registration fee configuration |
| `app/api/rules/` | Tournament rules engine |
| `app/api/team-payments/` | Team payment record management |
| `app/api/teams/` | Team CRUD |
| `app/api/volunteers/` | Volunteer CRUD and check-in |
| `app/api/weather/` | Weather alert CRUD |
| `app/api/weather-engine/` | OpenWeatherMap integration + automated alert/game management |
