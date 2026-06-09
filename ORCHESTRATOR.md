# Orchestrator (`brunch cook`)

Compiles a plan (epics + slices) into a **Petri net** and runs it — each transition fires an
AI agent step in an isolated git worktree. Add `--petrinaut-stream` to watch it live.

## The two example plans (TL;DR)

| Fixture | What it does | The point |
| --- | --- | --- |
| `fixtures/parallel-utils` | Builds 8 independent utility functions (chunk, unique, debounce, …) after one setup step. | **Fan-out / speed** — `parallel` builds them all at once; `serial` does them one-by-one. Watch the agent pool drain and refill. |
| `fixtures/layered-todo` | Builds a Todo service (`types → store + validation → service`) then a CLI over it. | **Dependency join** — `service` waits for *both* `store` and `validation`; the `cli` group waits for `core` to finish. |

## 0. Check prerequisites

```bash
which pi && pi --version          # need pi >= 0.74
test -f .env && echo ".env ok"    # must hold the model key, e.g. ANTHROPIC_API_KEY=...
```

## 1. Run a fixture

```bash
npx tsx src/server/cli.ts cook fixtures/parallel-utils/ --policy=parallel
```

## 2. Run it live in Petrinaut

```bash
PORT=6006 \
PETRINAUT_URL=https://petrinaut-git-cf-fe-petrinaut-actual-brunch-integration.stage.hash.ai/brunch?sse=http://localhost:6006/stream \
npx tsx src/server/cli.ts cook fixtures/parallel-utils/ \
  --petrinaut-stream --policy=parallel --petrinaut-fold=identity --verbose
```

Boots a local SSE server, prints a launcher link, and opens your browser on the live net.

## 3. Show the parallel speedup (run both, compare)

```bash
npx tsx src/server/cli.ts cook fixtures/parallel-utils/ --policy=serial --petrinaut-stream
npx tsx src/server/cli.ts cook fixtures/parallel-utils/ --policy=parallel --petrinaut-stream
```

## 4. Show a dependency join

```bash
npx tsx src/server/cli.ts cook fixtures/layered-todo/ --policy=parallel --petrinaut-stream
```

`service` stays dark until **both** `store` and `validation` finish.

## 5. Run from the published binary (no checkout)

```bash
PORT=6006 \
PETRINAUT_URL=https://petrinaut-git-cf-fe-petrinaut-actual-brunch-integration.stage.hash.ai/brunch?sse=http://localhost:6006/stream \
npx @hashintel/brunch cook ./my-plan --petrinaut-stream --policy=parallel
```

`./my-plan` must contain a `plan.yaml` (the published package does not bundle fixtures).

## 6. Run against a real repo (codebase mode)

```bash
git status --porcelain --untracked-files=no   # must be empty
npx tsx src/server/cli.ts cook "$(pwd)" --policy=serial --max-retries=1
```

Reads `.brunch/cook/specs/<id>/plan.yaml` (newest emitted spec). Requires a clean tree.

## 7. Generate a plan from a spec

```bash
npx @hashintel/brunch plan <specId>                       # writes .brunch/cook/specs/<specId>/plan.yaml
npx @hashintel/brunch cook "$(pwd)" --spec=<specId> --policy=parallel
```

Review the emitted YAML — verification targets must point at real test files.

## 8. Inspect a run

```bash
RUN=$(ls -t .brunch/cook/runs/ | head -1)
cat ".brunch/cook/runs/$RUN/reports.jsonl"     # what each step did
ls ".brunch/cook/runs/$RUN/"                    # net.json, net.sdcpn.json, petrinaut-events.jsonl, worktree/
```

## 9. Clean up worktrees

```bash
RUN_ID=$(basename "$(ls -td .brunch/cook/runs/*/ | head -1)")
git worktree remove --force ".brunch/cook/runs/$RUN_ID/worktree"
git branch -D "cook/$RUN_ID" 2>/dev/null
git branch --list "cook-slice/$RUN_ID/*" | xargs -n1 git branch -D 2>/dev/null
rm -rf ".brunch/cook/runs/$RUN_ID"
git worktree prune
```

---

## Flags

| Flag | Default | |
| --- | --- | --- |
| `--policy=serial\|parallel` | `serial` | one step at a time vs all enabled (pool-bounded); serial greenfield runs in one shared tree |
| `--max-retries=N` | `3` | retry budget per slice before it halts |
| `--out=<dir>` | — | promote a completed **greenfield** run into `<dir>` as a git commit |
| `--force` | off | allow `--out` promotion into a non-empty target (lands on `cook/<runId>`) |
| `--petrinaut-stream` | off | live SSE view + browser open |
| `--petrinaut-fold=color\|identity` | `identity` | `identity` keeps each slice; `color` collapses repeats onto token color |
| `--petrinaut-lanes=both\|mechanical` | `both` | `mechanical` hides the semantic lane in the projection |
| `--petrinaut-url=<url>` | — | Petrinaut route (else `PETRINAUT_URL`); requires `--petrinaut-stream` |
| `--no-petrinaut-open` | opens | don't auto-open the browser |
| `--spec=<id>` | newest | which emitted spec plan to cook |
| `--verbose`, `-v` | off | echo raw pi-agent output |

**Env:** `PETRINAUT_URL` (required when streaming) · `PORT` (pin the SSE port; avoid `6000` and any port a dev server uses).

## Plan format

```yaml
epics:
  - id: demo
    summary: "My feature"
    depends_on: []
    verification: []                      # optional cross-slice integration tests
slices:
  - id: greet
    epic_id: demo
    definition: "Add `greet(name: string): string` in src/greet.ts returning `Hello, <name>!`."
    depends_on: []
    writes: ["src/greet.ts"]              # repo-relative paths this slice exclusively writes
    verification:
      - kind: unit-test
        target: "tests/greet.test.ts"     # must be a real test file
```

Name the exact file + change in each `definition`; give each slice a real
`verification.target`. Declare every file a slice writes in `writes` (exact paths,
no globs): the executability contract enforces **single-writer-per-file**, so a path
claimed by two slices is a `file-write-conflict`. A "join" slice is just the sole
writer of a shared file (e.g. `src/index.ts`) that `depends_on` the slices it joins.
Keep demos to 1–3 slices. `.brunch/` is gitignored.

`mode` (`greenfield`|`brownfield`) and `profile` (toolchain) are **spec-derived** and
written by `brunch plan`; authored fixture plans omit both and load as `greenfield`
with the `bun` toolchain.

## See also

`docs/praxis/orchestration-guide.md` · `docs/design/orchestrator-demo-fixtures.md` · `memory/SPEC.md` §Lexicon
