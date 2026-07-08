# Intent Proposals

Use when the active plane is `intent` and the user needs alternative territory framings for the selected spec: goals, bets, requirements, assumptions, constraints, terms, decisions, criteria, examples, or their relationships.

Intent proposal is not extractive intent reading. It generates candidate source material so the user can recognize which framing they want to pursue.

## Fan-in rule: pick

Intent candidates are coherent territories. Ask for a **single pick** first; do not synthesize or compose across candidates unless the user explicitly asks after recognizing a primary direction. Cherry-picking before a pick can produce an incoherent spec.

```pseudo
chain intent-proposal
  gather grounding bundle + edge-local graph anchors
  fan_out coherent territory candidates
  present_candidates
  ask(continues)
  record the picked direction as recognition input
  stop before graph commitment unless a separate review-set draft is warranted
```

The picked candidate does not write graph truth. It is recognition/provenance for later capture, mapping, or review-set approval.

## Grounding bundle

Ground every intent fan-out in the available subset of:

- **Domain** — what kind of thing is being built.
- **Protagonist** — who it is for.
- **Pain / pull** — the friction or aspiration motivating it.
- **Constraint** — what is binding: time, integration, regulation, organization, or technology.

Do not refuse because the bundle is incomplete. Scale output resolution and epistemic posture instead.

| Density | Intent output | Conduct |
| --- | --- | --- |
| empty / thin | low-resolution territory framings | mark speculative; name the missing anchors that would make a pick safer |
| moderate | scenario sketches foregrounding different anchors | show which selected-spec nodes or session facts each candidate centers |
| rich | completion candidates with likely node/edge fills | keep graph language draft-like and route commitment through review-set approval |
| mature | reframing diffs against existing intent | preserve accepted commitments unless the alternative explicitly challenges them |

## Candidate content

Each candidate should make these differences legible:

- core bet or thesis
- protagonist/pain emphasis
- constraints treated as binding vs negotiable
- what the framing foregrounds and refuses
- likely downstream design/oracle consequences
- main risks or contradictions it invites
- what would become easier or harder to know

Use existing `graph_refs` only for selected-spec nodes the candidate actually relies on. Put new assumptions and caveats in prose, not graph refs.

## Review-set boundary

Most intent proposal sessions should stop after `present_candidates -> ask(continues)`; the next move may be `map`, `elicit`, or another proposal. If the user asks to turn the picked framing into graph material, draft through `references/present-review-set.md` and current `map` guidance so the exact nodes/edges can be approved as a batch.
