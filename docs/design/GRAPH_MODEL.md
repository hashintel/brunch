# Graph Model

Canonical reference for the Brunch graph data plane (M4 and onward).
Owns the edge layer end-to-end; defers nodes to Phase 2 (see [§Nodes — deferred](#nodes--deferred-phase-2)).

This document is the lock for the edge model that supersedes the prior
"large semantic edge-type catalogue + relation-policy registry"
direction. It is also the source of truth for the type definitions
under [`src/graph/`](../../src/graph/) and the per-category policy
table consumed by snapshot/projection builders and the
`CommandExecutor`.

`memory/SPEC.md` and `memory/PLAN.md` are reconciled to this doc for
the locked edge layer; if later planning text drifts, treat this
document as the canonical edge-model contract.

## Status

- **Phase 1 (this document):** edges, edge policy, reconciliation-need
  shape. Locked.
- **Phase 2 (TBD):** per-plane node kinds, decision/example shape,
  product framings / theses. Placeholder section near the end.

## Scope and posture

The primary author of graph nodes and edges in Brunch is an LLM
agent — through direct elicitation, post-exchange capture, review-set
proposals, and reviewer findings. Two pressures follow from that:

1. **Authoring burden must be low.** The agent should not be asked
   to choose among many named relation kinds, each with its own
   tuple-specific legality and its own projection policy.
2. **Interpretation burden at snapshot time must be low.** Context
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
type NodeId = string
type EdgeId = string
type Lsn    = number   // monotonic, one per commit
```

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
type EdgeBasis  = "explicit" | "accepted_review_set"

interface GraphEdge {
  readonly id:           EdgeId
  readonly category:     EdgeCategory
  readonly sourceId:     NodeId
  readonly targetId:     NodeId
  readonly stance?:      EdgeStance            // REQUIRED for proof, support
                                               // INVALID for other categories
  readonly basis:        EdgeBasis
  readonly rationale?:   string
  readonly provenance?: {
    readonly sessionId?:       string
    readonly entryId?:         string
    readonly proposalEntryId?: string          // present when basis = accepted_review_set
  }
  readonly createdAtLsn: Lsn
  readonly updatedAtLsn: Lsn                   // metadata only;
                                               // category/source/target/stance are immutable
                                               // (change category = delete + recreate)
}
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

Authority for edge writes lives in the `change_log` keyed by
`createdAtLsn` / `updatedAtLsn`. Edges do not denormalize authority.

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

The category drives all policy. The `CommandExecutor` enforces
structural legality at write time; snapshot/projection builders use
this table to bucket edges; coherence triggers use the cascade
column.

|                | cascade on src change | recon_need on src change | criteria-help signal | projection effect                              |
| -------------- | :-------------------: | :----------------------: | :------------------: | ---------------------------------------------- |
| `dependency`   |          ✓            |            ✓             |          —           | —                                              |
| `proof`        |          —            |        advisory          |          ✓           | —                                              |
| `support`      |          —            |        advisory          |          —           | —                                              |
| `realization`  |          —            |        advisory          |          —           | —                                              |
| `boundary`     |          —            |            ✓             |          —           | —                                              |
| `composition`  |          —            |            —             |          —           | —                                              |
| `association`  |          —            |            —             |          —           | —                                              |
| `supersession` |          —            |            —             |          —           | hide predecessor from active context           |

Legend:

- **cascade** — automatic block / mark stale on the dependent
  (e.g. assumption invalidation cascade).
- **recon_need on src change** — generate a `ReconciliationNeed`
  pointing at the edge. *Advisory* = generated only if a coherence
  rule asks for it; the edge does not auto-cascade.
- **criteria-help** — used by the interviewer to suggest criteria
  for the target node ("requirement with no `proof` incoming →
  suggest criterion").
- **projection effect** — how snapshot/neighborhood builders treat
  the edge in active-context views.

Only `dependency` triggers automatic cascades. Other categories
surface as reconciliation needs at most; they do not auto-block
downstream items.

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
MS_graph     : milestone   -[composition]->         FE_700         : frontier
FE_700       : frontier    -[composition]->         SL_persist     : slice
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
plain-language phrasing for graph snapshots, UI, and prompt
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

The lookup is a static table keyed on
`(category, source.kind, target.kind, perspective[, stance])`. It is
built by inverting the prior catalogue entries plus the `proof` rows
above. It lives separately from this document — the canonical
location for the table is TBD (likely
`src/graph/projection/labels.ts` when projection builders land).

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

## Snapshot bucketing

Snapshot buckets come from category and endpoint role, not from the
derived label string. A neighborhood snapshot of an intent node:

```text
anchor: R_offline : requirement

hard dependencies:
  A_no_network         depends on assumption

support:
  P_field_users        motivated by context

proof:
  CR_airplane          witnessed by criterion
  E_typical            witnessed by example

realized by:
  M_sqlite_store       realized by design module
  SL_persist           established by plan slice

boundaries:
  C_no_cloud           bounded by constraint

supersedes:
  R_offline_v0         supersedes prior requirement
```

## Structural invariants

- Edge categories are closed. Agents cannot submit arbitrary
  relation strings.
- Every edge has exactly one category.
- `stance` is required iff `category ∈ { proof, support }`.
- `association` is symmetric at the product level even if stored
  with `sourceId` / `targetId` columns.
- `supersession` chains are acyclic.
- Accepted graph edges are graph truth. Candidate or low-confidence
  edges live outside graph truth (preface / capture analysis /
  review-set drafts) until accepted.
- Tuple-label lookup cannot change category policy.
- Snapshot bucket assignment comes from category and endpoint role,
  not from label strings.
- `composition` does not imply sequencing or dependency.
- `support` does not imply blocking / staleness by default.
- Only `dependency` triggers automatic cascades; other categories
  surface as `ReconciliationNeed` records when policy says so.
- Cross-plane freedom: node `kind` does not constrain edge
  category legality.

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
narrower category to force the write through.

These commands land in the M5 `agent-graph-integration` extension
under `src/tui-client/.pi/extensions/graph/tools/` per the existing
implementation layout. They are out of scope for Phase 1 stubs.

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
```

Category-selection rubric (ask in order; stop at first strong match):

```text
0. Should this be graph truth now?
   - explicit user statement, accepted review set, or high-confidence extraction -> continue
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

## Nodes — deferred (Phase 2)

The node layer is deferred to a separate lock-and-materialize pass.
Phase 2 will cover, at minimum:

- Per-plane node `kind` enumeration (intent / oracle / design / plan)
- Whether `framing_as` survives the POC or is dropped pending a
  present reader; whether product **thesis** earns a first-class
  kind alongside `goal` and `assumption`
- Subtype enums on `constraint`, `invariant`, `criterion`, `example`
  vs free-form body text — which earn schema columns
- Decision node shape (`chosen_option`, `rejected_alternatives`,
  `rationale`) as fields, not as hyper-edges over alternative nodes
  (the hyper-edge / reasoning-record promotion is the deliberate
  M5/M6 escape hatch per `pi-seam-extensions.md §Q1`)
- Node provenance / basis symmetry with edges
- Oracle-plane node detail (`check`, `validation_method`, `evidence`,
  `obligation`)

Nothing in Phase 2 changes the edge model. The two phases are
independent; landing nodes does not require re-opening this
document's edge sections.

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

Outbound references to update via `/ln-sync`:

- `memory/SPEC.md` D27-L — `edge_drafts` payload language ("relation"
  becomes "category + stance")
- `memory/SPEC.md` A7-L — `framing_as` open question gains a Phase 2
  hook
- `memory/PLAN.md` `graph-data-plane` — objective language for the
  edge surface
