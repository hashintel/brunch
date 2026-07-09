# Live scope authoring from elicitor to accepted review set

Frontier: elicitor-scope-handoff
Status:   active
Mode:     single
Created:  2026-07-09

## Orientation

- Seam: accepted intent/design/verification truth -> live Specify-mode planning proposal -> plan-lens review set -> committed `scope`.
- Frontier: `elicitor-scope-handoff` turns FE-1173's proven downstream seam into a natural live authoring path.
- Posture: proving.
- Main risk: the live elicitor may keep generating frontier-level or freeform task prose, leaving `scope` as a technically valid shape with no canonical producer.
- Cross-cutting obligations: keep `scope` elicitation-owned, keep `slice` executor-only, and preserve the existing review-set commitment discipline instead of adding a direct graph-write shortcut.

## Target Behavior

When the user asks Brunch to plan implementation work in Specify mode, the live planning flow proposes one or more `scope` packages grounded in accepted intent/design/verification truth, presents them through the plan-lens review path, and commits the approved `scope` shape without executor-side repair heuristics.

## Full-card cold-start reads

- `memory/PLAN.md` — frontier: `scope-handoff-proof`, `elicitor-scope-handoff`.
- `memory/SPEC.md` — D100-L, D103-L, D109-L, D111-L, D112-L, I51-L, I58-L.
- `src/agents/runtime/elicitor/TOPOLOGY.md` — live Specify-mode authoring ownership.
- `src/agents/skills/project/SKILL.md` — project flow contract.
- `src/agents/skills/map/references/map-plans.md` — current planning projection guidance.
- `src/agents/skills/propose/references/present-review-set.md` — review-set presentation contract.
- `src/graph/review-set.ts` — plan-lens review-set authoring shape.
- `src/graph/command-executor/__tests__/accept-review-set.test.ts` — current committed `scope` proof.

## Boundary Crossings

```text
accepted intent / design / verification truth
-> live elicitor planning prompt + skill guidance
-> plan-lens proposal containing scope packages
-> present_review_set approval
-> committed `scope`
```

## Risks and Assumptions

- RISK: prompt/guidance changes could teach the language but still leave the runtime presenting frontier-only review sets. -> MITIGATION: prove the path through the actual plan-lens review-set surface, not just prompt text or unit-level formatting helpers.
- RISK: live authoring may smuggle executor concerns back into `scope` content. -> MITIGATION: keep acceptance focused on upstream truth grounding and review-set commitment, not worker-brief wording.
- ASSUMPTION: the existing `project`/`propose` skill seams can steer scope-shaped proposals without a new exchange family. -> IMPACT IF FALSE: a follow-up must change proposal/review surface ownership, not just wording. -> VALIDATE: one live flow reaches `present_review_set` with scope packages on the existing seam.
- ASSUMPTION: one manual end-to-end proof is enough for this tracer. -> IMPACT IF FALSE: a second slice should add broader prompt/oracle coverage before productizing the flow. -> VALIDATE: the live walkthrough produces a committed scope visible in export/executor surfaces.

## Posture Check

This is a proving tracer: it does not extend the durable model further. It only proves that the accepted `scope` model can be produced naturally by the live Specify-mode authoring path.

## Acceptance Criteria

✓ Live project/planning guidance teaches `intent -> design -> verification -> scope -> build` and names `scope` as the handoff unit.
✓ A live Specify-mode planning proposal can present a plan-lens review set containing scope packages grounded in accepted upstream truth.
✓ Approving that review set commits the same `scope` graph shape FE-1173 proved, with no executor-owned backfill logic.
✓ One manual walkthrough demonstrates the end-to-end path and confirms the committed scope is visible through the existing export/executor surfaces.

## Verification Approach

- Inner: focused tests around live prompt/guidance shaping and plan-lens review-set presentation only where the tracer crosses a subtle behavioral boundary.
- Outer: one manual Specify-mode walkthrough from accepted upstream truth to approved `scope`.
- Live proof: `node --import tsx src/probes/project-graph-review-cycle-proof.ts --seed-name workspace-alpha-grounding --seed-variant scope-handoff-ready --review-set-expectation scope_handoff --run-id fe-1175-scope-handoff-live --prompt "..."` -> promoted run evidence at `.fixtures/runs/project-graph-review-cycle/fe-1175-scope-handoff-live/`.

## Cross-cutting Obligations

- Preserve review-set commitment discipline: live planning proposals stay advisory until approval.
- Preserve model ownership: `scope` belongs to elicitation truth; `slice` remains executor-derived.
- Preserve D103-L boundary: do not reopen horizon/decision-flow persistence or broader plan-plane redesign in this tracer.

## Expected Touched Paths (Tentative)

```text
src/agents/runtime/elicitor/
├── compose-live-prompt.ts                        ?
└── TOPOLOGY.md                                   ?
src/agents/skills/project/
├── SKILL.md                                      ~
└── references/
    └── map-plans.md                             ~
src/agents/skills/propose/
└── references/
    └── present-review-set.md                    ~
src/graph/
├── review-set.ts                                ?
└── command-executor/__tests__/
    └── accept-review-set.test.ts                ?
memory/cards/
└── elicitor-scope-handoff--live-scope-authoring-tracer.md  +
```
