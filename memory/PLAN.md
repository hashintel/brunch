<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The live frontier is now **Track A — Interaction model**, centered on restoring review revision card contract consistency now that specification-scoped runtime proving has landed. The runtime seam no longer blocks grounding/design successor interactivity on observer capture, so the next planning pressure shifts back to transcript trust, while workflow-ownership extraction and brownfield/context follow-ons stay queued behind that freshly proven lifecycle contract.

## Active

### Track A — Interaction model

1. **Review revision card contract consistency** — make regenerated requirements/criteria review cards preserve the same display contract as the initial review card, including reference codes, grounding references, rationale line, and explicit badge semantics.
   - Why now / unlocks: with runtime proving retired, the most visible remaining trust break from the same manual walkthrough is regenerated review-card drift (`Added by you` ambiguity, raw `requirements:one`-style identifiers, missing secondary lines). Fixing the review revision contract before more brownfield/context slices keeps accepted-review semantics legible.
   - Execution fronts: align first-review and regenerated-review projection on one display contract; preserve stable reference codes, grounding/rationale secondary lines, and explicit badge semantics across live successor turns and replay; prove the contract in routed review tests without widening into broader review UX redesign.
   - Traceability: D90, D118, D119; A61, A62; I87, I104.

## Next

### Track A — Interaction model

1. **Brownfield workspace-analysis grounding brief** — first analysis-first grounding path using turn-internal grounding cards.
   - Why now / unlocks: now that deferred observer capture no longer blocks successor interactivity, this can prove the turn-internal grounding-card seam against real brownfield repos without reopening the core lifecycle question.
   - Traceability: D32, D83, D99, D117, D120; A47, A56; I101.

2. **Reusable interviewer-invoked context gathering** — generalize context gathering beyond opening grounding.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model. Best resumed after the brownfield grounding-brief slice proves the current interaction seam on real repositories.
   - Traceability: D99, D30, D32, D83, D117; I101, I104.

### Track B — Runtime / workflow ownership

3. **Workflow ownership extraction** — extract the workflow projector/read path and transition/orchestration write path behind explicit runtime-owned seams now that the D113 lifecycle contract has a concrete proving slice.
   - Why now / unlocks: the runtime proving slice landed the deferred observer backlog seam without introducing a second durable workflow model. This cleanup can now separate transport, durable snapshot assembly, workflow projection, and workflow transition logic without guessing ahead.
   - Traceability: D110, D112, D113, D123; I24, I72, I104, I105.

4. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation.
   - Why now / unlocks: still depends on workflow ownership extraction. Once read/write workflow ownership is explicit, a continuous workspace can adopt one chat runtime and section-addressable focus without adding new lifecycle ambiguity.
   - Traceability: A58; D86, D87, D103, D107, D110, D113, D114; I24, I102.

## Horizon

### Engagement / polish

- Thinking token streaming in a lines-limited vertical scrolling sub-area for the interview view.

### Completion / reporting follow-ons

- Dashboard / result summaries and completeness metrics.

### Revisit / cascade

- Edit mode + cascade preview.
- Cascade execution + secondary thread lifecycle.

### Infrastructure / tooling / extensions

- Typed fixture-builder convergence for happy-path tests — unify happy-path review/interview test fixtures behind the same typed builders used by seed/walkthrough generation, while keeping raw inline literals only for negative/schema-invalid cases.
- Drizzle Kit audit remediation.
- Git-friendly file-based persistence representation for diffable specs.
- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.

## Recently Completed

- [2026-04-22] Specification runtime state-machine proving retired — Done: decoupled grounding/design structured-response observer capture from interviewer successor readiness using a specification-scoped lifecycle backlog plus turn-owned `/api/specifications/:id/turns/:turnId/observer-capture`, preserved turn-owned capture status / stale-turn safety, and proved reload/reseed behavior without introducing a second durable workflow model. Verified: `npm run verify`. Watch: server dedupe is process-local and deferred capture is still scoped to grounding/design structured responses.
- [2026-04-22] Query ownership remediation retired — Done: accepted the automated route/query oracles plus manual outer-loop walkthrough validation across `brownfield-grounding-replay`, `issue-tracker-requirements-ready`, `issue-tracker-criteria-ready`, and `issue-tracker-all-phases-closed`, then retired `Active → Track A — Query ownership → Query ownership remediation` as complete. Watch: the same walkthrough surfaced a new lifecycle/runtime concern around observer backlog independence and revision-card contract drift, which now anchors the next planning frontier.
- [2026-04-22] Transcript/entity boundary repair — Done: moved the entities subscription out of `src/client/routes/specification/$id/_view/route.tsx`'s transcript-owning `ViewLayout` into entity-owned child surfaces only, and strengthened the mounted-route router oracle to prove entities invalidation refetches only `/entities` without remounting or rerendering the interview route. Verified: `npm run verify`.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Interaction model
review-revision-card-contract-consistency  (active)
brownfield-workspace-analysis-grounding-brief
  └──→ reusable-context-gathering

TRACK B — Runtime / workflow ownership
workflow-ownership-extraction
  └──→ continuous-workspace-phase-addressable-interview-surface
```
