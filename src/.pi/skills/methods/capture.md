# Method: capture

Capture is the single home for FE-861 foreground elicitor selected-spec sweep discipline. Use it after every elicitor turn, before composing the next question: first turn the un-swept transcript tail into graph truth or elicitation agenda, then ask from the updated world.

## Goal

Keep graph truth high-confidence without losing useful low-confidence material.

```pseudo
chain capture-then-ask:
  unswept transcript tail
    -> banded capture sweep
    -> mutate_graph / update_elicitation_gaps
    -> next question over updated graph + gaps
```

## Sweep frame

Walk the un-swept material once by readiness band and likely node kind. Conversational answers, ordinary user text, and acquisition digests are all sweep inputs. Large raw reads or tool results should be digested first; capture from the digest plus the conversation, not from unbounded raw bulk.

Use the graph and gap tools as the mutation boundary:

| Capture outcome | Tool | Boundary rule |
| --- | --- | --- |
| Graph truth | `mutate_graph` | one selected-spec graph mutation through the role-named grammar |
| New agenda | `update_elicitation_gaps` `spawn` | one gap write; question/rationale only, not domain truth |
| Manual gap disposition | `update_elicitation_gaps` `set_disposition` | one disposition write on the graph clock |

Do not invent graph payload fields, LSNs, result shapes, or capture-local edge syntax. Relation-bearing capture uses `mutate_graph` role fields such as `dependency/dependent`, `support/claim`, `abstract/concrete`, `boundary/subject`, and sibling category roles.

## Commitment gradient

Confidence controls commitment. Directness alone does not.

| If the swept item is... | Route | Basis |
| --- | --- | --- |
| directly stated by the user | commit graph truth | `explicit` |
| confidently materialized from stated content, including safe implied edges or structure | commit graph truth | `implicit` |
| a low-confidence noticing, suspicion, possible implication, or missing piece | never commit; map to an elicitation gap | gap `basis: implicit` |

Low-confidence material must not become graph truth. Its durable form is an `elicitation_gap`: a question plus rationale that names the node kind it would help establish.

```pseudo
data-shape low-confidence-noticing:
  noticing: "They may need live graph latency guarantees"
  not graph truth: no requirement / criterion / assumption node yet
  gap:
    refersTo: assumption | requirement | criterion | constraint | ...
    question: "Should graph observer freshness carry a hard latency promise?"
    rationale: "Freshness pressure appeared in the answer, but was not established."
```

## Gap conduct

Gap close/spawn responsibility belongs here, not in `review-for-gaps`; read/interpret-gap semantics stay on the `read_elicitation_gaps` tool description.

Before spawning, abstract-map the noticing onto the existing agenda:

1. Read current gaps when a noticing could be an already-open obligation.
2. Prefer the existing matching gap when the noticing asks for the same kind of missing material.
3. Spawn only when no existing gap carries that obligation.
4. Spawn gaps as questions/rationales, never as hidden domain assertions.

Structural gaps become answered from graph truth. Do not hand-set `answered` for presence/field/coverage predicates. Use `set_disposition` only for manual dispositions such as a manually judged gap becoming answered, not to shadow graph-derived coverage.

## Relation-bearing capture

Review captured nodes before adding edges:

```pseudo
chain relation-capture:
  candidate relation
    -> check previous-band nodes
    -> check likely upstream kinds
    -> commit missing high-confidence nodes first
    -> commit edge with role-named endpoints
```

If either endpoint is low-confidence, do not create the edge. Spawn or reuse a gap for the missing endpoint/relationship instead.

## Anti-goals

- Do not run a product-side extraction pass or revive submit-time labeled-prefix capture.
- Do not create observer/auditor queues as the primary capture path.
- Do not store low-confidence domain content inside gaps as if it were truth.
- Do not create a second mutation clock; graph mutations and gap writes share the selected spec's `{specId, lsn}` change log.
- Do not use capture-local `{category, source, target}` edge dialects; use the canonical role-named `mutate_graph` grammar.
