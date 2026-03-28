---
phase: 8
slug: schedule-change-request-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest                              |
| **Config file**        | vitest.config.ts                    |
| **Quick run command**  | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime**  | ~15 seconds                         |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement    | Test Type | Automated Command | File Exists | Status     |
| -------- | ---- | ---- | -------------- | --------- | ----------------- | ----------- | ---------- |
| 08-01-01 | 01   | 1    | SCR-01, SCR-02 | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |
| 08-02-01 | 02   | 1    | SCR-03, SCR-08 | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |
| 08-03-01 | 03   | 2    | SCR-04, SCR-05 | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |
| 08-04-01 | 04   | 2    | SCR-06         | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |
| 08-05-01 | 05   | 3    | SCR-07         | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `__tests__/engines/schedule-change.test.ts` — stubs for slot suggestion engine (SCR-04, SCR-05)
- [ ] `__tests__/api/schedule-change-requests.test.ts` — stubs for API route state machine (SCR-08)
- [ ] `__tests__/engines/schedule-change-rpc.test.ts` — stubs for atomic reschedule RPC (SCR-06)

---

## Manual-Only Verifications

| Behavior                                        | Requirement | Why Manual     | Test Instructions                                                             |
| ----------------------------------------------- | ----------- | -------------- | ----------------------------------------------------------------------------- |
| ScheduleChangeRequestModal opens from game card | SCR-01      | UI interaction | Click "Request Change" on game card, verify modal opens with game pre-checked |
| Admin slot selection and confirm flow           | SCR-05      | UI interaction | Approve request, verify slot list renders, select slot, confirm reschedule    |
| Notification delivery to affected teams         | SCR-07      | End-to-end     | Reschedule game, verify notification_queue entries for both teams             |
| Cancelled game styling in schedule              | SCR-03      | Visual         | Cancel game, verify strikethrough/muted styling in ScheduleTab                |

_Manual verifications cover UI interactions that require browser context._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
