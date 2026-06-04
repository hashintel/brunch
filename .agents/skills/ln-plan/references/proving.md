# Planning posture: proving

Load this reference when the active frontier item declares `Certainty: proving`, or when the project's `.pi/POSTURE.md` declares `certainty: proving` and the frontier inherits.

## Objective function

Optimize for **information gain**. The next frontier should *tell you the most* about what is still unknown. Landing is valuable when it falsifies, retires, or locates a load-bearing belief — not when it merely produces visible output.

## Tracer-bullet sequencing

A good tracer-bullet frontier scores on at least one of three convergent axes:

- **Proof of life.** Landing it lights up an end-to-end path that did not exist.
- **Invariants.** Landing it locates or stabilizes a seam that future slices will aim from.
- **Uncertainty.** Landing it retires a load-bearing assumption from `memory/SPEC.md` §Assumptions.

The strongest next frontier scores on more than one axis. Prefer a slice that does several at once over one that maximizes a single axis.

When ranking candidates, weigh:

- **blast radius** if a load-bearing assumption turns out false
- **reversibility cost** if discovered late vs early
- **validation cost** (cheap slice vs expensive end-to-end rework)
- **load-bearingness** (how many active/next frontiers depend on it)

## Required annotation fields

Every `Active` / `Next` frontier under proving posture must carry at least one of:

- `Retires: <SPEC assumption id(s)>` — collapses the assumption by landing
- `Depends on: <SPEC assumption id(s)> (validated enough)` — assumption must be settled first
- `Blocked by: <SPEC assumption id(s)>` — load-bearing; do not start until retired
- `Lights up: <pipeline / seam>` — establishes a new end-to-end path
- `Stabilizes: <invariant id(s) or seam>` — locates or fixes structure others will aim from

If none of these apply, the frontier is not earning its slot under proving posture. Either reshape it, demote it to `Horizon`, or reclassify — it may actually be earned-posture work mislabelled as proving.

## Epistemic horizon

If live low-confidence assumptions block downstream work, **stop the plan at that boundary**. Plan spikes or thinner proving frontier items, not fantasy certainty. Sequencing past fog is the most expensive form of premature commitment.

## Reshape, don't defer

If an assumption blocks a slice, reshape the slice before switching to study. A tracer bullet that breaks when the assumption is wrong almost always beats a study step in this codebase.

"High-impact" means the assumption being false would force rework across more than the slice — invalidating queued cards, changing the chosen module shape from `ln-design`, or forcing a different frontier-level sequencing decision.

## Spike exception

Use `ln-spike` only when no buildable frontier could carry the proof more cheaply — a third-party API contract, vendor performance characteristic, or research-grade unknown. Do not insert ceremonial spikes when a tracer-bullet frontier exists.

## Fire the tracer that tells you the most

Under proving posture, attack uncertainty by building. Spikes, design passes, and prototypes are escape hatches; the default is a slice whose landing falsifies the load-bearing belief.

This sequencing pressure is distinct from the **Epistemic horizon** rule above. Horizon tells the planner to *stop* at fog; this rule tells the planner to **fire the tracer that retires the next fog patch**.
