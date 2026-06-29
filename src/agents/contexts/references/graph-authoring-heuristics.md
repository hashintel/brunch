# Graph authoring heuristics

Runtime-eligible shared reference for graph-writing judgment (D97-L/D98-L). Use this for authoring discipline that is shared by `capture` and `commit-graph`; use `graph-ontology.md` for generated kind/band, edge-category, and detail/form vocabulary instead of restating tables here.

## Author declarative graph claims

Every graph node should read as a stable claim, not an interview prompt or scratch note.

- Normalize questions into the underlying declarative claim before writing graph truth.
- Keep follow-ups with no stable claim out of graph truth; route them to elicitation gaps instead.
- Promote before filing as `context`: if the material is success-critical, limiting, possibly false but consequential, a choice among alternatives, or a value bet, use the sharper node kind.
- Use `context` only for descriptive material that aids interpretation but does not yet carry a stronger graph role.

## Commit only settled material

Graph writes are for material whose commitment path is settled.

- Direct user statements and approved review-set items are `explicit` graph truth.
- Confident structure materialized from accepted content may be `implicit` graph truth.
- Low-confidence noticings, suspicions, possible implications, or missing pieces do not become graph truth; route them to an `elicitation_gap` question plus rationale.
- Contradictions with existing graph truth are retrospective repair work; route them to a `reconciliation_need`, not a gap and not an overwrite.

## Build relation-bearing batches from confident endpoints

Create relation-bearing graph batches only after endpoint confidence is settled.

```pseudo
chain relation-bearing-authoring:
  candidate relation
    -> confirm or create confident endpoint nodes
    -> skip edge if either endpoint remains low-confidence
    -> use role-named mutate_graph endpoints
```

Do not use capture-local or prose-local edge dialects. `graph-ontology.md` lists the generated edge-category policy table; `mutate_graph` edges use role fields such as `dependency/dependent`, `support/claim`, `abstract/concrete`, and `boundary/subject`; diagnostics from `structural_illegal` are the repair path.

## Keep mutation grammar role-named

Prepare one coherent `mutate_graph` batch when the user-facing commitment is already settled. Prefer create-only direct commits in the current product posture: `create_node` ops plus role-named `create_edge` ops. Do not invent graph payload fields, LSNs, edge categories, result shapes, or partial-write recovery paths.

## Treat detail.form as inert payload

Use `graph-ontology.md` for the generated required-detail and allowed-form tables. Node `kind` drives graph behavior; `detail.form` is only method payload plus a renderer hook. Do not infer edge legality, readiness, commitment strength, or runtime method state from `form`.
