<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: petri-petrinaut-semantics (FE-761). -->

# Scope cards — FE-761 petri-petrinaut-semantics

Two-slice queue. Only Slice 1 is pre-scoped; Slice 2 will be scoped after Slice 1 lands, because its exact shape depends on naming + halt decisions made during Slice 1.

---

## Slice 1: sibling transitions for conditional branching

**Status:** in progress

### Target Behavior

Every `TransitionSkeleton` in the compiled net has exactly one fixed output set; conditional routing in `evaluate`, `run-tests`, `assess-semantic`, and `verify-epic` is expressed as sibling transitions with complementary enabling guards rather than `HandlerDescriptor` output-set selection.

### Design choice (option A, confirmed 2026-05-27)

Each conditional action-transition splits into two stages:

1. **Producer transition** (kind preserved: `action` / `run-tests` / `assess-semantic` / `verify-epic`) — runs the work synchronously, attaches the resulting report to the output token, emits to a single new intermediate place named `slice:<sliceId>:<step>:reported` (or `epic:<epicId>:verify:reported` for the epic-level verify).
2. **Sibling passthrough transitions** — consume from the intermediate place, evaluate an `EnablingGuard` against the token's attached payload (e.g. `tokenPayloadFieldTruthy: 'done'`), and emit to a single fixed output set.

Tokens gain a `report?: ReportLine | { passed: boolean; ... }` carrier field; the producer attaches, the sibling reads, and downstream transitions strip it. The producer transition is still synchronous in Slice 1 — making it instantaneous (`dispatch:*` + `complete:*:<outcome>`) is Slice 2's concern.

Why option A: (a) ships Slice 1 with no dependency on dispatch/complete async work; (b) every transition emits to one fixed output set, satisfying the Petrinaut all-outputs-fire requirement at the topology level; (c) the report-bearing-token + intermediate-place contract is exactly what Slice 2 will need anyway, so this lays Slice 2's foundation; (d) rejected option B (pure relabeling with hidden state) and option C (merge Slice 1 + Slice 2) for under- and over-scope respectively.

### Boundary Crossings

```
→ src/orchestrator/src/net-blueprint.ts        (introduce EnablingGuard; drop onTrue/onFalse/onPass/onFail/onSatisfied/onRejected/onPassOutputs branching from HandlerDescriptor variants; producer descriptors emit to single `*:reported` intermediate place; sibling passthroughs gain enabling-guard data; enumerateCandidateOutputs collapses to single output set per transition)
→ src/orchestrator/src/net-compiler.ts          (compileTopology adds 4 intermediate places + 4 producer transitions + 8 sibling passthroughs per slice; verify-epic also splits)
→ src/orchestrator/src/petri-net.ts             (Transition.isEnabled evaluates EnablingGuard over token payload from input markings; Token type gains optional report carrier; fire kernel propagates report attach/strip)
→ src/orchestrator/src/topology.test.ts         (adapter goldens updated for new place/transition counts and sibling shapes)
→ src/orchestrator/src/engine-contract.test.ts  (runtime-equivalence assertions unchanged — same observable outcomes; counts in adapter assertions updated)
```

### Risks and Assumptions

```
- RISK: Today's RouteGuard is a *routing* predicate over a report; sibling-transition siblings need an *enabling* predicate that reads input-marking token payloads (report attached to token, not to transition). → MITIGATION: Introduce EnablingGuard distinct from RouteGuard, or generalize RouteGuard to read from token payload; pick the smaller correct change during build.
- RISK: assess-semantic + run-tests carry budget tokens; if siblings share one input arc onto the budget place, both will be considered enabled and the firing policy may double-decrement → MITIGATION: Encode mutual exclusion in enabling guards (sibling N's guard implies NOT sibling M's guard); add contract test for budget-exhaustion paths across siblings.
- RISK: verify-epic halt-on-fail currently mutates ctx.halted in a fire closure; without halted:* place, the "fail" sibling has no topological output and may dead-end the net → MITIGATION: For Slice 1, keep ctx.halted mutation in the fail sibling's fire closure (instantaneous transition is acceptable; halted:* place is a Slice 2 / dispatch-refactor concern). Flag for Slice 2 scoping.
- ASSUMPTION: Engine contract suite (~120 tests across both engines) is the runtime-equivalence oracle. → VALIDATE: All tests green post-refactor. [→ memory/SPEC.md §Assumptions]
- ASSUMPTION: Pool / budget tokens stay consume+return (no read-arc migration) until Petrinaut team confirms read-arc concurrency. [→ HANDOFF.md "Open coordination items"; PLAN.md FE-761 frontier]
- ASSUMPTION: Topology growth ≈ +4 intermediate places + +8 sibling-passthrough transitions per slice (4 conditional transitions × 2 siblings each, producers retained). Plus +1 intermediate place + 2 siblings for epic-level `verify-epic`. → VALIDATE: compileTopology adapter test asserts new counts.
```

### Acceptance Criteria

```
✓ blueprint-shape — ActionDescriptor.onTrue/onFalse, RunTestsDescriptor.onPass/onFail, AssessSemanticDescriptor.onSatisfied/onRejected, VerifyEpicDescriptor branching removed from HandlerDescriptor variants.
✓ enumerate-candidate-outputs-single-set — for every TransitionSkeleton in fixtures simplePlan/depPlan/multiSlicePlan, enumerateCandidateOutputs(transition) returns the topology-declared output set (no union of mutually-exclusive branches).
✓ sibling-mutual-exclusion — for each former conditional transition, exactly one sibling fires per input marking; contract test exercises both branches and asserts no double-firing.
✓ engine-contract-suite-green — all ~120 engine-contract tests pass against both petri and proc engines.
✓ topology-counts-pinned — adapter test asserts post-refactor place + transition counts for simplePlan, depPlan, and fixtures/txt-style plan (placeholder count: today 57P/39T → expect 57P/47T after this slice, before dispatch/complete refactor).
✓ budget-paths-coherent — budget-exhaustion contract tests still pass; rework / retry budget decremented exactly once per attempt across siblings.
```

### Verification Approach

```
- Inner: Vitest engine-contract suite (existing, both engines) + new adapter tests over compileTopology output — proves runtime equivalence + sibling-decomposition topology.
- Middle: enumerateCandidateOutputs literal-fixture goldens — proves topology-only consumer sees one output set per transition. Plus budget-exhaustion contract tests asserting mutual-exclusion enabling guards.
- Outer: End-to-end `brunch cook fixtures/txt/` smoke — confirms refactored net still drives a real cook run to completion.
```

### Notes for Slice 2 scoping (do not pre-scope)

Slice 2 (`dispatch:*` + `complete:*:<outcome>` pair refactor) needs:

- Decision on `halted:*:<sliceId>` place — currently a proposal in FE-761 acceptance, not cross-team-required. Slice 1 keeps `ctx.halted` mutation in fail-sibling closures, so the halt-as-place decision can be made when slice 2 surfaces the dispatch lifecycle.
- Place naming convention for `running:*:<sliceId>` (open coordination item in FE-762).
- Async dispatch hook in petri-net.ts — `PetriNet.fire()` currently runs handlers synchronously; dispatch/complete split decouples task invocation from completion signal.

Scope Slice 2 after Slice 1's adapter tests pin the new place/transition counts; the dispatch-decomposition will add another ~25 places / ~25 transitions on top.

---
