---
name: ln-sync
description: "Refresh memory/SPEC.md and memory/PLAN.md — graduate assumptions, archive stale items, and flag drift between docs and code. Use periodically or when docs feel out of date."
---

# Ln Sync

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

For each assumption in `memory/SPEC.md` §Assumptions whose `Status` is `validated`:
- If it establishes a durable truth → promote to §Lexicon as an invariant or term
- If it resolved a choice → promote to §Decisions
- Preserve `Status: validated` in §Assumptions

For each assumption whose `Status` is `invalidated`:
- If it led to an alternative choice → record in §Decisions (superseding the prior decision)
- Preserve `Status: invalidated` in §Assumptions
- Flag all implicated slices in `memory/PLAN.md`

### 2b. Consolidation pass

`ln-build` is local and conservative — it only compares against items the current slice references. `ln-sync` owns whole-document consolidation: merging equivalent rows, generalizing micro-variants, and absorbing implementation-detail decisions.

Read the full affected sections and merge overly-granular items before pruning.

#### Same-item tests (from ln-build — apply globally here)

- **Same assumption** = same boundary/component + same unresolved claim
- **Same decision** = same seam/boundary + same chosen alternative
- **Same invariant** = same seam/boundary + same rule template + same proved decision(s)

#### Global consolidation rules

- Keep the **oldest surviving ID** among equivalent rows
- Rewrite that survivor to the **generalized statement**
- Union metadata (`Protected by`, `Established by`, dependencies, implicated slices, validation evidence)
- Remove absorbed rows and leave an HTML comment naming absorbed IDs and why
- Do **not** renumber surviving items
- Rewrite references in both `SPEC.md` and `PLAN.md` from absorbed IDs to the surviving ID

Comment format: `<!-- Consolidated 2026-04-XX: absorbed I54, I55 into I52 — same seam/rule, generalized wording -->`

#### Assumptions — merge when:

- same boundary/component + same unresolved claim + differences are only wording, confidence, evidence, or validation method
- After merge: keep one row, preserve strongest status/evidence, union dependent decisions and implicated slices

#### Decisions — merge when:

- same seam/boundary + same chosen alternative + newer rows only add implementation detail, narrower examples, or first use cases of the same pattern
- Keep separate when different alternatives at the same seam, or either choice could still be revisited independently

#### Invariants — merge when:

- same seam/boundary + same rule template + same proved decision(s), or one row is a strict example/branch of the other
- Prefer the generalized seam-level wording; union protecting test files and establishing slices
- Keep separate only when they can regress independently because seam, rule, proof, or test family differs

#### Completed-slice notes in PLAN.md

For every `done` slice:
- keep at most one compact completion block (max 4 bullets / 6 lines): shipped outcome, seam changed, evidence, remaining debt
- replace verbose `Observed current state` / `Observed code seam` narratives with the compact form
- if the parent slice is `done`, fold tracer-bullet prose into the parent note
- delete completion notes that only repeat acceptance text, invariant IDs, or commit history

Git is the history. PLAN.md keeps only routing-relevant summaries.

### 2c. Pruning check

After consolidation, assess each remaining item for removal:

| State | Criterion | Action |
| --- | --- | --- |
| **Embedded** | Now a structural property of code/tests/decisions/invariants; restating it as a live tracked item adds noise | Remove |
| **Moot** | The concern no longer applies in the current architecture | Remove |
| **Superseded** | Replaced by a newer decision/assumption/invariant and all references can point to the replacement | Remove, note replacement |
| **Redundant** | Equivalent to another surviving row after consolidation | Remove |

When pruning, leave a comment noting which IDs were removed and why (e.g. `<!-- Pruned 2026-04-03: removed A1, A2 — embedded in architecture -->`). Do not renumber surviving items.

After pruning, repair or replace any dangling cross-references in `memory/SPEC.md` and `memory/PLAN.md` that pointed at removed or absorbed items.

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

### Pruned
- [items removed as embedded/moot/superseded, with rationale]

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
