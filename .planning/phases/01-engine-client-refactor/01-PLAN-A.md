---
phase: 1
plan: A
title: "Core Engine Refactor"
wave: 1
depends_on: []
requirements: ["SEC-03", "SEC-06"]
files_modified:
  - "lib/engines/rules.ts"
  - "lib/engines/referee.ts"
  - "lib/engines/field.ts"
  - "lib/engines/weather.ts"
  - "lib/engines/eligibility.ts"
  - "lib/engines/unified.ts"
  - "app/api/field-engine/route.ts"
autonomous: true
estimated_tasks: 7
---

# Plan A: Core Engine Refactor

## Goal
Refactor all 6 engine modules to accept an injected `SupabaseClient` parameter, remove all browser client imports, fix the field-engine resolved bug, and move the OpenWeather API key to a server-only environment variable.

## Tasks

<task id="1">
<title>Refactor rules.ts — inject SupabaseClient, remove browser client import</title>
<read_first>
- lib/engines/rules.ts
- supabase/server.ts
- supabase/client.ts
</read_first>
<instructions>
`rules.ts` must be refactored first because `field.ts` depends on it. Steps:

1. Remove the import: `import { createClient } from '@/supabase/client'`
2. Add the type import at the top of the file: `import type { SupabaseClient } from '@supabase/supabase-js'`
3. Update every function signature that currently calls `createClient()` internally:
   - `loadRules(eventId: number)` → `loadRules(eventId: number, sb: SupabaseClient)`
   - `getRules(eventId: number)` → `getRules(eventId: number, sb: SupabaseClient)`
   - `updateRule(id: string, newValue: string, changedBy: string)` → `updateRule(id: string, newValue: string, changedBy: string, sb: SupabaseClient)`
   - `resetRule(id: string)` → `resetRule(id: string, sb: SupabaseClient)`
   - `resetAllRules(eventId: number)` → `resetAllRules(eventId: number, sb: SupabaseClient)`
4. Inside each of those functions, remove the line `const sb = createClient()` (or however it is currently named — the internal `createClient()` call). Use the injected `sb` parameter for all Supabase operations.
5. The pure getter functions (`invalidateRulesCache`, `getRule`, `getRuleNum`, `getRuleBool`, `getWeatherThresholds`, `getRefereeRules`, `getSchedulingRules`) delegate to `getRules`. Update `getSchedulingRules` and `getWeatherThresholds` and `getRefereeRules` to accept and pass through `sb: SupabaseClient` to `getRules`. Update `getRules` to call `loadRules(eventId, sb)` instead of `loadRules(eventId)`.
6. Add a comment above the module-level cache variables (`_cache`, `_cacheTime`) noting: `// TODO Phase 2: key cache by eventId — module-level cache causes cross-event pollution when multi-event support is enabled`
7. Confirm zero remaining references to `createClient` in this file.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/client'` is gone from `rules.ts`
- [ ] `import type { SupabaseClient } from '@supabase/supabase-js'` is present
- [ ] `loadRules`, `getRules`, `updateRule`, `resetRule`, `resetAllRules` each have `sb: SupabaseClient` as a parameter
- [ ] `getSchedulingRules`, `getWeatherThresholds`, `getRefereeRules` each have `sb: SupabaseClient` as a parameter and pass it to `getRules`
- [ ] No internal `createClient()` calls remain
- [ ] Cache TODO comment is present
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="2">
<title>Refactor referee.ts — inject SupabaseClient, remove browser client import</title>
<read_first>
- lib/engines/referee.ts
</read_first>
<instructions>
`referee.ts` is standalone with no cross-engine dependencies. Steps:

1. Remove: `import { createClient } from '@/supabase/client'`
2. Add: `import type { SupabaseClient } from '@supabase/supabase-js'`
3. The private internal function `clearStaleConflicts(eventDateId, types)` currently calls `createClient()`. Change its signature to `clearStaleConflicts(eventDateId: number, types: string[], sb: SupabaseClient)` and remove the internal `createClient()` call.
4. `runRefereeEngine(eventDateId)` → `runRefereeEngine(eventDateId: number, sb: SupabaseClient)`. Remove the internal `createClient()` call. Pass `sb` to `clearStaleConflicts(...)` calls within this function.
5. `findAvailableRefs(eventDateId, gameTime, division, excludeRefIds)` → add `sb: SupabaseClient` as the last parameter. Remove the internal `createClient()` call.
6. Remove the module-level `EVENT_ID = 1` constant if it exists. Any remaining hardcoded `event_id: 1` values are noted but NOT changed in Phase 1 (Phase 2 handles hardcode removal).
7. Confirm zero remaining `createClient` references.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/client'` is gone from `referee.ts`
- [ ] `import type { SupabaseClient } from '@supabase/supabase-js'` is present
- [ ] `runRefereeEngine(eventDateId, sb)` signature is correct
- [ ] `findAvailableRefs(eventDateId, gameTime, division, excludeRefIds, sb)` signature is correct
- [ ] `clearStaleConflicts` accepts and uses `sb` parameter
- [ ] No internal `createClient()` calls remain
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="3">
<title>Refactor field.ts — inject SupabaseClient, remove browser client import, fix resolved bug</title>
<read_first>
- lib/engines/field.ts
- app/api/field-engine/route.ts
</read_first>
<instructions>
`field.ts` depends on `rules.ts` (already refactored in Task 1). This task also fixes the resolved-conflicts bug. Steps:

**Engine refactor:**
1. Remove: `import { createClient } from '@/supabase/client'`
2. Add: `import type { SupabaseClient } from '@supabase/supabase-js'`
3. The private `clearStaleFieldConflicts(eventDateId)` → `clearStaleFieldConflicts(eventDateId: number, sb: SupabaseClient)`. Remove its internal `createClient()` call.
4. `runFieldConflictEngine(eventDateId)` → `runFieldConflictEngine(eventDateId: number, sb: SupabaseClient)`. Remove internal `createClient()`. Pass `sb` to `clearStaleFieldConflicts`. The call to `getSchedulingRules()` must become `getSchedulingRules(sb)` (rules engine now requires `sb`).
5. `applyResolution(conflictId, action, params)` → add `sb: SupabaseClient` as last parameter. Remove internal `createClient()`.
6. `runFullConflictScan(eventDateId)` → add `sb: SupabaseClient` as last parameter. Remove internal `createClient()`. Pass `sb` down to any internal helpers.
7. Remove the module-level `EVENT_ID = 1` constant reference (leave hardcoded event_id values in DB queries for Phase 2 to fix — do not change query logic).

**Bug fix (in `app/api/field-engine/route.ts`):**
8. Find the GET handler. Locate the line with `.eq('resolved', type === 'all' ? false : false)`. Replace the entire query construction for the open/all case with a conditional filter:

```typescript
let query = sb
  .from('operational_conflicts')
  .select('*')
  .eq('event_id', eventId)
  .in('conflict_type', ['field_overlap', 'field_blocked', 'schedule_cascade', 'missing_referee'])
  .order('severity', { ascending: false })
  .order('created_at', { ascending: false })

if (type !== 'all') {
  query = query.eq('resolved', false)
}

const { data, error } = await query
```

Adjust variable names to match the existing code style in the file. The key fix is: when `type === 'all'`, do NOT apply the `resolved = false` filter.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/client'` is gone from `field.ts`
- [ ] `import type { SupabaseClient } from '@supabase/supabase-js'` is present
- [ ] `runFieldConflictEngine(eventDateId, sb)` signature is correct
- [ ] `applyResolution(conflictId, action, params, sb)` signature is correct
- [ ] `runFullConflictScan(eventDateId, sb)` signature is correct
- [ ] `clearStaleFieldConflicts(eventDateId, sb)` accepts and uses `sb` parameter
- [ ] `getSchedulingRules(sb)` call passes through the injected client
- [ ] In `app/api/field-engine/route.ts` GET handler: `type === 'all'` returns all conflicts (no resolved filter); `type === 'open'` still filters `resolved = false`
- [ ] The double-`false` ternary bug is gone
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="4">
<title>Refactor weather.ts — inject SupabaseClient, move OpenWeather key to server-only (SEC-06)</title>
<read_first>
- lib/engines/weather.ts
- app/api/weather-engine/route.ts
</read_first>
<instructions>
`weather.ts` is standalone. This task also satisfies SEC-06 (OpenWeather key migration). Steps:

**Engine refactor:**
1. Remove: `import { createClient } from '@/supabase/client'`
2. Add: `import type { SupabaseClient } from '@supabase/supabase-js'`
3. The functions that use Supabase: `runWeatherEngine`, `getLatestReading`, `getReadingHistory`, `checkLightningStatus`, `liftLightningDelay`. Each currently calls `createClient()` internally.
   - `runWeatherEngine(complexId, apiKey?)` → `runWeatherEngine(complexId: number, sb: SupabaseClient, apiKey?: string)`
   - `getLatestReading(complexId)` → `getLatestReading(complexId: number, sb: SupabaseClient)`
   - `getReadingHistory(complexId, hours)` → `getReadingHistory(complexId: number, hours: number, sb: SupabaseClient)`
   - `checkLightningStatus(complexId)` → `checkLightningStatus(complexId: number, sb: SupabaseClient)`
   - `liftLightningDelay(complexId, eventId)` → `liftLightningDelay(complexId: number, eventId: number, sb: SupabaseClient)`
4. Remove the internal `createClient()` call from each of these functions. Use the injected `sb`.
5. The pure functions (`evaluateAlerts`, `calcHeatIndex`, `getMockWeather`, `windDirection`, `conditionIcon`) have no DB access — leave their signatures unchanged.

**OpenWeather key migration (SEC-06):**
6. Find the line in `runWeatherEngine` that reads: `const key = apiKey ?? process.env.NEXT_PUBLIC_OPENWEATHER_KEY ?? ''`
7. Change it to: `const key = apiKey ?? process.env.OPENWEATHER_API_KEY ?? ''`
8. Remove any other references to `NEXT_PUBLIC_OPENWEATHER_KEY` in the file (grep the file to be sure — there should be only one).

**Environment variable note (document in code comment):**
9. Add a comment above the key line: `// Server-only: OPENWEATHER_API_KEY must be set in Vercel env and .env.local (not NEXT_PUBLIC_*)`

**Do not touch:**
- `evaluateAlerts`, `calcHeatIndex`, `getMockWeather`, `windDirection`, `conditionIcon` — leave as-is
- The `apiKey` parameter on `runWeatherEngine` stays (enables testability without env var)
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/client'` is gone from `weather.ts`
- [ ] `import type { SupabaseClient } from '@supabase/supabase-js'` is present
- [ ] `runWeatherEngine(complexId, sb, apiKey?)` signature is correct
- [ ] `getLatestReading`, `getReadingHistory`, `checkLightningStatus`, `liftLightningDelay` all have `sb: SupabaseClient` parameter
- [ ] `NEXT_PUBLIC_OPENWEATHER_KEY` does not appear anywhere in `weather.ts`
- [ ] `process.env.OPENWEATHER_API_KEY` is used as the env var fallback
- [ ] Pure functions are untouched
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="5">
<title>Refactor eligibility.ts — inject SupabaseClient, remove browser client import</title>
<read_first>
- lib/engines/eligibility.ts
</read_first>
<instructions>
`eligibility.ts` is standalone with no cross-engine dependencies. Steps:

1. Remove: `import { createClient } from '@/supabase/client'`
2. Add: `import type { SupabaseClient } from '@supabase/supabase-js'`
3. Each exported function currently calls `createClient()` at its top. Update each signature:
   - `checkPlayerEligibility(playerId, gameId, eventDateId)` → add `sb: SupabaseClient` as last parameter
   - `approveMultiGame(approvalId, approvedBy, approvedByName)` → add `sb: SupabaseClient` as last parameter
   - `denyMultiGame(approvalId, deniedBy, reason)` → add `sb: SupabaseClient` as last parameter
   - `getPendingApprovals(gameId)` → add `sb: SupabaseClient` as last parameter
   - `getAllPendingApprovals(eventId)` → add `sb: SupabaseClient` as last parameter
4. Inside each function, remove the `createClient()` call and use the injected `sb`.
5. Confirm no module-level `EVENT_ID` constant. If present, leave it (Phase 2 handles removal).
6. Confirm zero remaining `createClient` references.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/client'` is gone from `eligibility.ts`
- [ ] `import type { SupabaseClient } from '@supabase/supabase-js'` is present
- [ ] All 5 exported functions have `sb: SupabaseClient` as a parameter
- [ ] No internal `createClient()` calls remain
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="6">
<title>Refactor unified.ts — inject SupabaseClient, replace fetch() with direct function calls</title>
<read_first>
- lib/engines/unified.ts
- lib/engines/referee.ts
- lib/engines/field.ts
- lib/engines/weather.ts
</read_first>
<instructions>
`unified.ts` is the most complex engine to refactor because it currently uses `fetch('/api/...')` relative URL calls, which only work in a browser context. These must be replaced with direct function calls.

1. Remove: `import { createClient } from '@/supabase/client'`
2. Add: `import type { SupabaseClient } from '@supabase/supabase-js'`
3. Add imports for the sub-engine functions that `runUnifiedEngine` will now call directly:
   ```typescript
   import { runRefereeEngine } from '@/lib/engines/referee'
   import { runFieldConflictEngine } from '@/lib/engines/field'
   import { runWeatherEngine } from '@/lib/engines/weather'
   ```
4. Update exported function signatures:
   - `runUnifiedEngine(eventDateId)` → `runUnifiedEngine(eventDateId: number, sb: SupabaseClient)`
   - `resolveAlert(alertId, resolvedBy, note?)` → `resolveAlert(alertId: string, resolvedBy: string, note: string | undefined, sb: SupabaseClient)`
   - `generateShiftHandoff(createdBy)` → `generateShiftHandoff(createdBy: string, sb: SupabaseClient)`
5. Update the private function `applyResolutionAction(action, params)` → `applyResolutionAction(action: string, params: any, sb: SupabaseClient)`. Remove its internal `createClient()` call.
6. Inside `runUnifiedEngine`, replace the three `fetch('/api/referee-engine', ...)`, `fetch('/api/field-engine', ...)`, `fetch('/api/weather-engine', ...)` calls with direct function calls:
   ```typescript
   // Replace: const refResp = await fetch('/api/referee-engine', { method: 'POST', body: JSON.stringify({ event_date_id: eventDateId }) })
   // With:
   const refResult = await runRefereeEngine(eventDateId, sb)

   // Replace: const fieldResp = await fetch('/api/field-engine', { method: 'POST', ... })
   // With:
   const fieldResult = await runFieldConflictEngine(eventDateId, sb)

   // Replace: const weatherResp = await fetch('/api/weather-engine', { method: 'POST', ... })
   // With: (pass the API key from env — unified engine runs server-side)
   const weatherResult = await runWeatherEngine(complexId, sb, process.env.OPENWEATHER_API_KEY)
   ```
   Adjust variable names and the result-processing logic to match the actual return shapes of each engine function (check the return types from the already-refactored engine files).
7. Remove all remaining internal `createClient()` calls in `runUnifiedEngine`, `resolveAlert`, `generateShiftHandoff`, and `applyResolutionAction`.
8. Any `event_id: 1` hardcodes within `runUnifiedEngine` DB writes — leave them (Phase 2). Note them with a `// TODO Phase 2: replace with dynamic eventId` comment.
9. Confirm zero remaining `createClient` references.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/client'` is gone from `unified.ts`
- [ ] `import type { SupabaseClient } from '@supabase/supabase-js'` is present
- [ ] `runRefereeEngine`, `runFieldConflictEngine`, `runWeatherEngine` are imported directly (no `fetch` calls to those routes)
- [ ] `runUnifiedEngine(eventDateId, sb)` calls sub-engines with the injected `sb`
- [ ] `resolveAlert(alertId, resolvedBy, note, sb)` signature is correct
- [ ] `generateShiftHandoff(createdBy, sb)` signature is correct
- [ ] `applyResolutionAction` accepts and uses `sb`
- [ ] No relative `fetch('/api/...')` calls remain for sub-engine orchestration
- [ ] No internal `createClient()` calls remain
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="7">
<title>Verify environment variable rename and confirm no NEXT_PUBLIC_OPENWEATHER_KEY remains in codebase</title>
<read_first>
- app/api/weather-engine/route.ts
</read_first>
<instructions>
After Tasks 1–6, verify the full OpenWeather key migration is clean:

1. Search the entire codebase for `NEXT_PUBLIC_OPENWEATHER_KEY`:
   - Use grep or your search tool on `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.env*`
   - The result must be zero matches (or only in `.env.local` as a comment noting it is deprecated)
2. Confirm `app/api/weather-engine/route.ts` passes `process.env.OPENWEATHER_API_KEY` to `runWeatherEngine`. The research notes this route already uses the new key name — verify it still does after the refactor.
3. Open `.env.local` (if it exists). If `NEXT_PUBLIC_OPENWEATHER_KEY` is present, add `OPENWEATHER_API_KEY=<same value>` and add a comment: `# NEXT_PUBLIC_OPENWEATHER_KEY is deprecated — remove after confirming OPENWEATHER_API_KEY works`. Do NOT remove the old key yet (leave both during transition).
4. Add a code comment in `app/api/weather-engine/route.ts` if not already present: `// OPENWEATHER_API_KEY is server-only — do not use NEXT_PUBLIC_ prefix`
5. Run `npm run type-check` to confirm no TypeScript errors across all modified files.
6. Run `npm run lint` to confirm no lint errors.
</instructions>
<acceptance_criteria>
- [ ] Zero occurrences of `NEXT_PUBLIC_OPENWEATHER_KEY` in any `.ts` or `.tsx` file
- [ ] `app/api/weather-engine/route.ts` uses `process.env.OPENWEATHER_API_KEY`
- [ ] `.env.local` (if present) has `OPENWEATHER_API_KEY` defined
- [ ] `npm run type-check` passes with zero errors
- [ ] `npm run lint` passes with zero errors
</acceptance_criteria>
</task>

## Verification
- [ ] Run `grep -r "from '@/supabase/client'" lib/engines/` — must return zero results
- [ ] Run `grep -r "NEXT_PUBLIC_OPENWEATHER_KEY" .` — must return zero results in `.ts`/`.tsx` files
- [ ] Run `npm run type-check` — zero errors
- [ ] Run `npm run lint` — zero errors
- [ ] All 6 engine files have `import type { SupabaseClient } from '@supabase/supabase-js'`
- [ ] The field-engine GET route no longer has `.eq('resolved', type === 'all' ? false : false)`
- [ ] `unified.ts` has no `fetch('/api/referee-engine'...)`, `fetch('/api/field-engine'...)`, or `fetch('/api/weather-engine'...)` calls

## Must-Haves
- All 6 engines (`rules.ts`, `referee.ts`, `field.ts`, `weather.ts`, `eligibility.ts`, `unified.ts`) export functions that accept `sb: SupabaseClient` and contain zero `createClient()` calls
- `NEXT_PUBLIC_OPENWEATHER_KEY` is eliminated from all TypeScript source files
- The field engine resolved-conflicts bug (`type === 'all' ? false : false`) is fixed in the route handler
- `unified.ts` calls sub-engines via direct function imports, not `fetch('/api/...')`
- TypeScript strict-mode type-check passes after all changes
