---
phase: 2
reviewers: [claude-cli]
reviewed_at: 2026-03-22T00:00:00Z
plans_reviewed: [02-00-PLAN.md, 02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 2

## Claude CLI Review (Separate Session)

### 1. Summary Assessment

The plans are well-structured and represent solid engineering discipline. The layer-by-layer approach (engines -> API routes -> store -> components) is dependency-safe, the TDD scaffolding in Plan 00 is a clear highlight, and the decision log (CONTEXT.md) is thorough. The phase has a realistic scope and clear acceptance criteria. However, there are several correctness issues -- one UX-breaking contradiction, one Next.js pitfall, and an excessive realtime reconnect pattern -- that should be addressed before execution.

### 2. Strengths

- Wave sequencing is correct -- engine changes (01) -> API routes (02) -> store (03) -> components (04) respects call-graph order
- TDD via `test.fails()` in Plan 00 is well-executed -- creates failing tests before fixing the store
- Per-event rules cache (`_cacheByEvent`) is a genuine correctness fix beyond simple s/1/eventId
- Explicit carve-outs for public routes (`join/`, `check-email/`) show attention to routes that must not require event_id
- Decision log (D-01 through D-06) is clear and consistently referenced across all plans
- Plan 04 `autonomous: false` with a human-verify gate on the final sweep is appropriate
- Portal pattern (using `userRole.event_id`) was verified against actual `UserRole` interface

### 3. Concerns

#### HIGH -- AppShell null guard contradicts D-01

Plan 04, Task 2 says to add `if (!eventId) return null` to `components/AppShell.tsx`. D-01 states: "The app shell stays visible while individual tab content waits." Returning null from AppShell would blank the entire UI. AppShell should NOT get a null guard -- it should only replace `?? 1` with `eventId` and pass it down.

#### HIGH -- useSearchParams() in RegisterPage requires Suspense boundary

Plan 04, Task 1 adds `useSearchParams()` to RegisterPage. In Next.js 14 App Router, `useSearchParams()` inside a Client Component requires a `<Suspense>` boundary or the build will fail / throw at runtime.

Fix: Wrap `<RegisterPage />` in `<Suspense fallback={null}>` or add boundary inside RegisterPage itself.

#### MEDIUM -- Realtime reconnects on every date change (Plan 03)

Plan 03, Fix 4 sets realtime useEffect dep array to `[eventId, currentDate]`. Every date tab switch tears down and recreates the Supabase channel -- a reconnect storm on tournament day.

Fix: Use a `currentDateRef` pattern -- `useRef(currentDate)` synced in a separate effect -- so the games callback reads the ref instead of the state. Realtime effect dep array becomes `[eventId]` only.

#### MEDIUM -- Rules cache has no eviction; invalidateRulesCache is never called

Plan 01 adds `invalidateRulesCache()` but no plan calls it. The per-event Map accumulates indefinitely. Also, CACHE_TTL_MS = 30_000 is new behavior -- rules changes could be silently ignored for 30 seconds.

Fix: Call `invalidateRulesCache(eventId)` when rules are mutated via the rules API route POST/PUT.

#### MEDIUM -- games/route.ts and payment routes absent from Plan 02

Plan 02 covers 20 routes but does not include `games/route.ts`, `games/[id]/route.ts`, `players/route.ts`, `checkins/route.ts`, `assignments/route.ts`, or `payments/` subtree. If any have hardcodes, they will be missed.

Fix: Explicitly verify these routes are clean or add them to Plan 02.

#### LOW -- Final sweep grep has false positive/negative risks

The grep pattern `event_id.*: 1` may miss `event_id=1` in URL strings and match non-event defaults like score calculations.

Fix: Use tighter grep pattern scoped to known variable name patterns.

#### LOW -- triggerLightning/liftLightning dep array fix is under-specified

Plan 03 Fixes 7/8 say "add eventId" but don't audit the full dep arrays. Other missing deps would leave callbacks half-fixed.

Fix: Require executor to enumerate ALL dependencies, not just add eventId.

### 4. Suggestions

1. Add a Suspense boundary task to Plan 04 for RegisterPage useSearchParams
2. Separate AppShell from the null-guard pattern -- it passes eventId down but does not return null
3. Wire invalidateRulesCache to the rules mutation route in Plan 02
4. Use currentDateRef in the realtime effect to avoid reconnect storm
5. Add games/route.ts to Plan 02 scope or explicitly exclude with verification
6. Tighten the final sweep grep pattern

### 5. Risk Assessment: MEDIUM

The two HIGH concerns are straightforward to fix. The MEDIUM concerns (reconnect storm, cache eviction) are behavioral regressions that would surface in production under load. The overall architecture is sound; issues are localized and correctable.

---

## Gemini Review

Gemini CLI available but GEMINI_API_KEY not configured. Review skipped.

---

## Codex Review

Codex CLI not installed. Review skipped.

---

## Consensus Summary

### Agreed Strengths

- Wave sequencing and dependency graph are correct
- TDD scaffold approach (test.fails -> passing tests) is well-designed
- Per-event rules cache fixes a real correctness bug
- Decision traceability (D-01 through D-06) is thorough

### Agreed Concerns (Priority Order)

1. **HIGH: AppShell null guard contradicts D-01** -- would blank entire UI during loading
2. **HIGH: RegisterPage needs Suspense boundary** -- Next.js 14 hard requirement for useSearchParams
3. **MEDIUM: Realtime reconnect storm on date change** -- currentDateRef pattern recommended
4. **MEDIUM: Rules cache eviction gap** -- invalidateRulesCache never called
5. **MEDIUM: Missing route verification** -- games/players/assignments/payments routes not checked

### Divergent Views

Only one reviewer available -- no divergent views to compare. Recommend configuring GEMINI_API_KEY for multi-model adversarial review in future phases.
