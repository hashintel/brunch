<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

Full-fidelity frontier. The demo shortcut period is over; the active burden is no longer "make the walkthrough legible" but "make the model truthful again." The codebase still speaks several overlapping product languages at once — legacy scope aliases, mixed knowledge facades, turn-shaped control artifacts, and multiple interaction families — so the frontier still prioritizes semantic and interaction-model recovery first. The distinct review-phase UI slice is now complete enough to retire from the live frontier, and the last legacy knowledge-facade cleanup is now done as well. The next major architecture move is now unambiguously the merged-stream projector cutover.

## Active

### Active Code Alignment Map

The current active frontier should now be read not just as product/design cleanup, but as a concrete realignment program over the live code seams that still embody the older model.

- **Workflow + persistence seam (`src/server/core.ts`, `src/server/app.ts`, `src/server/db.ts`, `src/server/schema.ts`, `src/shared/api-types.ts`, `src/shared/project-state-turn.ts`)** — this stack still fabricates kickoff / recovery as durable `turn_kind` rows, auto-seeds frontier turns through `ensureProjectFrontier()`, and exposes frontier/control meaning through turn records. Active items 1, 2, and 3 must replace that with explicit stream projection, anchored phase-outcome authority, truthful hydration landings, and projected control semantics.
- **Workspace stream controller + routed interview view (`src/client/routes/project/$id/_view/-interview-controller-core.ts`, `src/client/routes/project/$id/_view/-interview-controller.ts`, `src/client/routes/project/$id/_view/-interview-data.ts`, `src/client/routes/project/$id/_view/-interview-view.tsx`)** — the review-specific card family is now good enough to stop blocking progress, but this pipeline still chooses bottom-of-phase UI from `turn_kind`, missing-frontier heuristics, and generic closed-shell fallbacks. Active items 1, 2, and 3 must move it to an explicit merged stream projector that can render durable turn cards, projected kickoff / recovery / handoff controls, phase markers, and activity cards without pretending they are all turns.
- **Card primitives and closed-state affordances (`src/client/components/question-cards.tsx`, `src/client/components/review-set-card.tsx`)** — requirements and criteria now have their own card family, but the larger card shell still conflates substantive turn cards with structural control / completion artifacts. Active items 2 and 3 must finish that separation while preserving the accepted-set review seam.
- **Ontology + sidebar/read-model seam (`src/shared/knowledge.ts`, `src/client/components/EntitySidebar.tsx`, `src/server/db.ts`, `src/server/observer.ts`, `src/shared/api-types.ts`)** — the canonical ontology contract and review-authority seam are now aligned on one `knowledge_item` collection contract, and the dead per-type schema tables are gone. This seam is no longer its own active frontier item, but it remains an important dependency surface for the projector and later naming cleanup.
- **Fixtures, manifests, seeded scenarios, and oracle tests (`src/server/fixtures/manifest.ts`, `src/server/fixtures/scenarios.ts`, `src/server/fixtures/manifests/*.json`, `src/server/fixtures/corpus.ts`, `src/server/fixtures/walkthrough.test.ts`, `src/server/core.test.ts`, `src/server/app.test.ts`, `src/client/routes/project/$id/_view/*test.tsx`)** — these files still encode kickoff / recovery as durable frontier rows and assertions on `turn_kind`, even though the target architecture demotes those to projection detail. Active items 1, 2, and 3 must rewrite the seeded states and tests around projected control cards, anchored phase outcomes, and resumed landing states instead.
- **Naming, routing, and grounding-language seam (`src/shared/phase-routes.ts`, `src/shared/phase-display.ts`, `src/client/routes/project/$id/index.tsx`, `src/server/interview.ts`, `src/server/tools/index.ts`, `src/shared/grounding-strategy.ts`)** — the codebase still mixes `scope`, kickoff-specific brownfield ritual language, and route names that predate the grounding/card-owned model. Active items 2 and especially 4 must simplify these seams so reusable grounding/context-gathering and later naming normalization do not keep inheriting obsolete product language.

1. **Merged stream projector cutover: truthful landings, slim charts, and projected controls** — make the center column honest about artifact types by projecting it from active-path turns, anchored workflow facts, and projected control / activity / phase-marker elements instead of treating every visible card as a durable turn, and make hydration land in those projected states through a pure reconciler rather than through kickoff/recovery turn heuristics.
   - Why now / unlocks: D94 / D95 / D110 changed the conceptual model. As long as kickoff, recovery, and phase-boundary affordances still masquerade as ordinary turns, later UI cleanup keeps restabilizing the wrong abstraction. This slice establishes the machine/runtime/read-model contract that the rest of the interaction cleanup can build on.
   - Traceability: D65, D93, D94, D95, D96, D110; A44, A51, A54, A55; I24, I72.
   - What this slice must accomplish:
     - introduce an explicit `deriveSpecificationLanding(snapshot)` reconciliation seam that derives the one truthful bottom artifact for hydration and resume: projected kickoff, frontier turn, visible generation, projected recovery, handoff, or complete
     - define the open-phase landing contract that feeds a slim phase chart, rather than rehydrating phases through `turn_kind` and seeded kickoff rows
     - introduce an explicit workspace-stream projection model that can interleave durable conversational turns, anchored workflow facts, projected control cards, projected phase markers, and activity cards without requiring each artifact to be a turn row
     - stop using persisted kickoff / recovery turn kinds as product truth; kickoff and recovery should project from workflow state and durable conditions even if transitional storage still reuses turn fields internally
     - keep `phaseOutcome` as the authoritative durable phase-boundary fact and anchor handoff / completion projection to it; define how start/end markers attach to nearby turns without joining the branch-bearing linked list
     - split responsibilities cleanly: reconciliation + queue reseeding + lease ownership + cancellation + stale-event rejection in a specification runtime host; in-phase legality in the phase chart; cross-phase progression and boundary retry in the spec chart
     - preserve the active-path invalidation rule: if an anchored non-turn fact points at a turn that falls off the trusted branch, that fact is superseded or hidden rather than left floating in the stream
     - keep hydration/resume truthful when a phase opens into projected entry, frontier reply, visible generation, projected recovery, or closed-phase handoff state
     - rewrite fixtures, seeded scenarios, and tests to assert on projected controls and derived landings rather than on kickoff / recovery turn rows
   - Execution guidance for this frontier:
     - treat the cutover as a **read-model + seed-contract transition**, not as a historical data migration project; while the model is still fluid, prefer destructive reset / reseed over compatibility work for legacy local data
     - keep seeds aligned to **durable authority only**: active-path substantive turns, `phaseOutcome`, and workflow facts; do not encode projected kickoff / recovery / handoff states as if they were canonical authored rows
     - make server and client tests assert on **derived landing / projection output** rather than on the existence of legacy `turn_kind` control rows
     - if kickoff / recovery rows still exist internally during transition, treat them as **transitional submit plumbing only**; no new product behavior, fixture happy path, or UI read model should depend on them as truth
     - retire seed helpers and manifest patterns that manufacture control turns as authoritative state as soon as the corresponding projector seam exists, so future slices do not silently reintroduce the legacy model

2. **Interaction-family canonicalization: durable turn cards plus projected control cards** — finalize the workspace stream as the canonical interaction surface for user action, with durable turn cards for substantive elicitation, projected control cards for structural affordances, and no straggling alternative input seams.
   - Why now / unlocks: once the merged stream projector is honest about artifact types, the older kickoff-as-turn, one-shot brownfield ritual, and global bottom composer fallbacks can be removed without inventing another exception layer. This slice makes the new stream model the only real interaction contract.
   - Traceability: D89, D91, D95, D99, D110; A51, A54, A56; I24.
   - What this slice must accomplish:
     - remove the generic bottom composer as a canonical input path; any remaining uses become explicit debug / admin affordances or are deleted
     - replace persisted kickoff / recovery-as-turn assumptions with projected control-card seams derived from workflow state
     - fold the previous kickoff interaction family into the workspace stream so kickoff, grounding cards, question cards, review cards, and handoff controls share one coherent projection model without all becoming the same durable artifact type
     - retire the one-shot brownfield kickoff ritual in favor of reusable interviewer-invoked context gathering that produces grounding cards (D99)
     - confirm greenfield and brownfield grounding both enter through the workspace stream surface

3. **Phase transition and handoff stabilization on the cleaned model** — make every phase end in a legible next action, with no empty shells or stranded in-progress states, after review and input semantics stop fighting the projector.
   - Why now / unlocks: the remaining handoff bugs are real, but fixing them before the semantic cleanup would just restabilize the wrong model. Once review authority, ontology, and input seams are cleaned, transition work can become a straightforward projection pass instead of another exception layer.
   - Traceability: D94, D100, D101, D104; A54.
   - What this slice must accomplish:
     - requirements acceptance advances cleanly into criteria kickoff without dead air
     - criteria acceptance closes into a visible workflow-complete / export-ready state
     - closed phases show explicit handoff / completion artifacts instead of relying on the generic shell to imply what happened
     - force-close and proposed-close confirmations stay legible and do not leave stale active-phase projections behind

4. **Naming normalization: project → specification, scope → grounding, cwd removal** — align internal identifiers, route keys, and schema columns with the product vocabulary settled in D97 / D98.
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

- 2026-04-19 — **Projected control artifacts now use control/artifact terminology instead of turn-flavored names** — the interview controller/view seam now exposes `activeArtifact` rather than `turnCard`, projected kickoff/recovery cards and accepted-closure replay now use control/artifact component names, and the touched controller/view/story tests now speak in the same vocabulary as the merged-stream model instead of implying projected controls are durable turns. Verified: `npm run verify`.
- 2026-04-19 — **Projected kickoff strategy selection no longer requires a seeded kickoff turn row** — the routed interview controller now persists landing-only grounding-strategy kickoff through a dedicated project-level kickoff-response mutation, `src/server/app.ts` now accepts that kickoff response from derived landing/workflow state without creating a kickoff row first, and the touched client/server tests now prove brownfield kickoff selection works from projected kickoff state before the chat path reuses any transitional control-turn plumbing. Verified: `npm run verify`. Watch: manual browser reload on kickoff-ready and recovery-ready seeded states is still pending from the earlier projector cutover checks.
- 2026-04-19 — **Seed-first fixture and oracle surfaces now normalize to derived landings instead of authoritative control rows** — `src/server/fixtures/manifest.ts` now rejects seeded kickoff/recovery control rows, `src/server/fixtures/corpus.ts` drops transitional kickoff/recovery rows when capturing runtime state back into manifests, `src/server/fixtures/scenarios.ts` no longer seeds criteria kickoff as canonical authority, and the touched server/client tests now assert on derived `landing` / projected kickoff-recovery output instead of happy-path `turn_kind` control rows. Verified: `npx vitest run src/server/fixtures/manifest.test.ts src/server/fixtures/corpus.test.ts src/server/core.test.ts src/client/routes/project/$id/_view/-interview-data.test.ts src/client/routes/project/$id/_view/InterviewView.test.tsx src/server/app.test.ts`. Watch: `npm run fix` and `npm run verify` are still blocked by pre-existing missing story imports under `src/client/stories/stream-blocks/*` (`TS2307` in the `.stories.ts` re-export files).
- 2026-04-19 — **Canonical transition fixtures now seed durable authority instead of authoritative control rows** — the walkthrough kickoff/recovery scenarios in `src/server/fixtures/scenarios.ts` no longer append persisted kickoff/recovery frontier rows as the canonical seeded state, and `src/server/fixtures/walkthrough.test.ts` now proves those scenarios reopen from substantive turns + phase outcomes into the expected derived `landing` contract. Verified: `npm run verify`. Watch: do one manual seeded browser reload on a kickoff-ready and recovery-ready walkthrough before widening this seed-first rule across the rest of the fixture catalog.
- 2026-04-19 — **Open-phase landing now derives from one shared projector seam** — `src/shared/project-state-turn.ts` now derives the truthful active landing (`kickoff`, `frontier-turn`, or `recovery`) from workflow state plus active-path turns, `src/server/core.ts` now hydrates `/api/projects/:id` with that `landing` contract, and the routed interview controller/view now consumes that seam instead of inferring kickoff/recovery from persisted `turn_kind` rows. Verified: `npm run verify`. Watch: do one manual browser reload check on fresh kickoff and answered-turn recovery states before widening into broader projector cleanup.
- 2026-04-19 — **Legacy knowledge facade cleanup retired as an active frontier item** — decision/assumption entity references now use the canonical `knowledge_item` collection contract, dead legacy per-type schema tables and relationship tables were removed from `src/server/schema.ts`, and `drizzle/0010_retire_legacy_knowledge_tables.sql` now drops the retired tables so runtime boot, seeding, and projection all flow only through `knowledge_item`, `turn_knowledge_item`, and `knowledge_edge`. Done: `npm run verify`.
- 2026-04-19 — **Retired the legacy `/framing` route compatibility seam** — removed `src/client/routes/project/$id/_view/framing.tsx`, regenerated `src/client/routeTree.gen.ts` without `/project/$id/framing`, and updated file-route / router coverage so canonical grounding is the only live first-phase route. Done: `npm run verify`.
- 2026-04-18 — **Runtime-generated review turns now persist their own interviewer-owned review metadata** — `src/shared/chat.ts` now allows `ask_question` review turns to carry a full `reviewSet` payload alongside explicit `reviewActions`, `src/server/interview.ts` now instructs and validates requirements / criteria review turns to emit that metadata for the active phase, and `src/server/app.ts` now persists the generated `tool-ask_question` part plus a derived `data-review-set` from that same authoritative review metadata before falling back to synthesized inventory. `src/server/app.test.ts`, `src/server/interview.test.ts`, and `src/shared/project-state-turn.test.ts` now prove the first runtime-generated requirements / criteria review turns round-trip explicit accept/request-changes semantics plus the persisted review set through submit and replay without relying on synthesized fallback inventory on the happy path. Done: `npm run verify`.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
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
