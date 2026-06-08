---
name: ln-plan
description: "Break a feature or project area into frontier items and update `memory/PLAN.md`. Re-run to retire completed work, reorder priorities, or add new items."
argument-hint: "[feature or project area to plan]"
---

# Ln Plan

Plan the **rolling frontier**, not the whole historical timeline.

`memory/PLAN.md` is the canonical record of what's next. `docs/archive/PLAN_HISTORY.md` is the only sanctioned archive for retired plan history. `memory/cards/` is the sanctioned derivative location for prepared scope cards; one file per concern, named `<frontier-id>--<slug>.md` (or `dev--<slug>.md`, `tooling--<slug>.md`, `docs--<slug>.md` for non-frontier work). Scope files are not canonical planning state. Do not invent other sidecar plan docs, milestone ledgers, or alternate memory locations without explicit permission.

## Frontier vs slice vocabulary

Use **frontier item** for a named canonical work item in `memory/PLAN.md`. Frontier items are the unit of Linear issue / Graphite branch work and should be vertical enough to establish or unlock a meaningful product or architecture step.

Use **slice** for the buildable scope card produced by `ln-scope` and implemented by `ln-build`. A slice is often a sub-unit of one frontier item. Several slices may land on the same frontier branch. Do not turn slices into separate PLAN entries unless the frontier itself changes shape, ownership, or dependency ordering.

The vertical-slicing instinct still applies at planning time: frontier items should cut through the relevant concerns of `memory/SPEC.md` instead of becoming layer-by-layer chores. The term "frontier" names their canonical/branch role; the term "slice" remains reserved for scoped execution.

**Notation aid.** Express the `Dependencies` block as `pseudo graph` rather than a hand-drawn tree — cross-edges (optional successors, on-promotion edges) and dependency-edge types (`-[hard]->`, `-[optional]->`, `-[on promotion]->`) stay visible, and horizon items go in an `unconnected` group so they're acknowledged without implying spine relations. See `pseudo references/graph.md` worked example "roadmap dependency graph."

## Plan document shape

Prefer the conflict-resistant mature shape:

- `Context` — short rolling narrative for re-entry
- `Sequencing` — small, frequently edited ordering/status references by stable frontier id
- `Frontier Definitions` — relatively stable per-frontier definitions keyed by stable id
- `Recently Completed` — last 2-3 completed frontier items only
- `Dependencies` — active / next blocking relationships by stable id only

Within `Sequencing`, use:

- `Active` — ordered frontier items open now
- `Next` — near-horizon frontier items, loosely ordered
- `Parallel / Low-conflict` — useful work that can proceed without disturbing the main stack
- `Horizon` — future work, lightly shaped

Archive deeper history to `docs/archive/PLAN_HISTORY.md` instead of keeping it live in `memory/PLAN.md`.

Treat frontier items as branch-sized work, not commit-sized work. If one frontier item will unfold as several consecutive verified slices, keep that chain in a `Mode: chain` scope file under `memory/cards/` or in session context instead of fragmenting `memory/PLAN.md` into a commit ledger. `memory/PLAN.md` may carry at most a lightweight pointer such as `current execution pointer: memory/cards/<frontier-id>--<slug>.md`; detailed discretionary sub-slicing belongs in the scope file itself.

## Operating posture

Sequencing pressure depends on the active frontier's **certainty posture**. Read `.pi/POSTURE.md` (if present) for the project default, then check each `Active` / `Next` frontier definition for an explicit `Certainty:` override.

| Certainty | Ask | Optimize for | Reference |
| --- | --- | --- | --- |
| `proving` | What does landing this *tell us*? | information gain | [`references/proving.md`](references/proving.md) |
| `earned` | What does landing this *close*? | closure gain | [`references/earned.md`](references/earned.md) |

The posture is **per frontier**, not per project. A mostly-earned repo can carry a fresh proving seam; a settled seam can regress to proving on a new unknown. The project posture in `.pi/POSTURE.md` is only the default — annotate the frontier when it diverges.

Posture annotations are **required** on every `Active` / `Next` frontier (see the matching reference for the field set). If no posture-specific annotation applies, the frontier is not earning its slot — reshape, reclassify, or demote it.

When implementation later reveals the posture was wrong, treat that as a state transition (downgrade earned → proving, reshape the slice, route back through `ln-plan` if the frontier itself splits). Do not invent a third permanent posture. (A horizontal **coverage frontier** is a frontier *shape*, not a third posture — see [§Horizontal coverage frontiers](#horizontal-coverage-frontiers-frontier-shape-not-a-posture).)

Defensive parsing: depend primarily on `.pi/POSTURE.md`'s `certainty:` field; tolerate extra or mismatched fields rather than failing on schema drift.

## Input

The feature or project area: $ARGUMENTS

If context is thin, run a brief interview — not a full `ln-grill`.

If this is a fresh thread or the frontier rationale is unclear, read `HANDOFF.md` if present before planning.

## Planning rules

### Stable frontier ids

Every frontier definition should have a stable lowercase id / slug. Good ids are short and semantic, e.g. `agent-fixture-substrate`, `intent-graph-semantics`, `changeset-ledger`.

Rules:

- `Sequencing` references frontier ids; it does not duplicate definition blocks.
- `Frontier Definitions` are keyed by frontier id and should not move just because ordering changes.
- Rename a frontier id only when the identity of the work changed, not because the title improved.
- Linear issue ids belong in the definition metadata when known; they are not the only stable id.

### Work-type awareness

Classify each frontier item before deciding how much planning weight it needs.

| Work type | Planning weight |
| --- | --- |
| Structural | full frontier definition with `memory/SPEC.md` traceability |
| Bounded feature | objective + acceptance + verification; add `memory/SPEC.md` links only if durable boundaries change |
| Hardening | task-level objective + acceptance |
| Bugfix | usually do not add to `memory/PLAN.md` unless it changes frontier priority |
| Refactor | route through `ln-refactor` unless it is itself frontier work |

### Anti-fragmentation

Create a new frontier item only when it introduces at least one of:

1. a new lifecycle seam
2. a new transport or persistence seam
3. a new workflow entry / exit behavior
4. a meaningful unblocker for forward progress
5. a distinct dependency / branch boundary that should be tracked independently

Do not fragment the plan for minor action/status variants or ordinary follow-through inside a settled seam.

Do not split one frontier item into several new PLAN entries just because execution will require several scope cards or commits. Only split when the frontier itself changes shape, ownership, or dependency ordering.

But do not let anti-fragmentation erase cross-cutting architecture. If a subsystem or mechanism spans multiple frontier items and is not getting its own frontier id, thread it explicitly through the affected frontier definitions as an obligation in Objective, Acceptance, Verification, or a dedicated cross-cutting note.

### Sequencing vs definition edits

When priorities change, edit `Sequencing` first. Do not move or rewrite frontier definitions merely to reorder work.

When the meaning, acceptance, verification, traceability, or design-doc references of a frontier changes, edit its `Frontier Definitions` entry.

When a frontier completes, remove it from `Sequencing`, add a terse `Recently Completed` entry, and archive older completion history if needed. Keep the definition only if it still carries live rationale for nearby work; otherwise archive/retire it.

### Posture-dependent sequencing

Sequencing pressures and required annotation fields depend on the active frontier's posture:

- **Proving frontiers** → load [`references/proving.md`](references/proving.md). Covers tracer-bullet axes (proof of life, invariants, uncertainty), epistemic horizon, spike exception, reshape-don't-defer, and the `Retires` / `Depends on` / `Blocked by` / `Lights up` / `Stabilizes` annotation set.
- **Earned frontiers** → load [`references/earned.md`](references/earned.md). Covers the closure move-set (materialize, consolidate, name canonically, delete-as-progress, retire bridges, take-the-bigger-step), the "circling" recognition heuristic, sprawl guardrails, regression handling, and the `Closes` / `Materializes` / `Canonicalizes` / `Deletes/retires` / `Locks in` annotation set.

A plan may contain a mix of postures across its `Active` / `Next` frontiers. Load both references when planning a mixed plan.

### Horizontal coverage frontiers (frontier *shape*, not a posture)

Posture answers *how to rank the next vertical slice*; it carries **no completeness test**. Vertical tracers touch a horizontal capability layer (for example "the agent's READ tools as a whole") only as far as each claim needs, so a load-bearing layer can stay permanently shallow while every individual slice is still "done."

A **coverage frontier** fills that gap. It is a different frontier *shape*, not a third posture: it adds no row-level execution mechanics — each row is still built under `proving` or `earned`. What it adds is a layer-level **aggregate definition of done**: *no required row in a closed enumerated inventory is left open.*

**Recognition trigger.** Reach for a coverage frontier only when all three hold:

1. a **named layer is load-bearing as a whole** — its value *is* its breadth (an agent's capability surface, a public API's method set, a renderer family), not just one claim it proves;
2. you can **author a closed, enumerated inventory** up front of what the layer must contain; and
3. rows can be marked **required vs deferred** (e.g. POC `●` / later `○`).

If you cannot close the enumeration, it is not a coverage frontier — stay tracer-shallow. Most product layers should (correct YAGNI). Coverage mode is safe *only because the surface is a closed list*; without this gate it degenerates into completionist sprawl (global `AGENTS.md` §completionist sprawl).

**Frontier definition fields.** A coverage frontier names:

- the **layer boundary** — what is in the layer and explicitly what is out;
- the **aggregate DoD** — "every `●` row is closed";
- a pointer to the **`Mode: coverage` scope file** under `memory/cards/` that holds the row ledger (authored via `ln-scope`).

Each ledger row declares its own **fill mode** — `proving` if the row still carries an unknown, `earned` if it is settled-but-unbuilt. `ln-build` closes rows; the frontier completes when no `●` row remains in a `spec` / `new` / `partial` state — the ledger DoD, not a single tracer claim.

**Maturity gate.** The coverage shape is young. Treat it as a recognized scope-file mode, **not** a canonical posture or doc type. Promote it to first-class (a `references/coverage.md` posture, a canonical coverage store) only on rule-of-three — at least three real coverage cases *and* a recurring need for row-level mechanics beyond "closed ledger + per-row proving/earned." Until then, do not add a third posture reference or an alternate planning store.

## Procedure

0. Read `.pi/POSTURE.md` if present for the project's default certainty posture. For each `Active` / `Next` frontier, check for an explicit `Certainty:` override and load the matching reference (`references/proving.md` or `references/earned.md`). Load both when the plan is mixed.
1. Read `memory/PLAN.md` if it exists. Identify existing frontier ids and retire/archive stale completed material into `docs/archive/PLAN_HISTORY.md`.
2. Read `memory/SPEC.md` if it exists. Pull only the live requirements, assumptions, decisions, and invariants that still constrain forward work.
3. Explore the codebase enough to understand real boundaries.
4. Draft or revise `Sequencing` (`Active`, `Next`, `Parallel / Low-conflict`, `Horizon`) by stable frontier id.
5. Draft or revise `Frontier Definitions` only for new or substantively changed frontier items.
6. Add `Why now / unlocks` in a frontier definition when ordering would otherwise be opaque to a fresh thread.
7. Keep `Recently Completed` to 2-3 terse items max. Move older history to `docs/archive/PLAN_HISTORY.md`, not to handoff files or ad hoc notes.
8. Update `Dependencies` to reflect only active / next items, by frontier id.
9. If several commit-sized execution steps are already obvious inside one frontier item, keep them out of `memory/PLAN.md`; they belong in a scope file under `memory/cards/` or in the active thread as derivative execution detail.

### Cross-cutting obligations

When a canonical design doc or `memory/SPEC.md` defines a cross-cutting subsystem, enforcement mechanism, or verification layer that spans multiple frontiers, ensure it is visible somewhere in each affected frontier definition unless the frontier truly does not touch it.

Good examples:

- a side-task subsystem that affects M5, M7, and M9 even though it is not its own frontier
- a command-layer / transaction invariant that every persistence frontier must preserve
- a replay/property/adversarial fixture model that changes what `Verification` means for several milestones

The test is simple: if an agent read only `memory/PLAN.md`, would they know this frontier must preserve or establish that cross-cutting thing? If not, the plan is under-specified.

## Traceability

Traceability is conditional on structural significance.

- Structural frontier items should name relevant requirements, assumptions, decisions, or invariants from `memory/SPEC.md`.
- Bounded features and hardening tasks only need SPEC links if they change durable boundaries or depend on a live assumption.
- Scope-card slices inherit traceability from their containing frontier unless `ln-scope` discovers a durable change that must promote back into SPEC/PLAN.

Do not rely on traceability alone to carry cross-cutting obligations. If a frontier depends on a subsystem or verification model that is easy to miss from bare id references, restate it succinctly in the frontier definition.

## Output

Write or update `memory/PLAN.md` using the [plan template](assets/plan-template.md).

## Routing

After writing the plan, present these options to the user (use `tool-ask-question`):

| #   | Label             | Target       | Why |
| --- | ----------------- | ------------ | --- |
| 1   | Scope next slice  | `ln-scope`   | The frontier is clear and ready to scope |
| 2   | Design oracles    | `ln-oracles` | Verification design needs explicit work |
| 3   | Spike first       | `ln-spike`   | A load-bearing assumption should be retired before scoping |
| 4   | Grill it more     | `ln-grill`   | Planning surfaced unresolved product questions |
| 5   | Back to triage    | `ln-consult` | Direction needs reassessment |

Recommended: **1** unless tracer-bullet sequencing surfaced a question that no buildable frontier could answer cheaper than a spike (then **3**).
