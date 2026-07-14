---
description: Coordinate scoped or refactor-plan work through delegated, independently reviewed execution
argument-hint: "[frontier-id | scope-file-path | memory/REFACTOR.md | concern]"
---

Act as the coordinator, scoper, and reviewer for execution focus: ${@:-infer from the current concern}

A focus may be:

- a named frontier in `memory/PLAN.md`;
- one or more active scope files under `memory/cards/`;
- the active `memory/REFACTOR.md` plan;
- a non-frontier concern represented by category-prefixed scope files (`dev--`, `tooling--`, or `docs--`).

Do not invent a PLAN frontier merely because an execution artifact exists.

## Resolve the focus

When an argument is present, resolve it in this order:

1. an exact `memory/PLAN.md` frontier id;
2. an exact execution-artifact path under `memory/cards/` or the exact `memory/REFACTOR.md` path;
3. otherwise, a concern description to correlate with the conversation and active execution artifacts.

Ask when multiple plausible matches remain.

When no argument is present:

1. inspect the current conversation, active files under `memory/cards/`, and `memory/REFACTOR.md` when present;
2. infer the smallest coherent focus;
3. present that inferred focus to the user for confirmation before scoping or delegating;
4. offer a bounded choice when several focuses are plausible, or ask what should be prepared when none is evident.

## Refactor-plan execution semantics

`memory/REFACTOR.md` is already a complete execution artifact produced by `ln-refactor`. Its ordered `## Commits` items are commit-sized reviewable units: treat them like the serial cards inside a `Mode: slices` scope file.

- Do **not** invoke `ln-scope`, create a scope file, or translate each refactor item into a card before building it.
- Select the next unfinished commit item whose prerequisites hold, and delegate that item directly.
- Preserve list order unless review proves two items independent and the worktree-isolation rules permit separate writers.
- Apply the same sliced-execution stop conditions used for prepared cards: stop on failed verification, scope growth, invalidated assumptions, overlap, behavioral ambiguity, canonical-truth changes, or user judgment.
- If an item is no longer buildable as written, revise or supersede the refactor plan through `ln-refactor`; do not route it through `ln-scope` merely because it needs clarification.
- After accepting an item, record completion in the refactor plan using its existing status convention; when it has none, prefix the item text with `[done]`. When every item is done or explicitly dropped, delete `memory/REFACTOR.md` in the final consuming commit, as required by `ln-build` and `ln-refactor`.

## Run the focus

Work in a review-bounded loop:

1. **Orient.** Read the canonical context appropriate to the focus. For a frontier, read its `memory/PLAN.md` definition and sequencing. For a refactor, read all of `memory/REFACTOR.md`. For any focus, read `memory/SPEC.md`, `HANDOFF.md` if present, and the topology or canonical docs needed to identify posture, obligations, and open risks.
2. **Inspect active execution artifacts.** Relevant active scope files or the active refactor plan win over creating new artifacts. A `Mode: sweep` ledger and an ordered refactor commit list are already complete execution artifacts; do not invoke `ln-scope` merely to select their next unit. Ask when artifact selection is ambiguous.
3. **Scope only to the epistemic horizon.** Apply `ln-scope` only when no suitable execution artifact exists or the selected non-refactor work needs a new artifact. Let the skill choose `single`, `slices`, or `sweep`. Pre-scope a sequence only when `ln-scope`'s sliced-mode conditions hold. Never scope a downstream unit whose shape depends on findings from an earlier unit. Revise an invalidated refactor plan through `ln-refactor` instead.
4. **Derive execution lanes.** Treat file order inside `Mode: slices` and commit order inside `memory/REFACTOR.md` as serial. Treat separate scope files as independent only when their declared primary write paths are disjoint under `ln-scope`'s overlap test. Keep blocked or discovery-dependent work out of the ready set. Do not invent a private card-level dependency graph: route frontier-level dependency changes through `ln-plan`, rescope intra-frontier card work when new dependencies emerge, and revise refactor sequencing in the refactor plan.
5. **Admit writers safely.** Maintain ready, running, blocked, stale, and under-review state for the focus. Independent lanes may be prepared in advance, but allow only one writing builder in a shared worktree. Run writers concurrently only when each has an isolated working directory and an explicit reintegration plan. Read-only exploration may run in parallel.
6. **Baseline protected state.** Immediately before each delegation, inspect `git status --short`. Record every pre-existing modified or untracked path as protected state. Identify the selected unit's tentative write manifest, including required canonical reconciliation paths.
7. **Delegate one reviewable unit.** Call the project-local `builder` with `cwd` set to the repository root and the concrete packet below. For `Mode: sweep`, delegate exactly one row and return for review. For `Mode: slices`, permit card-by-card continuation only while `ln-build`'s sliced-execution stop conditions allow it. For `memory/REFACTOR.md`, delegate the selected commit item directly and permit item-by-item continuation under those same stop conditions.
8. **Review claims independently.** Ensure the writer has stopped, then inspect status, commits, diffs, acceptance evidence, verification, canonical reconciliation, and residual risk. Treat the builder's report as claims, not completion.
9. **Update epistemic state.** Decide whether the result closes a unit, exhausts the focus, changes what the focus means, invalidates prepared work, exposes fog, or requires `ln-scope`, `ln-refactor`, `ln-spec`, `ln-plan`, or human judgment. For a refactor focus, use `ln-refactor` rather than `ln-scope` to revise the execution artifact. Revalidate every prepared downstream unit before releasing it.
10. **Repeat or stop.** Continue while a verified ready unit remains. Stop when the focus is exhausted, blocked, invalidated, unsafe to continue, or needs user/product judgment.

## Builder delegation packet

Replace every placeholder before delegating:

For a scope file, use:

```md
Apply `ln-build` to `<relative-scope-file-path>`.

Build this reviewable execution unit:

- Selected card/row: <identify the concrete unit>
- Delegation bound: <next card | exactly one sweep row | sliced continuation while skill stop conditions permit>

Shared-worktree context:

- Protected pre-existing state: <exact `git status --short` baseline, or `none`>
- Tentative allowed write manifest: <expected paths plus required canonical reconciliation paths>

The loaded `ln-build` skill is authoritative for implementation, verification,
acceptance, reconciliation, scope-file lifecycle, and stop conditions. Return
its required completion evidence plus commit hashes/messages and files touched
per commit so the coordinator can independently review the claims.
```

For `memory/REFACTOR.md`, use:

```md
Apply `ln-build` directly to `memory/REFACTOR.md`.

Treat its ordered commit items as prepared serial cards. Do not invoke
`ln-scope` and do not create a scope file.

Build this reviewable execution unit:

- Selected refactor item: <quote its number and commit description>
- Delegation bound: <this item only | serial continuation while sliced-execution stop conditions permit>

Shared-worktree context:

- Protected pre-existing state: <exact `git status --short` baseline, or `none`>
- Tentative allowed write manifest: <expected paths plus required canonical reconciliation paths>

The loaded `ln-build` skill is authoritative for TDD, verification, acceptance,
canonical reconciliation, refactor-plan lifecycle, and stop conditions. The
selected refactor item itself is sufficient scope. Return the required
completion evidence plus commit hashes/messages and files touched per commit so
the coordinator can independently review the claims.
```

## Interrupted delegation

Treat timeout or silence as interruption, not failure and not permission to launch a second writer.

1. Confirm the writer is no longer active; if uncertain, stop and ask.
2. Compare `git status --short` with the recorded baseline and preserve the interrupted diff.
3. Review and verify completed work normally.
4. If incomplete, delegate a fresh builder to finish the existing diff, naming completed evidence and missing leaves; forbid restarting or reverting it.
5. Do not advance the execution state until the unit is verified and committed.

## Review decision

After inspecting the evidence, choose one:

- **accepted, continue** — claims match and another unit is ready;
- **accepted, focus exhausted** — claims match and the focus's completion condition holds;
- **revision requested** — delegate a bounded correction naming exact findings;
- **rescope / revise refactor** — learning invalidated the prepared unit or changed the next best card, row, or refactor item;
- **route to `ln-spec` / `ln-plan`** — durable truth or frontier sequencing changed;
- **human decision needed** — product, policy, or unsafe-concurrency judgment is required.

Report the decision, commits reviewed, verification evidence, divergences or residual risk, and the recommended next action.
