---
name: ln-plan
description: "Break a feature or project area into frontier items and update `memory/PLAN.md`. Re-run to retire completed work, reorder priorities, or add new items."
argument-hint: "[feature or project area to plan]"
---

# Ln Plan

Plan the **rolling frontier**, not the whole historical timeline.

`memory/PLAN.md` is the canonical record of what's next. `docs/archive/PLAN_HISTORY.md` is the only sanctioned archive for retired plan history. `memory/CARDS.md` is the sanctioned derivative queue for multiple prepared scope cards inside one frontier item; it is not canonical planning state. Do not invent other sidecar plan docs, milestone ledgers, or alternate memory locations without explicit permission.

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

Treat frontier items as branch-sized work, not commit-sized work. If one frontier item will unfold as several consecutive verified slices, keep that execution queue in `memory/CARDS.md` or in session context instead of fragmenting `memory/PLAN.md` into a commit ledger. `memory/PLAN.md` may carry at most a lightweight pointer such as `current card queue: memory/CARDS.md`; detailed discretionary sub-slicing belongs in `memory/CARDS.md`.

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

### Epistemic horizon

If live low-confidence assumptions block downstream work, stop the plan at that boundary. Plan spikes or thinner proving frontier items, not fantasy certainty.

### Tracer-bullet sequencing

Sequencing is not only seam-driven. A good tracer-bullet frontier scores on three convergent axes (see `docs/praxis/ln-skills.md` §Tracer-bullet sequencing): **proof of life**, **invariants**, **uncertainty**. The strongest next frontier scores on more than one.

When ranking candidates, weigh:

- **blast radius** if a load-bearing assumption turns out false
- **reversibility cost** if discovered late vs early
- **validation cost** (cheap slice vs expensive end-to-end rework)
- **load-bearingness** (how many active/next frontiers depend on it)

Annotate each `Active` / `Next` frontier definition with the relevant axes when they are in play:

- `Retires: <SPEC assumption id(s)>` — collapses the assumption by landing
- `Depends on: <SPEC assumption id(s)> (validated enough)` — assumption must be settled first
- `Blocked by: <SPEC assumption id(s)>` — load-bearing; do not start until retired
- `Lights up: <pipeline / seam>` — establishes a new end-to-end path
- `Stabilizes: <invariant id(s) or seam>` — locates or fixes structure others will aim from

**Spike exception.** Use `ln-spike` only when no buildable frontier could carry the proof. Do not insert ceremonial spikes when a tracer-bullet frontier exists.

This sequencing pressure is distinct from "Epistemic horizon": that rule tells the planner to *stop* at fog; this rule tells the planner to **fire the tracer that tells you the most**.

## Procedure

1. Read `memory/PLAN.md` if it exists. Identify existing frontier ids and retire/archive stale completed material into `docs/archive/PLAN_HISTORY.md`.
2. Read `memory/SPEC.md` if it exists. Pull only the live requirements, assumptions, decisions, and invariants that still constrain forward work.
3. Explore the codebase enough to understand real boundaries.
4. Draft or revise `Sequencing` (`Active`, `Next`, `Parallel / Low-conflict`, `Horizon`) by stable frontier id.
5. Draft or revise `Frontier Definitions` only for new or substantively changed frontier items.
6. Add `Why now / unlocks` in a frontier definition when ordering would otherwise be opaque to a fresh thread.
7. Keep `Recently Completed` to 2-3 terse items max. Move older history to `docs/archive/PLAN_HISTORY.md`, not to handoff files or ad hoc notes.
8. Update `Dependencies` to reflect only active / next items, by frontier id.
9. If several commit-sized execution steps are already obvious inside one frontier item, keep them out of `memory/PLAN.md`; they belong in `memory/CARDS.md` or in the active thread as derivative execution detail.

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
