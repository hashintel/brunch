<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Specification-first creation and workspace terminology adoption** — root creation asks only for the specification name, and touched product surfaces start distinguishing workspace vs specification while internal `project` identifiers remain unchanged.
   - Why now / unlocks: this establishes D82, D96, and D97 at the entry seam so grounding strategy can move into the workspace honestly instead of mutating a premature root-modal choice.

2. **Interview workflow transition extraction from `app.ts`** — move phase-confirmation, review accept-to-close, successor-frontier creation, and observer-scheduling policy into a smaller deep module with a narrow command/result seam, leaving `app.ts` as transport composition.
   - Why now / unlocks: the frontier/review/closure model is now rich enough that every new interaction family risks deepening the `app.ts` monolith. Extracting the workflow seam now makes grounding-card and kickoff-follow-on work cheaper, safer, and easier to test in isolation.
   - What this slice must accomplish:
     - separate HTTP/SSE transport concerns from workflow policy so `app.ts` stops owning phase-progression semantics directly
     - unify the transition rules for the four advancement paths: ordinary answered frontier turns, full-set review accept-to-close, proposed phase-closure confirmation, and force-close
     - preserve the frontier invariant explicitly: open phases bottom out in one actionable frontier or visible generation state, successor turns appear without dead gaps, and next-phase kickoff creation stays coupled to confirmed closure
     - centralize observer scheduling and attachment policy so late observer results remain turn-owned and future interaction families do not each invent their own observer timing rules
     - give upcoming grounding work (workspace-owned strategy choice, grounding cards, brownfield analysis brief) one place to add new interaction semantics instead of growing route-handler branches
     - make workflow behavior testable as a deep module with focused command/result cases instead of forcing every transition change through `app.test.ts` and full stream orchestration

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

- **Interaction-semantics hardening bundle** — retire remaining incidental UI coupling in a small follow-on bundle: encode full-set review semantics directly on review options/tool payloads instead of deriving `reviewAction` from option ordering, and clean up any remaining control-marker or transcript affordances that still infer semantics from presentation copy.
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

- 2026-04-16 — **Frontier lifecycle skeleton across open phases** — the open-phase seam now bottoms out in fixed kickoff turns, visible generation states, same-turn review accept-to-close progression, and exceptional recovery turns, closing the no-dead-state frontier tracked under D94.
- 2026-04-16 — **Persist explicit full-set review actions through response + fixture seams** — requirements/criteria review submissions now carry explicit persisted `reviewAction` semantics, server acceptance no longer depends on option copy, client review submissions include the action in transport, and manifest/corpus/synthetic fixture seams round-trip the full-set review action without modeling per-item review turns as the user interaction.
- 2026-04-16 — **Persist frontier turn kinds for kickoff and recovery** — open-phase frontier turns now carry explicit persisted `turn_kind` semantics (`question` / `kickoff` / `recovery`), and controller/view projection no longer depends on `why` sentinels to classify kickoff vs recovery cards.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
specification-first-creation-and-workspace-terminology-adoption
  └──→ grounding-strategy-selection-inside-the-workspace-kickoff-flow

interview-workflow-transition-extraction-from-app-ts
  ├──→ grounding-strategy-selection-inside-the-workspace-kickoff-flow
  └──→ grounding-card-transcript-primitive

grounding-strategy-selection-inside-the-workspace-kickoff-flow
  └──→ brownfield-workspace-analysis-grounding-brief

grounding-card-transcript-primitive
  ├──→ brownfield-workspace-analysis-grounding-brief
  └──→ rich-replay-treatment-for-kickoff-review-observer-progress-and-grounding-card-detail
```