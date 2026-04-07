# brunch

## symlinks

This project uses symlinks for tool compatibility. Do not duplicate or overwrite these — edit the target file.

- `CLAUDE.md` → `AGENTS.md` (same file; CLAUDE.md is what Claude Code reads, AGENTS.md is the canonical name)
- `.claude/skills/` → `.agents/skills/` (skill definitions live in `.agents/skills/`)

## workflow

Slices and spikes in `memory/PLAN.md` are the unit of work. When starting one:

1. Create a Linear issue under FE-531 — use `/cli-linear`
2. Create a Graphite stacked branch — use `/cli-graphite` (read `docs/praxis/graphite-workflow.md` first)

One branch per slice/spike. Stacked branches mirror slice dependencies in PLAN.md. Graphite manages the stack; Linear tracks the issue.

### naming conventions

- **Branch**: `ln/{issue-id}-{keywords}` (e.g. `ln/fe-534-walking-skeleton`)
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
