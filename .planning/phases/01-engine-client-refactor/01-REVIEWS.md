---
phase: 1
reviewers: [claude-self-review]
reviewed_at: 2026-03-22T19:45:00Z
plans_reviewed: [01-PLAN-A.md, 01-PLAN-B.md, 01-PLAN-C.md, 01-PLAN-D.md]
note: Gemini review unavailable (free tier daily quota exhausted). Self-review performed as fallback.
---

# Cross-AI Plan Review — Phase 1

## Claude Self-Review

### 1. Summary

Phase 1 plans are well-structured and comprehensive. The 4-plan decomposition (core refactor, API routes, client migration, tests) follows a logical dependency chain. The research phase correctly identified the critical `unified.ts` architectural issue (relative-URL `fetch` calls that only work in browser) and the unexpected `CommandCenter.tsx` client-side engine imports. Task-level acceptance criteria are specific and testable. The wave structure (A+B parallel in wave 1, C+D parallel in wave 2) maximizes parallelism while respecting dependencies. Overall, this is a solid, executable plan set.

### 2. Strengths

- **Dependency-safe ordering**: `rules.ts` first (since `field.ts` depends on it), `unified.ts` last (depends on all sub-engines) — prevents cascading type errors during implementation
- **Bug fix correctly scoped**: The field-engine resolved bug (`type === 'all' ? false : false`) is fixed in Plan A alongside the file it lives in, with a clear code-level fix showing the conditional filter pattern
- **Plan B Task 5 (new API routes)** can start immediately — no dependency on Plan A completing, since new files don't conflict
- **Mock pattern in Plan D** is practical — chainable mock builder covers Supabase's fluent API without over-engineering
- **SEC-06 coverage is thorough**: OpenWeather key migration handled in Plan A Task 4 with a verification grep in Task 7
- **Explicit "do not touch" boundaries** prevent scope creep (e.g., "leave hardcoded event_id values for Phase 2")
- **Every task has `read_first`** references — executor won't start blind

### 3. Concerns

- **HIGH — Plan A + B wave 1 parallelism is fragile**: Plan B says it runs in parallel with Plan A, but Plan B Tasks 1-4 depend on Plan A's signature changes being complete. The Plan B context note acknowledges this ("do not begin until Plan A is complete OR coordinate together"), but this contradicts the `wave: 1` / `depends_on: []` frontmatter. If two agents execute simultaneously, Plan B Tasks 1-4 will hit type errors. **Recommendation**: Either change Plan B to `wave: 2, depends_on: ["A"]`, or split Plan B into two sub-plans — Task 5 (new routes, truly parallel) vs Tasks 1-4 (depends on A).

- **MEDIUM — `unified.ts` restructuring scope is underestimated**: The research found that `unified.ts` uses `fetch('/api/referee-engine')` internally. Plan A Task 6 must replace these with direct function calls, which means `unified.ts` now imports and calls `runRefereeEngine`, `runFieldConflictEngine`, `runWeatherEngine` directly. This is a significant architectural change — it converts `unified.ts` from an HTTP orchestrator to a direct function orchestrator. The task instructions should explicitly address: (a) removing the `fetch` calls, (b) importing sub-engine functions, (c) passing `sb` through to each, (d) handling the different response shape (direct return vs `Response.json()`).

- **MEDIUM — Plan B new API routes lack error handling specification**: Tasks for the 3 new routes (`/api/unified-engine`, `/api/unified-engine/resolve`, `/api/shift-handoff`) don't specify error response format. Existing routes likely return `{ error: string }` with appropriate status codes — new routes should match.

- **MEDIUM — `createClient()` from `@/supabase/server` may require `cookies()`**: The research didn't clarify whether `createClient` from `supabase/server.ts` is a simple function or requires Next.js `cookies()` import. If it uses the `@supabase/ssr` pattern with `cookies()`, the engine functions receive a request-scoped client that can't be reused across async boundaries. Plan tasks should note this.

- **LOW — Plan D mock pattern doesn't cover `.then()` correctly**: The `makeMockSb` helper has `chain['then']` that resolves the result directly, but Supabase queries resolve differently depending on whether `.single()` is called. Tests that mock queries returning arrays need `chain['then']` to resolve `{ data: [...], error: null }` without `.single()`. The mock should handle both paths.

- **LOW — No integration test**: All Plan D tests are unit tests with mocked Supabase. There's no test verifying that the actual API routes correctly create a server client and pass it to engines. A single smoke test (API route → engine → mocked DB) would catch wiring errors.

- **LOW — Rules engine cache comment is insufficient**: Plan A Task 1 adds a TODO comment about cache keying. But the `_cache` variable is module-level — in a serverless environment (Vercel), this cache is per-invocation anyway (cold start = empty cache). The comment may create unnecessary future work. Consider noting that serverless context means the cache is effectively request-scoped.

### 4. Suggestions

- **Split Plan B into B1 (Task 5 only, wave 1) and B2 (Tasks 1-4, wave 2, depends on A)** to eliminate the fragile parallelism concern. This is the highest-impact change.
- **Expand Plan A Task 6 (unified.ts)** with explicit sub-steps for replacing `fetch('/api/...')` calls with direct function imports. This is the most complex single task.
- **Add error response format to Plan B Task 5** — specify `return NextResponse.json({ error: message }, { status: 4xx })` pattern matching existing routes.
- **Add one integration test in Plan D** — a test that imports an API route handler, mocks only the Supabase client creation, and verifies the handler passes the client to the engine function.
- **Verify `supabase/server.ts` client creation pattern** before starting — if it requires `cookies()`, document the pattern in Plan A Task 1 so all subsequent tasks follow it consistently.

### 5. Risk Assessment

**Overall Risk: LOW**

This is a well-scoped refactoring phase with no schema changes, no new UI, and clear boundaries. The biggest risk is the `unified.ts` restructuring (replacing `fetch` with direct calls), which is more than a simple parameter injection — but the research correctly identified this, and the plan addresses it. The wave 1 parallelism issue (Plan A + B) is a process risk, not a technical risk — it's easily mitigated by adjusting the wave assignments. All acceptance criteria are testable, and the `npm run type-check` gate after each task provides a safety net against signature mismatches.

---

## Consensus Summary

### Agreed Strengths
- Dependency-safe engine ordering (rules → referee → field → weather → eligibility → unified)
- Clear acceptance criteria with type-check gates
- Field-engine bug fix correctly scoped alongside the refactor
- SEC-06 (OpenWeather key) thoroughly addressed with verification grep

### Agreed Concerns
- Plan A + B wave 1 parallelism needs clarification — Tasks 1-4 of Plan B depend on Plan A
- `unified.ts` restructuring is the most complex task and needs more detailed sub-steps
- New API routes in Plan B Task 5 should specify error handling patterns

### Divergent Views
- N/A (single reviewer — cross-AI review will be available when Gemini quota resets)

---
*Review conducted: 2026-03-22*
*Gemini cross-AI review pending: free tier quota exhausted — retry tomorrow*
