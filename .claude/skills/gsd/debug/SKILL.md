---
name: gsd:debug
description: 'GSD debug workflow for systematic investigation and bug fixing. Use when something is broken, behaving unexpectedly, or you need to understand root cause before making changes.'
---

# GSD Debug Workflow

You are entering the **GSD Debug** workflow. This is methodical, evidence-driven investigation before any fixes.

**Rule #1: Do not touch code until you understand the root cause.**

## Phase 1 — Capture the Symptom

Before doing anything, write down exactly:

1. What is the observed behavior?
2. What is the expected behavior?
3. Where does the failure surface (URL, component, function, error message)?
4. When did it start (last working state, if known)?

## Phase 2 — Build a Hypothesis List

List 3–5 plausible causes, ranked by likelihood. For each:

- State the hypothesis
- State what evidence would confirm or rule it out

Example:

> **H1** (most likely): RLS policy missing for authenticated role  
> Evidence: query returns empty array instead of error; other tables with same pattern work

## Phase 3 — Investigate (Structured)

Work through hypotheses top-down. For each:

1. Find the relevant code or config
2. Read it — don't assume
3. Test or reason through whether it explains the symptom
4. Mark: CONFIRMED / RULED OUT / INCONCLUSIVE

Stop when one hypothesis is CONFIRMED. Don't "also fix" things you ruled out.

## Phase 4 — Root Cause Statement

Write one clear sentence:

> "The bug is caused by X in file Y:line Z, which produces symptom S."

If you can't write this sentence, you haven't found the root cause yet.

## Phase 5 — Fix

Only now make the change:

- Minimal fix targeting the confirmed root cause
- No opportunistic refactoring
- No "while I'm in here" changes

## Phase 6 — Verify the Fix

Confirm:

- The symptom no longer occurs
- No adjacent behavior regressed
- The fix is understandable to a future reader

---

**Now begin Phase 1 for the issue the user described.**
