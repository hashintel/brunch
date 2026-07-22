# brunch

## symlinks

This project uses symlinks for tool compatibility. Do not duplicate or overwrite these — edit the target file.

- `CLAUDE.md` → `AGENTS.md` (same file; CLAUDE.md is what Claude Code reads, AGENTS.md is the canonical name)
- `.claude/skills/` → `.agents/skills/` (skill definitions live in `.agents/skills/`)

## workflow

Plan-level frontier items in `memory/PLAN.md` are the unit of tracker/branch work. Here, a **frontier item** means one named canonical work item in the plan (preferably a stable id in `Frontier Definitions`, sequenced under `Sequencing`) — not a scope card or an implementation slice discovered later.

When starting a new frontier item:

1. Create a Linear issue in the **Frontend (FE)** team and **brunch** project — use `/cli-linear`
   - Do **not** parent new post-release issues under FE-531; FE-531 tracked the now-closed initial release.
   - Only set a parent issue when the user or current plan explicitly names an active parent.
2. Create a Graphite stacked branch — use `/cli-graphite` (read `docs/praxis/graphite-workflow.md` first)

One branch per frontier item. `ln-scope` may thin that frontier item into smaller scoped slices for implementation, but those do **not** get their own Linear issues or branches by default. Keep slices on the same issue + branch unless `ln-plan` explicitly revises `memory/PLAN.md` into separate frontier items that should stack independently. Stacked branches mirror frontier-item dependencies in PLAN.md, not intra-frontier slice sequencing. Graphite manages the stack; Linear tracks the plan-level frontier item.

### naming conventions

- **Branch**: `{prefix}/{issue-id}-{keywords}` — `{prefix}` is whatever `gt user branch-prefix` returns (set per-user via `gt user branch-prefix --set <prefix>`).
- **PR title**: `{issue-id | upper}: {Linear issue title in sentence case}` (e.g. `FE-534: Walking skeleton SDK to SSE to React`)

PR descriptions are written only when tying off a branch — not during active development.

### git vs gt

Use `git` for commits and reads (status, log, diff, add, commit). Use `gt` for stack-aware operations (create, submit, restack, move, track, checkout). Details and rationale in `docs/praxis/graphite-workflow.md`.

## development phase posture

Brunch is pre-release. Optimize for conceptual correctness, domain clarity, and future leverage over backward compatibility with existing local/dev data.

Do not preserve old data models, fixtures, dummy data, or compatibility shims merely because they exist. If a schema or domain model is wrong, change it and regenerate fixtures/seeds/tests as needed. Migration support is required only when SPEC.md, PLAN.md, or the user explicitly says existing data must be preserved.

Be rigorous about deletion. Retire stale concepts, obsolete code paths, superseded docs, unused fixtures, and compatibility scaffolding once they no longer serve the current model. Keep the lexicon tight: prefer one canonical domain/conceptual term, update callers/docs/tests to match it, and remove aliases or legacy names when they stop carrying useful history.

This is not permission for unrelated rewrites: keep changes scoped to the active seam, preserve accepted invariants, and verify behavior through the normal harness.

## code organization

Use a lightweight fractal sub-tree pattern when a file outgrows its current mini-library boundary. Keep the original file as the public entry point (for example, `context-pack.ts`) and place private implementation modules in a same-named folder (for example, `context-pack/observer-capture.ts`). External consumers should continue importing from the public root file; only that root file should import from its private sub-tree. Split along semantic purpose, not file shape, and avoid speculative folder scaffolding until the file has real pressure.

## planning

Two canonical documents in `memory/`:

- **SPEC.md** [create: /ln-spec · read: all · update: /ln-sync] — what and why
- **PLAN.md** [create: /ln-plan · read: all · update: /ln-sync, /ln-build, /ln-spike] — what's next

Traceability: assumptions in SPEC.md link to decisions and frontier items in PLAN.md. Scope-card slices inherit from their containing frontier unless they reveal durable changes. Skills that touch planning or completion (/ln-spec, /ln-plan, /ln-build, /ln-spike) maintain these cross-references.

### skills

The `/ln-*` skills at `.agents/skills/` follow this flow. See `docs/praxis/ln-skills.md` for the colleague-facing reference, discretionary tools, and chooser table.

- **Knowledge**: /ln-grill or /ln-disambiguate → /ln-spec → /ln-plan → /ln-oracles
- **Execution**: /ln-scope → /ln-spike (optional) → /ln-build
- **Quality**: /ln-review → /ln-refactor (optional) → /ln-sync
- **Process**: /ln-consult (triage), /ln-handoff (state capture), /ln-design (interface exploration)

Verification boundary: /ln-spec owns inner-loop verification (commands, policy). /ln-oracles owns middle/outer loop strategy, diagnostic assessment, and blind spots. /ln-scope applies the oracle strategy per slice. /ln-review audits oracle coverage.

### verification

**Inner loop** (run after every meaningful edit): `npm run fix` — lint-fixes then auto-formats.

**Gate** (run before committing): `npm run verify` — check (fmt + lint, no writes) → test → build. All must pass.

| Script | Purpose | Writes? |
| --- | --- | --- |
| `npm run fix` | lint:fix + fmt (inner loop) | yes |
| `npm run check` | fmt:check + lint (CI gate) | no |
| `npm run verify` | check + test + build (full gate) | no |

Tooling: oxlint (lint + type-aware + type-check via tsgolint), oxfmt (format). Verification strategy details in SPEC.md §Verification Design.

## operational protocols

Read these before the relevant activity:

- **`docs/praxis/graphite-workflow.md`** — before creating branches, submitting PRs, or reintegrating parallel work
- **`docs/praxis/worktree-agents.md`** — before spawning parallel agent builds with `isolation: "worktree"`
- **`docs/praxis/manual-testing.md`** — before outer-loop UI testing or fixture capture
- **`docs/praxis/dev-server-logs.md`** — before reading runtime logs from the dev server or browser

## Cursor Cloud specific instructions

Environment is prepared by the startup update script (`npm ci`). Standard commands live in `CONTRIBUTING.md` (`npm run dev`, `npm test`, `npm run build`, `npm run verify`, `npm run seed`). Non-obvious caveats for this VM:

- **Node version.** The exec-daemon injects an older Node (v22.14) at the front of `PATH`, but `package.json` requires `>=22.19.0`. nvm has v22.22.2 installed, and `~/.bashrc` prepends it so interactive shells resolve the right Node. If `node --version` ever shows `< 22.19`, run `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"` (or `nvm use 22.22.2`) before `npm run dev`/tests/build.
- **Anthropic key.** The dev server reads `ANTHROPIC_API_KEY` from the environment (provided as a secret); no `.env` file is needed. Without it, `src/server/preflight.ts` exits before `npm run dev` starts.
- **App URL / ports.** `npm run dev` serves the UI at `http://localhost:5173` and the API at `http://localhost:3000` (API routes are under `/api`; `/` returns 404). Runtime logs stream to `tmp/logs/latest/{vite,api,browser,combined}.log`. The SQLite DB lives at `.brunch/brunch.db` (gitignored); wipe it to reset a manual walkthrough.
- **Test suite parallelism.** `npm test` (`vitest run`) is reliable for the core product (`src/server`, `src/client`, `src/shared`). The `src/orchestrator` ("cook") subsystem spawns many git/child processes and its tests are flaky under full parallelism on this 4-core VM — they hit the default 5s timeout and report spurious failures. Run the orchestrator dir serially for a clean signal: `npx vitest run src/orchestrator --no-file-parallelism --testTimeout=30000`.
- **Orchestrator external tools.** A few `src/orchestrator` tests spawn `bun` (`test-runner.test.ts`) and `bwrap`/bubblewrap (`sandbox-guard.test.ts`); neither is installed here, so those specific tests fail. They are not needed for the core spec-elicitation product.
- **Stale docker artifacts.** `docker-compose.yml` and `Dockerfile` reference a Dolt SQL server and `server/server.js` that do not match the current SQLite/`src/server` codebase. Ignore them for local dev; the real dev path is `npm run dev`.
