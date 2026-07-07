# Executor Run Environment Substrate And Verify Policy

Frontier: executor-run-environment
Linear:   FE-1166
Status:   active
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: run creation metadata -> worktree substrate creation -> test runner invocation.
- Trigger: `cook-layered-todo` greenfield execution proved the scheduler/plan path, then failed because the run substrate was a full Brunch git worktree and verification was hardcoded to `npm run verify`.
- Posture: proving.

## Target Behavior

Executor runs can declare their environment policy independently of source-copy policy:

- `substrate: git_worktree` keeps the current brownfield/full-repo behavior.
- `substrate: empty_dir` creates an isolated run directory without checking out the host repo.
- `verifyTarget` records the command/args that `execute_test_result` should run for that run.

## Acceptance Criteria

- `execute_run_create` can persist `substrate` and `verifyTarget` in `run.json`.
- `execute_worktree_create` creates an empty directory substrate without invoking `GitWorktreePort` when requested.
- `execute_test_result` passes the run's `verifyTarget` to the injected `TestRunnerPort`.
- Existing default behavior remains compatible: omitted substrate uses `git_worktree`; omitted verify target uses `npm run verify`.

## Verification Approach

- Focused Vitest for run creation, worktree creation, test result ingestion, and `createTestRunnerPort`.
- Adapter test for `execute_run_create` params.
- Gate: `npm run verify`.

## Non-goals

- No scaffold templating yet.
- No fixture-specific default selection from seed metadata yet.
- No marketplace extension integration.
- No change to host promotion semantics.
