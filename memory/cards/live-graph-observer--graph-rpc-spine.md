# Selected-spec graph RPC observer spine

Frontier: live-graph-observer | n/a
Status:   active
Mode:     chain
Created:  2026-06-03

## Orientation

- Containing seam: `db/` + `graph/` + `.pi/extensions/graph/` + `rpc/` + TUI launch. This is the core black-triangle spine: TUI/agent writes selected-spec graph truth; RPC/web observers read and refetch it.
- Frontier item: `live-graph-observer` (FE-795). The user clarified that all graph items, including future plan/oracle/design graph items, are owned by one spec.
- Volatile handoff state: current code has DB-backed `specs`, but graph rows/readers are workspace-global; current WebSocket updates broadcast only after WebSocket-originated mutations; current stdio RPC returns only responses and uses Node `readline`.
- Pi RPC context: Pi RPC is not JSON-RPC; it is LF-framed JSONL commands/responses/events. Brunch can keep JSON-RPC method envelopes, but should mirror the semantic rule that responses and asynchronous notifications share the transport stream.
- Main open risk: current modes are mutually exclusive. A real TUI-writer/web-observer proof needs the TUI-launched product process to expose an observer web/RPC endpoint, or else a separately designed cross-process event bridge.
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

## Card 2 — next — Discoverable selected-spec graph RPC reads

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

## Card 3 — next — Product update notifications span transports

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
- ASSUMPTION: For F1, one process owns the writer and observer host; cross-process DB polling/event relay is out of scope.
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
- Outer: manual browser smoke after TUI observer host lands.

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

## Card 4 — next — TUI launches an observer-capable web/RPC attachment host

### Target Behavior

A TUI writer session can expose a local read-only web/RPC observer endpoint from the same Brunch process.

### Boundary Crossings

```pseudo
→ brunch-cli --mode tui
→ WorkspaceSessionCoordinator activation
→ observer web host start with shared coordinator/update publisher
→ Pi InteractiveMode writer session
→ graph commit via TUI/agent tool
→ product update publisher
→ WebSocket browser observer
→ graph.overview refetch
```

### Risks and Assumptions

- RISK: Current `--mode web` and `--mode tui` are mutually exclusive, so manual two-process testing would miss in-process event wiring.
  → MITIGATION: start the observer web host from TUI mode for F1, or provide an explicit `--observer-web` flag if always-on web is too intrusive.
- RISK: Sharing mutable coordinator/session objects between TUI and web could imply two writers.
  → MITIGATION: web graph/session surfaces remain read-only in this frontier; only selected session activation/projections are exposed unless a later card adds write authority.
- RISK: Port allocation/browser URL handling distracts from the observer proof.
  → MITIGATION: random localhost port and printed URL is enough; browser auto-open is optional.
- ASSUMPTION: Same-process observer host is the desired POC proof path.
  → IMPACT IF FALSE: replace this card with a cross-process polling/IPC design before implementation.
  → VALIDATE: manual runbook proves one writer process with attached observers, not separate product daemons.

### Tracer-bullet check

- Proof of life: the actual TUI launch path also owns the web observer path; no harness secretly wires the web host.
- Invariants: preserves one-writer/many-observer local model.

### Acceptance Criteria

✓ TUI launch — after spec/session activation, starts or advertises a WebSocket-backed observer URL without blocking `InteractiveMode.run()`.
✓ Shared update bus — graph commits from the TUI graph tool notify browser clients attached to that URL.
✓ Read-only web — browser can read workspace/session/graph projections but does not expose graph mutation controls in F1.
✓ Shutdown — closing TUI closes the observer host cleanly enough for tests/manual reruns.
✓ Test — launch path test verifies the observer host runner is invoked after activation and before/alongside interactive launch.

### Verification Approach

- Inner: `src/brunch-tui.test.ts` — launch sequencing and shared publisher injection.
- Middle: local integration/manual smoke in workbench — TUI writer, browser observer, graph commit/refetch.

### Cross-cutting obligations

- D33-L: browser/WebSocket is an attachment, not a Brunch session.
- One writer: TUI remains the writer; web remains observer/read-only unless explicitly scoped later.
- No cross-process event bus or daemon in F1.

### Expected touched paths (tentative)

```pseudo
src/brunch-tui.ts                    ~
src/brunch-tui.test.ts               ~
src/rpc/web-host.ts                  ~
src/rpc/product-updates.ts           ~
src/brunch.ts                        ?
```

## Card 5 — next — Session runtime state RPC projection

### Target Behavior

`session.runtimeState` returns the flattened Brunch session-agent runtime state for an explicit selected session.

### Boundary Crossings

```pseudo
→ JSON-RPC request `{specId, sessionId}`
→ rpc/ session runtime-state handler
→ session/ linear transcript envelope reader
→ .pi operational-mode state projector or session-owned equivalent
→ JSON-RPC result
```

### Risks and Assumptions

- RISK: Web parsing raw transcript rows duplicates session projection logic.
  → MITIGATION: expose a thin named RPC projection; web renders result only in the web architecture card.
- RISK: Runtime-state projection lives under `.pi/extensions/operational-mode.ts`, which is adapter-ish.
  → MITIGATION: for F1, reuse the existing projector if cheap; if the builder needs to move pure projection code under `session/` or `agents/state.ts`, keep the move narrow and update README boundaries.
- ASSUMPTION: `brunch.agent_runtime_state` entries remain the transcript truth for this projection until `agents-composition-layer` relocates state definitions.
  → IMPACT IF FALSE: this card should wait for the agents frontier.
  → VALIDATE: tests feed cumulative init/switch custom entries and assert last-writer-wins projection.

### Tracer-bullet check

- Proof of life: RPC can show live runtime posture, not just graph data.
- Invariants: session state is transcript-backed and flattened by a product projection.

### Acceptance Criteria

✓ `rpc.discover` — lists `session.runtimeState` with params/result schema and example.
✓ Projection — returns default state for no entries and latest valid switch after cumulative entries.
✓ Explicit target — requires/uses `{specId, sessionId}` and rejects mismatched/non-linear transcripts like other session projections.
✓ Notifications — session runtime-state changes publish/invalidate `session.runtimeState` for the selected session.

### Verification Approach

- Inner: session/rpc projection tests.
- Middle: fixture custom entries prove the projection until a runtime-switch UI exists.

### Cross-cutting obligations

- D40-L: runtime state is transcript-backed, not hidden extension memory.
- D52-L: long-term pure state definitions move toward `agents/`; this card may reuse existing projector but must not deepen `.pi` ownership.
- D33-L: explicit session target; no transport-derived durable identity.

### Expected touched paths (tentative)

```pseudo
src/rpc/
├── handlers.ts                      ~
├── handlers.test.ts                 ~
└── README.md                        ~
src/session/
├── runtime-state.ts                 ?
└── README.md                        ?
src/.pi/extensions/operational-mode.ts ?
```
