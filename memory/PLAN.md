<!-- PLAN.md — single source of truth for WHAT'S NEXT.
     Created by ln-plan · Read by all skills · Updated by ln-build, ln-sync, and ln-spike.
     Authority: active frontier, near-horizon ordering, and dependencies that still matter.

     Frontier item = canonical plan/Linear/branch unit.
     Slice = scoped execution unit from ln-scope/ln-build, often inside one frontier.

     Keep this file light. Archive older completed work to docs/archive/PLAN_HISTORY.md.
     Edit Sequencing for ordering/status churn; keep Frontier Definitions relatively stable.

     Anchored on SPEC.md and the three POC architecture docs. -->

# Plan

## Context

Brunch-next is proceeding on the razed `next` line (tag `next-baseline`) as a thin product layer over `pi-coding-agent`. M0–M3 plus `pi-ui-extension-patterns` (FE-744) proved the basic host, JSONL transcript viability, probe/RPC substrate, read-only web shell, Pi extension seams, and public-RPC structured-exchange parity; detailed completed frontier definitions live in `docs/archive/PLAN_HISTORY.md`. The active frontier is now `sealed-pi-profile-runtime-state`, expanded in place into a **prep envelope before `graph-data-plane` (M4) CRUD**. It carries two strands under one branch (`ln/fe-776-graph-layer-prep-profile`): **(a) Pi harness sealing** — Brunch-owned programmatic settings/resource/tool/prompt/keybinding policy isolates product behavior from ambient user/project `.pi/`, and operational-mode / role-preset / strategy / lens state is appended to Pi JSONL as Brunch custom entries reconstructed at turn boundaries; **(b) graph-model lock-and-materialize** — lock the conceptual edge and node contracts in [`docs/design/GRAPH_MODEL.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/GRAPH_MODEL.md), stub the type/policy surface under `src/graph/`, and prove the A20-L Drizzle 1.0-beta + `drizzle-orm/typebox` + `better-sqlite3` + Pi `registerTool` round-trip so M4 CRUD lands on settled persistence/schema-derivation foundations. Phase 1 (edges) has landed; Phase 2 (nodes) and the Drizzle spike are the remaining moves before `graph-data-plane` resumes. A18-L strict command containment is still carried as a residual Pi API risk to route as a narrow upstream ask if the embedded-harness strand surfaces a clean seam.

Architecture grill (2026-06-01) locked several decisions that shape graph-data-plane and agent-graph-integration: **(1)** source topology `src/{.pi, agents, db, graph, session, rpc, web}` with directed layer dependencies (D52-L); **(2)** `commitGraph` — a single-tool atomic batch mutation accepting `{ nodes, edges }` with intra-batch and existing-node references, one LSN, all-or-nothing (D53-L, I34-L); **(3)** the `propose-graph` strategy bypasses review-set — user accepts a concept, agent generates and persists the full subgraph through `commitGraph` directly (D26-L updated); **(4)** strategy/lens axis split — strategies are interaction shapes (`step-wise-decision-tree`, `step-wise-disambiguate`, `propose-graph`, `project-graph`), lenses are topical focus (`intent`, `design`, `oracle`) (D25-L updated). The `commitGraph` path under `propose-graph` is the primary A14-L proof target: if LLMs cannot produce structurally-legal multi-node multi-edge batches, the core flow must be re-architected.

Phase 2 node grill (2026-06-01) locked the node layer: **(1)** common flat `GraphNode` shape with `title`, `body`, `basis`, `source` (free-form epistemic attribution), and `detail` JSON column (D54-L); **(2)** `provenance` retired from both nodes and edges — `change_log` owns audit trail (D55-L); **(3)** 11 intent kinds in 3 derived categories: basic (`goal`, `thesis`, `term`, `context`), structural (`requirement`, `assumption`, `constraint`, `invariant`), reasoning (`decision`, `criterion`, `example`) (D56-L); **(4)** `framing_as` retired, absorbed by thesis/term/constraint/invariant/goal (A7-L retired, D7-L retired, I7-L retired); **(5)** spec-grade grounding gate: LLM-judged satisficiency with count floor on basic-category nodes, Walter-style rubric in prompt (D57-L); **(6)** `posture` is spec-level, not a graph node; **(7)** modality-of-claim + source-question rubric and context promotion heuristic for agent prompting.

### POC assumption pressure

The POC should maximize assumption falsification rather than merely implement milestone labels. Treat the table below as the live consequence map from SPEC assumptions to frontier pressure; when scoping a frontier, prefer the thinnest slice that can validate or falsify its assigned assumptions. Retired/validated assumptions A10-L and A23-L are now carried by the SPEC decision/invariant residues for chrome, structured exchange, and public RPC parity; FE-744's remaining residue is the still-open A18-L containment limitation, not missing chrome work.

| Assumption | Pressure / what could falsify it | Plan consequence |
| --- | --- | --- |
| A1-L Pi substrate seams | A needed host/session/RPC/extension seam cannot be expressed without forking Pi. | Mostly exercised by M0-M3; FE-744 and `sealed-pi-profile-runtime-state` close the remaining UI/profile seams before graph-agent work depends on them. |
| A3-L command layer sufficiency | Agent, UI, reviewer, or capture writes need shortcuts around one `CommandExecutor`. | `graph-data-plane`, `agent-graph-integration`, and `authority-model` must prove one command boundary for every write path. |
| A4-L global LSN adequacy | Replay, staleness, or reconciliation ordering needs per-entity/vector clocks. | `graph-data-plane` establishes one-LSN-per-transaction; `turn-boundary-reconciliation` tries to break it with cross-session traces. |
| A5-L probe/transcript driver quality | Agent-as-user probes fail to catch regressions or cannot produce reviewable transcript evidence for realistic Brunch seams. | FE-744 has proved a deterministic public-RPC structured-exchange permutation driver; future brief-based or generative golden runs must pass through the `.fixtures/runs/<probe-id>/<run-id>/` probe/transcript artifact path. |
| A6-L unified `graph.*` namespace | Intent/oracle/design/plan semantics become confusing or unsafe under one umbrella. | `graph-data-plane` and `agent-graph-integration` should start unified but watch for namespace pressure. |
| A7-L `framing_as` modality | ~~Product framings need a node-shape carrier that `framing_as` cannot express.~~ | **Retired.** Phase 2 node lock absorbed `framing_as` into first-class `thesis`, `term`, `context`, `constraint`, `invariant`, and `goal` kinds (D54-L, D56-L). |
| A8-L reconciliation substrate | Gaps, contradictions, process debt, and conflicts need separate substrates immediately. | `graph-data-plane` builds the shared substrate; `coherence-first-class` and known-bad briefs test subtype pressure. |
| A9-L mention ledger granularity | Session-scoped snapshots miss necessary staleness or create noisy hints. | Defer until `turn-boundary-reconciliation`, after graph ids/LSNs exist. |
| A11-L next-turn delivery | Side-task/reviewer results require mid-turn delivery or another event plane. | Keep deferred until M5/M7 side-task/reviewer paths exist; test at turn-boundary rendezvous. |
| A13-L deferred observer/auditor queue | Async audit/backfill needs canonical chat/turn tables or privileged writes. | Not load-bearing after D18-L; defer until a backstop queue is actually introduced. |
| A14-L graph-mutation structural legality | LLMs cannot produce structurally-legal `commitGraph` batches (multi-node multi-edge with intra-batch refs) or review-set entity drafts reliably enough. The `propose-graph` → `commitGraph` path (D53-L) is the primary proof target. | `graph-data-plane` must land `commitGraph` batch validation (I34-L); `agent-graph-integration` must test LLM generation against real CommandExecutor. This is the highest-stakes assumption: failure requires re-architecture of the propose-graph flow. |
| A15-L establishment hints | Offers are not reconstructable or useful from transcript entries alone. | M5 establishment-offer probe runs and FE-744 chrome affordances exercise this. |
| A16-L reviewer trigger/scope | Reviewer findings are too slow, noisy, or incomplete under deferred policy. | Do not overbuild early; first accepted review-set probe runs should make reviewer policy empirical. |
| A17-L elicitation temperament preference | Users do not need persistent interrogative/proposal preference. | Outer-loop adoption signal only; do not block POC. |
| A18-L command containment | Hiding suggestions + lifecycle blocking leaves unsafe Pi built-ins reachable. | FE-744 product-shell evidence must name any Pi upstream seam before M5/M6 authority work relies on it. |
| A19-L sealed Pi profile | Ambient `.pi` settings/resources still shape Brunch product behavior. | `sealed-pi-profile-runtime-state` is a gate before graph tools and authority-sensitive agent work. |
| A20-L Drizzle line + schema path | The chosen Drizzle line blocks migrations, SQLite fidelity, monotonic counter/change-log mechanics, or runtime-schema derivation. | Prove the persistence seam now inside `sealed-pi-profile-runtime-state`: one representative table plus monotonic counter / change-log skeleton, then let `graph-data-plane` inherit the settled choice. |
| A21-L bounded coherence | Contradiction/gap verdicts cannot represent useful coherence without broader judgment. | Keep implementation late (M8), but design known-bad probe scenarios earlier so the rubric is falsifiable. |
| A22-L synchronous elicitor capture | Elicitor over-captures, misses obvious facts, or cannot use preface to resolve uncertainty. | `agent-graph-integration` needs targeted capture probe runs before async observer backstops are reconsidered. |


## Sequencing

### Active

(none — `graph-data-plane` just completed; `agent-graph-integration` is next)

### Next

1. `agent-graph-integration` — M5. Graph tools, synchronous elicitor capture, review-set acceptance, and reviewer advisory writes through pi extension seams; all writes via the shared command layer.

### Parallel / Low-conflict

- `probes-and-transcripts-evolution` — Harden the probe/transcript artifact path as new seams need evidence: report schemas, transcript renderers, targeted probe scenarios, and optional brief inputs that feed normal `.fixtures/runs/<probe-id>/<run-id>/` runs. Doc/test-heavy, but assumption-critical.
- `subagents-for-proposal-diversity` — Optional enhancement to candidate-proposal generation (D44-L). Lands when `agent-and-graph-integration` (M5) is far enough along that batch-proposal flow exists and would benefit from parallel data-gathering; never a blocker.

### Horizon

- `authority-model` — M6. Three-tier policy (autonomous / requires-confirmation / human-only) end-to-end across modes.
- `turn-boundary-reconciliation` — M7. Graph-revision tracking, session interest sets, `worldUpdate` injection, and the mention-staleness hint synthesiser.
- `coherence-first-class` — M8. Clarify the product meaning of coherence, then implement synchronous structural legality plus stored semantic coherence verdicts visible to UI and agent.
- `compaction-and-conflict-widening` — M9. Compaction preserves graph + coherence anchors; interest sets can widen; conflict signals remain intelligible at long horizons.
- `flue-pattern-adoption` — Sandbox abstraction (SessionEnv/SandboxApi style), remote-deploy shape, MCP adapter. Post-POC.
- `oracle-design-plan-graphs` — Lift oracle / design / plan planes from stub status to durable persistence + commands. Post-POC.
- `framework-direction-stubs` — Lightweight structural stubs for Context layer, capability tiers, candidate artefacts. Discretionary; only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — Datalog-shaped intent store and petri-net plan execution. Exploratory; parallel to Brunch proper.

## Frontier Definitions

### sealed-pi-profile-runtime-state

- **Name:** Sealed Pi profile, transcript-backed runtime state, and graph-model prep (M4 prep envelope)
- **Linear:** [FE-776](https://linear.app/hash/issue/FE-776)
- **Branch:** `ln/fe-776-graph-layer-prep-profile`
- **Kind:** structural hardening (prep envelope before M4 CRUD)
- **Status:** done
- **Objective:** Broader prep envelope before `graph-data-plane` (M4) CRUD work begins. Two strands under one frontier/branch: **(a) Pi harness sealing** — Brunch-owned programmatic settings/resource/tool/prompt/keybinding policy isolates product behavior from ambient user/project `.pi/`; operational mode / role preset / strategy / lens state is appended to Pi JSONL as Brunch custom entries and reconstructed at turn boundaries. **(b) Graph-model lock-and-materialize** — lock the conceptual edge and node contracts in [`docs/design/GRAPH_MODEL.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/GRAPH_MODEL.md), stub the type/policy surface under `src/graph/`, and prove the A20-L persistence seam now: the Drizzle line, row-schema derivation path, monotonic counter allocation, change-log shape, and Pi `registerTool` round-trip so M4 CRUD lands on settled persistence/schema-derivation foundations.
- **Why now / unlocks:** FE-744 proved multiple Pi extension seams and exposed the exact weak point: ambient resource discovery and settings policy had to be sealed before future `elicit` vs `execute` work could depend on product-owned prompt/tool posture. Once sealing is in code, the cheapest remaining moves before M4 CRUD are conceptual rather than persistence-mechanical: lock the graph model so review-set drafts, reconciliation needs, snapshot bucketing, and CommandExecutor result discriminants share a stable contract; retire the speculative named-relation catalogue and brainstormed edge taxonomy; settle the persistence/schema-derivation toolchain (A20-L). De-risks M5/M6/M7 before graph tools, capture/reviewer jobs, and authority gating depend on the embedded harness or the graph data plane.
- **Acceptance:**
  - **Sealing strand:** A `BrunchPiProfile` (or equivalent module boundary) owns settings policy, resource-loader options, extension factories, keybinding/command policy, tool policy, and prompt policy; tests prove ambient context files/extensions/skills/prompt templates/themes do not load while explicit Brunch-owned extension-discovered resources can load intentionally through Pi `resources_discover`; settings that affect product behavior are overridden/sealed or documented as a Pi upstream seam; runtime extension factories load explicitly from `src/.pi/pi-extension-shell.ts` / `src/.pi/extensions/*` and reusable TUI components under `src/.pi/components/*`, with no root project-local Pi discovery path as product runtime. Full selected-state transcript entries under `brunch.agent_runtime_state` can be appended by Brunch helpers and replayed to reconstruct active operational mode, role preset/runtime bundle, strategy, and lens; turn prep composes prompt packs from base Brunch prompt + operational mode + role preset + strategy + lens + spec readiness grade + elicitation posture + current graph/coherence/world state + pending structured-interaction rules; `elicit` suppresses execute/dangerous tools such as raw `bash`/`write` unless explicitly allowed by the active bundle.
  - **Graph-model strand:** Phase 1 edge contract locked in `docs/design/GRAPH_MODEL.md` and materialized as type/policy stubs under `src/graph/` (✓ landed at commit `100585a1`). Phase 2 node contract locked (✓ landed at commits `b6ecec1e`–`8346e23d`): 11 intent kinds in 3 derived categories (basic/structural/reasoning), common `GraphNode` shape with `detail` JSON column for `decision`/`term`, `provenance` retired from both nodes and edges, `framing_as` retired, `source` as free-form epistemic attribution, modality-of-claim + source-question agent rubric, context promotion heuristic. Materialized as `src/graph/schema/nodes.ts` and reflected in SPEC via D54-L/D55-L/D56-L/D57-L plus I36-L/I37-L. A20-L spike produces a verdict on the persistence seam over one representative intent-plane slice: Drizzle line choice, row-schema derivation path (`drizzle-zod`, `drizzle-orm/typebox`, or equivalent), monotonic counter allocation, change-log writes, and Pi `registerTool` round-trip.
- **Verification:** Inner — profile/runtimestate unit tests, prompt-composition snapshot tests, tool-policy contract tests, edge/node schema unit tests, category-policy unit tests. Middle — ambient `.pi/` fixture/audit tests proving disabled discovery and sealed settings; explicit Brunch resource-injection test proving extension factories may inject Brunch-owned skills/prompts despite ambient `noSkills`/`noPromptTemplates`; JSONL reload/projection tests for runtime init/switch entries; before-agent-start/tool-call policy tests for `elicit`; persistence spike tests covering one representative table, one insert/select cycle, monotonic counter allocation, change-log append shape, and one Pi `registerTool` parameter binding; I26-L grep-based architectural test wired alongside the first Drizzle import so the single-schema-vocabulary boundary stays enforced. Outer — manual TUI/RPC smoke that active role/lens/strategy changes are inspectable in transcript and reflected in prompt/tool posture rather than hidden UI state.
- **Cross-cutting obligations:** Do not expose Pi's generic extension/skill/prompt/theme configuration to Brunch users; do not make Pi skills the primary authority for core operational prompts; keep raw Pi RPC behind Brunch adapters; keep runtime state linear-transcript-backed and compatible with compaction/session-boundary lifecycle hooks (`session_start`, `resources_discover`, `before_agent_start`, `context`, `tool_call`, `session_before_switch`, `session_before_compact`, `session_shutdown`). Graph-model lock work must trace to `docs/design/GRAPH_MODEL.md`; node lock must preserve the closed-edge-set invariants (immutable accepted-edge identity, `dependency`-only auto-cascade, separate `ReconciliationNeed` substrate with `{kind:'edge'|'node_pair'}` target). The persistence spike is throwaway scope — one representative slice, no broad imports until the verdict lands; if the current beta line blocks (migrations, SQLite fidelity, schema-derivation bugs, or ergonomics), pick the simpler working adapter/line and continue without re-opening M4 design.
- **Traceability:** R25, R26 / D2-L, D16-L, D23-L, D39-L, D40-L, D41-L, D51-L / I24-L, I25-L, I26-L / A19-L, A20-L
- **Design docs:** [GRAPH_MODEL.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/GRAPH_MODEL.md) (canonical graph contract; Phase 1 + Phase 2 locked), [pi-seam-extensions.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md), [pi-ui-extension-patterns.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-ui-extension-patterns.md)
- **Current execution pointer:**
  - **Sealing strand:** ✓ Complete. Profile resource/settings/runtime slices landed. Session display names generated from spec title + ordinal, persisted via Pi `session_info`, rendered in TUI chrome.
  - **Graph-model strand:** ✓ Complete. Phase 1 (edges) + Phase 2 (nodes) locked. A20-L persistence spike validated (`drizzle-orm@0.45.2` + `drizzle-typebox@0.3.3` + `better-sqlite3@12.8.0`).
  - **Tie-off:** ✓ Both strands at acceptance. `graph-data-plane` (M4 CRUD) is unblocked.

### graph-data-plane

- **Name:** Graph data plane (intent-first, workspace-graph-ready) (M4 CRUD)
- **Linear:** [FE-741](https://linear.app/hash/issue/FE-741/graph-data-plane-intent-first-workspace-graph-ready-m4)
- **Branch:** `ln/fe-741-graph-data-plane` (stacked on `ln/fe-737-web-shell`; will re-base above `ln/fe-776-graph-layer-prep-profile` once the prep envelope ties off)
- **Kind:** structural
- **Status:** done (all 6 execution steps complete 2026-06-01)
- **Objective:** Stand up SQLite-backed CRUD over the prep-envelope-locked graph model: durable intent-plane nodes and edges per [`docs/design/GRAPH_MODEL.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/GRAPH_MODEL.md); a single global LSN per commit; the change log; the reconciliation-need substrate; named homes for coherence state (verdicts and violations); and the `commitGraph` atomic batch mutation (D53-L) that accepts `{ nodes, edges }` with intra-batch and existing-node references — all forward-compatible with oracle, design, and plan planes. Source topology follows D52-L: `db/` owns Drizzle schema and migrations; `graph/` owns the CommandExecutor, readers, policy, validators, snapshot bucketing, change-log replay, and recon-need substrate; `graph/` imports from `db/`; no other layer imports `db/` directly.
- **Why now / unlocks:** Pins I1-L, I6-L. Unlocks all agent ↔ graph work (M5+) and lets oracle / design / plan planes be added later without re-foundation. The graph contract and persistence toolchain are settled by the prep envelope, so M4 is pure CRUD/transaction/CommandExecutor work rather than mixed design-and-mechanics. Landing `commitGraph` here (not deferring to M5) means the A14-L proof can run as soon as agent tools are wired.
- **Acceptance:** Graph CRUD + change-log replay tests pass through the `CommandExecutor` public mutation boundary; command results already include success, `needs_human`, `policy_blocked`, `version_conflict`, and `structural_illegal` shapes even if pre-M6 policy classification is minimal; `commitGraph` batch validation is all-or-nothing (I34-L) — if any node or edge fails structural checks, the entire batch is rejected with diagnostics sufficient for agent self-correction; reconciliation-need substrate accepts inserts/updates/resolutions with LSN invariants enforced; oracle-plane stub tables exist (Check, Validation Method, Evidence, Obligation) even if unused; graph snapshot readers support at least two detail levels (cursory full-graph overview, node-neighborhood with hops) per I35-L; the persistence layer proves the one-transaction protocol that couples authority/result classification, version checks, structural validation (including the closed edge-category set, immutable accepted-edge identity per D51-L, and intra-batch reference resolution per D53-L), LSN allocation, change-log append, and any coherence updates.
- **Verification:** Inner gate plus command/result schema/type tests. Middle — property/model-based tests on LSN monotonicity, graph replay, reconciliation invariants (target shape `{kind:'edge'|'node_pair'}`), framing matrix, edge structural legality (closed category set, stance scoping, supersession acyclicity), `commitGraph` batch all-or-nothing property (I34-L), intra-batch reference resolution correctness, existing-node reference validation, and `CommandExecutor` transaction/result behavior; architectural no-bypass tests. Outer — fixture property invariants on reconciliation-substrate begin running.
- **Cross-cutting obligations:** Reuse the Drizzle + `better-sqlite3` persistence shape settled by the prep-envelope A20-L spike; do not re-open the line/adapter choice in M4 unless the spike itself falsifies it. `CommandExecutor` result contract and no-bypass transaction rule become shared infrastructure for later direct-agent, elicitor-capture, deferred observer/auditor, side-task, migration, and UI-attributed writes. Derive row/insert/update runtime schemas from Drizzle table definitions via the schema path chosen during the spike — do not hand-author parallel row schemas. The I26-L grep-based architectural test should already be live from the prep envelope; M4 widens its coverage as new Drizzle imports land. `commitGraph` and `acceptReviewSet` are parallel paths to the same CommandExecutor — both must share the same validation, LSN, and change-log mechanics.
- **Traceability:** R7, R9, R13 / D3-L, D4-L, D6-L, D8-L, D9-L, D16-L, D20-L, D41-L, D51-L, D52-L, D53-L / I1-L, I6-L, I7-L, I11-L, I26-L, I34-L, I35-L / A3-L, A4-L, A14-L
- **Design docs:** [GRAPH_MODEL.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/GRAPH_MODEL.md) (canonical graph contract), [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [pi-seam-extensions.md §Graph clock, §Reconciliation-need substrate, §Oracle plane](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md) (note: §"Edge types" in pi-seam-extensions.md is retired and superseded by `docs/design/GRAPH_MODEL.md`)
- **Current execution pointer:** **(1)** ✓ `src/db/` Drizzle schema + `initSchema` DDL push + graph_clock seed. **(2)** ✓ `CommandExecutor` result contract and one-transaction LSN/change-log skeleton with `createNode` proof-of-life, I26-L architectural boundary test, NodeId/EdgeId corrected to `number`. **(3)** skipped — subsumed by (4). **(4)** ✓ `commitGraph` atomic batch mutation with intra-batch + existing-node ref resolution, edge structural validation (closed category set, stance scoping, self-loop rejection), I34-L all-or-nothing (edge failure rolls back nodes), one LSN per batch, one change_log entry per batch. **(5)** ✓ graph snapshot readers (`getGraphOverview`, `getNodeNeighborhood`) with superseded-predecessor exclusion, configurable hop depth, typed domain returns (I35-L); **(6)** ✓ reconciliation-need substrate (`createReconciliationNeed`, `resolveReconciliationNeed`, `getOpenReconciliationNeeds`) with target validation, LSN invariants, and change_log; oracle-plane stub acceptance met by existing `createNode` + `ORACLE_KINDS`. **All M4 graph-data-plane steps complete.**

### agent-graph-integration

- **Name:** Agent ↔ graph integration through the shared command layer (M5)
- **Linear:** [FE-785](https://linear.app/hash/issue/FE-785)
- **Branch:** `ln/fe-785-agent-graph-integration` (stacked on `ln/fe-776-graph-layer-prep-profile`)
- **Kind:** structural
- **Status:** in-progress
- **Objective:** Brunch installs graph tools through pi's extension seams; agent graph operations — including `commitGraph` batch mutations for the `propose-graph` direct-commit path (D53-L, D26-L) — elicitor post-exchange capture writes, reviewer-attributed advisory writes, review-set batch acceptances for `project-graph`, spec readiness grade/posture updates, and the transcript-native establishment/intent-hint surfaces all route exclusively through the Brunch-owned command layer and shared event substrate; web, TUI, and agent all observe the same changes. **The primary A14-L proof runs here:** test whether the LLM can produce structurally-legal `commitGraph` batches against the real CommandExecutor with bounded retry.
- **Acceptance:**

  ```text
  acceptance:
  ├── command-routing through CommandExecutor
  │   ├── agent CRUD on intent-plane nodes (create / update / link via Brunch tools)
  │   ├── elicitor capture (post-exchange, synchronous)
  │   ├── reviewer writes (target restricted to `reconciliation_need`)
  │   └── acceptReviewSet commits batch atomically (one LSN, one change-log entry)
  ├── exchange entries (custom)
  │   ├── brunch.establishment_offer       [must carry: lens/routing metadata]
  │   └── brunch.elicitor_intent_hint      [must carry: lens/routing metadata]
  ├── capture rules (post-exchange, synchronous)
  │   ├── high-confidence extractive facts → commit
  │   ├── readiness updates                → commit
  │   └── low-confidence implications      → stay in structured-exchange preface/question material
  ├── proposal rules
  │   ├── carry explicit support/grounding coverage
  │   ├── carry epistemic_status
  │   └── only dry-run-valid proposals surface as reviewable review sets
  ├── reviewer policy
  │   ├── advisory only (writes only `reconciliation_need`)
  │   └── initial POC reviewer trigger/scope policy recorded in implementation docs/tests (not implicit)
  ├── architectural invariants (lint or test)
  │   ├── no direct DB access
  │   ├── no caller-side authority bypass outside command layer
  │   └── reviewer cannot write anything other than `reconciliation_need`
  ├── cross-surface observability
  │   └── same change observed across TUI and web client
  └── async substrate (conditional)
      └── if observer/auditor queues land → backstops only, not primary capture freshness path
  ```
- **Implementation layout:** Per D52-L, graph domain logic lives in `src/graph/` (CommandExecutor, readers, policy, validators, snapshot functions) and persistence in `src/db/`. The Pi-facing adapter goes in one explicit product extension directory, `src/.pi/extensions/graph/`, imported by `src/.pi/pi-extension-shell.ts` as `registerBrunchGraph` rather than discovered dynamically. Use `graph/index.ts` only to register Pi tools, message renderers, and event hooks. Keep tool definitions in `graph/tools/*` (`read-graph`, `commit-graph`, `create-intent-node`, `update-intent-node`, `link-intent-nodes`, `accept-review-set`), boundary schemas in `graph/schemas/*` (`tool-inputs`, `tool-results`, `custom-entries`), transcript helpers in `graph/transcript/*` (`entries`, `projections`, `renderers`), synchronous capture in `graph/capture/post-exchange-capture.ts`, reviewer target enforcement in `graph/reviewer/reviewer-writes.ts`, and the Pi→CommandExecutor translation seam in `graph/command-adapter.ts`. The extension directory must not own SQLite/Drizzle persistence, LSN allocation, structural graph validators, reviewer-agent implementation, or capture model/prompt machinery; those are Brunch product/core modules passed into the extension through explicit shell options such as `{ graph: { commandExecutor, capturePostExchange?, reviewerWrites? } }`. Agent prompts, strategy definitions (including `propose-graph` and `project-graph`), lens definitions, and context builders live in `src/agents/` per D52-L.
- **Verification:** Inner — verify gate plus graph-tool/capture/reviewer command shape tests, proposal-entry schema validation (`brunch.review_set_proposal` must declare `epistemic_status` and support/grounding coverage), establishment-offer / elicitor-intent-hint schema validation (must declare `lens`), structured-exchange `preface` contract tests, and projection-helper tests for latest-offer lookup. Middle — `CommandExecutor` contract tests including `acceptReviewSet` discriminants and the rule that only dry-run-valid proposals become reviewable review sets, direct-DB no-bypass checks, extension-layout/import-boundary tests proving `src/.pi/extensions/graph/**` reaches graph mutation only through `command-adapter.ts` and never imports Drizzle/SQLite directly, post-exchange capture fixtures distinguishing committed facts from preface-only implications, reviewer-job restart/idempotence tests keyed by batch-acceptance entry id, reviewer-write-target architectural boundary test (rejects non-`reconciliation_need` targets), `acceptReviewSet` batch-atomicity property tests (one LSN / one change-log entry; partial-batch impossible under mid-batch validation failure), `supersedes`-chain acyclicity property tests, lens-routing correctness property tests, differential test comparing dry-run validation at proposal time vs real-run validation at acceptance, and cross-surface projection checks. Outer — kernel-card-output coverage assertions begin landing through targeted probe runs; first batch-proposal probe (e.g. `propose-scenarios-with-tradeoffs`) replays through review cycle + acceptance; A14-L proposal structural-legality rate captured in probe metadata as POC-phase fitness (not merge gate); 1–2 known-bad coherence-problem probe scenarios exercise reviewer precision; side-task / elicitor-capture / reviewer-attributed writes remain indistinguishable from other writes at the command-layer boundary except for attribution and reviewer's narrow target.
- **Cross-cutting obligations:** Preserve the single-authority mutation rule for primary-agent, elicitor-capture, reviewer, side-task, and batch-acceptance flows by making the `CommandExecutor` the only mutation entry; deferred observer/auditor jobs, if introduced, are operational backstops keyed to transcript anchors, not a revived chat/turn store or privileged primary extraction path; reviewer is advisory and writes only to `reconciliation_need`; lens metadata on elicitor-emitted entries routes capture/reviewer/future-auditor consumption; establishment offers remain orientation artifacts for chrome/web surfaces rather than a default exhaustive lens picker.
- **Traceability:** R10, R13, R17, R21, R22, R23 / D4-L, D13-L, D15-L, D18-L, D20-L, D25-L, D26-L, D27-L, D28-L, D29-L, D30-L, D32-L, D45-L, D46-L, D47-L, D50-L / I2-L, I11-L, I14-L, I15-L, I16-L, I17-L, I18-L, I20-L, I30-L, I31-L, I33-L / A3-L, A11-L, A13-L, A14-L, A16-L, A22-L
- **Design docs:** [prd.md §M5, §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [ELICITATION_LENSES.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/ELICITATION_LENSES.md), [REVIEW_SETS.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/REVIEW_SETS.md)
- **Current execution pointer:** **(1)** ✓ Source topology move: `src/tui-client/.pi/` → `src/.pi/` per D52-L. **(2)** ✓ `commit_graph` and `read_graph` Pi tools wired through `CommandExecutor` and pre-bound `GraphSnapshotReaders` via `src/.pi/extensions/graph/`; command-adapter translation seam, TypeBox parameter schemas, I26-L-compliant enum re-exports from `graph/index.ts`, extension shell conditional wiring; 9 integration tests. Next: validate the tools work with a real LLM (A14-L outer-loop proof), then scope capture/reviewer slices.

### subagents-for-proposal-diversity

- **Name:** Subagents for candidate-proposal diversity (optional enhancement)
- **Linear:** unassigned
- **Kind:** optional enhancement
- **Status:** deferred (lands when `agent-and-graph-integration` is far enough along to benefit; never a blocker for M0–M9)
- **Objective:** Register a single `subagent` Pi tool per D44-L so the main agent can (a) fan out blocking data-gathering calls (scout / researcher / graph-reader) in parallel to ground proposals, then (b) fan out parallel `proposer` invocations to generate diverse candidate variants — the subagent realization of `ln-design`'s "design it twice" pattern and `ln-oracles`'s parallel-fan-out — and finally compose `brunch.review_set_proposal` entries from those variants via the D31-L meta-rubric. Subagent results return as tool content; no `CommandExecutor` access; no Brunch RPC access; isolated `pi --no-session --no-skills --no-extensions` subprocesses inheriting Brunch Pi Profile sealing.
- **Acceptance:** `subagent` tool registered with `{ agent, task }` and `{ tasks: [] }` parameters; starter agents scout/researcher/graph-reader/proposer land as markdown files with TypeBox-validated frontmatter under `src/.pi/extensions/subagents/agents/`; proposer is system-prompt-only (no tools) and produces exactly one variant per invocation; argv shape per spawned subprocess includes `--no-session --no-skills --no-extensions` plus an explicit per-agent tool allowlist / model / system-prompt path; concurrency cap honored from [src/.pi/extensions/subagents/config.json](file:///Users/lunelson/Code/hashintel/brunch-next/src/.pi/extensions/subagents/config.json); subagents have no inherited conversation context so the task string must carry everything; result text returns as tool result content with no transcript side-effects; at least one batch-proposal probe exercises a `tasks: []` parallel `proposer` fan-out (≥ 2 variants) feeding a single `brunch.review_set_proposal` composed by the main agent via the D31-L meta-rubric.
- **Verification:** Inner — `subagent` tool argv-shape tests; TypeBox schema validation of agent frontmatter and `config.json`; per-starter-agent tool-allowlist conformance (proposer must have an empty tool set). Middle — isolation audit (no ambient `.pi/` resources reachable; parent `CommandExecutor` / Brunch RPC handlers absent from subprocess environment); subprocess streaming / abort propagation tests; parallel-fan-out independence test (two `proposer` invocations with distinct framings produce structurally distinct outputs). Outer — proposal-generation probe invokes scout/researcher/graph-reader to ground, then parallel `proposer` variants, and surfaces the composed review-set proposal with grounding-bundle coverage and `epistemic_status` consistent with the gathered evidence; meta-rubric application visible in the comparison rendering.
- **Cross-cutting obligations:** Preserve the single-authority mutation rule (`CommandExecutor` only — subagents never bypass it) and the sealed Pi Profile (no ambient `.pi/` leakage through the subprocess boundary). Cross-extension agent registration (Amos's `globalThis.__pi_subagents` bridge) is deferred because it conflicts with profile sealing; the POC registry is Brunch-owned only. Worker-style write-capable subagents are deferred until an execute operational mode exists.
- **Traceability:** R20 / D2-L, D26-L, D27-L, D30-L, D31-L, D39-L, D41-L, D44-L / I2-L, I11-L, I24-L, I29-L
- **Design docs:** [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [ELICITATION_LENSES.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/ELICITATION_LENSES.md), [REVIEW_SETS.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/REVIEW_SETS.md)

### authority-model

- **Name:** Authority model and gated tools (M6)
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Fill in the policy matrix behind the existing `CommandExecutor` result seam: three-tier policy (autonomous / requires-confirmation / human-only) implemented end-to-end; headless modes fail or delegate cleanly with structured `needs_human`; attribution + optimistic concurrency shared across all callers.
- **Acceptance:** Adversarial briefs requesting human-gated actions in print/RPC produce structured `needs_human` through the command result contract; an authority test matrix passes across all four modes; M6 does not introduce a second policy service or caller-side authority gate.
- **Verification:** Inner gate plus policy classifier/result-shape unit tests. Middle — authority matrix contract tests across TUI/web/print/RPC through the existing `CommandExecutor` result seam. Outer — adversarial probe for structured `needs_human` regression.
- **Traceability:** R5, R6, R12 / D4-L, D20-L
- **Design docs:** [prd.md §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### turn-boundary-reconciliation

- **Name:** Detection, relevance, turn-boundary reconciliation (M7)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Graph-revision tracking; session interest sets; `worldUpdate` synthesised by `prepareNextTurn`; mention-ledger staleness hints; side-task-result and reviewer-finding drain at the same boundary; session/spec binding transitions — and any lens switches present by then — recompute interest set before next agent turn.
- **Acceptance:** Cross-session paired probe exercises `worldUpdate` filtering; mention-staleness hints synthesise when an entity changed since last snapshot; succeeded side-task results are delivered only at the next turn boundary; reviewer findings from earlier batch acceptances arrive as advisory `reconciliation_need` items at the same boundary, never mid-turn; session/spec binding transitions and any emitted `brunch.lens_switch` entries recompute interest sets.
- **Verification:** Inner gate plus mention-ledger/session-interest unit tests. Middle — generated LSN/change traces and property tests for I4-L, I5-L, I9-L, I12-L, I16-L; subscription/update ordering checks for turn-boundary messages including reviewer findings. Outer — paired-brief adversarial capture passes, including side-task delivery and reviewer-finding delivery when those subsystems are active.
- **Cross-cutting obligations:** This frontier is the rendezvous point for Brunch's shared next-turn event semantics: `worldUpdate`, side-task results, reviewer findings, lens changes, session/spec binding state, and mention staleness must coexist without inventing a second event plane.
- **Traceability:** R11, R13, R14, R18, R21 / D6-L, D11-L, D14-L, D15-L, D17-L, D29-L / I1-L, I4-L, I5-L, I9-L, I12-L, I16-L / A4-L, A9-L, A11-L, A16-L
- **Design docs:** [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [pi-seam-extensions.md §5 Graph-entity mentions](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### coherence-first-class

- **Name:** Coherence as a first-class graph property (M8)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Structural legality enforced synchronously; semantic coherence stored as explicit product state; UI and agent read the same coherence verdict; before-images available where needed.
- **Acceptance:** "Contradictory requirements" adversarial brief produces an `incoherent` verdict with a backing open reconciliation need; coherence verdict surfaces in the TUI chrome and in `graph.*` reads.
- **Verification:** Inner gate plus structural validator tests. Middle — coherence-emission property tests proving backing reconciliation needs and projection/query visibility. Outer — adversarial probe for contradictory requirements plus manual UI checklist for visible coherence verdict.
- **Cross-cutting obligations:** Coherence verdicts must remain visible through the same transcript/graph authority model that side tasks, elicitation exchanges, deferred audit/reviewer jobs, and reconciliation needs already use; this frontier must not hide coherence behind a private subsystem.
- **Traceability:** R12, R14 / D8-L / I6-L
- **Design docs:** [pi-seam-extensions.md §Reconciliation-need substrate](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### compaction-and-conflict-widening

- **Name:** Compaction-aware continuity and conflict widening (M9)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Compaction preserves graph, coherence, and continuity anchors per D43-L; interest sets can widen beyond direct reads when needed; conflict signaling remains intelligible at long horizons.
- **Acceptance:** Long-horizon adversarial brief (50+ turns) replays through compaction with `lastSeenLsn`, interest set, and session binding preserved; spec/session changes across compaction boundaries do not desync; the auto-compaction extension renders the configured preserved-anchor set byte-stable so active spec, in-flight side-task / deferred-auditor-job / reviewer-job bookkeeping, latest `brunch.agent_runtime_state`, latest `brunch.establishment_offer`, latest `brunch.lens_switch`, unresolved staleness hints, and active review-set leaves remain intelligible after compaction; ambient-affordance chrome continues to render the current offer; auto-compaction failure falls through to Pi default compaction rather than dropping anchors silently.
- **Verification:** Inner gate plus continuity-metadata unit tests and TypeBox schema validation of [src/.pi/extensions/auto-compaction-anchors.json](file:///Users/lunelson/Code/hashintel/brunch-next/src/.pi/extensions/auto-compaction-anchors.json). Middle — compaction round-trip/property tests for `lastSeenLsn`, interest set, session binding, graph/coherence anchors, active side-task/deferred-auditor/reviewer bookkeeping, latest-establishment-offer/lens/runtime-state reconstruction; deterministic anchor-rendering tests (same branch + same config → same header bytes); fallback-to-Pi-default behavior under simulated auth failure, empty LLM output, and thrown error. Outer — long-horizon probe passes, including continuity checks for side-task, interest-set, runtime-state, and establishment-offer state when present.
- **Cross-cutting obligations:** Preserve the coherence anchors, session binding, session continuity metadata, and side-task/deferred-auditor/spec state that earlier milestones attached to the shared transcript/event substrate; preserve lens state only if a lens subsystem has landed by then. The auto-compaction extension is the canonical owner of `session_before_compact`; product code paths that touch compaction must compose with it rather than register a parallel hook.
- **Traceability:** R15 / D6-L, D15-L, D43-L / I12-L, I28-L
- **Design docs:** [prd.md §Continuity, Divergence, and Coherence](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### probes-and-transcripts-evolution

- **Name:** Evolve probe/transcript strategy as captures land
- **Linear:** unassigned
- **Kind:** hardening
- **Status:** not-started
- **Objective:** Keep the current probe/transcript substrate honest as new seams need evidence: report envelopes, Brunch-semantic transcript rendering, artifact layout, targeted probe scenarios, optional brief inputs, agent-as-user evaluator shape (mission/intention, evaluation focus, max-turn budget, blocker/friction report), and per-assumption fitness notes as real probe runs expose gaps.
- **Acceptance:** Each assumption-heavy frontier either lands a transcript-backed probe run under `.fixtures/runs/<probe-id>/<run-id>/`, extends the probe/report/transcript contract, or explicitly records "no probe change needed" for the assumptions it touched. Optional brief-shaped inputs may be added only as inputs to concrete probe runs, not as a standalone library obligation.
- **Verification:** PR review on the doc plus cross-check that new/changed probe assertions map to SPEC assumptions/invariants or acknowledged blind spots; downstream probe runs catch regressions and surface assumption fitness rather than only pass/fail.
- **Cross-cutting obligations:** Treat probe/transcript strategy as canonical verification architecture that must stay in sync with SPEC/PLAN, not as optional commentary. If an assumption is not being tested by its assigned frontier, PLAN should say whether it is deferred, accepted as risk, or needs a spike/oracle pass.
- **Traceability:** A5-L
- **Design docs:** [probes-and-transcripts.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/probes-and-transcripts.md)

### flue-pattern-adoption

- **Name:** Adopt selected Flue patterns post-POC
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon
- **Objective:** Bring sandbox abstraction (SessionEnv/SandboxApi style), remote-deployment shape, MCP adapter style, and per-run event-stream style into Brunch via Brunch-side adapters over pi. Not part of POC.
- **Acceptance:** Defer until POC success criteria are met; revisit then.
- **Verification:** Defer.
- **Traceability:** Future Direction Register §Adoption patterns from Flue
- **Design docs:** [pi-seam-extensions.md §Flue framework evaluation](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### oracle-design-plan-graphs

- **Name:** Lift oracle / design / plan planes from stub to durable
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon
- **Objective:** Promote oracle-plane stub to first-class persistence + commands; bring design and plan graphs online behind the same command layer.
- **Acceptance:** Defer until POC success criteria are met.
- **Verification:** Defer.
- **Traceability:** R9, R13
- **Design docs:** [pi-seam-extensions.md §Oracle plane](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### framework-direction-stubs

- **Name:** Lightweight stubs for Context layer, capability tiers, candidate artefacts
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** horizon
- **Objective:** Add minimal structural stubs (named namespaces, empty tables, or typed placeholders) for the deferred subsystems where a stub is cheaper than leaving a hole.
- **Acceptance:** Discretionary; only land when downstream pressure makes a stub cheaper than a hole.
- **Verification:** Defer.
- **Traceability:** Future Direction Register §Framework alignment & deferred subsystems
- **Design docs:** [pi-seam-extensions.md §Framework alignment & deferred subsystems](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### geolog-and-petri-execution

- **Name:** Geolog (TA1.2) and petri-net plan execution
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon
- **Objective:** Exploratory — Datalog-shaped intent store (Geolog) and petri-net-compiled plan execution. Parallel to Brunch proper; surface here so dependents know it is acknowledged.
- **Acceptance:** Defer; tracked elsewhere.
- **Verification:** Defer.
- **Traceability:** Future Direction Register §Framework alignment & deferred subsystems

## Recently Completed

- 2026-06-01 `graph-data-plane` (FE-741) — Done: all 6 execution steps complete. **(1)** Drizzle schema + `initSchema` DDL push + graph_clock seed. **(2)** `CommandExecutor` result contract, one-transaction LSN/change-log skeleton, `createNode` proof-of-life, I26-L architectural boundary test. **(3)** skipped (subsumed by 4). **(4)** `commitGraph` atomic batch mutation with intra-batch + existing-node ref resolution, edge structural validation, I34-L all-or-nothing. **(5)** graph snapshot readers (`getGraphOverview`, `getNodeNeighborhood`) with superseded-predecessor exclusion, configurable hop depth, typed domain returns (I35-L). **(6)** reconciliation-need substrate (`createReconciliationNeed`, `resolveReconciliationNeed`, `getOpenReconciliationNeeds`) with target validation + LSN invariants; oracle-plane stub acceptance met by existing node kinds. Verified: `npm run verify` after each slice. `agent-graph-integration` (M5) is now unblocked.
- 2026-06-01 `sealed-pi-profile-runtime-state` (FE-776) — Done: prep envelope tied off. Both strands complete: **(a)** Pi harness sealing including sealed profile, runtime-state transcript projection, session display names via Pi `session_info`; **(b)** graph-model lock-and-materialize with Phase 1 (edges) + Phase 2 (nodes) locked in `docs/design/GRAPH_MODEL.md`, code stubs under `src/graph/`, and A20-L persistence spike validating `drizzle-orm@0.45.2` + `drizzle-typebox@0.3.3` + `better-sqlite3@12.8.0`. `graph-data-plane` (M4 CRUD) is now unblocked. Verified: `npm run verify` after each slice.
- 2026-06-01 `pi-ui-extension-patterns` (FE-744) — Done. All Pi extension seam evidence for M5/M6/M7 landed. Detailed frontier definition archived to [docs/archive/PLAN_HISTORY.md §2026-06-01 Sync archive](file:///Users/lunelson/Code/hashintel/brunch-next/docs/archive/PLAN_HISTORY.md).

Older history (including `web-shell`, `graph-data-plane` Phase 1 edge lock, `jsonl-session-viability`, `mode-shell-and-fixture-driver`, `walking-skeleton`): `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
nodes:
  sealed-pi-profile-runtime-state   [done]                   (M4 prep envelope: sealing + graph-model lock)
  graph-data-plane                  [done]                   (M4 CRUD proper)
  agent-graph-integration           [in-progress]            (M5)
  subagents-for-proposal-diversity  [deferred · optional]
  authority-model                   [not-started]            (M6)
  turn-boundary-reconciliation      [not-started]            (M7)
  coherence-first-class             [not-started]            (M8)
  compaction-and-conflict-widening  [not-started]            (M9)
  probes-and-transcripts-evolution  [continuous, parallel]

edges:
  sealed-pi-profile-runtime-state  -[hard]->         graph-data-plane
  graph-data-plane                 -[hard]->         agent-graph-integration
  agent-graph-integration          -[hard]->         authority-model
  agent-graph-integration          -[hard]->         turn-boundary-reconciliation
  agent-graph-integration          -[optional]->     subagents-for-proposal-diversity
  turn-boundary-reconciliation     -[hard]->         coherence-first-class
  coherence-first-class            -[hard]->         compaction-and-conflict-widening
  graph-data-plane                 -[on promotion]-> oracle-design-plan-graphs

groups:
  unconnected:
    flue-pattern-adoption
    oracle-design-plan-graphs
    framework-direction-stubs
    geolog-and-petri-execution

notes:
  - probes-and-transcripts-evolution runs in parallel across all frontiers; not a spine edge.
  - unconnected items are horizon work; surfaced for acknowledgment, not active dependency.
  - the m5 -> subagents edge is `optional` — subagents is never a blocker for the spine.
  - `pi-ui-extension-patterns` (FE-744) tied off 2026-06-01; see docs/archive/PLAN_HISTORY.md.
```
