# Phase 5: Event Creation Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 05-event-creation-enhancements
**Areas discussed:** Venue search UX, Registration link & QR placement, QR code download & style, Venue search scope, Registration link visibility, QR preview in app, Database migration strategy, Event creation wizard flow, Share button behavior

---

## Venue Search UX

| Option                                        | Description                                                                                             | Selected |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| Replace text input with autocomplete dropdown | Type in existing Location field, debounced dropdown appears, select one, lat/lng/address saved silently | ✓        |
| Autocomplete + confirmation card              | Same dropdown but show confirmation card with full address and map pin preview                          |          |
| You decide                                    | Claude picks based on existing design system                                                            |          |

**User's choice:** Replace text input with autocomplete dropdown
**Notes:** Simple inline UX preferred

---

### Venue Not Found Handling

| Option                   | Description                                                                                          | Selected |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | -------- |
| Allow freetext fallback  | If no suggestion picked, save typed text as location. venue_lat/lng stay null. Google data optional. | ✓        |
| Require Google selection | Must pick from Google results                                                                        |          |
| You decide               | Claude picks                                                                                         |          |

**User's choice:** Allow freetext fallback
**Notes:** Youth lacrosse venues may be unlisted parks

---

### Venue Data Persistence

| Option            | Description                                                       | Selected |
| ----------------- | ----------------------------------------------------------------- | -------- |
| Event record only | Save venue fields directly on events table. Complexes unchanged.  |          |
| Update both       | Save to events AND update associated complex with lat/lng/address | ✓        |
| You decide        | Claude picks                                                      |          |

**User's choice:** Update both

---

## Registration Link & QR Placement

| Option                                       | Description                                                             | Selected |
| -------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| In EventSetupTab general section             | Add Registration Link card inline with other event settings             |          |
| Dedicated 'Sharing' section in EventSetupTab | New tab/section within EventSetupTab for registration link, QR, sharing | ✓        |
| You decide                                   | Claude picks                                                            |          |

**User's choice:** Dedicated 'Sharing' section in EventSetupTab

---

### Registration URL Pattern

| Option                | Description                    | Selected |
| --------------------- | ------------------------------ | -------- |
| /register/[eventSlug] | Direct registration path       |          |
| /e/[slug]/register    | Nested under public event path | ✓        |
| You decide            | Claude picks                   |          |

**User's choice:** /e/[slug]/register

---

### Copy-to-Clipboard Behavior

| Option                           | Description                                                 | Selected |
| -------------------------------- | ----------------------------------------------------------- | -------- |
| Copy button + toast confirmation | Simple copy with toast feedback                             |          |
| Copy + share options             | Copy button plus Share via Email and Share via Text buttons | ✓        |
| You decide                       | Claude picks                                                |          |

**User's choice:** Copy + share options

---

## QR Code Download & Style

### Download Format

| Option           | Description                                            | Selected |
| ---------------- | ------------------------------------------------------ | -------- |
| SVG only         | Scalable, crisp, small file                            |          |
| SVG + PNG option | Primary SVG, also offer PNG download for flyers/emails | ✓        |
| You decide       | Claude picks                                           |          |

**User's choice:** SVG + PNG option

---

### QR Branding

| Option                | Description                                                       | Selected |
| --------------------- | ----------------------------------------------------------------- | -------- |
| Plain QR only         | Clean black-on-white, no text or logo                             |          |
| QR + event name below | QR code with event name text below, self-documenting when printed | ✓        |
| You decide            | Claude picks                                                      |          |

**User's choice:** QR + event name below

---

## Venue Search Scope

| Option         | Description                                       | Selected |
| -------------- | ------------------------------------------------- | -------- |
| US only        | Restrict to United States (components=country:us) | ✓        |
| No restriction | Global search                                     |          |
| You decide     | Claude picks                                      |          |

**User's choice:** US only

---

## Registration Link Visibility

| Option                             | Description                                                             | Selected |
| ---------------------------------- | ----------------------------------------------------------------------- | -------- |
| Always visible once event exists   | Link generated on creation, page shows 'not yet open' if reg not active |          |
| Only show after event is published | Link hidden until admin publishes event                                 | ✓        |
| You decide                         | Claude picks                                                            |          |

**User's choice:** Only show after event is published

---

## QR Preview in App

| Option                   | Description                                                  | Selected |
| ------------------------ | ------------------------------------------------------------ | -------- |
| Inline preview card      | Medium QR (150-200px) displayed inline with download buttons |          |
| Small thumbnail + expand | Small QR (~80px) with Preview button opening full-size modal | ✓        |
| You decide               | Claude picks                                                 |          |

**User's choice:** Small thumbnail + expand

---

## Database Migration Strategy

| Option                          | Description                                                                                  | Selected |
| ------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| All nullable                    | venue_address, venue_lat, venue_lng, venue_place_id all nullable. Existing events keep NULL. | ✓        |
| Nullable with location backfill | Same nullable columns but copy existing location text into venue_address                     |          |
| You decide                      | Claude picks                                                                                 |          |

**User's choice:** All nullable

---

## Event Creation Wizard Flow

| Option                          | Description                                            | Selected      |
| ------------------------------- | ------------------------------------------------------ | ------------- |
| In the 'details' wizard step    | Replace plain text input in step 3 of creation wizard  | ✓             |
| Only in settings after creation | Keep wizard simple, venue search only in EventSetupTab |               |
| Both                            | Autocomplete in wizard AND settings                    | ✓ (follow-up) |

**User's choice:** In the 'details' wizard step, AND also available when editing in EventSetupTab settings
**Notes:** Same reusable autocomplete component used in both places

---

## Share Button Behavior

### Pre-filled Message Content

| Option                    | Description                   | Selected |
| ------------------------- | ----------------------------- | -------- |
| Event name + dates + link | Full context in share message | ✓        |
| Event name + link only    | Shorter, admin adds details   |          |
| You decide                | Claude picks                  |          |

**User's choice:** Event name + dates + link

---

### Share Technical Implementation

| Option                      | Description                                                      | Selected |
| --------------------------- | ---------------------------------------------------------------- | -------- |
| mailto: and sms: links      | Simple, works everywhere, no server needed                       | ✓        |
| Web Share API with fallback | navigator.share() on supported devices, fallback to mailto:/sms: |          |
| You decide                  | Claude picks                                                     |          |

**User's choice:** mailto: and sms: links

---

## Claude's Discretion

- Debounce timing on autocomplete
- Exact dropdown styling within dark theme
- QR code resolution/size for PNG export
- Modal component choice for QR preview
- Migration file naming and ordering

## Deferred Ideas

None — discussion stayed within phase scope
