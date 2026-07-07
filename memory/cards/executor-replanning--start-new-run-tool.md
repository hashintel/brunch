# Executor Replanning Start-New-Run Tool

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: explicit HITL action execution for starting a fresh run from a prior run.
- Builds on: `executor-replanning--run-supersession.md`.
- Posture: proving.
- Trigger: recommendations can return `start_new_run`, and the core can create a superseding run, but Execute mode has no explicit tool to perform that action.

## Target Behavior

Execute mode exposes a bounded `execute_replan_start_new_run` tool that creates a new run linked to a prior run only when the current plan is fresh and launch-ready.

## Acceptance Criteria

- Tool accepts `previousRunId`, optional deterministic `runId`, and optional mode.
- Tool computes current graph projection, delegates to `createSupersedingRun`, and returns side-effect details honestly.
- Tool is admitted in executor active tools and reported by `execute_status`.
- Tool does not mutate the previous run or execute the new run.

## Verification Approach

- Registry/tool test for successful linked run creation.
- Gate: `npm run verify`.

## Non-goals

- No auto-regeneration of stale plans.
- No retry-current-step action execution.
- No UI beyond the tool surface.
