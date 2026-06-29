# Edge Heuristics

## Categories and endpoint roles

| Category          | Endpoint roles          | Affected | Impact   | Stance   | Criteria help | Projection effect                    |
| ----------------- | ----------------------- | -------- | -------- | -------- | ------------- | ------------------------------------ |
| `dependency`      | dependency → dependent  | target   | cascade  | —        | no            | none                                 |
| `witness`         | oracle → claim          | source   | advisory | required | yes           | none                                 |
| `rationale`       | support → claim         | source   | advisory | required | no            | none                                 |
| `realization`     | abstract → concrete     | target   | advisory | —        | no            | none                                 |
| `refinement`      | abstract → concrete     | target   | advisory | —        | no            | none                                 |
| `exclusion`       | boundary → subject      | target   | advisory | —        | no            | none                                 |
| `composition`     | whole → part            | source   | advisory | —        | no            | none                                 |
| `cross_reference` | peer → peer             | —        | none     | —        | no            | none                                 |
| `supersession`    | successor → predecessor | source   | advisory | —        | no            | hide_predecessor_from_active_context |

NOTES
- Stance (`for | against`) is **required** on `witness` and `rationale`, **invalid** everywhere else.
- Prefer a concrete `example` plus `witness:against`, or an `exclusion` edge, over vague prose ("not that"). 
- Contradiction between two accepted claims is **not** an edge: with the `conflict` edge deliberately deferred, a contradiction surfaces as a `reconciliation_need` of kind `semantic_conflict` (ONTOLOGY_REVIEW_PROTOCOL §8).

## Edge and node interfaces

```ts
interface GraphEdge {
  category: EdgeCategory          // one of the nine
  sourceId, targetId: NodeId      // storage order carries NO impact meaning
  stance?: 'for' | 'against'      // required iff witness | rationale
  basis: 'explicit' | 'implicit'  // approval directness (D63-L)
  rationale?: string              // why the relation holds
  // + id, specId, createdAtLsn, updatedAtLsn
}

interface GraphNode {
  plane, kind, kindOrdinal        // kind drives behavior; code = label+ordinal (D62-L)
  title, body?
  basis: 'explicit' | 'implicit'
  source?: string                 // lightweight epistemic attribution text, not policy
  detail?: NodeDetail             // decision | term | claim-form union
  // + id, specId, createdAtLsn, updatedAtLsn
}
```

## Endpoint-relative labels and direction

- **`projection/labels.ts`** — anchor-relative phrasing. A two-tier table keyed on `(category, anchorRole, stance)` (≈18 base cells) plus a small tier-2 refinement keyed on `(category, sourceKind, targetKind)`. Renderers never leak the structural vocabulary.
- **`projection/direction.ts`** — upstream / downstream / lateral, read from the `affected` endpoint in the policy table, **not** from storage geometry. "Downstream" is the endpoint that needs reconciliation when the other changes.

Base anchor-relative labels (from [`labels.ts`](../../../graph/projection/labels.ts)):

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
