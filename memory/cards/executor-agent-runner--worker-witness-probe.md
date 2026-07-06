# executor-agent-runner — worker witness probe

## Objective

Add a runnable witness probe for the default executor agent-runner path.

## Acceptance Criteria

✓ `src/probes/__tests__/executor-agent-runner-witness.test.ts` — runs the default `AgentRunnerPort` through the sealed `worker` over a faux provider and observes an actual worktree write via `write_worktree_file`.

✓ Probe artifact writer persists portable request/result/proof/report files under `runs/executor-agent-runner-witness/<runId>/` when given a fixture root.

## Verification Approach

- Inner: focused witness probe tests.
- Gate: `npm run verify`.
