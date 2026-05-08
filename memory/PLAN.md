<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, the first relation-first observer capture seam, and the multi-chat substrate (chat containers + `reconciliation_need` queue) all ship as working product. FE-698's prompt/context scenario substrate has also landed from `main`, giving future agent-heavy work a packaged prompt registry, typed context packs, and repeatable prompt probes. Side-chat V2 plumbing — `edit` / `edge` / `drill-down` patch kinds with server route, reducer, and undo-capable appliers — is branch-complete on FE-673 (PR #97) but ships without its user-facing Edit-mode trigger, leaving a follow-up gap captured under Next. The live frontier is **continuous workspace**, the phase-addressable interview surface that adopts one visible runtime per specification.

The May 2026 intent-spec, multi-chat, changeset-ledger, prompt/context, and agent-mutation design notes are reconciled into one direction. `docs/design/MULTI_CHAT.md` is the now-shipped phase-one substrate. `docs/design/SIDE_CHAT.md` describes side-chat V2 / V3 / V4 phasing on top of that substrate. `docs/design/PATCH_LEDGER.md` remains historical deeper design pressure for semantic mutation history, but canonical future-facing vocabulary is `changeset` / `change`; `docs/design/INTENT_SPEC_EVOLUTION.md` carries the broader synthesis. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` (canonical reference for the FE-700 frontier) and `docs/design/BEHAVIORAL_KERNELS.md` (canonical reference for the FE-702 kernel probes). The dev-layer self-tooling trajectory — the `ln-*` skill family, the proposed file-backed spec registry, and the long-horizon convergence between dev and product ontologies — lives in `docs/design/DEV_WORKFLOW_EVOLUTION.md`. Older portability work remains a future-facing boundary map rather than a live roadmap item until a hosted, remote, or adapter-backed substrate becomes a product goal.

## Active

1. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and the single actionable frontier preserved at the current reachable phase.
   - Why now / unlocks: workflow read/write ownership is extracted (FE-616); the multi-chat substrate (FE-697) ships chat containers below the specification, so continuous workspace can adopt one visible runtime without smuggling in a second durable workflow model. Side-chat V2 plumbing is branch-complete (FE-673), so refinement-from-graph already has the patch-list + applier seams to land on top of the cumulative surface.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`.

## Next

2. **Side-chat V2 UI trigger** — enable the disabled Edit-mode button in `SideChatPopover` and wire `onClick` to stage an `EditPatch` through the existing `makeEditApplier` seam, surfacing soft / hard impact through the patch-list entry copy.
   - Why now / unlocks: closes the gap between the V2 design (`docs/design/SIDE_CHAT.md` §9: V2 ships the user-facing Edit / Drill-down / Propose-edge trigger) and the V2 implementation (FE-673 shipped server route + reducer + applier + tests but left the `SideChatPopover` `Edit (coming in V2)` button stubbed). Without this, V2 plumbing is unreachable from the running app and the soft-impact edit round-trip can only be exercised via curl or unit tests.
   - Recommended shape: small follow-up under FE-673; un-stub the button, derive `EditPatch` payload from active pinned item + composer text via the existing chat surface, route through the same patch-list overlay used by V1 annotate. Hard-impact responses defer to V3 with the existing "feature coming" message.
   - Traceability: Requirement 10; A48; D135.
   - Design doc: `docs/design/SIDE_CHAT.md` §5.1, §9.

3. **Side-chat V3 — hard-impact edit + cascade preview** — replace the V2 hard-impact placeholder with cascade preview inline plus a batch-resolution secondary-thread mode in the side-chat panel, reading from the `reconciliation_need` queue.
   - Why now / unlocks: the substrate ships the `reconciliation_need` table with directed source/target items + lifecycle (FE-697), which V3 was waiting on. The retired `revisit_session` shape from `docs/archive/design/REVISIT_MODULE.md` is superseded by this path per D135.
   - Recommended shape: hard-impact `PATCH /api/specifications/:id/knowledge-items/:itemId` enqueues `reconciliation_need` rows from semantic edge traversal; the panel renders cascade preview off that queue and offers per-item resolution turns inside a side-chat sub-thread. Side-chats reuse the substrate's chat container so the secondary thread is a sibling chat, not a turn-tree branch.
   - Depends on: Side-chat V2 UI trigger (item 2).
   - Traceability: Requirement 10; A48, A49; D80, D135, D137, D138; I111.
   - Design doc: `docs/design/SIDE_CHAT.md` §5.2, §9.


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

- [2026-05-07] FE-698 prompt/context scenario substrate — Packaged markdown prompt registry + observer context-pack foundation + scenario runner capture skeleton/composition + agent mutation-surface audit. Server interviewer, observer, and side-chat role prompts now load from markdown assets through a typed prompt registry, observer capture renders its existing prompt context through the first typed scenario-specific context pack, and seeded observer-capture prompt scenarios now compose the production observer prompt with typed context-pack output into deterministic no-provider probe artifacts. Review fixes moved observer prompt composition into a pure module and made prompt scenario prompt sources explicit. The agent mutation-surface audit inventories current and projected agent-originated write paths as input to the registry/handler slices. Verified: `npm run verify` for code slices; audit verified by code-search/document consistency. Watch: next FE-698 slices still need the capability registry skeleton, broader context-pack scenarios, real provider/harness execution probes, and/or Pi adapter spike work.
- [2026-05-07] Side-chat V2 — Edit / Drill-down / Propose-edge plumbing (FE-673, PR #97) — added `edit`, `edge`, and `drill-down` patch kinds to the V1 patch-list seam. Server: `classifyEditImpact` returns `none | soft | hard`; `PATCH /api/specifications/:id/knowledge-items/:itemId` applies `none` / `soft` impact and returns `previousContent` / `previousRationale` for undo while hard impact defers; `POST` / `DELETE /api/specifications/:id/knowledge-edges` create and remove edges through one shared Zod payload schema. Client: patch-list reducer extended with `EditPatch` / `EdgePatch` / `DrillDownPatch`; three applier factories (`makeEditApplier` / `makeEdgeApplier` / `makeDrillDownApplier`) with real undo handlers (re-PATCH for edit, DELETE for edge, throw "not yet implemented in V2" for drill-down). Verified: `npm run verify` (935 tests, 19 new). Watch: the `SideChatPopover` `Edit (coming in V2)` button remains hardcoded `disabled` — the V2 plumbing is reachable today only via curl or unit tests. Successor work is the **Side-chat V2 UI trigger** Next item; V3 hard-impact cascade absorbs the deferred hard-impact path via the new `reconciliation_need` queue.
- [2026-05-06] Multi-chat substrate + reconciliation needs (FE-697) — `chat` table with one interview chat per spec, nullable `turn.chat_id`, `specification.primary_chat_id`, mirrored `chat.active_turn_id`, plus the `reconciliation_need` queue with directed source/target items, narrow `kind`/`status`, partial unique index on open rows, and cascade FK to knowledge items. Spec creation now inserts spec + interview chat in one transaction; turn writes populate both legacy and chat pointers; `advanceHead` is transactional and mirrors to the interview chat; parent-chat consistency is asserted at the application layer. No user-visible change. Migrations 0014–0017 backfill existing data, slotted above FE-656's `0013_annotation` to avoid timestamp collision. Verified: `npm run verify` (673 tests) plus manual fixture playback per `docs/design/MULTI_CHAT.md` §8 against a real `.brunch/brunch.db` (39 specs / 39 interview chats / 81 turns / dual-pointer equivalence holds for every spec). Watch: legacy `turn.specification_id` and `specification.active_turn_id` remain alongside the new chat pointers — cleanup migration is deferred until callers read ownership through `chat_id`. A82 and A83 validated for the Phase 1 substrate.
- [2026-05-01] Side-chat V1.1 — Explore vertical slice. End-to-end graph-launched chat interaction shipped: prompt builder, POST `/side-chat` SSE endpoint, popover host, graph-view wiring, SSE consumer, and active-button activation. Follow-up refactor collapsed pending assistant text into the message list and extracted `SideChatHost` so activation is a tree-mount fact. This is complete implementation history; future conceptual work is multi-chat / reconciliation, not Side-chat V2/V3.
- [2026-05-04] Graph view structured-list peer route — `/specification/$id/graph` now renders project-wide entities through the structured-list layout with relationship subsections, relation chips, empty state, row controls, and a back-to-chat affordance. Follow-up active-path filtering and spatial canvas remain horizon work. Verified: `npm run verify` in the FE-643 slice family.

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
        │     ├──→ side-chat-V2-UI-trigger  (next)
        │     └──→ side-chat-V3-hard-impact-cascade  (next, depends on V2 trigger)
        ├──→ persistent-side-chat-history  (future user surface)
        └──→ semantic-changeset ledger  (horizon)
              └──→ architect-loop  (horizon)

TRACK B — Infrastructure
multi-chat-substrate  (completed)
  ├──→ semantic-changeset ledger  (horizon)
  └──→ continuous-workspace  (active)


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

