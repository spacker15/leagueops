---
phase: 06-registration-flow-enhancements
verified: 2026-03-24T07:25:00Z
status: passed
score: 18/18 must-haves verified
gaps: []
human_verification:
  - test: 'Registration wizard Step 3 renders additional coaches section and availability toggle'
    expected: 'Collapsible ADDITIONAL COACHES section appears per team; ADD COACH button appends rows; Trash2 deletes rows; Available All Dates toggle shows/hides checkboxes'
    why_human: 'Requires browser interaction in live registration wizard to verify collapse/expand behavior and form state updates'
  - test: 'Coach self-registration flow end-to-end via /coach/[token]'
    expected: "Valid token shows form with team dropdown; submission saves coach and shows YOU'RE REGISTERED! success card; expired/revoked token shows branded error page"
    why_human: 'Requires live Supabase data (valid coach_invite row) and network requests'
  - test: 'Program leader portal shows coach invite lifecycle'
    expected: 'GENERATE INVITE LINK creates token; COPY LINK writes to clipboard; QR modal shows black-on-white QR; REVOKE LINK opens confirmation modal and sets is_active=false'
    why_human: 'Requires authentication as a program leader role with a registered program and event'
  - test: 'Registration window enforcement on /e/[slug]/register'
    expected: "Closed event (registration_open=false) shows 'Registration is currently closed' with no form; open event shows register link"
    why_human: 'Requires live Supabase event record with registration window fields set'
---

# Phase 6: Registration Flow Enhancements Verification Report

**Phase Goal:** Build coach management (direct add + self-registration links), team availability selection, multi-team registration, and registration date enforcement into the program registration system.
**Verified:** 2026-03-24T07:25:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                        | Status     | Evidence                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Schema migration creates coaches, coach_teams, coach_invites, coach_conflicts tables         | ✓ VERIFIED | `supabase/phase6_registration.sql` — 4 CREATE TABLE IF NOT EXISTS statements confirmed                                                        |
| 2   | Event and team_registrations tables extended with registration window + availability columns | ✓ VERIFIED | ALTER TABLE statements in SQL file; `registration_opens_at`, `available_date_ids` confirmed                                                   |
| 3   | TypeScript interfaces exist for Coach, CoachTeam, CoachInvite, CoachConflict                 | ✓ VERIFIED | `types/index.ts` lines 489, 498, 511, 524 — all four interfaces present                                                                       |
| 4   | Coach conflict engine detects coaches on multiple teams and pairs them                       | ✓ VERIFIED | `lib/engines/coach-conflicts.ts` exports `detectCoachConflicts` + `getConflictingTeamPairs`; 5/5 unit tests pass                              |
| 5   | Admin can set registration window dates and manual toggle in EventSetupTab                   | ✓ VERIFIED | `components/settings/EventSetupTab.tsx` — datetime inputs, role="switch" toggle, SAVE REGISTRATION SETTINGS button confirmed                  |
| 6   | Admin can define event schedule dates via MultiDatePicker                                    | ✓ VERIFIED | `components/events/MultiDatePicker.tsx` exists with `eachDayOfInterval`, navy `bg-[#0B3D91]` selected state, `px-3 py-3` cells                |
| 7   | Sharing tab shows green/red/gray registration status badge                                   | ✓ VERIFIED | EventSetupTab lines 3289-3295 — all three Pill variants (green/red/gray) with correct labels                                                  |
| 8   | Program leader can add coaches per team in Step 3 of registration wizard                     | ✓ VERIFIED | `components/auth/RegisterPage.tsx` — ADDITIONAL COACHES section, ADD COACH button, Trash2 delete, collapsible per-team                        |
| 9   | Program leader can select per-team availability dates in Step 3                              | ✓ VERIFIED | `availableAllDates` toggle with `role="switch"`, individual date checkboxes, validation warning at lines 1604–1646                            |
| 10  | Team count indicator and copy-from-team-1 button present                                     | ✓ VERIFIED | "Team {i+1} of {teams.length}" at line 1314; `copyFromTeam1` function deep-copies coach+availability state                                    |
| 11  | Additional coaches saved to coaches + coach_teams tables on submission                       | ✓ VERIFIED | Submission handler inserts to `coaches` (role: head/assistant) then `coach_teams` with `added_by: 'program_leader'`                           |
| 12  | Available date IDs saved to team_registrations on submission                                 | ✓ VERIFIED | `available_date_ids: availableDateIds` in team_registrations update at line 640                                                               |
| 13  | Coach can self-register via /coach/[token] token-gated page                                  | ✓ VERIFIED | `app/coach/[token]/page.tsx` server component + `CoachJoinClient.tsx` client form — COMPLETE REGISTRATION, YOU'RE REGISTERED!                 |
| 14  | Expired/invalid/closed tokens show branded error page with no form                           | ✓ VERIFIED | page.tsx checks `is_active`, `expires_at`, `regDateClosed`; error messages "expired", "already been used", "invalid" all present              |
| 15  | Coach API route validates token, rate-limits, inserts coach+team, detects conflicts          | ✓ VERIFIED | `app/api/coach/route.ts` — PUBLIC ROUTE annotation, `publicRatelimit`, GET+POST handlers, `detectCoachConflicts` called                       |
| 16  | Program leader can generate, copy, and revoke coach invite links with QR                     | ✓ VERIFIED | `ProgramLeaderDashboard.tsx` — GENERATE INVITE LINK, COPY LINK, REVOKE LINK, QRCodeSVG `bgColor="#FFFFFF"`                                    |
| 17  | Registration window enforcement blocks wizard when window is closed                          | ✓ VERIFIED | `app/e/[slug]/register/page.tsx` — all three closed messages present, `bg-[#081428]` card background                                          |
| 18  | Schedule engine uses coach conflicts as slot-level constraints                               | ✓ VERIFIED | `lib/engines/schedule.ts` — `getConflictingTeamPairs` imported, `coachConflictInSlot` check in slot assignment loop (NOT in filteredMatchups) |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact                                         | Expected                                              | Status     | Details                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `supabase/phase6_registration.sql`               | All Phase 6 schema changes                            | ✓ VERIFIED | 4 CREATE TABLE + 2 ALTER TABLE statements; `registration_opens_at`, `available_date_ids` columns             |
| `types/index.ts`                                 | 5 new TypeScript interfaces                           | ✓ VERIFIED | TeamRegistration, Coach, CoachTeam, CoachInvite, CoachConflict all present; Event extended                   |
| `lib/engines/coach-conflicts.ts`                 | Coach conflict detection engine                       | ✓ VERIFIED | Exports `detectCoachConflicts` and `getConflictingTeamPairs`; queries `coach_teams` by event_id              |
| `__tests__/lib/engines/coach-conflicts.test.ts`  | Unit tests for conflict detection                     | ✓ VERIFIED | 5/5 tests pass (verified with vitest run)                                                                    |
| `components/events/MultiDatePicker.tsx`          | Multi-date picker for event schedule dates            | ✓ VERIFIED | `'use client'`, `eachDayOfInterval`, `bg-[#0B3D91]` selected state, `px-3 py-3` cell padding                 |
| `components/settings/EventSetupTab.tsx`          | Registration window fields + schedule dates + badge   | ✓ VERIFIED | SCHEDULE DATES, REGISTRATION WINDOW sections; Pill badges; role="switch" toggle                              |
| `components/auth/RegisterPage.tsx`               | Extended Step 3 with coaches + availability + UX      | ✓ VERIFIED | All required patterns confirmed: ADDITIONAL COACHES, availableAllDates, COPY FROM TEAM 1, coach_teams insert |
| `app/coach/[token]/page.tsx`                     | Server component for coach token validation           | ✓ VERIFIED | No 'use client'; queries coach_invites; error states; passes context to CoachJoinClient                      |
| `app/coach/[token]/CoachJoinClient.tsx`          | Client form for coach self-registration               | ✓ VERIFIED | 'use client'; COMPLETE REGISTRATION; YOU'RE REGISTERED!; bg-[#040e24] select; toast.error                    |
| `app/api/coach/route.ts`                         | GET (validate) + POST (submit) coach registration API | ✓ VERIFIED | PUBLIC ROUTE; publicRatelimit; GET+POST handlers; coaches insert; coach_teams insert; detectCoachConflicts   |
| `components/programs/ProgramLeaderDashboard.tsx` | Coach invite section in program leader portal         | ✓ VERIFIED | GENERATE INVITE LINK; COPY LINK; REVOKE LINK; QRCodeSVG bgColor="#FFFFFF"; coach_teams fetch                 |
| `app/api/coach-invite/route.ts`                  | API for generating/revoking coach invite tokens       | ✓ VERIFIED | POST + DELETE handlers; crypto.randomUUID(); coach_invites upsert with onConflict                            |
| `app/e/[slug]/register/page.tsx`                 | Registration window enforcement wrapper               | ✓ VERIFIED | registration_open, registration_opens_at, registration_closes_at; all three closed messages; bg-[#081428]    |
| `lib/engines/schedule.ts`                        | Coach conflict slot-level constraints                 | ✓ VERIFIED | getConflictingTeamPairs imported; teamsShareCoach helper; coachConflictInSlot in slot loop only              |
| `components/programs/ProgramApprovals.tsx`       | Admin coach conflict badges                           | ✓ VERIFIED | COACH CONFLICT Pill variant="yellow"; coach_conflicts fetch; aria-label; "also assigned to" text             |

---

### Key Link Verification

| From                                             | To                               | Via                                      | Status  | Details                                                                           |
| ------------------------------------------------ | -------------------------------- | ---------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| `lib/engines/coach-conflicts.ts`                 | `coach_teams` table              | Supabase query `.from('coach_teams')`    | ✓ WIRED | Line 23: `.from('coach_teams').select(...).eq('event_id', eventId)`               |
| `components/events/MultiDatePicker.tsx`          | `event_dates` table              | Supabase insert/delete in EventSetupTab  | ✓ WIRED | EventSetupTab line ~1885 renders MultiDatePicker; event_dates queries present     |
| `components/settings/EventSetupTab.tsx`          | `/api/events/[id]`               | PATCH with registration window fields    | ✓ WIRED | `registration_opens_at` field bound to form state; included in saveSettings PATCH |
| `components/auth/RegisterPage.tsx`               | `coaches` table                  | Supabase insert on form submission       | ✓ WIRED | `.from('coaches').insert(...)` confirmed in submission handler                    |
| `components/auth/RegisterPage.tsx`               | `coach_teams` table              | Supabase insert linking coach to team    | ✓ WIRED | `.from('coach_teams').insert(...)` confirmed in submission handler                |
| `components/auth/RegisterPage.tsx`               | `team_registrations`             | Supabase update with available_date_ids  | ✓ WIRED | `available_date_ids: availableDateIds` in update call                             |
| `app/coach/[token]/page.tsx`                     | `coach_invites` table            | Supabase query by token                  | ✓ WIRED | `.from('coach_invites').select(...).eq('token', params.token)`                    |
| `app/api/coach/route.ts`                         | `coaches` + `coach_teams`        | Supabase insert on POST                  | ✓ WIRED | `.from('coaches').insert(...)` then `.from('coach_teams').insert(...)`            |
| `components/programs/ProgramLeaderDashboard.tsx` | `/api/coach-invite`              | fetch POST to generate, DELETE to revoke | ✓ WIRED | `fetch('/api/coach-invite', { method: 'POST' })` and DELETE confirmed             |
| `app/e/[slug]/register/page.tsx`                 | `events` table                   | Supabase query for registration window   | ✓ WIRED | `.select('...registration_opens_at, registration_closes_at, registration_open')`  |
| `lib/engines/schedule.ts`                        | `lib/engines/coach-conflicts.ts` | `getConflictingTeamPairs` import         | ✓ WIRED | Line 20 import; line 242 call before slot assignment; line 455 slot check         |

---

### Data-Flow Trace (Level 4)

| Artifact                                         | Data Variable                 | Source                                               | Produces Real Data | Status    |
| ------------------------------------------------ | ----------------------------- | ---------------------------------------------------- | ------------------ | --------- |
| `components/settings/EventSetupTab.tsx`          | `event.registration_opens_at` | Supabase event fetch + saveSettings PATCH            | Yes                | ✓ FLOWING |
| `components/auth/RegisterPage.tsx`               | `eventDates`                  | `.from('event_dates').select(...).eq('event_id')`    | Yes                | ✓ FLOWING |
| `components/auth/RegisterPage.tsx`               | `additionalCoaches`           | Per-team form state, persisted on submit to coaches  | Yes                | ✓ FLOWING |
| `components/programs/ProgramLeaderDashboard.tsx` | coaches list                  | `.from('coach_teams').select('coaches(name,email)')` | Yes                | ✓ FLOWING |
| `components/programs/ProgramLeaderDashboard.tsx` | invite status                 | `.from('coach_invites').select('token,is_active')`   | Yes                | ✓ FLOWING |
| `app/e/[slug]/register/page.tsx`                 | `closedMessage`               | Event's registration_open / opens_at / closes_at     | Yes                | ✓ FLOWING |
| `components/programs/ProgramApprovals.tsx`       | `conflictsByTeam`             | `.from('coach_conflicts').eq('event_id')`            | Yes                | ✓ FLOWING |
| `lib/engines/schedule.ts`                        | `coachConflictPairs`          | `getConflictingTeamPairs(eventId, sb)`               | Yes                | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                                    | Command                                                                                                       | Result                                                                                                         | Status |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------ |
| Coach-conflicts engine: 5 unit tests pass                   | `npx vitest run __tests__/lib/engines/coach-conflicts.test.ts`                                                | 5/5 passed                                                                                                     | ✓ PASS |
| Coach-conflicts: `getConflictingTeamPairs` exports function | `node -e "const m = require('./lib/engines/coach-conflicts'); console.log(typeof m.getConflictingTeamPairs)"` | function                                                                                                       | ✓ PASS |
| Schedule engine: slot-level check NOT in filteredMatchups   | `grep -n "filteredMatchups\|coachConflict" schedule.ts`                                                       | coachConflictPairs set on line 242, coachConflictInSlot on line 455, outside filteredMatchups block (line 330) | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description                                                                                  | Status      | Evidence                                                                                           |
| ----------- | -------------- | -------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| REG-01      | 06-02, 06-05   | Admin defines event schedule dates before registration opens                                 | ✓ SATISFIED | MultiDatePicker in EventSetupTab + registration window date inputs + enforcement page              |
| REG-02      | 06-03          | Program leader can select team availability — all dates or specific dates per team           | ✓ SATISFIED | `availableAllDates` toggle + date checkboxes in RegisterPage Step 3; saved to `available_date_ids` |
| REG-03      | 06-03          | Program leader can add coaches directly to a team with name, email, phone, certifications    | ✓ SATISFIED | ADDITIONAL COACHES section in RegisterPage Step 3; saved to `coaches` + `coach_teams`              |
| REG-04      | 06-04, 06-05   | System generates a unique coach self-registration link per program                           | ✓ SATISFIED | `app/api/coach-invite/route.ts` POST upserts token; `ProgramLeaderDashboard.tsx` exposes it        |
| REG-05      | 06-04          | Coach can self-register via link — selects team, provides name, email, phone, certifications | ✓ SATISFIED | `app/coach/[token]/` full flow: validation → form → POST to `/api/coach` → success state           |
| REG-06      | 06-01, 06-05   | System detects when same coach is assigned to multiple teams and flags the conflict          | ✓ SATISFIED | `detectCoachConflicts` engine + upsert to `coach_conflicts`; yellow badges in ProgramApprovals     |
| REG-07      | 06-01, 06-05   | Coach conflicts surface to admin during schedule generation as hard constraints              | ✓ SATISFIED | `getConflictingTeamPairs` wired into `generateSchedule()` slot assignment loop as skip constraint  |
| REG-08      | 06-03          | Program leader can register one or many teams in a single registration session               | ✓ SATISFIED | "Team N of M" indicator + COPY FROM TEAM 1 button; multi-team coach/availability UI                |

All 8 requirements explicitly mapped and satisfied. No orphaned requirements (all REG-01 through REG-08 claimed in plan frontmatter).

---

### Anti-Patterns Found

| File       | Line | Pattern | Severity | Impact                                                                              |
| ---------- | ---- | ------- | -------- | ----------------------------------------------------------------------------------- |
| None found | —    | —       | —        | No stubs, empty returns, or disconnected handlers detected across all phase 6 files |

**Anti-pattern scan summary:** All coach insert handlers persist to real Supabase tables. Toggle switches are wired to state setters. Form submission handler has substantive DB operations. Schedule engine check is correctly placed in slot loop (not a matchup-level filter). Registration window closed page computes status from real event data.

---

### Human Verification Required

#### 1. Registration Wizard Step 3 UX

**Test:** Load the registration wizard at `/register?event_id=<id>` as a program leader. Navigate to Step 3 and add a second team. Verify the ADDITIONAL COACHES section collapses/expands per team independently; ADD COACH appends a new row with 4 fields; Trash2 icon removes it; "Available All Dates" toggle shows/hides date checkboxes with validation.
**Expected:** Each team has its own independent expanded-state for the coaches section; form prevents submission when toggle is OFF and no dates selected.
**Why human:** Requires browser interaction to test per-index state management and collapse/expand behavior.

#### 2. Coach Self-Registration End-to-End

**Test:** Use a valid coach invite link (e.g., `/coach/<token>`) from a program that has team registrations. Fill in name, email, phone, certifications, select a team, and submit. Then attempt to use an expired or revoked link.
**Expected:** Successful submission shows YOU'RE REGISTERED! success card. Expired/revoked links show branded error page with no form fields.
**Why human:** Requires live Supabase data and network round-trips to verify Supabase inserts succeed.

#### 3. Program Leader Coach Invite Portal

**Test:** Log in as a program leader. Navigate to the program leader dashboard. Use GENERATE INVITE LINK, then COPY LINK, then view the QR modal. Finally use REVOKE LINK and confirm the modal.
**Expected:** COPY LINK writes URL to clipboard with a toast. QR modal shows black-on-white QR code with download buttons. REVOKE sets is_active=false and clears the UI.
**Why human:** Requires program leader authentication and clipboard API behavior that cannot be grepped.

#### 4. Registration Window Enforcement

**Test:** Set an event's `registration_open = false` in Supabase. Visit `/e/<slug>/register`. Verify the "Registration is currently closed" page appears with no registration form. Then set `registration_open = true` and verify the register link appears.
**Expected:** Closed state shows informational card only; open state shows "Register Now" link to the main app.
**Why human:** Requires live Supabase mutation and public sub-app routing to verify.

---

### Gaps Summary

No gaps identified. All 18 observable truths verified against the actual codebase. All 15 required artifacts exist, are substantive (not stubs), and are wired to real data sources. All 8 requirement IDs (REG-01 through REG-08) are covered by plan implementations and confirmed in code. The coach conflict slot-level constraint is correctly placed in the schedule engine's inner loop and not misapplied as a matchup-level filter.

Phase 6 goal — "Build coach management (direct add + self-registration links), team availability selection, multi-team registration, and registration date enforcement into the program registration system" — is fully achieved.

---

_Verified: 2026-03-24T07:25:00Z_
_Verifier: Claude (gsd-verifier)_
