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
├── TUI-started web sidecar
│   ├── /rpc observer connections: read methods only
│   ├── /rpc/driver connection: read methods + live-session driver methods when handles exist
│   └── /petrinaut/stream: artifact replay followed by same-process live journal wake-ups
└── standalone web combined host
    └── /rpc: target-required session.open/close/presentation/openAsks/driveTurn/answerExchange
```

The full CLI/RPC host includes mutation-capable workspace/session methods. The TUI-started web sidecar is an attachment to the TUI-hosted process: ordinary `/rpc` observer connections expose projection/read methods plus `rpc.discover` and reject workspace/session write methods as `Method not found`. The explicitly designated `/rpc/driver` connection adds live driver methods only when their process-local handles are attached (`session.driveTurn` for a live `AgentSession`, `session.answerExchange` for a live exchange broker, `session.openAsks` — a read — for the live ask registry). Browser clients, CLI probes, TUI adapters, and future relays speak Brunch method names; they do not coordinate raw Pi RPC plus Brunch product RPC themselves.

`session.submitExchangeResponse` (this directory) and `session.answerExchange` (the `/rpc/driver` leg above) are two structurally distinct paths, not variants of one mechanism — the former never touches Pi's `ctx.ui.*`/tool-execution layer at all; the latter answers a genuinely live tool call through the process-local broker when no local TUI is bound. See [`docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`](../../docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md) for the full mechanism and per-response-kind coverage.

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

RPC handlers must not become a generic records API, REST read model, or canonical view store. Reads are named projections over the store that owns the fact. The current graph read subset is deliberately limited to `graph.overview` and `graph.nodeNeighborhood`; `src/graph/TOPOLOGY.md` owns the observed-shape ledger and decides which graph-owned shapes are required, deferred, or not applicable per consumer. Mutations route through the owning product seam: session transcript operations through `session.*`, review-set approval through `session.submitExchangeResponse` → the shared session review-set settlement operation → `CommandExecutor.acceptReviewSet`, and other graph mutations through the agent/tool or `CommandExecutor` path that owns them. High-confidence capture is elicitor turn-boundary sweep conduct (D80-L), not a submit-path mutation. Local fixture curation now lives outside public RPC on the explicit dev CLI (`npm run dev-cli -- mutate ...`).

## Method registry

Method discovery and dispatch come from the same registry. A method not present in a surface registry is not discoverable and is rejected as `Method not found` on that surface.

```pseudo
rpc/
├── handlers.ts
│   ├── createRpcHandlers(...)            -> default full registry
│   ├── createReadOnlyRpcHandlers(...)    -> read-only registry
│   ├── createWebSidecarRpcHandlers(...)  -> TUI-sidecar driver registry; live methods only with handles
│   ├── createHostedSessionRpcHandlers(...) -> standalone target-addressed session registry
│   └── rpc.discover                      -> discovery over active registry
└── methods/
    ├── registry.ts                    -> method definition + discovery shape
    ├── workspace.ts                   -> workspace.* handlers
    ├── session.ts                     -> session.* handlers
    ├── session-driver.ts              -> live AgentSession driver method
    ├── session-exchange-answer.ts     -> live exchange answer method
    ├── graph.ts                       -> graph.* handlers
    ├── execute.ts                     -> execute.* run observers plus guarded replan recommendation/regeneration/supersession/abandonment
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
    execute.runs
    execute.run
    execute.runTraceIndex
    execute.replanRecommendation
  writes:
    workspace.activate
    session.triggerExchange
    session.submitExchangeResponse
    session.submitMessage
    execute.replanRegeneratePlan
    execute.replanStartNewRun
    execute.replanAbandonRun

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
    execute.runs
    execute.run
    execute.runTraceIndex
    execute.replanRecommendation
  rejected as method-not-found:
    workspace.activate
    session.triggerExchange
    session.submitExchangeResponse
    session.submitMessage
    session.driveTurn
    session.openAsks
    execute.replanRegeneratePlan
    execute.replanStartNewRun
    execute.replanAbandonRun

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
    execute.runs
    execute.run
    execute.runTraceIndex
    execute.replanRecommendation
  rejected as method-not-found:
    workspace.activate
    session.triggerExchange
    session.submitExchangeResponse
    session.submitMessage
    session.driveTurn
    session.answerExchange
    session.openAsks
    execute.replanRegeneratePlan
    execute.replanStartNewRun
    execute.replanAbandonRun

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
    execute.runs
    execute.run
    execute.runTraceIndex
    execute.replanRecommendation
  live-session drivers:
    session.driveTurn
    session.answerExchange
  live-session reads (handle-gated):
    session.openAsks
  rejected as method-not-found:
    workspace.activate
    session.triggerExchange
    session.submitExchangeResponse
    session.submitMessage
    execute.replanRegeneratePlan
    execute.replanStartNewRun
    execute.replanAbandonRun

standalone web combined host (/rpc):
  target-required lifecycle:
    session.open
    session.close
  target-required reads:
    session.presentation
    session.openAsks
  target-and-driver-required writes:
    session.driveTurn
    session.answerExchange
```

The standalone surface requires `(specId, sessionId)` on every method; driver operations additionally require `driverId`. It has no selected/current-session fallback and does not reuse the TUI sidecar's `/rpc/driver` handle contract.

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
  source: Pi active-branch transcript projection through `session/active-session-branch.ts` (D24-L/I19-L)

session.exchanges
  access: read
  params: {sessionId, specId?} or omitted selected session
  result: structured exchange history on the active branch; abandoned siblings are history, not current exchange state
  source: Pi active-branch transcript projection through `session/active-session-branch.ts` (D24-L/I19-L)

session.runtimeState
  access: read
  params: {sessionId, specId}
  result: active-branch transcript-backed runtime posture, mention slots, world watermarks (latest graph LSN and git head, no raw detail bags), lifecycle slots
  source: Pi active-branch transcript projection through `session/active-session-branch.ts` (D24-L/I19-L)

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
  result: accepted terminal response plus review-set outcome when the pending review carries graph drafts
    review:
      approved(lsn, createdNodes)
      | request_changes
      | rejected
      | structural_illegal(diagnostics)
  effects: appends an `ask` toolResult carrying preserved request_* details, publishes selected-session invalidations, and on review-set approval invokes the shared session settlement operation before publishing graph.overview / graph.nodeNeighborhood invalidations. Local and RPC approval produce the same durable acceptance semantics: exact translated mutation payload, `accept_review_set` operation, spec-local LSN, and one change-log row. Digest capture is no longer review-shaped: a digest-referencing questionnaire/confirmation terminal carries the runtime-copied accepted abstract.

session.submitMessage
  access: write
  params:
    text
    interruption?
  result: accepted ordinary user message
  effects: appends a user message to the selected session transcript and rejects ordinary text while a structured exchange is pending unless interruption=true (no submit-time capture — capture is elicitor turn-boundary sweep conduct, D80-L)

session.driveTurn
  access: write (TUI sidecar `/rpc/driver` when a driver handle is attached; standalone `/rpc` through the hosted-session registry)
  params: TUI sidecar `{prompt}`; standalone `{specId, sessionId, driverId, prompt}`
  result: {status: completed}
  errors: -32601 on ordinary observers or when no driver handle is attached; -32010 when an attached handle reports no current live session
  effects: re-enters the live in-process AgentSession with one plain prompt; resulting AgentSessionEvents stream as brunch.sessionEvent frames and reduce to Pi JSONL transcript truth
  boundary: not a generic transcript write API; no workspace activation, no submitMessage, no concurrency arbiter

session.answerExchange
  access: write (TUI sidecar `/rpc/driver` when a broker is attached; standalone `/rpc` through the hosted-session registry)
  params: TUI sidecar `{exchangeId, answer}`; standalone `{specId, sessionId, driverId, exchangeId, answer}`
    questionnaire answers use a schema-tagged JSON string envelope checked against the open ask
  result: {status: completed}
  errors: -32601 on ordinary observers or when no broker handle is attached; -32008 when no matching live exchange is pending; -32602 when a questionnaire envelope fails registry validation. Other mode strings are accepted by the rendezvous and decoded by the ask collector, which may return a validation terminal rather than an RPC error.
  effects: resolves the in-process ask answer promise; Pi then appends the provider-legal tool result and continues the same live turn, whose AgentSessionEvents stream as brunch.sessionEvent frames and reduce to Pi JSONL transcript truth
  boundary: not a transcript append API and not a second exchange store; review-set approval converges through the same session settlement operation as local TUI, while terminal-vs-web answer racing remains outside the current single-driver contract

session.openAsks
  access: read (TUI sidecar `/rpc/driver` when a live ask registry reader is attached; standalone `/rpc` through the hosted-session registry)
  params: TUI sidecar none; standalone `{specId, sessionId}`
  result: {openAsks: [{exchangeId, mode, question}]} — every currently-open ask with its full D116-L question payload
  source: the process-local live ask registry (D125-L); no transcript scan
  errors: -32601 on ordinary observers or the full host; -32010 when no registry handle is attached
  boundary: live-state discovery for the agent-as-user driver (D125-L), paired with session.answerExchange; the transcript-backed session.pendingExchange stays the file/observer-facing compatibility projection

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

execute.run
  access: read
  params: {runId}
  result: recorded run snapshot, per-requirement status, artifact-presence flags, reports tail, raw Petri runtime-event tail, normalized worker/verify stream tails, optional derived Petri projection, optional raw Petri net, and optional Petrinaut replay export metadata
  source: .brunch/cook/runs/<runId> read projection; raw artifact paths, Pi event payloads, and subprocess handles do not cross the RPC boundary

execute.runs
  access: read
  params: none
  result: run summaries and artifact-presence flags
  source: .brunch/cook/runs/* metadata projection

execute.runTraceIndex
  access: read
  params: {specId}
  result: graph node code -> run/slice trace entries for requirements and criteria exercised by executor runs
  source: .brunch/cook/runs/* plan/report projections; raw artifact paths do not cross the RPC boundary

execute.replanRecommendation
  access: read
  params: {runId, specId, mode?}
  result: current retry/replan eligibility, recommendation, and allowed actions
  source: durable run state compared with the current graph projection; no run mutation

execute.replanRegeneratePlan
  access: write (full RPC host only)
  params: {runId, specId, mode?}
  result: regenerated plan artifact or a typed refusal
  effects: D128-L admits one canonical {cwd, runId} owner before graph projection and plan write; contention returns run_execution_active

execute.replanStartNewRun
  access: write (full RPC host only)
  params: {previousRunId, specId, runId?, mode?}
  result: linked superseding run or a typed refusal
  effects: run-supersession core owns D128-L admission for both run identities before creating the new run

execute.replanAbandonRun
  access: write (full RPC host only)
  params: {runId, reason?}
  result: abandoned run or a typed refusal
  effects: run-abandon core owns D128-L admission before metadata mutation; durable artifacts are retained
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
      - execute.runs
      - execute.run
      - execute.runTraceIndex
    updates:
      - {topic, specId?, sessionId?, nodeId?, lsn?, runId?, petriProjectionSource?, petriProjectionReplayReason?}
```

WebSocket and stdio transports both carry these notifications independently from request responses. The notification payload is owned by `rpc/`; graph and session mutation adapters receive only a narrow product-update publisher.

`execute.run` updates may carry lightweight live Petri read hints in addition to `runId`: `petriProjectionSource` (`snapshot` or `replay`), `petriProjectionReplayReason` (`snapshot_missing_or_unreadable` or `snapshot_stale`), and ready/blocked frontier hints. Strict `execute.runs` summaries and `execute.run` details both admit ordered `failedSliceIds`; terminal projections retain their journal timestamp and durable failure identity. Petrinaut replay definitions require finite `x`/`y`, arcs require positive integer weights, and firings expose exactly `{transitionId,input,output,ts}` with a TypeBox `date-time` validated timestamp. Complete Petrinaut replay exports do not ride invalidation notifications; clients refetch canonical `execute.run` detail. The executor orchestrate path emits a conservative synchronous `snapshot` hint on per-step completion because the drive observer hook is not awaited, while write-side `execute.replan*` RPC mutations can await `readRunDetail(...)` and publish honest replay/snapshot hints from current read-side truth.

Petrinaut HTTP surfaces are sidecar routes, not JSON-RPC methods. `/petrinaut/stream?runId=<id>` subscribes before reading validated `petrinaut/net.sdcpn.json` + `events.jsonl`, emits the complete replay, catches up any append that raced the snapshot, then stays open for same-process journal wake-ups through terminal state. Refresh is single-flight per client; unreadable live state closes the stream so reconnect can retry rather than hanging, and a run-scoped journal-failure wake-up (failed durable append, FE-1190 fail-closed) closes active streams so clients reconnect against whatever remained durable instead of waiting on a wake-up that cannot come. Normal completion waits for journal order, while metadata-only abandonment has an explicit wake-up. Late joiners reconstruct the same firing/terminal timeline from artifacts. Active streams unsubscribe and end during web-host shutdown. Cross-origin read permission is emitted only for the configured `PETRINAUT_URL` origin. `/petrinaut/launch?runId=<id>` redirects to configured `PETRINAUT_URL` with an absolute local `sse` URL; it rejects missing config, missing artifacts, and non-loopback `Host` headers. Both routes are observer surfaces only and never affect run lifecycle authority.

Live session-stream frames are process-local observer notifications, not request methods or persisted transcript truth. The TUI sidecar retains its raw Pi relay for existing observer tooling. The standalone host instead exposes only a semantic browser contract:

```pseudo
brunch.sessionEvent:
  params:
    target: {specId, sessionId}
    seq: target-local monotonic sequence
    delta: assistant_text_delta | ask_opened | agent_settled
```

Only Pi's real `agent_settled` is a convergence boundary; `agent_end` is not. Standalone clients refetch `session.presentation` from canonical JSONL and discard ephemeral overlay state at settlement or after remount/reconnect. The production-host concurrency oracle (`src/dev/__tests__/standalone-web-session-host.concurrency.test.ts`) proves these frames remain target-local and independently sequenced across two overlapping hosted sessions, while reconnect reads each target's separate canonical JSONL presentation.

## Streaming transport coverage

Code-anchored coverage ledger for the topology-A streaming relay layer (`session-event-relay.ts` plus the `websocket.ts` multiplex). It maps each oracle-battery claim to the relay capability it exercises and the closure oracle that proves it. The required relay battery is closed; only the trigger-gated `agent_settled` ordering row remains in PLAN as `web-driver-streaming-residue`.

Boundary — in layer: the streaming transport relay and its battery. Out of layer: the web render consumer (`src/web/`), the canonical `session.*` projections, and `brunch.updated` invalidation semantics. DoD: every `●` row `built`.

| # | Capability | Status | Req | Closure oracle | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Topology-A walking skeleton through the real host entry | `built` | ● | `src/dev/__tests__/web-driver-streaming.relay.test.ts` | I22-L: attaches via product factory, not the test |
| 2 | Stream↔transcript differential (assembled `message_update` deltas == flushed JSONL) | `built` | ● | same test | D19-L linchpin |
| 3 | Ordered incremental delivery (monotonic `seq`, no gaps/dupes) | `built` | ● | same test | |
| 4 | Domain-projection multiplex (one WS carries `brunch.sessionEvent` + `brunch.updated`) | `built` | ● | same test | deferred-in-order while a request is in flight |
| 6 | Reconnect/resume idempotence | `built` | ● | `src/dev/__tests__/web-driver-streaming.reconnect.test.ts` | observer-side, replay-less: reconnect refetches `session.*` projections and resumes later live frames |
| 7 | One-driver / many-observer fan-out | `built` | ● | `src/dev/__tests__/web-driver-streaming.fan-out.test.ts` | observer-side, autonomous; three concurrent observers receive byte-identical streams and read-only sidecar writes reject |
| 5 | Mid-stream ask convergence | `built` | ● | `src/dev/__tests__/web-driver-streaming.exchange-convergence.test.ts`, `src/.pi/extensions/__tests__/ask-headless-discovery.test.ts` | every no-UI ask mode registers in D125-L live state; `session.openAsks` discovers the full payload and `session.answerExchange` resolves the broker string, with per-mode decoding in the ask collector; JSONL receives the canonical terminal |
| — | command-intake slice 1 (web drives a plain turn) | `built` | ● | `src/dev/__tests__/web-driver-streaming.command-intake.test.ts` | narrow `session.driveTurn` sidecar method re-enters the live AgentSession |
| — | `agent_end` → `agent_settled` consumer ordering | `trigger-gated` | ○ | add to the existing relay battery only when a web consumer gates idle-only actions on full-run settlement | consumer must remain busy until settled; not current product behavior |
| — | render feel (token / tool / dialog) | `n/a` | ○ | manual walkthrough | outer-loop only; no automated perceptual gate |

Classification: all required topology-A relay rows are built. D125-L's live registry owns ask discovery/answering for every mode; the transcript-backed pending projection is file/observer compatibility, not live-driver discovery. The only remaining relay row is conditional on a future `agent_settled` consumer.

## RPC methods to web Query hooks

The graph/workspace routes remain read-oriented. The standalone session route uses target-addressed presentation/open-ask queries and direct hosted-session mutations; the TUI sidecar retains its narrower handle-gated driver surface.

```pseudo
query key families:
  workspace.state       -> ['workspace.state']
  workspace.selectionState -> ['workspace.selectionState']
  session.pendingExchange  -> ['session.pendingExchange', specId, sessionId]  # target
  session.exchanges        -> ['session.exchanges', specId, sessionId]        # target
  session.runtimeState     -> ['session.runtimeState', specId, sessionId]
  session.presentation     -> ['session.presentation', specId, sessionId]
  graph.overview           -> ['graph.overview', specId]
  graph.nodeNeighborhood   -> ['graph.nodeNeighborhood', specId, nodeId, hops]
  execute.runTraceIndex    -> ['execute.runTraceIndex', specId]
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
| `session.submitExchangeResponse` | `submitExchangeResponseMutationOptions(rpc)` | target full-host mutation; sidecar rejects | invalidates pending/exchanges/runtime state; review-set approval additionally invalidates `graph.overview(specId)` / `graph.nodeNeighborhood(specId)` |
| `session.presentation` | `sessionPresentationQueryOptions(rpc, target)` | standalone session route hydrates canonical JSONL semantics | `agent_settled` or reconnect/remount refetch |
| `session.openAsks` | direct target-addressed hosted-session query | standalone session route renders the current `ask` tracer | live ask changes; settlement refetch |
| `session.driveTurn` | direct hosted-session mutation | standalone session route wired with target + browser driver id; TUI sidecar remains handle-gated | live semantic `brunch.sessionEvent`; settlement refetch |
| `session.answerExchange` | direct hosted-session mutation | standalone session route wired for `ask` with target + browser driver id; TUI sidecar remains handle-gated | live semantic `brunch.sessionEvent`; settlement refetch |
| `graph.overview` | `graphOverviewQueryOptions(rpc, specId)` | implemented; spec route loader primes it | exact `graph.overview(specId)` when `specId` is present |
| `graph.nodeNeighborhood` | `graphNodeNeighborhoodQueryOptions(rpc, specId, nodeId, hops?)` | implemented query option; graph panel selection not yet wired | exact/prefix neighborhood invalidation when `nodeId` is present; broad topic fallback otherwise |
| `execute.runs` | `executeRunsQueryOptions(rpc)` | implemented; run observer list route | exact `execute.runs` |
| `execute.run` | `executeRunQueryOptions(rpc, runId)` | implemented; run detail route incl. reports + worker/verify stream tails | exact `execute.run(runId)`; updates may also carry live Petri projection hints for immediate cache patching |
| `execute.runTraceIndex` | `executeRunTraceIndexQueryOptions(rpc, specId)` | implemented; spec graph run badges | exact `execute.runTraceIndex(specId)` when graph/run evidence changes |
| `execute.replanRecommendation` | target query helper | implemented; web-safe replanning diagnosis | none |
| `execute.replanRegeneratePlan` | target mutation helper | implemented; stale early-run plan/provenance regeneration | exact `execute.runs` + `execute.run(runId)` on write, with read-side Petri hints when available |
| `execute.replanStartNewRun` | target mutation helper | implemented; create linked superseding run | exact old/new `execute.run(runId)` + `execute.runs` on write, with read-side Petri hints when available |
| `execute.replanAbandonRun` | target mutation helper | implemented; evidence-preserving abandon | exact `execute.runs` + `execute.run(runId)` on write, with read-side Petri hints when available |

`execute.replanRetryCurrentStep` is deliberately **not** a registered RPC method: retrying a lifecycle step requires `ExecutionPorts` and executor runtime/model context, so the exact registered tool name `execute_replan_retry_current_step` remains on the executor tool surface until a separate host-authority slice deliberately wires those ports into RPC/web-host context. The corresponding registered RPC names are exactly `execute.replanRecommendation` and `execute.replanRegeneratePlan`; clients must not shorten them to `execute.replanRecommend` or `execute.regeneratePlan`.

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
    preface/proposal/rubric/offer material when applicable
    expected `ask` tool

`ask` toolResult carrying request_* details
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

generalized capture (D80-L)
  elicitor turn-boundary banded sweep over the un-swept transcript tail
  -> mutate_graph (commit, advisory basis/settlement for low-confidence capture, D99-L)
     or update_elicitation_scratchpad (low-confidence noticing, non-authoritative, D81-L)
  — not a submit-path mutation

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
