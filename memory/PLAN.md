<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, and the first relation-first observer capture seam all ship as working product. In this stack, downstack FE-697 supplies the multi-chat substrate (chat containers + `reconciliation_need` queue), and FE-698 supplies the prompt/context scenario substrate from `main`. Side-chat V2 plumbing — `edit` / `edge` / `drill-down` patch kinds with server route, reducer, and undo-capable appliers — is branch-complete on FE-673 (PR #97) but ships without its user-facing Edit-mode trigger, and the V2 hard-impact branch returns a `deferred: true` placeholder banner. The live frontier is **side-chat V3.0**, which removes that placeholder by routing hard-impact apply through the new `reconciliation_need` queue.

The May 2026 intent-spec, multi-chat, changeset-ledger, prompt/context, and agent-mutation design notes are reconciled into one direction. `docs/design/MULTI_CHAT.md` is the downstack phase-one substrate for this stack. `docs/design/SIDE_CHAT.md` describes side-chat V1 / V2 / V3.0 / V3.1 / V4 phasing on top of that substrate, with §13 mapping each user-surface version onto a substrate phase. `docs/design/PATCH_LEDGER.md` remains historical deeper design pressure for semantic mutation history, but canonical future-facing vocabulary is `changeset` / `change`; `docs/design/INTENT_SPEC_EVOLUTION.md` carries the broader synthesis. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` (canonical reference for the FE-700 frontier) and `docs/design/BEHAVIORAL_KERNELS.md` (canonical reference for the FE-702 kernel probes). The dev-layer self-tooling trajectory — the `ln-*` skill family, the proposed file-backed spec registry, and the long-horizon convergence between dev and product ontologies — lives in `docs/design/DEV_WORKFLOW_EVOLUTION.md`. Older portability work remains a future-facing boundary map rather than a live roadmap item until a hosted, remote, or adapter-backed substrate becomes a product goal.


## Active

1. **Side-chat V3.0 — hard-impact edit cascade through `reconciliation_need`** — drop the V2 deferred banner; on hard-impact `propose_edit` apply, server enumerates incident `knowledge_edge` rows under typed relation policy (Path 1 from MULTI_CHAT.md §5.1) and opens one `reconciliation_need` per affected pair; client surfaces those rows as a `Pending review` section in `patch-list-overlay.tsx` with per-row accept-on-target / edit-target / dismiss actions. V3.0 groups needs mechanically (by `kind` and relation type); agent-grouped resolution is V3.1 horizon work.
   - Why now / unlocks: downstack FE-697 supplies the queue table for this stack; the FE-674 planning sync (PR #110) reconciled SIDE_CHAT.md §5.3 / §8 / §9 / §13 and SPEC.md (Acceptance Criterion 7, A88, D139, I113) against the substrate; the V2 deferred banner is the highest-visibility user gap. Without V3.0, FE-697's queue has no reader and V2 hard-impact stays an empty promise.
   - Recommended shape: ship as a small queue of scope cards inside this one frontier item (track in `memory/CARDS.md` if needed). Suggested order — (a) un-stub `SideChatPopover` Edit-mode button so V2 plumbing is reachable from the UI at all; (b) server `openReconciliationNeedsForItemChange()` + lifecycle endpoint for resolution; (c) `edit-applier` rewrite to drop the `deferred: true` shape and surface needs into side-chat state; (d) overlay `Pending review` section + per-row resolution actions; (e) verification — `edit-applier.test.ts`, `reconciliation-need.test.ts`, `patch-list-overlay.test.tsx`, F6 fixture matrix (leaf, 2-downstream, 5+-downstream, in-active-review-set, mixed kinds).
   - Linear: FE-674.
   - Traceability: Acceptance Criterion 7; Requirement 10; A48, A71, A83, A88; D80, D135, D137, D138, D139; I111, I113.
   - Design doc: `docs/design/SIDE_CHAT.md` §5.3, §9, §13; `docs/design/MULTI_CHAT.md` §5.

## Next

2. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and the single actionable frontier preserved at the current reachable phase.
   - Why now / unlocks: workflow read/write ownership is extracted (FE-616); the multi-chat substrate (FE-697) ships chat containers below the specification, so continuous workspace can adopt one visible runtime without smuggling in a second durable workflow model. Bumped behind V3.0 because V3.0 closes a visible V2 gap and pays off the substrate immediately, while continuous workspace is independent of either.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`.


## Horizon

### Intent graph and reconciliation

- **Semantic changeset ledger** — make semantic mutations first-class once non-primary surfaces can change intent-graph truth.
  - Linear: FE-701.
  - Recommended shape: one `changeset` contains one or more atomic `change` records. Use `changeset` / `change` as canonical schema and operation vocabulary; `patch` / `patch_change` remain historical design-doc terms only. Connect `reconciliation_need.caused_by_changeset_id` once changesets exist.
  - Depends on: multi-chat substrate + reconciliation needs; prompt/context context packs for reconciliation scenarios.
  - Traceability: A71, A82, A83; D135, D138, D140.
  - Design doc: `docs/design/PATCH_LEDGER.md` (historical file name; future vocabulary is changeset/change).

- **Relation-first observer capture enrichment** — after the next ontology/relation-policy probes, broaden observer relationship extraction across the refined ontology where edge support and operational participation are understood.
  - Recommended shape: keep `runObserver()` as the public turn-owned seam, but feed it scenario-specific context packs and validate output through the relation-policy registry. The FE-639 first cut has landed; remaining work should be driven by corpus/manual proving.
  - Depends on: prompt/context substrate; intent graph semantics + progressive checkability foundation.
  - Traceability: Requirements 30, 38, 40; A66, A81, A84; D125, D136, D137, D139, D140; I109.

- **Architect / generator loop** — autonomous agent that iterates over the intent graph and proposes semantic changes for HITL review through the same future changeset / reconciliation pathway as user-driven edits.
  - Recommended shape: keep productized architect proposals behind multi-chat + reconciliation + semantic changesets; use the scenario substrate for shadow/proposal-only probes first.
  - Traceability: A73, A85, A87; D139, D141; depends on chat containers + reconciliation needs and semantic changeset ledger.

- **Side-chat V3.1 — agent-grouped reconciliation resolution** — once V3.0 ships, a reconciliation agent reads the `reconciliation_need` queue and reclassifies open needs into auto-confirm (review-only items, one-click resolve), auto-edit (mechanical text replacements applied through the standard edit pipeline), and substantive (judgment required, walk inside the side-chat panel using pinned-context conversation). Maps onto MULTI_CHAT.md Phase 3.
  - Why later: V3.0 satisfies Acceptance Criterion 7 mechanically; agent grouping is value-add, not gap-closing. Hold until V3.0's mechanical grouping reveals whether substantive items get lost in a flat list (A88 validation).
  - Depends on: V3.0 ship; reconciliation agent prompt + grouping policy.
  - Traceability: Requirement 10; A48, A88; D135, D137, D138, D139.
  - Design doc: `docs/design/SIDE_CHAT.md` §5.3 (V3.1), §9.

### User-facing capabilities

- **First-run provider setup** — make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer / observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
  - Linear: FE-633 covers the OpenRouter/default-provider part; dashboard credential UX + XDG key storage may need a sibling issue if split from provider proving.
  - Recommended shape: prove the provider resolver first with current Anthropic behavior, then spike OpenRouter against tool use, structured output, and reasoning/thinking options before making it the default. The dashboard should expose credential status without leaking secret values and offer setup before the user starts a specification.
  - Traceability: Requirements 34, 35, 36; A74, A75; D130, D131, D132; I106.

- **Workspace hygiene / `.brunch/` gitignore assist** — detect whether generated local state is already ignored and, with explicit confirmation, add an idempotent `.gitignore` entry or create `.gitignore` when absent.
  - Linear: FE-648.
  - Recommended shape: keep this as a deterministic local mutation with preview/confirmation semantics; it can ship independently, but the dashboard is the natural surface because it already explains workspace binding and first-run setup.
  - Traceability: Requirement 37; A76; D133; I107.

- **Productized web research capability** — web search and page-fetch tools as interviewer-invoked context gathering, surfaced as preface cards after the scenario substrate proves query framing, tool ergonomics, and provisional-context handling.
  - Linear: FE-649.
  - Depends on: prompt/context scenario substrate and web-research probe.
  - Traceability: Requirements 20, 21, 40, 41; D99, D112, D139, D142.

- **Dashboard result summaries and completeness metrics** — progress visibility across specifications.

- **Two-axis interview framing** — adapt interviewer setup and questioning to the full `greenfield <> brownfield` by `end-to-end build <> incremental feature` matrix instead of treating partial-scope work as a special case.
  - Linear: FE-638.
  - Traceability: Requirement 29; A65; D124.

- **Productized candidate-spec completion assist** — replace skip-only remainder handling with a `fill in the rest for me` path that generates candidate specs, implications, tradeoffs, and likely typed knowledge for reaction-based refinement after prompt probes prove useful output.
  - Depends on: prompt/context scenario substrate; intent graph semantics + progressive checkability foundation; candidate-spec generation probe.
  - Traceability: Requirement 31, 40; A67, A77, A78, A85; D126, D134, D136, D139.

- **Progressive detail / recursive deflation** — support broad-pass interviewing with explicit next-level-of-detail actions rather than one uniform depth-first drill-down.
  - Linear: FE-637.
  - Recommended shape: pair ordinary grounding/design question turns with a turn-owned breadth-skeleton artifact that makes current coverage visible and exposes a structured detail reaction (`deepen this area`, `continue broad pass`, `sufficient for now`). The chosen reaction should steer the next same-phase frontier turn instead of introducing a separate detail workflow.
  - First cut should optimize for `broad question -> choose one area to deepen next -> focused successor question -> refreshed breadth skeleton`, while keeping the same detail-focus intent reusable later from chat or graph surfaces.
  - Traceability: Requirement 32; A67, A68; D127.

- **Spatial canvas layout for graph view** — add the spatial DAG layout as a second layout choice inside graph mode, alongside the structured-list route. Same projection seam, same intent contract; only the layout strategy changes.
  - Recommended shape: a layout switch inside the existing `/specification/$id/graph` route that transforms the same `EntitiesData` projection into a spatial scene with viewport / selection / focus / path-highlighting. First cut should optimize for `select node -> inspect -> launch refinement` through the multi-chat substrate.
  - Depends on: graph view structured-list ship. Richer node actions depend on multi-chat / reconciliation rather than the old side-chat conceptual roadmap.
  - Traceability: Requirement 33; A69; D128.

- **Graph view active-path render filter + scope toggle** — render only active-path items by default in graph view, with a `Show all` toggle in the header that flips to the full whole-spec set. Both subsets project from the same in-memory `mode=project-wide` data; no second fetch.
  - Depends on: server data-layer change for active-path membership exposure.
  - Traceability: Requirement 33; D128, D129; I102.

### Infrastructure / tooling

- **Structured development spec registry** — prototype file-backed canonical spec records, deterministic checks, generated markdown views, and task-local slices for Brunch's own development workflow (the `ln-*` skill family).
  - Status: design horizon, not a migration commitment. Self-tooling experiment for the dev layer; not part of the product roadmap.
  - Recommended shape: follow the `memory/spec/{schema,records,generated,tools}/` trajectory and the 5-step migration path (stable IDs → sidecar files → stop editing generated md → `spec:check` in the verify gate → task-local slices). First-adopter candidate: a bounded sub-area such as the multi-chat substrate's records, not the full SPEC.
  - Traceability: D134.
  - Design doc: `docs/design/DEV_WORKFLOW_EVOLUTION.md` (canonical reference, including the three-layer framing and convergence question); `docs/design/INTENT_SPEC_EVOLUTION.md` (broader synthesis context).

- **Portability boundaries** — split durable store/read-model, interview session runtime, and workspace capability provider if Brunch targets hosted, remote, embedded, or sandbox-backed operation.
  - Status: deferred. Some enabling seams already exist (query domains, workflow projector, no persisted `cwd` on specifications), but adapter-backed portability is not on the live roadmap.
  - Deep design source: `docs/design/PORTABILITY_BOUNDARIES.md`.
- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.
- Git-friendly file-based persistence representation for diffable exported specs.
- Typed fixture-builder convergence for happy-path tests.

## Recently Completed

- [2026-05-08] FE-674 planning sync — reconciled `docs/design/SIDE_CHAT.md` §5.3 / §8 / §9 / §13 against the downstack FE-697 substrate; SPEC.md adds A88 (Path 1 sufficiency without agent), D139 (cascade routes through `reconciliation_need`, `deferred: true` apply contract removed at V3.0 ship), I113 (apply opens at least one need per typed dependency edge), and rewrites Acceptance Criterion 7. Doc-only, no `src/` touched. PR #110 stacked on FE-704.
- [2026-05-07] FE-698 prompt/context scenario substrate — Packaged markdown prompt registry + observer context-pack foundation + scenario runner capture skeleton/composition + agent mutation-surface audit. Server interviewer, observer, and side-chat role prompts now load from markdown assets through a typed prompt registry, observer capture renders its existing prompt context through the first typed scenario-specific context pack, and seeded observer-capture prompt scenarios now compose the production observer prompt with typed context-pack output into deterministic no-provider probe artifacts. Review fixes moved observer prompt composition into a pure module and made prompt scenario prompt sources explicit. The agent mutation-surface audit inventories current and projected agent-originated write paths as input to the registry/handler slices. Verified: `npm run verify` for code slices; audit verified by code-search/document consistency. Watch: next FE-698 slices still need the capability registry skeleton, broader context-pack scenarios, real provider/harness execution probes, and/or Pi adapter spike work.
- [2026-05-07] Side-chat V2 — Edit / Drill-down / Propose-edge plumbing (FE-673, PR #97) — added `edit`, `edge`, and `drill-down` patch kinds. Server `classifyEditImpact` returns `none | soft | hard`; soft applies directly with undo, hard returns `deferred: true` placeholder. Client: patch-list reducer + three applier factories with real undo handlers. Verified: `npm run verify` (935 tests, 19 new). Watch: `SideChatPopover` Edit button stays `disabled` and hard-impact deferred banner is live until V3.0 lands.
- [2026-05-06] Multi-chat substrate + reconciliation needs (FE-697) — `chat` table with one interview chat per spec, nullable `turn.chat_id`, `specification.primary_chat_id`, mirrored `chat.active_turn_id`, plus the `reconciliation_need` queue with directed source/target items, narrow `kind`/`status`, partial unique index on open rows, cascade FK. Spec creation inserts spec + interview chat in one transaction; `advanceHead` is transactional. No user-visible change. Verified: `npm run verify` (673 tests) plus manual fixture playback (39 specs / 81 turns / dual-pointer equivalence). A82 / A83 validated for Phase 1.
- [2026-05-04] Graph view structured-list peer route — `/specification/$id/graph` now renders project-wide entities through the structured-list layout with relationship subsections, relation chips, empty state, row controls, and a back-to-chat affordance. Follow-up active-path filtering and spatial canvas remain horizon work. Verified: `npm run verify` in the FE-643 slice family.
- [2026-05-01] Side-chat V1.1 — Explore vertical slice. End-to-end graph-launched chat interaction shipped: prompt builder, POST `/side-chat` SSE endpoint, popover host, graph-view wiring, SSE consumer, and active-button activation. Follow-up refactor collapsed pending assistant text into the message list and extracted `SideChatHost` so activation is a tree-mount fact.
- [2026-04-30] FE-650 streamed question cache promotion — `ask_question` tool execution now advances the active frontier, returns the acknowledged turn id, interviewer streams emit a post-finalize `frontier-turn-ready` event, and the client promotes that streamed question into the specification bundle query cache before refetch reconciliation. Verified: `npm run verify` plus dev-mode manual retry; the formerly visible inert-card gap is improved. Watch: if residual scroll jumps persist, inspect remaining pane-wide rerender boundaries around workspace stream projection.
- [2026-04-30] FE-639 relation-first observer capture first cut — eligible answered turns now enter one background observer-capture backlog, observer prompts use compact existing-knowledge anchors, observer output persists validated graph-delta relationship candidates, and accepted review grounding refs reuse the same conservative relation policy. Verified: `npm run verify`. Watch: A66 remains open until corpus/manual graph-review proves edge precision and density are useful.
- [2026-04-27] Runtime JSON payload hardening — Express API parsing now accepts chat-sized request bodies above the default parser ceiling and returns a JSON 413 response instead of Express HTML when a payload exceeds the app limit. Verified: `npm run verify`. Watch: if real chat requests still exceed the 5 MB limit, investigate client history / tool-result pruning rather than only raising the ceiling.
- [2026-04-24] Distribution hardening release path — `package.json` now declares the Node 22+ engine floor, explicit shipped files, and public scoped publish config; `npm run release` drives release-it at repo root, rebuilds and dry-runs the packaged artifact, and documents npm auth prerequisites. Verified: `npm run verify`. Watch: CI trusted publishing is still intentionally out of scope.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Agent/semantic substrate
multi-chat-substrate + reconciliation-needs  (completed)
  ├──→ prompt/context scenario substrate  (completed)
  │     ├──→ intent graph semantics + progressive checkability  (next)
  │     ├──→ generative prompt probes before UI  (next)
  │     │     ├──→ productized web research capability  (horizon)
  │     │     ├──→ productized candidate-spec completion assist  (horizon)
  │     │     └──→ post-spec oracle/decomposition frontier  (probe/future product)
  │     └──→ continuous-workspace  (next, independent UI track but graph-context aware)
  └──→ semantic-changeset ledger  (horizon)
        ├──→ relation-first observer enrichment  (horizon, after ontology/policy probes)
        └──→ architect-loop  (horizon, proposal-only until changeset/reconciliation path)

TRACK B — Graph/workspace surfaces
graph-view-structured-list  (completed)
  ├──→ active-path-filter-and-scope-toggle  (horizon, blocked on server data-layer)
  ├──→ spatial-canvas-layout  (horizon)
  └──→ multi-chat-substrate + reconciliation-needs  (completed)
        ├──→ side-chat-V2-plumbing  (completed, FE-673 PR #97)
        │     └──→ side-chat-V3.0-cascade-through-reconciliation_need  (active, FE-674; absorbs V2 UI trigger as scope card)
        │           └──→ side-chat-V3.1-agent-grouped-resolution  (horizon)
        ├──→ persistent-side-chat-history  (future user surface)
        └──→ semantic-changeset ledger  (horizon)

TRACK B — Infrastructure
multi-chat-substrate  (completed)
  ├──→ semantic-changeset ledger  (horizon)
  └──→ continuous-workspace  (next)



UNBLOCKED HORIZON
first-run provider setup  (needs provider spike / scope)
workspace hygiene gitignore assist  (bounded, dashboard-surface candidate)
intent-spec ontology + progressive checkability  (needs probe)
relation-first observer capture  (first cut complete, needs enrichment proving)
knowledge-edge semantics policy  (discussion/design before observer expansion)
web-research tools  (gate ready, needs tool impl)
dashboard metrics
two-axis interview framing
progressive detail / recursive deflation
revisit / edit-mode  (reshaped by reconciliation needs + changeset ledger)
structured development spec registry  (tooling experiment)
portability boundaries  (deferred until substrate goal exists)
```

