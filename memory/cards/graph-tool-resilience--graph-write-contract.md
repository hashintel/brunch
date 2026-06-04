# Graph write contract materialization

Frontier: graph-tool-resilience
Status:   active
Mode:     chain
Created:  2026-06-04

## Orientation

- Containing seam: `graph-tool-resilience` (FE-808), reshaped from probe-only hardening into the graph write contract materialization frontier.
- Posture: proving (inherited from `graph-tool-resilience`). This slice chain should stabilize I39-L/I40-L/I41-L before capture/review frontiers build on graph writes.
- Main risk: adapters, snapshots, and tests may still assume raw integer node ids and `accepted_review_set` basis values; remove the old shape directly rather than bridging it.
- Cross-cutting obligations: preserve `CommandExecutor` as the only graph mutation authority; keep projected node codes out of DB storage; keep readiness bands as query/rubric metadata, not write-time kind gates.

## Card 1 — Persist per-kind node ordinals

Status: done

### Target Behavior

Every committed graph node receives a monotonic, non-reused ordinal scoped to `(spec_id, plane, kind)`.

### Boundary Crossings

```pseudo
agent/capture/review command input
→ graph/CommandExecutor
→ db/schema.ts nodes + node_kind_counters
→ graph/snapshot row mappers
```

### Risks and Assumptions

- RISK: allocating ordinals inside failed batches may leave gaps.
  → MITIGATION: require monotonic/no-reuse, not gaplessness; rollback tests should prove failed batches do not persist nodes or change-log entries.
- ASSUMPTION: a small counter table is cheaper and clearer than deriving ordinals by scanning existing nodes.
  → IMPACT IF FALSE: CommandExecutor allocation code changes, but projected-code contract remains.
  → VALIDATE: transaction tests around batch allocation, rollback, and duplicate DB constraints.

### Posture check

This stabilizes I39-L and proves the storage half of D62-L through the real mutation boundary.

### Acceptance Criteria

```pseudo
✓ command-executor.test.ts — multi-node batches allocate kind_ordinal per (spec, plane, kind)
✓ command-executor.test.ts — failed batches do not persist nodes, edges, change-log entries, or unusable counter state
✓ db/schema tests or migration checks — duplicate (spec_id, plane, kind, kind_ordinal) rows are structurally impossible
✓ snapshot.test.ts — GraphNode domain objects expose kindOrdinal
```

### Verification Approach

- Inner: CommandExecutor + DB schema tests — prove allocation, rollback, and uniqueness.
- Middle: none for this card; later cards exercise adapters/product tools.

### Cross-cutting obligations

- Do not store rendered reference-code strings in graph tables.
- Keep ordinals spec-scoped; no workspace-global graph truth.

### Expected touched paths (tentative)

```pseudo
src/db/
├── schema.ts              ~
├── row-schemas.ts         ~
└── README.md              ~
drizzle/
└── *.sql                  +
src/graph/
├── command-executor.ts       ~
├── command-executor.test.ts  ~
├── snapshot.ts               ~
├── snapshot.test.ts          ~
├── spec-ownership.test.ts    ~
├── atoms.ts                  ~
├── index.ts                  ~
└── schema/
    └── nodes.ts              ~
```

## Card 2 — Replace path-shaped graph basis with approval basis

Status: done

### Target Behavior

Accepted graph nodes and edges persist only `basis: explicit | implicit`.

### Boundary Crossings

```pseudo
propose-graph / capture / review-set adapter basis decision
→ graph/CommandExecutor input
→ db enum constraints
→ snapshots and graph domain types
```

### Risks and Assumptions

- RISK: current tool schemas allow callers to supply per-node/per-edge basis and preserve `accepted_review_set`.
  → MITIGATION: move basis to the command/adaptation context; reject retired values in tests.
- ASSUMPTION: mutation path is recoverable enough from `change_log.operation` and payload.
  → IMPACT IF FALSE: need richer change-log payloads, not a third basis enum.
  → VALIDATE: tests assert both stored basis and change-log operation for each write path.

### Posture check

This stabilizes I40-L and removes the most misleading compatibility bridge in the graph model.

### Acceptance Criteria

```pseudo
✓ command-executor.test.ts — commitGraph accepts one batch approval basis and applies it to all created nodes/edges
✓ command-executor.test.ts — retired accepted_review_set basis values are rejected at the command boundary or impossible through types/schemas
✓ review-set-proposal tests — accepted review-set translation commits exact reviewed items with explicit basis
✓ graph tool adapter tests — propose-graph commit path supplies implicit basis without asking the agent per item
✓ change-log assertions — mutation operation remains visible independently of basis
```

### Verification Approach

- Inner: domain/schema/adapter tests — prove basis enum and assignment rules.
- Middle: none for this card unless an existing product probe already inspects basis.

### Cross-cutting obligations

- `basis` is approval strength only; do not encode strategy or transport path in it.
- Low-confidence inferred material still stays outside graph truth.

### Expected touched paths (tentative)

```pseudo
src/db/
├── schema.ts              ~
└── README.md              ~
src/graph/
├── command-executor.ts       ~
├── command-executor.test.ts  ~
├── schema/
│   ├── nodes.ts              ~
│   └── edges.ts              ~
└── index.ts                  ~
src/.pi/extensions/graph/
├── tool-schemas.ts           ~
├── command-adapter.ts        ~
├── review-set-proposal.ts    ~
└── *.test.ts                 ?
```

## Card 3 — Resolve existing graph refs by projected code

Status: done

### Target Behavior

Agent-facing graph write adapters resolve existing-node references from projected codes to internal NodeIds.

### Boundary Crossings

```pseudo
commit_graph tool params / review-set payload
→ graph adapter projected-code parser
→ selected-spec graph lookup
→ CommandExecutor NodeId refs
→ tool result rendering
```

### Risks and Assumptions

- RISK: prefix parsing can be ambiguous if labels collide.
  → MITIGATION: hard-code globally unique labels and test longest-prefix parsing.
- RISK: CommandExecutor currently owns existing-node spec guards for raw ids.
  → MITIGATION: keep selected-spec ownership check after code resolution; adapter resolution must not weaken the guard.
- ASSUMPTION: lower-level CommandExecutor may still use internal NodeId refs after adapter resolution.
  → IMPACT IF FALSE: ref-resolution helper moves into graph/ so all adapters share it.
  → VALIDATE: adapter and spec-ownership tests.

### Posture check

This lights up the D62-L product handle path without making projected code a DB column.

### Acceptance Criteria

```pseudo
✓ graph metadata tests — every node kind has a globally unique 1–3 letter label and readiness-band metadata
✓ adapter tests — existingCode values like A1/CON2/CR3 parse to kind + kindOrdinal by longest prefix
✓ adapter/CommandExecutor tests — existingCode resolves only within the selected spec
✓ read_graph formatting tests — success output renders projected codes as primary handles and raw ids only as diagnostics/details when needed
```

### Verification Approach

- Inner: parser/adapter/spec-ownership tests — prove code resolution and selected-spec guard.
- Middle: direct graph tool probe later in the frontier should include an existing-node code reference.

### Cross-cutting obligations

- Projected codes are presentation handles; do not store them or make them canonical DB identity.
- Existing refs must target the selected spec only.

### Expected touched paths (tentative)

```pseudo
src/graph/
├── schema/
│   └── nodes.ts              ~
├── snapshot.ts               ~
├── snapshot.test.ts          ~
├── spec-ownership.test.ts    ~
└── index.ts                  ~
src/.pi/extensions/graph/
├── tool-schemas.ts           ~
├── command-adapter.ts        ~
├── command-adapter.test.ts   +
└── index.ts                  ~
src/agents/contexts/
├── graph.ts                  ~
├── graph.test.ts             ~
├── node.ts                   ~
└── node.test.ts              ~
```

## Card 4 — Enforce supersession acyclicity

Status: next

### Target Behavior

Same-spec supersession edge creation rejects every proposed cycle before writing any batch state.

### Boundary Crossings

```pseudo
edge command input
→ CommandExecutor structural validation
→ existing same-spec supersession edge read
→ transaction rollback / success result
```

### Risks and Assumptions

- RISK: mixed existing + intra-batch cycles are easy to miss if validation runs only per edge.
  → MITIGATION: validate the proposed supersession graph as a set against existing same-spec supersession edges.
- ASSUMPTION: supersession acyclicity is structural legality, not coherence advice.
  → IMPACT IF FALSE: downstream active-context projection can hide the wrong current node.
  → VALIDATE: cycle tests across existing, intra-batch, and mixed cases.

### Posture check

This stabilizes I41-L and removes a documented-but-unenforced graph invariant.

### Acceptance Criteria

```pseudo
✓ command-executor.test.ts — rejects simple existing-cycle closure
✓ command-executor.test.ts — rejects intra-batch supersession cycles
✓ command-executor.test.ts — rejects mixed existing+batch supersession cycles
✓ command-executor.test.ts — rejected cycles roll back all nodes/edges/change-log from the batch
✓ command-executor.test.ts — acyclic supersession chains still commit
```

### Verification Approach

- Inner: CommandExecutor structural tests — prove cycle detection and rollback.
- Middle: none required.

### Cross-cutting obligations

- Keep cross-plane freedom; acyclicity applies to `supersession` edges, not node-kind legality.

### Expected touched paths (tentative)

```pseudo
src/graph/
├── command-executor.ts       ~
├── command-executor.test.ts  ~
└── policy/
    └── category-policy.ts    ?
```

## Card 5 — Make active-context graph reads code-aware and non-dangling

Status: next

### Target Behavior

Active-context graph snapshots omit hidden superseded nodes and every edge whose endpoint is hidden.

### Boundary Crossings

```pseudo
graph/snapshot pull
→ graph domain projection
→ agents/contexts render
→ read_graph tool result / RPC graph readers
```

### Risks and Assumptions

- RISK: changing `getGraphOverview` semantics could break existing observer UI expectations.
  → MITIGATION: make projection choice explicit where the public read surface needs both graph_truth and active_context; default only where current product contract names it.
- ASSUMPTION: active-context filtering belongs in graph pull, while LLM string formatting belongs in agents/contexts or tool adapters.
  → IMPACT IF FALSE: projection/rendering responsibilities blur again.
  → VALIDATE: snapshot tests plus context-render tests.

### Posture check

This stabilizes D60-L and keeps the graph read path aligned with the new code/basis write contract.

### Acceptance Criteria

```pseudo
✓ snapshot.test.ts — graph_truth can include superseded predecessors and their edges when requested
✓ snapshot.test.ts — active_context omits superseded nodes and edges touching omitted nodes
✓ agents context tests — rendered graph/node context uses projected codes as primary handles
✓ read_graph adapter tests — details/content remain selected-spec scoped after projection changes
```

### Verification Approach

- Inner: snapshot/context/tool tests — prove projection and rendering split.
- Middle: later frontier probe can exercise browser/read_graph observation after graph writes.

### Cross-cutting obligations

- PULL remains typed read-only data in `graph/`; RENDER remains in `agents/contexts/` or adapter formatting.
- Do not widen into a generic records API beyond the list/related/overview shapes currently named by D60-L.

### Expected touched paths (tentative)

```pseudo
src/graph/
├── snapshot.ts               ~
├── snapshot.test.ts          ~
└── README.md                 ~
src/agents/contexts/
├── graph.ts                  ~
├── graph.test.ts             ~
├── node.ts                   ~
└── node.test.ts              ~
src/.pi/extensions/graph/
├── command-adapter.ts        ~
└── index.ts                  ~
src/rpc/
├── handlers.ts               ?
└── handlers.test.ts          ?
src/web/
├── app.tsx                   ?
└── app.test.tsx              ?
```
