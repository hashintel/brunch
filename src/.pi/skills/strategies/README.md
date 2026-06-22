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

## Observer classification guide (M5 input)

When `agents-composition-layer` authors the strategy resources, seed each
strategy's prompt with the observer classification rules from
the earlier `INTENT_GRAPH_SEMANTICS.md` translation table:

| User phrase pattern              | Most likely kind      |
|----------------------------------|-----------------------|
| "always true that…"             | `invariant`           |
| "should never…"                 | `invariant`           |
| "for example, when…"            | `example`             |
| "we wouldn't want…"             | `example` (negative) or `constraint` |
| "we don't care about X"         | `constraint`          |
| "we picked Y over Z because…"   | `decision`            |
| "we think" / "probably"          | `assumption`          |
| "the system shall" / "must do"   | `requirement`         |
| "what outcome are we after?"     | `goal`                |

The observer should **abstain** rather than guess when
classification support is weak.

## Source reference

Rich classification and translation tables from the earlier
design are in the archived
`/brunch/docs/design/INTENT_GRAPH_SEMANTICS.md` §Observer-prompt
classification guide and §Translation table. Treat as a prompt
engineering input, not a schema target.
