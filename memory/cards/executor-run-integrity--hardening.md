# Executor Run Integrity Hardening

Frontier: executor-run-integrity
Status:   active
Mode:     slices
Created:  2026-07-06

## Orientation

- Containing seam: `src/executor/` execute-mode lifecycle helpers and thin `.pi/extensions/agent-runtime` tool wrappers.
- Frontier item: `executor-run-integrity` / FE-1154, created from the `cook-parallel-utils` reversed fixture review.
- Handoff state: none; motivating evidence is run `run-mr9cmjg5` under `.fixtures/workbenches/cook-parallel-utils/.brunch/cook/runs/`.
- Main open risk: executor metadata can report success while reports record failed verification; fix run truth before rerunning fixture evidence.

Posture: proving (inherited from executor-run-integrity)

Cross-cutting obligations:

- Preserve the executor purity boundary: core helpers do not import Pi, app, rpc, web, or db layers.
- Keep side effects explicit under I52-L/I56-L; refusing advancement must not mutate run metadata.
- Keep run truth visible to observers; if a new blocked/failure status is introduced, projections must expose it honestly.

## Slice 1: Failed Verification Blocks Run Completion

Status: next

### Target Behavior

A run with any failed `slice_test_result` cannot transition to `run_completed`.

### Full-card cold-start reads

- `memory/SPEC.md` — D98-L, D101-L, I52-L/I56-L executor authority and side-effect discipline.
- `memory/PLAN.md` — frontier: `executor-run-integrity`.
- `src/executor/TOPOLOGY.md` — lifecycle ownership and purity boundary.
- `.fixtures/workbenches/cook-parallel-utils/.brunch/cook/runs/run-mr9cmjg5/reports.jsonl` — false-positive report shape.

### Boundary Crossings

→ `execute_run_complete`
→ `src/executor/run-complete.ts`
→ `reports.jsonl` verdict scan
→ `run.json` unchanged on failure

### Risks and Assumptions

- RISK: reports can contain duplicate slice test events → MITIGATION: derive from the latest test event per slice if duplicate ingestion is possible.
- ASSUMPTION: every completed slice has an ingested test result before `slice_complete`.
  → IMPACT IF FALSE: completion must also reject missing test evidence.
  → VALIDATE: run-complete unit test with a completed slice lacking test evidence.

### Acceptance Criteria

✓ `completeRun` rejects failed slice verification and leaves metadata unchanged.
✓ `completeRun` rejects missing slice test evidence if that state is constructible.
✓ Orchestration halts before Petri/promotion when verification failed.

### Verification Approach

- Inner: focused executor unit tests for `run-complete.ts`.
- Middle: orchestrate test for halted drive on failed verification.

### Expected touched paths (tentative)

```text
src/executor/
├── run-complete.ts          ~
├── orchestrate.ts           ?
└── __tests__/
    ├── run-complete.test.ts ~
    └── orchestrate.test.ts  ~
src/.pi/extensions/__tests__/registry.test.ts ?
```

## Slice 2: Failed Verification Blocks Promotion

Status: next

### Target Behavior

A run with failed verification cannot transition from `petri_exported` to `promotion_prepared`.

### Full-card cold-start reads

- `memory/SPEC.md` — D98-L, D101-L, I52-L/I56-L executor authority and side-effect discipline.
- `memory/PLAN.md` — frontier: `executor-run-integrity`.
- `src/executor/TOPOLOGY.md` — promotion boundary and run-local land rules.

### Boundary Crossings

→ `execute_promotion_prepare`
→ `src/executor/promotion.ts`
→ `reports.jsonl` verdict scan
→ `GitLandPort` not invoked on failed verification

### Risks and Assumptions

- RISK: duplicate verdict logic drifts from run completion → MITIGATION: extract an executor-local report verdict reader if both guards need the same logic.
- ASSUMPTION: promotion can read reports for every petri-exported run.
  → IMPACT IF FALSE: promotion must fail closed when reports are absent.
  → VALIDATE: promotion unit test for missing reports.

### Acceptance Criteria

✓ `preparePromotion` refuses failed verification and leaves metadata unchanged.
✓ `GitLandPort` is not called when verification is failed or missing.
✓ Existing successful promotion still lands when verification is green.

### Verification Approach

- Inner: focused executor unit tests for `promotion.ts`.
- Middle: registry/tool wrapper test locks product-facing refusal shape if the wrapper output changes.

### Expected touched paths (tentative)

```text
src/executor/
├── promotion.ts             ~
├── report-verdict.ts        ?
└── __tests__/
    └── promotion.test.ts    ~
src/.pi/extensions/__tests__/registry.test.ts ?
```

## Slice 3: Executable Plan Preserves Dependency Topology

Status: next

### Target Behavior

Generated executable plans preserve graph-provided scaffold-to-leaf dependencies instead of flattening every slice to `depends_on: []`.

### Full-card cold-start reads

- `memory/SPEC.md` — D98-L, D101-L executor projection shape.
- `memory/PLAN.md` — frontier: `executor-run-integrity`; `planning-process-model` adjacency.
- `src/executor/TOPOLOGY.md` — executable-plan draft and preview compatibility notes.

### Boundary Crossings

→ `ExecutionSpecSnapshot`
→ `execute_plan_outline`
→ `src/executor/executable-plan-draft.ts`
→ `plan-preview.ts` / `plan-file.ts`

### Risks and Assumptions

- RISK: current graph snapshot lacks structured dependency facts → MITIGATION: preserve only accepted dependency facts; do not infer topology from requirement text.
- ASSUMPTION: the reversed fixture's scaffold relation is present in graph facts or outline input.
  → IMPACT IF FALSE: this becomes a graph/spec projection issue, not a draft heuristic.
  → VALIDATE: unit fixture over the lowest DTO that actually carries dependency facts.

### Acceptance Criteria

✓ Draft/preview/file tests show utility leaf slices depend on the scaffold slice when the input carries that dependency.
✓ Integration slice depends on utility leaves when the input carries those dependencies.
✓ No text-title heuristic is introduced to infer dependencies.

### Verification Approach

- Inner: `executable-plan-draft` and `plan-preview` unit tests.
- Middle: fixture plan-file golden for `cook-parallel-utils` if the fixture graph exposes dependency edges.

### Expected touched paths (tentative)

```text
src/executor/
├── execution-spec-snapshot.ts        ?
├── execute-plan-outline.ts           ?
├── executable-plan-draft.ts          ~
├── plan-preview.ts                   ?
└── __tests__/
    ├── executable-plan-draft.test.ts ~
    ├── plan-preview.test.ts          ?
    └── plan-file.test.ts             ?
.fixtures/workbenches/cook-parallel-utils/ ?
```

## Slice 4: Greenfield Runs Avoid Host Source Bleed

Status: next

### Target Behavior

Greenfield plan-only runs verify only generated fixture sources unless host source copying is explicitly selected.

### Full-card cold-start reads

- `memory/SPEC.md` — D98-L, D101-L, I52-L/I56-L executor authority and side-effect discipline.
- `memory/PLAN.md` — frontier: `executor-run-integrity`.
- `src/executor/TOPOLOGY.md` — source policy/copy/populate ownership.
- `.fixtures/workbenches/cook-parallel-utils/.brunch/cook/runs/run-mr9cmjg5/worktree/package.json` — host-source bleed shape.

### Boundary Crossings

→ `execute_orchestrate` default context
→ `src/executor/source-policy.ts`
→ `src/executor/source-copy.ts`
→ run worktree contents

### Risks and Assumptions

- RISK: existing host-source tests rely on the current default → MITIGATION: make source policy explicit in tests and wrappers.
- ASSUMPTION: greenfield mode is available before source policy selection.
  → IMPACT IF FALSE: thread mode through run metadata or require explicit orchestration policy.
  → VALIDATE: orchestrate/source-policy tests covering greenfield and host-source cases.

### Acceptance Criteria

✓ Greenfield orchestration selects `plan_only` or equivalent empty-project population by default.
✓ Host-source copying remains available only through explicit policy.
✓ A regression test proves unrelated host `src/**` files are absent from a greenfield utility run worktree.

### Verification Approach

- Inner: source-policy/source-copy/orchestrate unit tests.
- Middle: rerun `cook-parallel-utils` fixture and confirm verification reflects only generated utility package tests.

### Expected touched paths (tentative)

```text
src/executor/
├── orchestrate.ts            ~
├── source-policy.ts          ~
├── source-copy.ts            ?
└── __tests__/
    ├── orchestrate.test.ts   ~
    ├── source-policy.test.ts ~
    └── source-copy.test.ts   ?
src/.pi/extensions/agent-runtime/execute-orchestrate/index.ts ?
.fixtures/workbenches/cook-parallel-utils/ ?
```

## Routing

Recommended next step: build Slice 1 first with `ln-build memory/cards/executor-run-integrity--hardening.md`, stopping after Slice 1 if the report-verdict model reveals broader lifecycle-state changes.
