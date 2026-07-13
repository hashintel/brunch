# Slice C — PR #325 composition witness

Frontier: executor-plan-synthesis
Status:   active
Mode:     slices
Created:  2026-07-13

## Orientation

- Seam: admitted synthesized plan (slice B) -> plan.yaml + contract -> run creation (contract verify target) -> drive() with petriScheduler + frontierFiringPolicy (PR #325 frozen topology) -> fan-in -> epic verification -> promotion gate.
- Frontier: executor-plan-synthesis (FE-1197); oracles 8 and 9.
- Posture: proving (inherited).

## Card C1 — Fixture-backed composition witness (oracle 8 + conformance)

### Target Behavior

An admitted synthesized plan with dependency-independent slices executes through PR #325's frozen topology with overlapping isolated slices, ordered fan-in, planner-driven epic verification using only contract-resolved commands, and a promotion gate that failed verification cannot pass.

### Full-card cold-start reads

```
- memory/PLAN.md — frontier: executor-plan-synthesis (oracles 8/9)
- src/executor/__tests__/orchestrate.test.ts — createRunAtCreatedWithPlan/fakePorts/parity harness
- src/executor/plan-synthesis.ts + plan-file.ts (admitted draft -> payload)
```

### Acceptance Criteria

```
✓ plan-synthesis-composition.test.ts — synthesized admitted plan (scripted planner) executes
  to promotion_prepared under petriScheduler + frontierFiringPolicy; both independent slices'
  agent effects overlap (barrier witness); worker requests carry the synthesized goal/done
  criteria and scope provenance; every verify invocation (slice + epic) uses exactly the
  contract-resolved command; fan-in and epic verification facts appear in the reports.
✓ plan-synthesis-composition.test.ts — the same plan with a failing verify verdict never
  reaches run_completed/promotion_prepared.
```

### Verification Approach

- Inner/Middle: the composition suite over real drive() with fake ports.
- Outer (owned, not ambient): the live Specify → committed scope → synthesized/admitted plan
  → PR #325 execution → promotion witness (oracle 9) requires a live provider session; it is
  owned by this frontier's acceptance and recorded per docs/praxis/manual-testing.md when a
  model-backed session drives it. Re-entry trigger: first live FE-1197 walkthrough.

### Expected touched paths (tentative)

```
src/executor/__tests__/plan-synthesis-composition.test.ts  +
```
