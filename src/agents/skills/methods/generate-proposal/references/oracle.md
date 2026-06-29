# Oracle Plane

Use this reference when the active lens is `oracle` and the user needs alternative verification strategies, oracle families, fixture/probe designs, evidence plans, or blind-spot disclosures for already-accepted intent and design material. Keep this distinct from the extractive `oracle` lens: the lens asks what would prove a claim; this method generates reviewable oracle-plane material.

The oracle plane fan-in move is **compose**. Verification-design alternatives are additive: one family may catch semantic drift, another may catch schema breakage, and another may make human judgment repeatable. Redundancy across independent oracle families is a feature when it reduces bad degrees of freedom at acceptable cost.

Fan out oracle ensembles, not isolated checks. Choose the weakest sufficient oracle artifact for the claim at hand: human review, concrete example/counterexample, regression or golden, runtime contract, property/model-based rule, probe/transcript, or proof obligation. Treat that as verification conduct only — do not add graph node fields such as `checkability`, `strength`, or trace lists.

Each candidate should name:

- **Observability**: what the system exposes that lets the oracle see the behavior.
- **Reproducibility**: whether the observation can be replayed or fixture-backed.
- **Controllability**: what inputs, prompts, state, or environment can be pinned.
- **Oracle family**: schema/static check, fixture/golden, property/model-based, probe/transcript, visual/manual review, or another locally justified family.
- **Fixture/probe commitments**: what artifacts must be kept, refreshed, or run to make the oracle repeatable.
- **Loop tier**: inner, middle, or outer, with verification economics named.
- **Evidence breadth**: whether the claim is reviewed, example-backed, regression-covered, enforced, or proved, without storing that breadth as graph metadata.
- **Blind spots**: what the oracle misses, its false-positive shape, and the trigger for revisiting it.

Use the D31-L meta-rubric through the verification-design column:

- `legibility_cost_of_knowing`: oracle weight to read, run, and maintain.
- `failure_modes`: what the oracle misses and how it can false-positive.
- `coverage_range`: which invariants, claims, or user-facing behaviors it covers.
- `commitment`: infrastructure cost, fixture commitment, and run time.

Compose through the existing spine:

```text
present_candidates({ heading, candidates: [oracle ensembles] })
-> request_response({ exchangeId })
-> compose the additive ensemble in reasoning
-> present_review_set({ review_set })
-> request_response({ exchangeId })
-> approve commits through acceptReviewSet
```

Do not add an oracle-specific tool, schema field, multi-select affordance, or bespoke commit path. The user may recognize one ensemble as the base direction and ask for pieces from another; the composition happens in your reasoning and is made concrete only in the review-set batch. If the ensemble cannot be expressed without a multi-select affordance, stop and surface that as the fan-in falsifier instead of inventing `fan_in_mode` here.

When producing the review set, express oracle commitments as graph vocabulary learned from the active context/rendered ontology surfaces. Prefer checks, criteria, evidence obligations, proof/support edges, fixture/probe commitments, and named blind spots. Do not present an implementation task as an oracle unless it names the observation that discriminates success from failure.

Keep epistemic status honest. With thin grounding, offer low-resolution oracle ensembles and name what evidence would make them safer. With richer graph context, attach the ensemble to specific claims, invariants, criteria, and known failure modes.
