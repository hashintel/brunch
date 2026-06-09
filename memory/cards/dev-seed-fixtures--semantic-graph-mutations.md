# Semantic graph mutations for fixture curation

Frontier: superseded by `role-safe-graph-mutations` for the semantic mutation command; `dev-seed-fixtures` remains the seed-data frontier.
Status:   superseded
Mode:     chain
Created:  2026-06-05
Superseded: 2026-06-09 by `memory/cards/role-safe-graph-mutations--mutate-graph.md`.

## Orientation

- Supersession note: this card's command-layer create/patch/delete curation scope is folded into `role-safe-graph-mutations` so semantic mutation work lands as the canonical `mutateGraph` / `mutate_graph` grammar instead of a dev-only second graph-write dialect. Keep this file as historical scoping context; build from `memory/cards/role-safe-graph-mutations--mutate-graph.md`.
- Containing seam: `graph/CommandExecutor` as the single graph-truth mutation boundary. The current creation-only `commitGraph({nodes, edges})` shape is sufficient for `propose-graph` creation, but not for manual curation of persisted seed specs where humans must patch or remove existing graph items.
- Relevant frontier item: `dev-seed-fixtures` because the immediate product need is curated Bilal/reference seed data that can be edited in a local DB and exported back to `.fixtures/seeds/**`. This slice also touches the cross-frontier graph mutation contract (`D4-L`, `D20-L`, `D53-L`), so it must reconcile SPEC/GRAPH_MODEL when built.
- Volatile handoff state: a clean curation workspace exists at `.fixtures/workbenches/bilal-curation`; DB→fixture export and the one-shot RPC helper are already in place (`src/graph/export-fixtures.ts`, `src/dev/workspace-rpc.ts`). FE-809 review-cycle work has landed, but this scope still touches fresh `src/graph/command-executor.ts` and review-set graph code; coordinate before building it in a shared worktree.
- Main open risk: edit/delete semantics can accidentally become a second mutation model. The implementation must preserve one transaction, one spec-local LSN, one change-log row, all-or-nothing structural validation, and no direct DB writes outside `CommandExecutor`.

Posture: proving (inherited from `dev-seed-fixtures`).

Frontier-level cross-cutting obligations this slice carries:

- Preserve D4-L/D20-L: all semantic graph mutations route through the Brunch command layer and return structured command results.
- Preserve D16-L/A4-L: every graph mutation allocates exactly one `{specId, lsn}` through the target spec's existing `graph_clock` row; bare LSNs remain non-comparable across specs.
- Preserve D51-L/D54-L: accepted node `plane`/`kind` and edge `category`/endpoints/`stance` are immutable; changing those means delete+create or supersession, not an in-place patch.
- Preserve D62-L: `kind_ordinal` is monotonic and never reused after deletion or supersession; rendered codes stay projected, not stored.
- Preserve D63-L: `basis` remains approval strength (`explicit | implicit`), not mutation pathway. Editing or deleting an item does not rewrite its original basis.
- Preserve D19-L: curation-only RPC lives under `dev.*`, is enabled only by `BRUNCH_DEV_RPC=1`, and is absent from normal product discovery/read-only sidecars.
- Preserve D52-L: `graph/` owns mutation semantics; `rpc/` and `.pi/extensions/` adapt boundary refs and publish invalidation, never import `db/`.

## Card 1 — Canonical semantic graph mutation command

Status: next
Weight: full

### Target Behavior

`CommandExecutor` accepts one atomic selected-spec graph mutation batch containing create, patch, and delete operations over accepted graph nodes and edges.

### Boundary Crossings

```pseudo
→ graph command input type(s)
→ semantic mutation planner / structural validation
→ CommandExecutor transaction boundary
→ SQLite graph rows + spec-local graph_clock/change_log
→ graph readers / existing product callers
→ graph topology docs + SPEC/GRAPH_MODEL reconciliation
```

### Risks and Assumptions

- RISK: `commitGraph` and the new semantic batch command drift into two validation engines.
  → MITIGATION: one private planner/engine owns structural validation and write planning; any creation-only public surface is only an operation-constructor over that engine, or is removed by breakage-driven repair if no longer needed.
- RISK: delete semantics create dangling edges or surprising cascades.
  → MITIGATION: node deletion rejects incident edges by default; destructive incident-edge deletion requires an explicit operation option and records deleted edge ids in the same change-log payload.
- RISK: in-place patches weaken immutable graph-shape decisions.
  → MITIGATION: patch only mutable fields (`node.title`, `node.body`, `node.source`, `node.detail`; `edge.rationale`); reject `plane`, `kind`, `kindOrdinal`, `category`, endpoints, `stance`, `basis`, and LSN fields in patch payloads.
- RISK: adapters or tests silently depend on raw DB ids for human curation.
  → MITIGATION: core may use internal ids after adapter resolution, but boundary tests must prove selected-spec projected-code resolution for the curation path in Card 2.
- ASSUMPTION: hard delete is acceptable for pre-release manual fixture curation.
  → IMPACT IF FALSE: curation would need explicit supersession/retirement operations instead of deletion, changing exporter and UI expectations.
  → VALIDATE: tests cover both hard delete and supersession preservation through graph-truth export; if the user wants historical curation lineage, scope a separate retention model before using deletes for reference fixtures.
  → memory/SPEC.md: D51-L currently says accepted graph items are present-or-absent and category/kind changes are delete+recreate; no new assumption id expected unless this proves false.

### Posture check

This proving slice is a tracer bullet on two axes:

- **Invariants:** it stabilizes the command-layer shape required to edit seed truth without bypassing `CommandExecutor`.
- **Proof of life:** a mixed create/update/delete batch must be visible through normal graph readers and later exportable as seed JSON.

It deliberately does not attempt a full UI curation workflow or write leases. Those are adjacent surfaces, not required to prove the mutation seam.

### Acceptance Criteria

```pseudo tree
semantic graph mutation command
├── creation parity
│   ├── ✓ create-node/create-edge ops can express the existing `commitGraph` creation batch shape
│   ├── ✓ intra-batch refs and existing same-spec refs validate before any write
│   └── ✓ structural-illegal creation batch writes no rows and does not advance graph_clock
├── node patch
│   ├── ✓ patching title/body/source/detail advances only `updated_at_lsn` on the node
│   ├── ✓ invalid per-kind detail is rejected before LSN allocation
│   └── ✓ immutable fields (`plane`, `kind`, `kindOrdinal`, `basis`) are not patchable
├── edge patch
│   ├── ✓ patching rationale advances only `updated_at_lsn` on the edge
│   └── ✓ immutable fields (`category`, `source`, `target`, `stance`, `basis`) are not patchable
├── deletion
│   ├── ✓ deleting an edge removes that edge and records its id in the batch result/change-log payload
│   ├── ✓ deleting a node with incident edges rejects by default before LSN allocation
│   ├── ✓ deleting a node with explicit incident-edge deletion removes the node and its incident edges in one transaction
│   └── ✓ deleting a node does not decrement or reuse `(spec, plane, kind)` ordinals
├── atomicity and audit
│   ├── ✓ mixed create/patch/delete batch consumes one spec-local LSN and one change-log row
│   ├── ✓ any invalid op rejects the whole batch with diagnostics and no partial writes
│   ├── ✓ refs to nodes/edges from a sibling spec are rejected
│   └── ✓ result reports created, updated, and deleted node/edge identities sufficiently for adapters and tests
└── reconciliation
    ├── ✓ existing creation callers either use the semantic engine or are updated directly; no second validation path remains
    ├── ✓ `src/graph/README.md` describes the surviving command shape
    └── ✓ `memory/SPEC.md` / `docs/design/GRAPH_MODEL.md` reconcile D53-L from creation-only `commitGraph` to semantic graph mutation, or explicitly preserve `commitGraph` as a creation-specific product tool over the same engine
```

### Verification Approach

- Inner: `CommandExecutor` unit/regression tests — prove validation, all-or-nothing writes, spec scoping, LSN/change-log behavior, and immutable-field rules.
- Inner: graph-read/export cross-check — after a mixed mutation, `getGraphOverview(..., graph_truth)` and `exportSeedFixture` reflect the post-mutation graph.
- Middle: compile/import repair over existing graph callers — proves the old creation path did not keep an unmaintained validation fork.

### Cross-cutting obligations

- Do not introduce a generic records/data API; this remains graph-native command input.
- Do not add a permanent compatibility bridge. A creation-only `commitGraph` facade is acceptable only if it is still a present product tool name and delegates to the semantic engine without owning validation.
- Do not introduce workspace-global writes or compare bare LSNs.

### Expected touched paths (tentative)

```pseudo tree
src/graph/
├── command-executor.ts                                      ~
├── command-executor.test.ts                                 ~
├── command-executor/
│   ├── commit-graph-types.ts                                ~
│   ├── commit-graph-batch.ts                                ~
│   ├── semantic-mutation-types.ts                           +?
│   ├── semantic-mutation-planner.ts                         +?
│   └── semantic-mutation.test.ts                            +?
├── export-fixtures.test.ts                                  ~
├── index.ts                                                 ~
└── README.md                                                ~
src/.pi/extensions/graph/                                    ?
src/graph/capture/                                           ?
src/rpc/                                                     ?
docs/design/GRAPH_MODEL.md                                   ~
memory/SPEC.md                                               ~
memory/PLAN.md                                               ?
```

## Card 2 — Dev curation RPC exposes semantic mutations by projected codes

Status: next after Card 1
Weight: full

### Target Behavior

A local curation agent can apply semantic graph mutations to a seeded workspace through one dev-only RPC method using projected graph codes instead of raw DB ids.

### Boundary Crossings

```pseudo
→ dev JSON-RPC params over stdio
→ selected-spec projected-code resolution
→ CommandExecutor semantic mutation command
→ product-update invalidation `{specId, lsn}`
→ seeded-dev workflow docs / one-shot RPC helper usage
```

### Risks and Assumptions

- RISK: dev RPC becomes an accidental public product API.
  → MITIGATION: method name stays under `dev.graph.*`, discovery requires `BRUNCH_DEV_RPC=1`, and read-only sidecars do not expose it.
- RISK: curation payloads require raw IDs and become unusable from UI/readback context.
  → MITIGATION: node targets and edge endpoints at the RPC boundary accept projected existing codes (`G1`, `CTX4`, `R2`) and batch refs; raw edge ids may be allowed only where no stable projected edge code exists yet.
- RISK: creation-only `dev.graph.commitGraph` remains as stale docs/API after semantic mutation lands.
  → MITIGATION: update `docs/testing/seeded-dev-rpc.md` to present the semantic method as the curation path; keep `dev.graph.commitGraph` only if it is intentionally retained as a tiny create-only convenience over the same command engine.
- ASSUMPTION: a one-shot JSON helper is enough ergonomics for agents before a richer `brunch-dev` CLI.
  → IMPACT IF FALSE: curation sessions will stall on command ceremony, and a small command-specific CLI should be scoped next.
  → VALIDATE: run manual smoke commands against a temporary seeded workspace and record the command shape in the docs.

### Posture check

This is a proving slice because it lights up the real local curation entrypoint without committing to a broad CLI or UI editor. It should be enough for an agent to patch/delete the Bilal specs safely; if not, the failed smoke identifies the next ergonomic slice.

### Acceptance Criteria

```pseudo tree
dev curation mutation RPC
├── discovery and access
│   ├── ✓ `rpc.discover` includes the method only when `BRUNCH_DEV_RPC=1`
│   └── ✓ the method is absent from normal/read-only sidecar discovery
├── refs and validation
│   ├── ✓ node targets accept selected-spec projected codes and reject malformed/unresolved codes with field diagnostics
│   ├── ✓ sibling-spec codes do not resolve accidentally
│   ├── ✓ batch create refs can be used by same-batch create-edge ops
│   └── ✓ invalid semantic operations return `structural_illegal` without writes
├── mutation behavior
│   ├── ✓ update-node, delete-edge, and create-node/create-edge work through the same RPC method
│   ├── ✓ success publishes `brunch.updated` with `{topic: "graph.overview", specId, lsn}` or the established graph mutation update payload
│   └── ✓ graph.overview readback shows the post-mutation graph and unchanged sibling-spec LSNs
└── workflow ergonomics
    ├── ✓ `src/dev/workspace-rpc.ts` can call the semantic dev mutation method without JSON-RPC stdin ceremony
    ├── ✓ `docs/testing/seeded-dev-rpc.md` shows one curation mutation example and one fixture export example
    └── ✓ a fresh temporary seed workspace smoke mutates one spec, verifies sibling LSN stability, and exports the mutated spec JSON for inspection
```

### Verification Approach

- Inner: RPC handler/discovery tests — prove dev-only exposure, schema validation, projected-code diagnostics, and product-update payloads.
- Middle: one-shot helper smoke against a temporary seeded workspace — prove the actual command an agent will use works end to end.
- Outer: optional manual curation rehearsal in `.fixtures/workbenches/bilal-curation` only after the user confirms the workspace may be mutated.

### Cross-cutting obligations

- Keep one-writer discipline: do not run dev RPC writes concurrently with TUI/agent writes against the same workspace unless deliberately testing concurrency.
- Do not add package scripts or bin aliases while `package.json` is dirty from unrelated work; the helper path is sufficient for this slice.
- Do not capture curated fixtures into reusable seed files until the user has reviewed the UI-curated content.

### Expected touched paths (tentative)

```pseudo tree
src/rpc/
├── methods/dev-graph.ts                                    ~
├── handlers.test.ts                                        ~
└── README.md                                               ?
src/dev/
└── workspace-rpc.ts                                        ~
docs/testing/seeded-dev-rpc.md                              ~
.fixtures/workbenches/                                      ? (scratch smoke only; do not commit DB state)
```

## Foreseeable follow-ons not scoped as build cards yet

These are intentionally named but not pre-scoped because their exact shape depends on the manual curation discoveries made after Cards 1–2 land.

1. **Manual Bilal spec curation pass.** Use `.fixtures/workbenches/bilal-curation` and the semantic dev mutation method to repair the current ported specs. Do not encode this as a code card until the user identifies the concrete curation edits or target quality rubric.
2. **Capture curated reference seed set.** Export reviewed DB state into a new seed set such as `.fixtures/seeds/bilal-curated/`; add a README documenting provenance (`bilal-port` + manual Brunch curation) and update seed tests only after the curated files exist.
3. **Richer curation CLI.** If `workspace-rpc.ts` plus JSON payloads remain too cumbersome, scope a tiny command-specific helper (`overview`, `mutate`, `capture`) without touching `package.json` until package-file dirtiness clears or the user asks for a bin/script.
4. **Product tool expansion.** Decide separately whether the agent-facing `commit_graph` tool should remain creation-only (likely) or gain patch/delete operations. Do not silently expose deletion to autonomous agents just because dev curation needs it.
