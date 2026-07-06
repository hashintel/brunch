# Executor Plan Projection Integrity

Frontier: executor-run-integrity
Status:   active
Mode:     single
Created:  2026-07-06

## Orientation

- Seam: executor plan projection from graph snapshot to executable cook plan (`src/executor/execution-spec-snapshot.ts` -> `execute-plan-outline.ts` -> `executable-plan-draft.ts`).
- Frontier: `executor-run-integrity` (FE-1154), reopened as a focused follow-up because the transcript evidence shows the run lifecycle hardening landed but plan projection can still erase the graph's dependency shape.
- Posture: proving (inherited from `executor-run-integrity`).
- Main risk: the current snapshot may not carry enough non-requirement dependency evidence, so the slice must first expose that with a regression test and then pass only the minimum graph signal needed downstream.

## Target Behavior

Executor runs refuse misleading plans, use run-scoped verification, keep worker artifacts inside the sandbox, and halt before completing failed slices.

## Full-card cold-start reads

- `memory/SPEC.md` — D51-L, D56-L, D98-L; constraints CON4/CON5 if present in the live graph.
- `memory/PLAN.md` — frontier: `executor-run-integrity` and `planning-process-model` context.
- `src/executor/TOPOLOGY.md` — executor projection boundary and port/lifecycle rules.

## Boundary Crossings

→ graph edge snapshot projection
→ execution plan outline
→ executable plan draft
→ cook scheduler-visible `depends_on`

## Risks and Assumptions

- RISK: requirement-only dependency extraction cannot see design/decision/term edges that encode the intended diamond/gate. → MITIGATION: add a regression that builds the minimal graph shape and requires the executable draft to contain slice dependencies; widen the snapshot only as far as needed.
- ASSUMPTION: dependency category direction remains dependency -> dependent. → IMPACT IF FALSE: projected `depends_on` reverses and the cook schedule serializes incorrectly. → VALIDATE: regression names the concrete upstream/downstream requirements and asserts only downstream slices depend on upstream slices.

## Posture Check

This is a proving tracer. It stabilizes the executor projection invariant by making the reversed-cook failure reproducible at the projection seam before touching broader orchestration.

## Acceptance Criteria

✓ `src/executor/__tests__/execution-spec-snapshot.test.ts` — projected dependency edges outside requirement-to-requirement shape are preserved as unprojected dependencies.
✓ `src/executor/__tests__/execute-plan-check.test.ts` — unprojected dependencies block plan readiness with an error instead of allowing a flat executable plan.
✓ Plan-producing execute tools assert plan readiness before returning or writing outline/draft/preview/plan artifacts.
✓ `src/executor/__tests__/executable-plan-draft.test.ts` — representable diamond-shaped requirement dependencies still lower to executable slice `dependsOn`.
✓ `src/executor/__tests__/run.test.ts` / `test-result.test.ts` / `src/app/__tests__/test-runner-port.test.ts` — greenfield runs carry `bun test`; brownfield runs keep `npm run verify`; the test runner honors run-scoped commands.
✓ `src/executor/__tests__/slice-execute.test.ts` / `agent-result.test.ts` — worker request/result artifacts live under the run worktree.
✓ `src/executor/__tests__/slice-complete.test.ts` / `orchestrate.test.ts` — failed slice verification halts at `slice_complete` without recording `slice_completed`.

## Verification Approach

- Inner: targeted Vitest for executor projection tests proves the topology-preserving behavior.
- Gate: `npm run verify` if feasible; otherwise report the first unrelated/environmental blocker with command output.

## Cross-cutting Obligations

- Preserve executor side-effect honesty: projection functions remain side-effect free.
- Preserve CON2/CON4: no missing dependency edges when the graph encodes genuine build order.
- Preserve CON5: greenfield verification must be todo-scoped (`bun test`), not the host monorepo verify target.

## Expected Touched Paths (Tentative)

```text
src/executor/
├── agent-result.ts                 ~
├── execution-ports.ts              ~
├── execution-spec-snapshot.ts       ~
├── execute-plan-check.ts            ~
├── execute-projection.ts            ~
├── orchestrate.ts                   ~
├── run.ts                           ~
├── slice-complete.ts                ~
├── slice-execute.ts                 ~
├── test-result.ts                   ~
├── TOPOLOGY.md                      ~
└── __tests__/
    ├── agent-result.test.ts          ~
    ├── executable-plan-draft.test.ts ~
    ├── execution-spec-snapshot.test.ts ?
    ├── execute-plan-check.test.ts      ~
    ├── orchestrate.test.ts             ~
    ├── run.test.ts                     ~
    ├── slice-complete.test.ts          ~
    ├── slice-execute.test.ts           ~
    └── test-result.test.ts             ~
src/app/
├── test-runner-port.ts              ~
└── __tests__/test-runner-port.test.ts ~
src/.pi/extensions/agent-runtime/
├── __tests__/execute-orchestrate-updates.test.ts ~
├── execute-orchestrate/index.ts      ~
├── execute-plan-draft/index.ts          ~
├── execute-plan-draft-artifact/index.ts ~
├── execute-plan-file/index.ts           ~
├── execute-plan-outline/index.ts        ~
└── execute-plan-preview/index.ts        ~
memory/cards/
└── executor-run-integrity--plan-projection.md +
```

## Build Note

Targeted executor/app tests pass. Full `npm run fix` / gate is blocked in this isolated worktree by missing installed dependencies (`typebox`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, etc.), so the card remains active rather than consumed/deleted.
