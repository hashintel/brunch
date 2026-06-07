# graph/ — Graph domain layer

Canonical reference: `docs/design/GRAPH_MODEL.md`
SPEC decisions: D4-L, D20-L, D27-L, D51-L, D52-L, D53-L, D54-L, D62-L, D63-L

## Owns

- **CommandExecutor** (`command-executor.ts`) — the single mutation boundary for
  graph/spec writes. It hides structural validation, transaction mechanics,
  spec-local LSN allocation, per-kind node ordinal allocation, change-log append,
  and structured command results.

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
- **Readers / snapshot functions** (`snapshot.ts`) — graph projections at
  multiple detail levels: active-context and graph-truth overview, node
  neighborhood, selected-spec graph-code lookup, and open reconciliation needs.
  These return typed domain objects or internal ids, not Drizzle rows.

- **Preview harness helpers** (`render-preview.ts`) — deterministic fixture-seed
  + selected-spec read helpers for render-preview scripts/tests that need real
  graph data without bypassing the command/read seams.

- **Domain schema types** (`schema/`) — `GraphNode`, `GraphEdge`,
  `ReconciliationNeed`, kind/category types, per-kind node ordinals, and derived
  intent-kind grouping.

- **Policy** (`policy/category-policy.ts`) — edge-category semantics such as
  cascade behavior, reconciliation triggers, and projection effects.

- **Workspace graph runtime** (`workspace-store.ts`) — opens `.brunch/data.db`
  through `db/connection.ts` and returns a `CommandExecutor` plus bound snapshot
  readers for adapters.

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

  snapshot.ts
    getGraphOverview
    getNodeNeighborhood
    resolveGraphNodeCode
    getOpenReconciliationNeeds
    row -> domain mapping

  render-preview.ts
    deterministic seeded-fixture render-preview helpers for scripts/tests

  workspace-store.ts
    openWorkspaceGraphRuntime(cwd)
    openWorkspaceCommandExecutor(cwd)

  schema/
    nodes.ts
    edges.ts
    reconciliation-need.ts

  policy/
    category-policy.ts
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
            prompt context snapshots
```

## Fractal split points

Keep `command-executor.ts` and `snapshot.ts` as public entry points. The first
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

graph/snapshot/
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
