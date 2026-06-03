# RPC session method judo

Frontier: live-graph-observer | n/a
Status:   active
Mode:     chain
Created:  2026-06-03

## Orientation

- Containing seam: `rpc/` owns Brunch JSON-RPC method discovery/dispatch; `session/` owns transcript projection, structured-exchange reconstruction, runtime-state projection, and Pi JSONL session mechanics.
- Frontier item: `live-graph-observer` (FE-795). This is branch-local refactor hardening before continuing the web graph overview panel.
- Volatile handoff/review state: the RPC registry/read-only sidecar refactor is accepted in shape, but `src/rpc/methods/session.ts` is now a 1015-line hotspot and `session.runtimeState` discovery does not exactly describe its explicit-`specId` requirement.
- Main open risk: moving the old mega-handler pressure sideways instead of deleting adapter complexity. Keep behavior stable, but make the JSON-RPC file a thin adapter over session-owned transcript helpers.
- Cross-cutting obligations: preserve D19-L thin named RPC methods, D33-L read-only web sidecar semantics, D40-L transcript-backed runtime state, D41-L boundary schema truth, and D52-L source topology / topology README accuracy.

## Card 1 — done — Exact session RPC discovery contract

### Objective

`rpc.discover` describes the exact parameter contract enforced by each current `session.*` method.

### Acceptance Criteria

✓ `session.runtimeState` discovery — params schema requires both `sessionId` and `specId`, matching the handler's explicit-target policy.
✓ Selected-or-explicit reads — `session.pendingExchange` and `session.exchanges` keep their existing selected-session-or-explicit target behavior unless the builder finds a current test/spec contradiction.
✓ Read-only sidecar discovery — TUI-started web sidecar discovery still lists only read methods and still omits `workspace.activate`, `session.triggerExchange`, and `session.submitExchangeResponse`.
✓ Retired names — no retired RPC method name re-enters discovery or product handlers.

### Verification Approach

- Inner: `npm test -- src/rpc/handlers.test.ts src/rpc/web-host.test.ts` — proves full/read-only discovery and handler policy match.
- Inner: focused schema assertion in `src/rpc/handlers.test.ts` — `Value.Check(runtimeState.paramsSchema, { sessionId })` fails while `{ sessionId, specId }` passes.

### Cross-cutting obligations

- Keep discovery and dispatch generated from the same registry; do not add a side allow-list or compatibility alias.
- Keep `session.submitMessage` reserved/future and absent from discovery.

### Assumption dependency

None — this is contract tightening inside the settled D19-L/D48-L/D49-L surface.

### Expected touched paths (tentative)

```pseudo
src/rpc/
├── handlers.test.ts             ~
└── methods/
    └── session.ts               ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 2 — next — Session RPC adapter sheds transcript mechanics

### Target Behavior

`src/rpc/methods/session.ts` becomes a thin JSON-RPC method adapter while structured-exchange transcript mechanics live behind a session-owned helper.

### Boundary Crossings

```pseudo
→ JSON-RPC session.* request
→ rpc/methods/session.ts method adapter
→ session/ projection or structured-exchange helper
→ Pi JSONL Brunch session envelope / session manager
→ JSON-RPC response and product-update invalidation
```

### Risks and Assumptions

- RISK: the refactor only moves a 1000-line blob into another 1000-line blob.
  → MITIGATION: move one cohesive helper cluster only; prefer one session helper plus tests over speculative folders. Delete duplicate parsing/materialization from the RPC adapter.
- RISK: session-owned helpers accidentally learn JSON-RPC protocol details.
  → MITIGATION: `session/` helpers return domain results/errors; `rpc/methods/session.ts` maps those to JSON-RPC codes/messages.
- RISK: private Pi flush mechanics sprawl into a new seam.
  → MITIGATION: keep `_rewriteFile`/`setSessionFile` behind the smallest existing or new helper needed for this deterministic write path; do not generalize Pi session persistence.
- ASSUMPTION: the deterministic structured-exchange loop remains the current implementation behind `session.triggerExchange` until the real agent loop is scoped.
    → IMPACT IF FALSE: this slice should delete the deterministic proof driver instead of moving it.
    → VALIDATE: check D49-L/I32-L and existing public-RPC parity tests before moving code.

### Tracer-bullet check

- Invariants: restores D52-L topological truth by keeping transcript reconstruction in `session/` and JSON-RPC framing in `rpc/`.
- Test surface: public RPC handler tests continue to cross the same product boundary while new session tests cover the extracted domain helper directly.

### Acceptance Criteria

✓ Adapter thinness — `src/rpc/methods/session.ts` no longer contains the deterministic exchange script, markdown option parser, or response toolResult materialization logic.
✓ Session ownership — a `src/session/*` helper owns pending structured-exchange reconstruction and response materialization without importing from `src/rpc/*`.
✓ Public behavior unchanged — `session.triggerExchange`, `session.pendingExchange`, `session.submitExchangeResponse`, `session.exchanges`, and `session.runtimeState` keep their current success/error behavior and update publication.
✓ Helper oracles — focused session tests cover text, single-select, multi-select, invalid mode, invalid option, Other/None comment requirement, and markdown-option fallback behavior.
✓ Topology README — `src/session/README.md` is updated if a new session helper module is added.
✓ Size/depth check — the RPC session adapter is back below the 1000-line judo threshold with visible internal organization.

### Verification Approach

- Inner: `npm test -- src/rpc/handlers.test.ts src/session/runtime-state.test.ts` — proves current public RPC/session projection behavior remains stable.
- Inner: `npm test -- src/session/<new-helper>.test.ts` — proves extracted structured-exchange helper behavior at the session seam.
- Inner: `npm run fix` on touched files after implementation.
- Gate before commit: `npm run verify` if the builder owns all resulting changes; otherwise run the narrow tests above and report unrelated failures.

### Cross-cutting obligations

- No retired public method aliases or discovery entries.
- No web write surface; sidecar remains read-only by registry selection.
- No generic read gateway, view store, or DB-backed chat/turn projection.
- No direct `db/` import from `rpc/`, `session/`, or `web/`.

### Expected touched paths (tentative)

```pseudo
src/rpc/
├── handlers.test.ts             ~
└── methods/
    └── session.ts               ~
src/session/
├── README.md                    ~
├── structured-exchange-loop.ts  +
└── structured-exchange-loop.test.ts +
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
