---
name: propose
description: Generate candidate source material for human recognition and review; use when the elicitor should fan out alternatives, compare them, and fan in without treating proposals as accepted graph truth.
---

# Propose

Use `propose` when the next useful move is to generate candidate material rather than ask the user for a missing answer. The skill owns proposal procedure and candidate authorship. It does **not** own graph expression or persistence: `map` owns graph vocabulary/routing, and accepted review sets or graph mutations are the only commitment paths.

## Shared generate spine

Every proposal flow follows the same operational shape:

```pseudo
chain propose
  read active plane + selected-spec context
  load one plane reference when branch conduct matters
  fan_out candidate alternatives with explicit comparison axes
  present_candidates for recognition/comparison only
  ask with continues for the user's recognition input
  fan_in in reasoning: pick | synthesize | compose
  if graph drafts are warranted:
    draft through current map/review-set boundary
    present_review_set
    ask(continues)
    commit only after approval through the review-set path
```

`present_candidates` is a recognition surface. It lets the user compare alternatives and say which direction has value; it does not create graph truth. `present_review_set` is the review surface for structurally valid graph-draft batches; approval of that exact batch is what can become accepted graph material.

## Plane fan-in

| Plane | Generate when... | Fan-in move | Commitment boundary |
| --- | --- | --- | --- |
| `intent` | the user needs alternative territory framings, bets, requirements, assumptions, constraints, terms, decisions, criteria, or examples | **pick** one coherent framing | picked candidates remain recognition/provenance until later capture or review-set approval |
| `design` | accepted intent needs alternative module shapes, ownership seams, dependency directions, or implementation topologies | **synthesize** a chosen direction plus useful insights | synthesize into graph drafts only through `present_review_set` |
| `oracle` | accepted intent/design needs verification strategies, oracle families, fixture/probe checks, or blind-spot disclosures | **compose** an additive ensemble | compose into graph drafts only through `present_review_set` |

Do not add a fan-in schema field, a plane-specific commit tool, or a multi-select replacement for these moves. They are method conduct inside the proposal flow. If a plane truly needs a fourth disposition, stop and surface that as a falsifier for D96-L rather than inventing local shape.

## Procedure

1. **Orient narrowly.** Read the selected spec/session context and the smallest graph neighborhood that makes the candidate alternatives grounded. Load static references only when they change proposal quality.
2. **Choose exactly one branch reference when needed.**
   - `references/intent.md` for intent territory candidates.
   - `references/design.md` for module/interface/topology candidates.
   - `references/oracle.md` for verification ensemble candidates.
   - `references/present-review-set.md` only when drafting or checking a graph-review batch.
3. **Fan out real alternatives.** Make differences legible: each candidate needs a core bet, best fit, cost/complexity, coverage, main risks, lock-in constraints, and optionally a recommendation.
4. **Present candidates before drafts.** Call `present_candidates`, then `ask(continues)`. Treat the response as recognition input, not permission to write graph truth.
5. **Fan in in reasoning.** Pick, synthesize, or compose according to the plane. Keep uncertainty visible; do not launder thin evidence into settled commitments.
6. **Draft only when warranted.** If the next move is a graph batch, use current map/review-set guidance for node, edge, detail, and routing shape. Do not hand-copy ontology tables into this skill.
7. **Commit only through approval.** A review-set batch becomes graph truth only after the user approves the exact reviewed items through the existing review-set acceptance path.

## Candidate comparison constraints

- Reason internally with the D31-L meta-rubric axes: legibility / cost-of-knowing, failure modes, coverage / range, and commitment.
- Render user-facing candidate fields such as `core_bet`, `best_fit`, `cost_complexity`, `covers_well`, `main_risks`, `lock_in_constraints`, and optional `recommendation`.
- Avoid fake low/medium/high scalar ratings for cost, risk, confidence, timeline, or verification.
- Use `graph_refs` only for existing graph node references: `{ node_id: string }`.
- Put grounding, assumptions, caveats, and uncertainty in prose, not in `graph_refs`.
- Cite existing ontology/render surfaces when graph vocabulary matters; `map` and graph schema/policy own node kinds, edge categories, detail payloads, and persistence rules.

## Grounding posture

The proposal flow is always available. Thin context lowers resolution and demands visible uncertainty; rich selected-spec context permits sharper candidates tied to existing graph anchors. Branch references own the plane-specific density rules and scenario use. Probe inputs remain testing infrastructure, not product scenarios.
