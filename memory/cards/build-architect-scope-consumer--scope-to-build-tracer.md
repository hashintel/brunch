# Consume committed scope in the build architect

Frontier: build-architect-scope-consumer
Status:   active
Mode:     single
Created:  2026-07-09

## Orientation

- Seam: committed `frontier -> scope` package -> executor/build-architect lowering -> executable-plan draft -> worker-facing slice brief.
- Frontier: `build-architect-scope-consumer` is the first real consumer follow-on to FE-1173/FE-1175. The proof stack established that `scope` can be committed and authored; this frontier makes that handoff operational in execute-mode.
- Posture: proving.
- Main risk: the executor may keep treating `scope` as descriptive metadata while still planning directly from frontier-level requirement lists, leaving the handoff real in storage but not load-bearing in build.
- Cross-cutting obligations: keep `scope` elicitation-owned, keep `slice` executor-owned, and do not restore a durable `slice` graph node just to make lowering easier.

## Target Behavior

Given committed scope truth, the build architect derives a buildable plan from the scope package itself: one scope can lower into one or more executor-owned slices, dependencies remain truthful, and slice briefs preserve the scope package's design and verification context without the user restating it.

## Full-card cold-start reads

- `memory/PLAN.md` — frontiers: `scope-handoff-proof`, `elicitor-scope-handoff`, `build-architect-scope-consumer`.
- `memory/SPEC.md` — D100-L, D103-L, D111-L, D112-L, I51-L, I58-L.
- `src/executor/TOPOLOGY.md` — execute-mode ownership, `ExecutionSpecSnapshot`, plan outline, and executable-plan draft boundaries.
- `src/executor/execution-spec-snapshot.ts` — committed scope package projection.
- `src/executor/execute-plan-outline.ts` — scope package to build-task outline lowering.
- `src/executor/executable-plan-draft.ts` — outline to worker-facing slice brief lowering.
- `src/executor/plan-preview.ts` and `src/executor/plan-file.ts` — plan artifact surfaces that should carry the lowered result.

## Boundary Crossings

```text
committed frontier + scope truth
-> executor-facing scope snapshot
-> build-architect lowering / plan outline
-> executable-plan draft
-> worker-facing slice brief / plan artifact
```

## Risks and Assumptions

- RISK: lowering may collapse back to one requirement = one slice, making `scope` only a label over the existing planner. -> MITIGATION: prove at least one committed scope that truthfully lowers into multiple executor-owned slices.
- RISK: scope-local dependency projection may accidentally erase needed ordering or reintroduce self-edges when the same scope fans out. -> MITIGATION: keep acceptance focused on truthful dependency preservation in the lowered slice set.
- ASSUMPTION: the current execute-mode surfaces (`ExecutionSpecSnapshot`, plan outline, executable-plan draft) are the right consumer seam; no new planner substrate is needed. -> IMPACT IF FALSE: a follow-on frontier must introduce a new executor/build-architect seam instead of stretching prompt text. -> VALIDATE: one tracer lands on the current execute-mode artifacts.
- ASSUMPTION: build-architect lowering needs only secondary prompt shaping, not a new elicitor frontier. -> IMPACT IF FALSE: widen only after the executor-side seam is proven insufficient. -> VALIDATE: one focused consumer pass succeeds with executor/productization changes as the primary work.

## Posture Check

This frontier productizes a proven seam, but the first slice is still a tracer. It should prove that committed `scope` is not just durable truth but the actual planning input to execute-mode.

## Acceptance Criteria

✓ Execute-mode planning consumes committed scope packages as the organizing unit for build derivation rather than reading frontier requirements directly.
✓ One committed scope can lower into multiple executor-owned slices/tasks when the work naturally fans out.
✓ Derived slices preserve scope identity plus the scope package's design and verification context where workers need it.
✓ One focused proof shows a user can start from committed scope truth and obtain a buildable plan artifact without hand-restating the scope package.

## Verification Approach

- Inner: targeted Vitest over `execution-spec-snapshot`, `execute-plan-outline`, `executable-plan-draft`, and any worker-brief/plan-artifact surface the tracer touches.
- Outer: one narrow manual or fixture-backed proof from committed scope package to buildable plan artifact.
- Gate: use focused checks on touched files if the repo-wide `npm run verify` remains blocked by the known unrelated `@earendil-works/pi-ai/compat` issue.

## Cross-cutting Obligations

- Preserve executor purity: no graph mutation, Pi runtime coupling, or app/UI side effects under `src/executor/`.
- Preserve ownership clarity: `scope` stays durable elicitation truth; `slice` stays derived build/execution output.
- Preserve deletion pressure: do not keep frontier-level fallback planning paths alive if the consumer seam replaces them truthfully.
- Preserve boundary discipline: do not reopen the broader planning-process-model redesign or invent new durable graph kinds in this tracer.

## Expected Touched Paths (Tentative)

```text
src/executor/
├── execution-spec-snapshot.ts             ?
├── execute-plan-outline.ts                ~
├── executable-plan-draft.ts               ~
├── plan-preview.ts                        ?
├── plan-file.ts                           ?
├── slice-execute.ts                       ?
├── TOPOLOGY.md                            ~
└── __tests__/
    ├── execution-spec-snapshot.test.ts    ?
    ├── execute-plan-outline.test.ts       ~
    ├── executable-plan-draft.test.ts      ~
    ├── plan-preview.test.ts               ?
    ├── plan-file.test.ts                  ?
    └── slice-execute.test.ts              ?
memory/cards/
└── build-architect-scope-consumer--scope-to-build-tracer.md  +
```
