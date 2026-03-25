---
phase: 10
slug: responsive-design-notification-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value            |
| ---------------------- | ---------------- |
| **Framework**          | vitest 4.1.0     |
| **Config file**        | vitest.config.ts |
| **Quick run command**  | `npm run test`   |
| **Full suite command** | `npm run test`   |
| **Estimated runtime**  | ~15 seconds      |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                     | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ----------------------------------------------------- | ----------- | ---------- |
| 10-01-01 | 01   | 1    | MOB-04      | manual    | Visual: hamburger menu on 375px                       | N/A         | ⬜ pending |
| 10-01-02 | 01   | 1    | MOB-02      | manual    | Visual: bottom drawer on mobile                       | N/A         | ⬜ pending |
| 10-02-01 | 02   | 1    | MOB-01      | manual    | Visual: no horizontal scroll at 375px                 | N/A         | ⬜ pending |
| 10-02-02 | 02   | 1    | MOB-03      | unit      | `npm run test -- --grep TouchSensor`                  | ❌ W0       | ⬜ pending |
| 10-03-01 | 03   | 2    | NOT-02      | unit      | `npm run test -- --grep weather-notification`         | ❌ W0       | ⬜ pending |
| 10-03-02 | 03   | 2    | NOT-03      | unit      | `npm run test -- --grep schedule-change-notification` | ❌ W0       | ⬜ pending |
| 10-03-03 | 03   | 2    | NOT-04      | unit      | `npm run test -- --grep admin-alert-notification`     | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `__tests__/lib/engines/weather-notifications.test.ts` — stubs for NOT-02 weather alert → notification_queue
- [ ] `__tests__/api/schedule-change-notifications.test.ts` — stubs for NOT-03 verification
- [ ] `__tests__/api/admin-alert-notifications.test.ts` — stubs for NOT-04 referee no-show + deadline

_Existing vitest infrastructure covers test execution needs._

---

## Manual-Only Verifications

| Behavior                      | Requirement | Why Manual              | Test Instructions                                               |
| ----------------------------- | ----------- | ----------------------- | --------------------------------------------------------------- |
| Hamburger menu on mobile      | MOB-04      | Visual/interaction test | Resize browser to 375px, verify hamburger appears, drawer opens |
| Bottom drawer for RightPanel  | MOB-02      | Visual/interaction test | Resize to <1024px, tap FAB, verify drawer slides up             |
| No horizontal scroll at 375px | MOB-01      | Visual layout test      | Check Dashboard, Schedule, CheckIn at 375px width               |
| Touch drag-drop refs          | MOB-03      | Touch device test       | Use iOS Safari or Chrome Android, verify drag-drop works        |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
