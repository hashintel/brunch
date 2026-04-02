# brunch

## symlinks

This project uses symlinks for tool compatibility. Do not duplicate or overwrite these — edit the target file.

- `CLAUDE.md` → `AGENTS.md` (same file; CLAUDE.md is what Claude Code reads, AGENTS.md is the canonical name)
- `.claude/skills/` → `.agents/skills/` (skill definitions live in `.agents/skills/`)

## workflow

Slices and spikes in `memory/PLAN.md` are the unit of work. When starting one:

1. Create a Linear issue under FE-531 — use `/cli-linear`
2. Create a Graphite stacked branch: `ln/{issue-id}-{keywords}` (e.g. `ln/fe-534-walking-skeleton`) — use `/cli-graphite`

One branch per slice/spike. Stacked branches mirror slice dependencies in PLAN.md. Graphite manages the stack; Linear tracks the issue.

### naming conventions

- **Branch**: `ln/{issue-id}-{keywords}` (e.g. `ln/fe-534-walking-skeleton`)
- **PR title**: `{issue-id | upper}: {Linear issue title in sentence case}` (e.g. `FE-534: Walking skeleton SDK to SSE to React`)

PR descriptions are written only when tying off a branch — not during active development.

## planning

Two canonical documents in `memory/`:

- **SPEC.md** [create: /ln-spec · read: all · update: /ln-sync] — what and why
- **PLAN.md** [create: /ln-plan · read: all · update: /ln-sync, /ln-build, /ln-spike] — what's next

Traceability: assumptions in SPEC.md link to decisions and slices in PLAN.md. Skills that touch planning or completion (/ln-spec, /ln-plan, /ln-build, /ln-spike) maintain these cross-references.

### skills

The `/ln-*` skills at `.agents/skills/` follow this flow:

- **Knowledge**: /ln-grill → /ln-spec → /ln-plan
- **Execution**: /ln-scope → /ln-spike (optional) → /ln-build
- **Quality**: /ln-review → /ln-refactor (optional) → /ln-sync
- **Process**: /ln-consult (triage), /ln-handoff (state capture), /ln-design (interface exploration)

### verification

Verification strategy is defined per-project in SPEC.md §Verification Design (three-tier feedback loops). The global verification harness in `~/.claude/CLAUDE.md` provides the execution stack.

### manual testing

When a slice requires manual UI testing (outer-loop verification):

1. **Dev server**: use `/tool-cmux` to open a terminal pane, run `npm run dev` there
2. **Browser**: use `/tool-cdp-cli` to launch Chrome with DevTools Protocol, open the dev URL, and interact (snapshot, fill, click, eval, console)

This keeps the dev server and browser observable without leaving the agent session.
