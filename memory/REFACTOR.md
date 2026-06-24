# Refactor: FE-885 exec-progress tidy-up

Derivative execution aid. Delete when complete or superseded.

## Problem Statement

The FE-885 producer landed clean, but `ln-review` surfaced four low-impact rough edges in the orchestrator-side projection code:

1. **Duplicated spec-graph normalization** — `projectPlanFromSpec` and `buildPlanSpec` each walk the snapshot's `verifies` edges independently and each sort by kind ordinal. Two readers must stay in lockstep on edge semantics and ordering, and the `verifies` adjacency is built twice (once requirement→criteria, once criterion→requirement-refs).
2. **Id helpers bypassed** — `requirementItemId`/`criterionItemId` were introduced for slice-id-space identity, but `projectPlanFromSpec` still inlines the `req-<id>` literal, so id construction has two forms.
3. **Dead disposition distinction** — `slicesNeedingReview` records `rework` in its last-write-wins map, but `rework` and absence collapse to the same (excluded) output, so the distinction carries no behavior today.
4. **Redeclared result shape** — `ExecProgress.run_status` / `reason` re-type `OrchestratorResult`'s `status` / `reason` as literals instead of deriving them, so they can silently drift if the engine adds a terminal status.

None changes runtime behavior; all are clarity/locality debt.

## Solution

One source of truth for spec→plan identity and the `verifies` walk; helper-based id construction everywhere; `slicesNeedingReview` says only what it means; and `ExecProgress` derives its run-status facet from the engine result type so the two cannot drift.

## Commits

1. Use the `requirementItemId` / `criterionItemId` helpers wherever `req-<id>` / `crit-<id>` identity is constructed, replacing the remaining inlined literal in the spec→plan projection. (Finding #2)
2. Derive the execution-progress snapshot's run-status and reason facets from the orchestrator result type instead of redeclaring the literal union. (Finding #4)
3. Extract the snapshot's `verifies`-edge walk and kind-ordinal ordering into one shared internal pass that both the plan projector and the spec-block builder consume. (Finding #1)
4. Simplify the needs-review fold so it tracks only the human-attention signal, with a one-line note that the rework lane is reserved for the Phase-3 assessor. (Finding #3)

Each commit leaves `check` + the orchestrator suite green.

## Decisions

- Spec→plan identity (`req-<id>` / `crit-<id>`) has exactly one construction site (the existing helpers).
- The snapshot `verifies` adjacency and kind-ordinal ordering are walked once and shared by both the plan projector and the `Plan.spec` builder.
- `ExecProgress` run-status/reason are type-derived from `OrchestratorResult`, not independently declared.
- `slicesNeedingReview` returns only `needs-human-review` slices; `rework` is documented-as-reserved, not tracked.

## Testing Decisions

- No new behavior, so existing tests are the oracle: `plan-projection.test.ts` (both `projectPlanFromSpec` and `buildPlanSpec`), `exec-progress.test.ts` (needs-review mapping + run_status), and `engine-contract.test.ts` #1b (inertness) must stay green unchanged.
- Good test here = observable output identity (same projected `Plan`, same `Plan.spec`, same `ExecProgress`), not internal call shape. Do not add tests asserting the new shared helper's existence — assert through the public functions.

## Out of Scope

- The criterion `covered` proxy semantics (scheduling vs. target existence) — already documented as structural; not changed here.
- Any change to the wire format of `plan.yaml` or `exec-progress.json`.
- The consuming UI (separate downstream frontier).
- Activating the `needs-review` / `rework` semantics (Phase-3 assessor).
