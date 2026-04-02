# Graphite Workflow

Graphite manages the stacked branch structure. Every slice gets its own branch; the stack mirrors PLAN.md dependencies.

## git vs gt boundary

Use **git** for local operations that don't touch the stack:

- `git status`, `git diff`, `git log` — read state
- `git add`, `git commit` — stage and commit changes
- `git stash` — temporary state management

Use **gt** (via `/cli-graphite`) for stack-aware operations:

- `gt create ln/{issue-id}-{keywords}` — create a new stacked branch
- `gt submit` — push the stack to remote and create/update PRs
- `gt restack` — rebase the stack after changes to a parent branch
- `gt move --onto <branch>` — reparent a branch in the stack
- `gt track --parent <branch>` — adopt an existing git branch into the stack
- `gt checkout <branch>`, `gt top`, `gt bottom` — navigate the stack

**Why the split matters:** `gt` commands maintain Graphite's internal metadata about branch parentage. Using raw `git checkout -b` or `git rebase` bypasses this metadata and can corrupt the stack. Commits and reads don't touch stack metadata, so plain git is fine for those.

## Branch naming

- **Format**: `ln/{issue-id}-{keywords}` (e.g. `ln/fe-534-walking-skeleton`)
- **PR title**: `{issue-id | upper}: {Linear issue title in sentence case}` (e.g. `FE-534: Walking skeleton SDK to SSE to React`)
- PR descriptions are written only when tying off a branch — not during active development.

## Typical slice lifecycle

```
gt create ln/fe-XXX-keywords     # new branch on top of stack
# ... implement slice ...
git add <files> && git commit    # plain git for commits
npm run verify                   # gate before submit
gt submit                        # push + create/update PR
```

## Reintegrating parallel work

When worktree agents produce branches outside the Graphite stack:

1. Merge the agent's branch into the target branch (plain git)
2. In the control worktree: `gt track --parent <parent-branch>` to adopt if needed
3. `gt restack` to rebase any downstream branches
4. `gt submit` to push the updated stack

All `gt` commands happen in the control worktree. Worker worktrees use plain git only.
