# executor-agent-runner — AgentRunnerPort contract slice

## Orientation

- Containing seam: `orchestrator-cutover` real-execution substrate, after `executor-sandbox` proved real git worktrees and real verify subprocesses behind injected capability ports.
- Frontier item: `executor-agent-runner` (FE-1111) on `ka/fe-1111-executor-agent-runner`, stacked on `ka/fe-1109-cook-sandbox`.
- Handoff state: no `HANDOFF.md` present; parent branch says FE-1109 is built and ready to tie off.
- Main open risk: the write-capable CODE worker must reuse the D90-L-D93-L sealed subagent substrate without punching an ambient write/shell hole into executor core or resurrecting prewritten `result.json` ingest.

## Scope Weight

Full scope card. This slice establishes the LLM-bearing execution-port seam and crosses executor core, Pi tool registration, app composition, and the sealed subagent substrate.

## Target Behavior

`execute_agent_result` runs an injected `AgentRunnerPort` for the active requested slice and records the runner's real output as the slice agent result.

## Boundary Crossings

```text
execute_agent_result Pi tool
→ src/executor/agent-result.ts
→ src/executor/execution-ports.ts AgentRunnerPort contract
→ injected app-layer runner implementation/fake
→ run worktree agent-output/report metadata
```

## Risks and Assumptions

- RISK: implementing the real write-capable worker and the orchestration transition in one slice obscures whether the port boundary is right. → MITIGATION: first prove the port contract and Pi injection with a fake runner; leave the concrete CODE worker body/catalog for the next slice.
- RISK: the old prewritten-file path remains live and masks that no worker ran. → MITIGATION: remove `missing_agent_result` / `readFile(result.json)` behavior from the tool path; focused tests must fail if no runner is injected or if the runner is not invoked.
- ASSUMPTION: `slice_execution_requested` metadata already carries enough context for the runner contract: run id, active epic/slice, worktree path, and request artifact path. → VALIDATE: the port args asserted in executor tests include those fields and no app/Pi imports enter `src/executor`.
- ASSUMPTION: a runner execution failure should not advance run metadata, matching `GitWorktreePort` and `TestRunnerPort` failure posture. → VALIDATE: focused failure test returns an explicit failure status with `sideEffects: []` and leaves `run.json` unchanged.

## Acceptance Criteria

✓ `src/executor/__tests__/agent-result.test.ts` — `ingestAgentResult` invokes an injected `AgentRunnerPort`, appends `slice_agent_result`, records `agentResultPath` / runner summary, and never reads a prewritten `agent-output/<sliceId>/result.json`.

✓ `src/executor/__tests__/agent-result.test.ts` — runner failure returns an explicit non-advancing status with no side effects and preserves `status:"slice_execution_requested"`.

✓ `src/.pi/extensions/__tests__/registry.test.ts` — the registered `execute_agent_result` tool is wired with the injected fake runner and no longer describes itself as prewritten-result ingestion.

✓ `src/executor/execution-ports.ts` — `AgentRunnerPort` has concrete arg/result types and executor core still imports no `src/app`, `.pi`, git, subprocess, or SDK implementation modules.

## Verification Approach

- Inner: focused Vitest contract tests for `agent-result` and Pi registry injection prove the port call, metadata transition, side-effect report, and failure posture.
- Middle: `npm run fix` after edits proves lint/format and catches type-aware seam drift.
- Gate: `npm run verify` before commit.

## Promotion Checklist

- [x] Does this change a requirement? It materializes D99-L's `AgentRunnerPort` layer.
- [ ] Does this create, retire, or invalidate an assumption?
- [x] Does this make or reverse a non-trivial design decision? It chooses the first runner transition shape: injected runner result instead of prewritten file ingest.
- [x] Does this establish a new seam-level invariant? Runner failure must not advance run metadata; executor core remains implementation-free.
- [x] Does it cross more than two major seams?
- [x] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Recommended Next Route

Build it with `ln-build`.
