# Intent → Design Projection

Use when accepted intent-plane anchors need implementation shape: modules, interfaces, entities, sketches, ownership seams, dependency directions, or implementation topology.

## Derivation job

```pseudo
chain intent-to-design
  read accepted intent anchors and nearby constraints/criteria
  group anchors by design pressure
  derive 2-3 downstream design candidates
  compare boundary, dependency direction, misuse risk, and graph-anchor coverage
  present_candidates
  request_response
  if graph commitment is warranted:
    draft through map/review-set guidance
    present_review_set
    request_response
```

A design projection is not free architecture. It must answer: what implementation shape is forced, suggested, or ruled out by accepted intent?

## Candidate content

Each candidate should name:

- upstream anchors it realizes or protects
- owned responsibility and what stays outside the boundary
- public interface or caller contract, if one is implied
- dependency direction and data/model responsibility
- constraints or invariants that shape the seam
- failure/misuse path that the design must resist
- what remains unresolved before graph commitment

Use `graph_refs` only for existing graph node references. Put assumptions and uncertainty in prose.

## Commitment boundary

When the user recognizes a direction, draft graph material only through `map` / review-set guidance. Typical output may include design-plane modules, interfaces, entities, sketches, and connecting edges such as realization, dependency, composition, refinement, or exclusion — but the current map/schema guidance owns exact legality and role names.

Do not create a design node without an accepted intent anchor unless you explicitly route it as advisory material or a scratchpad obligation needing validation.
