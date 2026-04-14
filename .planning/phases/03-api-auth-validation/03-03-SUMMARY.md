---
phase: 03-api-auth-validation
plan: '03'
subsystem: api-rate-limiting
tags: [security, rate-limiting, upstash, redis, sec-08]
dependency_graph:
  requires: [03-01]
  provides: [SEC-08]
  affects:
    [
      field-engine,
      referee-engine,
      schedule-engine,
      shift-handoff,
      unified-engine,
      weather-engine,
      join,
      checkins,
      auth/check-email,
    ]
tech_stack:
  added: []
  patterns: [upstash-ratelimit, fixed-window, sliding-window, x-ratelimit-headers]
key_files:
  created: []
  modified:
    - app/api/field-engine/route.ts
    - app/api/referee-engine/route.ts
    - app/api/schedule-engine/route.ts
    - app/api/shift-handoff/route.ts
    - app/api/unified-engine/route.ts
    - app/api/weather-engine/route.ts
    - app/api/join/route.ts
    - app/api/checkins/route.ts
    - app/api/auth/check-email/route.ts
decisions:
  - 'Engine-trigger route GET handlers excluded from rate limiting — only POST triggers expensive engine operations; GET serves cached data reads'
  - 'checkins DELETE handler gets rate limiting — although destructive, it is a public route with no auth guard and must be protected'
  - 'publicRatelimit shared across all 3 public routes — sliding window allows burst tolerance for real event-day usage'
metrics:
  duration: '2 min'
  completed_date: '2026-03-23'
  tasks_completed: 2
  files_modified: 9
---

# Phase 03 Plan 03: Rate Limiting (SEC-08) Summary

**One-liner:** Upstash rate limiting applied to 6 engine-trigger routes (10 req/60s fixed) and 3 public routes (30 req/60s sliding) with standard X-RateLimit-\* headers on all 429 responses.

## Tasks Completed

| Task | Name                                       | Commit  | Files                                                                                        |
| ---- | ------------------------------------------ | ------- | -------------------------------------------------------------------------------------------- |
| 1    | Add rate limiting to engine-trigger routes | 2eb94db | field-engine, referee-engine, schedule-engine, shift-handoff, unified-engine, weather-engine |
| 2    | Add rate limiting to public-facing routes  | 8c7b598 | join, checkins, auth/check-email                                                             |

## What Was Built

### Engine-Trigger Rate Limiting (Task 1)

All 6 engine-trigger POST handlers now call `engineRatelimit.limit(ip)` before any other logic:

- `app/api/field-engine/route.ts` — POST handler
- `app/api/referee-engine/route.ts` — POST handler
- `app/api/schedule-engine/route.ts` — POST handler
- `app/api/shift-handoff/route.ts` — POST handler
- `app/api/unified-engine/route.ts` — POST handler
- `app/api/weather-engine/route.ts` — POST handler

Each uses `engineRatelimit` from `lib/ratelimit.ts` (10 req/60s fixed window). Rate limit check is placed before auth guard and body parsing — cheapest rejection path.

### Public Route Rate Limiting (Task 2)

All 3 public routes and all their handlers now call `publicRatelimit.limit(ip)`:

- `app/api/join/route.ts` — GET and POST handlers
- `app/api/checkins/route.ts` — GET, POST, and DELETE handlers
- `app/api/auth/check-email/route.ts` — POST handler

Each uses `publicRatelimit` from `lib/ratelimit.ts` (30 req/60s sliding window). SEC-02 documentation comments added to each public route file.

### 429 Response Pattern

All rate-limited routes return the same pattern on limit exceeded:

```typescript
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
```

IP extraction uses `x-forwarded-for` header (first IP only, trimmed), falling back to `'127.0.0.1'`.

### Scope Boundaries

- Write routes: 0 rate limiting (preserves Upstash free quota)
- Read-authenticated routes: 0 rate limiting (same reason)
- Engine-trigger GET handlers: 0 rate limiting (GET serves cached reads, not engine triggers)

## Verification

```
engineRatelimit files: 6  (matches 6 engine-trigger route files)
publicRatelimit files:  3  (matches 3 public route files)
X-RateLimit-Limit in:  9 files
429 status in:         9 files
Ratelimit in write/read-auth routes: 0 (CLEAN)
```

## Deviations from Plan

None — plan executed exactly as written.

Note: ROUTE-INVENTORY.md shows a summary count of 7 engine-trigger routes but the table contains 6 distinct engine-trigger route files. The 6-file count matches the actual files and all were rate-limited. The inventory summary count appears to be a minor discrepancy in the planning document.

## Known Stubs

None — all rate limiting is fully wired to the live `engineRatelimit` and `publicRatelimit` instances from `lib/ratelimit.ts`. The Upstash Redis connection requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables to be set in Vercel (documented in plan frontmatter under `user_setup`).

## Self-Check: PASSED

Files exist:

- app/api/field-engine/route.ts: FOUND
- app/api/referee-engine/route.ts: FOUND
- app/api/schedule-engine/route.ts: FOUND
- app/api/shift-handoff/route.ts: FOUND
- app/api/unified-engine/route.ts: FOUND
- app/api/weather-engine/route.ts: FOUND
- app/api/join/route.ts: FOUND
- app/api/checkins/route.ts: FOUND
- app/api/auth/check-email/route.ts: FOUND

Commits exist:

- 2eb94db: FOUND (engine-trigger rate limiting)
- 8c7b598: FOUND (public route rate limiting)
