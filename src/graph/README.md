# graph/ — Graph domain layer

Canonical reference: `docs/design/GRAPH_MODEL.md`
SPEC decisions: D4-L, D20-L, D27-L, D45-L, D51-L, D52-L, D53-L, D54-L, D60-L, D62-L, D63-L, D75-L

## Owns

- **CommandExecutor** (`command-executor.ts`) — the single mutation boundary for
  graph/spec writes. It hides structural validation, transaction mechanics,
  spec-local LSN allocation, per-kind node ordinal allocation, change-log append,
  and structured command results. It also owns prospective-register writes for
  `elicitation_gaps` (`createSpec` seeding, legacy/local seed-floor repair, and
  create/disposition commands), because the gap register shares the same
  spec-local LSN and audit boundary. Gaps name obligations by
  `refersTo: NodeKind` + free-form `question`, not a parallel typology enum.

- **mutateGraph** — atomic graph mutation for direct writers and future curation:
  one tool call, one transaction, one selected-spec LSN, all-or-nothing. The
  direct agent surface currently uses create-only `ops[]` (`create_node` plus
  role-named `create_edge`) rather than raw DB rows. `command-executor/`
  owns the private shared planners used by both dry-run and commit before any
  batch writes occur.

- **review-set payload translation** (`review-set.ts`) — validates exact
  user-reviewable review-set payloads, resolves projected existing-node codes
  inside the selected spec, and translates them to explicit-basis `mutateGraph`
  batches.
  `CommandExecutor.acceptReviewSet` is the only graph mutation entrypoint for
  accepted review sets and records `operation: "accept_review_set"`.

- **Capture translators** (`capture/`) — narrow, high-confidence structured
  response translators that turn transcript-native answers into `mutateGraph`
  command input. They do not write DB rows directly and do not own session
  projection.
- **Readers / query functions** (`queries.ts`) — graph reads at multiple
  detail levels: active-context and graph-truth overview, node
  neighborhood, selected-spec graph-code lookup, open reconciliation needs, and
  elicitation gaps. These return typed domain objects or
  internal ids, not Drizzle rows.

- **Elicitation driver** (`elicitation-driver.ts`) — pure read-only rank/select
  policy over selected-spec `ElicitationGap[]`. It owns the deterministic
  what-to-ask-next ordering (band → importance → coverage → affinity → stable
  tiebreak) and imports no DB, session, projection, or prompt layers.

- **Domain schema types** (`schema/`) — `GraphNode`, `GraphEdge`,
  `ReconciliationNeed`, `ElicitationGap` (`refersTo` + `question`),
  kind/category types, per-kind node ordinals, and derived intent-kind grouping. Raw domain enum
  taxonomy lives in the zero-import `schema/kinds.ts` leaf so web-facing graph
  imports do not pull in Drizzle.

- **Policy** (`policy/category-policy.ts`) — the single per-category
  metadata table (`EDGE_CATEGORY_METADATA`): endpoint roles, impact
  direction/strength (cascade vs advisory), criteria-help signal, and
  projection effects.

- **Projection** (`projection/`) — anchor-relative derivations over the
  policy table: `labels.ts` (direction-aware semantic phrasing) and
  `direction.ts` (upstream/downstream/lateral for the reconciliation
  flow). Pure functions; no DB access.

- **Workspace graph runtime** (`workspace-store.ts`) — opens `.brunch/data.db`
  through `db/connection.ts`, repairs legacy/local specs missing the current
  seeded elicitation-gap floor through `CommandExecutor`, and returns the
  executor plus bound query readers for adapters.

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
| `elicitation_gaps` | `getElicitationGaps` | deferred | deferred | deferred | Consumed by prompt readiness and the read-only elicitation driver through the selected-spec graph-read seam; still not a `read_graph`/RPC/web projection. |

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

- `db/` — Drizzle table definitions and connection handle. `graph/` is the
  only application layer that should import `db/` directly.

## Imported by `db/`

- `schema/kinds.ts` — the single sanctioned `db/` → `graph/` edge (D73-L).
  It is a zero-import taxonomy leaf containing only domain enum literals for
  column constraints and graph-domain types.

## Imported by

- `.pi/extensions/graph/` — Pi tool adapters for `mutate_graph` and `read_graph`.
- `rpc/` — graph projection handlers and synchronous response-capture wiring.
- `projections/graph/` — topology stubs for deferred graph PROJECT seams; node-neighborhood consumers read `NodeNeighborhood` directly from `queries.ts`.
- `renderers/graph/` — reusable lossy markdown/text rendering over projected graph DTOs.
- `.pi/agents/` — prompt composition consumes the read-only elicitation driver and context renderers consume graph reads.
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
    createSpec (spec identity only; no stored readiness grade)
    create/set elicitation-gap disposition
    createNode
    per-kind node ordinal allocation
    mutateGraph / dryRunMutateGraph
    acceptReviewSet
    create/resolve reconciliation need

  command-executor/
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

  capture/
    structured-response.ts
      deterministic labeled-answer capture to explicit-basis mutateGraph input

  queries.ts
    getGraphOverview
    getNodeNeighborhood
    resolveGraphNodeCode
    getElicitationGaps
    getOpenReconciliationNeeds
    row -> domain mapping

  elicitation-driver.ts
    pure read-only rank/select over ElicitationGap[]
    no DB writes, no prompt-layer imports, no driver-local state

  workspace-store.ts
    openWorkspaceGraphRuntime(cwd)
    seeded elicitation-gap floor repair for legacy/local specs
    bound queryGraph/getNodes/getElicitationGaps readers
    openWorkspaceCommandExecutor(cwd)

  schema/
    kinds.ts
      zero-import domain enum taxonomy leaf
    elicitation-gaps.ts
    elicitation-gap-fixtures.ts
      synthetic gap builders (presenceGap, groundingFloorGaps); production
      fail-closed floor + test fixtures ride the same shape
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
      ├─►.pi/extensions/graph
      │     agent tool adapter
      │
      ├─► rpc/
      │     public product projections
      │     session.submitExchangeResponse capture wiring
      │
      └─► .pi/agents
            elicitation recommendation selection and prompt context render inputs
```

## Fractal split points

Keep `command-executor.ts` and `queries.ts` as public entry points. The first
real split is now `command-executor/graph-mutation-planner.ts` and
`command-executor/graph-mutation-writer.ts`: private planning/apply code for the
`mutateGraph` seam, imported only by the public `command-executor.ts`
entrypoint. `create-graph-batch.ts` remains the narrower shared planner for the
create-only subset used by review-set translation and test/dev helpers. Future
splits should follow the same pattern: split by semantic responsibility, keep
external imports pointed at the root entrypoint, and avoid folder scaffolding
until pressure is real.

```pseudo
graph/command-executor/
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
