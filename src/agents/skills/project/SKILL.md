---
name: project
description: Derive downstream graph-plane material from accepted upstream graph anchors; use for intent-to-design or design-to-oracle projection without adding a new tool, schema family, or commit path.
---

# Project

Use `project` when accepted graph anchors should produce downstream plane candidates: intent commitments into design shape, or design commitments into oracle/evidence shape. Projection starts from graph material already accepted or explicitly selected for review; it is not ambient brainstorming and not a hidden `generate` mode.

`project` owns derivation conduct. It does **not** own graph expression, ontology tables, exchange schemas, or persistence. Use `present_candidates` and `request_response` for recognition, then hand exact graph drafts to current `map` / review-set guidance when commitment is warranted.

## Projection spine

```pseudo
chain project
  read accepted upstream anchors + edge-local neighborhood
  choose one projection lane
  derive downstream candidates with explicit anchor coverage
  present_candidates for recognition/comparison only
  request_response for the user's recognition input
  if exact graph drafts are warranted:
    load map/review-set guidance
    draft downstream nodes + connecting edges
    present_review_set
    request_response
    commit only after approval through the review-set path
```

`present_candidates` remains recognition only. Approval of a `present_candidates` direction is permission to refine or draft; graph truth changes only through the existing review-set acceptance path or another current graph mutation path owned by `map` / command-layer guidance.

## Lanes

| Lane | Use when... | Read |
| --- | --- | --- |
| intent → design | goals, requirements, constraints, invariants, decisions, or criteria need implementation shape | [`references/intent-to-design.md`](references/intent-to-design.md) |
| design → oracle | modules, interfaces, entities, or sketches need verification/evidence shape | [`references/design-to-oracle.md`](references/design-to-oracle.md) |

If the requested derivation crosses another lane, use the closest current lane and state the gap. Do not invent a new lane-specific tool or schema field inside the skill.

## Conduct rules

1. **Start from anchors.** Name the accepted upstream graph references that make the projection legitimate. If there are no anchors, route to `elicit`, `ingest`, or `propose` first.
2. **Derive, do not fan out from nothing.** Every downstream candidate should say which upstream anchor it realizes, witnesses, constrains, or stress-tests.
3. **Keep alternatives structural.** Candidate differences should expose different downstream consequences, not cosmetic wording.
4. **Separate recognition from commitment.** `present_candidates` helps the user choose a direction; `present_review_set` is the review surface for exact graph drafts.
5. **Delegate graph expression.** Use `map` references for node kinds, edge categories, detail payloads, and routing. Cite schema/render surfaces; do not copy ontology tables here.

## Stop signals

Stop and ask or route elsewhere when:

- the user is asking for same-plane alternatives with no upstream/downstream dependency (`propose`)
- the source material is unaccepted or not yet digested (`ingest` / `map` / `elicit`)
- a candidate would require a new product tool, exchange schema, direct graph-write path, or hidden projector runtime state
- downstream material cannot be grounded in the provided graph anchors without inventing facts
