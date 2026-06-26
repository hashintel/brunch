# `.fixtures/seeds/`

Tracked reusable graph seeds. Each seed family owns one or more explicit-basis
spec fixtures consumed by `src/graph/seed-fixtures.ts` through
`CommandExecutor`.

Seed refs are always `name/variant`:

- use a semantic variant like `workspace-spread/alpha-grounding` when the
  family exists to compare scenarios
- use `base` for the canonical full variant of a faithful project port, such as
  `brunch-self/base` or `yamlbase/base`

Use a single named seed for normal workbench setup, or opt in to the whole
catalog when building a broad manual workbench / probe-input database:

```sh
npm run seed -- --workspace .fixtures/workbenches/<name> --seed workspace-spread/alpha-grounding
npm run seed -- --workspace .fixtures/workbenches/<name> --all-seeds --reset
```

`--all-seeds` is never the default. A bare seed command fails with usage rather
than loading anything into the shell cwd.

## Disposition catalog

| Seed set | Disposition | Purpose |
| --- | --- | --- |
| `bilal-port` | manual workbench | Rich ported prototype graphs for UI, renderer, and agent-context development against realistic messy specs. |
| `bilal-port-variants` | probe input | Small curated Bilal-derived bases for product-path fixture curation and proposal runs. |
| `brunch-self` | preview | Faithful Brunch planning graph used as a realistic all-planes anchor for renderer and graph previews. |
| `cook-port` | test | Small fully-grounded intent graphs that exercise fan-out, join/gate, and halt-isolation shapes. |
| `dumpchat` | preview | Faithful external-project graph that previews all-plane rendering over a compact real spec. |
| `edge-spread` | test | Synthetic edge-category and absence-case coverage for graph projections and renderers. |
| `fable` | preview | Faithful external-project graph with broad all-plane coverage for realistic renderer/readback previews. |
| `kind-band-spread` | test | Compact synthetic coverage matrix for every graph kind and readiness band. |
| `rd-loop` | preview | Faithful harness graph that provides a second realistic all-planes anchor beside Brunch itself. |
| `workspace-spread` | test | Deterministic two-spec workspace inventory for workspace/spec projection tests and workbenches. |
| `yamlbase` | preview | Faithful external-project graph used as a worked template for porting planning prose into seed truth. |
