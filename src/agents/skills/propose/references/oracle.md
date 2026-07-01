# Oracle Proposals

Use when accepted intent/design needs alternative verification strategies, oracle families, fixture/probe designs, evidence plans, or blind-spot disclosures. Oracle proposal generates verification-design source material; it does not add graph fields or create a bespoke commit path.

## Fan-in rule: compose

Verification alternatives are additive. One oracle family may catch semantic drift, another schema breakage, and another human-review ambiguity. Compose the weakest sufficient ensemble after user recognition.

```pseudo
chain oracle-proposal
  read claims/invariants/design anchors + observable surfaces
  fan_out oracle ensembles, not isolated checks
  compare observability, reproducibility, controllability, cost, coverage, and blind spots
  present_candidates
  request_response
  compose in reasoning
  if graph material is warranted:
    draft through map/review-set guidance
    present_review_set
    request_response
    commit only after approval
```

Do not add an oracle-specific tool, schema field, multi-select affordance, or graph metadata such as `checkability`/`strength`. If the plane truly cannot compose without a new affordance, surface that as a D96-L falsifier instead of inventing local payload shape.

## Candidate ensemble content

Each ensemble should name:

- **Observability** — what behavior or artifact can be seen.
- **Reproducibility** — whether the observation can be replayed or fixture-backed.
- **Controllability** — which inputs, prompts, state, or environment can be pinned.
- **Oracle family** — schema/static check, fixture/golden, property/model-based, probe/transcript, visual/manual review, or a locally justified family.
- **Fixture/probe commitments** — artifacts that must be kept, refreshed, or run.
- **Loop tier** — inner, middle, or outer, with verification economics named.
- **Evidence breadth** — reviewed, example-backed, regression-covered, enforced, or proved, as prose rather than graph metadata.
- **Blind spots** — misses, false positives, and revisit triggers.

Use the D31-L verification-design rubrics while comparing:

- legibility / cost-of-knowing: oracle weight to read, run, and maintain
- failure modes: what the oracle misses or misreads
- coverage / range: claims, invariants, or user-facing behaviors covered
- commitment: infrastructure cost, fixture commitment, and run time

## Review-set boundary

Oracle commitments become graph material only through the current review-set path. Express checks, criteria, evidence obligations, fixture/probe commitments, witness/rationale edges, and blind spots using graph vocabulary owned by `map` and graph schema/policy. Do not present an implementation task as an oracle unless it names the observation that discriminates success from failure.
