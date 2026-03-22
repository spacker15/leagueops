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
autonomous: true
estimated_tasks: 7
---

# Plan D: Engine Unit Tests

## Goal
Write unit tests for all 6 engine modules using a mocked Supabase client, following the existing Vitest conventions in the project.

## Context
This plan runs in wave 2, after Plan A is complete. The injection refactor (Plan A) is the enabler: engines now accept `sb` as a parameter, so tests can pass a mock instead of calling the real DB. Tests run in parallel with Plan C.

Tests live at: `__tests__/lib/engines/<engine>.test.ts` (mirrors source structure, per CLAUDE.md conventions).

## Shared Mock Pattern
Every test file in this plan uses the same chainable Supabase mock. Define it once at the top of each test file (do not share across files — keep each test file self-contained).

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'

function makeChain(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq',
                   'in', 'gte', 'lte', 'is', 'order', 'limit', 'not', 'or']
  for (const m of methods) {
    chain[m] = () => chain
  }
  chain['single'] = () => Promise.resolve(result)
  chain['then'] = (fn: (v: typeof result) => unknown) => Promise.resolve(result).then(fn)
  return chain as any
}

function makeMockSb(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  return { from: vi.fn(() => makeChain(result)) }
}
```

Use `makeMockSb()` to create a fresh mock in each test. For tests that need different results per table, set up `vi.fn().mockReturnValueOnce(...)` on `sb.from`.

## Tasks

<task id="1">
<title>Write unit tests for rules.ts</title>
<read_first>
- lib/engines/rules.ts
- vitest.config.ts
- vitest.setup.ts
- __tests__/lib/utils.test.ts
</read_first>
<instructions>
Create `__tests__/lib/engines/rules.test.ts`. Read the existing test file (`utils.test.ts`) first to understand the test file structure and import style.

Cover the following:

**1. loadRules — happy path**
```typescript
it('loadRules returns parsed rules from DB', async () => {
  const mockRules = [
    { category: 'weather', key: 'heat_advisory_hi', value: '95', id: '1', event_id: 1 },
    { category: 'weather', key: 'heat_warning_hi', value: '103', id: '2', event_id: 1 },
  ]
  const sb = makeMockSb({ data: mockRules, error: null })
  const result = await loadRules(1, sb as any)
  expect(sb.from).toHaveBeenCalledWith('event_rules')
  expect(result).toHaveProperty('weather.heat_advisory_hi', '95')
})
```

**2. loadRules — DB error returns empty object**
```typescript
it('loadRules returns empty object on DB error', async () => {
  const sb = makeMockSb({ data: null, error: { message: 'db error' } })
  const result = await loadRules(1, sb as any)
  expect(result).toEqual({})
})
```

**3. getRules — cache behavior**
Test that calling `getRules` twice in quick succession only calls `sb.from` once (cache hit). Then call `invalidateRulesCache()` and call `getRules` again — `sb.from` should be called a second time.
```typescript
it('getRules uses cache for repeated calls', async () => {
  invalidateRulesCache()
  const sb = makeMockSb({ data: [], error: null })
  await getRules(1, sb as any)
  await getRules(1, sb as any)
  expect(sb.from).toHaveBeenCalledTimes(1)
})
```

**4. getRule — returns fallback when key not in cache**
```typescript
it('getRule returns fallback when key missing', async () => {
  invalidateRulesCache()
  const sb = makeMockSb({ data: [], error: null })
  const val = await getRule('weather', 'nonexistent_key', 'default_val', sb as any)
  // Adjust signature if getRule is synchronous — check actual implementation
  expect(val).toBe('default_val')
})
```
Note: if `getRule` is synchronous (reads from the in-memory cache), call `getRules(1, sb as any)` first to warm the cache, then call `getRule` synchronously.

**5. updateRule — calls correct table and field**
```typescript
it('updateRule calls event_rules with correct id', async () => {
  const sb = makeMockSb({ data: null, error: null })
  await updateRule('rule-id-1', 'new_value', 'user-123', sb as any)
  expect(sb.from).toHaveBeenCalledWith('event_rules')
})
```

Read the actual `rules.ts` implementation carefully to ensure mock result shapes match what the code expects. Adjust test data accordingly.
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/rules.test.ts` exists
- [ ] At least 5 test cases covering happy path, error path, cache behavior, fallback, and DB write
- [ ] `npm run test` passes with all new tests green
- [ ] No real Supabase calls made (all DB access goes through mock `sb`)
</acceptance_criteria>
</task>

<task id="2">
<title>Write unit tests for referee.ts</title>
<read_first>
- lib/engines/referee.ts
</read_first>
<instructions>
Create `__tests__/lib/engines/referee.test.ts`.

Cover the following:

**1. runRefereeEngine — happy path with no conflicts**
Mock `sb.from` to return empty conflict data. Verify the function returns a result object (not throws) and `sb.from` was called with `'operational_conflicts'` (or whatever tables the engine queries — check the source).

**2. runRefereeEngine — detects double-booking conflict**
Build mock game data where the same referee is assigned to two overlapping games. Pass this data through the engine logic. The engine should write a conflict row. Verify `sb.from` is called with the conflicts insert table.

Note: the engine may fetch data in multiple steps. Use `vi.fn().mockReturnValueOnce(makeChain({ data: refData, error: null })).mockReturnValueOnce(makeChain({ data: gamesData, error: null }))` to return different results for sequential `sb.from` calls.

**3. runRefereeEngine — empty games returns no conflicts**
```typescript
it('returns empty conflicts when no games exist', async () => {
  const sb = makeMockSb({ data: [], error: null })
  const result = await runRefereeEngine(1, sb as any)
  expect(result).toBeDefined()
  // result.conflicts should be empty or result should have a conflicts/alerts key
})
```

**4. findAvailableRefs — returns refs not in exclude list**
Build mock referee data with 3 referees. Call `findAvailableRefs` with `excludeRefIds` containing 1 of them. Verify the result does not include the excluded ref (or verify the query filters are applied — check by inspecting `sb.from` call arguments).

**5. clearStaleConflicts — calls delete on correct table**
If `clearStaleConflicts` is exported (or testable via side-effects from `runRefereeEngine`), verify it calls `sb.from('operational_conflicts')`.

Read `referee.ts` carefully to understand the exact return type and table names before writing assertions.
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/referee.test.ts` exists
- [ ] At least 4 test cases covering happy path, conflict detection, empty data, and available-refs filtering
- [ ] `npm run test` passes with all new tests green
- [ ] No real Supabase calls made
</acceptance_criteria>
</task>

<task id="3">
<title>Write unit tests for field.ts</title>
<read_first>
- lib/engines/field.ts
- lib/engines/rules.ts
</read_first>
<instructions>
Create `__tests__/lib/engines/field.test.ts`. Note: `field.ts` imports `getSchedulingRules` from `rules.ts`. The mock `sb` you pass to `runFieldConflictEngine` will be passed down to `getSchedulingRules` — mock it to return empty rules so the field engine does not fail on rules loading.

**1. runFieldConflictEngine — happy path no conflicts**
```typescript
it('returns no conflicts when fields are clear', async () => {
  const sb = makeMockSb({ data: [], error: null })
  const result = await runFieldConflictEngine(1, sb as any)
  expect(result).toBeDefined()
})
```

**2. runFieldConflictEngine — detects field overlap**
Build mock game data where two games are scheduled on the same field at the same time. Verify the engine detects an overlap. The engine should insert a conflict row — verify `sb.from` is called with the conflicts table for an insert.

**3. applyResolution — marks conflict resolved**
```typescript
it('applyResolution updates conflict to resolved', async () => {
  const sb = makeMockSb({ data: null, error: null })
  await applyResolution('conflict-id-1', 'reschedule', {}, sb as any)
  expect(sb.from).toHaveBeenCalledWith('operational_conflicts')
})
```

**4. runFullConflictScan — calls field engine and returns results**
```typescript
it('runFullConflictScan returns a result', async () => {
  const sb = makeMockSb({ data: [], error: null })
  const result = await runFullConflictScan(1, sb as any)
  expect(result).toBeDefined()
})
```

**5. Resolved bug regression test**
This test documents that the resolved bug is fixed at the engine level (the route-level fix is in the GET handler, but ensure the engine itself does not filter resolved conflicts when `type === 'all'` is passed if applicable).

Read `field.ts` carefully. The overlap detection logic has time math — test it with clearly overlapping times (e.g., `09:00–10:00` and `09:30–10:30` on the same field) vs non-overlapping times (`09:00–10:00` and `10:00–11:00`).
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/field.test.ts` exists
- [ ] At least 4 test cases covering no-conflicts, overlap detection, applyResolution, and fullScan
- [ ] `npm run test` passes with all new tests green
- [ ] No real Supabase calls made
</acceptance_criteria>
</task>

<task id="4">
<title>Write unit tests for weather.ts — pure functions and DB functions</title>
<read_first>
- lib/engines/weather.ts
</read_first>
<instructions>
Create `__tests__/lib/engines/weather.test.ts`. This engine has the most testable pure functions — many tests require no mocking at all.

**Pure function tests (no mock needed):**

**1. calcHeatIndex — known values**
```typescript
it('calcHeatIndex returns correct heat index at 95°F / 50% humidity', () => {
  const hi = calcHeatIndex(95, 50)
  expect(hi).toBeGreaterThan(95)  // heat index > temp at high humidity
  expect(hi).toBeLessThan(120)
})

it('calcHeatIndex returns temp when humidity is very low', () => {
  const hi = calcHeatIndex(80, 10)
  expect(hi).toBeCloseTo(80, 0)  // low humidity → HI ≈ temp
})
```

**2. evaluateAlerts — lightning codes trigger alert**
```typescript
it('evaluateAlerts returns lightning alert for code 200', () => {
  const reading = { conditions_code: 200, temp_f: 75, humidity: 60, wind_mph: 10 }
  const alerts = evaluateAlerts(reading as any)
  expect(alerts.some(a => a.type === 'lightning')).toBe(true)
})

it('evaluateAlerts returns heat warning at 103°F heat index', () => {
  // Craft a reading that produces HI >= 103
  const reading = { conditions_code: 800, temp_f: 100, humidity: 80, wind_mph: 5 }
  const alerts = evaluateAlerts(reading as any)
  expect(alerts.some(a => a.type === 'heat')).toBe(true)
})

it('evaluateAlerts returns no alerts for clear mild conditions', () => {
  const reading = { conditions_code: 800, temp_f: 70, humidity: 40, wind_mph: 10 }
  const alerts = evaluateAlerts(reading as any)
  expect(alerts).toHaveLength(0)
})
```

**3. windDirection — cardinal direction from degrees**
```typescript
it('windDirection returns N for 0 degrees', () => {
  expect(windDirection(0)).toBe('N')
})
it('windDirection returns S for 180 degrees', () => {
  expect(windDirection(180)).toBe('S')
})
```

**4. conditionIcon — returns string for known codes**
```typescript
it('conditionIcon returns a non-empty string for code 800', () => {
  expect(conditionIcon(800)).toBeTruthy()
})
```

**DB-accessing function tests (mock required):**

**5. runWeatherEngine — happy path**
```typescript
it('runWeatherEngine returns a result object', async () => {
  const sb = makeMockSb({ data: null, error: null })
  const result = await runWeatherEngine(1, sb as any, 'test-api-key')
  expect(result).toBeDefined()
})
```

**6. getLatestReading — queries correct table**
```typescript
it('getLatestReading queries weather_readings table', async () => {
  const mockReading = { id: 1, complex_id: 1, temp_f: 72, recorded_at: new Date().toISOString() }
  const sb = makeMockSb({ data: mockReading, error: null })
  await getLatestReading(1, sb as any)
  expect(sb.from).toHaveBeenCalledWith('weather_readings')
})
```

Read `weather.ts` to confirm table names and alert type strings before writing assertions.
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/weather.test.ts` exists
- [ ] At least 8 test cases — pure function tests (no mock) and DB function tests (with mock)
- [ ] `calcHeatIndex`, `evaluateAlerts`, `windDirection`, `conditionIcon` tested without any mocking
- [ ] `runWeatherEngine` and `getLatestReading` tested with mock `sb`
- [ ] `npm run test` passes with all new tests green
</acceptance_criteria>
</task>

<task id="5">
<title>Write unit tests for eligibility.ts</title>
<read_first>
- lib/engines/eligibility.ts
</read_first>
<instructions>
Create `__tests__/lib/engines/eligibility.test.ts`.

**1. checkPlayerEligibility — eligible player returns true/approved**
Build mock data for a player with no multi-game approval needed. Verify the function returns the expected result shape.

**2. checkPlayerEligibility — player with pending approval returns pending status**
Build mock data where a player has a multi-game approval in pending state. Verify the result reflects the pending status.

**3. getPendingApprovals — returns list from DB**
```typescript
it('getPendingApprovals queries multi_game_approvals table', async () => {
  const mockApprovals = [{ id: '1', player_id: 'p1', game_id: 'g1', status: 'pending' }]
  const sb = makeMockSb({ data: mockApprovals, error: null })
  const result = await getPendingApprovals('game-id', sb as any)
  expect(sb.from).toHaveBeenCalledWith('multi_game_approvals')
  expect(result).toHaveLength(1)
})
```

**4. approveMultiGame — calls update on correct table**
```typescript
it('approveMultiGame updates approval status to approved', async () => {
  const sb = makeMockSb({ data: null, error: null })
  await approveMultiGame('approval-id', 'admin-id', 'Admin Name', sb as any)
  expect(sb.from).toHaveBeenCalledWith('multi_game_approvals')
})
```

**5. getAllPendingApprovals — returns all pending for event**
```typescript
it('getAllPendingApprovals queries by event_id', async () => {
  const sb = makeMockSb({ data: [], error: null })
  const result = await getAllPendingApprovals(1, sb as any)
  expect(Array.isArray(result)).toBe(true)
})
```

Read `eligibility.ts` to confirm the actual table names (`multi_game_approvals` or similar) and return types before writing assertions.
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/eligibility.test.ts` exists
- [ ] At least 4 test cases covering eligibility check, pending approvals, approve action, and get-all
- [ ] `npm run test` passes with all new tests green
- [ ] No real Supabase calls made
</acceptance_criteria>
</task>

<task id="6">
<title>Write unit tests for unified.ts</title>
<read_first>
- lib/engines/unified.ts
- lib/engines/referee.ts
- lib/engines/field.ts
- lib/engines/weather.ts
</read_first>
<instructions>
Create `__tests__/lib/engines/unified.test.ts`. `unified.ts` is the most complex — it calls three sub-engines directly after Plan A. In tests, those sub-engines will also receive the mock `sb` via unified's pass-through.

**Strategy for mocking sub-engine calls:**
Since `unified.ts` now calls `runRefereeEngine`, `runFieldConflictEngine`, and `runWeatherEngine` directly (not via fetch), you can either:
- Pass a mock `sb` that returns appropriate mock data for all sub-engine queries (preferred — tests real integration)
- Use `vi.mock('@/lib/engines/referee', ...)` etc. to stub sub-engines (simpler but less realistic)

Use `vi.mock` for sub-engines in unified tests to keep tests focused on unified's own logic (ops_alerts writes, result aggregation). This is the pragmatic choice.

```typescript
vi.mock('@/lib/engines/referee', () => ({
  runRefereeEngine: vi.fn().mockResolvedValue({ conflicts: [], alerts: [] }),
}))
vi.mock('@/lib/engines/field', () => ({
  runFieldConflictEngine: vi.fn().mockResolvedValue({ conflicts: [], alerts: [] }),
}))
vi.mock('@/lib/engines/weather', () => ({
  runWeatherEngine: vi.fn().mockResolvedValue({ alerts: [], reading: null }),
}))
```

**Tests:**

**1. runUnifiedEngine — happy path, no alerts**
```typescript
it('runUnifiedEngine returns result when all sub-engines return no alerts', async () => {
  const sb = makeMockSb({ data: [], error: null })
  const result = await runUnifiedEngine(1, sb as any)
  expect(result).toBeDefined()
})
```

**2. runUnifiedEngine — calls all three sub-engines**
```typescript
it('runUnifiedEngine calls referee, field, and weather engines', async () => {
  const { runRefereeEngine } = await import('@/lib/engines/referee')
  const { runFieldConflictEngine } = await import('@/lib/engines/field')
  const { runWeatherEngine } = await import('@/lib/engines/weather')
  const sb = makeMockSb({ data: [], error: null })
  await runUnifiedEngine(1, sb as any)
  expect(runRefereeEngine).toHaveBeenCalledWith(1, sb)
  expect(runFieldConflictEngine).toHaveBeenCalledWith(1, sb)
  expect(runWeatherEngine).toHaveBeenCalled()
})
```

**3. resolveAlert — updates alert in DB**
```typescript
it('resolveAlert updates ops_alerts table', async () => {
  const sb = makeMockSb({ data: null, error: null })
  await resolveAlert('alert-id', 'user-id', 'resolved manually', sb as any)
  expect(sb.from).toHaveBeenCalledWith('ops_alerts')
})
```

**4. generateShiftHandoff — returns handoff document**
```typescript
it('generateShiftHandoff returns a result', async () => {
  const sb = makeMockSb({ data: [], error: null })
  const result = await generateShiftHandoff('admin-user-id', sb as any)
  expect(result).toBeDefined()
})
```

Read `unified.ts` to confirm exact table names used for `ops_alerts` writes and the result shape of `runUnifiedEngine` before finalizing assertions.
</instructions>
<acceptance_criteria>
- [ ] `__tests__/lib/engines/unified.test.ts` exists
- [ ] Sub-engine modules are mocked with `vi.mock` in the unified test file
- [ ] At least 4 test cases: happy path, all three sub-engines called, resolveAlert, generateShiftHandoff
- [ ] `npm run test` passes with all new tests green
- [ ] No real Supabase calls or HTTP fetch calls made
</acceptance_criteria>
</task>

<task id="7">
<title>Run full test suite and confirm all tests pass</title>
<read_first>
- vitest.config.ts
</read_first>
<instructions>
After creating all 6 test files, run the complete test suite and ensure everything is green.

**Step 1: Run all tests**
```bash
npm run test
```

**Step 2: If any test fails, diagnose and fix**
Common failure causes:
- Mock chain missing a method the engine calls (add the method to `makeChain`)
- Engine function signature mismatch (test calling old signature — update to new signature from Plan A)
- `vi.mock` hoisting issue (ensure `vi.mock` calls are at the top of the file, before imports)
- Table name in assertion does not match actual table name in engine — read the engine source carefully
- `single()` vs `then()` resolution — the engine may use `.single()` for some queries and direct promise resolution for others. Ensure `makeChain` handles both.

**Step 3: Run type-check**
```bash
npm run type-check
```

**Step 4: Run lint**
```bash
npm run lint
```

All three must pass cleanly before this task is complete.

**Step 5: Run test coverage (optional)**
```bash
npm run test:coverage
```
Note coverage numbers for the engine files. These are informational — no coverage threshold is required for Phase 1.
</instructions>
<acceptance_criteria>
- [ ] `npm run test` — all tests pass, zero failures
- [ ] `npm run type-check` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] All 6 new test files appear in the test output
- [ ] At least 1 test per engine is explicitly verified in the output (not skipped)
</acceptance_criteria>
</task>

## Verification
- [ ] `ls __tests__/lib/engines/` shows 6 test files: `rules.test.ts`, `referee.test.ts`, `field.test.ts`, `weather.test.ts`, `eligibility.test.ts`, `unified.test.ts`
- [ ] `npm run test` passes with all 6 test files green
- [ ] No test file imports `@/supabase/client` — all DB interaction goes through mock `sb`
- [ ] Pure functions in `weather.ts` (`calcHeatIndex`, `evaluateAlerts`, `windDirection`, `conditionIcon`) are tested without any mock
- [ ] `vi.mock` is used in `unified.test.ts` to stub sub-engine calls

## Must-Haves
- All 6 test files exist and all tests pass (`npm run test` is green)
- Tests use the mock `sb` injection pattern — zero real Supabase calls
- Weather pure functions are tested with direct inputs (no mock) — these are the highest-confidence tests
- Unified engine tests use `vi.mock` to stub sub-engines so unified's own logic is isolated
- Test file structure follows `__tests__/lib/engines/<engine>.test.ts` naming convention
