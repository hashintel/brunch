---
description: Coordinate scoped or refactor-plan work through delegated, independently reviewed execution
argument-hint: "[frontier-id | scope-file-path | memory/REFACTOR.md | concern]"
---

Act as the coordinator and reviewer for execution focus: ${@:-infer from the current concern}

A focus may be: a named frontier in `memory/PLAN.md`; one or more active scope files under `memory/cards/`; the active `memory/REFACTOR.md` plan; or a non-frontier concern represented by category-prefixed scope files (`dev--`, `tooling--`, `docs--`). Do not invent a PLAN frontier merely because an execution artifact exists.

## Resolve the focus

With an argument, resolve in order: exact `memory/PLAN.md` frontier id → exact artifact path under `memory/cards/` or `memory/REFACTOR.md` → a concern description to correlate with the conversation and active artifacts. Ask when multiple plausible matches remain.

Without an argument, inspect the conversation, active files under `memory/cards/`, and `memory/REFACTOR.md` when present; infer the smallest coherent focus and confirm it with the user before delegating.

## Run the focus

Work in a review-bounded loop:

1. **Orient.** Read the canonical context for the focus: its `memory/PLAN.md` definition and sequencing (or all of `memory/REFACTOR.md`), plus `memory/SPEC.md`, `HANDOFF.md` if present, and the topology docs needed to identify posture, obligations, and open risks.
2. **Select the execution artifact.** Active scope files or the active refactor plan win over creating new artifacts. A `Mode: sweep` ledger and an ordered refactor commit list are already complete execution artifacts. Gate a pre-existing scope file the same way step 3 gates a freshly scoped one — write-path overlap against other active cards, posture, cold-start-read completeness — before admitting a builder to it. When several scope files are ready, treat them as independent only when their declared primary write paths are disjoint; sequence overlapping files in dependency order. Ask when artifact selection is ambiguous.
3. **Delegate scoping when needed.** When no suitable artifact exists (and the focus is not a refactor), delegate to the project-local `ln-scoper` with the packet below; the loaded `ln-scope` skill owns shape selection and card content. Never scope a downstream unit whose shape depends on findings from an earlier unit. Review the returned scope file before admitting any builder: write-path overlap against active cards, posture, cold-start-read completeness. Revise an invalidated refactor plan through `ln-refactor`, never `ln-scope`.
4. **Sequence builds serially; pipeline the rest.** Card order inside `Mode: slices` and commit order inside `memory/REFACTOR.md` are serial. Exactly one writing `ln-builder` runs at a time in the repository. Read-only delegation (scout, researcher) may run alongside it, and `ln-scoper` may scope the next unit ahead of the running build — it only adds new files under `memory/cards/`. Route frontier-level dependency changes through `ln-plan`; revise refactor sequencing through `ln-refactor`.
5. **Baseline protected state.** Immediately before each delegation, inspect `git status --short`. Record every pre-existing modified or untracked path — including scope files just written by `ln-scoper` — as protected state, and identify the unit's tentative write manifest with required canonical reconciliation paths.
6. **Delegate one reviewable unit.** Call the project-local `ln-builder` with `cwd` set to the repository root and the packet below. For `Mode: sweep`, delegate exactly one row and return for review. For `Mode: slices` and refactor items, permit continuation only while `ln-build`'s stop conditions allow it.
7. **Review claims independently.** Ensure the writer has stopped, then inspect status, commits, diffs, acceptance evidence, verification, canonical reconciliation, and residual risk. Treat the report as claims, not completion. A returned question is a blocked unit: answer it from canonical context or escalate to the user.
8. **Update state; repeat or stop.** Decide whether the result closes a unit, exhausts the focus, invalidates prepared work, or requires `ln-scope`, `ln-refactor`, `ln-spec`, `ln-plan`, or human judgment; revalidate every prepared downstream unit before releasing it. Continue while a verified ready unit remains. Stop when the focus is exhausted, blocked, invalidated, or needs user/product judgment.

For `memory/REFACTOR.md`: its ordered `## Commits` items are already commit-sized reviewable units — never route them through `ln-scope`. Review cadence is a delegation-bound choice: **per-item** (delegate one item, review, repeat) or **batched** (the builder commits item by item under a continuation bound; the coordinator reviews the whole batch when it returns). Confirm the cadence with the user when the focus does not state it. After accepting an item, record completion using the plan's existing status convention (or prefix the item text with `[done]`); the loaded skills own final deletion of the exhausted plan.

Subagents are isolated: each receives only its delegation packet plus its one loaded skill — no session context. Transcribe into the packet every session-established decision, constraint, and exclusion the unit depends on; nothing else crosses.

## ln-scoper delegation packet

```md
Apply `ln-scope` to this work:

- Focus: <frontier id with its PLAN.md definition, or a precise concern objective>
- Established context: <session decisions, constraints, and exclusions this scope depends on, or `none`>
- Active scope files to overlap-test against: <`memory/cards/` paths, or `none`>
- Protected pre-existing state: <exact `git status --short` baseline, or `none`>

Return the scope file path(s) written and any unresolved ambiguity.
```

## ln-builder delegation packet

```md
Apply `ln-build` to <relative scope-file path | `memory/REFACTOR.md` directly>.

Build this reviewable execution unit:

- Selected unit: <card, sweep row, or quoted refactor commit item>
- Delegation bound: <next card | exactly one sweep row | this refactor item only | continuation while `ln-build` stop conditions permit>
- Established context: <session decisions and constraints not already in the scope file or refactor plan, or `none`>
- Refactor items only: treat the ordered commit items as prepared serial cards; the selected item is sufficient scope — do not invoke `ln-scope` or create a scope file.

Working-copy context:

- Protected pre-existing state: <exact `git status --short` baseline, or `none`>
- Tentative allowed write manifest: <expected paths plus required canonical reconciliation paths>

The loaded `ln-build` skill is authoritative for implementation, verification, acceptance, reconciliation, artifact lifecycle, and stop conditions. Return its required completion evidence plus commit hashes/messages and files touched per commit.
```

## Interrupted delegation

Treat timeout or silence as interruption, not failure and not permission to launch a second writer.

1. Confirm the writer is no longer active; if uncertain, stop and ask.
2. Compare `git status --short` with the recorded baseline and preserve the interrupted diff.
3. Review and verify completed work normally.
4. If incomplete, delegate a fresh ln-builder to finish the existing diff, naming completed evidence and missing leaves; forbid restarting or reverting it.
5. Do not advance the execution state until the unit is verified and committed.

## Review decision

After inspecting the evidence, choose one:

- **accepted, continue** — claims match and another unit is ready;
- **accepted, focus exhausted** — claims match and the focus's completion condition holds;
- **revision requested** — delegate a bounded correction naming exact findings;
- **rescope / revise refactor** — learning invalidated the prepared unit or changed the next best card, row, or refactor item;
- **route to `ln-spec` / `ln-plan`** — durable truth or frontier sequencing changed;
- **human decision needed** — product or policy judgment is required.

Report the decision, commits reviewed, verification evidence, divergences or residual risk, and the recommended next action.
