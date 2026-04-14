---
phase: 06-registration-flow-enhancements
plan: 02
subsystem: event-setup
tags: [registration, event-dates, multi-date-picker, admin-ui]
dependency_graph:
  requires: [06-01]
  provides: [MultiDatePicker, registration-window-controls, registration-status-badge]
  affects: [EventSetupTab, event_dates-table, events-table]
tech_stack:
  added: []
  patterns: [date-fns month-grid, Supabase insert/delete toggle, Pill status badge]
key_files:
  created:
    - components/events/MultiDatePicker.tsx
  modified:
    - components/settings/EventSetupTab.tsx
decisions:
  - 'registration_open: null means auto/date-based; true = manual open; false = manual closed — cycles via toggle'
  - 'toggleEventDate does insert or delete directly in Supabase event_dates, no batch save needed'
  - 'datetime-local inputs slice to 16 chars on load (yyyy-MM-ddTHH:mm) to avoid browser incompatibility'
  - 'saveRegistrationSettings is a separate save action from the main SAVE button to avoid unexpected overwrites'
metrics:
  duration: 4 min
  completed: '2026-03-24'
  tasks: 1
  files: 2
---

# Phase 6 Plan 02: Admin Event Setup — Registration Window + Schedule Dates Summary

**One-liner:** Multi-date picker for event schedule dates, registration window datetime inputs with manual override toggle, and green/red/gray status badge in Sharing tab.

## What Was Built

### MultiDatePicker component (`components/events/MultiDatePicker.tsx`)

A new client component that renders a month-view calendar grid between an event's start and end dates. Key behaviors:

- Uses date-fns `eachDayOfInterval`, `eachMonthOfInterval`, `startOfWeek`, `endOfWeek`, `isSameDay`, `isSameMonth` for full grid generation
- Renders one calendar grid per month in the event date range
- Day cells: selected = `bg-[#0B3D91] text-white rounded-lg` (navy accent), unselected = `hover:bg-[#0a1a3a]`, out-of-range = `text-[#2a3a5a] cursor-not-allowed`
- Day headers: `text-[12px] text-[#5a6e9a] font-cond font-black tracking-[.12em] uppercase`
- Month header: `text-[18px] font-cond font-black text-white`
- Padding: `px-3 py-3` per UI-SPEC spacing exception

### EventSetupTab General tab additions

**Schedule Dates section (D-11):**

- Renders MultiDatePicker between event start_date and end_date
- Clicking a date calls `toggleEventDate(isoDate)` which INSERT or DELETEs from `event_dates` table
- Toast on successful save; shows count of selected dates

**Registration Window section (D-13, D-14, D-15):**

- Two `datetime-local` inputs: `registration_opens_at` and `registration_closes_at`
- Manual override toggle button cycling: `null` (auto) → `true` (manual open) → `false` (manual closed) → `null`
  - Auto with dates: navy "Auto"
  - Auto without dates: gray "OFF"
  - Manual open: green "Override: Open"
  - Manual closed: red "Override: Closed"
- Toggle has `role="switch"` and `aria-checked` for accessibility
- "SAVE REGISTRATION SETTINGS" button with spinner, calls `saveRegistrationSettings()`

### EventSetupTab Sharing tab additions (D-17)

Registration status badge shown next to REGISTRATION LINK header:

- `<Pill variant="green">Registration Open</Pill>` — when `registration_open === true` OR within date window
- `<Pill variant="red">Registration Closed</Pill>` — when `registration_open === false` OR past close date
- `<Pill variant="gray">Registration Window Not Set</Pill>` — no dates and no manual toggle

### EventData interface and data flow

Added to EventData:

- `registration_opens_at: string` (empty string = null in DB)
- `registration_closes_at: string`
- `registration_open: boolean | null`

`loadEvent` maps these from DB. `saveSettings` (main save) and `saveRegistrationSettings` (dedicated save) both persist these fields.

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes

**Pre-existing TypeScript error:** `components/auth/RegisterPage.tsx` has a pre-existing type error from 06-01/06-03 parallel agent work that was intermittently visible during a stash cycle. After restoring our changes, `tsc --noEmit` exits 0. The error was from another parallel agent's in-progress work and was resolved before our commit.

## Self-Check

- [x] `components/events/MultiDatePicker.tsx` — exists with `export function MultiDatePicker`
- [x] `components/settings/EventSetupTab.tsx` — contains all required strings
- [x] `npm run type-check` exits 0
- [x] Commit `fd4790d` exists
