# Petri execution parity review remediation

Frontier: petri-execution-parity
Status:   done
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

Status: done
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

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Graph-authored frontiers project end to end | met | `execute-projection.test.ts`: composition maps epic membership, frontier dependency maps `depends_on`, positive criterion witness maps verification with criterion provenance, and artifacts preserve the direct schema. |
| Orphan requirements remain executable slices | met | Projection emits no synthetic epic/`epic_id`; `orchestrate.test.ts` executes orphan slices serially and concurrently with absent epic identity through ports/events. |
| Invalid membership and empty epics reject | met | Multiple frontier composition throws during snapshot projection; plan check blocks empty authored frontiers; topology rejects direct and dependent zero-member epics. |
| Epic dependencies require persisted completion | met | `slice-start.test.ts` refuses completed-member-only state, reports `{kind: epic_dependency}`, then starts after `completedEpicIds`; observer projection exposes the same blocker. |
| Epic history preserves durable order | met | `orchestrate.test.ts`: epics complete in dependency-driven non-plan order; restart repairs corrupted summary order from journal without adding events/effects. Metadata projection consumes only journal-derived `epicTransitionHistory`. |
| Frozen authority semantics remain | met | D123 parallel overlap/fan-in/restart and D124 same-run/epic-claim suites remain green; existing topology ids/arcs remain unchanged for valid plans. |

Skipped-test delta vs parent: 0.

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

Status: done
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

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Accepted marking owns active-batch readiness | met | Claimed/running/unintegrated/mixed-failed/all-failed barrier tests show `petriReadySteps: []` and per-slice `parallel_authority` blockers; consumed claims never reappear ready. |
| Batch stream inventory survives reconnect | met | `sliceStreamInventory` enumerates every claimed slice plus actual agent/verify attempt files; observer tests cover claimed, running, succeeded-unintegrated, failed, integrated, and all-failed states. |
| RPC exposes the same active authority | met | `execute.run` RPC barrier test returns both running slices, authority blockers, stream tails, and attempt inventory while `run.json` remains serial. |
| Serial and parallel share lifecycle mechanics | met | `isolated-slice-operations.ts` owns start/request, one agent/verify attempt, streams/reports, integration/completion, thrown reasons, and retry disposition; adapters retain metadata/authority sequencing. |
| Artifact and vocabulary parity | met | Serial-vs-parallel parity test compares request bytes, agent streams, per-slice report sequence, verify artifacts, and attempt histories for two slices. |
| Fractal boundary remains closed | met | `boundaries.test.ts` scans all `src/**` imports: only `parallel-slice-batch.ts` may import its private subtree; shared operations are a documented public executor module. |
| Full gate and skip count | met | Executor/app/extension/RPC families and final `npm run verify`/`npm run check` pass; skipped-test delta is 0. |

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

## Slice 4 — Fresh review authority and observer closure

Status: done
Weight: full

### Target Behavior

Concurrent authority remains singular and visible through write windows, restart, reconnect, and every observer projection.

### Acceptance Criteria

✓ fan-in admission tests — active batch marking survives summary updates; standalone starts cannot duplicate active work.
✓ epic-claim tests — claimed/transitioned verification is blocked explicitly and cannot appear ready.
✓ reconnect tests — persisted run ordering preserves cross-slice agent/verify order before tail limiting.
✓ restart tests — malformed/torn epic history halts without metadata fallback or effects.
✓ projection tests — mixed and all-failed parallel requirement states agree through executor, RPC, and web.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Batch remains authority in fan-in summary window | met | `orchestrate.test.ts`: metadata-listener write-window detail retains failed/integrated/running blockers and no ready starts. |
| Standalone start shares run admission | met | `slice-start.test.ts`: contended owner and persisted batch both refuse with no metadata mutation. |
| Epic verification claim blocks readiness | met | `orchestrate.test.ts`: claimed and transitioned snapshots suppress `epic_verify` and expose `epic_verification_authority`. |
| Reconnect preserves global stream order | met | `orchestrate.test.ts`: agent `A1,B1,A2` and verify `V1,W1,V2` survive reconnect; limit 2 returns the newest global pair. |
| Torn epic journal fails closed | met | `orchestrate.test.ts`: restart returns structured `petri_input_unreadable` and invokes no runner. |
| Parallel requirement status is shared | met | mixed/all-failed executor tests, active RPC projection, and web running-status rendering. |
| D123/D124 and shared core remain bounded | met | parallel authority stays in marking; run admission remains process-local; stream writes remain in `isolated-slice-operations.ts`. |

Skipped-test delta vs parent: 0.

## Slice 5 — Versioned production projection and stream crash closure

Status: done
Weight: full

### Target Behavior

The authored execution projection has one current version and one production witness, while stream reconnect authority cannot omit an event persisted before a mirror fault.

### Acceptance Criteria

✓ version tests — snapshot, outline, draft, and preview emit v2 and reject v1 at consuming boundaries.
✓ artifact tests — outline/draft artifacts persist v2; cook plan provenance remains v1.
✓ production consumer test — registered `execute_plan_file` persists multi-frontier authored semantics and an orphan slice.
✓ crash-window test — ordered stream carrier persists before the attempt mirror and reconnect still returns the event when the mirror fails.
✓ topology test — executor decision register includes D124-L and D125-L.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Projection chain is coherently v2 | met | focused snapshot/check/outline/draft/preview tests assert v2 and explicit v1 rejection. |
| Persisted artifacts carry current version | met | outline and draft artifact tests compare exact v2 payloads; plan-file test pins `PlanFileProvenance.schemaVersion: 1`. |
| Registered production path carries D125 authored semantics | met | `registry.test.ts`: `execute_plan_file` persists F1/F2 memberships, F2 dependency, AC1 epic/slice verification, and orphan task-3. |
| Stream fault cannot hide a persisted event | met | `slice-stream-events.test.ts`: attempt mirror fails after journal append; `readRunDetail` reconnect returns runSequence 0. |
| Decision register is complete | met | `src/executor/TOPOLOGY.md` header names D124-L and D125-L. |

Skipped-test delta vs parent: 0.
