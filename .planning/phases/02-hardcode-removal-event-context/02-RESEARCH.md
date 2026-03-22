# Phase 2: Hardcode Removal & Event Context - Research

**Researched:** 2026-03-22
**Domain:** React Context propagation, Supabase Realtime subscription scoping, Next.js 14 App Router event plumbing
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** When `eventId` is not yet available (undefined/loading), components return `null` early — no spinner, no error boundary. The app shell stays visible while individual tab content waits.
- **D-02:** Never replace `?? 1` with another constant. Every fallback must be a null-render guard.
- **D-03:** When `eventId` changes, teardown the existing `leagueops-realtime` channel and create a new one with `filter: 'event_id=eq.{newEventId}'` on each `postgres_changes` listener.
- **D-04:** The resubscription logic goes in `lib/store.tsx` inside the existing realtime `useEffect`, which must add `eventId` to its dependency array.
- **D-05:** QR code URLs use the event slug (not numeric ID). Pattern: `/checkin/{eventSlug}/{token}`. Consistent with the existing `/e/[slug]` routing pattern.
- **D-06:** Work layer-by-layer: engines first, then API routes, then store/realtime, then components. Each layer is a separate plan.

### Claude's Discretion

- Exact grouping of components into sub-plans (by tab, by feature, or alphabetical)
- Whether to batch small API route changes into one plan or split by route
- `loadAll` dependency fix can go in the store/realtime plan since it's in `lib/store.tsx`

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                                      | Research Support                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SEC-04 | All hardcoded `event_id = 1` references (~60 locations) replaced with dynamic event_id from context/props/params | Full inventory in CONCERNS.md §2; `useApp()` already exposes `eventId`; patterns documented below |
| SEC-05 | Real-time subscriptions scoped to current event_id                                                               | Supabase Realtime `filter` option documented; teardown/resubscribe pattern verified in store.tsx  |

</phase_requirements>

---

## Summary

Phase 2 is a systematic refactor across ~60 locations that removes every `event_id = 1` hardcode and replaces it with the dynamic `eventId` value already flowing through `AppProvider`. The `eventId` is correctly propagated from the URL slug in `app/page.tsx` down through `AppProvider` — the problem is that dozens of engine functions, API routes, components, and portal pages ignore it and hardcode `1` instead.

The work divides cleanly into four layers that must be addressed in dependency order: (1) engine constants (`EVENT_ID = 1` in `referee.ts`, `weather.ts`, `field.ts`), (2) `unified.ts` internal hardcodes, (3) API routes that fall back to `?? '1'` in query params and hardcode `event_id: 1` in inserts, and (4) UI components. The store layer (`lib/store.tsx`) gets a targeted fix: add `eventId` to both the `loadAll` effect and the realtime `useEffect` dependency arrays, and rebuild the realtime channel on `eventId` change with per-table event filters.

Note that Phase 1 completed the engine client injection refactor (engines now accept `SupabaseClient` as a parameter). This means engines no longer hardcode the Supabase client — but they still hardcode `EVENT_ID = 1` as a module-level constant used internally for their own queries. Phase 2 must replace those constants with function parameters.

**Primary recommendation:** Add `eventId: number` as a required parameter to every engine entry-point function. Pass `eventId` from the API route (which receives it from request params) down into the engine. This follows the same injection pattern established for the Supabase client in Phase 1.

---

## Standard Stack

This phase uses no new libraries. All work is within the existing stack.

### Core (in use)

| Library                          | Version   | Purpose                                                   | Notes                                               |
| -------------------------------- | --------- | --------------------------------------------------------- | --------------------------------------------------- |
| `@supabase/supabase-js`          | `^2.99.2` | Realtime channel + `postgres_changes` filter              | `filter` param on `.on()` is the key SEC-05 feature |
| React `useEffect` / `useReducer` | `^18.3.1` | Dependency array fixes for `loadAll` and realtime         | Standard React pattern                              |
| Next.js 14 App Router            | `14.2.4`  | API route params (`searchParams`) already pass `event_id` | Routes already accept `event_id` as query param     |

**No new installations required.**

---

## Architecture Patterns

### How eventId Already Flows (Verified by Code Reading)

```
app/page.tsx
  selectedEventId (useState<number | null>)
  └─ <AppProvider eventId={selectedEventId}>    ← already wired
       └─ lib/store.tsx: AppProvider({ eventId = 1 })
            └─ useApp() exposes: { eventId, state, actions }
```

The `eventId = 1` default in `AppProvider` props signature is the root of the problem — it masks missing event context at render time. With D-01 decided (null-render guard), components that need `eventId` should return `null` before render if `!eventId`.

### Pattern 1: Engine Function Parameter (Engines Layer)

**What:** Replace the module-level `const EVENT_ID = 1` constant with a function parameter on each engine entry point.

**When to use:** All three engines with the constant: `referee.ts`, `weather.ts`, `field.ts`. Also `unified.ts` internal hardcodes.

**Before:**

```typescript
// lib/engines/referee.ts
const EVENT_ID = 1

export async function runRefereeEngine(eventDateId: number, sb: SupabaseClient) {
  // uses EVENT_ID internally
  await sb.from('operational_conflicts').delete().eq('event_id', EVENT_ID)
}
```

**After:**

```typescript
export async function runRefereeEngine(eventDateId: number, eventId: number, sb: SupabaseClient) {
  await sb.from('operational_conflicts').delete().eq('event_id', eventId)
}
```

**Caller update (API route):**

```typescript
// app/api/referee-engine/route.ts
const eventId = Number(searchParams.get('event_id') ?? '0')
if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
await runRefereeEngine(eventDateId, eventId, sb)
```

### Pattern 2: API Route — Replace `?? '1'` with 400 Guard

**What:** API routes already extract `event_id` from query params as `?? '1'`. Remove the fallback and return 400 if not provided.

**When to use:** All routes that are called from the admin app (not public routes like `join`, `checkin`).

**Before:**

```typescript
// app/api/fields/route.ts
const eventId = searchParams.get('event_id') ?? '1'
```

**After:**

```typescript
const eventId = searchParams.get('event_id')
if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
```

**Exception — Routes that should NOT require event_id:**

- `app/api/join/route.ts` — public self-registration via token (Phase 3)
- `app/api/auth/check-email/route.ts` — public (Phase 3)
- `app/api/admin/create-user/route.ts` — already authenticated; `event_id` comes from request body

### Pattern 3: Store loadAll Dependency Fix (SEC-04 + SEC-05)

**What:** Add `eventId` to the `loadAll` `useEffect` dependency array so switching events re-fetches all data. Also rebuild the realtime channel with event-scoped filters when `eventId` changes.

**Current broken state (verified in lib/store.tsx lines 210-289):**

```typescript
useEffect(() => {
  async function loadAll() { ... }  // closes over eventId via closure
  loadAll()
}, [])  // ← eventId missing — never re-runs on event switch

useEffect(() => {
  const sub = sb.channel('leagueops-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_log' }, ...)
    // no filter — receives ALL events' changes
  ...
}, [currentDate])  // ← eventId missing
```

**Fixed pattern:**

```typescript
// loadAll effect
useEffect(() => {
  if (!eventId) return  // D-01: null guard
  async function loadAll() { ... }
  loadAll()
}, [eventId])  // ← re-runs when event switches

// realtime effect — teardown and recreate channel with filter
useEffect(() => {
  if (!eventId) return  // D-01: null guard
  const sb = createClient()
  const filter = `event_id=eq.${eventId}`
  const sub = sb
    .channel('leagueops-realtime')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'ops_log',
      filter,
    }, ...)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'incidents',
      filter,
    }, ...)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'games',
      filter,
    }, ...)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'medical_incidents',
      filter,
    }, ...)
    .subscribe()
  return () => { sb.removeChannel(sub) }
}, [eventId, currentDate])  // ← teardown/resubscribe on event change
```

**Critical note on Supabase Realtime filters:** The `filter` option on `postgres_changes` uses Supabase's PostgREST filter syntax: `'column=operator.value'`. For equality: `'event_id=eq.5'`. This requires the column to be indexed (which `event_id` is in all affected tables). The `filter` parameter is passed inside the event config object, not as a separate argument.

Supabase Realtime subscription filters were introduced in Supabase JS v2. The project uses `^2.99.2` — this feature is available. Confidence: HIGH (verified against Supabase JS v2 documentation patterns).

### Pattern 4: Component — useApp() eventId with null guard (D-01)

**What:** Components that make direct Supabase calls (bypassing the store) must pull `eventId` from `useApp()` and guard on it.

**When to use:** Any component that calls `createClient()` directly and hardcodes `event_id: 1`.

**Before:**

```typescript
// components/incidents/IncidentsTab.tsx line 125
await logIncident({
  event_id: 1,
  ...
})
```

**After:**

```typescript
const { eventId } = useApp()
if (!eventId) return null  // D-01 guard — component-level

await logIncident({
  event_id: eventId,
  ...
})
```

**Note:** `logIncident` is a store action that already calls `db.insertIncident(incident)` — so the `event_id` field on the incident payload comes from the component, not the store. The component must supply the correct value.

### Pattern 5: QR Code URL — Slug-based (D-05)

**What:** `CheckInTab.tsx` generates QR codes with hardcoded `event_id=1` in the URL. Replace with event slug.

**Current (CheckInTab.tsx line 59, 191):**

```typescript
.upsert({ player_id: id, event_id: 1 }, ...)
// URL: `/checkin/1/${token}` (hardcoded)
```

**After:**

- The `AppProvider`/`useApp()` already exposes `state.event` which has a `slug` field (it's loaded as part of `db.getEvent(eventId)`)
- Use `state.event?.slug` for the URL segment
- For the `player_qr_tokens` upsert: use `eventId` from `useApp()`
- QR URL pattern: `/checkin/${state.event?.slug}/${token}` (D-05)

**Guard:** If `!state.event?.slug`, the QR generation button should be disabled or return null.

### Pattern 6: Portal Components (RefereePortal, VolunteerPortal)

These components (`components/auth/RefereePortal.tsx`, `components/auth/VolunteerPortal.tsx`) create direct Supabase calls with `event_id: 1`. However, these portal components are rendered outside the `AppProvider` context — they are rendered from `app/page.tsx` before an event is selected.

**Resolution:** These portals need the event_id passed from a different source. The `userRole` object loaded by `useAuth()` already contains the user's event association via the `user_roles` table. The portals should derive `event_id` from `userRole.event_id` rather than `useApp()`.

```typescript
// RefereePortal: derive from userRole
const { userRole } = useAuth()
const portalEventId = userRole?.event_id // field exists in user_roles table
if (!portalEventId) return null

// Replace: event_id: 1
// With:    event_id: portalEventId
```

**IMPORTANT:** This pattern must be verified against the `user_roles` schema. The `UserRole` interface in `types/index.ts` must include an `event_id` field for this to work without a cast.

### Pattern 7: AppShell `(state.event as any)?.id ?? 1` — Type Fix (CONCERNS.md §18)

Components like `AppShell.tsx` use `(state.event as any)?.id ?? 1`. Since `state.event` is typed as `Event | null` and the `Event` interface should have `id: number`, this is a type-system problem. The cast and fallback must both be removed:

```typescript
// Before:
<EventSetupTab eventId={(state.event as any)?.id ?? 1} />

// After:
const { eventId } = useApp()
if (!eventId) return null
<EventSetupTab eventId={eventId} />
```

### Anti-Patterns to Avoid

- **Do not use `eventId ?? 1` as a fallback anywhere.** Per D-02, every occurrence must become a null-render guard.
- **Do not add `eventId` to the AppProvider default parameter.** The existing `eventId = 1` default should be removed from the function signature; the prop becomes required.
- **Do not filter realtime subscriptions by `currentDate` alone.** The realtime `useEffect` currently depends on `[currentDate]` — if you only add `eventId` to the listener but keep the old dep array, the realtime channel won't resubscribe on event change if `currentDate` happens to be the same index.
- **Do not close over stale eventId in useCallback actions.** Actions like `addLog`, `refreshGames` use `useCallback` with `[]` dependencies — they must include `eventId` in their dep arrays or they will log to the wrong event after a switch.

---

## Don't Hand-Roll

| Problem                   | Don't Build                      | Use Instead                                                         | Why                                               |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| Realtime filter syntax    | Custom filter string builder     | Supabase's built-in `filter` option on `.on()`                      | Supabase validates and evaluates server-side      |
| Event context propagation | Redux/Zustand/additional context | `useApp()` — already in place                                       | AppProvider already accepts and exposes `eventId` |
| Slug-to-ID resolution     | New API route                    | `state.event` already loaded by `db.getEvent(eventId)` in `loadAll` | The slug is on the event record already in state  |

---

## Common Pitfalls

### Pitfall 1: Missing eventId in useCallback Dependency Arrays

**What goes wrong:** After fixing the `loadAll` and realtime `useEffect` dependencies, actions like `addLog`, `refreshGames`, `toggleRefCheckin` etc. close over `eventId` in their `useCallback` bodies but do not list it as a dependency. If `eventId` changes, these actions silently operate against the old event.

**Why it happens:** `useCallback(fn, [])` with an empty dep array captures `eventId` at mount time only.

**How to avoid:** Every `useCallback` in `lib/store.tsx` that uses `eventId` must include it in the dependency array. Run `npm run lint` — ESLint's `exhaustive-deps` rule will flag these if eslint-plugin-react-hooks is configured (it is via `eslint-config-next`).

**Warning signs:** ESLint `react-hooks/exhaustive-deps` warnings on useCallback/useEffect bodies that reference `eventId`.

### Pitfall 2: Realtime Channel Name Collision

**What goes wrong:** When `eventId` changes, the old channel is removed via `sb.removeChannel(sub)` in the cleanup. If a new channel is created with the same name `'leagueops-realtime'` before the old one is fully torn down, Supabase may complain or deduplicate the subscription.

**Why it happens:** Supabase client reuses channel names across the same client instance.

**How to avoid:** The cleanup function runs synchronously before the new effect, so ordering is correct. However, consider using `'leagueops-realtime'` as-is (not `leagueops-realtime-${eventId}`) since the channel is fully torn down before recreation. If collision issues arise, use the event-scoped name.

**Warning signs:** Console warnings from Supabase about duplicate channels; realtime events not arriving after event switch.

### Pitfall 3: Portal Components Have No AppProvider

**What goes wrong:** `RefereePortal` and `VolunteerPortal` are rendered from `app/page.tsx` BEFORE an event is selected (before `AppProvider` wraps). Calling `useApp()` inside them will throw: `"useApp must be used within AppProvider"`.

**Why it happens:** These portals serve referees/volunteers who are scoped to a specific event, but `AppProvider` only wraps the admin shell.

**How to avoid:** Source `event_id` from `useAuth().userRole.event_id` rather than `useApp()`. Verify the `UserRole` type includes `event_id` — check `types/index.ts` before writing portal code.

**Warning signs:** Runtime error "useApp must be used within AppProvider" on referee/volunteer login.

### Pitfall 4: API Route Callers Must Send event_id

**What goes wrong:** When API routes are changed from `?? '1'` to returning 400 if missing, any component that calls those routes without an `event_id` query param will silently start getting errors.

**Why it happens:** Components that call `/api/field-engine?event_id=1` or `/api/conflicts?event_id=1` hardcode the query param — after the component fix, the param becomes dynamic. If the component fix is done in a different plan wave than the API route fix, there is a window where callers send `event_id=1` to routes that now require it. This is acceptable — the `1` is still being removed from components in the same phase.

**How to avoid:** Fix components and API routes in the same phase (they are). The API route changes (remove `?? '1'`) should happen AFTER the component changes that supply the correct `event_id` in the call. Alternatively, keep the 400 guard to prevent silent fallback while accepting `1` only temporarily from unfixed callers.

**Warning signs:** 400 errors from API routes during incremental rollout within the phase.

### Pitfall 5: ScheduleTab addGame Uses Hardcoded event_id in Payload

**What goes wrong:** `ScheduleTab.tsx` calls `addGame({ event_id: 1, ... })` — this is a store action call, not a direct DB call. The store action passes the payload directly to `db.insertGame(game)`. The `event_id` in the payload must match the current event.

**Why it happens:** The `addGame` action accepts the full game object from the component — the component is responsible for providing the correct `event_id`.

**How to avoid:** Components that call store actions passing entity payloads must use `eventId` from `useApp()` in the payload, not hardcode it.

### Pitfall 6: Unified Engine Receives eventId via sb but Hardcodes Internally

**What goes wrong:** `unified.ts`'s `runUnifiedEngine(eventDateId, sb)` already receives `sb` but its internal queries for `ops_alerts`, `ops_log` hardcode `event_id: 1`. Phase 1 fixed the client injection — Phase 2 must add `eventId` as a third parameter.

**Why it happens:** Phase 1 only addressed client injection, not event scoping.

**How to avoid:** In Plan A (engines), add `eventId: number` as a required parameter to `runUnifiedEngine`, `resolveAlert`, and internal helpers.

---

## Code Examples

Verified patterns from code reading:

### Supabase Realtime Filter (postgres_changes)

```typescript
// Verified pattern — Supabase JS v2 postgres_changes with filter
const sub = sb
  .channel('leagueops-realtime')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `event_id=eq.${eventId}`, // SEC-05
    },
    () => {
      if (currentDate)
        db.getGamesByDate(eventId, currentDate.id).then((d) =>
          dispatch({ type: 'SET_GAMES', payload: d })
        )
    }
  )
  .subscribe()
```

### loadAll with eventId Dependency

```typescript
useEffect(() => {
  if (!eventId) return  // D-01: null guard before async
  async function loadAll() {
    dispatch({ type: 'SET_LOADING', payload: true })
    const [event, eventDates, fields, teams, ...rest] = await Promise.all([
      db.getEvent(eventId),
      db.getEventDates(eventId),
      // ... all other fetches use eventId
    ])
    dispatch({ type: 'INIT', payload: { event, eventDates: eventDates ?? [], ... } })
  }
  loadAll()
}, [eventId])  // ← SEC-04 fix
```

### Component Null Guard (D-01)

```typescript
// At the top of any component that needs eventId
const { state, eventId } = useApp()
if (!eventId) return null // D-01: no spinner, app shell stays visible
```

### Event Slug for QR URL (D-05)

```typescript
// In CheckInTab.tsx ensureTokens function
const { state, eventId } = useApp()
const eventSlug = state.event?.slug
if (!eventId || !eventSlug) return {}

// QR URL uses slug, not numeric ID
const qrUrl = `${window.location.origin}/checkin/${eventSlug}/${token}`
```

### Engine with eventId Parameter

```typescript
// lib/engines/referee.ts — after Phase 2
export async function runRefereeEngine(
  eventDateId: number,
  eventId: number, // ← new required param
  sb: SupabaseClient
): Promise<RefereeEngineResult> {
  // Replace all: .eq('event_id', EVENT_ID)
  // With:        .eq('event_id', eventId)
}
```

---

## Hardcode Inventory Summary

Based on verified code reading of CONCERNS.md §2 and direct file inspection:

### Layer 1: Engine Constants (highest priority — feed all other layers)

| File                     | Current                                        | Fix                                                               |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------- |
| `lib/engines/referee.ts` | `const EVENT_ID = 1` (line 25)                 | Add `eventId: number` param to `runRefereeEngine`                 |
| `lib/engines/weather.ts` | `const EVENT_ID = 1` (line 15)                 | Add `eventId: number` param to weather engine entry points        |
| `lib/engines/field.ts`   | `const EVENT_ID = 1` (line 19)                 | Add `eventId: number` param to `runFieldConflictEngine`           |
| `lib/engines/unified.ts` | `event_id: 1` at lines 74, 107, 127, 175, 195+ | Add `eventId: number` param to `runUnifiedEngine`, `resolveAlert` |

### Layer 2: API Routes (~15 occurrences)

Two patterns: (a) `searchParams.get('event_id') ?? '1'` → require param with 400 guard; (b) `event_id: 1` literal inserts → use parsed `eventId` from request.

| File                                 | Occurrences          | Pattern                      |
| ------------------------------------ | -------------------- | ---------------------------- |
| `app/api/rules/route.ts`             | 3 literal inserts    | Use eventId from params/body |
| `app/api/lightning/route.ts`         | 5 (`?? 1` fallbacks) | Require in body, 400 guard   |
| `app/api/admin/create-user/route.ts` | 2 (`?? 1` in body)   | Require in body              |
| `app/api/conflicts/route.ts`         | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/eligibility/route.ts`       | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/field-engine/route.ts`      | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/fields/route.ts`            | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/incidents/route.ts`         | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/medical/route.ts`           | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/ops-log/route.ts`           | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/referees/route.ts`          | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/registration-fees/route.ts` | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/rules/changes/route.ts`     | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/team-payments/route.ts`     | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/teams/route.ts`             | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/volunteers/route.ts`        | 1 (`?? '1'`)         | 400 guard                    |
| `app/api/weather/route.ts`           | 1 (`?? '1'`)         | 400 guard                    |

### Layer 3: Store/Realtime (lib/store.tsx)

| Location                                                           | Fix                                  |
| ------------------------------------------------------------------ | ------------------------------------ |
| `loadAll` useEffect dep array `[]` (line 253)                      | Add `eventId`                        |
| `currentDate` games useEffect dep array `[currentDate]` (line 262) | Add `eventId`                        |
| Realtime useEffect dep array `[currentDate]` (line 289)            | Add `eventId`, add per-table filters |
| `addLog` useCallback dep array `[]` (line 304)                     | Add `eventId`                        |
| All other `useCallback` closures over `eventId`                    | Add `eventId` where used             |

### Layer 4: Components (~25+ occurrences)

| File                                         | Occurrences | Notes                                                             |
| -------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `components/engine/CommandCenter.tsx`        | 4           | `ops_alerts`, `ops_log` queries; 3 subscriptions also need filter |
| `components/checkin/CheckInTab.tsx`          | 2           | QR token upsert + eligibility fetch with `event_id=1`             |
| `components/incidents/IncidentsTab.tsx`      | 2           | `logIncident` and `dispatchTrainer` payloads                      |
| `components/auth/RefereePortal.tsx`          | 3           | Derives from `userRole.event_id` (no AppProvider)                 |
| `components/auth/VolunteerPortal.tsx`        | 2           | Derives from `userRole.event_id` (no AppProvider)                 |
| `components/auth/RegisterPage.tsx`           | 4+          | Pre-AppProvider; derives from query/token context                 |
| `components/programs/ProgramApprovals.tsx`   | 4           | Uses `useApp()` context — straightforward                         |
| `components/programs/RegistrationConfig.tsx` | 2           | Direct Supabase queries                                           |
| `components/schedule/ScheduleTab.tsx`        | 3           | `addGame` payload + `fetch('/api/field-engine?event_id=1')`       |
| `components/refs/RefsTab.tsx`                | 1           |                                                                   |
| `components/settings/LeagueSettingsTab.tsx`  | 1           | `ops_log` insert                                                  |
| `components/AppShell.tsx`                    | 1           | `(state.event as any)?.id ?? 1` cast                              |
| `components/auth/UserManagement.tsx`         | 1           | Same `as any` pattern                                             |

---

## Open Questions

1. **Does `UserRole` type include `event_id`?**
   - What we know: `user_roles` table is queried by `loadUserRole()` in `lib/auth.tsx`; the `UserRole` interface is in `types/index.ts`
   - What's unclear: Whether the fetched `user_roles` row includes `event_id` in the SELECT, and whether `UserRole` interface has it
   - Recommendation: Read `types/index.ts` and `lib/auth.tsx` before writing portal fixes; if missing, add the field to both

2. **RegisterPage event context**
   - What we know: `RegisterPage` at `app/register/page.tsx` is outside `AppProvider` and `app/page.tsx`'s event-selection flow; it has multiple `event_id: 1` hardcodes
   - What's unclear: Where `RegisterPage` gets its event context — presumably from a URL param or query string
   - Recommendation: Read `app/register/page.tsx` at the start of the components plan; this may require receiving `event_id` from a query param rather than from `useApp()`

3. **CommandCenter subscription filters for `ops_alerts`**
   - What we know: `CommandCenter.tsx` opens three subscriptions (`cmd-alerts`, `cmd-feed`, `cmd-games`) outside the store, with no event filter
   - What's unclear: Whether `ops_alerts` table has `event_id` column (it does — seen in CONCERNS.md §2 and unified.ts)
   - Recommendation: Add `filter: \`event_id=eq.${eventId}\``to`cmd-alerts`and`cmd-feed` subscriptions in CommandCenter

---

## Environment Availability

Step 2.6: SKIPPED — This phase is purely code and configuration changes. No new external services, CLIs, or runtimes are required. All changes are within the existing Next.js/Supabase stack.

---

## Validation Architecture

### Test Framework

| Property           | Value                     |
| ------------------ | ------------------------- |
| Framework          | Vitest `^4.1.0`           |
| Config file        | `vitest.config.ts` (root) |
| Quick run command  | `npm run test`            |
| Full suite command | `npm run test:coverage`   |

### Phase Requirements → Test Map

| Req ID | Behavior                                                        | Test Type                    | Automated Command                                         | File Exists?                           |
| ------ | --------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- | -------------------------------------- |
| SEC-04 | Engine functions reject `EVENT_ID = 1` constant — use parameter | unit                         | `npm run test -- __tests__/lib/engines/`                  | Yes (Phase 1 created all engine tests) |
| SEC-04 | `loadAll` re-fires when `eventId` prop changes                  | unit (React Testing Library) | `npm run test -- __tests__/lib/store.test.tsx`            | No — Wave 0 gap                        |
| SEC-04 | grep assertion: no `event_id.*1` or `?? 1` remains              | smoke (grep in CI)           | `grep -r "event_id.*: 1\|?? 1" lib/ components/ app/api/` | N/A — manual verification              |
| SEC-05 | Realtime subscription includes `filter: 'event_id=eq.N'`        | unit                         | `npm run test -- __tests__/lib/store.test.tsx`            | No — Wave 0 gap                        |
| SEC-05 | Realtime channel torn down and recreated when eventId changes   | unit (React Testing Library) | `npm run test -- __tests__/lib/store.test.tsx`            | No — Wave 0 gap                        |

### Sampling Rate

- **Per task commit:** `npm run test -- __tests__/lib/engines/`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + grep verifies no `?? 1` or `event_id: 1` literal remains

### Wave 0 Gaps

- [ ] `__tests__/lib/store.test.tsx` — covers SEC-04 (loadAll re-fires on eventId change) and SEC-05 (realtime filter and teardown behavior)

_(Existing engine test files from Phase 1 already exist and will be updated to pass `eventId` param in test calls — not a new file, an update.)_

---

## Project Constraints (from CLAUDE.md)

- **Stack is locked:** Next.js 14 App Router + Supabase + Vercel — no stack changes
- **All interactive components use `'use client'` as first line**
- **TypeScript strict mode:** Explicit types on all function signatures and interfaces
- **Import style:** `import * as db from '@/lib/db'` for database layer; `import type { ... }` for type-only imports
- **Naming:** `useCallback` dep arrays must be explicit — ESLint `exhaustive-deps` will fire
- **Multi-event scoping rule (already in CLAUDE.md):** "Every Supabase query must be scoped with `.eq('event_id', eventId)`. Never hardcode `event_id: 1` in new code."
- **No new third-party libraries** unless budget/free-tier compliant
- **AppProvider already accepts `eventId?: number` defaulting to `1` for backward compatibility — this default must be removed or made explicit** (noted in CONTEXT.md code_context)

---

## Sources

### Primary (HIGH confidence)

- Direct code reading: `lib/store.tsx`, `lib/engines/referee.ts`, `lib/engines/field.ts`, `lib/engines/weather.ts`, `lib/engines/unified.ts`
- Direct code reading: `components/engine/CommandCenter.tsx`, `components/checkin/CheckInTab.tsx`, `components/incidents/IncidentsTab.tsx`
- Direct code reading: `app/api/lightning/route.ts`, `app/api/rules/route.ts`
- `.planning/codebase/CONCERNS.md` — canonical hardcode inventory with line numbers
- `.planning/codebase/ARCHITECTURE.md` — data flow and provider structure
- `.planning/phases/02-hardcode-removal-event-context/02-CONTEXT.md` — all decisions

### Secondary (MEDIUM confidence)

- Supabase JS v2 `postgres_changes` filter syntax — verified via pattern match against `@supabase/supabase-js ^2.99.2` in use
- ESLint `react-hooks/exhaustive-deps` behavior — established pattern in Next.js + React 18 ecosystem

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Hardcode inventory: HIGH — verified by direct file reading + CONCERNS.md line numbers
- Architecture patterns: HIGH — verified against actual code (store.tsx, app/page.tsx)
- Realtime filter syntax: HIGH — Supabase JS v2 is in use, filter option is documented
- Portal event_id source: MEDIUM — `UserRole.event_id` field needs type verification before implementation

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack, no fast-moving dependencies)
