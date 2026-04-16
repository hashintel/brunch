<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Frontier lifecycle skeleton across open phases** — establish the universal no-dead-state turn lifecycle: fixed kickoff turns for newly opened phases, visible generating-frontier states while successor turns are created, and exceptional recovery turns only when frontier continuity breaks.
   - Why now / unlocks: this is the new structural center from `memory/SPEC.md` (D94). It replaces the old auto-trigger workaround, guarantees a next visible action now that the raw composer is gone, and is the prerequisite for lightweight review and future grounding-card work.

2. **Specification-first creation and workspace terminology adoption** — root creation asks only for the specification name, and touched product surfaces start distinguishing workspace vs specification while internal `project` identifiers remain unchanged.
   - Why now / unlocks: this establishes D82, D96, and D97 at the entry seam so grounding strategy can move into the workspace honestly instead of mutating a premature root-modal choice.

## Next

1. **Grounding strategy selection inside the workspace kickoff flow** — the first grounding move chooses elicitation-first vs analysis-first from the workspace-owned kickoff/frontier seam instead of in the root modal.
   - Why now / unlocks: once creation is specification-first and kickoff turns are real, grounding can own its opening move inside one interaction family.

2. **Grounding-card transcript primitive** — add visible provisional grounding cards with optional comment + continue semantics, keeping card content non-durable while allowing user reactions to feed later knowledge capture.
   - Why now / unlocks: this is the next distinct turn-card family after kickoff/question/review and is required for brownfield grounding briefs and reusable context gathering.

3. **Brownfield workspace-analysis grounding brief** — use read-only workspace analysis to produce the first visible grounding card, then hand off into the first substantive grounding question.
   - Why now / unlocks: this lands analysis-first grounding on top of the revised kickoff/card/provenance model without yet solving the full reusable context-gathering loop.

4. **Router/query ownership refinement for interview surfaces** — replace coarse route-wide invalidation with deliberate loader/query ownership after the revised frontier lifecycle settles.
   - Why now / unlocks: refresh pain should be judged against the new kickoff/generation/recovery model before investing in narrower ownership seams.

5. **Rich replay treatment for kickoff, review, observer progress, and grounding-card detail** — once the turn lifecycle and grounding-card primitives stabilize, make replay components visually match their live counterparts more closely.
   - Why now / unlocks: transcript trust depends on carrying fixed kickoff turns, review outcomes, and provisional grounding artifacts legibly through hydration.

## Horizon

- **Output route and markdown export refinement** — conditional route available when all phases are closed, with accepted review outputs projected into markdown export (D100).
- **Close Phase confirmation modal** — modal UX for the Close Phase button with readiness/turn-count context and closeability gating (D103); review phases may stay on their lighter accept-to-close path.
- **Workflow projector extraction** — refactor `getCurrentWorkflowState()` into a pure projector over a `WorkflowSnapshot` struct. Independent lane.
- **Remove `cwd` from spec record, make workspace implicit** — Depends on: specification-first creation.
- **Legacy knowledge facade cleanup** — drop dead schema tables, collapse legacy types into kind-discriminated `KnowledgeItem`.
- **Project → specification physical DB rename** — Depends on: legacy knowledge cleanup, specification-first creation.
- **Reusable interviewer-invoked context gathering beyond opening grounding** — defer until opening brownfield brief proves the card/provenance model.
- **Dashboard/result summaries and completeness metrics** — post-interview surface.
- **Edit mode + cascade preview** — revisit affordance after interview-surface refinement settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on.
- **Drizzle Kit audit remediation** — independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes**.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-16 — **Criteria review accept-to-close wiring** — accepting the criteria full-set review now marks the presented criterion set approved, closes criteria on the same durable turn, makes the workflow output-ready, and suppresses the stale review text from being forwarded into chat after workflow completion.
- 2026-04-16 — **Lightweight review turn v1 across requirements + criteria** — both review phases now use full-set review turns with stable item reference codes, one review note, explicit `Accept review` / `Request changes` actions, and accept-to-close progression into the next kickoff/output frontier.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
frontier-lifecycle-skeleton-across-open-phases
  ├──→ grounding-strategy-selection-inside-the-workspace-kickoff-flow
  ├──→ grounding-card-transcript-primitive
  ├──→ router-query-ownership-refinement-for-interview-surfaces
  └──→ rich-replay-treatment-for-kickoff-review-observer-progress-and-grounding-card-detail

specification-first-creation-and-workspace-terminology-adoption
  └──→ grounding-strategy-selection-inside-the-workspace-kickoff-flow

grounding-strategy-selection-inside-the-workspace-kickoff-flow
  └──→ brownfield-workspace-analysis-grounding-brief

grounding-card-transcript-primitive
  ├──→ brownfield-workspace-analysis-grounding-brief
  └──→ rich-replay-treatment-for-kickoff-review-observer-progress-and-grounding-card-detail
```