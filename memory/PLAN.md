<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The naming/ownership cleanup is retired. The plan now runs two parallel tracks: **interaction model** (product-priority) and **architecture/layout** (structural). The interaction-model track is prioritized because it reshapes the user-facing grounding, review, and data-freshness experience without depending on the continuous workspace migration. The architecture track proceeds independently around completion surfaces and cumulative workspace ownership.

Key insight from dependency analysis: grounding free-text (D115), hint-guided prompts (D120), turn-internal grounding cards (D117), review per-item commenting (D118/D119), and query domain design (D121) do NOT depend on continuous workspace — they touch schema, prompts, turn data model, and card rendering, not center-pane layout. The only real shared structural prerequisite for multi-artifact turns (grounding card + question, revision card + review set) is a multi-part turn rendering seam, not the continuous workspace.

## Active

### Track A — Interaction model

1. **Brownfield workspace-analysis grounding brief** — first analysis-first grounding path using turn-internal grounding cards.
   - Why now / unlocks: proves the turn-internal grounding-card seam against real brownfield repos. Turn-internal grounding cards are done and unblocked.
   - Traceability: D32, D83, D99, D117, D120; A47, A56; I101.

2. **Reusable interviewer-invoked context gathering** — generalize context gathering beyond opening grounding.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model.
   - Traceability: D99, D30, D32, D83, D117; I101, I104.

## Next

### Track A — Query ownership

1. **Granular query domain implementation** — migrate from coarse `router.invalidate()` to independently invalidable query domains.
   - Why now / unlocks: design document is done (`docs/query-domain-design.md`). Best sequenced after interaction-model seams settle to avoid query-key churn.
   - Traceability: D87, D121; A20, A50, A64; I24, I54, I102.

### Track B — Architecture / layout

2. **Workflow ownership extraction** — extract projector and `app.ts` workflow ownership.
    - Why now / unlocks: architectural cleanup prerequisite for continuous workspace. Does not gate interaction-model work.
    - Traceability: D110, D112, D113; I24, I72, I104.

3. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation.
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

- Drizzle Kit audit remediation.
- Git-friendly file-based persistence representation for diffable specs.
- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.

## Recently Completed

- [2026-04-21] Review per-item commenting and regeneration — Done: per-item comment toggles on review set items, structured `itemComments` in submission payload, interviewer context includes per-item comments for successor review turns, version badges (v1, v2, …) on active and answered review sets, revision cards stacked above successor review sets showing change summary, and prior revision collapsing (superseded reviews render as compact summaries). Verified: `npm run verify`. Scope cards in `memory/CARDS_TRACK_A.md`.
- [2026-04-21] Turn-internal grounding cards — Done: brownfield grounding turns produce both a grounding card and a question card within one turn lifecycle, observer captures the full validated unit, interviewer context renders stacked turns. Verified: `npm run verify`.
- [2026-04-21] Close Phase confirmation modal — Done: in-progress grounding and elicitation phases open a confirmation modal with readiness and turn-count context before user-forced close.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Interaction model
brownfield-workspace-analysis-grounding-brief  (active; unblocked — turn-internal grounding cards done)
  └──→ reusable-context-gathering

granular-query-domain-implementation  (design done; after interaction-model seams settle)

TRACK B — Architecture / layout
workflow-ownership-extraction
  └──→ continuous-workspace-phase-addressable-interview-surface
```
