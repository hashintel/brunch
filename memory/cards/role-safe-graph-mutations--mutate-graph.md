# Role-safe graph mutations (`mutateGraph` / `mutate_graph`)

Frontier: role-safe-graph-mutations
Status:   active
Mode:     chain
Created:  2026-06-09

## Orientation

- Containing seam: the authored graph-mutation language before `CommandExecutor` turns payloads into accepted graph truth. The relevant frontier is `role-safe-graph-mutations` in `memory/PLAN.md`.
- Prior scope state: `memory/cards/graph--role-named-edge-surface.md` and `memory/cards/dev-seed-fixtures--semantic-graph-mutations.md` are superseded by this file. Current code still exposes `commitGraph` / `commit_graph` and several callers still author edges with `{ category, source, target }`.
- Main risk: landing patch/delete curation or role-named edges separately would create two graph mutation dialects. This chain takes the bigger step: `mutateGraph` / `mutate_graph` becomes the one authored graph-mutation grammar, and exposed `commitGraph` / `commit_graph` is retired by break-and-repair.
- Posture: proving (inherited from `role-safe-graph-mutations`). Landing this stabilizes the edge-authoring seam future relation capture, review-set projection, seed loading, and dev curation will aim at.

Frontier-level cross-cutting obligations:

- Preserve D4-L/D20-L: all graph mutations route through `CommandExecutor` and return structured command results.
- Preserve D16-L/A4-L/I1-L: one selected-spec LSN and one change-log row per mutation batch; bare LSNs remain spec-local.
- Preserve D51-L: stored accepted edge identity stays `(category, sourceId, targetId, stance)`; `sourceId`/`targetId` are internal storage geometry, not authored vocabulary.
- Preserve D62-L/D63-L: boundary refs use projected node codes where user/agent-facing; `basis` is approval strength and applies only to newly created graph items.
- Preserve D52-L: `graph/` owns mutation semantics; `.pi/`, `rpc/`, `seed-fixtures`, and capture adapters translate only at boundaries and do not import `db/` directly.
- Do not grant autonomous agents delete authority merely because `mutate_graph` can represent delete ops; operation permissions are policy-gated by caller/posture.

## Chain-level design lock

Canonical authored command shape (sketch; exact names may move during build):

```ts
type MutateGraphInput = {
  /** Applies only to newly-created nodes/edges; patch/delete never rewrite basis. */
  createBasis: 'explicit' | 'implicit';
  ops: GraphMutationOp[];
};

type GraphMutationOp =
  | { op: 'create_node'; ref: string; plane: NodePlane; kind: NodeKind; title: string; body?: string; source?: string; detail?: unknown }
  | ({ op: 'create_edge' } & RoleNamedEdgeDraft)
  | { op: 'patch_node'; node: NodeRef; patch: NodePatch }
  | { op: 'patch_edge'; edge: EdgeRef; patch: { rationale?: string } }
  | { op: 'delete_edge'; edge: EdgeRef }
  | { op: 'delete_node'; node: NodeRef; deleteIncidentEdges?: boolean };

type RoleNamedEdgeDraft =
  | { category: 'dependency'; dependency: NodeRef; dependent: NodeRef; rationale?: string }
  | { category: 'proof'; oracle: NodeRef; claim: NodeRef; stance: 'for' | 'against'; rationale?: string }
  | { category: 'support'; support: NodeRef; claim: NodeRef; stance: 'for' | 'against'; rationale?: string }
  | { category: 'realization'; abstract: NodeRef; concrete: NodeRef; rationale?: string }
  | { category: 'boundary'; boundary: NodeRef; subject: NodeRef; rationale?: string }
  | { category: 'composition'; whole: NodeRef; part: NodeRef; rationale?: string }
  | { category: 'supersession'; successor: NodeRef; predecessor: NodeRef; rationale?: string }
  | { category: 'association'; a: NodeRef; b: NodeRef; rationale?: string };
```

Normalization rule: for category `C`, the endpoint field named by `EDGE_CATEGORY_METADATA[C].sourceRole` becomes private `source`; the endpoint field named by `.targetRole` becomes private `target`. `association` is peer/peer and maps `a -> source`, `b -> target` for storage only.

Break-and-repair path:

```pseudo
1. Add graph-owned RoleNamedEdgeDraft + table-driven normalizer.
2. Introduce CommandExecutor.mutateGraph / mutateGraph planner.
3. Replace exposed commit_graph with mutate_graph and repair direct graph writers.
4. Port review-set proposals/acceptance to role-named edge drafts over the same planner.
5. Add dev curation RPC over mutateGraph.
6. Reconcile SPEC + GRAPH_MODEL alongside the slices that change those public contracts.
```

No compatibility bridge: generic `{ category, source, target }` authored drafts are rejected at graph-tool and review-set boundaries by the end of this chain.

## Card 1 — Graph-owned role-named edge draft normalizer

Status: next
Weight: full

### Target Behavior

Role-named edge drafts normalize to private `BatchEdgeInput` source/target geometry through `EDGE_CATEGORY_METADATA`.

### Boundary Crossings

```pseudo
→ authored RoleNamedEdgeDraft
→ graph-owned endpoint-role normalizer
→ EDGE_CATEGORY_METADATA sourceRole/targetRole
→ private BatchEdgeInput { category, source, target, stance?, rationale? }
→ existing commit/mutation edge planner
```

### Risks and Assumptions

```pseudo
- RISK: role field names drift from EDGE_CATEGORY_METADATA endpoint roles.
  → MITIGATION: drift guard enumerates all categories and asserts the union endpoint fields match metadata roles; normalizer reads the table, not a copied role map.
- RISK: `association` has peer/peer roles and no semantic source/target.
  → MITIGATION: special-case only peer/peer as `a -> source`, `b -> target`; document this as arbitrary storage orientation.
- RISK: adding the normalizer to `category-policy.ts` makes policy metadata too command-specific.
  → MITIGATION: prefer a command/mutation module importing `EDGE_CATEGORY_METADATA`; export only the minimal role-draft type/normalizer needed by adapters.
- ASSUMPTION: EDGE_CATEGORY_METADATA endpoint roles are the correct authored role vocabulary.
  → IMPACT IF FALSE: docs, prompts, and normalizer drift together; role naming must be revised before tool-schema work.
  → VALIDATE: drift tests against `docs/design/GRAPH_MODEL.md` policy table and existing `category-policy.test.ts` coverage.
```

### Posture check

Proving slice on invariants: it locates the single source of endpoint-role truth and retires the most direct `source`/`target` authoring error before larger mutation work is built on top.

### Acceptance Criteria

```pseudo tree
role-named edge draft normalizer
├── ✓ all eight EdgeCategory values have one role-named draft variant
├── ✓ every non-peer variant's endpoint fields match EDGE_CATEGORY_METADATA sourceRole/targetRole
├── ✓ association peer/peer maps a/b to source/target with an explicit test
├── ✓ proof/support require stance and every other variant rejects stance at the authored shape
├── ✓ normalizeEdgeDraft returns private source/target refs without consulting a second role map
└── ✓ graph/index exports only the role-draft surface needed by adapters, not db/storage details
```

### Verification Approach

```pseudo
- Inner: vitest normalizer matrix over all EdgeCategory values.
- Inner: drift guard comparing RoleNamedEdgeDraft endpoint fields to EDGE_CATEGORY_METADATA.
- Inner: stance-locality tests independent of CommandExecutor persistence.
```

### Cross-cutting obligations

- `EDGE_CATEGORY_METADATA` stays the single endpoint-role source.
- Storage and `BatchEdgeInput` can still use source/target internally; authored boundaries must not.

### Expected touched paths (tentative)

```pseudo tree
src/graph/
├── command-executor/
│   ├── role-named-edge-draft.ts        +
│   └── role-named-edge-draft.test.ts   +
├── policy/
│   └── category-policy.test.ts         ~?
└── index.ts                            ~
```

## Card 2 — Atomic `mutateGraph` command engine

Status: next after Card 1
Weight: full

### Target Behavior

`CommandExecutor.mutateGraph` executes one atomic role-safe graph mutation batch.

### Boundary Crossings

```pseudo
→ MutateGraphInput
→ graph mutation planner (create / patch / delete)
→ existing create-node and edge structural validation
→ CommandExecutor transaction boundary
→ SQLite nodes/edges + graph_clock + change_log
→ graph readers/export fixtures
```

### Risks and Assumptions

```pseudo
- RISK: mutateGraph and commitGraph become two validation engines.
  → MITIGATION: implement one planner; any temporary commitGraph helper delegates to mutateGraph and is private or removed by chain completion.
- RISK: patch/delete semantics weaken immutable graph identity.
  → MITIGATION: patches allow only node title/body/source/detail and edge rationale; reject category, semantic endpoints, stored endpoints, stance, basis, LSN fields.
- RISK: node deletion creates dangling edges or surprising cascades.
  → MITIGATION: reject incident edges by default before LSN allocation; require explicit incident-edge deletion flag and audit deleted edge ids in the same change-log payload.
- RISK: mixed create/patch/delete rollback accidentally advances counters/clock.
  → MITIGATION: plan before write where possible; tests assert invalid batches do not advance graph_clock, change_log, node_kind_counters, nodes, or edges.
- ASSUMPTION: hard delete remains acceptable for pre-release fixture curation.
  → IMPACT IF FALSE: deletion operation must be dropped or replaced by supersession/retirement before dev curation lands.
  → VALIDATE: tests cover hard delete semantics and export readback; product-facing delete authority remains policy-gated.
```

### Posture check

Proving slice on proof-of-life and invariants: a mixed graph mutation goes through the real command boundary with one transaction/LSN/change-log row, proving the future curation and capture seam without a second mutation model.

### Acceptance Criteria

```pseudo tree
mutateGraph command engine
├── creation parity
│   ├── ✓ create_node/create_edge ops express current commitGraph create-only batches
│   ├── ✓ intra-batch refs and same-spec existing refs validate before writes
│   └── ✓ structurally illegal create batches write no rows and do not advance graph_clock
├── patch
│   ├── ✓ patch_node mutates only title/body/source/detail and updated_at_lsn
│   ├── ✓ invalid per-kind detail is rejected before LSN allocation
│   ├── ✓ patch_edge mutates only rationale and updated_at_lsn
│   └── ✓ identity fields are rejected before LSN allocation
├── delete
│   ├── ✓ delete_edge removes exactly that edge and reports/audits its id
│   ├── ✓ delete_node with incident edges rejects by default before LSN allocation
│   ├── ✓ delete_node with explicit incident-edge deletion removes node+incident edges in one transaction
│   └── ✓ node kind ordinals are not decremented or reused after delete
├── atomicity and audit
│   ├── ✓ mixed create/patch/delete batch consumes one spec-local LSN and one change-log row
│   ├── ✓ any invalid op rejects the whole batch with diagnostics and no partial writes
│   ├── ✓ sibling-spec node/edge refs are rejected
│   └── ✓ result reports created/updated/deleted identities sufficiently for adapters and tests
└── consolidation
    ├── ✓ no second commitGraph validation path remains
    └── ✓ any surviving commitGraph helper is private and delegates to mutateGraph
```

### Verification Approach

```pseudo
- Inner: CommandExecutor unit/regression tests for planning, write, rollback, and result shape.
- Inner: graph query/export readback after a mixed mutation.
- Middle: import/compile repair proves current callers cannot keep using a stale public commitGraph engine unnoticed.
```

### Cross-cutting obligations

- Preserve one transaction, one selected-spec LSN, and one change-log row.
- Patch/delete never rewrite `basis`; `createBasis` applies only to newly-created nodes/edges.
- Do not expose operation permissions here as policy; command semantics and caller authority remain separate.

### Expected touched paths (tentative)

```pseudo tree
src/graph/
├── command-executor.ts                                  ~
├── command-executor.test.ts                             ~
├── command-executor/
│   ├── commit-graph-types.ts                            ~
│   ├── commit-graph-batch.ts                            ~
│   ├── commit-graph-batch.test.ts                       ~
│   ├── graph-mutation-types.ts                          +
│   ├── graph-mutation-planner.ts                        +
│   └── graph-mutation-planner.test.ts                   +
├── export-fixtures.test.ts                              ~?
└── index.ts                                             ~
```

## Card 3 — Exposed graph tool and direct writers port to `mutate_graph`

Status: next after Card 2
Weight: full

### Target Behavior

Product direct graph writers use `mutateGraph` as their only authored graph-mutation path.

### Boundary Crossings

```pseudo
→ Pi graph tool schema (`mutate_graph`)
→ graph command adapter / projected-code resolution
→ CommandExecutor.mutateGraph
→ product update invalidation
→ capture and seed-fixture direct writers
→ prompt resources / docs naming the graph tool
```

### Risks and Assumptions

```pseudo
- RISK: exposed commit_graph remains as an easier stale path.
  → MITIGATION: rename/remove exposed tool; tests assert only mutate_graph is registered for graph mutation.
- RISK: source/target remains in prompt/resource text and encourages old payloads.
  → MITIGATION: grep/resource tests or targeted assertions over graph tool guidelines and relevant prompt resources.
- RISK: capture/seed loading are node-only today and feel unrelated.
  → MITIGATION: port them anyway so `commitGraph` does not remain the go-to helper by inertia.
- ASSUMPTION: current graph tool callers can be break-repaired atomically in this branch.
  → IMPACT IF FALSE: if an external consumer exists, this would need deprecation discipline; current posture and docs treat these as internal pre-release product seams.
  → VALIDATE: grep callers and tests; no persisted wire consumer is promised.
```

### Posture check

Proving slice on proof-of-life: the real Pi tool path and direct graph writers exercise the new grammar through the product entrypoints rather than only unit tests.

### Acceptance Criteria

```pseudo tree
product direct writer port
├── ✓ Pi registers mutate_graph, not commit_graph, as the graph mutation tool
├── ✓ mutate_graph tool schema uses role-named create_edge ops and rejects generic source/target authored edges
├── ✓ command adapter resolves projected existing node codes per role field before CommandExecutor.mutateGraph
├── ✓ propose-graph direct commits use create-only ops with createBasis=implicit
├── ✓ captureExplicitTextFacts uses create-only ops with createBasis=explicit
├── ✓ seedFixture uses create-only ops with createBasis=explicit
├── ✓ graph mutation success still publishes graph invalidations with {specId, lsn}
└── ✓ prompt/resource/docs text no longer presents commit_graph as the go-to graph-writing tool
```

### Verification Approach

```pseudo
- Inner: graph tool adapter tests for role-named endpoint resolution and schema rejection of source/target.
- Middle: graph tools end-to-end test persists nodes/edges through mutate_graph and read_graph readback.
- Inner: capture and seed-fixture tests pass over mutateGraph create-only ops.
- Inner: grep/source assertions for exposed commit_graph retirement where practical.
```

### Cross-cutting obligations

- Keep createBasis explicit/implicit semantics aligned with D63-L.
- Do not expose patch/delete to autonomous agent modes unless current runtime policy allows it; the unified grammar and authority remain separate.

### Expected touched paths (tentative)

```pseudo tree
src/.pi/extensions/graph/
├── index.ts                         ~
├── tool-schemas.ts                  ~
└── command-adapter.ts               ~
src/.pi/__tests__/
├── graph-tools.test.ts              ~
└── prompting.test.ts                ~?
src/.pi/skills/methods/
└── commit-graph.md                  ~?
src/graph/
├── capture/structured-response.ts   ~
├── capture/structured-response.test.ts ~
├── seed-fixtures.ts                 ~
├── seed-fixtures.test.ts            ~
└── index.ts                         ~
docs/design/GRAPH_MODEL.md           ~
memory/SPEC.md                        ~
```

## Card 4 — Review-set proposals use role-named mutation drafts

Status: next after Card 3
Weight: full

### Target Behavior

Review-set proposal edge drafts use the same role-named edge grammar as `mutateGraph`.

### Boundary Crossings

```pseudo
→ project-graph review-set payload
→ review-set payload validation
→ role-named endpoint resolution (draftId | existingCode)
→ mutateGraph create-only planning / dry-run
→ acceptReviewSet workflow audit
→ CommandExecutor write
```

### Risks and Assumptions

```pseudo
- RISK: review-set payload schemas drift from graph-owned role draft shape.
  → MITIGATION: review-set translation imports/reuses graph-owned RoleNamedEdgeDraft semantics; schema tests reject source/target edge drafts.
- RISK: acceptReviewSet loses its workflow audit identity if it delegates too deeply.
  → MITIGATION: acceptReviewSet remains the workflow command and change_log operation; only graph write planning is shared with mutateGraph.
- RISK: present_review_set structured-exchange schemas encode the old edge shape separately.
  → MITIGATION: inspect/update `src/.pi/extensions/exchanges/schemas/**` in the same slice if they own review-set edge payload shape; add lockstep test or source assertion.
- ASSUMPTION: review-set endpoint refs remain `{draftId}` or `{existingCode}` regardless of role field name.
  → IMPACT IF FALSE: role-named endpoint resolution must be redesigned before payload schema update.
  → VALIDATE: translation tests over draft and existing-code endpoints for several categories.
```

### Posture check

Proving slice on invariants: it canonicalizes the second LLM-authored edge boundary and preserves I20-L dry-run gating under the new grammar.

### Acceptance Criteria

```pseudo tree
review-set role-named edge drafts
├── ✓ ReviewSetEdgeDraft is role-named and rejects generic source/target
├── ✓ draftId and existingCode endpoints resolve correctly from role fields
├── ✓ role-named edge drafts translate to mutateGraph create-only ops with createBasis=explicit
├── ✓ dryRunAcceptReviewSet still rejects structurally illegal proposals before user review
├── ✓ acceptReviewSet still writes one accept_review_set change_log row and one graph LSN
├── ✓ project-graph review-set tests cover at least proof/support stance and one non-stance category
└── ✓ D27-L / GRAPH_MODEL review-set examples are reconciled to role-named edge drafts
```

### Verification Approach

```pseudo
- Inner: review-set payload shape and translation tests.
- Inner: CommandExecutor accept/dry-run parity tests.
- Middle: existing project-graph review-cycle tests/probe fixture review; regenerate only if committed fixtures encode old payloads.
```

### Cross-cutting obligations

- Preserve D27-L/I15-L/I20-L: only dry-run-valid proposals surface as reviewable; approval remains one atomic acceptReviewSet command.
- Keep review-set exact approval basis explicit; mutation path remains in change_log, not `basis`.

### Expected touched paths (tentative)

```pseudo tree
src/graph/
├── review-set.ts                              ~
├── review-set.test.ts                         ~
└── command-executor/accept-review-set.test.ts ~
src/.pi/extensions/exchanges/schemas/          ?
src/.pi/__tests__/
├── structured-exchange-schemas.test.ts        ~?
└── structured-exchange-present-request.test.ts ~?
docs/design/GRAPH_MODEL.md                     ~
memory/SPEC.md                                  ~
.fixtures/runs/project-graph-review-cycle/      ?
```

## Card 5 — Dev curation RPC exposes `mutateGraph` by projected codes

Status: next after Card 4
Weight: full

### Target Behavior

Dev-only graph curation RPC applies projected-code `mutateGraph` operations to a selected spec.

### Boundary Crossings

```pseudo
→ dev JSON-RPC params
→ TypeBox schema / discovery gate
→ selected-spec projected-code and edge-id validation
→ CommandExecutor.mutateGraph
→ product update invalidation
→ graph.overview readback / fixture export workflow docs
```

### Risks and Assumptions

```pseudo
- RISK: dev RPC becomes accidental public product API.
  → MITIGATION: method stays under dev.graph.*, discovery requires BRUNCH_DEV_RPC=1, and read-only sidecars do not expose it.
- RISK: curation payloads need raw node ids.
  → MITIGATION: node refs accept projected node codes and batch refs; core may use internal ids only after adapter resolution.
- RISK: edge targets lack stable projected edge codes.
  → MITIGATION: allow edge ids for patch_edge/delete_edge at the dev boundary only with selected-spec validation; do not invent edge-code projection in this frontier.
- RISK: old dev.graph.commitGraph remains as stale convenience.
  → MITIGATION: replace it with dev.graph.mutateGraph; no parallel dev commit method after this card.
- ASSUMPTION: one-shot `src/dev/workspace-rpc.ts` remains enough curation ergonomics.
  → IMPACT IF FALSE: scope a later tiny curation CLI; do not add package scripts here.
  → VALIDATE: smoke against a temporary seeded workspace and document the command shape.
```

### Posture check

Proving slice on proof-of-life: it exercises create/patch/delete through the real local curation entrypoint without a separate mutation model or DB bypass.

### Acceptance Criteria

```pseudo tree
dev curation mutateGraph RPC
├── discovery and access
│   ├── ✓ dev.graph.mutateGraph appears only when BRUNCH_DEV_RPC=1
│   └── ✓ normal/read-only sidecars do not expose it
├── refs and validation
│   ├── ✓ node refs accept selected-spec projected codes and reject malformed/unresolved/sibling-spec codes
│   ├── ✓ create_edge uses role-named endpoint fields and rejects source/target
│   ├── ✓ edge-id patch/delete refs are selected-spec validated
│   └── ✓ invalid ops return structural_illegal without writes
├── mutation behavior
│   ├── ✓ create-node/create-edge, patch-node, patch-edge, delete-edge, and guarded delete-node work through one method
│   ├── ✓ success publishes graph invalidation with {specId, lsn}
│   └── ✓ graph.overview readback shows post-mutation graph and unchanged sibling-spec LSNs
└── workflow ergonomics
    ├── ✓ src/dev/workspace-rpc.ts can call dev.graph.mutateGraph
    ├── ✓ docs/testing/seeded-dev-rpc.md shows mutate and fixture-export examples
    └── ✓ fresh temporary seed workspace smoke mutates one spec and exports JSON for inspection
```

### Verification Approach

```pseudo
- Inner: RPC handler/discovery tests.
- Middle: one-shot workspace-rpc smoke against a temporary seeded workspace.
- Outer: optional manual Bilal curation rehearsal only after user confirms the workbench may be mutated.
```

### Cross-cutting obligations

- Dev RPC remains absent from normal product discovery and read-only sidecars.
- Do not mutate `.fixtures/workbenches/bilal-curation` or capture curated seeds unless the user explicitly approves that data change.

### Expected touched paths (tentative)

```pseudo tree
src/rpc/
├── methods/dev-graph.ts       ~
├── handlers.test.ts           ~
├── methods/registry.test.ts   ~?
└── README.md                  ~
src/dev/
└── workspace-rpc.ts           ~
docs/testing/seeded-dev-rpc.md ~
.fixtures/workbenches/         ? (scratch smoke only; do not commit DB state)
```

## Traceability / canonical reconciliation during the chain

- D53-L: exposed graph-writing tool becomes `mutate_graph`; direct propose-graph commits are create-only `mutateGraph` ops with `createBasis: implicit`.
- D27-L: review-set edge drafts are role-named and acceptance still writes one atomic `accept_review_set` command.
- D51-L: add explicit boundary note that endpoint roles are authored vocabulary while `sourceId`/`targetId` remain immutable stored geometry.
- A14-L: structural-legality assumption now includes role-named edge drafts and the `mutate_graph` grammar.
- New/updated invariant: agents express edges only by category + endpoint roles; `source/target` is internal storage geometry derived from `EDGE_CATEGORY_METADATA`; role field names are test-pinned to that table.
- `docs/design/GRAPH_MODEL.md`: update agent-facing command surface and examples from `commitGraph({nodes, edges})` / `{category, source, target}` to `mutateGraph` create ops with role-named edges.
