---
name: ln-sync
description: "Refresh `memory/SPEC.md` and `memory/PLAN.md` in mature mode — restore canonical truth, archive retired plan history, delete stale derivative artifacts, and flag drift against code."
---

# Ln Sync

Audit and refresh the canonical documents so they stay lightweight enough for fast re-entry.

`ln-sync` is the family-wide ontology repair and garbage-collection pass. Merge equivalent facts, repair stale references, and delete exhausted derivative artifacts. Only `docs/archive/PLAN_HISTORY.md` acts as archive history.

## When to run

Prefer `ln-sync` at these moments:

- milestone boundaries
- before major refactors
- at handoff / context compaction
- when `memory/SPEC.md` or `memory/PLAN.md` feels overweight

## Document roles

| File | Authority | Keep live |
| --- | --- | --- |
| `memory/SPEC.md` | what and why | active assumptions, current decisions, critical invariants, live constraints |
| `memory/PLAN.md` | what's next | active frontier, near-horizon items, recent completions |
| `docs/archive/PLAN_HISTORY.md` | historical ledger | older completed phases and retired plan history |
| `HANDOFF.md` | derivative volatile transfer | only unfinished chat state not yet reconciled |
| `memory/REFACTOR.md` | derivative temporary execution plan | only unfinished refactor steps |

## Procedure

### 1. Read the current docs

If either `memory/SPEC.md` or `memory/PLAN.md` is missing, route to `ln-spec` or `ln-plan` first.

### 2. Weight check

Ask whether each file is still serving re-entry.

- If `memory/SPEC.md` is carrying embedded truths, old implementation detail, or closed historical debates, prune it.
- If `memory/PLAN.md` is mostly completed history, collapse it to a rolling frontier and archive the rest.
- If `HANDOFF.md` or `memory/REFACTOR.md` no longer carry live temporary state, delete them.

### 3. SPEC pass — keep only live architecture

For each item in `memory/SPEC.md`, choose one:

- **keep** — still unresolved or still constrains future work
- **update** — wording / evidence / scope changed
- **remove** — embedded, moot, superseded, or redundant

#### Keep in SPEC

- concept and goal
- constraints and non-goals
- requirements
- live assumptions only
- current decisions only
- durable seam-defining decisions even when implemented
- critical seam-level invariants only
- lexicon
- verification stance / commands / blind spots

#### Remove from SPEC

- implementation diary entries
- historical completion notes already reflected in code or tests
- micro-variant decisions / invariants that are now embedded in a larger seam
- validated assumptions that no longer change future work

Do **not** remove durable seam rationale merely because code and tests now exist. Prune micro-decisions, not the architectural spine.

Merge equivalent assumptions, decisions, and invariants instead of carrying parallel rows for the same seam-level fact. When rows merge or move, repair the references that point at them.

When pruning, leave concise HTML comments naming removed IDs when useful. Do not renumber survivors.

### 4. PLAN pass — restore the rolling frontier

Reshape `memory/PLAN.md` to:

- `Active`
- `Next`
- `Horizon`
- `Recently Completed`
- `Dependencies`

Rules:

- move older completed items to `docs/archive/PLAN_HISTORY.md`
- keep only the last 2-3 completed items live
- only active / next items need detailed acceptance or traceability
- keep dependency diagrams limited to active / next work
- keep enough `Why now / unlocks` context that a fresh thread can understand frontier ordering without reading the full archive
- do not archive handoffs, refactor plans, or sync reports

### 5. Drift and ontology check

Scan recent code / commits for:

- new domain concepts not reflected in the lexicon
- durable decisions not reflected in `memory/SPEC.md`
- active work not represented in `memory/PLAN.md`
- stale references between `memory/PLAN.md` and `memory/SPEC.md`
- equivalent facts that should merge instead of coexisting
- stale derivative artifacts that should be deleted after reconciliation

### 6. Garbage-collect derivative artifacts

Delete exhausted temporary artifacts after their useful state has been reconciled:

- remove stale `HANDOFF.md` files instead of preserving them as archive breadcrumbs
- remove completed `memory/REFACTOR.md` files instead of leaving completion notes or pointers
- if an ad hoc planning/status file was created with explicit permission and is now exhausted, reconcile any durable facts, then delete it unless the user asked to keep it

### 7. Report and update

Produce a concise sync report and make the edits.

```md
## Sync Report

### Pruned
- [items removed and why]

### Archived
- [history moved to PLAN_HISTORY.md]

### Garbage-collected
- [temporary artifacts deleted and why]

### Drift fixed
- [concept / decision / frontier updates made]

### Remaining live items
- [important assumptions or frontier work that still matter]
```

## Routing

After sync, present these options to the user (use `tool-ask-question`):

| #   | Label             | Target       | Why |
| --- | ----------------- | ------------ | --- |
| 1   | Scope next item   | `ln-scope`   | Docs are current and the next slice is ready |
| 2   | Revisit the plan  | `ln-plan`    | Sync changed priorities or exposed new frontier work |
| 3   | Back to triage    | `ln-consult` | Direction needs reassessment |

Recommended: **1** if the frontier is still sound, **2** if sync materially changed it.
