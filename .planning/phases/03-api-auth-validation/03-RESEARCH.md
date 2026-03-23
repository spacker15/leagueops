# Phase 03: API Auth & Validation - Research

**Researched:** 2026-03-23
**Domain:** Next.js App Router — Supabase SSR Auth, Zod request validation, Upstash rate limiting
**Confidence:** HIGH (core patterns verified against official docs and current package versions)

---

## Summary

Phase 03 is a cross-cutting hardening phase that touches every API route in the project. Its three concerns — authentication guards (SEC-02), Zod request validation (SEC-07), and Upstash rate limiting (SEC-08) — are bundled because all three share the same "touch every route" migration effort. The safest execution strategy is a categorize-first, modify-by-category-second discipline: enumerate all routes into four buckets (write, read, public, engine-trigger) before modifying any of them.

Supabase SSR auth for Next.js App Router requires `@supabase/ssr` and `createServerClient` with an async `cookies()` call from `next/headers`. The key guard call is `supabase.auth.getUser()` — never `getSession()` on the server, as that only validates the local JWT without hitting the Supabase Auth server. An expired or invalid JWT produces `{ data: { user: null }, error }` (never throws), which must be explicitly converted to a `401` JSON response.

Zod validation uses `schema.safeParse(await req.json())` — `safeParse` never throws, so no try/catch needed for the validation step itself. The machine-readable 400 response shape is `{ success: false, error: result.error.flatten() }`. Upstash rate limiting uses `@upstash/ratelimit ^2.x` with `Redis.fromEnv()`, a `slidingWindow` or `fixedWindow` limiter, and an IP or route-based identifier; the 429 response should include `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers from the `limit()` response.

**Primary recommendation:** Categorize all routes in a single inventory file first, then process one category at a time in this order: (1) add Zod schemas to all write routes, (2) add auth guards to write/read-authenticated routes, (3) add rate limiting to engine-trigger and public routes.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-02 | Every write route (POST/PATCH/DELETE) must call `auth.getUser()` and return `401` for unauthenticated requests. Intentionally public routes explicitly excluded and documented. | Supabase SSR `getUser()` pattern, `@supabase/ssr` Route Handler client setup, null-check + 401 return pattern. |
| SEC-07 | All request bodies parsed with Zod schemas. Malformed requests return `400` with machine-readable error, not 500. | `zod` `safeParse` + `error.flatten()` pattern; `req.json()` failure handling. |
| SEC-08 | Weather-engine, referee-engine trigger routes, and all public-results API endpoints have Upstash rate limiting. Expired/invalid JWT returns consistent `401`. | `@upstash/ratelimit ^2.x` + `@upstash/redis ^1.x` `slidingWindow` pattern, IP extraction from `x-forwarded-for`, `limit()` response shape, 429 with headers. |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.9.0 (current) | Server-side Supabase client with cookie handling | Official Supabase package for App Router; replaces deprecated auth-helpers |
| `@supabase/supabase-js` | 2.100.0 (current) | Supabase JS client — provides `auth.getUser()` | Required peer dependency for @supabase/ssr |
| `zod` | 4.3.6 (current) | Runtime schema validation for request bodies | Supabase-project-standard; TypeScript-first; `safeParse` never throws |
| `@upstash/ratelimit` | 2.0.8 (current) | Serverless rate limiting with Redis backend | Approved in phase scope notes; v2.x API is stable |
| `@upstash/redis` | 1.37.0 (current) | Upstash Redis REST client — backend for ratelimit | Required peer; `Redis.fromEnv()` for zero-config initialization |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/headers` (built-in) | Next.js built-in | Async `cookies()` access in Route Handlers | Required for `createServerClient` cookie reading in server context |
| `@vercel/functions` | optional | `waitUntil(pending)` for Upstash analytics | Use only if deploying to Vercel and want analytics flush before cold-start termination |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@upstash/ratelimit` | `lru-cache` in-memory | In-memory doesn't survive serverless cold starts; not viable |
| `zod.safeParse` + `flatten()` | `zod-error` package | `zod-error` adds a dep; flatten() is built-in and sufficient |
| `auth.getUser()` | `auth.getSession()` or `auth.getClaims()` | `getSession()` is insecure on server (no auth-server revalidation); never use it in Route Handlers |

**Installation (if not already present):**

```bash
npm install @supabase/ssr @supabase/supabase-js zod @upstash/ratelimit @upstash/redis
```

**Version verification (confirmed 2026-03-23):**

```
@upstash/ratelimit  2.0.8
@upstash/redis      1.37.0
zod                 4.3.6
@supabase/supabase-js 2.100.0
@supabase/ssr       0.9.0
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── supabase/
│   │   └── server.ts       # createClient() utility for Route Handlers
│   └── ratelimit.ts        # Ratelimit instances (engine, public)
├── app/
│   └── api/
│       ├── [route]/
│       │   └── route.ts    # Each Route Handler — auth + zod + optional rate limit
│       ├── join/           # PUBLIC — no auth guard (documented comment)
│       ├── checkins/       # PUBLIC — no auth guard (documented comment)
│       └── public-results/ # PUBLIC + rate-limited — no auth guard
└── schemas/
    └── [domain].ts         # Zod schemas co-located by domain, imported into routes
```

### Pattern 1: Supabase Server Client for Route Handlers

**What:** A shared async utility function that creates a `createServerClient` instance reading cookies from `next/headers`. Must be `await`-ed because `cookies()` from `next/headers` is async in Next.js 15.

**When to use:** Every Route Handler that needs to check authentication.

**Example:**

```typescript
// lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore if
            // middleware is refreshing user sessions.
          }
        },
      },
    }
  )
}
```

### Pattern 2: Auth Guard in a Write Route (SEC-02)

**What:** Call `auth.getUser()` at the top of any POST/PATCH/DELETE handler; return `401` if user is null or error is set.

**When to use:** All routes classified as "write" or "read-authenticated." Never on intentionally public routes.

**Example:**

```typescript
// app/api/some-resource/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // ... rest of handler
}
```

**For public routes — required documentation comment:**

```typescript
// app/api/join/route.ts
// PUBLIC ROUTE — intentionally excluded from auth guard per SEC-02.
// This endpoint allows unauthenticated users to join a league.
export async function POST(request: Request) { ... }
```

### Pattern 3: Zod Validation in a Route Handler (SEC-07)

**What:** Define a Zod schema for the request body, call `safeParse` (never `parse` — it throws), and return a `400` with `error.flatten()` if invalid.

**When to use:** All routes that accept a request body.

**Example:**

```typescript
// schemas/schedule.ts
import { z } from 'zod'

export const createScheduleSchema = z.object({
  leagueId: z.string().uuid(),
  startDate: z.string().datetime(),
  rounds: z.number().int().min(1).max(52),
})

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
```

```typescript
// app/api/schedules/route.ts
import { NextResponse } from 'next/server'
import { createScheduleSchema } from '@/schemas/schedule'

export async function POST(request: Request) {
  // Auth guard first (if write route)
  // ...

  // Parse body — request.json() can throw if body isn't valid JSON at all
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Zod validation — safeParse never throws
  const result = createScheduleSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.flatten() },
      { status: 400 }
    )
  }

  const { leagueId, startDate, rounds } = result.data
  // ... handler logic
}
```

**400 response shape (machine-readable):**

```json
{
  "success": false,
  "error": {
    "formErrors": [],
    "fieldErrors": {
      "leagueId": ["Invalid uuid"],
      "rounds": ["Number must be greater than or equal to 1"]
    }
  }
}
```

### Pattern 4: Rate Limiting Engine-Trigger and Public Routes (SEC-08)

**What:** Instantiate `Ratelimit` once per route (or shared), call `limit(identifier)`, return `429` with rate-limit headers if `success` is false.

**When to use:** Weather-engine routes, referee-engine routes, `/api/public-results/*`, and `/api/join`, `/api/checkins`.

**Example — shared ratelimit instances:**

```typescript
// lib/ratelimit.ts
// Source: https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// Engine trigger routes — stricter (these are internal cron/webhook callers)
export const engineRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(10, '60 s'),
  prefix: 'leagueops:engine',
  analytics: true,
})

// Public-facing routes — more generous
export const publicRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  prefix: 'leagueops:public',
  analytics: true,
})
```

```typescript
// app/api/engine/weather/route.ts
import { NextResponse } from 'next/server'
import { engineRatelimit } from '@/lib/ratelimit'

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'

  const { success, limit, remaining, pending, reset } =
    await engineRatelimit.limit(ip)

  // Flush analytics without blocking response (Vercel edge)
  // In non-Vercel: pending is a no-op promise, safe to ignore
  void pending

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

  // ... engine trigger logic
}
```

### Anti-Patterns to Avoid

- **Using `auth.getSession()` on the server:** Returns a locally-decoded JWT without verifying with the Supabase Auth server. A revoked or expired session will appear valid. Always use `getUser()`.
- **Using `schema.parse()` instead of `safeParse()`:** `parse()` throws a `ZodError` — if uncaught, it produces a 500 instead of a 400. Use `safeParse()` exclusively in Route Handlers.
- **Not awaiting `cookies()` from `next/headers`:** In Next.js 15 the `cookies()` API is async. Calling it without `await` returns a Promise instead of the cookie store, causing the Supabase client to read zero cookies and `getUser()` to return null for every request.
- **Applying rate limiting to authenticated write routes:** The Upstash free tier is 10k requests/day. Applying rate limiting to all write routes will exhaust the quota. Apply only to engine-trigger and public endpoints as specified.
- **Using a single global `Ratelimit` instance for all routes:** Instantiate `Ratelimit` outside the handler (module-level) so it is reused across invocations in the same warm function instance. Do NOT create a new `Ratelimit` inside each handler call — this resets the in-memory limiter state.
- **Trusting `x-forwarded-for` without taking only the first IP:** The header is comma-separated (client IP first, then each proxy). Always `split(',')[0].trim()` to get the actual client IP.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation and session revalidation | Custom JWT decode + expiry check | `supabase.auth.getUser()` | Requires auth-server round-trip; local decode can't detect revocation |
| Request body schema enforcement | Manual `if (!body.field)` checks | `zod.safeParse()` with typed schema | Manual checks miss type coercion, nested validation, union types, and produce inconsistent errors |
| Serverless rate limiting | In-memory Map or LRU cache | `@upstash/ratelimit` + `@upstash/redis` | In-memory state is lost on each cold start; Redis provides consistent counts across all instances |
| IP extraction from forwarded headers | Custom header parsing | `request.headers.get('x-forwarded-for')?.split(',')[0]` one-liner | Simple enough to inline; no library needed |
| 429 response headers | Custom counter tracking | Use `limit`, `remaining`, `reset` from `ratelimit.limit()` response | Upstash computes these server-side accurately |

**Key insight:** In a serverless environment, any solution that stores rate-limit state in-process is silently broken across multiple concurrent instances.

---

## Common Pitfalls

### Pitfall 1: AuthSessionMissingError in Route Handlers

**What goes wrong:** `supabase.auth.getUser()` throws `AuthSessionMissingError: Auth session missing!` even when a valid auth cookie is present in the request.

**Why it happens:** A known bug in `@supabase/ssr` (tracked in issue #107) where a background `initialize()` call in the `createServerClient` constructor races with session loading in Route Handlers. Also triggered in Next.js 14.2+/15 by calling `cookies()` without `await`.

**How to avoid:**
1. Always `await cookies()` when constructing the server client.
2. If the error persists, upgrade to `@supabase/ssr@0.9.0` which contains the fix (race condition resolved via `skipAutoInitialize`).
3. Treat `authError !== null` as equivalent to "not logged in" — catch this error gracefully and return `401` rather than letting it surface as a 500.

```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Warning signs:** 500 errors on authenticated write routes; `AuthSessionMissingError` in server logs despite browser sending a valid cookie.

### Pitfall 2: `request.json()` Throwing on Malformed JSON

**What goes wrong:** If a client sends a request with a body that is not valid JSON (e.g., empty body, garbled payload), `await request.json()` throws a `SyntaxError`. Without a try/catch, this becomes a 500.

**Why it happens:** `request.json()` is a native Web API that throws on parse failure — unlike `safeParse`, there is no "safe" variant of `request.json()`.

**How to avoid:** Always wrap `request.json()` in a try/catch separate from the Zod validation:

```typescript
let body: unknown
try {
  body = await request.json()
} catch {
  return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
}
const result = schema.safeParse(body)
```

**Warning signs:** 500 errors with `SyntaxError: Unexpected end of JSON input` in logs.

### Pitfall 3: Rate Limit Quota Exhaustion

**What goes wrong:** Applying `@upstash/ratelimit` to all API routes (including authenticated write routes) drains the Upstash free tier 10k requests/day limit, causing rate limiting to fail open (or blocking legitimate requests).

**Why it happens:** Every call to `ratelimit.limit()` counts against the Upstash Redis quota, not just blocked requests.

**How to avoid:** Apply rate limiting only to: engine-trigger routes (weather, referee engines), and public-facing routes (`/api/join`, `/api/checkins`, `/api/public-results/*`). Authenticated write routes do NOT get rate limiting in this phase.

**Warning signs:** Upstash console showing quota near/at 10k/day shortly after deployment.

### Pitfall 4: Route Categorization Done Mid-Modification

**What goes wrong:** Modifying routes as you discover them (rather than categorizing all routes first) leads to missed routes, inconsistent coverage, and regressions in routes touched twice.

**Why it happens:** Without a full inventory, the scope is invisible.

**How to avoid:** Wave 0 of this phase must produce a route inventory document listing every route file with its category (write/read/public/engine-trigger) before any code changes begin.

**Warning signs:** Auth guards missing from some POST routes; no documented exclusions for public routes.

### Pitfall 5: Supabase Environment Variable Key Name

**What goes wrong:** The Supabase anon key environment variable is referenced as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in some versions of the Supabase SSR docs, but existing projects typically use `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Why it happens:** Supabase recently rebranded the anon key as "publishable key" but many projects still use the old name.

**How to avoid:** Check the project's existing `.env.local` to confirm which name is in use before writing the `createClient()` utility. Do not assume either name — verify first.

**Warning signs:** `createClient()` crashes with `Invalid URL` or `undefined` errors at startup.

---

## Code Examples

### Complete Route Handler: Auth + Zod + (Optional Rate Limit)

```typescript
// app/api/schedules/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createScheduleSchema } from '@/schemas/schedule'

export async function POST(request: Request) {
  // 1. Auth guard (SEC-02)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse raw JSON body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // 3. Zod validation (SEC-07)
  const result = createScheduleSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.flatten() },
      { status: 400 }
    )
  }

  // 4. Business logic with typed data
  const { leagueId, startDate, rounds } = result.data
  // ...

  return NextResponse.json({ success: true }, { status: 201 })
}
```

### Complete Route Handler: Public + Rate Limited

```typescript
// app/api/public-results/[id]/route.ts
// PUBLIC ROUTE — intentionally excluded from auth guard per SEC-02.
// Rate limited per SEC-08 to prevent scraping.
import { NextResponse } from 'next/server'
import { publicRatelimit } from '@/lib/ratelimit'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Rate limit by IP (SEC-08)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  const { success, limit, remaining, reset, pending } =
    await publicRatelimit.limit(ip)
  void pending

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

  // ... fetch public results for params.id
  return NextResponse.json({ results: [] })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023–2024 | auth-helpers is deprecated; all new projects use @supabase/ssr |
| `auth.getSession()` on server | `auth.getUser()` on server | 2024 | `getSession()` is now explicitly documented as insecure on server |
| `cookies()` called synchronously | `await cookies()` | Next.js 15 | cookies() became async; sync call returns a Promise instead of CookieStore |
| `zod.parse()` in API routes | `zod.safeParse()` | Long-standing | `parse()` throws; `safeParse()` returns structured result without throwing |
| `error.format()` for Zod errors | `error.flatten()` (or `z.treeifyError()`) | Zod v4 | `error.format()` deprecated in Zod v4 in favor of `flatten()` and `treeifyError()` |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`; do not install or use.
- `auth.getSession()` in server context: Documented as insecure; always use `auth.getUser()` on the server.
- `zod.error.format()`: Deprecated in Zod v4; use `error.flatten()` for flat schemas.

---

## Open Questions

1. **Existing environment variable name for Supabase anon key**
   - What we know: Supabase docs now use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but older setups use `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - What's unclear: Which name does this project's `.env.local` use?
   - Recommendation: Wave 0 task must check `.env.local` / `.env.example` and standardize the `createClient()` utility against the actual key name in use.

2. **Existing middleware.ts session refresh**
   - What we know: `@supabase/ssr` auth works correctly only when middleware refreshes tokens before Route Handlers run
   - What's unclear: Does the project already have a `middleware.ts` with `updateSession` from Phase 2?
   - Recommendation: Verify middleware.ts exists and calls `supabase.auth.getClaims()` (or the `updateSession` helper from @supabase/ssr docs) before implementing Route Handler auth guards.

3. **Upstash Redis credentials availability**
   - What we know: `Redis.fromEnv()` requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the environment
   - What's unclear: Whether these credentials are already provisioned for the project
   - Recommendation: Wave 0 must verify these env vars exist; if not, create the Upstash Redis database first (free tier is sufficient for this phase's scope).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All — runtime | Yes | v24.14.0 | — |
| npm | Package install | Yes | 11.9.0 | — |
| `@upstash/ratelimit` | SEC-08 | To install | — | None — must install |
| `@upstash/redis` | SEC-08 | To install | — | None — must install |
| Upstash Redis REST API | SEC-08 runtime | Unknown | — | No fallback — must provision if absent |
| `@supabase/ssr` | SEC-02 | To install (if not from Phase 2) | — | None — must install |
| `zod` | SEC-07 | To install (if not present) | — | None — must install |

**Missing dependencies with no fallback:**
- Upstash Redis database credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) — must be created in Upstash Console before rate limiting tasks run.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

The phase has no existing test infrastructure discovered (no test config files in the working directory). Wave 0 must establish the baseline.

| Property | Value |
|----------|-------|
| Framework | Vitest (recommended for Next.js App Router) or Jest |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-02 | Unauthenticated POST returns 401 | unit (mock Supabase) | `npx vitest run tests/api/auth-guard.test.ts` | Wave 0 gap |
| SEC-02 | Public routes return 2xx without auth header | unit | `npx vitest run tests/api/public-routes.test.ts` | Wave 0 gap |
| SEC-07 | Malformed body returns 400 with `fieldErrors` | unit | `npx vitest run tests/api/zod-validation.test.ts` | Wave 0 gap |
| SEC-07 | Valid body returns 2xx (no validation error) | unit | `npx vitest run tests/api/zod-validation.test.ts` | Wave 0 gap |
| SEC-08 | Rate-limited route returns 429 after N requests | integration (mock Redis) | `npx vitest run tests/api/rate-limit.test.ts` | Wave 0 gap |
| SEC-08 | 429 response includes X-RateLimit-* headers | integration | `npx vitest run tests/api/rate-limit.test.ts` | Wave 0 gap |
| SEC-08 | Expired JWT returns 401 (not empty/silent) | unit | `npx vitest run tests/api/auth-guard.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/api/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/api/auth-guard.test.ts` — covers SEC-02 (401 for unauthenticated, 401 for expired JWT)
- [ ] `tests/api/public-routes.test.ts` — covers SEC-02 exclusion of public routes
- [ ] `tests/api/zod-validation.test.ts` — covers SEC-07 (400 with fieldErrors, 2xx for valid body)
- [ ] `tests/api/rate-limit.test.ts` — covers SEC-08 (429 after limit, correct headers)
- [ ] `tests/setup.ts` — mock for `@supabase/ssr` `createServerClient` and `@upstash/redis`
- [ ] `vitest.config.ts` — test framework configuration

---

## Sources

### Primary (HIGH confidence)

- [Supabase: Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — createClient pattern, middleware, getUser()
- [Supabase: JavaScript auth.getUser() reference](https://supabase.com/docs/reference/javascript/auth-getuser) — return shape, never-throws behavior, getUser vs getSession distinction
- [Upstash Ratelimit Getting Started](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted) — constructor, Redis.fromEnv(), slidingWindow, limit() response
- [Upstash ratelimit-js GitHub examples/nextjs](https://github.com/upstash/ratelimit-js/tree/main/examples/nextjs) — Route Handler code pattern, waitUntil(pending)
- [Zod error formatting docs](https://zod.dev/error-formatting) — flatten() vs format() (deprecated), FlattenedError shape
- npm registry (verified 2026-03-23) — all package versions confirmed

### Secondary (MEDIUM confidence)

- [Supabase SSR issue #107](https://github.com/supabase/ssr/issues/107) — AuthSessionMissingError root cause (race condition in initialize()) and fix in 0.9.0
- [Dub.co: Using Zod with Next.js API validation](https://dub.co/blog/zod-api-validation) — safeParse pattern in App Router route handlers
- [Upstash blog: Rate Limiting Next.js API Routes](https://upstash.com/blog/nextjs-ratelimiting) — X-RateLimit headers pattern, 429 response

### Tertiary (LOW confidence)

- Various community search results on IP extraction patterns (`x-forwarded-for`) — cross-verified with Upstash official examples

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-03-23
- Architecture patterns: HIGH — verified against official Supabase SSR docs and Upstash ratelimit-js docs
- Pitfalls: HIGH — AuthSessionMissingError verified against open GitHub issue; others verified through official docs
- Validation architecture: MEDIUM — test framework recommendation is standard for Next.js but no existing test config was found to confirm

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (Supabase and Upstash APIs are stable; Zod v4 newly released — watch for error API changes if upgrading beyond 4.3.x)
