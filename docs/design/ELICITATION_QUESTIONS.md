# Elicitation question catalogue — historical note

Status: superseded as a live catalogue; retained for design history
Reconciled: 2026-08-05

This note originally expanded each graph node kind into example elicitation
questions. Its durable design insight was:

> The node kind is the closed ontology. Questions are an open, projectable
> heuristic layer inside a kind; adding a question does not add a stored type.

The former per-kind catalogue is no longer current authority. It predated later
kind additions and renames, used a three-band readiness model, and described
retired strategy/lens routing. Keeping those examples here made historical
vocabulary look executable, so FE-1318 removed the catalogue body.

## Current authority

- [`src/graph/schema/nodes.ts`](../../src/graph/schema/nodes.ts) and
  [`src/graph/schema/kinds.ts`](../../src/graph/schema/kinds.ts) own the closed
  node-kind inventory.
- [`src/graph/TOPOLOGY.md`](../../src/graph/TOPOLOGY.md) owns graph schema and
  policy topology.
- [`src/agents/skills/TOPOLOGY.md`](../../src/agents/skills/TOPOLOGY.md) owns
  elicitor capabilities and process moves.
- [`src/agents/runtime/elicitor/TOPOLOGY.md`](../../src/agents/runtime/elicitor/TOPOLOGY.md)
  owns live elicitor runtime composition.
- [`src/session/elicitation-scratchpad.ts`](../../src/session/elicitation-scratchpad.ts)
  owns situated session questions; it does not persist a parallel question
  taxonomy.
- [`src/agents/references/data-model.md`](../../src/agents/references/data-model.md)
  owns current source-question text, while
  [`src/agents/skills/elicit/references/question-kinds-per-intent-kind.md`](../../src/agents/skills/elicit/references/question-kinds-per-intent-kind.md)
  owns open question phrasing and
  [`src/agents/skills/map/references/map-nodes.md`](../../src/agents/skills/map/references/map-nodes.md)
  owns current node-mapping heuristics.

`memory/SPEC.md` records the governing decision events; the files above name the
current materialized surface.

## Historical scope

The removed catalogue supplied examples for the ontology that existed in June
2026. It was useful as exploratory prompt texture, but it was never a schema and
must not be revived as a second readiness, gap, or routing model. New heuristic
examples belong with the current agent references and skills that consume them.
