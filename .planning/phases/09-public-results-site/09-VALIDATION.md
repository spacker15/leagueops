---
phase: 9
slug: public-results-site
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| **Framework**          | vitest (existing in monorepo)                                      |
| **Config file**        | `apps/public-results/vitest.config.ts` or "none — Wave 0 installs" |
| **Quick run command**  | `cd apps/public-results && npx vitest run --reporter=verbose`      |
| **Full suite command** | `cd apps/public-results && npx vitest run`                         |
| **Estimated runtime**  | ~15 seconds                                                        |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/public-results && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd apps/public-results && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type   | Automated Command | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ----------- | ----------------- | ----------- | ---------- |
| TBD     | TBD  | TBD  | PUB-01      | integration | `vitest run`      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PUB-02      | unit        | `vitest run`      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PUB-03      | unit        | `vitest run`      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PUB-04      | unit        | `vitest run`      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PUB-05      | unit        | `vitest run`      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PUB-06      | unit        | `vitest run`      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PUB-07      | integration | `vitest run`      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PUB-08      | security    | `vitest run`      | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/public-results/vitest.config.ts` — vitest configuration
- [ ] `apps/public-results/src/__tests__/` — test directory structure
- [ ] Test stubs for each PUB requirement

_Planner will populate exact task IDs and test files after plan creation._

---

## Manual-Only Verifications

| Behavior                  | Requirement   | Why Manual               | Test Instructions                                            |
| ------------------------- | ------------- | ------------------------ | ------------------------------------------------------------ |
| Mobile bracket pinch-zoom | PUB-04 (D-10) | Requires touch device    | Open bracket on phone, verify pinch-zoom works               |
| QR code scannability      | PUB-05        | Physical QR scanning     | Print QR code, scan with phone camera, verify URL            |
| Score animation visual    | PUB-07 (D-13) | Visual animation quality | Trigger score update, verify green flash + number transition |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
