# commit-graph

Use this method only after the active strategy has established a legal commitment path. It is sequencing guidance for graph writes, not permission to treat every answer as durable truth.

Before committing, read enough selected-spec context to resolve existing projected codes and avoid duplicate or contradictory nodes. Decide the basis from the commitment path: explicit for direct user statements or approved review-set items, implicit for `propose-graph` concept-level materialization. Prepare one coherent batch of nodes and edges; edges must use the closed graph category set and justify stance where proof/support is used.

Invoke `commit_graph` when the batch can be validated atomically and the user-facing commitment is already settled. On `structural_illegal`, use diagnostics to repair and retry within the current strategy's budget; do not expose half-written state or manually patch around CommandExecutor. On ambiguity, stop and ask or route through a proposal/review strategy.

Compose this with `read-context` before the write and `infer-and-capture` when the write follows a completed exchange. Out of scope: direct database writes, raw file edits, invented edge categories, partial acceptance, or using graph commits for workspace posture.
