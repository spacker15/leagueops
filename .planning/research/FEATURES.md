# Features Research

*Researched: 2026-03-22 | Based on knowledge of TourneyMachine, GameChanger, SportsEngine, TeamSnap, and general tournament operations patterns as of mid-2025.*

---

## Schedule Change Requests

### How Platforms Handle It Today

**TourneyMachine** is the closest comp for tournament-day operations. It does not have a formal coach-initiated change request workflow. Schedule changes are admin-only — admins drag games to new slots and the system updates downstream. Coaches have no self-service path. Notifications of changes go out via email blast only, with no per-team targeting. The lack of a structured request workflow is a frequent complaint in tournament director communities.

**SportsEngine** (acquired by NBC Sports) offers a "game request" concept within league play — a coach or team contact can flag a scheduling issue through a form, but it routes to an inbox and the resolution is manual. There is no auto-suggest of alternative slots, no status tracking visible to the coach, and approval/denial is communicated via generic email. Their workflow is designed around season-long league schedules, not single-weekend tournaments.

**GameChanger** focuses on in-game scoring and stat tracking. It has no schedule change request feature. Schedule adjustments are admin-only. It is not a tournament operations tool.

**TeamSnap** supports availability windows — coaches/players mark themselves unavailable, and the schedule builder avoids those windows. This is a pre-schedule conflict tool, not a post-schedule change request workflow. There is no coach-submits-conflict-request-post-publication flow.

### Table Stakes (must have or coaches stop using the platform)

- Coaches can see their team's schedule at all times
- Schedule changes are reflected immediately (not batch email the next morning)
- Coaches receive a notification when their game is rescheduled or cancelled
- Admin has final authority over all schedule changes — no coach can unilaterally reschedule

### Differentiators (competitive advantage)

- **Structured request workflow with status tracking** — coach submits a request, gets a confirmation it was received, sees Pending / Approved / Denied status. No competitor does this well for tournaments.
- **Auto-suggest alternative slots** — when admin approves a rescheduling request, the system proposes 2-3 open slots that satisfy field availability, team availability, and no referee double-booking. Admin picks one and it's done. This is a significant time-saver vs. the admin manually hunting for a slot.
- **Reason categorization** — coach selects from: Travel/logistics, Conflict with another sport, Religious/cultural observance, Other. This lets admins triage requests by urgency without reading free-text.
- **Audit trail** — every request, approval, and denial is logged with timestamps. Useful for post-event disputes.
- **Affected-parties notification** — when a game is rescheduled, the system notifies both teams' coaches/leaders plus the assigned referee automatically. No competitor does this atomically; they send one blast to all participants.

### Anti-Features (deliberately avoid)

- **Coach can propose a specific time** — this creates negotiation loops. Coaches should state the conflict and the reason; the system and admin find the time. Giving coaches time proposals turns every request into a negotiation.
- **Multi-step approval chains** — for a youth tournament, one admin approval is sufficient. Do not build league commissioner → event director → admin chains. That belongs in a season-long league tool, not a tournament weekend.
- **Open comment threads on requests** — message threads on schedule requests become arguments. Accept text reason + admin notes only; no back-and-forth in the platform.

### LeagueOps Implementation Notes (SCH-01 through SCH-06)

The planned workflow (coach submits → admin reviews → system suggests → admin confirms → notifications sent) maps exactly to the gap in the market. The auto-suggest slot (SCH-04) is the biggest differentiator — it requires querying field availability, team schedules, and referee assignments simultaneously, which LeagueOps already has engine infrastructure to do. The key UX constraint: keep the coach-facing form to under 60 seconds to complete, or coaches won't bother and will call/text the admin directly, defeating the purpose.

---

## Notifications

### How Platforms Handle It Today

**TourneyMachine** sends email notifications for schedule changes. There is no SMS. There is no push notification. Emails are sent as plain-text blasts to all registered contacts — no targeting by team or role. Weather alerts are not a platform feature; directors use separate weather apps and then manually email participants.

**SportsEngine** has the most mature notification system of the group: email + push via their mobile app. They support targeted messaging (send to one team, one division, all coaches). Weather delay notifications can be sent via their alert system. SMS is behind a paid add-on. Their app-based push requires participants to have the SportsEngine app installed, which is a real adoption barrier for youth sports parents.

**GameChanger** sends push notifications for live scoring events (score updates, game end) to anyone following a team. This is their core notification value prop. They do not support weather alerts or admin broadcast messages in a structured way.

**TeamSnap** has the most comprehensive multi-channel notifications: email, SMS (paid), push. Coaches can message their team roster directly. Admins can broadcast to the league. Availability reminders are automated. Their notification system is their most praised feature.

### Table Stakes

- Email notifications for schedule changes reach coaches within 5 minutes of the change
- Admin can send a broadcast message to all participants at any time (weather delays, field closures)
- Notifications identify which game/field/team is affected — not a generic "something changed" message

### Differentiators

- **Weather-triggered alerts** — LeagueOps already has a weather engine with lightning and heat detection. Automatically sending notifications when the engine fires an alert (rather than requiring admin to manually send) is something no competitor does. The chain: weather engine fires → ops_alert created → notification dispatched. This is a genuine differentiator because it removes human latency during a weather emergency.
- **Role-targeted delivery** — sending a referee no-show alert only to admins, sending a field closure alert to all coaches with games on that field, sending a weather delay to everyone. Blanket blasts are the norm; targeted delivery is the upgrade.
- **Channel preference per recipient** — some coaches want SMS, some want email, some want push. Letting recipients set their own preference per alert category (weather vs. schedule vs. admin) is a product detail that drives retention.
- **SMS via free/cheap tier** — Twilio free tier is minimal (limited to verified numbers). Better options for low-volume tournament use: Resend (email, very generous free tier), Supabase Edge Functions + Resend for email, and Twilio Verify or a cost-per-message model for SMS. For the LeagueOps budget constraint, email-first + browser push via PWA is the right initial approach; SMS as a later add-on.
- **Browser push via PWA** — SportsEngine requires their native app. A PWA push works in Safari (iOS 16.4+) and Chrome on Android without an app store installation. For a tool used on tournament day by coaches standing on a field, this is superior adoption.

### Anti-Features

- **In-platform chat/messaging threads** — TeamSnap has this and it becomes a support burden. Coaches use it for everything except what it was designed for. Stick to one-way broadcast notifications and direct email/SMS; don't build an in-app chat layer.
- **Notification frequency caps without user control** — platforms that throttle alerts (to avoid spam complaints) end up suppressing legitimate weather emergencies. Let admins bypass frequency caps for safety alerts.
- **Requiring app installation for push** — see above. PWA push is the correct path for this stack.
- **Read receipts on admin alerts** — creates false accountability ("we notified you") and generates support tickets. Send the message; don't build a compliance audit trail into the notification system.

### LeagueOps Implementation Notes (NOT-01 through NOT-06)

Priority order given budget and impact:
1. Email (NOT-04) — use Resend, which has a 3,000 email/month free tier and a simple REST API callable from Supabase Edge Functions. This is the delivery workhorse.
2. Browser push via PWA (NOT-06) — requires a service worker and Web Push API. Works without a native app. Best for tournament-day alerts.
3. SMS (NOT-05) — use Twilio with pay-per-message (~$0.0075/SMS). For a typical tournament sending 200 SMS messages, that's $1.50/event. Acceptable cost but adds complexity; defer until email + push are stable.

The weather alert chain (NOT-01) is the highest-value notification to build first because it's the only one that must be instant and cannot tolerate manual intervention.

---

## Public Results Site

### How Platforms Handle It Today

**TourneyMachine** has a public-facing tournament page. Parents can view brackets, schedules, and scores without logging in. Updates are not real-time — the page refreshes on a timer (typically 60-120 seconds). Bracket visualization is their strongest feature here. Mobile experience is passable but not optimized. There is no team-specific search or QR code entry point.

**GameChanger** is the gold standard for public game streams and live scoring. Their public game page shows pitch-by-pitch (baseball/softball), live score, and inning-by-inning breakdown. Parents follow a team and get push notifications. The experience is polished and mobile-first. However, it is sport-specific (baseball/softball-optimized) and requires teams to actively use the GameChanger scoring app during games.

**SportsEngine** has public-facing score pages per organization. Real-time is approximate — their "live" scores update every 30-60 seconds via polling. Standings and schedules are viewable without login. Mobile experience is adequate.

**TeamSnap** does not have a strong public results site. Their public schedule page is basic. Scores require login in most configurations.

### Table Stakes

- Scores and schedules are visible without login — parents should never need to create an account to see their kid's game time
- Mobile-first layout — the overwhelming majority of parent traffic is from phones
- Schedule viewable by team, by field, and by time slot — all three views are expected
- Results update within 2 minutes of being entered by the admin/scorer

### Differentiators

- **True real-time via Supabase Realtime** — LeagueOps already has real-time subscriptions on core tables. Extending this to the public site means parents see score updates the instant the admin enters them, with no polling. No competitor does true real-time on their public page. This is a legitimate technical differentiator.
- **QR code entry per team** — a poster/email with a QR code that takes a parent directly to their team's schedule and live scores, pre-filtered. Reduces the "how do I find my kid's team?" support burden on tournament day. No competitor has this as a first-class feature.
- **Division standings with live win/loss** — standings that update as games complete. TourneyMachine does this but via polling; real-time standings are a visible differentiator at the tournament information table.
- **Bracket visualization** — for single-elimination or pool-play-to-bracket formats, a visual bracket (not just a list) is what parents expect. TourneyMachine has this; it is now table stakes for tournament platforms but not for league platforms.
- **"Find my team" search** — a simple team name search on the public landing page, before a parent knows how the tournament is organized, removes friction dramatically.

### Anti-Features

- **Requiring parent account creation** — any friction between a parent and seeing their kid's schedule will generate complaints to the tournament director. The public site must be zero-auth.
- **Stat leaders / advanced analytics on the public page** — this belongs in a separate analytics view, not the live results page. It adds visual complexity and distracts from the primary use case (what's the score, where is my kid playing next).
- **Comments or reactions on game results** — a public results page for youth sports is not a social feed. No commenting, no likes, no parent-visible game chat.
- **Full player rosters on the public page** — COPPA and general privacy caution for youth sports. Show team names, division, scores. Do not show player names or ages on the unauthenticated public page.

### LeagueOps Implementation Notes (PUB-01 through PUB-06)

The `apps/public-results` skeleton already exists. The right architecture:
- Supabase Realtime subscription scoped to the event (fixes SEC-05 when that's done)
- Static generation for the event shell (schedule structure doesn't change often), dynamic for scores
- Three route segments: `/[event-slug]/schedule`, `/[event-slug]/standings`, `/[event-slug]/bracket`
- QR code generation (PUB-05) can use the `qrcode` npm package client-side — no service needed
- No auth middleware on this app — it is fully public

The real-time scores (PUB-06) is the highest-value feature to ship first because it's the visible proof point that LeagueOps is different from TourneyMachine.

---

## Registration & Onboarding

### How Platforms Handle It Today

**TourneyMachine** has a registration system where programs submit team entries. The director sets a registration deadline and fee structure. Programs fill in team info, division, roster size. There is no self-service coach registration — the program contact handles everything. Conflict detection (same coach, multiple teams) is not a feature; it is the director's job to notice.

**SportsEngine** has the most feature-complete registration system of any platform in this space. Their HQ Registration product supports: custom form fields, payment collection (Stripe-integrated), discount codes, division auto-placement by age/grade, waitlisting, approval workflows, and partial registration (register now, pay later). Their coach registration links (unique URL per team) are a paid feature. Conflict detection is not built in.

**TeamSnap** supports team registration and roster management. Registration forms are customizable. They support payment collection. Coach profiles are managed at the org level, not per-event. No conflict detection.

**GameChanger** is not a registration platform. Programs use it for scoring only; registration happens elsewhere.

**Smaller platforms (GotSoccer, Demosphere, ArbiterSports):** These serve specific sports and have registration systems optimized for their sport's workflow. GotSoccer (soccer) has strong conflict detection for coaches across clubs. Demosphere has a coach certification tracking feature. ArbiterSports focuses on referee assignment, not team registration.

### Table Stakes

- Program leaders can register multiple teams in one session without re-entering org info
- Admin can approve or reject registrations with a reason
- Registration deadline is enforced by the system, not by admin manually closing a form
- Roster import (CSV) is supported so coaches don't re-enter players by hand
- Division assignment is visible and editable by admin after submission

### Differentiators

- **Coach self-registration link per team (REG-04)** — a unique URL that a program leader sends to each of their coaches. The coach creates their account scoped to that specific team, enters their own info and certifications. No platform in the direct comp set does this cleanly for tournaments. It eliminates the data-entry burden on program leaders who are managing 5-10 coaches across multiple teams.
- **Availability selection during registration (REG-02)** — program leader specifies which event dates each team can play. This flows into the schedule generation engine as hard constraints. TourneyMachine does not have this at registration time; availability has to be communicated out-of-band and manually entered by the admin. This feature directly reduces schedule-change requests downstream.
- **Conflict detection at registration (REG-05)** — flagging when the same coach appears across multiple teams, especially in the same division or same time block. No tournament platform does this. The workflow: registration submitted → system checks all coach names/emails across the event → flag if a coach is on multiple teams in same division → show admin a "Conflict Review" queue alongside the standard approval queue.
- **QR code for registration link (EVT-02)** — a QR code generated for the event's registration URL, designed for social media images and printed flyers. This is trivial to generate but no platform makes it a first-class shareable asset. In youth sports, most communication happens via Facebook groups and email flyers; a pre-built QR code image reduces the barrier for directors who aren't tech-savvy.

### Anti-Features

- **Payment collection** — explicitly out of scope per PROJECT.md. This is the right call: payment processing adds PCI scope, Stripe fees, refund workflows, and dispute handling. Youth lacrosse tournaments at this scale typically collect checks or bank transfers. Do not build it.
- **Waitlist management** — adds complexity (automated vs. manual promotion, notification chains) for a feature that can be handled by the admin in a spreadsheet for tournament sizes LeagueOps currently serves.
- **Parent-facing registration** — parents registering individual players directly (bypassing the program/club structure) is a different product. LeagueOps is program-first. Individual player registration belongs in a recreational league tool, not a competitive tournament platform.
- **Custom form builder** — SportsEngine has this and it's a support nightmare. Define a fixed, well-designed registration form. If a director needs a custom field, they can collect it out-of-band. A custom form builder is a 3-month project that serves 5% of use cases.

### LeagueOps Implementation Notes (REG-01 through REG-06, EVT-01, EVT-02)

The existing 3-step wizard (account → program → teams) is a strong foundation. The additions are:
- **REG-02** (availability selection): add a step after team creation where the program leader checks off event dates. Store as a `team_availability` join table. Feed into schedule engine.
- **REG-04/REG-03** (coach registration links): generate a JWT-scoped invite link per team. When a coach hits the link, they land on a registration form pre-bound to that team. Their account is created with `role = program_leader` scoped to that team only.
- **REG-05** (conflict detection): run on registration submission and on approval. Query: for each coach email/name on this submission, find any other team in this event with the same coach. Flag if found. Surface in the admin approval view as a warning badge, not a hard block (admin decides whether it's a real conflict).
- **EVT-01** (Google Maps): use the Google Places Autocomplete API on the venue field in event creation. Store `place_id`, `lat`, `lng`, `formatted_address`. The Maps JavaScript API Embed is free for display; Places Autocomplete is $0.017/request with a $200/month free credit — negligible for this use case.
- **EVT-02** (registration QR code): use the `qrcode` package to generate a PNG of the event registration URL. Display inline and offer a download button. Zero cost.

---

## Conflict Detection

### How Platforms Handle It Today

**TourneyMachine** has basic schedule conflict detection: it will warn if the same team is scheduled to play two games at the same time. It does not detect referee double-booking, coach conflicts, or field overlaps beyond a basic time check.

**SportsEngine** has team-level conflict detection in their league scheduler. It respects blackout dates entered during registration. It does not have coach-level conflict detection.

**ArbiterSports** (referee management platform) has sophisticated referee conflict detection: it tracks official certifications, geographic availability, and association-level conflicts of interest. This is the best-in-class referee conflict system but it's a standalone product, not integrated into tournament scheduling.

**GotSoccer / Demosphere** (soccer-specific): GotSoccer has club-level coach conflict detection — it flags when the same coach appears on teams in the same flight/division. This is the only platform in the space with coach conflict detection as a built feature.

### Table Stakes

- Same team cannot be scheduled in two games simultaneously
- Admin is warned (not silently blocked) when a conflict is detected
- Conflicts are re-checked when the schedule is modified, not just at initial generation

### Differentiators

- **Referee conflict detection** — LeagueOps already has this engine. It is ahead of TourneyMachine and SportsEngine.
- **Field conflict detection with field blocks** — LeagueOps already has this. Field blocks (maintenance, other events, field preparation) are not a feature any competitor has at this level of control.
- **Coach conflict detection at registration** — see REG-05. Checking for the same coach across teams at registration time, before the schedule is built, prevents conflicts from entering the system rather than catching them after the fact. This is the right point in the workflow to catch it.
- **Unified conflict engine** — LeagueOps already has the unified engine running all detection in one pass. The differentiator is surfacing all conflicts in one Command Center view, not having admins check three separate screens.

### Anti-Features

- **Hard-blocking conflicts at schedule generation** — a hard block that refuses to generate a schedule unless all conflicts are resolved will frustrate admins in real operations. Warnings + override is the correct pattern. Tournament directors regularly make exceptions (two games for a team with a long break between them, a referee working two consecutive games by choice).
- **Conflict "resolution suggestions" that modify the schedule automatically** — auto-resolution creates unintended side effects (moving one game creates a conflict elsewhere). Suggest, don't act. The auto-suggest in SCH-04 is for the explicit reschedule-request flow where admin has already approved a change; it is not the same as auto-resolving detected conflicts.

---

## Recommendations Summary

### What to Build First (Highest Impact vs. Effort)

| Feature | Impact | Effort | Priority |
|---|---|---|---|
| Public results site with real-time scores (PUB-01, PUB-06) | Very High — visible to every parent at every event | Low-Medium — skeleton exists, Realtime already works | **1** |
| Weather-triggered notifications via email (NOT-01, NOT-04) | Very High — safety-critical, no human latency | Medium — needs Resend + Edge Function + notification dispatch chain | **2** |
| Schedule change request workflow (SCH-01 through SCH-06) | High — eliminates the biggest admin pain point | Medium-High — new DB tables + UI for coach and admin | **3** |
| Coach self-registration links (REG-04) | High — eliminates data entry burden | Medium — JWT invite links + scoped account creation | **4** |
| Registration QR code + shareable link (EVT-02) | Medium — marketing/distribution convenience | Very Low — `qrcode` package, one component | **5** |
| Google Maps venue integration (EVT-01) | Medium — quality of life for event setup | Low — Places Autocomplete API, one form field change | **6** |
| Availability selection at registration (REG-02) | High — reduces schedule change requests downstream | Medium — new registration step + engine constraint feeding | **7** |
| Conflict detection at registration (REG-05) | Medium — catches problems early | Low-Medium — query extension on existing conflict engine | **8** |
| Browser push notifications via PWA (NOT-06) | Medium — better than email for tournament-day | High — service worker, manifest, subscription management | **9** |
| SMS notifications (NOT-05) | Medium — reaches coaches who ignore email | Medium — Twilio integration + opt-in management | **10** |

### Table Stakes Summary (build these or coaches/parents will reject the platform)

1. Public scores visible without login — non-negotiable for parent adoption
2. Schedule changes reflected in real time — coaches checking stale schedules on tournament day is a crisis
3. Notifications reach coaches within minutes of a schedule or weather change
4. Admin retains full authority over all schedule modifications — no self-service rescheduling
5. Program leaders can register multiple teams without re-entering program information

### Differentiators Summary (these are the reasons to choose LeagueOps over TourneyMachine)

1. **True real-time scores** via Supabase Realtime — no competitor does this; they all poll
2. **Weather-triggered automatic notifications** — the weather engine already exists; wiring it to notifications is a genuine first-mover advantage for safety-critical alerts
3. **Structured schedule change request workflow with auto-suggest slots** — fills a real gap; no tournament platform handles this cleanly
4. **Coach self-registration links** — reduces the program leader's administrative burden significantly
5. **Unified conflict detection** (referee + field + coach) surfaced in one Command Center view — no competitor combines all three

### Anti-Features Summary (deliberately do not build these)

1. **Payment processing** — PCI scope, refund workflows, disputes; out of scope and correctly so
2. **In-platform parent/coach chat or messaging threads** — scope creep, support burden, not a tournament operations tool
3. **Custom registration form builder** — 3-month project serving 5% of use cases
4. **Player/roster data on the public results page** — privacy risk for youth athletes
5. **Auto-resolving schedule conflicts** — suggest only; admin confirms all changes
6. **Coach-initiated time proposals in change requests** — creates negotiation loops; coaches state conflict + reason, admin and system find the time
7. **Native mobile app** — PWA is sufficient; two codebases is not justified at this scale
8. **Waitlist management** — spreadsheet-level complexity, not platform-level complexity for current tournament sizes
9. **Stat leaders and advanced analytics** — deferred correctly; adds display complexity without improving operations

### Platform Positioning

LeagueOps is not trying to be SportsEngine (a full national sports organization platform) or GameChanger (a stat-tracking and fan experience tool) or TeamSnap (a team communication tool). It is a **tournament day operations platform** — the tool the admin uses to run the event from first whistle to last. The public results site and notifications are the outward face of that operations core, not the product itself. Build the operations features first; the public-facing and notification features extend their value to more people.

The clearest competitive gap is: **TourneyMachine is the incumbent for tournament operations but it is not real-time and has no structured change request workflow.** LeagueOps wins by being more real-time and giving coaches a structured path to interact with the schedule, while keeping admin authority intact.

---

*Note: WebSearch and WebFetch were unavailable during this research session. This document reflects knowledge of TourneyMachine, GameChanger, SportsEngine, TeamSnap, GotSoccer, Demosphere, and ArbiterSports as of mid-2025, cross-referenced against the specific features defined in PROJECT.md. Competitive feature claims should be spot-checked against current platform documentation before using them in external communications.*
