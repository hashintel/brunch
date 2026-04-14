# Worktree Agent Allocation Brief — retired for now

This file is **not** the current source of truth for the next wave.

The earlier parallel-work brief described a previous planning moment. Since then:

- the fixture-backed walkthrough workspace shipped
- the brownfield kickoff rehabilitation shipped
- the remaining prep/design material has been consolidated into `docs/design/WAVE_2_PREP.md`

## Current instruction

Do **not** spawn new worktree agents from this brief.

Before any new parallel allocation decision:

1. run the fixture-seeded manual walkthrough round
2. synthesize findings with `docs/design/DESIGN_SCRATCH.md`
3. use `docs/research/tanstack-loaders-vs-queries.md` as the primary router/query reference
4. only then decide whether the next two slices should run in parallel, and whether worktrees are warranted

## Likely future split after prep

If the prep confirms the boundary, the likely low-conflict split remains:

1. **Story-first phase and transcript patterns**
   - primary ownership: `src/client/stories/**`
2. **Router/query ownership refinement for interview surfaces**
   - primary ownership: routed data-loading / invalidation seams

That split is provisional, not yet an active charter.

## Source of truth

Use `docs/design/WAVE_2_PREP.md` for the live prep/design state.