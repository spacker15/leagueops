# LeagueOps Backlog

_Last updated: 2026-04-12_

---

## Post-v1.0 Features Shipped (since 2026-03-25)

These were built after v1.0 milestone and are live in production:

- [x] **Payments system** — DB tables, auto-generate fees from teams, extra game fees, per-division config, program-grouped overview with collect workflow
- [x] **Trainer role** — TrainerPortal login, trainer availability management in Refs tab, trainer role in UserManagement dropdown
- [x] **NWS Weather integration** — National Weather Service alerts + live observations, WeatherBar strip at top, per-complex readings, auto-poll every 5 min, removed OpenWeather API key UI
- [x] **Game Day tab** — Added to Referee and Volunteer portals for live day-of tracking
- [x] **Team & program logos** — Upload throughout: program header, team list, payments, program dashboard
- [x] **No Show game status** — New status with color mapping + improved reschedule on game cards
- [x] **Schedule improvements** — Sort by time, board view chronological sort, CSV compare tool, ref grid pivot
- [x] **RLS Phase 4 complete** — Corrected RLS migration applied to production (write restrictions + payment RLS)
- [x] **Incident log** — Edit and delete support added
- [x] **Duplicate prevention** — Ref/vol invite link deduplication
- [x] **Trainer availability** — Manage trainer schedules from Refs tab

### Additional shipped since 2026-04-09 (34 commits on main)

- [x] **Trainer operations** — Check-in with on-duty indicator, auto-checkout after last game, dispatch to field, dispatch banner with resolve button, medical incident auto-create on dispatch
- [x] **Push notifications** — Persistent until acknowledged, vibrate + ring on mobile
- [x] **Command Center improvements** — Games sorted by time, first/last game times per field, Today's Schedule quick view in right panel
- [x] **Portal defaults** — Ref/vol/program portals default to games/schedule view with date picker, mobile-friendly date picker in status bar
- [x] **Field card** — First/last game times, Final games sort to bottom of columns, mobile status bar shows first/last + last game time
- [x] **Incident monitor** — Shows today only, includes medical dispatches, shows all (not just first 4), scrollable Active Medical section
- [x] **Incidents report page** — Dedicated report view + incident log scroll fix
- [x] **Rules tab** — 2026 USA Lacrosse Boys Youth Rules reference, moved inside RefereePortal correctly
- [x] **Reports > Matchups** — Date picker + date range slider (from/to), alphabetical team sort
- [x] **Hide scores setting** — Score visibility toggle, field view shows upcoming games first
- [x] **User management** — Role editing in user edit card, improved create-user error handling
- [x] **Scoring fix** — Refs assigned via vol_assignments can now score games

---

## Known Open Items / Next Work

- [ ] **Notification UAT gaps** — Phase 7 UAT showed 0 passed, 1 issue, 1 blocked. NOT-02, NOT-03, NOT-04 stubs wired but need end-to-end validation
- [ ] **Phase 4 anon RLS** — Public results site needs anon-role read policies on public tables (standings, games) for unauthenticated visitors to see live data
- [ ] **Payments — collection flow** — Collect button wired but end-to-end payment recording needs validation
- [ ] **Weather alert dedup** — Engine-generated and NWS alerts may overlap; dedup logic was added but needs UAT under real conditions

---

## Future / Unscheduled

- [ ] Multi-event dashboard (super admin view across all events)
- [ ] Coach self-registration email flow (currently link-only)
- [ ] Export/reporting (CSV downloads for rosters, schedules, payments)
- [ ] Mobile PWA install prompt for refs/volunteers
