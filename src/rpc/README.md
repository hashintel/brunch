# Brunch public RPC

This directory owns Brunch's public JSON-RPC boundary. This README is the findable naming contract for RPC methods that product clients and designers should reason about. `memory/SPEC.md` records the architectural decision; this file names the concrete surface implemented by `rpc/`.

## Boundary

Brunch exposes two handler surfaces over stdio, WebSocket, and in-process handlers:

```pseudo
rpc handler surfaces:
├── full RPC host
│   ├── read methods
│   └── write methods
└── TUI-started web sidecar
    └── read methods only
```

The full CLI/RPC host includes mutation-capable workspace/session methods. The TUI-started web sidecar is a read attachment: it exposes projection/read methods plus `rpc.discover`, and rejects write methods as `Method not found`. Browser clients, CLI probes, TUI adapters, and future relays speak Brunch method names; they do not coordinate raw Pi RPC plus Brunch product RPC themselves.

RPC handlers project from canonical stores:

```pseudo
canonical stores:
  .brunch/workspace.json
    project
    posture
    current/default spec/session acceleration

  SQLite graph DB
    specs
    nodes
    edges
    change_log
    reconciliation_needs

  deferred graph-adjacent store
    coherence_state
      not yet defined; do not expose a durable coherence contract until modeled

  Pi JSONL transcript
    session_binding
    agent_runtime_state
    structured_exchange toolResult tuples
    worldUpdate entries
```

RPC handlers must not become a generic records API, REST read model, or canonical view store. Reads are named projections over the store that owns the fact. Mutations route through the owning product seam: session transcript operations through `session.*`, synchronous high-confidence response capture through `session.submitExchangeResponse` → `graph/capture` → `CommandExecutor`, and other graph mutations through the agent/tool or `CommandExecutor` path that owns them. `dev.*` is the only exception family: methods in that namespace are explicitly gated local harnesses, absent from default discovery and absent from the read-only sidecar.

## Method registry

Method discovery and dispatch come from the same registry. A method not present in a surface registry is not discoverable and is rejected as `Method not found` on that surface.

```pseudo
rpc/
├── handlers.ts
│   ├── createRpcHandlers(...)         -> default full registry
│   ├── createRpcHandlers({devRpc})    -> full registry plus gated dev.* harnesses
│   ├── createReadOnlyRpcHandlers(...) -> read-only registry, never dev.*
│   └── rpc.discover                   -> discovery over active registry
└── methods/
    ├── registry.ts                    -> method definition + discovery shape
    ├── workspace.ts                   -> workspace.* handlers
    ├── session.ts                     -> session.* handlers
    ├── graph.ts                       -> graph.* handlers
    ├── dev-graph.ts                   -> gated dev.graph.* fixture-curation harness
    └── schemas.ts                     -> shared protocol schemas
```

## Current method surface

```pseudo
full RPC host:
  reads:
    rpc.discover
    workspace.snapshot
    workspace.selectionState
    session.pendingExchange
    session.exchanges
    session.runtimeState
    graph.overview
    graph.nodeNeighborhood
  writes:
    workspace.activate
    session.triggerExchange
    session.submitExchangeResponse

dev-enabled full RPC host only:
  writes:
    dev.graph.commitGraph
  absent unless:
    createRpcHandlers({devRpc: true}) or BRUNCH_DEV_RPC=1 in CLI rpc mode
  still absent from:
    default full RPC discovery
    TUI-started web sidecar

TUI-started web sidecar:
  reads:
    rpc.discover
    workspace.snapshot
    workspace.selectionState
    session.pendingExchange
    session.exchanges
    session.runtimeState
    graph.overview
    graph.nodeNeighborhood
  rejected as method-not-found:
    workspace.activate
    session.triggerExchange
    session.submitExchangeResponse
```

## Method overview

```pseudo
rpc.discover
  access: read
  params: none
  result: supported methods with descriptions, schemas, and examples
  source: active method registry

workspace.snapshot
  access: read
  params: none
  result: cwd-scoped workspace product state
    project
    posture
    current/default spec/session
    activation/chrome state
  source: WorkspaceSessionCoordinator + .brunch/workspace.json + DB-backed spec inventory

workspace.selectionState
  access: read
  params: none
  result: spec/session picker inventory and requiresSelection flag
  source: WorkspaceSessionCoordinator inspection

workspace.activate
  access: write
  params: {decision}
    continue | openSession | newSession | newSpec | cancel
  result: workspace snapshot or cancelled activation state
  effects: creates/opens selected spec/session and publishes selected-session invalidations

session.pendingExchange
  access: read
  params: {sessionId, specId?} or omitted selected session
  result: current unresolved structured exchange, or idle
  source: linear Pi JSONL transcript projection

session.exchanges
  access: read
  params: {sessionId, specId?} or omitted selected session
  result: structured exchange history
  source: linear Pi JSONL transcript projection

session.runtimeState
  access: read
  params: {sessionId, specId}
  result: transcript-backed runtime posture, mention slots, world watermarks (latest graph LSN and git head, no raw detail bags), lifecycle slots
  source: linear Pi JSONL transcript projection

session.triggerExchange
  access: write
  params: none
  result: pending exchange
  effects: starts/resumes/advances the assistant-first exchange loop and publishes selected-session invalidations

session.submitExchangeResponse
  access: write
  params:
    exchangeId
    answer: {text} | {optionId} | {optionIds}
    note?
  result: accepted terminal response plus capture outcome
    capture:
      captured(lsn, nodeCount, createdNodes)
      | no_capture(reason)
      | structural_illegal(diagnostics)
  effects: appends request_* toolResult response, publishes selected-session invalidations, and when captured publishes graph.overview / graph.nodeNeighborhood invalidations for the transcript-bound spec

graph.overview
  access: read
  params: {specId}
  result: selected-spec graph overview
    nodes
    edges
    nodeCount
    edgeCount
    lsn
  source: SQLite graph reader for the explicit spec

graph.nodeNeighborhood
  access: read
  params: {specId, nodeId, hops?}
  result: success(anchor, neighbors, edges) | not_found
  source: SQLite graph reader for the explicit spec

dev.graph.commitGraph
  access: write
  params:
    specId
    basis: explicit | implicit
    nodes: [{ref, plane, kind, title, body?, source?, detail?}]
    edges: [{category, source, target, stance?, rationale?}]
      source/target: batch ref | {existingCode}
  result: success(lsn, createdNodes, edges) | structural_illegal(diagnostics)
  effects: commits atomically through CommandExecutor and publishes graph projection invalidations
  gate: explicit local harness only; absent from default public RPC and read-only sidecars
  caveat: fixture curation helper, not evidence that propose-graph's real agent commit_graph tool path works
```

## Product update notifications

`brunch.updated` is a JSON-RPC notification, not a request/response method. It carries process-local invalidation hints only; clients refetch canonical projections through named RPC methods.

```pseudo
brunch.updated:
  params:
    topics:
      - workspace.snapshot
      - workspace.selectionState
      - session.pendingExchange
      - session.exchanges
      - session.runtimeState
      - graph.overview
      - graph.nodeNeighborhood
    updates:
      - {topic, specId?, sessionId?, nodeId?, lsn?}
```

WebSocket and stdio transports both carry these notifications independently from request responses. The notification payload is owned by `rpc/`; graph and session mutation adapters receive only a narrow product-update publisher.

## RPC methods to web Query hooks

Current web code only uses the read sidecar. Write hooks are named here as the expected TanStack Query mutation shape for a future write-capable web/client surface; they are not accepted by the TUI-started sidecar today.

```pseudo
query key families:
  workspace.snapshot       -> ['workspace.snapshot']
  workspace.selectionState -> ['workspace.selectionState']        # target, not yet implemented in web queryKeys
  session.pendingExchange  -> ['session.pendingExchange', specId, sessionId]  # target
  session.exchanges        -> ['session.exchanges', specId, sessionId]        # target
  session.runtimeState     -> ['session.runtimeState', specId, sessionId]
  graph.overview           -> ['graph.overview', specId]
  graph.nodeNeighborhood   -> ['graph.nodeNeighborhood', specId, nodeId, hops]
```

| RPC method | Web Query/Mutation mapping | Current web status | Invalidation source |
| --- | --- | --- | --- |
| `rpc.discover` | `rpcDiscoveryQueryOptions(rpc)` | not implemented; optional debug/adaptive UI only | none |
| `workspace.snapshot` | `workspaceSnapshotQueryOptions(rpc)` | implemented; root/spec loaders prime it | exact `workspace.snapshot` |
| `workspace.selectionState` | `workspaceSelectionStateQueryOptions(rpc)` | target; picker route not built | `workspace.selectionState` or activation success |
| `workspace.activate` | `activateWorkspaceMutationOptions(rpc)` | target full-host mutation; sidecar rejects | invalidates workspace + selected session resources |
| `session.pendingExchange` | `pendingExchangeQueryOptions(rpc, target)` | target; no current web panel | `session.pendingExchange` |
| `session.exchanges` | `sessionExchangesQueryOptions(rpc, target)` | target; no current web history panel | `session.exchanges` |
| `session.runtimeState` | `sessionRuntimeStateQueryOptions(rpc, target)` | implemented query option; not yet route-rendered | `session.runtimeState` |
| `session.triggerExchange` | `triggerExchangeMutationOptions(rpc)` | target full-host mutation; sidecar rejects | invalidates pending/exchanges/runtime state |
| `session.submitExchangeResponse` | `submitExchangeResponseMutationOptions(rpc)` | target full-host mutation; sidecar rejects | invalidates pending/exchanges/runtime state; captured text answers additionally invalidate `graph.overview(specId)` / `graph.nodeNeighborhood(specId)` |
| `graph.overview` | `graphOverviewQueryOptions(rpc, specId)` | implemented; spec route loader primes it | exact `graph.overview(specId)` when `specId` is present |
| `graph.nodeNeighborhood` | `graphNodeNeighborhoodQueryOptions(rpc, specId, nodeId, hops?)` | implemented query option; graph panel selection not yet wired | exact/prefix neighborhood invalidation when `nodeId` is present; broad topic fallback otherwise |

Route/use pattern:

```pseudo
route loader
  -> queryClient.ensureQueryData(queryOptionsFrom(web/queries/*))

route/component
  -> useSuspenseQuery(same query options) for required projections
  -> useQuery(enabled: target != null) for optional panels

root subscription
  -> useBrunchUpdateSubscription(queryClient, rpcClient)
  -> brunch.updated invalidates method-shaped Query keys
```

## Structured exchange lifecycle

A structured exchange is transcript-native. Its durable semantic content lives in Pi JSONL `toolResult` tuples, not in UI local state.

```pseudo
present_* toolResult
  assistant-side display and recovery payload:
    exchange id
    display markdown/data
    strategy/lens metadata when applicable
    preface/proposal/rubric/offer material when applicable
    expected request_* tool

request_* toolResult
  terminal user-side response:
    answered | cancelled | unavailable
    selected choice(s) or freeform answer
    optional user-authored comment
    runtime-authored message for cancellation/unavailable states

capture_* toolResult (future)
  assistant analysis only:
    transcript evidence
    possible semantic candidates
    no graph mutation

synchronous response capture (current POC tracer)
  request_answer text with direct labels:
    Goal: ...
    Context: ...
    Constraint: ...
    Criterion: ...
  -> graph/capture translator
  -> CommandExecutor.commitGraph({basis: explicit})
  -> selected-spec graph truth

```
Payload facets such as establishment offers, elicitor intent hints, and review/proposal material belong inside structured exchange payloads when they are part of an exchange. They are not separate public RPC entities.

## Web UI rules

```pseudo
if session.pendingExchange returns pending:
  render the structured exchange form
  submit via session.submitExchangeResponse
  do not also treat freeform text as ambient chat

if no exchange is pending:
  session.triggerExchange may ask the agent for the next exchange
  future session.submitMessage may append ordinary user text or an explicit interruption
```

`session.submitMessage` is reserved for a future real method. It is not exposed in current discovery. When implemented, it must not silently answer a pending exchange; interruptions should be explicit in the payload and transcript-visible.

## `propose-graph` flow

In `propose-graph`, the browser does not submit graph nodes or edges and does not call `commitGraph` directly.

```pseudo
session.triggerExchange
  -> agent presents a concept proposal as a structured exchange

session.pendingExchange
  -> web reads proposal/rubric/choice surface

session.submitExchangeResponse
  -> user chooses accept_concept | request_revision | reject
     with optional comment

agent continues after acceptance
  -> agent calls commitGraph({ nodes, edges }) internally
  -> CommandExecutor validates and commits atomically
  -> graph projections update
  -> future graph.coherenceSummary updates only after coherence semantics are defined
```

The user reviews the concept-level proposal. The graph becomes product truth only after the internal `commitGraph` path succeeds.

## Names absent from current public RPC

These names are not compatibility aliases and must not be reintroduced in product code:

```pseudo
session.startElicitation        -> retired proof-era name for session.triggerExchange
elicitation.respond             -> retired non-session family for session.submitExchangeResponse
session.elicitationExchanges    -> retired proof-era name for session.exchanges
session.transcriptDisplay       -> removed render/debug projection; not a web product API
command.*                       -> internal authority seam, not a browser RPC primitive
```

Reserved future names:

```pseudo
session.submitMessage
  ordinary non-exchange user text or explicit interruption; absent until real behavior is scoped

graph.changesSince / graph.recentChanges
  future graph update projection

graph.coherenceSummary
  future graph-adjacent coherence projection after durable semantics are modeled
```
