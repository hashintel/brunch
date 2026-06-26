# `.fixtures/seeds/bilal-port/`

Ported spec graphs from Bilal's spec-elicitation prototype, transformed
to the brunch graph model. Intended as development seed data — rich,
real spec material to populate a dev SQLite database for UI / agent work.

Not probe-run artifacts; sits under `.fixtures/seeds/` alongside
`.fixtures/runs/` rather than inside it.

## Provenance

Source: vendored under [`_originals/`](./_originals/) — copied from
Bilal's spec-elicitation prototype `spec/<slug>/graph/{nodes,edges}.json`.

Each sibling `bilal-*/base.json` is generated from `_originals/` by
[`_port-script.ts`](./_port-script.ts) (a throwaway data-prep step,
not product code). Re-runnable from this directory alone; each run
overwrites the sibling base fixtures.

## Transformation rules

See the header docstring of the port script for the full mapping rules,
including: decision-hub-and-spoke collapse, justification-hub absorption,
evidence → oracle plane (with one synthetic per-spec `check`),
`risk` and `design` → `context` with source flags for curation,
and the `derived_from` → dependency-vs-support rule keyed on target kind.

Curation flags carried in the `source` field:

- `derived-risk-or-question` — was Bilal `risk` semanticRole; many are
  literally "Open question (Q##): ..." phrased; per the interrogative
  normalization rule in `src/.pi/skills/methods/commit-graph/SKILL.md`, curate into
  `assumption`, `criterion`, or keep as `context`.
- `derived-design-statement` — was Bilal `design` semanticRole; lacks
  the structural material to prove a real decision/module; curate into
  `decision` (if alternatives recoverable from history), or design plane
  `module`/`interface` (if it actually names code).
- `derived-justification-synthesis` — was a Bilal `hub:justification`;
  rationale appended to body. Curate per case.
- `derived-port-synthetic` — node minted by the port script itself
  (currently only the per-spec audit `check`).

## Output layout

```
bilal-port/
├── README.md         # this file (generated)
├── _port-script.ts   # throwaway prep: _originals/ → sibling bilal-*/base.json
├── _originals/       # vendored Bilal source (reproducibility)
│   └── <slug>/{nodes,edges}.json
├── ../bilal-code-health/base.json
├── ../bilal-explorer-ui/base.json
└── ../bilal-macro-view/base.json
```

Each sibling `base.json` is the seed contract consumed by the loader:

```
{
  "spec":  { "slug", "name" },
  "nodes": [ { "local_id", "plane", "kind", "title", "body?", "basis", "source?", "detail?" } ],
  "edges": [ { "category", "source_local_id", "target_local_id", "stance?", "basis", "rationale?" } ]
}
```

Node/edge field shape mirrors [`src/db/schema.ts`](../../../src/db/schema.ts)
column names. `local_id` is a placeholder for autoincrement; edges reference
nodes by `local_id`. No LSNs or change-log entries are pre-baked — the loader
([`src/graph/seed-fixtures.ts`](../../../src/graph/seed-fixtures.ts)) wraps each spec
in one `mutateGraph` transaction so the graph clock, change log, and lsn
columns stay coherent under brunch's mutation contract.

## Stats

| Seed family | spec slug | nodes in | edges in | nodes emitted | edges emitted | edges absorbed | self-after-collapse drops | unresolved-endpoint drops | duplicate-after-collapse drops |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| bilal-code-health | bilal-code-health | 335 | 600 | 277 | 446 | 117 | 1 | 0 | 74 |
| bilal-explorer-ui | bilal-explorer-ui | 316 | 698 | 280 | 580 | 74 | 15 | 0 | 34 |
| bilal-macro-view | bilal-macro-view | 265 | 568 | 232 | 461 | 68 | 0 | 0 | 43 |
