# Phase 2: Hardcode Removal & Event Context - Research

**Researched:** 2026-03-22 (re-research with codebase scan)
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
| SEC-04 | All hardcoded `event_id = 1` references (~60 locations) replaced with dynamic event_id from context/props/params | Full inventory below; `useApp()` already exposes `eventId`; `UserRole.event_id` verified in types |
| SEC-05 | Real-time subscriptions scoped to current event_id                                                               | Supabase Realtime `filter` option verified; teardown/resubscribe pattern documented in store.tsx  |

</phase_requirements>

---

## Summary

Phase 2 is a systematic refactor across **~93 hardcoded lines** (verified by grep) spanning five engine files, 17 API route files, the store, and 18 component files. Phase 1 completed the Supabase client injection into engine entry points — engines now accept `SupabaseClient` as a parameter — but every engine still uses a module-level `const EVENT_ID = 1` constant for all its internal queries. Phase 2 must add `eventId: number` as a required function parameter to replace those constants.

The `eventId` already flows correctly from the URL slug at `app/page.tsx` through `AppProvider` to `useApp()`. The problem is that `AppProvider` defaults to `eventId = 1` (masking missing context), `loadAll` has `[]` as its dependency array (so it never re-runs on event switch), and the realtime `useEffect` has `[currentDate]` dependencies only (so subscriptions are never re-scoped). Fixing these three issues in `lib/store.tsx` is the highest-leverage single change in the phase.

Components outside `AppProvider` — `RefereePortal`, `VolunteerPortal`, `ProgramDashboard`, and `RegisterPage` — cannot use `useApp()`. Confirmed: `UserRole` interface in `lib/auth.tsx` already includes `event_id: number | null`, and `loadUserRole` uses `select('*')` so the field is populated. Portal components derive `event_id` from `useAuth().userRole.event_id`. `RegisterPage` and `ProgramDashboard` are public/program-leader flows where event scoping must come from a query param or the user's role record.

**Primary recommendation:** Add `eventId: number` as a required parameter to every engine entry-point function. Pass `eventId` from the API route (received from request params) into the engine. This mirrors the client injection pattern from Phase 1.

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
  └─ <AppProvider eventId={selectedEventId}>    ← already wired (line 69)
       └─ lib/store.tsx: AppProvider({ eventId = 1 })  ← default is the bug
            └─ useApp() exposes: { eventId, state, actions }
```

The `eventId = 1` default in `AppProvider` props signature (line 202 of `lib/store.tsx`) masks missing event context at render time. Per D-01, the default must be removed — components guard with `if (!eventId) return null`.

### Pattern 1: Engine Function Parameter (Layer 1 — Engines)

**What:** Replace the module-level `const EVENT_ID = 1` constant with a function parameter on each engine entry point.

**Applies to:** `referee.ts`, `field.ts`, `weather.ts`, `unified.ts`, `rules.ts`

**Current signature (referee.ts line 86):**

```typescript
export async function runRefereeEngine(
  eventDateId: number,
  sb: SupabaseClient
): Promise<RefereeEngineResult>
```

**Target signature:**

```typescript
export async function runRefereeEngine(
  eventDateId: number,
  eventId: number, // ← new required param
  sb: SupabaseClient
): Promise<RefereeEngineResult>
```

**Rules engine special case:** `rules.ts` has a cache (`_cache`) keyed globally — not per-eventId. The Phase 2 plan must change the cache key to include `eventId` so switching events invalidates stale rules. The convenience functions (`getWeatherThresholds`, `getRefereeRules`, `getSchedulingRules`, `getRule`, `getRuleNum`, `getRuleBool`) currently call `getRules(EVENT_ID, sb)` internally and must be updated to accept and pass `eventId`. `field.ts` calls `getSchedulingRules(sb)` at line 86 — this must become `getSchedulingRules(eventId, sb)` once the signature is updated.

**API route caller update (referee-engine, field-engine, unified-engine):**

```typescript
// app/api/referee-engine/route.ts POST handler — after fix
const { event_date_id, event_id } = body
if (!event_date_id || !event_id) {
  return NextResponse.json({ error: 'event_date_id and event_id required' }, { status: 400 })
}
const result = await runRefereeEngine(Number(event_date_id), Number(event_id), sb)
```

**Note:** `weather-engine/route.ts` already does not pass `event_id` to `runWeatherEngine` — it only passes `complexId` and `apiKey`. The weather engine's event scoping is internal (uses `EVENT_ID`). `event_id` must be added to the route body and passed as a new parameter.

### Pattern 2: API Route — Replace `?? '1'` with 400 Guard (Layer 2 — API Routes)

**What:** All 17 affected API route files use `searchParams.get('event_id') ?? '1'` or `event_id ?? 1` from the request body. Replace with a required param and 400 guard.

**Before:**

```typescript
const eventId = searchParams.get('event_id') ?? '1'
```

**After:**

```typescript
const eventId = searchParams.get('event_id')
if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
```

**Body-param variant (lightning, rules, admin/create-user):**

```typescript
// lightning route — body contains event_id
const { complex_id, event_id } = body
if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 })
```

**Routes that must NOT require event_id:**

- `app/api/join/route.ts` — public self-registration via token
- `app/api/auth/check-email/route.ts` — public

**rules/route.ts special case (lines 60, 70, 83):** Has three literal `event_id: 1` inserts in the POST/PUT handlers and `const { action, id, event_id = 1 } = body`. The body destructure default must become required.

### Pattern 3: Store loadAll and Realtime Dependency Fixes (Layer 3 — Store)

**Current broken state (lib/store.tsx verified):**

```typescript
// loadAll effect — line 253
useEffect(() => {
  async function loadAll() { ... }  // closes over eventId via closure
  loadAll()
}, [])  // ← eventId missing — never re-runs on event switch

// Games reload on date change — line 262
useEffect(() => {
  if (!currentDate) return
  db.getGamesByDate(eventId, currentDate.id).then(...)
}, [currentDate])  // ← eventId missing

// Realtime — line 289
useEffect(() => {
  const sub = sb.channel('leagueops-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_log' }, ...)
    // no filter — receives ALL events' changes
}, [currentDate])  // ← eventId missing

// addLog — line 302-304
const addLog = useCallback(async (message: string, type: LogType = 'info') => {
  await db.addOpsLog(eventId, message, type)
}, [])  // ← eventId missing from deps
```

**Fixed pattern:**

```typescript
// loadAll — add eventId to dep array and null guard
useEffect(() => {
  if (!eventId) return  // D-01: null guard
  async function loadAll() { ... }
  loadAll()
}, [eventId])

// Games reload — add eventId to dep array
useEffect(() => {
  if (!currentDate) return
  db.getGamesByDate(eventId, currentDate.id).then(...)
}, [currentDate, eventId])

// Realtime — teardown/recreate channel with event filter (D-03, D-04)
useEffect(() => {
  if (!eventId) return
  const sb = createClient()
  const filter = `event_id=eq.${eventId}`
  const sub = sb
    .channel('leagueops-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_log', filter }, ...)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter }, ...)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter }, ...)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_incidents', filter }, ...)
    .subscribe()
  return () => { sb.removeChannel(sub) }
}, [eventId, currentDate])

// addLog — add eventId to dep array
const addLog = useCallback(async (message: string, type: LogType = 'info') => {
  await db.addOpsLog(eventId, message, type)
}, [eventId])
```

**Additional useCallback dep array fixes needed in store.tsx:**

- `refreshGames` — uses `eventId` and `currentDate` — already has `[currentDate]`; add `eventId`
- `triggerLightning` — uses `eventId` (line 421) — dep array must include `eventId`
- `liftLightning` — uses `eventId` (line 438, 445) — dep array must include `eventId`
- `addField` — already correctly has `[eventId]` (line 485) — no change needed

### Pattern 4: Component — useApp() eventId with null guard (Layer 4 — Components)

**What:** Components inside `AppProvider` that hardcode `event_id: 1` must pull `eventId` from `useApp()` and guard on it.

```typescript
const { eventId } = useApp()
if (!eventId) return null  // D-01 guard

// All event_id usages become: eventId
await logIncident({ event_id: eventId, ... })
```

### Pattern 5: Portal/Pre-Provider Components — userRole.event_id

**Applies to:** `RefereePortal.tsx`, `VolunteerPortal.tsx`, `ProgramDashboard.tsx`

These components are rendered from `app/page.tsx` **before** `AppProvider` wraps. Calling `useApp()` inside them will throw. Confirmed solution: `UserRole` interface in `lib/auth.tsx` already includes `event_id: number | null` and `loadUserRole` uses `select('*')` — the field is populated.

```typescript
const { userRole } = useAuth()
const portalEventId = userRole?.event_id
if (!portalEventId) return null // D-01 guard

// Replace: event_id: 1
// With:    event_id: portalEventId
```

### Pattern 6: RegisterPage and ProgramDashboard — No App Context

**RegisterPage** (`components/auth/RegisterPage.tsx`) is rendered from `app/register/page.tsx` — outside both `AuthProvider` and `AppProvider` in a separate URL route. It currently hardcodes `event_id: 1` in five places (lines 133, 139, 460, 472, 499). This is a public program registration flow. Resolution: `RegisterPage` must read `event_id` from the URL query string (`?event_id=X`) using `useSearchParams()`. The `app/register/page.tsx` currently passes no props, so it relies entirely on implicit hardcoding.

**ProgramDashboard** (`components/programs/ProgramDashboard.tsx`) is rendered for `program_leader` role users at line 50 of `app/page.tsx` — also outside `AppProvider`. It hardcodes `event_id: 1` at line 124. Like portals, it can derive from `userRole.event_id`.

### Pattern 7: AppShell and UserManagement — Type Fix

```typescript
// Before (AppShell.tsx line 151):
<EventSetupTab eventId={(state.event as any)?.id ?? 1} />

// After — use eventId from useApp():
const { eventId } = useApp()
if (!eventId) return null
<EventSetupTab eventId={eventId} />
```

```typescript
// Before (UserManagement.tsx line 27):
const eventId = (state.event as any)?.id ?? 1

// After:
const { eventId } = useApp()
if (!eventId) return null
```

### Pattern 8: WeatherTab Lightning Trigger

```typescript
// Before (WeatherTab.tsx line 194):
body: JSON.stringify({ complex_id: complexId, action, event_id: state.event?.id ?? 1 })

// After:
const { eventId } = useApp()
if (!eventId) return null
body: JSON.stringify({ complex_id: complexId, action, event_id: eventId })
```

### Pattern 9: QR Code URL — Slug-based (D-05)

```typescript
// In CheckInTab.tsx ensureTokens function
const { state, eventId } = useApp()
const eventSlug = state.event?.slug
if (!eventId || !eventSlug)
  return (
    {}

      // Token upsert: replace event_id: 1
      .upsert({ player_id: id, event_id: eventId }, { onConflict: 'player_id,event_id' })
  )

// QR URL uses slug, not numeric ID (D-05)
const qrUrl = `${window.location.origin}/checkin/${eventSlug}/${token}`
```

### Anti-Patterns to Avoid

- **Never use `eventId ?? 1` as a fallback anywhere.** Per D-02, every `?? 1` must become a null-render guard.
- **Do not remove `eventId` from `AppProvider` prop type without updating callers.** The prop is `eventId?: number` — after removing the default, make it required and update `app/page.tsx` call.
- **Do not forget the games reload useEffect dep array.** Lines 257-262 in `store.tsx` also close over `eventId` and have a missing dep.
- **Do not leave realtime subscriptions with only `currentDate` in dep array.** The `[currentDate]` array means the channel never resubscribes when `eventId` changes if `currentDate` index stays the same.
- **Rules cache keyed globally breaks multi-event.** The `_cache` in `rules.ts` is a single flat map. Must be changed to `_cacheByEvent: Record<number, Record<string, string>>` and keyed by `eventId`.

---

## Don't Hand-Roll

| Problem                   | Don't Build                      | Use Instead                                                         | Why                                               |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| Realtime filter syntax    | Custom filter string builder     | Supabase's built-in `filter` option on `.on()`                      | Supabase validates and evaluates server-side      |
| Event context propagation | Redux/Zustand/additional context | `useApp()` — already in place                                       | AppProvider already accepts and exposes `eventId` |
| Slug-to-ID resolution     | New API route                    | `state.event` already loaded by `db.getEvent(eventId)` in `loadAll` | The slug is on the event record already in state  |
| Portal event context      | New context provider             | `useAuth().userRole.event_id` — already populated                   | `UserRole.event_id: number \| null` confirmed     |

---

## Hardcode Inventory (Verified by Grep — 2026-03-22)

Total hardcoded lines found: **~93** across 41 files (engines + routes + store + components).

### Layer 1: Engine Constants (5 files, ~44 hardcoded lines)

All five engines use `const EVENT_ID = 1` at module level. Phase 1 injected `SupabaseClient` but did NOT add `eventId` to function signatures.

| File                     | Hardcode Count | Entry Point(s) to Update                                                                                                                              | Internal uses to replace           |
| ------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `lib/engines/referee.ts` | 5              | `runRefereeEngine(eventDateId, sb)` → add `eventId`                                                                                                   | All `.eq('event_id', EVENT_ID)`    |
| `lib/engines/field.ts`   | 11             | `runFieldConflictEngine(eventDateId, sb)` → add `eventId`                                                                                             | All `.eq('event_id', EVENT_ID)`    |
| `lib/engines/weather.ts` | 7              | `runWeatherEngine(complexId, apiKey, sb)` → add `eventId`                                                                                             | All `.eq('event_id', EVENT_ID)`    |
| `lib/engines/unified.ts` | 9              | `runUnifiedEngine(eventDateId, sb)` → add `eventId`; `resolveAlert(alertId, resolvedBy, note, sb)` → add `eventId`                                    | All literal `event_id: 1`          |
| `lib/engines/rules.ts`   | 12             | `getRules`, `getRule`, `getRuleNum`, `getRuleBool`, `getWeatherThresholds`, `getRefereeRules`, `getSchedulingRules` → add `eventId`; change cache key | All `getRules(EVENT_ID, sb)` calls |

**Rules cache fix required:**

```typescript
// Before: single global cache
let _cache: Record<string, string> | null = null

// After: keyed by eventId
const _cacheByEvent: Map<number, { map: Record<string, string>; time: number }> = new Map()
```

### Layer 2: API Routes (17 files, ~24 hardcoded lines)

Two patterns: (a) `searchParams.get('event_id') ?? '1'` → require with 400 guard; (b) `event_id ?? 1` in body → require in body.

Engine routes also need `event_id` added to their call forwarding:

| File                                 | Count | Pattern                                | Special Notes                                   |
| ------------------------------------ | ----- | -------------------------------------- | ----------------------------------------------- |
| `app/api/referee-engine/route.ts`    | 0\*   | POST body needs `event_id`             | \*No fallback but must pass `eventId` to engine |
| `app/api/field-engine/route.ts`      | 1     | GET: `?? '1'`; POST needs `event_id`   | POST body needs `event_id` for engine call      |
| `app/api/weather-engine/route.ts`    | 0\*   | POST body needs `event_id`             | \*No fallback but engine needs `eventId`        |
| `app/api/unified-engine/route.ts`    | 0\*   | POST body needs `event_id`             | \*No fallback but engine needs `eventId`        |
| `app/api/rules/route.ts`             | 4     | GET: `?? '1'`; POST: 3 literal inserts | `const { ..., event_id = 1 } = body` default    |
| `app/api/lightning/route.ts`         | 5     | Body: `event_id ?? 1` × 5              | Uses `event_id` in 5 places                     |
| `app/api/admin/create-user/route.ts` | 2     | Body: `event_id ?? 1` × 2              |                                                 |
| `app/api/conflicts/route.ts`         | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/eligibility/route.ts`       | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/fields/route.ts`            | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/incidents/route.ts`         | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/medical/route.ts`           | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/ops-log/route.ts`           | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/referees/route.ts`          | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/registration-fees/route.ts` | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/rules/changes/route.ts`     | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/team-payments/route.ts`     | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/teams/route.ts`             | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/volunteers/route.ts`        | 1     | GET: `?? '1'`                          |                                                 |
| `app/api/weather/route.ts`           | 1     | GET: `?? '1'`                          |                                                 |

### Layer 3: Store/Realtime (lib/store.tsx — 1 default + 4 missing deps)

| Location                                                        | Fix                                  |
| --------------------------------------------------------------- | ------------------------------------ |
| `AppProvider` signature `eventId = 1` (line 202)                | Remove default — makes prop required |
| `loadAll` useEffect dep array `[]` (line 253)                   | Add `eventId`; add null guard        |
| Games reload useEffect dep array `[currentDate]` (line 262)     | Add `eventId`                        |
| Realtime useEffect dep array `[currentDate]` (line 289)         | Add `eventId`; add per-table filters |
| `addLog` useCallback dep array `[]` (line 304)                  | Add `eventId`                        |
| `refreshGames` useCallback dep array `[currentDate]` (line 314) | Add `eventId`                        |
| `triggerLightning` useCallback (line 419)                       | Add `eventId` to dep array           |
| `liftLightning` useCallback (line 436)                          | Add `eventId` to dep array           |

### Layer 4: Components (18 files, ~44 hardcoded lines)

| File                                         | Count | Context Source      | Notes                                          |
| -------------------------------------------- | ----- | ------------------- | ---------------------------------------------- |
| `components/engine/CommandCenter.tsx`        | 5     | `useApp()`          | `eventDateId ?? 1` (line 61) + 4 event_id refs |
| `components/programs/ProgramApprovals.tsx`   | 6     | `useApp()`          | Direct Supabase calls in admin component       |
| `components/auth/RegisterPage.tsx`           | 5     | `useSearchParams()` | Public flow — read `event_id` from URL query   |
| `components/programs/RegistrationConfig.tsx` | 4     | `useApp()`          | Direct Supabase calls                          |
| `components/auth/RefereePortal.tsx`          | 3     | `userRole.event_id` | Outside AppProvider — no useApp()              |
| `components/auth/VolunteerPortal.tsx`        | 3     | `userRole.event_id` | Outside AppProvider — no useApp()              |
| `components/schedule/ScheduleTab.tsx`        | 3     | `useApp()`          | `addGame` payload + fetch URL                  |
| `components/rules/RulesTab.tsx`              | 3     | `useApp()`          | All fetch URLs hardcode `event_id=1`           |
| `components/checkin/CheckInTab.tsx`          | 2     | `useApp()`          | QR token upsert (D-05) + eligibility fetch     |
| `components/incidents/IncidentsTab.tsx`      | 2     | `useApp()`          | `logIncident` payload + `dispatchTrainer`      |
| `components/programs/ProgramDashboard.tsx`   | 1     | `userRole.event_id` | Outside AppProvider — program leader view      |
| `components/engine/EngineTab.tsx`            | 1     | `useApp()`          | `event_id: 1` in ops_log insert                |
| `components/payments/PaymentsTab.tsx`        | 1     | `useApp()`          | `state.event?.id ?? 1` pattern                 |
| `components/AppShell.tsx`                    | 1     | `useApp()`          | `(state.event as any)?.id ?? 1` cast           |
| `components/auth/UserManagement.tsx`         | 1     | `useApp()`          | `(state.event as any)?.id ?? 1` cast           |
| `components/refs/RefsTab.tsx`                | 1     | `useApp()`          |                                                |
| `components/settings/LeagueSettingsTab.tsx`  | 1     | `useApp()`          | `ops_log` insert                               |
| `components/weather/WeatherTab.tsx`          | 1     | `useApp()`          | Lightning body `state.event?.id ?? 1`          |

---

## Common Pitfalls

### Pitfall 1: Missing eventId in useCallback Dependency Arrays

**What goes wrong:** After fixing the `loadAll` and realtime `useEffect` dependencies, actions like `addLog`, `refreshGames`, `triggerLightning`, `liftLightning` close over `eventId` in their `useCallback` bodies but do not list it as a dependency. If `eventId` changes, these actions silently operate against the old event.

**Why it happens:** `useCallback(fn, [])` or `useCallback(fn, [currentDate])` captures `eventId` at creation time only.

**How to avoid:** Every `useCallback` in `lib/store.tsx` that references `eventId` must include it in the dependency array. Run `npm run lint` — ESLint's `exhaustive-deps` rule will flag these.

**Warning signs:** ESLint `react-hooks/exhaustive-deps` warnings on useCallback/useEffect bodies.

### Pitfall 2: Realtime Channel Name Collision

**What goes wrong:** When `eventId` changes, the old channel is removed via `sb.removeChannel(sub)` in the cleanup, then a new channel with the same name `'leagueops-realtime'` is created. If the client hasn't fully processed the removal before creating the new one, Supabase may warn about duplicate channels.

**Why it happens:** React runs cleanup synchronously before the new effect, so ordering is correct. However, the Supabase `removeChannel` is async internally.

**How to avoid:** The default behavior (using the same channel name) is safe in practice because React cleanup runs before the new effect. If issues arise, use `leagueops-realtime-${eventId}` as the channel name for clear isolation.

**Warning signs:** Console warnings from Supabase about duplicate channels; realtime events not arriving after event switch.

### Pitfall 3: Portal Components Have No AppProvider

**What goes wrong:** `RefereePortal`, `VolunteerPortal`, and `ProgramDashboard` are rendered from `app/page.tsx` BEFORE `AppProvider` wraps. Calling `useApp()` inside them throws: `"useApp must be used within AppProvider"`.

**Confirmed safe solution:** `UserRole.event_id: number | null` is populated via `loadUserRole`'s `select('*')`. Use `userRole?.event_id` from `useAuth()` in these components.

**Warning signs:** Runtime error "useApp must be used within AppProvider" on referee/volunteer login.

### Pitfall 4: API Route Callers Must Send event_id After Routes Are Fixed

**What goes wrong:** When API routes change from `?? '1'` fallbacks to 400 guards, any component calling those routes without an `event_id` param will get 400 errors.

**How to avoid:** Fix API routes and the component callers in the same phase (they are). Sequence API route fixes after component fixes within each plan wave, or accept temporary 400s during incremental rollout knowing the fix is in progress.

### Pitfall 5: Rules Cache Keyed Globally Serves Wrong Event

**What goes wrong:** `lib/engines/rules.ts` has `let _cache: Record<string, string> | null = null` — a single global cache for all events. If Event A is loaded, then a request comes in for Event B, the cache returns Event A's rules.

**Why it happens:** The cache was designed for single-event use. On Vercel serverless this is less severe (request isolation), but in local dev it causes cross-event contamination.

**How to avoid:** Change cache to `Map<number, { map: Record<string, string>; time: number }>` keyed by `eventId`.

### Pitfall 6: RegisterPage Has No App Context — Needs URL Query Param

**What goes wrong:** `RegisterPage` lives at `/register` with no event selection flow upstream. It hardcodes `event_id: 1` in 5 places.

**Context source:** `RegisterPage` must read `eventId` from the URL query string via `useSearchParams()`. Callers (registration links) must include `?event_id=X` in the URL. If `event_id` is absent from the URL, the component should display an error or disabled state rather than defaulting to 1.

**Warning signs:** Programs registering to the wrong event.

### Pitfall 7: unified.ts Receives eventId but Sub-Engines Also Need It

**What goes wrong:** When `runUnifiedEngine` gets `eventId` as a parameter and calls `runRefereeEngine(eventDateId, sb)` and `runFieldConflictEngine(eventDateId, sb)`, those sub-engine calls also need `eventId`. The fix must cascade — both the unified engine signature and all its internal engine calls must be updated together.

**How to avoid:** In Plan A (engines layer), fix all five engines in one plan so the chain is consistent. Don't fix unified.ts without also fixing its engine callees.

---

## Code Examples

Verified patterns from code reading:

### Supabase Realtime Filter (postgres_changes)

```typescript
// Verified pattern — Supabase JS v2 postgres_changes with filter
// Source: store.tsx pattern + Supabase JS v2 docs (filter param)
const filter = `event_id=eq.${eventId}`
const sub = sb
  .channel('leagueops-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter }, () => {
    if (currentDate)
      db.getGamesByDate(eventId, currentDate.id).then((d) =>
        dispatch({ type: 'SET_GAMES', payload: d })
      )
  })
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
// At the top of any component that needs eventId (inside AppProvider)
const { state, eventId } = useApp()
if (!eventId) return null // D-01: no spinner, app shell stays visible
```

### Portal Null Guard (Outside AppProvider)

```typescript
// At the top of RefereePortal / VolunteerPortal / ProgramDashboard
const { userRole } = useAuth()
const portalEventId = userRole?.event_id
if (!portalEventId) return null // D-01 guard
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

### Rules Cache Keyed by eventId

```typescript
// lib/engines/rules.ts — after Phase 2
const _cacheByEvent = new Map<number, { map: Record<string, string>; time: number }>()
const CACHE_TTL_MS = 30_000

export async function getRules(
  eventId: number,
  sb: SupabaseClient
): Promise<Record<string, string>> {
  const now = Date.now()
  const cached = _cacheByEvent.get(eventId)
  if (cached && now - cached.time < CACHE_TTL_MS) return cached.map
  const rules = await loadRules(eventId, sb)
  const map: Record<string, string> = {}
  for (const r of rules) map[`${r.category}.${r.rule_key}`] = r.rule_value
  _cacheByEvent.set(eventId, { map, time: now })
  return map
}

export function invalidateRulesCache(eventId?: number) {
  if (eventId !== undefined) _cacheByEvent.delete(eventId)
  else _cacheByEvent.clear()
}
```

---

## State of the Art

| Old Approach                           | Current Approach                          | When Changed         | Impact                 |
| -------------------------------------- | ----------------------------------------- | -------------------- | ---------------------- |
| Engine imports browser client directly | Engine accepts `SupabaseClient` parameter | Phase 1 (complete)   | Server-safe calls      |
| `event_id: 1` hardcode everywhere      | Dynamic `eventId` from context/params     | Phase 2 (this phase) | Multi-event isolation  |
| Global rules cache                     | Per-event cache keyed by eventId          | Phase 2 (this phase) | Correct rule isolation |

---

## Open Questions

1. **RegisterPage event_id source**
   - What we know: `RegisterPage` lives at `/register` with no upstream event context. It hardcodes `event_id: 1` in 5 places. `app/register/page.tsx` passes no props.
   - What's unclear: Who generates the registration link — is `?event_id=X` already appended by the admin, or does it need a slug-based approach like `/register?event=slug`?
   - Recommendation: Read how `EventPicker` generates registration links before implementing `RegisterPage` changes. Default implementation: `useSearchParams()` to read `event_id`; show an error message if missing.

2. **CommandCenter eventDateId ?? 1 (line 61)**
   - What we know: `const eventDateId = currentDate?.id ?? 1` at line 61 of `CommandCenter.tsx` is a `?? 1` fallback that must become a null guard per D-02.
   - What's unclear: Whether `CommandCenter` should show empty state when `currentDate` is null, or if it should be guarded by parent rendering logic.
   - Recommendation: Convert to `if (!currentDate) return null` at the top of the component, consistent with D-01.

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

| Req ID | Behavior                                                          | Test Type                    | Automated Command                                         | File Exists?                              |
| ------ | ----------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| SEC-04 | Engine functions accept `eventId` param and use it (not EVENT_ID) | unit                         | `npm run test -- __tests__/lib/engines/`                  | Yes — need updating to pass `eventId` arg |
| SEC-04 | `loadAll` re-fires when `eventId` prop changes                    | unit (React Testing Library) | `npm run test -- __tests__/lib/store.test.tsx`            | No — Wave 0 gap                           |
| SEC-04 | grep assertion: no `event_id.*: 1` or `?? 1` remains              | smoke (grep in CI)           | `grep -r "event_id.*: 1\|?? 1" lib/ components/ app/api/` | N/A — manual                              |
| SEC-05 | Realtime subscription includes `filter: 'event_id=eq.N'`          | unit                         | `npm run test -- __tests__/lib/store.test.tsx`            | No — Wave 0 gap                           |
| SEC-05 | Realtime channel torn down and recreated when eventId changes     | unit (React Testing Library) | `npm run test -- __tests__/lib/store.test.tsx`            | No — Wave 0 gap                           |
| SEC-04 | Rules cache returns correct rules per event, not cross-event      | unit                         | `npm run test -- __tests__/lib/engines/rules.test.ts`     | Yes — need new test cases                 |

### Sampling Rate

- **Per task commit:** `npm run test -- __tests__/lib/engines/`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + grep verifies no `?? 1` or `event_id: 1` literal remains in engines/components/routes

### Wave 0 Gaps

- [ ] `__tests__/lib/store.test.tsx` — covers SEC-04 (loadAll re-fires on eventId change) and SEC-05 (realtime filter and teardown behavior)

Existing engine test files (`referee.test.ts`, `field.test.ts`, `weather.test.ts`, `unified.test.ts`, `rules.test.ts`) call engines with the current 2-arg signature. After the engine signature change, all test call sites must add `eventId` as the second argument before `sb`. This is an update to existing files, not new files.

---

## Project Constraints (from CLAUDE.md)

- **Stack is locked:** Next.js 14 App Router + Supabase + Vercel — no stack changes
- **All interactive components use `'use client'` as first line**
- **TypeScript strict mode:** Explicit types on all function signatures and interfaces
- **Import style:** `import * as db from '@/lib/db'` for database layer; `import type { ... }` for type-only imports
- **Naming:** `useCallback` dep arrays must be explicit — ESLint `exhaustive-deps` will fire
- **Multi-event scoping rule (CLAUDE.md):** "Every Supabase query must be scoped with `.eq('event_id', eventId)`. Never hardcode `event_id: 1` in new code."
- **No new third-party libraries** unless budget/free-tier compliant
- **`AppProvider` currently defaults `eventId = 1` — this default must be removed as part of this phase**

---

## Sources

### Primary (HIGH confidence)

- Direct code reading: `lib/store.tsx` (lines 195-510 verified)
- Direct code reading: `lib/engines/referee.ts`, `field.ts`, `weather.ts`, `unified.ts`, `rules.ts`
- Direct code reading: `lib/auth.tsx` — `UserRole.event_id: number | null` confirmed at line 19
- Direct code reading: `app/page.tsx` — AppProvider wiring confirmed at line 69
- Direct code reading: `components/auth/RegisterPage.tsx`, `components/auth/RefereePortal.tsx`, `components/auth/VolunteerPortal.tsx`, `components/programs/ProgramDashboard.tsx`
- Direct grep: hardcode inventory counts verified on 2026-03-22
- `.planning/phases/02-hardcode-removal-event-context/02-CONTEXT.md` — all decisions

### Secondary (MEDIUM confidence)

- Supabase JS v2 `postgres_changes` filter syntax — verified via pattern match against `@supabase/supabase-js ^2.99.2` in use
- ESLint `react-hooks/exhaustive-deps` behavior — established pattern in Next.js + React 18 ecosystem

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Hardcode inventory: HIGH — verified by direct grep scan of actual codebase (2026-03-22)
- Architecture patterns: HIGH — verified against actual code (store.tsx, app/page.tsx)
- Realtime filter syntax: HIGH — Supabase JS v2 is in use, filter option is in active use pattern
- Portal event_id source: HIGH — `UserRole.event_id: number | null` confirmed in `lib/auth.tsx` line 19
- RegisterPage event source: MEDIUM — URL query param is the logical source; registration link generation flow not fully traced

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack, no fast-moving dependencies)
