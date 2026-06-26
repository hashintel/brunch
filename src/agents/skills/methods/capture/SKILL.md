---
name: capture
description: "Capture selected-spec facts and gap noticings through the banded capture-sweep conduct."
---

# Method: capture

Capture is the single home for foreground elicitor selected-spec sweep discipline. Use it after every elicitor turn, before composing the next question: first turn the un-swept transcript tail into graph truth, elicitation agenda, or reconciliation agenda, then ask from the updated world.

## Goal

Keep graph truth high-confidence without losing useful low-confidence material. The sweep bands are procedural passes over the conversation, not ontology law: they guide what to notice next, while graph legality still comes from the generated ontology and mutation tools.

```pseudo
chain capture-then-ask:
  unswept transcript tail or acquisition digest
    -> capture-sweep passes
    -> mutate_graph / update_elicitation_gaps / update_reconciliation_needs
    -> next question over updated graph + gaps
```

## Capture-sweep passes

Walk the un-swept material once using the current conversation stage as an attention order. If the user gives later-band material early, capture it honestly; do not down-rank or discard it because the session has not “reached” that band. Stage guides questioning, not graph validity.

| Pass | Attention job | Common route |
| --- | --- | --- |
| Grounding → orient | domain, protagonist, pain/pull, vocabulary, constraints, ambient context | intent graph truth or grounding gaps |
| Elicitation → strengthen | requirements, assumptions, constraints, invariants, decisions, criteria, examples | graph truth when explicit/implicit confidence is high; gaps otherwise |
| Anytime sidecar | `story`, `sketch`, and `example` material that appears opportunistically | capture as the given kind when useful; do not force it into the current band |
| Projection: design → derive shape | modules, interfaces, entities, sketches implied by accepted intent | usually review-set/proposal material; direct capture only when user explicitly establishes it |
| Projection: oracle → derive witness | criteria, checks, methods, evidence, obligations, examples/counterexamples | graph truth or proposal material; keep checkability as conduct, not schema |
| Projection: closure → commitments | reviewable decisions, accepted batches, contradictions, unsettled commitments | graph truth, review set, or reconciliation need |
| Projection: plan → sequence work | milestones, frontiers, slices, dependencies, acceptance signals | graph truth or proposal material anchored to accepted pressure |

Use `src/agents/contexts/references/context-slice-index.md` to choose the smallest topical reference for the pass. For ordinary capture, prefer `intent-capture-slice.md` plus `graph-authoring-heuristics.md`; pull design/oracle/plan slices only when the user actually supplied or requested that material. The exact node/edge vocabulary lives in `src/agents/contexts/references/graph-ontology.md` and the shared graph-authoring judgment — declarative claims, low-confidence routing, contradiction routing, confident endpoints, and role-named mutation grammar — lives in `src/agents/contexts/references/graph-authoring-heuristics.md`.

Conversational answers, ordinary user text, and acquisition digests are all sweep inputs. Large raw reads or tool results should be digested first; capture from the digest plus the conversation, not from unbounded raw bulk.

Use the graph, gap, and reconciliation tools as the mutation boundary:

| Capture outcome | Tool | Boundary rule |
| --- | --- | --- |
| Graph truth | `mutate_graph` | one selected-spec graph mutation through the role-named grammar |
| New agenda | `update_elicitation_gaps` `spawn` | one gap write; question/rationale only, not domain truth |
| Manual gap disposition | `update_elicitation_gaps` `set_disposition` | one disposition write on the graph clock |
| Contradiction with existing graph truth | `update_reconciliation_needs` `create` | one reconciliation need; records the impasse, never overwrites the conflicting node |
| Candidate batch needing judgment | `present_review_set` | reviewable proposal only; commitment waits for explicit approval |

Do not invent graph payload fields, LSNs, result shapes, or capture-local edge syntax. Follow the role-named mutation grammar in `graph-authoring-heuristics.md`.

## Commitment gradient

Confidence controls commitment. Directness alone does not.

| If the swept item is... | Route | Basis |
| --- | --- | --- |
| directly stated by the user | commit graph truth | `explicit` |
| confidently materialized from stated content, including safe implied edges or structure | commit graph truth | `implicit` |
| coherent but judgment-heavy candidate material | present a review set | no graph basis until accepted |
| a low-confidence noticing, suspicion, possible implication, or missing piece | never commit; map to an elicitation gap | gap `basis: implicit` |
| a contradiction with existing graph truth | never commit or spawn a gap; create a reconciliation need | `semantic_conflict` over the conflicting `node_pair` |

Low-confidence material must not become graph truth. Its durable form is an `elicitation_gap`: a question plus rationale that names the node kind it would help establish. A contradiction is different: it is not missing prospective coverage, but a retrospective impasse over existing graph truth. Record it as a `reconciliation_need` so repair stays distinct from the elicitation agenda.

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

Review captured nodes before adding edges. Use `graph-authoring-heuristics.md` for the shared relation-bearing rule: commit missing high-confidence endpoints first, use role-named endpoints, and skip the edge when either endpoint is low-confidence. Spawn or reuse a gap for the missing endpoint/relationship instead.

When reading existing context for an anchor, prefer edge-local neighborhoods over global kind buckets: dependencies, dependents, evidence, refinements, lateral neighbors, gaps, and reconciliation needs tell you why the anchor stands and what changes if it moves.

## Anti-goals

- Do not run a product-side extraction pass or revive submit-time labeled-prefix capture.
- Do not create a separate model-invoked skill for each ontology kind; the capture-sweep bands are procedural conduct.
- Do not create observer/auditor queues as the primary capture path.
- Do not store low-confidence domain content inside gaps as if it were truth.
- Do not file contradictions as elicitation gaps; use reconciliation needs for retrospective impasses.
- Do not create a second mutation clock; graph mutations, gap writes, review acceptance, and reconciliation-need writes share the selected spec's `{specId, lsn}` change log.
- Do not use capture-local `{category, source, target}` edge dialects; use the canonical role-named `mutate_graph` grammar.
