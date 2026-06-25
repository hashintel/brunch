# Intent Plane

Use this reference when the active lens is `intent` and the user needs alternative framings of the product/spec territory: goals, bets, requirements, assumptions, constraints, terms, decisions, criteria, examples, or the relationship among them. Keep this distinct from the extractive `intent` lens: the lens asks or interprets to establish intent; this method generates reviewable territory candidates.

The intent plane fan-in move is a **single pick**. Present coherent territory candidates and ask the user to choose one. Do not synthesize or compose intent candidates unless the user explicitly asks after the pick; cherry-picking across territory framings can make the spec incoherent.

Ground every intent fan-out in the available bundle:

- **Domain**: what kind of thing is being built.
- **Protagonist**: who it is for.
- **Pain / pull**: the friction or aspiration motivating it.
- **Constraint**: what is binding: time, integration, regulation, organization, or technology.

The method is always available; output resolution scales with density instead of refusing:

- Empty/thin grounding: propose low-resolution territory framings with an `inferred` or `assumed` posture and say what would make them safer to commit to.
- Moderate grounding: propose scenario sketches that foreground different existing anchors.
- Rich grounding: propose completion candidates that name likely graph fills and rationale.
- Mature graph: propose reframing candidates as diffs against existing material.

Keep epistemic status honest in the candidate prose. Low-density candidates should read as speculative and useful for recognition, not as discovered truth. Richer candidates may be more assertive only where existing graph/session evidence supports them.

For the intent plane, prefer `present_candidates` followed by `request_response`:

```text
present_candidates({ heading, candidates: [...] })
-> request_response({ exchangeId })
-> user picks one candidate
```

Do not write picked intent candidates to the graph in this method. The picked candidate is recognition/provenance for a later capture or review-set commit path, preserving the candidate-never-commits invariant.
