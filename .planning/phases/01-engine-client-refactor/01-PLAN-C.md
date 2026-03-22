---
phase: 1
plan: C
title: "Client-Side Migration"
wave: 2
depends_on: ["A", "B"]
requirements: ["SEC-03"]
files_modified:
  - "components/engine/CommandCenter.tsx"
autonomous: true
estimated_tasks: 3
---

# Plan C: Client-Side Migration

## Goal
Update `CommandCenter.tsx` to call the new API routes instead of importing engine functions directly, and verify no other client-side code imports DB-accessing engine functions.

## Context
This plan runs in wave 2, after Plans A and B are complete and all tests pass. The three new API routes created in Plan B (`/api/unified-engine`, `/api/unified-engine/resolve`, `/api/shift-handoff`) are the targets for CommandCenter's `fetch` calls.

## Tasks

<task id="1">
<title>Update CommandCenter.tsx — replace direct engine imports with API route fetch calls</title>
<read_first>
- components/engine/CommandCenter.tsx
- app/api/unified-engine/route.ts
- app/api/unified-engine/resolve/route.ts
- app/api/shift-handoff/route.ts
</read_first>
<instructions>
`CommandCenter.tsx` is a `'use client'` component that currently imports and calls `runUnifiedEngine`, `resolveAlert`, and `generateShiftHandoff` directly from `@/lib/engines/unified`. These engine functions now require a server-side Supabase client and cannot be called from client code. Replace each with a `fetch` call to the corresponding API route.

**Step 1: Remove the engine imports**
Find and remove:
```typescript
import { runUnifiedEngine, resolveAlert, generateShiftHandoff } from '@/lib/engines/unified'
// or however it is structured — may be separate named imports on one line
```
Keep any `type` imports from `@/lib/engines/unified` (e.g., `import type { OpsAlert } from '@/lib/engines/unified'`) — type-only imports are fine in client components since they are erased at compile time.

**Step 2: Replace runUnifiedEngine call**
Find the call site (research notes it is around line 141). Replace with a `fetch`:
```typescript
// Before:
const result = await runUnifiedEngine(eventDateId)

// After:
const resp = await fetch('/api/unified-engine', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event_date_id: eventDateId }),
})
if (!resp.ok) throw new Error('Failed to run unified engine')
const result = await resp.json()
```
Use the same variable name (`result`) so that downstream code that processes `result` does not need to change.

**Step 3: Replace resolveAlert call**
Find the call site (research notes it is around line 161). Replace with:
```typescript
// Before:
await resolveAlert(alertId, resolvedBy, note)

// After:
const resp = await fetch('/api/unified-engine/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ alert_id: alertId, resolved_by: resolvedBy, note }),
})
if (!resp.ok) throw new Error('Failed to resolve alert')
```

**Step 4: Replace generateShiftHandoff call**
Find the call site (research notes it is around line 173). Replace with:
```typescript
// Before:
const handoff = await generateShiftHandoff(createdBy)

// After:
const resp = await fetch('/api/shift-handoff', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ created_by: createdBy }),
})
if (!resp.ok) throw new Error('Failed to generate shift handoff')
const handoff = await resp.json()
```

**Step 5: Wrap each fetch call in try/catch**
Each of the three blocks above should be wrapped in `try/catch` (per CLAUDE.md Gotcha #6) and show `toast.error(...)` on failure:
```typescript
try {
  // fetch call here
} catch (err) {
  toast.error('Could not run engine — check console')
  console.error(err)
}
```
Use the existing `toast` import (from `react-hot-toast`) — it should already be in the file.

**Step 6: Verify call site line numbers**
The line numbers in the research (141, 161, 173) are approximate. Read the actual file before editing to locate the exact call sites. Do not blindly edit line 141 — find the actual function call by name.
</instructions>
<acceptance_criteria>
- [ ] `import { runUnifiedEngine, resolveAlert, generateShiftHandoff }` (or any runtime import of these) is absent from `CommandCenter.tsx`
- [ ] `import type { OpsAlert }` (or other type-only imports) from `@/lib/engines/unified` may remain if present — they are compile-time only
- [ ] `runUnifiedEngine` call is replaced with `fetch('/api/unified-engine', ...)`
- [ ] `resolveAlert` call is replaced with `fetch('/api/unified-engine/resolve', ...)`
- [ ] `generateShiftHandoff` call is replaced with `fetch('/api/shift-handoff', ...)`
- [ ] Each fetch call is wrapped in `try/catch` with `toast.error(...)` on failure
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
</acceptance_criteria>
</task>

<task id="2">
<title>Verify no other client-side files import DB-accessing engine functions</title>
<read_first>
- components/weather/WeatherTab.tsx
</read_first>
<instructions>
The research identified two client-side files that import from engine modules:
1. `CommandCenter.tsx` — fixed in Task 1
2. `WeatherTab.tsx` — imports only pure helper functions (`conditionIcon`, `windDirection`, `evaluateAlerts`, `calcHeatIndex`, `THRESHOLDS`) and types, which are safe to import from client code (no DB access)

This task confirms the full picture is clean.

**Step 1: Search for all engine imports in client components**
Search the codebase for files that:
- Import from `@/lib/engines/*`
- Are `'use client'` components or client-only files (`lib/store.tsx`, `lib/auth.tsx`, etc.)

Run these searches:
- `grep -r "from '@/lib/engines/" components/` — list every component that imports any engine
- `grep -r "from '@/lib/engines/" lib/` — check store and auth

**Step 2: Evaluate each result**
For each file found:
- If it imports ONLY pure functions and types from `weather.ts` (e.g., `evaluateAlerts`, `calcHeatIndex`, `conditionIcon`, `windDirection`, `THRESHOLDS`) or type-only imports — this is acceptable. Leave it.
- If it imports any DB-accessing function (`runRefereeEngine`, `runFieldConflictEngine`, `runWeatherEngine`, `getLatestReading`, `getReadingHistory`, `checkLightningStatus`, `liftLightningDelay`, `runUnifiedEngine`, `resolveAlert`, `generateShiftHandoff`, `checkPlayerEligibility`, etc.) — this must be removed and redirected to an API route call. Fix it following the same pattern as Task 1.

**Step 3: Document results**
If no additional problem imports are found, note: "Verified: no other client-side files import DB-accessing engine functions." If additional fixes were made, list the files and what was changed.

**Step 4: Confirm store.tsx is clean**
The research confirmed `lib/store.tsx` has no direct engine imports. Verify by checking the file — search for `from '@/lib/engines'`. Must return zero results.
</instructions>
<acceptance_criteria>
- [ ] Search of `components/` for `from '@/lib/engines/'` shows only `WeatherTab.tsx` (pure functions only)
- [ ] Search of `lib/` for `from '@/lib/engines/'` returns zero results
- [ ] `lib/store.tsx` has no engine imports
- [ ] Any additional problem imports found are fixed (or documented as none found)
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="3">
<title>Smoke-test CommandCenter API calls in development</title>
<read_first>
- components/engine/CommandCenter.tsx
- app/api/unified-engine/route.ts
</read_first>
<instructions>
After the client-side migration, confirm the end-to-end flow works in the development server. This task is a manual verification step.

**Step 1: Start the dev server**
```bash
npm run dev
```

**Step 2: Open the app and navigate to the Command Center tab**
The Command tab is in the main app navigation (tab id: `command`).

**Step 3: Trigger the unified engine run**
Click the "Run Engine" button (or whatever the trigger is in `CommandCenter.tsx`). Observe:
- No JavaScript console errors of the form: `TypeError: Cannot call createClient in browser context` or similar
- The network tab shows a POST to `/api/unified-engine` (not a direct function call error)
- The response returns 200 with a JSON body (may have empty alerts array if no event data exists)

**Step 4: Confirm no "createClient from browser" errors**
The symptom of the pre-refactor bug was that engines called `createClient()` from the browser, which returned a client without a valid server session — queries returned empty arrays. After refactor, the POST to `/api/unified-engine` should hit the server-side route.

**Step 5: Check browser console**
Confirm zero errors referencing:
- `@/lib/engines/unified` imports
- `createClient` in browser context
- Any `fetch` relative URL resolution failures

If any errors appear, diagnose and fix before marking this task complete. Common issues:
- Missing `'use client'` on a component that uses hooks
- Wrong JSON field name in the fetch body (e.g., `eventDateId` vs `event_date_id`)
- Route not found (check file path is exactly `app/api/unified-engine/route.ts`)
</instructions>
<acceptance_criteria>
- [ ] Dev server starts without build errors
- [ ] Navigating to Command Center tab does not throw runtime errors
- [ ] Triggering engine run results in a POST to `/api/unified-engine` (visible in network tab)
- [ ] No console errors referencing engine imports or `createClient` in browser context
- [ ] Response from `/api/unified-engine` is a valid JSON object (even if alerts array is empty)
</acceptance_criteria>
</task>

## Verification
- [ ] `grep -r "from '@/lib/engines/unified'" components/` returns only type-only imports (if any) — no runtime function imports
- [ ] `grep -r "runUnifiedEngine\|resolveAlert\|generateShiftHandoff" components/` — must return zero results (runtime calls are gone)
- [ ] `grep -r "from '@/lib/engines/" lib/store.tsx` — returns zero results
- [ ] `npm run type-check` passes
- [ ] `npm run build` completes without errors
- [ ] Dev server smoke test confirms CommandCenter engine trigger works end-to-end

## Must-Haves
- `CommandCenter.tsx` contains zero runtime imports of DB-accessing engine functions
- All three CommandCenter engine operations route through API calls (`/api/unified-engine`, `/api/unified-engine/resolve`, `/api/shift-handoff`)
- No other client component or library file imports DB-accessing engine functions
- The app builds and the CommandCenter tab renders without runtime errors
