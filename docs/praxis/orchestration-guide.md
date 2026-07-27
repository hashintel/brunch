# Orchestration guide — cook on brunch

Run `brunch cook` against the brunch repo in codebase (brownfield) mode.

## Pre-flight

```sh
npm run build                                  # dist/ fresh (bundles the in-process pi SDK)
grep -q '^ANTHROPIC_API_KEY=' .env             # cook feeds this to the embedded agent
git status --porcelain --untracked-files=no    # must be empty
```

`brunch cook` embeds `@earendil-works/pi-coding-agent` in-process (FE-841), so no external `pi` binary on `$PATH` is required — only `ANTHROPIC_API_KEY` in `.env`, which the cook command loads via `--env-file=.env`.

`.brunch/` is already gitignored, so cook artifacts won't appear in `git status`.

## Author the plan

Cook reads ONE file: `.brunch/cook/plan.yaml`.

**Target shape: read it from a spec-graph projection.** The intended long-term path is `petri-graph-compilation` (blocked on `intent-graph-semantics` / FE-700): cook compiles its net directly from workspace plan-graph nodes + relation policy, no `plan.yaml` step at all. The plan-graph projection becomes the source of truth; `.brunch/cook/plan.yaml` either disappears or becomes a derived artifact emitted by the compiler.

**Not done yet.** Until `petri-graph-compilation` lands, the bridge from spec/frontier to cook plan is manual. Two interim mechanisms:

### A. `/ln-scope`-then-translate (most disciplined interim)

Run `/ln-scope` on a `memory/PLAN.md` frontier to produce a scope card (Target Behavior + Acceptance + Verification). Translate the scope card to YAML by hand — usually 15–30 lines, 2–5 minutes. The scope card is the human-readable contract you can verify before spending pi tokens.

### B. One-shot pi translation (cheap interim)

Extract the frontier section and ask pi for YAML:

The `pi` CLI is no longer a global prerequisite, but it still ships inside the bundled dep — invoke it with `npx pi` (resolves to `node_modules/.bin/pi`):

```sh
FRONTIER="<id>"
awk "/^### $FRONTIER\$/,/^### /" memory/PLAN.md | head -n -1 > /tmp/f.md
npx pi -p --no-session --provider anthropic --model claude-haiku-4-5 \
   --tools "read,write" \
   "Translate /tmp/f.md into .brunch/cook/plan.yaml. One epic, one slice per
    Acceptance line (max 2). Each slice needs a verification.target pointing
    at a real bun-test file. Definitions name exact file + change + constraint.
    Output only YAML." > .brunch/cook/plan.yaml
```

Always review — pi hallucinates file paths.

### C. Hand-author (escape hatch)

For one-off experiments or when no frontier exists:

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

### Discipline (applies to all three)

- Every slice needs a real `verification.target` (an existing test file) or `bun test` halts with no output → retry exhaustion.
- Definitions name exact file + exact change + exact constraint. Vague slices halt or short-circuit.
- 1–2 slices per run; more triggers more disk usage even with CoW.

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

- **Agent runs in-process.** Cook drives the agent via the embedded `@earendil-works/pi-coding-agent` SDK (FE-841), not a spawned `pi` CLI. `evaluate-done` is scoped to a read-only tool allowlist (`toolsForAction('evaluate-done')`), so the evaluator cannot fix the file during evaluation (I126-K); `done` comes from executing the verification targets, not an LLM verdict.
- **No commit on the cook branch.** Modification is in untracked subdirs of the cook branch's worktree, not committed. Promotion is manual `cp -R`.
- **Plan vs frontier mismatch.** `.brunch/cook/plan.yaml` is orchestrator runtime, not planning vocabulary. `/ln-scope` or pi-assisted translation is the bridge.
