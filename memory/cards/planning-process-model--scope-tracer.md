# Prove scope as the handoff from specification to execution

Frontier: planning-process-model
Status:   active
Mode:     single
Created:  2026-07-09

## Orientation

- Seam: accepted specification truth (intent/design/verification) -> committed `scope` node -> scope-scoped executor projection -> enriched slice request.
- Frontier: `planning-process-model` remains Horizon/proving in `memory/PLAN.md`; this card proves the `scope` handoff seam without promoting the full plan-plane redesign into canon yet.
- Posture: proving (inherited from `planning-process-model`).
- Main risk: `scope` could collapse into duplicated task prose or executor-owned heuristics if graph commitment and executor export boundaries are not kept separate.
- Cross-cutting obligations: preserve D100-L's existing review-set path, preserve D111-L/D112-L executor purity and side-effect boundaries, and keep `slice` a derived execution artifact rather than a restored durable graph kind.

## Target Behavior

One accepted `scope` packages reviewed specification truth (intent, design, and verification) and exports one executor slice brief without the executor inferring missing implementation meaning from broad graph context.

## Full-card cold-start reads

- `memory/SPEC.md` — D56-L, D94-L, D98-L, D100-L, D103-L, D111-L, D112-L, I51-L, I58-L.
- `memory/PLAN.md` — frontier: `planning-process-model`.
- `src/graph/TOPOLOGY.md` — graph mutation boundary, plan-plane vocabulary, and query ownership.
- `src/agents/runtime/elicitor/TOPOLOGY.md` — live Specify-mode elicitor ownership and prompt/runtime boundary.
- `src/executor/TOPOLOGY.md` — executor projection seam, slice request ownership, and side-effect rules.
- `src/agents/skills/project/references/intent-to-design.md` — accepted intent to design projection shape.
- `src/agents/skills/project/references/design-to-oracle.md` — design to verification projection shape.

## Boundary Crossings

```text
accepted intent / design / oracle anchors
-> review-set commitment of one scope package
-> scope-aware plan/output projection
-> executable-plan draft slice export
-> slice request / worker brief
```

## Risks and Assumptions

- RISK: adding `scope` reintroduces durable below-frontier sprawl and quietly restores `slice` semantics under a new name. -> MITIGATION: add only one durable below-frontier node (`scope`), keep `slice` runtime-only, and use existing edge categories for the tracer.
- RISK: cross-plane review-set commitment for design + verification + scope may require a broader prompt/tool affordance change than the tracer can carry. -> MITIGATION: keep the commit path on the existing candidate/review-set surface and prove one minimal combined package end to end.
- ASSUMPTION: `one scope -> one slice` is enough to prove the handoff seam before staged lowering exists. -> IMPACT IF FALSE: a follow-on tracer must prove staged lowering rules before `scope` can be the default execution source. -> VALIDATE: the exported slice and worker request must carry scope-derived design + verification content, not just requirement prose.
- ASSUMPTION: existing edge categories (`composition`, `realization`, `witness`) are sufficient to model the `scope` package. -> IMPACT IF FALSE: the ontology grows before the tracer proves the current semantics are inadequate. -> VALIDATE: command/review-set tests can express the package without introducing a new edge category.

## Posture Check

This is a proving tracer: it lights up a new end-to-end path from elicitation commitment to executor handoff and retires the load-bearing assumption that a durable accountability unit below `frontier` needs either a restored `slice` node or executor-owned heuristics.

## Acceptance Criteria

✓ `src/graph/command-executor/__tests__/accept-review-set.test.ts` or `src/graph/__tests__/review-set.test.ts` — one approved review set can commit a `scope` node linked to a `frontier`, reviewed design anchors, reviewed requirement/criterion anchors, and verification anchors using existing edge categories.
✓ `src/agents/contexts/data-model/plan/__tests__/plan-output.test.ts` — plan output can render durable `scope` material distinctly from `frontier` without restoring durable `slice` output.
✓ `src/executor/__tests__/execution-spec-snapshot.test.ts` and `src/executor/__tests__/executable-plan-draft.test.ts` — executor projection reads `scope`-scoped anchors and exports one derived slice whose payload includes `scopeId`, scope definition, design context, and verification context.
✓ `src/executor/__tests__/slice-execute.test.ts` or `src/app/__tests__/agent-runner-port.test.ts` — the worker request/task text includes scope-derived design + verification content, not just ids or raw requirement text.

## Verification Approach

- Inner: targeted Vitest over graph commitment, plan output, executor projection, and slice request rendering.
- Gate: `npm run verify`.

## Cross-cutting Obligations

- Preserve review-set commitment discipline: candidate presentation stays recognition-only; graph truth crosses only through review-set acceptance or existing graph mutation boundaries.
- Preserve executor purity: `src/executor/` reads committed graph projections and writes declared run artifacts only; it does not mutate graph truth or grow prompt-only heuristics.
- Preserve plan-plane clarity: `scope` is the only durable tracer below `frontier`; `slice` remains a derived execution artifact.
- Preserve minimal ontology growth: no new edge categories in the tracer unless the existing categories fail to express the package truthfully.

## Expected Touched Paths (Tentative)

```text
src/graph/
├── schema/
│   ├── kinds.ts                               ~
│   └── nodes.ts                               ?
├── review-set.ts                              ?
├── command-executor/
│   └── __tests__/
│       └── accept-review-set.test.ts          ~
└── __tests__/
    └── review-set.test.ts                     ?
src/agents/contexts/data-model/plan/
├── plan-output.ts                             ~
└── __tests__/
    └── plan-output.test.ts                    ~
src/agents/skills/project/references/
├── intent-to-design.md                        ?
└── design-to-oracle.md                        ?
src/executor/
├── execution-spec-snapshot.ts                 ~
├── execute-plan-outline.ts                    ?
├── executable-plan-draft.ts                   ~
├── slice-execute.ts                           ~
├── TOPOLOGY.md                                ~
└── __tests__/
    ├── execution-spec-snapshot.test.ts        ~
    ├── executable-plan-draft.test.ts          ~
    └── slice-execute.test.ts                  ~
src/app/
└── __tests__/
    └── agent-runner-port.test.ts              ?
memory/cards/
└── planning-process-model--scope-tracer.md    +
```
