# Slice B — LLM plan synthesis, deterministic validation, bounded repair

Frontier: executor-plan-synthesis
Status:   active
Mode:     slices
Created:  2026-07-13

## Orientation

- Seam: PlanningProjection (slice A) -> model-authored CandidatePlan -> total deterministic validation -> bounded repair -> admitted ExecutablePlanDraft + ExecutionContract -> existing preview/plan.yaml/Petri pipeline.
- Frontier: `executor-plan-synthesis` (FE-1197) — this is Slice B of the admitted three-slice shape; frontier definition carries the ownership model, validation contract, and oracles 1–9.
- Main risk: the candidate schema accidentally re-admitting free-form commands or completion authority; both must be unrepresentable in the type, not merely rejected by checks.
- Posture: proving (inherited from executor-plan-synthesis).

## Design permutations (folded ln-design pass)

**Command safety by construction.** (a) validate model-authored argv against an allowlist; (b) **chosen: the CandidatePlan schema has no command surface at all** — the model may only reference capability ids and structural intents; deriving `resolvedActions` stays slice-A provider code. Unsafe command material is unrepresentable, not filtered.

**Planner seam.** (a) model SDK import in src/executor (violates boundaries.test.ts); (b) planner as pi-extension-only concern; (c) **chosen: `PlannerPort` in `ExecutionPorts`** mirroring `AgentRunnerPort`'s untyped-runtime pattern — contract + validation stay executor-pure; the app implements it over the sealed subagent substrate.

**Repair loop owner.** (a) planner port loops internally (opaque); (b) **chosen: executor-owned `synthesizePlan` loop** — validate, feed exact findings back to one bounded re-synthesis round set, then admit or block. History (rounds, findings) is part of the result; no trivial-plan fallback exists on any path.

## Card B1 — Candidate contract, total validation, bounded repair (deterministic core) [done]

### Target Behavior

A model-authored candidate plan is either admitted into an `ExecutablePlanDraft` + execution contract with full findings history, or explicitly blocked with typed findings — through a total pure validator and an executor-owned bounded repair loop with no silent fallback.

### Full-card cold-start reads

```
- memory/PLAN.md    — frontier: executor-plan-synthesis (validation contract bullet list, oracles 6/7, prior-art verdicts)
- memory/SPEC.md   — D130-L, D123-L, D129-L, I58-L
- src/executor/planning-projection.ts + execution-contract.ts + capability-providers.ts (slice A seam)
- src/executor/executable-plan-draft.ts — admission target shape
- scratchpad prior-art: old-main checkPlan semantics (typed severity findings, one shared cycle policy, coverage-by-provenance, mechanical-vs-design split)
```

### Boundary Crossings

```
→ PlanningProjection + detected capabilities
→ PlannerPort.synthesize (fake/scripted in this card)
→ parseCandidatePlan (unknown -> typed | malformed_candidate)
→ validateCandidatePlan (total, pure, typed findings)
→ bounded repair rounds (findings fed back verbatim)
→ admitCandidatePlan -> ExecutablePlanDraft + ExecutionContract | blocked result
```

### Risks and Assumptions

```
- RISK: validator diverges from repair on cycle identification -> MITIGATION: one shared
  dependency-cycle helper used by both detection and any dependency-related lowering.
- RISK: coverage check satisfiable vacuously (all requirements marked non-buildable) ->
  MITIGATION: explicit finding when a candidate covers zero scope obligations; blocking,
  not warning.
- ASSUMPTION: the admitted candidate can lower onto ExecutablePlanDraft without changing
  SchedulerPlan/preview consumers. -> IMPACT IF FALSE: plan-chain ripple in slice C.
  -> VALIDATE: admission test round-trips through previewPlan + planFilePayload.
```

### Posture check

Proof of life (candidate → admitted draft end-to-end with a scripted planner) + uncertainty (retires "can validation catch the oracle-7 defect classes without model help?").

### Acceptance Criteria

```
✓ candidate-plan.test.ts — malformed/unknown input fails closed as malformed_candidate
  (never a partial candidate); a well-formed candidate parses with provenance intact.
✓ plan-validation.test.ts — each defect class yields its typed error finding:
  slice in zero/multiple epics; slice without committed scope when scopes exist;
  uncovered scope requirement; unknown ids (epic/scope/requirement/criterion/dependency);
  dependency cycle (shared cycle helper); dropped criterion/verification obligation;
  dropped stack-commitment capability (oracle 6 rival); unsupported capability;
  required-vs-detected conflict; zero-coverage candidate.
✓ plan-validation.test.ts — a fully coherent candidate validates with zero error findings.
✓ plan-synthesis.test.ts — invalid candidate + scripted planner that repairs on round two
  => admitted with findings history for both rounds (oracle 7 repair half).
✓ plan-synthesis.test.ts — planner that never repairs => blocked result carrying final
  findings + full history; no fallback plan appears on any path (assert no draft).
✓ plan-synthesis.test.ts — admitted candidate lowers to ExecutablePlanDraft that
  round-trips previewPlan + planFilePayload with its execution contract.
```

### Invariants preserved

```
- Deterministic scope lowering (no scopes touched by this card) — guarded by:
  execute-projection.test.ts, execute-plan-outline.test.ts staying green.
- Executor purity — guarded by: boundaries.test.ts.
- D130-L admission at run creation — guarded by: execute-run-create.test.ts.
```

### Verification Approach

- Inner: the three new suites + npm run fix.
- Middle: admission round-trip through the real plan artifact writers.
- Outer: rides slice C (frontier-owned oracles 8/9).

### Expected touched paths (tentative)

```
src/executor/
├── candidate-plan.ts         +
├── plan-validation.ts        +
├── plan-synthesis.ts         +
├── execution-ports.ts        ~ (PlannerPort type only)
├── TOPOLOGY.md               ~
└── __tests__/
    ├── candidate-plan.test.ts    +
    ├── plan-validation.test.ts   +
    └── plan-synthesis.test.ts    +
```

## Card B2 — Sealed planner port and production wiring

### Target Behavior

`execute_plan_file` can synthesize its plan through an injected `PlannerPort` implemented over the sealed subagent substrate, with the deterministic lowering remaining the explicit non-planner path.

### Full-card cold-start reads

```
- memory/PLAN.md    — frontier: executor-plan-synthesis (slice B bullet)
- src/app/agent-runner-port.ts — sealed subagent invocation pattern (runSubagent, fails closed without modelRegistry)
- src/agents/subagents/worker.md — sealed subagent definition shape
- src/app/pi-extensions.ts — ExecutionPorts wiring (~line 330)
- src/.pi/extensions/executor/execute-plan-file/index.ts — production consumer oracle
```

### Boundary Crossings

```
→ execute_plan_file (planner-enabled path)
→ PlannerPort (app impl) -> sealed planner subagent -> JSON candidate text
→ parseCandidatePlan -> synthesizePlan (B1 loop)
→ writePlanFile (admitted draft + contract) | blocked tool result with findings
```

### Risks and Assumptions

```
- RISK: subagent free-text response breaks JSON parsing -> MITIGATION: parse via
  parseCandidatePlan fail-closed; a parse failure is a findings round, feedable to repair.
- ASSUMPTION: planner subagent can be registered like 'worker' with read-only tools.
  -> IMPACT IF FALSE: planner runs tool-less on projection text alone (still viable).
  -> VALIDATE: registrar/agent-manifest test.
```

### Posture check

Proof of life: the production plan-file path can carry a synthesized plan end-to-end with a faked subagent runtime; the live-model witness stays in slice C.

### Acceptance Criteria

```
✓ planner-port.test.ts — the app port renders the projection + findings into the sealed
  planner task, parses the reply, and fails closed (typed) on missing modelRegistry or
  unparseable output.
✓ execute-plan-file test — with an injected fake planner the tool writes the synthesized
  admitted plan + contract; a blocked synthesis returns the findings and writes nothing.
✓ execute-plan-file test — without a planner the deterministic lowering path is unchanged
  (existing tests stay green).
✓ registry.test.ts — production surface unchanged in tool count; planner port appears in
  ExecutionPorts wiring.
```

### Invariants preserved

```
- Sealed-child containment (D44-L/D91-L/I29-L family) — guarded by: subagent session suites.
- Deterministic path behavior — guarded by: existing execute-plan-file/registry suites.
```

### Verification Approach

- Inner: new suites + npm run fix.
- Middle: tool-level round trip with fake planner.
- Outer: slice C live witness (frontier-owned).

### Expected touched paths (tentative)

```
src/executor/execution-ports.ts            ~
src/app/planner-port.ts                    +
src/app/__tests__/planner-port.test.ts     +
src/app/pi-extensions.ts                   ~
src/agents/subagents/planner.md            +
src/.pi/extensions/executor/execute-plan-file/index.ts  ~
src/.pi/extensions/__tests__/registry.test.ts           ~
src/executor/TOPOLOGY.md                   ~
```
