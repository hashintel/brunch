# Design projection slice

Draft injectable reference for agents projecting accepted intent into coherent design-plane content. Use when generating, reviewing, or explaining `module`, `interface`, `entity`, or `sketch` nodes.

## Job

Turn intent pressure into design shape without pretending early sketches are settled architecture.

```pseudo
accepted intent neighborhood
  -> identify load-bearing goals, constraints, invariants, requirements, examples
  -> project candidate design seams
  -> choose design kind: sketch | module | interface | entity
  -> attach design nodes back to intent with role-named edges
  -> surface missing anchors as gaps or review notes, not design facts
```

## Design-kind routing

| Design material | Kind | Use when | Avoid |
| --- | --- | --- | --- |
| implementation part that hides complexity | `module` | there is a named responsibility and boundary | dumping every file/class into graph truth |
| contract across a seam | `interface` | callers/callees, tool schemas, API contracts, or data exchange matter | using interface as a synonym for module |
| domain or data object | `entity` | identity, lifecycle, relationships, or storage shape matter | modelling every noun as an entity |
| tentative diagram, option, or advisory shape | `sketch` | design helps thinking but should not yet constrain work | hardening speculative architecture |

## Projection graph

```pseudo
nodes:
  goal:       intent
  constraint: intent
  invariant: intent
  requirement: intent
  example:    intent
  module:     design
  interface:  design
  entity:     design
  sketch:     design

edges:
  goal, requirement        -[rationale:for]-> module
  constraint               -[exclusion]->     module, interface, entity
  invariant                -[dependency]->    module, interface
  requirement              -[realization]->   module, interface
  interface                -[composition]->   entity
  sketch                   -[refinement]->    module, interface, entity   # only after accepted
  example                  -[witness:for]->   interface, entity           # if the case demonstrates the seam

notes:
  - `realization` reads abstract -> concrete: requirement/invariant/interface -> module/slice/check.
  - `refinement` reads broad -> specific: generic model -> specialized model.
  - Use `sketch` for early advisory design material instead of promoting it prematurely.
```

## Coherent design content checklist

A design node is coherent when it names:

- the pressure it answers: which requirement, invariant, constraint, goal, or example forced this shape;
- what it hides or stabilizes;
- what may depend on it downstream;
- whether it is settled design (`module`/`interface`/`entity`) or advisory design (`sketch`);
- at least one useful edge back to intent unless the node is explicitly a `sketch`.

## Design projection matrix

| Intent pressure | Likely design response | Edge to create when settled |
| --- | --- | --- |
| requirement needs behavior | `module` or `interface` | `realization` |
| invariant protects state or authority | `interface`, `entity`, or module boundary | `dependency` from invariant to design subject, plus `realization` if the design expresses it |
| constraint rules out options | boundary/design node that is limited | `exclusion` |
| example reveals a domain object | `entity` | `witness` or `rationale` depending on whether it proves or motivates |
| term stabilizes vocabulary | `entity` or `interface` name | `rationale` only if the term motivates the design choice |
| unknown must be accommodated | `sketch` or explicit design seam | `dependency` only if the unknown is truly load-bearing |

## Anti-patterns

- Do not make a module for every source file; graph design nodes are conceptual seams.
- Do not use `sketch` as a permanent parking lot for accepted design truth.
- Do not create a design node whose only support is “this is how systems like this usually look.”
- Do not encode method/style vocabulary as node kinds; use existing kinds plus `detail.form` and renderer/heuristic conduct.
- Do not infer design readiness from `detail.form`; behavior comes from `kind` and edges.

## Minimum design proposal shape

```yaml
design_candidate:
  node:
    kind: module | interface | entity | sketch
    title: string
    body: string          # responsibility, boundary, and why it exists
  anchors:
    intent_refs: string[] # projected graph codes or titles
    edge_plan: string[]   # role-named edges to create if accepted
  risk_notes: string[]    # what is speculative or missing
```

If `anchors.intent_refs` is empty, the design is probably a brainstorm; keep it as prose, a `sketch`, or a candidate review item until anchored.
