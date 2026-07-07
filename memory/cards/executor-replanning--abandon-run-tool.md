# Executor Replanning Abandon Run Tool

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: explicit HITL action execution for abandoning an executor run.
- Builds on: retry eligibility and recommendation helpers, which already surface `abandon_run` as an allowed action for active runs.
- Posture: proving.

## Target Behavior

Execute mode exposes `execute_replan_abandon_run`, which marks a non-terminal run abandoned without deleting worktree, reports, Petri, promotion, or graph state.

## Acceptance Criteria

- Add `abandoned` run metadata status plus optional reason/timestamp fields.
- Core helper refuses missing and already-terminal runs; already-abandoned is idempotent.
- Tool accepts `runId` and optional reason.
- Tool writes only `run.json` and preserves prior evidence paths/files.
- Retry eligibility treats abandoned runs as terminal/inspect-only.

## Verification Approach

- Core tests for missing, terminal refusal, idempotent already-abandoned, and successful abandon.
- Registry/tool test for successful abandon.
- Gate: `npm run verify`.

## Non-goals

- No artifact deletion or cleanup.
- No graph mutation.
- No replacement run creation.
