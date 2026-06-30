---
name: generate-proposal
description: "Generate reviewable candidate graph material: intent-pick, design-synthesize, or oracle-compose. Not for extractive intent/design/oracle lenses that ask or interpret without proposing graph drafts."
---

# Method: generate-proposal

Generate proposal material by fanning out alternatives, making comparison legible, then asking the user to pick, synthesize, or compose. Keep proposed material separate from accepted graph truth: candidates are recognition/provenance only; graph commitment still happens through a later accepted review set or graph-mutation path.

## Shared spine

Use the same spine for every plane:

1. Read the active lens/plane and the current graph/session context.
2. Prefer edge-local neighborhoods for the anchors under proposal, then load the smallest current shared reference from `../../../references/` when a static concept changes the proposal.
3. Load the matching plane reference:
   - `references/intent.md` when generating intent-plane territory candidates.
   - `references/design.md` when generating design-plane module or boundary candidates.
   - `references/oracle.md` when generating oracle-plane verification ensembles.
   - current map/propose references only when the proposal is explicitly about graph mapping, work sequencing, or a review-set batch.
4. Fan out candidate alternatives with explicit comparison axes.
5. Call `present_candidates` for recognition/comparison before any commit-facing draft.
6. Call `present_review_set` only when the user is reviewing a structurally valid graph-draft batch.
7. Call `request_response` after the presentation tool. Do not call retired request-specific tools directly.
8. Treat the user's response as selection/review input, not as an automatic graph write.

Intent uses `pick`, design uses `synthesize`, and oracle uses `compose`. These are method conduct inside this skill, not schema fields or bespoke tools. Do not add a fan-in field, a multi-select affordance, or a plane-specific commit path unless a later build explicitly changes the architecture.

Do not write picked intent candidates to the graph in this method. The picked candidate is recognition/provenance for a later capture or review-set commit path, preserving the candidate-never-commits invariant.

For design and oracle, the synthesis or composition happens in reasoning after candidate recognition and before the review-set draft:

```text
present_candidates({ heading, candidates: [...] })
-> request_response({ exchangeId })
-> synthesize or compose selected material into graph drafts
-> present_review_set({ review_set })
-> request_response({ exchangeId })
-> approve commits through acceptReviewSet
```

`present_candidates` records user-facing comparison plus meta-rubric reasoning trace. It does not create graph truth. Commitment still requires the later accepted review-set / graph-mutation path.

## Candidate comparison constraints

- Internally reason with the D31-L meta-rubric axes: `legibility_cost_of_knowing`, `failure_modes`, `coverage_range`, and `commitment`.
- Derive user-facing `present_candidates` fields: `core_bet`, `best_fit`, `cost_complexity`, `covers_well`, `main_risks`, `lock_in_constraints`, and optional `recommendation`.
- `core_bet` is the candidate headline or thesis.
- Avoid fake low/medium/high scalar ratings for cost, risk, confidence, timeline, or verification.
- `graph_refs` are per-candidate and strictly existing graph node references: `{ node_id: string }` only.
- Do not add ad-hoc assumptions, caveats, observations, or grounding prose to `graph_refs`.
- Cite existing ontology/render surfaces when you need graph vocabulary; do not hand-copy node-kind, band, or edge-category lists as if this skill owned them.

## Plane references

The disclosed references are branch-specific payload, not independently advertised skills. Load exactly one branch reference unless the user explicitly asks to compare planes. Topical context slices are supporting references, not new model-invoked skills.

- `references/intent.md`: intent plane, single pick, grounding-density scaling.
- `references/design.md`: design plane, synthesize, radically different module/interface shapes.
- `references/oracle.md`: oracle plane, compose, additive verification ensembles and blind spots.
- Current live map and propose references supersede the retired context-slice files when candidate material names graph kinds, capture routes, plan sequencing, or review-set batches.
