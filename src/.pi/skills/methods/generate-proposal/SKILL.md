---
name: generate-proposal
description: "Generate reviewable candidate graph material without committing it directly."
---

# Method: generate-proposal

Generate proposal material by fanning out alternatives, making comparison legible, then asking the user to pick or review. Keep proposed material separate from accepted graph truth.

## Shared spine

Use the same spine for every plane:

1. Read the active lens/plane and the current graph/session context.
2. Fan out candidate alternatives with explicit comparison axes.
3. Call `present_candidates` for pick-style comparisons, or `present_review_set` only when the user is reviewing a structurally valid graph-draft batch.
4. Call `request_response` after the presentation tool. Do not call retired request-specific tools directly.
5. Treat the user's response as selection/review input, not as an automatic graph write.

`present_candidates` records user-facing comparison plus meta-rubric reasoning trace. It does not create graph truth. Commitment still requires the later accepted review-set / graph-mutation path.

## Candidate comparison constraints

- Internally reason with the D31-L meta-rubric axes: `legibility_cost_of_knowing`, `failure_modes`, `coverage_range`, and `commitment`.
- Derive user-facing `present_candidates` fields: `core_bet`, `best_fit`, `cost_complexity`, `covers_well`, `main_risks`, `lock_in_constraints`, and optional `recommendation`.
- `core_bet` is the candidate headline or thesis.
- Avoid fake low/medium/high scalar ratings for cost, risk, confidence, timeline, or verification.
- `graph_refs` are per-candidate and strictly existing graph node references: `{ node_id: string }` only.
- Do not add ad-hoc assumptions, caveats, observations, or grounding prose to `graph_refs`.
- Cite existing ontology/render surfaces when you need graph vocabulary; do not hand-copy node-kind, band, or edge-category lists as if this skill owned them.

## Intent-plane generation

Use this facet when the active lens is `intent` and the user needs alternative framings of the product/spec territory: goals, bets, requirements, assumptions, constraints, terms, decisions, criteria, examples, or the relationship among them.

The intent-plane fan-in move is a **single pick**. Present coherent territory candidates and ask the user to choose one. Do not synthesize or compose intent candidates unless the user explicitly asks after the pick; cherry-picking across territory framings can make the spec incoherent.

Ground every intent fan-out in the available bundle:

- **Domain** — what kind of thing is being built.
- **Protagonist** — who it is for.
- **Pain / pull** — the friction or aspiration motivating it.
- **Constraint** — what is binding: time, integration, regulation, organization, or technology.

The method is always available; output resolution scales with density instead of refusing:

- Empty/thin grounding: propose low-resolution territory framings with an `inferred` or `assumed` posture and say what would make them safer to commit to.
- Moderate grounding: propose scenario sketches that foreground different existing anchors.
- Rich grounding: propose completion candidates that name likely graph fills and rationale.
- Mature graph: propose reframing candidates as diffs against existing material.

Keep epistemic status honest in the candidate prose. Low-density candidates should read as speculative and useful for recognition, not as discovered truth. Richer candidates may be more assertive only where existing graph/session evidence supports them.

For the intent plane, prefer `present_candidates` followed by `request_response`:

```text
present_candidates({ heading, candidates: [...] })
→ request_response({ exchangeId })
→ user picks one candidate
```

Do not write picked intent candidates to the graph in this method. The picked candidate is recognition/provenance for a later capture or review-set commit path, preserving the candidate-never-commits invariant.
