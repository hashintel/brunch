---
name: ln-sync
description: "Refresh memory/SPEC.md and memory/PLAN.md — graduate assumptions, archive stale items, and flag drift between docs and code. Use periodically or when docs feel out of date."
---

# Dev Sync

Audit and refresh the two project documents. Create any that are missing.

## The two documents

| File               | Authority    | Contains                                                                                                           |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **memory/SPEC.md** | What and why | Concept & goal, constraints, requirements, assumptions, decisions, lexicon, verification design, acceptance criteria |
| **memory/PLAN.md** | What's next  | Phases containing ordered slices and spikes, each linking to SPEC.md requirements and assumptions                   |

## Procedure

### 1. Read both documents

If either is missing, prompt `ln-spec` or `ln-plan` to create it.

### 2. Graduation check

For each validated assumption in `memory/SPEC.md` §Assumptions:
- If it establishes a durable truth → promote to §Lexicon as an invariant or term
- If it resolved a choice → promote to §Decisions
- Mark as `validated` in §Assumptions

For each invalidated assumption:
- If it led to an alternative choice → record in §Decisions (superseding the prior decision)
- Mark as `invalidated` in §Assumptions
- Flag all implicated slices in `memory/PLAN.md`

### 3. Staleness check

- **PLAN.md**: Are completed slices still marked in-progress? Are active items still relevant? Do slice/spike cross-references to SPEC.md §Requirements and §Assumptions still hold?
- **SPEC.md**: Do §Lexicon terms match current code names? Have §Decisions been superseded by implementation reality? Are §Acceptance Criteria still accurate?

### 4. Drift check

Scan recent code changes (git log/diff) for:
- New domain concepts not reflected in §Lexicon
- Implicit decisions not recorded in §Decisions
- New assumptions being made without tracking in §Assumptions
- Broken traceability links between SPEC.md and PLAN.md

### 5. Report and update

Present findings, then update docs with user confirmation:

```md
## Sync Report

### Graduations
- [assumption] → [promoted to Lexicon/Design Decisions]

### Stale items
- [item] in [file] — [what's wrong]

### Drift
- [new concept/decision/assumption not yet tracked]

### Actions taken
- [list of doc updates made]
```

## Routing

After sync, present these options to the user (use `tool-ask-question`):

| #   | Label             | Target       | Why                                        |
| --- | ----------------- | ------------ | ------------------------------------------ |
| 1   | Scope next slice  | `ln-scope`   | Docs are current, continue with next slice |
| 2   | Revisit the plan  | `ln-plan`    | Sync surfaced new work or changed priority |
| 3   | Back to triage    | `ln-consult` | Direction needs reassessment               |

Recommended: **1** if plan is on track, **2** if sync found significant drift.
