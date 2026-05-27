<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: petri-petrinaut-semantics (FE-761). -->

# Scope cards — FE-761 petri-petrinaut-semantics

Two-slice queue. Slice 1 has landed; Slice 2 is now scoped against the post-Slice-1 topology.

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

## Slice 2: dispatch / complete decomposition for async producer transitions

**Status:** next

### Target Behavior

Every producer transition (`evaluate`, `run-tests`, `assess-semantic`, `verify-epic`) is split into a synchronous `dispatch:<step>` transition that publishes work to a `running:<step>:<sliceId>` place and a `complete:<step>:<outcome>` sibling pair that consumes from `running:*` and emits the reported token, decoupling handler invocation from completion so the petri-net no longer blocks on synchronous handler work.

### Boundary Crossings

```
→ src/orchestrator/src/net-blueprint.ts        (introduce DispatchDescriptor + CompleteDescriptor variants; producer descriptors retire — `action` / `run-tests` / `assess-semantic` / `verify-epic` become dispatch+complete pairs; add halted:<sliceId> place to retire ctx.halted side effect)
→ src/orchestrator/src/net-compiler.ts          (compileTopology: per slice, emit 4 dispatch transitions + 4 running:* places + 8 complete sibling transitions + 1 halted:<sliceId> place; verify-epic mirrors at epic scope)
→ src/orchestrator/src/petri-net.ts             (PetriNet.fire() splits into synchronous-dispatch fast-path and async-complete signal path; introduce signalCompletion(token, outcome) API consumed by handler runners; remove synchronous handler invocation from fire kernel)
→ src/orchestrator/src/handler-runner.ts        (or equivalent — handlers now receive a completion callback and produce tokens via signalCompletion, not via synchronous return)
→ src/orchestrator/src/topology.test.ts         (adapter goldens updated for dispatch/complete/running/halted counts and shapes)
→ src/orchestrator/src/engine-contract.test.ts  (runtime-equivalence assertions unchanged; async-completion ordering invariants added; ctx.halted assertion paths replaced with halted:<sliceId> marking assertions)
```

### Risks and Assumptions

```
- RISK: Async completion changes firing order — a handler that completes before its sibling guard sees the running token may race. → MITIGATION: signalCompletion always enqueues onto a single-threaded petri-net step loop; complete transitions are the only consumers of running:* places; add ordering contract test.
- RISK: Retiring ctx.halted breaks any caller that reads it (cook CLI, status reporting). → MITIGATION: Audit callers in src/orchestrator/ and src/cook/ before flipping; surface halted:<sliceId> marking through the same status accessor.
- RISK: handler-runner shape may not yet exist as a single file; current sibling onFire closures embed completion logic. → MITIGATION: First step of build is locating the synchronous handler boundary in petri-net.fire; if no clean seam exists, extract one before the dispatch/complete split. May warrant an ln-spike if the seam is hidden.
- RISK: verify-epic operates at epic scope, not slice scope — running:verify:<epicId> + halted:<epicId> place naming must stay coherent with slice-scoped running:*/halted:*. → MITIGATION: Adopt `running:<step>:<scopeId>` convention where scopeId is sliceId or epicId; document in topology.test.ts goldens.
- ASSUMPTION: Single-threaded petri-net step loop is acceptable (no concurrent fire). → VALIDATE: existing engine-contract suite remains green; no test currently asserts concurrent fire. [→ memory/SPEC.md §Assumptions]
- ASSUMPTION: Topology growth ≈ +4 running:* places + +1 halted:<sliceId> place per slice, +8 complete sibling transitions per slice (dispatches replace producers 1:1, so producer count is net-zero). Plus +1 running:verify:<epicId> + 1 halted:<epicId> per epic. → VALIDATE: topology adapter test asserts new counts.
- ASSUMPTION: Read-arc / pool-budget question stays deferred — dispatch/complete pairs continue consume+return on budget places. [→ HANDOFF retired; open coordination item lives in PLAN.md FE-761 frontier]
```

### Acceptance Criteria

```
✓ dispatch-complete-shape — for every former producer, blueprint contains exactly one DispatchDescriptor and one CompleteDescriptor-pair (one per outcome sibling); producer variants are absent from HandlerDescriptor union.
✓ running-place-per-dispatch — each dispatch transition emits to exactly one `running:<step>:<scopeId>` place and the matching complete siblings are the only consumers.
✓ halted-as-place — fail-path siblings emit to `halted:<scopeId>` instead of mutating ctx.halted; ctx.halted field is removed (or last-resort: marked deprecated with a single read-through accessor).
✓ async-completion-ordering — contract test invokes a handler that defers completion across an event-loop tick; engine continues to step other independent transitions and consumes the completion deterministically.
✓ engine-contract-suite-green — all engine-contract tests pass against both petri and proc engines, including budget exhaustion and verify-epic halt-on-fail paths.
✓ topology-counts-pinned — adapter test asserts post-refactor place + transition counts for simplePlan, depPlan, and fixtures/txt plan.
✓ cook-smoke-green — `brunch cook fixtures/txt/` drives a real run to completion using async dispatch/complete.
```

### Verification Approach

```
- Inner: Vitest engine-contract suite (existing, both engines) + new adapter tests over compileTopology — proves runtime equivalence + dispatch/complete topology.
- Middle: New async-completion ordering contract test that defers handler completion across ticks; budget-exhaustion contract test re-verified against halted:* marking instead of ctx.halted.
- Outer: End-to-end `brunch cook fixtures/txt/` smoke run — confirms async lifecycle drives a real cook to completion.
```

---
