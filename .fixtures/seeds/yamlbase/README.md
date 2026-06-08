# `.fixtures/seeds/yamlbase/`

A **faithful** spec graph hand-derived from the **yamlbase** project's planning
prose (internal name "Dogbase"), modeled on `brunch-self/` as the worked
template. yamlbase is an agent-oriented local DB: a thin TypeScript CLI over
SQLite presenting a document store, with per-record JSON files
(`data/<collection>/<id>.json`) as Git-backed canonical storage and a
disposable, rebuildable SQLite index.

Source docs (from `/Users/lunelson/Code/hashintel/yamlbase`):

- `memory/SPEC.md` — problem, requirements, constraints, decisions, invariants,
  domain terms, verification design
- `memory/PLAN.md` — inside-out slice sequence (skeleton → serializer →
  json-store → config/schema → sqlite-index → sync → CLI → lock → doctor)
- `docs/sqlite-db-backed-by-json.md` — the design conversation behind the
  document-store CLI, Drizzle-vs-Prisma, TypeScript-vs-Bash, per-record-vs-JSONL,
  and pull/push command naming
- `docs/beads-dolt-assessment.md` — assessment of Dolt-backed storage
  (steveyegge/beads), the rejected version-controlled-data-layer alternative

Coverage (a by-product of being faithful):

- all four planes — intent / oracle / design / plan — genuinely populated
- decision nodes carry `chosen_option` / `rejected` / `rationale`; term nodes
  carry `definition` (+ aliases)
- both proof and support stances, including `against` edges sourced from the
  Dolt assessment
- one supersession lineage (import/export naming supersedes pull/push naming)

Projected (not explicit in the source): the plan-plane milestones (M1/M2) and
frontiers, which group the explicit PLAN.md slices for composition edges. These
nodes carry `source: "projected"`.

Validate:

```
npx tsx src/graph/validate-fixture.ts yamlbase/spec-graph
```

This seeds the fixture through the real `CommandExecutor` mutation boundary, so
it passes only if every node/edge is structurally legal.
