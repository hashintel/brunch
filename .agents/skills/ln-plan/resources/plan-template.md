<!-- PLAN.md — single source of truth for WHAT we're doing next.
     Created by ln-plan · Read by all skills · Updated by ln-sync, ln-build, ln-spike.
     Authority: phases, slices, spikes, ordering, status, and traceability to SPEC.md.

     Re-run ln-plan frequently to retire completed slices, occasionally to add new ones.
     Every slice and spike names its dependent requirements and assumptions from SPEC.md.
     Invalidating an assumption in SPEC surfaces every slice it touches here. -->

# Plan

<!-- Phases are temporal groups, ordered. Within each phase, slices and spikes are ordered
     by uncertainty first, dependency second (retire risk early).
     Status: not-started | in-progress | done -->

## Phase 1: [name]

<!-- [Brief rationale for this phase grouping] -->

### Slices

1. **[Slice name]** `[ISSUE-ID]` — [why this, why now] `[status: not-started|in-progress|done]`
   - Requirements: [→ SPEC.md §Requirements #N, #N]
   - Assumptions: [→ SPEC.md §Assumptions A1, A2]
   - Acceptance: [observable, testable target]
   - Branch: `[branch-name]`

### Spikes

1. **[Spike name]** `[ISSUE-ID]` — [question to answer] `[status: not-started|in-progress|done]`
   - Assumptions: [→ SPEC.md §Assumptions being tested]
   - Branch: `[branch-name]`

## Phase 2: [name]
...

## Dependencies

<!-- Blocking relationships between slices. Update when slices are added or retired. -->

```
[ASCII diagram of blocking relationships]
```
