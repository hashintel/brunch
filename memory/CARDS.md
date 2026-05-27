<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: petri-petrinaut-semantics (FE-761). -->

# Scope cards — FE-761 petri-petrinaut-semantics

Three-slice queue. Slice 1 and Slice 2 have landed; Slice 3 (the async
dispatch/complete refactor) remains scoped but unstarted. Splitting the
original Slice 2 turned out cleaner than the monolithic scope card: halted-
as-place is structural and observable on its own, while dispatch/complete
is an architectural lift that deserves its own scope card and risk pass.

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

## Slice 3: dispatch / complete decomposition for async producer transitions

**Status:** next

### Target Behavior

Every producer transition (`evaluate`, `run-tests`, `assess-semantic`, `verify-epic`) is split into a synchronous `dispatch:<step>` transition that publishes work to a `running:<step>:<scopeId>` place and a `complete:<step>:<outcome>` sibling pair that consumes from `running:*` and emits the reported token, decoupling handler invocation from completion so the petri-net no longer blocks on synchronous handler work.

### Boundary Crossings

```
→ src/orchestrator/src/net-blueprint.ts        (introduce DispatchDescriptor + CompleteDescriptor variants; producer descriptors retire — `action` / `run-tests` / `assess-semantic` / `verify-epic` become dispatch+complete pairs)
→ src/orchestrator/src/net-compiler.ts          (compileTopology: per slice, emit 4 dispatch transitions + 4 running:* places + 8 complete sibling transitions; verify-epic mirrors at epic scope)
→ src/orchestrator/src/petri-net.ts             (PetriNet.fire() splits into synchronous-dispatch fast-path and async-complete signal path; introduce signalCompletion(scopeId, step, outcome, reportId) API consumed by handler runners; remove synchronous handler invocation from fire kernel)
→ src/orchestrator/src/handler-runner.ts        (or equivalent — handlers now receive a completion callback and produce tokens via signalCompletion, not via synchronous return; this seam may need to be extracted first if no clean boundary exists in petri-net.fire today)
→ src/orchestrator/src/topology.test.ts         (adapter goldens updated for dispatch/complete/running counts and shapes)
→ src/orchestrator/src/engine-contract.test.ts  (runtime-equivalence assertions unchanged; async-completion ordering invariants added)
```

### Risks and Assumptions

```
- RISK: Async completion changes firing order — a handler that completes before its sibling guard sees the running token may race. → MITIGATION: signalCompletion always enqueues onto a single-threaded petri-net step loop; complete transitions are the only consumers of running:* places; add ordering contract test.
- RISK: handler-runner shape may not yet exist as a single file; current producer fire closures embed completion logic. → MITIGATION: First step of build is locating the synchronous handler boundary in petri-net.fire / net-compiler producer closures; if no clean seam exists, extract one before the dispatch/complete split. May warrant an `ln-spike` if the seam is hidden.
- RISK: verify-epic operates at epic scope, not slice scope — running:verify:<epicId> place naming must stay coherent with slice-scoped running:*. → MITIGATION: Adopt `running:<step>:<scopeId>` convention where scopeId is sliceId or epicId; document in topology.test.ts goldens.
- ASSUMPTION: Single-threaded petri-net step loop is acceptable (no concurrent fire). → VALIDATE: existing engine-contract suite remains green; no test currently asserts concurrent fire. [→ memory/SPEC.md §Assumptions]
- ASSUMPTION: Topology growth ≈ +4 running:* places + +8 complete sibling transitions per slice (dispatches replace producers 1:1, so producer count is net-zero). Plus +1 running:verify:<epicId> per verified epic. → VALIDATE: topology adapter test asserts new counts.
- ASSUMPTION: Read-arc / pool-budget question stays deferred — dispatch/complete pairs continue consume+return on budget places. [→ open coordination item lives in PLAN.md FE-761 frontier]
```

### Acceptance Criteria

```
✓ dispatch-complete-shape — for every former producer, blueprint contains exactly one DispatchDescriptor and one CompleteDescriptor-pair (one per outcome sibling); producer variants are absent from HandlerDescriptor union.
✓ running-place-per-dispatch — each dispatch transition emits to exactly one `running:<step>:<scopeId>` place and the matching complete siblings are the only consumers.
✓ async-completion-ordering — contract test invokes a handler that defers completion across an event-loop tick; engine continues to step other independent transitions and consumes the completion deterministically.
✓ engine-contract-suite-green — all engine-contract tests pass, including budget exhaustion and verify-epic halt-on-fail paths.
✓ topology-counts-pinned — adapter test asserts post-refactor place + transition counts for simplePlan, depPlan, and fixtures/txt plan.
✓ cook-smoke-green — `brunch cook fixtures/txt/` drives a real run to completion using async dispatch/complete.
```

### Verification Approach

```
- Inner: Vitest engine-contract suite (existing) + new adapter tests over compileTopology — proves runtime equivalence + dispatch/complete topology.
- Middle: New async-completion ordering contract test that defers handler completion across ticks.
- Outer: End-to-end `brunch cook fixtures/txt/` smoke run — confirms async lifecycle drives a real cook to completion.
```

---
