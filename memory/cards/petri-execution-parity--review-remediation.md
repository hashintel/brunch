# Petri execution parity review remediation

Frontier: petri-execution-parity
Status:   active
Mode:     slices
Created:  2026-07-13

Posture: proving (inherited from `petri-execution-parity`).

## Slice 1 — Unified execution authority

Status: done
Weight: full

### Target Behavior

Every external executor effect is admitted once per run, durably claimed before invocation, and durably settled or halted across throws and crashes.

### Cold-start reads

- `memory/SPEC.md` — D111-L, D112-L, D123-L, I58-L
- `memory/PLAN.md` — frontier `petri-execution-parity`
- `src/executor/TOPOLOGY.md` — journal/marking/run-summary authority

### Acceptance Criteria

✓ concurrent-drive tests — same-run callers execute effects once; different runs overlap; rejected owners release waiters.
✓ epic crash tests — verification claim prevents rerun; journal/marking evidence catches metadata up without rerunning; append failure advances no summary.
✓ thrown-effect tests — workspace/agent/verifier throws become per-slice settlements and terminal facts while successful siblings remain durable.

### Verification Approach

- Inner: deterministic barriers and fault-injection tests in executor/extension suites.
- Middle: executor, extension, RPC suites plus `npm run fix`.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Same canonical run executes external effects once | met | `orchestrate.test.ts`: two canonical-path drives share one worktree effect/outcome; `execute-orchestrate-updates.test.ts`: concurrent production tool calls invoke one agent. |
| Different runs overlap | met | Deterministic two-run worktree barrier observes both owners entered before release. |
| Rejected owner releases waiters and mutex state | met | Same-run owner/waiter share one thrown rejection; a subsequent drive acquires authority and completes. |
| Epic claim precedes runner | met | Runner-entry oracle observes durable `epic_verification_claimed`, marking phase `claimed`, and absent `verifiedEpicIds`. |
| Claimed crash never reruns; durable pass catches summary up | met | Claimed-without-result restart invokes zero runners and halts; transitioned-marking restart invokes zero runners, writes missing summary, and retains one `epic_verify` fact. |
| Epic ordering and carrier failures | met | Pass journals `epic_verify` and transitioned marking before summary; journal/marking claim failures invoke zero runners and advance no summary. |
| Thrown epic runner is durable terminal failure | met | Thrown runner appends failed `epic_test_result` with reason/message, then `net_halted` and terminal marking retaining its claim. |
| Thrown parallel effects settle per slice | met | Workspace, request artifact, agent, and verifier throw cases each persist typed failed settlement step/reason, integrate successful sibling, and end with terminal marking. |
| D123-L remains bounded | met | Parallel claim/fan-in/restart suites remain green; D124-L owns only process-local run admission and epic effect claims, with no durable process lease. |

Skipped-test delta vs parent: 0.

### Expected touched paths (tentative)

```text
src/executor/
├── run-execution-authority.ts    +
├── orchestrate.ts                ~
├── epic-lifecycle.ts             ~
├── parallel-slice-batch/         ~
├── petri-marking.ts              ~
├── petri-events.ts               ~
└── __tests__/                    ~
```

## Slice 2 — Canonical execution model

Status: queued
Weight: full

### Target Behavior

All admitted plan shapes obey one epic-aware readiness and ordered replay model across standalone, serial, and parallel execution.

### Acceptance Criteria

✓ topology tests — zero-member epics reject; orphan slices execute serially and in parallel.
✓ standalone readiness tests — dependent slices require `completedEpicIds`, not merely completed members.
✓ replay-order tests — metadata summary never invents epic order that differs from the durable journal.
✓ authoring tests — production plan projection carries graph-authored epic membership, dependencies, and criterion verification; invalid multiple membership rejects.

### Verification Approach

- Inner: graph projection, topology, standalone-tool, replay, and production-plan tests.
- Middle: executor/app/extension suites plus `npm run fix`.

### Expected touched paths (tentative)

```text
src/executor/
├── execution-spec-snapshot.ts    ~
├── execute-plan-outline.ts       ~
├── executable-plan-draft.ts      ~
├── plan-preview.ts               ~
├── orchestrate-topology.ts       ~
├── petri-runtime.ts              ~
├── slice-start.ts                ~
└── __tests__/                    ~
```

## Slice 3 — Lifecycle depth and observers

Status: queued
Weight: full

### Target Behavior

Serial and parallel execution share one isolated-slice lifecycle core, and observers derive readiness and streams from active durable authority.

### Acceptance Criteria

✓ parity tests — serial and parallel adapters produce equivalent request/result/stream/report/attempt artifacts through shared core operations.
✓ observer tests — claimed slices are not reported ready; running, failed, and unintegrated batch streams survive reconnect.
✓ boundary tests — only the public batch facade imports its private subtree; executor core remains app-independent.
✓ full gate — no skipped-test delta and `npm run verify` passes.

### Verification Approach

- Inner: lifecycle parity and observer reconnect tests.
- Gate: `npm run verify` and `npm run check`.

### Expected touched paths (tentative)

```text
src/executor/
├── slice-*.ts                     ~
├── agent-result.ts                ~
├── test-result.ts                 ~
├── parallel-slice-batch/          ~
├── observer-read.ts               ~
├── TOPOLOGY.md                    ~
└── __tests__/                     ~
```
