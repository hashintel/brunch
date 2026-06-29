# strategies/ — Interaction-shape prompt resources

SPEC decisions: D25-L, D26-L, D53-L, D85-L

Each strategy describes an interaction shape — how the agent structures its turns and what the user experiences. Graph-write commitment mechanisms are method-routed by D85-L, not strategy-axis members.

## Strategies

| Strategy | Interaction path | Notes |
| --- | --- | --- |
| `freestyle` | ordinary turns | user-pinned free chat; AUTO never selects it |
| `step-wise-decision-tree` | single-exchange Q&A | one claim at a time |
| `step-wise-disambiguate` | contrastive examples | collapse meaningful ambiguity |

## Prompt resource contents

Each `<strategy>/SKILL.md` file in this directory is a prompt resource the agent reads
(advertised via the D58-L `<brunch-skills>` manifest with `<kind>strategy</kind>`) when the strategy is active. It should contain:

- What the agent is doing in this strategy
- How to structure the turn
- How to compose with graph-write methods when commitments are ready

## Heuristic provenance

Phrase-classification and translation heuristics are authored and locked into each
`<strategy>/SKILL.md` body in distilled form (D97-L: cite/distill, do not copy
vocabulary tables). The canonical "abstain rather than guess on weak classification
support" rule and the contrastive signal-phrase routing live in
`step-wise-disambiguate/SKILL.md` and `step-wise-decision-tree/SKILL.md`; graph
vocabulary itself is owned by `src/graph/schema/kinds.ts`. This topology file owns the
current axis membership only — not a parallel copy of the per-strategy heuristics.
