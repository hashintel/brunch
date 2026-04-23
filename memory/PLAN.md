<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The live frontier remains **Track A — Interaction model**, now centered on reusable interviewer-invoked context gathering. The brownfield grounding-brief proving slice is retired: real brownfield startup now reads as a coherent grounding brief + paired question + live activity lifecycle, so the next interaction-model work is broadening that same context-gathering seam beyond the opening turn. Workflow-ownership extraction stays queued behind this interaction-model expansion.

## Active

### Track A — Interaction model

1. **Reusable interviewer-invoked context gathering** — generalize context gathering beyond opening grounding.
   - Why now / unlocks: the opening brownfield grounding-brief seam is now proven in both automated coverage and real usage, so the next honest step is reusing that same artifact/lifecycle seam whenever the interviewer needs more orientation later in grounding. This broadens grounding capability without inventing a second artifact model.
   - Traceability: D99, D30, D32, D83, D117; I101, I104.

## Next

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

- [2026-04-23] Brownfield workspace-analysis grounding brief parity / proving retired — Done: a real brownfield start confirmed that the grounding brief, paired question, and live activity chrome read as one coherent turn lifecycle, so the remaining uncertainty is no longer about startup parity. Verified: manual confirmation in a real brownfield run. Watch: reuse the same seam for later interviewer-invoked context gathering rather than inventing a second artifact family.
- [2026-04-23] Transcript activity chrome and workspace polish retired — Done: task activity now mirrors reasoning's auto-open/auto-collapse behavior, task/reasoning triggers can hide leading icons, live tool activity surfaces richer target details during streaming, the duplicate `src/components/ai-elements` tree was removed in favor of `src/client/components/ai-elements`, and workspace/review header layout polish landed. Verified: `npm run verify`. Watch: extend `extractToolDetail()` as new tool families need richer live targets.
- [2026-04-22] Review revision card contract consistency retired — Done: acceptance now carries predecessor metadata across sparse regenerated review sets, regeneration context/prompt sources preserve reference codes + rationale + grounding refs + explicit `Added in revision` / `Revised` semantics, and criteria-phase active/replayed/pending review-card routes plus source-owned examples now prove the same contract as requirements. Verified: `npm run verify`. Watch: the next honest follow-on is deciding whether projector-side normalization/fallback can now be reduced without regressing transcript trust.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Interaction model
reusable-context-gathering  (active)

TRACK B — Runtime / workflow ownership
workflow-ownership-extraction
  └──→ continuous-workspace-phase-addressable-interview-surface
```
