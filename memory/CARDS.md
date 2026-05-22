# Scope cards — FE-737 web-shell final hardening and tie-off

## Orientation

- **Containing seam/frontier:** `web-shell` (FE-737, M3) — native Brunch web surface over named JSON-RPC method families, with WebSocket/stdin/browser/TUI surfaces as client attachments rather than Brunch sessions.
- **Current volatile state:** The previous queues landed WebSocket transport hardening, explicit read-only session projection, and a first browser transcript panel. Review now finds remaining tie-off debt: session-binding validation is still duplicated, explicit projection can be misconfigured without `cwd`, browser RPC error lifecycle is not terminal, transcript rendering shows IDs/metadata rather than content, and manual browser smoke remains outstanding.
- **Main open risk:** M3 could appear complete while the browser still proves only projection mechanics, not a real read-only transcript view over durable Pi JSONL transcript truth.
- **Frontier obligations:** preserve D5-L/D10-L/D12-L/D13-L/D19-L/D24-L/D33-L and I10-L/I19-L/I21-L; keep web read-only, keep transcript truth in Pi JSONL, reject non-linear sessions, avoid REST product reads, and do not add browser input or write ownership.

---

## Card 1 — Shared session-binding codec

**Status:** done  
**Weight:** full scope card

### Target Behavior

All code that creates, verifies, or reads `brunch.session_binding` uses one shared session-binding codec.

### Boundary Crossings

```text
→ WorkspaceSessionCoordinator session creation/binding
→ shared session-binding codec
→ workspace store oracle
→ session projection reader
→ durable Pi JSONL entries
```

### Risks and Assumptions

- RISK: the shared codec becomes a broad session-store abstraction instead of a narrow binding codec → MITIGATION: expose only constants/types/parse/create helpers for `brunch.session_binding`; leave session creation and projection ownership where they are.
- RISK: changing binding construction can perturb existing coordinator flush/reload behavior → MITIGATION: preserve emitted JSON shape byte-equivalent except for ordinary timestamp/id behavior already owned by Pi.
- ASSUMPTION: `WorkspaceSessionCoordinator`, store oracle, and session projection reader are the only current binding readers/writers → VALIDATE: repo search for `brunch.session_binding`, `SESSION_BINDING_TYPE`, and binding schema constants after refactor.

### Acceptance Criteria

✓ `binding codec is single-sourced` — only one module defines `brunch.session_binding`, binding schema version, binding data shape, and binding-entry parser/constructor.  
✓ `coordinator uses codec` — session creation/binding in `WorkspaceSessionCoordinator` uses the shared constructor/parser.  
✓ `store oracle uses codec` — `verifyWorkspaceSessionStores` validates bindings through the shared parser.  
✓ `projection reader uses codec` — explicit session lookup validates bindings through the shared parser.  
✓ `existing JSONL viability and coordinator tests pass` — no compatibility shim or duplicate validator remains.

### Verification Approach

- Inner: `npm run fix`; focused coordinator/projection-reader tests plus existing JSONL viability and workspace store oracle tests.
- Middle: grep/architectural assertion in tests or review that duplicate binding constants/parsers are gone.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D21-L: only coordinator/user-flow code creates or mutates Brunch session bindings.
- Preserve I8-L/I21-L: durable binding is canonical session/spec truth, not workspace default or client attachment state.
- Preserve D24-L: this codec does not introduce branch adaptation.

---

## Card 2 — Required cwd for RPC handlers

**Status:** done  
**Weight:** light scope card

### Objective

Make `createRpcHandlers` impossible to construct without the workspace cwd needed for explicit session projection.

### Acceptance Criteria

✓ `createRpcHandlers` requires `cwd` in its options type and all production/test call sites provide it.  
✓ explicit session projection no longer has an internal `explicitProjectionCwd()` throw path.  
✓ no-param selected-session fallback still works where intentionally tested.  
✓ explicit session projection tests still prove `openExisting()` is not called for explicit reads.

### Verification Approach

- Inner: `npm run fix`; TypeScript build plus RPC/web/fixture tests.
- Middle: existing explicit-session RPC tests prove the constructor cannot be misconfigured at runtime.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D33-L/I21-L: explicit reads use workspace resource identity, not transport/default state.
- Preserve D19-L: this is still named RPC handler construction, not a generic read gateway.

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

## Card 3 — Terminal browser RPC socket errors

**Status:** next  
**Weight:** light scope card

### Objective

Treat browser WebSocket `error` events as terminal connection failures until an explicit reconnect policy exists.

### Acceptance Criteria

✓ a socket `error` rejects all pending requests with the connection-failed error.  
✓ after a socket `error`, later `request()` calls reject immediately instead of being queued/sent.  
✓ close-after-error does not double-settle requests or change the terminal error unexpectedly.  
✓ existing explicit `close()` and protocol-failure behavior remains covered.

### Verification Approach

- Inner: `npm run fix`; fake-`WebSocket` lifecycle tests in `src/web-client/rpc-client.test.ts`.
- Middle: not needed.
- Outer: not needed.

### Cross-cutting obligations

- Preserve D33-L: this is client attachment lifecycle state only.
- Do not add reconnection or subscription semantics in this card.

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

## Card 4 — Transcript display projection

**Status:** queued  
**Weight:** full scope card

### Target Behavior

The browser transcript panel renders user/assistant transcript text from the selected linear Pi JSONL session through an explicit read-only session RPC projection.

### Boundary Crossings

```text
→ React transcript panel
→ WebSocketRpcClient.request(session.* with { sessionId, specId })
→ RPC handler
→ read-only session projection reader
→ Pi JSONL transcript entries
→ browser transcript content view
```

### Risks and Assumptions

- RISK: adding display content creates a parallel chat/turn store by accident → MITIGATION: derive display rows directly from linear Pi JSONL entries; no persistence, no browser-owned turn model.
- RISK: projection shape becomes final chat UI prematurely → MITIGATION: expose a modest read-only transcript display projection sufficient for M3 smoke; defer richer structured elicitation UI and browser input.
- RISK: content projection bypasses non-linear transcript policy → MITIGATION: reuse the same linear transcript loader/policy used by elicitation exchange projection.
- ASSUMPTION: assistant/user message text is enough for the first real transcript view → VALIDATE: tests render assistant and user content from a synthetic/real linear JSONL session; structured entries can remain summarized or omitted until structured UI work.

### Acceptance Criteria

✓ a named read-only `session.*` RPC method or enriched existing projection returns displayable transcript rows for explicit `{ sessionId, specId }`.  
✓ the projection validates durable `brunch.session_binding` and rejects non-linear transcripts with product-shaped errors.  
✓ React renders assistant and user message text, not only entry IDs/counts/status.  
✓ no selected session renders a no-session state without calling the session projection method.  
✓ no browser input, response submission, write method, or canonical chat/turn table is introduced.

### Verification Approach

- Inner: `npm run fix`; RPC projection tests and React/jsdom tests asserting rendered transcript text and explicit params.
- Middle: WebSocket RPC contract test with a real coordinator-created session containing assistant/user messages.
- Outer: covered by the manual browser smoke card after this lands.

### Cross-cutting obligations

- Preserve D12-L/D13-L/I10-L: transcript display derives from Pi JSONL and elicitation exchange projection, not a parallel store.
- Preserve D24-L/I19-L: reject non-linear sessions; do not flatten or branch-select.
- Preserve D33-L/I21-L: browser reads target explicit durable session identity.
- Preserve read-only web posture until write ownership/leases are designed.

---

## Card 5 — M3 manual browser smoke and projection postconditions

**Status:** queued  
**Weight:** light scope card

### Objective

Run and record the planned M3 manual browser smoke/projection postcondition pass for the read-only web shell.

### Acceptance Criteria

✓ built web mode serves the canonical Vite shell and JavaScript asset from `dist-web`.  
✓ browser opens the web shell and renders workspace chrome plus read-only transcript text for a coordinator-bound linear session.  
✓ WebSocket RPC traffic uses named `workspace.*` / `session.*` methods and explicit `{ sessionId, specId }` for session transcript reads.  
✓ non-linear selected/explicit session behavior remains product-shaped or is covered by existing automated test references in the smoke notes.  
✓ `memory/PLAN.md` current execution pointer is updated to either mark M3 browser-smoke debt complete or record any explicit remaining outer-loop debt.

### Verification Approach

- Inner: `npm run verify` before/after any runbook/doc edits.
- Middle: manual browser smoke paired with observable postconditions: served asset status, rendered chrome/transcript text, WebSocket method names/params, and no HTTP product read endpoints.
- Outer: qualitative manual browser check for “read-only dashboard over TUI/session truth” feel; no visual polish gate beyond correctness.

### Cross-cutting obligations

- Preserve D10-L/D19-L: WebSocket RPC, not REST product reads.
- Preserve D33-L: browser is an observer/client attachment, not the Brunch session.
- Preserve PLAN truth: do not tie off `web-shell` while manual smoke debt is silently outstanding.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
