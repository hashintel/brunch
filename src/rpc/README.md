# Brunch public RPC

This directory owns Brunch's public JSON-RPC boundary. This README is the findable naming contract for RPC methods that product clients and designers should reason about. `memory/SPEC.md` records the architectural decision; this file names the concrete surface.

## Boundary

Brunch exposes one product RPC surface over stdio, WebSocket, and in-process handlers. Browser clients, CLI probes, TUI adapters, and future relays speak Brunch method names; they do not coordinate raw Pi RPC plus Brunch product RPC themselves.

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

RPC handlers must not become a generic records API, REST read model, or canonical view store. Reads are named projections over the store that owns the fact. Mutations route through the owning product seam: session transcript operations through `session.*`, graph mutations through the agent/tool or `CommandExecutor` path that owns them.

## Product update notifications

`brunch.updated` is a JSON-RPC notification, not a request/response method. It carries process-local invalidation hints only; clients refetch canonical projections through named RPC methods.

```pseudo
brunch.updated:
  params:
    topics:
      - graph.overview
      - graph.nodeNeighborhood
      - workspace.snapshot
      - session.pendingExchange
      - session.elicitationExchanges
      - session.transcriptDisplay
    updates:
      - {topic, specId?, sessionId?, nodeId?, lsn?}
```

WebSocket and stdio transports both carry these notifications independently from request responses. The notification payload is owned by `rpc/`; graph and session mutation adapters receive only a narrow product-update publisher.

## Product method vocabulary

Use these names in product design, SPEC text, and new public handlers:

```pseudo
rpc.discover
  Returns supported Brunch methods, schemas, and examples.

workspace.snapshot
  Returns cwd-scoped workspace product state:
    project
    posture
    current/default spec/session
    activation/chrome state

workspace.selectionState
  Returns boot/picker inventory and whether explicit spec/session activation is required.

workspace.activate
  Applies an explicit workspace -> spec -> session decision.

session.promptExchange
  Starts, resumes, or advances the assistant-first session loop until one of:
    pending structured exchange
    idle/completed state
    needs_human blocker
    policy/authority blocker

session.pendingExchange
  Reads the current unresolved structured exchange without advancing the agent loop.

session.submitExchangeResponse
  Submits the terminal response for one pending structured exchange.
  The payload is generic over request_* variants:
    request_answer
    request_choice
    request_choices
    request_review
    future request_* tools

session.submitMessage
  Submits ordinary non-exchange user text or an explicit interruption.
  It is not a structured exchange answer.

session.exchanges
  Projects structured exchange history from transcript truth.

graph.overview
  Returns the canonical selected-spec graph overview for explicit `{specId}`:
    nodes
    edges
    nodeCount
    edgeCount
    lsn

graph.nodeNeighborhood
  Returns a focused same-spec graph read for explicit `{specId,nodeId,hops?}`:
    success with anchor/neighbors/edges
    not_found when the node is absent from that spec

future graph projection methods
  graph.changesSince / graph.recentChanges
future graph-adjacent coherence projection method
  graph.coherenceSummary
```

## Names to avoid

These names are proof-era, stale, or too narrow for the stable product contract:

```pseudo
session.startElicitation
  too mode/lifecycle specific; use session.promptExchange

elicitation.respond
  too mode-specific and too narrow; use session.submitExchangeResponse

session.elicitationExchanges
  too mode-specific; use session.exchanges

session.transcriptDisplay
  render/debug concern, not a core web-product state API

command.*
  not a web UI primitive for propose-graph; command execution is an internal authority seam
```

Existing code may still expose some proof-era names from the deterministic public-RPC parity slice. Treat those as rename debt, not as product vocabulary for new work.

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
```

Payload facets such as establishment offers, elicitor intent hints, and review/proposal material belong inside structured exchange payloads when they are part of an exchange. They are not separate public RPC entities.

## Web UI rules

```pseudo
if session.pendingExchange returns pending:
  render the structured exchange form
  submit via session.submitExchangeResponse
  do not also treat freeform text as ambient chat

if no exchange is pending:
  session.promptExchange may ask the agent for the next exchange
  session.submitMessage may append ordinary user text or an explicit interruption
```

`session.submitMessage` must not silently answer a pending exchange. If interruption is allowed, it should be explicit in the payload and transcript-visible.

## `propose-graph` flow

In `propose-graph`, the browser does not submit graph nodes or edges and does not call `commitGraph` directly.

```pseudo
session.promptExchange
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
