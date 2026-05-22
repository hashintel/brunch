# Scope cards — FE-737 web-shell review fixes and follow-on

## Orientation

- **Containing seam/frontier:** `web-shell` (FE-737, M3) — native Brunch web surface over named JSON-RPC method families, with WebSocket connections as ephemeral client attachments rather than Brunch sessions.
- **Current volatile state:** The previous hardening queue landed: shared JSON-RPC helpers, `ws` transport adapter, persistent browser RPC client, canonical built asset serving, stable React runtime, and explicit session projection. Review found that explicit projection still leaks binding/session-store lookup into `src/rpc.ts` and still touches coordinator default state before explicit reads.
- **Main open risk:** read-only web/dashboard work will multiply the wrong dependency if session projection remains split between `WorkspaceSessionCoordinator`, ad hoc RPC file scans, and transcript projection helpers.
- **Frontier obligations:** preserve D5-L/D10-L/D19-L/D24-L/D33-L and I21-L; keep product semantics in named `session.*` / `workspace.*` handlers, validate durable `brunch.session_binding`, reject non-linear transcripts, keep browser reads explicit/read-only, and do not add REST product reads or browser input.

---

## Card 1 — Session projection reader seam

**Status:** done  
**Weight:** full scope card

### Target Behavior

Explicit session projection reads are resolved through one read-side session projection module that validates durable session bindings without consulting or mutating workspace default state.

### Boundary Crossings

```text
→ JSON-RPC request: session.elicitationExchanges({ sessionId, specId? })
→ session projection reader / bound-session lookup seam
→ durable .brunch/sessions JSONL + brunch.session_binding validation
→ linear elicitation exchange projection
→ JSON-RPC response
```

### Risks and Assumptions

- RISK: duplicating coordinator binding logic creates a second weaker definition of `brunch.session_binding` → MITIGATION: move shared binding-entry parsing/validation behind one exported helper or coordinator-adjacent read module; delete the local loose validator from `src/rpc.ts`.
- RISK: explicit reads still call `coordinator.openExisting()` and therefore depend on `.brunch/state.json` default selection → MITIGATION: explicit `{ sessionId }` path should resolve from the coordinator cwd or injected session root without opening/changing the selected session.
- RISK: making all reads explicit could break current no-param snapshot shell before the UI has routing/selector state → MITIGATION: preserve the no-param selected-session fallback for now, but isolate it as a fallback path distinct from explicit projection.
- ASSUMPTION: scanning `.brunch/sessions` for a matching binding is acceptable at POC scale → VALIDATE: tests create multiple sessions under one cwd and prove explicit lookup ignores current-session default.

### Acceptance Criteria

✓ `explicit session read ignores workspace default` — `session.elicitationExchanges({ sessionId })` returns the requested session even when `.brunch/state.json` points at another session, without calling `openExisting()` on the explicit path.  
✓ `binding validation is single-sourced` — `src/rpc.ts` no longer parses `brunch.session_binding` JSONL entries directly or defines a local binding-entry shape.  
✓ `spec mismatch stays product-shaped` — `{ sessionId, specId }` returns `-32003` when the durable binding belongs to another spec.  
✓ `missing session stays product-shaped` — unknown `sessionId` returns `-32004`.  
✓ `non-linear explicit read stays product-shaped` — explicit projection still maps `NonLinearTranscriptError` to `-32002` without flattening or branch selection.  
✓ `raw file params remain rejected` — `{ file }` or other non-product params still return `-32602`.

### Verification Approach

- Inner: `npm run fix`; focused unit tests around the new session projection reader and `src/rpc.test.ts`.
- Middle: WebSocket/RPC contract test proving explicit session projection works with two sessions and no reliance on selected default state.
- Outer: not needed; this is read-side seam hardening.

### Cross-cutting obligations

- Advance I21-L: client/default attachment state is not canonical session identity for explicit reads.
- Preserve D21-L: only coordinator/user-flow code creates or binds sessions; this reader is read-only.
- Preserve D24-L: reject non-linear Pi JSONL; do not adapt branches.
- Preserve D19-L: expose a named `session.*` projection, not a generic read gateway.

---

## Card 2 — Shared JSON-RPC dispatch failure semantics

**Status:** next  
**Weight:** full scope card

### Target Behavior

Both stdio and WebSocket JSON-RPC transports map malformed JSON and handler exceptions through the same transport-neutral dispatch helper.

### Boundary Crossings

```text
→ stdio line or WebSocket message
→ shared JSON-RPC dispatch helper
→ RpcHandlers.handle
→ stdio line response or WebSocket message response
```

### Risks and Assumptions

- RISK: hiding too much in protocol helpers turns them into product routing → MITIGATION: helper only parses, invokes `RpcHandlers.handle`, and maps thrown errors; method dispatch stays in `createRpcHandlers`.
- RISK: changing stdio handler failure semantics affects fixture diagnostics → MITIGATION: preserve successful stdio responses exactly and add explicit `-32603` tests for thrown handlers.
- ASSUMPTION: stdio and WebSocket should share internal-error behavior for handler exceptions → VALIDATE: matching tests for both transports.

### Acceptance Criteria

✓ `shared dispatch handles parse errors` — malformed JSON returns `-32700` through stdio and WebSocket via the same helper.  
✓ `shared dispatch handles handler throws` — thrown handler errors return `-32603 Internal error` through stdio and WebSocket.  
✓ `transport modules shrink` — `src/web-rpc-transport.ts` and `runJsonRpcLineServer()` no longer each own bespoke parse/throw mapping logic.  
✓ `product method responses unchanged` — existing `workspace.snapshot` and `session.elicitationExchanges` success/error tests still pass.

### Verification Approach

- Inner: `npm run fix`; protocol/dispatch unit tests plus existing `rpc` and `web-host` tests.
- Middle: stdio and WebSocket contract tests compare parse-error/internal-error semantics.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D5-L: JSON-RPC remains the shared protocol across stdio and WebSocket.
- Preserve D19-L: dispatch helper is transport/protocol only, not product method routing.

---

## Card 3 — Browser RPC client protocol-failure hardening

**Status:** queued  
**Weight:** light scope card

### Objective

Make malformed or invalid WebSocket JSON-RPC response frames fail the browser RPC client deterministically instead of throwing from event listeners or leaving pending requests unresolved.

### Acceptance Criteria

✓ malformed JSON response rejects all pending requests with a protocol/connection error.  
✓ invalid response shape, missing ID, or unknown response ID is handled deterministically according to one documented client policy.  
✓ after a protocol-failure close/failed state, later `request()` calls reject immediately.  
✓ existing out-of-order success and JSON-RPC failure behavior remains covered.

### Verification Approach

- Inner: `npm run fix`; fake-`WebSocket` lifecycle tests in `src/web-client/rpc-client.test.ts`.
- Middle: not needed unless real-browser behavior diverges.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D33-L: this is client attachment lifecycle state only, not durable session state.
- Preserve room for future subscriptions without adding subscription semantics in this card.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

---

## Card 4 — Safe static asset resolver

**Status:** queued  
**Weight:** light scope card

### Objective

Constrain web-mode static asset serving so `/assets/*` requests cannot escape the configured web asset root.

### Acceptance Criteria

✓ `/assets/brunch-web.js` still serves a built asset from the configured web asset root.  
✓ traversal attempts such as `/assets/../index.html`, encoded `..` segments, and absolute-path-like inputs return `404` or `400` without reading outside the asset root.  
✓ asset path normalization is covered by unit or web-host tests.  
✓ no product read endpoint is introduced over HTTP GET.

### Verification Approach

- Inner: `npm run fix`; web-host asset resolver tests.
- Middle: existing web-host HTTP tests prove static asset success/missing-bundle behavior still works.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D10-L: static HTTP is only a browser-bundle shim.
- Preserve D19-L: no REST product reads.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

---

## Card 5 — Shared JSON-RPC response type in fixture capture

**Status:** queued  
**Weight:** light scope card

### Objective

Remove fixture-capture’s local JSON-RPC response type so the fixture driver consumes the shared protocol type.

### Acceptance Criteria

✓ `src/fixture-capture.ts` imports the shared `JsonRpcResponse<T>` type from `src/json-rpc-protocol.ts`.  
✓ local duplicate `JsonRpcResponse<T>` interface is deleted.  
✓ fixture capture tests and M1 runbook still pass.  
✓ no behavior change to fixture metadata or captured artifacts.

### Verification Approach

- Inner: `npm run fix`; fixture-capture and runbook tests.
- Middle: existing fixture replay/runbook tests prove no capture behavior changed.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D5-L: fixture driver remains over JSON-RPC stdio.
- Preserve D19-L: shared protocol type does not become product semantics.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

---

## Card 6 — Read-only transcript rendering in web shell

**Status:** queued  
**Weight:** full scope card

### Target Behavior

The browser shell renders the selected session’s elicitation exchange projection through an explicit read-only `session.elicitationExchanges({ sessionId, specId })` RPC call.

### Boundary Crossings

```text
→ React workspace snapshot route/query
→ explicit session projection query keyed by sessionId/specId
→ WebSocketRpcClient.request
→ session.elicitationExchanges RPC handler
→ browser read-only transcript/exchange view
```

### Risks and Assumptions

- RISK: UI rendering may regress to implicit selected-session reads → MITIGATION: query function must pass `{ sessionId, specId }` from `workspace.snapshot` when a session is present; tests assert RPC params.
- RISK: transcript UI implies browser write capability → MITIGATION: render read-only exchange/open-prompt state only; no input box or response actions.
- RISK: projection shape is still low-level IDs, not final transcript UX → MITIGATION: render a modest diagnostic/read-only panel for current M3 proof, not final chat UI polish.
- ASSUMPTION: elicitation exchange projection is sufficient for the first read-only transcript panel → VALIDATE: tests cover `empty`, `open_prompt`, `ready`, and error/no-session states at the component boundary as feasible.

### Acceptance Criteria

✓ selected ready workspace triggers `session.elicitationExchanges` with `{ sessionId, specId }`, not an implicit no-param call.  
✓ browser renders exchange count and open-prompt/readiness state for the selected session.  
✓ no selected session renders an explicit no-session/read-only empty state without calling `session.elicitationExchanges`.  
✓ RPC failure renders a product-shaped read-only error state.  
✓ no browser input, response submission, or write method is added.

### Verification Approach

- Inner: `npm run fix`; React/jsdom tests with fake RPC client asserting method names and params.
- Middle: existing WebSocket/RPC integration tests plus app tests prove explicit read-only projection composes with the runtime.
- Outer: manual browser smoke can follow later; not required for this slice.

### Cross-cutting obligations

- Preserve D33-L/I21-L: web reads target durable session identity explicitly.
- Preserve D12-L/D13-L: render transcript-derived elicitation exchanges; do not create a browser-owned chat/turn store.
- Preserve D19-L: keep data fetching through named RPC methods over WebSocket, not REST.
- Preserve the web read-only posture until write ownership/leases are designed.
