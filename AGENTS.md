# brunch

## symlinks

This project uses symlinks for tool compatibility. Do not duplicate or overwrite these — edit the target file.

- `CLAUDE.md` → `AGENTS.md` (same file; CLAUDE.md is what Claude Code reads, AGENTS.md is the canonical name)
- `.claude/skills/` → `.agents/skills/` (skill definitions live in `.agents/skills/`)

## workflow

Plan-level frontier items in `memory/PLAN.md` are the unit of tracker/branch work. Here, a **frontier item** means one named work item in the plan (for example, an item in `Active`, `Next`, or `Horizon`) — not a scope card or an implementation sub-slice discovered later.

When starting a new frontier item:

1. Create a Linear issue in the **Frontend (FE)** team and **brunch** project — use `/cli-linear`
   - Do **not** parent new post-release issues under FE-531; FE-531 tracked the now-closed initial release.
   - Only set a parent issue when the user or current plan explicitly names an active parent.
2. Create a Graphite stacked branch — use `/cli-graphite` (read `docs/praxis/graphite-workflow.md` first)

One branch per frontier item. `ln-scope` may thin that frontier item into smaller scope cards or sub-slices for implementation, but those do **not** get their own Linear issues or branches by default. Keep sub-slices on the same issue + branch unless `ln-plan` explicitly revises `memory/PLAN.md` into separate frontier items that should stack independently. Stacked branches mirror frontier-item dependencies in PLAN.md, not intra-item sub-slice sequencing. Graphite manages the stack; Linear tracks the plan-level work item.

### naming conventions

- **Branch**: `{prefix}/{issue-id}-{keywords}` — `{prefix}` is whatever `gt user branch-prefix` returns (set per-user via `gt user branch-prefix --set <prefix>`).
- **PR title**: `{issue-id | upper}: {Linear issue title in sentence case}` (e.g. `FE-534: Walking skeleton SDK to SSE to React`)

PR descriptions are written only when tying off a branch — not during active development.

### git vs gt

Use `git` for commits and reads (status, log, diff, add, commit). Use `gt` for stack-aware operations (create, submit, restack, move, track, checkout). Details and rationale in `docs/praxis/graphite-workflow.md`.

## planning

Two canonical documents in `memory/`:

- **SPEC.md** [create: /ln-spec · read: all · update: /ln-sync] — what and why
- **PLAN.md** [create: /ln-plan · read: all · update: /ln-sync, /ln-build, /ln-spike] — what's next

Traceability: assumptions in SPEC.md link to decisions and slices in PLAN.md. Skills that touch planning or completion (/ln-spec, /ln-plan, /ln-build, /ln-spike) maintain these cross-references.

### skills

The `/ln-*` skills at `.agents/skills/` follow this flow:

- **Knowledge**: /ln-grill → /ln-spec → /ln-plan → /ln-oracles
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

- **Dev server**: `npm run dev` starts both Vite (`:5173`) and Express API (`:3000`) via `agent-tail`. Logs are written to `tmp/logs/` under the workspace root — see `docs/praxis/dev-server-logs.md` for details.
- **Fixture seeding**: Use `npm run seed <scenario>` to populate `.brunch/brunch.db`. Wipe first with `rm -f .brunch/brunch.db*` for a clean state. See `CONTRIBUTING.md § Fixture Scenarios` for available scenarios.
- **ANTHROPIC_API_KEY**: Required to exercise AI chat turns. Without it the server starts and serves seeded data, but chat requests will fail. Pass it when starting the dev server (e.g. `ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npm run dev`) or create a `.env` file in the workspace root.
- **Blank-page recovery**: If the SPA shows a blank page with `504 Outdated Optimize Dep` in the browser console, kill dev-server listeners, run `rm -rf node_modules/.vite-*`, and restart `npm run dev` (documented in `CONTRIBUTING.md`).
- **Verification commands**: See the `## verification` section above — `npm run fix` (inner loop), `npm run check` (CI gate), `npm run verify` (full gate including tests and build).
