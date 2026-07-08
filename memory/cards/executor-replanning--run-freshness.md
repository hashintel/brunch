# Executor Replanning Run Freshness

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: read-only freshness diagnosis for existing executor runs.
- Builds on: `executor-replanning--plan-freshness.md`, which made launch readiness provenance-aware before a run exists.
- Posture: proving.
- Trigger: once stale plans are blocked at launch, the next HITL replanning question is whether an existing run can be retried as-is or must route through replanning.

## Target Behavior

Executor can diagnose whether an existing run's plan is still fresh against the current graph projection without mutating run artifacts.

## Boundary Crossings

→ run metadata (`run.json`)
→ selected plan provenance
→ current graph projection stamp
→ typed retry/replan diagnosis

## Acceptance Criteria

- Add a read-only core helper that reads a run and compares its `planPath` provenance to the current projection stamp.
- Return typed statuses for missing run, invalid plan path, missing plan, missing provenance, stale plan, blocked projection, and fresh run.
- Preserve launch freshness as the single provenance comparison source where practical.
- Add focused tests for fresh, stale, missing provenance, missing run, and blocked projection.
- Do not implement mutation, run supersession, or a user-facing HITL prompt in this slice.

## Verification Approach

- Inner: focused Vitest for the run freshness helper.
- Gate: `npm run verify`.

## Expected Touched Paths

```text
src/executor/
├── run-freshness.ts              + read-only run freshness helper
├── __tests__/run-freshness.test.ts + status coverage
└── TOPOLOGY.md                   ~ document helper
```

## Non-goals

- No full replanning UI.
- No run mutation or supersession.
- No automatic retry/replan action execution.
