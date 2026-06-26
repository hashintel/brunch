# `.fixtures/seeds/brunch-self/`

A **faithful** spec graph hand-derived from this repository's own planning prose
(`memory/SPEC.md` + `memory/PLAN.md`), as opposed to the synthetic
coverage/edge-spread fixtures.

Purpose:

- prove the whole loop end-to-end: real prose → graph fixture → the real
  propose-graph validator (`seedFixture` → `CommandExecutor`) → renderers
- give the renderers a realistic, all-planes anchor to project from, with
  meaningful titles and rationales instead of synthetic placeholders
- serve as the worked example / template for porting other projects' spec/plan
  docs into structurally-legal seed graphs

Coverage (a by-product of being faithful, not the goal):

- every node kind across all four planes (intent / oracle / design / plan)
- every edge category (dependency, proof, support, realization, boundary,
  composition, association, supersession), including both proof/support stances
- one supersession lineage (per-strategy offer-first supersedes the retired
  universal per-turn ritual)

Contents:

- `base.json` — the canonical faithful Brunch graph; one `planning_ready` spec
  describing Brunch itself.

Structural legality is enforced by the seed loader: `base` is committed through
`CommandExecutor` by `src/renderers/graph/previews.test.ts`, which fails if any
node/edge is structurally illegal.
