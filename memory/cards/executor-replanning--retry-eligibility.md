# Executor Replanning Retry Eligibility

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: read-only HITL retry/replan classification for existing executor runs.
- Builds on: `executor-replanning--run-freshness.md`.
- Posture: proving.
- Trigger: run freshness tells whether the run's plan matches current graph truth; the next question is which actions are safe to offer the human.

## Target Behavior

Executor can say whether a run may be retried as-is, needs a fresh plan before retry, or must start a new run because execution evidence already exists.

## Boundary Crossings

→ run freshness diagnosis
→ run lifecycle status
→ allowed HITL action set

## Acceptance Criteria

- Add a read-only helper that combines `checkRunFreshness` with `run.json.status`.
- Fresh non-terminal runs allow retrying the current step.
- Stale early runs allow regenerating the plan before retry.
- Stale runs with execution evidence require starting a new run instead of mutating the existing run plan.
- Terminal runs do not offer retry/replan mutation actions.
- Missing run returns a typed status and safe create/new-run action.

## Verification Approach

- Inner: focused Vitest for each status/action class.
- Gate: `npm run verify`.

## Expected Touched Paths

```text
src/executor/
├── run-retry-eligibility.ts              + read-only classifier
├── __tests__/run-retry-eligibility.test.ts + status/action coverage
└── TOPOLOGY.md                           ~ document helper
```

## Non-goals

- No user-facing HITL prompt.
- No run mutation.
- No automatic retry, replanning, or supersession execution.
