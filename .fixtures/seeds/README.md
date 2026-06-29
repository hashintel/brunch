# `.fixtures/seeds/`

Tracked reusable graph seeds. Each seed family owns one or more explicit-basis
spec fixtures consumed by `src/graph/seed-fixtures.ts` through
`CommandExecutor`.

Seed refs are always `name/variant`:

- `name` is the canonical family/workbench id; omitting `--workspace` derives
  `.fixtures/workbenches/<name>/`
- `variant` is the starting graph state within that family; `base` is the
  canonical full graph, and semantic variants like `grounded-intent` capture
  alternate starting states for the same workbench

Use a single named seed for normal workbench setup, or opt in to the whole
catalog when building a broad manual workbench / probe-input database:

```sh
npm run seed -- --seed workspace-alpha-grounding/base --reset
npm run dev -- --seed workspace-alpha-grounding/base --reset --open-web
npm run seed -- --workspace .fixtures/workbenches/<name> --all-seeds --reset
```

`--all-seeds` is never the default. A bare seed command fails with usage rather
than loading anything into the shell cwd.

## Disposition catalog

| Seed set | Disposition | Purpose |
| --- | --- | --- |
| `bilal-code-health` | manual workbench | Rich Bilal-derived spec for renderer, context, and curation work around code-health material. |
| `bilal-explorer-ui` | manual workbench | Rich Bilal-derived spec for UI- and renderer-heavy exploration. |
| `bilal-macro-view` | probe input | Bilal-derived macro-view family; `base` is the full port and `grounded-intent` is the curated probe starting state. |
| `brunch-self` | preview | Faithful Brunch planning graph used as a realistic all-planes anchor for renderer and graph previews. |
| `cook-layered-todo` | test | Small grounded intent graph that exercises fan-out, join, and cross-epic gate shape. |
| `cook-parallel-utils` | test | Small grounded intent graph that exercises pure scaffold-to-leaf fan-out. |
| `cook-resilient-pipeline` | test | Small grounded intent graph that exercises halt isolation and an unreachable join. |
| `dumpchat` | preview | Faithful external-project graph that previews all-plane rendering over a compact real spec. |
| `edge-category-directions` | test | Synthetic edge-category and absence-case coverage for graph projections and renderers. |
| `edge-hub-neighborhood` | test | Synthetic neighborhood fixture centered on a high-degree hub for traversal and projection checks. |
| `fable` | preview | Faithful external-project graph with broad all-plane coverage for realistic renderer/readback previews. |
| `kind-coverage-matrix` | test | Compact synthetic coverage matrix for every graph kind and readiness band. |
| `rd-loop` | preview | Faithful harness graph that provides a second realistic all-planes anchor beside Brunch itself. |
| `workspace-alpha-grounding` | test | Small workspace-oriented grounding fixture used for smoke workbenches and projection tests. |
| `workspace-beta-commitments` | test | Small workspace-oriented commitments fixture paired with the alpha workbench family for multi-spec tests. |
| `yamlbase` | preview | Faithful external-project graph used as a worked template for porting planning prose into seed truth. |
