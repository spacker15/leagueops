---
phase: 7
slug: notification-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing project framework) |
| **Config file** | `vitest.config.ts` or "none — Wave 0 installs" |
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *Populated after plans are created* | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify `pg_net` extension is enabled (required for Database Webhooks)
- [ ] Install `resend`, `@react-email/components`, `react-email` packages
- [ ] Install `web-push` package for VAPID key generation and push sending
- [ ] Create test stubs for notification queue, preferences, and delivery

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser push notification appears | NOT-06 | Requires real browser with push permission | 1. Open app in Chrome, 2. Grant push permission, 3. Insert notification_queue row, 4. Verify push notification appears |
| Email arrives in real inbox | NOT-05 | Requires Resend API key + verified domain | 1. Insert notification_queue row with email channel, 2. Check inbox within 30s |
| Edge Function triggered by DB webhook | NOT-01 | Requires Supabase hosted environment | 1. Insert row into notification_queue, 2. Check notification_log for delivery record |
| Service worker registered | NOT-06 | Requires HTTPS + browser | 1. Open app, 2. Check DevTools > Application > Service Workers |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
