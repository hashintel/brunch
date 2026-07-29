# Freeze And Fire The Secure Drop Tracer

Frontier: greenfield-secure-drop-demo
Status:   active
Mode:     slices
Created:  2026-07-28

## Orientation

- The containing seam is the settled Specify review-set handoff into D126-L scopes and the D120-L production Execute path.
- FE-1289 is a proving frontier: the first run must locate real demo blockers before any product fix is scoped.
- Existing comparison machinery is evidence infrastructure only; this tracer must not widen it into a new generic campaign framework.
- Main risk: the accepted graph may omit authored harness or scope facts needed by plan admission, making the first run valuable as a falsifier rather than a success.

Posture: proving (inherited from `greenfield-secure-drop-demo`).

Cross-cutting obligations:

- Security uses existing `constraint`, `invariant`, `criterion`, `vv_method`, `check`, and `evidence` semantics; do not add a security kind or newly generate `vv_obligation`.
- Greenfield execution uses authored commands only, keeps Petrinaut observational, and mutates the host only through confirmed `/brunch:land`.
- Comparison evidence stays controller-safe and cannot use Brunch-private diagnostics for cross-lane claims.

## Card 1 — done — Freeze the reusable mission

### Target Behavior

One product-neutral Secure Drop mission carries enough bounded security and delivery truth to drive real elicitation without prescribing the resulting graph or plan.

### Full-card cold-start reads

- `memory/SPEC.md` — D56-L, D120-L, D126-L, D130-L; I51-L, I58-L, I69-L
- `memory/PLAN.md` — frontier `greenfield-secure-drop-demo`
- `testing/comparisons/missions/README.md` — saved mission contract
- `docs/praxis/comparison-runs/mission-packet.md` — reveal and budget discipline

### Boundary Crossings

```text
operator-owned product intent
→ reusable private saved mission
→ top-level simulated-user answers
→ Brunch elicitation and review-set settlement
```

### Risks and Assumptions

- RISK: too much implementation detail turns elicitation into transcription → MITIGATION: freeze consequential product/security facts while leaving low-consequence architecture and interaction decisions open.
- RISK: a broad messenger scope destroys determinism and parallel buildability → MITIGATION: exclude conversations, delivery state, presence, notifications, and real-time synchronization.
- ASSUMPTION: a file drop with optional note, expiry, and revocation is rich enough to yield independent frontend/backend/crypto slices.
  → IMPACT IF FALSE: fall back to a text-only expiring encrypted note drop before building any case-specific oracle.
  → VALIDATE: inspect the settled graph and synthesized scope/dependency shape from Card 2.

### Posture check

- Proof of life: the mission enters the real elicitation path rather than a seed or hand-authored graph.
- Invariant: the server never receives plaintext or decryption-key material.
- Uncertainty retired: whether the existing graph vocabulary can represent consequential security requirements without a new node kind.

### Acceptance Criteria

✓ `testing/comparisons/missions/README.md` review — `secure-drop.md` is listed and follows the saved-mission contract.
✓ Mission content review — the user journey, threat boundary, ciphertext-only server rule, capability-link authority, expiry/revocation, deterministic local stack, and out-of-scope messenger behavior are explicit.
✓ Mission content review — consequential unknowns and decision latitude remain available for elicitation rather than being silently invented.
✓ `npm run check:markdown-links` — all new local Markdown links resolve.

### Verification Approach

- Inner: content/shape review plus Markdown link check.
- Middle: real Brunch elicitation consumes the mission in Card 2.
- Outer: deferred to Card 2, owned by this same scope file and triggered immediately after Card 1 is green.

### Expected touched paths (tentative)

```text
testing/comparisons/missions/
├── README.md       ~
└── secure-drop.md  +
```

## Card 2 — failed witness retained — Fire the first production witness

### Target Behavior

A fresh Secure Drop workspace produces an evidence-backed verdict for every stage from elicitation through Petrinaut-observed production execution and confirmed greenfield landing.

### Full-card cold-start reads

- `memory/SPEC.md` — D120-L, D126-L, D127-L, D130-L; I58-L, I69-L
- `memory/PLAN.md` — frontier `greenfield-secure-drop-demo`
- `src/executor/TOPOLOGY.md` — plan, run, promotion, and landing contracts
- `src/rpc/TOPOLOGY.md` — Petrinaut stream and run observer surfaces
- `docs/praxis/manual-testing.md` — TUI and findings-ledger protocol
- `docs/praxis/comparison-runs.md` — provenance and evidence retention
- `testing/comparisons/missions/secure-drop.md` — operator truth

### Boundary Crossings

```text
saved mission
→ real TUI elicitation
→ accepted graph and committed scopes
→ production plan synthesis and run creation
→ parallel cook with Petrinaut stream
→ promotion_prepared
→ confirmed greenfield landing
→ mission-owned application checks
```

### Risks and Assumptions

- RISK: a live stage fails before application output exists → MITIGATION: retain the attempt and classify the first causal blocker; do not bypass it with graph mutation or repository surgery.
- RISK: the generated application passes its own tests while violating security intent → MITIGATION: inspect HTTP, SQLite, logs, and browser behavior with unique sentinels before calling the run successful.
- ASSUMPTION: the existing production path can carry at least two dependency-independent slices through durable parallel firing.
  → IMPACT IF FALSE: the demo does not prove its central parallel-execution claim.
  → VALIDATE: retain plan dependencies plus Petri journal/marking timing evidence.

### Posture check

- Proof of life: one complete product path reaches a working landed application.
- Invariant: Petrinaut remains observer-only and host mutation remains user-confirmed.
- Uncertainty retired: which failures are actual demo-critical product blockers versus acceptable scenario limitations.

### Acceptance Criteria

✓ Settled graph evidence — exported spec plus `graph.overview` show intent, flows, security constraints/invariants, executable criteria, frontend/backend boundaries, at least three scopes, at least two independent scopes, and one `Project execution harness`.
✓ Production plan evidence — `plan.json` is synthesized from accepted graph truth and contains a parallel-ready dependency shape.
✓ Petrinaut evidence — the live stream visibly advances before terminal state and retained Petri artifacts replay to the same final marking.
✓ Run evidence — production orchestration reaches `promotion_prepared` without manual target-repository edits.
✓ Landing evidence — `execute_land_preflight` plus confirmed `/brunch:land` materializes only into a missing or empty target.
✓ Application V&V — authored test/build commands and controller-owned browser/API/SQLite security checks pass.
✓ Findings ledger — every failure is classified `demo-critical`, `acceptable demo limitation`, or `software-specific deferred work`, with owner and re-entry trigger.

### Verification Approach

- Inner: deterministic RPC/artifact reads and application test/build commands.
- Middle: browser/API/SQLite security checks over a unique plaintext sentinel and controlled clock.
- Outer: real TUI, live Petrinaut observation, and confirmed landing.

### Expected touched paths (tentative)

```text
.fixtures/scratch/greenfield-secure-drop-demo/  + (gitignored run evidence)
TESTING_FINDINGS.md                             ? (only when a finding exists)
memory/cards/
└── greenfield-secure-drop-demo--mission-and-witness.md ~
```

Pilot result: the real path reached a settled four-scope graph, then `execute_plan_file` timed out repeatedly after Execute-mode preparation created duplicate requirement packaging and cyclic scope/oracle edges while repairing its own incomplete D126-L scope shape. This is demo-critical and blocks the remaining Card 2 acceptance criteria. The retained session id is `019fa95a-bf25-76b1-afd1-82375712e85f`; the pre-repair exported specification is in `.fixtures/scratch/greenfield-secure-drop-demo/pilot-1/`.

## Card 3 — completed — Keep plan preparation bounded

### Target Behavior

A plan-ready multi-scope graph reaches a synthesized plan file in one bounded attempt without an Execute-mode graph-repair cascade.

### Full-card cold-start reads

- `memory/SPEC.md` — D126-L and D130-L
- `src/agents/skills/map/references/map-plans.md` — scope-edge authoring contract
- `src/agents/subagents/planner.md` — sealed planner conduct and inference posture
- `src/app/planner-port.ts` — bounded planning projection and structured output contract
- `src/executor/plan-synthesis.ts` — model-round deadline and admission loop
- retained session `019fa95a-bf25-76b1-afd1-82375712e85f` — exact failed plan-file calls and graph repair sequence

### Boundary Crossings

```text
review-approved scope graph
→ deterministic plan-ready projection
→ sealed planner candidate
→ deterministic validation
→ plan.json
```

### Risks and Assumptions

- RISK: raising the timeout hides non-terminating planning rather than fixing it → MITIGATION: keep the 120-second ceiling and reduce planner reasoning posture from high to medium.
- RISK: model latency is only a symptom of malformed scope packaging → MITIGATION: harden the plan-mapping contract so every scope directly receives unique requirements, executable criteria, design anchors, and verification machinery with the canonical D126-L edge directions.
- ASSUMPTION: medium thinking is sufficient for a bounded structured plan projection.
  → IMPACT IF FALSE: retain the timeout and classify the planner/model combination as an unresolved demo blocker.
  → VALIDATE: a live `execute_plan_file` call returns a structured candidate within the existing per-round deadline.

### Posture check

- Proof of life: the retained graph produces `plan.json` without changing the graph during the probe.
- Invariant: invalid model candidates still fail closed; no deterministic fallback is introduced when a planner is available.
- Uncertainty retired: whether the blocker is the 120-second policy, excessive planner reasoning, or missing plan-authoring guidance.

### Acceptance Criteria

✓ `src/.pi/extensions/subagents/__tests__/agents.test.ts` — planner manifest pins the bounded medium-thinking posture and retains structured-output repair instructions.
✓ `npm run check:skills` — plan-mapping guidance remains internally consistent and names the exact D126-L direct-edge contract.
✓ Live retained-graph probe — `execute_plan_file` writes `plan.json` within the existing per-round timeout after the planner posture change.
✓ Fresh-run probe — the elicited plan review set directly packages every scope without duplicate requirement ownership or oracle-node composition.

### Verification Approach

- Inner: focused subagent-definition test and skill-system check.
- Middle: live retained-graph plan-file probe with no graph mutation.
- Outer: restart Card 2 from a fresh workspace after this card is green.

### Expected touched paths (tentative)

```text
src/agents/subagents/planner.md                         ~
src/agents/skills/map/references/map-plans.md          ~
src/.pi/extensions/subagents/__tests__/agents.test.ts  ~
TESTING_FINDINGS.md                                    ~
```

Fresh result: graph LSN 10 in the second Secure Drop workspace passed `execute_plan_check` with zero findings and all six requirements covered by four criteria. `execute_plan_file` wrote a four-epic, nine-slice `plan.json` in three bounded rounds without mutating the graph.

## Card 4 — implemented, witness pending — Establish one greenfield repository root

### Target Behavior

An empty-target plan materializes one shared repository foundation before otherwise-independent feature slices, and executor-owned worker result artifacts never enter source integration.

### Full-card cold-start reads

- `memory/SPEC.md` — D126-L, D127-L, D130-L; I58-L, I69-L
- `src/agents/skills/map/references/map-plans.md` — shared design and scope packaging
- `src/agents/subagents/planner.md` — greenfield foundation conduct
- `src/app/agent-runner-port.ts` — worker-task/result ownership boundary
- `src/executor/parallel-slice-batch/` — concurrent settlement and integration
- run `run-ms55kdd2` — package/result add-add conflict witness

### Boundary Crossings

```text
shared Project foundation design anchor
→ one prerequisite foundation slice
→ parallel crypto and backend slices
→ executor-owned external result artifacts
→ conflict-free source integration
```

### Risks and Assumptions

- RISK: serializing all work would hide the conflict while destroying the demo's parallel claim → MITIGATION: serialize only the shared root, then require the crypto/backend implementation slices to form one parallel batch.
- RISK: guidance alone may not keep downstream workers from rewriting root configuration → MITIGATION: make ownership explicit in the shared design anchor and foundation slice done criteria.
- ASSUMPTION: workers created target `result.json` only because the executor result path was exposed in their task.
  → IMPACT IF FALSE: add a source-integration exclusion for executor artifacts rather than teaching workers about orchestration paths.
  → VALIDATE: the next parallel run contains external `agent-output/**/result.json` records and no target-worktree `result.json`.

### Posture check

- Proof of life: one foundation firing unlocks at least two slices that execute concurrently and both integrate.
- Invariant: no semantic manifest merge or hidden repository reconciliation is introduced.
- Uncertainty retired: whether empty-target parallelism needs a scheduler abstraction or only an authored shared-root dependency.

### Acceptance Criteria

✓ `src/app/__tests__/agent-runner-port.test.ts` — worker-visible task omits the executor result path while the port still persists the returned summary.
✓ `src/.pi/extensions/subagents/__tests__/agents.test.ts` — greenfield planner conduct names one root-owning foundation slice and preserved downstream parallelism.
✓ `src/agents/skills/__tests__/assurance-semantics.test.ts` — plan mapping requires a shared `Project foundation` anchor across root-touching scopes.
✓ Fresh plan probe — `plan.json` contains one foundation slice before at least two otherwise-independent feature slices.
✓ Fresh run probe — Petrinaut records the post-foundation slices as one parallel batch and both integrate without `package.json` or `result.json` conflicts.

### Verification Approach

- Inner: focused app-port, planner-definition, and skill-contract tests.
- Middle: regenerated plan inspection for one shared-root predecessor and parallel successors.
- Outer: restart production orchestration from a fresh empty target and retain Petri plus integration evidence.

### Expected touched paths (tentative)

```text
src/app/agent-runner-port.ts                           ~
src/app/__tests__/agent-runner-port.test.ts            ~
src/app/TOPOLOGY.md                                    ~
src/agents/subagents/planner.md                        ~
src/agents/skills/map/references/map-plans.md          ~
src/.pi/extensions/subagents/__tests__/agents.test.ts  ~
src/executor/plan-validation.ts                        ~
src/executor/__tests__/plan-validation.test.ts          ~
src/executor/TOPOLOGY.md                                ~
TESTING_FINDINGS.md                                    ~
```

Fresh plan result: graph LSN 11 produced one initial `Project Foundation` slice with crypto and backend successors both dependent on it. Fresh run `run-ms5y9tm9` launched only that foundation slice and contained executor-owned results exclusively under `agent-output/**`; it halted before the parallel batch because all three S1 attempts retained a false-negative typed-array assertion. A later LSN 12 regeneration admitted two initially runnable carriers of the replacement foundation, proving prompt guidance was insufficient. Candidate admission now requires exactly one project-foundation carrier and transitive dependency from every other shared-root carrier; the next regenerated plan/run must close this card.

## Card 5 — completed — Make byte-for-byte an executable value oracle

### Target Behavior

The accepted crypto round-trip criterion names a stable element-wise byte comparison so generated tests do not confuse cross-realm typed-array structure with plaintext inequality.

### Full-card cold-start reads

- active AC1 criterion and its incident requirement/scope/verification edges
- runs `run-ms5y9tm9` and `run-ms64ngaw` — six-cycle false-negative witness
- Vitest output at the failing round-trip assertion

### Boundary Crossings

```text
accepted byte-for-byte criterion
→ explicit element-wise comparison procedure
→ generated crypto test
→ criterion-strength harness pass
```

### Risks and Assumptions

- RISK: prescribing one assertion library call would overfit the oracle → MITIGATION: permit `Array.from`, `Buffer.from`, or explicit element iteration while requiring exact byte values and length.
- RISK: a global equality hook could make unrelated tests less legible → MITIGATION: explicitly forbid global matcher/configuration workarounds for this criterion.
- ASSUMPTION: the failed Web Crypto test is a value-comparison defect, not a plaintext-integrity defect.
  → IMPACT IF FALSE: production crypto must remain failed and the finding returns to application behavior.
  → VALIDATE: fresh byte-level round-trip plus tamper, wrong-key, role, and drop-id assertions all pass.

### Posture check

- Proof of life: the same greenfield slice passes without global equality hooks or production representation tricks.
- Invariant: wrong-key, tamper, role, and drop-id failure assertions remain unchanged.
- Uncertainty retired: whether “byte-for-byte” is precise enough for the generated cross-realm test environment.

### Acceptance Criteria

✓ Specify review — AC1 replacement preserves all eight security assertions and all active incident semantics while making assertion 4 element-wise.
✓ Criterion body — raw `Uint8Array.toEqual` across realms, global equality hooks, and production representation changes solely for the test are forbidden.
✓ Fresh run probe — the affected slice passes the canonical harness without a global equality override or production-code accommodation for the assertion.
✓ Continuation probe — orchestration advances beyond the foundation into the planned parallel crypto/backend batch.

### Verification Approach

- Inner: `execute_plan_check` and plan inspection after criterion supersession.
- Middle: fresh S1 canonical harness result.
- Outer: restart production orchestration from a fresh empty target under the regenerated plan.

### Expected touched paths (tentative)

```text
TESTING_FINDINGS.md                                    ~
memory/cards/
└── greenfield-secure-drop-demo--mission-and-witness.md ~
accepted graph + regenerated plan evidence             ~
```

## Card 6 — completed — Carry the `node:sqlite` compatibility floor

### Target Behavior

The accepted Project Foundation explicitly requires a test-runner/toolchain version that supports the selected `node:sqlite` backend, and the synthesized root-owning slice carries that bound into the generated manifest.

### Full-card cold-start reads

- accepted graph LSN 11 — MOD6 Project Foundation and MOD7 `node:sqlite` backend
- runs `run-ms5zpmux`, `run-ms611svn`, `run-ms626cf8` — unconstrained Vitest resolver failures
- Vitest issue 7177 / fix 7179 — mandatory `node:` prefix compatibility history

### Boundary Crossings

```text
accepted node:sqlite backend
→ explicit Vitest >=3 compatibility bound
→ Project Foundation slice
→ generated greenfield manifest
→ canonical install/test command
→ runtime built-in compatibility
```

### Risks and Assumptions

- RISK: encoding a product-specific compatibility bound as general worker conduct would widen the fix and remain non-authoritative → MITIGATION: keep the bound in the accepted shared design that chose `node:sqlite`.
- RISK: superseding the foundation without repackaging every root-touching scope could reintroduce parallel root divergence → MITIGATION: compose the replacement foundation into every existing scope before plan regeneration.
- ASSUMPTION: Vitest 3.0.0 or newer contains mandatory-prefix support for `node:sqlite`.
  → IMPACT IF FALSE: retain the failure as application/toolchain incompatibility and add an accepted test shim through the same review flow.
  → VALIDATE: S3's real server suite imports `node:sqlite` and executes, rather than failing during module resolution.

### Posture check

- Proof of life: a clean generated manifest resolves and runs the accepted Node 24 built-in without target surgery.
- Invariant: graph truth, not worker prompt folklore, owns consequential compatibility requirements.
- Uncertainty retired: whether configuration can compensate for pre-fix Vitest releases.

### Acceptance Criteria

✓ Specify review — replacement Project Foundation names Vitest 3.0.0 or newer plus a compatible Vite release and is composed into every root-touching scope.
✓ Plan probe — regenerated foundation slice carries the compatibility bound before parallel work.
✓ Fresh run probe — generated manifest resolves Vitest 3.0.0 or newer.
✓ Backend probe — the S3 suite loads and exercises `node:sqlite` under the canonical `npm test` command.

### Verification Approach

- Inner: `execute_plan_check` plus regenerated plan inspection.
- Middle: clean foundation and backend slice harness results.
- Outer: restart production orchestration from a fresh empty target and advance beyond S3.

### Expected touched paths (tentative)

```text
TESTING_FINDINGS.md                                    ~
memory/cards/
└── greenfield-secure-drop-demo--mission-and-witness.md ~
accepted graph + regenerated plan evidence             ~
```

Fresh result: run `run-ms663v20` passed the S1 and S2 AC5 suites, including the realm-stable element-wise byte oracle, and S3 loaded and exercised `node:sqlite` under Vitest 3. The run reached the planned S2/S3 post-foundation parallel wave without a crypto or resolver repair.

## Card 7 — completed — Keep generated dependencies and caches out of source integration

### Target Behavior

The accepted Project Foundation creates a root `.gitignore` before any canonical install or test command, so parallel slices cannot commit dependency trees, build output, or tool caches as application source.

### Full-card cold-start reads

- accepted graph LSN 13 — active MOD8 Project Foundation
- run `run-ms663v20` — S2/S3 post-foundation parallel integration conflict
- run source-policy and integration reports for the conflicting Vitest cache path

### Boundary Crossings

```text
accepted Project Foundation
→ root .gitignore
→ canonical npm install/test
→ untracked dependency and tool caches
→ conflict-free parallel source integration
```

### Risks and Assumptions

- RISK: filtering the integration diff in executor code would hide an underspecified repository contract → MITIGATION: keep ignore ownership in the accepted greenfield foundation and generated application.
- RISK: an overbroad ignore rule could exclude application evidence → MITIGATION: require only `node_modules/` and `dist/`; do not ignore source, tests, configuration, or retained run evidence.
- ASSUMPTION: the S3 conflict is caused only by tracked generated output under `node_modules/.vite/`.
  → IMPACT IF FALSE: inspect the next conflict path and amend the foundation only when it is another deterministic generated artifact.
  → VALIDATE: S2 and S3 both integrate from one parallel batch with no cache file in either committed source diff.

### Posture check

- Proof of life: the same post-foundation parallel wave integrates both slices.
- Invariant: executor integration remains ordinary source integration with no semantic merge or hidden artifact filter.
- Uncertainty retired: whether the shared root must own ignore policy before workers run project commands.

### Acceptance Criteria

✓ Specify review — the active Project Foundation requires a root `.gitignore` containing `node_modules/` and `dist/`.
✓ Plan probe — the sole foundation owner carries `.gitignore` creation before the S2/S3 parallel wave.
✓ Source probe — committed slice diffs contain no path under `node_modules/` or `dist/`.
✓ Integration probe — S2 and S3 both emit successful slice-integration evidence from the same parallel batch.

### Verification Approach

- Inner: `execute_plan_check` plus regenerated plan inspection.
- Middle: inspect S1/S2/S3 committed paths and canonical harness results.
- Outer: restart production orchestration from a fresh empty target and advance beyond the S2/S3 integration wave.

### Expected touched paths (tentative)

```text
TESTING_FINDINGS.md                                    ~
memory/cards/
└── greenfield-secure-drop-demo--mission-and-witness.md ~
accepted graph + regenerated plan evidence             ~
```

Fresh result: graph LSN 14 superseded MOD8 with MOD9, preserving the accepted foundation and adding the two-line root `.gitignore`. Run `run-ms671oww` passed and integrated S1, then fired S2/S3 in one parallel wave; both integrated on cycle 1 with no `node_modules/`, `dist/`, package-manifest, result-artifact, or cache conflict.

## Card 8 — completed — Recover repairs after interleaved parallel history

### Target Behavior

A later serial slice that enters repair after earlier independent slices fired in parallel recovers from the durable Petri journal by transition multiset authority, dispatches exactly one repair worker, and continues without a false `petri_input_unreadable` halt.

### Full-card cold-start reads

- `src/executor/TOPOLOGY.md` — journal/lifecycle parity and repair authority
- `src/executor/orchestrate.ts` — `recoverPendingSliceRepair`
- `src/executor/petri-journal-authority.ts` — topology replay and transition multiset relation
- run `run-ms671oww` — S6 cycle-2 repair halt and retained Petri/run divergence

### Boundary Crossings

```text
earlier parallel transition journal
→ later serial verify failure
→ pending repair materialization
→ multiset journal/lifecycle reconciliation
→ one cycle-2 worker dispatch
→ integrated slice and terminal Petri state
```

### Risks and Assumptions

- RISK: accepting arbitrary reordering could hide missing or extra transitions → MITIGATION: retain compiled-topology replay and fail unless journal authority is `equal` or lifecycle-ahead with an exact recoverable residual multiset.
- RISK: repairing the retained run manually would counterfeit the product path → MITIGATION: preserve it as failed evidence and prove the fix only through a fresh run.
- ASSUMPTION: the initial halt is the ordered-prefix check in `recoverPendingSliceRepair`, not unreadable journal bytes.
  → IMPACT IF FALSE: retain the halt and diagnose the first unreadable carrier before changing reconciliation semantics.
  → VALIDATE: regression fixture has a replayable, multiset-equal journal whose order differs from the projected lifecycle at an earlier independent-slice transition.

### Posture check

- Proof of life: the fresh Secure Drop run repairs S6 and reaches `promotion_prepared`.
- Invariant: every accepted journal and projected history still replay through the same compiled topology with no missing or extra transition.
- Uncertainty retired: whether repair recovery incorrectly treats one valid parallel firing order as corrupt.

### Acceptance Criteria

✓ Regression oracle — an earlier parallel wave followed by one failing dependent slice reproduces `petri_input_unreadable` before the fix.
✓ Recovery semantics — multiset-equal interleaved history emits no duplicate catch-up transitions and dispatches one cycle-2 worker.
✓ Residual semantics — lifecycle-ahead recovery emits only the exact residual transition multiset in projected order; journal-ahead or mixed residuals still fail closed.
✓ Fresh run probe — production orchestration reaches `promotion_prepared` with run metadata, Petri marking, and terminal journal aligned.

### Verification Approach

- Inner: focused executor regression test around `recoverPendingSliceRepair`.
- Middle: executor test suite plus `npm run fix`.
- Outer: fresh LSN-14 Secure Drop run through S6 repair and terminal promotion preparation.

### Expected touched paths (tentative)

```text
src/executor/orchestrate.ts                    ~
src/executor/__tests__/orchestrate.test.ts     ~
src/executor/TOPOLOGY.md                       ~
TESTING_FINDINGS.md                            ~
memory/cards/
└── greenfield-secure-drop-demo--mission-and-witness.md ~
```

Fresh result: run `run-ms68py2m` fired S2/S3 in parallel, then S4 failed its first verification and recovered through cycle 2 under `execute_orchestrate` alone. All six slices and five epics completed, the marking reached `run:promotion_prepared` with `net_completed`, and confirmed `/brunch:land` materialized the promoted tree into `/tmp/brunch-secure-drop-demo-app`.

## Card 9 — active — Make the final application gate test every client surface and build

### Target Behavior

The accepted Project Foundation and execution harness make the landed application discover both client-page suites and produce a client/server build through canonical commands, so promotion evidence cannot omit the runnable app entrypoint or silently skip UI security criteria.

### Full-card cold-start reads

- accepted graph LSN 14 — MOD9 Project Foundation and active `Project execution harness`
- landed run `run-ms68py2m` at `/tmp/brunch-secure-drop-demo-app`
- landed `vite.config.ts`, `package.json`, `src/client/*.test.tsx`
- controller results for `npm test`, `npx vitest list`, and `npm run build`

### Boundary Crossings

```text
accepted foundation and harness
→ generated Vite client entrypoint and test discovery
→ canonical npm test + npm run build
→ landed runnable application
→ controller-owned browser/API/SQLite V&V
```

### Risks and Assumptions

- RISK: adding files directly to the landed target would make the demo pass by repository surgery → MITIGATION: preserve the failed landed output and amend accepted graph truth before a fresh plan/run.
- RISK: treating `npm test` exit 0 as sufficient would retain a false green because two UI suites were undiscovered → MITIGATION: require named discovery of CreateDropPage and ReceiveDropPage suites in addition to command exit.
- ASSUMPTION: Vite's configured `root: 'src/client'` makes the absolute include pattern omit tests at that root while still finding sibling lib/server tests.
  → IMPACT IF FALSE: diagnose the actual discovery boundary before prescribing a replacement pattern.
  → VALIDATE: the amended harness lists and executes all five expected test files, including both client pages.

### Posture check

- Proof of life: a fresh landed tree passes both canonical commands and serves a mounted Secure Drop UI.
- Invariant: no direct edits are made to the failed landed target or retained run worktree.
- Uncertainty retired: whether passing slice/epic verification implied a runnable final application.

### Acceptance Criteria

✓ External oracle — retained landed tree passes 31 discovered assertions but omits both UI suites, and `npm run build` fails because `src/client/index.html` is absent.
✓ Specify review — replacement foundation preserves MOD9 and adds concrete client entrypoint plus complete test-discovery/build obligations; the authored harness runs test and build.
✓ Fresh run probe — all expected client/lib/server suites execute before promotion and the canonical build succeeds.
✓ Landed probe — confirmed fresh landing passes `npm test`, `npm run build`, and controller-owned browser/API/SQLite checks without target edits.

### Verification Approach

- Inner: `execute_plan_check`, regenerated plan inspection, and exact harness-content review.
- Middle: clean generated test discovery plus client/server build.
- Outer: fresh production run, confirmed landing, and mission-owned security oracle.

### Expected touched paths (tentative)

```text
TESTING_FINDINGS.md                                    ~
memory/cards/
└── greenfield-secure-drop-demo--mission-and-witness.md ~
accepted graph + regenerated plan evidence             ~
```
