<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, and the first relation-first observer capture seam all ship as working product. The live frontier now centers on the **multi-chat substrate**: introducing chat containers and reconciliation needs as the first durable foundation for side-chats, direct graph edits, revisit/cascade, and future semantic patch history.

The May 2026 intent-spec, multi-chat, and patch-ledger design notes are now reconciled into one direction. `docs/design/MULTI_CHAT.md` is the concrete phase-one substrate proposal; `docs/design/PATCH_LEDGER.md` remains deeper design pressure for semantic mutation history; `docs/design/INTENT_SPEC_EVOLUTION.md` carries the broader synthesis. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` (canonical reference for the FE-700 frontier) and `docs/design/BEHAVIORAL_KERNELS.md` (canonical reference for the FE-702 kernel probes). The dev-layer self-tooling trajectory — the `ln-*` skill family, the proposed file-backed spec registry, and the long-horizon convergence between dev and product ontologies — lives in `docs/design/DEV_WORKFLOW_EVOLUTION.md`. Older portability work remains a future-facing boundary map rather than a live roadmap item until a hosted, remote, or adapter-backed substrate becomes a product goal.

## Active

### Track B — Infrastructure

1. **Multi-chat substrate + reconciliation needs** — add durable `chat` containers, transitional `turn.chat_id`, `specification.primary_chat_id`, mirrored `chat.active_turn_id`, and a minimal `reconciliation_need` queue while keeping legacy spec-scoped pointers during the first slice.
   - Why now / unlocks: side-chats, direct graph edits, revisit/cascade, and architect-style proposals all need a substrate below `specification` before a full patch ledger exists. This slice relieves the one-rope-per-spec pressure without making semantic changesets first-class yet.
   - Recommended shape: follow `docs/design/MULTI_CHAT.md`; keep `turn.specification_id` and `specification.active_turn_id` during phase one; populate both legacy and chat pointers on new writes; add application assertions for same-spec and same-chat ancestry; create item-to-item reconciliation needs from semantic edge traversal first; carry `caused_by_turn_id` now and nullable `caused_by_patch_id` as a future placeholder.
   - Traceability: Requirement 39; A71, A82, A83; D135, D137, D138; I111.
   - Design doc: `docs/design/MULTI_CHAT.md`.

## Next

2. **Prompt/context scenario substrate** — externalize server-side prompts and reusable agent doctrines into markdown assets; add typed prompt loading/composition, graph context-pack builders, and a lightweight scenario runner for pre-UI prompt probes. Include a Pi SDK/RPC spike as a candidate harness adapter for tool and agent-flow experiments, without adopting Pi as product runtime truth.
   - Linear: FE-698. Pi harness spike: FE-635.
   - Why now / unlocks: multi-chat removes the single transcript spine as default agent context, while ontology, observer, candidate-spec, web research, behavioral-kernel, architect, and post-spec decomposition work all need shared prompt/context machinery. This prevents every future agent feature from inventing its own prompt-context hack and lets LLM-heavy flows be tested before UI work.
   - Recommended shape: inventory current interviewer/observer prompts; move prompt text and reusable policies into packaged markdown; define scenario-specific context packs for observer capture, next-question generation, candidate-spec synthesis, criteria/witness generation, web research, reconciliation, architect proposals, and decomposition/oracle probes; build a CLI/test runner that captures rendered prompt, context pack, model/provider settings, raw output, structured parse status, and review notes; add a Brunch-owned agent capability / mutation-surface registry with stable ids, schemas, authority metadata, and adapter-neutral contracts that scenario probes and future CLI/TUI/Pi harnesses can reference, while keeping execution adapters and durable mutating handlers out of the first slice unless they are read-only/proposal-only. The key rule is that future agent-originated writes must go through Brunch-owned handlers rather than direct ORM access.
   - Verification approach: inner-loop prompt-loader/context-pack unit tests plus seeded scenario snapshots; middle-loop multi-run prompt probes should be designed before judging generative quality.
   - Traceability: Requirements 40, 41, 42; A84, A85, A86, A87; D139, D140, D141, D142, D143; I112.
   - Design docs: `docs/design/INTENT_SPEC_EVOLUTION.md`; `docs/design/MULTI_CHAT.md`; Pi SDK docs as spike input.

3. **Intent graph semantics + progressive checkability foundation** — refine the ontology and relation policy so the graph can represent invariants, examples/counterexamples, constraint subtypes, narrowed decisions, witness strength, and checkability gaps as source/destination material for future generative features.
   - Linear: FE-700.
   - Why now / unlocks: candidate generation, behavioral kernels, architect proposals, and downstream verification-aware decomposition need a sharper semantic target than the current exploration/review ontology.
   - Recommended shape: add `invariant` and `example` as first-class durable kinds; subtype examples (positive / negative / edge-case / trace / not-relevant); narrow `decision` per the decision-capture criteria; enrich `constraint` subtypes (non_goal / scope / technical / policy / resource / compatibility / environmental); add `criterion` subtypes (acceptance / test / manual_review / runtime_check / proof / observability) and `invariant` subtypes (state / transition / authority / provenance / consistency / security / data_integrity); add `checkability` and `witness strength` fields on claims per the progressive-checkability ladder; introduce the five-family relation taxonomy (justification / dependency / boundary / refinement / verification) plus first-class negative relations (`rules_out`, `counterexample_for`); add edge epistemic metadata (`support`, `status`, `provenanceTurnId`, `rationale`); land a relation-policy registry whose axes distinguish `visible`, `cascade`, `export_trace`, `staleness`, `reconciliation`, `criteria_help`, and `weak_suggestion` participation. Full enumerations and worked examples in `docs/design/INTENT_GRAPH_SEMANTICS.md`.
   - Verification approach: corpus/fixture observer probes comparing old vs refined ontology; graph-review manual assessment for precision/noise; context-pack probe outputs must show authority and witness labels.
   - Traceability: Requirement 38; A77, A78, A80, A81, A84; D134, D136, D137, D139, D140.
   - Design docs: `docs/design/INTENT_GRAPH_SEMANTICS.md` (canonical reference); `docs/design/INTENT_SPEC_EVOLUTION.md` (broader synthesis context).

4. **Generative prompt probes before UI** — use the scenario substrate to prototype web research, behavioral kernels, candidate-spec completion, and post-spec design/oracle/decomposition flows against intent-graph fixtures before committing product surfaces.
   - Linear: FE-702 for post-spec decomposition probes; FE-649 and FE-640 are productization children under FE-698.
   - Why now / unlocks: proves whether progressive checkability and graph-first context can be taught to agents, and de-risks the next generation of UI features.
   - Recommended shape: start with one web-research context/query scenario, the first three behavioral kernels (`state & lifecycle`, `containment & topology`, `authority & capability`) per the v0.1 kernel ontology, candidate-spec set generation, and exploratory oracle/decomposition scenarios inspired by `.agents/skills/ln-design/` and `.agents/skills/ln-oracles/`. Each kernel probe should follow the kernel-card structure (detection signals, contrastive question templates, artifact schema, validators) and emit typed claims/edges per `docs/design/INTENT_GRAPH_SEMANTICS.md`. Outputs remain probe artifacts or proposal-only structures, not committed graph mutations.
   - Verification approach: scenario-runner fixtures, raw output review, structured parse validation, and qualitative scorecards before product UI.
   - Traceability: Requirements 20, 21, 31, 32, 40, 41; A67, A68, A80, A85, A87; D126, D127, D139, D141.
   - Design docs: `docs/design/BEHAVIORAL_KERNELS.md` (kernel ontology + cards); `docs/design/INTENT_GRAPH_SEMANTICS.md` (artifact target).

5. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and the single actionable frontier preserved at the current reachable phase.
   - Why now / unlocks: workflow read/write ownership is extracted; the multi-chat substrate clarifies the difference between conversation containers and workflow state so continuous workspace can adopt one visible runtime without smuggling in a second durable workflow model.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`.

## Horizon

### Intent graph and reconciliation

- **Semantic changeset / patch ledger** — make semantic mutations first-class once non-primary surfaces can change graph truth.
  - Linear: FE-701.
  - Recommended shape: prefer the invariant "one semantic mutation set contains one or more atomic changes"; naming remains open between `changeset` / `change` and `patch` / `patch_change`. Connect `reconciliation_need.caused_by_patch_id` once patches exist.
  - Depends on: multi-chat substrate + reconciliation needs; prompt/context context packs for reconciliation scenarios.
  - Traceability: A71, A79, A83; D135, D138, D140.
  - Design doc: `docs/design/PATCH_LEDGER.md`.

- **Relation-first observer capture enrichment** — after the next ontology/relation-policy probes, broaden observer relationship extraction across the refined ontology where edge support and operational participation are understood.
  - Recommended shape: keep `runObserver()` as the public turn-owned seam, but feed it scenario-specific context packs and validate output through the relation-policy registry. The FE-639 first cut has landed; remaining work should be driven by corpus/manual proving.
  - Depends on: prompt/context substrate; intent graph semantics + progressive checkability foundation.
  - Traceability: Requirements 30, 38, 40; A66, A81, A84; D125, D136, D137, D139, D140; I109.

- **Architect / generator loop** — autonomous agent that iterates over the intent graph and proposes semantic changes for HITL review through the same future changeset / reconciliation pathway as user-driven edits.
  - Recommended shape: keep productized architect proposals behind multi-chat + reconciliation + semantic changesets; use the scenario substrate for shadow/proposal-only probes first.
  - Traceability: A73, A85, A87; D139, D141; depends on chat containers + reconciliation needs and semantic changeset / patch ledger.

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

- [2026-05-07] FE-698 prompt/context scenario substrate — Packaged markdown prompt registry + observer context-pack foundation + scenario runner capture skeleton/composition. Server interviewer, observer, and side-chat role prompts now load from markdown assets through a typed prompt registry, observer capture renders its existing prompt context through the first typed scenario-specific context pack, and seeded observer-capture prompt scenarios now compose the production observer prompt with typed context-pack output into deterministic no-provider probe artifacts. Review fixes moved observer prompt composition into a pure module and made prompt scenario prompt sources explicit. Verified: `npm run verify`. Watch: next FE-698 slices still need broader context-pack scenarios, real provider/harness execution probes, and/or Pi adapter spike work.
- [2026-05-01] Side-chat V1.1 — Explore vertical slice. End-to-end graph-launched chat interaction shipped: prompt builder, POST `/side-chat` SSE endpoint, popover host, graph-view wiring, SSE consumer, and active-button activation. Follow-up refactor collapsed pending assistant text into the message list and extracted `SideChatHost` so activation is a tree-mount fact. This is complete implementation history; future conceptual work is multi-chat / reconciliation, not Side-chat V2/V3.
- [2026-05-04] Graph view structured-list peer route — `/specification/$id/graph` now renders project-wide entities through the structured-list layout with relationship subsections, relation chips, empty state, row controls, and a back-to-chat affordance. Follow-up active-path filtering and spatial canvas remain horizon work. Verified: `npm run verify` in the FE-643 slice family.
- [2026-04-30] FE-639 relation-first observer capture first cut — eligible answered turns now enter one background observer-capture backlog, observer prompts use compact existing-knowledge anchors, observer output persists validated graph-delta relationship candidates, and accepted review grounding refs reuse the same conservative relation policy. Verified: `npm run verify`. Watch: A66 remains open until corpus/manual graph-review proves edge precision and density are useful.
- [2026-04-29] Workflow ownership extraction (FE-616) — workflow projector extraction, turn-response transition extraction, chat-route transition/application extraction, and phase-close / force-close write-path ownership now live behind runtime-owned seams. Verified: `npm run verify`. Unblocks continuous workspace.
- [2026-04-27] Runtime JSON payload hardening — Express API parsing now accepts chat-sized request bodies above the default parser ceiling and returns a JSON 413 response instead of Express HTML when a payload exceeds the app limit. Verified: `npm run verify`. Watch: if real chat requests still exceed the 5 MB limit, investigate client history / tool-result pruning rather than only raising the ceiling.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Agent/semantic substrate
multi-chat-substrate + reconciliation-needs  (active)
  ├──→ prompt/context scenario substrate  (next)
  │     ├──→ intent graph semantics + progressive checkability  (next)
  │     ├──→ generative prompt probes before UI  (next)
  │     │     ├──→ productized web research capability  (horizon)
  │     │     ├──→ productized candidate-spec completion assist  (horizon)
  │     │     └──→ post-spec oracle/decomposition frontier  (probe/future product)
  │     └──→ continuous-workspace  (next, independent UI track but graph-context aware)
  └──→ semantic-changeset / patch-ledger  (horizon)
        ├──→ relation-first observer enrichment  (horizon, after ontology/policy probes)
        └──→ architect-loop  (horizon, proposal-only until patch/reconciliation path)

TRACK B — Graph/workspace surfaces
graph-view-structured-list  (completed)
  ├──→ active-path-filter-and-scope-toggle  (horizon, blocked on server data-layer)
  └──→ spatial-canvas-layout  (horizon)

UNBLOCKED HORIZON
first-run provider setup  (needs provider spike / scope)
workspace hygiene gitignore assist  (bounded, dashboard-surface candidate)
dashboard metrics
two-axis interview framing
progressive detail / recursive deflation
revisit / edit-mode  (reshaped by reconciliation needs + patch ledger)
structured development spec registry  (tooling experiment)
portability boundaries  (deferred until substrate goal exists)
```
