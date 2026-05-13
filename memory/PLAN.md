<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, the first relation-first observer capture seam, the multi-chat substrate (chat containers + `reconciliation_need` queue), **side-chat V3.0 — hard-impact cascade through `reconciliation_need`**, and **side-chat V3.1 — agent-grouped reconciliation resolution** all ship as working product. V3.1 closes the V3.x arc: the reconciliation classifier writes `auto-confirm` / `auto-edit` / `substantive` per row and the Pending review surface renders chips + per-class actions + bulk Confirm-all / Apply-all-suggested.

The next product arc is a **continuous conversational workspace** plus a stronger semantic/generative substrate. Continuous workspace is already active in parallel: it gives the chat runtime a stable phase-addressable host. The FE-705 branch contributes an integration substrate — a local agent capability CLI and external LLM-as-user probe harness — that should be reconciled into main before graph-review and scenario-options work depends on generated completed-spec fixtures. After that, the highest-coordination work is the intent-graph semantic model and semantic changeset ledger; lower-coordination provider, gitignore, and web-research work can proceed in parallel.

The May 2026 intent-spec, multi-chat, changeset-ledger, prompt/context, and agent-mutation design notes are reconciled into one direction. `docs/design/MULTI_CHAT.md` is the substrate document. `docs/design/SIDE_CHAT.md` describes side-chat V1 / V2 / V3.0 / V3.1 / V4 phasing on top of that substrate. `docs/design/PATCH_LEDGER.md` remains historical deeper design pressure for semantic mutation history, but canonical future-facing vocabulary is `changeset` / `change`; `docs/archive/design/INTENT_SPEC_EVOLUTION.md` carries the broader synthesis. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` (canonical reference for FE-700) and `docs/design/BEHAVIORAL_KERNELS.md` (kernel probes). FE-705's branch-local strategy/proposal notes add scenario options, graph-review oracle, chat-local strategies, and concern/dependency mapping; those notes should become a canonical design doc when the branch is integrated. The dev-layer self-tooling trajectory lives in `docs/design/DEV_WORKFLOW_EVOLUTION.md`.

## Active

1. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and the single actionable frontier preserved at the current reachable phase.
   - Why now / unlocks: workflow read/write ownership is extracted (FE-616); the multi-chat substrate ships chat containers below the specification, so continuous workspace can adopt one visible runtime without smuggling in a second durable workflow model. Side-chat V3.0 + V3.1 just closed, so the cascade surface is stable; no remaining V2/V3 placeholder blocks the workspace work. This is being handled in parallel with the FE-705 reconciliation lane.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`; umbrella synthesis in `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md`.

## Next

2. **FE-705 integration — agent capability CLI + LLM-as-user fixture probe** — integrate the branch-complete local `brunch agent` JSONL capability adapter and external probe runner so agents can drive the real Brunch interview flow through Brunch-owned contracts rather than privileged ORM access.
   - Linear: FE-705. Pi comparison remains FE-635 after this seam has a real Brunch use case to compare against.
   - Status: branch-complete off main; not treated as shipped in main until the FE-705 implementation is rebased and verified. Canonical plan records it as the near-term integration substrate because later graph-review/scenario-options probes need credible completed-spec fixtures.
   - Why now / unlocks: prompt/context and graph-review probes need realistic graph/transcript fixtures, but hand-authoring those fixtures is chicken-and-egg. A JSONL capability adapter lets an external LLM-as-user drive the real lifecycle through the same mutation authority future agents must use, pressure-testing tool-call vocabulary, chat readiness, resource identity, fixture curation, and import-boundary discipline.
   - Recommended shape: preserve the branch's split between server-owned capability contracts and script-side probe harness. The adapter exposes explicit resource-id calls (`spec.create`, `chat.getPrimary`, `chat.ensureReady`, `chat.read`, `turn.submitResponse`, and follow-on lifecycle/export operations as scoped); the probe runner owns scenario briefs, model-backed simulated-user policy, artifact bundles, fixture-candidate inspection, and workspace-state preservation. Keep browser automation, product UI, provider credential UX, shared production provider routing, and durable runtime-operation ledgers out of the integration slice.
   - Verification approach: contract/dispatcher tests, JSONL protocol/session tests, import-boundary tests proving the probe runner uses only the JSONL client/process boundary, fake process tests, opt-in real-provider smoke, and fixture-candidate structure/readiness checks.
   - Traceability: Requirement 43; A89; D143, D147; I114. Also protects Requirements 40, 41, 42 by making prompt/context and mutation-surface probes executable through a real adapter.
   - Design docs: `docs/design/AGENT_MUTATION_SURFACE.md`; `docs/archive/design/INTENT_SPEC_EVOLUTION.md`; FE-705 branch artifacts until rebased.

3. **Intent graph semantics + relation-policy directionality foundation** — refine the ontology and relation policy so the graph can represent invariants, examples/counterexamples, constraint subtypes, narrowed decisions, witness strength, checkability gaps, and operational edge behavior as source/destination material for future generative features.
   - Linear: FE-700.
   - Why now / unlocks: candidate generation, behavioral kernels, graph review, scenario-options acceleration, architect proposals, direct-edit cascade, and downstream verification-aware decomposition all need a sharper semantic target than the current exploration/review ontology. This is the semantic-layer lane most likely to collide with parallel work, so it should land before broadening observer enrichment or committing generated candidate bundles.
   - Recommended shape: add `invariant` and `example` as first-class durable kinds; subtype examples; narrow `decision`; enrich `constraint`, `criterion`, and `invariant` subtypes; add `checkability` and witness strength; introduce the five-family relation taxonomy and negative relations; add edge epistemic metadata; and make relation-policy directionality explicit (`canonicalSentence`, `inverseSentence`, source-change behavior, target-change behavior) rather than inferring cascade from raw edge direction. Leave room for contrastive-kernel artifacts such as `alternative`, `question`, `ambiguity`, and `candidate`, but keep them proposal-local unless probes prove they need durable top-level kinds.
   - Verification approach: corpus/fixture observer probes comparing old vs refined ontology; relation-policy unit tests for mixed-direction relations; graph-review manual assessment for precision/noise; context-pack probe outputs must show authority, witness, relation support, and directionality labels.
   - Traceability: Requirement 38; A77, A78, A80, A81, A84; D134, D136, D137, D139, D140.
   - Design docs: `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/archive/design/INTENT_SPEC_EVOLUTION.md`; FE-705 strategy/proposal notes for relation directionality.

4. **Semantic changeset ledger + proposal-turn staleness** — introduce the semantic history spine that separates graph mutation history from conversational turn ancestry.
   - Linear: FE-701.
   - Status: not complete in main. Current code has `reconciliation_need`, side-chat apply behavior, and the V3.1 classifier lifecycle, but no first-class `changeset` / `change` ledger and no durable proposal-turn staleness semantics.
   - Why now / unlocks: scenario bundle acceptance, direct-edit atomicity, accepted-with-issues flows, stale proposal detection, graph-review repairs, side-chat V4b item versioning, and future architect/reconciliation agents all need a durable semantic mutation boundary. Without it, productized scenario-options can stay probe-only but cannot safely commit candidate bundles.
   - Recommended shape: add `changeset` / `change` as canonical schema and operation vocabulary; track the latest semantic changeset per specification; stamp proposal turns with base/opened changeset identity; connect `reconciliation_need.caused_by_changeset_id`; keep proposals/findings as turn-owned artifacts until accepted; ensure only `accept` applies a proposal changeset; and treat a changeset as the smallest atomic unit that preserves semantic coherence.
   - Verification approach: DB atomicity tests for changeset + changes + reconciliation_need writes, staleness tests for open proposal turns across multi-chat changes, capability/transition tests proving non-accept actions cannot mutate graph truth.
   - Traceability: Requirements 39, 42, 44; A71, A79; D135, D138, D143.
   - Design doc: `docs/design/PATCH_LEDGER.md` (historical filename; future vocabulary is changeset/change); FE-705 strategy/proposal notes for semantic history and proposal turns.

5. **Graph-review oracle + scenario-options probes** — build the internal critique path and artifact-only candidate bundle probes before product UI.
   - Linear: FE-702 for graph-review / scenario probes; FE-649 and FE-640 remain productization children under FE-698 where relevant.
   - Why now / unlocks: product wants first-turn strategy choice and mid-interview acceleration, but engineering needs graph-review critique to make generated candidate bundles credible. This lane can advance in parallel with FE-700 if it stays artifact-only and does not commit canonical graph truth.
   - Recommended shape: define candidate graph bundle and graph-review finding artifacts; add a graph-review prompt/context pack and rubric covering coherence, fixed-premise respect, coverage, tradeoff honesty, checkability, granularity, scenario fidelity, epistemic labels, provenance, and downstream usefulness; generate 2–3 scenario options that complete the current direction from context-packed accepted graph truth; run fast gates before display and deeper async critique/refine/repair as probe artifacts; classify candidate readiness as `draft` / `reviewing` / `reviewed_clean` / `reviewed_with_issues` / `blocked`; keep broader graph-review issues turn-owned rather than adding a `graph_issue` table.
   - Verification approach: scenario-runner fixtures, FE-705 JSONL-generated completed-spec fixtures, raw output review, structured parse validation, qualitative scorecards, and comparison against drilldown-produced graphs. Middle/outer-loop oracle design should decide when fixture candidates become golden.
   - Traceability: Requirements 20, 21, 31, 32, 40, 41, 43, 44; A67, A68, A80, A85, A87, A89; D126, D127, D139, D141, D147.
   - Design docs: `docs/design/BEHAVIORAL_KERNELS.md`; `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/design/AGENT_MUTATION_SURFACE.md`; FE-705 strategy/proposal notes.

6. **Productized scenario-options / candidate-spec completion assist** — replace skip-only remainder handling with first-turn strategy choice and a mid-interview `speed this up` path that generates reviewed candidate graph bundles with tradeoffs, completing the current direction by default.
   - Why later: product UI waits on graph-review probes, FE-700 semantics, and FE-701 changesets. Until then, scenario-options remain artifact/proposal-only.
   - Scope relationship: this likely absorbs or reshapes **two-axis interview framing** and **progressive detail / recursive deflation** because first-turn strategy and speed-up paths are where those distinctions become actionable. The broader **architect / generator loop** remains related but not fully subsumed; autonomous graph mutation proposals through changeset/reconciliation stay a later capability unless deliberately narrowed into this surface.
   - Depends on: FE-705 fixture substrate, prompt/context substrate, intent graph semantics + relation-policy directionality, graph-review oracle, and changeset ledger for canonical acceptance.
   - Traceability: Requirements 31, 40, 44; A67, A77, A78, A85; D126, D134, D136, D139.

## Parallel / low-conflict candidates

- **First-run provider setup** — make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer / observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
  - Linear: FE-633 covers the OpenRouter/default-provider part; dashboard credential UX + XDG key storage may need a sibling issue if split from provider proving.
  - Traceability: Requirements 34, 35, 36; A74, A75; D130, D131, D132; I106.

- **Workspace hygiene / `.brunch/` gitignore assist** — detect whether generated local state is already ignored and, with explicit confirmation, add an idempotent `.gitignore` entry or create `.gitignore` when absent.
  - Linear: FE-648.
  - Traceability: Requirement 37; A76; D133; I107.

- **Productized web research capability** — web search and page-fetch tools as interviewer-invoked context gathering, surfaced as preface cards after the scenario substrate proves query framing, tool ergonomics, and provisional-context handling.
  - Linear: FE-649.
  - Depends on: prompt/context scenario substrate and web-research probe.
  - Traceability: Requirements 20, 21, 40, 41; D99, D112, D139, D142.

## Horizon

### Semantic and generative follow-through

- **Relation-first observer capture enrichment** — the first cut is shipped; enrichment waits for FE-700 relation policy so observer output can broaden across the refined ontology without flooding the graph.
  - Depends on: intent graph semantics + relation-policy directionality; prompt/context substrate.
  - Traceability: Requirements 30, 38, 40; A66, A81, A84; D125, D136, D137, D139, D140; I109.

- **Architect / generator loop** — autonomous agent that iterates over the intent graph and proposes semantic changes for HITL review through the same future changeset / reconciliation pathway as user-driven edits.
  - Status: related to scenario-options but broader. Keep productized architect proposals behind multi-chat + reconciliation + semantic changesets; use the scenario substrate for shadow/proposal-only probes first.
  - Traceability: A73, A85, A87; D139, D141.

- **Server mini-library compartmentalization** — refactor growing server seams into plural public roots with same-named private subtrees where FE-698 / FE-705 pressure has made boundaries too implicit.
  - Status: near-term refactor candidate after FE-705 integration, not product roadmap work.
  - Candidate shape: `fixtures.ts` + `fixtures/`, `context-packs.ts` + `context-packs/`, `prompts.ts` + `prompts/`, `scenario-runner.ts` + `scenario-runner/`, `entity-apis.ts` + route submodules, and `agent-apis.ts` + capability/protocol subtrees.

### Side-chat follow-on

- **Side-chat persistence — V4a (multi-chat Phase 2 substrate)** — side-chat client persists its turns into the existing `chat` / `turn` tables with `chat.kind='side_chat'`, loads prior side-chat sessions on remount, and surfaces an "Old chats" affordance per pinned item / spec.
  - Status: deprioritized below continuous workspace and semantic/generative substrate. Phase 1 substrate already ships schema support; the remaining decision is the anchor model (`chat` row anchor fields vs deferred `chat_focus` table).
  - Linear: FE-675 (umbrella; V4a half).
  - Traceability: Requirement 39; A82, A83; D138.
  - Design docs: `docs/design/MULTI_CHAT.md` §10 Phase 2; `docs/design/SIDE_CHAT.md` §9 V4 row.

- **Side-chat V4b — item versioning + branched exploration** — once the changeset ledger lands, item versioning unblocks dangling-annotation repair and soft-edit audit; branched exploration lets drill-downs / past-turn edits / revisits coexist with the original chain.
  - Depends on: semantic changeset ledger; V4a side-chat persistence.
  - Traceability: A72, A73, A85; D139, D141.

### Lower-priority / unclear product surface

- **Dashboard result summaries and completeness metrics** — progress visibility across specifications.
- **Spatial canvas layout for graph view** — add the spatial DAG layout as a second layout choice inside graph mode, alongside the structured-list route.
- **Graph view active-path render filter + scope toggle** — render only active-path items by default in graph view, with a `Show all` toggle.
- **MCP server adapter for core operations** — future adapter over capability contracts, not direct ORM / route wrappers.
- **Git-friendly file-based persistence representation for diffable exported specs**.
- **Typed fixture-builder convergence for happy-path tests**.

### Meta / deferred boundaries

- **Structured development spec registry** — prototype file-backed canonical spec records, deterministic checks, generated markdown views, and task-local slices for Brunch's own development workflow.
  - Meaning: self-tooling experiment for Brunch's development process, not product functionality. It would make `memory/SPEC.md` / `memory/PLAN.md` generated views over structured records to reduce drift and merge conflicts.
  - Status: design horizon, not a migration commitment.
  - Design doc: `docs/design/DEV_WORKFLOW_EVOLUTION.md`.

- **Portability boundaries** — split durable store/read-model, interview session runtime, and workspace capability provider if Brunch targets hosted, remote, embedded, or sandbox-backed operation.
  - Meaning: future architecture boundary map for non-local deployments or adapter-backed execution. Deferred until hosted/remote/sandbox operation becomes a product goal.
  - Deep design source: `docs/design/PORTABILITY_BOUNDARIES.md`.

## Recently Completed

- [2026-05-11] **Side-chat V3.1 — agent-grouped reconciliation resolution** (FE-674, PR #124 + downstack) — closes the V3.x arc end-to-end. Server: `POST /api/specifications/:id/reconciliation-needs/run-agent` (spec-level classifier loop) and `POST /api/specifications/:id/reconciliation-needs/:needId/reset-agent` (per-row Re-run) walk every awaiting open need through I114's `null → queued → classifying → classified | failed` lifecycle; agent_classification persists one of `auto-confirm` / `auto-edit` / `substantive`; agent_proposal carries an optional text suggestion. Client: `<ClassificationChip>` renders six visual variants per row; `<RunAgentButton>` in the Pending review header with conditional 1s polling while any need is in flight; per-row Re-run on classified/failed rows; per-class action buttons (`auto-confirm` → Confirm, `auto-edit` → View proposal + Apply + Skip, `substantive` → Open side-chat via `useSideChat().openFor`); bulk Confirm-all (N) and Apply-all-suggested (N) iterate serially over existing per-row endpoints. Listing endpoint extended with `target_item_kind` + `target_reference_code` to feed the Open-side-chat handoff. Verified: `npm run verify` 1178 / 1179 pass (one unrelated `side-chat-route` flake). **Watch**: A88 outer-loop walkthrough has not yet happened — empirical signal on whether agent grouping helps legibility vs V3.0's flat list remains open; capture qualitative notes during the next manual walkthrough on a dense spec.
- [2026-05-11] FE-698 reconciliation context-pack slice — Added a proposal-only reconciliation prompt/context scenario that renders open reconciliation needs with source/target anchors, reason/status, prompt/context fingerprints, and read-only capability metadata. This is substrate-only: no FE-674 need lifecycle endpoint, overlay action, side-chat reducer, or durable mutation behavior. Verified: `npm run verify`. Watch: next FE-698 work can move to broader read-only/proposal-only probes and the Pi adapter spike without treating this pack as a resolution agent.
- [2026-05-08] **Side-chat V3.0 — hard-impact cascade through `reconciliation_need`** (FE-674, PR #115 + #116 + #117) — three-card stack closes V3.0. Card 1 (PR #115): server `cascade-producer` + `getDownstreamEdges` + `openReconciliationNeedIfAbsent`; hard-impact apply mutates the source and opens one need per typed dependency edge; response shape adds `openedNeedIds`; partial-unique-index dedupe. Card 2 (PR #116): drop deferred banner; new `GET /api/specifications/:id/reconciliation-needs` endpoint and `useSpecificationOpenReconciliationNeeds` query; patch-list overlay renders a Pending review section listing open needs with kind chip and source/target references. Card 3 (PR #117): idempotent `POST /api/specifications/:id/reconciliation-needs/:needId/resolve` endpoint and per-row Resolve button; mutation pending state disables the button mid-flight. Verified: `npm run verify` (1063 tests, 0 lint warnings). Watch: A88 (Path 1 sufficiency without agent) is partially validated mechanically — full validation depends on outer-loop walkthrough on dense graphs. V3.1 (agent-grouped resolution) shipped 2026-05-11; richer per-row kinds beyond single Resolve are V3.1. SIDE_CHAT.md §9 updated to reflect the V3.0 single-action shape.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Workspace shell (parallel colleague lane)
continuous-workspace / phase-addressable interview surface  (active)
  ├──→ stable host for side-chat persistence and strategy chats
  └──→ workspace-aware graph / structured-list peer routes

TRACK B — Agent fixture substrate (FE-705 integration lane)
prompt/context scenario substrate foundation  (completed)
  └──→ agent capability CLI + LLM-as-user fixture probe  (next, branch-complete off main)
        ├──→ generated completed-spec fixture candidates
        ├──→ graph-review oracle + scenario-options probes
        └──→ Pi harness comparison  (future, FE-635)

TRACK C — Semantic substrate (highest coordination)
multi-chat-substrate + reconciliation-needs  (completed)
  ├──→ intent graph semantics + relation-policy directionality  (next, FE-700)
  │     ├──→ relation-first observer enrichment  (horizon, first cut already shipped)
  │     ├──→ robust direct-edit / reconciliation cascade policy
  │     └──→ graph-review oracle can become semantically meaningful
  └──→ semantic changeset ledger + proposal-turn staleness  (next, FE-701)
        ├──→ canonical scenario bundle acceptance
        ├──→ direct-edit atomicity with caused_by_changeset_id
        ├──→ stale open proposal detection
        └──→ architect-loop / verifier/import mutation provenance

TRACK D — Strategy probes and product acceleration
FE-705 fixtures + FE-700 semantics
  └──→ graph-review oracle + scenario-options probes  (next, artifact-only)
        └──→ productized scenario-options / candidate-spec completion assist  (after changesets)
              ├──→ absorbs / reshapes two-axis interview framing
              └──→ absorbs / reshapes progressive detail / recursive deflation

TRACK E — Low-conflict parallel work
first-run provider setup
workspace hygiene gitignore assist
productized web research capability

LOWER-PRIORITY / DEFERRED
side-chat persistence V4a / V4b
spatial graph layout + active-path filter
dashboard metrics
MCP adapter / file-based persistence / typed fixture builders
structured development spec registry
portability boundaries
```
