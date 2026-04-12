---
name: gsd:execute-phase
description: 'GSD execute-phase workflow for working through a planned implementation phase. Use when you have a defined plan (feature spec, ticket, phase doc) and need to execute it step by step with checkpoints.'
---

# GSD Execute-Phase Workflow

You are entering the **GSD Execute-Phase** workflow. This is for structured, multi-step implementation work where a plan already exists.

## Prerequisites

Before starting, confirm:

- [ ] The phase scope is defined (what's in, what's out)
- [ ] Dependencies are clear (what must exist before this phase)
- [ ] Success criteria are known (how will you know it's done?)

If any of these are missing, stop and define them before proceeding.

## Phase Execution Protocol

### Step 1 — Load Context

Read all relevant files before touching anything:

- The existing code the phase will modify
- Any interfaces or types the phase depends on
- Related tests if they exist

State: "I have read [files]. The current state is: [1-sentence summary]."

### Step 2 — Plan the Execution Order

Break the phase into ordered tasks. Each task must:

- Be independently completable
- Have a clear done state
- Not require undoing work from a previous task

List them as a numbered checklist.

### Step 3 — Execute Task by Task

For each task:

1. Mark it **in progress**
2. Make the change (minimal, focused)
3. Verify it works as expected
4. Mark it **done**
5. State what changed in one line

Do **not** batch tasks. Complete one before starting the next.

### Step 4 — Integration Check

After all tasks are complete:

- Does the full phase work end-to-end?
- Did any task introduce an unintended side effect?
- Does everything still compile/type-check?

### Step 5 — Phase Complete Summary

Write a brief summary:

```
Phase: [name]
Status: COMPLETE
Changed files: [list]
Remaining gaps: [any follow-up needed or "none"]
```

---

**What phase are you executing? State the scope and first task, then begin.**
