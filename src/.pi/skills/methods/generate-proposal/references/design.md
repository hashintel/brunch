# Design Plane

Use this reference when the active lens is `design` and the user needs alternative module shapes, interface boundaries, ownership seams, dependency directions, or implementation topologies for already-accepted intent. Keep this distinct from the extractive `design` lens: the lens interprets and asks about design implications; this method generates reviewable design material.

Fan out **radically different design shapes**. Use the `ln-design` discipline: make at least two or three meaningfully different module/interface options, then compare them on depth, locality, leverage, ease of correct use vs misuse, general-purpose vs specialized fit, implementation efficiency, and epistemic cost. The user should be able to recognize which tradeoff they value, not merely approve one pre-optimized answer.

The design plane fan-in move is **synthesize**. `present_candidates` is still the recognition surface: show the candidate shapes and their comparison rubrics, then call `request_response` so the user can indicate the preferred direction. After that, synthesize the chosen direction and useful insights from the alternatives into a structurally valid graph-draft batch, then present it for review:

```text
present_candidates({ heading, candidates: [design shapes] })
-> request_response({ exchangeId })
-> synthesize selected direction into graph drafts
-> present_review_set({ review_set })
-> request_response({ exchangeId })
-> approve commits through acceptReviewSet
```

Do not add a synthesize-specific tool, schema field, or multi-select affordance. The synthesis happens in your reasoning between the candidate pick and the review-set draft; the durable graph commitment still happens only through the existing `present_review_set -> request_response -> acceptReviewSet` path.

Design candidates should cite the graph context and renderer surfaces they rely on instead of restating node kinds, edge categories, planes, or readiness bands. Use existing graph refs in `graph_refs` only when a candidate is anchored to known graph material; otherwise keep the candidate prose honest about its grounding density and epistemic status.

When producing the review set, express design commitments as graph vocabulary learned from the active context/rendered ontology surfaces. Prefer module/interface ownership, information-hiding, dependency direction, realization, and boundary commitments. If a design alternative reveals a missing product requirement, do not smuggle it in as architecture; either ask through the intent lens or mark the review-set item as a design assumption that needs intent validation.
