# Structured Exchange Contract Tightening

Frontier: structured-exchange-affordance
Linear:   FE-1108
Status:   active
Mode:     slices
Created:  2026-06-30

## Orientation

- Containing seam: the live structured-exchange surface spanning `src/.pi/extensions/exchanges/`, `src/projections/exchanges/`, and `src/agents/contexts/exchanges/` after the `request_response` collapse and FE-1085 `project` closeout.
- Relevant frontier item: `structured-exchange-affordance` / FE-1108, inherited as the Linear issue and branch boundary from `memory/PLAN.md`.
- Main pressure: the legal exchange shape is now mostly structurally right, but the model-facing authoring contract still has “enforced but untaught” pockets around present-side choice rules, nested review-set payload companions, and leftover symmetry survivors.
- Main non-goal: this frontier does **not** redesign elicitation-gap ranking/guidance, and it does **not** introduce new exchange tool families or revive pre-collapse request tool routing.

Posture: earned hardening (inherited from `structured-exchange-affordance`)

## Target Behavior

The live exchange surface teaches the model the right shape where it authors exchange payloads, and the remaining exchange projection/renderer inventory contains only modules that still earn a shared home.

## Full-card cold-start reads

- `memory/SPEC.md` — I23-L, I51-L, D27-L, D37-L, D38-L, D65-L, D66-L, D84-L, D86-L, D96-L, D100-L.
- `memory/PLAN.md` — `structured-exchange-affordance` frontier definition and dependency order.
- `docs/design/STRUCTURED_EXCHANGE_COLLAPSE.md` — built rationale for `request_response` and the remaining “enforced but untaught” residue.
- `src/.pi/extensions/exchanges/TOPOLOGY.md` and `src/.pi/extensions/exchanges/schemas/TOPOLOGY.md` — current exchange adapter and schema ownership.
- `src/projections/TOPOLOGY.md` and `src/agents/contexts/exchanges/TOPOLOGY.md` — current exchange projection/render inventory and ownership boundary.
- `src/.pi/extensions/exchanges/{present-question,present-candidates,present-review-set,request-response}.ts` — current tool-facing descriptions/guidelines.
- `src/.pi/extensions/exchanges/schemas/{params,present,request,shared}.ts` — current authoring boundary shapes and companion discriminants.
- `src/projections/exchanges/*` and `src/agents/contexts/exchanges/*` — surviving shared modules to justify, inline, or delete.
- `src/session/{structured-exchange-loop.ts,exchange-projection.ts}` — transcript reconstruction and result-detail expectations that must remain true.

## Boundary Crossings

```text
→ model-authored exchange params / details guidance
→ Pi exchange tool registration and prompt guidelines
→ canonical transcript details projection
→ model-facing exchange result rendering
→ session pending-exchange reconstruction
→ topology inventory of what remains shared vs what gets inlined
```

## Risks and Assumptions

- RISK: tightening one boundary teaching surface while leaving another stale creates contradictory guidance → MITIGATION: update tool descriptions, schema descriptions, and renderer/context wording in the same slice when they teach the same shape.
- RISK: deleting an exchange projection/renderer that still has a real second consumer breaks transcript reconstruction or test inventory coverage → MITIGATION: justify every retained module explicitly and prove single-owner modules before inlining/deleting.
- RISK: broad cleanup widens into an exchange redesign → MITIGATION: preserve the current `present_*` / `request_response` / canonical request-detail contract; this frontier teaches and trims, it does not re-architect.
- ASSUMPTION: the remaining exchange pain is mostly authoring-surface teaching debt plus symmetry residue, not a deeper tool/topology mismatch.
  → IMPACT IF FALSE: the first slice should reveal a load-bearing mismatch and force a re-scope before broad delete work.
  → VALIDATE: start with the most model-facing seams (`present_question`, `present_candidates`, `present_review_set`, `request_response`) and the tests that already witness their transcript contract.

## Slice Queue

### Slice 1 — Present/response contract teaching

Status: done — tightened the present-side response-selection guidance and schema descriptions for `present_question` / `present_candidates`, removed legacy request-tool selection wording from `request_response`, and locked the guidance with `exchanges-extension.test.ts`.

- Tighten prompt-guideline and schema-description language for `present_question`, `present_candidates`, and `request_response`.
- Remove stale legacy request-tool wording where the model still appears to choose `request_answer` / `request_choice` / `request_choices` directly.
- Keep I51-L explicit for the candidates path: recognition now, commitment later.

### Slice 2 — Review-set nested companion teaching

Status: next

- Tighten the model-visible shape for `present_review_set` nested companions (`grounding`, `pitch`, `epistemicStatus`, related discriminants) at the authoring boundary.
- Keep the deep graph validator as the ultimate contract, but stop relying on deep failures as the first teaching surface.

### Slice 3 — Exchange inventory trim

- Audit `src/projections/exchanges/*` and `src/agents/contexts/exchanges/*` survivors after slices 1–2.
- Inline or delete modules that no longer earn a shared home; keep only modules with named multi-consumer or model-facing-text reasons.
- Reconcile the kept-vs-deleted inventory in the touched topology homes.

## Acceptance Criteria

✓ Present-side choice vs freeform vs candidate-selection rules are explicit where the model authors them; stale legacy request-tool pairing language is removed.
✓ Review-set nested payload companions are described or re-shaped at the authoring boundary, not only rejected deep in graph validation.
✓ `present_candidates` / `request_response` wording stays aligned with recognition-only semantics until a later review-set or graph-mutation commitment path.
✓ Unjustified exchange symmetry survivors are inlined or deleted; retained modules name a real multi-consumer or model-facing-text ownership reason.
✓ Touched topology homes agree on the final kept-vs-deleted exchange inventory.

## Verification Approach

- Inner: targeted exchange tests and snapshots for tool descriptions, transcript details, and renderer inventory.
- Middle: `npm run fix` after each meaningful edit cluster.
- Gate: `npm run verify` before tying off the frontier or any builder-delivered slice.

## Cross-cutting obligations

- Preserve the current `request_response` collapse and canonical request-detail discriminants; do not revive old request tool selection as model-facing product behavior.
- Preserve transcript-native recoverability and session reconstruction semantics in `src/session/`.
- Preserve I51-L: candidates never commit graph truth directly.
- Keep `.pi/extensions/` adapter-owned and `projections/` / `agents/contexts/` honest about whether a shared layer is still earned.

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                       ~
└── cards/
    └── structured-exchange-affordance--contract-tightening.md    +
src/
├── .pi/extensions/exchanges/
│   ├── {present-question,present-candidates,present-review-set,request-response}.ts   ~
│   ├── schemas/{params,present,request,shared}.ts                                   ~
│   ├── TOPOLOGY.md                                                                   ~
│   └── schemas/TOPOLOGY.md                                                           ~
├── projections/
│   ├── exchanges/*                                                                   ~/-
│   └── TOPOLOGY.md                                                                   ~
├── agents/contexts/exchanges/
│   ├── *.ts                                                                          ~/-
│   ├── __tests__/*                                                                   ~
│   └── TOPOLOGY.md                                                                   ~
└── session/
    ├── exchange-projection.ts                                                        ~
    └── __tests__/*                                                                   ~
```
