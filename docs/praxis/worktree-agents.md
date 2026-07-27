# Worktree Agent Protocol

Use `isolation: "worktree"` to run parallel agent builds in isolated copies of the repository. This enables concurrent scoped-slice implementation without merge conflicts during development.

## Known limitations

- **Isolation can fail.** The agent may execute git commands in the main worktree instead of the isolated one. Verify with `git worktree list` and `git status` in the main worktree immediately after spawning.
- **Merge gaps.** When parallel agents modify overlapping files, each agent works from the pre-fork state. Review must check that changes from one branch aren't missing in the other (e.g. agent A adds rendering code to a component, agent B copies the pre-A version).

## Protocol

### Before spawning

1. Ensure the main worktree is clean (`git status` — no uncommitted changes).
2. Identify which frontier items or scoped slices can run in parallel (check PLAN.md `## Sequencing` → `Parallel / Low-conflict` and `## Dependencies`).
3. Each agent gets a complete task description — it has no context from the parent conversation.

### During execution

- Monitor `git worktree list` to confirm agents are working in their isolated directories.
- If an agent's branch appears in the main worktree, the isolation failed — the agent is modifying your working copy.

### After completion

1. Review each agent's output independently.
2. Merge into the target branch (plain git — resolve conflicts manually).
3. Check for merge gaps: files modified by both agents where one is missing the other's changes.
4. Run `npm run verify` after merging.
5. Graphite reintegration happens in the control worktree only (see `graphite-workflow.md`).

## When not to use worktree agents

- When frontier items or scoped slices have direct dependencies (one needs the other's output).
- When the task requires interactive human steering (e.g. prompt iteration, visual design).
- When the risk of merge gaps exceeds the time saved by parallelism.
- For non-build tasks (spikes, reviews, spec work) — these don't benefit from isolation.
