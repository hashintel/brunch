# Executor Replanning Plan Freshness

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: executor plan artifact provenance and launch readiness (`execute_plan_file` -> `.brunch/cook/specs/<specId>/plan.yaml` -> `execute_launch`).
- Frontier: `executor-replanning` (FE-1114).
- Posture: proving.
- Trigger: transcript evidence showed `execute_plan_file` correctly blocking on current graph dependencies while `execute_launch` still reported `ready` from an older on-disk plan file.

## Target Behavior

Launch readiness is authoritative for the current graph, not merely for the existence of a bounded `plan.yaml` path.

## Full-card cold-start reads

- `memory/cards/executor-run-integrity--plan-projection.md` — dependency projection and blocking behavior this slice builds on.
- `src/executor/execute-projection.ts` — current source provenance carries `graphLsn` in memory.
- `src/executor/plan-file.ts` — plan payload writer and sibling provenance artifact.
- `src/executor/launch.ts` and `.pi/extensions/agent-runtime/execute-launch/index.ts` — freshness-aware launch readiness.
- `src/executor/TOPOLOGY.md` — executor side-effect and compatibility boundaries.

## Boundary Crossings

→ graph projection provenance
→ plan file artifact metadata
→ launch readiness check
→ execute-mode user-facing status text/details

## Risks and Assumptions

- RISK: embedding provenance directly in the old cook payload breaks compatibility with existing plan consumers. → MITIGATION: keep `plan.yaml` as the old-cook payload and write a sibling `plan.provenance.json` artifact.
- RISK: launch re-runs too much projection logic and stops being a cheap readiness check. → MITIGATION: launch compares current graph provenance to artifact provenance; `execute_plan_file` remains the writer/projection authority.
- ASSUMPTION: graph LSN is enough for freshness in the current single-spec, active-visibility projection. → VALIDATE: tests cover same LSN ready, newer graph stale, missing provenance stale, and blocked current projection does not become launch-ready through an old artifact.

## Posture Check

This is a proving tracer. It stabilizes the replanning invariant: a saved plan is launchable only if it is known to come from the current graph projection.

## Acceptance Criteria

- `execute_plan_file` persists provenance for the plan artifact, including at least spec id, graph LSN, projection visibility, and mode.
- `execute_launch` reports a non-ready stale/provenance-missing status when the selected plan artifact predates the current graph projection or lacks provenance.
- `execute_launch` does not report `ready` if the current projection is blocked, even when an older plan file exists.
- Existing bounded-path protection remains: explicit plan paths outside `.brunch/cook/specs/<specId>/plan.yaml` are rejected before probing.
- User-facing `execute_launch` output distinguishes `missing_plan`, `missing_provenance`, `stale_plan`, `blocked_projection`, and `ready`.

## Verification Approach

- Inner: focused Vitest around `plan-file.ts` / `launch.ts` for provenance write/read and stale detection.
- Adapter: registry execute-launch test proving tool details expose stale vs ready honestly.
- Regression: construct an old ready plan, mutate the graph so the current executable projection changes or becomes blocked by true plan-input errors, and assert launch is stale/blocked rather than ready.
- Gate: `npm run verify`.

## Cross-cutting Obligations

- Preserve old-cook compatibility: the runnable plan payload remains consumable by existing run lifecycle code.
- Preserve executor side-effect honesty: launch remains read-only.
- Preserve plan-projection authority: plan artifacts are written only after `assertExecuteProjectionPlanReady` passes.

## Expected Touched Paths

```text
src/executor/
├── plan-file.ts          ~ provenance write/read helper and sibling artifact path
├── launch.ts             ~ freshness-aware readiness
└── __tests__/
    ├── plan-file.test.ts ~ provenance persistence
    └── launch.test.ts    ~ stale/current/blocked readiness
src/.pi/extensions/agent-runtime/
├── execute-launch/index.ts ~ expose freshness status/details
├── execute-plan-file/index.ts ~ write provenance beside plan
└── ../__tests__/registry.test.ts ~ adapter oracle
src/executor/TOPOLOGY.md ~ document launch freshness contract
```

## Non-goals

- No full replanning UI.
- No decision about how to recover an already-started run after graph mutation.
- No Petri scheduler or parallel execution change.
- No graph repair automation for invalid dependency edges.
