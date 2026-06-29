# Slice: edge authoring

> Draft injectable context slice (scratch; not wired). Inject when an agent is about to relate two nodes. Source of truth for edge-category policy is [`graph-ontology.md`](../../contexts/references/graph-ontology.md) (projected from `src/graph/policy/category-policy.ts`); authoring judgment is [`graph-heuristics.md`](references/graph-heuristics.md).

Edges are a **closed set of nine structural categories** with role-named endpoints. Do not use retired named-relation dialects (`derived_from`, `motivated_by`, `rules_out`, `counterexample_for`, `tested_by`) as categories — they map onto the nine below. Endpoint storage order carries no meaning; category metadata owns direction.

## The nine categories

```
policy: exclusive   (each edge is exactly one category)

category        | source role -> target role   | affected | impact   | stance
----------------|------------------------------|----------|----------|----------
dependency      | dependency -> dependent      | target   | cascade  | -
witness         | oracle -> claim              | source   | advisory | required
rationale       | support -> claim             | source   | advisory | required
realization     | abstract -> concrete         | target   | advisory | -
refinement      | abstract -> concrete         | target   | advisory | -
exclusion       | boundary -> subject          | target   | advisory | -
composition     | whole -> part               | source   | advisory | -
cross_reference | peer -> peer                | -        | none     | -
supersession    | successor -> predecessor    | source   | advisory | -
```

Stance (`for | against`) is **required** on `witness` and `rationale`, **omitted** everywhere else. `supersession` hides the predecessor from active context and must stay acyclic.

## If you mean… use…

```
policy: exclusive

if you mean…                                                | use category | stance
------------------------------------------------------------|--------------|--------
one claim relies on another staying true                    | dependency   | -
an oracle/example/check/evidence supports a claim           | witness      | for
an oracle/example/counterexample refutes a claim            | witness      | against
a goal/thesis/argument motivates a claim                    | rationale    | for
an argument opposes a claim                                 | rationale    | against
an abstract claim is implemented/expressed by a concrete one| realization  | -
a general claim/model is specialized by a more specific one | refinement   | -
a boundary/non-goal/constraint limits a subject             | exclusion    | -
a whole contains a part                                     | composition  | -
two items relate but no stronger relation is justified      | cross_reference | -
a newer item replaces an older item                         | supersession | -
```

## Role-named grammar

Author with role names, never with `source`/`target` geometry:

```
create_edge dependency:    dependency: A1   dependent: REQ1
create_edge witness:       oracle: AC1      claim: REQ1     stance: for
create_edge witness:       oracle: EX2      claim: INV4     stance: against
create_edge rationale:     support: G2      claim: REQ1     stance: for
create_edge realization:   abstract: REQ1   concrete: MOD1
create_edge refinement:    abstract: REQ1   concrete: REQ2
create_edge exclusion:     boundary: CON2   subject: EX3
create_edge composition:   whole: F1        part: S1
create_edge supersession:  successor: REQ2  predecessor: REQ1
create_edge cross_reference: peer: REQ1     peer: G1
```

## Negative knowledge is first-class

Intent is often clarified by what is ruled out. Prefer a concrete node + stance/exclusion over vague "not that" prose.

```
counterexample / rejected interpretation:
  EX2: rejected review item appears in export
  create_edge witness:  oracle: EX2  claim: INV4  stance: against

out-of-scope disambiguator:
  EX3: importing old local dev fixtures
  create_edge exclusion:  boundary: CON2  subject: EX3
```

Contradiction between two accepted claims is **not** an edge — there is no `conflict` category. Raise a `reconciliation_need` of kind `semantic_conflict`.

## Author edges only between settled endpoints

```
chain relation-authoring:
  candidate relation
    -> both endpoints settled enough to be graph truth?
      x> no: spawn/reuse an elicitation_gap for the missing endpoint; skip the edge
    -> contradicts existing truth?
      x> yes: raise a reconciliation_need; do not overwrite or add a competing edge
    -> create_edge with role-named endpoints + stance (witness/rationale only)
```
