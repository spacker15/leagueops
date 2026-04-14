---
phase: 5
slug: event-creation-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest (existing project config)    |
| **Config file**        | vitest.config.ts                    |
| **Quick run command**  | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run`                    |
| **Estimated runtime**  | ~15 seconds                         |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                       | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | --------------------------------------- | ----------- | ---------- |
| 05-01-01 | 01   | 1    | EVT-02      | migration   | `supabase migration list`               | ❌ W0       | ⬜ pending |
| 05-02-01 | 02   | 1    | EVT-01      | unit        | `npx vitest run VenueAutocompleteInput` | ❌ W0       | ⬜ pending |
| 05-02-02 | 02   | 1    | EVT-03      | integration | `npx vitest run api/maps`               | ✅          | ⬜ pending |
| 05-03-01 | 03   | 2    | EVT-04      | unit        | `npx vitest run SharingSection`         | ❌ W0       | ⬜ pending |
| 05-03-02 | 03   | 2    | EVT-05      | unit        | `npx vitest run QRCode`                 | ❌ W0       | ⬜ pending |
| 05-03-03 | 03   | 2    | EVT-06      | unit        | `npx vitest run ShareButtons`           | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `__tests__/components/VenueAutocompleteInput.test.tsx` — stubs for EVT-01, EVT-02
- [ ] `__tests__/components/SharingSection.test.tsx` — stubs for EVT-04, EVT-05, EVT-06
- [ ] Install `qrcode.react` package dependency

_Existing infrastructure covers test framework — vitest already configured._

---

## Manual-Only Verifications

| Behavior                                              | Requirement | Why Manual                                           | Test Instructions                                                                |
| ----------------------------------------------------- | ----------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Google Maps autocomplete dropdown renders suggestions | EVT-01      | Requires live Google API key and browser interaction | Type "Central Park" in venue input, verify dropdown appears with suggestions     |
| QR code scans correctly                               | EVT-05      | Requires physical QR scanner or camera               | Download QR SVG, scan with phone camera, verify it navigates to registration URL |
| Share via Email/Text opens native app                 | EVT-06      | Requires native mailto:/sms: handler                 | Click Share via Email, verify mail client opens with pre-filled content          |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
