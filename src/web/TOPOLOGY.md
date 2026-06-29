# web/ — Brunch React client

Canonical references: `docs/architecture/prd.md` §Browser / web client, `src/rpc/README.md`

This directory owns the browser client served as the **TUI web sidecar**: when you launch the TUI (`brunch`, i.e. `--mode tui`), `runBrunchTui` starts a local web host and opens the browser to it. The browser is a thin remote head over the Brunch host: one React app, one WebSocket-backed Brunch JSON-RPC client, TanStack Router for route/data preloading, and TanStack Query for cache ownership and update scheduling. A standalone web-only mode (`--mode web`) is deferred — the web UI is not useful without the TUI driving the session — so it currently errors with a "not available yet" message.

The web client must not read SQLite, Pi RPC, local JSONL, or `.brunch/workspace.json` directly. It speaks Brunch public RPC method names and renders product projections. Its current graph observer subset is `graph.overview` + `graph.nodeNeighborhood`; `src/graph/README.md` owns the observed-shape ledger and keeps additional graph-owned shapes deliberate rather than accidental bleed-through from agent/RPC needs.

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
    app/runtime/router assembly:
      createBrunchWebRuntime
      createBrunchWebRouter
      BrunchWebApp shell

  query-client.ts
    per-runtime QueryClient defaults

  query-keys.ts
    method-shaped product query keys:
      workspace.state
      session.runtimeState
      graph.overview
      graph.nodeNeighborhood

  queries/
    workspace.ts -> workspace.state + workspace.selectionState query options
    session.ts   -> session.runtimeState query options
    graph.ts     -> graph overview/neighborhood query options

  subscriptions/
    brunch-updates.ts
      brunch.updated -> exact Query invalidation where possible

  app-meta.ts
    static product chrome (name/version/tagline) + home-path abbreviation
    APP_VERSION injected from package.json via vite `__BRUNCH_VERSION__` define

  components/
    app-header.tsx  global header (product identity + workspace path)
    icons.tsx       inline SVG glyphs (chevron / eye / eye-off), no icon dep
    node-card.tsx   plane-accented node presentation primitives
    drawer-card.tsx reusable card-with-collapsible-drawer

  routes/
    root.tsx
      root subscription + global-header layout (Outlet)
      `/` index route: workspace spec list
    spec.tsx
      `/spec/$specId` loader primes workspace.state + graph.overview
      renders the knowledge-graph structured list

  features/graph/
    structured-list-view.tsx
      read-only KnowledgeGraphView: counts sub-header + kind filter chips +
      collapsible per-kind sections of node cards (ported from the prior
      trunk's -structured-list-view, minus chat/annotate/inline-edit)
    kind-display.ts
      presentation-only kind section ordering + plural section labels

  *.test.tsx / *.test.ts
    component, route/cache, and transport oracles for current web proof

```

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
    QueryClient factory/defaults per runtime

  query-keys.ts
    one stable key factory object for all product resources

  queries/
    workspace.ts
      workspaceStateQueryOptions(rpc)
      workspaceSelectionStateQueryOptions(rpc)

    session.ts
      sessionRuntimeStateQueryOptions(rpc, target)
      pendingExchangeQueryOptions(rpc, target)       # target, when exchange UI lands
      sessionExchangesQueryOptions(rpc, target)      # target, when exchange history lands

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
      triggerExchangeMutationOptions(rpc)
      submitExchangeResponseMutationOptions(rpc)
      submitMessageMutationOptions(rpc)

  subscriptions/
    brunch-updates.ts
      useBrunchUpdateSubscription(queryClient, rpc)
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
    exchanges/
      PendingExchangePanel.tsx
      response controls for request_response (answer/choice/choices/review)

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
    state: ['workspace.state'],
    selectionState: ['workspace.selectionState'],
  },

  session: {
    runtimeState: (specId, sessionId) =>
      ['session.runtimeState', specId, sessionId],

    pendingExchange: (specId, sessionId) =>
      ['session.pendingExchange', specId, sessionId],     # target

    exchanges: (specId, sessionId) =>
      ['session.exchanges', specId, sessionId],           # target
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

Method names follow `src/rpc/README.md`. The TUI-started web sidecar is read-only today: current web code should use query options only. Mutation hook names below describe the expected TanStack Query shape for a future write-capable web/client surface; the current sidecar rejects those RPC methods.

```pseudo
current implemented hooks:
  workspace.state
    workspaceStateQueryOptions(rpc)
    query key: ['workspace.state']
    route loader: root and spec routes

  session.runtimeState
    sessionRuntimeStateQueryOptions(rpc, target)
    query key: ['session.runtimeState', specId, sessionId]
    route status: query option exists; panel not yet rendered

  graph.overview
    graphOverviewQueryOptions(rpc, specId)
    query key: ['graph.overview', specId]
    route loader: spec route

  graph.nodeNeighborhood
    graphNodeNeighborhoodQueryOptions(rpc, specId, nodeId, hops)
    query key: ['graph.nodeNeighborhood', specId, nodeId, hops]
    route status: query option exists; selection UI not yet wired

  workspace.selectionState
    workspaceSelectionStateQueryOptions(rpc)
    query key: ['workspace.selectionState']
    route status: root route reads picker inventory

planned read hooks:
  rpc.discover
    rpcDiscoveryQueryOptions(rpc)
    Purpose: optional capability/schema introspection for debug panels and adaptive clients.

  session.pendingExchange
    pendingExchangeQueryOptions(rpc, target)
    Purpose: current unresolved structured exchange.

  session.exchanges
    sessionExchangesQueryOptions(rpc, target)
    Purpose: transcript-derived structured exchange history.

planned mutation hooks (not sidecar-accepted today):
  workspace.activate
    activateWorkspaceMutationOptions(rpc)
    On success: invalidate workspace.state, workspace.selectionState, session/graph keys for selected resources.

  session.triggerExchange
    triggerExchangeMutationOptions(rpc)
    On success: invalidate session.pendingExchange, session.exchanges, and session.runtimeState.

  session.submitExchangeResponse
    submitExchangeResponseMutationOptions(rpc)
    On success: invalidate session.pendingExchange, session.exchanges, session.runtimeState; review-set approval also publishes graph.overview / graph.nodeNeighborhood topics for the transcript-bound spec.

reserved future method:
  session.submitMessage
    submitMessageMutationOptions(rpc)
    Must not silently answer a pending exchange.

future graph projections:
  graph.recentChanges / graph.changesSince
    graphRecentChangesQueryOptions(rpc, specId, sinceLsn)

  graph.coherenceSummary
    graphCoherenceSummaryQueryOptions(rpc, specId)
```

## Subscription / notification bridge

Current proof code listens for `brunch.updated` and invalidates broad keys. Target shape:

```pseudo
useBrunchUpdateInvalidation(rpc, queryClient)
  subscribe to server notifications once at app/root level

  for each notification:
    if topic == workspace.state:
      invalidate queryKeys.workspace.state

    if topic == workspace.selectionState:
      invalidate queryKeys.workspace.selectionState

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
    workspace.state
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
    graph projections update only after agent-internal mutateGraph succeeds
```

The browser does not call `mutateGraph` directly, does not submit node/edge drafts in `propose-graph`, and does not treat proposal prose as graph truth.

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
