# brunch

## symlinks

This project uses symlinks for tool compatibility. Do not duplicate or overwrite these — edit the target file.

- `CLAUDE.md` → `AGENTS.md` (same file; CLAUDE.md is what Claude Code reads, AGENTS.md is the canonical name)
- `.claude/skills/` → `.agents/skills/` (skill definitions live in `.agents/skills/`)

## git workflow

- Branch naming: `ln/{param-case-issue-id}-{param-case-keywords}` (e.g. `ln/fe-534-walking-skeleton`)
- Use Graphite (`gt`) for stacked PRs. Use `tool-graphite` skill for reference.
- Use Linear CLI (`linear`) for issue management. Use `tool-linear-cli` skill for reference.
- Parent issue: FE-531 (Spec elicitation deliverable)

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
