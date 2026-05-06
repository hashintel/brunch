<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, and the first relation-first observer capture seam all ship as working product. The live frontier now centers on the **multi-chat substrate**: introducing chat containers and reconciliation needs as the first durable foundation for side-chats, direct graph edits, revisit/cascade, and future semantic patch history.

The May 2026 intent-spec, multi-chat, and patch-ledger design notes are now reconciled into one direction. `docs/design/MULTI_CHAT.md` is the concrete phase-one substrate proposal; `docs/design/PATCH_LEDGER.md` remains deeper design pressure for semantic mutation history; `docs/design/INTENT_SPEC_EVOLUTION.md` carries broader ontology and progressive checkability implications. Older portability work remains a future-facing boundary map rather than a live roadmap item until a hosted, remote, or adapter-backed substrate becomes a product goal.

## Active

### Track B — Infrastructure

1. **Multi-chat substrate + reconciliation needs** — add durable `chat` containers, transitional `turn.chat_id`, `specification.primary_chat_id`, mirrored `chat.active_turn_id`, and a minimal `reconciliation_need` queue while keeping legacy spec-scoped pointers during the first slice.
   - Why now / unlocks: side-chats, direct graph edits, revisit/cascade, and architect-style proposals all need a substrate below `specification` before a full patch ledger exists. This slice relieves the one-rope-per-spec pressure without making semantic changesets first-class yet.
   - Recommended shape: follow `docs/design/MULTI_CHAT.md`; keep `turn.specification_id` and `specification.active_turn_id` during phase one; populate both legacy and chat pointers on new writes; add application assertions for same-spec and same-chat ancestry; create item-to-item reconciliation needs from semantic edge traversal first; carry `caused_by_turn_id` now and nullable `caused_by_patch_id` as a future placeholder.
   - Traceability: Requirement 39; A71, A82, A83; D135, D137, D138; I111.
   - Design doc: `docs/design/MULTI_CHAT.md`.

## Next

2. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and the single actionable frontier preserved at the current reachable phase.
   - Why now / unlocks: workflow read/write ownership is extracted; the multi-chat substrate clarifies the difference between conversation containers and workflow state so continuous workspace can adopt one visible runtime without smuggling in a second durable workflow model.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`.

## Horizon

### Intent graph and reconciliation

- **Intent-spec ontology + progressive checkability** — move Brunch's product output from prose-centered planning specs toward intent graphs: typed claims, semantic edges, examples / counterexamples, unresolved ambiguity, user validation status, and witness strength from prose through tests / contracts / invariants / proof obligations.
  - Recommended shape: add `invariant` and `example` as first-class durable ontology kinds, with positive / negative / edge-case / not-relevant examples represented as subtypes rather than separate top-level kinds; keep a `Property`-like normalization layer as a design candidate until the requirement / criterion mapping is clearer; update observer prompts, shared registries, API types, fixtures, and export language together.
  - Traceability: Requirement 38; A77, A81, A83; D134, D136.
  - Design doc: `docs/design/INTENT_SPEC_EVOLUTION.md`.

- **Observer ontology refinement** — narrow `decision`, enrich `constraint` subtypes, and add context-promotion rules so observer capture classifies claims by semantic modality rather than answer shape.
  - Recommended shape: update observer prompt first, then shared kind/subtype registries and fixtures; run corpus probes before schema migration.
  - Traceability: Requirement 38; D136.

- **Knowledge-edge semantics policy** — decide how far intent edges should go before broadening observer extraction: relation families, support strength, visibility, cascade participation, export relevance, staleness production, and suggestion handling.
  - Recommended shape: design relation policy and edge-local prompt context before implementing wider relation-first observer capture. Keep negative examples as intent content, boundary edges as intent semantics, and reconciliation needs as directed process debt rather than making graph edges double as work queue state.
  - Traceability: A81, A83; D135, D137, D138.
  - Deep design sources: `docs/design/INTENT_SPEC_EVOLUTION.md` §4; `docs/design/PATCH_LEDGER.md` §Reconciliation Need; `docs/design/MULTI_CHAT.md` §5.

- **Semantic changeset / patch ledger** — make semantic mutations first-class once non-primary surfaces can change graph truth.
  - Recommended shape: prefer the invariant "one semantic mutation set contains one or more atomic changes"; naming remains open between `changeset` / `change` and `patch` / `patch_change`.
  - Depends on: multi-chat substrate + reconciliation needs.
  - Traceability: A71, A83; D135, D138.
  - Design doc: `docs/design/PATCH_LEDGER.md`.

- **Relation-first observer capture** — expand observer relationship extraction so graph edges are captured across the ontology when reasonably traceable, not only for decisions and assumptions.
  - Recommended shape: keep `runObserver()` as the public turn-owned seam, but widen its internal output into a generic graph delta with server-owned provisional-reference resolution and typed relation-policy validation. The FE-639 first cut has landed; remaining work should be driven by corpus/manual proving.
  - Depends on: knowledge-edge semantics policy.
  - Traceability: Requirements 30, 33; A66, A81; D125, D134, D137; I109.

- **Behavioral kernel cards** — detect recurring correctness patterns such as state/lifecycle, containment, authority, concurrency, transactions, migration, and evidence; ask contrastive questions and emit progressively checkable artifacts.
  - Recommended shape: prototype one or two kernels as interviewer machinery before adding visible product UI.
  - Traceability: A80; D134.

- **Architect / generator loop** — autonomous agent that iterates over the intent graph and proposes semantic changes for HITL review through the same future changeset / reconciliation pathway as user-driven edits.
  - Recommended shape: keep this behind multi-chat + reconciliation + semantic changesets; run in shadow mode before user-visible proposal flows.
  - Traceability: A73; depends on chat containers + reconciliation needs and semantic changeset / patch ledger.

### User-facing capabilities

- **First-run provider setup** — make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer / observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
  - Linear: FE-633 covers the OpenRouter/default-provider part; dashboard credential UX + XDG key storage may need a sibling issue if split from provider proving.
  - Recommended shape: prove the provider resolver first with current Anthropic behavior, then spike OpenRouter against tool use, structured output, and reasoning/thinking options before making it the default. The dashboard should expose credential status without leaking secret values and offer setup before the user starts a specification.
  - Traceability: Requirements 34, 35, 36; A74, A75; D130, D131, D132; I106.

- **Workspace hygiene / `.brunch/` gitignore assist** — detect whether generated local state is already ignored and, with explicit confirmation, add an idempotent `.gitignore` entry or create `.gitignore` when absent.
  - Linear: FE-648.
  - Recommended shape: keep this as a deterministic local mutation with preview/confirmation semantics; it can ship independently, but the dashboard is the natural surface because it already explains workspace binding and first-run setup.
  - Traceability: Requirement 37; A76; D133; I107.

- **Web research as a context-gathering capability** — web search and page-fetch tools as interviewer-invoked context gathering, surfaced as preface cards. The tool gate and preface lifecycle are ready; this adds new tool implementations.
  - Linear: FE-649.
  - Traceability: Requirements 20, 21; D99, D112.

- **Dashboard result summaries and completeness metrics** — progress visibility across specifications.

- **Two-axis interview framing** — adapt interviewer setup and questioning to the full `greenfield <> brownfield` by `end-to-end build <> incremental feature` matrix instead of treating partial-scope work as a special case.
  - Linear: FE-638.
  - Traceability: Requirement 29; A65; D124.

- **Candidate-spec completion assist** — replace skip-only remainder handling with a `fill in the rest for me` path that generates candidate specs, implications, and tradeoffs for reaction-based refinement.
  - Traceability: Requirement 31; A67, A77, A78; D126, D134, D136.

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

- **Structured development spec registry** — prototype file-backed canonical spec records, deterministic checks, generated markdown views, and task-local slices for Brunch's own development workflow.
  - Status: design horizon, not a migration commitment.
  - Traceability: D134.
  - Design doc: `docs/design/INTENT_SPEC_EVOLUTION.md`.

- **Portability boundaries** — split durable store/read-model, interview session runtime, and workspace capability provider if Brunch targets hosted, remote, embedded, or sandbox-backed operation.
  - Status: deferred. Some enabling seams already exist (query domains, workflow projector, no persisted `cwd` on specifications), but adapter-backed portability is not on the live roadmap.
  - Deep design source: `docs/design/PORTABILITY_BOUNDARIES.md`.

- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.
- Git-friendly file-based persistence representation for diffable exported specs.
- Typed fixture-builder convergence for happy-path tests.

## Recently Completed

- [2026-05-01] Side-chat V1.1 — Explore vertical slice. End-to-end graph-launched chat interaction shipped: prompt builder, POST `/side-chat` SSE endpoint, popover host, graph-view wiring, SSE consumer, and active-button activation. Follow-up refactor collapsed pending assistant text into the message list and extracted `SideChatHost` so activation is a tree-mount fact. This is complete implementation history; future conceptual work is multi-chat / reconciliation, not Side-chat V2/V3.
- [2026-05-04] Graph view structured-list peer route — `/specification/$id/graph` now renders project-wide entities through the structured-list layout with relationship subsections, relation chips, empty state, row controls, and a back-to-chat affordance. Follow-up active-path filtering and spatial canvas remain horizon work. Verified: `npm run verify` in the FE-643 slice family.
- [2026-04-30] FE-639 relation-first observer capture first cut — eligible answered turns now enter one background observer-capture backlog, observer prompts use compact existing-knowledge anchors, observer output persists validated graph-delta relationship candidates, and accepted review grounding refs reuse the same conservative relation policy. Verified: `npm run verify`. Watch: A66 remains open until corpus/manual graph-review proves edge precision and density are useful.
- [2026-04-29] Workflow ownership extraction (FE-616) — workflow projector extraction, turn-response transition extraction, chat-route transition/application extraction, and phase-close / force-close write-path ownership now live behind runtime-owned seams. Verified: `npm run verify`. Unblocks continuous workspace.
- [2026-04-27] Runtime JSON payload hardening — Express API parsing now accepts chat-sized request bodies above the default parser ceiling and returns a JSON 413 response instead of Express HTML when a payload exceeds the app limit. Verified: `npm run verify`. Watch: if real chat requests still exceed the 5 MB limit, investigate client history / tool-result pruning rather than only raising the ceiling.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — User-facing / semantic surfaces
graph-view-structured-list  (completed)
  ├──→ active-path-filter-and-scope-toggle  (horizon, blocked on server data-layer)
  ├──→ spatial-canvas-layout  (horizon)
  └──→ multi-chat-substrate + reconciliation-needs  (next scope)
        └──→ semantic-changeset / patch-ledger  (horizon)
              └──→ architect-loop  (horizon)

TRACK B — Infrastructure
multi-chat-substrate  (active)
  ├──→ semantic-patch-ledger  (horizon)
  ├──→ persistent-side-chat-history  (future user surface)
  └──→ continuous-workspace  (next)

UNBLOCKED HORIZON
first-run provider setup  (needs provider spike / scope)
workspace hygiene gitignore assist  (bounded, dashboard-surface candidate)
intent-spec ontology + progressive checkability  (needs probe)
relation-first observer capture  (first cut complete, needs enrichment proving)
knowledge-edge semantics policy  (discussion/design before observer expansion)
revisit / edit-mode  (reshaped by reconciliation needs)
web-research tools  (gate ready, needs tool impl)
dashboard metrics
two-axis interview framing
candidate-spec completion assist
progressive detail / recursive deflation
behavioral kernels as elicitation machinery
semantic changeset / patch ledger  (after reconciliation needs)
structured development spec registry  (tooling experiment)
portability boundaries  (deferred until substrate goal exists)
```
