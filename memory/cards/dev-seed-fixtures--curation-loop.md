# Product-driven fixture curation loop

Frontier: dev-seed-fixtures
Status:   done
Mode:     single
Created:  2026-06-05

## Orientation

- Containing seam: `.fixtures/seeds/` base data plus `src/probes/` product-path curation runs over the real Brunch graph/tool/runtime path.
- Relevant frontier item: `dev-seed-fixtures` (parallel / continuous), staying on the FE-807 branch as support work unless the user later chooses to split the frontier.
- Volatile handoff state: none (`HANDOFF.md` absent). The dev RPC harness is landed in `65b1ae51`; this card may use it only as local setup/readback convenience, not as proof of the product `propose-graph` flow.
- Main open risk: the curation loop could accidentally prove only a harness or hand-authored JSON path; this slice must leave evidence that the additive graph expansion went through the real agent `commit_graph` tool path, while base fixtures remain explicit curated starting truth.

Posture: proving (inherited from `dev-seed-fixtures` via project default).

Frontier-level obligations this slice carries:

- Preserve D4-L/D20-L/I11-L: fixture base loading and product-run graph writes go through `CommandExecutor`.
- Preserve D53-L/D63-L: product `propose-graph` materialization uses `commit_graph` and records `basis: implicit`; base seed facts authored/curated as starting truth stay `basis: explicit`.
- Preserve A5-L/A14-L verification posture: run artifacts must pair transcript evidence with graph/report evidence; dev RPC/manual mutation is not a substitute for real agent-tool proof.
- Preserve multi-spec discipline (D61-L): every fixture and curation run targets one explicit selected spec; no workspace-global graph.

Completion 2026-06-05: landed `macro-view-grounded-intent` explicit base variant, `src/probes/fixture-curation-loop.ts`, report/artifact tests, and real run artifacts at `.fixtures/runs/fixture-curation/fixture-curation-2026-06-05T104440Z/` proving one real product `commit_graph` tool result with implicit graph readback.

## Card 1 — One fixture curation tracer

Status: done
Weight: full

### Target Behavior

One Bilal-derived base seed can be curated by a real `propose-graph` run into reviewable fixture-run artifacts.

### Boundary Crossings

```pseudo
Bilal consolidated seed
→ explicit base-variant generator/export under .fixtures/seeds/
→ seedFixture / CommandExecutor load into scratch Brunch workspace
→ selected spec/session + runtime state (goal/strategy/lens)
→ real Brunch agent runtime factory
→ read_graph / commit_graph Pi tools
→ SQLite graph/change_log via CommandExecutor
→ graph overview snapshot + transcript/report artifacts under .fixtures/runs/
```

### Risks and Assumptions

- RISK: Base variants are hand-edited in a way that is not reproducible from the existing Bilal source.
  → MITIGATION: generate the first base variant from existing consolidated Bilal seed data with a narrow, deterministic filter; document the filter in the variant set README.
- RISK: The curation run creates reusable mixed-basis seed JSON too early.
  → MITIGATION: keep base seed fixtures `explicit` and loadable; preserve product-run `implicit` writes only as run artifacts (`report.json`, transcript, graph snapshot) unless a later scope proves mixed-basis reusable seeds are needed.
- RISK: The run bypasses the real agent/tool path by calling `CommandExecutor` or `dev.graph.commitGraph` directly for the expansion.
  → MITIGATION: report parser must prove a `commit_graph` tool result appears in the session transcript and that committed nodes include `basis: implicit` in graph readback.
- RISK: The model may fail to produce a useful proposal against a large imported graph.
  → MITIGATION: start with one small base variant and a bounded prompt; fitness quality is reviewed from artifacts, while structural legality remains the hard gate.
- RISK: The scope backslides into dev-RPC integration work instead of product-path fixture curation.
  → MITIGATION: expected write paths stay in `.fixtures/**` and `src/probes/**`; if implementation needs `src/rpc/**`, stop and rescope rather than widening this card.
- ASSUMPTION: A deterministic intent-only / grounded-intent filter is enough to create the first base variant without changing the seed loader.
  → IMPACT IF FALSE: We need a separate base-variant generation slice before product curation can run.
  → VALIDATE: Load the generated base variant through existing `seedFixture` with no loader changes.
- ASSUMPTION: The existing `propose-graph-commit` probe/runtime path is reusable enough for a fixture-curation run.
  → IMPACT IF FALSE: We need a small probe-runner extraction or product prompt-driver seam, but not a public `graph.commit` shortcut.
  → VALIDATE: Build the curation runner as the tracer; if reuse is awkward, factor only the minimal shared artifact/report helpers.

### Posture check

This is a proving tracer bullet:

- Proof of life: a real seeded Brunch spec can be expanded by the product agent/tool path, not by direct JSON editing.
- Invariants: it locks the basis distinction for fixture work — explicit base truth versus implicit product materialization evidence.
- Uncertainty: it tests whether Bilal-derived fixtures can support the next few user-flow probes before investing in full variant families and richer curation tooling.

If the tracer fails because the model cannot navigate the imported graph, the next scope should shrink the base variant or add focused graph-context/prompt support; do not broaden into a generic fixture platform in this card.

### Acceptance Criteria

```pseudo
base variant
├── creates exactly one new Bilal-derived base seed file/set for the tracer
├── contains only explicit-basis nodes and edges
├── omits design-plane and oracle-plane nodes from the base variant
├── keeps a grounded or intent-developed intent profile named in README/report
└── loads through seedFixture / npm-run-seed-compatible loader without changes to graph mutation rules

product curation run
├── creates a scratch Brunch workspace from the base seed
├── activates one selected spec/session for the run
├── pins runtime state to elicit + propose-graph + intent + commit-converge (or records why a narrower legal tuple is used)
├── sends a bounded curation prompt using the original/base context
├── records at least one real commit_graph tool result in the Pi JSONL transcript
└── persists at least one new intent-plane graph node through CommandExecutor

basis and artifact evidence
├── graph readback distinguishes explicit base nodes from implicit product-created nodes
├── report records created node codes/titles/kinds/basis and final graph counts
├── report records model, prompt, seed slug, spec id, session id, run id, and friction
├── artifacts include session.jsonl, transcript.md, report.json, and graph snapshot JSON
└── post-run mixed-basis graph snapshot is not registered as a normal reusable seed
```

### Verification Approach

- Inner: fixture generation/load test — proves the base variant is explicit-only, intent-only, and loadable through `seedFixture`.
- Inner: report summarizer tests — prove `commit_graph` attempts and implicit created nodes are detected from transcript/graph inputs.
- Middle: curation runner dry/probe test with a stubbed or fixture transcript where possible — proves artifact writing and report shape without requiring an LLM.
- Outer: one real model curation run — review transcript/report/graph snapshot for proposal quality and keep structural legality as the hard gate, behavioral usefulness as fitness evidence.

### Cross-cutting obligations

- Do not use `dev.graph.commitGraph` as evidence for the `propose-graph` product flow; it may be used in later manual curation only after this tracer proves the real tool path.
- Do not add delete/update/mixed-basis seed-loader support in this slice.
- Do not create a generic fixture platform or a new planning document; artifact outputs live under `.fixtures/runs/`, reusable base seeds under `.fixtures/seeds/`.
- If this slice reveals that command-line RPC needs an arbitrary real-agent prompt method, stop and scope that seam separately instead of smuggling it into fixture code.

### Expected touched paths (tentative)

```pseudo
memory/cards/
└── dev-seed-fixtures--curation-loop.md                 +

.fixtures/
├── seeds/
│   ├── bilal-port-variants/
│   │   ├── _variant-script.ts                          +
│   │   ├── README.md                                   +
│   │   └── <one-base-variant>.json                     +
│   └── bilal-port/                                     ?  # read-only input; edit only if variant generation proves a source-data defect
└── runs/
    └── fixture-curation/
        └── <run-id>/                                   +

src/
├── probes/
│   ├── fixture-curation-loop.ts                        +
│   ├── fixture-curation-loop.test.ts                   +
│   ├── propose-graph-commit-proof.ts                   ?
│   └── propose-graph-commit-proof.test.ts              ?
└── graph/
    └── seed-fixtures.test.ts                           ?

src/rpc/                                                   ! avoid in this scope unless explicitly rescoping
```
