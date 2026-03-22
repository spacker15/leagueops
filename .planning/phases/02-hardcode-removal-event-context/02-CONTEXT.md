# Phase 2: Hardcode Removal & Event Context - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate all ~60 hardcoded `event_id = 1` references across engines, API routes, store, and components. Fix the `loadAll` dependency array bug so data reloads when `eventId` changes. Scope realtime subscriptions to the current event. Replace QR code URLs with dynamic event slugs. No schema changes, no new features.

</domain>

<decisions>
## Implementation Decisions

### Loading Fallbacks

- **D-01:** When `eventId` is not yet available (undefined/loading), components return `null` early — no spinner, no error boundary. The app shell stays visible while individual tab content waits.
- **D-02:** Never replace `?? 1` with another constant. Every fallback must be a null-render guard.

### Realtime Subscription Scoping (SEC-05)

- **D-03:** When `eventId` changes, teardown the existing `leagueops-realtime` channel and create a new one with `filter: 'event_id=eq.{newEventId}'` on each `postgres_changes` listener.
- **D-04:** The resubscription logic goes in `lib/store.tsx` inside the existing realtime `useEffect`, which must add `eventId` to its dependency array.

### QR Code URLs

- **D-05:** QR code URLs use the event slug (not numeric ID). Pattern: `/checkin/{eventSlug}/{token}`. Consistent with the existing `/e/[slug]` routing pattern.

### Migration Order

- **D-06:** Work layer-by-layer: engines first, then API routes, then store/realtime, then components. Each layer is a separate plan. Dependency-safe — engines feed routes, routes feed components.

### Claude's Discretion

- Exact grouping of components into sub-plans (by tab, by feature, or alphabetical)
- Whether to batch small API route changes into one plan or split by route
- `loadAll` dependency fix can go in the store/realtime plan since it's in `lib/store.tsx`

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hardcode Inventory

- `.planning/codebase/CONCERNS.md` §2 — Full list of hardcoded `event_id = 1` locations with line numbers
- `.planning/codebase/ARCHITECTURE.md` — Data flow and state management patterns

### Store & Realtime

- `lib/store.tsx` — AppProvider, loadAll, realtime subscriptions (lines 211-290)
- `lib/auth.tsx` — AuthProvider, user role loading

### Engine Modules (already refactored in Phase 1)

- `lib/engines/unified.ts` — May still have hardcoded event_id references in alert creation
- `lib/engines/weather.ts` — EVENT_ID constant
- `lib/engines/referee.ts` — EVENT_ID constant
- `lib/engines/field.ts` — EVENT_ID constant

### Key Components

- `components/engine/CommandCenter.tsx` — Multiple hardcoded event_id references
- `components/checkin/CheckInTab.tsx` — QR code URL with hardcoded event_id
- `components/auth/RegisterPage.tsx` — Registration queries with hardcoded event_id
- `components/schedule/ScheduleTab.tsx` — Schedule queries

### Prior Phase Context

- `.planning/phases/01-engine-client-refactor/01-CONTEXT.md` — Phase 1 decisions on engine injection pattern

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `useApp()` hook — Already provides `eventId` via `AppProvider` props. Components can destructure it.
- `useAuth()` hook — Provides user context, not event-scoped.
- Event slug resolution — `app/e/[slug]/page.tsx` resolves slug to event record including `id`.

### Established Patterns

- `AppProvider` accepts `eventId?: number` defaulting to `1` for backward compatibility — this default must be removed or made explicit.
- All `lib/db.ts` functions use `.eq('event_id', eventId)` pattern — engines and components should follow the same pattern.
- Realtime setup in `store.tsx` uses a single channel with multiple `postgres_changes` listeners.

### Integration Points

- `lib/store.tsx` loadAll — Must include `eventId` in its dependency array
- `lib/store.tsx` realtime useEffect — Must include `eventId` in dependency array and resubscribe
- Every component that calls `lib/db.ts` directly (bypassing store) needs eventId passed through

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard systematic refactor following the hardcode inventory in CONCERNS.md.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 02-hardcode-removal-event-context_
_Context gathered: 2026-03-22_
