# Executor Replanning Recommendation

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: read-only human-facing recommendation over executor retry eligibility.
- Builds on: `executor-replanning--retry-eligibility.md`.
- Posture: proving.
- Trigger: retry eligibility returns allowed actions, but the HITL frontier needs a concise diagnosis and recommended next move before exposing a user-facing decision surface.

## Target Behavior

Executor can translate run freshness + lifecycle eligibility into a concise diagnosis, recommended action, and allowed alternatives without mutating any run state.

## Boundary Crossings

→ retry eligibility result
→ human-readable diagnosis
→ recommended HITL action

## Acceptance Criteria

- Add a read-only helper that returns diagnosis text, recommended action, and allowed actions for a run.
- Missing runs recommend starting a new run.
- Fresh active runs recommend retrying the current step.
- Stale early runs recommend regenerating the plan.
- Stale started runs recommend starting a new run.
- Terminal runs recommend inspection only.

## Verification Approach

- Inner: focused Vitest for recommendation mapping.
- Gate: `npm run verify`.

## Expected Touched Paths

```text
src/executor/
├── run-replan-recommendation.ts              + read-only recommendation helper
├── __tests__/run-replan-recommendation.test.ts + mapping coverage
└── TOPOLOGY.md                               ~ document helper
```

## Non-goals

- No user-facing tool/UI surface.
- No execution of the recommended action.
- No run mutation or supersession.
