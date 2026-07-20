# Mapping Edges

Accepted edges use the closed structural categories owned by `src/graph/policy/category-policy.ts`. Do not use retired named-relation dialects such as `derived_from`, `motivated_by`, `rules_out`, `counterexample_for`, or `tested_by` as edge categories.

Use the role-named `mutate_graph` grammar. Endpoint storage order does not carry impact meaning; category metadata owns endpoint roles, affected endpoint, impact strength, criteria-help signal, and mapping effect.

| If you mean...                                                             | Use current edge category                           |
| -------------------------------------------------------------------------- | --------------------------------------------------- |
| one claim relies on another remaining true                                 | `dependency` (`dependency` -> `dependent`)          |
| deliberately promoted observed evidence supports/refutes a claim          | `witness` with `stance: for` or `stance: against`   |
| a criterion or method specifies a concrete check                          | `realization`                                       |
| a goal, thesis, rationale, or argument motivates/opposes a claim           | `rationale` with `stance: for` or `stance: against` |
| an abstract claim is implemented or expressed by a concrete artifact       | `realization`                                       |
| a general claim/model is specialized by a more specific one                | `refinement`                                        |
| a boundary, non-goal, or constraint limits a subject                       | `exclusion`                                         |
| a whole contains a part                                                    | `composition`                                       |
| two items are related but no stronger relation is justified                | `cross_reference`                                   |
| one item replaces an older item                                            | `supersession`                                      |

Stance is required only for `witness` and `rationale`; omit it everywhere else.

## Relation-bearing batches need confident endpoints

Create edges only after both endpoints are confident enough for the intended settlement. Advisory edges are allowed when a reviewed source implies the relation but it is not yet globally harmonized; settled edges require settled endpoints.

```pseudo
chain relation-bearing-authoring:
  candidate relation
    -> confirm or create confident endpoint nodes
    -> choose advisory vs settled settlement
    -> skip edge if either endpoint remains low-confidence
    -> use role-named mutate_graph endpoints
```

If an endpoint is uncertain, add or reuse a scratchpad obligation for the missing claim. If a relation contradicts existing settled graph truth, create a reconciliation need instead of overwriting or adding a competing settled edge.

# Edge Heuristics

Edges are a **closed set of nine structural categories** with role-named endpoints. Do not use retired named-relation dialects (`derived_from`, `motivated_by`, `rules_out`, `counterexample_for`, `tested_by`) as categories — they map onto the nine below. Endpoint storage order carries no meaning; category metadata owns direction.

NOTES
- Stance (`for | against`) is **required** on `witness` and `rationale`, **invalid** everywhere else.
- Prefer a concrete `example` or an `exclusion` edge over vague prose ("not that"); use `witness:against` only for promoted observed evidence.
- Contradiction between two accepted claims is **not** an edge: with the `conflict` edge deliberately deferred, a contradiction surfaces as a `reconciliation_need` of kind `semantic_conflict` (ONTOLOGY_REVIEW_PROTOCOL §8).

## The nine categories

```
policy: exclusive   (each edge is exactly one category)

| category        | source role -> target role | affected | impact   | stance   |
| --------------- | -------------------------- | -------- | -------- | -------- |
| dependency      | dependency -> dependent    | target   | cascade  | -        |
| witness         | oracle -> claim            | source   | advisory | required |
| rationale       | support -> claim           | source   | advisory | required |
| realization     | abstract -> concrete       | target   | advisory | -        |
| refinement      | abstract -> concrete       | target   | advisory | -        |
| exclusion       | boundary -> subject        | target   | advisory | -        |
| composition     | whole -> part              | source   | advisory | -        |
| cross_reference | peer -> peer               | -        | none     | -        |
| supersession    | successor -> predecessor   | source   | advisory | -        |
```

Stance (`for | against`) is **required** on `witness` and `rationale`, **omitted** everywhere else. `supersession` hides the predecessor from active context and must stay acyclic.

## If you mean… use…

```
policy: exclusive

| if you mean…                                                 | use category    | stance  |
| ------------------------------------------------------------ | --------------- | ------- |
| one claim relies on another staying true                     | dependency      | -       |
| promoted observed evidence supports a claim                  | witness         | for     |
| promoted observed evidence refutes a claim                   | witness         | against |
| a criterion or method specifies a concrete check             | realization     | -       |
| a goal/thesis/argument motivates a claim                     | rationale       | for     |
| an argument opposes a claim                                  | rationale       | against |
| an abstract claim is implemented/expressed by a concrete one | realization     | -       |
| a general claim/model is specialized by a more specific one  | refinement      | -       |
| a boundary/non-goal/constraint limits a subject              | exclusion       | -       |
| a whole contains a part                                      | composition     | -       |
| two items relate but no stronger relation is justified       | cross_reference | -       |
| a newer item replaces an older item                          | supersession    | -       |
```

## Role-named grammar

Author with role names, never with `source`/`target` geometry:

```
create_edge dependency:    dependency: A1   dependent: REQ1
create_edge realization:   abstract: AC1    concrete: CH1
create_edge realization:   abstract: VV1    concrete: CH1
create_edge witness:       oracle: E2       claim: INV4     stance: against
create_edge rationale:     support: G2      claim: REQ1     stance: for
create_edge realization:   abstract: REQ1   concrete: MOD1
create_edge refinement:    abstract: REQ1   concrete: REQ2
create_edge exclusion:     boundary: CON2   subject: EX3
create_edge composition:   whole: F1        part: SCP1
create_edge supersession:  successor: REQ2  predecessor: REQ1
create_edge cross_reference: peer: REQ1     peer: G1
```

## Negative knowledge is first-class

Intent is often clarified by what is ruled out. Prefer a concrete node + stance/exclusion over vague "not that" prose.

```
observed counterexample:
  E2: promoted observation that a rejected review item appeared in export
  create_edge witness:  oracle: E2  claim: INV4  stance: against

out-of-scope disambiguator:
  EX3: importing old local dev fixtures
  create_edge exclusion:  boundary: CON2  subject: EX3
```

Contradiction between two accepted claims is **not** an edge — there is no `conflict` category. Raise a `reconciliation_need` of kind `semantic_conflict`.

## Author edges only between confident endpoints

```
chain relation-authoring:
  candidate relation
    -> both endpoints confident enough for the intended settlement?
      x> no: add/reuse a scratchpad obligation for the missing endpoint; skip the edge
    -> contradicts existing settled truth?
      x> yes: raise a reconciliation_need; do not overwrite or add a competing edge
    -> create_edge with role-named endpoints + stance (witness/rationale only) + settlement
```

## Edge and node interfaces

```ts
interface GraphEdge {
  category: EdgeCategory          // one of the nine
  sourceId, targetId: NodeId      // storage order carries NO impact meaning
  stance?: 'for' | 'against'      // required iff witness | rationale
  basis: 'explicit' | 'implicit'  // approval directness (D63-L)
  settlement: 'advisory' | 'settled'
  rationale?: string              // why the relation holds
  // + id, specId, createdAtLsn, updatedAtLsn
}

interface GraphNode {
  plane, kind, kindOrdinal        // kind drives behavior; code = label+ordinal (D62-L)
  title, body?
  basis: 'explicit' | 'implicit'
  settlement: 'advisory' | 'settled'
  source?: string                 // lightweight epistemic attribution text, not policy
  detail?: NodeDetail             // decision | term | claim-form union
  // + id, specId, createdAtLsn, updatedAtLsn
}
```

## Endpoint-relative labels and direction

- **`projection/labels.ts`** — anchor-relative phrasing. A two-tier table keyed on `(category, anchorRole, stance)` (≈18 base cells) plus a small tier-2 refinement keyed on `(category, sourceKind, targetKind)`. Renderers never leak the structural vocabulary.
- **`projection/direction.ts`** — upstream / downstream / lateral, read from the `affected` endpoint in the policy table, **not** from storage geometry. "Downstream" is the endpoint that needs reconciliation when the other changes.

Base anchor-relative labels (from [`labels.ts`](../../../../graph/projection/labels.ts)):

| Category          | Anchor = source           | Anchor = target              |
| ----------------- | ------------------------- | ---------------------------- |
| `dependency`      | required by               | depends on                   |
| `witness`         | witnesses / refutes       | witnessed by / challenged by |
| `rationale`       | supports / argues against | motivated by / opposed by    |
| `realization`     | realized by               | realizes                     |
| `refinement`      | refined by                | refines                      |
| `exclusion`       | bounds                    | bounded by                   |
| `composition`     | contains                  | part of                      | ¸ |
| `supersession`    | supersedes                | superseded by                |
| `cross_reference` | related to                | related to                   |
