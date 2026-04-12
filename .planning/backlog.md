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

---

## Known Open Items / Next Work

- [ ] **Notification UAT gaps** — Phase 7 UAT showed 0 passed, 1 issue, 1 blocked. NOT-02, NOT-03, NOT-04 stubs were wired but need end-to-end validation
- [ ] **Phase 4 anon RLS** — Public results site needs anon-role read policies on public tables (standings, games) for unauthenticated visitors to see live data
- [ ] **Payments — collection flow** — Collect button wired but end-to-end payment recording needs validation
- [ ] **Weather alert dedup** — Engine-generated and NWS alerts may overlap; dedup logic was added but needs UAT under real conditions

---

## Future / Unscheduled

- [ ] Multi-event dashboard (super admin view across all events)
- [ ] Coach self-registration email flow (currently link-only)
- [ ] Export/reporting (CSV downloads for rosters, schedules, payments)
- [ ] Mobile PWA install prompt for refs/volunteers
