<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

Full-fidelity frontier. The demo shortcut period is over; the active burden is no longer "make the walkthrough legible" but "make the model truthful again." The codebase still speaks several overlapping product languages at once — legacy scope/framing aliases, mixed knowledge facades, turn-shaped control artifacts, and multiple interaction families — so the frontier still prioritizes semantic and interaction-model recovery first. The distinct review-phase UI slice is now complete enough to retire from the live frontier; remaining review polish belongs to the broader stream / interaction cleanup rather than blocking onward motion.

## Active

### Active Code Alignment Map

The current active frontier should now be read not just as product/design cleanup, but as a concrete realignment program over the live code seams that still embody the older model.

- **Workflow + persistence seam (`src/server/core.ts`, `src/server/app.ts`, `src/server/db.ts`, `src/server/schema.ts`, `src/shared/api-types.ts`, `src/shared/project-state-turn.ts`)** — this stack still fabricates kickoff / recovery as durable `turn_kind` rows, auto-seeds frontier turns through `ensureProjectFrontier()`, and exposes frontier/control meaning through turn records. Active items 3, 4, and 5 must replace that with explicit stream projection, anchored phase-outcome authority, truthful hydration landings, and projected control semantics.
- **Workspace stream controller + routed interview view (`src/client/routes/project/$id/_view/-interview-controller-core.ts`, `src/client/routes/project/$id/_view/-interview-controller.ts`, `src/client/routes/project/$id/_view/-interview-data.ts`, `src/client/routes/project/$id/_view/-interview-view.tsx`)** — the review-specific card family is now good enough to stop blocking progress, but this pipeline still chooses bottom-of-phase UI from `turn_kind`, missing-frontier heuristics, and generic closed-shell fallbacks. Active items 3, 4, and 5 must move it to an explicit merged stream projector that can render durable turn cards, projected kickoff / recovery / handoff controls, phase markers, and activity cards without pretending they are all turns.
- **Card primitives and closed-state affordances (`src/client/components/question-cards.tsx`, `src/client/components/review-set-card.tsx`)** — requirements and criteria now have their own card family, but the larger card shell still conflates substantive turn cards with structural control / completion artifacts. Active items 4 and 5 must finish that separation while preserving the accepted-set review seam.
- **Ontology + sidebar/read-model seam (`src/shared/knowledge.ts`, `src/client/components/EntitySidebar.tsx`, `src/server/db.ts`, `src/server/observer.ts`, `src/shared/api-types.ts`)** — legacy knowledge facades and framing-era grouping assumptions still leak through the shared types, persistence reads, and sidebar projections. Active items 1 and 2 must narrow this to the canonical durable ontology and accepted-review projections so the UI, observer, persistence, and fixtures all speak the same kind language.
- **Fixtures, manifests, seeded scenarios, and oracle tests (`src/server/fixtures/manifest.ts`, `src/server/fixtures/scenarios.ts`, `src/server/fixtures/manifests/*.json`, `src/server/fixtures/corpus.ts`, `src/server/fixtures/walkthrough.test.ts`, `src/server/core.test.ts`, `src/server/app.test.ts`, `src/client/routes/project/$id/_view/*test.tsx`)** — these files still encode `framing`, kickoff / recovery as durable frontier rows, and assertions on `turn_kind` or generic phase shells that the target architecture demotes to projection detail. Active items 1, 2, 3, 4, and 5 must rewrite the seeded states and tests around canonical kinds, projected control cards, anchored phase outcomes, and resumed landing states instead.
- **Naming, routing, and grounding-language seam (`src/shared/phase-routes.ts`, `src/shared/phase-display.ts`, `src/client/routes/project/$id/_view/framing.tsx`, `src/client/routes/project/$id/index.tsx`, `src/server/interview.ts`, `src/server/tools/index.ts`, `src/shared/grounding-strategy.ts`)** — the codebase still mixes `scope`, `framing`, kickoff-specific brownfield ritual language, and route names that predate the grounding/card-owned model. Active items 1, 4, and especially 6 must simplify these seams so reusable grounding/context-gathering and later naming normalization do not keep inheriting obsolete product language.

1. **Framing kind retirement and canonical scope-kind normalization** — finish the migration away from `framing` as a scope kind and normalize writes into the canonical `goal` / `term` / `context` / `constraint` set.
   - Why now / unlocks: `framing` is still persisted, projected, and referenced in routes (`_view/framing.tsx`), shared schemas, fixtures, stories, and UI cards. Every new interaction family has to branch around it. Retiring it unblocks both the knowledge facade cleanup and the later naming normalization.
   - Traceability: D49, D68; A40; I48.
   - What this slice must accomplish:
     - remove `framing` from the canonical scope-kind enum and from observer output contracts
     - migrate existing persisted `framing` rows into the appropriate canonical kind (likely `context` or `goal` depending on provenance)
     - remove `_view/framing.tsx` as the canonical interview surface, keeping only legacy redirect compatibility if needed, and retire any framing-specific card / sidebar affordances
     - update fixtures, scenarios, tests, and stories to stop producing or asserting on `framing`

2. **Legacy knowledge facade cleanup** — drop the dead schema tables and collapse the remaining legacy types into the kind-discriminated `KnowledgeItem` model.
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

3. **Merged stream projector cutover: truthful landings, slim charts, and projected controls** — make the center column honest about artifact types by projecting it from active-path turns, anchored workflow facts, and projected control / activity / phase-marker elements instead of treating every visible card as a durable turn, and make hydration land in those projected states through a pure reconciler rather than through kickoff/recovery turn heuristics.
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

4. **Interaction-family canonicalization: durable turn cards plus projected control cards** — finalize the workspace stream as the canonical interaction surface for user action, with durable turn cards for substantive elicitation, projected control cards for structural affordances, and no straggling alternative input seams.
   - Why now / unlocks: once the merged stream projector is honest about artifact types, the older kickoff-as-turn, one-shot brownfield ritual, and global bottom composer fallbacks can be removed without inventing another exception layer. This slice makes the new stream model the only real interaction contract.
   - Traceability: D89, D91, D95, D99, D110; A51, A54, A56; I24.
   - What this slice must accomplish:
     - remove the generic bottom composer as a canonical input path; any remaining uses become explicit debug / admin affordances or are deleted
     - replace persisted kickoff / recovery-as-turn assumptions with projected control-card seams derived from workflow state
     - fold the previous kickoff interaction family into the workspace stream so kickoff, grounding cards, question cards, review cards, and handoff controls share one coherent projection model without all becoming the same durable artifact type
     - retire the one-shot brownfield kickoff ritual in favor of reusable interviewer-invoked context gathering that produces grounding cards (D99)
     - confirm greenfield and brownfield grounding both enter through the workspace stream surface

5. **Phase transition and handoff stabilization on the cleaned model** — make every phase end in a legible next action, with no empty shells or stranded in-progress states, after review and input semantics stop fighting the projector.
   - Why now / unlocks: the remaining handoff bugs are real, but fixing them before the semantic cleanup would just restabilize the wrong model. Once review authority, ontology, and input seams are cleaned, transition work can become a straightforward projection pass instead of another exception layer.
   - Traceability: D94, D100, D101, D104; A54.
   - What this slice must accomplish:
     - requirements acceptance advances cleanly into criteria kickoff without dead air
     - criteria acceptance closes into a visible workflow-complete / export-ready state
     - closed phases show explicit handoff / completion artifacts instead of relying on the generic shell to imply what happened
     - force-close and proposed-close confirmations stay legible and do not leave stale active-phase projections behind

6. **Naming normalization: project → specification, scope → grounding, cwd removal** — align internal identifiers, route keys, and schema columns with the product vocabulary settled in D97 / D98.
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

- 2026-04-18 — **Registry-owned reference-code prefixes now drive runtime code generation** — `src/shared/knowledge.ts` now stores the current reference-code prefix on each `knowledgeKindRegistry` entry and derives `createKnowledgeReferenceCode()` from registry metadata instead of a separate hard-coded map, while `src/shared/knowledge.test.ts` proves the registry and emitted codes stay aligned. Done: `npm run verify`. Watch: Active item 2 still needs the follow-on sweep that replaces brittle hard-coded reference-code expectations across tests, fixtures, and stories before the contract prefix change lands.
- 2026-04-18 — **Captured-item replay now projects through one collection-driven entity path** — `src/server/db.ts` now builds `captured_items` for replay by iterating the canonical project-wide entity collections through `knowledgeKindRegistry` instead of hand-enumerating each collection, while focused db/app/interview-data/view tests prove collection/kind/reference-code parity for generic items, decisions, and assumptions. Done: `npm run verify`. Watch: Active item 2 now appears close to retired, but any remaining facade/API cleanup should be re-scoped explicitly rather than assumed.
- 2026-04-18 — **Decision and assumption transport schemas now derive from the canonical knowledge-item contract** — `src/shared/api-types.ts` now defines decision and assumption entity schemas by projecting `knowledgeItemSchema` instead of hand-maintained bespoke object bodies, while schema tests prove the outward entities payload remains unchanged and still strips extra ontology fields. Done: `npm run verify`. Watch: Active item 2 still needs the remaining typed-projection/API cleanup beyond the shared schema + server projection paths.
- 2026-04-18 — **Decision and assumption entity reads now share one knowledge-item projection helper** — `src/server/db.ts` no longer uses bespoke `toDecision` / `toAssumption` adapters for entity projection; both the create-path return values and project-wide entity reads now derive from one shared `knowledge_item`-based projector while preserving outward payload shape and reference codes. Done: `npm run verify`. Watch: Active item 2 still needs the remaining typed-projection/API cleanup beyond the shared server projection path.
- 2026-04-18 — **Active-path generic entity filtering now runs through one collection-driven helper** — `src/server/db.ts` now filters generic knowledge collections for active-path projection through a shared registry-driven helper instead of hand-maintained per-collection branches, while preserving accepted requirement / criterion carry-forward and relationship visibility. Done: `npm run verify`. Watch: Active item 2 still needs the remaining typed-projection cleanup beyond the shared filtering path.
- 2026-04-18 — **Shared kind lookup maps now drive both sidebar and server relationship projection** — `src/shared/knowledge.ts` now exports canonical `kind -> collectionKey` and `kind -> entityCollection` maps, `EntitySidebar` consumes them instead of rebuilding local lookup tables, and `src/server/db.ts` now projects relationship collections from the shared map instead of a local helper. Done: `npm run verify`. Watch: Active item 2 still needs the broader legacy knowledge facade collapse across active-path filtering and remaining typed projections.
- 2026-04-18 — **Project-wide generic entity projection now uses one shared knowledge-item path** — `src/server/db.ts` now projects `requirement` and `criterion` through the same generic knowledge-item helper used for the other canonical `knowledge_item` kinds, eliminating the special-case project-wide collection branches while preserving entities payload shape and reference codes. Done: `npm run verify`. Watch: Active item 2 still needs the broader legacy knowledge facade collapse across persistence reads, active-path filtering, and client typed projections.
- 2026-04-18 — **Shared ontology tuples now drive API kind enums and manifest collection mapping** — `src/shared/knowledge.ts` now exports canonical knowledge-kind / collection tuples plus `knowledgeCollectionKeyByKind`, `src/shared/api-types.ts` reuses those tuples for transport schemas instead of hand-maintained kind lists, and manifest seeding now consumes the shared kind→collection mapping. Done: `npm run verify`. Watch: Active item 2 still needs the broader legacy knowledge facade collapse across persistence reads and typed projections.
- 2026-04-18 — **Non-compatibility `framing` references retired from active fixtures and test naming** — route infrastructure tests now distinguish canonical grounding routes from the legacy `/framing` redirect seam, server observer/app tests use canonical `context` naming, and the active issue-tracker manifest no longer describes criteria review in framing-era language. Done: `npm run verify`. Watch: Active item 1 still needs any remaining runtime or persisted `framing` retirement beyond tests, fixtures, and compatibility coverage.
- 2026-04-18 — **Shared requirement/criterion entity contracts dropped legacy `reviewStatus`** — `src/shared/api-types.ts` now exposes canonical requirement and criterion entities without `reviewStatus`, schema tests now prove legacy payloads are stripped at the contract boundary, and client sidebar/graph/interview fixtures now use the canonical read-model shape. Done: `npm run verify`. Watch: Active item 2 still needs broader facade cleanup across any remaining server-side legacy read/write seams.
- 2026-04-18 — **Canonical grounding route cut over with legacy framing redirect** — the first phase now enters through `/grounding`, index/export/in-workspace navigation now targets the canonical grounding URL, the file-routed interview surface gained a dedicated `grounding.tsx` entry, and the legacy `/framing` route now redirects instead of remaining the primary product surface. Done: `npm run verify`. Watch: Active item 1 still needs any remaining persisted/fixture-level framing retirement beyond the route surface.
- 2026-04-18 — **Distinct review-phase UI rebuilt on accepted-set authority** — requirements and criteria now render through review-specific entry, active, replayed, proposal, and closed-state presenters, while the routed header close action now follows the same force-close policy seam as the transcript so review proposal states no longer expose an invalid contradictory close path. Done: `npm run verify`. Watch: remaining review loading-shell polish is deferred into active items 4 and 5 rather than blocking frontier movement.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
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
