# RPC/Web graph read relay

Frontier: graph-observed-shapes
Status:   active
Mode:     chain
Created:  2026-06-08

## Orientation

- Containing seam: D60-L graph context PULL-to-surface boundary, specifically the selected-spec `graph.overview` / `graph.nodeNeighborhood` public RPC and web observer surfaces over `WorkspaceGraphRuntime.forSpec`.
- Relevant frontier item: `graph-observed-shapes`; `memory/PLAN.md` currently marks it done, but the volatile handoff records a new unstaged PULL collapse to `queryGraph` + `getNodes`, so this is a narrow follow-through card under the same consumer-shape policy rather than a new frontier.
- Volatile handoff state: graph PULL now treats `GraphSlice` and `NodeNeighborhood` as the typed JSON forms; RPC/web policy is settled enough to build — relay full read shapes, let web derive presentation locally, and do not reconcile global docs/ledgers yet.
- Main open risk: legacy transport aliases (`nodeCount` / `edgeCount`, `success` / `anchor` / `neighbors`) can survive in discovery schemas, tests, or fixtures even after runtime handlers return graph-owned shapes.

Posture: proving (inherited from `graph-observed-shapes`).

Frontier-level cross-cutting obligations:

- Preserve consumer-specific adoption: RPC/web remain limited to `overview` + `nodeNeighborhood`; do not promote `list_by_kind`, `list_by_band`, `gaps`, or `related` while doing this relay work.
- Preserve selected-spec discipline (D33-L/D61-L): every graph read targets explicit `specId`; no workspace-global graph reads or client-attachment session inference.
- Keep graph-owned read logic in `src/graph/`; RPC validates params and relays, web renders/cache-invalidates, neither layer rebuilds graph queries.
- Do not update `memory/SPEC.md`, `memory/PLAN.md`, `src/graph/README.md`, or projection/renderer ledgers in this slice unless implementation proves the frontier itself must be replanned.

## Card 1 — RPC graph reads relay graph-owned shapes

Status: next  
Weight: full scope card

### Target Behavior

Public graph RPC reads relay the graph-owned typed read shapes without transport-only shape aliases.

### Boundary Crossings

```pseudo
→ public JSON-RPC request (`graph.overview` / `graph.nodeNeighborhood`)
→ `src/rpc/methods/graph.ts` param validation and method discovery schema
→ `WorkspaceGraphRuntime.forSpec(specId).queryGraph/getNodes`
→ JSON-RPC success result containing `GraphSlice` or `NodeNeighborhood`
```

### Risks and Assumptions

- RISK: discovery schemas still advertise legacy count or anchor names after runtime handlers return the new shape → MITIGATION: assert discovery JSON for positive new fields and negative legacy aliases.
- RISK: `graph.nodeNeighborhood` absent-node behavior drifts between RPC fallback and `getNodes` output → MITIGATION: test the absent selector result as `{selector, status: 'not_found', related: [], edges: []}`.
- ASSUMPTION: RPC does not need derived `nodeCount` / `edgeCount` because web and clients can derive counts from `GraphSlice.nodes.length` / `edges.length`.
  → IMPACT IF FALSE: `graph.overview` becomes a transport DTO again and D60-L's typed-read-is-JSON-form policy needs a local exception.
  → VALIDATE: remove count aliases from result schema/tests and prove current web observer still renders counts locally in Card 2.

### Posture check

This tracer proves the public-transport side of the PULL collapse: if `graph.overview` / `graph.nodeNeighborhood` cannot expose the graph-owned read values directly, the new `queryGraph` + `getNodes` shape is not yet a clean consumer contract.

### Acceptance Criteria

```pseudo tree
RPC relay shape
├── ✓ `graph.overview` returns exactly GraphSlice-shaped data: `nodes`, `edges`, `lsn`; no `nodeCount` or `edgeCount`
├── ✓ `rpc.discover` result schema for `graph.overview` advertises the same shape and does not mention count aliases
├── ✓ `graph.nodeNeighborhood` found responses use `NodeNeighborhood`: `selector`, `status: 'found'`, `node`, `related`, `edges`
├── ✓ `graph.nodeNeighborhood` missing responses use `NodeNeighborhood`: `selector`, `status: 'not_found'`, `related: []`, `edges: []`
├── ✓ `rpc.discover` result schema for `graph.nodeNeighborhood` advertises `found` / `not_found` and does not mention `success`, `anchor`, or `neighbors`
└── ✓ existing invalid-param behavior remains `-32602`; selected-spec isolation remains covered by existing wrong-spec assertions
```

### Verification Approach

- Inner: behavior + protocol schema tests — `npm test -- src/rpc/handlers.test.ts`
- Middle: none unless the handler change touches WebSocket host registration; if it does, include `npm test -- src/rpc/web-host.test.ts`
- Outer: none; this is a transport shape relay with existing selected-spec fixtures

### Cross-cutting obligations

- Keep `rpc.discover` product-owned and concrete (D19-L/D48-L); do not add generic graph read methods.
- Keep graph reads read-only and outside `CommandExecutor`; do not touch graph mutation authority.
- Leave unresolved `read_graph related` traversal semantics alone; that is an agent/tool rendering decision, not an RPC/web relay requirement.

### Expected touched paths (tentative)

```pseudo tree
src/rpc/
├── methods/graph.ts     ~
├── handlers.test.ts     ~
└── README.md            ~
```

## Card 2 — Web observer consumes relayed graph read shapes

Status: next  
Weight: light scope card

### Objective

The web graph observer treats RPC graph reads as graph-owned values and keeps all counts/rendering as local presentation derivations.

### Acceptance Criteria

```pseudo tree
Web graph observer shape adoption
├── ✓ `/spec/$specId` still primes only `workspace.state` and `graph.overview(specId)` through TanStack Query
├── ✓ `graphOverviewQueryOptions` consumes `GraphSlice` without relying on `nodeCount` / `edgeCount`
├── ✓ `GraphOverviewPanel` renders node/edge counts from array lengths over a GraphSlice fixture that has no count aliases
├── ✓ `graphNodeNeighborhoodQueryOptions` remains typed as `NodeNeighborhood` and forwards optional `hops` without adopting legacy RPC `success` / `anchor` / `neighbors`
└── ✓ graph update invalidation remains exact for `graph.overview(specId)` and prefix-scoped for `graph.nodeNeighborhood(specId, nodeId, hops?)`
```

### Verification Approach

- Inner: web route/query/render tests — `npm test -- src/web/app.test.tsx`
- Middle: include `npm test -- src/web/rpc-client.test.ts src/rpc/web-host.test.ts` only if the builder touches RPC client or subscription transport code
- Outer: none unless the graph observer UI behavior materially changes; this card should not build new neighborhood UI

### Cross-cutting obligations

- Web remains a read-only observer; do not add graph mutations or client-local graph stores.
- Do not promote additional graph shapes onto web while updating these two required reads.
- Keep route/spec view state client-local; do not borrow the TUI session transcript for graph target selection.

### Assumption dependency

None — the slice builds against D5-L/D10-L/D19-L/D33-L/D60-L decisions and does not hinge on an open SPEC assumption.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

This stays light because it only updates the web client to consume the RPC shape settled by Card 1; if implementation needs a new neighborhood UI, new graph query, or transport DTO, stop and promote/re-scope.

### Expected touched paths (tentative)

```pseudo tree
src/web/
├── queries/graph.ts                 ~
├── features/graph/GraphOverview.tsx ?
├── app.test.tsx                     ~
└── README.md                        ~
```
