---
name: map
description: Map grounded material into graph-shaped intent, design, oracle, plan, and edge candidates without confusing proposal with committed truth.
---

# Map

Map owns source-independent graph ontology guidance: what kind a span becomes, which edge category relates two items, and how intent, design, oracle, and plan planes stay distinct. Source intake belongs to `ingest`; proposal generation belongs to `propose`; approval gates belong to `review`.

Read the focused references when detail matters:

- [`references/map-nodes.md`](references/map-nodes.md) — cross-plane node selection and quick routing.
- [`references/map-intents.md`](references/map-intents.md) — intent-plane promotion, nearby-kind distinctions, examples, and decision criteria.
- [`references/map-edges.md`](references/map-edges.md) — the closed edge categories and role-named grammar.
- [`references/map-design.md`](references/map-design.md) — `module`, `interface`, `entity`, and `sketch` routing.
- [`references/map-oracles.md`](references/map-oracles.md) — criteria, checks, evidence, methods, obligations, and witnesses.
- [`references/map-plans.md`](references/map-plans.md) — `milestone`, `frontier`, and `scope` routing.
- [`references/routing.md`](references/routing.md) — confidence/conflict routing into settled graph truth, advisory graph signal, gaps, reconciliation, or review.

Each plane answers a different concern. Stay on the plane the active work is on; cross-plane links are edges, not kind changes. Promote across planes only when the material genuinely hardens.

## Map / Intent

> what and why  #intent

Build the spec's truth-bearing claims. Coherence here means: every goal/thesis has a path toward something that satisfies it, and every commitment is judged.

```
tree intent obligations:
  goal / thesis            value + bet — the why
    requirement            obligations that serve the why
      invariant            what must stay true while requirements operate
      criterion            how each requirement/invariant is judged
      example              concrete witnesses + counterexamples
  context / term           the stipulated frame + lexicon
  assumption / unknown     what might be false / what is not yet known
  constraint               what the solution space rules out
```

```
coherence checks (intent)
  goal/thesis      -> has a rationale edge into >=1 requirement?            else: scratchpad obligation
  requirement      -> has a witness path (criterion/example/oracle)?        else: scratchpad obligation
  requirement      -> pairs with an invariant it must not break?            consider
  decision         -> names >=1 rejected alternative + rationale?           else: not a decision
  assumption       -> high fanout + thin evidence?                          surface risk
  constraint/non-goal -> attached to its subject via exclusion?             else: vague
```

Typical edges: `rationale` (goal→requirement), `dependency` (claim→claim), `exclusion` (constraint→subject), `refinement` (general→specific), `witness` (example→claim, with stance).

## Map / Design

> how it's shaped  

Name the implementation shape that realizes the intent. Keep weak design hints as `sketch`; if a source clearly implies `module`, `interface`, or `entity` before harmonization, map the sharper kind as advisory graph material.

```
kinds: module (MOD) | interface (API) | entity (ENT) | sketch (SKT)

  module     a seam / unit of implementation
  interface  a contract surface
  entity     a data/domain entity
  sketch     intentionally lightweight, not yet hardened
```

```
coherence checks (design)
  module/interface -> realizes >=1 requirement (realization edge)?  else: unanchored design
  entity           -> referenced by a requirement/criterion it serves?
  sketch           -> promote to module/interface/entity once settled; don't leave advisory truth
  interface        -> precondition as constraint, postcondition as criterion/invariant, hung on the API
```

Typical edges: `realization` (requirement→module, renders "implemented by"), `refinement` (model→specialization), `composition` (whole→part), `dependency` (module→module).

## Map / Oracle

> how we know  

Make claims checkable. Distinguish the intent-plane `criterion` (the oracle *claim*) from oracle-plane nodes (the concrete *machinery*). Choose the **weakest sufficient** artifact; redundancy across independent oracle families is a feature when it reduces bad degrees of freedom at acceptable cost.

```
kinds: check (CH) | vv_method (VV) | evidence (E) | vv_obligation (O)

ladder (weakest sufficient first — this is conduct, not a stored field):
  human review -> example/counterexample -> regression/golden
    -> runtime contract -> property/model-based -> probe/transcript -> proof obligation
```

```
coherence checks (oracle)
  criterion        -> witness edge into the requirement/invariant it judges?  else: orphan oracle
  check/vv_method  -> names the observation that discriminates pass from fail? else: it's a task, not an oracle
  ensemble         -> blind spots named in prose? (false-positive shape, trigger to revisit)
  counterexample   -> example + witness:against the claim it falsifies
```

Typical edges: `witness` (oracle→claim, `stance: for|against`), `realization` (criterion→check). Express evidence breadth (reviewed / example-backed / regression-covered / enforced / proved) as prose, never as graph metadata.

## Map / Plan

how it's sequenced  #plan

Sequence the work. A `frontier` is the plan/tracker/branch unit; a `scope` is the durable handoff package from specification into execution; a `milestone` is a bounded phase. Buildable `slice`s stay downstream in executor flow rather than persisting as plan nodes.

```
kinds: milestone (M) | frontier (F) | scope (SCP)

tree plan containment:
  milestone
    frontier        the tracker/branch unit
      scope         the committed handoff package for execution
```

```
coherence checks (plan)
  frontier -> contains >=1 scope (composition)?
  scope    -> establishes >=1 requirement and packages design/verification for execution?
  frontier -> dependencies mirror intent dependencies, not intra-frontier execution order
  milestone-> frontiers map to an invariant bundle to establish
```

Typical edges: `composition` (milestone→frontier→scope), `realization` (requirement→scope, renders "established by"), `dependency` (frontier→frontier).
