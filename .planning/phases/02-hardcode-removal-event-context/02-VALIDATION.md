---
phase: 2
slug: hardcode-removal-event-context
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value              |
| ---------------------- | ------------------ |
| **Framework**          | vitest             |
| **Config file**        | `vitest.config.ts` |
| **Quick run command**  | `npm run test`     |
| **Full suite command** | `npm run test`     |
| **Estimated runtime**  | ~15 seconds        |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement    | Test Type | Automated Command                                         | File Exists | Status     |
| -------- | ---- | ---- | -------------- | --------- | --------------------------------------------------------- | ----------- | ---------- |
| 02-00-01 | 00   | 0    | SEC-04, SEC-05 | scaffold  | `test -f __tests__/lib/store.test.tsx`                    | W0 creates  | ⬜ pending |
| 02-01-01 | 01   | 1    | SEC-04         | grep      | `grep -rn "event_id = 1\|eventId = 1\|?? 1" lib/engines/` | N/A         | ⬜ pending |
| 02-02-01 | 02   | 2    | SEC-04         | grep      | `grep -rn "event_id = 1\|eventId = 1\|?? 1" app/api/`     | N/A         | ⬜ pending |
| 02-03-01 | 03   | 2    | SEC-05         | unit      | `npm run test -- __tests__/lib/store.test.tsx`            | ✅ W0       | ⬜ pending |
| 02-04-01 | 04   | 3    | SEC-04         | grep      | `grep -rn "event_id = 1\|eventId = 1\|?? 1" components/`  | N/A         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- **02-00-PLAN.md** (Wave 0): Creates `__tests__/lib/store.test.tsx` with behavioral tests for SEC-04 (loadAll re-fires on eventId change) and SEC-05 (realtime filter and channel teardown). Must run before Plan 03 (store fixes).
- Existing engine test files from Phase 1 already exist and will be updated to pass `eventId` param in test calls — not a new file, an update.
- Grep-based verification covers hardcode removal for engines, API routes, and components.

---

## Manual-Only Verifications

| Behavior                                | Requirement | Why Manual                           | Test Instructions                                               |
| --------------------------------------- | ----------- | ------------------------------------ | --------------------------------------------------------------- |
| Event switching shows correct data      | SEC-04      | Requires multi-event browser session | Switch events in UI, verify no stale data bleed                 |
| Realtime resubscription on event change | SEC-05      | Requires live Supabase connection    | Change event, verify new channel filter in DevTools Network tab |
| QR code uses dynamic slug               | SEC-04      | Visual verification                  | Open CheckInTab, verify QR URL contains event slug              |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
