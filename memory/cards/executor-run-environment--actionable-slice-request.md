# Executor Actionable Slice Request

Frontier: executor-run-environment
Status:   active
Mode:     slices
Created:  2026-07-08

## Orientation

- Seam: execution graph projection -> cook-compatible plan file -> active slice request -> sealed worker task -> verify runner.
- Frontier: `executor-run-environment` (FE-1166), because the failed run used the newly exposed `empty_dir` substrate plus `npm_test` verify profile and proved that configurability alone is not enough.
- Posture: proving (inherited from `executor-run-environment`).
- Main risk: a greenfield worker cannot infer build steps from ids alone; the request artifact must carry enough executable context without leaking graph internals or turning executor core into an agent prompt module.

## Scope Sequence

1. Slice A: preserve executable verification context in the plan projection.
2. Slice B: write a self-contained active-slice request for the sealed worker.

## Slice A: Plan Criteria Projection

### Target Behavior

Executable plan artifacts preserve graph verification/check nodes that witness projected requirements.

### Full-card cold-start reads

- `memory/SPEC.md` — D98-L, D111-L, D112-L, I58-L; capability requirements 24-26.
- `memory/PLAN.md` — frontier: `executor-run-environment`; related closed frontier: `executor-run-integrity`.
- `src/executor/TOPOLOGY.md` — projection boundary, cook compatibility, and side-effect rules.
- `memory/cards/executor-run-environment--substrate-verify.md` — current substrate/verify behavior this card completes.

### Boundary Crossings

```text
graph check / criterion facts
-> ExecutionSpecSnapshot
-> executable plan outline / draft
-> old-cook plan preview/file
```

### Risks and Assumptions

- RISK: existing graph kinds use `check` as oracle-plane proof rather than intent-plane `criterion`, so projection may need to accept both without broadening semantics too far. -> MITIGATION: add the smallest graph fixture with `REQ1` witnessed by `CH1`; lower only nodes connected to requirements by witness/verification edges.
- ASSUMPTION: check nodes linked to a requirement by witness edges are safe to expose as executable verification hints. -> IMPACT IF FALSE: workers may treat weak/manual checks as hard acceptance. -> VALIDATE: test names the exact graph edge categories that are lowered and rejects unrelated oracle context.

### Posture Check

This is a proving slice: it turns the transcript's `requirement_without_criteria` warning into a focused projection regression and retires the assumption that oracle check nodes are already executable-plan visible.

### Acceptance Criteria

✓ `src/executor/__tests__/execution-spec-snapshot.test.ts` — a requirement witnessed by check nodes projects those checks into the execution snapshot.
✓ `src/executor/__tests__/execute-plan-outline.test.ts` or `executable-plan-draft.test.ts` — the requirement's executable task carries acceptance/verification entries derived from the projected checks.
✓ `src/executor/__tests__/plan-file.test.ts` — written `plan.yaml` contains non-empty `criteria` or slice `verification` for the witnessed requirement.

### Verification Approach

- Inner: targeted Vitest over executor projection and plan-file tests.
- Gate: `npm run verify` before commit.

## Slice B: Actionable Worker Request

### Target Behavior

The active slice execution request contains enough context for a sealed worker in an empty directory to scaffold, implement, and verify the slice.

### Full-card cold-start reads

- `memory/SPEC.md` — D98-L, D111-L, D112-L, I58-L; capability requirements 24-26.
- `memory/PLAN.md` — frontier: `executor-run-environment`; related closed frontier: `executor-run-integrity`.
- `src/executor/TOPOLOGY.md` — `slice-execute.ts`, `agent-result.ts`, `test-result.ts`, and run side-effect rules.
- `memory/cards/executor-run-environment--substrate-verify.md` — current `empty_dir` and `npm_test` policy.

### Boundary Crossings

```text
run metadata + populated plan
-> slice-execute request artifact
-> AgentRunnerPort worker task
-> sealed worker writes worktree
-> TestRunnerPort verify target
```

### Risks and Assumptions

- RISK: request payload grows into an ad hoc prompt schema. -> MITIGATION: define a small typed request DTO in executor core with product facts only: run id, epic id, slice id, slice definition, derived requirements, acceptance/verification entries, substrate, source policy, and verify target.
- RISK: `npm_test` in `empty_dir` still fails if the worker does not create `package.json`. -> MITIGATION: request must state the verify command and that the worker owns any needed scaffold when the worktree is empty; regression should use a fake agent runner that asserts it receives those facts, not rely on a model.
- ASSUMPTION: the worker can act from a deterministic JSON request plus rendered task text. -> IMPACT IF FALSE: the worker prompt needs a separate design slice. -> VALIDATE: focused `AgentRunnerPort` test proves the rendered task includes the structured request verbatim.

### Posture Check

This is a proving tracer: it lights up the exact failing path from `empty_dir + npm_test` to a worker request that is no longer just `{runId, sliceId, epicId, action, status}`.

### Acceptance Criteria

✓ `src/executor/__tests__/slice-execute.test.ts` — `request.json` for an active slice includes the slice definition, derived requirement text, acceptance/verification entries, selected substrate/source policy, and verify target.
✓ `src/app/__tests__/agent-runner-port.test.ts` — the sealed worker task includes the structured execution request and paths without dropping the slice body.
✓ `src/executor/__tests__/orchestrate.test.ts` — an `empty_dir + npm_test` run with a fake agent that writes a minimal package/test fixture reaches `promotion_prepared` or the configured run-local terminal state with passing verification.
✓ Existing false-positive protections remain: failed `npm test` still blocks `run_completed` / promotion.

### Verification Approach

- Inner: targeted Vitest for `slice-execute`, `agent-runner-port`, and `orchestrate`.
- Middle: one fixture-style executor run test using `empty_dir + npm_test` and a fake agent/test runner or minimal real `npm test` scaffold.
- Gate: `npm run verify` before commit.

## Cross-cutting Obligations

- Preserve executor core purity: no SDK, Pi tool registration, graph DB reads, subprocess, or UI imports under `src/executor/`.
- Preserve I58-L side-effect honesty: `slice-execute.ts` writes only declared request/report/metadata artifacts; agent/test effects stay behind ports.
- Preserve run-integrity behavior: failed or missing verification never advances to completed/promoted state.
- Do not mutate host project files; host promotion remains behind explicit preflight/apply acceptance.

## Expected Touched Paths (Tentative)

```text
src/executor/
├── execution-spec-snapshot.ts       ~
├── execute-plan-outline.ts          ?
├── executable-plan-draft.ts         ~
├── plan-preview.ts                  ?
├── plan-file.ts                     ?
├── slice-execute.ts                 ~
├── TOPOLOGY.md                      ~
└── __tests__/
    ├── execution-spec-snapshot.test.ts ~
    ├── execute-plan-outline.test.ts    ?
    ├── executable-plan-draft.test.ts   ~
    ├── plan-file.test.ts               ?
    ├── slice-execute.test.ts           ~
    └── orchestrate.test.ts             ~
src/app/
├── agent-runner-port.ts             ?
└── __tests__/
    └── agent-runner-port.test.ts    ~
memory/cards/
└── executor-run-environment--actionable-slice-request.md +
```

## Notes From Failing Run

- Run id observed: `run-mrbyf8u9`.
- The generated `agent-output/task-1/request.json` contained only ids/status/action, so the worker produced a placeholder result and no source changes.
- `npm test` failed in the empty worktree with exit code 254 because no scaffold or package script existed.
- The transcript also showed `execute_plan_check` warning `requirement_without_criteria`, despite CH1/CH2 check nodes in the graph.
