# graph/ — Graph domain layer

Canonical reference: `docs/design/GRAPH_MODEL.md`
SPEC decisions: D4-L, D20-L, D51-L, D52-L, D53-L, D54-L, D62-L

## Owns

- **CommandExecutor** (`command-executor.ts`) — the single mutation boundary for
  graph/spec writes. It hides structural validation, transaction mechanics, LSN
  allocation, per-kind node ordinal allocation, change-log append, and
  structured command results.

- **commitGraph** — atomic batch mutation for `propose-graph`: one tool call,
  one transaction, one LSN, all-or-nothing. It accepts product command input
  (`nodes[]` with batch refs, `edges[]` with batch/existing refs), not raw DB
  rows.
- **Readers / snapshot functions** (`snapshot.ts`) — graph projections at
  multiple detail levels: active-context and graph-truth overview, node
  neighborhood, selected-spec graph-code lookup, and open reconciliation needs.
  These return typed domain objects or internal ids, not Drizzle rows.

- **Domain schema types** (`schema/`) — `GraphNode`, `GraphEdge`,
  `ReconciliationNeed`, kind/category types, per-kind node ordinals, and derived
  intent-kind grouping.

- **Policy** (`policy/category-policy.ts`) — edge-category semantics such as
  cascade behavior, reconciliation triggers, and projection effects.

- **Workspace graph runtime** (`workspace-store.ts`) — opens `.brunch/data.db`
  through `db/connection.ts` and returns a `CommandExecutor` plus bound snapshot
  readers for adapters.

## Imports from

- `db/` — Drizzle table definitions, enum arrays, and connection handle.
  `graph/` is the only application layer that should import `db/` directly.

## Imported by

- `.pi/extensions/graph/` — Pi tool adapters for `commit_graph` and `read_graph`.
- `rpc/` — future `graph.*` projection handlers and graph-adjacent state.
- `agents/contexts/` — future prompt context renderers.
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
    create/resolve reconciliation need

  snapshot.ts
    getGraphOverview
    getNodeNeighborhood
    resolveGraphNodeCode
    getOpenReconciliationNeeds
    row -> domain mapping

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
      ├─► .pi/extensions/graph
      │     agent tool adapter
      │
      ├─► rpc/ future graph handlers
      │     public product projections
      │
      └─► agents/contexts future renderers
            prompt context snapshots
```

## Fractal split points

Keep `command-executor.ts` and `snapshot.ts` as public entry points. When either
file needs to split, use same-named private folders rather than exposing more
entry points:

```pseudo
graph/command-executor/
  commit-graph.ts
  specs.ts
  reconciliation-needs.ts
  diagnostics.ts
  lsn.ts
  change-log.ts

graph/snapshot/
  row-mappers.ts
  overview.ts
  neighborhood.ts
  reconciliation-needs.ts
  changes-since.ts
```

Do not create these files until pressure is real or an importer/test names the
seam. The desired shape is documented here so future splits preserve topology.

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
