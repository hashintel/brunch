<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, and the first relation-first observer capture seam all ship as working product. In this stack, downstack FE-697 supplies the multi-chat substrate (chat containers + `reconciliation_need` queue), and FE-698 supplies the prompt/context scenario substrate from `main`. Side-chat V2 plumbing — `edit` / `edge` / `drill-down` patch kinds with server route, reducer, and undo-capable appliers — is branch-complete on FE-673 (PR #97) but ships without its user-facing Edit-mode trigger, and the V2 hard-impact branch returns a `deferred: true` placeholder banner. The live frontier is **side-chat V3.0**, which removes that placeholder by routing hard-impact apply through the new `reconciliation_need` queue.

The May 2026 intent-spec, multi-chat, changeset-ledger, prompt/context, agent-mutation, and strategy design notes are reconciled into one direction. `docs/design/MULTI_CHAT.md` is the downstack phase-one substrate for this stack. `docs/design/SIDE_CHAT.md` describes side-chat V1 / V2 / V3.0 / V3.1 / V4 phasing on top of that substrate, with §13 mapping each user-surface version onto a substrate phase. `docs/design/PATCH_LEDGER.md` remains historical deeper design pressure for semantic mutation history, but canonical future-facing vocabulary is `changeset` / `change`; `docs/design/INTENT_SPEC_EVOLUTION.md` carries the broader synthesis. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` (canonical reference for the FE-700 frontier), `docs/design/BEHAVIORAL_KERNELS.md` (canonical reference for the FE-702 kernel probes), and `docs/design/SPEC_EVOLUTION_STRATEGIES.md` (chat-local strategies, candidate bundles, graph-review oracle, and concern/dependency map). The dev-layer self-tooling trajectory — the `ln-*` skill family, the proposed file-backed spec registry, and the long-horizon convergence between dev and product ontologies — lives in `docs/design/DEV_WORKFLOW_EVOLUTION.md`. Older portability work remains a future-facing boundary map rather than a live roadmap item until a hosted, remote, or adapter-backed substrate becomes a product goal.


## Active

1. **Side-chat V3.0 — hard-impact edit cascade through `reconciliation_need`** — drop the V2 deferred banner; on hard-impact `propose_edit` apply, server enumerates incident `knowledge_edge` rows under typed relation policy (Path 1 from MULTI_CHAT.md §5.1) and opens one `reconciliation_need` per affected pair; client surfaces those rows as a `Pending review` section in `patch-list-overlay.tsx` with per-row accept-on-target / edit-target / dismiss actions. V3.0 groups needs mechanically (by `kind` and relation type); agent-grouped resolution is V3.1 horizon work.
   - Why now / unlocks: downstack FE-697 supplies the queue table for this stack; the FE-674 planning sync (PR #110) reconciled SIDE_CHAT.md §5.3 / §8 / §9 / §13 and SPEC.md (Acceptance Criterion 7, A88, D146, I113) against the substrate; the V2 deferred banner is the highest-visibility user gap. Without V3.0, FE-697's queue has no reader and V2 hard-impact stays an empty promise.
   - Recommended shape: ship as a small queue of scope cards inside this one frontier item (track in `memory/CARDS.md` if needed). Suggested order — (a) un-stub `SideChatPopover` Edit-mode button so V2 plumbing is reachable from the UI at all; (b) server `openReconciliationNeedsForItemChange()` + lifecycle endpoint for resolution; (c) `edit-applier` rewrite to drop the `deferred: true` shape and surface needs into side-chat state; (d) overlay `Pending review` section + per-row resolution actions; (e) verification — `edit-applier.test.ts`, `reconciliation-need.test.ts`, `patch-list-overlay.test.tsx`, F6 fixture matrix (leaf, 2-downstream, 5+-downstream, in-active-review-set, mixed kinds).
   - Linear: FE-674.
   - Traceability: Acceptance Criterion 7; Requirement 10; A48, A71, A83, A88, A93; D80, D135, D137, D138, D146, D150; I111, I113, I117.
   - Design doc: `docs/design/SIDE_CHAT.md` §5.3, §9, §13; `docs/design/MULTI_CHAT.md` §5.

## Next

2. **Intent graph semantics + relation-policy directionality foundation** — refine the ontology and relation policy so the graph can represent invariants, examples/counterexamples, constraint subtypes, narrowed decisions, witness strength, checkability gaps, and operational edge behavior as source/destination material for future generative features.
   - Linear: FE-700.
   - Work type: semantic substrate / high-coordination foundation.
   - Why now / unlocks: candidate generation, behavioral kernels, graph review, scenario-options acceleration, architect proposals, direct-edit cascade, and downstream verification-aware decomposition all need a sharper semantic target than the current exploration/review ontology. This is the next substrate layer most likely to collide with parallel work, so it should land before broadening graph-review or reconciliation behavior.
   - Recommended shape: add `invariant` and `example` as first-class durable kinds; subtype examples (positive / negative / edge-case / trace / not-relevant); narrow `decision`; enrich `constraint`, `criterion`, and `invariant` subtypes; add `checkability` and `witness strength`; introduce the five-family relation taxonomy and negative relations; add edge epistemic metadata; and make relation-policy directionality explicit (`canonicalSentence`, `inverseSentence`, source-change behavior, target-change behavior) rather than inferring cascade from raw edge direction. Leave room for contrastive-kernel artifacts such as `alternative`, `question`, `ambiguity`, and `candidate`, but keep them proposal-local unless probes prove they need durable top-level kinds.
   - Verification approach: corpus/fixture observer probes comparing old vs refined ontology; relation-policy unit tests for mixed-direction relations; graph-review manual assessment for precision/noise; context-pack probe outputs must show authority, witness, relation support, and directionality labels.
   - Parallelization note: this is the semantic-layer lane; keep strategy probes artifact-only until this stabilizes.
   - Traceability: Requirement 38; A77, A78, A80, A81, A84, A93; D134, D136, D137, D139, D140, D150; I117.
   - Design docs: `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/design/SPEC_EVOLUTION_STRATEGIES.md` §Relation directionality; `docs/design/INTENT_SPEC_EVOLUTION.md`.

3. **Semantic changeset ledger + proposal-turn staleness** — introduce the semantic history spine that separates graph mutation history from conversational turn ancestry.
   - Linear: FE-701.
   - Work type: persistence / mutation substrate.
   - Why now / unlocks: scenario bundle acceptance, direct-edit atomicity, accepted-with-issues flows, stale proposal detection, graph-review repairs, and future architect/reconciliation agents all need a durable semantic mutation boundary. Without it, productized scenario-options can stay probe-only but cannot safely commit candidate bundles.
   - Recommended shape: add `changeset` / `change` as canonical schema and operation vocabulary; track `specification.latest_changeset_id`; stamp new turns with `opened_at_changeset_id` / `base_changeset_id`; connect `reconciliation_need.caused_by_changeset_id`; keep proposals/findings as turn-owned artifacts until accepted; ensure only `accept` applies a proposal changeset; and treat a changeset as the smallest atomic unit that preserves semantic coherence. Do not add a first-class `procedure_run` table unless lifecycle/retry/cancel or multi-turn operation grouping demands it.
   - Verification approach: DB atomicity tests for changeset + changes + reconciliation_need writes, staleness tests for open proposal turns across multi-chat changes, capability/transition tests proving non-accept actions cannot mutate graph truth.
   - Parallelization note: can proceed after/alongside FE-700 if relation-policy interfaces are agreed, but avoid product candidate acceptance until this lands.
   - Traceability: Requirements 39, 42, 44; A71, A79, A92; D135, D138, D145, D149; I116.
   - Design docs: `docs/design/PATCH_LEDGER.md` (historical filename; future vocabulary is changeset/change); `docs/design/SPEC_EVOLUTION_STRATEGIES.md` §Semantic history and proposal turns.

4. **Graph-review oracle + scenario-options probes** — build the internal critique path and artifact-only candidate bundle probes before product UI.
   - Linear: FE-702 for graph-review / scenario probes; FE-649 and FE-640 remain productization children under FE-698 where relevant.
   - Work type: strategy/proposal artifact + oracle probe.
   - Why now / unlocks: product wants first-turn strategy choice and a mid-interview `speed this up` affordance, but engineering needs graph-review critique to make generated candidate bundles credible. This lane can advance in parallel with FE-700 if it stays artifact-only and does not commit canonical graph truth.
   - Recommended shape: define candidate graph bundle and graph-review finding artifacts; add a graph-review prompt/context pack and rubric covering coherence, fixed-premise respect, coverage, tradeoff honesty, checkability, granularity, scenario fidelity, epistemic labels, provenance, and downstream usefulness; generate 2–3 scenario options that complete the current direction from context-packed accepted graph truth; run fast gates before display and deeper async critique/refine/repair as probe artifacts; classify candidate readiness as `draft` / `reviewing` / `reviewed_clean` / `reviewed_with_issues` / `blocked`; keep broader graph-review issues turn-owned rather than adding a `graph_issue` table.
   - Verification approach: scenario-runner fixtures, FE-705 JSONL-generated completed-spec fixtures, raw output review, structured parse validation, qualitative scorecards, and comparison against drilldown-produced graphs. Middle/outer-loop oracle design should decide when fixture candidates become golden.
   - Parallelization note: good isolation lane for work that should avoid schema-heavy relation migrations; use `scripts/agent-probes` and context-pack modules rather than product UI.
   - Traceability: Requirements 20, 21, 31, 32, 40, 41, 43, 44; A67, A68, A80, A85, A87, A89, A90, A91; D126, D127, D139, D141, D147, D151, D152; I114, I118.
   - Design docs: `docs/design/SPEC_EVOLUTION_STRATEGIES.md`; `docs/design/BEHAVIORAL_KERNELS.md`; `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/design/AGENT_MUTATION_SURFACE.md`.

5. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and the single actionable frontier preserved at the current reachable phase.
   - Why now / unlocks: workflow read/write ownership is extracted (FE-616); the multi-chat substrate (FE-697) ships chat containers below the specification, so continuous workspace can adopt one visible runtime without smuggling in a second durable workflow model. Bumped behind V3.0 and the semantic substrate because V3.0 closes a visible V2 gap while FE-700/FE-701 define the graph/turn semantics that multi-strategy work will need.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`.


## Horizon

### Intent graph and reconciliation

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
  - Traceability: Requirement 10; A48, A88; D135, D137, D138, D146.
  - Design doc: `docs/design/SIDE_CHAT.md` §5.3 (V3.1), §9.

### User-facing capabilities

- **First-run provider setup** — deferred out of FE-698. Make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer / observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
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

- **Productized scenario-options / candidate-spec completion assist** — replace skip-only remainder handling with first-turn strategy choice and a mid-interview `speed this up` side-chat that generates 2–3 reviewed candidate graph bundles with tradeoffs, completing the current direction by default.
  - Depends on: prompt/context scenario substrate; intent graph semantics + relation-policy directionality; graph-review oracle; changeset ledger for canonical acceptance.
  - Traceability: Requirements 31, 40, 44; A67, A77, A78, A85, A90, A91; D126, D134, D136, D139, D148, D151, D152; I118.

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

- **Server mini-library compartmentalization** — consider renaming and organizing growing server seams into plural public roots with same-named private subtrees, especially around fixtures, context packs, prompts, scenario runner, entity APIs, and agent APIs.
  - Status: refactor idea captured for later, not current work and not a migration commitment.
  - Candidate shape: `fixtures.ts` + `fixtures/`, `context-packs.ts` + `context-packs/`, `prompts.ts` + `prompts/` with prompt snapshots colocated under `prompts/__snapshots__/`, `scenario-runner.ts` + `scenario-runner/`, `entity-apis.ts` + `entity-apis/*-route.ts`, and `agent-apis.ts` + `agent-apis/` containing tool/capability-registry subtrees.
  - Rationale: make public mini-library boundaries and private implementation compartments more obvious as FE-698 prompt/context and future agent API seams grow.

- **Structured development spec registry** — prototype file-backed canonical spec records, deterministic checks, generated markdown views, and task-local slices for Brunch's own development workflow (the `ln-*` skill family).
  - Status: design horizon, not a migration commitment. Self-tooling experiment for the dev layer; not part of the product roadmap.
  - Recommended shape: follow the `memory/spec/{schema,records,generated,tools}/` trajectory and the 5-step migration path (stable IDs → sidecar files → stop editing generated md → `spec:check` in the verify gate → task-local slices). First-adopter candidate: a bounded sub-area such as the multi-chat substrate's records, not the full SPEC.
  - Traceability: D134.
  - Design doc: `docs/design/DEV_WORKFLOW_EVOLUTION.md` (canonical reference, including the three-layer framing and convergence question); `docs/design/INTENT_SPEC_EVOLUTION.md` (broader synthesis context).

- **Portability boundaries** — split durable store/read-model, interview session runtime, and workspace capability provider if Brunch targets hosted, remote, embedded, or sandbox-backed operation.
  - Status: deferred. Some enabling seams already exist (query domains, workflow projector, no persisted `cwd` on specifications), but adapter-backed portability is not on the live roadmap.
  - Deep design source: `docs/design/PORTABILITY_BOUNDARIES.md`.

- **Agent-native CLI adapter** — future CLI-addressability should project the agent capability contract registry rather than wrap routes or ORM scripts by hand.
  - Status: design input captured, not current work.
  - Recommended shape: generate or mechanically validate commands from capability contracts; enforce conventional verbs/flags (`get`, `list`, `--json`, `--force`, `--wait`), non-interactive defaults, bounded JSON output, enumerated errors, structured `brunch agent-context` introspection, and a recoverable async job ledger. Durable writes still route through Brunch-owned mutation handlers.
  - Traceability: A89; D143, D147.

- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.
- Git-friendly file-based persistence representation for diffable exported specs.
- Typed fixture-builder convergence for happy-path tests.

## Recently Completed

- [2026-05-12] FE-705 probe harness hardening refactor — Hardened the external agent-probe harness around JSONL process failures, artifact failure reporting, explicit turn budgets, and fixture-candidate structure/readiness checks. Process transports now settle pending requests on protocol errors, malformed output, process exit, stderr, write failure, or timeout; process-backed runs serialize failure artifacts; scripted/process probes accept a configurable turn budget defaulting to two; and fixture reports distinguish `parseReady`, `structureReady`, and normalization debt. Verified: targeted probe-harness tests and `npm run verify`.
- [2026-05-12] FE-705 fixture-candidate normalization checkpoint — Added a fixture-candidate inspector for probe artifact directories. It validates `artifact-bundle.json`, `summary.json`, `raw-jsonl.ndjson`, `final-chat.json`, expected preserved workspace state, completed vs error-run status, and normalization debt for timestamps/durations, temp paths, environment metadata, generated wording, resource ids, and provider-specific error redaction. Verified: targeted test, real-provider packaged smoke artifact `/tmp/brunch-llm-user-smoke-OVPjPG`, and `npm run verify`.
- [2026-05-12] FE-705 opt-in packaged LLM-as-user smoke helper — Added a fake-tested smoke helper that runs `npm run build`, drives the default packaged `node bin/brunch.js agent` command with the model-backed user policy, preserves workspace state, and returns/prints JSON-safe summaries with redacted failure artifacts. Verified: targeted tests, real-provider smoke (`turnsAnswered: 2`, final frontier `answered`, artifact dir `/tmp/brunch-llm-user-smoke-OVPjPG`), and `npm run verify`.
- [2026-05-12] FE-705 model-backed LLM-as-user policy — Added a fakeable model-backed simulated-user policy for the external probe runner. It renders strict JSON prompts from scenario brief, active question, options, and prior Q/A; parses free-text and option-selection responses into `turn.submitResponse` payloads; records prompt/raw-output/parse-status events in artifact bundles; and reports invalid model output as structured probe errors. Verified: targeted tests and `npm run verify`.
- [2026-05-12] FE-705 user-simulator policy interface — Added an injectable probe response policy that receives the scenario brief, current `chat.read` projection, active turn, and prior answered turns; the scripted answer path now runs through that policy seam, and policy failures become structured probe errors. Verified: targeted test and `npm run verify`.
- [2026-05-12] FE-705 probe workspace fixture preservation — Added opt-in `preserveWorkspaceState` support for process-backed probes: run results and artifact bundles now record the temp workspace cwd, and enabled runs copy the workspace `.brunch/` state into `workspace-state/` under the artifact directory while disabled runs keep the existing minimal artifact set. Verified: targeted test and `npm run verify`.
- [2026-05-12] FE-705 probe-runner scripts harness boundary — Moved the external probe runner out of `src/server` into `scripts/agent-probes`, expanded formatter/lint/test/type-check coverage to include `scripts/`, and updated the boundary guard around the script-side harness so it cannot import DB, capability dispatch/registry, schema, core, route-transition, or turn-response authority modules directly. Verified: targeted test and `npm run verify`.
- [2026-05-12] FE-705 probe runner import-boundary guard — Added a static boundary test proving the probe-runner module does not import DB, capability dispatch/registry, schema, core, route-transition, or turn-response authority modules directly; the existing capability/JSONL tests continue to cover the server-owned mutation path. Verified: targeted test and `npm run check`.
- [2026-05-12] FE-705 probe artifact schema and safe summaries — Hardened proof-runner artifacts with schema-versioned bundles, command sequences, raw JSONL transcripts, parsed events, non-secret environment metadata, compact question/answer summaries, duration, and deterministic redacted errors. Verified: targeted test and `npm run check`. Watch: remaining runner boundary guard should mechanically prevent direct DB/handler imports.
- [2026-05-12] FE-705 process-backed probe runner — Added a process JSONL transport plus temp-workspace runner path around the packaged `node bin/brunch.js agent` boundary. The runner can spawn through an injected process adapter, drive the scripted two-turn probe, and write raw JSONL, final chat, and summary artifacts outside `.brunch/`. Verified: targeted test and `npm run check`. Watch: next slice should harden the artifact schema/redaction before treating output as fixture-candidate material.
- [2026-05-12] FE-705 probe runner JSONL client — Added a provider-free scripted probe-runner core over an injected JSONL transport. It drives `spec.create → chat.getPrimary → chat.ensureReady → chat.read → turn.submitResponse → chat.read → chat.ensureReady → chat.read → turn.submitResponse → chat.read`, supports free-text and option-selection responses from `chat.read`, and reports structured errors without DB/handler imports. Verified: targeted test and `npm run check`. Watch: next slice still needs a process-backed temp-workspace runner and artifact writes.
- [2026-05-11] FE-705 real-provider readiness smoke hardening — Hardened `chat.ensureReady` for live provider use: initial generation now uses a non-empty runtime prompt, readiness question persistence falls back from plain text to structured ask-question parts to the turn row written by tool execution, and the manual temp-workspace JSONL smoke reaches a second answerable frontier with JSONL-only output. Verified: targeted tests, real-provider smoke, and `npm run verify`. Watch: next FE-705 slice can add `turn.get` or start the proof-of-life probe runner.
- [2026-05-11] FE-705 agent turn response submission — Added executable `turn.submitResponse` with explicit chat/turn ownership checks, shared turn-response payload validation, delegation to `submitTurnResponseTransition`, and agent-facing read projection that points answered turns back to `chat.ensureReady`. JSONL tests prove `spec.create → chat.getPrimary → chat.ensureReady → turn.submitResponse → chat.read` over explicit ids. Verified: `npm run verify`. Superseded by the live readiness smoke hardening above.
- [2026-05-11] FE-705 generated chat readiness — `chat.ensureReady` now turns an empty generated frontier into an answerable `awaiting_response` frontier by invoking a fakeable interviewer generation boundary, persisting fallback question text plus assistant parts, and preserving idempotence for already-answerable turns. JSONL tests prove `spec.create → chat.getPrimary → chat.ensureReady → chat.read` returns an answerable turn through explicit ids. Verified: `npm run verify`. Superseded by the turn-response submission slice above.
- [2026-05-11] FE-705 deterministic chat readiness — Added `chat.ensureReady` as a runtime-replay JSONL capability that materialized a kickoff-ready primary chat into a persisted empty frontier turn without invoking LLM/provider generation. The handler resolved explicit `chatId` ownership, used the existing phase-entry transition seam, mirrored the active head through spec/chat state, and was idempotent when a frontier already existed. Verified: `npm run verify`. Superseded by the generated chat readiness slice above.
- [2026-05-11] FE-705 primary chat read projection — Added read-only `chat.getPrimary` and `chat.read` agent capabilities. JSONL clients can now create a spec, discover its primary interview chat, and read a compact Brunch-owned chat projection with spec/chat identity, visible active-path turns, frontier state, and neutral next-command hints. Verified: `npm run verify`. Watch: this is read-only; next FE-705 work still needs readiness/generation and turn-response mutation before an external LLM-as-user probe can drive the interview.
- [2026-05-11] FE-705 agent JSONL lifecycle proof — Added `brunch agent` as a long-lived JSONL capability session, with executable `spec.create` and `spec.getStatus` contracts routed through Brunch-owned handlers rather than Express routes or ORM scripts. The packaged CLI can create a real local specification and read it back by explicit `specId`; malformed JSON, unknown capabilities, and schema-invalid inputs return typed error envelopes. Verified: `npm run verify`. Watch: next FE-705 slices still need chat readiness / turn response capabilities and the external LLM-as-user probe runner.
- [2026-05-11] FE-698 reconciliation context-pack slice — Added a proposal-only reconciliation prompt/context scenario that renders open reconciliation needs with source/target anchors, reason/status, prompt/context fingerprints, and read-only capability metadata. This is substrate-only: no FE-674 need lifecycle endpoint, overlay action, side-chat reducer, or durable mutation behavior. Verified: `npm run verify`. Watch: next FE-698 work can move to broader read-only/proposal-only probes and the Pi adapter spike without treating this pack as a resolution agent.
- [2026-05-08] FE-674 planning sync — reconciled `docs/design/SIDE_CHAT.md` §5.3 / §8 / §9 / §13 against the downstack FE-697 substrate; SPEC.md adds A88 (Path 1 sufficiency without agent), D146 (cascade routes through `reconciliation_need`, `deferred: true` apply contract removed at V3.0 ship), I113 (apply opens at least one need per typed dependency edge), and rewrites Acceptance Criterion 7. Doc-only, no `src/` touched. PR #110 stacked on FE-704.
- [2026-05-08] FE-698 prompt/context follow-up hardening — Candidate-spec prompt scenarios no longer advertise durable changeset submission, prompt scenario artifacts report schema version 2 for the fingerprinted shape, scenario definitions require typed context data, empty prompt assets are cached correctly, context-pack anchors use intent vocabulary, and `context-pack.ts` now remains the public entry point over private scenario-specific context-pack modules. Verified: `npm run verify`. Watch: this is still FE-698 continuation hardening; broader generative quality review and additional scenario probes remain later slices.
- [2026-05-08] FE-698 prompt/context remediation + candidate scenario — Prompt scenario definitions are now discriminated by scenario kind, candidate-spec scenarios render deterministic no-provider proposal artifacts from typed context packs, scenario artifacts include prompt/context fingerprints, server prompt asset copying mirrors current source assets, prompt golden coverage protects production prompt text, and the build-boundary prompt test writes isolated output. Verified: `npm run verify`. Watch: full generative quality review for candidate-spec output remains a later execution/probe slice.
- [2026-05-08] FE-698 scenario execution error hardening — Scenario execution failures now serialize safe deterministic summaries: API-key-like provider errors are redacted, non-Error rejections avoid object dumps, and ordinary errors remain reviewable. Verified: `npm run verify`.
- [2026-05-08] FE-698 Anthropic scenario adapter — Added a probe-only Anthropic AI SDK adapter behind the existing `PromptScenarioModelAdapter` seam. Web-research prompt scenarios now map rendered prompts to AI SDK system content and rendered context packs to user prompt content under mocked tests, with unsupported providers rejected before model construction. Verified: `npm run verify`. Watch: this is not the shared AI runtime provider seam; OpenRouter/provider-neutral routing, credential UX, Pi, web tools, CLI/UI, persistence, and Brunch mutations remain out of scope.
- [2026-05-08] FE-698 prompt scenario execution probe — Web-research prompt scenarios can now execute through an injected fakeable model adapter and serialize `succeeded` / `failed` execution results with raw output or deterministic error text, while no-provider artifacts remain deterministic `not-run` snapshots. Structured parsing is explicitly `not-applicable` for this prose-only web-research path. Verified: `npm run verify`. Watch: real provider adapters, Pi, web tools, CLI/UI, persistence, and mutating Brunch handlers remain out of scope for this foundation slice.
- [2026-05-07] FE-698 prompt/context foundation slices — Packaged markdown prompt registry + observer and web-research context-pack foundations + scenario runner capture skeleton/composition + agent mutation-surface audit + capability registry metadata. Server interviewer, observer, side-chat, and web-research role prompts now load from markdown assets through a typed prompt registry; observer capture and web-research probes render typed scenario-specific context packs; seeded prompt scenarios compose production prompts with typed context-pack output into deterministic no-provider probe artifacts; and scenario artifacts can declare validated Brunch capability contracts. Review fixes moved observer prompt composition into a pure module and made prompt scenario prompt sources explicit. The agent mutation-surface audit inventories current and projected agent-originated write paths as input to later handler slices. Verified: `npm run verify` for code slices; audit verified by code-search/document consistency. This is a completed foundation within FE-698, not retirement of the whole FE-698 frontier; the live continuation remains in `Next`.
- [2026-05-07] Side-chat V2 — Edit / Drill-down / Propose-edge plumbing (FE-673, PR #97) — added `edit`, `edge`, and `drill-down` patch kinds. Server `classifyEditImpact` returns `none | soft | hard`; soft applies directly with undo, hard returns `deferred: true` placeholder. Client: patch-list reducer + three applier factories with real undo handlers. Verified: `npm run verify` (935 tests, 19 new). Watch: `SideChatPopover` Edit button stays `disabled` and hard-impact deferred banner is live until V3.0 lands.
- [2026-05-06] Multi-chat substrate + reconciliation needs (FE-697) — `chat` table with one interview chat per spec, nullable `turn.chat_id`, `specification.primary_chat_id`, mirrored `chat.active_turn_id`, plus the `reconciliation_need` queue with directed source/target items, narrow `kind`/`status`, partial unique index on open rows, cascade FK. Spec creation inserts spec + interview chat in one transaction; `advanceHead` is transactional. No user-visible change. Verified: `npm run verify` (673 tests) plus manual fixture playback (39 specs / 81 turns / dual-pointer equivalence). A82 / A83 validated for Phase 1.
- [2026-05-01] Side-chat V1.1 — Explore vertical slice. End-to-end graph-launched chat interaction shipped: prompt builder, POST `/side-chat` SSE endpoint, popover host, graph-view wiring, SSE consumer, and active-button activation. Follow-up refactor collapsed pending assistant text into the message list and extracted `SideChatHost` so activation is a tree-mount fact. This is complete implementation history; future conceptual work is multi-chat / reconciliation, not Side-chat V2/V3.
- [2026-05-04] Graph view structured-list peer route — `/specification/$id/graph` now renders project-wide entities through the structured-list layout with relationship subsections, relation chips, empty state, row controls, and a back-to-chat affordance. Follow-up active-path filtering and spatial canvas remain horizon work. Verified: `npm run verify` in the FE-643 slice family.
- [2026-04-30] FE-650 streamed question cache promotion — `ask_question` tool execution now advances the active frontier, returns the acknowledged turn id, interviewer streams emit a post-finalize `frontier-turn-ready` event, and the client promotes that streamed question into the specification bundle query cache before refetch reconciliation. Verified: `npm run verify` plus dev-mode manual retry; the formerly visible inert-card gap is improved. Watch: if residual scroll jumps persist, inspect remaining pane-wide rerender boundaries around workspace stream projection.
- [2026-04-30] FE-639 relation-first observer capture first cut — eligible answered turns now enter one background observer-capture backlog, observer prompts use compact existing-knowledge anchors, observer output persists validated graph-delta relationship candidates, and accepted review grounding refs reuse the same conservative relation policy. Verified: `npm run verify`. Watch: A66 remains open until corpus/manual graph-review proves edge precision and density are useful.
- [2026-04-27] Runtime JSON payload hardening — Express API parsing now accepts chat-sized request bodies above the default parser ceiling and returns a JSON 413 response instead of Express HTML when a payload exceeds the app limit. Verified: `npm run verify`. Watch: if real chat requests still exceed the 5 MB limit, investigate client history / tool-result pruning rather than only raising the ceiling.
- [2026-04-24] Distribution hardening release path — `package.json` now declares the Node 22+ engine floor, explicit shipped files, and public scoped publish config; `npm run release` drives release-it at repo root, rebuilds and dry-runs the packaged artifact, and documents npm auth prerequisites. Verified: `npm run verify`. Watch: CI trusted publishing is still intentionally out of scope.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Semantic substrate (highest coordination)
multi-chat-substrate + reconciliation-needs  (completed)
  ├──→ intent graph semantics + relation-policy directionality  (next, FE-700)
  │     ├──→ relation-first observer enrichment  (horizon, after ontology/policy probes)
  │     ├──→ robust direct-edit / reconciliation cascade  (active V3.0 uses mechanical subset)
  │     └──→ graph-review oracle can become semantically meaningful
  └──→ semantic changeset ledger + proposal-turn staleness  (next, FE-701)
        ├──→ canonical scenario bundle acceptance
        ├──→ direct-edit atomicity with caused_by_changeset_id
        ├──→ stale open proposal detection
        └──→ architect-loop / verifier/import mutation provenance

TRACK B — Strategy probes / graph-review / candidate bundles (parallelizable if artifact-only)
prompt/context scenario substrate foundation  (completed)
  ├──→ agent-capability-CLI + LLM-as-user fixture probe  (branch-complete FE-705)
  │     └──→ golden completed-spec fixture curation  (probe output)
  ├──→ graph-review oracle + scenario-options probes  (next, FE-702)
  │     ├──→ behavioral-kernel targeted-case probes
  │     ├──→ candidate bundle readiness gates
  │     ├──→ async review/refine/repair worker shape
  │     └──→ productized scenario-options / speed-this-up side-chat  (horizon)
  ├──→ productized web research capability  (horizon)
  └──→ post-spec oracle/decomposition frontier  (probe/future product)

TRACK C — Graph/workspace surfaces
graph-view-structured-list  (completed)
  ├──→ active-path-filter-and-scope-toggle  (horizon, blocked on server data-layer)
  ├──→ spatial-canvas-layout  (horizon)
  └──→ side-chat-V2-plumbing  (completed, FE-673 PR #97)
        └──→ side-chat-V3.0-cascade-through-reconciliation_need  (active, FE-674)
              └──→ side-chat-V3.1-agent-grouped-resolution  (horizon)

TRACK D — Workspace shell / UX
multi-chat-substrate  (completed)
  ├──→ continuous-workspace  (next after active/substrate pressure)
  ├──→ first-turn strategy choice  (horizon, after strategy artifacts prove)
  └──→ scenario-options side-chat  (horizon, after graph-review + changesets)

UNBLOCKED / LOWER-COORDINATION HORIZON
first-run provider setup  (needs provider spike / scope)
workspace hygiene gitignore assist  (bounded, dashboard-surface candidate)
web-research tools  (gate ready, needs tool impl)
dashboard metrics
two-axis interview framing
progressive detail / recursive deflation
structured development spec registry  (tooling experiment)
portability boundaries  (deferred until substrate goal exists)
```
