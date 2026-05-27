# Cook brownfield on brunch

Run `brunch cook` against the brunch repo.

## Pre-flight

```sh
which pi && pi --version                       # pi >= 0.74
npm run build                                  # dist/ fresh
git status --porcelain --untracked-files=no    # must be empty
```

`.brunch/` is already gitignored, so cook artifacts won't appear in `git status`.

## Author the plan

Cook reads ONE file: `.brunch/cook/plan.yaml`. Two ways to produce it.

### A. Hand-author

```yaml
epics:
  - id: <epic-id>
    summary: <one-line>
    depends_on: []
    verification: []

slices:
  - id: <slice-id>
    epic_id: <epic-id>
    definition: |
      Modify `<symbol>` in `<file>`:
      - <what>
      - <constraint>
      Do not modify <thing-to-preserve>.
    depends_on: []
    verification:
      - kind: unit-test
        target: <path/to/existing.test.ts>
```

**Discipline:**

- Every slice needs a real `verification.target` (an existing test file) or `bun test` halts with no output → retry exhaustion.
- Definitions name exact file + exact change + exact constraint. Vague slices halt or short-circuit.
- 1–2 slices per run; more triggers more disk usage even with CoW.

### B. Generate from a `memory/PLAN.md` frontier

Cook's plan format is the orchestrator runtime, not the planning vocabulary — frontiers don't map mechanically.

Two bridges, both still manual review at the end:

- **`/ln-scope` then translate.** Run the skill on a frontier to get a scope card (Target Behavior + Acceptance + Verification), then translate to YAML by hand. Most disciplined.
- **One-shot pi translation.** Extract the frontier section and ask pi for YAML:
  ```sh
  FRONTIER="<id>"
  awk "/^### $FRONTIER\$/,/^### /" memory/PLAN.md | head -n -1 > /tmp/f.md
  pi -p --no-session --provider anthropic --model claude-haiku-4-5 \
     --tools "read,write" \
     "Translate /tmp/f.md into .brunch/cook/plan.yaml. One epic, one slice per
      Acceptance line (max 2). Each slice needs a verification.target pointing
      at a real bun-test file. Definitions name exact file + change + constraint.
      Output only YAML." > .brunch/cook/plan.yaml
  ```
  Always review — pi hallucinates file paths.

Long-term answer: `petri-graph-compilation` (blocked on FE-700) compiles cook nets directly from workspace graph, no `plan.yaml` step.

## Cook

```sh
node --env-file=.env bin/brunch.js cook "$(pwd)" --policy=serial --max-retries=1
```

`"$(pwd)"` (absolute path) is required — relative `.` resolves against brunch's packageRoot in the spawned CLI, not your shell pwd.

## Inspect

```sh
RUN=$(ls -t .brunch/cook/runs/ | head -1)

# Source byte-identical (brownfield invariant)
git diff HEAD --stat                          # empty
git status --porcelain --untracked-files=no   # empty

# Modification lives in the slice worktree, not on the cook branch as a commit
diff -r src/ ".brunch/cook/runs/$RUN/worktree/<slice-id>/src/" | head
cat ".brunch/cook/runs/$RUN/reports.jsonl"
```

## Promote (manual)

```sh
cp -R ".brunch/cook/runs/$RUN/worktree/__epic__/<epic-id>/." .
git status   # review and commit normally
```

No automatic `git merge cook/<runId>` yet — that's the deferred `cook-artifact-lifecycle` frontier.

## Cleanup

```sh
RUN_ID=$(basename "$(ls -td .brunch/cook/runs/*/ | head -1)")
git worktree remove --force ".brunch/cook/runs/$RUN_ID/worktree"
git branch -D "cook/$RUN_ID"
git branch --list "cook-slice/$RUN_ID/*" | xargs -n1 git branch -D
rm -rf ".brunch/cook/runs/$RUN_ID"
rm -f .brunch/cook/plan.yaml
```

Periodic stragglers: `git worktree prune` + `git branch --list 'cook*' | xargs -n1 git branch -D`.

## Known limitations

- **Pi evaluator may short-circuit.** Pi has `read,write,edit,bash` even during `evaluate-done` and may fix the file during evaluation rather than going through write-tests → write-code → run-tests. Non-deterministic.
- **No commit on the cook branch.** Modification is in untracked subdirs of the cook branch's worktree, not committed. Promotion is manual `cp -R`.
- **Plan vs frontier mismatch.** `.brunch/cook/plan.yaml` is orchestrator runtime, not planning vocabulary. `/ln-scope` or pi-assisted translation is the bridge.
