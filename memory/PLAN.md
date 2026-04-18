<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

Full-fidelity frontier. The demo shortcut period is over; the active burden is no longer "make the walkthrough legible" but "make the model truthful again." The codebase still speaks several overlapping product languages at once — status-filtered review pools, legacy scope/framing aliases, mixed knowledge facades, and multiple input families — so the frontier now prioritizes semantic and interaction-model recovery first. Demo-visible stabilization remains important, but only after the underlying seams stop lying.

## Active

1. **Distinct review-phase UI rebuilt on accepted-set authority** — rebuild requirements and criteria as review-specific surfaces after the authority cleanup, even if the old UI breaks in the meantime.
   - Why now / unlocks: once the old semantics are gone, the UI should fail loudly instead of masking mismatches. Rebuilding on top of the cleaned contract yields a much simpler and more honest review surface.
   - Traceability: D90, D93; A52; I87.
   - What this slice must accomplish:
     - make the active requirements / criteria frontier read as a synthesized set review, not a generic interview question card
     - show the current candidate set, stable reference codes, and the lightweight whole-set review seam (`accept review` / `request changes` + one authoritative note) without reintroducing per-item approval authority
     - preserve the richer shared `ReviewSetCard` structure, including future-facing per-item comment affordances, unless a later explicit design decision changes that boundary
     - make live and hydrated turns render through the same review-specific card family
     - remove remaining presentation assumptions that requirements / criteria are just another branch of the ordinary Q&A surface

2. **Framing kind retirement and canonical scope-kind normalization** — finish the migration away from `framing` as a scope kind and normalize writes into the canonical `goal` / `term` / `context` / `constraint` set.
   - Why now / unlocks: `framing` is still persisted, projected, and referenced in routes (`_view/framing.tsx`), shared schemas, fixtures, stories, and UI cards. Every new interaction family has to branch around it. Retiring it unblocks both the knowledge facade cleanup and the later naming normalization.
   - Traceability: D49, D68; A40; I48.
   - What this slice must accomplish:
     - remove `framing` from the canonical scope-kind enum and from observer output contracts
     - migrate existing persisted `framing` rows into the appropriate canonical kind (likely `context` or `goal` depending on provenance)
     - remove the `_view/framing.tsx` route surface and any framing-specific card / sidebar affordances
     - update fixtures, scenarios, tests, and stories to stop producing or asserting on `framing`

3. **Legacy knowledge facade cleanup** — drop the dead schema tables and collapse the remaining legacy types into the kind-discriminated `KnowledgeItem` model.
   - Why now / unlocks: D61 flagged the mixed legacy / generic knowledge storage as transitional; with `framing` retired, the target single-model shape is reachable. Finishing the facade cleanup removes a source of drift between persistence, the shared kind registry, the observer prompt, API types, fixtures, and the sidebar grouping that currently all describe the ontology slightly differently.
   - Traceability: Requirements 22, 23; D49, D50, D61, D105, D108, D109; I48, I54.
   - What this slice must accomplish:
     - drop dead schema tables left over from the pre-generic knowledge model
     - collapse legacy per-type entity collections into generic `KnowledgeItem` reads behind the existing typed projections
     - establish one canonical ontology contract for durable exploration knowledge (`goal`, `term`, `context`, `constraint`, `decision`, `assumption`), accepted-review requirements / criteria, and the `constraint` subtype `non-goal`
     - drive shared registries, observer prompt language, API types, fixtures, stories, and sidebar copy from that canonical ontology contract so kind language does not drift by layer
     - defer `feature` / `user story` as top-level durable kinds until the graph seam has explicit semantics that justify them
     - keep `EntitySidebar` grouping (D105) and stable per-kind reference codes (D49) working across the collapse
     - make Drizzle migrations explicit about the drop so the reseed path stays trustworthy

4. **Merged stream projector cutover: turns, anchored facts, and projected controls** — make the center column honest about artifact types by projecting it from active-path turns, anchored workflow facts, and projected control / activity / phase-marker elements instead of treating every visible card as a durable turn.
   - Why now / unlocks: D94 / D95 / D110 changed the conceptual model. As long as kickoff, recovery, and phase-boundary affordances still masquerade as ordinary turns, later UI cleanup keeps restabilizing the wrong abstraction. This slice establishes the runtime read-model seam the rest of the interaction cleanup can build on.
   - Traceability: D65, D93, D94, D95, D96, D110; A44, A51, A54; I24, I72.
   - What this slice must accomplish:
     - introduce an explicit workspace-stream projection model that can interleave durable conversational turns, anchored workflow facts, projected control cards, projected phase markers, and activity cards without requiring each artifact to be a turn row
     - stop using persisted kickoff / recovery turn kinds as product truth; kickoff and recovery should project from workflow state and durable conditions even if transitional storage still reuses turn fields internally
     - anchor phase-end projection to `phaseOutcome` records and define how start/end markers attach to nearby turns without joining the branch-bearing linked list
     - preserve the active-path invalidation rule: if an anchored non-turn fact points at a turn that falls off the trusted branch, that fact is superseded or hidden rather than left floating in the stream
     - keep hydration/resume truthful when a phase opens into entry state, recovery state, visible generation state, or closed-phase handoff state

5. **Interaction-family canonicalization: durable turn cards plus projected control cards** — finalize the workspace stream as the canonical interaction surface for user action, with durable turn cards for substantive elicitation, projected control cards for structural affordances, and no straggling alternative input seams.
   - Why now / unlocks: once the merged stream projector is honest about artifact types, the older kickoff-as-turn, one-shot brownfield ritual, and global bottom composer fallbacks can be removed without inventing another exception layer. This slice makes the new stream model the only real interaction contract.
   - Traceability: D89, D91, D95, D99, D110; A51, A54, A56; I24.
   - What this slice must accomplish:
     - remove the generic bottom composer as a canonical input path; any remaining uses become explicit debug / admin affordances or are deleted
     - replace persisted kickoff / recovery-as-turn assumptions with projected control-card seams derived from workflow state
     - fold the previous kickoff interaction family into the workspace stream so kickoff, grounding cards, question cards, review cards, and handoff controls share one coherent projection model without all becoming the same durable artifact type
     - retire the one-shot brownfield kickoff ritual in favor of reusable interviewer-invoked context gathering that produces grounding cards (D99)
     - confirm greenfield and brownfield grounding both enter through the workspace stream surface

6. **Phase transition and handoff stabilization on the cleaned model** — make every phase end in a legible next action, with no empty shells or stranded in-progress states, after review and input semantics stop fighting the projector.
   - Why now / unlocks: the remaining handoff bugs are real, but fixing them before the semantic cleanup would just restabilize the wrong model. Once review authority, ontology, and input seams are cleaned, transition work can become a straightforward projection pass instead of another exception layer.
   - Traceability: D94, D100, D101, D104; A54.
   - What this slice must accomplish:
     - requirements acceptance advances cleanly into criteria kickoff without dead air
     - criteria acceptance closes into a visible workflow-complete / export-ready state
     - closed phases show explicit handoff / completion artifacts instead of relying on the generic shell to imply what happened
     - force-close and proposed-close confirmations stay legible and do not leave stale active-phase projections behind

7. **Naming normalization: project → specification, scope → grounding, cwd removal** — align internal identifiers, route keys, and schema columns with the product vocabulary settled in D97 / D98.
   - Why now / unlocks: after the semantic, ontology, and interaction layers are clean, the naming drift is the last pervasive legacy burden. Doing it after the deeper model cleanup avoids rebase pain across the same files while still preventing new surfaces from inheriting the vocabulary split. This is the most invasive slice — it touches schema, routes, and API types — and should be planned as a sequence of safe commits.
   - Traceability: D97, D98; Horizon `project → specification physical DB rename`, Horizon `cwd removal`.
   - What this slice must accomplish:
     - rename `project` record / table / API identifier to `specification` (or the agreed internal name) with an explicit migration path
     - migrate the internal phase key from `scope` to `grounding`, or commit to keeping `scope` and document it as a permanent internal alias
     - remove `cwd` from the specification record and derive workspace path implicitly from the runtime context
     - update routes, loaders, fixtures, tests, and stories to match
     - manual verification after each commit in the sequence to catch silent breakage

## Next

1. **Transcript fidelity stabilization for seeded and resumed states** — make replayed interview history trustworthy enough that the workspace reads like one coherent thread instead of a partial hydration. Likely partially absorbed by slice 5; whatever remains after canonicalization lands here.
   - Traceability: D92, D93, D96; A53, A55.

2. **Interview workflow transition extraction from `app.ts`** — deferred by choice. Picks up after the retirement frontier lands, when the extraction is no longer competing with semantic cleanup for the same files.

3. **Router / query ownership refinement for interview surfaces** — deferred by choice. Replace coarse route-wide invalidation with deliberate loader / query ownership once the cleaned surfaces make the real invalidation boundaries legible.

## Horizon

- **Output route and markdown export refinement** — conditional route available when all phases are closed, with accepted review outputs projected into markdown export (D101).
- **Close Phase confirmation modal** — modal UX for the Close Phase button with readiness / turn-count context and closeability gating (D104); review phases may stay on their lighter accept-to-close path.
- **Workflow projector extraction** — refactor `getCurrentWorkflowState()` into a pure projector over a `WorkflowSnapshot` struct. Independent lane.
- **Grounding-card transcript primitive** — add visible provisional grounding cards with optional comment + continue semantics, keeping card content non-durable while allowing user reactions to feed later knowledge capture.
- **Brownfield workspace-analysis grounding brief** — use read-only workspace analysis to produce the first visible grounding card, then hand off into the first substantive grounding question.
- **Reusable interviewer-invoked context gathering beyond opening grounding** — defer until opening brownfield brief proves the card / provenance model.
- **Dashboard / result summaries and completeness metrics** — post-interview surface.
- **Edit mode + cascade preview** — revisit affordance after interview-surface refinement settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on.
- **Drizzle Kit audit remediation** — independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes**.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-18 — **Review-specific closed-phase completion cards** — closed requirements and criteria phases now render through `ReviewPhaseCompletionCard` in the routed interview view, so review closure states use review-specific handoff/export copy while non-review phases keep the generic closed-state shell. Done: `npm run verify`. Watch: Active item 1 still needs broader review-phase distinctness beyond the active and closed review presenters.
- 2026-04-18 — **Dedicated active review-turn presenter split** — active requirements and criteria frontier turns now render through a dedicated `ActiveReviewSetCard` path instead of the generic `ActiveQuestionCard`, while persisted active turns and streamed pending turns still submit the same whole-set review action payload and preserve the shared `ReviewSetCard` boundary. Done: `npm run verify`. Watch: Active item 1 still needs broader review-phase distinctness and later handoff/completion polish.
- 2026-04-18 — **Shared review-card route cutover with preserved card structure** — requirements and criteria review turns now render through the same `ReviewSetCard` path in both persisted and streamed pending states, while the richer shared card structure (stats and per-item comment affordances) remains intact even though review authority stays at the whole-set accept/request-changes seam. Done: `npm run verify`. Watch: Active item 1 still includes broader review-phase distinctness and later handoff/completion polish.
- 2026-04-18 — **Accepted-set authority cleanup and legacy review semantics retirement** — replaced `reviewStatus`-driven downstream behavior with accepted-set projections, removed review badges from the UI, rewired requirements / criteria review prompts and submission semantics around explicit full-set review actions, and updated seeded walkthrough fixtures so confirmed review sets replay through the same accepted-set seam used at runtime. Done: `npm run verify`.
- 2026-04-18 — **Explicit review-action payload seam for full-set review turns** — requirements and criteria review turns now carry explicit `reviewActions` metadata in the persisted tool payload, the submit path validates and persists the matching explicit `reviewAction`, targeted `requirementReview` / `criterionReview` turn metadata and per-item response writes are retired, and seeded review fixtures replay through the same contract. Done: `npm run verify`. Watch: accepted-set projection still depends on legacy `reviewStatus` reads until the next cleanup slice lands.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
accepted-set-authority-cleanup-and-legacy-review-semantics-retirement
  ├──→ distinct-review-phase-ui-rebuilt-on-accepted-set-authority
  └──→ phase-transition-and-handoff-stabilization-on-the-cleaned-model

distinct-review-phase-ui-rebuilt-on-accepted-set-authority
  └──→ phase-transition-and-handoff-stabilization-on-the-cleaned-model

framing-kind-retirement-and-canonical-scope-kind-normalization
  └──→ legacy-knowledge-facade-cleanup

legacy-knowledge-facade-cleanup
  └──→ merged-stream-projector-cutover-turns-anchored-facts-and-projected-controls
  └──→ naming-normalization-project-specification-scope-grounding-cwd-removal

merged-stream-projector-cutover-turns-anchored-facts-and-projected-controls
  └──→ interaction-family-canonicalization-durable-turn-cards-plus-projected-control-cards
  └──→ phase-transition-and-handoff-stabilization-on-the-cleaned-model

interaction-family-canonicalization-durable-turn-cards-plus-projected-control-cards
  └──→ phase-transition-and-handoff-stabilization-on-the-cleaned-model
  └──→ naming-normalization-project-specification-scope-grounding-cwd-removal

phase-transition-and-handoff-stabilization-on-the-cleaned-model
  └──→ naming-normalization-project-specification-scope-grounding-cwd-removal

naming-normalization-project-specification-scope-grounding-cwd-removal
  └──→ transcript-fidelity-stabilization-for-seeded-and-resumed-states (Next)
  └──→ interview-workflow-transition-extraction-from-app-ts (Next)
```
