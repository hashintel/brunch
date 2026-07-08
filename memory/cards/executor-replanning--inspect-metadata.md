# Executor Replanning Inspect Metadata

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: read-only run inspection surfaces.
- Builds on: run supersession and abandon actions.
- Posture: proving.

## Target Behavior

Run list/detail projections expose replanning metadata written by HITL actions so `inspect_run` can explain abandoned and superseding runs.

## Acceptance Criteria

- `listRuns` and `readRunDetail` include `supersedesRunId`, `abandonedAt`, and `abandonReason` when present.
- RPC execute schemas admit those optional fields.
- Existing unreadable/missing behavior is unchanged.

## Verification Approach

- Focused observer-read tests for abandoned and superseding run metadata.
- Gate: `npm run verify`.

## Non-goals

- No new web UI layout.
- No mutation/action tools.
