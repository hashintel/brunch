# Slice A — Planning projection and plan-owned execution contract

Frontier: executor-plan-synthesis
Status:   active
Mode:     slices
Created:  2026-07-13

## Orientation

- Seam: committed scope truth (`ExecutionSpecSnapshot` v2, incl. the projected-then-dropped `context` block) -> executable plan artifact (`plan.yaml` + provenance) -> run creation (`execute_run_create`) -> verify execution (`TestRunnerPort`).
- Frontier: `executor-plan-synthesis` (FE-1197), stacked on FE-1195/PR #325; this file is Slice A of the three-slice shape settled at admission.
- Volatile state: fe-1195 branch swap pending the other session's quiescence; this branch (`ka/fe-1197-executor-plan-synthesis`) sits on the reconciled restack tip and will be restacked once the parent ref moves.
- Main risk: the transitional default (existing greenfield flows keep working before Slice B's planner populates elicited capabilities) quietly re-creating the silent-default defect — every default must be explicit, provenance-stamped contract content, never ambient code fallback.
- Posture: proving (inherited from executor-plan-synthesis).

## Design permutations (folded ln-design pass — decided here, recorded for review)

**Execution-contract home.** (a) new run-metadata-only field; (b) sidecar artifact next to plan.yaml; (c) **chosen: typed section inside the plan artifact chain** (draft -> preview -> plan.yaml payload) so the contract freezes with the plan, rides `populatedPlanPath`/`petri-plan-snapshot` unchanged, and run creation reads one source of truth. Rejected (a): run metadata is derived state, not authored plan truth; rejected (b): second planning store beside the plan artifact (guardrail violation).

**Capability vocabulary.** (a) closed union enum (old-main `ProfileId` — repudiated); (b) free-form strings resolved by the model (unsafe); (c) **chosen: open string ids + typed product-owned provider registry** — `CapabilityProvider` objects recognize capability ids and resolve typed actions; unrecognized ids stay in the contract as explicit `blocked` requirements. Vocabulary is data owned by providers, not a type-level catalogue; adding an ecosystem = adding a provider, not redesigning the contract.

**Action safety shape.** (a) model-authored argv (unsafe); (b) fixed command templates keyed by enum (old-main, repudiated); (c) **chosen: providers resolve to the existing `VerifyTarget`-shaped `{command, args}` values plus typed setup/build intents; only provider-resolved actions reach `RunMetadata.verifyTarget`/ports.** The model (Slice B) may only select/compose capability ids and intents; deterministic code resolves what runs.

## Card A1 — Plan-owned execution contract in the plan artifact [done 31c264e6]

### Target Behavior

The executable plan artifact carries a typed, provenance-stamped execution contract (required capabilities, detected capabilities, resolved/blocked actions) derived through product-owned capability providers.

### Full-card cold-start reads

```
- memory/SPEC.md   — D123-L (scope handoff), D111-L/D112-L/I58-L (executor purity/ports), D127-L/D128-L/D129-L (FE-1195 authority + canonical model)
- memory/PLAN.md    — frontier: executor-plan-synthesis (ownership model, oracles 1-9, prior-art verdicts)
- src/executor/TOPOLOGY.md — v2 projection chain, module table, I58-L side-effect rules
- src/executor/execution-spec-snapshot.ts — `ExecutionSpecContextSnapshot` (constraints/invariants/decisions/examples/design/oracle) — projected today, dropped by the outline
- src/executor/plan-preview.ts + plan-file.ts — where preview fields become plan.yaml payload (deferred `profile` slot comment)
- src/executor/execution-ports.ts — `VerifyTarget` shape
```

### Boundary Crossings

```
→ ExecutionSpecSnapshot (context block + scopes + mode)
→ planning projection (bounded scope-informed input incl. decisions/constraints)
→ execution-contract derivation (providers: detect / recognize / resolve / block)
→ ExecutablePlanDraft -> PlanPreview -> plan.yaml payload (+ provenance untouched)
```

### Risks and Assumptions

```
- RISK: "relevant decisions/constraints" is unbounded -> MITIGATION: bounded rule — all
  non-advisory constraint/invariant/decision nodes plus scope-linked design/verification;
  no whole-graph dumps; rule stated in the projection module and its test.
- RISK: transitional default re-creates silent defaults -> MITIGATION: the default verify
  action appears IN the contract as {source: 'default'} with a `ceiling:` naming Slice B
  as the trigger; nothing falls back outside the contract.
- ASSUMPTION: workspace detection can stay a pure-fs read inside src/executor (manifest
  reads, no subprocess). -> IMPACT IF FALSE: needs a DetectionPort in ExecutionPorts +
  app impl; contract shape unchanged. -> VALIDATE: boundaries.test.ts stays green with
  the fs-read module; detection tests use fixture directories.
```

### Posture check

Proof of life (a contract flows end-to-end into plan.yaml) + invariants (locates the capability/action seam Slice B synthesizes into) + uncertainty (retires "can the contract express today's flows without a closed catalogue?").

### Acceptance Criteria

```
✓ planning-projection.test.ts — the bounded planning projection includes scope packages,
  requirement deps, criteria, scope-linked design/verification, AND constraint/invariant/
  decision context; advisory nodes excluded; nothing else from the graph leaks in.
✓ execution-contract.test.ts — deriving a contract with a registered provider yields
  requiredCapabilities/detectedCapabilities with provenance and provider-resolved
  setup/build/verify actions; an unregistered capability id yields an explicit blocked
  entry (never a guessed command).
✓ execution-contract.test.ts — contradictory required-vs-detected capabilities yield a
  typed conflict finding, not a resolution.
✓ capability-providers.test.ts — the node/npm provider resolves verify to a
  VerifyTarget-shaped action; provider vocabulary is data (adding a provider needs no
  contract type change — proven by a second in-test provider).
✓ workspace-detection.test.ts — fixture dir with package.json reports detected
  capabilities with file provenance; empty dir reports none; no subprocess use
  (boundaries.test.ts stays green).
✓ plan-file.test.ts — plan.yaml payload carries the execution contract section verbatim;
  PlanFileProvenance schema unchanged (stays v1).
✓ execute-projection.test.ts — the deterministic default lowering emits an explicit
  {source:'default'} verify action for greenfield with no elicited capabilities, with
  ceiling: comment naming Slice B.
```

### Invariants preserved

```
- v2 chain version rejection (outline/draft asserts) — guarded by: execute-plan-outline.test.ts,
  executable-plan-draft.test.ts v1-rejection tests.
- Scope lowering semantics (only committed scopes; blocked incomplete packages) — guarded by:
  execute-plan-check.test.ts + execute-plan-outline.test.ts scope suites.
- I58-L side-effect honesty (artifact writers touch only .brunch/execution-reports /
  declared files) — guarded by: per-helper executor suites + boundaries.test.ts.
- Frozen-plan consumers (SchedulerPlan projection, petri snapshot, populated plan) keep
  parsing plans that now carry a contract section — guarded by: orchestrate.test.ts,
  petri-runtime plan tests, rpc execute.test.ts.
```

### Verification Approach

- Inner: unit suites named above per module (vitest), `npm run fix` after edits.
- Middle: plan-artifact round-trip — projection -> contract -> plan.yaml -> read-back equality (plan-file.test.ts); oracle 6's contract half (dropped constraint/decision changes the projection => test fails).
- Outer: rides Slice C's composition witness (owned by frontier definition, oracle 9).

### Cross-cutting obligations

- No second planning store: contract lives only in the plan artifact + graph truth + run evidence.
- Executor purity: no SDK/subprocess/graph/UI imports in src/executor (boundaries.test.ts).
- `ceiling:` markers on every deliberate transitional shortcut.

### Expected touched paths (tentative)

```
src/executor/
├── planning-projection.ts        +
├── execution-contract.ts         +
├── capability-providers.ts       +
├── workspace-detection.ts        +
├── execute-projection.ts         ~
├── executable-plan-draft.ts      ~ (carry contract)
├── plan-preview.ts               ~ (carry contract)
├── plan-file.ts                  ~ (payload section)
├── TOPOLOGY.md                   ~
└── __tests__/
    ├── planning-projection.test.ts   +
    ├── execution-contract.test.ts    +
    ├── capability-providers.test.ts  +
    ├── workspace-detection.test.ts   +
    ├── plan-file.test.ts             ~
    └── execute-projection.test.ts    ~
```

## Card A2 — Run creation consumes admitted plan truth

### Target Behavior

`execute_run_create` derives substrate, source policy, and verification intent from the plan artifact's execution contract, and a caller-supplied profile that contradicts it is rejected before any run artifact is written.

### Full-card cold-start reads

```
- memory/SPEC.md   — D111-L (ports), D128-L (run admission), I58-L
- memory/PLAN.md    — frontier: executor-plan-synthesis (defect inventory in slice A text)
- src/.pi/extensions/executor/execute-run-create/index.ts — verifyProfile enum + verifyTargetForProfile
- src/app/test-runner-port.ts — hardcoded `npm run verify` fallback
- src/agents/prompts/executor.md — §run-creation prose heuristic
- src/executor/run.ts — RunMetadata.substrate/verifyTarget
```

### Boundary Crossings

```
→ execute_run_create tool params (foreground agent)
→ plan.yaml execution contract read (launch readiness path)
→ RunMetadata {substrate, verifyTarget} written from contract
→ TestRunnerPort receives only contract-resolved actions
```

### Risks and Assumptions

```
- RISK: existing fixtures/probes create runs with verifyProfile -> MITIGATION: regenerate
  fixtures per pre-release posture; failing callers are the oracle that the cutover is
  complete (grep for verifyProfile must end empty outside history).
- RISK: TestRunnerPort's ambient `npm run verify` fallback silently survives ->
  MITIGATION: the port requires an explicit verifyTarget; absence is a typed error;
  the default lives only in the contract ({source:'default'} from A1).
- ASSUMPTION: run-creation-time contract read can reuse the launch-readiness plan read
  (launch.ts) without a new artifact. -> IMPACT IF FALSE: small reader helper in
  plan-file.ts. -> VALIDATE: first test.
```

### Posture check

Closure-flavored proving: lights up the run-creation admission path and retires the "run creation can contradict the plan" defect for the deterministic path (oracle 1's rejection half at the tool boundary).

### Acceptance Criteria

```
✓ execute-run-create registrar test — tool schema no longer exposes verifyProfile; run
  creation with a plan carrying a contract writes contract-derived substrate/verifyTarget
  into RunMetadata.
✓ execute-run-create test — a caller-supplied verification override contradicting the
  admitted contract returns a typed rejection; no run directory/metadata is created.
✓ test-runner-port.test.ts — the port with no verifyTarget returns a typed failure
  (no ambient npm run verify); with a contract-resolved target it runs exactly that command.
✓ agent prompt check — executor.md no longer instructs profile selection; check:skills /
  prompt snapshot suite stays green.
✓ registry.test.ts + rpc execute.test.ts — production tool surface reflects the new
  schema; regenerated fixtures pass.
```

### Invariants preserved

```
- Failed/missing verification never advances run_completed/promotion — guarded by:
  run-complete/test-result/orchestrate suites (existing).
- D128-L single-owner run admission untouched — guarded by: run-effect-authority.test.ts.
- empty_dir substrate init behavior (I58-L narrow exception) — guarded by: worktree.test.ts.
```

### Verification Approach

- Inner: named suites above.
- Middle: end-to-end deterministic run over a fixture plan with a contract (orchestrate.test.ts family) proving the run executes only contract-resolved verify commands.
- Outer: rides Slice C composition witness (frontier-owned).

### Cross-cutting obligations

- Oracle 1 (contradictory profile rejected before worker launch) lands here for the tool boundary; re-assert in Slice C live.
- Keep `execute_*` tools executor-only (D40-L concentric authority).

### Expected touched paths (tentative)

```
src/.pi/extensions/executor/execute-run-create/index.ts  ~
src/.pi/extensions/__tests__/registry.test.ts            ~
src/app/test-runner-port.ts                              ~
src/app/__tests__/test-runner-port.test.ts               ~
src/agents/prompts/executor.md                           ~
src/executor/run.ts                                      ~ (contract-derived fields)
src/executor/launch.ts                                   ? (contract read)
src/executor/__tests__/run.test.ts                       ~
src/rpc/methods/__tests__/execute.test.ts                ~
```
