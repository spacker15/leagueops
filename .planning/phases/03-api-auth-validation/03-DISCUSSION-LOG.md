# Phase 3: API Auth & Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 03-api-auth-validation
**Areas discussed:** Auth guard pattern, Zod schema organization, Rate limiting strategy, Error response format

---

## Auth Guard Pattern

### Q1: How should auth checks be applied across 40+ routes?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared helper function | A single `requireAuth()` helper in lib/ that routes call at the top. Returns user or throws 401. | ✓ |
| Next.js middleware | Use middleware.ts to intercept all /api/* requests. Must maintain public-routes allowlist. | |
| Inline per-route | Each route calls auth.getUser() directly. Most explicit but repetitive. | |

**User's choice:** Shared helper function
**Notes:** None

### Q2: How should public routes be documented as intentionally unprotected?

| Option | Description | Selected |
|--------|-------------|----------|
| Comment + exported constant | A PUBLIC_ROUTES array exported from auth helper. Single source of truth. | ✓ |
| Comment-only in each route | Each public route gets a comment. No centralized list. | |
| You decide | Claude picks the approach. | |

**User's choice:** Comment + exported constant
**Notes:** None

### Q3: Should the auth helper also check role-based access?

| Option | Description | Selected |
|--------|-------------|----------|
| Auth only | Helper just verifies user is logged in. Role checks stay in individual routes. | ✓ |
| Auth + optional role param | requireAuth({ role: 'admin' }) — optionally checks role via user_roles table. | |
| You decide | Claude picks based on route analysis. | |

**User's choice:** Auth only
**Notes:** None

### Q4: How should expired/invalid JWTs be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| 401 with clear error code | Return { error: 'unauthorized', message: 'Session expired or invalid' } with 401. | ✓ |
| Redirect to login | Return 401 with redirect hint in response body. | |
| You decide | Claude picks cleanest approach. | |

**User's choice:** 401 with clear error code
**Notes:** None

---

## Zod Schema Organization

### Q1: Where should Zod validation schemas live?

| Option | Description | Selected |
|--------|-------------|----------|
| Single shared file | lib/validations.ts — all schemas in one file, exported by name. | ✓ |
| Co-located with routes | Each route folder gets a schema.ts file. | |
| Grouped by domain | lib/validations/games.ts, lib/validations/fields.ts, etc. | |

**User's choice:** Single shared file
**Notes:** None

### Q2: How granular should validation be?

| Option | Description | Selected |
|--------|-------------|----------|
| Full body validation | Every POST/PATCH body gets a Zod schema, even simple ones. | ✓ |
| Complex routes only | Only validate routes with 3+ fields or nested objects. | |
| You decide | Claude picks based on route complexity. | |

**User's choice:** Full body validation
**Notes:** None

### Q3: Should GET routes validate query parameters with Zod?

| Option | Description | Selected |
|--------|-------------|----------|
| Bodies only | Zod for POST/PATCH/DELETE bodies. GET params keep manual checks. | ✓ |
| All methods | Also validate GET query params with Zod. | |
| You decide | Claude picks based on safety value. | |

**User's choice:** Bodies only
**Notes:** None

---

## Rate Limiting Strategy

### Q1: Which endpoints should get rate limiting?

| Option | Description | Selected |
|--------|-------------|----------|
| Engine triggers + public only | Rate limit engine and public routes. Authenticated write routes skip. | ✓ |
| All public + engine + high-write | Above plus high-frequency write routes. | |
| You decide | Claude picks minimal set. | |

**User's choice:** Engine triggers + public only
**Notes:** None

### Q2: What rate limit thresholds?

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative defaults | Engine: 10 req/min per IP. Public: 30 req/min per IP. | ✓ |
| Aggressive | Engine: 5 req/min. Public: 15 req/min. | |
| You decide | Claude picks based on traffic patterns. | |

**User's choice:** Conservative defaults
**Notes:** None

### Q3: How should rate-limited requests be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| 429 + Retry-After header | Standard 429 with Retry-After header and JSON error body. | ✓ |
| 429 + backoff guidance | Same plus remaining quota in response. | |
| You decide | Claude picks simplest standard approach. | |

**User's choice:** 429 + Retry-After header
**Notes:** None

---

## Error Response Format

### Q1: Standard error JSON shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple { error, message } | Machine-readable error code + human message. Matches existing patterns. | ✓ |
| Structured with code + details | { code: 'AUTH_EXPIRED', status: 401, message, details }. More structured. | |
| You decide | Claude picks closest to current patterns. | |

**User's choice:** Simple { error, message }
**Notes:** None

### Q2: Should Zod failures include field-level error details?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include field details | 400 with details array of { field, message }. Helpful for debugging. | ✓ |
| Generic message only | 400 with just error message. Simpler but harder to debug. | |
| You decide | Claude picks most useful for frontend. | |

**User's choice:** Yes, include field details
**Notes:** None

---

## Claude's Discretion

- Route categorization order (write, read, public, engine-trigger)
- Exact helper function signature and error handling internals
- Whether to batch small route changes or handle one-by-one
- Upstash Redis configuration details
- Zod schema naming conventions

## Deferred Ideas

None — discussion stayed within phase scope.
