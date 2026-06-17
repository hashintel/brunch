# Brunch public RPC

This directory owns Brunch's public JSON-RPC boundary. This README is the findable naming contract for RPC methods that product clients and designers should reason about. `memory/SPEC.md` records the architectural decision; this file names the concrete surface implemented by `rpc/`.

## Boundary

Brunch exposes three handler surfaces over stdio, WebSocket, and in-process handlers:

```pseudo
rpc handler surfaces:
├── full RPC host
│   ├── read methods
│   └── workspace/session transcript writes
├── read-only RPC registry
│   └── read methods only
└── TUI-started web sidecar
    ├── /rpc observer connections: read methods only
    └── /rpc/driver connection: read methods + live-session driver methods when handles exist
```

The full CLI/RPC host includes mutation-capable workspace/session methods. The TUI-started web sidecar is an attachment to the TUI-hosted process: ordinary `/rpc` observer connections expose projection/read methods plus `rpc.discover` and reject workspace/session write methods as `Method not found`. The explicitly designated `/rpc/driver` connection adds live driver methods only when their process-local handles are attached (`session.driveTurn` for a live `AgentSession`, `session.answerExchange` for a live exchange broker). Browser clients, CLI probes, TUI adapters, and future relays speak Brunch method names; they do not coordinate raw Pi RPC plus Brunch product RPC themselves.

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

RPC handlers must not become a generic records API, REST read model, or canonical view store. Reads are named projections over the store that owns the fact. The current graph read subset is deliberately limited to `graph.overview` and `graph.nodeNeighborhood`; `src/graph/README.md` owns the observed-shape ledger and decides which graph-owned shapes are required, deferred, or not applicable per consumer. Mutations route through the owning product seam: session transcript operations through `session.*`, synchronous high-confidence response capture through `session.submitExchangeResponse` → `graph/capture` → `CommandExecutor`, review-set approval through `session.submitExchangeResponse` → `CommandExecutor.acceptReviewSet`, and other graph mutations through the agent/tool or `CommandExecutor` path that owns them. `dev.*` is the only exception family: methods in that namespace are explicitly gated local harnesses, absent from default discovery and absent from the read-only sidecar.

## Method registry

Method discovery and dispatch come from the same registry. A method not present in a surface registry is not discoverable and is rejected as `Method not found` on that surface.

```pseudo
rpc/
├── handlers.ts
│   ├── createRpcHandlers(...)            -> default full registry
│   ├── createRpcHandlers({devRpc})       -> full registry plus gated dev.* harnesses
│   ├── createReadOnlyRpcHandlers(...)    -> read-only registry, never dev.*
│   ├── createWebSidecarRpcHandlers(...)  -> driver registry; live methods only with handles
│   └── rpc.discover                      -> discovery over active registry
└── methods/
    ├── registry.ts                    -> method definition + discovery shape
    ├── workspace.ts                   -> workspace.* handlers
    ├── session.ts                     -> session.* handlers
    ├── session-driver.ts              -> live AgentSession driver method
    ├── session-exchange-answer.ts     -> live exchange answer method
    ├── graph.ts                       -> graph.* handlers
    ├── dev-graph.ts                   -> gated dev.graph.* fixture-curation harness
    └── schemas.ts                     -> shared protocol schemas
```

## Current method surface

```pseudo
full RPC host:
  reads:
    rpc.discover
    workspace.state
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
    session.submitMessage

dev-enabled full RPC host only:
  writes:
    dev.graph.mutateGraph
  absent unless:
    createRpcHandlers({devRpc: true}) or BRUNCH_DEV=1 in CLI rpc mode
  still absent from:
    default full RPC discovery
    TUI-started web sidecar

TUI-started web sidecar without live driver handle:
  reads:
    rpc.discover
    workspace.state
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
    session.submitMessage
    session.driveTurn

TUI-started web sidecar observer connection (/rpc), even when live driver handles exist:
  reads:
    rpc.discover
    workspace.state
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
    session.submitMessage
    session.driveTurn
    session.answerExchange

TUI-started web sidecar driver connection (/rpc/driver) with live driver handles:
  reads:
    rpc.discover
    workspace.state
    workspace.selectionState
    session.pendingExchange
    session.exchanges
    session.runtimeState
    graph.overview
    graph.nodeNeighborhood
  live-session drivers:
    session.driveTurn
    session.answerExchange
  rejected as method-not-found:
    workspace.activate
    session.triggerExchange
    session.submitExchangeResponse
    session.submitMessage
```

## Method overview

```pseudo
rpc.discover
  access: read
  params: none
  result: supported methods with descriptions, schemas, and examples
  source: active method registry

workspace.state
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
  result: workspace state or cancelled activation state
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
  result: pending exchange (assistant-created) or idle
  effects: kick surface (D49-L/D78-L revised 2026-06-12) — seeds origination context for the selected session and reports pending-exchange state; the product mints no deterministic exchange, so transports without a live agent session legitimately receive idle; publishes selected-session invalidations

session.submitExchangeResponse
  access: write
  params:
    exchangeId
    answer: {text} | {optionId} | {optionIds} | {review:{decision, comment?}}
    note?
  result: accepted terminal response plus capture/review outcome
    capture:
      captured(lsn, nodeCount, createdNodes)
      | no_capture(reason)
      | structural_illegal(diagnostics)
    review:
      approved(lsn, createdNodes)
      | request_changes
      | rejected
      | structural_illegal(diagnostics)
  effects: appends request_* toolResult response, publishes selected-session invalidations, and when captured or approved publishes graph.overview / graph.nodeNeighborhood invalidations for the transcript-bound spec

session.submitMessage
  access: write
  params:
    text
    interruption?
  result: accepted ordinary user message plus capture outcome
    capture:
      captured(lsn, nodeCount, createdNodes)
      | no_capture(reason)
      | structural_illegal(diagnostics)
  effects: appends a user message to the selected session transcript, rejects ordinary text while a structured exchange is pending unless interruption=true, and when captured publishes graph.overview / graph.nodeNeighborhood invalidations for the transcript-bound spec

session.driveTurn
  access: write (TUI-started web sidecar only, discovered only when a driver handle is attached)
  params: {prompt}
  result: {status: completed}
  errors: -32601 when no driver handle is attached; -32010 when an attached handle reports no current live session
  effects: re-enters the live in-process AgentSession with one plain prompt; resulting AgentSessionEvents stream as brunch.sessionEvent frames and reduce to Pi JSONL transcript truth
  boundary: not a generic transcript write API; no workspace activation, no submitMessage, no concurrency arbiter

session.answerExchange
  access: write (TUI-started web sidecar only, discovered only when a live-exchange answer broker handle is attached)
  params: {exchangeId, answer}
  result: {status: completed}
  errors: -32601 when no broker handle is attached; -32008 when no matching live exchange is pending
  effects: resolves the in-process request_answer promise; Pi then appends the provider-legal tool result and continues the same live turn, whose AgentSessionEvents stream as brunch.sessionEvent frames and reduce to Pi JSONL transcript truth
  boundary: not a transcript append API and not a second exchange store; request_choice/request_choices/request_review and terminal-vs-web answer racing are separate follow-ons

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

dev.graph.mutateGraph
  access: write
  params:
    specId
    createBasis?: explicit | implicit
    ops:
      - {op: create_node, ref, plane, kind, title, body?, source?, detail?}
      - {op: create_edge, category, <role-named-endpoints>, stance?, rationale?}
        role-named endpoints: batch ref | {existingCode}
      - {op: patch_node, node: {existingCode}, patch}
      - {op: patch_edge, edgeId, patch}
      - {op: delete_edge, edgeId}
      - {op: delete_node, node: {existingCode}, deleteIncidentEdges?}
  result: success(lsn, createdNodes, createdEdges, updatedNodes, updatedEdges, deletedNodes, deletedEdges) | structural_illegal(diagnostics)
  effects: resolves projected node codes / selected-spec edge ids at the boundary, commits atomically through `CommandExecutor.mutateGraph`, and publishes graph projection invalidations
  gate: explicit local harness only; absent from default public RPC and read-only sidecars
  caveat: local curation harness only; product-path proof still comes from transcript-backed `mutate_graph` tool runs
```

## Product update notifications

`brunch.updated` is a JSON-RPC notification, not a request/response method. It carries process-local invalidation hints only; clients refetch canonical projections through named RPC methods.

```pseudo
brunch.updated:
  params:
    topics:
      - workspace.state
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

The TUI-started web sidecar also multiplexes live session-stream frames on the same `/rpc` WebSocket when a live in-process `AgentSession` exists:

```pseudo
brunch.sessionEvent:
  params:
    seq: monotonic process-local sequence number
    event: Pi AgentSessionEvent payload carried verbatim
```

`brunch.sessionEvent` is a process-local observer notification, not a request method and not a persisted transcript projection. `src/rpc/session-event-relay.ts` owns the ephemeral relay seam: `runBrunchTui` creates one relay, the sidecar transport subscribes to it, and `createBrunchAgentSessionRuntimeFactory` attaches the live `AgentSession` after Pi creates it. Browser clients may render incremental session state from these frames, but canonical transcript truth remains the Pi JSONL session file and named `session.*` projections.

## Streaming transport coverage

Code-anchored coverage ledger for the topology-A streaming relay layer (`session-event-relay.ts` plus the `websocket.ts` multiplex). It maps each oracle-battery claim to the relay capability it exercises and the closure oracle that proves it. **Sequencing and status authority is `memory/PLAN.md` §web-driver-streaming**; this ledger is the code-side "what proves this" view, reconciled by `/ln-sync`.

Boundary — in layer: the streaming transport relay and its battery. Out of layer: the web render consumer (`src/web/`), the canonical `session.*` projections, and `brunch.updated` invalidation semantics. DoD: every `●` row `built`.

| # | Capability | Status | Req | Closure oracle | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Topology-A walking skeleton through the real host entry | `built` | ● | `src/dev/__tests__/web-driver-streaming.relay.test.ts` | I22-L: attaches via product factory, not the test |
| 2 | Stream↔transcript differential (assembled `message_update` deltas == flushed JSONL) | `built` | ● | same test | D19-L linchpin |
| 3 | Ordered incremental delivery (monotonic `seq`, no gaps/dupes) | `built` | ● | same test | |
| 4 | Domain-projection multiplex (one WS carries `brunch.sessionEvent` + `brunch.updated`) | `built` | ● | same test | deferred-in-order while a request is in flight |
| 6 | Reconnect/resume idempotence | `built` | ● | `src/dev/__tests__/web-driver-streaming.reconnect.test.ts` | observer-side, replay-less: reconnect refetches `session.*` projections and resumes later live frames |
| 7 | One-driver / many-observer fan-out | `built` | ● | `src/dev/__tests__/web-driver-streaming.fan-out.test.ts` | observer-side, autonomous; three concurrent observers receive byte-identical streams and read-only sidecar writes reject |
| 5 | Mid-stream exchange convergence (live `request_answer` answered leg) | `built` | ● | `src/dev/__tests__/web-driver-streaming.exchange-convergence.test.ts` | answer broker resolves the live request_answer promise through `session.answerExchange`; discovery may use the relayed `request_answer` frame when same-turn tool batching has not flushed a transcript-backed pending projection yet; post-answer `session.pendingExchange` is idle and JSONL carries the provider-legal answer |
| — | command-intake slice 1 (web drives a plain turn) | `built` | ● | `src/dev/__tests__/web-driver-streaming.command-intake.test.ts` | narrow `session.driveTurn` sidecar method re-enters the live AgentSession |
| — | render feel (token / tool / dialog) | `n/a` | ○ | manual walkthrough | outer-loop only; no automated perceptual gate |

Classification: the required topology-A streaming rows are built for the current `request_answer` tracer. The UI-host finding (`ctx.hasUI` is run-mode-bound; not injectable on a bare in-process `AgentSession`) is recorded in `memory/SPEC.md` A28-L/D84-L; the landed answer broker reframes the answer source as Brunch-owned for Brunch-authored `request_*` tools rather than a Pi UI-host injection.

## RPC methods to web Query hooks

Current web code only uses read queries. Write hooks are named here as the expected TanStack Query mutation shape for future write-capable web/client surfaces; today the TUI-started sidecar accepts only `session.driveTurn` and rejects the other write methods.

```pseudo
query key families:
  workspace.state       -> ['workspace.state']
  workspace.selectionState -> ['workspace.selectionState']
  session.pendingExchange  -> ['session.pendingExchange', specId, sessionId]  # target
  session.exchanges        -> ['session.exchanges', specId, sessionId]        # target
  session.runtimeState     -> ['session.runtimeState', specId, sessionId]
  graph.overview           -> ['graph.overview', specId]
  graph.nodeNeighborhood   -> ['graph.nodeNeighborhood', specId, nodeId, hops]
```

| RPC method | Web Query/Mutation mapping | Current web status | Invalidation source |
| --- | --- | --- | --- |
| `rpc.discover` | `rpcDiscoveryQueryOptions(rpc)` | not implemented; optional debug/adaptive UI only | none |
| `workspace.state` | `workspaceStateQueryOptions(rpc)` | implemented; root/spec loaders prime it | exact `workspace.state` |
| `workspace.selectionState` | `workspaceSelectionStateQueryOptions(rpc)` | implemented; root route reads picker inventory | exact `workspace.selectionState` or activation success |
| `workspace.activate` | `activateWorkspaceMutationOptions(rpc)` | target full-host mutation; sidecar rejects | invalidates workspace + selected session resources |
| `session.pendingExchange` | `pendingExchangeQueryOptions(rpc, target)` | target; no current web panel | `session.pendingExchange` |
| `session.exchanges` | `sessionExchangesQueryOptions(rpc, target)` | target; no current web history panel | `session.exchanges` |
| `session.runtimeState` | `sessionRuntimeStateQueryOptions(rpc, target)` | implemented query option; not yet route-rendered | `session.runtimeState` |
| `session.triggerExchange` | `triggerExchangeMutationOptions(rpc)` | target full-host mutation; sidecar rejects | invalidates pending/exchanges/runtime state |
| `session.submitExchangeResponse` | `submitExchangeResponseMutationOptions(rpc)` | target full-host mutation; sidecar rejects | invalidates pending/exchanges/runtime state; captured text answers additionally invalidate `graph.overview(specId)` / `graph.nodeNeighborhood(specId)` |
| `session.driveTurn` | `driveTurnMutationOptions(rpc)` | target; driver-attached sidecar accepted, web UI not wired | live `brunch.sessionEvent` stream; transcript projection refetch via existing session queries if needed |
| `session.answerExchange` | `answerExchangeMutationOptions(rpc)` | target; broker-attached sidecar accepted for `request_answer`, web UI not wired | live `brunch.sessionEvent` stream; transcript projection refetch via existing session queries if needed |
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
  -> CommandExecutor.mutateGraph({createBasis: explicit, ops})
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
  session.submitMessage may append ordinary user text or an explicit interruption
```

## `propose-graph` flow

In `propose-graph`, the browser does not submit graph nodes or edges and does not call `mutateGraph` directly.

```pseudo
session.triggerExchange
  -> agent presents a concept proposal as a structured exchange

session.pendingExchange
  -> web reads proposal/rubric/choice surface

session.submitExchangeResponse
  -> user chooses accept_concept | request_revision | reject
     with optional comment

agent continues after acceptance
  -> agent calls mutateGraph({ createBasis, ops }) internally
  -> CommandExecutor validates and commits atomically
  -> graph projections update
  -> future graph.coherenceSummary updates only after coherence semantics are defined
```

The user reviews the concept-level proposal. The graph becomes product truth only after the internal `mutateGraph` path succeeds.

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
graph.changesSince / graph.recentChanges
  future graph update projection

graph.coherenceSummary
  future graph-adjacent coherence projection after durable semantics are modeled
```
