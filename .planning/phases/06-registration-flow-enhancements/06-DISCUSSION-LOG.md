# Phase 6: Registration Flow Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 06-registration-flow-enhancements
**Areas discussed:** Coach registration UX, Team availability dates, Registration window enforcement, Multi-team registration, Coach invite link UX, Coach conflicts engine, Program leader portal changes

---

## Coach Registration UX

### How should coaches be added during registration?

| Option | Description | Selected |
|--------|-------------|----------|
| Expand existing team step | Keep head coach fields in Step 3, add 'Additional Coaches' section per team. Coach invite link is separate. | ✓ |
| Dedicated coach step | Add a new Step 4 'Coaches' between teams and confirm. | |
| Head coach in wizard, rest via invite only | Only capture head coach in wizard. All others self-register via invite link. | |

**User's choice:** Expand existing team step (Recommended)

### Where should coach invite links be generated?

| Option | Description | Selected |
|--------|-------------|----------|
| Admin generates in Command Center | Admin generates links per program from admin view. | |
| Program leader generates in their portal | Program leaders generate from own dashboard. More self-service. | ✓ |
| Auto-generated on registration approval | Links auto-created when admin approves registration. | |

**User's choice:** Program leader generates in their portal

### What info should coach self-registration collect?

| Option | Description | Selected |
|--------|-------------|----------|
| Name, email, phone, certifications | Matches REG-05. Certifications as text field. Coach selects team from dropdown. | ✓ |
| Name, email, phone only | Minimal. Certifications captured later. | |
| Full profile with photo | Name, email, phone, certifications, bio, headshot. | |

**User's choice:** Name, email, phone, certifications (Recommended)

### How should coach conflicts be surfaced?

| Option | Description | Selected |
|--------|-------------|----------|
| Warning badge in Command Center | Show warning badge on affected teams. Also flag during schedule generation. | ✓ |
| Inline warning during registration | Show immediate warning in wizard when adding duplicate email. | |
| Report-only | Admin runs a report. No inline warnings. | |

**User's choice:** Warning badge in Command Center (Recommended)

---

## Team Availability Dates

### How should admin define event schedule dates?

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-date picker in EventSetupTab | Admin picks individual dates. Stored as array/table. Supports skipping days. | ✓ |
| Date range only | Start/end date. System generates all dates in range. | |
| Date range with exclusions | Start/end + exclude specific dates. | |

**User's choice:** Multi-date picker in EventSetupTab (Recommended)

### How should program leaders select team availability?

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox list per team | Show event dates as checkboxes. 'Available all dates' toggle (default ON). | ✓ |
| Calendar view per team | Mini calendar with tap-to-toggle dates. | |
| Single dropdown per team | 'All dates' or 'Select dates' dropdown. | |

**User's choice:** Checkbox list per team (Recommended)

---

## Registration Window Enforcement

### What should users see when registration is closed?

| Option | Description | Selected |
|--------|-------------|----------|
| Informational page with dates | Show event name, logo, message about dates. No form. | ✓ |
| Disabled form | Show form greyed out with banner. | |
| Redirect to event page | Redirect to /e/[slug] with toast. | |

**User's choice:** Informational page with dates (Recommended)

### Should admin be able to override the registration window?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, manual toggle | Toggle 'Registration Open' on/off regardless of dates. | ✓ |
| Dates only, no override | Strict date control. Change dates to extend. | |
| Override with password | Generate bypass link for late registrations. | |

**User's choice:** Yes, manual toggle (Recommended)

### Do coach invite links also respect the registration window?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, expire at registration close | Tokens expire when registration closes or manually toggled off. | ✓ |
| Independent expiry | Own expiry date set by program leader. | |
| Never expire | Active until revoked. | |

**User's choice:** Yes, expire at registration close (Recommended)

### Where should registration dates and toggle live in EventSetupTab?

| Option | Description | Selected |
|--------|-------------|----------|
| Existing General tab | Alongside start_date/end_date. All date config in one place. | ✓ |
| New 'Registration' tab | Dedicated tab for registration config. | |
| Sharing tab | Next to registration link/QR. | |

**User's choice:** Existing General tab (Recommended)

### Should Sharing tab reflect registration status?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show status badge | Green/red badge showing 'Registration Open' or 'Registration Closed'. | ✓ |
| No, dates only in General tab | Sharing tab shows link/QR regardless. | |

**User's choice:** Yes, show status badge (Recommended)

---

## Multi-Team Registration

### What improvements beyond existing 'Add Team' button?

| Option | Description | Selected |
|--------|-------------|----------|
| Copy coach info + availability across teams | 'Copy from Team 1' for coach fields and dates. Team count indicator. | ✓ |
| Bulk import from CSV | Upload CSV with team data. Good for large programs. | |
| Current flow is sufficient | Just integrate new fields cleanly. | |

**User's choice:** Copy coach info + availability across teams (Recommended)

---

## Coach Invite Link UX

### How should the coach self-registration page work?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple form with team selection | Event branding, form fields, team dropdown. No account creation. | ✓ |
| Account-based registration | Coach creates account first. More friction, enables portal access. | |
| Minimal — just confirm identity | Link pre-fills team. Coach enters name/email/phone/certs only. | |

**User's choice:** Simple form with team selection (Recommended)

### What happens with expired/used invite links?

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly error page | Event branding + message. Contact info for program leader. No form. | ✓ |
| Redirect to event page | Send to /e/[slug] with toast. | |
| Allow re-registration | Token stays valid. Coach can update info. | |

**User's choice:** Friendly error page (Recommended)

---

## Coach Conflicts Engine

### When should coach conflict detection run?

| Option | Description | Selected |
|--------|-------------|----------|
| On coach assignment | Run check whenever coach added to team. Write flag to DB immediately. | ✓ |
| Batch before schedule generation | Full scan before scheduling. No real-time detection. | |
| Both real-time and batch | Check on each add AND full scan before scheduling. | |

**User's choice:** On coach assignment (Recommended)

### How should conflicts integrate with schedule generation?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard constraint — block simultaneous scheduling | Teams sharing coach cannot be scheduled at same time. | ✓ |
| Soft warning | Generate normally, flag conflicts. Admin decides. | |
| Pre-check only | Show conflicts before generation. Admin resolves manually. | |

**User's choice:** Hard constraint — block simultaneous scheduling (Recommended)

---

## Program Leader Portal Changes

### How should portal surface coach management?

| Option | Description | Selected |
|--------|-------------|----------|
| Coach section per team | Each team card gets Coaches section + Generate Invite Link button + QR. | ✓ |
| Dedicated coaches tab | Top-level Coaches tab listing all coaches across teams. | |
| Minimal — invite link only | Just add invite link button per team. No coach list in portal. | |

**User's choice:** Coach section per team (Recommended)

### Can program leaders revoke coach invite links?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with regenerate | Revoke existing + generate new. Simple toggle/button. | ✓ |
| No, admin only | Only admins can revoke/manage. | |
| Auto-expire only | Links expire at registration close. No manual revocation. | |

**User's choice:** Yes, with regenerate (Recommended)

---

## Claude's Discretion

- Database table design for coaches, coach_teams, coach_invites, event_dates, coach_conflicts
- Multi-date picker component choice
- Exact styling of coach section in program leader portal
- QR code size for coach invite links
- Migration file naming and ordering
- Coach conflicts engine internal implementation

## Deferred Ideas

None — discussion stayed within phase scope
