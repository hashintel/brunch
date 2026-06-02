# web/ — Brunch React client

Canonical references: `docs/architecture/prd.md` §Browser / web client, `src/rpc/README.md`

This directory owns the browser client for `brunch --mode web`. The browser is a thin remote head over the Brunch host: one React app, one WebSocket-backed Brunch JSON-RPC client, TanStack Router for route/data preloading, and TanStack Query for cache ownership and update scheduling.

The web client must not read SQLite, Pi RPC, local JSONL, or `.brunch/workspace.json` directly. It speaks Brunch public RPC method names and renders product projections.

## Current topology

```pseudo
web/
  main.tsx
    browser entrypoint
    creates root-owned WebSocketRpcClient
    creates BrunchWebRuntime
    disposes runtime on pagehide

  rpc-client.ts
    one WebSocket JSON-RPC client
    request(method, params) -> Promise<result>
    subscribe(listener) for server notifications
    close()

  app.tsx
    creates QueryClient + TanStack Router runtime
    root route loader ensureQueryData(workspace.snapshot)
    current proof UI:
      workspace.snapshot
      session.transcriptDisplay  # proof-era method; rename debt per rpc/README
      brunch.updated notification -> invalidate relevant queries

  *.test.tsx / *.test.ts
    component and transport oracles for current web proof
```

Current `app.tsx` intentionally keeps query options in-file because the surface is still tiny. Split to the topology below as soon as a second route, mutation, or graph projection lands.

## Host / asset boundary

`src/rpc/web-host.ts` serves the built Vite bundle and attaches Brunch JSON-RPC at `/rpc`:

```pseudo
GET /
  -> dist-web/index.html

GET /assets/*
  -> static built assets

WS /rpc
  -> Brunch public JSON-RPC handlers
```

Useful pattern from `../brunch`: a CLI-launched local service can choose a random localhost port, print/open the URL, serve static client assets, and keep the browser as a local attachment to the same process authority. Brunch-next already follows the same shape through `startWebHost`; future launch polish can copy the old runtime guard / browser-open ergonomics if needed.

## Framework contract

```pseudo
React
  component/runtime layer only

TanStack Router
  route ownership
  route params
  loaders that prewarm Query caches via ensureQueryData
  defaultPreloadStaleTime: 0

TanStack Query
  query/mutation cache
  request deduplication
  invalidation on Brunch RPC notifications
  optimistic mutation scaffolding when web writes arrive

WebSocketRpcClient
  transport only
  no React state
  no product-specific cache
  no method-specific helpers
```

Do not add a second client state container for server truth. Local UI state is fine for transient form controls, expansion state, canvas viewport, selected graph node, etc.; product facts live in Query cache entries derived from RPC projections.

## Source-of-truth flow

```pseudo
Brunch host canonical stores
  .brunch/workspace.json
  SQLite graph DB
  Pi JSONL transcript
      │
      ▼
rpc/ handlers
  named product projections and mutations
      │
      ▼
web/rpc-client.ts
  one WebSocket request/notification transport
      │
      ▼
web/queries/* and web/mutations/*
  Query options, mutation options, subscription bridges
      │
      ▼
routes/features/components
  render product projections
```

## Target file topology

Introduce these files incrementally when an importer or test needs the seam. Do not create empty markers.

```pseudo
web/
  app.tsx
    createBrunchWebRuntime
    createBrunchWebRouter
    BrunchWebApp shell

  main.tsx
    DOM mounting only

  rpc-client.ts
    generic WebSocket JSON-RPC transport

  query-client.ts
    QueryClient factory/defaults once defaults matter outside tests

  query-keys.ts
    one stable key factory object for all product resources

  queries/
    workspace.ts
      workspaceSnapshotQueryOptions(rpc)
      workspaceSelectionStateQueryOptions(rpc)

    session.ts
      pendingExchangeQueryOptions(rpc, specId, sessionId)
      sessionExchangesQueryOptions(rpc, specId, sessionId)
      # proof-era compatibility may live here temporarily:
      transcriptDisplayQueryOptions(rpc, specId, sessionId)

    graph.ts
      graphOverviewQueryOptions(rpc, specId)
      graphNodeNeighborhoodQueryOptions(rpc, specId, nodeId, hops)
      graphRecentChangesQueryOptions(rpc, specId, sinceLsn)

    coherence.ts
      graphCoherenceSummaryQueryOptions(rpc, specId)
      # only after durable coherence semantics are modeled

  mutations/
    workspace.ts
      activateWorkspaceMutationOptions(rpc)

    session.ts
      promptExchangeMutationOptions(rpc)
      submitExchangeResponseMutationOptions(rpc)
      submitMessageMutationOptions(rpc)

  subscriptions/
    brunch-updates.ts
      useBrunchUpdateInvalidation(rpc, queryClient)
      maps notification topics/LSNs -> exact Query keys

  routes/
    root.tsx
      workspace shell and loader

    workspace.tsx
      spec/session selection dashboard

    session.tsx
      transcript + pending exchange surface

    graph.tsx
      graph overview / node-neighborhood route

  features/
    structured-exchange/
      PendingExchangePanel.tsx
      response controls for request_answer / request_choice / request_choices / request_review

    propose-graph/
      ProposeGraphExchange.tsx
      ProposalConceptCard.tsx
      GraphContextPanel.tsx

    graph/
      GraphOverview.tsx
      NodeNeighborhood.tsx
      ReconciliationBadges.tsx
```

## Query key contract

Keys should mirror Brunch product resources, not database tables:

```pseudo
queryKeys = {
  workspace: {
    snapshot: ['workspace.snapshot'],
    selectionState: ['workspace.selectionState'],
  },

  session: {
    pendingExchange: (specId, sessionId) =>
      ['session.pendingExchange', specId, sessionId],

    exchanges: (specId, sessionId) =>
      ['session.exchanges', specId, sessionId],

    transcriptDisplay: (specId, sessionId) =>
      ['session.transcriptDisplay', specId, sessionId], # proof-era only
  },

  graph: {
    overview: (specId) => ['graph.overview', specId],
    nodeNeighborhood: (specId, nodeId, hops) =>
      ['graph.nodeNeighborhood', specId, nodeId, hops],
    recentChanges: (specId, sinceLsn) =>
      ['graph.recentChanges', specId, sinceLsn],
    coherenceSummary: (specId) =>
      ['graph.coherenceSummary', specId],
  },
}
```

Avoid:

```pseudo
['nodes']
['edges']
['records']
['sqlite', tableName]
['pi-rpc', command]
```

## RPC methods to web hooks

Method names follow `src/rpc/README.md`. Existing proof-era methods may remain until renamed, but new web work should use the stable vocabulary below.

```pseudo
rpc.discover
  useRpcDiscoveryQuery(rpc)
  Purpose: optional capability/schema introspection for debug panels and adaptive clients.

workspace.snapshot
  workspaceSnapshotQueryOptions(rpc)
  Purpose: cwd product state, project/posture, current/default spec/session, chrome state.
  Route loader: root route.

workspace.selectionState
  workspaceSelectionStateQueryOptions(rpc)
  Purpose: boot/picker inventory and whether explicit activation is required.
  Route: workspace/spec-session picker.

workspace.activate
  activateWorkspaceMutationOptions(rpc)
  Purpose: apply explicit workspace -> spec -> session decision.
  On success: invalidate workspace.snapshot, workspace.selectionState, session/graph keys for selected resources.

session.promptExchange
  promptExchangeMutationOptions(rpc)
  Purpose: start/resume/advance assistant-first loop until pending exchange, idle, needs_human, or blocker.
  On success: invalidate session.pendingExchange and session.exchanges.

session.pendingExchange
  pendingExchangeQueryOptions(rpc, specId, sessionId)
  Purpose: current unresolved structured exchange.
  Route: session/propose-graph panel.

session.submitExchangeResponse
  submitExchangeResponseMutationOptions(rpc)
  Purpose: submit terminal response for one pending structured exchange.
  On success: invalidate session.pendingExchange, session.exchanges, graph.overview, graph.coherenceSummary as applicable.

session.submitMessage
  submitMessageMutationOptions(rpc)
  Purpose: ordinary non-exchange user text or explicit interruption.
  Must not silently answer a pending exchange.

session.exchanges
  sessionExchangesQueryOptions(rpc, specId, sessionId)
  Purpose: transcript-derived structured exchange history.

future graph.overview
  graphOverviewQueryOptions(rpc, specId)
  Purpose: committed graph projection, node/edge counts, LSN.

future graph.nodeNeighborhood
  graphNodeNeighborhoodQueryOptions(rpc, specId, nodeId, hops)
  Purpose: focused graph context around selected/mentioned node.

future graph.recentChanges / graph.changesSince
  graphRecentChangesQueryOptions(rpc, specId, sinceLsn)
  Purpose: worldUpdate panels and cache patching.

future graph.coherenceSummary
  graphCoherenceSummaryQueryOptions(rpc, specId)
  Purpose: coherence banner/badges after durable semantics are defined.
```

## Subscription / notification bridge

Current proof code listens for `brunch.updated` and invalidates broad keys. Target shape:

```pseudo
useBrunchUpdateInvalidation(rpc, queryClient)
  subscribe to server notifications once at app/root level

  for each notification:
    if topic == workspace.snapshot:
      invalidate queryKeys.workspace.snapshot

    if topic == session.pendingExchange:
      invalidate exact pendingExchange key

    if topic == session.exchanges:
      invalidate exact exchanges key

    if topic == graph.overview:
      invalidate or patch exact graph.overview(specId)

    if topic == graph.nodeNeighborhood:
      invalidate neighborhoods that include changed node ids

    if topic == graph.coherenceSummary:
      invalidate exact graph.coherenceSummary(specId)
```

Prefer exact invalidation when the notification includes `{specId, sessionId, lsn, nodeIds, edgeIds}`. Broad invalidation is acceptable in proof code, but it should not become the product cache policy.

## Route/data ownership pattern

Use the old `../brunch/src/client/routes/specification/$id/-specification-data.ts` as a cautionary reference: centralizing route query keys, loader priming, and invalidation helpers is useful, but REST fetchers and large all-in-one route data modules should not be copied directly.

Target Brunch-next pattern:

```pseudo
route loader
  context.queryClient.ensureQueryData(queryOptionsFrom(web/queries/*))

route component
  useSuspenseQuery(same query options) for required data
  useQuery(enabled: target != null) for optional panels

feature component
  receives loaded product projection props or calls a narrow feature hook
  never constructs raw RPC method strings ad hoc
```

## `propose-graph` UI data dependencies

```pseudo
ProposeGraphExchange route/panel
  required:
    workspace.snapshot
    session.pendingExchange(specId, sessionId)

  context panels:
    graph.overview(specId)
    graph.nodeNeighborhood(specId, selectedNodeId, hops)
    graph.coherenceSummary(specId)  # future, once modeled

  mutations:
    session.submitExchangeResponse
      decision: accept_concept | request_revision | reject
      comment?: string

  after submit:
    pendingExchange invalidates immediately
    graph projections update only after agent-internal commitGraph succeeds
```

The browser does not call `commitGraph`, does not submit node/edge drafts in `propose-graph`, and does not treat proposal prose as graph truth.

## Testing expectations

```pseudo
rpc-client.test.ts
  transport ordering
  request id correlation
  malformed frame failure
  notifications independent from requests

app / route tests
  one runtime-owned QueryClient and router
  loaders call expected queryOptions
  no optional session query when no session is selected
  notifications invalidate expected keys

future hook tests
  query keys are exact and stable
  mutation success invalidates/patches intended domains only
  pending exchange response does not submit ambient message text
  graph updates do not remount unrelated session routes
```

Keep tests at the seam that owns the behavior: transport tests for `rpc-client.ts`, hook tests for `queries/` / `mutations/`, route integration tests for loader/cache ownership, and component tests for rendering/accessibility.
