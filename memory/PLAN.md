<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Story-first turn-card refinement** — now that grounding cards, question cards, and workspace-owned phase entry are the target interaction family, refine them first in `src/client/stories/` instead of discovering them inside routed code.
   - Why now / unlocks: the grounding redesign changes the card family itself; stabilizing shapes in stories keeps routed work from inventing around moving semantics.

2. **Review-set implementation across requirements + criteria** — replace repeated micro-interview review turns with synthesized per-item approve / reject / comment lists plus list-level confirmation.
   - Why now / unlocks: the product model for grounding/design is becoming turn-card based while review remains list-based; landing review sets keeps that separation clean.

3. **Specification-first creation and workspace terminology adoption** — root creation asks only for the specification name, and touched product surfaces start distinguishing workspace vs specification while internal `project` identifiers remain unchanged.
   - Why now / unlocks: this establishes D82, D96, and D97 at the entry seam so grounding strategy can move into the workspace honestly instead of mutating a premature root-modal choice.

4. **Grounding strategy selection inside the workspace** — the first grounding move chooses elicitation-first vs analysis-first in the workspace-owned turn flow instead of in the root modal.
   - Why now / unlocks: once creation is specification-first, the actual grounding phase can own its opening move and converge both strategies inside one interaction family.

5. **Grounding-card transcript primitive** — add visible provisional grounding cards with optional comment + continue semantics, keeping card content non-durable while allowing user reactions to feed later knowledge capture.
   - Why now / unlocks: this is the core interaction seam required for brownfield grounding briefs and later interviewer-invoked context gathering.

6. **Brownfield workspace-analysis grounding brief** — use read-only workspace analysis to produce the first visible grounding card, then hand off into the first substantive grounding question.
   - Why now / unlocks: this lands analysis-first grounding on top of the new card/provenance model without yet solving the full reusable context-gathering loop.

## Next

1. **Router/query ownership refinement for interview surfaces** — replace coarse route-wide invalidation with deliberate loader/query ownership.
   - Why now / unlocks: still important, but keep it narrow until the new grounding-card flow settles and refresh pain can be judged against the revised interaction family.

2. **Reusable interviewer-invoked context gathering beyond opening grounding** — allow the interviewer to insert later workspace-analysis or research grounding cards when the next move needs more context.
   - Why now / unlocks: the spec now treats context gathering as reusable capability, but defer generalization until the opening brownfield brief proves the card/provenance model.

3. **Rich replay treatment for collapsed reasoning, observer progress, and grounding-card detail** — once the turn lifecycle and grounding-card primitives stabilize, make replay components visually match their live counterparts more closely, including collapsible detail where needed.
   - Why now / unlocks: transcript trust is now about more than answered questions; replay has to carry provisional grounding artifacts legibly too.

4. **Dashboard/result summaries and completeness metrics** — once workflow entry, grounding, review, and transcript trust are no longer masking basic usability.
   - Why now / unlocks: promote this now so the post-interview surface can follow close behind the grounding redesign instead of getting stranded in the long tail.

## Horizon

- **Edit mode + cascade preview** — revisit affordance after the current interview-surface refinement wave settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on after preview-only revisit is stable.
- **Drizzle Kit audit remediation** — independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes**.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-14 — **Turn-owned captured-item projection and trailing observer attachment** — Done: answered turns now list their actual captured knowledge with stable server-owned reference codes that match the sidebar, and late observer completion stays attached to the collapsed answered card until durable capture hydrates in place. Verified: `npm run verify`. Watch: story-first interaction refinement and browser-side dramaturgical review are still the next UX-facing follow-ons.
- 2026-04-14 — **Turn-owned submit/interviewer-processing choreography** — Done: active elicitation turns now stay mounted through submit, lock inline while the interviewer processes, and collapse only when the next step is ready to reveal; same-project refresh updates the submitted turn in place without rewriting earlier answered replay. Verified: `npm run verify`. Watch: manual browser review should still confirm the live pacing on seeded scenarios now that the capture seam is attached.
- 2026-04-14 — **Phase terminal staging and auto-present current turn** — Done: open phases now auto-initiate the current turn instead of bottoming out in `Begin/Continue`, answered-turn replay filters control and closure artifacts, and closed phases end with their handoff/completion card at the bottom of the transcript column. Verified: `npm run verify`. Watch: manual browser confirmation is still needed on `issue-tracker-kickoff-ready`, `issue-tracker-design-active`, `issue-tracker-scope-closed`, and `issue-tracker-all-phases-closed`.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
story-first-turn-card-refinement
  ├──→ review-set-implementation-across-requirements-and-criteria
  ├──→ grounding-card-transcript-primitive
  └──→ rich-replay-treatment-for-collapsed-reasoning-observer-progress-and-grounding-card-detail

specification-first-creation-and-workspace-terminology-adoption
  └──→ grounding-strategy-selection-inside-the-workspace

grounding-strategy-selection-inside-the-workspace
  └──→ brownfield-workspace-analysis-grounding-brief

grounding-card-transcript-primitive
  ├──→ brownfield-workspace-analysis-grounding-brief
  ├──→ reusable-interviewer-invoked-context-gathering-beyond-opening-grounding
  └──→ rich-replay-treatment-for-collapsed-reasoning-observer-progress-and-grounding-card-detail

router-query-ownership-refinement-for-interview-surfaces
  └──→ reusable-interviewer-invoked-context-gathering-beyond-opening-grounding if mid-turn refresh churn remains visible
```
