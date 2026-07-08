# Executor Replanning Run Supersession

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: bounded creation of a fresh executor run linked to a prior run.
- Builds on: run freshness, retry eligibility, and recommendation helpers.
- Posture: proving.
- Trigger: recommendations can say `start_new_run`, but there is no safe core path that creates the new run while preserving prior-run evidence.

## Target Behavior

Executor can create a fresh run from the current launch-ready plan while recording which prior run it supersedes, without mutating the prior run.

## Boundary Crossings

→ prior run metadata read
→ current plan launch readiness
→ new run metadata write

## Acceptance Criteria

- Add a core helper that creates a new `created` run with `supersedesRunId` set to the prior run id.
- Refuse supersession when the prior run is missing.
- Refuse supersession when the current plan is not launch-ready.
- Refuse overwriting an existing target run id.
- Do not mutate the prior run metadata.

## Verification Approach

- Inner: focused Vitest for success and refusal states.
- Gate: `npm run verify`.

## Expected Touched Paths

```text
src/executor/
├── run.ts                         ~ metadata field
├── run-supersession.ts             + helper
├── __tests__/run-supersession.test.ts + coverage
└── TOPOLOGY.md                     ~ document helper
```

## Non-goals

- No user-facing tool surface yet.
- No mutation/marking of the previous run.
- No automatic regeneration of a stale plan.
