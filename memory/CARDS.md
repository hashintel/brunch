<!-- CARDS.md — prepared scope-card queue for the active frontier item.
     Owned by ln-scope · Consumed by ln-build · Overwritten when queue is exhausted.
     Frontier: petri-semantic-lanes (new, under umbrella H-6476). -->

# petri-semantic-lanes — scope cards

## Card 1: Two-lane subnet with semantic completion gate

**Status:** next

### Target Behavior

The compiled slice subnet enforces a two-lane terminal join: `return-done` is unreachable unless both mechanical verification (`done-spec`) and semantic assessment (`semantic-satisfied`) have produced tokens.

### Boundary Crossings

```
→ types.ts (add 'assess-semantic' to action vocabulary)
→ net-compiler.ts (add semantic places + assess-semantic transition + terminal join)
→ engine-contract.test.ts (update call-order assertions, add semantic-gate scenario)
→ petri-net.ts (no change — interpreter is topology-agnostic)
→ engine-petri.ts / engine-proc.ts (no change — thin wrappers)
```

### Risks and Assumptions

```
- RISK: All existing contract tests check call-order sequences that will gain an
    assess-semantic step → every test with call-order assertions needs updating.
  → MITIGATION: Mechanical change — add the step to expected sequences. The
    fake factory already uses Record<string, ActionHandler> so adding a new key
    is trivial.

- RISK: Semantic assessment always passes in fakes — the topological constraint
    is real but the assessment itself is a no-op until real oracles land.
  → MITIGATION: Add one contract test where assess-semantic fails → slice halts.
    This proves the gate is load-bearing, not decorative.

- ASSUMPTION: A single assess-semantic action per slice is sufficient for Phase 1.
    The spec doc shows multiple semantic transitions (AssessOracleSatisfaction,
    AssessDesignExercised, AssessIntentEstablished), but those can be sub-steps
    of one assessment action in this slice; the net template can refine later.
  → VALIDATE: The terminal join enforces the gate; internal decomposition of
    semantic assessment is additive, not structural.
```

### Acceptance Criteria

```
✓ semantic-places — Compiled subnet per slice includes `semantic-gate` and
  `semantic-satisfied` places. Adapter test confirms updated place count.

✓ assess-semantic-transition — New transition `{sliceId}:assess-semantic`
  consumes `done-spec` + `semantic-gate` and produces `semantic-satisfied`
  (on pass) or routes to `needs-more` (on fail, forcing another TDD cycle).

✓ terminal-join — `return-done` transition consumes `semantic-satisfied`
  instead of `done-spec`. PlanDoneAccepted (= `completed` place) is
  topologically unreachable without semantic satisfaction.

✓ assess-semantic-action — `assess-semantic` key added to ActionHandlers.
  Fake factory provides a default that always returns { satisfied: true }.

✓ contract-tests-updated — All existing contract test call-order assertions
  include the new assess-semantic step. All 26 tests pass.

✓ semantic-gate-fail-test — New contract test: assess-semantic returns
  { satisfied: false } → slice re-enters TDD loop. If it keeps failing,
  slice halts.

✓ adapter-test-updated — Net shape adapter tests updated for new place
  and transition counts.
```

### Verification Approach

```
- Inner: npm run verify — contract tests (26 existing updated + 1–2 new),
  adapter tests updated, lint + type-check + build.
- Middle: n/a (no product behavior change)
- Outer: n/a
```

### Implementation notes

1. Add `assess-semantic` to fake factory (returns `{ satisfied: true }` by default).
2. Add `semantic-gate` and `semantic-satisfied` places to compiler template.
3. Seed `semantic-gate` with a token when slice starts.
4. Add `assess-semantic` transition: consumes `done-spec` + `semantic-gate`,
   calls `actions['assess-semantic']`, routes to `semantic-satisfied` or `needs-more`.
5. Change `return-done` inputs from `[done-spec]` to `[semantic-satisfied]`.
6. Update all contract test call-order expectations.
7. Add semantic-gate-fail contract test.
8. Update adapter test place/transition counts.

## Card 2: TransitionContract type

**Status:** queued

### Objective

Each transition in the compiled net carries typed metadata (`TransitionContract`) describing its kind, lane, actor, and guard — enabling the interpreter and future event model to distinguish mechanical from semantic transitions without inspecting transition IDs.

### Acceptance Criteria

```
✓ TransitionContract type defined in petri-net.ts with fields: kind
  ('mechanical' | 'semantic' | 'structural'), lane, actor, guard description.

✓ TransitionDef gains an optional `contract` field.

✓ Compiler populates contract metadata for all transitions it creates.

✓ Adapter test asserts that mechanical-lane transitions have kind='mechanical'
  and semantic-lane transitions have kind='semantic'.

✓ No behavioral change — interpreter ignores contract metadata for now.

✓ All existing tests pass.
```

### Verification Approach

```
- Inner: npm run verify — type-check + adapter tests for contract metadata.
```

## Card 3: §7 event vocabulary

**Status:** queued

### Objective

The interpreter emits structured events from the spec §7 vocabulary (`transition_fired`, `oracle_passed`, `task_dispatched`, `net_deadlocked`, …) as each transition fires, providing a durable replayable record for audit, visualization, and future graph reconciliation.

### Acceptance Criteria

```
✓ Event type defined with spec §7 vocabulary fields (event kind, transition id,
  consumed/produced places, timestamp, contract metadata).

✓ PetriNet.run() accepts an optional event sink and emits transition_fired
  events on each firing.

✓ Net deadlock (no enabled transition, not halted) emits net_deadlocked.

✓ Contract tests can optionally capture and assert event sequences.

✓ Existing tests pass (event sink is optional, defaults to no-op).
```

### Verification Approach

```
- Inner: npm run verify — event sink tests, contract tests with event capture.
```
