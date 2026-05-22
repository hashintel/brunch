# Scope cards — FE-737 web-shell hardening

## Orientation

- **Containing seam/frontier:** `web-shell` (FE-737, M3) — native Brunch web surface over named JSON-RPC method families, with the browser as a thin remote head rather than a second product runtime.
- **Current volatile state:** Web HTTP shell, hand-written WebSocket bridge, and React workspace snapshot shell exist; `memory/SPEC.md` now records `D33-L` / `I21-L`: transport connections are client attachments, not Brunch sessions, and web is initially read-only/observer-shaped.
- **Main open risk:** the current WebSocket implementation conflates transport convenience with product semantics and hand-parses frames; hardening must deepen transport without inventing a generic read gateway or browser-owned session model.
- **Frontier obligations:** preserve D5-L/D10-L/D19-L/D24-L/D33-L; keep JSON-RPC as named product methods, validate durable `brunch.session_binding` for session projections, reject non-linear transcripts, keep web reads explicit/read-only until write ownership is designed, and do not add REST product reads.

---

## Card 1 — Shared JSON-RPC protocol seam

**Status:** done  
**Weight:** full scope card

### Target Behavior

JSON-RPC request/response types and helpers are defined once and reused by stdio handlers, WebSocket transport, and the browser client.

### Boundary Crossings

```text
→ src/rpc.ts handler boundary
→ shared JSON-RPC protocol module
→ src/web-host.ts / future web-rpc transport
→ src/web-client/rpc-client.ts
```

### Risks and Assumptions

- RISK: protocol helpers grow into a generic API platform → MITIGATION: keep them transport/protocol-only; product methods remain in `createRpcHandlers`.
- RISK: browser imports pull Node-only code into the Vite bundle → MITIGATION: put shared protocol types/helpers in a runtime-neutral module with no Node imports.
- ASSUMPTION: current JSON-RPC shape is sufficient for request/response hardening before subscriptions → VALIDATE: stdio and web tests still pass with no subscription API added.

### Acceptance Criteria

✓ `rpc protocol contract` — request IDs, success responses, failures, invalid requests, parse errors, and method-not-found helpers are exercised from one shared module.  
✓ `stdio JSON-RPC handlers use shared protocol` — `runJsonRpcLineServer` still returns the same product-shaped responses and parse errors through shared helpers.  
✓ `browser RPC client imports shared protocol types` — `src/web-client/rpc-client.ts` no longer redeclares parallel JSON-RPC request/response shapes.  
✓ `no product-generic surface` — no `records.*`, REST read, or generic read-model abstraction is introduced.

### Verification Approach

- Inner: `npm run fix`; focused unit tests for protocol helpers and existing `src/rpc.test.ts`.
- Middle: existing stdio RPC contract tests prove shared protocol helpers preserve handler semantics.
- Outer: not needed; this is protocol factoring, not UX behavior.

### Cross-cutting obligations

- Preserve D5-L and D19-L: JSON-RPC is the protocol; named product method families remain the semantic boundary.
- Preserve D33-L/I21-L: protocol identity is not session identity.

---

## Card 2 — Server WebSocket transport adapter

**Status:** next  
**Weight:** full scope card

### Target Behavior

The `/rpc` WebSocket endpoint is served by a dedicated transport adapter that delegates WebSocket framing/lifecycle to a real WebSocket implementation and maps malformed input or handler failures to controlled JSON-RPC outcomes.

### Boundary Crossings

```text
→ HTTP server upgrade at /rpc
→ web-rpc server transport adapter
→ shared JSON-RPC protocol helpers
→ RpcHandlers.handle
→ WebSocket response frame
```

### Risks and Assumptions

- RISK: adding a WebSocket package complicates ESM/types/build output → MITIGATION: choose a maintained Node WebSocket server package with available TypeScript types and verify `npm run build`.
- RISK: malformed frames/JSON can still throw out of socket event handlers → MITIGATION: adapter catches parse/protocol/handler errors and responds or closes deliberately; tests install failing handlers.
- ASSUMPTION: replacing hand-written frame parsing will not change product handler semantics → VALIDATE: existing `web-host.test.ts` WebSocket RPC cases continue to pass.

### Acceptance Criteria

✓ `web-rpc transport multiplexes one socket` — two JSON-RPC requests sent over one WebSocket connection receive two responses correlated by ID.  
✓ `web-rpc transport handles malformed JSON` — invalid JSON sent over `/rpc` returns a JSON-RPC parse error or deliberately closes without an uncaught server exception.  
✓ `web-rpc transport handles handler failures` — a throwing handler produces a JSON-RPC internal error response and keeps the host process alive.  
✓ `web-rpc transport rejects unsupported paths` — non-`/rpc` upgrades are rejected without installing product semantics elsewhere.  
✓ `hand-rolled frame parser retired` — `readWebSocketTextFrame` / `writeWebSocketTextFrame` and manual handshake code are deleted from `src/web-host.ts`.

### Verification Approach

- Inner: `npm run fix`; focused `web-rpc` adapter tests plus existing `web-host.test.ts`.
- Middle: WebSocket contract tests with malformed JSON, concurrent requests, handler throw, and non-linear transcript error propagation.
- Outer: not needed; this is transport safety.

### Cross-cutting obligations

- Preserve D10-L: browser talks over one WebSocket RPC transport, not REST.
- Preserve D19-L: transport adapter wraps `RpcHandlers`; it does not define product methods.
- Preserve D24-L: non-linear transcript errors remain product-shaped over WebSocket.

---

## Card 3 — Persistent browser RPC client

**Status:** queued  
**Weight:** full scope card

### Target Behavior

`createWebSocketRpcClient()` opens one persistent WebSocket per client instance and multiplexes concurrent JSON-RPC requests by ID.

### Boundary Crossings

```text
→ React/query call site
→ WebSocketRpcClient.request
→ persistent WebSocket connection state
→ shared JSON-RPC protocol helpers
→ pending promise resolution/rejection
```

### Risks and Assumptions

- RISK: requests issued before `open` are dropped or reordered accidentally → MITIGATION: queue outbound messages until the socket opens and assert both pre-open and post-open request paths.
- RISK: close/error leaves pending promises hanging → MITIGATION: reject all pending requests on socket close/error and clear the pending map.
- ASSUMPTION: subscriptions are not required for this slice → VALIDATE: public client interface remains `request()` + `close()` only, with no subscription semantics.

### Acceptance Criteria

✓ `persistent client opens one socket` — multiple `request()` calls on one client instance construct only one `WebSocket`.  
✓ `persistent client multiplexes concurrent requests` — out-of-order responses resolve the correct promises by JSON-RPC ID.  
✓ `persistent client rejects JSON-RPC failures` — server error responses reject with a useful error message/code surface.  
✓ `persistent client rejects pending work on close/error` — all in-flight requests settle when the connection fails.  
✓ `persistent client exposes close` — callers can close the client and no pending request remains unresolved.

### Verification Approach

- Inner: `npm run fix`; deterministic fake-`WebSocket` unit tests for client lifecycle.
- Middle: existing React app test plus WebSocket integration test proves the real client still reaches `workspace.snapshot`.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D33-L/I21-L: the persistent socket is client attachment state only, not durable Brunch session identity.
- Preserve room for subscriptions without implementing them in this card.

---

## Card 4 — Canonical web shell asset contract

**Status:** queued  
**Weight:** light scope card

### Objective

Make Vite's built `dist-web/index.html` the canonical browser shell served by web mode, with an explicit missing-bundle contract instead of a silently broken hard-coded shell.

### Acceptance Criteria

✓ `/` serves the built Vite `index.html` when `dist-web/index.html` exists, including the real script asset path.  
✓ `/assets/brunch-web.js` returns `200` with JavaScript content when the built asset exists.  
✓ Missing `dist-web` returns an explicit operator-facing error or startup failure that says to run `npm run build:web`, instead of serving HTML that points to a missing JS asset.  
✓ The duplicate `SHELL_HTML` source in `src/web-host.ts` is removed.

### Verification Approach

- Inner: `npm run fix`; web-host asset tests with temporary present/missing build directories or injectable asset root.
- Middle: `npm run build:web` followed by web-host test/contract proving `/` and the JS asset are both loadable.
- Outer: manual browser smoke can use the same contract later; not required for this card.

### Cross-cutting obligations

- Preserve D10-L: web shell remains native Brunch React, not `pi-web-ui`.
- Preserve no REST product reads: static assets are the only HTTP GET surface besides health/static shims.

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

## Card 5 — Stable React web runtime boundary

**Status:** queued  
**Weight:** light scope card

### Objective

Hoist the web app runtime so React renders do not recreate the TanStack Router, QueryClient, or WebSocket RPC client.

### Acceptance Criteria

✓ `createBrunchWebRuntime` or equivalent owns one `QueryClient`, one router, and one `WebSocketRpcClient` for the browser app lifetime.  
✓ `BrunchWebApp` re-rendering does not recreate the router or QueryClient.  
✓ Tests cover re-render behavior with a fake RPC client and preserve the existing workspace snapshot rendering.  
✓ Runtime cleanup closes the RPC client where the root/bootstrap path owns it.

### Verification Approach

- Inner: `npm run fix`; React component/runtime tests in jsdom.
- Middle: existing workspace snapshot query test proves the runtime still fetches through RPC.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D10-L: one browser WebSocket RPC client under the native React app.
- Preserve D33-L: runtime state is client attachment state, not durable session truth.

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

## Card 6 — Explicit read-only session projection target

**Status:** queued  
**Weight:** full scope card

### Target Behavior

`session.elicitationExchanges` can project a named session by durable session identity without relying on the current workspace default or raw file paths.

### Boundary Crossings

```text
→ JSON-RPC request params { sessionId, specId? }
→ session lookup/index over .brunch/sessions
→ durable brunch.session_binding validation
→ linear elicitation exchange projection
→ JSON-RPC success/failure response
```

### Risks and Assumptions

- RISK: adding explicit params reintroduces raw file access under another name → MITIGATION: accept product IDs only; lookup scans/uses session bindings under the workspace session directory.
- RISK: current no-param callers break before the web UI has a selector → MITIGATION: preserve no-param selected-session behavior temporarily for `workspace.snapshot`/current shell, but add explicit-params path and tests; do not add write methods.
- ASSUMPTION: a session directory scan is acceptable for POC-scale read-only projection → VALIDATE: tests create multiple sessions and lookup by binding/session ID deterministically.

### Acceptance Criteria

✓ `session.elicitationExchanges` with `{ sessionId }` reads the matching bound session even when `.brunch/state.json` points at another current session.  
✓ `{ sessionId, specId }` validates that the session binding belongs to the named spec and returns a product-shaped error on mismatch.  
✓ Raw file params remain rejected.  
✓ Non-linear transcript failures remain product-shaped for explicit session reads.  
✓ No web/browser write method is introduced.

### Verification Approach

- Inner: `npm run fix`; RPC handler/session lookup unit tests.
- Middle: WebSocket RPC contract test for explicit session projection with two sessions under one spec.
- Outer: not needed until visual multi-session dashboard work begins.

### Cross-cutting obligations

- Establish I21-L for read paths: client attachment/default workspace state is not canonical session identity.
- Preserve D24-L: explicit projection still rejects non-linear Pi JSONL.
- Preserve D19-L: this is still a named `session.*` projection handler, not a generic read gateway.
