# Executor Replanning Retry Current Step Tool

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: explicit HITL action execution for retrying the current ready executor step.
- Builds on: retry eligibility and the existing `drive()` loop.
- Posture: proving.
- Trigger: recommendations can return `retry_current_step`, but Execute mode has no guarded action that executes just that next step.

## Target Behavior

Execute mode exposes a bounded `execute_replan_retry_current_step` tool that advances exactly one ready lifecycle step only when the run is fresh and retry-eligible.

## Acceptance Criteria

- Tool accepts `runId` and optional mode.
- Tool refuses stale/missing/terminal runs using retry eligibility.
- Tool advances exactly one scheduler-ready step when eligible.
- Tool reports the drive outcome and does not loop to full promotion.

## Verification Approach

- Registry/tool test for one-step retry from `created` to `worktree_created`.
- Registry/tool test for stale run refusal.
- Gate: `npm run verify`.

## Non-goals

- No automatic plan regeneration.
- No full-run orchestration; `execute_orchestrate` remains the full-drive tool.
