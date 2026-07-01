# Refactor: executor-sandbox port internals (FE-1109 review findings 1–3)

## Problem Statement

The two app-layer execution ports were built in parallel and drifted into avoidable duplication:

- `git-worktree-port` and `test-runner-port` each carry their own copy of the same `spawn`-based subprocess runner and its `CommandResult` / `CommandRunner` types. The only real difference is that the test runner surfaces a distinct spawn-error signal while the git port folds it into stderr. The two pending ports (agent-runner, git-land) will shell out too, so this becomes four copies.
- Test fakes for the ports exist in three places: the shared `fake-ports` helper, a parametrized inline fake in the worktree test, and local copies in the extension registry test. A port-contract change would need edits in three spots.
- `TestRunArgs` carries a `cwd` field that no runner uses (tests run inside the worktree). It was added only for shape-symmetry with the git worktree args.

## Solution

- One app-layer subprocess runner owns stdio capture, exit-code, and spawn-error semantics. Both ports (and future ports) keep only their command/args and their result mapping.
- One canonical set of port test fakes that every test imports.
- `TestRunArgs` describes only what a test runner actually needs.

Observable behavior is unchanged: same commands, same success/failure results, same reported side effects.

## Commits

1. ~~**Drop the unused `cwd` from the test-run arguments.**~~ Done. Removed from the port argument type, the executor call site, and the app + executor test assertions that named it.

2. ~~**Extract a single app-layer subprocess runner and have both ports use it.**~~ Done. Added a shared `command-runner` module (spawn wrapper + `CommandResult` with a `spawnError` signal); both ports consume it. Git port's spawn-error message preserved via a `spawnError` fallback, locked by a new git spawn-failure test.

3. **Consolidate the port test fakes onto the shared helper.** Give the shared git-worktree fake an optional behavior override so it can replace the parametrized inline fake, add any missing fake the registry test needs, then point the worktree test and the registry test at the shared helper and delete their local copies.

## Decisions

- New module: a shared app-layer subprocess runner used by all execution ports.
- Interface change: `TestRunArgs` loses `cwd`; the shared runner result carries an explicit spawn-error field.
- No change to port public contracts (`GitWorktreePort.create`, `TestRunnerPort.run`), tool side-effect reports, or run-metadata transitions.

## Testing Decisions

- Keep the port contract tests behavior-first: assert the command/args issued, the pass/fail/errored result, and the reported side effects — not the internal runner wiring.
- Add one git-worktree-port test for the spawn-failure message (the gap that makes commit 2 risky).
- Fakes are test infrastructure; a single shared source keeps them honest against the real port types.

## Out of Scope

- Wiring tool cancellation (`_signal`) or a timeout into the verify subprocess (separate behavioral slice).
- Making the verify command configurable beyond its current option.
- Any change to `AgentRunnerPort` / `GitLandPort` (pending frontiers).
- The retained `.brunch/cook/` runtime paths (settled decision).
