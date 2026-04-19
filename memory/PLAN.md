<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

Full-fidelity frontier. The demo shortcut period is over; the active burden is no longer "make the walkthrough legible" but "make the model truthful again." The codebase still speaks several overlapping product languages at once — legacy scope aliases, mixed knowledge facades, turn-shaped control artifacts, and multiple interaction families — so the frontier still prioritizes semantic and interaction-model recovery first. The distinct review-phase UI slice is now complete enough to retire from the live frontier, and the last legacy knowledge-facade cleanup is now done as well. The merged-stream projector cutover is now complete enough to retire from the active frontier, and interaction-family canonicalization is now complete enough to retire as well; the next major architecture move is phase transition and handoff stabilization on top of that cleaned interaction model.

## Active

### Active Code Alignment Map

The current active frontier should now be read not just as product/design cleanup, but as a concrete realignment program over the live code seams that still embody the older model.

- **Workflow + persistence seam (`src/server/core.ts`, `src/server/app.ts`, `src/server/db.ts`, `src/server/schema.ts`, `src/server/parts.ts`, `src/shared/api-types.ts`, `src/shared/project-state-turn.ts`)** — read-model truth now projects from workflow state plus active-path turns, phase-intent chat submits now prepare interviewer turns directly from derived landing, and general runtime helpers no longer fabricate kickoff / recovery rows. Legacy kickoff rows now exist only through explicit test-support seeding for narrow compatibility assertions; remaining work in this seam is about reusable grounding/context-gathering and later naming cleanup rather than control-row compatibility.
- **Workspace stream controller + routed interview view (`src/client/routes/project/$id/_view/-interview-controller-core.ts`, `src/client/routes/project/$id/_view/-interview-controller.ts`, `src/client/routes/project/$id/_view/-interview-data.ts`, `src/client/routes/project/$id/_view/-interview-view.tsx`)** — the projector now owns ordered stream artifacts and the dormant generic composer seam is gone. The remaining work in this seam is to keep handoff states legible without backsliding into turn-shaped control exceptions.
- **Card primitives and closed-state affordances (`src/client/components/question-cards.tsx`, `src/client/components/review-set-card.tsx`)** — requirements and criteria now have their own card family, but the larger card shell still conflates substantive turn cards with structural control / completion artifacts. The next active slices must finish that separation while preserving the accepted-set review seam.
- **Ontology + sidebar/read-model seam (`src/shared/knowledge.ts`, `src/client/components/EntitySidebar.tsx`, `src/server/db.ts`, `src/server/observer.ts`, `src/shared/api-types.ts`)** — the canonical ontology contract and review-authority seam are now aligned on one `knowledge_item` collection contract, and the dead per-type schema tables are gone. This seam is no longer its own active frontier item, but it remains an important dependency surface for interaction cleanup and later naming normalization.
- **Fixtures, manifests, seeded scenarios, and oracle tests (`src/server/fixtures/manifest.ts`, `src/server/fixtures/scenarios.ts`, `src/server/fixtures/manifests/*.json`, `src/server/fixtures/corpus.ts`, `src/server/fixtures/walkthrough.test.ts`, `src/server/core.test.ts`, `src/server/app.test.ts`, `src/client/routes/project/$id/_view/*test.tsx`)** — kickoff / recovery are now seed- and read-model-level projections rather than canonical rows. The remaining fixture/test burden is to keep asserting on projected controls, phase outcomes, and resumed landing states as interaction cleanup continues.
- **Naming, routing, and grounding-language seam (`src/shared/phase-routes.ts`, `src/shared/phase-display.ts`, `src/client/routes/project/$id/index.tsx`, `src/server/interview.ts`, `src/server/tools/index.ts`, `src/shared/grounding-strategy.ts`)** — the codebase still mixes `scope`, kickoff-specific brownfield ritual language, and route names that predate the grounding/card-owned model. The handoff frontier and later naming normalization must simplify these seams so new workflow surfaces do not keep inheriting obsolete product language.

1. **Phase transition and handoff stabilization on the cleaned model** — make every phase end in a legible next action, with no empty shells or stranded in-progress states, after review and input semantics stop fighting the projector.
   - Why now / unlocks: the remaining handoff bugs are real, but fixing them before the semantic cleanup would just restabilize the wrong model. Once review authority, ontology, and input seams are cleaned, transition work can become a straightforward projection pass instead of another exception layer.
   - Traceability: D94, D100, D101, D104; A54.
   - What this slice must accomplish:
     - requirements acceptance advances cleanly into criteria kickoff without dead air
     - criteria acceptance closes into a visible workflow-complete / export-ready state
     - closed phases show explicit handoff / completion artifacts instead of relying on the generic shell to imply what happened
     - force-close and proposed-close confirmations stay legible and do not leave stale active-phase projections behind

## Next

1. **Naming normalization: project → specification, scope → grounding, cwd removal** — align internal identifiers, route keys, and schema columns with the product vocabulary settled in D97 / D98.
   - Why now / unlocks: after the semantic, ontology, and interaction layers are clean, the naming drift is the last pervasive legacy burden. Doing it after the deeper model cleanup avoids rebase pain across the same files while still preventing new surfaces from inheriting the vocabulary split. This is the most invasive slice — it touches schema, routes, and API types — and should be planned as a sequence of safe commits.
   - Traceability: D97, D98; Horizon `project → specification physical DB rename`, Horizon `cwd removal`.
   - What this slice must accomplish:
     - rename `project` record / table / API identifier to `specification` (or the agreed internal name) with an explicit migration path
     - migrate the internal phase key from `scope` to `grounding`, or commit to keeping `scope` and document it as a permanent internal alias
     - remove `cwd` from the specification record and derive workspace path implicitly from the runtime context
     - update routes, loaders, fixtures, tests, and stories to match
     - manual verification after each commit in the sequence to catch silent breakage

2. **Transcript fidelity stabilization for seeded and resumed states** — make replayed interview history trustworthy enough that the workspace reads like one coherent thread instead of a partial hydration. Whatever remains after interaction-family canonicalization lands here.
   - Traceability: D92, D93, D96; A53, A55.

2. **Interview workflow transition extraction from `app.ts`** — deferred by choice. Picks up after the retirement frontier lands, when the extraction is no longer competing with semantic cleanup for the same files.

3. **Router / query ownership refinement for interview surfaces** — deferred by choice. Replace coarse route-wide invalidation with deliberate loader / query ownership once the cleaned surfaces make the real invalidation boundaries legible.

## Horizon

- **Output route and markdown export refinement** — independent parallel lane; refine the conditional route available when all phases are closed, with accepted review outputs projected into markdown export (D101).
- **Close Phase confirmation modal** — modal UX for the Close Phase button with readiness / turn-count context and closeability gating (D104); review phases may stay on their lighter accept-to-close path.
- **Workflow projector extraction** — conditional parallel refactor lane; extract `getCurrentWorkflowState()` into a pure projector over a `WorkflowSnapshot` struct without changing semantics on the active projector frontier.
- **Grounding-card transcript primitive** — add visible provisional grounding cards with optional comment + continue semantics, keeping card content non-durable while allowing user reactions to feed later knowledge capture.
- **Brownfield workspace-analysis grounding brief** — use read-only workspace analysis to produce the first visible grounding card, then hand off into the first substantive grounding question.
- **Reusable interviewer-invoked context gathering beyond opening grounding** — defer until opening brownfield brief proves the card / provenance model.
- **Dashboard / result summaries and completeness metrics** — post-interview surface.
- **Edit mode + cascade preview** — revisit affordance after interview-surface refinement settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on.
- **Drizzle Kit audit remediation** — recommended independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes** — complements the current manual-heavy outer loop once the existing contract, integration, fixture, controller, and build-boundary oracle stack is no longer enough for projector/interaction regressions.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-19 — **Interaction-family canonicalization retired from the active frontier** — the workspace stream now carries projected kickoff/recovery/handoff controls plus durable grounding/question/review turns as one canonical interaction family, and brownfield grounding no longer depends on a one-shot repo-summary question ritual. Verified: `npm run verify`.
- 2026-04-19 — **Brownfield kickoff now lands on a grounding-card first turn instead of a repo-summary question handoff** — brownfield scope tooling now exposes `present_grounding_card`, the opening brownfield interviewer prompt requires a provisional grounding brief before the first substantive question, and runtime persistence now materializes that first-turn grounding card plus its continue affordance from the streamed tool payload. Verified: `npm run verify`.
- 2026-04-19 — **Grounding cards now replay as their own workspace-stream turn family** — persisted `data-grounding-card` assistant metadata now round-trips through shared parts helpers, answered and active grounding cards render separately from question/review cards in the routed interview surface, and chat-path observer capture now skips provisional grounding-card responses while still advancing to the successor interviewer turn. Verified: `npm run verify`.
- 2026-04-19 — **Legacy control-row fabrication is now gone from production runtime helpers** — `src/server/core.ts` no longer exposes `ensureProjectFrontier()`, plain `/api/projects/:id/chat` submits now persist substantive answered turns instead of fabricating kickoff / recovery rows, and narrow seeded legacy kickoff coverage now lives in `src/server/test-support/legacy-control-rows.ts` rather than general runtime plumbing. Verified: `npm run verify`.
- 2026-04-19 — **The routed interview surface no longer carries a dormant generic composer contract** — `-interview-controller-core.ts`, `-interview-controller.ts`, and `-interview-view.tsx` no longer project or render `promptInput` state, so card-owned turn/review/control affordances are now the only active user-input seam in the interview surface. Verified: `npm run verify`.
- 2026-04-19 — **Phase-intent chat submits now prepare interviewer turns directly from derived landing** — `/api/projects/:id/chat` no longer fabricates kickoff / recovery control rows when projected kickoff or recovery cards submit typed `data-phase-intent`; the chat path now validates landing availability and prepares the successor interviewer turn directly, while `/api/projects/:id/phase-intent` retains the seeded legacy kickoff-row compatibility seam for persisted grounding-strategy selection. Verified: `npm run verify`.
- 2026-04-19 — **Merged-stream projector cutover retired from the active frontier** — project creation, phase confirmation / force-close, and requirements acceptance no longer pre-seed next-phase kickoff rows; resumed state, phase-entry kickoff, and closed-phase advancement now rely on derived `landing` plus durable workflow outcomes instead of fabricated control rows. Verified: `npm run verify`. Watch: the chat runtime still fabricated kickoff / recovery rows only as transitional submit plumbing when a user explicitly starts or resumes a phase.
- 2026-04-19 — **Control markers now depend only on typed phase-intent parts, not legacy command-copy heuristics** — the routed interview view no longer infers start / continue markers from plain text, the obsolete controller-core phase-message exports are gone, and the touched workspace-stream / interview-view tests now prove typed `data-phase-intent` is the only live control-marker seam. Verified: `npm run verify`.
- 2026-04-19 — **Workspace-stream projection now owns review markers, control markers, and terminal handoff/completion artifacts in one ordered list** — `src/client/routes/project/$id/_view/-workspace-stream-projector.ts` now emits phase markers, typed control markers, and terminal handoff / workflow-complete artifacts as first-class ordered stream items, and `src/client/routes/project/$id/_view/-interview-view.tsx` now renders those artifacts inline instead of splitting them across a banner seam and footer seam. Verified: `npm run verify`.
- 2026-04-19 — **Phase controls now submit through typed transcript parts instead of the message-text bridge** — `src/shared/phase-intents.ts`, `src/shared/chat.ts`, `src/server/app.ts`, and the routed interview controller/view now carry phase-entry / phase-continue intent as a typed `data-phase-intent` contract, render control markers from that typed part, and accept control submissions in `/api/projects/:id/chat` without requiring exact command-copy text. Verified: `npm run verify`.
- 2026-04-19 — **Specification-state reads now stay projection-only while frontier/control-row fabrication remains explicit runtime plumbing** — `src/server/core.ts` now exposes a pure `readProjectStateProjection()` seam and `getProjectState()` no longer seeds kickoff or recovery rows during reads, while the touched core/app tests now prove empty and recovery landings project from durable workflow state without mutating the active path. Verified: `npm run verify`. Watch: only the chat/runtime submit seam still fabricates transitional kickoff-row compatibility.
- 2026-04-19 — **Kickoff and recovery controls now submit through shared phase-intent seams instead of branching in the client on control-row presence** — `src/client/mutations/interview-mutations.ts`, `src/client/routes/project/$id/_view/-interview-controller.ts`, and `src/server/app.ts` now route projected kickoff and recovery actions through `phase-entry` / `phase-continue` intent submissions, and the touched controller/view/server tests now prove the same intent seam works for both landing-only kickoff and seeded kickoff-row states. Verified: `npm run verify`. Watch: the server route still owns transitional kickoff-row compatibility directly until the next refactor step hides it behind one runtime adapter.
- 2026-04-19 — **Workspace stream ordering now projects through one client seam instead of being recomputed inline in the interview view** — `src/client/routes/project/$id/_view/-workspace-stream-projector.ts` now maps durable phase turns, accepted closures, and the current bottom artifact into ordered render artifacts, and `src/client/routes/project/$id/_view/-interview-view.tsx` now renders answered turns, accepted closures, dividers, and active bottom artifacts from that projection rather than reducing phase state inline. Verified: `npm run verify`. Watch: kickoff/recovery submission still branches on legacy control-row presence until the next refactor step hides that runtime detail.
- 2026-04-19 — **The routed interview seam now uses one discriminated bottom-artifact contract for visible bottom-of-stream state** — `createInterviewControllerViewState()` now projects kickoff, recovery, persisted frontier turn, pending question, phase-summary proposal, generating, phase handoff, and workflow-complete states through one `bottomArtifact` union, and the interview controller/view plus their focused tests now consume that contract instead of recomposing the bottom region from separate `activeArtifact` / `phaseSummary` / `showGeneratingState` booleans. Verified: `npm run verify`.
- 2026-04-19 — **Projected control artifacts now use control/artifact terminology instead of turn-flavored names** — the interview controller/view seam no longer exposes kickoff, recovery, or accepted-closure affordances under turn-flavored names, and the touched controller/view/story tests now speak in the same vocabulary as the merged-stream model instead of implying projected controls are durable turns. Verified: `npm run verify`.
- 2026-04-19 — **Projected kickoff strategy selection no longer requires a seeded kickoff turn row** — the routed interview controller now persists landing-only grounding-strategy kickoff through a dedicated project-level kickoff-response mutation, `src/server/app.ts` now accepts that kickoff response from derived landing/workflow state without creating a kickoff row first, and the touched client/server tests now prove brownfield kickoff selection works from projected kickoff state before the chat path reuses any transitional control-turn plumbing. Verified: `npm run verify`. Watch: manual browser reload on kickoff-ready and recovery-ready seeded states is still pending from the earlier projector cutover checks.
- 2026-04-19 — **Seed-first fixture and oracle surfaces now normalize to derived landings instead of authoritative control rows** — `src/server/fixtures/manifest.ts` now rejects seeded kickoff/recovery control rows, `src/server/fixtures/corpus.ts` drops transitional kickoff/recovery rows when capturing runtime state back into manifests, `src/server/fixtures/scenarios.ts` no longer seeds criteria kickoff as canonical authority, and the touched server/client tests now assert on derived `landing` / projected kickoff-recovery output instead of happy-path `turn_kind` control rows. Verified: `npm run verify`.
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

### Parallelism Opportunities

Spawn separate worktrees only after the control worktree is clean, and keep the mainline focused on active item 1 while these lanes stay inside their file boundaries.

- **Recommended worktree lane — Drizzle Kit audit remediation**
  - Objective: audit Drizzle Kit config, migration journal integrity, and schema-generation hygiene without widening into product naming migration or projector semantics.
  - Primary files: `drizzle.config.ts`, `drizzle/*.sql`, `drizzle/meta/*`, `package.json`, and `src/server/schema.ts` only if the audit proves schema/migration drift that must be reconciled.
  - No-go zones: `src/server/app.ts`, `src/server/core.ts`, `src/shared/project-state-turn.ts`, and `src/client/routes/project/$id/_view/*`; do not bundle `project → specification` or `scope → grounding` renames into this lane.
  - Merge-risk notes: low if it stays tooling-only; medium if it regenerates or edits migrations that the mainline also needs. Review for migration ordering conflicts and snapshot drift.

- **Recommended worktree lane — Output route and markdown export refinement**
  - Objective: improve export projection and the dedicated export route without changing workflow-complete semantics or the merged-stream / handoff projector contract.
  - Primary files: `src/server/export.ts`, `src/server/export.test.ts`, `src/server/app.ts` (export endpoint only), `src/server/app.test.ts` (export assertions only), `src/client/routes/project/$id/export.tsx`, `src/client/routes/project/$id/-export-preview.tsx`, `src/client/routes/project/$id/export-loader.test.ts`, `src/client/routes/project/$id/ExportPreview.test.tsx`, and `src/client/routes/project/$id/-phase-navigation-sidebar.tsx` plus its test if navigation copy changes.
  - No-go zones: `src/client/routes/project/$id/_view/-interview-view.tsx`, `src/client/routes/project/$id/_view/-workspace-stream-projector.ts`, `src/client/routes/project/$id/_view/-interview-controller*`, and workflow closure rules in `src/server/db.ts`.
  - Merge-risk notes: medium. The route itself is isolated, but final-phase CTA copy and export-readiness presentation sit near active item 2 handoff work. Check for missing mainline changes in export links and completion-card language before merging.

- **Conditional worktree lane — Workflow projector extraction**
  - Objective: perform a behavior-preserving refactor that extracts `getCurrentWorkflowState()` into a pure projector over a snapshot struct while leaving workflow semantics unchanged.
  - Primary files: `src/server/db.ts`, `src/server/db.test.ts`, and, if needed for the extracted contract, a new shared/server-local projector module plus supporting notes in `docs/design/state-machines/README.md`.
  - No-go zones: do not change workflow status meaning, landing derivation, phase progression, export readiness, or client-facing interview/view behavior; avoid `src/server/app.ts`, `src/server/core.ts`, and `src/client/routes/project/$id/_view/*` unless a tiny mechanical import adjustment is unavoidable.
  - Merge-risk notes: medium-high because `src/server/db.ts` is still a hot seam on the active frontier. Only run this lane in parallel if the brief is explicitly constrained to pure extraction and the reviewer is prepared to check carefully for merge gaps against mainline workflow changes.

- **Do not parallelize yet**
  - Active item 1 remains sequential ahead of Next item 1 per the dependency graph above and because the same workflow, interview-view, card, and fixture seams are still in motion.
  - Next items 1-4 remain downstream of the handoff frontier or intentionally deferred until the current semantic cleanup stops competing for the same files.
  - Horizon items tied to the interview surface itself — Close Phase confirmation modal, grounding-card transcript primitive, brownfield grounding brief, reusable interviewer-invoked context gathering, and the headless interview driver — should wait until the interaction and handoff contracts stop moving.
