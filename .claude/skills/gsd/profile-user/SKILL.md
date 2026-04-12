---
name: gsd:profile-user
description: "GSD profile-user workflow for generating a developer profile that gets stored in CLAUDE.md. Captures coding preferences, workflow style, and project context to personalize Claude's behavior."
---

# GSD Profile User

You are entering the **GSD Profile User** workflow. This generates a developer profile that gets saved to the `## Developer Profile` section of `CLAUDE.md`.

The profile helps Claude understand:

- How you like to work
- Your experience level in relevant areas
- Communication preferences
- Project-specific context

## Profile Generation Steps

### Step 1 — Read Existing CLAUDE.md

Read `CLAUDE.md` to understand the project context before asking questions.

### Step 2 — Ask These Questions

Ask the user the following, one block at a time (don't dump all at once):

**Block A — Experience & Stack**

> 1. How long have you been working with Next.js / React?
> 2. How comfortable are you with TypeScript? (beginner / comfortable / expert)
> 3. Any areas of the stack where you'd like more explanation vs. less?

**Block B — Workflow Style**

> 4. Do you prefer seeing the plan first, or just dive in?
> 5. How much do you want Claude to explain what it's doing vs. just do it?
> 6. When something has multiple valid approaches, do you want options or a decision?

**Block C — Code Preferences**

> 7. Preferred comment style: minimal / explain complex logic only / verbose?
> 8. Do you care about test coverage for new code?
> 9. Anything you dislike seeing in PRs (e.g., unnecessary abstractions, over-engineering)?

**Block D — Project Context**

> 10. What's the most important thing working in this project right now?
> 11. What's the biggest pain point or area of tech debt?
> 12. Any stakeholder or timeline pressure I should know about?

### Step 3 — Generate the Profile

After the user answers, synthesize a clean profile in this format and write it to the `## Developer Profile` section of `CLAUDE.md`:

```markdown
## Developer Profile

> Last updated: [date]
> This section is managed by `generate-claude-profile` -- do not edit manually.

**Experience:** [summary of stack familiarity]

**Communication style:** [concise / detailed / options-first / decision-first]

**Code preferences:**

- Comments: [style]
- Tests: [expectation]
- Abstractions: [lean/pragmatic/avoid over-engineering]

**Current focus:** [what matters most right now]

**Watch out for:** [pain points, things to avoid]
```

### Step 4 — Write to CLAUDE.md

Edit the `## Developer Profile` section in `CLAUDE.md` with the generated profile. Replace only that section — do not touch anything else in the file.

---

**Begin with Block A questions.**
