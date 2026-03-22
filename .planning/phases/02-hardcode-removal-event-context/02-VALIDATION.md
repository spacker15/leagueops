---
phase: 2
slug: hardcode-removal-event-context
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SEC-04 | grep | `grep -rn "event_id = 1\|eventId = 1\|?? 1" lib/engines/` | N/A | ⬜ pending |
| 02-02-01 | 02 | 1 | SEC-04 | grep | `grep -rn "event_id = 1\|eventId = 1\|?? 1" app/api/` | N/A | ⬜ pending |
| 02-03-01 | 03 | 2 | SEC-05 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | SEC-04 | grep | `grep -rn "event_id = 1\|eventId = 1\|?? 1" components/` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. Grep-based verification is sufficient for hardcode removal. Store/realtime changes verified by existing tests + grep.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Event switching shows correct data | SEC-04 | Requires multi-event browser session | Switch events in UI, verify no stale data bleed |
| Realtime resubscription on event change | SEC-05 | Requires live Supabase connection | Change event, verify new channel filter in DevTools Network tab |
| QR code uses dynamic slug | SEC-04 | Visual verification | Open CheckInTab, verify QR URL contains event slug |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
