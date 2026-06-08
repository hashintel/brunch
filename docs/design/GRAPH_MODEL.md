# Graph Model

Canonical reference for the Brunch graph data plane (M4 and onward).
Owns both the edge layer and the node layer end-to-end.

This document is the lock for the graph model that supersedes the
prior "large semantic edge-type catalogue + relation-policy registry"
direction and the deferred `framing_as` modality. It is also the
source of truth for the type definitions under
[`src/graph/`](../../src/graph/) and the per-category policy table
consumed by query/projection builders and the `CommandExecutor`.

`memory/SPEC.md` and `memory/PLAN.md` are reconciled to this doc;
if later planning text drifts, treat this document as the canonical
graph-model contract.

## Status

- **Phase 1:** edges, edge policy, reconciliation-need shape. Locked.
- **Phase 2:** per-plane node kinds, node shape, detail schemas,
  kind categories, `source` field, `provenance` retirement. Locked.
- **Current lock:** stable node reference codes, `basis` as
  approval strength (`explicit | implicit`), non-exclusive
  readiness bands, supersession acyclicity, and graph-context
  read separation. Locked.

## Scope and posture

The primary author of graph nodes and edges in Brunch is an LLM
agent — through direct elicitation, post-exchange capture, review-set
proposals, and reviewer findings. Two pressures follow from that:

1. **Authoring burden must be low.** The agent should not be asked
   to choose among many named relation kinds, each with its own
   tuple-specific legality and its own projection policy.
2. **Interpretation burden at read/render time must be low.** Context
   builders should derive dependency/dependent/support/realization
   buckets from the stored edge's category and endpoint roles, not
   from a per-relation policy registry.

This drives the design move: store a small closed set of
**structural edge categories with endpoint roles**. Derive
domain-specific labels later from tuple context (see
[§Tuple-label lookup](#tuple-label-lookup)). The category drives all
policy.

## Atoms

```ts
type SpecId      = number
type NodeId      = number   // SQLite integer primary key / FK
type EdgeId      = number   // SQLite integer primary key / FK
type KindOrdinal = number   // monotonic per (spec, plane, kind)
type Lsn         = number   // monotonic, one per commit
```

`NodeId` and `EdgeId` are internal storage identities. The database
stores `kindOrdinal`, not a rendered reference-code string. Human
and agent-facing references use projected codes such as `R3`, derived
from `node.kind` plus `kindOrdinal` through a hard-coded presentation
lookup (see [§Stable node reference codes](#stable-node-reference-codes)).

## Graph basis — approval strength, not mutation path

```ts
type GraphBasis = "explicit" | "implicit"
```

`basis` is shared by nodes and edges. It records whether the exact
accepted graph item was user-approved:

- **`explicit`** — the user directly stated the node/edge, or
  approved that exact node/edge in a review set.
- **`implicit`** — the user accepted a concept/proposal, and the
  agent materialized specific graph items to match it without
  per-item review (the `propose-graph` direct-commit path).

`basis` does **not** record the mutation pathway. The pathway lives
in `change_log.operation` and payload (`commit_graph`,
`accept_review_set`, post-exchange capture, etc.). Low-confidence
inferred material still stays outside graph truth until clarified or
accepted.

## GraphEdge — the single shape

```ts
type EdgeCategory =
  | "dependency"
  | "proof"
  | "support"
  | "realization"
  | "boundary"
  | "composition"
  | "association"
  | "supersession"

type EdgeStance = "for" | "against"           // required for proof | support
type EdgeBasis  = GraphBasis

interface GraphEdge {
  readonly id:           EdgeId
  readonly specId:       SpecId
  readonly category:     EdgeCategory
  readonly sourceId:     NodeId
  readonly targetId:     NodeId
  readonly stance?:      EdgeStance            // REQUIRED for proof, support
                                               // INVALID for other categories
  readonly basis:        EdgeBasis
  readonly rationale?:   string
  readonly createdAtLsn: Lsn
  readonly updatedAtLsn: Lsn                   // metadata only;
                                               // category/source/target/stance are immutable
                                               // (change category = delete + recreate)
}
// provenance (sessionId, entryId, proposalEntryId) is retired from
// the edge shape. The change_log at createdAtLsn owns all audit
// trail; transcript entry pointers are fragile under compaction.
```

### What this shape does NOT carry

The prior model carried fields that are dropped here. Each has a
named successor home; nothing is lost, the substrates are different.

| Dropped field             | Successor home                                                       |
| ------------------------- | -------------------------------------------------------------------- |
| `status: proposed`        | Review-set drafts (D27-L) — not a graph edge yet                     |
| `status: accepted`        | The edge simply exists                                               |
| `status: rejected`        | Edge was never created, or was deleted. Audit lives in `change_log`  |
| `status: stale`           | A `ReconciliationNeed` with `target.kind = "edge"` references it     |
| `support: weak_candidate` | Lives in structured-exchange `preface` or `capture_*` analysis (D47-L, D50-L) |
| `support: strong_inference` | Same — promoted to accepted edge only via review set                |
| `relation: <named kind>`  | Collapsed into category + stance + endpoint roles                    |
| `family`                  | Implied by category                                                  |
| Per-relation policy axes  | Per-category policy table below                                      |

Audit for edge writes lives in the `change_log` keyed by
`createdAtLsn` / `updatedAtLsn`. Edges do not denormalize transcript
pointers or mutation pathway. Their `basis` only records item-level
approval strength.

## Edge categories — directional first

Seven directional categories and one symmetric. The first cut for
the agent is the cardinality question — *directional or peer?* —
which routes to the right rubric before any subtler discrimination.

| Category       | Source role  | Target role  | Meaning                                                   |
| -------------- | ------------ | ------------ | --------------------------------------------------------- |
| `dependency`   | dependency   | dependent    | Hard upstream — downstream validity depends on it         |
| `proof`        | oracle       | claim        | Oracle-bearing witness (`for`) or refutation (`against`)  |
| `support`      | support      | claim        | Motivation, rationale, evidence; not load-bearing         |
| `realization`  | abstract     | concrete     | Expression / implementation / establishment / assertion   |
| `boundary`     | boundary     | subject      | Scope rule, constraint, exclusion, limit                  |
| `composition`  | whole        | part         | Containment / decomposition (NOT sequencing)              |
| `supersession` | successor    | predecessor  | Intentional replacement; acyclic                          |
| `association`  | peer         | ↔ peer       | Weak relatedness; last resort                             |

Notes on the categories most likely to be confused:

- **`proof` vs `support`.** Both have stance. `proof` is
  oracle-bearing — the source is an artifact whose function is to
  witness (or refute) the claim: a `criterion`, a `check`, an
  `example` used as positive witness or counterexample, a piece of
  `evidence`. `support` is rationale-bearing — the source explains
  why the target exists or motivates it without being load-bearing:
  a `context`, a goal-shaped motivation, a non-oracle example used
  for illustration. If invalidating the source should drive a
  `criteria-help` signal or progressive-checkability rendering, it
  is `proof`; if it just changes the rationale, it is `support`.
- **`dependency` vs `support`.** Both run upstream-to-downstream.
  Use `dependency` only when downstream validity or readiness
  depends on the upstream. Use `support` when the upstream explains
  or motivates but the downstream could still stand if the support
  changed.
- **`realization` vs `composition`.** Composition is whole/part.
  Realization is abstract/concrete (same conceptual thing,
  different level of specification). A milestone *composes* its
  slices; a requirement is *realized* by a slice.
- **`boundary` vs `support:against`.** Boundary is when the source
  is itself a scope rule / constraint / non-goal. `support:against`
  is when the source is evidence or an example that argues against
  the claim.
- **`supersession` vs `realization`.** Supersession is temporal /
  evolutionary replacement of overlapping scope. Realization is
  abstract-to-concrete elaboration. A new requirement *supersedes*
  an old requirement it replaces; a module *realizes* the
  requirement (no replacement).

## Per-category policy

The category drives all policy. This is the **single** per-category
metadata table — materialized as `EDGE_CATEGORY_METADATA` in
[`src/graph/policy/category-policy.ts`](../../src/graph/policy/category-policy.ts).
It supersedes the earlier split where endpoint-role/reconciliation
metadata briefly lived in `schema/edges.ts` while a drifted
`CATEGORY_POLICY` lived alongside it (the two disagreed on impact
direction for `proof`/`support`). The `CommandExecutor` enforces
structural legality at write time; query/render builders use source
and target roles to label edges semantically; coherence and the
reconciliation flow use the impact columns. Mechanical `incoming` /
`outgoing` direction is only endpoint geometry for filters and traversal.

|                | Source role | Target role | Impact on source change | Impact on target change | criteria-help signal | projection effect                    |
| -------------- | ----------- | ----------- | ----------------------- | ----------------------- | :------------------: | ------------------------------------ |
| `dependency`   | dependency  | dependent   | cascade → target        | none                    |          —           | —                                    |
| `proof`        | oracle      | claim       | none                    | advisory → source       |          ✓           | —                                    |
| `support`      | support     | claim       | none                    | advisory → source       |          —           | —                                    |
| `realization`  | abstract    | concrete    | advisory → target       | none                    |          —           | —                                    |
| `boundary`     | boundary    | subject     | advisory → target       | none                    |          —           | —                                    |
| `composition`  | whole       | part        | none                    | advisory → source       |          —           | —                                    |
| `association`  | peer        | peer        | none                    | none                    |          —           | —                                    |
| `supersession` | successor   | predecessor | none                    | advisory → source       |          —           | hide predecessor from active context |

Legend:

- **impact on source/target change** — if the named endpoint node
  changes, how the *opposite* endpoint is affected: `cascade` (hard —
  may auto block / mark-stale), `advisory` (soft — surface a
  `ReconciliationNeed`), or `none`. The arrow names the impacted
  (downstream) endpoint. A well-formed category drives impact in at
  most one direction.
- **criteria-help** — used by the interviewer to suggest criteria for
  the claim ("requirement with no incoming `proof` edge → suggest
  criterion").
- **projection effect** — how query/neighborhood builders treat the
  edge in active-context views.

Only `dependency` triggers a hard cascade. Other categories surface
as advisory reconciliation needs at most; they do not auto-block
downstream items.

The impact columns are *not* aligned with source→target geometry:
for `dependency`/`realization`/`boundary` the source is upstream, but
for `proof`/`support`/`composition`/`supersession` the **target** is
upstream. The directional projection (below) derives upstream /
downstream / lateral from these columns so the reconciliation flow
never has to guess direction from the arrow.

## Worked examples — same shape across planes

```text
# Intent (M4)
A_local_only  : assumption   -[dependency]->        D_no_auth      : decision
C_no_cloud    : constraint   -[boundary]->          D_no_auth      : decision
I_no_network  : invariant    -[realization]->       R_offline      : requirement
CR_airplane   : criterion    -[proof:+]->           I_no_network   : invariant
E_typical     : example      -[proof:+]->           R_offline      : requirement
E_outage      : example      -[proof:-]->           A_local_only   : assumption

# Oracle (M5+ stub) — folds prior validates/instance_of/produces/discharges
CR_airplane   : criterion         -[realization]->  CH_airplane    : check
CH_airplane   : check             -[proof:+]->      I_no_network   : invariant
CH_airplane   : check             -[realization]->  VM_unit        : validation_method
CH_airplane   : check             -[realization]->  EV_trace       : evidence
CH_airplane   : check             -[proof:+]->      OB_no_network  : obligation
OB_no_network : obligation        -[realization]->  I_no_network   : invariant

# Design (M5+ stub)
R_offline         : requirement   -[realization]->  M_sqlite_store : module
IF_session_store  : interface     -[realization]->  M_sqlite_store : module
M_sqlite_store    : module        -[composition]->  M_sqlite_helper: module
M_sqlite_store    : module        -[dependency]->   M_pi_session   : module

# Plan (M5+ stub)
MS_graph     : milestone   -[composition]->         FR_graph_data  : frontier
FR_graph_data: frontier    -[composition]->         SL_persist     : slice
R_offline    : requirement -[realization]->         SL_persist     : slice
SL_persist   : slice       -[supersession]->        SL_persist_v0  : slice
```

No plane-crossing rules. Node `kind` does not constrain edge
category legality. The categories were chosen so that the
cross-plane vocabulary stays naturally narrow.

## ReconciliationNeed — separate substrate, NOT a graph edge

```ts
type ReconciliationNeedKind =
  | "edge_revalidation"   // existing edge needs re-checking
  | "possible_relation"   // two nodes might need an edge
  | "possible_duplicate"  // two nodes might be the same
  | "semantic_conflict"
  // open extension

type ReconciliationNeedTarget =
  | { readonly kind: "edge";      readonly edgeId: EdgeId }
  | { readonly kind: "node_pair"; readonly aId: NodeId; readonly bId: NodeId }

interface ReconciliationNeed {
  readonly id:             string
  readonly kind:           ReconciliationNeedKind
  readonly target:         ReconciliationNeedTarget
  readonly rationale?:     string
  readonly createdAtLsn:   Lsn
  readonly resolvedAtLsn?: Lsn
}
```

Reconciliation needs reference graph state. They are **not** graph
edges. They do not appear in projection neighborhoods as edges.
They surface to the user through next-turn delivery as advisory
items, per D29-L.

`target.kind = "edge"` is the default — recon_needs describe
relations whose semantic basis may have changed. `target.kind =
"node_pair"` covers the cases where no edge exists yet (possible
duplicate, possible relation). When a `node_pair` need resolves to
"yes, edge exists," create the edge and close the need; an audit
choice about whether to rewrite the need's target to `edge` form is
deferred.

## Tuple-label lookup

Tuple-label lookup is a presentation concern only. It produces
plain-language phrasing for graph context, UI, and prompt
context. It does not change category policy; it only renders the
stored edge readably from one endpoint's perspective.

Examples:

| Stored edge                                | View from source        | View from target           |
| ------------------------------------------ | ----------------------- | -------------------------- |
| `dependency(assumption → decision)`        | "premise for decision"  | "depends on assumption"    |
| `dependency(assumption → requirement)`     | "required by requirement"| "depends on assumption"   |
| `support(context → requirement, for)`      | "motivates requirement" | "motivated by context"     |
| `proof(criterion → invariant, for)`        | "witnesses invariant"   | "witnessed by criterion"   |
| `proof(example → invariant, against)`      | "counterexample for invariant" | "challenged by counterexample" |
| `realization(invariant → requirement)`     | "expressed by requirement" | "expresses invariant"   |
| `realization(requirement → design module)` | "realized by module"    | "realizes requirement"     |
| `realization(interface → adapter)`         | "implemented by adapter"| "implements interface"     |
| `realization(requirement → plan slice)`    | "established by slice"  | "establishes requirement"  |
| `boundary(non-goal → requirement)`         | "rules out / limits"    | "bounded by non-goal"      |
| `composition(milestone → slice)`           | "contains slice"        | "belongs to milestone"     |
| `supersession(new req → old req)`          | "supersedes prior"      | "superseded by"            |
| `association(A ↔ B)`                       | "related to B"          | "related to A"             |

The lookup is materialized as `edgeLabel()` in
[`src/graph/projection/labels.ts`](../../src/graph/projection/labels.ts).
It is a two-tier static table:

- **Tier 1 (base)** keyed on `(category, anchorRole, stance)` — ~18
  cells covering every edge from the anchor's perspective. The
  neighbor's `kind` is rendered separately, so headings never embed it.
- **Tier 2 (refine)** keyed on `(category, sourceKind, targetKind)` —
  optional finer verbs where the neighbor's kind alone is too vague
  (primarily the realization sub-types). Deliberately small; absence
  falls back to the Tier-1 heading.

The lookup cannot change category policy; it only renders the stored
edge readably from one endpoint's perspective.

### Realization sub-types — tuple-implied, not edge-encoded

The prior brainstorm proposed splitting `realization` into
`implementation`, `establishment`, `assertion`, and `expression`.
The current bet is that those distinctions emerge from tuple
context — e.g. `realization(requirement → module)` reads as
"implementation," `realization(requirement → slice)` reads as
"establishment" — and therefore live in the label-lookup table
rather than as an edge-shape field. If probe runs surface three or
more realization sub-clusters that demand distinct cascade or
projection policy, split `realization` into siblings (see
[§Open questions](#open-questions)).

## Context projections and bucketing

Two projection axes are derived from the per-category metadata, never
from the rendered label string. Both are anchor-relative — they read
an edge from the perspective of one node:

- **Semantic labels** ([`projection/labels.ts`](../../src/graph/projection/labels.ts))
  — direction-aware phrasing (`depends on`, `realizes`, `motivated
  by`) from `(category, anchorRole, stance)` plus optional kind
  refinement. Drives readable per-edge text.
- **Directional grouping** ([`projection/direction.ts`](../../src/graph/projection/direction.ts))
  — `upstream` / `downstream` / `lateral` plus `hard` / `soft`
  strength, derived from the impact columns. Drives the
  reconciliation flow (log downstream impacts when a node changes) and
  the neighborhood section grouping. `relationFromAnchor` returns
  `downstream` when the anchor sits at the upstream end (changing the
  anchor impacts the neighbor) and `upstream` when it sits at the
  downstream end.

The two compose: the neighborhood renderer groups incident edges by
directional relation and labels each line semantically. A pure
semantic-bucket grouping (by category role rather than direction) is
an alternative view over the same two functions.

Callers must also choose which projection they want:

- **`graph_truth`** — accepted graph truth records. Superseded
  predecessors and their edges may still appear because they are
  part of auditably accepted graph state.
- **`active_context`** — the context the agent/user should treat as
  current. Superseded predecessor nodes are hidden, and edges whose
  endpoints are hidden are also omitted so active-context reads
  never contain dangling references.

The read family should stay product-shaped and close to observed
needs, not become a generic records API:

```ts
listNodes({ kinds?, readinessBands?, basis?, activeOnly? })

relatedNodes({
  anchors,
  edgeCategories?,
  direction: "incoming" | "outgoing" | "both",
  hops?,
  projection?: "graph_truth" | "active_context",
})

overview({ projection: "graph_truth" | "active_context" })
```

A rendered neighborhood context of an intent node, grouped by the
directional axis and labelled semantically (exact layout is still
being tuned; the projection contract is what is locked):

```text
[Selected-spec node context]
- anchor: [REQ1] intent/requirement: Stage 2 must compute three configuration spaces…
- upstream (review anchor if these change):
  - depends on [A1] intent/assumption: Users run fully local…
  - realizes [INV3] intent/invariant: No network call in the offline path…
- downstream (reconcile if anchor changes):
  - required by [D11] intent/decision: Adopt the two-stage split… {hard}
  - witnessed by [CR1] intent/criterion: Airplane-mode test passes… {soft}
- lateral (related):
  - related to [CTX2] intent/context: Stakeholder preference…
```

`{hard}` marks a `dependency` cascade; `{soft}` marks an advisory
reconciliation need.

## Structural invariants

- Edge categories are closed. Agents cannot submit arbitrary
  relation strings.
- Every edge has exactly one category.
- `stance` is required iff `category ∈ { proof, support }`.
- `basis` is exactly `explicit | implicit` for accepted nodes and
  edges; mutation path is recovered from `change_log`, not from
  `basis`.
- Every node has a stable `kindOrdinal`; rendered reference codes are
  a projection from `kind` + `kindOrdinal`, not stored graph state.
- `(specId, plane, kind, kindOrdinal)` is unique, and ordinals are
  monotonic / never reused for that tuple.
- `association` is symmetric at the product level even if stored
  with `sourceId` / `targetId` columns.
- `supersession` chains are acyclic. CommandExecutor validation
  checks proposed supersession edges together with existing edges.
- Accepted graph edges are graph truth. Candidate or low-confidence
  edges live outside graph truth (preface / capture analysis /
  review-set drafts) until accepted.
- Tuple-label lookup cannot change category policy.
- Context bucket assignment comes from category and endpoint role,
  not from label strings.
- Active-context reads omit superseded nodes and any edge whose
  endpoint is omitted.
- `composition` does not imply sequencing or dependency.
- `support` does not imply blocking / staleness by default.
- Only `dependency` triggers automatic cascades; other categories
  surface as `ReconciliationNeed` records when policy says so.
- Cross-plane freedom: node `kind` does not constrain edge
  category legality.
- Readiness bands do not constrain node creation legality.

## Agent-facing command surface

Prefer category-specific commands over one generic
`createEdge({ category })` command — the call site documents the
intended role:

```ts
linkDependency({ dependency, dependent, basis, rationale })
linkProof({ oracle, claim, stance, basis, rationale })
linkSupport({ support, claim, stance, basis, rationale })
linkRealization({ abstract, concrete, basis, rationale })
linkBoundary({ boundary, subject, basis, rationale })
linkComposition({ whole, part, basis, rationale })
linkAssociation({ a, b, basis, rationale })
linkSupersession({ successor, predecessor, basis, rationale })
```

The command layer owns structural validation. If a tuple is
structurally illegal (missing stance, supersession cycle, etc.) the
tool returns `structural_illegal`; the agent should not invent a
narrower category to force the write through. In most agent-facing
flows, `basis` is supplied by the strategy adapter or execution
context (`explicit` for exact user/review approval, `implicit` for
`propose-graph` materialization), not improvised per edge.

These commands land in the M5 `agent-graph-integration` extension
under `src/.pi/extensions/graph/tools/` per D52-L. They are out of
scope for Phase 1 stubs.

### `commitGraph` — atomic batch mutation (D53-L)

The `propose-graph` strategy's load-bearing tool. One tool call
creates an entire subgraph — nodes and edges — in a single
transaction with one LSN. Direct `propose-graph` commits use
`basis: "implicit"` because the user accepted a concept, not each
individual item. Review-set acceptance is a parallel path to the
same executor and uses `basis: "explicit"` because the user approved
the exact reviewed items.

```ts
commitGraph({
  basis: "implicit",
  nodes: [
    { ref: "n1", plane: "intent", kind: "requirement", title: "...", body: "..." },
    { ref: "n2", plane: "intent", kind: "constraint",  title: "...", body: "..." },
    { ref: "n5", plane: "intent", kind: "invariant",  title: "...", body: "..." },
    { ref: "n3", plane: "intent", kind: "decision",    title: "...", body: "...",
      detail: { chosen_option: "...", rejected: ["..."], rationale: "..." } },
    { ref: "n4", plane: "intent", kind: "term", title: "...",
      detail: { definition: "...", aliases: ["..."] } },
  ],
  edges: [
    { category: "dependency",   source: "n1",                    target: "n2" },
    { category: "boundary",     source: "n2",                    target: "n1" },
    { category: "realization",  source: "n1",                    target: "n3" },
    { category: "support",      source: { existingCode: "A1" },  target: "n1",
                                stance: "for" },
  ]
})
```

Reference modes:

- **Intra-batch**: `"n1"` — a node defined in the same payload.
- **Existing**: `{ existingCode: "A1" }` — a node already in the
  selected spec, addressed by a projected reference code. Tool
  adapters parse this to `kind` + `kindOrdinal` and resolve the
  numeric `NodeId` before calling lower-level executor helpers; graph
  tables do not store the rendered code string.

CommandExecutor processing:

```
commitGraph tool call
        │
        ▼
  1. Validate all nodes structurally
  2. Allocate ONE Lsn
  3. Allocate per-kind ordinals
  4. Insert nodes and build batch ref → NodeId/kindOrdinal map
  5. Resolve intra-batch refs on edges
  6. Resolve existing-node refs (fail if not found or wrong spec)
  7. Validate all edges (closed categories, stance, supersession acyclicity)
  8. Write all nodes + edges + change-log in one transaction
  9. Return success + created ids/kindOrdinals (adapters may render codes)
     OR structural_illegal + diagnostics for retry
```

All-or-nothing (I34-L): if any node or edge fails, the entire batch
is rejected. The agent may retry within a bounded budget; the user
does not see intermediate failures.

`commitGraph` and `acceptReviewSet` (D27-L) are parallel paths to the
same CommandExecutor — one for direct agent-authored commits after
concept acceptance, one for user-reviewed batch proposals.

## Prompting

System-prompt fragment for graph-writing agents:

```text
When creating graph edges, choose only from Brunch's structural edge categories:
dependency, proof, support, realization, boundary, composition, association, supersession.

Do not invent relation names such as depends_on, validates, witnesses, implements,
expresses, motivated_by, or related_concern. Those are rendering labels derived later
from the stored category and endpoint node kinds.

Create an accepted graph edge only when the relation is clear enough to become graph truth.
If the relation is weak, speculative, ambiguous, or merely a possible duplicate / possible
relation, do not create an accepted edge. Keep it in preface / capture analysis or raise a
reconciliation_need.

Use one edge for the strongest operational role between two nodes. Do not create multiple
edges merely because several English paraphrases are possible.

Basis rule: use explicit only when the user directly stated the item or approved the exact
node/edge in a review set. Use implicit for propose-graph commits where the user accepted
the concept but did not review each graph item. Do not use accepted_review_set as a basis.

Readiness rule: readiness grade and readiness bands guide what to ask for next; they do not
forbid capturing clear requirements, criteria, checks, or design nodes early.
```

Category-selection rubric (ask in order; stop at first strong match):

```text
0. Should this be graph truth now?
   - explicit user statement, exact accepted review set item, high-confidence extraction,
     or accepted propose-graph concept with clear materialization -> continue
   - weak inference, possible relation, possible duplicate, unresolved ambiguity -> no accepted edge

1. Is a newer item intentionally replacing an older item for overlapping scope?
   -> supersession(successor -> predecessor)

2. Is this a whole/part, parent/child, or decomposition relation?
   -> composition(whole -> part)

3. Does one item limit, exclude, scope, or constrain another?
   -> boundary(boundary -> subject)

4. If the upstream item is invalidated, must the downstream be revisited/blocked/stale?
   -> dependency(dependency -> dependent)

5. Is the source an oracle artifact that witnesses or refutes the claim
   (criterion, check, example as witness/counterexample, evidence)?
   -> proof(oracle -> claim, stance: for | against)

6. Is one item a concrete expression, implementation, assertion, or establishment of another?
   -> realization(abstract -> concrete)

7. Does one item motivate, justify, evidence, or challenge another without being load-bearing
   and without being an oracle?
   -> support(support -> claim, stance: for | against)

8. Are the two items usefully related, but no stronger role is safe?
   -> association(a <-> b)

9. Otherwise, create no edge.
```

## Naming notes

- **`proof` collides with the prior `proof` checkability tier.** If
  the progressive-checkability ladder lands as node metadata in
  Phase 2 or later, rename its tier to `formal_proof` to avoid
  collision with the edge category. The category name *proof*
  covers any oracle-bearing witness; *formal_proof* is one rung at
  the strong end of the checkability ladder.

## GraphNode — the single shape

```ts
interface GraphNode {
  readonly id:           NodeId             // internal SQLite identity
  readonly specId:       SpecId
  readonly kindOrdinal:  KindOrdinal        // per (spec, plane, kind)
  readonly plane:        NodePlane
  readonly kind:         string             // per-plane closed enum (see below)
  readonly title:        string             // required, non-empty
  readonly body?:        string             // markdown content
  readonly basis:        NodeBasis
  readonly source?:      string             // free-form epistemic attribution
                                             // convention by prompt, not structural validation
                                             // e.g. "stakeholder", "regulatory", "derived"
  readonly detail?:      object             // per-kind validated sub-structure (JSON column)
  readonly createdAtLsn: Lsn
  readonly updatedAtLsn: Lsn
}

type NodePlane = "intent" | "oracle" | "design" | "plan"
type NodeBasis = GraphBasis
// Same semantics as EdgeBasis — item-level approval strength.
// No "inferred" basis; low-confidence material stays in preface /
// capture analysis until promoted.
```

### Fields

- **`id`** — internal storage/FK identity. It is stable, but not the
  primary human or agent-facing handle.
- **`specId`** — selected-spec owner. Ordinals and projected
  reference codes are scoped by spec.
- **`kindOrdinal`** — monotonic integer per `(specId, plane, kind)`;
  never reused after deletion or supersession. The rendered human
  reference code is derived later from `kind` + `kindOrdinal`.
- **`plane`** — which graph plane owns this node. Structurally
  validated; determines which `kind` enum applies.
- **`kind`** — per-plane closed enum. Structurally validated by
  the `CommandExecutor`. See [§Per-plane node kinds](#per-plane-node-kinds).
- **`title`** — required, non-empty. The human-readable name of the
  node. Used for mentions, context display, and search.
- **`body`** — optional markdown content. Carries the semantic detail
  the agent authored. Most kinds put their primary content here.
- **`basis`** — item-level approval strength: `explicit` or
  `implicit`. See [§Graph basis](#graph-basis--approval-strength-not-mutation-path).
- **`source`** — free-form string for epistemic attribution.
  Convention by prompt (e.g. "stakeholder", "regulatory", "derived",
  "domain expert", "market research", "agent synthesis"), not
  structural validation. Exists for context-render enrichment —
  it will be transformed back into sparse text in prompt context,
  not used for policy or filtering.
- **`detail`** — optional JSON object with per-kind validated
  sub-structure. See [§Per-kind detail schemas](#per-kind-detail-schemas).
- **`provenance`** — retired. The `change_log` at `createdAtLsn`
  owns all audit trail. Transcript entry pointers (sessionId,
  entryId, proposalEntryId) are fragile under compaction and
  redundant with `change_log` + `basis`.

## Stable node reference codes

Node reference codes are the human/agent handle for accepted graph
nodes. They are spec-scoped and stable for the life of the node, but
they are **not stored** in the graph tables:

```ts
referenceCode = NODE_KIND_LABELS[node.kind] + node.kindOrdinal
```

`NODE_KIND_LABELS` is a hard-coded presentation lookup used by UI,
prompt-context renderers, and agent-tool adapters. If code needs an
internal key for lookup, use the canonical `node.kind` string plus
`kindOrdinal`, not the rendered reference-code string.

Allocation rules:

1. Prefix labels are presentation metadata and unique across all node
   kinds so `#`-mention parsing can use longest-prefix matching.
2. `kindOrdinal` is allocated monotonically per `(specId, plane,
   kind)` inside the same CommandExecutor transaction that creates
   the node.
3. Allocation uses a counter table (`node_kind_counters` or
   equivalent), not `MAX(kind_ordinal)+1`, so deletion and
   supersession cannot reuse ordinals.
4. DB constraints enforce `unique(spec_id, plane, kind, kind_ordinal)`.
   There is no `code` column and no `unique(spec_id, code)` database
   constraint.
5. Context renders and prompts use projected codes as primary handles.
   Raw IDs may appear in diagnostics, but product/agent references
   should use projected codes.

## Per-plane node kinds

### Intent plane

Intent kinds fall into three **derived semantic categories**.
Category is a pure function of `kind` — it is not stored on the node.
These semantic categories are distinct from the cross-plane
readiness bands in [§Node kind metadata](#node-kind-metadata-codes-and-readiness-bands).

| Category | Kind | Modality of claim | Source question |
| --- | --- | --- | --- |
| basic | `goal` | Value or outcome claim | "What outcome are we after?" |
| basic | `thesis` | Position or bet claim | "What do we believe about who this is for and why?" |
| basic | `term` | Naming commitment | "What do we mean when we say X?" |
| basic | `context` | Descriptive claim | "What is true about the world this lives in?" |
| structural | `requirement` | Obligation claim | "What must the system do?" |
| structural | `assumption` | Uncertainty claim | "What might be false?" |
| structural | `constraint` | Boundary claim | "What does this rule out?" |
| structural | `invariant` | Preservation claim | "What must never be broken?" |
| reasoning | `decision` | Choice claim | "What did we pick among real alternatives?" |
| reasoning | `criterion` | Oracle claim | "How will we judge that it holds?" |
| reasoning | `example` | Witness or disambiguator claim | "What concrete case would settle this?" |

11 intent kinds, 3 derived categories.

The **modality of claim** and **source question** columns are
agent-facing prompting guidance: they help the agent discriminate
between kinds when authoring nodes and help the elicitor choose
which question to ask next. The source question is the abstract
driver — it is not a literal question to parrot, but a heuristic
for what kind of material the node captures.

**Category semantics:**

- **`basic`** — grounding material. Establishes what/who/why before
  structural elicitation can proceed. It is semantic, not a creation
  gate. The spec-grade gate from `grounding_onboarding` toward
  `elicitation_ready` uses readiness-band evidence with a count
  floor; basic intent nodes are central evidence, and
  grounding-relevant constraints may also count.
- **`structural`** — core specification material. Requirements,
  assumptions, and constraints form the structural backbone.
- **`reasoning`** — decisions, criteria, and evidence. Emerges as
  the agent and user reason about structural material.

### Oracle plane

| Kind | Description |
| --- | --- |
| `check` | A verification action that witnesses or refutes a claim |
| `validation_method` | How a check is executed (unit test, manual, etc.) |
| `evidence` | A concrete artifact or observation produced by a check |
| `obligation` | A verification commitment — what must be checked |

### Design plane

| Kind | Description |
| --- | --- |
| `module` | A software component or subsystem |
| `interface` | A contract between modules |

### Plan plane

| Kind | Description |
| --- | --- |
| `milestone` | A bounded phase of work |
| `frontier` | A named canonical work item within a milestone |
| `slice` | A thin vertical implementation unit within a frontier |

## Node kind metadata: codes and readiness bands

Metadata is a pure function of `(plane, kind)`. It is not stored as a
nested object on each node. Readiness-band membership is consumed by
context / prompt filters; reference-code labels are consumed by
presentation code that combines the label with stored `kindOrdinal`.

Readiness bands are **non-exclusive**. They guide elicitor goals,
context filters, and grade-advancement rubrics; they do not make any
node kind illegal at earlier grades. If the user clearly states a
requirement or criterion during grounding, capture it as graph truth
with the right `basis`; it simply does not by itself prove the
readiness threshold.

| Plane | Kind | Prefix | Readiness bands |
| --- | --- | --- | --- |
| intent | `goal` | `G` | grounding |
| intent | `thesis` | `TH` | grounding |
| intent | `term` | `T` | grounding |
| intent | `context` | `CTX` | grounding |
| intent | `assumption` | `A` | elicitation |
| intent | `constraint` | `CON` | grounding, elicitation |
| intent | `invariant` | `I` | elicitation |
| intent | `decision` | `D` | elicitation |
| intent | `example` | `EX` | elicitation |
| intent | `criterion` | `CR` | commitment |
| intent | `requirement` | `R` | commitment |
| oracle | `validation_method` | `VM` | elicitation |
| oracle | `obligation` | `OB` | elicitation |
| oracle | `evidence` | `EV` | commitment |
| oracle | `check` | `CH` | commitment |
| design | `module` | `M` | elicitation |
| design | `interface` | `IF` | elicitation |
| plan | `milestone` | `MS` | commitment |
| plan | `frontier` | `FR` | commitment |
| plan | `slice` | `SL` | commitment |

Notes:

- `criterion` uses `CR`, not the previous app's legacy `AC`, because
  Brunch-next treats it as an intent/oracle claim rather than a
  phase-specific acceptance-criteria record.
- Prefixes are 1–3 capital letters and must remain globally unique
  across node kinds. If a new kind would collide by prefix, choose a
  longer prefix rather than changing existing codes.

## Per-kind detail schemas

Most kinds use `title` + `body` only. Two kinds have structured
`detail` sub-schemas validated by the `CommandExecutor`:

```ts
// decision: REQUIRED detail
interface DecisionDetail {
  readonly chosen_option:  string
  readonly rejected:       string[]
  readonly rationale:      string
}

// term: REQUIRED detail
interface TermDetail {
  readonly definition:     string
  readonly aliases?:       string[]
}
```

**Validation rules:**

- `decision` and `term` nodes REQUIRE `detail`; the CommandExecutor
  rejects creation without it.
- All other kinds: `detail` must be absent or null.
- Unknown fields in `detail` are rejected (closed validation).
- `detail` is stored as a JSON column in SQLite — one `nodes`
  table for all planes and kinds.

## Prompting guidance for kind discrimination

The modality-of-claim table (§Intent plane) is the primary agent
rubric. Additional prompting heuristics for kinds that need them:

- **`requirement` duality.** A requirement may be user-story-shaped
  (stated directly by a stakeholder, `source: "stakeholder"`,
  `basis: "explicit"`) or projection-shaped (derived from existing
  goals/theses/constraints via `project-graph`, `source: "derived"`,
  `basis: "explicit"` after exact review-set approval). A
  `propose-graph` requirement is also an obligation claim, but its
  `basis` is `implicit` because the user accepted the concept rather
  than each item. `source` carries epistemic attribution;
  `basis` carries item-level approval strength; `change_log` carries
  the mutation path.
- **`decision` capture criteria.** A claim should become a
  `decision` only if all of the following hold:
  1. **Plausible alternatives existed** — "we chose A over B"
  2. **The choice is durable** — it constrains future work
  3. **The choice is explicit** — stated, not implied
  4. **Rejected alternatives can be named** — at least one
  5. **There is a rationale** — "because X"

  The `CommandExecutor` enforces `rejected.length >= 1` in
  `DecisionDetail`. If none of these criteria hold, the material
  is probably `context`, `requirement`, or `assumption` — not a
  decision.
- **`invariant` vs `constraint`.** A constraint says "don't go
  there" — it bounds the solution space. An invariant says "this
  must always hold" — things break if it's violated. Constraints
  get `boundary` edges; invariants get `dependency` and `proof`
  edges. If invalidating the source should cascade downstream
  breakage, it is an invariant; if it merely narrows what's in
  scope, it is a constraint.
- **`thesis` carries the grounding material** that a prose spec
  invests in: who this is for, what problem it solves, what value
  it creates, what bet we're making. It is not a requirement (a
  bet, not a need), not a goal (falsifiable, not aspirational),
  and not an assumption (a chosen position, not a dependency).
- **`context` promotion heuristic.** Context is the last-resort
  descriptive bucket — before filing a node as `context`, check
  whether it should be promoted:

  | If the context… | Promote to… |
  | --- | --- |
  | must be true for success | `requirement` or `invariant` |
  | limits acceptable solutions | `constraint` |
  | may be false and matters | `assumption` |
  | chooses among alternatives | `decision` |
  | is a bet about users/market/value | `thesis` |
  | just helps interpretation | keep as `context` |

- **Interrogative content normalization.** Brunch has no
  `question` kind — every intent node is a declarative claim.
  When elicitation produces interrogative material ("Open
  question: …", "Should we …?", "Is X true?"), rewrite into the
  underlying declarative claim before authoring. Reserve graph
  truth for what the question is *about*; track the question
  itself, if it needs tracking, outside the graph as a worklist
  or capture artifact, not as a node. Common rewrites:

  | If the question is about… | Author as… |
  | --- | --- |
  | a possibly-false premise downstream depends on | `assumption` (rewrite as the latent premise) |
  | how success or correctness will be judged | `criterion` (rewrite as the judgment claim) |
  | which option to take among alternatives, still open | `context` (state that the choice is unresolved; preserve original wording in `body`) |
  | a follow-up task with no stable declarative content yet | keep outside graph truth |

  When such an unresolved-state `context` node is later resolved,
  create a fresh `decision` and link
  `decision -[supersession]-> context`. This preserves the
  discovery-to-resolution arc without mutating either node and
  without a dedicated `question` kind. Note that interrogative
  rewriting is independent of the
  `present_question` / `present_options` structured-exchange
  surface — interrogatives are valid at the *prompt* layer; this
  rule constrains only what enters the *graph*.

### Beyond the schema contract

Two categories of agent-facing guidance live outside this document
because they evolve faster than the schema:

- **Observer classification / translation tables** — phrase-pattern
  → kind mappings for post-exchange capture. Seeded in
  [`src/.pi/skills/strategies/README.md`](../../src/.pi/skills/strategies/README.md);
  lands as prompt-pack content with M5 `agent-graph-integration`.
- **Topology-driven question ranking** — graph-shape heuristics
  for what to ask next (e.g. "requirement with no incoming proof
  edge → suggest a criterion"). Seeded in
  [`src/.pi/skills/lenses/README.md`](../../src/.pi/skills/lenses/README.md);
  lands as lens prompt-pack content with M5.

Both draw on the archived
`/brunch/docs/design/INTENT_GRAPH_SEMANTICS.md` as source material.

## `framing_as` — retired

The prior `framing_as` orthogonal modality (problem, persona, JTBD,
non-goal, etc.) is retired. Its work is absorbed by:

- **`thesis`** — carries "what/who/why" material (problem framing,
  persona framing, value proposition framing)
- **`term`** — carries naming commitments
- **`constraint`** — carries exclusions and boundary claims
- **`invariant`** — carries preservation claims (was formerly
  conflated with constraints)
- **`goal`** — carries aspirational intent

The allowed `framing_as` matrix (I7-L) and the "promote when a
framing demands unique relation policy" escape hatch are both
retired. No node carries a `framing_as` field.

## Open questions

- **Tuple-label table location.** Likely
  `src/graph/projection/labels.ts`; lands with the first
  projection-builder slice in M4 or M5.
- **Realization watch criterion.** If probe runs surface three or
  more realization sub-clusters that demand distinct cascade or
  projection policy, split `realization` into siblings (probable
  candidates: `implementation`, `establishment`, `assertion`,
  `expression`).
- **Multi-edge between same pair.** The system-prompt discipline
  says "use one edge, the strongest operational role." Whether to
  also enforce a structural uniqueness constraint on
  `(sourceId, targetId)` or `(sourceId, targetId, category)` is
  deferred — the discipline plus the cost of false positives argue
  against enforcement.
- **Recon_need closure on edge deletion.** If an edge is deleted,
  any `ReconciliationNeed` with `target.kind = "edge"` referencing
  it needs an explicit resolution rule. Likely: mark resolved with
  reason `target_removed`. Deferred to the recon_need substrate
  slice.

## Supersession notes

This document supersedes:

- `docs/architecture/pi-seam-extensions.md` §"Edge types" (the
  earlier M4 edge-type catalogue: `validates`, `instance_of`,
  `produces`, `discharges`, `depends_on`, `derived_from`,
  `counterexample_for`, `witnesses`)
- `archive/docs/design/INTENT_GRAPH_SEMANTICS.md` §"Relations" and
  §"Edge schema and epistemic metadata" (already archived prior to
  this document; the edge-layer content is now canonically here)
- `archive/docs/design/GRAPH_EDGE_CATEGORIES.md` — the brainstorm
  that produced this document
- The `framing_as` orthogonal modality and allowed matrix from
  `memory/SPEC.md` D7-L, A7-L, I7-L — absorbed by `thesis`,
  `term`, `constraint`, and `goal`
- `EdgeProvenance` / node provenance — retired; `change_log` owns
  audit trail
- The former `basis: accepted_review_set` path value — replaced by
  `basis: explicit | implicit`, with mutation path in `change_log`
- String-shaped `NodeId` examples — replaced by integer internal ids
  plus projected human reference-code handles derived from `kind` +
  `kindOrdinal`

Outbound references updated with current graph-model lock:

- `memory/SPEC.md` — D51-L (edge shape), D54-L (node shape), D55-L
  (provenance retirement), D56-L (intent kind categories), D57-L
  (grounding gate), D62-L (projected node reference codes), D63-L (basis), D64-L
  (readiness bands); A7-L retired; I7-L retired; I36-L, I37-L,
  I39-L, I40-L, I41-L added
- `memory/PLAN.md` — frontier traceability still points at the graph
  write/capture/review-cycle work that must materialize these locks
