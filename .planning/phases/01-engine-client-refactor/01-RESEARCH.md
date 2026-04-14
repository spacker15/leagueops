# Phase 1 Research: Engine Client Refactor

**Researched:** 2026-03-22
**Status:** Complete — ready for planning

---

## Current Engine State (per engine)

### `lib/engines/referee.ts`

- **Import:** `import { createClient } from '@/supabase/client'`
- **Exported functions:** `runRefereeEngine(eventDateId)`, `findAvailableRefs(eventDateId, gameTime, division, excludeRefIds)`
- **Internal functions:** `clearStaleConflicts(eventDateId, types)` (private, not exported)
- **Client usage:** Each function calls `createClient()` independently at its top — `runRefereeEngine` creates one instance, `clearStaleConflicts` creates a separate one, `findAvailableRefs` creates a third. Three separate browser client instantiations per engine run.
- **Hardcoded `EVENT_ID = 1`** at module level — used in referee fetch and all DB writes.

### `lib/engines/field.ts`

- **Import:** `import { createClient } from '@/supabase/client'`
- **Also imports:** `import { getSchedulingRules } from '@/lib/engines/rules'` — this is the cross-engine dependency that requires attention (rules engine also uses browser client).
- **Exported functions:** `runFieldConflictEngine(eventDateId)`, `applyResolution(conflictId, action, params)`, `runFullConflictScan(eventDateId)`
- **Internal functions:** `clearStaleFieldConflicts(eventDateId)` (private)
- **Client usage:** `runFieldConflictEngine` creates one instance; `clearStaleFieldConflicts` creates another; `applyResolution` creates another; `runFullConflictScan` creates yet another. Four separate instantiations.
- **Hardcoded `EVENT_ID = 1`** at module level.
- **Contains the resolved-conflicts bug** — see Field Engine Bug Analysis below.

### `lib/engines/weather.ts`

- **Import:** `import { createClient } from '@/supabase/client'`
- **Exported functions:** `runWeatherEngine(complexId, apiKey?)`, `evaluateAlerts(reading)`, `calcHeatIndex(tempF, humidity)`, `getMockWeather(complex)`, `getLatestReading(complexId)`, `getReadingHistory(complexId, hours)`, `checkLightningStatus(complexId)`, `liftLightningDelay(complexId, eventId)`, `windDirection(deg)`, `conditionIcon(code)`
- **Client usage:** `runWeatherEngine`, `getLatestReading`, `getReadingHistory`, `checkLightningStatus`, `liftLightningDelay` each call `createClient()` independently.
- **Hardcoded `EVENT_ID = 1`** at module level.
- **Contains the `NEXT_PUBLIC_OPENWEATHER_KEY` exposure** — see OpenWeather Key Migration below.
- **Note:** `evaluateAlerts`, `calcHeatIndex`, `getMockWeather`, `windDirection`, `conditionIcon` are pure functions with no DB access. They can remain as pure exports without needing client injection.

### `lib/engines/eligibility.ts`

- **Import:** `import { createClient } from '@/supabase/client'`
- **Exported functions:** `checkPlayerEligibility(playerId, gameId, eventDateId)`, `approveMultiGame(approvalId, approvedBy, approvedByName)`, `denyMultiGame(approvalId, deniedBy, reason)`, `getPendingApprovals(gameId)`, `getAllPendingApprovals(eventId)`
- **Client usage:** Each function calls `createClient()` independently at its top.
- **No module-level EVENT_ID** — uses `game.event_id` from fetched data, which is correct behavior.

### `lib/engines/unified.ts`

- **Import:** `import { createClient } from '@/supabase/client'`
- **Exported functions:** `runUnifiedEngine(eventDateId)`, `resolveAlert(alertId, resolvedBy, note?)`, `generateShiftHandoff(createdBy)`
- **Internal functions:** `applyResolutionAction(action, params)` (private), `buildRefAlert(conflict, eventDateId)` (private, pure), `buildFieldAlert(conflict, eventDateId)` (private, pure)
- **Client usage:** `runUnifiedEngine`, `resolveAlert`, `generateShiftHandoff`, `applyResolutionAction` each call `createClient()` independently.
- **Special pattern:** `runUnifiedEngine` does NOT call the referee/field/weather engines directly — it calls them via `fetch('/api/referee-engine', ...)`, `fetch('/api/field-engine', ...)`, `fetch('/api/weather-engine', ...)`. This means it is using relative URL fetches, which **only work in a browser context** (server-side fetch requires absolute URLs). This is the most architecturally problematic engine.
- **Hardcoded `event_id: 1`** inline throughout (not even a module constant).

### `lib/engines/rules.ts`

- **Import:** `import { createClient } from '@/supabase/client'`
- **Exported functions:** `loadRules(eventId)`, `getRules(eventId)`, `invalidateRulesCache()`, `getRule(category, key, fallback)`, `getRuleNum(category, key, fallback)`, `getRuleBool(category, key, fallback)`, `getWeatherThresholds()`, `getRefereeRules()`, `getSchedulingRules()`, `updateRule(id, newValue, changedBy)`, `resetRule(id)`, `resetAllRules(eventId)`
- **Client usage:** `loadRules`, `updateRule`, `resetRule`, `resetAllRules` each call `createClient()`.
- **Module-level cache:** Uses `let _cache: Record<string, string> | null = null` with a 30-second TTL. **Important:** With injection, the cache becomes shared across all calls that use the same `sb` instance. When different requests inject different clients, the cache is still global (module-level), which is a problem — each server request should get a fresh cache or the cache must be keyed by eventId + client. For Phase 1, the simplest safe approach is to pass the client through but accept that the module-level cache is a known issue documented for Phase 2.
- **Cross-engine dependency:** `field.ts` imports `getSchedulingRules()` from `rules.ts`. After refactoring, `runFieldConflictEngine(eventDateId, sb)` must pass its `sb` to `getSchedulingRules(sb)`.
- **Hardcoded `EVENT_ID = 1`** at module level.

---

## Call Site Inventory

### API Routes Calling Engines

| Route                             | Engine Functions Called                                                                                        | Currently Passes Server Client?                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/api/referee-engine/route.ts` | `runRefereeEngine`, `findAvailableRefs`                                                                        | No — engines create their own                                                                                               |
| `app/api/field-engine/route.ts`   | `runFieldConflictEngine`, `runFullConflictScan`, `applyResolution`                                             | No — engines create their own. Route imports `createClient` from server but only uses it in the GET handler directly.       |
| `app/api/weather-engine/route.ts` | `runWeatherEngine`, `getLatestReading`, `getReadingHistory`                                                    | No — engines create their own                                                                                               |
| `app/api/eligibility/route.ts`    | `checkPlayerEligibility`, `approveMultiGame`, `denyMultiGame`, `getPendingApprovals`, `getAllPendingApprovals` | No — engines create their own. Route imports `createClient` from server but only uses it... nowhere (the import is unused). |

### Client-Side Components Importing Engines Directly (Must Be Fixed)

| File                                  | Imports                                                                                                                                                    | What it does                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `components/engine/CommandCenter.tsx` | `runUnifiedEngine`, `resolveAlert`, `generateShiftHandoff`, `type OpsAlert` from `@/lib/engines/unified`                                                   | Calls these functions directly from a `'use client'` component at lines 141, 161, 173                                    |
| `components/weather/WeatherTab.tsx`   | `conditionIcon`, `windDirection`, `evaluateAlerts`, `calcHeatIndex`, `THRESHOLDS`, `type WeatherReading`, `type WeatherAlert` from `@/lib/engines/weather` | Only imports **pure helper functions and types** — no DB calls from client-side. These do not need to move to API calls. |

### `lib/store.tsx`

No direct engine imports found. The store uses API calls for lightning trigger (verified via grep — no engine imports in store.tsx).

### Resolution Required for Client-Side Imports

- **`CommandCenter.tsx`** imports `runUnifiedEngine`, `resolveAlert`, `generateShiftHandoff` and calls them directly. Per D-03/D-04, these must be redirected to API route calls. A `/api/unified-engine` route will need to be created, or the existing functions wrapped behind API calls.
- **`WeatherTab.tsx`** imports only pure functions (`conditionIcon`, `windDirection`, `evaluateAlerts`, `calcHeatIndex`, `THRESHOLDS`) and types. Per D-03, this is acceptable — pure functions with no DB access can remain imported on the client. No API route redirect needed for these.

---

## Field Engine Bug Analysis

**Location:** `app/api/field-engine/route.ts`, GET handler, line 64

**Bug:**

```typescript
.eq('resolved', type === 'all' ? false : false)
```

**Problem:** Both branches of the ternary evaluate to `false`. When `type === 'all'` is requested (intending to fetch all conflicts including resolved ones), it still filters to `resolved = false`. Resolved conflicts are never returned by the GET endpoint regardless of the `type` query parameter.

**Correct fix:**

```typescript
.eq('resolved', type === 'resolved' ? true : false)
```

Or, more expressively, to support the intended `'open'` / `'all'` / `'history'` distinction:

```typescript
// Remove the .eq('resolved', ...) filter entirely when type === 'all'
```

The cleanest fix given the three `type` options (`open`, `all`, `history`):

- `'open'`: filter `resolved = false` (current behavior, correct)
- `'all'`: no resolved filter (return everything)
- `'history'`: already handled above the branch (engine run history)

**Recommended fix:**

```typescript
const query = sb
  .from('operational_conflicts')
  .select('*')
  .eq('event_id', eventId)
  .in('conflict_type', ['field_overlap', 'field_blocked', 'schedule_cascade', 'missing_referee'])
  .order('severity', { ascending: false })
  .order('created_at', { ascending: false })

if (type !== 'all') {
  query.eq('resolved', false)
}
```

**Impact:** The Phase 8 slot suggestion feature (Schedule Change Request Workflow) will query resolved conflicts to avoid re-suggesting known-bad slots. This bug would cause it to always receive an empty resolved set.

---

## OpenWeather Key Migration

**Current exposure:** `lib/engines/weather.ts`, line 100:

```typescript
const key = apiKey ?? process.env.NEXT_PUBLIC_OPENWEATHER_KEY ?? ''
```

`NEXT_PUBLIC_` prefix causes Next.js to embed this value in the client-side JavaScript bundle, exposing the API key to anyone who views the page source.

**Current partial fix in API route:** `app/api/weather-engine/route.ts` already passes `process.env.OPENWEATHER_API_KEY` (the server-only name) to `runWeatherEngine`:

```typescript
const result = await runWeatherEngine(
  Number(complex_id),
  api_key ?? process.env.OPENWEATHER_API_KEY
)
```

This means the route already anticipates the new key name. However, the engine itself falls back to `NEXT_PUBLIC_OPENWEATHER_KEY` if no key is passed, so the exposure remains if anything calls the engine without the key argument.

**Migration steps:**

1. In `weather.ts`: change `process.env.NEXT_PUBLIC_OPENWEATHER_KEY` to `process.env.OPENWEATHER_API_KEY`
2. In `.env.local` (and Vercel env config): rename the variable (add `OPENWEATHER_API_KEY`, remove `NEXT_PUBLIC_OPENWEATHER_KEY`)
3. Verify `WeatherTab.tsx` does NOT reference `NEXT_PUBLIC_OPENWEATHER_KEY` — it does not (confirmed). The tab calls `/api/weather-engine` via fetch.

**Note:** After client injection refactor, the `apiKey` parameter on `runWeatherEngine` becomes the only source of the key (no fallback to env in the engine). The API route is the only caller and always supplies it from server env. The `apiKey` parameter can remain for testability.

---

## Server Client Pattern

**`supabase/server.ts`** exports a single `createClient()` function that:

- Uses `createServerClient` from `@supabase/ssr`
- Reads cookies via `next/headers` `cookies()` — this means it **must only be called from a Route Handler or Server Component context**
- Sets `persistSession: false` (appropriate for server use)
- Handles cookie get/set/remove for SSR auth

**Injection pattern for engines:**
Each engine function signature changes from:

```typescript
export async function runRefereeEngine(eventDateId: number): Promise<RefereeEngineResult>
```

to:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
export async function runRefereeEngine(
  eventDateId: number,
  sb: SupabaseClient
): Promise<RefereeEngineResult>
```

The internal `createClient()` call at the top of each function is removed. The injected `sb` is used throughout.

**Private functions:** Internal helpers (`clearStaleConflicts`, `clearStaleFieldConflicts`, `applyResolutionAction`) must also receive `sb` as a parameter since they currently create their own instance.

**API route call sites after refactor:**

```typescript
// In app/api/referee-engine/route.ts
import { createClient } from '@/supabase/server'
const sb = createClient()
const result = await runRefereeEngine(Number(event_date_id), sb)
```

**Cross-engine call (field → rules):**
`runFieldConflictEngine` calls `getSchedulingRules()`. After refactor:

```typescript
const rules = await getSchedulingRules(sb)
```

All rules engine functions that need a client (`loadRules`, `getRules`, `updateRule`, `resetRule`, `resetAllRules`) receive `sb`. Pure functions (`invalidateRulesCache`, typed getters that delegate to `getRules`) pass `sb` through.

**Unified engine special case:**
`runUnifiedEngine` currently uses relative URL `fetch('/api/...')` calls, which only work in browser context. Post-refactor, it should import and call the engine functions directly (passing `sb` through) rather than using fetch. This removes the browser-only limitation and is more efficient (no HTTP round-trip).

**Type import:**
Use `import type { SupabaseClient } from '@supabase/supabase-js'` — this is already in the project's dependency tree via `@supabase/supabase-js ^2.99.2`.

---

## Testing Strategy

### Existing Test Infrastructure

- **Runner:** Vitest `^4.1.0`, config at `vitest.config.ts`
- **Environment:** `jsdom` (via `test.environment`)
- **Setup:** `vitest.setup.ts` only imports `@testing-library/jest-dom`
- **Path alias:** `@/` → project root (configured in `vitest.config.ts`)
- **Existing test:** `__tests__/lib/utils.test.ts` — pure unit test, no mocking, no async DB calls
- **Test file pattern:** `__tests__/<module-path>/<file>.test.ts` mirrors source

### Engine Test File Locations

Following existing convention:

```
__tests__/lib/engines/referee.test.ts
__tests__/lib/engines/field.test.ts
__tests__/lib/engines/weather.test.ts
__tests__/lib/engines/eligibility.test.ts
__tests__/lib/engines/unified.test.ts
__tests__/lib/engines/rules.test.ts
```

### Mock Supabase Client Shape

Engines use a subset of the Supabase client: `.from(table).select(...)`, `.insert(...)`, `.update(...)`, `.delete(...)`, `.eq(...)`, `.in(...)`, `.neq(...)`, `.single()`, `.order(...)`, `.limit(...)`, `.gte(...)`, `.is(...)`.

The mock must support chaining. A builder pattern mock works well:

```typescript
function makeChain(result: { data?: any; error?: any }) {
  const chain: any = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    upsert: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    gte: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve(result),
    then: (fn: any) => Promise.resolve(result).then(fn),
  }
  return chain
}

const mockSb = {
  from: vi.fn(() => makeChain({ data: [], error: null })),
}
```

### What to Test

Each engine test file should cover:

1. **Happy path** — with mock data returns expected result shape
2. **Empty data guard** — when DB returns null/empty, returns safe default (not throws)
3. **Conflict detection logic** — pure algorithmic checks (time overlap math, division rank comparison, etc.) verified against mock data
4. **Pure functions** (weather: `evaluateAlerts`, `calcHeatIndex`, `windDirection`, `conditionIcon`) — no mocking needed, test with direct inputs
5. **DB write calls** — verify `sb.from` was called with expected table names

### Testability Gain from Injection

The refactor is the enabler for testing: currently engines call `createClient()` internally, making them impossible to unit test without mocking the module. After injection, tests simply pass a mock `sb` — no module mocking required.

### Notes

- Engine tests are `*.test.ts` (not `.tsx`) since no React components are involved
- `jsdom` environment is fine for these tests (no DOM APIs used in engines)
- Vitest's `vi.fn()` is used for mock tracking

---

## Risk Assessment

### Risk 1: `unified.ts` fetch() calls break in server context

**Severity: High**
`runUnifiedEngine` uses `fetch('/api/referee-engine', ...)` with relative URLs. In a server-side API route, relative URLs have no base and will throw. If any route calls `runUnifiedEngine` server-side, it will fail at runtime. Current state: `CommandCenter.tsx` calls it directly from client (browser fetch works), which is why it hasn't broken yet.
**Mitigation:** Refactor `runUnifiedEngine` to import and call engine functions directly instead of using fetch.

### Risk 2: `rules.ts` module-level cache creates cross-request state pollution

**Severity: Medium**
The `_cache` and `_cacheTime` variables are module-level. In Next.js server context, modules are cached between requests within the same process. A cache populated by one request's `eventId=1` could be read by a different request before TTL expires. Phase 1 scope keeps `eventId=1` hardcoded everywhere, so cross-event pollution isn't an issue yet. But the cache makes multi-event support in Phase 2 harder.
**Mitigation:** Accept as known issue for Phase 1. Document in the rules.ts refactor that the cache should be keyed by `eventId` in Phase 2.

### Risk 3: `field.ts` imports `rules.ts` — double injection required

**Severity: Low-Medium**
`runFieldConflictEngine` calls `getSchedulingRules()`. After refactor, both must accept `sb`. The field engine must pass its `sb` to the rules function. If missed, the rules call silently uses a stale or mismatched client.
**Mitigation:** Refactor rules engine first (or simultaneously), then field engine. Test integration with a chain mock.

### Risk 4: `WeatherTab.tsx` imports engine pure functions — not a breaking change

**Severity: None**
`WeatherTab.tsx` only imports `conditionIcon`, `windDirection`, `evaluateAlerts`, `calcHeatIndex`, `THRESHOLDS`, and types. None of these use Supabase. This import is safe to keep as-is. However, if the engine module is restructured (e.g., split into pure vs. DB files), these imports must be updated.
**Mitigation:** Keep all exports in-place in `weather.ts`. No structural split needed.

### Risk 5: `CommandCenter.tsx` currently calls engine functions directly from client

**Severity: High**
`CommandCenter.tsx` imports `runUnifiedEngine`, `resolveAlert`, `generateShiftHandoff` and calls them directly. These functions use `createClient()` (browser client). After refactor, they will require a server `sb` — they will no longer be callable from client code at all.
**Mitigation:** Create or use existing API routes for these operations. `runUnifiedEngine` → POST to a new `/api/unified-engine` or `/api/engine/run` route. `resolveAlert` → POST to a new `/api/unified-engine/resolve` route. `generateShiftHandoff` → POST to a new `/api/shift-handoff` route. The component then calls these routes via `fetch`.

### Risk 6: `server.ts` uses `next/headers` — cannot be called at module load time

**Severity: Low**
`createClient()` in `supabase/server.ts` calls `cookies()` from `next/headers`. This must be called inside a request handler (not at module level). The injection pattern naturally satisfies this: each API route handler creates `const sb = createClient()` at the top of the handler function, then passes it down. Engine functions never call `createClient()` themselves.

### Risk 7: `applyResolution` in `field.ts` uses `sb` in a `finally` block

**Severity: Low**
`applyResolution` uses `sb` inside a `try/catch/finally`. After refactor, the `finally` block will use the injected `sb`. This is fine — the injected client is available throughout the function scope.

### Risk 8: Environment variable rename requires Vercel config update

**Severity: Low (deployment risk)**
Renaming `NEXT_PUBLIC_OPENWEATHER_KEY` → `OPENWEATHER_API_KEY` requires updating the Vercel environment variable settings before deploying. If renamed in code but not in Vercel, weather engine will fall through to mock data silently.
**Mitigation:** Add both old and new names during transition (old in Vercel, new in Vercel), remove old after confirming.

---

## Recommended Approach

### Refactoring Order (dependency-safe sequence)

1. **`rules.ts`** first — it has no cross-engine dependencies. Other engines depend on it.
2. **`referee.ts`** — standalone, no cross-engine calls.
3. **`field.ts`** — depends on `rules.ts` (already refactored). Also contains the resolved bug fix.
4. **`weather.ts`** — standalone DB calls. Also apply OpenWeather key rename.
5. **`eligibility.ts`** — standalone, no cross-engine calls.
6. **`unified.ts`** — last, because it orchestrates all others. Requires the most restructuring (replace fetch() with direct function calls + client injection).

### API Route Updates (simultaneous with each engine)

For each engine refactored, update its corresponding API route(s) to:

1. Import `createClient` from `@/supabase/server`
2. Create `const sb = createClient()` at handler top
3. Pass `sb` as last argument to each engine function call

### New API Routes Required (for CommandCenter)

`CommandCenter.tsx` calls three engine functions directly. These need new server-side route handlers:

- `POST /api/unified-engine` — calls `runUnifiedEngine(eventDateId, sb)`
- `POST /api/unified-engine/resolve` — calls `resolveAlert(alertId, resolvedBy, note, sb)`
- `POST /api/shift-handoff` — calls `generateShiftHandoff(createdBy, sb)`

Then `CommandCenter.tsx` is updated to call these routes via `fetch` instead of importing engine functions directly.

### Field Engine Bug Fix

Fix is in `app/api/field-engine/route.ts` GET handler — change line 64 from:

```typescript
.eq('resolved', type === 'all' ? false : false)
```

to a conditional filter that omits the resolved filter when `type === 'all'`.

### OpenWeather Key Migration

1. Change `weather.ts` line 100: `process.env.NEXT_PUBLIC_OPENWEATHER_KEY` → `process.env.OPENWEATHER_API_KEY`
2. Update Vercel env config (add `OPENWEATHER_API_KEY`, deprecate `NEXT_PUBLIC_OPENWEATHER_KEY`)
3. Update `.env.local` (if present locally)

### Test Files to Create

```
__tests__/lib/engines/rules.test.ts
__tests__/lib/engines/referee.test.ts
__tests__/lib/engines/field.test.ts
__tests__/lib/engines/weather.test.ts
__tests__/lib/engines/eligibility.test.ts
__tests__/lib/engines/unified.test.ts
```

Each test file uses a chainable mock Supabase client (no real DB calls). Pure functions tested directly without mocks.

---

_Phase: 01-engine-client-refactor_
_Research completed: 2026-03-22_
