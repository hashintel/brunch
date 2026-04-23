<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The live frontier remains **Track A — Interaction model**, now narrowed to the last honest brownfield proving pass for turn-internal grounding cards. The transcript activity chrome now stages and streams correctly, including live thinking/tool displays, so the remaining gap is broader grounding-brief parity in a real repository rather than missing tool indication. Workflow-ownership extraction stays queued behind closing that last interaction-model proof.

## Active

### Track A — Interaction model

1. **Brownfield workspace-analysis grounding brief parity / proving** — close the gap between synthetic coverage and real brownfield runtime behavior for turn-internal grounding cards.
   - Why now / unlocks: the staging/runtime parity fixes now cover both pending-preface and live tool-activity projection in automated runtime tests, and the current activity chrome is behaving correctly in the app. The remaining question is whether one honest built-app brownfield walkthrough in `~/code/lunelson/cco` proves the full grounding-brief-to-question sequence as a coherent end-to-end interaction. Closing that last outer-loop check unlocks the reusable context-gathering frontier on top of a proven interaction seam instead of a test-only one.
   - Traceability: D32, D83, D99, D117, D120; A47, A56; I101.
   - Remaining proof:
     - Confirm in a real brownfield run that the grounding brief, paired question, and live activity chrome read as one legible turn lifecycle rather than three loosely related states.

## Next

### Track A — Interaction model

1. **Reusable interviewer-invoked context gathering** — generalize context gathering beyond opening grounding.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model. Best resumed after the remaining brownfield grounding-brief proof retires.
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

- [2026-04-23] Transcript activity chrome and workspace polish retired — Done: task activity now mirrors reasoning's auto-open/auto-collapse behavior, task/reasoning triggers can hide leading icons, live tool activity surfaces richer target details during streaming, the duplicate `src/components/ai-elements` tree was removed in favor of `src/client/components/ai-elements`, and workspace/review header layout polish landed. Verified: `npm run verify`. Watch: extend `extractToolDetail()` as new tool families need richer live targets.
- [2026-04-22] Review revision card contract consistency retired — Done: acceptance now carries predecessor metadata across sparse regenerated review sets, regeneration context/prompt sources preserve reference codes + rationale + grounding refs + explicit `Added in revision` / `Revised` semantics, and criteria-phase active/replayed/pending review-card routes plus source-owned examples now prove the same contract as requirements. Verified: `npm run verify`. Watch: the next honest follow-on is deciding whether projector-side normalization/fallback can now be reduced without regressing transcript trust.
- [2026-04-22] Specification runtime state-machine proving retired — Done: decoupled grounding/design structured-response observer capture from interviewer successor readiness using a specification-scoped lifecycle backlog plus turn-owned `/api/specifications/:id/turns/:turnId/observer-capture`, preserved turn-owned capture status / stale-turn safety, and proved reload/reseed behavior without introducing a second durable workflow model. Verified: `npm run verify`. Watch: server dedupe is process-local and deferred capture is still scoped to grounding/design structured responses.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Interaction model
brownfield-workspace-analysis-grounding-brief-parity-proving  (active)
  └──→ reusable-context-gathering

TRACK B — Runtime / workflow ownership
workflow-ownership-extraction
  └──→ continuous-workspace-phase-addressable-interview-surface
```
