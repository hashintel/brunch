# `.fixtures/seeds/rd-loop/`

A **faithful** spec graph hand-derived from the `rd-loop` harness's prose docs
(`README.md`, `concept-1-a.md`, `concept-1-b.md`, `concept-2-b.md`, and the
frontier-governance addendum), as opposed to the synthetic coverage fixtures.

Source project: `harnesses/rd-loop` — a bash loop that wraps Amp in fresh
contexts, persistent disk state, budgets, gates, and an isolated adversary to
govern autonomous R&D as a controlled epistemic process. The docs argue toward
a Geolog/Datalog-style change-governance substrate: warranted action, not
correct action.

Purpose:

- prove the loop end-to-end: real prose → graph fixture → the real
  propose-graph validator (`seedFixture` → `CommandExecutor`) → renderers
- give a second realistic all-planes anchor alongside `brunch-self/`

Coverage (a by-product of being faithful):

- every node kind across all four planes (intent / oracle / design / plan)
- every edge category (dependency, realization, boundary, composition,
  association, supersession, proof, support), including both proof/support
  stances
- one supersession lineage (the role-dissolution decision supersedes the
  single-executor assumption)

Contents:

- `spec-graph.json` — one `planning_ready` spec describing `rd-loop`.

Most nodes map directly to doc prose; the two plan-plane **frontier** nodes are
`source: "projected"` because the planning decomposition is synthesized from
the docs' forward-looking POC/evolution path. Validate with
`npx tsx src/graph/validate-fixture.ts rd-loop/spec-graph`.
