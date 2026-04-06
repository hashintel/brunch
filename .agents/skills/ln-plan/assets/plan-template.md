<!-- PLAN.md — single source of truth for WHAT we're doing next.
     Created by ln-plan · Read by all skills · Updated by ln-sync, ln-build, ln-spike, ln-oracles.
     Authority: phases, slices, spikes, ordering, status, and traceability to SPEC.md.

     Re-run ln-plan frequently to retire completed slices, occasionally to add new ones.
     Every slice and spike names its dependent requirements and assumptions from SPEC.md.
     Invalidating an assumption in SPEC surfaces every slice it touches here.
     Respect local project protocols for issue/ticket mapping and branch naming, if any,
     but keep that metadata optional and secondary to the slice itself. -->

# Plan

<!-- Phases are temporal groups, ordered. Within each phase, slices and spikes are ordered
     by uncertainty first, dependency second (retire risk early).
     Status: not-started | in-progress | done -->

## Phase 1: [name]

<!-- [Brief rationale for this phase grouping] -->

### Slices

1. **[Slice name]** — [why this, why now] `[status: not-started|in-progress|done]`
   - Requirements: [→ SPEC.md §Requirements #N, #N]
   - Assumptions: [→ SPEC.md §Assumptions A1, A2]
   - Candidate invariant goals: [structural property this slice should establish; assign I# after build/spike if proven]
   - Invariants to respect: [→ SPEC.md §Invariants I#, I# | none]
   - Acceptance: [observable, testable target]
   - Verification approach: [inner/middle/outer oracle family summary, or `to be designed`]
   - Invariants established: [I# | none yet]
   - Execution tracking (optional): [issue/ticket code, branch name, or other local protocol metadata]

### Spikes

1. **[Spike name]** — [question to answer] `[status: not-started|in-progress|done]`
   - Assumptions: [→ SPEC.md §Assumptions being tested]
   - Decision unlocked: [what this spike informs]
   - Execution tracking (optional): [issue/ticket code, branch name, or other local protocol metadata]

## Phase 2: [name]
...

## Dependencies

<!-- Blocking relationships between slices. Update when slices are added or retired. -->

```
[ASCII diagram of blocking relationships]
```

### Parallelism opportunities

- [Slices that are currently unblocked and can proceed concurrently]
