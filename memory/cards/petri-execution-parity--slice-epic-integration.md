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
  → IMPACT IF FALSE: stop before side-effect concurrency and promote `petri-durable-parallel-authority`.
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

Status: queued
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

## Slice 3 — Epic verification and completion

Status: queued
Weight: full

### Target Behavior

An epic completes only after all member outputs are integrated and its declared verification passes against the integrated tree.

### Cold-start reads

- `memory/SPEC.md` — D111-L, D112-L, I58-L
- `memory/PLAN.md` — frontier `petri-execution-parity`
- `src/executor/TOPOLOGY.md` — test-runner and promotion boundaries
- `src/executor/orchestrate-topology.ts`, `src/executor/petri-runtime.ts` — epic topology from Slice 1
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

### Verification Approach

- Inner: focused epic lifecycle, report verdict, observer, and Petrinaut tests.
- Middle: `npm run fix` and full executor/app/RPC suites.
- Gate: `npm run verify` before submit.

### Cross-cutting obligations

- Topology documentation must describe the materialized epic and isolation seams.
- SPEC Future Direction must retain durable parallel authority as future work unless evidence promotes it.

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
