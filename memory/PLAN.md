<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The live frontier is now **Track A — Interaction model**, centered on the first brownfield workspace-analysis grounding brief now that review revision card contract consistency has landed. The runtime seam no longer blocks grounding/design successor interactivity on observer capture, and regenerated review cards now hold a stable source-owned contract, so the next planning pressure shifts back to proving turn-internal grounding cards against real brownfield repos while workflow-ownership extraction stays queued behind that interaction seam.

## Active

### Track A — Interaction model

1. **Brownfield workspace-analysis grounding brief** — first analysis-first grounding path using turn-internal grounding cards.
   - Why now / unlocks: with review revision contract drift retired, this can now prove the turn-internal grounding-card seam against real brownfield repos without reopening the core lifecycle question.
   - Traceability: D32, D83, D99, D117, D120; A47, A56; I101.

## Next

### Track A — Interaction model

1. **Reusable interviewer-invoked context gathering** — generalize context gathering beyond opening grounding.
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

- [2026-04-22] Review revision card contract consistency retired — Done: acceptance now carries predecessor metadata across sparse regenerated review sets, regeneration context/prompt sources preserve reference codes + rationale + grounding refs + explicit `Added in revision` / `Revised` semantics, and criteria-phase active/replayed/pending review-card routes plus source-owned examples now prove the same contract as requirements. Verified: `npm run verify`. Watch: the next honest follow-on is deciding whether projector-side normalization/fallback can now be reduced without regressing transcript trust.
- [2026-04-22] Specification runtime state-machine proving retired — Done: decoupled grounding/design structured-response observer capture from interviewer successor readiness using a specification-scoped lifecycle backlog plus turn-owned `/api/specifications/:id/turns/:turnId/observer-capture`, preserved turn-owned capture status / stale-turn safety, and proved reload/reseed behavior without introducing a second durable workflow model. Verified: `npm run verify`. Watch: server dedupe is process-local and deferred capture is still scoped to grounding/design structured responses.
- [2026-04-22] Query ownership remediation retired — Done: accepted the automated route/query oracles plus manual outer-loop walkthrough validation across `brownfield-grounding-replay`, `issue-tracker-requirements-ready`, `issue-tracker-criteria-ready`, and `issue-tracker-all-phases-closed`, then retired `Active → Track A — Query ownership → Query ownership remediation` as complete. Watch: the same walkthrough surfaced a new lifecycle/runtime concern around observer backlog independence and revision-card contract drift, which now anchors the next planning frontier.
- [2026-04-22] Transcript/entity boundary repair — Done: moved the entities subscription out of `src/client/routes/specification/$id/_view/route.tsx`'s transcript-owning `ViewLayout` into entity-owned child surfaces only, and strengthened the mounted-route router oracle to prove entities invalidation refetches only `/entities` without remounting or rerendering the interview route. Verified: `npm run verify`.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Interaction model
brownfield-workspace-analysis-grounding-brief  (active)
  └──→ reusable-context-gathering

TRACK B — Runtime / workflow ownership
workflow-ownership-extraction
  └──→ continuous-workspace-phase-addressable-interview-surface
```
