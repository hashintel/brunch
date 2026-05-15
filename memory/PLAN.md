<!-- PLAN.md — single source of truth for WHAT'S NEXT.
     Created by ln-plan · Read by all skills · Updated by ln-build, ln-sync, and ln-spike.
     Authority: active frontier, near-horizon ordering, and dependencies that still matter.

     Frontier item = canonical plan/Linear/branch unit.
     Slice = scoped execution unit from ln-scope/ln-build, often inside one frontier.

     Keep this file light. Archive older completed work to docs/archive/PLAN_HISTORY.md.
     Edit Sequencing for ordering/status churn; keep Frontier Definitions relatively stable.
     Do not spread retired work history across handoff files, refactor plans, or ad hoc status notes. -->

# Plan

## Context

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, the first relation-first observer capture seam, the multi-chat substrate, side-chat V3.0 hard-impact cascade, and side-chat V3.1 agent-grouped reconciliation resolution all ship as working product.

The next product arc is a **continuous conversational workspace** plus a stronger semantic/generative substrate. Continuous workspace is active in a parallel lane and gives the chat runtime a stable phase-addressable host. The FE-705 branch contributes an integration substrate — a local agent capability CLI and external LLM-as-user probe harness — that should be reconciled into main before graph-review and scenario-options work depends on generated completed-spec fixtures. After that, the highest-coordination work is intent-graph semantics and the semantic changeset ledger; FE-701 should follow soon after the FE-705 reconciliation because the current schema already carries transitional multi-chat / reconciliation placeholders that only become coherent once `changeset` / `change` owns semantic mutation history. Lower-coordination provider, gitignore, and web-research work can proceed in parallel.

The May 2026 intent-spec, multi-chat, changeset-ledger, prompt/context, and agent-mutation design notes are reconciled into one direction. `docs/design/MULTI_CHAT.md` is the substrate document. `docs/design/SIDE_CHAT.md` describes side-chat V1 / V2 / V3.0 / V3.1 / V4 phasing on top of that substrate. `docs/design/PATCH_LEDGER.md` remains historical deeper design pressure for semantic mutation history, but canonical future-facing vocabulary is `changeset` / `change`. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` and `docs/design/BEHAVIORAL_KERNELS.md`; broader synthesis lives in `docs/archive/design/INTENT_SPEC_EVOLUTION.md`. FE-705's branch-local strategy/proposal notes add scenario options, graph-review oracle, chat-local strategies, and concern/dependency mapping; those notes should become a canonical design doc when the branch is integrated. Coordination uses a substrate-strangler posture: keep existing frontend REST/SSE contracts stable while route adapters and capability adapters converge on shared server-owned handlers, then cut over UI flows only after parity and changeset-backed authority exist. The dev-layer self-tooling trajectory lives in `docs/design/ln-skills/EVOLUTION.md`.

## Sequencing

### Active

1. `continuous-workspace` — in progress in parallel lane — stable phase-addressable host for the chat runtime.
2. `agent-fixture-substrate` — branch-complete off main, reconciling — FE-705 integration substrate for JSONL agent capability CLI and LLM-as-user probes.

### Next

1. `intent-graph-semantics` — highest-coordination semantic substrate after FE-705 reconciliation.
2. `changeset-ledger` — schedule soon after FE-705 reconciliation; semantic history spine needed before canonical proposal acceptance, direct-edit atomicity, and productized scenario options.
3. `graph-review-scenario-options` — artifact-only critique/probe lane; can advance in parallel with FE-700 if it does not commit canonical graph truth.
4. `productized-scenario-options` — user-facing acceleration surface after FE-700 semantics, FE-701 changesets, and graph-review probes.

### Parallel / Low-conflict

- `first-run-provider-setup` — provider/key UX and runtime seam can progress independently of semantic-stack work.
- `workspace-gitignore-assist` — small workspace hygiene surface with low overlap.
- `productized-web-research` — waits on prompt/context scenario substrate for probe quality, but can remain separate from semantic schema work.

### Horizon

- `relation-first-observer-enrichment`
- `architect-generator-loop`
- `server-mini-library-compartmentalization`
- `side-chat-persistence-v4a`
- `side-chat-v4b-item-versioning`
- `dashboard-summaries`
- `spatial-graph-layout`
- `graph-view-active-path-filter`
- `mcp-adapter`
- `file-based-persistence`
- `typed-fixture-builder-convergence`
- `structured-development-spec-registry`
- `portability-boundaries`

## Frontier Definitions

### continuous-workspace

- **Name:** Continuous workspace / phase-addressable interview surface
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** in-progress
- **Objective:** Replace per-phase rendering boundaries with a cumulative center pane, realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and preservation of the single actionable frontier at the current reachable phase.
- **Why now / unlocks:** Workflow read/write ownership is extracted, the multi-chat substrate ships chat containers below the specification, and side-chat V3.0/V3.1 closed the cascade surface. This gives future side-chat persistence, strategy chats, and graph/workspace routes a stable host without introducing a second durable workflow model.
- **Acceptance:** Realized phase sections remain legible, future sections stay unreachable until valid, navigation is focus/scroll state only, and the current phase retains exactly one actionable frontier/recovery/handoff/completion affordance.
- **Verification:** Manual workspace walkthroughs across kickoff-ready, active, review-active, recovery, close-to-next-phase, resume/reload, and future-phase deep-link states; regression tests around route/workflow state where available.
- **Traceability:** A58; D86, D87, D110, D113, D114; I24, I102.
- **Design docs:** `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`; umbrella synthesis in `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md`.

### agent-fixture-substrate

- **Name:** FE-705 integration — agent capability CLI + LLM-as-user fixture probe
- **Linear:** FE-705
- **Kind:** structural
- **Status:** branch-complete / reconciling
- **Objective:** Integrate the branch-complete local `brunch agent` JSONL capability adapter and external probe runner so agents can drive the real Brunch interview flow through Brunch-owned contracts rather than privileged ORM access.
- **Why now / unlocks:** Prompt/context and graph-review probes need realistic graph/transcript fixtures, but hand-authoring those fixtures is chicken-and-egg. A JSONL capability adapter lets an external LLM-as-user drive the real lifecycle through the same mutation authority future agents must use, pressure-testing tool-call vocabulary, chat readiness, resource identity, fixture curation, and import-boundary discipline. Pi comparison remains FE-635 after this seam has a real Brunch use case to compare against.
- **Acceptance:** Server-owned capability contracts and JSONL protocol/session code are integrated; the probe runner uses only the JSONL client/process boundary; fixture-candidate artifacts preserve scenario briefs, model policy, generated transcripts, and workspace-state inspection without becoming Brunch authority.
- **Verification:** Contract/dispatcher tests, JSONL protocol/session tests, import-boundary tests, fake process tests, opt-in real-provider smoke, and fixture-candidate structure/readiness checks.
- **Traceability:** Requirement 43; A89; D143, D147; I115. Also protects Requirements 40, 41, 42 by making prompt/context and mutation-surface probes executable through a real adapter.
- **Design docs:** `docs/design/AGENT_MUTATION_SURFACE.md`; `docs/design/SUBSTRATE_STRANGLER_COORDINATION.md`; `docs/archive/design/INTENT_SPEC_EVOLUTION.md`; FE-705 branch artifacts until rebased.

### intent-graph-semantics

- **Name:** Intent graph semantics + relation-policy directionality foundation
- **Linear:** FE-700
- **Kind:** structural
- **Status:** not-started
- **Objective:** Refine the ontology and relation policy so the graph can represent invariants, examples/counterexamples, constraint subtypes, narrowed decisions, witness strength, checkability gaps, and operational edge behavior as source/destination material for future generative features.
- **Why now / unlocks:** Candidate generation, behavioral kernels, graph review, scenario-options acceleration, architect proposals, direct-edit cascade, and downstream verification-aware decomposition all need a sharper semantic target than the current exploration/review ontology. This semantic-layer lane is most likely to collide with parallel work, so it should land before broad observer enrichment or canonical candidate-bundle acceptance.
- **Acceptance:** `invariant` and `example` are first-class durable kinds; examples are subtyped; `decision` is narrowed; `constraint`, `criterion`, and `invariant` semantics are enriched; `checkability` and witness strength are represented; relation families, negative relations, edge epistemic metadata, and relation-policy directionality are explicit.
- **Verification:** Corpus/fixture observer probes comparing old vs refined ontology; relation-policy unit tests for mixed-direction relations; graph-review manual assessment for precision/noise; context-pack probe outputs show authority, witness, relation support, and directionality labels.
- **Traceability:** Requirement 38; A77, A78, A80, A81, A84; D134, D136, D137, D139, D140.
- **Design docs:** `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/archive/design/INTENT_SPEC_EVOLUTION.md`; FE-705 strategy/proposal notes for relation directionality.

### changeset-ledger

- **Name:** Semantic changeset ledger + proposal-turn staleness
- **Linear:** FE-701
- **Kind:** structural
- **Status:** not-started
- **Objective:** Introduce the semantic history spine that separates graph mutation history from conversational turn ancestry.
- **Why now / unlocks:** Scenario bundle acceptance, direct-edit atomicity, accepted-with-issues flows, stale proposal detection, graph-review repairs, side-chat V4b item versioning, and future architect/reconciliation agents all need a durable semantic mutation boundary. Without it, productized scenario-options can stay probe-only but cannot safely commit candidate bundles. The current DB substrate is already halfway there: `chat` and `reconciliation_need` exist, `specification.active_turn_id` / `chat.active_turn_id` are deliberately duplicated during the multi-chat transition, and `reconciliation_need.caused_by_patch_id` is a historical placeholder that should become changeset-backed provenance rather than be deleted as ordinary cruft.
- **Current schema observations:** Legacy dedicated knowledge tables (`decision`, `assumption`, `requirement`, `criterion`, and old join/parent tables) are retired in migration `0010`; current semantic truth is `knowledge_item` + `knowledge_edge` + `turn_knowledge_item`. `annotation` and `reconciliation_need` are active process/read-model tables even when empty in local DBs. `turn.turn_kind` / `turn.is_resolution` remain transitional structural-artifact markers until continuous workspace and multi-chat proposal semantics replace that projection. `docs/schema.dbml` is stale relative to `src/server/schema.ts` and should be regenerated or deleted when FE-701 touches schema docs.
- **Migration watch:** Live local `.brunch/brunch.db` was observed with only 18 applied migrations, stopping at `0017_reconciliation_need`; it lacked `0018` source snapshot columns and `0019` reconciliation-agent columns even though `src/server/schema.ts` defines them. There is no explicit `npm run migrate`; app/server `createDb()` runs Drizzle migrations automatically. Before FE-701 schema work, verify the target DB by inspecting `__drizzle_migrations` and `PRAGMA table_info(reconciliation_need)` so drift is not misread as product intent.
- **Acceptance:** Schema and operation vocabulary use `changeset` / `change`; specifications track latest semantic changeset; proposal turns carry base/opened changeset identity; `reconciliation_need.caused_by_changeset_id` replaces/connects the historical patch placeholder; non-accept proposal actions cannot mutate graph truth; a changeset is the smallest atomic unit preserving semantic coherence.
- **Verification:** DB atomicity tests for changeset + changes + reconciliation_need writes, staleness tests for open proposal turns across multi-chat changes, migration/drift checks against an actual SQLite DB, and capability/transition tests proving non-accept actions cannot mutate graph truth.
- **Traceability:** Requirements 39, 42, 44; A71, A79; D135, D138, D143.
- **Design docs:** `docs/design/PATCH_LEDGER.md` (historical filename; future vocabulary is changeset/change); `docs/design/SUBSTRATE_STRANGLER_COORDINATION.md`; FE-705 strategy/proposal notes for semantic history and proposal turns.

### graph-review-scenario-options

- **Name:** Graph-review oracle + scenario-options probes
- **Linear:** FE-702 for graph-review / scenario probes; FE-649 and FE-640 remain productization children under FE-698 where relevant
- **Kind:** structural
- **Status:** not-started
- **Objective:** Build the internal critique path and artifact-only candidate bundle probes before product UI.
- **Why now / unlocks:** Product wants first-turn strategy choice and mid-interview acceleration, but engineering needs graph-review critique to make generated candidate bundles credible. This lane can advance in parallel with FE-700 if it stays artifact-only and does not commit canonical graph truth.
- **Acceptance:** Candidate graph bundle and graph-review finding artifacts exist; graph-review prompt/context pack and rubric cover coherence, fixed-premise respect, coverage, tradeoff honesty, checkability, granularity, scenario fidelity, epistemic labels, provenance, and downstream usefulness; candidate readiness is classified as `draft` / `reviewing` / `reviewed_clean` / `reviewed_with_issues` / `blocked`; broader graph-review issues remain turn-owned unless querying/filtering needs prove otherwise.
- **Verification:** Scenario-runner fixtures, FE-705 JSONL-generated completed-spec fixtures, raw output review, structured parse validation, qualitative scorecards, and comparison against drilldown-produced graphs. Middle/outer-loop oracle design should decide when fixture candidates become golden.
- **Traceability:** Requirements 20, 21, 31, 32, 40, 41, 43, 44; A67, A68, A80, A85, A87, A89; D126, D127, D139, D141, D147.
- **Design docs:** `docs/design/BEHAVIORAL_KERNELS.md`; `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/design/AGENT_MUTATION_SURFACE.md`; FE-705 strategy/proposal notes.

### productized-scenario-options

- **Name:** Productized scenario-options / candidate-spec completion assist
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** blocked
- **Objective:** Replace skip-only remainder handling with first-turn strategy choice and a mid-interview `speed this up` path that generates reviewed candidate graph bundles with tradeoffs, completing the current direction by default.
- **Why now / unlocks:** This is the likely first user-visible alternative to long drilldown, but product UI waits on graph-review probes, FE-700 semantics, and FE-701 changesets. Until then, scenario-options remain artifact/proposal-only.
- **Acceptance:** Users can choose or request acceleration via scenario options; generated bundles preserve accepted graph truth as fixed premise, present tradeoff profiles, and become canonical only through coherent accepted changesets with known issues represented as follow-on review/process debt.
- **Verification:** Probe comparison against direct drilldown, graph-review scorecards, accepted-with-issues flow tests once changesets exist, and manual user-flow review for trust/comprehension.
- **Traceability:** Requirements 31, 40, 44; A67, A77, A78, A85, A90, A91; D126, D134, D136, D139, D151, D152.
- **Design docs:** FE-705 strategy/proposal notes until canonicalized; `docs/design/BEHAVIORAL_KERNELS.md`; `docs/design/INTENT_GRAPH_SEMANTICS.md`.

### first-run-provider-setup

- **Name:** First-run provider setup
- **Linear:** FE-633 covers the OpenRouter/default-provider part; dashboard credential UX + XDG key storage may need a sibling issue if split from provider proving
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer/observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
- **Why now / unlocks:** Can proceed independently and reduces first-run friction for real users and probe workflows.
- **Acceptance:** Dashboard surfaces provider credential status before specification creation; setup flow stores UI-entered keys outside the project workspace; interviewer/observer construction routes through a shared provider seam.
- **Verification:** Unit tests for provider precedence/storage paths, manual first-run walkthroughs, and provider capability spike for model naming, structured output, tool use, and reasoning/thinking support.
- **Traceability:** Requirements 34, 35, 36; A74, A75; D130, D131, D132; I106.
- **Design docs:** none yet beyond SPEC/PLAN entries.

### workspace-gitignore-assist

- **Name:** Workspace hygiene / `.brunch/` gitignore assist
- **Linear:** FE-648
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Detect whether generated local state is already ignored and, with explicit confirmation, add an idempotent `.gitignore` entry or create `.gitignore` when absent.
- **Why now / unlocks:** Low-conflict guardrail that reduces accidental commits of local Brunch state.
- **Acceptance:** The app detects absent, present, and already-covering ignore states; previews repository mutation; mutates `.gitignore` only after explicit confirmation; append/create behavior is idempotent and content-preserving.
- **Verification:** Unit tests for ignore detection/append behavior and manual dashboard walkthrough with absent, present, and already-covering `.gitignore` states.
- **Traceability:** Requirement 37; A76; D133; I107.
- **Design docs:** none yet beyond SPEC/PLAN entries.

### productized-web-research

- **Name:** Productized web research capability
- **Linear:** FE-649
- **Kind:** structural
- **Status:** not-started
- **Objective:** Add web search and page-fetch tools as interviewer-invoked context gathering, surfaced as preface cards after the scenario substrate proves query framing, tool ergonomics, and provisional-context handling.
- **Why now / unlocks:** Extends the same phase-agnostic preface-card model to external research, but should wait for prompt/context scenario substrate proof so web research does not become an ad hoc tool surface.
- **Acceptance:** Research tools are invoked through interviewer context gathering, outputs render as provisional preface cards paired with questions, and observer capture treats the validated full turn as atomic.
- **Verification:** Prompt/context scenario probes for query framing and tool-output summarization, plus manual review of provisional-context handling.
- **Traceability:** Requirements 20, 21, 40, 41; D125, D139, D140, D142.
- **Design docs:** FE-698 prompt/context scenario substrate references; future productized research notes if needed.

### relation-first-observer-enrichment

- **Name:** Relation-first observer capture enrichment
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Broaden observer output across the refined ontology without flooding the graph.
- **Why now / unlocks:** First cut is shipped; enrichment waits for FE-700 relation policy so observer output can become semantically richer while preserving prompt-budgeted compact anchors and user trust.
- **Acceptance:** Observer extraction captures richer relation families and operational metadata with abstention under weak support.
- **Verification:** Observer corpus probes, graph/export review for precision/noise, and context-pack output review.
- **Traceability:** Requirements 30, 38, 40; A66, A81, A84; D125, D136, D137, D139, D140; I109.
- **Design docs:** `docs/design/INTENT_GRAPH_SEMANTICS.md`.

### architect-generator-loop

- **Name:** Architect / generator loop
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Explore an autonomous agent that iterates over the intent graph and proposes semantic changes for HITL review through the same future changeset/reconciliation pathway as user-driven edits.
- **Why now / unlocks:** Related to scenario-options but broader; keep productized architect proposals behind multi-chat, reconciliation, and semantic changesets. Use the scenario substrate for shadow/proposal-only probes first.
- **Acceptance:** Shadow/proposal-only architect outputs can be compared against user-driven edits without mutating canonical graph truth.
- **Verification:** Scenario substrate probes and human comparison against accepted user edits.
- **Traceability:** A73, A85, A87; D139, D141.
- **Design docs:** `docs/design/BEHAVIORAL_KERNELS.md`; future design doc if promoted.

### server-mini-library-compartmentalization

- **Name:** Server mini-library compartmentalization
- **Linear:** unassigned in this plan snapshot
- **Kind:** refactor
- **Status:** in-progress opportunistically on FE-705 lane; `db.ts` persistence facade extraction complete, broader server roots remain horizon.
- **Objective:** Refactor growing server seams into plural public roots with same-named private subtrees where FE-698 / FE-705 pressure has made boundaries too implicit.
- **Why now / unlocks:** Near-term refactor candidate after FE-705 integration, not product roadmap work. The persistence facade now proves the pattern: `db.ts` owns connection setup and curated public exports while private `src/server/db/*-store.ts` modules own cohesive persistence implementation.
- **Acceptance:** Candidate seams such as `db.ts`, `fixtures.ts`, `context-packs.ts`, `prompts.ts`, `scenario-runner.ts`, `entity-apis.ts`, and `agent-apis.ts` hide private implementation subtrees behind stable public roots where real pressure exists.
- **Verification:** Existing test suite plus import-boundary review; for the completed `db.ts` slice, focused store/route/workflow tests, `npm run check`, and `npm run build` pass.
- **Traceability:** code organization convention in `AGENTS.md`.
- **Design docs:** none.

### side-chat-persistence-v4a

- **Name:** Side-chat persistence — V4a (multi-chat Phase 2 substrate)
- **Linear:** FE-675 umbrella, V4a half
- **Kind:** structural
- **Status:** horizon
- **Objective:** Persist side-chat client turns into the existing `chat` / `turn` tables with `chat.kind='side_chat'`, load prior side-chat sessions on remount, and surface an "Old chats" affordance per pinned item/spec.
- **Why now / unlocks:** Deprioritized below continuous workspace and semantic/generative substrate. Phase 1 substrate already ships schema support; the remaining decision is the anchor model (`chat` row anchor fields vs deferred `chat_focus` table).
- **Acceptance:** Side-chat sessions survive remount/reload and remain coherent with graph truth without introducing a second workflow model.
- **Verification:** Persistence/reload tests and manual side-chat walkthroughs.
- **Traceability:** Requirement 39; D138; I111.
- **Design docs:** `docs/design/MULTI_CHAT.md` §10 Phase 2; `docs/design/SIDE_CHAT.md` §9 V4 row.

### side-chat-v4b-item-versioning

- **Name:** Side-chat V4b — item versioning + branched exploration
- **Linear:** FE-675 umbrella, V4b half
- **Kind:** structural
- **Status:** horizon
- **Objective:** Add item versioning and branched exploration once the changeset ledger lands.
- **Why now / unlocks:** Item versioning unblocks dangling-annotation repair and soft-edit audit; branched exploration lets drill-downs, past-turn edits, and revisits coexist with the original chain.
- **Acceptance:** Prior item versions are queryable for diff/comparison/audit while active-path projection always reflects latest semantic truth.
- **Verification:** Changeset-backed versioning tests, revisit cascade tests, and annotation repair walkthroughs.
- **Traceability:** A72, A73, A85; D139, D141.
- **Design docs:** `docs/design/MULTI_CHAT.md`; `docs/design/PATCH_LEDGER.md`.

### dashboard-summaries

- **Name:** Dashboard result summaries and completeness metrics
- **Linear:** unassigned in this plan snapshot
- **Kind:** bounded feature
- **Status:** horizon
- **Objective:** Improve progress visibility across specifications.
- **Why now / unlocks:** Lower-priority product surface after core workspace and semantic substrate stabilize.
- **Acceptance:** Dashboard communicates spec progress/completeness without implying false closure.
- **Verification:** Manual dashboard walkthroughs.
- **Traceability:** Requirements 8, 13, 15.
- **Design docs:** none.

### spatial-graph-layout

- **Name:** Spatial canvas layout for graph view
- **Linear:** unassigned in this plan snapshot
- **Kind:** bounded feature
- **Status:** horizon
- **Objective:** Add the spatial DAG layout as a second layout choice inside graph mode, alongside the structured-list route.
- **Why now / unlocks:** Graph view already ships as a structured-list peer route; spatial layout follows once relation density and graph interaction needs justify it.
- **Acceptance:** Users can switch between structured-list and spatial canvas layouts without changing projection semantics or action contracts.
- **Verification:** Manual graph-view walkthroughs at low/high edge density plus visual regression if available.
- **Traceability:** Requirement 33; A69, A70; D128.
- **Design docs:** graph-view sections in SPEC; future graph-view design notes if promoted.

### graph-view-active-path-filter

- **Name:** Graph view active-path render filter + scope toggle
- **Linear:** unassigned in this plan snapshot
- **Kind:** bounded feature
- **Status:** horizon
- **Objective:** Render only active-path items by default in graph view, with a `Show all` toggle.
- **Why now / unlocks:** Lower-priority graph legibility improvement after core graph semantics and projection surfaces stabilize.
- **Acceptance:** Active-path filtering is default, user can inspect all items, and edge rendering remains honest under both scopes.
- **Verification:** Graph-view fixtures for active-path/all toggles.
- **Traceability:** D128 and graph-view requirements.
- **Design docs:** none.

### mcp-adapter

- **Name:** MCP server adapter for core operations
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Expose future adapter over capability contracts, not direct ORM/route wrappers.
- **Why now / unlocks:** Deferred until capability contracts stabilize through FE-705 and real agent/probe use.
- **Acceptance:** MCP tools wrap Brunch-owned capability contracts and preserve resource identity, authority metadata, and mutation semantics.
- **Verification:** Contract adapter tests and import-boundary tests.
- **Traceability:** Requirements 42, 43; D143, D147.
- **Design docs:** `docs/design/AGENT_MUTATION_SURFACE.md`.

### file-based-persistence

- **Name:** Git-friendly file-based persistence representation for diffable exported specs
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Explore a diffable file representation for exported/durable spec truth.
- **Why now / unlocks:** Deferred until product ontology and changeset semantics are clearer.
- **Acceptance:** File representation preserves intent graph meaning and review/export boundaries without becoming a second source of truth.
- **Verification:** Round-trip and diff-fixture tests if promoted.
- **Traceability:** Product direction from planning specs toward intent specs; D134, D135.
- **Design docs:** future design needed if promoted.

### typed-fixture-builder-convergence

- **Name:** Typed fixture-builder convergence for happy-path tests
- **Linear:** unassigned in this plan snapshot
- **Kind:** hardening
- **Status:** horizon
- **Objective:** Converge test fixtures around typed builders that represent current product semantics.
- **Why now / unlocks:** Useful after semantic schema work stabilizes so tests do not fossilize obsolete ontology names.
- **Acceptance:** Happy-path tests can create coherent specs/chats/turns/intent graph state through typed builders with minimal duplication.
- **Verification:** Existing test suite, fixture API review, and migration of representative tests.
- **Traceability:** I48, I109, I111, I112.
- **Design docs:** none.

### structured-development-spec-registry

- **Name:** Structured development spec registry
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural / process
- **Status:** horizon
- **Objective:** Prototype file-backed canonical spec records, deterministic checks, generated markdown views, and task-local slices for Brunch's own development workflow.
- **Why now / unlocks:** Self-tooling experiment, not product functionality. It would make `memory/SPEC.md` / `memory/PLAN.md` generated views over structured records to reduce drift and merge conflicts.
- **Acceptance:** Generated views preserve current planning ergonomics while reducing merge churn and cross-reference drift.
- **Verification:** Deterministic generation checks and branch-conflict dry runs.
- **Traceability:** dev-layer trajectory only; not product-layer ontology.
- **Design docs:** `docs/design/ln-skills/EVOLUTION.md`.

### portability-boundaries

- **Name:** Portability boundaries
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Split durable store/read-model, interview session runtime, and workspace capability provider if Brunch targets hosted, remote, embedded, or sandbox-backed operation.
- **Why now / unlocks:** Future architecture boundary map for non-local deployments or adapter-backed execution. Deferred until hosted/remote/sandbox operation becomes a product goal.
- **Acceptance:** Boundary map supports hosted/remote/sandbox decisions without prematurely abstracting the local-first product.
- **Verification:** Architecture review and spike if product direction changes.
- **Traceability:** portability assumptions in design docs; current local-first constraint in SPEC.
- **Design docs:** `docs/design/PORTABILITY_BOUNDARIES.md`.

## Recently Completed

- [2026-05-11] `side-chat-v3-1-agent-grouped-reconciliation` — Done: FE-674 / PR #124 + downstack closed the V3.x arc end-to-end with spec-level classifier route, per-row reset route, agent classification lifecycle, chips, per-class actions, and bulk Confirm-all / Apply-all-suggested. Verified: `npm run verify` 1178 / 1179 pass with one unrelated `side-chat-route` flake. Watch: A88 outer-loop walkthrough on a dense spec remains open to assess legibility vs V3.0's flat list.
- [2026-05-11] `fe-698-reconciliation-context-pack` — Done: added proposal-only reconciliation prompt/context scenario rendering open reconciliation needs with source/target anchors, reason/status, prompt/context fingerprints, and read-only capability metadata. Verified: `npm run verify`. Watch: next FE-698 work can broaden read-only/proposal-only probes and Pi adapter spike without treating this pack as a resolution agent.
- [2026-05-08] `side-chat-v3-0-hard-impact-cascade` — Done: FE-674 / PR #115 + #116 + #117 shipped hard-impact cascade through `reconciliation_need`, Pending review listing, and idempotent resolve. Verified: `npm run verify` (1063 tests, 0 lint warnings). Watch: A88 mechanical grouping remains only partially validated until outer-loop walkthrough on dense graphs.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Workspace shell (parallel colleague lane)
continuous-workspace
  ├──→ stable host for side-chat-persistence-v4a
  └──→ workspace-aware graph / structured-list peer routes

TRACK B — Agent fixture substrate / strangler handler seam
prompt/context scenario substrate foundation (completed)
  └──→ agent-fixture-substrate
        ├──→ shared route/capability handler seam without frontend DTO cutover
        ├──→ generated completed-spec fixture candidates
        ├──→ graph-review-scenario-options
        └──→ Pi harness comparison (future, FE-635)

TRACK C — Semantic substrate (highest coordination)
multi-chat-substrate + reconciliation-needs (completed)
  ├──→ intent-graph-semantics
  │     ├──→ relation-first-observer-enrichment
  │     ├──→ robust direct-edit / reconciliation cascade policy
  │     └──→ graph-review-scenario-options becomes semantically meaningful
  └──→ changeset-ledger
        ├──→ canonical scenario bundle acceptance
        ├──→ direct-edit atomicity with caused_by_changeset_id
        ├──→ stale open proposal detection
        └──→ architect-generator-loop / verifier/import mutation provenance

TRACK D — Strategy probes, frontend artifacts, and product acceleration
agent-fixture-substrate + intent-graph-semantics
  └──→ graph-review-scenario-options
        ├──→ fixture-backed candidate / graph-review UI artifacts can proceed without canonical mutation
        └──→ productized-scenario-options
              ├──→ absorbs / reshapes two-axis interview framing
              └──→ absorbs / reshapes progressive detail / recursive deflation

TRACK E — Low-conflict parallel work
first-run-provider-setup
workspace-gitignore-assist
productized-web-research

LOWER-PRIORITY / DEFERRED
side-chat-persistence-v4a / side-chat-v4b-item-versioning
spatial-graph-layout + graph-view-active-path-filter
dashboard-summaries
mcp-adapter / file-based-persistence / typed-fixture-builder-convergence
structured-development-spec-registry
portability-boundaries
```
