# Selected-spec graph RPC web attachment spine

Frontier: live-graph-observer | n/a
Status:   active
Mode:     chain
Created:  2026-06-03

## Orientation

- Containing seam: `db/` + `graph/` + `.pi/extensions/graph/` + `rpc/` + TUI launch. This is the core black-triangle spine: TUI/agent writes selected-spec graph truth; RPC/web attachments read and refetch it.
- Frontier item: `live-graph-observer` (FE-795). The user clarified that all graph items, including future plan/oracle/design graph items, are owned by one spec.
- Volatile handoff state: current code has DB-backed `specs`, but graph rows/readers are workspace-global; current WebSocket updates broadcast only after WebSocket-originated mutations; current stdio RPC returns only responses and uses Node `readline`.
- Pi RPC context: Pi RPC is not JSON-RPC; it is LF-framed JSONL commands/responses/events. Brunch can keep JSON-RPC method envelopes, but should mirror the semantic rule that responses and asynchronous notifications share the transport stream.
- Main open risk: current modes are mutually exclusive. A real TUI-writer/web-attachment proof needs the TUI-launched product process to expose a web sidecar endpoint, or else a separately designed cross-process event bridge.
- Cross-cutting obligations: preserve D4-L/D20-L command-layer mutation authority, D19-L thin named RPC methods, D33-L attachments-not-sessions, D52-L dependency direction, and D61-L no workspace-global graph.

## Pi RPC context notes to carry into implementation

```pseudo
Pi RPC docs:
  transport: stdin/stdout JSONL, strict LF delimiter
  shape: commands -> correlated responses, plus asynchronous event records
  extension UI: dialog/fire-and-forget requests are events on the same stream
  warning: Node readline is not protocol-compliant for strict LF JSONL because it splits U+2028/U+2029

Brunch consequence:
  public Brunch RPC may remain JSON-RPC, but notifications must be first-class records:
    response:      {jsonrpc:'2.0', id, result|error}
    notification: {jsonrpc:'2.0', method:'brunch.updated', params:{topics:[...]}}
  WebSocket and stdio should both be able to carry notifications independent of request responses.
```

## Card 1 — done — Graph items are owned by spec

### Target Behavior

Every graph projection and graph mutation targets exactly one spec.

### Boundary Crossings

```pseudo
→ TUI/agent commit_graph tool or graph reader
→ .pi/extensions/graph adapter
→ graph/ CommandExecutor or snapshot readers
→ db/ SQLite rows with spec ownership
→ graph/ typed projection result
```

### Risks and Assumptions

- RISK: Adding `spec_id` to nodes only leaves edges/reconciliation needs effectively cross-spec or ambiguous.
  → MITIGATION: Store `spec_id` on graph items that are independently addressed (`nodes`, `edges`, graph-adjacent reconciliation needs) and validate edge endpoints share the command's `specId`.
- RISK: Existing-node refs in `commitGraph` can point across specs.
  → MITIGATION: `CommandExecutor.commitGraph({ specId, ... })` rejects existing refs whose row `spec_id` differs from the command spec.
- RISK: Graph tools could ask the agent to supply `specId`, creating prompt-time drift.
  → MITIGATION: agent/TUI graph tools bind `specId` from the selected Brunch session/spec; public RPC graph methods require explicit `specId` params.
- ASSUMPTION: Pre-release/free-rewrite posture allows replacing the initial graph migration and tests rather than preserving old local DB shape.
  → IMPACT IF FALSE: a compatibility migration/card is needed before graph storage changes.
  → VALIDATE: build/update fixtures/tests from a fresh `.brunch/data.db` only.
  → memory/SPEC.md D61-L / D52-L.

### Tracer-bullet check

- Proof of life: a graph commit in one spec becomes visible to selected-spec readers and invisible to another spec.
- Invariants: stabilizes the no-workspace-global-graph seam at storage, command, reader, tool, and future RPC boundaries.

### Acceptance Criteria

✓ `graph ownership isolation` — committing nodes/edges for spec A and spec B yields separate `getGraphOverview(db, specId)` projections.
✓ `existing ref guard` — `commitGraph` with `{ existing: nodeFromOtherSpec }` returns `structural_illegal` and writes nothing.
✓ `endpoint guard` — edges cannot connect nodes from different specs, including mixed intra-batch/existing-node edges.
✓ `reader guard` — `getNodeNeighborhood(db, specId, nodeId)` returns `not_found` for a node owned by another spec.
✓ `tool guard` — `read_graph` / `commit_graph` exercise selected-spec-bound readers/writes; the agent-facing tool schema does not expose a workspace-global graph read.
✓ `schema guard` — tests or architecture checks prove no `web/`, `rpc/`, or `.pi/` module imports `db/` directly while adding spec ownership.

### Verification Approach

- Inner: DB/graph unit tests — command validation, rollback, snapshot isolation, and cross-spec rejection.
- Middle: `.pi` graph tool test — selected spec binding drives read/write without asking the agent for a raw workspace-global graph.
- Outer: fresh workbench smoke can be deferred until Card 4; this card proves the storage/domain invariant.

### Cross-cutting obligations

- D4-L/D20-L: all graph writes remain through `CommandExecutor`.
- D52-L: `graph/` imports `db/`; adapters/RPC/web never import `db/` directly.
- D61-L: each spec owns its own intent/plan/oracle/design graph; no cross-spec claim sharing in the POC.
- A4-L remains intact: LSN may stay global per workspace DB, while graph item ownership is spec-scoped.

### Expected touched paths (tentative)

```pseudo
drizzle/
├── 0000_jazzy_warbound.sql          ~
└── meta/                            ~
src/db/
├── schema.ts                        ~
└── row-schemas.ts                   ?
src/graph/
├── command-executor.ts              ~
├── command-executor.test.ts         ~
├── snapshot.ts                      ~
├── snapshot.test.ts                 ~
├── workspace-store.ts               ~
├── architecture.test.ts             ?
└── README.md                        ~
src/.pi/extensions/graph/
├── index.ts                         ~
├── command-adapter.ts               ~
└── tool-schemas.ts                  ?
src/.pi/__tests__/graph-tools.test.ts ~
src/session/workspace-session-coordinator.ts ?
```


## Card 1A — done — Review hardening for selected-spec graph authority

### Objective

Graph authority paths reject stale or cross-spec writes in the remaining Card 1 review gaps.

### Acceptance Criteria

✓ `resolve reconciliation need spec guard` — resolving a reconciliation need requires `{specId,id}` and rejects the same need id under any other spec without mutating it.
✓ `dry-run spec parity` — `dryRunCommitGraph` returns `structural_illegal` for a nonexistent `specId`, matching `commitGraph`.
✓ `runtime graph binding` — a runtime created after an in-session workspace switch binds graph tools to the coordinator's current spec rather than the factory's initial spec.
✓ `active docs` — graph and CLI docs no longer teach the retired review state (`graph.*` missing spec scoping) or retired `brunch-next` / `brunch --mode` launch identity.

### Verification Approach

- Inner: targeted graph/TUI/package tests — spec-guard regression, dry-run/commit parity, runtime factory selected-spec binding, package identity.
- Middle: active-doc text scan — confirms stale launch/naming instructions are gone from active docs.

### Cross-cutting obligations

- D20-L: every graph-adjacent mutation remains behind `CommandExecutor`.
- D52-L: `.pi`, `rpc`, and `web` adapters do not import `db/` directly.
- D61-L: graph truth and graph-adjacent reconciliation needs are selected-spec owned; no workspace-global graph mutation path remains.
- A14-L review-set dry-run remains a real commit gate: user-reviewable proposals must fail dry-run when the eventual commit would fail.

### Assumption dependency

None — this card closes discovered review gaps inside already-established selected-spec graph ownership.

### Expected touched paths (tentative)

```pseudo
src/graph/
├── command-executor.ts              ~
├── command-executor.test.ts         ~
├── snapshot.test.ts                 ~
├── spec-ownership.test.ts           ~
└── README.md                        ~
src/brunch-tui.ts                    ~
src/brunch-tui.test.ts               ~
docs/
├── README.md                        ~
└── architecture/                    ?
```

## Card 2 — done — Discoverable selected-spec graph RPC reads

### Target Behavior

`graph.overview` and `graph.nodeNeighborhood` return canonical graph projections for the requested spec.

### Boundary Crossings

```pseudo
→ JSON-RPC request over stdio or WebSocket
→ rpc/ handler param validation and discovery schema
→ graph/ selected-spec snapshot reader
→ db/ graph rows
→ graph/ typed projection
→ JSON-RPC result
```

### Risks and Assumptions

- RISK: RPC handlers may reach into DB directly for convenience.
  → MITIGATION: handlers call graph reader/runtime functions only; architecture tests protect no `db/` import in `rpc/`.
- RISK: `specId` could be optional and silently fall back to workspace default.
  → MITIGATION: graph methods require explicit `specId`; workspace defaults can help the web choose a route but are not graph read authority.
- ASSUMPTION: Card 1 has landed.
  → IMPACT IF FALSE: handlers cannot satisfy the no workspace-global graph guard.
  → VALIDATE: tests seed two specs and assert RPC reads one at a time.

### Tracer-bullet check

- Proof of life: browser/CLI can read selected-spec graph state over public Brunch RPC.
- Invariants: puts graph read ownership in `graph/`, RPC method ownership in `rpc/`, and no DB imports in web/RPC.

### Acceptance Criteria

✓ `rpc.discover` — lists `graph.overview` and `graph.nodeNeighborhood` with schemas/examples.
✓ `graph.overview` — requires `{specId}` and returns nodes, edges, counts, and LSN for that spec only.
✓ `graph.nodeNeighborhood` — requires `{specId,nodeId}` with optional `hops` and returns `success` or `not_found` scoped to that spec.
✓ Cross-spec test — a node id from spec B is `not_found` when requested under spec A.
✓ Architecture test — `rpc/` does not import `db/`.

### Verification Approach

- Inner: `src/rpc/handlers.test.ts` and graph reader tests — schemas, invalid params, cross-spec isolation, discovery examples.
- Middle: stdio JSON-RPC smoke — request graph overview from the workbench.

### Cross-cutting obligations

- D19-L: concrete named graph methods; no `records.*`, no generic read gateway.
- D52-L: graph owns readers; rpc owns handler/schema/discovery only.
- D61-L: explicit spec targeting; no workspace-global graph projection.

### Expected touched paths (tentative)

```pseudo
src/rpc/
├── handlers.ts                      ~
├── handlers.test.ts                 ~
└── README.md                        ~
src/graph/
├── workspace-store.ts               ~
├── snapshot.ts                      ?
└── snapshot.test.ts                 ?
```

## Card 3 — done — Product update notifications span transports

### Target Behavior

Graph/session/workspace mutations publish product update notifications to every attached Brunch RPC transport.

### Boundary Crossings

```pseudo
→ product mutation seam (workspace.activate, structured-exchange response, commit_graph, future capture)
→ rpc/ product update publisher
→ WebSocket notification or stdio JSONL notification
→ client subscription bridge
→ Query invalidation/refetch
→ canonical projection reader
```

### Risks and Assumptions

- RISK: Putting event publication inside only WebSocket request handling recreates the current blind spot.
  → MITIGATION: introduce a process-local product update publisher/bus that mutation adapters can call whether the mutation came from TUI, RPC, or future capture.
- RISK: Putting RPC-specific event shapes in `graph/` couples domain to transport.
  → MITIGATION: `rpc/` owns JSON-RPC notification shape; graph/TUI adapters receive or call a narrow publisher interface after successful `CommandExecutor` results.
- RISK: Generalizing into a canonical event store violates the frontier non-goal.
  → MITIGATION: no durable event spine; this is process-local invalidation only. Canonical truth stays in graph/session/workspace stores.
- ASSUMPTION: For F1, one process owns the writer and web attachment host; cross-process DB polling/event relay is out of scope.
  → IMPACT IF FALSE: a separate web-mode process will not receive TUI-process notifications without polling or IPC.
  → VALIDATE: Card 4 runs the web transport in the same process as the graph tool writer.

### Tracer-bullet check

- Proof of life: TUI/agent graph commit triggers a browser refetch without page reload.
- Invariants: mutation adapters publish notifications; clients refetch canonical projections rather than reading a view store.

### Acceptance Criteria

✓ `ProductUpdatePublisher` or equivalent — has a typed topic payload carrying at least `{topic, specId?, sessionId?, lsn?}`.
✓ WebSocket — broadcasts notifications from bus events, not only after WebSocket-originated mutations.
✓ Stdio — can write JSON-RPC notifications independently from request responses; parser is LF-framed rather than Node `readline` if this transport is touched.
✓ Graph tool — successful selected-spec `commit_graph` publishes graph update topics with spec id and LSN.
✓ Session/workspace mutations — existing `workspace.activate` / structured-exchange mutations keep publishing their current update topics through the same bus.
✓ Tests — prove a synthetic graph update invalidates/broadcasts over WebSocket and stdio without fabricating a request mutation path.

### Verification Approach

- Inner: rpc transport tests — request/response correlation plus independent notifications; LF framing test if stdio parser changes.
- Middle: in-process integration — call graph tool/CommandExecutor adapter and observe notification topic then refetch `graph.overview`.
- Outer: manual browser smoke after TUI web sidecar lands.

### Cross-cutting obligations

- Notifications are invalidation hints, not canonical truth.
- Keep event bus process-local and thin; no DB-backed event log/view store in F1.
- Preserve Brunch public JSON-RPC method vocabulary; do not expose raw Pi RPC event records as product API.

### Expected touched paths (tentative)

```pseudo
src/rpc/
├── product-updates.ts               +
├── websocket.ts                     ~
├── web-host.ts                      ~
├── handlers.ts                      ~
├── handlers.test.ts                 ~
├── websocket.test.ts                ?
└── protocol.test.ts                 ?
src/.pi/extensions/graph/
├── index.ts                         ~
└── command-adapter.ts               ?
src/.pi/pi-extension-shell.ts        ~
src/brunch.ts                        ?
src/brunch.test.ts                   ?
```

## Card 4 — done — TUI launches a web sidecar attachment host

### Target Behavior

A TUI writer session can expose a local read-only web/RPC attachment endpoint from the same Brunch process.

### Boundary Crossings

```pseudo
→ brunch-cli --mode tui
→ WorkspaceSessionCoordinator activation
→ web sidecar host start with shared coordinator/update publisher
→ Pi InteractiveMode writer session
→ graph commit via TUI/agent tool
→ product update publisher
→ WebSocket browser attachment
→ graph.overview refetch
```

### Risks and Assumptions

- RISK: Current `--mode web` and `--mode tui` are mutually exclusive, so manual two-process testing would miss in-process event wiring.
  → MITIGATION: start the web sidecar host from TUI mode for F1, or provide an explicit web-attachment flag if always-on web is too intrusive.
- RISK: Sharing mutable coordinator/session objects between TUI and web could imply two writers.
  → MITIGATION: web graph/session surfaces remain read-only in this frontier; only selected session activation/projections are exposed unless a later card adds write authority.
- RISK: Port allocation/browser URL handling distracts from the web attachment proof.
  → MITIGATION: random localhost port and printed URL is enough; browser auto-open is optional.
- ASSUMPTION: Same-process web attachment host is the desired POC proof path.
  → IMPACT IF FALSE: replace this card with a cross-process polling/IPC design before implementation.
  → VALIDATE: manual runbook proves one writer process with attached web clients, not separate product daemons.

### Tracer-bullet check

- Proof of life: the actual TUI launch path also owns the web attachment path; no harness secretly wires the web host.
- Invariants: preserves one-writer/many-read-attachments local model.

### Acceptance Criteria

✓ TUI launch — after spec/session activation, starts or advertises a WebSocket-backed web sidecar URL without blocking `InteractiveMode.run()`.
✓ Shared update bus — graph commits from the TUI graph tool notify browser clients attached to that URL.
✓ Read-only web — browser can read workspace/session/graph projections but does not expose graph mutation controls in F1.
✓ Shutdown — closing TUI closes the web sidecar cleanly enough for tests/manual reruns.
✓ Test — launch path test verifies the web sidecar runner is invoked after activation and before/alongside interactive launch.

### Verification Approach

- Inner: `src/brunch-tui.test.ts` — launch sequencing and shared publisher injection.
- Middle: local integration/manual smoke in workbench — TUI writer, browser attachment, graph commit/refetch.

### Cross-cutting obligations

- D33-L: browser/WebSocket is an attachment, not a Brunch session.
- One writer: TUI remains the writer; web remains a read-only attachment unless explicitly scoped later.
- No cross-process event bus or daemon in F1.

### Expected touched paths (tentative)

```pseudo
src/brunch-tui.ts                    ~
src/brunch-tui.test.ts               ~
src/rpc/web-host.ts                  ~
src/rpc/product-updates.ts           ~
src/brunch.ts                        ?
```

## Card 5 — done — RPC method-family split and read-only web sidecar surface

### Target Behavior

The TUI-started web sidecar exposes only read/projection RPC methods while the full CLI/RPC host keeps the existing mutation-capable surface.

### Boundary Crossings

```pseudo
→ TUI web sidecar startup
→ rpc/ read-attachment handler surface
→ WebSocket transport
→ browser RPC request
→ graph/session/workspace projection owner
→ JSON-RPC response or method-not-found for mutation methods
```

### Risks and Assumptions

- RISK: Implementing sidecar read-only behavior as scattered `if (method === ...)` checks makes `handlers.ts` more tangled.
  → MITIGATION: split method-family modules or handler composition behind the existing public `createRpcHandlers` entry point; sidecar uses the read/projection composition, full RPC uses read + mutation composition.
- RISK: Accidentally changing `brunch-cli --mode rpc` or proof-era public RPC probes would break existing mutation proofs.
  → MITIGATION: full handler construction remains mutation-capable; only the TUI-started web sidecar swaps to the read-only attachment handler.
- RISK: Discovery could advertise mutations on a sidecar that rejects them.
  → MITIGATION: sidecar `rpc.discover` returns only methods that the sidecar handler will accept.
- ASSUMPTION: For F1, web sidecar writes should be rejected at the RPC boundary, not merely hidden in React UI.
  → IMPACT IF FALSE: if browser-side structured exchange driving becomes part of this frontier, a narrower write policy will need a separate explicit design.
  → VALIDATE: WebSocket tests call sidecar mutation methods and receive `Method not found` while read methods still work.

### Tracer-bullet check

- Invariants: enforces one-writer/many-read-attachments at the product boundary rather than as UI convention.
- Uncertainty: retires the review concern that the web sidecar can secretly mutate the TUI-selected workspace/session.

### Acceptance Criteria

✓ Handler split — `src/rpc/handlers.ts` remains the public entry point, but method families/protocol pieces are split enough that adding Card 6 does not grow it further as a 1400-line mega-module.
✓ Full RPC unchanged — `brunch-cli --mode rpc` and existing RPC handler tests still allow `workspace.activate`, `session.startElicitation`, and `elicitation.respond`.
✓ Sidecar reads work — TUI-started sidecar WebSocket accepts `rpc.discover`, `workspace.snapshot`, `workspace.selectionState`, `session.pendingExchange`, `session.elicitationExchanges`, `session.transcriptDisplay`, `graph.overview`, and `graph.nodeNeighborhood` where their params are valid.
✓ Sidecar mutations rejected — TUI-started sidecar WebSocket rejects `workspace.activate`, `session.startElicitation`, and `elicitation.respond` without mutating workspace/session/transcript state.
✓ Sidecar discovery honest — sidecar `rpc.discover` omits mutation methods it rejects.
✓ Update fanout preserved — graph commits from TUI graph tools still publish `brunch.updated` to sidecar clients over the same process-local bus.

### Verification Approach

- Inner: `src/rpc/*` tests — method family dispatch, discovery subsets, full-vs-read-only handler behavior, no CLI RPC regression.
- Middle: `src/rpc/web-host.test.ts` or `src/brunch-tui.test.ts` — TUI sidecar uses the read-only handler while retaining live update fanout.

### Cross-cutting obligations

- D19-L: concrete named methods; no generic read gateway and no second public product protocol.
- D33-L: browser/WebSocket is an attachment, not a Brunch session or writer.
- Keep sidecar read-only for F1; do not introduce a broad mutation-policy framework before a concrete browser write is scoped.
- Preserve the existing `createRpcHandlers` import path for external callers; split private implementation modules behind it.

### Expected touched paths (tentative)

```pseudo
src/rpc/
├── handlers.ts                      ~
├── handlers.test.ts                 ~
├── methods/
│   ├── discovery.ts                 +
│   ├── graph.ts                     +
│   ├── session.ts                   +
│   └── workspace.ts                 +
├── protocol.ts                      ?
├── web-host.ts                      ~
├── web-host.test.ts                 ~
└── README.md                        ~
src/brunch-tui.ts                    ?
src/brunch-tui.test.ts               ?
src/brunch.test.ts                   ?
```

## Card 6 — next — Broader session runtime state RPC projection

### Target Behavior

`session.runtimeState` returns flattened transcript-backed state for agent posture, mentions, world-update watermarks, and session lifecycle facts for an explicit selected session.

### Boundary Crossings

```pseudo
→ JSON-RPC request `{specId, sessionId}`
→ rpc/ read-method handler
→ session/ linear transcript envelope reader
→ session runtime-state projector
→ .pi operational-mode state entry parser or session-owned equivalent
→ JSON-RPC result
```

### Risks and Assumptions

- RISK: Web parsing raw transcript rows duplicates session projection logic.
  → MITIGATION: expose a thin named RPC projection; web renders result only in the web architecture card.
- RISK: A single `session.runtimeState` blob becomes a hidden mutable god object.
  → MITIGATION: model it as one read projection over several small transcript entry families; absent future entry families return explicit empty/default slots.
- RISK: Runtime-state projection currently lives under `.pi/extensions/operational-mode.ts`, which is adapter-ish.
  → MITIGATION: move or wrap pure projection under `session/` where practical; `.pi` may retain entry append/tool-policy adapter code.
- ASSUMPTION: `brunch.agent_runtime_state` entries remain the transcript truth for agent posture until `agents-composition-layer` relocates state definitions.
  → IMPACT IF FALSE: this card should wait for the agents frontier.
  → VALIDATE: tests feed cumulative init/switch custom entries and assert last-writer-wins posture projection.
- ASSUMPTION: Mentions, world-update watermarks, and lifecycle facts can be shaped now with defaults/placeholders even if producers are not all landed.
  → IMPACT IF FALSE: consumers would churn when those producers land.
  → VALIDATE: tests assert default empty slots plus fixture-backed slots for any currently available entry family.

### Tracer-bullet check

- Proof of life: RPC can show live runtime posture and session context, not just graph data.
- Invariants: session runtime state is transcript-backed and flattened by a product projection; web does not parse raw transcript rows.

### Acceptance Criteria

✓ `rpc.discover` — full RPC and read-only sidecar discovery list `session.runtimeState` with params/result schema and example.
✓ Agent posture — projection returns current op mode, derived role, strategy, lens, and goal from cumulative `brunch.agent_runtime_state` entries, defaulting cleanly when none exist.
✓ Mentions slots — result includes `mentions.graphNodes` and `mentions.files` arrays, empty when no mention entries exist, shaped for later stale-hint comparison.
✓ World-update slots — result includes latest known graph LSN/changeset and git head watermark slots when entries exist, with null/defaults when absent.
✓ Lifecycle facts — result includes transcript-backed lifecycle facts where available: new spec vs existing spec, new vs resumed session, `sessionIndexInSpec`, `isFirstSessionForSpec`, and `isTenthSessionForSpec` when computable from current coordinator/session facts without a new durable table.
✓ Explicit target — requires/uses `{specId, sessionId}` and rejects mismatched/non-linear transcripts like other session projections.
✓ Notifications — entries that affect runtime state publish/invalidate `session.runtimeState` for the selected session.

### Verification Approach

- Inner: `src/session/runtime-state.test.ts` — transcript fixtures for defaults, cumulative posture switches, mention/world/lifecycle entry families, non-linear rejection through projection readers.
- Inner: `src/rpc/handlers.test.ts` or split method tests — method discovery, invalid params, explicit target mismatch, read-only sidecar availability.
- Middle: fixture custom entries prove the projection until runtime-switch and world-update producers are richer.

### Cross-cutting obligations

- D40-L: runtime state is transcript-backed, not hidden extension memory.
- D52-L: long-term pure state definitions move toward `agents/`; this card should not deepen `.pi` ownership.
- D33-L: explicit session target; no transport-derived durable identity.
- Do not implement full staleness detection, automatic re-snapshotting, or rich TUI rendering in this card unless already trivial from existing data.

### Expected touched paths (tentative)

```pseudo
src/session/
├── runtime-state.ts                 +
├── runtime-state.test.ts            +
└── README.md                        ~
src/rpc/
├── handlers.ts                      ~
├── handlers.test.ts                 ~
├── methods/
│   ├── discovery.ts                 ~
│   └── session.ts                   ~
└── README.md                        ~
src/.pi/extensions/operational-mode.ts ?
src/.pi/__tests__/operational-mode.test.ts ?
src/web/
├── queries/session.ts               ~
└── query-keys.ts                    ?
```
