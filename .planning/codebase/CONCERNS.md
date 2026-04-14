# LeagueOps — Codebase Concerns

Technical debt, known issues, security concerns, performance problems, and fragile areas identified across the codebase.

---

## 1. Critical Security: Most API Routes Have No Authentication

The vast majority of API routes accept requests without verifying the caller's identity. Only two routes perform auth checks:

- `app/api/admin/create-user/route.ts` — checks `auth.getUser()` and validates `admin` role
- `app/api/auth/program-prefill/route.ts` — checks `auth.getUser()`

Every other route in the `app/api/` directory uses the server Supabase client but **never calls `auth.getUser()`**:

- `app/api/games/route.ts` — unauthenticated POST creates/modifies games
- `app/api/checkins/route.ts` — unauthenticated POST/DELETE modifies player check-ins
- `app/api/incidents/route.ts` — unauthenticated POST creates incident reports
- `app/api/medical/route.ts` — unauthenticated POST creates medical incidents
- `app/api/lightning/route.ts` — unauthenticated POST triggers/lifts lightning delays
- `app/api/payment-entries/route.ts` — unauthenticated POST records payments
- `app/api/teams/route.ts`, `app/api/referees/route.ts`, `app/api/players/route.ts` — unauthenticated writes
- `app/api/ops-log/route.ts`, `app/api/conflicts/route.ts`, `app/api/assignments/route.ts` — all unprotected

Access control currently relies entirely on Supabase Row Level Security policies. However, the base schema in `supabase/schema.sql` sets **all tables to permissive `"Allow all"` policies** with `USING (true)`:

```sql
-- supabase/schema.sql lines 254-268
CREATE POLICY "Allow all" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON teams FOR ALL USING (true) WITH CHECK (true);
-- ... repeated for all core tables
```

The inline comment reads: `-- Allow all for anon (public tournament operations — add auth later for production)`. This has not been addressed. Additionally, `supabase/auth_migration.sql` adds `"Allow all"` policies to `player_qr_tokens`, `qr_checkin_log`, and `portal_checkins`.

Anyone with the Supabase anon key (which is publicly exposed via `NEXT_PUBLIC_SUPABASE_ANON_KEY`) can read, write, or delete any data in the database.

---

## 2. Critical: Hardcoded `event_id = 1` Throughout the Codebase

The app supports multiple events via an `EventPicker` and dynamic `eventId` prop on `AppProvider`, but large swaths of the codebase bypass this entirely by hardcoding `event_id = 1`. This is the single largest area of technical debt.

**Affected files (partial — over 60 occurrences):**

- `lib/engines/unified.ts` — hardcodes `event_id: 1` in at least 12 places (lines 97, 113, 134, 155, 204, 222, 257, 371, 391, 443)
- `lib/engines/field.ts` — `const EVENT_ID = 1` at line 19
- `lib/engines/referee.ts` — `const EVENT_ID = 1` at line 25
- `lib/engines/weather.ts` — `const EVENT_ID = 1` at line 15
- `components/engine/CommandCenter.tsx` — hardcodes `event_id: 1` in queries and inserts (lines 66, 84, 787, 861)
- `components/incidents/IncidentsTab.tsx` — hardcodes `event_id: 1` (lines 125, 147)
- `components/auth/RegisterPage.tsx` — hardcodes `.eq('event_id', 1)` and `event_id: 1` in multiple inserts (lines 133, 139, 460, 472, 499)
- `components/auth/RefereePortal.tsx` — hardcodes `event_id: 1` in check-in (lines 139, 143, 424)
- `components/auth/VolunteerPortal.tsx` — hardcodes `event_id: 1` (lines 132, 136, 397)
- `components/programs/ProgramApprovals.tsx` — hardcodes `event_id: 1` (lines 108, 121, 140, 178, 195, 211)
- `components/programs/RegistrationConfig.tsx` — hardcodes `.eq('event_id', 1)` (lines 61, 65)
- `components/settings/LeagueSettingsTab.tsx` — hardcodes `event_id: 1` (line 139)
- `components/refs/RefsTab.tsx` — hardcodes `event_id: 1` (line 612)
- `components/checkin/CheckInTab.tsx` — hardcodes `event_id: 1` and `event_id=1` in URL (lines 59, 191)
- `components/schedule/ScheduleTab.tsx` — hardcodes `event_id: 1` (lines 48, 177, 575)
- `app/api/rules/route.ts` — hardcodes `event_id: 1` in inserts and defaults (lines 60, 70, 83)
- `app/api/lightning/route.ts` — falls back to `event_id ?? 1`

The unified engine also hardcodes `complex_id: 1` when calling the weather engine:

```typescript
// lib/engines/unified.ts line 67
body: JSON.stringify({ complex_id: 1 }),
```

This means running the unified engine at a multi-complex event will only ever check weather for complex 1, regardless of which complexes are actually in use.

---

## 3. Pervasive `as any` Usage — Missing Type Safety

`as any` casts appear over 80 times across the codebase, indicating that TypeScript's type system is being bypassed extensively. The most concentrated areas:

- `lib/engines/eligibility.ts` — 20+ casts: player and game objects are cast to `any` to access fields that should be typed (e.g., `(player as any).home_division`, `(game as any).event_id`)
- `lib/engines/unified.ts` — ~15 casts on alert, game, incident, and log objects
- `lib/engines/referee.ts` — ~8 casts on ref and assignment objects
- `lib/engines/field.ts` — ~3 casts on game and field objects
- `components/engine/CommandCenter.tsx` — prop types `field: any`, `liveGame: any`, `game: any` (lines 688, 690, 771)
- `components/schedule/ScheduleTab.tsx` — `game: any`, `conflict: any` component props (lines 870, 872)
- `components/weather/WeatherTab.tsx` — `event: any` prop (line 38)

The `types/index.ts` file defines typed interfaces, but many engine functions and components receive database query results without asserting them against those types, falling back to `as any` when the shape doesn't match. The eligibility engine in particular should be refactored to extend the `Player` and `Game` types with joined fields.

---

## 4. Unguarded Cookie Setter — Silent Failure

In `supabase/server.ts`, the `set` and `remove` cookie handlers silently swallow all errors:

```typescript
// supabase/server.ts lines 18-27
set(name: string, value: string, options: CookieOptions) {
  try {
    cookieStore.set({ name, value, ...options })
  } catch {}
},
remove(name: string, options: CookieOptions) {
  try {
    cookieStore.set({ name, value: '', ...options })
  } catch {}
},
```

Empty catch blocks will hide any failure to write session cookies. If session persistence breaks, users will get mysterious auth failures with no indication of the root cause.

---

## 5. Weather Engine Uses Client-Side Supabase in Server Context

The weather engine at `lib/engines/weather.ts` imports from `@/supabase/client` (the browser client):

```typescript
// lib/engines/weather.ts line 13
import { createClient } from '@/supabase/client'
```

The engine is called from server-side API routes (`app/api/weather-engine/route.ts`, `app/api/lightning/route.ts`). The browser client uses `createBrowserClient` which is designed for client-side use and depends on browser session cookies. Running it server-side means it cannot authenticate as the current user and will behave as the anonymous role.

The same issue affects:

- `lib/engines/field.ts` line 16 — `import { createClient } from '@/supabase/client'`
- `lib/engines/referee.ts` line 14 — `import { createClient } from '@/supabase/client'`
- `lib/engines/eligibility.ts` line 11 — `import { createClient } from '@/supabase/client'`
- `lib/engines/unified.ts` line 9 — `import { createClient } from '@/supabase/client'`

All engine modules should use `@/supabase/server` when called from API routes, or be refactored to accept a Supabase client as a parameter.

---

## 6. Weather API Key Exposed on Client Side

The OpenWeather API key is referenced as `NEXT_PUBLIC_OPENWEATHER_KEY` in the client-side weather engine:

```typescript
// lib/engines/weather.ts line 100
const key = apiKey ?? process.env.NEXT_PUBLIC_OPENWEATHER_KEY ?? ''
```

`NEXT_PUBLIC_` environment variables are bundled into the client JavaScript and visible to anyone who downloads the page. The server-side API route at `app/api/weather-engine/route.ts` correctly uses `process.env.OPENWEATHER_API_KEY` (without `NEXT_PUBLIC_`), but the engine code itself also reads the public key. The key should only ever be accessed server-side.

---

## 7. Missing Input Validation on Several API Routes

Multiple routes insert caller-supplied `body` directly into the database without validation:

- `app/api/games/route.ts` — `sb.from('games').insert(body)` with no field validation
- `app/api/fields/route.ts` — `sb.from('fields').insert(body)` unvalidated
- `app/api/teams/route.ts` — `sb.from('teams').insert(body)` unvalidated
- `app/api/referees/route.ts` — `sb.from('referees').insert(body)` unvalidated
- `app/api/ops-log/route.ts` — `sb.from('ops_log').insert({ ...body, ... })` unvalidated
- `app/api/medical/route.ts` — `sb.from('medical_incidents').insert(body)` unvalidated
- `app/api/incidents/route.ts` — `sb.from('incidents').insert(body)` unvalidated

There is no Zod schema validation, no field allowlist, and no sanitization. Any extra fields in the request body are passed through to Supabase, which will reject unknown columns but could be exploited to overwrite fields like `event_id` that should be server-controlled.

---

## 8. Payment Update Not Atomic — Race Condition Risk

In `app/api/payment-entries/route.ts`, recording a payment is a multi-step operation that is not wrapped in a transaction:

1. Insert `payment_entries` row
2. Re-fetch all entries to recalculate `amount_paid`
3. Update `team_payments` with new totals

If two payment entries are submitted simultaneously, both step 2 queries could read the same stale total and one update will silently overwrite the other. The `amount_paid` on `team_payments` could be permanently understated. This should be done with a database function or at minimum a transaction.

---

## 9. Store `loadAll` Effect Missing `eventId` Dependency

In `lib/store.tsx`, the initial data load effect is missing `eventId` in its dependency array:

```typescript
// lib/store.tsx lines 210-253
useEffect(() => {
  async function loadAll() { ... }
  loadAll()
}, []) // ← eventId is captured via closure but not listed
```

If the parent passes a new `eventId` prop, `loadAll` will not re-execute, leaving stale data for the previous event displayed. The same pattern is repeated in the `currentDate` game load effect which also closes over `eventId` without declaring it.

---

## 10. Real-time Subscription Not Scoped to Current Event

In `lib/store.tsx`, the Supabase realtime channel listens for `*` changes on `games`, `incidents`, `ops_log`, and `medical_incidents` across all rows:

```typescript
// lib/store.tsx lines 267-285
.on('postgres_changes', { event: '*', schema: 'public', table: 'ops_log' }, (payload) => { ... })
.on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => { ... })
```

There is no `filter` option (e.g., `filter: 'event_id=eq.1'`). In a multi-event deployment this means an update to any event's data triggers a full re-fetch for the active event. This creates unnecessary database load and could cause UI flickering.

---

## 11. Hardcoded Geographic Bias in Registration

The `RegisterPage` component restricts US state selection to only 10 states:

```typescript
// components/auth/RegisterPage.tsx line 25
const STATES = ['AL', 'AR', 'FL', 'GA', 'MS', 'NC', 'SC', 'TN', 'TX', 'VA']
```

This is Southeast-only and will silently exclude registrations from programs in other states without any indication to the user. The referee join form at `app/api/join/route.ts` also hardcodes `grade_level: 'Grade 5'` as the default for all incoming referees — this may not be appropriate as a permanent default.

---

## 12. `field-engine` GET Query Bug — `resolved` Filter Always False

In `app/api/field-engine/route.ts`, the GET handler passes `type === 'all' ? false : false` as the resolved filter:

```typescript
// app/api/field-engine/route.ts line 64
.eq('resolved', type === 'all' ? false : false)
```

Both branches evaluate to `false`, so requesting `?type=all` does not actually return resolved conflicts — it behaves identically to `?type=open`. The intended behavior is presumably `type === 'all' ? undefined : false` (skip the filter) or `type === 'resolved' ? true : false`.

---

## 13. Unified Engine Weather Call Hardcodes `complex_id: 1`

Beyond the `event_id` problem noted in section 2, `lib/engines/unified.ts` also hardcodes the complex:

```typescript
// lib/engines/unified.ts lines 64-68
fetch('/api/weather-engine', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ complex_id: 1 }),
})
```

Events with multiple complexes at different locations will only ever get weather data for complex 1 when running the unified engine. This is a safety concern given that weather (especially lightning) is location-specific.

---

## 14. Lightning Detection Relies on OpenWeatherMap Condition Codes — Not Actual Strike Data

The lightning detection in `lib/engines/weather.ts` infers lightning presence from OWM weather condition codes:

```typescript
// lib/engines/weather.ts line 385
lightning_detected: (d.weather[0]?.id ?? 0) >= 200 && (d.weather[0]?.id ?? 0) < 300,
```

OWM codes 200-299 are "Thunderstorm" codes, not actual lightning strike detections. This means lightning may not be detected until a thunderstorm is actively overhead, rather than at the 8-mile radius stated in `THRESHOLDS.lightning.radius_miles`. The comment in the code claims it uses "One Call API 3.0" with lightning radius detection, but the actual fetch uses the basic `/data/2.5/weather` endpoint which has no lightning strike radius data. The two descriptions are contradictory.

---

## 15. Mock Weather Data Has a Fixed Location Bias

`getMockWeather()` in `lib/engines/weather.ts` generates weather simulating "Jacksonville June weather" regardless of where the actual complex is located:

```typescript
// lib/engines/weather.ts lines 397-400
const baseTemp = 84 + Math.round((Math.random() - 0.5) * 8)
const humidity = 65 + Math.round(Math.random() * 15)
```

Events running in winter or in northern states will display unrealistic weather mock data. The UV index is hardcoded to 9 and wind direction to 225 degrees. This is unlikely to cause a production incident but creates misleading development and staging data.

---

## 16. No Tests for Business-Critical Engine Logic

The only test file is `__tests__/lib/utils.test.ts`, which covers utility functions (`cn`, `statusColor`, `initials`, `parseRosterCSV`). There are no tests for:

- `lib/engines/eligibility.ts` — no test for play-down enforcement or multi-game approval logic
- `lib/engines/referee.ts` — no test for conflict detection or schedule overlap logic
- `lib/engines/field.ts` — no test for field conflict detection
- `lib/engines/weather.ts` — no test for alert thresholds or heat index calculation
- `lib/engines/rules.ts` — no test for rule caching or invalidation

These engines make game-day operational decisions. A bug in the eligibility engine could allow illegal player participation; a bug in the weather engine could fail to trigger a lightning delay.

---

## 17. Fragile Time Parsing in Engines — No Timezone Handling

Both `lib/engines/field.ts` and `lib/engines/referee.ts` parse game scheduled times using string regex against formats like `"8:00 AM"`:

```typescript
// lib/engines/field.ts lines 56-67
function timeToMinutes(time: string): number {
  const ampm = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  ...
}
```

There is no timezone context attached to the parsed times. If `scheduled_time` values are stored inconsistently (some with timezone offsets, some without), comparisons between them will silently produce wrong overlap calculations. The function returns 0 for any time it cannot parse, which would make a game appear to start at midnight and potentially suppress real conflicts.

---

## 18. `AppShell` Uses `as any` to Access Event ID — Fragile Fallback

Multiple components access the event ID via `(state.event as any)?.id ?? 1`, which silently defaults to event 1 if the event has not loaded yet:

```typescript
// components/AppShell.tsx line 151
<EventSetupTab eventId={(state.event as any)?.id ?? 1} />

// components/auth/UserManagement.tsx line 27
const eventId = (state.event as any)?.id ?? 1
```

If the event fails to load (network error, bad event ID), the component silently operates against event 1. The `event` property on `State` is typed as `Event | null`, and `Event` in `types/index.ts` should have an `id` field — the `as any` cast is unnecessary and hides the actual typing issue.

---

## 19. No Rate Limiting on Any API Route

There is no rate limiting on any endpoint. Potentially sensitive or expensive endpoints have no protection:

- `app/api/eligibility/route.ts` — runs database queries per call, no limit
- `app/api/referee-engine/route.ts` — triggers a full conflict scan
- `app/api/field-engine/route.ts` — triggers a full conflict scan
- `app/api/weather-engine/route.ts` — calls the OpenWeatherMap API
- `app/api/auth/check-email/route.ts` — can be used to enumerate registered emails
- `app/api/join/route.ts` — publicly accessible self-registration endpoint

The weather engine endpoint is particularly concerning: calling it repeatedly will exhaust the OpenWeatherMap free tier (1,000 calls/day) and could incur charges on paid tiers.

---

## 20. Email Enumeration via `check-email` Endpoint

`app/api/auth/check-email/route.ts` accepts an email address and returns whether a program exists with that contact email, along with the program name and status. This endpoint has no authentication requirement and no rate limiting, making it usable as an oracle to enumerate which email addresses have registered programs.

---

## 21. `app/api/join` Does Not Validate Token Before Accepting Registration Data

The POST handler for `app/api/join/route.ts` re-validates the token after receiving the full request body, but the request body is parsed and destructured unconditionally before the validation occurs. If the token is invalid, the destructured PII (first name, last name, email, phone) has already been received and processed — it just isn't stored. The validation comment in the code addresses this as a two-step process but does not protect against malformed or oversized payloads.

---

## 22. Public Results Sub-App Has No Error Boundary

The public-facing sub-application at `apps/public-results/src/app/e/[slug]/page.tsx` fetches event data server-side. If the Supabase environment variables are not configured, the app at `apps/public-results/src/app/page.tsx` explicitly checks and shows a placeholder, but the `[slug]` page does not handle a missing Supabase URL gracefully and will throw at runtime.

---

## 23. Incomplete Player Type — Joined Fields Not in Interface

The `types/index.ts` file defines a `Player` interface, but engine code accesses join-expanded fields like `player.home_division`, `player.team[0]?.division`, and `player.team_id` by casting to `any`. These joined fields are fetched in query selects but not reflected in the `Player` type, causing the pervasive `as any` problem in `lib/engines/eligibility.ts`. Similarly, `Game` has join-expanded `home_team`, `away_team`, and `field` objects accessed via `as any` throughout engine code.

---

## 24. Ops Log Route Accepts Arbitrary Message Content Without Sanitization

`app/api/ops-log/route.ts` inserts caller-supplied body content directly into `ops_log.message` with no length limit or content validation. Since the ops log is displayed in the Command Center's live feed, an authenticated (or unauthenticated, per concern 1) caller could inject arbitrary text into the operational feed.

---

## 25. `supabase/server.ts` Sets `persistSession: false` — Potential Session Refresh Issue

The server-side Supabase client disables session persistence:

```typescript
// supabase/server.ts lines 11-13
auth: {
  persistSession: false,
},
```

With `@supabase/ssr`, `persistSession: false` means the server client will not automatically refresh expired tokens between requests. If a user's access token expires during a long operation, subsequent server-side auth checks will return `null` for the user, silently failing rather than prompting reauthentication. This interacts poorly with the already minimal auth checks on API routes.

---

## Summary of Priority Areas

| Priority | Concern                                                                          |
| -------- | -------------------------------------------------------------------------------- |
| P0       | Permissive RLS `"Allow all"` policies on all tables (schema.sql)                 |
| P0       | 40+ API routes have no authentication check                                      |
| P1       | Hardcoded `event_id = 1` breaks multi-event support in engines and components    |
| P1       | All engines import browser Supabase client — wrong context for server-side calls |
| P1       | Weather API key exposed via `NEXT_PUBLIC_OPENWEATHER_KEY`                        |
| P1       | Payment recording has a race condition (no transaction)                          |
| P2       | `field-engine` GET `resolved` filter always evaluates to `false`                 |
| P2       | Unified engine hardcodes `complex_id: 1` for weather — safety risk               |
| P2       | Lightning detection uses coarse condition codes, not actual strike radius data   |
| P2       | No rate limiting on any API route                                                |
| P2       | Email enumeration via unauthenticated `check-email` endpoint                     |
| P3       | Missing `eventId` in `loadAll` effect dependency array                           |
| P3       | Real-time subscriptions not scoped to current event                              |
| P3       | 80+ `as any` casts — type system broadly bypassed                                |
| P3       | No tests for any business-critical engine logic                                  |
| P3       | Time parsing in engines has no timezone handling                                 |
| P3       | State list in registration limited to 10 southeast states                        |
