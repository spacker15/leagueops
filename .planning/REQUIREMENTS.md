# Requirements: LeagueOps

**Defined:** 2026-03-22
**Core Value:** Tournament day operations must work reliably in real time — live scoring, field status, weather alerts, and referee assignments must be accurate and instant.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Security & Auth Hardening

- [x] **SEC-01**: All core database tables have proper RLS policies replacing "Allow all" — scoped by event_id via `user_event_ids()` helper function
- [x] **SEC-02**: All 40+ API routes validate authentication via `auth.getUser()` (except intentionally public routes: join, QR check-in, public results)
- [x] **SEC-03**: All engine modules (`referee.ts`, `weather.ts`, `field.ts`, `eligibility.ts`, `unified.ts`) accept a server-side Supabase client parameter instead of importing browser client
- [x] **SEC-04**: All hardcoded `event_id = 1` references (~60 locations) replaced with dynamic event_id from context/props/params
- [x] **SEC-05**: Real-time subscriptions scoped to current event_id
- [x] **SEC-06**: OpenWeather API key moved from `NEXT_PUBLIC_*` to server-only environment variable
- [x] **SEC-07**: All API route request bodies validated with zod schemas
- [x] **SEC-08**: Rate limiting applied to weather-engine, referee-engine, and public-facing endpoints via Upstash

### Event Creation

- [x] **EVT-01**: Admin can search for a venue/complex via Google Maps autocomplete when creating an event
- [x] **EVT-02**: Complex location (lat/lng, address, place ID) saved to event record
- [x] **EVT-03**: Google Maps API key protected via server-side proxy route (not exposed as NEXT_PUBLIC)
- [x] **EVT-04**: System generates a unique registration link per event
- [x] **EVT-05**: System generates a QR code for the registration link that admin can download/share
- [x] **EVT-06**: Registration link/QR includes event slug for direct routing

### Registration Flow

- [x] **REG-01**: Admin defines event schedule dates before registration opens
- [x] **REG-02**: Program leader can select team availability during registration — all dates or specific individual dates per team
- [x] **REG-03**: Program leader can add coaches directly to a team with name, email, phone, and certifications
- [x] **REG-04**: System generates a unique coach self-registration link per program
- [x] **REG-05**: Coach can self-register via link — selects team, provides name, email, phone, certifications
- [x] **REG-06**: System detects when same coach is assigned to multiple teams in same or different divisions and flags the conflict
- [x] **REG-07**: Coach conflicts surfaced to admin during schedule generation as hard constraints (cannot schedule conflicting teams at same time)
- [x] **REG-08**: Program leader can register one or many teams in a single registration session

### Schedule Change Requests

- [x] **SCR-01**: Coach/program leader can submit a schedule change request selecting affected game(s), reason, preferred alternative, and cancel vs reschedule
- [x] **SCR-02**: System notifies admin (in-app + email) when a new schedule change request is submitted
- [x] **SCR-03**: Admin can review, approve, or deny schedule change requests
- [x] **SCR-04**: When admin approves a request, system auto-suggests available alternative time slots considering field, team, and referee availability
- [x] **SCR-05**: Admin selects from suggested slots and confirms the reschedule
- [x] **SCR-06**: Rescheduled game updated atomically (database transaction) to prevent double-bookings
- [x] **SCR-07**: All affected teams notified of schedule changes via notification system
- [x] **SCR-08**: Schedule change request has state machine: pending → under_review → approved → rescheduled (or denied)

### Public Results Site

- [x] **PUB-01**: Parents/spectators can view live game scores without login via apps/public-results
- [x] **PUB-02**: Game schedules viewable by team, by field, and by time slot
- [x] **PUB-03**: Division standings with win/loss records displayed
- [x] **PUB-04**: Tournament bracket visualization
- [x] **PUB-05**: QR code per event/team that takes parents directly to their team's filtered view
- [x] **PUB-06**: Parents can search for events and find teams via browse or QR scan
- [x] **PUB-07**: Live scores update in real time via Supabase Realtime (scoped subscription, not per-visitor WebSocket for standings)
- [x] **PUB-08**: Public site works on mobile without horizontal scrolling

### Notifications

- [x] **NOT-01**: Notification queue table receives entries from engines and workflows — processed asynchronously via Supabase Edge Function
- [ ] **NOT-02**: Weather alerts (lightning delays, field closures, game suspensions) trigger notifications to affected coaches/program leaders
- [ ] **NOT-03**: Schedule change notifications sent to all affected teams when games are rescheduled or cancelled
- [ ] **NOT-04**: Admin alert notifications for referee no-shows, registration deadlines, and ops issues
- [x] **NOT-05**: Email delivery via Resend (3,000/month free tier)
- [x] **NOT-06**: Browser push notifications via Web Push API (no app install required)
- [x] **NOT-07**: Users can set notification preferences (which channels, which alert types)
- [x] **NOT-08**: Deduplication prevents notification storms (e.g., single lightning alert doesn't trigger hundreds of messages)

### Responsive Design

- [ ] **MOB-01**: Admin app main views (Dashboard, Schedule, Check-In) usable on phone screens
- [ ] **MOB-02**: RightPanel converts to bottom drawer on mobile
- [ ] **MOB-03**: Touch interactions work for drag-drop features (referee assignment via @dnd-kit TouchSensor)
- [ ] **MOB-04**: Navigation adapts for mobile (collapsible or bottom nav)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Payments
- **PAY-01**: Online payment processing via Stripe for program registration fees
- **PAY-02**: Payment status tracking per team/program

### Analytics
- **ANL-01**: Reports dashboard with game results, stat leaders
- **ANL-02**: Pool standings auto-calculation

### SMS Notifications
- **SMS-01**: SMS/text delivery channel for urgent alerts (deferred due to cost — free tier insufficient for production volume)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | Responsive web sufficient for field-side use |
| Offline mode | Events require connectivity |
| Multi-language support | English only for now |
| In-platform chat | Not a communication tool — scope creep |
| Player names/rosters on public page | COPPA/privacy concerns for youth athletes |
| Auto-resolving schedule conflicts | Suggest only; admin must confirm |
| Custom registration form builder | 3-month project for 5% of use cases |
| Stripe/payment processing | Adds PCI scope, refund workflows, disputes — track internally for now |

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SEC-01 | 4 — RLS & Database Security | not_started |
| SEC-02 | 3 — API Auth & Validation | not_started |
| SEC-03 | 1 — Engine Client Refactor | not_started |
| SEC-04 | 2 — Hardcode Removal & Event Context | not_started |
| SEC-05 | 2 — Hardcode Removal & Event Context | not_started |
| SEC-06 | 1 — Engine Client Refactor | not_started |
| SEC-07 | 3 — API Auth & Validation | not_started |
| SEC-08 | 3 — API Auth & Validation | not_started |
| EVT-01 | 5 — Event Creation Enhancements | not_started |
| EVT-02 | 5 — Event Creation Enhancements | not_started |
| EVT-03 | 5 — Event Creation Enhancements | not_started |
| EVT-04 | 5 — Event Creation Enhancements | not_started |
| EVT-05 | 5 — Event Creation Enhancements | not_started |
| EVT-06 | 5 — Event Creation Enhancements | not_started |
| REG-01 | 6 — Registration Flow Enhancements | not_started |
| REG-02 | 6 — Registration Flow Enhancements | not_started |
| REG-03 | 6 — Registration Flow Enhancements | not_started |
| REG-04 | 6 — Registration Flow Enhancements | not_started |
| REG-05 | 6 — Registration Flow Enhancements | not_started |
| REG-06 | 6 — Registration Flow Enhancements | not_started |
| REG-07 | 6 — Registration Flow Enhancements | not_started |
| REG-08 | 6 — Registration Flow Enhancements | not_started |
| SCR-01 | 8 — Schedule Change Request Workflow | not_started |
| SCR-02 | 8 — Schedule Change Request Workflow | not_started |
| SCR-03 | 8 — Schedule Change Request Workflow | not_started |
| SCR-04 | 8 — Schedule Change Request Workflow | not_started |
| SCR-05 | 8 — Schedule Change Request Workflow | not_started |
| SCR-06 | 8 — Schedule Change Request Workflow | not_started |
| SCR-07 | 8 — Schedule Change Request Workflow | not_started |
| SCR-08 | 8 — Schedule Change Request Workflow | not_started |
| PUB-01 | 9 — Public Results Site | not_started |
| PUB-02 | 9 — Public Results Site | not_started |
| PUB-03 | 9 — Public Results Site | not_started |
| PUB-04 | 9 — Public Results Site | not_started |
| PUB-05 | 9 — Public Results Site | not_started |
| PUB-06 | 9 — Public Results Site | not_started |
| PUB-07 | 9 — Public Results Site | not_started |
| PUB-08 | 9 — Public Results Site | not_started |
| NOT-01 | 7 — Notification Infrastructure | not_started |
| NOT-02 | 10 — Responsive Design & Notification Wiring | not_started |
| NOT-03 | 10 — Responsive Design & Notification Wiring | not_started |
| NOT-04 | 10 — Responsive Design & Notification Wiring | not_started |
| NOT-05 | 7 — Notification Infrastructure | not_started |
| NOT-06 | 7 — Notification Infrastructure | not_started |
| NOT-07 | 7 — Notification Infrastructure | not_started |
| NOT-08 | 7 — Notification Infrastructure | not_started |
| MOB-01 | 10 — Responsive Design & Notification Wiring | not_started |
| MOB-02 | 10 — Responsive Design & Notification Wiring | not_started |
| MOB-03 | 10 — Responsive Design & Notification Wiring | not_started |
| MOB-04 | 10 — Responsive Design & Notification Wiring | not_started |

---
*Last updated: 2026-03-22 after roadmap creation — traceability section populated*
