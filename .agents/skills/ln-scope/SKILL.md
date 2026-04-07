---
name: ln-scope
description: "Define one thin vertical slice with target behavior, risks, and acceptance criteria. Use when scoping the next piece of work before building, or when a slice from PLAN.md needs precise definition."
argument-hint: "[behavior to deliver in this slice]"
---

# Ln Scope

Define **one** tracer-bullet slice (Hunt & Thomas) — a thin end-to-end path, not a horizontal layer. If the target behavior needs "and", split it.

## Input

The behavior to deliver: $ARGUMENTS

If `memory/SPEC.md` exists, use its lexicon and respect its invariants.

**Parallelism check.** If `memory/PLAN.md` exists, check `## Dependencies` and `### Parallelism opportunities`. If the current state (completed slices) unblocks multiple slices, surface them: "Slices X and Y are both unblocked — which to scope?" If the user names one, note the other(s) as available for concurrent work (e.g. a separate agent thread or session).

## Scope Card

### Target Behavior

What is true when this slice is done? Single declarative sentence — observable, testable, no conjunctions.

### Boundary Crossings

Every boundary the slice passes through, entry to exit:
```
→ [entry point]
→ [layer/boundary]
→ [exit point]
```

### Risks and Assumptions

```
- RISK: [what might not work] → MITIGATION: [how to handle it]
- ASSUMPTION: [what we're assuming] → VALIDATE: [how we'll know] → [→ SPEC.md §Assumptions]
```

High-risk unvalidated assumption → suggest `ln-spike` before `ln-build`. New assumptions must be added to `memory/SPEC.md` §Assumptions.

### Acceptance Criteria

```
✓ [test name] — [observable assertion]
✓ [test name] — [observable assertion]
```

These become the spec tests written first in `ln-build`. Every criterion must be checkable by running a command.

### Verification Approach

Name the oracle strategy for this slice. If `memory/SPEC.md` §Oracle Strategy by Loop Tier exists, pick from the families already selected. If it doesn't, suggest running `ln-oracles` first unless the slice is trivial and purely structural, in which case naming the inner-loop checks directly may be sufficient.

```
- Inner: [oracle family] — [what it proves]
- Middle: [oracle family] — [what it proves] (if applicable)
- Outer: [oracle family] — [what it proves] (if applicable)
```

A slice without a verification approach is not fully scoped. At minimum, inner-loop oracles must be named. Middle/outer are required when the slice touches LLM boundaries, visual rendering, or compositional behavior. Those slices should run through `ln-oracles` before `ln-build`.

## Traceability (mandatory — do before routing)

After the scope card is complete, do these before presenting routing options:

1. New assumptions surfaced during scoping → add to `memory/SPEC.md` §Assumptions with links to this slice

## Routing

After traceability is complete, present these options to the user (use `tool-ask-question`):

| #   | Label          | Target       | Why                                                  |
| --- | -------------- | ------------ | ---------------------------------------------------- |
| 1   | Build it       | `ln-build`   | Slice is defined and its verification strategy exists |
| 2   | Design oracles | `ln-oracles` | Slice needs explicit oracle design before implementation |
| 3   | Spike first    | `ln-spike`   | Technical uncertainty needs resolution               |
| 4   | Revise spec    | `ln-spec`    | Scoping revealed the spec needs structural revision  |
| 5   | Revise plan    | `ln-plan`    | Slice doesn't fit the current plan                   |
| 6   | Back to triage | `ln-consult` | Scope revealed unclear state                         |

Recommended: **2** if the slice lacks oracle strategy and is not trivial/purely structural; otherwise **1** unless risks flagged a spike.
