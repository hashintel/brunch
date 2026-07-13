# Petri slice and epic integration parity

Frontier: petri-execution-parity
Status:   active
Mode:     slices
Created:  2026-07-13

Posture: proving (inherited from `petri-execution-parity`).

## Orientation

- Containing seam: `src/executor/` run lifecycle, Petri compiler/runtime, and injected git/test capability ports.
- Active frontier: `petri-execution-parity` / FE-1195; FE-1183, FE-1190, and FE-1192 are merged prerequisites.
- No handoff state exists. The frozen Petrinaut definition, fail-closed journal, serial `run.json` authority, and I58-L side-effect honesty are cross-cutting obligations.
- Main risk: independently enabled work must become observable and isolated without silently promoting the deferred durable-parallel-authority model.

## Slice 1 — Attempt-visible slice and epic topology

Status: done
Weight: full

### Target Behavior

The frozen executor net represents independent slice frontiers, bounded attempt loops, and epic integration/verification/completion gates before execution starts.

### Cold-start reads

- `memory/SPEC.md` — D111-L, D112-L, I58-L; Future Direction "Plan execution & Petri-net compatibility"
- `memory/PLAN.md` — frontier `petri-execution-parity`
- `src/executor/TOPOLOGY.md` — current executor/Petri authority and projection boundaries
- `src/executor/orchestrate-topology.ts` — compiler contracts
- `src/executor/petri-runtime.ts` — lifecycle-to-marking projection

### Boundary Crossings

→ frozen scheduler plan
→ executor topology compiler and guards
→ Petri runtime materialization/replay
→ SDCPN/Petrinaut definition

### Risks and Assumptions

- RISK: static attempt loops diverge from FE-1192 retry facts → MITIGATION: one retry-budget constant and contrastive topology/replay tests for retry and exhaustion.
- ASSUMPTION: serial durable lifecycle facts can project the richer topology without becoming marking authority.
  → IMPACT IF FALSE: stop before side-effect concurrency and promote the authority model inside this frontier.
  → VALIDATE: materialization and replay tests from pre-run through terminal state.

### Posture check

Lights up independent slice claims and explicit epic gates in the immutable net; stabilizes the topology vocabulary all later effects bind to.

### Acceptance Criteria

✓ `orchestrate.test.ts` topology contract — dependency-independent slice starts have disjoint claims and are selected together by `frontierFiringPolicy`.
✓ `orchestrate.test.ts` attempt contract — static attempt/retry-budget places and transitions represent failed attempt retry and exhaustion without dynamically rewriting the net.
✓ `petri.test.ts` epic contract — member success joins into integration, optional verification, and epic completion; dependent epics remain disabled until predecessor completion.
✓ Petrinaut projection suites — frozen SDCPN/replay surfaces retain the new places, transitions, subnet identities, and event order.

### Invariants preserved

- Journal appends remain fail-closed and precede hints/snapshots — guarded by `orchestrate.test.ts` and Petrinaut stream suites.
- `run.json` remains lifecycle authority — guarded by lifecycle projection/replay tests.
- Invalid plans fail closed — guarded by existing duplicate/dangling/cyclic topology tests plus new epic-reference validation.

### Verification Approach

- Inner: focused Vitest suites for topology, runtime, replay, and Petrinaut projection.
- Middle: `npm run fix` after the slice.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Independent slice starts have disjoint claims and co-selection | met | `orchestrate.test.ts`: dependency-ready starts carry separate claim inputs and `frontierFiringPolicy` selects both. |
| Static bounded attempts are connected to lifecycle and replay | met | `orchestrate.test.ts`: `slice_execute` seeds agent attempt 1; attempt-specific agent/verify success consumes the active token; active counters reconstruct in-flight attempt 2/exhaustion; durable per-slice/stage cycle history keeps terminal projection sequence/count equal to journal replay after retry success. `petri.test.ts`: replay proves attempt 1 → retry → attempt 2 and attempt 3 → exhaustion. |
| Failed attempts journal fact then marking transition fail-closed | met | `orchestrate.test.ts`: agent and verify retries assert `attempt_failed` before `*_retry`; bound exhaustion asserts `*_exhausted` before `net_halted`; retry-append failure preserves only the durable failed-attempt prefix and halts. |
| Epic member join, optional verification, completion, and dependency gate | met | `petri.test.ts`: member tokens replay through integration, optional verification, and completion before producing dependent epic claims. |
| Frozen SDCPN/replay surfaces retain topology and event order | met | `petri.test.ts`: SDCPN retains attempt success/retry/exhaustion transitions; Petrinaut replay projection preserves slice execute → retry → attempt-specific success order while non-marking `attempt_failed` remains journal-visible. |
| Journal appends remain fail-closed before hints/snapshots | met | Existing append-failure tests plus retry-transition append-failure regression are enabled and green. |
| `run.json` remains lifecycle authority | met | Active counters plus completed per-slice/stage attempt cycles reconstruct exact serial history; HITL reset journals a static reset before rerunning; no journal read, durable parallel marking authority, or new lifecycle store was added. |
| Invalid plans fail closed, including epic references/dependencies | met | Duplicate, dangling, self-referential, cyclic epic, and dangling slice-to-epic tests remain green. |

Skipped-test delta vs parent: 0.

### Cross-cutting obligations

- Frozen definition must include every transition that can fire.
- Attempt facts remain honest and stable across journal, replay, and observer projections.
- Durable parallel side-effect authority stays excluded.

### Expected touched paths (tentative)

```text
src/executor/
├── orchestrate-topology.ts       ~
├── petri-runtime.ts              ~
├── petri-replay.ts               ~
├── petrinaut/                    ~
└── __tests__/
    ├── orchestrate.test.ts       ~
    └── petri.test.ts             ~
```

## Slice 2 — Isolated slice execution and deterministic fan-in

Status: done
Weight: full

### Target Behavior

Each slice executes in an isolated workspace whose successful output is integrated deterministically into the run workspace or fails closed on conflict.

### Cold-start reads

- `memory/SPEC.md` — D111-L, D112-L, I58-L
- `memory/PLAN.md` — frontier `petri-execution-parity`
- `src/executor/TOPOLOGY.md` — effect boundaries
- `src/executor/execution-ports.ts`, `src/app/git-worktree-port.ts`, `src/app/git-land-port.ts` — injected git seams
- `docs/praxis/worktree-agents.md` — isolation constraints

### Boundary Crossings

→ enabled slice/attempt
→ executor-owned isolation/fan-in contracts
→ app-layer git adapter
→ isolated workspace
→ conflict-checked run-workspace integration
→ run metadata/report/journal facts

### Risks and Assumptions

- RISK: shared request/result/stream paths overwrite attempts → MITIGATION: derive paths from slice plus attempt identity and pin with filesystem tests.
- RISK: fan-in mutates the run tree before conflict certainty → MITIGATION: adapter performs conflict preflight and returns no integration side effect on failure.
- ASSUMPTION: per-slice isolation is sufficient for parity; old `main` did not create per-attempt worktrees.
  → IMPACT IF FALSE: add per-attempt workspace creation only with evidence, not as compatibility theater.
  → VALIDATE: two independent slices write the same filename differently and produce a fail-closed conflict without clobber.

### Posture check

Lights up the first isolated slice-output path and directly tests whether serial authority can safely surround co-firable effects.

### Acceptance Criteria

✓ new isolation core/adapter tests — independent slices receive distinct workspaces and stable attempt-scoped artifact paths.
✓ integration tests — non-conflicting slice commits fold in deterministic dependency order into the run workspace.
✓ conflict test — conflicting outputs halt/replan with no partial run-workspace mutation.
✓ `orchestrate.test.ts` — completed integration emits its declared transition before dependent slice/epic work becomes ready.

### Invariants preserved

- Host mutation remains behind accepted promotion — guarded by executor boundary and host-promotion suites.
- Core executor imports no app/git subprocess implementation — guarded by `boundaries.test.ts`.
- One writer serializes `run.json` updates — guarded by lifecycle tests.

### Verification Approach

- Inner: focused core fake-port tests and real-git adapter fixture tests.
- Middle: executor and app test families, then `npm run fix`.

### Cross-cutting obligations

- Integration conflicts are product facts, not thrown/unstructured adapter failures.
- Side effects are bounded and named under I58-L.
- No untracked workspace cleanup is introduced.

### Concurrency divergence

The safe old-`main` isolation/fan-in shape is implemented. Its oracle proved that actual overlapping effects require the authority promotion now scoped as Slice 3; Slice 2 therefore closes on isolation and deterministic fan-in rather than simulating overlap through the single active-slice ladder.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Distinct stable per-slice workspaces and attempt-distinct artifacts | met-with-divergence | `orchestrate.test.ts` proves dependency-ordered agents receive distinct stable workspace paths; retry tests prove attempt-distinct result and agent/verify stream paths. Workspaces are per-slice, not per-attempt. Effects remain serial rather than actually overlapping. |
| Non-conflicting commits integrate deterministically | met | `git-slice-integration-port.test.ts` real-git ordered integration; `orchestrate.test.ts` fake-port dependency-order lifecycle. |
| Conflict halts/replans without partial run-workspace mutation | met | Real-git conflict test proves unchanged run HEAD/tree/index; core and drive tests prove structured conflict report, unchanged `run.json`, no `slice_integrate` firing, and `net_halted`. |
| Integration transition precedes dependent readiness | met | `orchestrate.test.ts`, `petri.test.ts`, extension updates, and RPC stream tests include explicit `slice_integrate:<sliceId>` before `slice_complete`/dependency release. |
| Host mutation remains behind accepted promotion | met | Slice adapter mutates only run-local/slice worktrees; host-promotion real-git suite remains green. |
| Executor core imports no app/git implementation | met | `boundaries.test.ts`. |
| `run.json` remains one-writer serial authority | met-with-divergence | Lifecycle tests remain serial and replay-equivalent for this slice; the resulting concurrency limit promoted D123-L and Slice 3. |

Skipped-test delta vs parent: 0.

### Expected touched paths (tentative)

```text
src/executor/
├── execution-ports.ts            ~
├── slice-workspace.ts            +
├── slice-integration.ts          +
├── slice-execute.ts              ~
├── agent-result.ts               ~
├── test-result.ts                ~
├── orchestrate.ts                ~
├── petri-runtime.ts              ~
├── run.ts                        ~
└── __tests__/                    ~
src/app/
├── git-slice-integration-port.ts +
├── pi-extensions.ts              ~
└── __tests__/                    ~
```

## Slice 3 — Durable parallel slice authority

Status: done
Weight: full

### Target Behavior

Dependency-independent slice effects overlap only after their claims are durable, and each completion or failure updates authoritative journal/marking state independently.

### Cold-start reads

- `memory/SPEC.md` — D111-L, D112-L, D123-L, I58-L
- `memory/PLAN.md` — frontier `petri-execution-parity`
- `src/executor/TOPOLOGY.md` — run summary, journal, marking, and side-effect boundaries
- `src/executor/orchestrate.ts`, `src/executor/petri-runtime.ts`, `src/executor/petri-marking.ts` — current serial driver and recovery hints
- `src/executor/slice-workspace.ts`, `src/executor/slice-integration.ts` — isolated effect boundaries from Slice 2

### Boundary Crossings

→ co-firable Petri frontier
→ durable claim journal + marking
→ concurrently executing isolated slice effects
→ per-slice durable completion/failure
→ serial conflict-checked integration
→ run-summary projection

### Risks and Assumptions

- RISK: process interruption leaves ambiguous external effects → MITIGATION: persist claims before dispatch and recover claimed-but-unfinished slices as explicit halted/replan work, never silently re-fire.
- RISK: one slice failure rolls back unrelated claims → MITIGATION: completion/failure is per-slice; successful sibling evidence remains durable and integrable.
- RISK: concurrent fan-in races mutate the run tree → MITIGATION: effects overlap only in isolated workspaces; integration remains serialized in deterministic dependency order.
- ASSUMPTION: same-process bounded concurrency is sufficient for parity; split-process delivery remains out.
  → IMPACT IF FALSE: a durable broker/file watcher becomes a new frontier.
  → VALIDATE: controlled promise barriers plus restart/replay fixtures.

### Posture check

Retires the binding serial-authority assumption discovered by Slice 2 and lights up the first truthful overlapping side-effect path.

### Acceptance Criteria

✓ production-path oracle — registered `execute_orchestrate` composes `petriScheduler` + `frontierFiringPolicy`, overlaps independent effects, and preserves coherent progress updates.
✓ `orchestrate.test.ts` concurrency oracle — two dependency-independent agent effects cross a shared barrier before either completes.
✓ claim-order oracle — every effect starts only after its claim event and marking snapshot are durable.
✓ failure-isolation oracle — one failed slice leaves a successful sibling's completion durable and never rewinds its marking.
✓ recovery oracle — claimed-but-unfinished effects after restart halt/replan without automatic duplicate side effects.
✓ fan-in oracle — successful outputs integrate serially in deterministic dependency order; conflicts preserve the last clean run tree.
✓ observer/Petrinaut oracle — live and reconnect timelines expose simultaneous in-flight slice places and converge to equivalent terminal replay.

### Invariants preserved

- Run-control and host promotion remain serial and explicitly accepted — guarded by existing lifecycle/promotion suites.
- Journal append failure starts no unclaimed side effect — guarded by fail-closed claim tests.
- Frozen topology is never rewritten during execution — guarded by Petrinaut definition tests.

### Verification Approach

- Inner: deterministic barrier-based concurrency tests, journal/marking replay tests, and real-git serial fan-in tests.
- Middle: executor/app/RPC suites and `npm run fix`.

### Cross-cutting obligations

- D123-L authority applies only to concurrently firing isolated slice effects.
- `run.json` remains observer summary and serial run-control authority, not concurrent slice truth.
- No split-process broker or generic event spine.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Production `execute_orchestrate` reaches parallel authority | met | `execute-orchestrate-updates.test.ts`: the registered tool holds two independent injected agents behind one deterministic barrier, observes both entered before release, and emits worker details whose `progress.activeSliceId` matches each stream's slice. Production explicitly composes `petriScheduler` + `frontierFiringPolicy`; attached step observers no longer disable multi-slice batching. |
| Serial and one-step callers retain bounded semantics | met | `drive()` defaults remain linear/serial; parallel batching requires the explicit frontier policy, at least two slice starts, and no `maxFirings`. `execute_replan_retry_current_step` remains explicit `linearScheduler` + `serialFiringPolicy` + `maxFirings: 1`; executor max-firing and extension retry suites remain green. |
| Independent agent effects genuinely overlap | met | `orchestrate.test.ts`: deterministic promise barrier observes both slice ids entered before either is released; entry order is intentionally unconstrained. |
| Claims and marking are durable before dispatch | met | `orchestrate.test.ts`: each agent entry observes both `slice_start` journal facts and consumed claim places; blocked agents expose both attempt-1 places from the snapshot while `run.json` remains `reports_initialized`. Journal- and marking-write fault tests start zero agent effects. |
| Per-slice failure cannot rewind a successful sibling | met | `orchestrate.test.ts`: task-1 exhaustion retains task-2 integration/completion report and transition facts; terminal snapshot and journal replay agree on task-1 exhausted plus task-2 epic-member marking. |
| Claimed unfinished restart halts/replans without duplication | met | `orchestrate.test.ts`: persisted `parallelSliceBatch` returns `parallel_slice_replan_required` with zero agent/test calls; journal-ahead recovery after a failed claim snapshot does the same. |
| Fan-in is serialized and deterministic; conflict preserves clean prefix | met | `orchestrate.test.ts`: three claimed outputs integrate with maximum concurrency 1 in task-1/task-2 order, stop at task-2 conflict, and retain only task-1 summary. `git-slice-integration-port.test.ts` proves real-git conflict preflight leaves the run tree/index/HEAD unchanged. |
| Live observer and reconnect Petrinaut views expose overlap and converge | met | `orchestrate.test.ts`: `readRunDetail` exposes both simultaneous agent-attempt places from snapshot authority; process-live events equal the re-read journal exactly, and Petrinaut replay reproduces that firing timeline through terminal. Existing RPC live/reconnect suites remain green. |
| `run.json` remains summary + serial run-control authority | met | Barrier oracle observes unchanged `reports_initialized` metadata during overlap; only ordered successful integration updates `completedSliceIds`/commit summary. No parallel active-slice fields were added. |
| Frozen topology and injected effects are preserved | met | No topology compiler/net mutation; batch fires existing frozen transitions and invokes only injected `ExecutionPorts`. `boundaries.test.ts`, Petrinaut definition tests, executor/app/RPC suites are green. |

Skipped-test delta vs parent: 0.

### Expected touched paths (tentative)

```text
src/executor/
├── orchestrate.ts                ~
├── petri-runtime.ts              ~
├── petri-marking.ts              ~
├── petri-events.ts               ~
├── run.ts                        ~
├── observer-read.ts              ~
├── TOPOLOGY.md                   ~
└── __tests__/                    ~
src/rpc/                          ?
memory/SPEC.md                    ~
memory/PLAN.md                    ~
```

## Slice 4 — Epic verification and completion

Status: done
Weight: full

### Target Behavior

An epic completes only after all member outputs are integrated and its declared verification passes against the integrated tree.

### Cold-start reads

- `memory/SPEC.md` — D111-L, D112-L, D123-L, I58-L
- `memory/PLAN.md` — frontier `petri-execution-parity`
- `src/executor/TOPOLOGY.md` — test-runner and promotion boundaries
- `src/executor/orchestrate-topology.ts`, `src/executor/petri-runtime.ts` — epic topology from Slice 1
- `src/executor/parallel-slice-batch.ts`, `src/executor/parallel-slice-batch/authority.ts` — authoritative parallel completion gates from Slice 3
- `src/executor/test-result.ts`, `src/executor/run-complete.ts`, `src/executor/report-verdict.ts` — verification truth

### Boundary Crossings

→ integrated epic member outputs
→ epic verification transition
→ injected test runner over the integrated run tree
→ reports/journal verdict
→ epic-complete transition
→ dependent epic/run completion

### Risks and Assumptions

- RISK: empty epic verification becomes a fake passing oracle → MITIGATION: empty verification follows the explicit no-verification completion branch; non-empty verification must execute and pass.
- RISK: run completion reads slice verdicts but ignores epic verdicts → MITIGATION: one canonical report-verdict query gates both epic and run completion.
- ASSUMPTION: FE-1195 parity excludes old `main` brownfield remediation, oracle-edit rejection, and dual re-verification loops.
  → IMPACT IF FALSE: frontier scope expands materially and must return to `ln-plan`.
  → VALIDATE: PLAN's explicit-out boundary and parity-focused acceptance tests.

### Posture check

Lights up the complete member-slices → integration → epic verification → dependent epic/run path and stabilizes epic lifecycle meaning.

### Acceptance Criteria

✓ epic lifecycle tests — epic completion is disabled until every member slice is integrated.
✓ epic verification tests — declared verification runs against the integrated tree; failure halts/replans and success enables epic completion.
✓ dependency test — dependent epic slices remain blocked until predecessor epic completion.
✓ run completion test — the run cannot complete with failed/missing required epic verification.
✓ observer/Petrinaut tests — epic progress and terminal facts are visible and replay-equivalent.

### Invariants preserved

- Failed verification never promotes — guarded by existing promotion and new epic completion tests.
- Optional empty epic verification remains explicit rather than synthesized — guarded by contrastive empty/non-empty tests.
- Promotion verifies the same integrated run tree — guarded by real-git fan-in plus promotion fixture.
- Epic verification never auto-fires as a pure gate before its declared test runs — guarded by journal/replay negative-space tests.

### Verification Approach

- Inner: focused epic lifecycle, report verdict, observer, and Petrinaut tests.
- Middle: `npm run fix` and full executor/app/RPC suites.
- Gate: `npm run verify` before submit.

### Cross-cutting obligations

- Topology documentation must describe the materialized epic and isolation seams.
- D123-L's bounded authority split must remain limited to concurrently firing isolated slice effects.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Epic integration waits for all member integrations | met | `orchestrate.test.ts` serial and parallel epic tests: member `slice_integrate`/`slice_complete` firings precede executable `epic_integrate`; the parallel batch returns to the same serial epic lane. |
| Non-empty verification executes exactly once on the integrated run tree | met | `orchestrate.test.ts`: configured `TestRunnerPort` receives the run worktree and run `VerifyTarget` once after slice verification; the captured promotion worktree is identical. Plan criterion targets appear only in `epic_test_result.verification` provenance. |
| Empty verification is explicit integrate -> complete | met | `orchestrate.test.ts`: empty epic emits `epic_integrate`, no `epic_test_result`/runner call, then `epic_complete`. |
| Failed verification halts without false gates or release | met | `orchestrate.test.ts`: failed run-tree test appends durable failed `epic_test_result`, then `net_halted`; journal, marking replay, and `readRunDetail` contain integrate but no `epic_verify`, `epic_complete`, dependent agent, run terminal, or promotion. |
| Dependent epic starts only after predecessor completion | met | `orchestrate.test.ts`: dependent agent observes predecessor `epic_complete` already durable; multi-epic runtime test binds simultaneous epic steps by `epicId`. |
| Run completion requires completed and verified epics | met | `run-complete.test.ts`: incomplete epic and missing/failed required epic verdicts all refuse `run_completed`; successful serial/parallel drives complete normally. |
| Observer/Petrinaut replay remains equivalent | met | Focused orchestrator/Petri/observer suites: failed verification negative-space agrees across journal replay, marking snapshot, `readRunDetail`, and terminal reason; RPC live/reconnect suites retain one firing per executable epic transition. |
| D123-L and promotion invariants remain intact | met | Parallel overlap/restart/failure/fan-in suites remain green; epic lifecycle is serial after batch convergence, and verification/promotion both target the same integrated run worktree. |

Skipped-test delta vs parent: 0.

### Expected touched paths (tentative)

```text
src/executor/
├── epic-verification.ts          +
├── epic-complete.ts              +
├── report-verdict.ts             ~
├── run-complete.ts               ~
├── orchestrate-topology.ts       ~
├── petri-runtime.ts              ~
├── observer-read.ts              ~
├── TOPOLOGY.md                   ~
└── __tests__/                    ~
memory/SPEC.md                    ?
memory/PLAN.md                    ~
```
