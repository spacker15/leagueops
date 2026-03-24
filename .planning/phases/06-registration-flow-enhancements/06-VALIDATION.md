---
phase: 6
slug: registration-flow-enhancements
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-23
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 06-01-01 | 01 | 1 | REG-06, REG-07 | structural | `grep + type-check` | ⬜ pending |
| 06-01-02 | 01 | 1 | REG-06, REG-07 | unit | `npx vitest run __tests__/lib/engines/coach-conflicts.test.ts` | ⬜ pending |
| 06-02-01 | 02 | 2 | REG-01 | structural | `grep + type-check` | ⬜ pending |
| 06-03-01 | 03 | 2 | REG-02, REG-03, REG-08 | structural | `grep + type-check + lint` | ⬜ pending |
| 06-04-01 | 04 | 2 | REG-04, REG-05 | structural | `grep + type-check` | ⬜ pending |
| 06-04-02 | 04 | 2 | REG-04, REG-05 | structural | `grep + type-check` | ⬜ pending |
| 06-05-01 | 05 | 3 | REG-04 | structural | `grep + type-check + lint` | ⬜ pending |
| 06-05-02 | 05 | 3 | REG-01, REG-07 | structural | `grep + type-check` | ⬜ pending |
| 06-05-03 | 05 | 3 | REG-06 | structural | `grep + type-check` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Nyquist Rationale

The coach-conflicts engine (06-01-02) has dedicated unit tests providing behavioral coverage for the core business logic (REG-06, REG-07). All UI tasks use structural verification (grep for expected patterns + type-check) which is appropriate for component modifications — these are not pure-function candidates for unit tests. Lint checks are added to the largest component modification tasks (06-03, 06-05-01) to catch ESLint errors that break Vercel deploys.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Registration wizard blocks access outside window | REG-01 | UI visual state | Navigate to /e/[slug]/register when closed, verify info page shown |
| QR code renders correctly for coach invite | REG-05 | Visual rendering | Generate invite link, verify QR is black-on-white and scannable |
| Coach conflict badge in Command Center | REG-06 | UI visual indicator | Add same coach to 2 teams, verify badge appears on both team rows |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Behavioral coverage via coach-conflicts unit tests; structural coverage via grep + type-check for UI
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
