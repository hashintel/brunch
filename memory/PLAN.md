<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Demo walkthrough reset and seeded baseline** — wipe the local dev database, re-seed the canonical walkthrough scenarios, and turn the current demo weirdness into one explicit blocker matrix tied to named seeded states.
   - Why now / unlocks: the app has accumulated remodeling across workflow, interaction, and fixture seams; a clean seeded baseline is the fastest way to stop debugging ghost state and gives every follow-on demo slice a repeatable inspection loop.
   - What this slice must accomplish:
     - standardize the reset loop around `.brunch/brunch.db` and the walkthrough scenarios in `docs/praxis/manual-testing.md`
     - verify the most demo-relevant states after reseed: `issue-tracker-requirements-ready`, `issue-tracker-criteria-ready`, and `issue-tracker-all-phases-closed`
     - capture the current visible failures as scenario-scoped demo blockers rather than one blended "weirdness" bucket
     - confirm whether any remaining problems come from stale seeded data versus current projection logic

2. **Distinct review-phase UI for requirements and acceptance criteria** — stop rendering review phases as ordinary interview questions and project them as synthesized set-review surfaces owned by the review seam.
   - Why now / unlocks: this is the clearest demo-visible mismatch between the current product model and the current UI; fixing it makes requirements/criteria understandable and exposes the remaining transition bugs more honestly.
   - Traceability: D90, D93, A52.
   - What this slice must accomplish:
     - make the active requirements/criteria frontier read as a set review, not a generic question turn that happens to have two options
     - show the current requirement / criterion set, stable reference codes, and current review status as the primary content of the frontier card
     - keep the lightweight review contract: explicit `accept review` / `request changes` plus one review note
     - ensure hydrated seeded turns and live turns render through the same review-specific surface
     - remove any remaining UI dependence on older per-item micro-question assumptions for full-set review

3. **Phase transition and handoff stabilization for demo flows** — make every seeded demo phase end in a legible next action, with no empty shells or stranded in-progress states.
   - Why now / unlocks: once review phases render correctly, the next most obvious demo failures are inert handoffs, ambiguous closure states, and missing export/continue affordances.
   - Traceability: D94, D100, D101, D104.
   - What this slice must accomplish:
     - requirements acceptance advances cleanly into criteria kickoff without dead air
     - criteria acceptance closes into a visible workflow-complete/export-ready state
     - closed phases show explicit handoff / completion artifacts instead of relying on the generic shell to imply what happened
     - force-close and proposed-close confirmations stay legible and do not leave stale active-phase projections behind

4. **Transcript fidelity stabilization for seeded demo states** — make replayed interview history trustworthy enough that the demo reads like one coherent workspace instead of a partial hydration.
   - Why now / unlocks: after review and transition fixes, the remaining trust gap is transcript coherence; the demo needs previous assistant moves, summaries, and turn-owned activity to survive reload and navigation.
   - Traceability: D92, D93, D96, A53, A55.
   - What this slice must accomplish:
     - preserve the assistant-side shape that matters for the walkthrough: prior prompts, review framing, summaries, and turn-owned activity placeholders
     - keep phase filtering compatible with the richer replay so each phase route still reads cleanly
     - eliminate cases where the transcript implies a freeform chat model while the actual interaction is card-owned

## Next

1. **Router/query ownership refinement for interview surfaces** — replace coarse route-wide invalidation with deliberate loader/query ownership once the demo-visible projection bugs stop masking the actual invalidation problems.
   - Why now / unlocks: the current ownership work is still valuable, but it is no longer the fastest route to a convincing demo; defer until the review/transition/transcript surfaces are trustworthy enough to optimize.

2. **Interview workflow transition extraction from `app.ts`** — move phase-confirmation, review accept-to-close, successor-frontier creation, and observer-scheduling policy into a smaller deep module with a narrow command/result seam, leaving `app.ts` as transport composition.
   - Why now / unlocks: once the demo path is stable, extracting the workflow seam will make future interaction families and ownership refinements cheaper, safer, and easier to test in isolation.
   - What this slice must accomplish:
     - separate HTTP/SSE transport concerns from workflow policy so `app.ts` stops owning phase-progression semantics directly
     - unify the transition rules for the four advancement paths: ordinary answered frontier turns, full-set review accept-to-close, proposed phase-closure confirmation, and force-close
     - preserve the frontier invariant explicitly: open phases bottom out in one actionable frontier or visible generation state, successor turns appear without dead gaps, and next-phase kickoff creation stays coupled to confirmed closure
     - centralize observer scheduling and attachment policy so late observer results remain turn-owned and future interaction families do not each invent their own observer timing rules
     - give future interaction work one place to add new semantics instead of growing route-handler branches
     - make workflow behavior testable as a deep module with focused command/result cases instead of forcing every transition change through `app.test.ts` and full stream orchestration

## Horizon

- **Interaction-semantics hardening bundle** — retire remaining incidental UI coupling in a small follow-on bundle: encode full-set review semantics directly on review options/tool payloads instead of deriving `reviewAction` from option ordering, and clean up any remaining control-marker or transcript affordances that still infer semantics from presentation copy.
- **Output route and markdown export refinement** — conditional route available when all phases are closed, with accepted review outputs projected into markdown export (D101).
- **Close Phase confirmation modal** — modal UX for the Close Phase button with readiness/turn-count context and closeability gating (D104); review phases may stay on their lighter accept-to-close path.
- **Workflow projector extraction** — refactor `getCurrentWorkflowState()` into a pure projector over a `WorkflowSnapshot` struct. Independent lane.
- **Remove `cwd` from spec record, make workspace implicit**.
- **Legacy knowledge facade cleanup** — drop dead schema tables, collapse legacy types into kind-discriminated `KnowledgeItem`.
- **Project → specification physical DB rename** — Depends on: legacy knowledge cleanup.
- **Grounding-card transcript primitive** — add visible provisional grounding cards with optional comment + continue semantics, keeping card content non-durable while allowing user reactions to feed later knowledge capture.
- **Brownfield workspace-analysis grounding brief** — use read-only workspace analysis to produce the first visible grounding card, then hand off into the first substantive grounding question.
- **Reusable interviewer-invoked context gathering beyond opening grounding** — defer until opening brownfield brief proves the card/provenance model.
- **Dashboard/result summaries and completeness metrics** — post-interview surface.
- **Edit mode + cascade preview** — revisit affordance after interview-surface refinement settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on.
- **Drizzle Kit audit remediation** — independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes**.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-16 — **Transcript parity for existing turn families** — persisted assistant-side replay now stores concise activity summaries instead of raw reasoning/tool parts, hydrated answered/frontier cards reuse the same activity-placeholder family as live transcript updates, and route invalidation no longer needs generic placeholder fallbacks for existing turn families. Done: `npm run verify`. Watch: manual reload / invalidation walkthrough still outstanding.
- 2026-04-16 — **DrawerCard-based question card family and generating-turn placeholder** — ordinary interview turns now render through dedicated question-card components: compact answered cards, expanded active cards, inline activity placeholders, and a skeleton-backed generating-turn placeholder, replacing the older generic turn-card treatment for question-turn replay and in-flight generation.
- 2026-04-16 — **Specification-first creation and workspace-owned grounding kickoff** — new-spec creation now asks only for the specification name, the grounding strategy choice moved into the grounding kickoff inside the workspace, and touched entry/workspace copy now uses specification/workspace language while internal `project` identifiers remain unchanged.
- 2026-04-16 — **Frontier lifecycle skeleton across open phases** — the open-phase seam now bottoms out in fixed kickoff turns, visible generation states, same-turn review accept-to-close progression, and exceptional recovery turns, closing the no-dead-state frontier tracked under D94.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
demo-walkthrough-reset-and-seeded-baseline
  ├──→ distinct-review-phase-ui-for-requirements-and-acceptance-criteria
  ├──→ phase-transition-and-handoff-stabilization-for-demo-flows
  └──→ transcript-fidelity-stabilization-for-seeded-demo-states

distinct-review-phase-ui-for-requirements-and-acceptance-criteria
  └──→ phase-transition-and-handoff-stabilization-for-demo-flows

phase-transition-and-handoff-stabilization-for-demo-flows
  └──→ router-query-ownership-refinement-for-interview-surfaces

interview-workflow-transition-extraction-from-app-ts
  └──→ grounding-card-transcript-primitive

grounding-card-transcript-primitive
  └──→ brownfield-workspace-analysis-grounding-brief
```
