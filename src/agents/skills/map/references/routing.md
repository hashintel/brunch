# Routing Graph Material

Use this when mapped material needs a destination. Mapping decides what graph thing a span could become; routing decides whether it is settled graph truth, advisory signal, a session scratchpad obligation, reconciliation, or review material.

```pseudo
mapped material
  -> confidence high enough for graph truth?
  -> harmonized with settled graph truth?
  -> conflicts with settled graph truth?
  -> user judgment required?
  -> route to the strongest honest substrate
```

## Route by Confidence and Conflict

Stop at the first row that holds.

| If the mapped material is...                                                 | Route                 | Notes                                                    |
| ---------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------- |
| directly stated, or exact-review approved, and harmonized                    | settled graph item    | `basis: explicit`                                        |
| confidently materialized from accepted, harmonized content                   | settled graph item    | `basis: implicit`                                        |
| reviewed source-derived material that is graph-shaped but not harmonized     | advisory graph item   | accepted `present_digest` material starts here until harmonized |
| coherent but judgment-heavy candidate material                               | review-set draft      | no graph basis until accepted                            |
| low-confidence noticing, suspicion, possible implication, or missing support | session scratchpad obligation | obligation plus rationale naming what it would establish |
| contradiction with existing settled graph truth                              | `reconciliation_need` | retrospective repair; do not overwrite the settled claim |

## Rules

- Commit graph truth only through the current graph mutation or approved review-set path; never by direct database/file edits or prose assertion.
- Prepare one coherent batch when writing graph truth, so nodes and confident role-named edges validate atomically.
- Low confidence never commits. Its durable form is a session scratchpad obligation, not a speculative node or edge.
- Contradiction is reconciliation, not a scratchpad obligation. A scratchpad obligation is missing prospective coverage; a contradiction is a retrospective impasse over existing truth.
- Relate only confident endpoints. Commit missing high-confidence endpoints first, then add role-named edges; skip the edge and add a scratchpad obligation when either endpoint is weak.
- `basis` records approval directness, not the mutation path. Audit/provenance lives in `change_log`; lightweight source attribution can live on the node `source`.
- Advisory graph material is persistable reviewed signal. It still needs promotion, rewrite, split, supersession, reconciliation, or abandonment before it is settled truth.
- Accepted `present_digest` material is source-derived review input, not automatic graph truth. Route its `accepted_abstract` by confidence and conflict: advisory until harmonized, settled only when accepted and harmonized, scratchpad for low confidence, reconciliation for contradiction. The default follow-up is direct mutation into the strongest honest substrate (usually advisory graph material), not a broad question or a review set; reserve review sets for judgment-heavy candidates that need explicit item-level approval.
- Accepted `present_candidates` selections are recognition input, not graph truth. They can steer map/review-set drafting; non-picked candidates remain offer history.

## Relation-Bearing Batches

```pseudo
chain relation-authoring:
  candidate relation
    -> both endpoints confident enough for the intended settlement?
      x> no: add/reuse a scratchpad obligation for the missing endpoint; skip the edge
    -> contradicts existing settled truth?
      x> yes: raise a reconciliation_need; do not overwrite or add a competing edge
    -> create_edge with role-named endpoints + stance (witness/rationale only) + settlement
```

Review-set drafts may include candidate edges when both endpoints are present or resolvable in the selected spec. Accepted review-set items become `basis: explicit`; rejected proposals stay out of active graph material.
