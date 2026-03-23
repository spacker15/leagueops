---
phase: 05-event-creation-enhancements
plan: 02
subsystem: event-creation
tags: [venue, autocomplete, google-maps, event-picker, event-setup]
dependency_graph:
  requires: [05-01]
  provides: [EVT-01, EVT-02]
  affects: [components/events/EventPicker.tsx, components/settings/EventSetupTab.tsx]
tech_stack:
  added: []
  patterns: [reusable-component-wiring, callback-delegation, supabase-conditional-update]
key_files:
  created: []
  modified:
    - components/events/EventPicker.tsx
    - components/settings/EventSetupTab.tsx
decisions:
  - "handleVenueSelect() in EventPicker owns all venue state updates -- delegates to VenueAutocompleteInput for search/select UX"
  - "Complex update in EventSetupTab uses .is('lat', null).limit(1) filter to avoid overwriting manually-set complex coordinates"
  - "CheckCircle kept in EventPicker lucide imports -- still used for copy event code feedback"
metrics:
  duration: 2 min
  completed_date: "2026-03-23T16:40:00Z"
  tasks: 2
  files_modified: 2
---

# Phase 05 Plan 02: Venue Autocomplete Wiring Summary

Wire VenueAutocompleteInput component (built in Plan 01) into both event creation flows. Fixes venue_lat/venue_lng wiring gap in EventPicker and adds complex table updates on venue selection per D-03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire VenueAutocompleteInput into EventPicker.tsx + fix lat/lng gap | 7d9c8c4 | components/events/EventPicker.tsx |
| 2 | Wire VenueAutocompleteInput into EventSetupTab.tsx + complex update | c89474a | components/settings/EventSetupTab.tsx |

## What Was Built

**Task 1 — EventPicker.tsx:**
- Replaced 5 inline venue state variables (`venueQuery`, `venuePredictions`, `venueSearching`, `showVenueDropdown`) with 4 lean state vars: `selectedPlaceId`, `selectedLat`, `selectedLng`, `selectedVenueAddress`
- Removed `searchVenue()` and `selectVenue()` inline async functions (logic now lives inside VenueAutocompleteInput)
- Added `handleVenueSelect()` callback that sets all venue state and pre-fills complex name/address
- Fixed `createEvent()` eventInsert to include `venue_lat` and `venue_lng` (EVT-02 wiring gap now closed)
- Replaced inline search UI (Search icon, input, dropdown, chip) with `<VenueAutocompleteInput>` component

**Task 2 — EventSetupTab.tsx:**
- Added import for `VenueAutocompleteInput` from `@/components/events/VenueAutocompleteInput`
- Replaced wizard step 3 plain text location input with `VenueAutocompleteInput` (sets location + all venue fields via `set()`)
- Replaced general settings tab plain text location input with `VenueAutocompleteInput` (same venue field updates + complex record update per D-03)
- Complex update: `sb.from('complexes').update().eq('event_id', eventId).is('lat', null).limit(1)` — only updates the first complex without lat set, preserving manually-set coordinates
- Confirmed `saveSettings()` already includes all venue fields from Plan 01 Task 1

## Success Criteria Check

1. EventPicker.tsx uses VenueAutocompleteInput instead of inline venue search code — DONE
2. EventPicker.tsx saves venue_lat and venue_lng to event record (fixes wiring gap) — DONE
3. EventSetupTab.tsx uses VenueAutocompleteInput in both wizard and general settings — DONE (2 usages)
4. Selecting a venue in EventSetupTab also updates the associated complex record — DONE
5. Freetext fallback still works (onLocationChange fires on every keystroke without selecting) — DONE (VenueAutocompleteInput passes text through onLocationChange)
6. TypeScript compiles cleanly — DONE (tsc --noEmit: no errors)
7. ESLint passes — DONE (no errors, only pre-existing warnings)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CheckCircle still needed in EventPicker imports**
- **Found during:** Task 1 TypeScript check
- **Issue:** Plan said to remove CheckCircle from lucide-react imports, but it is still used on line 941 for the copy event code "Copied!" state (unrelated to venue)
- **Fix:** Kept CheckCircle in imports; only removed Search (no longer used after VenueAutocompleteInput wiring)
- **Files modified:** components/events/EventPicker.tsx
- **Commit:** 7d9c8c4

## Known Stubs

None — all venue data flows from VenueAutocompleteInput through real callbacks to Supabase inserts/updates.

## Self-Check: PASSED
