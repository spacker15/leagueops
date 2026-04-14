# Phase 5: Event Creation Enhancements - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Google Maps venue search to the event creation flow and generate shareable registration QR codes per event. This phase covers EVT-01 through EVT-06: venue autocomplete UI, venue data persistence, registration URL generation, QR code rendering/download, and sharing features.

</domain>

<decisions>
## Implementation Decisions

### Venue Search UX

- **D-01:** Replace the existing plain-text "Location / Venue" input with an inline autocomplete dropdown. Type triggers debounced Google Maps suggestions below the input; selecting a suggestion saves venue data silently.
- **D-02:** Freetext fallback allowed — if admin types a venue not in Google Maps and doesn't select a suggestion, save the typed text as `location` (existing column). `venue_lat`/`venue_lng`/`venue_place_id` stay NULL. Google data is optional.
- **D-03:** Save venue data to both the `events` table AND the associated `complexes` table. When a venue is selected, update the complex record with lat/lng/address as well.
- **D-04:** Restrict Google Places autocomplete to US only (`components=country:us` parameter on the API call).
- **D-05:** Venue autocomplete component used in two places: (1) the 'details' step of the event creation wizard, and (2) EventSetupTab General settings for editing existing events. Same reusable component.

### Registration Link & QR Placement

- **D-06:** Add a dedicated "Sharing" section/tab within EventSetupTab to house registration link, QR code, and share buttons.
- **D-07:** Registration URL pattern: `/e/[slug]/register` — nested under the public event path.
- **D-08:** Registration link only visible after event is published/activated. Before publishing, the Sharing section shows a message indicating the link will be available after the event is published.
- **D-09:** Share options: copy-to-clipboard button (with toast confirmation) PLUS "Share via Email" and "Share via Text" buttons.
- **D-10:** Share via Email uses `mailto:` link with pre-filled subject and body. Share via Text uses `sms:` link with pre-filled body. No server-side sharing needed.
- **D-11:** Pre-filled share message includes event name + dates + registration link. Example: "Register for Summer Classic 2026 (June 14-16): https://leagueops.vercel.app/e/summer-classic-2026/register"

### QR Code Style & Download

- **D-12:** QR code rendered using `qrcode.react ^3.x` — black-on-white for scanner compatibility.
- **D-13:** QR code includes event name text rendered below the QR image (self-documenting when printed).
- **D-14:** Two download formats: SVG (primary) and PNG. Both buttons available in the Sharing section.
- **D-15:** In the Sharing section, QR appears as a small thumbnail (~80px) with a "Preview" button that opens a full-size modal for inspection before download.

### Database Migration

- **D-16:** Add nullable columns to `events` table: `venue_address TEXT`, `venue_lat FLOAT8`, `venue_lng FLOAT8`, `venue_place_id TEXT`. All nullable — existing events keep NULL.
- **D-17:** Add corresponding nullable columns to `complexes` table for lat/lng/address if they don't already exist.
- **D-18:** No backfill of existing `location` text into `venue_address` — keep them separate.

### Claude's Discretion

- Debounce timing on autocomplete (300ms typical)
- Exact styling of the autocomplete dropdown within the dark theme
- QR code resolution/size for PNG export
- Modal component choice for QR preview (reuse existing Modal from `components/ui` or new)
- Migration file naming and ordering

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing API Routes (already built)

- `app/api/maps/autocomplete/route.ts` — Google Places Autocomplete proxy with auth guard and server-side API key (EVT-03 complete)
- `app/api/maps/details/route.ts` — Google Places Details proxy returning name, address, lat, lng (EVT-03 complete)

### Event Creation UI

- `components/settings/EventSetupTab.tsx` — Main event settings component with wizard + tabs. Venue input at line ~1148, settings tabs at line ~36
- `components/events/EventPicker.tsx` — Event creation with slug generation (line ~182), auto-generates `results_link`

### Existing Patterns

- `components/ui/index.tsx` — Shared UI component barrel (Modal, Btn, StatusBadge, etc.)
- `types/index.ts` — Event interface definition (line ~28) — needs venue fields added
- `supabase/schema.sql` — Events table definition (line ~12) — migration target

### Public Results (slug usage)

- `apps/public-results/src/lib/data.ts` — `getPublicEventBySlug()` using slug column
- `apps/public-results/src/app/e/[slug]/page.tsx` — Public event page by slug

### QR Code Existing Usage

- `components/auth/QRCodesPanel.tsx` — Existing QR code usage in the app
- `components/checkin/CheckInTab.tsx` — QR codes for player check-in

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **Google Maps API routes** (`/api/maps/autocomplete`, `/api/maps/details`): Already built with auth guards and server-side key. EVT-03 is effectively complete.
- **Modal component** (`components/ui/index.tsx`): Existing Modal for QR preview
- **Slug generation** (`EventPicker.tsx`): Already generates slugs on event creation
- **Copy pattern** (`EventPicker.tsx`): Copy-to-clipboard with toast exists for event_code
- **QR code components** (`QRCodesPanel.tsx`, `CheckInTab.tsx`): Existing QR patterns in the app (though `qrcode.react` not yet in package.json)

### Established Patterns

- **Dark theme** inputs: `bg-[#081428] border border-[#1a2d50] text-white` (from `inp` variable in EventSetupTab)
- **Label style**: `font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase` (from `lbl` variable)
- **Toast notifications**: `react-hot-toast` for feedback
- **Settings tabs**: EventSetupTab uses tab-based navigation (`SettingsTab` type) — new "sharing" tab fits this pattern
- **Auth guards**: `createClient()` from `@/lib/supabase/server` + `auth.getUser()` check

### Integration Points

- **EventSetupTab wizard step 3 (details)**: Replace plain text location input with autocomplete component
- **EventSetupTab settings tabs**: Add new "sharing" tab to `SettingsTab` union type
- **EventPicker.tsx event creation**: Wire venue data into event insert alongside existing slug generation
- **events table**: Migration adds venue columns
- **complexes table**: Migration adds venue columns for lat/lng/address
- **types/index.ts Event interface**: Add venue fields

</code_context>

<specifics>
## Specific Ideas

- Registration link pattern `/e/[slug]/register` aligns with public results pattern `/e/[slug]`
- QR with event name below is self-documenting for printed flyers — no separate label needed
- US-only restriction on Places API reduces noise and aligns with youth lacrosse focus
- mailto: and sms: links are the simplest reliable sharing approach — no native app dependencies

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 05-event-creation-enhancements_
_Context gathered: 2026-03-23_
