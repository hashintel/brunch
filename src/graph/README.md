# graph/ — Graph domain layer

Canonical reference: `docs/design/GRAPH_MODEL.md`
SPEC decisions: D4-L, D20-L, D27-L, D51-L, D52-L, D53-L, D54-L, D60-L, D62-L, D63-L

## Owns

- **CommandExecutor** (`command-executor.ts`) — the single mutation boundary for
  graph/spec writes. It hides structural validation, transaction mechanics,
  spec-local LSN allocation, per-kind node ordinal allocation, change-log append,
  and structured command results. It also owns prospective-register writes for
  `elicitation_backlog` (`createSpec` seeding plus create/close entry commands),
  because the backlog shares the same spec-local LSN and audit boundary.

- **commitGraph** — atomic batch mutation for `propose-graph`: one tool call,
  one transaction, one selected-spec LSN, all-or-nothing. It accepts product
  command input (`nodes[]` with batch refs, `edges[]` with batch/existing refs),
  not raw DB rows. `command-executor/commit-graph-batch.ts` owns the private
  shared planner used by both dry-run and commit before any batch writes occur.

- **review-set payload translation** (`review-set.ts`) — validates exact
  user-reviewable review-set payloads, resolves projected existing-node codes
  inside the selected spec, and translates them to explicit-basis graph batches.
  `CommandExecutor.acceptReviewSet` is the only graph mutation entrypoint for
  accepted review sets and records `operation: "accept_review_set"`.

- **Capture translators** (`capture/`) — narrow, high-confidence structured
  response translators that turn transcript-native answers into `commitGraph`
  command input. They do not write DB rows directly and do not own session
  projection.
- **Readers / query functions** (`queries.ts`) — graph reads at multiple
  detail levels: active-context and graph-truth overview, node
  neighborhood, selected-spec graph-code lookup, open reconciliation needs, and
  open elicitation-backlog entries. These return typed domain objects or
  internal ids, not Drizzle rows.


- **Domain schema types** (`schema/`) — `GraphNode`, `GraphEdge`,
  `ReconciliationNeed`, `ElicitationBacklogEntry`, kind/category types,
  per-kind node ordinals, and derived intent-kind grouping.

- **Policy** (`policy/category-policy.ts`) — the single per-category
  metadata table (`EDGE_CATEGORY_METADATA`): endpoint roles, impact
  direction/strength (cascade vs advisory), criteria-help signal, and
  projection effects.

- **Projection** (`projection/`) — anchor-relative derivations over the
  policy table: `labels.ts` (direction-aware semantic phrasing) and
  `direction.ts` (upstream/downstream/lateral for the reconciliation
  flow). Pure functions; no DB access.

- **Workspace graph runtime** (`workspace-store.ts`) — opens `.brunch/data.db`
  through `db/connection.ts` and returns a `CommandExecutor` plus bound query
  readers for adapters.

## Observed read-shape ledger

D60-L read-shape ownership is explicit: every durable graph read shape has one canonical owner in `queries.ts`; adapters may expose only the subset they need. Deferred means eligible or known but not currently exposed for that consumer; `n/a` means deliberately outside that consumer's product role.

| Shape | Canonical owner | `read_graph` tool | RPC | Web | Reason for deferred / n/a |
| --- | --- | --- | --- | --- | --- |
| `overview` | `getGraphOverview` | required | required | required | — |
| `neighborhood` | `getNodeNeighborhood` | required | required | required | — |
| `list_by_kind` | `getGraphSliceByKinds` | required | deferred | deferred | Web-eligible bounded graph slice; RPC follows a concrete web/client need. |
| `list_by_band` | `getGraphSliceByReadinessBands` | required | deferred | deferred | Web-eligible D64-L evidence slice; RPC follows a concrete web/client need. |
| `gaps` | `getGraphGaps` | required | n/a | n/a | Agent/RPC-only diagnostic shape; not a web observer projection. |
| `related` | `getRelatedNodes` | required | n/a | n/a | Agent/RPC-only traversal helper; not a web observer projection. |
| `reconciliation_needs` | `getOpenReconciliationNeeds` | deferred | deferred | deferred | Agent-internal register read; no transport consumer yet. |
| `elicitation_backlog` | `getOpenElicitationBacklogEntries` | deferred | deferred | deferred | Agent-internal prospective-register read; per-turn driver follow-on owns exposure. |

`observed-shapes-coverage.test.ts` guards the required subsets against accidental drift: the tool mode union must stay at the six required agent shapes, while RPC and web stay at `overview` + `neighborhood` until a scoped feature deliberately promotes another row.

## Clock and audit posture

`graph_clock` and `change_log` are spec-scoped. `CommandExecutor.createSpec`
creates the spec's initial `graph_clock` row at LSN 1 with the `create_spec`
audit entry. Later graph/spec mutations use an update-only bump on the target
spec's existing clock row, append a `change_log` row keyed by `(spec_id, lsn)`,
and write the same local LSN to that spec's graph rows or reconciliation needs.
Missing clock rows for existing specs are invariant failures; runtime code does
not repair them. Product updates therefore carry `{specId, lsn}`; callers must
not compare bare LSN values across sibling specs.

## Imports from

- `db/` — Drizzle table definitions, enum arrays, and connection handle.
  `graph/` is the only application layer that should import `db/` directly.

## Imported by

- `.pi/extensions/graph/` — Pi tool adapters for `commit_graph` and `read_graph`.
- `rpc/` — graph projection handlers and synchronous response-capture wiring.
- `projections/graph/` — reusable DTO projection over graph reader/command outputs.
- `renderers/graph/` — reusable lossy markdown/text rendering over projected graph DTOs.
- `.pi/agents/contexts/` — future prompt context renderers.
- `probes/` — graph proof drivers.

## Current topology

```pseudo
graph/
  atoms.ts
    NodeId / EdgeId / Lsn aliases

  index.ts
    public graph-layer export barrel
    re-exports enum arrays for non-db consumers

  command-executor.ts
    CommandExecutor
    command input/result types
    createSpec
    create/close elicitation-backlog entry
    updateReadinessGrade
    createNode
    per-kind node ordinal allocation
    commitGraph / dryRunCommitGraph
    acceptReviewSet
    create/resolve reconciliation need

  command-executor/
    commit-graph-types.ts
      commitGraph input/result/diagnostic types re-exported by command-executor.ts
    commit-graph-batch.ts
      private commitGraph batch planner
      dry-run/commit structural parity
      temporary endpoint graph for supersession acyclicity

  review-set.ts
    review-set payload contract
    selected-spec projected-code resolution
    explicit-basis command translation

  capture/
    structured-response.ts
      deterministic labeled-answer capture to explicit-basis commitGraph input

  queries.ts
    getGraphOverview
    getNodeNeighborhood
    resolveGraphNodeCode
    getOpenElicitationBacklogEntries
    getOpenReconciliationNeeds
    row -> domain mapping


  workspace-store.ts
    openWorkspaceGraphRuntime(cwd)
    openWorkspaceCommandExecutor(cwd)

  schema/
    elicitation-backlog.ts
    nodes.ts
    edges.ts
    reconciliation-need.ts

  policy/
    category-policy.ts

  projection/
    labels.ts
    direction.ts
```

## Boundary flow

```pseudo
db/schema.ts
  Drizzle rows + enum literals
      │
      ▼
graph/schema/*.ts
  domain types derived from enum literals
      │
      ▼
CommandExecutor
  validates product command input
  writes rows transactionally
  appends change_log
      │
      ├─►.pi/extensions/graph
      │     agent tool adapter
      │
      ├─► rpc/
      │     public product projections
      │     session.submitExchangeResponse capture wiring
      │
      └─► .pi/agents/contexts future context orchestration
            prompt context reads and render inputs
```

## Fractal split points

Keep `command-executor.ts` and `queries.ts` as public entry points. The first
real split is now `command-executor/commit-graph-batch.ts`: private planner code
for the commitGraph seam, imported only by the public `command-executor.ts`
entrypoint. Future splits should follow the same pattern: split by semantic
responsibility, keep external imports pointed at the root entrypoint, and avoid
folder scaffolding until pressure is real.

```pseudo
graph/command-executor/
  commit-graph-types.ts
    commitGraph input/result/diagnostic types re-exported by command-executor.ts
  commit-graph-batch.ts
    planned edge endpoints
    existing/batch ref validation
    supersession-cycle detection over existing ids + temporary batch keys
    created-node result formatter

graph/queries/
  row-mappers.ts
  overview.ts
  neighborhood.ts
  reconciliation-needs.ts
  changes-since.ts
```

## Known near-term schema pressure

- `kind_ordinal` is now the stored half of projected graph node codes. Keep
  rendered code strings out of graph tables; adapters and prompt renderers should
  project them from `kind` + `kindOrdinal`, then resolve existing-code handles
  through selected-spec graph readers before calling `CommandExecutor`.
- Keep spec scoping mandatory for stable `graph.*` RPC / multi-spec UI
  projections: graph rows and graph-adjacent reconciliation needs are
  spec-owned, and remaining graph read/write surfaces must preserve explicit
  selected-spec authority.
- Keep `coherence_state` deferred until its durable semantics are defined.
- Begin consuming `db/row-schemas.ts` at persistence-facing validation seams;
  do not use row schemas as public RPC or agent-tool object contracts.
