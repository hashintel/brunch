# Design → Oracle Projection

Use when accepted design-plane anchors need verification shape: checks, methods, evidence, obligations, probe/fixture plans, witness edges, or blind-spot disclosures.

## Derivation job

```pseudo
chain design-to-oracle
  read accepted design anchors and the intent they realize
  identify observable behavior or artifact surfaces
  derive oracle candidates or ensembles
  compare observability, reproducibility, controllability, cost, and blind spots
  present_candidates
  ask(continues)
  if graph commitment is warranted:
    draft through map/review-set guidance
    present_review_set
    ask(continues)
```

An oracle projection is not a task list. It must name the observation that would discriminate success from failure for the design and its upstream intent.

## Candidate content

Each candidate should name:

- design anchor under test and the intent/criterion it protects
- observable surface: API, graph mutation, transcript, prompt manifest, UI, fixture, or build artifact
- oracle family: static/schema check, regression/golden, property/model-based, probe/transcript, manual/visual review, or locally justified equivalent
- controllable inputs/state and what cannot be pinned
- fixture or promoted-run commitment, if any
- failure mode or blind spot that remains
- weakest sufficient loop tier: inner, middle, or outer

Express evidence breadth in prose. Do not invent stored fields for strength, confidence, or checkability.

## Commitment boundary

When graph drafts are warranted, use current `map` / review-set guidance for oracle-plane node kinds, witness/realization edges, and exact batch shape. A review-set batch is the commitment surface; candidate recognition alone never creates accepted graph truth.
