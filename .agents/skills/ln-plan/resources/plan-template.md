<!-- PLAN.md — the single source of truth for WHAT we're doing next.
     Created by ln-plan · Read by all skills · Updated by ln-sync, ln-build, ln-spike.
     Authority: phases, slices, spikes, ordering, status, and traceability to SPEC.md.

     Phases are temporal groups. Within each phase, slices and spikes are ordered
     by uncertainty first, dependency second (retire risk early).
     Every slice and spike names its dependent requirements and assumptions from SPEC.md.
     This is the bridge — invalidating an assumption in SPEC surfaces every slice it touches here. -->

# Plan

## Phase 1: [name]

### Slices

1. **[Slice name]** — [why this, why now] `[status: not-started|in-progress|done]`
   - Requirements: [→ SPEC.md §Requirements]
   - Assumptions: [→ SPEC.md §Assumptions]

### Spikes

1. **[Spike name]** — [question to answer] `[status: not-started|in-progress|done]`
   - Assumptions: [→ SPEC.md §Assumptions being tested]

## Phase 2: [name]
...
