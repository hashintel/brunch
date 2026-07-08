# Executor Plan Projection Integrity

Frontier: executor-run-integrity
Status:   retained-unconfirmed
Mode:     single
Created:  2026-07-06

## Orientation

- Seam: executor plan projection from graph snapshot to executable cook plan (`src/executor/execution-spec-snapshot.ts` -> `execute-plan-outline.ts` -> `executable-plan-draft.ts`).
- Frontier: `executor-run-integrity` (FE-1154), reopened as a focused follow-up because the transcript evidence shows the run lifecycle hardening landed but plan projection can still erase the graph's dependency shape.
- Posture: proving (inherited from `executor-run-integrity`).
- Main risk: the current snapshot may not carry enough non-requirement dependency evidence, so the slice must first expose that with a regression test and then pass only the minimum graph signal needed downstream.
- Retention note: acceptance boxes are checked and the FE-1154 branch has since passed verification, but this file is retained until KA confirms executor-card cleanup.

## Target Behavior

Plan-producing execute tools refuse to emit or write a falsely-flat executable plan when the graph contains dependency edges that the current requirement-slice projection cannot represent.

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

✓ `src/executor/__tests__/execution-spec-snapshot.test.ts` — requirement-to-requirement dependency edges are the only dependency edges lowered into executable slice dependencies.
✓ `src/executor/__tests__/execute-plan-check.test.ts` — plan readiness is blocked by missing executable inputs, not by non-requirement dependency context the cook scheduler does not lower.
✓ Plan-producing execute tools assert plan readiness before returning or writing outline/draft/preview/plan artifacts.

## Verification Approach

- Inner: targeted Vitest for executor projection tests proves the topology-preserving behavior.
- Gate: `npm run verify` if feasible; otherwise report the first unrelated/environmental blocker with command output.

## Cross-cutting Obligations

- Preserve executor side-effect honesty: projection functions remain side-effect free.
- Preserve CON2/CON4: no missing dependency edges when the graph encodes genuine build order.
- Do not force greenfield verify policy in this slice; CON5 is a separate follow-up unless a failing test already names it.

## Expected Touched Paths (Tentative)

```text
src/executor/
├── execution-spec-snapshot.ts       ~
├── execute-plan-check.ts            ~
├── execute-projection.ts            ~
├── TOPOLOGY.md                      ~
└── __tests__/
    ├── execution-spec-snapshot.test.ts ?
    └── execute-plan-check.test.ts      ~
src/.pi/extensions/executor/
├── execute-plan-draft/index.ts          ~
├── execute-plan-draft-artifact/index.ts ~
├── execute-plan-file/index.ts           ~
├── execute-plan-outline/index.ts        ~
└── execute-plan-preview/index.ts        ~
memory/cards/
└── executor-run-integrity--plan-projection.md +
```

## Build Note

Targeted projection tests passed in the original isolated worktree. The FE-1154 branch later passed `npm run verify`; this derivative card remains in-tree only because executor-card cleanup is awaiting KA confirmation.

## Revision Note

The original slice blocked every dependency edge outside requirement-to-requirement shape as an unprojected dependency. FE-1114 follow-up evidence showed that was too broad: legitimate design-plane dependency context should not block execution when the real requirement-slice diamond is present. Current behavior lowers only requirement-to-requirement dependencies and leaves other dependency edges to graph hygiene/reconciliation workflows outside executable scheduling.
