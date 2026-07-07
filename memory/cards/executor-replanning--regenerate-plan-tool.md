# Executor Replanning Regenerate Plan Tool

Frontier: executor-replanning
Linear:   FE-1114
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: explicit HITL action execution for refreshing a stale early-run plan.
- Builds on: retry eligibility and plan provenance.
- Posture: proving.

## Target Behavior

Execute mode exposes `execute_replan_regenerate_plan`, which rewrites `plan.yaml` and provenance only when an early run is stale and the current graph projection is plan-ready.

## Acceptance Criteria

- Tool accepts `runId` and optional mode.
- Tool refuses fresh, missing, terminal, and already-started stale runs.
- Tool refuses blocked current projections without writing.
- Tool writes fresh plan/provenance for early stale runs and does not mutate run metadata.

## Verification Approach

- Registry/tool tests for successful regeneration, blocked projection, and disallowed fresh run.
- Gate: `npm run verify`.

## Non-goals

- No full-run retry after regeneration.
- No run mutation or supersession.
