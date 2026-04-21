<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The naming/ownership cleanup is retired. The plan now runs two parallel tracks: **interaction model** (product-priority) and **architecture/layout** (structural). The interaction-model track is prioritized because it reshapes the user-facing grounding, review, and data-freshness experience without depending on the continuous workspace migration. The architecture track proceeds independently around completion surfaces and cumulative workspace ownership.

Key insight from dependency analysis: grounding free-text (D115), hint-guided prompts (D120), turn-internal grounding cards (D117), review per-item commenting (D118/D119), and query domain design (D121) do NOT depend on continuous workspace — they touch schema, prompts, turn data model, and card rendering, not center-pane layout. The only real shared structural prerequisite for multi-artifact turns (grounding card + question, revision card + review set) is a multi-part turn rendering seam, not the continuous workspace.

## Active

### Track A — Interaction model (product priority)

1. **Grounding free-text question format with hint-guided prompts** — bounded feature `[status: done]`
   - Objective: grounding questions use an open free-text format (question + why + response note) instead of option selection, and the grounding system prompt uses a hint-guided priority-ordered topic list with example question shapes instead of generating questions from scratch.
   - Why now / unlocks: this is the highest-impact product change — it reshapes every grounding session. Schema, prompt, and response seams are independent of center-pane layout.
   - Acceptance: `structuredQuestionSchema` accepts grounding questions without required options (phase-aware variant or discriminated response mode, not weakening the global schema); the grounding system prompt produces open exploratory questions from a topic list; the response schema and UI accept `freeText`-only submissions; elicitation and later phases still require options; observer captures from grounding turns correctly.
   - Verification: `npm run verify` plus manual greenfield grounding walkthrough confirming open questions, free-text response, hint-guided question quality, and correct observer capture.
   - Traceability: D115, D120; A59, A63; Requirements 4, 27.

2. **Homepage workspace binding** — bounded feature `[status: done]`
   - Objective: the root route surfaces workspace (CWD) identity so the user understands that listed specifications and the "new specification" affordance are scoped to the current project directory.
   - Why now / unlocks: trivially small, independent, and immediately improves orientation. No dependencies.
   - Acceptance: the homepage shows workspace path context, the spec list is framed as "Specifications in this workspace", and the empty state reinforces workspace scoping.
   - Verification: `npm run verify` plus visual check on the homepage.
   - Traceability: D122; Requirement 26.

### Track B — Architecture / completion surfaces

3. **Output route and markdown export refinement** — bounded feature `[status: not-started]`
   - Objective: make the output route, preview, and markdown export truthful and legible under the canonical specification terminology.
   - Why now / unlocks: export is the clearest user-visible completion seam after the naming cutover.
   - Acceptance: the output route, preview, and markdown export present accepted review outputs cleanly and remain available only when all interview phases are closed.
   - Verification: `npm run verify` plus a manual export walkthrough on a completed seeded specification.
   - Traceability: D101; I24, I87, I104.

4. **Close Phase confirmation modal** — bounded feature `[status: not-started]`
   - Objective: complete the remaining phase-exit UX by showing a confirmation modal with readiness/turn-count context before closing in-progress non-review phases.
   - Why now / unlocks: makes closure intent explicit before workflow extraction.
   - Acceptance: in-progress non-review phases show a confirmation modal with readiness/turn-count context and gating that matches closeability rules.
   - Verification: `npm run verify` plus manual close/reject/confirm walkthroughs on grounding and elicitation phases.
   - Traceability: D104, D65, D66; I72.

## Next

### Track A — Interaction model (continued)

1. ~~**Multi-part turn rendering seam**~~ `[done]` — structural prerequisite for both turn-internal grounding cards and review revision cards.
   - Traceability: A61; D117, D119; Requirements 4, 25.

2. **Turn-internal grounding cards** — grounding cards render within the same turn as their paired question card.
   - Why now / unlocks: once the multi-part turn seam and free-text format are in place, grounding cards become the enabling primitive for analysis-first grounding. The observer captures one validated unit (grounding context + question + user response).
   - Traceability: D83, D89, D91, D99, D112, D117; A56, A61; Requirements 20, 21, 28; I24, I54, I101, I104.

3. **Review per-item commenting and regeneration** — add per-item comment toggles, structured change-request payload, iterative regeneration, and revision cards.
   - Why now / unlocks: once the multi-part turn seam exists, revision cards can stack above review sets using the same pattern as grounding cards above questions. Independent of grounding work.
   - Traceability: D90, D118, D119; A61, A62; Requirements 11, 12, 25.

4. **Phase section headers** — orient each realized phase section without persisting extra turns.
   - Why now / unlocks: small projected-artifact addition. Can land any time after free-text grounding settles.
   - Traceability: D116; A60; Requirement 24.

5. **Brownfield workspace-analysis grounding brief** — first analysis-first grounding path using turn-internal grounding cards.
   - Why now / unlocks: proves the turn-internal grounding-card seam against real brownfield repos.
   - Traceability: D32, D83, D99, D117, D120; A47, A56; I101.

6. **Reusable interviewer-invoked context gathering** — generalize context gathering beyond opening grounding.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model.
   - Traceability: D99, D30, D32, D83, D117; I101, I104.

### Track A — Query ownership

7. **Granular query domain design** — design the TanStack Query decomposition (query hook count, shapes, invalidation targets).
   - Why now / unlocks: can proceed now since the current pain (scroll jank from `router.invalidate()`) is already visible. Design pass before implementation prevents churn.
   - Traceability: D121; A64.

8. **Granular query domain implementation** — migrate from coarse `router.invalidate()` to independently invalidable query domains.
   - Why now / unlocks: implements the designed decomposition. Best sequenced after interaction-model seams settle to avoid query-key churn.
   - Traceability: D87, D121; A20, A50, A64; I24, I54, I102.

### Track B — Architecture / layout (continued)

9. **Workflow ownership extraction** — extract projector and `app.ts` workflow ownership.
    - Why now / unlocks: architectural cleanup prerequisite for continuous workspace. Does not gate interaction-model work.
    - Traceability: D110, D112, D113; I24, I72, I104.

10. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation.
    - Why now / unlocks: depends on workflow extraction. Once in place, phase section headers fit more naturally.
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

- [2026-04-21] Multi-part turn rendering seam — Done: `answered-grounding-question` and `persisted-grounding-question` artifact kinds in workspace stream projector; stacked rendering in transcript artifacts; question numbering includes stacked turns. Verified: `npm run verify` (490 tests). Watch: manual brownfield walkthrough to confirm stacked grounding-card + question renders live and on replay.
- [2026-04-21] Homepage workspace binding — Done: homepage heading shows workspace name + full path, populated list framed with "Specifications in this workspace", empty state references workspace name. Verified: `npm run verify`. Watch: visual check on populated and empty homepage states.
- [2026-04-20] Alias deletion retired the naming frontier — Done: removed the remaining `/api/projects/...` compatibility entry points and deleted shared/server `project` alias seams from the happy path. Verified: `npm run verify`. Watch: freshly reseeded manual resume/export walkthrough still matters after the destructive cut.
- [2026-04-20] Specification routes moved to canonical ownership — Done: routed workspace/export entry now flows through `/specification/...`, and client fetch/mutation seams now target `/api/specifications/...` on the happy path. Verified: `npm run verify`. Watch: none.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Interaction model (product priority)
grounding-free-text-with-hint-guided-prompts  ✅ done
  └──→ multi-part-turn-rendering-seam  ✅ done
        ├──→ turn-internal-grounding-cards
        │     └──→ brownfield-workspace-analysis-grounding-brief
        │           └──→ reusable-context-gathering
        └──→ review-per-item-commenting-and-regeneration

phase-section-headers  (after grounding-free-text ✅; no other blockers)
homepage-workspace-binding  ✅ done

granular-query-domain-design  (no blockers)
  └──→ granular-query-domain-implementation  (after interaction-model seams settle)

TRACK B — Architecture / layout
output-route-and-markdown-export-refinement  (active; no blockers)
  └──→ close-phase-confirmation-modal
        └──→ workflow-ownership-extraction
              └──→ continuous-workspace-phase-addressable-interview-surface
```
