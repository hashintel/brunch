# Graph Model

Canonical reference for the Brunch graph data plane (M4 and onward).
Owns both the edge layer and the node layer end-to-end.

This document is the lock for the graph model that supersedes the
prior "large semantic edge-type catalogue + relation-policy registry"
direction and the deferred `framing_as` modality. It is also the
source of truth for the type definitions under
[`src/graph/`](../../src/graph/) and the per-category policy table
consumed by snapshot/projection builders and the `CommandExecutor`.

`memory/SPEC.md` and `memory/PLAN.md` are reconciled to this doc;
if later planning text drifts, treat this document as the canonical
graph-model contract.

## Status

- **Phase 1:** edges, edge policy, reconciliation-need shape. Locked.
- **Phase 2:** per-plane node kinds, node shape, detail schemas,
  kind categories, `source` field, `provenance` retirement. Locked.

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
under `src/.pi/extensions/graph/tools/` per D52-L. They are out of
scope for Phase 1 stubs.

### `commitGraph` — atomic batch mutation (D53-L)

The `propose-graph` strategy's load-bearing tool. One tool call
creates an entire subgraph — nodes and edges — in a single
transaction with one LSN.

```ts
commitGraph({
  nodes: [
    { ref: "n1", kind: "requirement", title: "...", body: "..." },
    { ref: "n2", kind: "constraint",  title: "...", body: "...",
      detail: { subtype: "invariant" } },
    { ref: "n3", kind: "decision",    title: "...", body: "...",
      detail: { chosen_option: "...", rejected: ["..."], rationale: "..." } },
    { ref: "n4", kind: "term", title: "...",
      detail: { definition: "...", aliases: ["..."] } },
  ],
  edges: [
    { category: "dependency",   source: "n1",              target: "n2" },
    { category: "boundary",     source: "n2",              target: "n1" },
    { category: "realization",  source: "n1",              target: "n3" },
    { category: "support",      source: { existing: "A12" }, target: "n1",
                                stance: "for" },
  ]
})
```

Reference modes:
- **Intra-batch**: `"n1"` — a node defined in the same payload
- **Existing**: `{ existing: "A12" }` — a node already in the graph

CommandExecutor processing:

```
commitGraph tool call
        │
        ▼
  1. Validate all nodes structurally
  2. Assign real NodeIds to each batch ref
  3. Resolve intra-batch refs on edges
  4. Resolve existing-node refs (fail if not found)
  5. Validate all edges (closed categories, stance, acyclicity)
  6. Allocate ONE Lsn
  7. Write all nodes + edges + change-log in one transaction
  8. Return success + created ids
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

## GraphNode — the single shape

```ts
interface GraphNode {
  readonly id:           NodeId
  readonly plane:        NodePlane
  readonly kind:         string              // per-plane closed enum (see below)
  readonly title:        string              // required, non-empty
  readonly body?:        string              // markdown content
  readonly basis:        NodeBasis
  readonly source?:      string              // free-form epistemic attribution
                                             // convention by prompt, not structural validation
                                             // e.g. "stakeholder", "regulatory", "derived"
  readonly detail?:      object              // per-kind validated sub-structure (JSON column)
  readonly createdAtLsn: Lsn
  readonly updatedAtLsn: Lsn
}

type NodePlane = "intent" | "oracle" | "design" | "plan"
type NodeBasis = "explicit" | "accepted_review_set"
// Same semantics as EdgeBasis — how the node entered graph truth.
// No "inferred" basis; low-confidence material stays in preface /
// capture analysis until promoted.
```

### Fields

- **`plane`** — which graph plane owns this node. Structurally
  validated; determines which `kind` enum applies.
- **`kind`** — per-plane closed enum. Structurally validated by
  the `CommandExecutor`. See [§Per-plane node kinds](#per-plane-node-kinds).
- **`title`** — required, non-empty. The human-readable name of the
  node. Used for mentions, snapshot display, and search.
- **`body`** — optional markdown content. Carries the semantic detail
  the agent authored. Most kinds put their primary content here.
- **`basis`** — how the node entered graph truth. Same `explicit` /
  `accepted_review_set` semantics as edges.
- **`source`** — free-form string for epistemic attribution.
  Convention by prompt (e.g. "stakeholder", "regulatory", "derived",
  "domain expert", "market research", "agent synthesis"), not
  structural validation. Exists for context-snapshot enrichment —
  it will be transformed back into sparse text in prompt snapshots,
  not used for policy or filtering.
- **`detail`** — optional JSON object with per-kind validated
  sub-structure. See [§Per-kind detail schemas](#per-kind-detail-schemas).
- **`provenance`** — retired. The `change_log` at `createdAtLsn`
  owns all audit trail. Transcript entry pointers (sessionId,
  entryId, proposalEntryId) are fragile under compaction and
  redundant with `change_log` + `basis`.

## Per-plane node kinds

### Intent plane

Intent kinds fall into three **derived categories** that map to
spec-grade progression. Category is a pure function of `kind` — it
is not stored on the node.

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
  structural elicitation can proceed. The spec-grade gate from
  `grounding_onboarding` toward `elicitation_ready` requires a
  satisficing threshold of `basic`-category nodes. The gate is
  LLM-judged with a count floor — the agent assesses readiness,
  but cannot declare grounding complete with zero basic nodes.
  Grounding rubric (Walter-style questions: what is it, who is it
  for, what problem, what value, when used, how measured) lives in
  the prompt as abstract drivers, not structural enforcement.
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
  `basis: "accepted_review_set"`). Both are obligation claims. The
  `source` and `basis` fields carry the provenance distinction;
  strategy prompt packs (`step-wise` vs `project-graph`) guide the
  agent on which framing to use.
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
  `term`, `constraint.subtype`, and `goal`
- `EdgeProvenance` / node provenance — retired; `change_log` owns
  audit trail

Outbound references updated with Phase 2 lock:

- `memory/SPEC.md` — D54-L (node shape), D55-L (provenance
  retirement), D56-L (intent kind categories), D57-L (grounding
  gate); A7-L retired; I7-L retired; I36-L, I37-L added
- `memory/PLAN.md` — `sealed-pi-profile-runtime-state` Phase 2
  node lock acceptance criteria updated
