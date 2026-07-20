---
name: review
description: Evaluate selected-spec material for weaknesses, gaps, blind spots, or change risk before further commitment. Use when the agent should critique what already exists or what has been proposed rather than orient, ingest, map, or propose.
---

# review

Use this skill when the next move is to examine accepted or proposed selected-spec material critically rather than ask, capture, or generate new material. Review is a judgment pass over graph meaning; it is not permission to rewrite graph truth by yourself.

If you do not already understand the local spec state, use `analyze` first or inline its edge-local reading discipline before judging anything.

## Procedure

```pseudo
chain review
  accepted or proposed selected-spec material
  -> orient enough to judge the local surface
  -> test grounding, coherence, coverage, checkability, and change risk
  -> separate missing support from contradiction
  -> choose the smallest next move: ask | propose repair | route to map | record conflict
```

## Use It For

- Checking whether current selected-spec material is coherent enough to trust.
- Surfacing unresolved gaps, conflicts, weak support, or verification debt.
- Helping the user judge whether to proceed, revise, gather more information, or reject a proposal.
- Stressing a local requirement, design seam, oracle story, or plan scope for weak spots.

## Do Not Use It For

- Replacing capture with endless critique.
- Inventing new graph truth to close the gap.
- Pretending every review concern is a contradiction that needs immediate repair.
- Adding or resolving scratchpad obligations automatically; audit output may route to scratchpad capture, but capture/mapping owns the write.
- Expanding into broad architectural analysis when the current review question is local.

## Plane heuristics

| Plane | Look for | Typical next move |
| --- | --- | --- |
| intent | goals with no requirements; requirements with no examples/criteria; high-fanout assumptions; decisions without rejected alternatives or rationale; conflicting boundaries; weak category support masquerading as certainty | ask one clarifier, propose a reviewable repair, or route accepted conflicts to reconciliation |
| design | unclear ownership; leaky interfaces; unbacked realization edges; dependency direction contradicting the module boundary; design claims with no accepted intent anchor; two modules owning the same fact; implementation preference posing as requirement | ask for boundary intent, mutation/projection owner, or hidden information; propose design alternatives; or route a graph repair through review-set drafting |
| oracle | claims without observation; criteria/methods without a concrete check; checks with no replay commitment; blind spots hidden by one oracle family; metrics with no claim they validate | ask what observation discriminates success from failure, propose an executable check ensemble, or route verification debt to graph/scratchpad handling |
| plan | scopes detached from claims/design/oracles; dependency order hiding risk; done definitions with no concrete check; handoff/recovery gaps | revise plan material or ask for the smallest missing check |

## Finding classes

```pseudo
rules review-finding-route
  missing support or unanswered question -> ask or route to scratchpad capture
  coherent repair candidate needing approval -> propose / present_review_set
  conflict with accepted graph truth -> reconciliation_need
  stale or illegal graph shape -> map-guided repair path
  merely adjacent concern -> name as out-of-scope unless it changes this decision
```

Name the class in the review output. This prevents low-confidence critique from laundering itself into hidden truth.

## Working Style

1. Review what is already there before inventing what should be there.
2. Prefer concrete findings tied to selected-spec material and graph relations.
3. Separate missing evidence from actual contradiction.
4. Check whether the material is grounded, internally coherent, adequately covered, and actually judgeable.
5. Recommend the smallest next move that improves confidence.

For Assurance review, planned `criterion` and `vv_method` must reach a concrete `check` through `realization`. A planned or unexecuted check is not proof: only observed material deliberately promoted as `evidence` may use `witness` to support or falsify a claim.

## Notes

- This is the live home for durable review guidance.
- `review` is evaluation layered on top of orientation, not a separate context-reading system.
- It is independent of the suspended legacy lens/method taxonomy.
