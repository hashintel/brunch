# executor-agent-runner — default runner composition proof

## Objective

Prove `execute_agent_result` uses the default app-composed `AgentRunnerPort` when sealed subagent deps are injected, instead of requiring a manually supplied fake port.

## Acceptance Criteria

✓ `src/.pi/extensions/__tests__/registry.test.ts` — `createBrunchPiExtensions` with `subagents` but without an explicit `agentRunner` registers `execute_agent_result` through the default runner.

✓ The default runner launches the sealed `worker` over the run worktree, observes a real file change in that worktree, writes the result artifact, and preserves the existing metadata/report transition.

## Verification Approach

- Inner: focused registry test for default runner composition.
- Gate: `npm run verify`.
