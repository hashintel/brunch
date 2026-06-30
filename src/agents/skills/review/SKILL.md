---
name: review
description: Evaluate selected-spec material for weaknesses, gaps, blind spots, or change risk before further commitment. Use when the agent should critique what already exists rather than orient, ingest, map, or propose.
---

# review

Use this skill when the next move is to examine existing selected-spec material critically rather than ask, capture, or project new material.

If you do not already understand the local spec state, use `analyze` first or inline its reading discipline before judging anything.

## Procedure

```text
chain review:
  current selected-spec material
    -> orient enough to judge the local surface
    -> test it for grounding, coherence, coverage, and checkability
    -> separate contradictions from missing support
    -> report concrete findings with the smallest next move
```

## Use It For

- Checking whether current selected-spec material is coherent enough to trust
- Surfacing unresolved gaps, conflicts, or verification debt
- Helping the user judge whether to proceed, revise, or gather more information
- Stressing a local requirement, design seam, oracle story, or plan slice for weak spots

## Do Not Use It For

- Replacing capture with endless critique
- Pretending every review concern is a contradiction that needs immediate repair
- Expanding into broad architectural analysis when the current review question is local
- Re-doing `analyze` from scratch when the real task is to make a judgment call

## Working Style

1. Review what is already there before inventing what should be there.
2. Prefer concrete findings tied to selected-spec material.
3. Separate missing evidence from actual contradiction.
4. Check whether the material is grounded, internally coherent, adequately covered, and actually judgeable.
5. Recommend the smallest next move that improves confidence.

## Notes

- This is the live home for durable review guidance.
- `review` is evaluation layered on top of orientation, not a separate context-reading system.
- It is independent of the suspended legacy lens/method taxonomy.
