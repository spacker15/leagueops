# LeagueOps

## What This Is

LeagueOps is a real-time tournament operations platform for youth lacrosse (and other sports). It is a multi-tenant SaaS app where a super admin creates events (tournaments, seasons, clinics, leagues), and each event is a fully isolated workspace. Admins manage scheduling, scoring, referees, volunteers, weather monitoring, field conflicts, and program registration — all in real time.

**Live URL:** https://leagueops.vercel.app
**GitHub:** https://github.com/spacker15/leagueops

## Core Value

Tournament day operations must work reliably in real time — live scoring, field status, weather alerts, and referee assignments must be accurate and instant so that admins can run events from a single screen.

## Requirements

### Validated

- ✓ Multi-event workspace isolation (events with slugs, role-based access) — existing
- ✓ Role-based authentication (super_admin, admin, league_admin, referee, volunteer, program_leader) — existing
- ✓ Event creation and configuration (40+ settings, sports support) — existing
- ✓ Schedule generation engine with board/table views — existing
- ✓ Live game scoring with real-time status updates — existing
- ✓ Dashboard with field command board (scoreboard-style field cards) — existing
- ✓ Referee and volunteer management with drag-drop assignment — existing
- ✓ Referee conflict detection engine — existing
- ✓ Field conflict detection engine with field blocks — existing
- ✓ Weather engine (OpenWeatherMap + mock) with lightning/heat alerts — existing
- ✓ Player eligibility engine (play-down rule, multi-game approval) — existing
- ✓ Unified engine (runs all engines, creates ops_alerts) — existing
- ✓ Command Center for unified operations — existing
- ✓ Player check-in with QR codes — existing
- ✓ Program registration wizard (3-step: account → program → teams) — existing
- ✓ Program approval workflow (admin approves programs/teams) — existing
- ✓ Program leader dashboard (manage teams, rosters) — existing
- ✓ NFYLL-format CSV roster import/export — existing
- ✓ Incident and medical incident logging — existing
- ✓ Interactive park map (drag/resize/rotate/color fields) — existing
- ✓ Configurable rules engine (35 rules per event) — existing
- ✓ Real-time subscriptions on 9 core tables — existing
- ✓ Ops log feed — existing

### Active

**Security & Multi-Event Hardening**
- [ ] SEC-01: Lock down RLS policies on all core tables (replace "Allow all" with proper row-level security)
- [ ] SEC-02: Add authentication checks to all 40+ API routes (currently only 2 routes check auth)
- [ ] SEC-03: Fix engine modules to use server-side Supabase client instead of browser client in API routes
- [ ] SEC-04: Remove hardcoded `event_id = 1` from all engines, components, and API routes (~60 locations)
- [ ] SEC-05: Scope real-time subscriptions to current event
- [ ] SEC-06: Move OpenWeather API key from NEXT_PUBLIC to server-only environment variable

**Event Creation Enhancements**
- [ ] EVT-01: Google Maps integration for complex lookup — search, save lat/lng, address, place ID when creating events
- [ ] EVT-02: Generate shareable registration link + QR code per event for social media/email distribution

**Registration Flow Enhancements**
- [ ] REG-01: Admin defines event schedule/dates before registration opens
- [ ] REG-02: Program leader selects team availability during registration (all dates or specific dates per team)
- [ ] REG-03: Program leader can add coaches directly with contact info (name, email, phone, certifications)
- [ ] REG-04: Generate coach self-registration link per program — coaches register themselves to a specific team
- [ ] REG-05: Conflict detection at registration — flag when same coach coaches multiple teams in same/different divisions
- [ ] REG-06: Program leaders can register one or many teams in a single session

**Schedule Change Request Workflow**
- [ ] SCH-01: Coaches/program leaders can submit schedule conflict requests (select games, reason, preferred alternative, cancel vs reschedule)
- [ ] SCH-02: System notifies admin of incoming schedule change requests
- [ ] SCH-03: Admin reviews and approves/denies conflict requests
- [ ] SCH-04: System auto-suggests available alternative slots when a request is approved
- [ ] SCH-05: Admin approves the rescheduled game from suggested options
- [ ] SCH-06: Notifications sent to all affected teams when schedule changes

**Public Results Site**
- [ ] PUB-01: Live scores visible to parents/spectators without login (apps/public-results)
- [ ] PUB-02: Game schedules viewable by team/field/time
- [ ] PUB-03: Division standings with win/loss records
- [ ] PUB-04: Tournament bracket visualization
- [ ] PUB-05: QR code + search for parents to find their kid's team
- [ ] PUB-06: Real-time updates via Supabase Realtime

**Notifications**
- [ ] NOT-01: Weather alert notifications (lightning delays, field closures, game suspensions)
- [ ] NOT-02: Schedule change notifications (game time/field changes, cancellations)
- [ ] NOT-03: Admin alert notifications (referee no-shows, registration deadlines, ops issues)
- [ ] NOT-04: Email delivery channel
- [ ] NOT-05: SMS/text delivery channel (free/cheap provider — Supabase Edge Functions or similar)
- [ ] NOT-06: Browser push notifications (PWA-compatible)

**Responsive Design**
- [ ] MOB-01: Make existing admin app fully responsive for phone/tablet use at fields

### Out of Scope

- Stripe/payment processing — no online payment collection for now (payments tracked internally as check/cash/bank transfer/waived)
- Native mobile app — responsive web is sufficient
- Offline mode — requires connectivity at events
- Multi-language support — English only
- Pool standings auto-calculation — deferred
- Stat leaders / advanced analytics — deferred

## Context

**Current state:** App is live and actively used for events. Single event has been the primary use case so far, but multi-event support is urgently needed. The codebase has significant security gaps (open RLS, unauthenticated API routes) that were acceptable during initial development but must be fixed before scaling.

**Technical debt highlights:**
- `event_id = 1` hardcoded in ~60 places across engines, components, and API routes
- All RLS policies set to "Allow all" (explicitly noted as temporary in schema)
- 40+ API routes with no auth checks
- Engine modules use browser Supabase client in server-side contexts
- 80+ `as any` TypeScript casts
- `field-engine` has a bug: `type === 'all' ? false : false` (both branches identical)
- Lightning detection uses coarse weather codes, not actual strike radius data

**Existing infrastructure:**
- Supabase project: rzzzwrqbubptnlwfesjv
- Vercel auto-deploy on push to main
- apps/public-results skeleton exists (separate Next.js app on port 3001)
- Registration system partially built (wizard, approvals, program dashboard)

## Constraints

- **Budget**: Keep third-party services free/cheap — use free tiers, Supabase Edge Functions where possible
- **Timeline**: Event is already live — security fixes are highest priority
- **Stack**: Next.js 14 App Router + Supabase + Vercel — no stack changes
- **Auth**: Supabase Auth — all role-based access through existing user_roles table
- **Design**: Maintain existing dark theme design system (Barlow Condensed, navy/red palette)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Security before features | Event is live, open RLS and no auth on routes is a risk | — Pending |
| Responsive web over native app | Simpler, faster, one codebase — sufficient for field-side use | — Pending |
| Free/cheap notification providers | Budget constraint — Supabase Edge Functions, free SMS tiers | — Pending |
| Google Maps for complex lookup | Standard solution, reliable geocoding, familiar UX | — Pending |
| Coach self-registration links | Reduces admin burden, coaches provide own info + certifications | — Pending |
| Schedule change request workflow | Coaches submit → admin approves → system suggests → admin confirms | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 after initialization*
