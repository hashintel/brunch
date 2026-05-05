<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, relation-first observer capture, and Side-chat V1.1's Explore vertical slice all ship as working product.

Side-chat V1.1 should now be treated as complete implementation history. The old side-chat conceptual roadmap is superseded by the multi-chat substrate, reconciliation-needs, and semantic changeset / patch-ledger direction. Future graph-anchored chat, edit, annotation, revisit, and architect-loop work should be planned through that multi-chat / reconciliation frame rather than as Side-chat V2/V3/V4.

The live frontier centers on **continuous workspace**: turning phase-addressable routes into one cumulative interview surface without adding a second durable workflow model. The May 2026 intent-spec, multi-chat, and patch-ledger design notes are promoted into the canonical horizon as design pressure, not as active implementation scope. Older portability work remains a future-facing boundary map rather than a live roadmap item until a hosted, remote, or adapter-backed substrate becomes a product goal.

## Active

### Track B — Infrastructure

1. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and the single actionable frontier preserved at the current reachable phase.
   - Why now / unlocks: workflow read/write ownership is now extracted, so the continuous workspace can adopt one chat runtime and section-addressable focus without route remounts owning lifecycle truth.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102, I110.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`.

## Next

2. **Multi-chat substrate + reconciliation needs scope** — scope the first persistence foundation for graph-anchored chats, revisit/cascade, and future semantic edits: durable chat containers plus reconciliation needs, while preserving turn-linked provenance during the transition.
   - Why now / unlocks: Side-chat V1.1 proved the graph-launched chat interaction, but its conceptual docs are superseded. Multi-chat containers and reconciliation needs are the next durable substrate before graph edits, patch ledger, or architect-loop work.
   - Traceability: Requirement 10; A48, A49, A71, A72; D80, D139.
   - Design docs: `docs/design/PATCH_LEDGER.md`; `docs/design/multi-chat-substrate-rfc.md` if retained in the repo.

## Horizon

### Intent graph and reconciliation

- **Intent-spec ontology + progressive checkability** — move Brunch's product output from prose-centered planning specs toward intent graphs: typed claims, semantic edges, examples / counterexamples, unresolved ambiguity, user validation status, and witness strength from prose through tests / contracts / invariants / proof obligations.
  - Recommended shape: prototype ontology additions (`invariant`, `example`) and a `Property`-like normalization layer in design probes before committing schema; keep requirements and criteria distinct as commitment vs oracle.
  - Traceability: A77, A78, A79; D138.
  - Design doc: `docs/design/INTENT_SPEC_EVOLUTION.md`.

- **Chat containers + reconciliation needs** — introduce conversation containers and durable reconciliation queues before full semantic patch history. This becomes the first persistence foundation for graph edits, graph-anchored chat, and revisit/cascade.
  - Recommended shape: add `chat` and `reconciliation_need` in a phase-one slice; keep `turn.specification_id` and turn-linked provenance during the transition; create needs from semantic edge traversal first.
  - Supersedes: the old side-chat V2/V3 conceptual roadmap and `docs/design/REVISIT_MODULE.md`'s `revisit_session` table shape as preferred persistence foundations, while keeping the user-facing graph-chat and revisit/cascade capabilities.
  - Traceability: Requirement 10; A48, A49, A71, A72; D80, D139.
  - Design doc: `docs/design/PATCH_LEDGER.md`.

- **Semantic changeset / patch ledger** — make semantic mutations first-class once non-primary surfaces can change graph truth.
  - Recommended shape: prefer the invariant "one semantic mutation set contains one or more atomic changes"; naming remains open between `changeset` / `change` and `patch` / `patch_change`.
  - Depends on: chat containers + reconciliation needs.
  - Traceability: A72; D139.
  - Design doc: `docs/design/PATCH_LEDGER.md`.

- **Relation-first observer capture proving** — evaluate whether the FE-639 relation-first graph-delta seam produces useful edge density for graph view, export grounding, and future revisit/cascade work before expanding extraction rules.
  - Recommended shape: run observer corpus probes and manual transcript review against representative greenfield/brownfield specs, inspect projected `EntitiesData.relationships` in graph/export surfaces, and decide whether the next increment should widen prompt context, add cross-turn enrichment, introduce confidence/review affordances, or leave the conservative policy unchanged.
  - Traceability: Requirements 30, 33; A66; D50, D80, D125, D128; I109.

- **Behavioral kernel cards** — detect recurring correctness patterns such as state/lifecycle, containment, authority, concurrency, transactions, migration, and evidence; ask contrastive questions and emit progressively checkable artifacts.
  - Recommended shape: prototype one or two kernels as interviewer machinery before adding visible product UI.
  - Traceability: A79; D138.

- **Architect / generator loop** — autonomous agent that iterates over the intent graph and proposes semantic changes for HITL review through the same future changeset / reconciliation pathway as user-driven edits.
  - Recommended shape: keep this behind multi-chat + reconciliation + semantic changesets; run in shadow mode before user-visible proposal flows.
  - Traceability: A73; depends on chat containers + reconciliation needs and semantic changeset / patch ledger.

### User-facing capabilities

- **First-run provider setup** — make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer / observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
  - Linear: FE-633 covers the OpenRouter/default-provider part; dashboard credential UX + XDG key storage may need a sibling issue if split from provider proving.
  - Recommended shape: prove the provider resolver first with current Anthropic behavior, then spike OpenRouter against tool use, structured output, and reasoning/thinking options before making it the default. The dashboard should expose credential status without leaking secret values and offer setup before the user starts a specification.
  - Traceability: Requirements 35, 36, 37; A74, A75; D134, D135, D136; I106.

- **Workspace hygiene / `.brunch/` gitignore assist** — detect whether generated local state is already ignored and, with explicit confirmation, add an idempotent `.gitignore` entry or create `.gitignore` when absent.
  - Linear: FE-648.
  - Recommended shape: keep this as a deterministic local mutation with preview/confirmation semantics; it can ship independently, but the dashboard is the natural surface because it already explains workspace binding and first-run setup.
  - Traceability: Requirement 38; A76; D137; I107.

- **Web research as a context-gathering capability** — web search and page-fetch tools as interviewer-invoked context gathering, surfaced as preface cards. The tool gate and preface lifecycle are ready; this adds new tool implementations.
  - Linear: FE-649.
  - Traceability: Requirements 20, 21; D99, D112.

- **Dashboard result summaries and completeness metrics** — progress visibility across specifications.

- **Two-axis interview framing** — adapt interviewer setup and questioning to the full `greenfield <> brownfield` by `end-to-end build <> incremental feature` matrix instead of treating partial-scope work as a special case.
  - Linear: FE-638.
  - Traceability: Requirement 29; A65; D124.

- **Candidate-spec completion assist** — replace skip-only remainder handling with a `fill in the rest for me` path that generates candidate specs, implications, and tradeoffs for reaction-based refinement.
  - Linear: FE-640.
  - Recommended shape: a turn-owned candidate-spec set artifact plus a structured reaction loop (`accept-direction`, `refine`, `regenerate`); accepting a candidate steers the next move but does not itself close the phase.
  - Traceability: Requirement 31; A67; D126.

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
  - Traceability: D138.
  - Design doc: `docs/design/INTENT_SPEC_EVOLUTION.md`.

- **Portability boundaries** — split durable store/read-model, interview session runtime, and workspace capability provider if Brunch targets hosted, remote, embedded, or sandbox-backed operation.
  - Status: deferred. Some enabling seams already exist (query domains, workflow projector, no persisted `cwd` on specifications), but adapter-backed portability is not on the live roadmap.
  - Design doc: `docs/design/PORTABILITY_BOUNDARIES.md`.

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
continuous-workspace  (active; unblocked by workflow ownership extraction)

UNBLOCKED HORIZON
first-run provider setup  (needs provider spike / scope)
workspace hygiene gitignore assist  (bounded, dashboard-surface candidate)
web-research tools  (gate ready, needs tool impl)
dashboard metrics
two-axis interview framing
observer graph enrichment proving
candidate-spec completion assist
progressive detail / recursive deflation
behavioral kernel cards
intent-spec ontology + progressive checkability  (needs probe)
structured development spec registry  (tooling experiment)
portability boundaries  (deferred until substrate goal exists)
```
