# Slice: authoring by plane

> Draft injectable context slice (scratch; not wired). Inject the whole, or excerpt one section by anchor (`#intent`, `#oracle`, `#design`, `#plan`), when an agent is generating coherent content on that plane. Source of truth: [`graph-ontology.md`](../references/graph-ontology.md) + [`graph-authoring-heuristics.md`](../references/graph-authoring-heuristics.md). Pairs with `slice-kind-selection.md`, `slice-edge-authoring.md`, and `slice-detail-payloads.md`.

Each plane answers a different concern. Stay on the plane the active work is on; cross-plane links are edges, not kind changes. Promote across planes only when the material genuinely hardens.

## intent — what and why  #intent

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
  goal/thesis      -> has a rationale edge into >=1 requirement?            else: gap
  requirement      -> has a witness path (criterion/example/oracle)?        else: gap
  requirement      -> pairs with an invariant it must not break?            consider
  decision         -> names >=1 rejected alternative + rationale?           else: not a decision
  assumption       -> high fanout + thin evidence?                          surface risk
  constraint/non-goal -> attached to its subject via exclusion?             else: vague
```

Typical edges: `rationale` (goal→requirement), `dependency` (claim→claim), `exclusion` (constraint→subject), `refinement` (general→specific), `witness` (example→claim, with stance).

## oracle — how we know  #oracle

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

## design — how it's shaped  #design

Name the implementation shape that realizes the intent. Keep advisory material as `sketch` until it is settled enough to be graph truth.

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

## plan — how it's sequenced  #plan

Sequence the work. A `frontier` is the plan/tracker/branch unit; a `slice` is the buildable unit inside it; a `milestone` is a bounded phase.

```
kinds: milestone (M) | frontier (F) | slice (S)

tree plan containment:
  milestone
    frontier        the tracker/branch unit
      slice         the buildable unit; establishes requirements
```

```
coherence checks (plan)
  frontier -> contains >=1 slice (composition)?
  slice    -> establishes >=1 requirement (realization, renders "established by")?
  frontier -> dependencies mirror intent dependencies, not intra-frontier slice order
  milestone-> frontiers map to an invariant bundle to establish
```

Typical edges: `composition` (milestone→frontier→slice), `realization` (requirement→slice, renders "established by"), `dependency` (frontier→frontier).

## Cross-plane discipline

```
-> the same concept does not change kind to cross planes; you add an edge
-> readiness bands guide questioning/projection; they do NOT gate truth
-> if the user states a later-plane item early, capture it honestly with the right kind + basis
```
