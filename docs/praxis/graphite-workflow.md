# Graphite Workflow

Graphite manages the stacked branch structure. Every plan-level `memory/PLAN.md` frontier item gets its own branch; the stack mirrors PLAN.md dependencies. Here, a **frontier item** means one named canonical work item in the plan itself, preferably keyed by a stable id in `Frontier Definitions` and ordered in `Sequencing` — not a scope card or an implementation slice discovered during `ln-scope` / `ln-build`. Those refinements stay on the same branch unless `ln-plan` is rerun and splits the frontier into separate PLAN.md items.

## git vs gt boundary

Use **git** for local operations that don't touch the stack:

- `git status`, `git diff`, `git log` — read state
- `git add`, `git commit` — stage and commit changes
- `git stash` — temporary state management

Use **gt** (via `/cli-graphite`) for stack-aware operations:

- `gt create {prefix}/{issue-id}-{keywords}` — create a new stacked branch for the current frontier item (`{prefix}` from `gt user branch-prefix`)
- `gt submit` — push the stack to remote and create/update PRs
- `gt restack` — rebase the stack after changes to a parent branch
- `gt move --onto <branch>` — reparent a branch in the stack
- `gt track --parent <branch>` — adopt an existing git branch into the stack
- `gt checkout <branch>`, `gt top`, `gt bottom` — navigate the stack

**Why the split matters:** `gt` commands maintain Graphite's internal metadata about branch parentage. Using raw `git checkout -b` or `git rebase` bypasses this metadata and can corrupt the stack. Commits and reads don't touch stack metadata, so plain git is fine for those.

## Frontier setup

Every new plan-level frontier item starts with a Linear issue in the **Frontend (FE)** team and the **brunch** project, unless the user or current plan explicitly says otherwise. Do not parent new post-release issues under FE-531; only set a parent when the user or `memory/PLAN.md` names an active parent.

Then create or track the corresponding Graphite branch. If another tool creates a raw git branch first, immediately `gt track --parent <parent-frontier-branch>` and rename to the standard branch format if needed.

## Branch granularity

- Branch / Linear-issue granularity follows the containing `memory/PLAN.md` frontier item.
- A frontier item is the plan-level work item; scope cards and implementation slices are execution detail inside it.
- `ln-scope` may narrow one frontier item into multiple buildable slices or consecutive scope cards; keep them on one branch.
- If several consecutive scope cards are prepared ahead of time, keep that sequence in a single `Mode: slices` scope file under `memory/cards/`. Multiple scope files for the same frontier (independent concerns) do **not** imply multiple branches, and detailed slice history does not belong in `memory/PLAN.md`.
- Only create a new branch when starting a different frontier item, or after `ln-plan` explicitly splits the frontier into separate PLAN.md items that should stack independently.
- If scoping shows the current frontier item is too large, revise `memory/PLAN.md` first, then align the branch stack to the revised frontier.

## Branch naming

- **Format**: `{prefix}/{issue-id}-{keywords}` — `{prefix}` is whatever `gt user branch-prefix` returns (set per-user via `gt user branch-prefix --set <prefix>`).
- **PR title**: `{issue-id | upper}: {Linear issue title in sentence case}` (e.g. `FE-534: Walking skeleton SDK to SSE to React`)
- PR descriptions are written only when tying off a branch — not during active development.

## Typical frontier-item lifecycle

```
gt create {prefix}/fe-XXX-keywords  # new branch for one PLAN.md frontier item
# ... implement one or more scoped slices on this branch ...
git add <files> && git commit    # plain git for commits
npm run verify                   # fast local checkpoint before submit (CI runs the full gate)
gt submit                        # push + create/update PR
```

## Trunks & merging

Graphite tracks two trunks for this repo: `main` and `next` (see `.graphite_repo_config` in the git dir). Base a stack on whichever trunk the current frontier item's PLAN.md dependency points at.

Both trunks merge through a GitHub merge queue once their PRs are approved and their required checks pass — `gt submit` pushes the stack, and Graphite (or `gh pr merge --squash --auto`) enqueues each PR; the queue rebases downstream PRs onto each newly-landed parent automatically. `next` has no required-approval gate (checks-only, frictionless integration trunk); `main` requires one approval and currently has a known issue where the queue's automatic rebase dismisses that approval on every restack, stalling multi-PR stacks — see `docs/praxis/merge-queue.md` for the mechanism and the interim one-PR-at-a-time workaround.

## Reintegrating parallel work

When worktree agents produce branches outside the Graphite stack:

1. Merge the agent's branch into the target branch (plain git)
2. In the control worktree: `gt track --parent <parent-branch>` to adopt if needed
3. `gt restack` to rebase any downstream branches
4. `gt submit` to push the updated stack

All `gt` commands happen in the control worktree. Worker worktrees use plain git only.
