<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The live frontier is now **Track A — Query ownership remediation**. Recent runtime/query commits already began this refactor, so this sync makes `memory/PLAN.md` match the actual in-flight work instead of leaving the overlap implicit. `memory/REFACTOR.md` remains a temporary execution decomposition inside this one frontier item, not a second planning authority.

The interaction-model grounding/context work still matters, and the architecture/layout track still proceeds independently, but neither should outrank the live ownership repair while the transcript/entity boundary is still ambiguous.

## Active

### Track A — Query ownership

1. **Query ownership remediation** — restore one authoritative specification-owned read path for workflow state, landing state, and turns; keep entities as the separately invalidable domain; and prove that observer updates refresh only entity-owned surfaces instead of destabilizing the transcript.
   - Why now / unlocks: recent commits already started this refactor, and the current fake `core` / `turns` split plus transcript-side entity subscription leave the canonical ownership boundary unclear. Finishing this frontier removes planning drift between `memory/PLAN.md` and `memory/REFACTOR.md` and stabilizes the client seam that later interaction-model work depends on.
   - Live design inputs: `docs/query-domain-design.md` for query-owned routing/invalidation and loader priming, read through the current staged bundle-vs-entities correction; `docs/research/tanstack-loaders-vs-queries.md` for router-as-coordinator, targeted invalidation, and subscription placement; `docs/research/async-server-state-to-ui-sync-for-chat-observer-agents.md` for separating chat streaming from observer-owned entity refresh.
   - Execution fronts: authoritative specification bundle path, transcript/entity boundary repair, loader and entry-path consolidation, ownership integration oracles, residual interaction-model truth pass, and cleanup + walkthrough validation.
   - Traceability: D22, D87, D121; A20, A64; I24, I54, I102, I104.

## Next

### Track A — Interaction model

1. **Brownfield workspace-analysis grounding brief** — first analysis-first grounding path using turn-internal grounding cards.
   - Why now / unlocks: proves the turn-internal grounding-card seam against real brownfield repos once the query-ownership seam stops moving under the transcript surface.
   - Traceability: D32, D83, D99, D117, D120; A47, A56; I101.

2. **Reusable interviewer-invoked context gathering** — generalize context gathering beyond opening grounding.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model. Best resumed after the active ownership refactor so the same runtime/query seams do not change twice.
   - Traceability: D99, D30, D32, D83, D117; I101, I104.

### Track B — Architecture / layout

3. **Workflow ownership extraction** — extract projector and `app.ts` workflow ownership.
   - Why now / unlocks: architectural cleanup prerequisite for continuous workspace. Remains parallel to, not blocked by, query ownership.
   - Traceability: D110, D112, D113; I24, I72, I104.

4. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation.
   - Why now / unlocks: depends on workflow extraction. Once in place, phase section headers render more naturally in their realized sections.
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

- [2026-04-21] Review per-item commenting and regeneration — Done: per-item comment toggles on review set items, structured `itemComments` in submission payload, interviewer context includes per-item comments for successor review turns, version badges (v1, v2, …) on active and answered review sets, revision cards stacked above successor review sets showing change summary, and prior revision collapsing (superseded reviews render as compact summaries). Verified: `npm run verify`.
- [2026-04-21] Turn-internal grounding cards — Done: brownfield grounding turns produce both a grounding card and a question card within one turn lifecycle, observer captures the full validated unit, interviewer context renders stacked turns. Verified: `npm run verify`.
- [2026-04-21] Close Phase confirmation modal — Done: in-progress grounding and elicitation phases open a confirmation modal with readiness and turn-count context before user-forced close.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Query ownership
query-ownership-remediation  (active; canonical frontier — memory/REFACTOR.md is its temporary execution plan)

TRACK A — Interaction model
brownfield-workspace-analysis-grounding-brief
  └──→ reusable-context-gathering

TRACK B — Architecture / layout
workflow-ownership-extraction
  └──→ continuous-workspace-phase-addressable-interview-surface
```
