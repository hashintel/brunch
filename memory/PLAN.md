<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The naming/ownership cleanup is retired. The plan now runs two parallel tracks: **interaction model** (product-priority) and **architecture/layout** (structural). The interaction-model track is prioritized because it reshapes the user-facing grounding, review, and data-freshness experience without depending on the continuous workspace migration. The architecture track proceeds independently around completion surfaces and cumulative workspace ownership.

Key insight from dependency analysis: grounding free-text (D115), hint-guided prompts (D120), turn-internal grounding cards (D117), review per-item commenting (D118/D119), and query domain design (D121) do NOT depend on continuous workspace — they touch schema, prompts, turn data model, and card rendering, not center-pane layout. The only real shared structural prerequisite for multi-artifact turns (grounding card + question, revision card + review set) is a multi-part turn rendering seam, not the continuous workspace.

## Active

### Track A — Interaction model

1. **Turn-internal grounding cards** — grounding cards render within the same turn as their paired question card.
   - Why now / unlocks: multi-part turn seam and free-text format are done; grounding cards become the enabling primitive for analysis-first grounding. The observer captures one validated unit (grounding context + question + user response).
   - Traceability: D83, D89, D91, D99, D112, D117; A56, A61; Requirements 20, 21, 28; I24, I54, I101, I104.

2. **Review per-item commenting and regeneration** — add per-item comment toggles, structured change-request payload, iterative regeneration, and revision cards.
   - Why now / unlocks: multi-part turn seam exists; revision cards can stack above review sets using the same pattern as grounding cards above questions. Independent of grounding work.
   - Traceability: D90, D118, D119; A61, A62; Requirements 11, 12, 25.

### Track B — Architecture / completion surfaces

3. **Close Phase confirmation modal** — bounded feature `[status: not-started]`
   - Objective: complete the remaining phase-exit UX by showing a confirmation modal with readiness/turn-count context before closing in-progress non-review phases.
   - Why now / unlocks: makes closure intent explicit before workflow extraction.
   - Acceptance: in-progress non-review phases show a confirmation modal with readiness/turn-count context and gating that matches closeability rules.
   - Verification: `npm run verify` plus manual close/reject/confirm walkthroughs on grounding and elicitation phases.
   - Traceability: D104, D65, D66; I72.

## Next

### Track A — Interaction model (continued)

1. **Brownfield workspace-analysis grounding brief** — first analysis-first grounding path using turn-internal grounding cards.
   - Why now / unlocks: proves the turn-internal grounding-card seam against real brownfield repos.
   - Traceability: D32, D83, D99, D117, D120; A47, A56; I101.

2. **Reusable interviewer-invoked context gathering** — generalize context gathering beyond opening grounding.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model.
   - Traceability: D99, D30, D32, D83, D117; I101, I104.

### Track A — Query ownership

3. **Granular query domain implementation** — migrate from coarse `router.invalidate()` to independently invalidable query domains.
   - Why now / unlocks: design document is done (`docs/query-domain-design.md`). Best sequenced after interaction-model seams settle to avoid query-key churn.
   - Traceability: D87, D121; A20, A50, A64; I24, I54, I102.

### Track B — Architecture / layout (continued)

4. **Workflow ownership extraction** — extract projector and `app.ts` workflow ownership.
    - Why now / unlocks: architectural cleanup prerequisite for continuous workspace. Does not gate interaction-model work.
    - Traceability: D110, D112, D113; I24, I72, I104.

5. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation.
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

- [2026-04-21] Output route and markdown export refinement — Done: closed specs land on output route, markdown export foregrounds accepted review outputs in canonical order, output preview uses readable presentation with specification terminology. Verified: `npm run verify`.
- [2026-04-21] Phase section headers — Done: projected `phase-section-header` artifact at top of each realized phase section with phase-specific copy. Verified: `npm run verify`.
- [2026-04-21] Granular query domain design — Done: design document at `docs/query-domain-design.md` specifying query key taxonomy, hook signatures, invalidation triggers, and router loader reduction.
- [2026-04-21] Multi-part turn rendering seam — Done: `answered-grounding-question` and `persisted-grounding-question` artifact kinds; stacked rendering; question numbering includes stacked turns. Verified: `npm run verify`. Watch: manual brownfield walkthrough.
- [2026-04-21] Homepage workspace binding — Done: workspace name + path on homepage. Verified: `npm run verify`.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Interaction model
turn-internal-grounding-cards  (active; unblocked)
  └──→ brownfield-workspace-analysis-grounding-brief
        └──→ reusable-context-gathering
review-per-item-commenting-and-regeneration  (active; unblocked; independent of grounding)

granular-query-domain-implementation  (design done; after interaction-model seams settle)

TRACK B — Architecture / layout
close-phase-confirmation-modal  (active; no blockers)
  └──→ workflow-ownership-extraction
        └──→ continuous-workspace-phase-addressable-interview-surface
```
