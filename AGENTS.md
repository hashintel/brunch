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

## topology READMEs

Directory-level `README.md` files under `src/**/` are **canonical documentation co-located with the code they describe**. They materialize architectural intent into the file topology: what the directory owns and does not own, its dependency direction, the SPEC decision IDs (`D52-L`, `D40-L`, …) that lock its layout, the resource taxonomy or layout sketch, and any in-flight migration state. Treat them as drift-prone canonical artifacts alongside `memory/SPEC.md` and `memory/PLAN.md` — not as ambient prose.

Common drift sources:

- a SPEC decision cited by the README is renumbered, retired, or rewritten
- a file or module the README names is moved, renamed, retired, or replaced
- the dependency direction the README asserts no longer matches actual imports
- migration notes describe state that has since shipped or been abandoned
- the directory layout sketch no longer matches the directory's contents

Skills that touch canonical state (`/ln-sync`, `/ln-build`, `/ln-spec`, `/ln-review`, `/ln-refactor`) include topology READMEs in their drift checks and reconciliation. New topology READMEs should follow the established shape: short ownership statement, SPEC decision references, dependency rules, layout sketch when useful, and migration notes when relevant. Keep them short — they are an orientation surface, not a design doc; deep rationale belongs in `memory/SPEC.md` or `docs/`.

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

**Inner loop** (run after every meaningful edit): `npm run fix` — lint:fix then format.

**Gate** (run before committing): `npm run verify` — fix → test → build. The gate auto-applies inner-loop fixes; if anything else fails, stop and fix it.

**CI / read-only check**: `npm run check` — lint then fmt:check, no writes. Use this where the gate must not mutate the worktree.

| Script | Steps | Writes? |
| --- | --- | --- |
| `npm run fix` | lint:fix → fmt | yes |
| `npm run check` | lint → fmt:check | no |
| `npm run verify` | fix → test → build | yes (via fix) |

Ordering rationale: `fix` must run lint:fix before fmt because lint fixes can rewrite code that then needs reformatting. `check` mirrors that order (lint before fmt:check) so both scripts read as the same recipe in different modes.

Type-checking is done by oxlint via tsgolint (`.oxlintrc.json` sets `typeAware: true` and `typeCheck: true`); there is no separate `typecheck` script. Tooling: oxlint (lint + type-aware + type-check via tsgolint), oxfmt (format), vitest (test). Verification strategy details in SPEC.md §Verification Design.

## critical file-safety rule

Do not delete untracked files or directories without explicit user confirmation. Do not overwrite, revert, reset, reformat, or otherwise clobber uncommitted changes unless you know they are yours from this session or the user explicitly approves. Treat any uncommitted work from the user or another agent as protected. This includes newly-created local files, ignored files, scratch directories, generated-looking folders, empty placeholder directories, and modified tracked files. If cleanup or rollback seems appropriate, ask first and name the exact path(s) and action you propose.

## operational protocols

Read these before the relevant activity:

- **`docs/praxis/graphite-workflow.md`** — before creating branches, submitting PRs, or reintegrating parallel work
- **`docs/praxis/worktree-agents.md`** — before spawning parallel agent builds with `isolation: "worktree"`
- **`docs/praxis/manual-testing.md`** — before outer-loop UI testing or fixture capture
- **`docs/praxis/dev-server-logs.md`** — before reading runtime logs from the dev server or browser
- **`docs/praxis/pi-types.md`** — before typing Brunch seams over Pi session, extension, or UI APIs
