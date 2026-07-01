# Design Proposals

Use when accepted intent needs alternative module shapes, interface boundaries, ownership seams, dependency directions, or implementation topologies. Design proposal is not a direct architecture write; it creates candidate source material, then synthesizes only after user recognition.

## Fan-in rule: synthesize

Fan out radically different shapes, present them for recognition, then synthesize the chosen direction and useful contrasting insights into a reviewable draft only if graph commitment is warranted.

```pseudo
chain design-proposal
  read accepted intent anchors + relevant graph neighborhood
  fan_out 2-3 meaningfully different design shapes
  compare depth, locality, leverage, misuse risk, specialization, and epistemic cost
  present_candidates
  request_response
  synthesize in reasoning
  if graph material is warranted:
    draft through map/review-set guidance
    present_review_set
    request_response
    commit only after approval
```

Do not add a synthesize-specific tool, schema field, or multi-select affordance. Synthesis is reasoning between candidate recognition and the review-set draft.

## Candidate shape

Each candidate should name:

- ownership boundary and what it hides
- public interface or caller contract
- dependency direction
- data/model responsibility
- happy path and likely misuse path
- implementation efficiency and migration cost
- what accepted intent it realizes or stresses
- what future design decisions it would lock in

Use `graph_refs` only for existing intent/design/oracle nodes that anchor the candidate. Cite active graph/render surfaces for vocabulary instead of copying node-kind or edge-category lists into this reference.

## Synthesis conduct

When synthesizing, keep the chosen direction coherent. Borrowing an insight from a losing candidate is legitimate only when it does not invert the winning candidate's boundary or dependency direction.

If a design alternative exposes a missing product requirement, do not smuggle it in as architecture. Route it to `elicit` or `map` as an intent assumption or scratchpad obligation that needs validation.

## Review-set boundary

Design commitments become graph material only through the current review-set path. Draft modules, interfaces, design assumptions, realization edges, dependency edges, and boundary constraints in graph vocabulary owned by `map` and graph schema/policy. Avoid speculative architecture nodes with no accepted intent anchor.
