<!-- PLAN.md — single source of truth for WHAT we're doing next.
     Created by ln-plan · Read by all skills · Updated by ln-sync, ln-build, ln-spike.
     Authority: phases, slices, spikes, ordering, status, and traceability to SPEC.md.

     Re-run ln-plan frequently to retire completed slices, occasionally to add new ones.
     Every slice and spike names its dependent requirements and assumptions from SPEC.md.
     Invalidating an assumption in SPEC surfaces every slice it touches here. -->

# Plan

<!-- Phases are temporal groups, ordered. Within each phase, slices and spikes are ordered
     by uncertainty first, dependency second (retire risk early).
     Status: not-started | in-progress | done -->

## Phase 1: Foundation `done`

<!-- Prove the stack works end-to-end, then add persistence. All subsequent phases depend on this. -->

### Slices

1. **Walking skeleton: SDK → SSE → React** `FE-534` `done` — I1, I2, I3, I4
2. **SQLite foundation + project persistence** `FE-535` `done` — I5, I6

## Phase 2: Architecture `done`

3. **Turn tree schema + API** `FE-544` `done` — I6, I9, I10
3c. **Drizzle ORM + core extraction** `FE-552` `done` — I11, I12, I13
3d. **Multi-project routing** `FE-553` `done` — I14, I15

## Phase 3: Interview Engine `done`

<!-- Spikes -->
- Spike: **Observer extraction fidelity** `FE-557` `done` — narrowly validated observer extraction for the original decisions/assumptions ontology (≥80% capture rate); broadened knowledge-layer extraction still needs follow-up coverage
- Spike: **Raw Anthropic SDK** `done` — invalidated A2, validated A26, led to D30

<!-- Slices -->
3b. **Rich chat UI** `FE-541` `done` — I7
4. **Structured interview: scope phase** `FE-554` `done` — I16
4a. **Parts-based persistence + context builders** `FE-555` `done` — I17, I18, I19
4b. **Structured interview: client UI** `FE-556` `done` — I17↑, I18↑
4c. **UI foundation: shadcn/ui + Tailwind 4 + AI Elements** `FE-558` `done`
5. **Observer agent + entity persistence** `FE-537` `done` — I20, I21, I22
6. **Entity sidebar (read-only)** `FE-538` `done` — I23
6b. **AI SDK-native chat pivot** `FE-559` `done` — I21↑, I22↑, I23↑
6b1. **Workspace seam characterization oracle** `done` — I24
    - Purpose: add a client integration harness around the interview workspace before the state-ownership refactor
    - Coverage: initial hydration from persisted turns, same-project refresh stability, observer-result sidebar reactivity, option-selection follow-through

## Phase 4: Interaction + Knowledge Foundations `done`

### Slices

6c. **Live streaming fix** `done`
    - Shipped: workspace controller projects streamed `tool-ask_question` into visible turn card before durable route refresh
    - Established: I24 (workspace seam)

6d. **Flexible turn-response model** `done`
    - Shipped: `data-turn-response` parts carry zero/one/many selections + free-text; workspace stages multi-select locally
    - Established: I44 (turn response seam)

6e. **Generic knowledge layer schema + sidebar projection** `done`
    - Shipped: `knowledge_item` + `turn_knowledge_item` + `knowledge_edge` persistence; kind-specific entity collections + typed relationships
    - Established: I48 (generic knowledge seam)

6f. **Phase-aware observer extraction** `done`
    - Shipped: observer biases extraction by phase — scope→goals/terms/contexts/constraints, design→decisions/assumptions, requirements→requirements, criteria→criteria
    - Established: I54 (observer widening seam)

## Phase 5: Mode Closure + Full Interview `done`

### Slices

7. **Explicit phase outcomes + scope closure** `done`
   - Shipped: durable `phase_outcome` records; `data-phase-summary` + `data-confirmation` chat seams; workspace header phase status
   - Established: I72 (phase-close seam)
   - Debt: shared closeability/readiness/closure-basis generalization folded into slice 8

7a. **Knowledge-layer redesign spike** `done`
   - Shipped: canonical ontology (8 kinds); `framing` demoted to migration alias; primary review UX is dedicated knowledge workspace

7b. **Canonical knowledge model foundation + cutover seam** `done`
   - Shipped: registry/observer/entities/sidebar use canonical kinds; decisions/assumptions persist through generic seam
   - Established: I48 (updated), I54 (updated)

8. **Design mode (commitment / exploration)** `done`
   - Shipped: shared workflow projection replaces scope-only seam; discriminated phase-close commands; force-close + durable closure basis
   - Established: I72 (updated)

9. **Requirements-review mode** `done`
   - Shipped: interviewer grounded in requirement inventory; targeted approve/reject; closeability from full review coverage; shared phase-close reused for requirements → criteria handoff
   - Established: I87 (requirements-review seam)

10.1 **Criteria grounding + first synthesis/review loop** `done`
     - Shipped: criteria interviewer grounded in approved requirements; initial criterion round-trips through observer/entity persistence
     - Established: I97 (criteria-review grounding)

10.2 **Explicit criterion review state + minimal closeability** `done`
     - Shipped: per-criterion approve/reject with latest-action-wins projection; closeability from full criterion review coverage
     - Established: I98 (criteria-review seam)

10.3 **Criteria closure + completed workflow state** `done`
     - Shipped: shared phase-close seam closes criteria; all four phases project `closed` with no stale active phase
     - Established: I99 (criteria closure)

## Phase 6: Readiness Surfaces + Export

<!-- Surface readiness outside the workspace, add a broader knowledge workspace/review surface,
     then export from the reviewed knowledge layer. Knowledge-graph revisit is now Phase 8. -->

### Slices

11a. **Project dashboard workflow state** `FE-573` `done`
     - Shipped: project list shows per-phase status/readiness/closure-basis from durable phase outcomes + live workflow projection
     - Distinguishes forced-close debt from ordinary closed state

12a. **Knowledge workspace review surface** `FE-574` `done`
     - Shipped: read-only `/project/:id/knowledge` route with kind-grouped items, review badges, and dependency edges
     - First dedicated review surface beyond sidebar

12b. **Spec export from the reviewed knowledge layer** `FE-574` `done`
     - Shipped: markdown export from active-path reviewed knowledge with closure caveats; gated on all phases closed
     - Evidence: export.test.ts, ExportPreview.test.tsx

11b. **Fixture scenarios + dev seed CLI** `done`
     - Shipped: shared fixture module + `npm run seed <scenario>` CLI; test files import from shared module
     - 10 programmatic scenarios cover all workflow states

11c. **Rich fixture generation for outer-loop testing** `done`
     - Shipped: JSON manifest seeder with issue-tracker domain (5 scenarios, 27 knowledge items, 14 edges, 24 turns)
     - Evidence: 223 tests pass; all 10 scenarios seed; knowledge workspace + export render from seeded state
     - Debt: manifest-authored fixtures currently prove convenience seeding more than trusted runtime-shaped persistence; strict manifest hardening and catalog split deferred to 16a

13a. **Review lifecycle refinement across requirements + criteria** — Revisit the first-cut review model only after the thin end-to-end path is working, and add the deferred variants that were intentionally excluded from slices 9 and 10 so the app kept moving toward completion. Depends on 12a + 12b. `not-started`
     - Requirements: → SPEC.md §Requirements #11, #12, #13
     - Assumptions: → SPEC.md §Assumptions A15, A40
     - Decisions: → SPEC.md §Decisions D17, D61, D65, D66, D86
     - Candidate invariant goals: richer review actions and invalidation semantics can evolve without regressing the thin end-to-end workflow; deferred edge-case variants are collected in one explicit refinement slice rather than fragmenting earlier mode slices
     - Invariants to respect: → SPEC.md §Invariants I18, I21, I24
     - Acceptance: deferred review refinements such as edit/add/merge/stale semantics across requirements and criteria can land behind one cross-cutting slice without regressing completion, export, or workflow-state coherence
     - **Verification approach**: inner — mutation/read-model/invalidation tests per refinement added. Outer — manual cross-phase review lifecycle walkthrough using the per-phase routes and ViewLayout knowledge sidebar.

## Phase 7: Distribution + Brownfield + UI Alignment `done`

<!-- Local-first storage, npx distribution, greenfield/brownfield routing, codebase exploration,
     and design-system alignment from the brunch-ui prototype.
     Must-haves for the first delivery deadline. -->

### Slices

17. **UI refinement + design-system alignment** `done`
    - Shipped: Inter font, Figma color ramp, typography scale, shadow tokens, Ladle stories, sidebar toggle, card-within-card in the dedicated knowledge view, resizable panels in InterviewView, skeleton loading, empty-state vocabulary
    - Evidence: 11 Ladle stories, 288 tests pass, npm run verify green
    - Debt: dark mode tokens, question card V2 (TurnCard refactor), badge mono font, per-route skeleton tuning

17a. **Debug route removal + shiki decoupling** `done`
     - Shipped: tool JSON renders via plain `<pre><code>` (no shiki); `/debug` route removed; AI Elements showcase migrated to Ladle story; shiki eliminated from all production chunks
     - Evidence: build-boundary.test.ts (no-shiki oracle), capability-boundaries.test.ts, 288 tests pass, npm run verify green

14. **Local-first storage + npx distribution** `done`
    - Shipped: `BrunchProject` resolution walks up safely, rejects invalid `.brunch` path shapes early, preserves API 404s when static assets are mounted, and ships a real JS bin entrypoint for `npx brunch`; empty `BRUNCH_DB` falls back safely; migrations still resolve via `import.meta.url`
    - Evidence: project.test.ts, launcher.test.ts, cli.test.ts, runtime-config.test.ts; 288 tests pass, npm run verify green
    - Debt: real published `npx` smoke test, `--port` flag, graceful shutdown

14a. **Greenfield/brownfield first-screen + exploration** `done`
     - Shipped: project table stores `mode` (greenfield/brownfield) and `cwd`; dialog-based first-screen routes between modes; brownfield scope uses read-only exploration tools + a scope-only exploration prompt + a higher step budget (12 vs 4); later phases keep their normal prompts; server derives cwd from launcher
     - Evidence: db.test.ts, interview.test.ts, app.test.ts, ProjectList.test.tsx; 288 tests pass, npm run verify green
     - Debt: outer-loop manual brownfield walkthrough (A47 validation)

## Phase 8: Knowledge-Graph Revisit (stretch)

<!-- Knowledge-graph-level revisit with edit mode, cascade, and secondary threads.
     Stretch goal — may not land before the first delivery deadline.
     Replaces the earlier "generalized revisit" concept (hard turn-tree branching). -->

### Slices

15. **Edit mode + cascade preview** — Edit mode (accessible from ViewLayout's knowledge sidebar or Graph view) lets user select items to invalidate/remove. Read-only cascade preview traces knowledge graph edges (BFS over `depends_on`, `derived_from`, `constrains`, `verifies`, `refines`), shows affected items and phases that would reopen. No mutations yet — preview only. `not-started`
    - Requirements: → SPEC.md §Requirements #10
    - Assumptions: → SPEC.md §Assumptions A48
    - Decisions: → SPEC.md §Decisions D5, D17, D80
    - Candidate invariant goals: cascade preview correctly identifies all downstream items via graph edges; preview matches what execution would produce; edit mode is modal (no other edits while active)
    - Invariants to respect: → SPEC.md §Invariants I48
    - Acceptance: enter edit mode, select items, see accurate cascade preview with affected items and phases listed; exit without confirming leaves state unchanged
    - Design: `docs/design/REVISIT_MODULE.md`

15a. **Cascade execution + secondary thread lifecycle** — Confirm cascade → write invalidation records, create `revisit_session`, spawn secondary thread turn anchored to highest associated primary turn, reopen affected phases. Secondary thread conversation re-resolves affected items via interviewer. Complete revisit when all items resolved; phases can be re-closed. `not-started`
     - Requirements: → SPEC.md §Requirements #10
     - Assumptions: → SPEC.md §Assumptions A48, A49
     - Decisions: → SPEC.md §Decisions D80, D84
     - Candidate invariant goals: secondary thread anchored to primary tree; affected phases reopen; re-resolution conversation produces valid knowledge items; session completes when all items resolved; knowledge item validity dual-checks active path + graph integrity
     - Invariants to respect: → SPEC.md §Invariants I48, I54, I72, I87
     - Acceptance: confirm cascade → phases reopen → secondary thread conversation → all items resolved → phases can be re-closed → export valid again
     - Design: `docs/design/REVISIT_MODULE.md`

## Phase 9: Post-Distribution Hardening

<!-- Defer dependency-risk changes until the packaged app exists and can be regression-tested as a distributed artifact. -->

### Slices

14b. **Port-safe launcher + same-CWD runtime guard** — Harden the local launch seam so packaged `npx brunch` picks a collision-free app port automatically, opens the actual bound URL, refuses a second live launch from the same `.brunch/` project, and keeps the split dev harness configurable without hard-killing fixed ports. `done`
    - Shipped: packaged launcher now binds an available localhost port, reports/opens the actual bound URL, and records a project-scoped runtime owner so the same resolved `.brunch/` root cannot launch twice concurrently
    - Shipped: dev API startup and Vite `/api` proxy now share one explicit `BRUNCH_PORT`/`PORT` seam, and `npm run dev` no longer kills fixed listeners before starting
    - Evidence: launcher.test.ts, runtime-config.test.ts, `npm run verify`
    - Debt: outer-loop packaged multi-dir and alternate-port dev smoke still pending

16. **Drizzle Kit audit remediation** — Revisit the current `npm audit` finding on `drizzle-kit` after distribution is stable. Do not use `npm audit fix --force`, which currently resolves to `drizzle-kit@0.18.1`; that downgrade crosses the modern config boundary and is not a safe path for this repo. Instead, validate a non-vulnerable upgrade path (currently the `1.0.0-beta` line) against this app's SQLite config, migration history, and `studio` workflow before changing dependencies. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Candidate invariant goals: packaged distribution remains stable while the Drizzle toolchain is upgraded off the vulnerable `@esbuild-kit/*` loader chain
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I4, I5
    - Acceptance: chosen `drizzle-kit` version removes the vulnerable loader chain, keeps `drizzle.config.ts` compatible, preserves existing migration history, and `npm run studio` still works against the existing SQLite database
    - **Verification approach**: inner — dependency tree/audit check plus config-load and migration/studio smoke tests. Outer — manual `npm run studio` walkthrough on the distributed app path.

16a. **Trusted fixture hardening + catalog split** — Recast manifest-authored fixture scenarios as trusted runtime-shaped fixtures rather than permissive demo seeds. Fail fast on manifest/load/compiler errors, compile the scenario DSL through the same domain operations the app uses for persisted turn/phase/selection state, patch assistant parts to match live persistence contracts, and split synthetic seam exercisers (e.g. deliberately impossible low-readiness states) out of the public seed catalog into test-only helpers. `done`
    - Shipped: manifest scenarios now compile through the runtime-shaped turn/phase/entity seam instead of permissive demo seeding, and public seed scenarios are limited to realistic trusted fixtures
    - Evidence: manifest compiler/loader tests, trusted-fixture round trips, `npm run seed <scenario>`
    - Debt: confirmed-good manual captures still need promotion into the curated corpus over time

16b. **Capture-backed golden fixture curation + observer probes** — After trusted fixtures are runtime-shaped, add a follow-on path that captures confirmed-good sessions into curated golden fixtures and uses them to strengthen observer evaluation. The initial target is a small hybrid corpus (captured then normalized) rather than a fully automated ingest pipeline. `done`
    - Shipped: `captureProjectToManifestScenario(...)` normalizes active-path sessions back into the trusted manifest seam, and `curatedGoldenCorpus` seeds scope + multi-phase review entries from that same scenario format
    - Seam changed: observer probes now replay prefix scenarios through the trusted fixture pipeline and compare per-turn captures without ad hoc SQL extraction
    - Evidence: corpus.test.ts (3), manifest.test.ts (5), observer.test.ts (9); targeted vitest green
    - Debt: the curated corpus is a bootstrap hybrid over trusted runtime-shaped scenarios; confirmed-good manual captures still need promotion into the corpus over time

## Phase 10: Route Ownership Refactor `done`

### Slices

18. **Router seam characterization for file-based routing migration** `done`
    - Shipped: locked current router bootstrapping, URL-to-screen mapping, and route-linked destinations before the file-route cutover
    - Evidence: main.test.tsx, router.test.tsx, ProjectList.test.tsx, InterviewView.test.tsx, ExportPreview.test.tsx

19. **Route wrapper extraction for file-based routing migration** `done`
    - Shipped: dashboard, interview, knowledge, and export route owners now delegate UI/controller work into extracted screen modules and route-support helpers instead of owning heavy screen logic directly
    - Seam changed: project creation navigation moved out of the mutation hook and back into the dashboard route wrapper
    - Evidence: ProjectList.test.tsx, InterviewView.test.tsx, ExportPreview.test.tsx, router.test.tsx, main.test.tsx, `npm run verify`

20. **File-route build infrastructure for staged cutover** `done`
    - Shipped: TanStack Router Vite plugin now scans `src/client/routes`, generates `src/client/routeTree.gen.ts`, and keeps the generated tree as the runtime router source of truth
    - Seam changed: generated route tree is a managed artifact ignored by oxlint/oxfmt; route-local tests and `-`-prefixed support files stay colocated under `src/client/routes` without becoming route owners
    - Evidence: file-route-infra.test.ts, `npm run verify`

21. **Final route-directory consolidation + helper colocation** `done`
    - Shipped: retired `src/client/file-routes`; `src/client/routes` is now the only routing directory, and the remaining route-adjacent helpers live there as ignored support files so thin route owners keep code splitting intact
    - Evidence: router.test.tsx, build-boundary.test.ts, file-route-dashboard.test.ts, file-route-export.test.ts, `npm run verify`

## Ad-hoc: Typing Hygiene `done`

22. **Strip Zod from non-LLM boundaries** `done`
    - Shipped: Zod validation removed from SDK output (onFinish), persistence round-trips, and server-to-client API responses; kept only for LLM tool schemas, structured output, and HTTP request bodies; `BrunchAssistantPart` type fixed to include `tool-propose_phase_closure`; type-safe discriminant filter replaces schema parse at SDK boundary
    - Seam changed: `assistantPartsSchema` and `userPartsSchema` deleted from `chat.ts`; `filterAssistantParts` introduced with `satisfies` guard; `postJsonMutation` no longer takes a schema parameter
    - Evidence: parts.test.ts, client-mutation.test.ts, -interview-data.test.ts, export-loader.test.ts, InterviewView.test.tsx, `npm run check` + build green
    - ~~Debt: 3 pre-existing test failures from Phase 10 routing refactor~~ Resolved — 296/296 tests pass as of 2026-04-13

## Phase 11: Routing & Layout Refactor `done`

<!-- Phase-based routing with three concentric layout shells (D86, D87).
     Pure client refactor — no server API changes, no LLM behavior changes.
     Prerequisite for layout-level data ownership and phase-specific views. -->

### Slices

23. **Directory-based routing infrastructure + layout shell scaffolding** `done`
    - Shipped: flat-file routes converted to directory-based nesting under `routes/project/$id/`; three layout shells scaffolded (AppLayout with logotype + cwd, ProjectLayout with stub sidebar, ViewLayout with `validateSearch` for `?view=chat|graph`); four phase routes all render InterviewView; export migrated into the nested route tree; project index redirects to the active phase; `/api/config` endpoint added for cwd display
    - Evidence: file-route-infra.test.ts, router.test.tsx, build-boundary.test.ts, file-route-interview.test.ts, file-route-export.test.ts; 308 tests pass, `npm run verify` green

23a. **Entity-projection alignment** `done`
     - Shipped: the entity seam now preserves the full relationship vocabulary, knowledge surfaces render the richer graph deliberately, routed entity reads default to the active path, and project-wide inventory requires explicit opt-in
     - Evidence: app.test.ts, export.test.ts, EntitySidebar.test.tsx, `npm run verify`

24. **ProjectLayout sidebar + layout-level data loading split** `done`
    - Shipped: workspace-loader split into `fetchProjectLayoutLoaderData` (ProjectState) and `fetchViewLayoutLoaderData` (EntitiesData); ProjectLayout renders `PhaseNavigationSidebar` with status/readiness/closeability per phase; ViewLayout owns entity loading; workspace-controller reads from two `useLoaderData` calls; `WorkspaceLoaderData` type retired
    - Seam changed: workspace-data adapter now accepts `(projectState, entitySnapshot, projectId)` instead of combined `WorkspaceLoaderData`
    - Evidence: phase-navigation-sidebar.test.tsx, -interview-controller.test.tsx, InterviewView.test.tsx, file-route-interview.test.ts, router.test.tsx; 318 tests pass, `npm run verify` green
    - Debt: project index route still fetches its own ProjectState for redirect (review finding #2 — deferred); manual browser verification pending

24b. **Route colocation + workspace lexicon retirement** `done`
    - Shipped: `screens/` and `workspace/` directories dissolved; all single-consumer modules inlined into their route or support files; shared modules moved to `_view/` with `-interview-` prefix; all `Workspace*` symbols renamed to `Interview*`; no file under `src/client/` contains "workspace" in its name
    - Seam changed: loader functions (`fetchProjectLayoutLoaderData`, `fetchViewLayoutLoaderData`, `fetchKnowledgeLoaderData`) now inline in route files; `InterviewView` replaces `InterviewWorkspace`; `KnowledgeView` replaces `KnowledgeWorkspace`
    - Evidence: 311 tests pass across 40 files; `npm run verify` green; build code-splitting intact

25. **Per-phase conversation views + phase-transition navigation + knowledge sidebar relocation** `done`
    - Shipped: each phase route renders only its phase's turns via `filterMessagesByPhase`; phase-close confirmation navigates to the next active phase via `getNextActivePhase` + `useEffect`; EntitySidebar moved from InterviewView into ViewLayout's ResizablePanelGroup; observer-result data parts trigger `router.invalidate()` replacing manual entity fetch; knowledge route retired; InterviewView header (workflow badges, Projects/Knowledge links) removed
    - Seam changed: interview-data adapter simplified (no entity refresh state); controller accepts `phase: WorkflowPhase`; EntitySidebar accepts `EntitiesData` directly (no `isLoading`)
    - Evidence: 290 tests pass across 38 files; `npm run verify` green; build code-splitting intact
    - Debt: project index summary page deferred (redirect behavior unchanged); kind/phase filter controls on EntitySidebar deferred; manual browser verification (outer-loop) pending

26. **Graph view stub in ViewLayout** `done`
    - Shipped: ViewLayout conditionally renders a code-split GraphView when `?view=graph` is active, showing all project entities grouped by kind (8 groups from knowledgeKindRegistry) with inline relationship indicators and kind filter controls; `?view=chat` returns to conversation + EntitySidebar two-column layout
    - Seam changed: ViewLayout reads `Route.useSearch()` and branches render; GraphView is lazy-loaded via `React.lazy` for code splitting
    - Evidence: GraphView.test.tsx (5 tests), file-route-interview.test.ts (source-level lazy import assertion), build-boundary.test.ts (graph chunk isolation); 295 tests pass across 39 files; `npm run verify` green
    - Debt: phase-of-capture filter deferred until the entities API exposes per-item phase provenance; interactive graph canvas deferred; manual browser verification pending

## Horizon

<!-- Future work not yet broken into slices. Revisit after Phase 11. -->

- MCP server adapter (expose core operations as MCP tools)
- Exploratory pathway (for projects where the goal itself is unclear — distinct from brownfield which is about context, not goal uncertainty)
- Hard turn-tree branching (deferred from V1; the linked-list structure supports it but UX is not exposed)
- Git-integrated diff-able persistence format (file-based representation of the DB for version control)
- Headless interview driver (programmatic harness driving `/api/projects/:id/chat` with scripted answers)
- Per-phase server endpoints — currently phase routes filter turns client-side from the full ProjectState. If conversation length becomes a performance concern, add `/api/projects/:id/turns?phase=scope` server endpoints to reduce payload size
- React Query granular caching migration — when layout-level `router.invalidate()` becomes too coarse (e.g., entity list too large for full re-fetch on observer extraction), migrate entity and turn data into React Query cache with targeted `queryClient.invalidateQueries()` per concern

## Dependencies

<!-- Blocking relationships between slices. Update when slices are added or retired. -->

```
done ─────────────────────────────────────────────────────────────┐
  Phase 1–7, 10: all complete                                     │
  Ad-hoc: 22 (Zod strip) done                                    │
  Phase 11: 23, 23a, 24, 24b, 25, 26 done — Phase 11 complete    │
──────────────────────────────────────────────────────────────────┘
Phase 8:  25 ──→ 15 (edit mode — adapts to new layout)    [stretch]
          15 ──→ 15a (cascade execution + secondary threads) [stretch]
Phase 9:  14 ──→ 14b (port-safe launcher + same-CWD runtime guard)
          14 ──→ 16 (drizzle-kit audit remediation)
          11b/11c/14 ──→ 16a (trusted fixture hardening + catalog split)
          16a ──→ 16b (capture-backed golden fixtures + observer probes)
Deferred: 25 ──→ 13a (review lifecycle refinement — adapts to per-phase views)
```

### Parallelism opportunities

- **Phase 11 is complete.** All slices (23, 23a, 24, 24b, 25, 26) are done.
- 14b (port-safe launcher + same-CWD runtime guard) and 16 (drizzle-kit audit) remain the independent post-distribution follow-ons from earlier shipped work.
- 16b is now done: capture/curation builds on the trusted runtime-shaped fixture pipeline, and observer probes no longer depend on ad hoc SQL extraction.
- 15/15a (knowledge-graph revisit) depend on 25 (done) — edit mode can now adapt to the ViewLayout sidebar or Graph view.
- 13a (review lifecycle refinement) depends on 25 (done) — review surfaces are now in per-phase routes.
