---
name: gsd:quick
description: 'GSD quick-task workflow for small fixes, doc updates, and ad-hoc tasks. Use for changes that can be scoped, executed, and verified in a single pass without formal planning.'
---

# GSD Quick Task Workflow

You are entering the **GSD Quick** workflow. This is the fast lane — for tasks that are well-understood, low-risk, and completable in one pass.

## When to Use This

- Single-file edits or bug fixes
- Doc/comment updates
- Adding a small UI element or form field
- Config changes
- One-off data or copy changes

If the task turns out to be larger than expected (touching 4+ files, requires design decisions, has unclear requirements), stop and escalate to `/gsd:debug` or `/gsd:execute-phase`.

## Execution Protocol

Follow these steps in order — no skipping:

### 1. Scope Check (30 seconds)

State out loud:

- What file(s) will change?
- What is the expected diff (1-line summary)?
- Any risk of breaking something else?

If you can't answer all three confidently, stop and gather context first.

### 2. Read Before Write

Always read the target file before editing. Never edit from memory alone.

### 3. Make the Change

- Minimal diff — only change what the task requires
- No refactoring nearby code
- No adding features that weren't asked for
- No style cleanup beyond what was asked

### 4. Verify

- Re-read the changed section
- If it's code: does it type-check? Does the logic hold?
- If it's copy/docs: does it read correctly?

### 5. Close the Loop

State what was done in one sentence. If there's a follow-up task worth tracking, name it — but don't start it.

---

**Now proceed with the task the user described.**
