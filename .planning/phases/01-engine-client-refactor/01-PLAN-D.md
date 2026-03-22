---
phase: 1
plan: D
title: "Engine Unit Tests"
wave: 2
depends_on: ["A"]
requirements: ["SEC-03"]
files_modified:
  - "__tests__/lib/engines/rules.test.ts"
  - "__tests__/lib/engines/referee.test.ts"
  - "__tests__/lib/engines/field.test.ts"
  - "__tests__/lib/engines/weather.test.ts"
  - "__tests__/lib/engines/eligibility.test.ts"
  - "__tests__/lib/engines/unified.test.ts"
  - "__tests__/app/api/referee-engine.integration.test.ts"
autonomous: true
estimated_tasks: 7
---

# Plan D: Engine Unit Tests

## Goal

Write unit tests for all 6 refactored engine modules using a mocked Supabase client, plus one integration-style test that verifies the API route correctly creates a server client and passes it to the engine function.

## Review Feedback Addressed

- **LOW — Add integration test**: Task 7 adds an integration-style test for the referee-engine route. It imports the route handler directly, mocks `createClient` from `@/supabase/server`, and verifies that the handler passes the mocked client to `runRefereeEngine`. This catches wiring errors (e.g., route forgetting to pass `sb`) without requiring a real DB.
- **LOW — Plan D mock pattern doesn't cover `.then()` correctly**: The `makeChain` helper is updated to correctly handle both array-returning queries (resolve `{ data: [...], error: null }`) and `.single()` queries (resolve `{ data: {...}, error: null }`). The `then` property resolves the array form by default; `.single()` resolves with the single-row form.

---

## Tasks

<task id="1">
<title>Create shared mock Supabase client helper</title>
<read_first>
- vitest.config.ts
- vitest.setup.ts
- __tests__/lib/utils.test.ts
</read_first>
<instructions>
Before writing engine tests, create a shared mock helper that all engine test files can import. This avoids duplicating the chainable mock builder in every test file.

Create `__tests__/lib/engines/_mockSb.ts`:

```typescript
import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a chainable Supabase query mock.
 * - Default result is { data: [], error: null } (array query result)
 * - .single() resolves with { data: null, error: null } by default
 *
 * Override by providing a result object:
 *   makeChain({ data: [{ id: 1 }], error: null })
 *   makeChain({ data: null, error: { message: 'not found' } })
 */
export function makeChain(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const resolved = { data: result.data ?? [], error: result.error ?? null }
  const singleResolved = { data: Array.isArray(resolved.data) ? (resolved.data[0] ?? null) : resolved.data, error: resolved.error }

  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    upsert: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    gte: () => chain,
    lte: () => chain,
    gt: () => chain,
    lt: () => chain,
    is: () => chain,
    not: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    // .single() returns single-row shape
    single: () => Promise.resolve(singleResolved),
    // Awaiting the chain directly (array query) resolves with array shape
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject),
    finally: (fn: () => void) => Promise.resolve(resolved).finally(fn),
  }
  return chain
}

/**
 * Creates a mock SupabaseClient.
 * Pass a default chain result; override per test with mockReturnValueOnce:
 *
 *   mockSb.from.mockReturnValueOnce(makeChain({ data: [{ id: 1 }], error: null }))
 */
export function makeMockSb(defaultResult: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  return {
    from: vi.fn(() => makeChain(defaultResult)),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  } as unknown as SupabaseClient
}
```

This helper:
- `makeChain({ data: [...] })` — for queries that return arrays (most engine queries)
- `makeChain({ data: {...} })` — for single-row results (use with `.single()`)
- `makeMockSb()` — factory for the full mock client, with `from` trackable via `vi.fn()`
- Correctly handles both `.then()` (awaited chain = array result) and `.single()` (single row)
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/_mockSb.ts` exists
- [ ] `makeChain` correctly resolves array result when awaited directly
- [ ] `makeChain` correctly resolves single-row result when `.single()` is called
- [ ] `makeMockSb` returns a `SupabaseClient`-compatible object with `from` as a `vi.fn()`
- [ ] File imports cleanly in test files without TypeScript errors
</acceptance_criteria>
</task>

<task id="2">
<title>Write rules.ts unit tests</title>
<read_first>
- lib/engines/rules.ts (refactored in Plan A Task 1)
- __tests__/lib/engines/_mockSb.ts (Task 1)
</read_first>
<instructions>
Create `__tests__/lib/engines/rules.test.ts`.

Tests to write:

1. **`loadRules` happy path**: Mock `sb.from('rules_config').select()` to return an array of rule rows. Verify `loadRules(eventId, sb)` resolves without throwing.

2. **`loadRules` empty result**: Mock `sb.from` to return `{ data: [], error: null }`. Verify `loadRules` returns without throwing and cache is set to an empty object (or default state).

3. **`getRules` uses cache on second call**: Call `loadRules(eventId, sb)` once, then call `getRules(eventId, sb)` immediately after. Mock `from` to fail on the second call. Verify `getRules` uses the cached value and does not call `from` again.

4. **`updateRule` calls correct table**: Mock `sb.from` to return success. Call `updateRule(id, value, changedBy, sb)`. Verify `sb.from` was called with `'rules_config'` (or whichever table the engine writes to).

5. **`invalidateRulesCache` clears cache**: Call `invalidateRulesCache()`. Then verify that calling `getRules` triggers a fresh DB fetch (mock `from` to succeed on second call).

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import { loadRules, getRules, updateRule, invalidateRulesCache } from '@/lib/engines/rules'

describe('rules engine', () => {
  let mockSb: ReturnType<typeof makeMockSb>

  beforeEach(() => {
    mockSb = makeMockSb()
    invalidateRulesCache() // clear cache between tests
  })

  it('loadRules resolves with empty cache when DB returns no rows', async () => {
    await expect(loadRules(1, mockSb)).resolves.not.toThrow()
  })

  // ... additional tests
})
```
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/rules.test.ts` exists with at least 4 test cases
- [ ] All tests pass with `npm run test`
- [ ] No real DB calls — only mocked `sb` used
- [ ] Cache behavior is tested (populate then verify no re-fetch)
</acceptance_criteria>
</task>

<task id="3">
<title>Write referee.ts unit tests</title>
<read_first>
- lib/engines/referee.ts (refactored in Plan A Task 2)
- __tests__/lib/engines/_mockSb.ts (Task 1)
</read_first>
<instructions>
Create `__tests__/lib/engines/referee.test.ts`.

Tests to write:

1. **`runRefereeEngine` happy path**: Mock `sb.from` to return sample referees and game data. Verify the result has the expected shape (e.g., `{ conflicts: [...], ... }`).

2. **`runRefereeEngine` empty data guard**: Mock `sb.from` to return `{ data: [], error: null }` for all calls. Verify the engine returns a safe default (e.g., `{ conflicts: [] }` or equivalent) without throwing.

3. **`runRefereeEngine` calls correct tables**: Verify `sb.from` was called with the referee and games table names. Use `expect(mockSb.from).toHaveBeenCalledWith('referees')` (adjust to actual table name).

4. **`findAvailableRefs` returns filtered refs**: Mock `sb.from` to return a set of referee rows. Verify `findAvailableRefs` excludes refs in `excludeRefIds`.

5. **`findAvailableRefs` empty result**: Mock `sb.from` to return `{ data: [], error: null }`. Verify the function returns an empty array without throwing.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import { runRefereeEngine, findAvailableRefs } from '@/lib/engines/referee'
```
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/referee.test.ts` exists with at least 4 test cases
- [ ] Happy path and empty data guard are both tested
- [ ] `findAvailableRefs` exclusion logic is tested
- [ ] All tests pass with `npm run test`
</acceptance_criteria>
</task>

<task id="4">
<title>Write field.ts and weather.ts unit tests</title>
<read_first>
- lib/engines/field.ts (refactored in Plan A Task 3)
- lib/engines/weather.ts (refactored in Plan A Task 4)
- __tests__/lib/engines/_mockSb.ts (Task 1)
</read_first>
<instructions>
Create two test files.

**`__tests__/lib/engines/field.test.ts`:**

1. **`runFieldConflictEngine` happy path**: Mock DB returns with sample field and game data. Verify result shape.
2. **`runFieldConflictEngine` empty data**: Mock returns `{ data: [], error: null }`. Verify no throw.
3. **Resolved-conflicts behavior**: Verify that the GET handler fix (from Plan A Task 3) applies correctly — this is tested in the API route integration test (Task 7), not here. Instead, test that `runFullConflictScan` calls the correct table.
4. **`applyResolution` calls correct table**: Mock `sb.from` to return success. Call `applyResolution(id, 'action', {}, mockSb)`. Verify `mockSb.from` was called with the operational_conflicts table.

**`__tests__/lib/engines/weather.test.ts`:**

1. **Pure functions — `calcHeatIndex`**: No mock needed. Test with known input/output pairs:
   - `calcHeatIndex(100, 50)` should return approximately `118` (Rothfusz equation result)
   - `calcHeatIndex(70, 30)` should return a value below `80`

2. **Pure functions — `evaluateAlerts`**: No mock needed. Test with sample weather readings:
   - A reading with `temp_f = 113` triggers a heat emergency alert
   - A reading with `wind_speed = 45` triggers a wind suspension alert
   - A reading with `conditions_code = 210` (lightning) triggers a lightning alert

3. **Pure functions — `windDirection`**: Test cardinal direction strings for known degree values.

4. **`runWeatherEngine` happy path**: Mock `sb.from` to return a sample weather reading. Verify the engine resolves without throwing.

5. **`runWeatherEngine` no API key**: Verify behavior when `apiKey` is `undefined` and `process.env.OPENWEATHER_API_KEY` is undefined (should use mock data or return gracefully).
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/field.test.ts` exists with at least 3 test cases
- [ ] `__tests__/lib/engines/weather.test.ts` exists with at least 5 test cases
- [ ] Pure functions (`calcHeatIndex`, `evaluateAlerts`, `windDirection`) tested without mocks
- [ ] `evaluateAlerts` threshold tests cover heat, wind, and lightning
- [ ] All tests pass with `npm run test`
</acceptance_criteria>
</task>

<task id="5">
<title>Write eligibility.ts unit tests</title>
<read_first>
- lib/engines/eligibility.ts (refactored in Plan A Task 5)
- __tests__/lib/engines/_mockSb.ts (Task 1)
</read_first>
<instructions>
Create `__tests__/lib/engines/eligibility.test.ts`.

Tests to write:

1. **`checkPlayerEligibility` happy path**: Mock `sb.from` to return a player row and a game row with matching division. Verify result indicates eligibility.

2. **`checkPlayerEligibility` ineligible case**: Mock `sb.from` to return a player row with a different division than the game. Verify result indicates ineligibility.

3. **`checkPlayerEligibility` player not found**: Mock `sb.from` to return `{ data: null, error: null }` for the player fetch. Verify the function handles the null case without throwing.

4. **`getPendingApprovals` returns empty array when no rows**: Mock `sb.from` to return `{ data: [], error: null }`. Verify `getPendingApprovals(gameId, mockSb)` returns `[]`.

5. **`approveMultiGame` calls correct table**: Mock `sb.from` to return success. Call `approveMultiGame(approvalId, approvedBy, approvedByName, mockSb)`. Verify `mockSb.from` was called with the approvals table name.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb, makeChain } from './_mockSb'
import { checkPlayerEligibility, getPendingApprovals, approveMultiGame } from '@/lib/engines/eligibility'
```
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/eligibility.test.ts` exists with at least 4 test cases
- [ ] Eligible, ineligible, and player-not-found cases are covered
- [ ] All tests pass with `npm run test`
</acceptance_criteria>
</task>

<task id="6">
<title>Write unified.ts unit tests</title>
<read_first>
- lib/engines/unified.ts (refactored in Plan A Task 6)
- __tests__/lib/engines/_mockSb.ts (Task 1)
</read_first>
<instructions>
Create `__tests__/lib/engines/unified.test.ts`.

Unified engine now calls sub-engines directly (not via fetch). The sub-engine imports must be mocked in these tests so the unified engine tests don't depend on sub-engine DB calls.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb } from './_mockSb'

// Mock sub-engine modules so unified.test.ts doesn't depend on DB
vi.mock('@/lib/engines/referee', () => ({
  runRefereeEngine: vi.fn().mockResolvedValue({ conflicts: [] }),
}))
vi.mock('@/lib/engines/field', () => ({
  runFieldConflictEngine: vi.fn().mockResolvedValue({ conflicts: [] }),
}))
vi.mock('@/lib/engines/weather', () => ({
  runWeatherEngine: vi.fn().mockResolvedValue({ alerts: [] }),
}))

import { runUnifiedEngine, resolveAlert, generateShiftHandoff } from '@/lib/engines/unified'
import { runRefereeEngine } from '@/lib/engines/referee'
import { runFieldConflictEngine } from '@/lib/engines/field'
```

Tests to write:

1. **`runUnifiedEngine` calls sub-engines**: Verify `runRefereeEngine` and `runFieldConflictEngine` mocks are called with the correct `eventDateId` and the `sb` passed to `runUnifiedEngine`.

2. **`runUnifiedEngine` aggregates results**: Verify the return value contains the expected aggregated structure (ops alerts, conflict counts, etc.).

3. **`runUnifiedEngine` sub-engine failure is handled**: Mock `runRefereeEngine` to throw. Verify `runUnifiedEngine` catches the error and either returns a partial result or re-throws with a useful message (not a silent empty result).

4. **`resolveAlert` calls correct table**: Mock `sb.from` to return success. Call `resolveAlert(alertId, resolvedBy, undefined, mockSb)`. Verify `mockSb.from` was called with the ops_alerts table.

5. **`generateShiftHandoff` returns expected shape**: Mock `sb.from` to return sample data. Verify the returned object has the expected handoff fields.
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/unified.test.ts` exists with at least 4 test cases
- [ ] Sub-engine modules are mocked with `vi.mock()`
- [ ] `runUnifiedEngine` is verified to pass `sb` to sub-engine calls
- [ ] Error propagation from sub-engine failures is tested
- [ ] All tests pass with `npm run test`
</acceptance_criteria>
</task>

<task id="7">
<title>Write integration test — referee-engine route wiring</title>
<read_first>
- app/api/referee-engine/route.ts (updated in Plan B2 Task 1)
- lib/engines/referee.ts (refactored in Plan A Task 2)
- __tests__/lib/engines/_mockSb.ts (Task 1)
</read_first>
<instructions>
Create `__tests__/app/api/referee-engine.integration.test.ts`.

This test imports the route handler directly and mocks only `createClient` from `@/supabase/server`. It verifies that:
1. The route handler creates a server client
2. The route handler passes that client to `runRefereeEngine`
3. The handler returns the engine result as JSON

This is an integration-style test (not a full HTTP integration test — it calls the handler function directly). It catches the specific class of wiring error where the route forgets to pass `sb` to the engine.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeMockSb } from '../lib/engines/_mockSb'

// Mock the server client factory
const mockSb = makeMockSb({ data: [], error: null })
vi.mock('@/supabase/server', () => ({
  createClient: vi.fn(() => mockSb),
}))

// Mock the engine function to capture what arguments it receives
const mockRunRefereeEngine = vi.fn().mockResolvedValue({ conflicts: [], alerts_written: 0 })
vi.mock('@/lib/engines/referee', () => ({
  runRefereeEngine: mockRunRefereeEngine,
  findAvailableRefs: vi.fn().mockResolvedValue([]),
}))

import { POST } from '@/app/api/referee-engine/route'
import { createClient } from '@/supabase/server'

describe('POST /api/referee-engine — route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a server client and passes it to runRefereeEngine', async () => {
    const request = new Request('http://localhost/api/referee-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date_id: 42 }),
    })

    const response = await POST(request)
    const data = await response.json()

    // Verify createClient was called (route created a server client)
    expect(createClient).toHaveBeenCalledOnce()

    // Verify runRefereeEngine was called with the correct eventDateId and the mock sb
    expect(mockRunRefereeEngine).toHaveBeenCalledWith(42, mockSb)

    // Verify the response contains the engine result
    expect(response.status).toBe(200)
    expect(data).toMatchObject({ conflicts: [], alerts_written: 0 })
  })

  it('returns 400 when event_date_id is missing', async () => {
    const request = new Request('http://localhost/api/referee-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })
})
```

**Note on test environment:** The `Request` constructor used here is the Web API `Request`. Vitest with `jsdom` environment should have this available. If not, add `global.Request = Request` in the test or adjust the test environment. Check `vitest.config.ts` for the current `environment` setting.
</instructions>
<acceptance_criteria>
- [ ] `__tests__/app/api/referee-engine.integration.test.ts` exists
- [ ] Test verifies `createClient` is called exactly once per request
- [ ] Test verifies `runRefereeEngine` is called with the mock `sb` (not a different client)
- [ ] Test verifies `runRefereeEngine` receives the correct `event_date_id` from the request body
- [ ] Missing `event_date_id` returns `400` with `{ error: string }`
- [ ] All tests pass with `npm run test`
</acceptance_criteria>
</task>

---

## Verification

- [ ] 7 test files created: 6 unit tests (one per engine) + 1 integration test
- [ ] Shared `_mockSb.ts` helper used consistently across all engine tests
- [ ] All pure functions (`calcHeatIndex`, `evaluateAlerts`, `windDirection`, `conditionIcon`) tested without mocks
- [ ] Sub-engine calls inside `unified.ts` are mocked so tests don't cascade
- [ ] Integration test verifies route → engine wiring (createClient called, sb passed through)
- [ ] `npm run test` passes — all new tests green, existing `utils.test.ts` still passes
- [ ] `npm run test:coverage` shows meaningful coverage on all 6 engine modules

## Must-Haves

- No test file makes real Supabase DB calls — all DB interactions are mocked via `makeMockSb`
- The integration test (Task 7) must verify `sb` is passed through (not just that the engine is called)
- Pure function tests for `evaluateAlerts` must cover all three alert thresholds: heat, wind, lightning
- The `_mockSb.ts` helper correctly handles both awaited-chain (array) and `.single()` (single-row) query patterns
