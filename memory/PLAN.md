<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

Full-fidelity frontier. The demo shortcut period is over; the active burden is no longer "make the walkthrough legible" but "make the model truthful again." The codebase still speaks several overlapping product languages at once — legacy scope aliases, mixed knowledge facades, turn-shaped control artifacts, and multiple interaction families — so the frontier still prioritizes semantic and interaction-model recovery first. The recent turn-artifact persistence and review-action cleanup is now complete enough to retire from active execution, and the seeded brownfield replay seam now has a named reusable-grounding oracle instead of only focused local coverage. The next major architecture move remains phase transition and handoff stabilization on top of that cleaned interaction model.

## Active

### Active Code Alignment Map

The current active frontier should now be read not just as product/design cleanup, but as a concrete realignment program over the live code seams that still embody the older model.

- **Workflow + persistence seam (`src/server/core.ts`, `src/server/app.ts`, `src/server/db.ts`, `src/server/schema.ts`, `src/server/parts.ts`, `src/shared/api-types.ts`, `src/shared/project-state-turn.ts`, `src/server/turn-artifacts.ts`)** — read-model truth now projects from workflow state plus active-path turns, phase-intent chat submits now prepare interviewer turns directly from derived landing, and interviewer-owned review / grounding / activity / closure artifacts now materialize through one server-owned persistence seam instead of route-specific reconstruction. Legacy kickoff rows now exist only through explicit test-support seeding for narrow compatibility assertions; remaining work in this seam is about handoff projection, later naming cleanup, and deeper workflow extraction rather than control-row compatibility.
- **Workspace stream controller + routed interview view (`src/client/routes/project/$id/_view/-interview-controller-core.ts`, `src/client/routes/project/$id/_view/-interview-controller.ts`, `src/client/routes/project/$id/_view/-interview-data.ts`, `src/client/routes/project/$id/_view/-interview-view.tsx`)** — the projector now owns ordered stream artifacts and the dormant generic composer seam is gone. The remaining work in this seam is to keep handoff states legible without backsliding into turn-shaped control exceptions.
- **Card primitives and closed-state affordances (`src/client/components/question-cards.tsx`, `src/client/components/review-set-card.tsx`)** — requirements and criteria now have their own card family, and active review buttons now submit by semantic review action metadata instead of assumed option order, but the larger card shell still conflates substantive turn cards with structural control / completion artifacts. The next active slices must finish that separation while preserving the accepted-set review seam.
- **Ontology + sidebar/read-model seam (`src/shared/knowledge.ts`, `src/client/components/EntitySidebar.tsx`, `src/server/db.ts`, `src/server/observer.ts`, `src/shared/api-types.ts`)** — the canonical ontology contract and review-authority seam are now aligned on one `knowledge_item` collection contract, and the dead per-type schema tables are gone. This seam is no longer its own active frontier item, but it remains an important dependency surface for interaction cleanup and later naming normalization.
- **Fixtures, TypeScript scenario builders, seeded scenarios, and oracle tests (`src/server/fixtures/scenarios.ts`, `src/server/fixtures/corpus.ts`, `src/server/fixtures/walkthrough.test.ts`, `src/server/fixtures/seed.test.ts`, `src/server/core.test.ts`, `src/server/app.test.ts`, `src/client/routes/project/$id/_view/*test.tsx`)** — kickoff / recovery are now seed- and read-model-level projections rather than canonical rows, the walkthrough catalog is builder-owned, and the observer corpus now seeds direct TS probes instead of carrying a second fixture format. The remaining fixture/test burden is to keep asserting on projected controls, phase outcomes, and resumed landing states as interaction cleanup continues.
- **Runtime lifecycle + state-machine seam (`docs/design/state-machines/README.md`, `docs/design/state-machines/{phase-machine,spec-machine}.ts`, `src/client/routes/project/$id/_view/-interview-view.tsx`, `src/client/routes/project/$id/_view/-interview-controller.ts`, `src/server/phase-intent-runtime.ts`, `src/server/db.ts`)** — the design note now describes reconciliation-first landing, runtime-owned live operation lifecycle, and stale-event suppression, but those constraints are only partially reflected in canonical planning. The currently disabled auto-present behavior is the clearest symptom: the route view still owns a behavior that the design note assigns to runtime lifecycle ownership. Before re-enabling automatic phase entry/continue, the active frontier must pull the relevant runtime constraints into the live plan instead of treating the state-machine note as a distant refactor appendix.
- **Naming, routing, and grounding-language seam (`src/shared/phase-routes.ts`, `src/shared/phase-display.ts`, `src/client/routes/project/$id/index.tsx`, `src/server/interview.ts`, `src/server/tools/index.ts`, `src/shared/grounding-strategy.ts`)** — the codebase still mixes `scope`, kickoff-specific brownfield ritual language, and route names that predate the grounding/card-owned model. The handoff frontier and later naming normalization must simplify these seams so new workflow surfaces do not keep inheriting obsolete product language.

1. **Phase transition and handoff stabilization on the cleaned model** — make every phase end in a legible next action, with no empty shells or stranded in-progress states, after review and input semantics stop fighting the projector.
   - Why now / unlocks: the remaining handoff bugs are real, but fixing them before the semantic cleanup would just restabilize the wrong model. Once review authority, ontology, and input seams are cleaned, transition work can become a straightforward projection pass instead of another exception layer. This item also establishes the truthful transition boundaries that the later router/query ownership pass should refine rather than guess at. It now also has to absorb the runtime/state-machine seam strongly enough that automatic phase lifecycle behaviors do not get reintroduced as route-local effects.
   - Traceability: D94, D100, D101, D104, D113; A54, A57.
   - Boundary with Next item 3: this item owns workflow semantics, projected handoff/completion behavior, and the minimum route/query changes needed to make those transitions truthful. It does **not** own the broad ownership/invalidation cleanup pass; only take loader/query changes here when they are the smallest honest fix for a handoff bug.
   - **Status board (sync 2026-04-19):**
     - **Done / proved in current code + tests**
       - requirements full-set review acceptance advances directly into criteria kickoff without dead air
       - criteria full-set review acceptance closes the final phase and yields workflow-complete / export-ready state
       - criteria closure confirmation no longer leaves a stale active interviewer phase projected after close
       - the narrow D113 lifecycle seam is proved for current reachable kickoff auto-present, recovery auto-continue, and rejected auto-submit fallback
     - **Remaining before this frontier item can honestly retire**
       - closed phases still need clearer explicit handoff / completion artifacts in the workspace stream instead of relying on the larger generic shell to imply what happened
       - force-close and proposed-close confirmation paths still need one final legibility / stale-projection pass, especially around design force-close and end-of-phase confirmation edge states
       - if those remaining edges expose broader lifecycle ownership gaps, scope only the smallest additional D113 follow-on needed; do not widen runtime ownership preemptively
     - **Not part of this item**
       - broad router/query ownership cleanup still belongs to Next item 3
       - naming normalization still belongs to Next item 1
   - **Evidence currently carrying the item:**
     - `src/server/app.test.ts` covers requirements acceptance into criteria kickoff, criteria acceptance into fully closed workflow/output-ready state, no stale active phase after criteria closure confirmation, and the shared force-close confirmation seam
     - `src/server/fixtures/walkthrough.test.ts` covers resumed kickoff/recovery landings plus export-ready seeded replay
     - `src/client/routes/project/$id/_view/*test.tsx` continues to carry the routed workspace/read-model projection seam while these transition slices land
   - **D113 lifecycle boundary inside this item:**
     - Done 2026-04-19: the first proving slice landed for auto-present on the current reachable kickoff phase through a specification-scoped lifecycle helper. It submits typed phase-entry intents only, suppresses duplicate submit across rerender/remount, leaves router ownership of navigation plus durable read-model rendering unchanged, and does not auto-choose grounding strategy kickoff on `scope`.
     - Done 2026-04-19: the next follow-on slice landed for auto-continue on the current reachable recovery phase through that same specification-scoped seam. It submits typed idempotent `phase-continue` intents only, suppresses duplicate submit across rerender/remount, falls back to the projected recovery card after failed auto-submit instead of retry-looping, and keeps router ownership of navigation plus durable read-model rendering unchanged.
     - Done 2026-04-19: rejected auto-submit now marks the current auto intent failed and re-projects the kickoff/recovery control instead of leaving the reachable phase stuck in lifecycle-owned generating state.
     - Remaining: do not widen lifecycle ownership beyond current reachable kickoff auto-present plus current reachable recovery auto-continue without fresh scoping; broader continue paths, force-close races, and any stronger runtime-host machinery remain deferred.
   - When to pick up the D113 concern:
     - immediately before any slice that would re-enable auto-present / auto-continue, move recovery/continue ownership back into the route view, or depend on remount-tied effects for lifecycle progress
     - immediately when a bug involves duplicate submits, late lifecycle outputs, force-close races, or restart/remount ambiguity about which in-flight effect is still authoritative
   - How to pick it up:
     - first prove the boundary on one narrow path using a specification-scoped lifecycle helper that consumes durable truth and emits typed idempotent intents
     - keep router ownership of navigation and durable read-model rendering unchanged while testing whether a minimal lifecycle seam is sufficient
     - only widen toward broader runtime machinery if that narrow proving slice cannot suppress duplicates / stale outputs cleanly
   - Feed forward into Next item 3 whenever an ownership issue is encountered:
     - which transition or mutation exposed the problem
     - which route / loader / query currently owns the stale or over-invalidated data
     - what the likely durable ownership boundary should be once semantics are stable
     - whether the observed failure was semantic/projection, invalidation/ownership, or both
     - what minimal enabling fix was taken now, and what broader cleanup should remain deferred to the later ownership pass

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
   - Why deferred / input from Active item 1: this item should consume the feed-forward notes from handoff stabilization rather than run in parallel with it. The ownership pass starts only after the active frontier has made transition semantics and visible handoff states trustworthy enough that invalidation bugs can be separated from workflow bugs.
   - What this later slice should harvest from Active item 1:
     - the transition points whose correctness currently depends on coarse invalidation
     - the route / loader / query seams that were forced to change as enabling work
     - places where route-wide refresh is masking unclear ownership rather than expressing it
     - any repeated pattern in stale handoff state, over-refresh, or mixed workflow/query responsibilities

## Horizon

- **Output route and markdown export refinement** — independent parallel lane; refine the conditional route available when all phases are closed, with accepted review outputs projected into markdown export (D101).
- **Close Phase confirmation modal** — modal UX for the Close Phase button with readiness / turn-count context and closeability gating (D104); review phases may stay on their lighter accept-to-close path.
- **Workflow projector extraction** — conditional parallel refactor lane; extract `getCurrentWorkflowState()` into a pure projector over a `WorkflowSnapshot` struct without changing semantics on the active projector frontier. Note: the broader runtime/state-machine ownership claims in `docs/design/state-machines/README.md` now constrain active lifecycle work even though this extraction itself remains deferred.
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

- 2026-04-19 — **Legacy fixture side path removed; one TS-native fixture model remains** — the public walkthrough catalog now proves direct builder ownership, app and observer tests seed projects through direct TS setup, the observer corpus probes seed from TS helpers instead of a second scenario format, and the legacy fixture support layer plus fixture artifacts are deleted. Verified: `npm run verify`.
- 2026-04-19 — **Public walkthrough seeds now prefer canonical review-turn helpers over stale late-phase scenario slices** — the public `requirements-ready` / `criteria-ready` seeds now resolve through the helper-backed full-set review seams, and the `issue-tracker-*` kickoff-ready later-phase walkthrough fixtures no longer slice stale per-item requirement drafts into public truth. Walkthrough regression coverage now asserts persisted `data-review-set` metadata on the seeded requirements / criteria review turns. Verified: `npm run verify`.
- 2026-04-19 — **D113 rejected auto-submit hardening landed under Active item 1** — specification-scoped auto phase intents now treat rejected submit promises as failed submissions instead of leaving the reachable phase stuck in lifecycle-owned generating state. The helper marks the current auto intent failed, re-projects the kickoff/recovery control, and still suppresses duplicate retry across rerender/remount until durable landing changes. Verified: `npm run verify`.
- 2026-04-19 — **D113 recovery auto-continue proving slice landed under Active item 1** — current reachable recovery restoration now auto-submits typed `phase-continue` through the same specification-scoped lifecycle helper as kickoff auto-present, suppresses duplicate submit across rerender/remount, and falls back to the projected recovery card after failed auto-submit instead of retry-looping. Router ownership of navigation plus durable read-model rendering remains unchanged, and no second durable workflow model was introduced. Verified: `npm run verify`.
- 2026-04-19 — **Narrow D113 lifecycle proving slice landed under Active item 1** — current reachable kickoff auto-present now runs through a specification-scoped lifecycle helper rather than a route-local effect, uses typed phase-entry intent submission only, suppresses duplicate submit across rerender/remount, and preserves router ownership of navigation plus durable read-model rendering. Grounding strategy kickoff on `scope` remains explicit pending the next lifecycle slice. Verified: `npm run verify`.
- 2026-04-19 — **Turn-artifact persistence and brownfield replay hardening retired from active execution** — interviewer-owned review, grounding, activity, and closure artifacts now materialize through one server-owned seam, active review buttons submit by semantic action metadata instead of assumed option order, and the walkthrough catalog now includes a named brownfield reusable-grounding replay scenario. Verified: `npm run verify`.
- 2026-04-19 — **Interaction-family canonicalization retired from the active frontier** — the workspace stream now carries projected kickoff/recovery/handoff controls plus durable grounding/question/review turns as one canonical interaction family, and brownfield grounding no longer depends on a one-shot repo-summary question ritual. Verified: `npm run verify`.
- 2026-04-19 — **Merged-stream projector cutover retired from the active frontier** — project creation, phase confirmation / force-close, and requirements acceptance no longer pre-seed next-phase kickoff rows; resumed state, phase-entry kickoff, and closed-phase advancement now rely on derived `landing` plus durable workflow outcomes instead of fabricated control rows. Verified: `npm run verify`.

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
  └──→ router-query-ownership-refinement-for-interview-surfaces (Next)

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
  - Active item 1 remains sequential ahead of Next item 1 and Next item 3 per the dependency graph above and because the same workflow, interview-view, card, and fixture seams are still in motion.
  - Next items 1-4 remain downstream of the handoff frontier or intentionally deferred until the current semantic cleanup stops competing for the same files; Next item 3 specifically depends on the feed-forward ownership notes gathered during Active item 1.
  - Horizon items tied to the interview surface itself — Close Phase confirmation modal, grounding-card transcript primitive, brownfield grounding brief, reusable interviewer-invoked context gathering, and the headless interview driver — should wait until the interaction and handoff contracts stop moving.
