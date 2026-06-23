---
name: commit-graph
description: "Commit graph truth only through Brunch graph tools and CommandExecutor-backed results."
---

# commit-graph

Use this method only after the active posture and user exchange have established a legal direct-commit path. It is sequencing guidance for graph writes, not permission to treat every answer as durable truth.

Before committing, read enough selected-spec context to resolve existing projected codes and avoid duplicate or contradictory nodes. Decide the basis from the commitment path: explicit for direct user statements or approved review-set items, implicit for accepted concept-level materialization. Prepare one coherent batch of nodes and edges; edges must use the closed graph category set and justify stance where `witness`/`rationale` is used.

## Authoring discipline

- **No question kind — normalize interrogatives.** Every intent node is a declarative claim. When material arrives as a question ("Open question: …", "Should we …?", "Is X true?"), rewrite it into the underlying declarative claim before authoring: a possibly-false premise downstream depends on → `assumption`; how success will be judged → `criterion`; an open choice among alternatives → `context` stating the choice is unresolved (preserve wording in `body`); a follow-up with no stable claim yet → keep out of graph truth. When such a `context` later resolves, author a fresh `decision` and link `decision -[supersession]-> context`.
- **Promote before filing as `context`.** `context` is the last-resort descriptive bucket. Before filing one, check for promotion: must be true for success → `requirement`/`invariant`; limits acceptable solutions → `constraint`; may be false and matters → `assumption`; chooses among alternatives → `decision`; a bet about users/market/value → `thesis`; only aids interpretation → keep as `context`.

Invoke `mutate_graph` when the batch can be validated atomically and the user-facing commitment is already settled. For direct agent commits in the current product posture, keep the batch create-only: `create_node` ops plus role-named `create_edge` ops. On `structural_illegal`, use diagnostics to repair and retry within the current method budget; do not expose half-written state or manually patch around CommandExecutor. On ambiguity, stop and ask or route through `generate-proposal`.

Compose this with `read-context` before the write and `capture` when the write follows a completed exchange. Out of scope: direct database writes, raw file edits, invented edge categories, partial acceptance, or using graph commits for workspace posture.
