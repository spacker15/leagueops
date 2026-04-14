---
phase: 05-event-creation-enhancements
plan: '00'
subsystem: testing
tags: [test-stubs, vitest, wave-0, nyquist]
dependency_graph:
  requires: []
  provides: [VenueAutocompleteInput.test.tsx, SharingSection.test.tsx]
  affects: [05-01, 05-02, 05-03, 05-04]
tech_stack:
  added: []
  patterns: [it.todo stubs for pending test cases]
key_files:
  created:
    - __tests__/components/VenueAutocompleteInput.test.tsx
    - __tests__/components/SharingSection.test.tsx
  modified: []
decisions:
  - 'Used it.todo() pattern for pending stubs — vitest treats todos as skipped (not failed), keeping suite green'
  - 'Created __tests__/components/ directory (did not previously exist) — follows existing __tests__/app/ and __tests__/lib/ pattern'
metrics:
  duration: '1 min'
  completed_date: '2026-03-23'
  tasks_completed: 1
  files_created: 2
  files_modified: 0
requirements:
  - EVT-01
  - EVT-02
  - EVT-04
  - EVT-05
  - EVT-06
---

# Phase 05 Plan 00: Wave 0 Test Stubs Summary

**One-liner:** Two vitest stub files with 19 todo test cases establishing the test contract for EVT-01 through EVT-06 (venue autocomplete, venue persistence, registration link, QR download, slug routing).

## What Was Built

Created the Wave 0 test stub files required by VALIDATION.md for Nyquist compliance. These stubs establish the test contract that subsequent plans (05-01 through 05-04) will implement against.

### Files Created

**`__tests__/components/VenueAutocompleteInput.test.tsx`**

- 4 todo stubs for EVT-01: venue autocomplete API call behavior, debouncing, dropdown rendering
- 4 todo stubs for EVT-02: prediction selection, onVenueSelect callback, freetext fallback, "Venue saved" chip

**`__tests__/components/SharingSection.test.tsx`**

- 3 todo stubs for EVT-04: registration URL construction, display, clipboard copy
- 3 todo stubs for EVT-05: QRCodeSVG render, QRCodeCanvas for PNG, preview modal
- 3 todo stubs for EVT-06: slug in URL, mailto href, sms href
- 2 todo stubs for D-08: draft gate (status !== active / status === active)

## Task Summary

| Task | Name                          | Commit  | Files                                                                                              |
| ---- | ----------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| 1    | Create Wave 0 test stub files | 2f9198a | **tests**/components/VenueAutocompleteInput.test.tsx, **tests**/components/SharingSection.test.tsx |

## Verification Results

- `test -f __tests__/components/VenueAutocompleteInput.test.tsx` — PASSED
- `test -f __tests__/components/SharingSection.test.tsx` — PASSED
- `npx vitest run` — 19 todo tests skipped (not failed), suite passes; 3 pre-existing failures in referee-engine.integration.test.ts (Upstash URL config — unrelated to this plan)

## Decisions Made

1. Used `it.todo()` pattern for all pending stubs — vitest treats these as skipped, not failed, so the suite stays green while documenting the test contract
2. Created `__tests__/components/` directory which did not previously exist — follows the existing `__tests__/app/` and `__tests__/lib/` directory pattern established in earlier phases

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — the test stub files themselves are intentional Wave 0 artifacts. The todo tests are the stubs; they will be implemented in plans 05-01 through 05-04.

## Self-Check: PASSED

- `__tests__/components/VenueAutocompleteInput.test.tsx` — FOUND
- `__tests__/components/SharingSection.test.tsx` — FOUND
- Commit `2f9198a` — FOUND (verified via git log)
