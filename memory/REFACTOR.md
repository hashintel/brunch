# RPC surface and handler decomposition refactor

## Problem Statement

The RPC surface currently preserves proof-era method names and concentrates almost all protocol behavior in one oversized handler module. The read-only web sidecar is behaviorally protected, but it is implemented as an allow-list check in front of the same mutation-capable dispatcher, with discovery filtered by a second method-name list. That structure leaves three risks: stale public vocabulary keeps leaking into new work, the sidecar/full split can drift from discovery, and every new projection pushes the mega-module farther past the 1000-line warning threshold.

Current shape:

```pseudo
tree current:
  rpc/
    handlers.ts
      createRpcHandlersForSurface(surface)
        allow/deny by READ_RPC_METHODS
        if method == rpc.discover
        if method == workspace.snapshot
        if method == workspace.selectionState
        if method == workspace.activate
        if method == session.startElicitation        # stale proof-era name
        if method == session.pendingExchange
        if method == elicitation.respond            # stale non-session family
        if method == session.elicitationExchanges   # stale proof-era name
        if method == session.transcriptDisplay      # debug/display projection in product surface
        if method == session.runtimeState
        if method == graph.overview
        if method == graph.nodeNeighborhood
      PUBLIC_RPC_METHOD_DISCOVERY
      schemas for every family
      helper bodies for every family
    methods/surface.ts
      READ_RPC_METHODS duplicates part of discovery/dispatch truth
```

The code works, but it makes the next web/rendering work pay for yesterday's naming debt and for a handler shape that cannot get deeper by adding more methods.

## Solution

Make the product method registry the source of truth. Split handlers by method family, generate discovery and surfaces from that registry, and hard-rename proof-era methods with no compatibility aliases, adapters, or migrations. This is a pre-release branch with free-rewrite posture; stale names should disappear rather than be preserved.

Desired shape:

```pseudo
tree desired:
  rpc/
    handlers.ts
      createRpcHandlers(options)         -> dispatch(fullRegistry)
      createReadOnlyRpcHandlers(options) -> dispatch(readOnlyRegistry)
    methods/
      registry.ts
        fullRegistry = readMethods + writeMethods
        readOnlyRegistry = readMethods
        discover(registry)
      workspace.ts
        workspace.snapshot
        workspace.selectionState
        workspace.activate
      session.ts
        session.triggerExchange
        session.pendingExchange
        session.submitExchangeResponse
        session.exchanges
        session.runtimeState
        # session.submitMessage reserved until behavior is scoped; absent from discovery if not implemented
      graph.ts
        graph.overview
        graph.nodeNeighborhood
      schemas.ts or family-local schemas
        protocol schemas owned near their handlers
```

Control-flow desired:

```pseudo
graph current:
  request -> surface allow-list -> giant if-chain -> discovery filtered by separate list

 graph desired:
  request -> registry lookup -> handler
                    └── discovery generated from same registry

 deleted:
  READ_RPC_METHODS drift
  sidecar special-case branching inside dispatcher
  proof-era public method names
  transcriptDisplay as default web sidecar product API
```

Target public vocabulary for this refactor:

```pseudo
rpc.discover
workspace.snapshot
workspace.selectionState
workspace.activate
session.triggerExchange
session.pendingExchange
session.submitExchangeResponse
session.exchanges
session.runtimeState
graph.overview
graph.nodeNeighborhood
```

`session.submitMessage` is acknowledged as the likely next session write method for non-exchange user text or explicit interruption, but it should not be added as a discovered stub unless this refactor also implements real behavior. `session.transcriptDisplay` should be removed from the normal sidecar/product discovery surface; if still useful for CLI diagnostics, keep it internal or full-host/debug-only only after naming that need explicitly.

## Commits

## Status

Completed and committed:

```pseudo
done:
  0 lexicon pass:
    commit: 39f91fc8 refactor rpc lexicon
    notes:
      - SPEC/RPC/web docs use canonical `session.triggerExchange`,
        `session.submitExchangeResponse`, and `session.exchanges`.
      - Proof-era names are quarantined only as retired vocabulary where needed.

  1 test/doc/probe vocabulary rename:
    commit: be5a1dab rename rpc method expectations
    notes:
      - RPC tests, WebSocket host tests, CLI/stdout tests, web RPC-client tests,
        and public parity probe expectations target the new method names.

  2 hard session lifecycle method rename:
    commit: c696fc3c rename session rpc handlers
    notes:
      - `session.startElicitation` -> `session.triggerExchange`.
      - `elicitation.respond` -> `session.submitExchangeResponse`.
      - `session.elicitationExchanges` -> `session.exchanges`.
      - Product-update topics and probe calls follow the renamed methods.
      - No compatibility aliases were kept.

  3 transcript-display cut:
    commit: c6aab18f remove transcript display from product rpc
    notes:
      - `session.transcriptDisplay` was removed from product discovery/dispatch.
      - Normal web routes no longer request transcript display.
      - Sidecar discovery no longer exposes transcript display.

  4 typed registry introduction:
    commit: 4987fbb8 introduce rpc method registry
    notes:
      - `src/rpc/methods/registry.ts` defines method definitions with handler,
        schemas, examples, access classification, and description.
      - `rpc.discover` is generated from the active registry.

  5 registry-selected surfaces:
    commit: 38a3700c select rpc surface by registry
    notes:
      - Full host dispatches through the full registry.
      - Read-only sidecar dispatches through a read-only registry.
      - `src/rpc/methods/surface.ts` and the duplicated read-method set were deleted.

  6 workspace method extraction:
    commit: 98fd873b extract workspace rpc methods
    notes:
      - Workspace method schemas and handlers moved to `src/rpc/methods/workspace.ts`.

  7 graph method extraction:
    commit: 2a4062f2 extract graph rpc methods
    notes:
      - Graph method schemas and handlers moved to `src/rpc/methods/graph.ts`.

  8 session method extraction:
    commit: a2c9fa2a extract session rpc methods
    notes:
      - Session method schemas, registry entries, projections, exchange-response
        handling, pending-exchange recovery, and update publication moved to
        `src/rpc/methods/session.ts`.
```

Focused verification after item 8:

```pseudo
passed:
  npm run fix
  npm test -- \
    src/rpc/handlers.test.ts \
    src/rpc/web-host.test.ts \
    src/brunch.test.ts \
    src/probes/public-rpc-parity-proof.test.ts \
    src/session/elicitation-exchange.test.ts \
    src/session/workspace-session-coordinator.test.ts
```

Remaining:

```pseudo
todo:
  9 tighten session.runtimeState result schema:
    status: not started
    notes:
      - Current extraction preserved existing runtime-state behavior/schema.
      - Next step should explicitly shape or omit transcript/world detail bags.

  10 final ln-sync-style drift pass:
    status: not started
    notes:
      - Run only after item 9 lands.
      - Check SPEC D49/D19, RPC/web READMEs, active cards, probe docs, and
        lexicon for unqualified proof-era names.
      - Reconcile durable facts, then remove this temporary refactor file if exhausted.
```

0. Run an `ln-sync`-style lexicon pass before code movement: make `session.triggerExchange`, `session.submitExchangeResponse`, and `session.exchanges` canonical in SPEC/PLAN/RPC/web/probe docs; remove or clearly quarantine proof-era names; repair card references to deleted scope files. This is not a compatibility note — it is ontology repair so later commits are not guided by stale vocabulary.
1. Rename the RPC method vocabulary in tests, docs, and probe expectations to the target names, with no aliases for the old names. This should fail until dispatch is renamed.
2. Hard-rename existing session lifecycle handlers: `session.startElicitation` becomes `session.triggerExchange`, `elicitation.respond` becomes `session.submitExchangeResponse`, and `session.elicitationExchanges` becomes `session.exchanges`. Update product-update topics and web query keys to match. Do not preserve old method names.
3. Decide and apply the transcript-display cut: remove `session.transcriptDisplay` from sidecar discovery and web route dependencies, or keep it as an explicitly named debug/full-host-only method if a current CLI/probe need justifies it.
4. Introduce a typed method registry where each method owns its handler, schemas, examples, mutability/readability classification, and description. Generate `rpc.discover` from the registry.
5. Replace the surface allow-list with registry selection: full host dispatches against the full registry; TUI-started web sidecar dispatches against the read-only registry. Delete the duplicated read-method set.
6. Extract workspace methods into their family module while preserving existing behavior and tests.
7. Extract graph methods into their family module while preserving existing behavior and tests.
8. Extract session methods into their family module while preserving existing behavior and tests.
9. Tighten `session.runtimeState` result schema so public RPC does not expose raw transcript detail bags; either shape the world changeset explicitly or omit it until a real producer contract exists.
10. Finish with a second `ln-sync`-style drift pass after the code shape is real: SPEC D49/D19, RPC/web READMEs, active cards, probe docs, and lexicon should contain no unqualified proof-era method names; any retained diagnostic-only method must be explicitly scoped and absent from sidecar discovery.

Each commit should leave focused RPC tests passing. Run file-scoped or package-scoped tests after each extraction; run the full gate before committing the completed refactor.

## Decisions

- No compatibility aliases for proof-era RPC names.
- `session.*` owns session interaction methods; `elicitation.*` is not a public family for this surface.
- `triggerExchange` is the canonical name for advancing/starting/resuming the assistant-first exchange loop.
- Method discovery is generated from the active registry for the host surface; discovery cannot describe methods that dispatch rejects.
- The web sidecar is read-only by construction through registry selection, not by a scattered allow/deny branch.
- Transcript display is not part of the normal product web sidecar contract unless a current diagnostic need is explicitly accepted.
- `session.submitMessage` is reserved but not exposed as a placeholder unless the refactor includes real behavior.

## Testing Decisions

- Characterization coverage already exists around discovery, WebSocket sidecar rejection, stdio RPC, public parity probe, graph reads, session projections, and update notifications. First commits should update these tests to the new vocabulary rather than add aliases.
- Discovery tests should assert exact method names per surface and verify every example method is dispatchable on that same surface.
- Sidecar tests should prove mutation names are absent from discovery and rejected as method-not-found, while read methods still work over the real WebSocket host.
- Product-update tests should assert renamed topics where topics mirror method names.
- Runtime-state tests should prove the tightened result shape, especially world/changeset behavior.
- The public RPC parity probe should be updated to drive `session.triggerExchange`, `session.submitExchangeResponse`, and `session.exchanges` only.

## Out of Scope

- Implementing a new `session.submitMessage` behavior unless deliberately pulled into this refactor as a real product method.
- Building a generic RPC framework, generic records/read gateway, REST layer, or durable event store.
- Changing graph persistence, CommandExecutor semantics, or structured-exchange transcript carriers.
- Web graph overview rendering beyond whatever minimal edits are required to stop depending on removed transcript-display methods.
- Compatibility migrations for old probe artifacts or old clients.
