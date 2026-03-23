# Phase 5: Event Creation Enhancements - Research

**Researched:** 2026-03-23
**Domain:** Google Maps Places API (server-side proxy), QR code generation, event registration URL architecture, Supabase schema migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Venue Search UX**
- D-01: Replace the existing plain-text "Location / Venue" input with an inline autocomplete dropdown. Type triggers debounced Google Maps suggestions below the input; selecting a suggestion saves venue data silently.
- D-02: Freetext fallback allowed — if admin types a venue not in Google Maps and doesn't select a suggestion, save the typed text as `location` (existing column). `venue_lat`/`venue_lng`/`venue_place_id` stay NULL. Google data is optional.
- D-03: Save venue data to both the `events` table AND the associated `complexes` table. When a venue is selected, update the complex record with lat/lng/address as well.
- D-04: Restrict Google Places autocomplete to US only (`components=country:us` parameter on the API call).
- D-05: Venue autocomplete component used in two places: (1) the 'details' step of the event creation wizard (EventPicker.tsx), and (2) EventSetupTab General settings for editing existing events. Same reusable component.

**Registration Link & QR Placement**
- D-06: Add a dedicated "Sharing" section/tab within EventSetupTab to house registration link, QR code, and share buttons.
- D-07: Registration URL pattern: `/e/[slug]/register` — nested under the public event path.
- D-08: Registration link only visible after event is published/activated. Before publishing, the Sharing section shows a message indicating the link will be available after the event is published.
- D-09: Share options: copy-to-clipboard button (with toast confirmation) PLUS "Share via Email" and "Share via Text" buttons.
- D-10: Share via Email uses `mailto:` link with pre-filled subject and body. Share via Text uses `sms:` link with pre-filled body. No server-side sharing needed.
- D-11: Pre-filled share message includes event name + dates + registration link. Example: "Register for Summer Classic 2026 (June 14-16): https://leagueops.vercel.app/e/summer-classic-2026/register"

**QR Code Style & Download**
- D-12: QR code rendered using `qrcode.react ^3.x` — black-on-white for scanner compatibility.
- D-13: QR code includes event name text rendered below the QR image (self-documenting when printed).
- D-14: Two download formats: SVG (primary) and PNG. Both buttons available in the Sharing section.
- D-15: In the Sharing section, QR appears as a small thumbnail (~80px) with a "Preview" button that opens a full-size modal for inspection before download.

**Database Migration**
- D-16: Add nullable columns to `events` table: `venue_address TEXT`, `venue_lat FLOAT8`, `venue_lng FLOAT8`, `venue_place_id TEXT`. All nullable — existing events keep NULL.
- D-17: Add corresponding nullable columns to `complexes` table for lat/lng/address if they don't already exist.
- D-18: No backfill of existing `location` text into `venue_address` — keep them separate.

### Claude's Discretion
- Debounce timing on autocomplete (300ms typical)
- Exact styling of the autocomplete dropdown within the dark theme
- QR code resolution/size for PNG export
- Modal component choice for QR preview (reuse existing Modal from `components/ui` or new)
- Migration file naming and ordering

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVT-01 | Admin can search for a venue/complex via Google Maps autocomplete when creating an event | Proxy routes already built; venue search state already implemented in EventPicker.tsx — need reusable component extracted for EventSetupTab |
| EVT-02 | Complex location (lat/lng, address, place ID) saved to event record | Migration adds venue columns to `events`; EventPicker createEvent() already writes venue_place_id + venue_address — needs venue_lat/venue_lng wiring |
| EVT-03 | Google Maps API key protected via server-side proxy route (not exposed as NEXT_PUBLIC) | COMPLETE — `/api/maps/autocomplete` and `/api/maps/details` already exist with auth guards |
| EVT-04 | System generates a unique registration link per event | Slug already exists on events table (multi_event.sql); registration URL `/e/[slug]/register` is a new route in apps/public-results |
| EVT-05 | System generates a QR code for the registration link that admin can download/share | `qrcode.react` not yet installed; QRCodeSVG + QRCodeCanvas approach confirmed; SVG/PNG download patterns established |
| EVT-06 | Registration link/QR includes event slug for direct routing | Slug column confirmed present on events; `/e/[slug]/register` page must be created in apps/public-results |
</phase_requirements>

---

## Summary

Phase 5 adds two independent features to the event creation flow: (1) Google Maps venue autocomplete for finding and saving structured venue data, and (2) shareable registration QR codes per event. Both features have significant groundwork already in place.

**EVT-03 is already complete.** The server-side proxy routes `/api/maps/autocomplete` and `/api/maps/details` exist with proper auth guards and server-side `GOOGLE_MAPS_API_KEY`. No work needed there. The venue autocomplete UX pattern (search state, fetch logic, dropdown UI) is also already implemented in `EventPicker.tsx` — the main work is extracting it into a reusable component and wiring it into `EventSetupTab`.

The QR code work is greenfield: `qrcode.react` is not yet installed (current version 4.2.0 on npm), and the existing QR infrastructure in the app uses an external image API (`api.qrserver.com`) rather than the approved local library. The approved library is `qrcode.react ^3.x` per phase scope notes, but npm currently shows 4.2.0. Both render correctly — install the latest and use `QRCodeSVG` for SVG export and `QRCodeCanvas` for PNG export via ref.

The `complexes` table already has `lat`, `lng`, and `address` columns (present since phase1_migration.sql). The `events` table needs new nullable columns: `venue_address`, `venue_lat`, `venue_lng`, `venue_place_id`. The `Event` TypeScript interface also needs these fields added.

**Primary recommendation:** Extract venue autocomplete as a reusable `VenueAutocompleteInput` component, wire it in both locations, install `qrcode.react`, and build the Sharing tab in EventSetupTab.

---

## Project Constraints (from CLAUDE.md)

These directives are mandatory. The planner must verify all tasks comply.

| Directive | Impact on this phase |
|-----------|---------------------|
| Stack locked: Next.js 14 App Router + Supabase + Vercel | No changes to routing architecture; use App Router patterns |
| Keep third-party services free/cheap | GOOGLE_MAPS_API_KEY has per-request cost — US restriction (D-04) reduces noise; billing alert in GCP at $10/mo |
| Maintain dark theme (Barlow Condensed, navy/red palette) | All new UI uses `inp`/`lbl` CSS variable patterns from EventSetupTab; QR code black-on-white (D-12) — isolated from dark theme |
| Auth via Supabase Auth + user_roles table | Venue proxy routes already have auth guards; sharing tab is admin-only |
| Every DB query scoped with `.eq('event_id', eventId)` | Complex update on venue select must use `event_id` scope |
| Auto-approve all program and team registrations | Not relevant to this phase |
| NEXT_PUBLIC_* must not expose secrets | `GOOGLE_MAPS_API_KEY` already server-only (existing proxy routes confirm this); never add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY |
| `Select` must always use `bg-[#040e24]` | Apply to any select elements in new Sharing tab |
| Hooks before guards | Ensure VenueAutocompleteInput component follows this rule |
| Vercel build: prefer-const, unused vars fail builds | All new code must pass ESLint on first attempt |

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | 14.2.4 | App Router framework | Installed |
| @supabase/ssr | ^0.9.0 | Supabase SSR client | Installed |
| react-hot-toast | ^2.4.1 | Toast notifications | Installed |
| lucide-react | ^0.395.0 | Icons (QrCode, Share2, Download, Copy, Mail, MessageSquare) | Installed |

### New Packages (must be installed)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| qrcode.react | ^4.2.0 | QR code rendering (SVG + Canvas) | Approved in phase scope; current npm version is 4.2.0 (scope says ^3.x — install latest ^4.x, same API) |

**Note on version:** Phase scope specifies `qrcode.react ^3.x` but npm current is 4.2.0. The API is identical (QRCodeSVG / QRCodeCanvas exports). Install 4.2.0.

**Note on `@vis.gl/react-google-maps`:** Phase scope listed this as approved. However, it is NOT needed here — the proxy routes call the Google Maps REST API directly (not the JS SDK). Do not install this package; it would add the Maps JS SDK to the client bundle, which contradicts EVT-03 (server-side key protection). The existing fetch-based proxy approach is correct and sufficient.

### Installation
```bash
npm install qrcode.react
```

**Version verification:**
```bash
npm view qrcode.react version    # 4.2.0 (verified 2026-03-23)
```

---

## Architecture Patterns

### Recommended Project Structure (new files)
```
components/
├── events/
│   ├── EventPicker.tsx              # MODIFY: extract venue state into VenueAutocompleteInput
│   └── VenueAutocompleteInput.tsx   # NEW: reusable venue search component
├── settings/
│   └── EventSetupTab.tsx            # MODIFY: replace location input, add 'sharing' SettingsTab
supabase/
└── phase5_venue_qr.sql              # NEW: migration for venue columns on events table
types/
└── index.ts                         # MODIFY: add venue fields to Event interface
```

### Pattern 1: VenueAutocompleteInput Component

**What:** A controlled input component that wraps the venue search logic already present in EventPicker.tsx. Replaces a plain text `<input>` with search-icon prefix, dropdown prediction list, and green "Venue selected" confirmation chip.

**When to use:** Anywhere an event's venue/location needs to be set with optional Google Maps enrichment.

**Props interface:**
```typescript
// Source: EventPicker.tsx lines 401-438 (existing implementation to extract)
interface VenueAutocompleteInputProps {
  value: string                        // displayed text (location string)
  onLocationChange: (text: string) => void  // freetext fallback
  onVenueSelect: (venue: {             // structured venue data
    name: string
    address: string
    lat: number
    lng: number
    place_id: string
  }) => void
  className?: string
}
```

**Key implementation details from EventPicker.tsx (existing working code):**
- Debounce: call `/api/maps/autocomplete?q=...` only when query length >= 3
- On selection: call `/api/maps/details?place_id=...` to get lat/lng/address
- Blur close: `onBlur={() => setTimeout(() => setShowVenueDropdown(false), 200)}` — 200ms delay so `onMouseDown` on dropdown items fires before blur
- US restriction: The existing autocomplete route does NOT yet include `components=country:us`. This must be added per D-04.
- Dropdown z-index: `z-50` to float over form content

**US restriction fix required in `/api/maps/autocomplete/route.ts`:**
```typescript
// CURRENT (line 28 — missing country restriction):
const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=establishment&key=${apiKey}`

// REQUIRED (add components=country:us per D-04):
const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=establishment&components=country:us&key=${apiKey}`
```

### Pattern 2: EventSetupTab — Sharing Tab

**What:** New `'sharing'` tab added to the `SettingsTab` union type. Shows registration URL, QR thumbnail with preview modal, copy/email/SMS share buttons. Only active content when `event.status === 'active'`.

**SettingsTab change:**
```typescript
// types/index.ts already has: type SettingsTab = 'general' | 'schedule' | ...
// Add 'sharing' to the union in EventSetupTab.tsx line 37:
type SettingsTab =
  | 'general'
  | 'schedule'
  | 'rules'
  | 'public'
  | 'scoring'
  | 'advanced'
  | 'branding'
  | 'map'
  | 'permissions'
  | 'sharing'    // NEW
```

**Registration URL construction:**
```typescript
// Source: EventPicker.tsx line 207 (results_link pattern)
// Slug is guaranteed to exist — EventPicker.tsx generates it at creation time
const registrationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/e/${event.slug}/register`
// Or with window.location.origin for client-side:
const registrationUrl = `${window.location.origin}/e/${event.slug}/register`
```

**Draft-state gate (D-08):**
```typescript
// When event.status !== 'active', show placeholder instead of real URL
{event.status !== 'active' ? (
  <div className="...">Registration link available after event is published</div>
) : (
  <SharingContent registrationUrl={registrationUrl} event={event} />
)}
```

### Pattern 3: QR Code Rendering and Download

**What:** `qrcode.react` provides `QRCodeSVG` (SVG element, use ref to serialize) and `QRCodeCanvas` (canvas element, use ref for `.toDataURL()`). Use both for dual-format download.

**SVG download:**
```typescript
// Source: qrcode.react docs + common pattern
import { QRCodeSVG } from 'qrcode.react'
const svgRef = useRef<SVGSVGElement>(null)

function downloadSVG() {
  const svgEl = svgRef.current
  if (!svgEl) return
  const serializer = new XMLSerializer()
  const source = serializer.serializeToString(svgEl)
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.slug}-registration-qr.svg`
  a.click()
  URL.revokeObjectURL(url)
}

// QR rendered (hidden at 200px for clean SVG data, thumbnail shown at 80px via CSS):
<QRCodeSVG
  ref={svgRef}
  value={registrationUrl}
  size={200}
  bgColor="#ffffff"
  fgColor="#000000"
  level="M"
/>
```

**PNG download:**
```typescript
import { QRCodeCanvas } from 'qrcode.react'
const canvasRef = useRef<HTMLCanvasElement>(null)

function downloadPNG() {
  const canvas = canvasRef.current
  if (!canvas) return
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.slug}-registration-qr.png`
  a.click()
}

// Hidden canvas for PNG export (not visible to user):
<div style={{ display: 'none' }}>
  <QRCodeCanvas ref={canvasRef} value={registrationUrl} size={512} bgColor="#ffffff" fgColor="#000000" level="M" />
</div>
```

**QR thumbnail + preview modal pattern (D-15):**
```typescript
// Thumbnail: CSS-scale the SVG visually; actual rendered at 80px
<div className="w-20 h-20">
  <QRCodeSVG value={registrationUrl} size={80} bgColor="#ffffff" fgColor="#000000" level="M" />
</div>
<Btn variant="ghost" size="sm" onClick={() => setShowQRModal(true)}>
  PREVIEW
</Btn>

// Modal: reuse existing Modal from components/ui
<Modal open={showQRModal} onClose={() => setShowQRModal(false)} title="Registration QR Code">
  <div className="flex flex-col items-center gap-4 p-4 bg-white rounded">
    <QRCodeSVG ref={svgRef} value={registrationUrl} size={256} bgColor="#ffffff" fgColor="#000000" level="M" />
    <div className="text-black font-bold text-[14px]">{event.name}</div>
  </div>
  <div className="flex gap-3 justify-center mt-4">
    <Btn variant="primary" size="sm" onClick={downloadSVG}>DOWNLOAD SVG</Btn>
    <Btn variant="outline" size="sm" onClick={downloadPNG}>DOWNLOAD PNG</Btn>
  </div>
</Modal>
```

**Note:** Event name text below QR (D-13) is rendered as a `<div>` inside a white-background container alongside the QR, not as part of the QR image itself. This is cleaner than embedding text in SVG.

### Pattern 4: Database Migration

**What:** SQL migration file adding venue columns to `events`. The `complexes` table already has `lat`, `lng` (DECIMAL(10,7)), and `address` TEXT from phase1_migration.sql — no changes needed to complexes.

```sql
-- supabase/phase5_venue_qr.sql
-- Phase 5: Add venue columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_address  TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_lat      FLOAT8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_lng      FLOAT8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_place_id TEXT;

-- Verify:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'events' AND column_name LIKE 'venue_%';
```

**Apply via:** Supabase MCP tool `apply_migration` or SQL Editor at supabase.com/dashboard (consistent with Phase 4 approach per decisions log 04-02).

### Pattern 5: EventPicker.tsx — Venue Lat/Lng Wiring Gap

The existing `EventPicker.tsx` already saves `venue_place_id` and `venue_address` (lines 210-213), but it does NOT save `venue_lat` and `venue_lng`. The `selectVenue()` function (line 422) fetches lat/lng from the details route but only stores them in local state for `complexAddress`. This needs fixing alongside adding those columns to the migration.

**Required addition to EventPicker.tsx `selectVenue()`:**
```typescript
// Current: only sets complexAddress, doesn't capture lat/lng
// Needs: track selectedLat/selectedLng state and write to eventInsert
if (selectedPlaceId) {
  eventInsert.venue_place_id = selectedPlaceId
  eventInsert.venue_address = complexAddress || newLocation
  eventInsert.venue_lat = selectedLat    // NEW
  eventInsert.venue_lng = selectedLng    // NEW
}
```

### Pattern 6: EventSetupTab — Venue Update for Existing Events

For existing event editing (D-05), when admin selects a venue from autocomplete, two DB updates are needed:
1. `UPDATE events SET venue_address=..., venue_lat=..., venue_lng=..., venue_place_id=... WHERE id=eventId`
2. `UPDATE complexes SET address=..., lat=..., lng=... WHERE event_id=eventId` (update primary complex, per D-03)

The existing `saveEvent()` function in EventSetupTab already does a single `sb.from('events').update(...)` — extend it to include venue fields when they are set.

### Anti-Patterns to Avoid

- **Do not install `@vis.gl/react-google-maps`:** It loads the Google Maps JS SDK client-side, which contradicts EVT-03. The proxy route approach is correct and already built.
- **Do not use `api.qrserver.com`:** Existing QRCodesPanel uses this external service for check-in QRs. The registration QR must use local `qrcode.react` — it needs to be downloadable and work offline in a print context.
- **Do not render QR without `bgColor="#ffffff"`:** Dark theme backgrounds break QR scanner compatibility (D-12 mandates black-on-white).
- **Do not add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`:** Would expose the key in the browser bundle. The server proxy is the only approved pattern.
- **Do not use `event.id` in the registration URL:** Must use `event.slug` (D-06/D-07). Slug is already generated at event creation.
- **Do not render QR before event status = 'active':** Per D-08, show a placeholder until published.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom SVG QR grid | `qrcode.react` QRCodeSVG / QRCodeCanvas | Error correction, version management, encoding edge cases |
| SVG serialization | Manual SVG string building | `XMLSerializer.serializeToString()` (native browser API) | Built-in, handles namespaces correctly |
| PNG export from canvas | Canvas drawing code | `canvas.toDataURL('image/png')` (native canvas API) | Built-in |
| Venue autocomplete UI | Custom debounce + dropdown | Extract existing EventPicker.tsx pattern | Already built, tested in production |
| Share URL construction | Complex URL builder | Template literal + `window.location.origin` | Slug is already a clean URL segment |

**Key insight:** The hardest parts of this phase (server-side proxy, venue search UI, slug generation) are already done. The implementation work is primarily extraction/wiring + adding `qrcode.react`.

---

## Common Pitfalls

### Pitfall 1: QR Canvas Ref Timing
**What goes wrong:** `canvasRef.current` is null when `downloadPNG()` is called if the hidden canvas is conditionally rendered (e.g., wrapped in `{event.status === 'active' && ...}`).
**Why it happens:** React ref is null when the DOM element is not mounted.
**How to avoid:** Always render `QRCodeCanvas` (for the ref) — just hide it with `style={{ display: 'none' }}`, not with conditional rendering. Or use a lazy ref pattern that renders canvas only when download is triggered.
**Warning signs:** `canvas.toDataURL()` throws "Cannot read properties of null."

### Pitfall 2: SVG Download Missing XML Declaration
**What goes wrong:** SVG file downloads fine but some editors or print workflows don't recognize it as valid SVG.
**Why it happens:** `XMLSerializer` omits the XML declaration.
**How to avoid:** Prepend `<?xml version="1.0" encoding="UTF-8"?>` to serialized SVG string before creating the Blob.

### Pitfall 3: Autocomplete Dropdown Dismissed Before Selection
**What goes wrong:** User clicks a dropdown prediction and the input's `onBlur` fires first, hiding the dropdown before the click registers.
**Why it happens:** `onBlur` fires before `onClick`. EventPicker.tsx already solved this with `setTimeout(..., 200)` and `onMouseDown` (not `onClick`) on prediction buttons.
**How to avoid:** Use `onMouseDown` on dropdown items (fires before blur) and `onBlur={() => setTimeout(() => setShowVenueDropdown(false), 200)}`.

### Pitfall 4: Missing `components=country:us` on Autocomplete Route
**What goes wrong:** The existing `/api/maps/autocomplete` route does NOT include the US restriction. This is required by D-04 but was not added when the routes were built.
**Why it happens:** Routes were built in a prior phase without Phase 5 context.
**How to avoid:** This is a required fix in Wave 0 / first task of this phase. Add `&components=country:us` to the autocomplete URL in `app/api/maps/autocomplete/route.ts` line 28.

### Pitfall 5: `venue_lat`/`venue_lng` Saved as NULL Despite Selection
**What goes wrong:** Event is created with `venue_place_id` set but `venue_lat`/`venue_lng` are NULL.
**Why it happens:** The existing EventPicker.tsx `createEvent()` only saves `venue_place_id` and `venue_address` — it does not capture `lat`/`lng` from the details response (verified at lines 209-213).
**How to avoid:** Add `selectedLat`/`selectedLng` state variables to `selectVenue()` and write them to `eventInsert`.

### Pitfall 6: EventSetupTab `EventData` Interface Missing Venue Fields
**What goes wrong:** TypeScript error when trying to set `event.venue_lat` etc. in EventSetupTab.
**Why it happens:** `EventData` interface (local to EventSetupTab) at line 84 doesn't include venue fields. Neither does the global `Event` interface in `types/index.ts`.
**How to avoid:** Update BOTH interfaces in the same task — `Event` in types/index.ts AND `EventData` in EventSetupTab.tsx plus `DEFAULT_EVENT` at line 155.

### Pitfall 7: `mailto:` / `sms:` Links with Unencoded Special Characters
**What goes wrong:** Share links fail on some mobile OS versions when the URL contains spaces, ampersands, or line breaks.
**How to avoid:** Use `encodeURIComponent()` on the message body in both `mailto:` and `sms:` link construction.

---

## Code Examples

Verified patterns from existing codebase:

### Copy-to-Clipboard Pattern (from EventPicker.tsx)
```typescript
// Source: EventPicker.tsx lines 370-375
function copyCode(id: number, code: string) {
  navigator.clipboard.writeText(code)
  setCopiedCode(id)
  setTimeout(() => setCopiedCode(null), 2000)
  toast.success('Event code copied')
}
```

### Dark Theme Input Variable (from EventSetupTab.tsx line 77-80)
```typescript
// Source: EventSetupTab.tsx lines 77-80
const inp =
  'w-full bg-[#081428] border border-[#1a2d50] text-white px-3 py-2 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors'
const lbl =
  'font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase block mb-1.5'
```

### Venue Dropdown UI (from EventPicker.tsx lines 621-647)
```typescript
// Source: EventPicker.tsx lines 621-647 — reuse this exact pattern
{showVenueDropdown && venuePredictions.length > 0 && (
  <div className="absolute z-50 left-0 right-0 mt-1 bg-[#081428] border border-[#1a2d50] rounded-xl overflow-hidden shadow-xl">
    {venuePredictions.map((p) => (
      <button
        key={p.place_id}
        type="button"
        className="w-full text-left px-4 py-3 hover:bg-[#0d1a2e] transition-colors border-b border-[#1a2d50] last:border-0"
        onMouseDown={() => selectVenue(p.place_id)}
      >
        <div className="font-cond text-[12px] font-bold text-white">{p.main_text}</div>
        <div className="font-cond text-[10px] text-[#5a6e9a]">{p.secondary_text}</div>
      </button>
    ))}
  </div>
)}
```

### Settings Tab Registration Pattern (from EventSetupTab.tsx line 1218)
```typescript
// Source: EventSetupTab.tsx lines 1218-1228 — add 'sharing' entry here
const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Settings size={13} /> },
  // ... existing tabs ...
  { id: 'sharing', label: 'Sharing', icon: <Share2 size={13} /> },  // NEW
]
```

### Share via Email/SMS Construction
```typescript
// mailto: with encoded body
const subject = encodeURIComponent(`Register for ${event.name}`)
const body = encodeURIComponent(
  `Register for ${event.name} (${formatDateRange(event.start_date, event.end_date)}):\n${registrationUrl}`
)
const mailtoHref = `mailto:?subject=${subject}&body=${body}`

// sms: (works on iOS and Android)
const smsBody = encodeURIComponent(
  `Register for ${event.name}: ${registrationUrl}`
)
const smsHref = `sms:?body=${smsBody}`
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| External QR API (api.qrserver.com) | Local qrcode.react | Enables download, works offline, no external dependency |
| Plain text location field | VenueAutocompleteInput with Google Places | Structured lat/lng data for weather engine and future map features |
| No registration sharing | Dedicated Sharing tab with QR + link | Programs can distribute registration without admin help |

**Note on QR version history:** The existing `QRCodesPanel.tsx` uses `api.qrserver.com` (external image API). This phase introduces `qrcode.react` as the standard for downloadable QRs. The check-in QR panel (QRCodesPanel.tsx) is not modified in this phase — it can be migrated to `qrcode.react` in a future phase.

---

## Open Questions

1. **Registration page route location**
   - What we know: The pattern `/e/[slug]` already exists at `apps/public-results/src/app/e/[slug]/page.tsx`. The registration URL pattern is `/e/[slug]/register` (D-07).
   - What's unclear: Does `/e/[slug]/register` live in `apps/public-results` (unauthenticated public sub-app) or in the main `app/` directory? The CONTEXT.md says the pattern "aligns with public results pattern `/e/[slug]`" which is in apps/public-results. However, apps/public-results is a separate Next.js app on a different domain (`leagueops-live.vercel.app`).
   - Recommendation: Create `apps/public-results/src/app/e/[slug]/register/page.tsx` to keep registration under the same public domain. The registration link should then use `leagueops-live.vercel.app` as the base, not the admin app URL. This needs to be confirmed during planning — if programs are at `leagueops.vercel.app/register`, a separate path is needed there instead.
   - **Impact:** This affects EVT-04 and EVT-06 specifically. The QR destination URL base will differ. The planner should verify this and make a decision.

2. **`@vis.gl/react-google-maps` in scope notes vs. actual need**
   - What we know: Phase scope listed it as the "approved Maps package" but the server-proxy approach (already built) doesn't need it.
   - What's unclear: Whether the scope note was a mistake or if a map embed was originally planned.
   - Recommendation: Do not install it. The proxy routes fully satisfy EVT-01/EVT-02/EVT-03. The package would only be needed if rendering an embedded Google Map widget, which is not in the requirements.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | Check assumed | — | — |
| GOOGLE_MAPS_API_KEY env var | EVT-01, EVT-02 | Unknown — not verifiable from research env | — | Proxy returns 500 if missing |
| qrcode.react | EVT-05 | Not installed | — | Install: `npm install qrcode.react` |
| Supabase (migration apply) | D-16 database migration | Via MCP or dashboard (per Phase 4 pattern) | — | SQL Editor at supabase.com/dashboard |

**Missing dependencies with no fallback:**
- `GOOGLE_MAPS_API_KEY` must be present in Vercel environment variables for venue autocomplete to function. If absent, the proxy returns a 500 error with "Google Maps API key not configured" — the UI needs to handle this gracefully.

**Missing dependencies with fallback:**
- `qrcode.react` — install via `npm install qrcode.react` as Wave 0 task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVT-01 | VenueAutocompleteInput calls /api/maps/autocomplete on input >= 3 chars | unit | `npm run test -- __tests__/components/events/VenueAutocompleteInput.test.tsx` | No — Wave 0 |
| EVT-02 | Venue lat/lng/address/place_id saved to event record on selection | unit | `npm run test -- __tests__/components/events/EventPicker.test.tsx` | No — Wave 0 |
| EVT-03 | /api/maps/autocomplete returns 401 for unauthenticated requests | unit | `npm run test -- __tests__/api/maps/autocomplete.test.ts` | No — Wave 0 |
| EVT-03 | /api/maps/details returns 401 for unauthenticated requests | unit | `npm run test -- __tests__/api/maps/details.test.ts` | No — Wave 0 |
| EVT-04 | Registration URL constructed as /e/[slug]/register | unit | `npm run test -- __tests__/components/settings/EventSetupTab.sharing.test.tsx` | No — Wave 0 |
| EVT-05 | QRCodeSVG renders with correct value prop | unit | `npm run test -- __tests__/components/settings/EventSetupTab.sharing.test.tsx` | No — Wave 0 |
| EVT-06 | Registration URL includes event slug | unit | `npm run test -- __tests__/components/settings/EventSetupTab.sharing.test.tsx` | No — Wave 0 |

**Note:** Given that most of this phase is UI/integration work, the most valuable tests are smoke tests verifying component render and URL construction. Full download behavior (SVG/PNG) is not automatable in jsdom — mark as manual-verify in plan.

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** Full suite green + `npm run lint` + `npm run type-check` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/components/events/VenueAutocompleteInput.test.tsx` — covers EVT-01, EVT-02
- [ ] `__tests__/api/maps/autocomplete.test.ts` — covers EVT-03 auth guard
- [ ] `__tests__/api/maps/details.test.ts` — covers EVT-03 auth guard
- [ ] `__tests__/components/settings/EventSetupTab.sharing.test.tsx` — covers EVT-04, EVT-05, EVT-06

---

## Sources

### Primary (HIGH confidence)
- Codebase: `app/api/maps/autocomplete/route.ts` — confirmed EVT-03 complete, missing country restriction
- Codebase: `app/api/maps/details/route.ts` — confirmed EVT-03 complete
- Codebase: `components/events/EventPicker.tsx` — venue search state pattern (lines 71-438)
- Codebase: `components/settings/EventSetupTab.tsx` — settings tab pattern, venue input location
- Codebase: `supabase/phase1_migration.sql` — complexes table confirmed has lat, lng, address
- Codebase: `supabase/multi_event.sql` — slug column confirmed on events table
- Codebase: `package.json` — confirmed qrcode.react NOT installed; @vis.gl/react-google-maps NOT installed
- npm registry: `npm view qrcode.react version` → 4.2.0 (verified live)
- npm registry: `npm view @vis.gl/react-google-maps version` → 1.7.1 (not needed)
- GitHub: [zpao/qrcode.react README](https://github.com/zpao/qrcode.react/blob/main/README.md) — QRCodeSVG/QRCodeCanvas props and usage

### Secondary (MEDIUM confidence)
- WebSearch: qrcode.react SVG/PNG download patterns — multiple sources confirm XMLSerializer + canvas.toDataURL() approach

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json verified, npm registry checked live
- Architecture patterns: HIGH — extracted directly from existing codebase
- Venue proxy: HIGH — routes exist and were read directly
- QR download: MEDIUM — XMLSerializer/toDataURL is well-established browser API; specific edge cases not verified against qrcode.react 4.x specifically
- Registration route location: LOW — open question about apps/public-results vs. main app needs planner decision

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable stack)
