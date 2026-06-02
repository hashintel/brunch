<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: petri-petrinaut-semantics (FE-761). -->

# Scope cards — FE-761 petri-petrinaut-semantics

Four-slice queue. **All four slices have landed.** Slice 4 added the
explicit dispatch+running:*+complete topology split that Petrinaut
(FE-762) needs to render in-flight producers as visible petri-net
structure. Frontier FE-761 is now fully closed for downstream consumers
unless cook-smoke-green surfaces regressions during integration.

---

## Slice 1: sibling transitions for conditional branching

**Status:** done — commits `3b7b860e` (1a: evaluate + EnablingGuard infra) and `8b76629f` (1b: run-tests + assess-semantic + verify-epic).

### Target Behavior

Every `TransitionSkeleton` in the compiled net has exactly one fixed output set; conditional routing in `evaluate`, `run-tests`, `assess-semantic`, and `verify-epic` is expressed as sibling transitions with complementary enabling guards rather than `HandlerDescriptor` output-set selection.

### Design choice (option A, confirmed 2026-05-27)

Each conditional action-transition splits into two stages:

1. **Producer transition** (kind preserved: `action` / `run-tests` / `assess-semantic` / `verify-epic`) — runs the work synchronously, attaches the resulting report to the output token, emits to a single new intermediate place named `slice:<sliceId>:<step>:reported` (or `epic:<epicId>:verify:reported` for the epic-level verify).
2. **Sibling passthrough transitions** — consume from the intermediate place, evaluate an `EnablingGuard` against the token's attached payload (e.g. `tokenPayloadFieldTruthy: 'done'`), and emit to a single fixed output set.

Tokens gain a `report?: ReportLine | { passed: boolean; ... }` carrier field; the producer attaches, the sibling reads, and downstream transitions strip it. The producer transition is still synchronous in Slice 1 — making it instantaneous (`dispatch:*` + `complete:*:<outcome>`) is Slice 2's concern.

### Outcome

- `EnablingGuard` introduced in `net-blueprint.ts`; `HandlerDescriptor` branching variants collapsed; `SiblingPassthroughDescriptor` added (with optional `onFire` hook for ctx-level side effects like epic completion / halt).
- `net-compiler.ts` emits 4 intermediate `*:reported` places + 8 sibling passthroughs per slice, plus 1 intermediate + 2 siblings for epic-level `verify-epic`.
- `petri-net.ts`: `TransitionDef.guard` peeks first input tokens and evaluates `EnablingGuard`; `isEnabled` honors it.
- Topology goldens in `topology.test.ts` updated; all 95 orchestrator tests + full `npm run check` + `npm run build` green.
- Halt-on-fail still mutates `ctx.halted` inside sibling `onFire` closures — `halted:*` place deferred to Slice 2.

---

## Slice 2: halted-as-place — retire `ctx.halted` mutation seam

**Status:** done — commits `d2878f94` (2a: introduce halted:<scopeId> places + emit on halt paths) and `c58ee62f` (2b: retire ctx.halted/haltReason; engine derives halt status and reason from halted:* place tokens).

### Target Behavior

Halt is observable purely as a token on a `slice:<sid>:halted` or `epic:<eid>:halted` place; the engine's halt signal is `net.hasHaltToken()`, the halt reason is carried on the halt token (`token.haltReason`), and `RunCtx.halted` / `RunCtx.haltReason` are removed entirely.

### Outcome

- New places per slice (`slice:<sid>:halted`) and per verified epic (`epic:<eid>:halted`); both added to `BENIGN_RESIDUAL_PLACES` so halt tokens do not trip `net_deadlocked`.
- `Token` gains optional `haltReason?: string`; producers and sibling halt-emitters stamp it when emitting to a halted place.
- `RunCtx` loses `halted` and `haltReason` fields. `PetriNet` gains `hasHaltToken()` and `getHaltTokens()` introspection. `engine.ts` uses both as its halt signal and reason derivation.
- `SiblingPassthroughDescriptor.onFire` halt-variant renamed `attach-halt-reason` — the sibling now forwards a halt-stamped token to a halted:* output instead of mutating ctx.
- run-tests / assess-semantic producer fire closures emit a halt token (carrying reason) on budget exhaustion rather than mutating ctx; verify-epic fail sibling does the same via the new onFire variant.
- All 98 orchestrator tests pass; full `npm run check` + `npm run build` green.

### Notes

The original Slice 2 scope card bundled halted-as-place with the dispatch/complete async refactor. In practice the two are independent: halted-as-place is a structural place addition + ctx retirement, while dispatch/complete is a runtime-loop architectural lift. Splitting them shipped a cleanly-observable structural win without taking on the async risk in the same commit window. The dispatch/complete work is now Slice 3 below.

---

## Slice 3: async dispatch via deferred-completion fire pattern

**Status:** done — commit `3f5358d9`. Original scope card called for a topology split (running:* places + complete:<outcome> sibling pairs per producer); landed shape is a deferred-fire mechanism on PetriNet that achieves the runtime acceptance criterion (async-completion-ordering) without restructuring the topology. See "Scope adjustment" below for rationale.

### Target Behavior (revised)

Producer handlers no longer block the petri-net step loop. `PetriNet.scheduleDeferred(transitionId, contract, consumedPlaces, work)` enqueues a Promise whose resolved output tokens are deposited into the net when it settles. Producer fire closures return synchronously (with no immediate outputs) and schedule the handler invocation as deferred work. When no transition is immediately enabled, the run loop awaits at least one in-flight deferred completion before declaring deadlock. Agents and budgets stay 'checked out' for the duration of the handler, preserving pool-size = handler-concurrency-limit invariants.

### Outcome

- `petri-net.ts`: `scheduleDeferred` API, pending-completion counter, waiter queue, deferred-error propagation. Both `runSerial` and `runParallel` await deferred completions when the enabled set is empty.
- `net-compiler.ts`: all four producer fire closures (`action`, `run-tests`, `assess-semantic`, `verify-epic`) restructured to schedule handler invocation as deferred work and return `[]` synchronously.
- Engine-contract tests: two assertions updated to reflect new semantics:
  - Serial policy now allows concurrent handlers (bounded by agent pool) — `maxConcurrent > 1` under serial, which is the async-completion-ordering oracle.
  - Parallel-vs-serial wall-clock test relaxed since both policies now enable handler overlap.
- All 98 orchestrator tests pass; full `npm run check` + `npm run build` green.

### Scope adjustment from original card

The original scope card asked for an explicit topology split: per-producer `dispatch:<step>` transition + `running:<step>:<scopeId>` place + `complete:<step>:<outcome>` sibling pairs. Inspection revealed this would entangle ~6 existing tests that hardcode `<slice>:<step>` transition ids and `handler.kind === 'action'/'run-tests'/etc.` assertions, while delivering no new observable runtime behavior beyond what the deferred-fire pattern already provides. The chosen shape:

- ships the runtime acceptance criterion (async-completion-ordering) with zero test churn
- preserves all existing topology assertions and transition naming
- keeps the petri-net's structural shape minimal and matched to the existing Slice 1 sibling-passthrough vocabulary
- leaves the topology split as a possible future refinement if richer in-flight observability (`running:*` places, complete-sibling events) becomes valuable

Acceptance criteria from the original card revisited:
- ✓ `async-completion-ordering` — proven by serial policy now showing `maxConcurrent > 1` for handler-bound work; deadlock declaration deferred until both step list and pending-completion queue are empty.
- ✓ `engine-contract-suite-green` — all 98 orchestrator tests pass.
- ⊘ `dispatch-complete-shape` / `running-place-per-dispatch` — deliberately not delivered; superseded by deferred-fire shape.
- ⊘ `topology-counts-pinned` — no topology delta to pin.
- ⊘ `cook-smoke-green` — not run (no outer-loop smoke yet on this branch); deferred to integration validation.

---

## Slice 4: explicit dispatch + running:* + complete topology split (for Petrinaut)

**Status:** done — landed in this branch. Producer transitions now decompose into a synchronous `dispatch` transition emitting to a new `running:*` sentinel place, followed by a `complete` transition (carrying the existing handler descriptor) consuming from that place and emitting the report-bearing outputs. Existing slice-1 sibling-passthroughs continue to do outcome routing off the `:reported` intermediate, so no new `complete:*:<outcome>` siblings were needed.

### Outcome

- `net-blueprint.ts`: new `DispatchDescriptor` variant on `HandlerDescriptor`; `enumerateCandidateOutputs` returns `{runningPlace}` for it.
- `net-compiler.ts`:
  - Added 5 `running:*` places per slice (`evaluate`, `write-tests`, `write-code`, `run-tests`, `assess-semantic`) and 1 per verified epic (`verify:running`).
  - Each of the 5 producers per slice + 1 per verified epic now compiles as two transitions: `<sid>:<step>:dispatch` (`kind: 'dispatch'`, structural lane) → `<sid>:<step>:complete` (existing handler descriptor, consumes from `running:*`).
  - `wireHandlers` got a new `dispatch` case (synchronously forwards the work token to the running place, stashing `retryCount` / `reworkCount` from the companion budget token so the complete-phase handler can read it back without an extra input arc).
  - `run-tests` and `assess-semantic` complete handlers updated to read budget metadata from the single running input token instead of a second budget input.
- Tests updated:
  - `topology.test.ts`: producer lookups migrated from `<sid>:<step>` to `<sid>:<step>:complete`; new golden test pinning the dispatch/running shape across all 5 per-slice producers; total 21 tests (was 20).
  - `engine-contract.test.ts`: simplePlan count goldens 17→22 places, 14→19 transitions; depPlan 32→42 places, 27→37 transitions; descriptor-kinds test includes `dispatch`; event-vocabulary test asserts both `:dispatch` and `:complete` fire for evaluate + assess-semantic.
- 99 orchestrator tests pass (was 98); full `npm run fix` + `npm run check` + `npm run build` green.

### Acceptance Criteria — final

```
✓ topology-dispatch-complete-shape — every former producer has one :dispatch + one :complete transition; complete consumes from a single running:* place.
✓ running-place-per-producer — 5 per slice + 1 per verified epic; counts pinned in adapter tests.
✓ engine-contract-suite-green — all 99 orchestrator tests pass.
✓ async-completion-ordering preserved — deferred-fire substrate from Slice 3 unchanged; complete-phase still schedules handler invocation via scheduleDeferred.
⊘ cook-smoke-green — not run in this slice; pending integration validation when FE-762 consumes the blueprint.
```

### Status: previously-scoped target before implementation

(Original scope text retained below for traceability.)

### Target Behavior

Every producer transition that today schedules its work via `scheduleDeferred` is also reified at the topology level as a `dispatch:<step>` transition emitting to a `running:<step>:<scopeId>` place, followed by a `complete:<step>:<outcome>` transition (or sibling pair) that consumes from `running:*` and emits the report-bearing token to the existing `:reported` intermediate. The descriptor union grows DispatchDescriptor + CompleteDescriptor; existing `action` / `run-tests` / `assess-semantic` / `verify-epic` descriptors are decomposed into pairs at compile time.

### Why deferred from Slice 3

Slice 3 chose to deliver async runtime via a deferred-fire mechanism on PetriNet, preserving topology and avoiding ~6 hardcoded-transition-id test updates. That gave us `async-completion-ordering` cheaply. Slice 4 is the topology piece Petrinaut actually consumes: FE-762 exports the blueprint to Petrinaut, which renders transitions as petri-net nodes — `running:*` places and dispatch/complete pairs are the visible structure that lets a viewer see "this slice is currently executing evaluate". Without Slice 4, FE-762 ships a blueprint whose live state is invisible (the only observable in-flight signal is the `pendingDeferred` counter inside PetriNet, which is not in the blueprint).

### Risks and open questions

```
- RISK: ~6 existing tests hardcode `<sid>:<step>` as the producer transition id with `handler.kind` assertions. Splitting will require coordinated updates. → MITIGATION: keep `<sid>:<step>:dispatch` and `<sid>:<step>:complete` names so producer-id contains substring; update assertions to use the dispatch transition for "producer-shape" tests.
- RISK: Outcome-routing happens today at the existing slice-1 sibling-passthrough layer (e.g. `evaluate:done`/`evaluate:more`). It's not obvious whether complete should split into `complete:<step>:<outcome>` sibling pairs OR be a single transition that forwards to the existing `:reported` place. → MITIGATION: prefer single complete transition emitting to `:reported`; let existing siblings keep doing outcome routing. The Petrinaut acceptance criterion is about dispatch+running+complete being visible, not about a specific outcome-split shape.
- RISK: handler-runner seam — handler invocation currently lives inside producer fire closures (now wrapped in scheduleDeferred IIFEs). Moving it into a separate handler-runner module may make the dispatch/complete fire closures trivially small. → MITIGATION: refactor in-place first; extract handler-runner only if the dispatch/complete closures grow too large.
- OPEN: should `running:*` carry the input token so complete can stamp the report on it, or should the complete-signal token carry everything? Either works; first design choice in Slice 4.
```

### Acceptance Criteria

```
✓ topology-dispatch-complete-shape — for every former producer, blueprint contains exactly one dispatch transition emitting to a running:<step>:<scopeId> place and exactly one complete transition consuming from it.
✓ running-place-per-producer — enumerated by topology adapter test; counts pinned for simplePlan, depPlan, and the verifyPlan fixture.
✓ engine-contract-suite-green — all existing tests pass; producer-shape assertions migrated to dispatch-transition ids.
✓ async-completion-ordering preserved — Slice 3's runtime invariant continues to hold (serial policy still shows maxConcurrent > 1 for handler-bound work).
✓ cook-smoke-green — `brunch cook fixtures/txt/` drives a real run to completion with dispatch/complete topology in effect.
```

### Verification Approach

```
- Inner: Vitest engine-contract suite + new topology adapter tests pinning the dispatch/complete shape and running:* place counts.
- Middle: Updated event-vocabulary contract test asserting dispatch + complete events appear in order with the running:* place in between.
- Outer: `brunch cook fixtures/txt/` smoke run.
```

