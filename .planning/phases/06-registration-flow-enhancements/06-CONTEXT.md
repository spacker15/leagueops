# Phase 6: Registration Flow Enhancements - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Build coach management (direct add in registration wizard + self-registration invite links), team availability date selection, registration window enforcement with admin override, and multi-team registration improvements into the existing program registration system. Covers REG-01 through REG-08.

</domain>

<decisions>
## Implementation Decisions

### Coach Registration UX

- **D-01:** Expand existing Step 3 ("teams") in the registration wizard. Keep head coach fields, add an "Additional Coaches" section per team where program leader enters name, email, phone, and certifications for assistant coaches. Coach invite link generation is separate (in program leader portal, not during wizard).
- **D-02:** Coach self-registration follows the existing `app/join/[token]` pattern — create `app/coach/[token]/page.tsx`. Simple form: name, email, phone, certifications text field, and team dropdown (pre-filtered to the program's teams). No account creation required.
- **D-03:** Coach info collected: name, email, phone, certifications (matches REG-05 spec). Certifications as a free text field (e.g., "US Lacrosse Level 2").
- **D-04:** Expired/used coach invite links show a friendly error page with event branding and message ("This invite link has expired" or "This link has already been used"). Contact info for program leader shown if available. No form displayed.

### Coach Invite Links

- **D-05:** Program leaders generate coach invite links from their own portal dashboard (not admin-generated). Per-program link — coach selects team from dropdown during self-registration.
- **D-06:** Program leaders can revoke an existing invite link (deactivates token) and regenerate a new one. Simple toggle/button in the coach section of their portal.
- **D-07:** Coach invite tokens expire at the event's registration close date. When registration is manually toggled off, invites also become invalid.

### Coach Conflicts

- **D-08:** Coach conflict detection runs on coach assignment — whenever a coach is added to a team (during registration wizard, coach self-registration, or admin manual add). Conflict flag written to DB immediately.
- **D-09:** Conflicts surfaced as warning badges in Command Center on affected teams in the admin's team/program management view. No inline warning during registration.
- **D-10:** Coach conflicts integrate with schedule generation as hard constraints — teams sharing a coach CANNOT be scheduled at the same time. `lib/engines/coach-conflicts.ts` reads `coach_conflicts` table and provides constraints to the schedule engine (same pattern as field conflicts).

### Team Availability Dates

- **D-11:** Admin defines event schedule dates via a multi-date picker in EventSetupTab General tab. Individual dates (e.g., June 14, 15, 16) stored as records in a new `event_dates` table. Supports tournaments that skip days.
- **D-12:** Program leaders select per-team availability in Step 3 as a checkbox list. "Available all dates" toggle at top (default ON). If toggled off, program leader checks individual dates. Stored as `available_date_ids` JSONB on `team_registrations`.

### Registration Window Enforcement

- **D-13:** Add `registration_opens_at` (TIMESTAMPTZ) and `registration_closes_at` (TIMESTAMPTZ) columns to `events` table. Both nullable — if unset, no automatic window enforcement.
- **D-14:** Add manual `registration_open` BOOLEAN toggle to `events` table. Manual toggle takes precedence over dates. Admin can override open/close regardless of date settings.
- **D-15:** Registration date pickers and manual toggle live in the existing General tab of EventSetupTab alongside start_date/end_date.
- **D-16:** When registration is closed (either by date or toggle), the `/e/[slug]/register` page shows an informational page with event branding: event name, logo, and message ("Registration opens [date]" or "Registration closed on [date]"). No form fields visible.
- **D-17:** Sharing tab shows a green/red status badge ("Registration Open" / "Registration Closed") next to the registration link for at-a-glance status.

### Multi-Team Registration

- **D-18:** Add "Copy from Team 1" button for coach fields and availability dates across teams. When programs register 5+ teams, re-entering is tedious. Also add team count indicator ("Team 3 of 5").

### Program Leader Portal

- **D-19:** Each team card/row in the program leader dashboard gets a "Coaches" section showing assigned coaches, coach count, and a "Generate Invite Link" button. Invite link is copyable with QR code (same qrcode.react pattern as Phase 5).
- **D-20:** Program leaders can see their team's availability selections and coach assignments in the portal after registration.

### Claude's Discretion

- Database table design for `coaches`, `coach_teams`, `coach_invites`, `event_dates`, `coach_conflicts`
- Multi-date picker component choice (custom vs library)
- Exact styling of coach section in program leader portal
- QR code size for coach invite links
- Migration file naming and ordering
- Coach conflicts engine internal implementation details
- Whether to reuse existing `registration_invites` table pattern or create new `coach_invites` table

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Registration Wizard (core modification target)

- `components/auth/RegisterPage.tsx` — Main 5-step registration wizard. Step 3 ("teams") is the primary modification point for coach fields and availability dates.
- `components/programs/RegistrationConfig.tsx` — Admin configuration for divisions and custom questions

### Token-Based Registration Pattern (coach invites follow this)

- `app/join/[token]/page.tsx` — Server component that validates token from `registration_invites` table
- `app/join/[token]/JoinClient.tsx` — Client form component for referee/volunteer registration
- `app/api/join/route.ts` — GET (validate token) + POST (submit registration). Public route, rate-limited.
- `supabase/registration_invites.sql` — Token table schema (id, event_id, type, token UNIQUE, is_active)

### Coach Schema (already exists)

- `supabase/add_coach_role.sql` — Coach role definition in AppRole enum
- `supabase/coach_team_link.sql` — team_id column on user_roles for coach-team linking

### Program Leader Portal

- `components/programs/ProgramLeaderDashboard.tsx` — Program leader view (teams, rosters, program info)
- `components/programs/ProgramApprovals.tsx` — Admin approval workflow for programs/teams

### Event Settings (registration window UI)

- `components/settings/EventSetupTab.tsx` — Main event settings. General tab for date config. Sharing tab for registration link/QR.
- `components/events/EventPicker.tsx` — Event creation with slug generation

### Existing Schema

- `supabase/program_registration.sql` — programs, team_registrations, program_teams, program_leaders tables
- `supabase/registration_config.sql` — registration_divisions, registration_questions, registration_answers tables
- `supabase/schema.sql` — Base events table
- `supabase/event_setup.sql` — Extended event fields
- `types/index.ts` — Event and Team type interfaces

### QR Code Pattern (reuse for coach invites)

- `components/settings/EventSetupTab.tsx` — Phase 5 Sharing tab with QR code rendering (qrcode.react)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **Token registration pattern** (`app/join/[token]`): Complete flow for token validation + simple form + submission. Coach self-registration follows this exact pattern.
- **QR code rendering** (`qrcode.react ^3.x`): Already in package.json from Phase 5. Black-on-white pattern established.
- **Registration wizard** (`RegisterPage.tsx`): Step 3 already supports multiple teams with coach fields. Extending with additional coaches and availability is additive.
- **Copy pattern** (`RegisterPage.tsx`): "Copy coach info from first team" button already exists in the wizard.
- **Dark theme inputs**: `bg-[#081428] border border-[#1a2d50] text-white` (Phase 5 pattern)

### Established Patterns

- **Coach role**: Already defined in schema (`add_coach_role.sql`). `user_roles.team_id` column exists for coach-team linking.
- **Registration invites**: `registration_invites` table with token, event_id, type, is_active — reusable pattern for coach invites.
- **Engine pattern**: All engines (`referee.ts`, `weather.ts`, `field.ts`, etc.) accept injected Supabase client + event_id. Coach conflicts engine follows same signature.
- **Settings tabs**: EventSetupTab uses `SettingsTab` type union for tab navigation.
- **Toast notifications**: `react-hot-toast` for user feedback.

### Integration Points

- **RegisterPage Step 3**: Add "Additional Coaches" section and date availability checkboxes per team
- **EventSetupTab General tab**: Add registration_opens_at, registration_closes_at date pickers + manual toggle
- **EventSetupTab Sharing tab**: Add registration status badge (green/red)
- **ProgramLeaderDashboard**: Add coach section per team with invite link generation
- **Schedule generation engine**: Wire coach conflicts as hard constraints
- **`/e/[slug]/register` route**: Add registration window check before rendering wizard
- **events table**: Migration adds registration window columns + registration_open toggle
- **New tables**: event_dates, coaches/coach_invites, coach_conflicts

</code_context>

<specifics>
## Specific Ideas

- Coach invite link follows existing `/join/[token]` pattern — new route at `/coach/[token]`
- Coach conflicts engine (`lib/engines/coach-conflicts.ts`) is a pure TS module matching existing engine conventions (injected client, event_id parameter)
- Multi-date picker for event schedule dates works well for multi-day tournaments that skip rest days
- "Available all dates" toggle defaulting ON reduces friction — most teams are available all days
- Registration status badge in Sharing tab gives admin at-a-glance awareness without navigating to General tab
- Program leader self-service for invite links reduces admin workload — admin doesn't need to be involved in coach onboarding

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 06-registration-flow-enhancements_
_Context gathered: 2026-03-23_
