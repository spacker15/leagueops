---
phase: 1
plan: B
title: "API Route Updates"
wave: 1
depends_on: []
requirements: ["SEC-03"]
files_modified:
  - "app/api/referee-engine/route.ts"
  - "app/api/field-engine/route.ts"
  - "app/api/weather-engine/route.ts"
  - "app/api/eligibility/route.ts"
  - "app/api/unified-engine/route.ts"
  - "app/api/unified-engine/resolve/route.ts"
  - "app/api/shift-handoff/route.ts"
autonomous: true
estimated_tasks: 5
---

# Plan B: API Route Updates

## Goal
Update all existing engine API routes to create a server-side Supabase client and pass it to the refactored engine functions, and create 3 new API routes that `CommandCenter.tsx` will use in wave 2.

## Context
This plan runs in parallel with Plan A (wave 1). The engine function signatures it targets are the ones being changed in Plan A. Do not begin implementing Tasks 1–4 until Plan A is complete and `npm run type-check` passes, OR coordinate changes together in the same session so type errors resolve atomically. Task 5 (new routes) can be written any time — new files have no existing dependency.

## Tasks

<task id="1">
<title>Update app/api/referee-engine/route.ts to pass server client to engine functions</title>
<read_first>
- app/api/referee-engine/route.ts
- lib/engines/referee.ts
- supabase/server.ts
</read_first>
<instructions>
The route currently calls `runRefereeEngine` and `findAvailableRefs` without passing a Supabase client. After Plan A, both functions require `sb: SupabaseClient`. Update the route:

1. Add the server client import at the top:
   ```typescript
   import { createClient } from '@/supabase/server'
   ```
   If this import already exists (the research notes the route imported it but only used it in the GET handler), confirm it is present.

2. In the **POST handler** (which calls `runRefereeEngine`):
   - Create the server client at the top of the handler function: `const sb = createClient()`
   - Update the engine call: `runRefereeEngine(Number(event_date_id), sb)`

3. In the **GET handler** (which calls `findAvailableRefs`):
   - Create the server client at the top of the handler function: `const sb = createClient()`
   - Update the engine call: `findAvailableRefs(Number(event_date_id), gameTime, division, excludeRefIds, sb)`
   - If the GET handler was already using `sb` for its own Supabase queries, reuse that same `sb` instance — do not create two separate clients in one handler.

4. Remove any lingering `import { createClient } from '@/supabase/client'` (browser client) if it exists in this route file.

5. Run `npm run type-check` — zero errors expected.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/server'` is present
- [ ] `import { createClient } from '@/supabase/client'` is absent
- [ ] POST handler creates `const sb = createClient()` and passes it to `runRefereeEngine`
- [ ] GET handler creates `const sb = createClient()` and passes it to `findAvailableRefs`
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="2">
<title>Update app/api/field-engine/route.ts to pass server client to engine functions</title>
<read_first>
- app/api/field-engine/route.ts
- lib/engines/field.ts
- supabase/server.ts
</read_first>
<instructions>
The field-engine route calls `runFieldConflictEngine`, `runFullConflictScan`, and `applyResolution`. After Plan A all three require `sb: SupabaseClient`. The Plan A task also fixes the resolved bug in this file's GET handler.

1. Confirm `import { createClient } from '@/supabase/server'` is present (the research notes the route already imported it but used it only in the GET handler directly). If not, add it.

2. In the **POST handler**:
   - Create `const sb = createClient()` at the handler top
   - Update calls:
     - `runFieldConflictEngine(Number(event_date_id), sb)`
     - `runFullConflictScan(Number(event_date_id), sb)`
     - `applyResolution(conflictId, action, params, sb)`
   - The exact calls present depend on the POST body routing logic — check what the handler actually does and update each engine call accordingly.

3. In the **GET handler**:
   - If `sb` is not already being created, add `const sb = createClient()` at the handler top
   - The resolved-bug fix from Plan A Task 3 is already in this handler — do not revert it

4. Remove any `import { createClient } from '@/supabase/client'` if present.

5. `npm run type-check` — zero errors.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/server'` is present
- [ ] `import { createClient } from '@/supabase/client'` is absent
- [ ] All calls to `runFieldConflictEngine`, `runFullConflictScan`, `applyResolution` pass `sb` as last argument
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="3">
<title>Update app/api/weather-engine/route.ts to pass server client to engine functions</title>
<read_first>
- app/api/weather-engine/route.ts
- lib/engines/weather.ts
- supabase/server.ts
</read_first>
<instructions>
The weather-engine route calls `runWeatherEngine`, `getLatestReading`, and `getReadingHistory`. After Plan A all three require `sb: SupabaseClient`. Note that `runWeatherEngine` now has a different signature: `runWeatherEngine(complexId, sb, apiKey?)`.

1. Add `import { createClient } from '@/supabase/server'` if not already present.

2. In the **POST handler** (which runs the engine):
   - Create `const sb = createClient()` at the handler top
   - Update the call. The current call is:
     ```typescript
     const result = await runWeatherEngine(Number(complex_id), api_key ?? process.env.OPENWEATHER_API_KEY)
     ```
     After refactor, the signature is `runWeatherEngine(complexId, sb, apiKey?)`, so:
     ```typescript
     const result = await runWeatherEngine(Number(complex_id), sb, api_key ?? process.env.OPENWEATHER_API_KEY)
     ```

3. In the **GET handler** (which calls `getLatestReading` or `getReadingHistory`):
   - Create `const sb = createClient()` at the handler top
   - Update calls to include `sb`: `getLatestReading(complexId, sb)`, `getReadingHistory(complexId, hours, sb)`

4. Remove any `import { createClient } from '@/supabase/client'` if present.

5. `npm run type-check` — zero errors.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/server'` is present
- [ ] `import { createClient } from '@/supabase/client'` is absent
- [ ] `runWeatherEngine` call passes `sb` as second argument and API key as third
- [ ] `getLatestReading` and `getReadingHistory` calls pass `sb`
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="4">
<title>Update app/api/eligibility/route.ts to pass server client to engine functions</title>
<read_first>
- app/api/eligibility/route.ts
- lib/engines/eligibility.ts
- supabase/server.ts
</read_first>
<instructions>
The eligibility route calls `checkPlayerEligibility`, `approveMultiGame`, `denyMultiGame`, `getPendingApprovals`, `getAllPendingApprovals`. After Plan A, all require `sb`. The research notes the route imported `createClient` from server but did not use it — time to actually use it.

1. Confirm `import { createClient } from '@/supabase/server'` is present. If it was imported but unused, it will now be used.

2. In each handler (POST, GET, PATCH — whatever exists):
   - Create `const sb = createClient()` at the handler top
   - Update every engine call to pass `sb` as the last argument:
     - `checkPlayerEligibility(playerId, gameId, eventDateId, sb)`
     - `approveMultiGame(approvalId, approvedBy, approvedByName, sb)`
     - `denyMultiGame(approvalId, deniedBy, reason, sb)`
     - `getPendingApprovals(gameId, sb)`
     - `getAllPendingApprovals(eventId, sb)`

3. Remove any `import { createClient } from '@/supabase/client'` if present.

4. `npm run type-check` — zero errors.
</instructions>
<acceptance_criteria>
- [ ] `import { createClient } from '@/supabase/server'` is present and used (not unused import)
- [ ] `import { createClient } from '@/supabase/client'` is absent
- [ ] All eligibility engine function calls pass `sb` as last argument
- [ ] `npm run type-check` passes
</acceptance_criteria>
</task>

<task id="5">
<title>Create 3 new API routes for CommandCenter (unified-engine, resolve-alert, shift-handoff)</title>
<read_first>
- lib/engines/unified.ts
- components/engine/CommandCenter.tsx
- app/api/referee-engine/route.ts
</read_first>
<instructions>
`CommandCenter.tsx` currently imports and calls `runUnifiedEngine`, `resolveAlert`, `generateShiftHandoff` directly. After Plan A, these functions require a server-side `sb` and cannot be called from client code. Three new API routes must be created so CommandCenter can call them via `fetch`. Use the `app/api/referee-engine/route.ts` as a style reference.

**File 1: `app/api/unified-engine/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { runUnifiedEngine } from '@/lib/engines/unified'

export async function POST(req: NextRequest) {
  try {
    const { event_date_id } = await req.json()
    if (!event_date_id) {
      return NextResponse.json({ error: 'event_date_id is required' }, { status: 400 })
    }
    const sb = createClient()
    const result = await runUnifiedEngine(Number(event_date_id), sb)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[unified-engine]', err)
    return NextResponse.json({ error: 'Engine error' }, { status: 500 })
  }
}
```

**File 2: `app/api/unified-engine/resolve/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { resolveAlert } from '@/lib/engines/unified'

export async function POST(req: NextRequest) {
  try {
    const { alert_id, resolved_by, note } = await req.json()
    if (!alert_id || !resolved_by) {
      return NextResponse.json({ error: 'alert_id and resolved_by are required' }, { status: 400 })
    }
    const sb = createClient()
    await resolveAlert(alert_id, resolved_by, note, sb)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[unified-engine/resolve]', err)
    return NextResponse.json({ error: 'Resolve error' }, { status: 500 })
  }
}
```

**File 3: `app/api/shift-handoff/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { generateShiftHandoff } from '@/lib/engines/unified'

export async function POST(req: NextRequest) {
  try {
    const { created_by } = await req.json()
    if (!created_by) {
      return NextResponse.json({ error: 'created_by is required' }, { status: 400 })
    }
    const sb = createClient()
    const result = await generateShiftHandoff(created_by, sb)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[shift-handoff]', err)
    return NextResponse.json({ error: 'Handoff error' }, { status: 500 })
  }
}
```

Create each file at the exact paths listed. Use `try/catch` blocks as shown (CLAUDE.md Gotcha #6 — never use `.catch()` chains on engine calls). Match the existing dark-theme convention in error messages (lowercase, brief).
</instructions>
<acceptance_criteria>
- [ ] `app/api/unified-engine/route.ts` exists and exports `POST`
- [ ] `app/api/unified-engine/resolve/route.ts` exists and exports `POST`
- [ ] `app/api/shift-handoff/route.ts` exists and exports `POST`
- [ ] All three routes create `const sb = createClient()` from `@/supabase/server`
- [ ] All three routes call the engine function with `sb` injected
- [ ] All three routes return structured JSON errors with appropriate status codes
- [ ] All three routes use `try/catch` (not `.catch()` chains)
- [ ] `npm run type-check` passes
- [ ] `npm run build` does not error on the new route files
</acceptance_criteria>
</task>

## Verification
- [ ] Run `grep -r "from '@/supabase/client'" app/api/` — must return zero results
- [ ] All 4 existing engine routes create `const sb = createClient()` from `@/supabase/server`
- [ ] All 4 existing engine routes pass `sb` to every engine function call
- [ ] Three new route files exist at the correct paths
- [ ] `npm run type-check` passes
- [ ] `npm run build` completes successfully (routes are valid Next.js route handlers)

## Must-Haves
- Every engine function call in every API route passes a server-created `SupabaseClient` instance
- No API route imports `@/supabase/client` (browser client)
- The three new routes (`/api/unified-engine`, `/api/unified-engine/resolve`, `/api/shift-handoff`) are functional POST endpoints that proxy CommandCenter operations server-side
- Build succeeds — no broken imports or type errors
