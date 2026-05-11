<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, the first relation-first observer capture seam, the multi-chat substrate (chat containers + `reconciliation_need` queue), **side-chat V3.0 — hard-impact cascade through `reconciliation_need`**, and **side-chat V3.1 — agent-grouped reconciliation resolution** all ship as working product. V3.1 closes the V3.x arc: the reconciliation classifier writes `auto-confirm` / `auto-edit` / `substantive` per row and the Pending review surface renders chips + per-class actions + bulk Confirm-all / Apply-all-suggested. The live frontier is now **continuous workspace**, the phase-addressable interview surface that adopts one visible runtime per specification.

The May 2026 intent-spec, multi-chat, changeset-ledger, prompt/context, and agent-mutation design notes are reconciled into one direction. `docs/design/MULTI_CHAT.md` is the substrate document. `docs/design/SIDE_CHAT.md` describes side-chat V1 / V2 / V3.0 / V3.1 / V4 phasing on top of that substrate, with §13 mapping each user-surface version onto a substrate phase. `docs/design/PATCH_LEDGER.md` remains historical deeper design pressure for semantic mutation history, but canonical future-facing vocabulary is `changeset` / `change`; `docs/design/INTENT_SPEC_EVOLUTION.md` carries the broader synthesis. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` (canonical reference for the FE-700 frontier) and `docs/design/BEHAVIORAL_KERNELS.md` (canonical reference for the FE-702 kernel probes). The dev-layer self-tooling trajectory — the `ln-*` skill family, the proposed file-backed spec registry, and the long-horizon convergence between dev and product ontologies — lives in `docs/design/DEV_WORKFLOW_EVOLUTION.md`. Older portability work remains a future-facing boundary map rather than a live roadmap item until a hosted, remote, or adapter-backed substrate becomes a product goal.


## Active

1. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and the single actionable frontier preserved at the current reachable phase.
   - Why now / unlocks: workflow read/write ownership is extracted (FE-616); the multi-chat substrate ships chat containers below the specification, so continuous workspace can adopt one visible runtime without smuggling in a second durable workflow model. Side-chat V3.0 + V3.1 just closed, so the cascade surface is stable; no remaining V2/V3 placeholder blocks the workspace work.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`.

## Next

2. **Side-chat persistence — V4a (multi-chat Phase 2 substrate)** — side-chat client persists its turns into the existing `chat` / `turn` tables with `chat.kind='side_chat'`, loads prior side-chat sessions on remount, and surfaces an "Old chats" affordance per pinned item / spec. Phase 1 substrate (FE-697, [2026-05-06]) already shipped the `chat` table, nullable `turn.chat_id`, and `specification.primary_chat_id`; nothing schema-side blocks this — only the client write path and a per-spec session listing remain. This is the V4a half of FE-675; V4b (item versioning + branched exploration) stays in Horizon, gated on FE-701.
   - Why later: side-chat threads stay in-memory through V3 by design (SIDE_CHAT.md §5.3); applied patches and `reconciliation_need` rows already persist independently. With V3.1 closed and the cascade surface settled, V4a becomes the next user-facing surface to light up — but Card 1 (server-side persistence) and Cards 2+ both depend on MULTI_CHAT.md §349's open question (anchor field on `chat` row vs deferred `chat_focus` table); route through `/ln-spec` or `/ln-spike` before scoping Cards 2+.
   - Linear: FE-675 (umbrella; per-substrate phase note on FE-675 rather than a new sub-ticket).
   - Traceability: Requirement 39; A82, A83; D138.
   - Design doc: `docs/design/MULTI_CHAT.md` §10 Phase 2; `docs/design/SIDE_CHAT.md` §9 V4 row (V4a half only).


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

- **Side-chat V4b — item versioning + branched exploration** — once the patch ledger lands, item versioning unblocks dangling-annotation repair and soft-edit audit; branched exploration lets drill-downs / past-turn edits / revisits coexist with the original chain. FE-675 V4b half.
  - Depends on: FE-701 patch ledger; V4a side-chat persistence (Next item 2).
  - Traceability: A72, A73, A85; D139, D141.
  - Design doc: `docs/design/SIDE_CHAT.md` §9 V4 row (V4b half).

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

- [2026-05-11] **Side-chat V3.1 — agent-grouped reconciliation resolution** (FE-674, PR #124 + downstack) — closes the V3.x arc end-to-end. Server: `POST /reconciliation-needs/run-agent` (spec-level classifier loop) and `POST /reconciliation-needs/:needId/reset-agent` (per-row Re-run) walk every awaiting open need through I114's `null → queued → classifying → classified | failed` lifecycle; agent_classification persists one of `auto-confirm` / `auto-edit` / `substantive`; agent_proposal carries an optional text suggestion. Client: `<ClassificationChip>` renders six visual variants per row; `<RunAgentButton>` in the Pending review header with conditional 1s polling while any need is in flight; per-row Re-run on classified/failed rows; per-class action buttons (`auto-confirm` → Confirm, `auto-edit` → View proposal + Apply + Skip, `substantive` → Open side-chat via `useSideChat().openFor`); bulk Confirm-all (N) and Apply-all-suggested (N) iterate serially over existing per-row endpoints. Listing endpoint extended with `target_item_kind` + `target_reference_code` to feed the Open-side-chat handoff. Verified: `npm run verify` 1178 / 1179 pass (one unrelated `side-chat-route` flake). **Watch**: A88 outer-loop walkthrough has not yet happened — empirical signal on whether agent grouping helps legibility vs V3.0's flat list remains open; capture qualitative notes during the next manual walkthrough on a dense spec.
- [2026-05-08] **Side-chat V3.0 — hard-impact cascade through `reconciliation_need`** (FE-674, PRs #115–#118) — three-card stack closes V3.0. Card 1 (#115): server `cascade-producer` + `getDownstreamEdges` + `openReconciliationNeedIfAbsent`; hard-impact apply mutates the source and opens one need per typed dependency edge; response shape adds `openedNeedIds`; partial-unique-index dedupe. Card 2 (#116): drop deferred banner; `GET /api/specifications/:id/reconciliation-needs` endpoint + `useSpecificationOpenReconciliationNeeds` query; Pending review section renders open needs with kind chip + source/target references. Card 3 (#117): idempotent `POST /reconciliation-needs/:needId/resolve` + per-row Resolve button. Polish (#118): extracted PendingReviewSection, suppressed Undo for hard, oracle assertions. Verified: `npm run verify` 1063 tests. Watch: V3.1 (agent-grouped resolution) cleared this watch on 2026-05-11.
- [2026-05-06] Multi-chat substrate + reconciliation needs (FE-697) — `chat` table with one interview chat per spec, nullable `turn.chat_id`, `specification.primary_chat_id`, mirrored `chat.active_turn_id`, plus the `reconciliation_need` queue. No user-visible change. A82 / A83 validated for Phase 1.


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
  │     └──→ continuous-workspace  (active, independent UI track but graph-context aware)
  └──→ semantic-changeset ledger  (horizon)
        ├──→ relation-first observer enrichment  (horizon, after ontology/policy probes)
        └──→ architect-loop  (horizon, proposal-only until changeset/reconciliation path)

TRACK B — Graph/workspace surfaces
graph-view-structured-list  (completed)
  ├──→ active-path-filter-and-scope-toggle  (horizon, blocked on server data-layer)
  ├──→ spatial-canvas-layout  (horizon)
  └──→ multi-chat-substrate + reconciliation-needs  (completed)
        ├──→ side-chat-V2-plumbing  (completed, FE-673 PR #97)
        │     └──→ side-chat-V3.0-cascade-through-reconciliation_need  (completed, FE-674)
        │           └──→ side-chat-V3.1-agent-grouped-resolution  (completed, FE-674 PR #124)
        │                 └──→ side-chat-persistence-V4a  (next, FE-675 V4a half)
        └──→ semantic-changeset ledger  (horizon)
              └──→ side-chat-V4b-item-versioning-+-branched-exploration  (horizon, FE-675 V4b half)

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
