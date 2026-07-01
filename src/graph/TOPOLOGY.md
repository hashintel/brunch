# graph/ — Graph domain layer

SPEC decisions: D4-L, D20-L, D27-L, D45-L, D51-L, D52-L, D53-L, D54-L, D60-L, D62-L, D63-L, D65-L, D75-L, D80-L, D81-L, D82-L, D94-L, D99-L, I52-L

## Owns

- **CommandExecutor** (`command-executor.ts`) — the single mutation boundary for
  graph/spec writes. It hides structural validation, transaction mechanics,
  spec-local LSN allocation, per-kind node ordinal allocation, change-log append,
  and structured command results. There is no persisted asking-agenda register
  here (D65-L): the former `elicitation_gaps` seed/repair/create/disposition
  paths were retired in the `elicitation-gap-guidance` frontier. The
  session-local asking agenda lives in `session/elicitation-scratchpad.ts`
  instead (non-authoritative, never a `CommandExecutor` write).

- **mutateGraph** — atomic graph mutation for direct writers and future curation:
  one tool call, one transaction, one selected-spec LSN, all-or-nothing. The
  direct agent surface currently uses create-only `ops[]` (`create_node` plus
  role-named `create_edge`, both accepting a batch-wide `createBasis` and
  `createSettlement`) rather than raw DB rows. `command-executor/`
  owns the private shared planners used by both dry-run and commit before any
  batch writes occur.

- **review-set payload translation** (`review-set.ts`) — validates exact
  user-reviewable review-set payloads, owns the agent-facing boundary-teaching
  schema for the nested proposal payload, resolves projected existing-node
  codes inside the selected spec, and translates them to explicit-basis
  `mutateGraph` batches. `CommandExecutor.acceptReviewSet` is the only graph
  mutation entrypoint for accepted review sets and records
  `operation: "accept_review_set"`.

- **Capture** — the submit-time `capture/` structured-response translator was
  deleted 2026-06-19 (D80-L fossil retirement). Capture is now elicitor
  turn-boundary sweep conduct authored in the live elicitor path; the graph layer
  owns only the `mutate_graph` mutation boundary that sweep conduct routes
  through (advisory basis/settlement on low-confidence capture, D99-L), not a
  product-side extraction pass or a gap register.
- **Readers / query functions** (`queries.ts`) — graph reads at multiple
  detail levels: active-context and graph-truth overview, node
  neighborhood, selected-spec graph-code lookup, and open reconciliation
  needs. `GraphFilter` supports a `settlement` filter so callers can request
  settled-only reads (I52-L) on both nodes and edges. These return typed
  domain objects or internal ids, not Drizzle rows.

- **Domain schema types** (`schema/`) — `GraphNode`, `GraphEdge` (both
  carrying `basis: NodeBasis` and `settlement: NodeSettlement` as orthogonal,
  independently-required fields, D63-L/D99-L/I52-L), `ReconciliationNeed`,
  kind/category types, per-kind node ordinals, per-kind node `detail` schemas,
  a derived per-kind latest-expected-readiness-band scalar
  (`latestExpectedBand`, D94-L/I50-L — the sole band reader; no earliest-band
  array survives), and derived intent-kind grouping. Raw domain enum taxonomy
  lives in the zero-import `schema/kinds.ts` leaf so web-facing graph imports
  do not pull in Drizzle. Agent-facing reference prose cites schema-owned
  vocabulary rather than regenerating a parallel ontology table.

- **Policy** (`policy/category-policy.ts`) — the single per-category
  metadata table (`EDGE_CATEGORY_METADATA`): endpoint roles, impact
  direction/strength (cascade vs advisory), criteria-help signal, and
  projection effects.

- **Projection** (`projection/`) — anchor-relative derivations over the
  policy table: `labels.ts` (direction-aware semantic phrasing) and
  `direction.ts` (upstream/downstream/lateral for the reconciliation
  flow). Pure functions; no DB access.

- **Workspace graph runtime** (`workspace-store.ts`) — opens `.brunch/data.db`
  through `db/connection.ts` and returns the `CommandExecutor` plus bound
  query readers for adapters. No legacy-seed repair remains; there is no
  seeded register to repair.

## Observed read-shape ledger

D60-L read-shape ownership is explicit: every durable graph read shape has one canonical owner in `queries.ts`; adapters may expose only the subset they need. Deferred means eligible or known but not currently exposed for that consumer; `n/a` means deliberately outside that consumer's product role.

| Shape                  | Canonical owner                 | `read_graph` tool       | RPC      | Web      | Reason for deferred / n/a                                                                                                                                 |
| ---------------------- | ------------------------------- | ----------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overview`             | `getGraphOverview`              | required                | required | required | —                                                                                                                                                         |
| `neighborhood`         | `getNodeNeighborhood`           | required                | required | required | —                                                                                                                                                         |
| `list_by_kind`         | `getGraphSliceByKinds`          | required                | deferred | deferred | Web-eligible bounded graph slice; RPC follows a concrete web/client need.                                                                                 |
| `list_by_band`         | `getGraphSliceByReadinessBands` | required                | deferred | deferred | Web-eligible D94-L derived-band evidence slice; RPC follows a concrete web/client need.                                                                   |
| `gaps`                 | `getGraphGaps`                  | required                | n/a      | n/a      | Agent/RPC-only diagnostic shape; not a web observer projection.                                                                                           |
| `related`              | `getRelatedNodes`               | required                | n/a      | n/a      | Agent/RPC-only traversal helper; not a web observer projection.                                                                                           |
| `reconciliation_needs` | `getOpenReconciliationNeeds`    | dedicated register tool | deferred | deferred | Exposed to agents through `read_reconciliation_needs`, not as a `read_graph` mode; no RPC/web projection yet.                                             |

`observed-shapes-coverage.test.ts` guards the required subsets against accidental drift: the tool mode union must stay at the five required agent shapes, while RPC and web stay at `overview` + `neighborhood` until a scoped feature deliberately promotes another row. There is no `gaps`/`elicitation_gaps` row: the persisted gap register was retired (D65-L) and the session-local scratchpad it replaced is session state, not a graph query shape.

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

- `db/` — Drizzle table definitions and connection handle. `graph/` is the
  only application layer that should import `db/` directly.

## Imported by `db/`

- `schema/kinds.ts` — the single sanctioned `db/` → `graph/` edge (D73-L).
  It is a zero-import taxonomy leaf containing only domain enum literals for
  column constraints and graph-domain types.

## Imported by

- `.pi/extensions/brunch-data/graph/` — Pi tool adapters for `mutate_graph` and `read_graph`.
- `rpc/` — graph projection handlers and synchronous response-capture wiring.
- `projections/graph/` — topology stubs for deferred graph PROJECT seams; node-neighborhood consumers read `NodeNeighborhood` directly from `queries.ts`.
- `agents/contexts/data-model/graph/` — reusable model-facing graph context text over projected graph DTOs, including advisory/settled labeling.
- `.pi/extensions/agent-runtime/system-prompts/` — prompt composition and the thin graph-fact seed renderers consume graph reads directly; there is no gap-recommendation layer to consume.
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
    spec-record mapping
    re-exports command input/result types (command-types.ts)
    createSpec (identity + spec.kind scope, D89-L; readiness stays computed, D45-L)
    createNode
    per-kind node ordinal allocation
    mutateGraph / dryRunMutateGraph (batch-wide createBasis + createSettlement)
    acceptReviewSet
    create/resolve reconciliation need
    patch_node / patch_edge settlement promotion (advisory -> settled monotonic; settled -> advisory rejected)

  command-executor/
    command-types.ts
      command input/result contract types re-exported by command-executor.ts
    command-validation.ts
      structural input/patch validators + kind tables for command-executor.ts
    graph-mutation-types.ts
      mutateGraph input/result/diagnostic types re-exported by command-executor.ts
    create-graph-batch.ts
      private create-only planner shared by direct-create callers and mutateGraph
    graph-mutation-planner.ts
      mixed create/patch/delete planner
      dry-run/commit structural parity
      temporary endpoint graph for supersession acyclicity
    graph-mutation-writer.ts
      mutation write/apply path for mutateGraph and acceptReviewSet

  review-set.ts
    review-set payload contract
    selected-spec projected-code resolution
    explicit-basis mutateGraph translation

  queries.ts
    getGraphOverview
    getNodeNeighborhood
    resolveGraphNodeCode
    getOpenReconciliationNeeds
    queryGraph / getNodes (GraphFilter, including settled-only settlement filter)
    row -> domain mapping

  workspace-store.ts
    openWorkspaceGraphRuntime(cwd)
    bound queryGraph/getNodes readers
    openWorkspaceCommandExecutor(cwd)

  schema/
    kinds.ts
      zero-import domain enum taxonomy leaf
    nodes.ts
      GraphNode and node taxonomy metadata
      NodeBasis / NodeSettlement as orthogonal required fields (D63-L, D99-L, I52-L)
      derived readiness-band membership + latestExpectedBand(kind) scalar (D94-L, I50-L)
      per-kind detail schema owner consumed by validation + mutation boundary schemas
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
graph/schema/kinds.ts
  domain enum literals
      │
      ├─► db/schema.ts
      │     Drizzle rows + enum column constraints
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
      ├─► .pi/extensions/brunch-data/graph
      │     agent tool adapter
      │
      ├─► rpc/
      │     public product projections
      │     session.submitExchangeResponse capture wiring
      │
      └─► .pi/extensions/agent-runtime/system-prompts
            thin graph-fact seed render inputs (no gap-recommendation selection)
```

## Fractal split points

Keep `command-executor.ts` and `queries.ts` as public entry points. The first
real split is now `command-executor/graph-mutation-planner.ts` and
`command-executor/graph-mutation-writer.ts`: private planning/apply code for the
`mutateGraph` seam, imported only by the public `command-executor.ts`
entrypoint. `create-graph-batch.ts` remains the narrower shared planner for the
create-only subset used by review-set translation and test/dev helpers.
`command-types.ts` (command input/result contract) and `command-validation.ts`
(structural input/patch validators + kind tables) follow the same rule: the
root `command-executor.ts` keeps only the `CommandExecutor` class and the
public re-export barrel. Future splits should follow the same pattern: split
by semantic responsibility, keep external imports pointed at the root
entrypoint, and avoid folder scaffolding until pressure is real.

```pseudo
graph/command-executor/
  command-types.ts
    command input/result contract types re-exported by command-executor.ts
  command-validation.ts
    structural input/patch validators + kind tables
  graph-mutation-types.ts
    mutateGraph input/result/diagnostic types re-exported by command-executor.ts
  create-graph-batch.ts
    create-only planner and result formatting
  graph-mutation-planner.ts
    planned edge endpoints
    existing/batch ref validation
    patch/delete validation
    supersession-cycle detection over existing ids + temporary batch keys
  graph-mutation-writer.ts
    create/update/delete application
    change-log payload emission

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
