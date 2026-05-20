<!-- SPEC.md — live architecture register.
     Created by ln-spec · Read by all skills · Refreshed by ln-sync.
     Authority: product contract, active assumptions, current decisions,
     critical invariants, future direction pointers, lexicon, verification stance.

     Anchored on the three canonical POC docs:
       - docs/architecture/prd.md
       - docs/architecture/pi-seam-extensions.md
       - docs/architecture/fixture-strategy.md

     When re-running ln-spec: read this file first, preserve existing authority,
     and evolve only the touched area. SPEC is not an implementation diary.
     Together with PLAN.md, this is the only canonical planning state. -->

# Brunch (POC over pi)

## Product Contract

### Concept

Brunch is an opinionated local product that helps a human and an agent co-author a **specification workspace** as a graph-native artifact. It runs as a single installable CLI over the `pi-coding-agent` harness and exposes one host through four presentation modes (TUI, web, RPC, print). The intent graph is canonical specification meaning; oracle, design, and plan graphs are accountable downstream planes. Coherence is shared product state, not an implicit hope.

The POC's purpose is to prove three things: (a) that pi's coding-agent harness can be the substrate without forking it; (b) that a graph-native spec workspace plus a JSONL-first transcript can coexist coherently under one mutation authority; (c) that capture-aware, offer-first elicitation produces specs that are inspectable, replayable, and pressure-testable through a fixture library.

### Constraints & Non-goals

- Do not expose pi's extension, skill, prompt-template, or theme APIs to Brunch users in the POC.
- Do not make REST the primary product API. JSON-RPC is the primary protocol; HTTP is a thin transport shim only.
- Do not target cloud-hosted, multi-machine, or organization-wide deployment in the POC.
- Do not solve mid-turn distributed consistency; the contract is turn-boundary clean only.
- Do not reuse `pi-web-ui` for the browser surface; the web client is a native Brunch React app.
- Do not expose a generic `records.*` data model. The vocabulary is graph-native (`graph.*`, `intent.*`, `oracle.*`, `design.*`, `plan.*`) or session-native (`session.*`).
- Do not adopt Flue as the harness substrate. Stay on `pi-coding-agent`; adopt Flue *patterns* (sandbox abstraction, remote-deploy shape, MCP adapter) selectively, post-POC.

### Capability Requirements

#### Distribution & lifecycle

1. Brunch must be installable and runnable as a single local CLI from any project directory.
2. Brunch must scope its durable state to `.brunch/` under the current working directory.
3. Brunch must reuse pi's coding-agent harness rather than fork pi for the POC.

#### Modes & authority

4. Brunch must expose TUI, web, RPC, and print modes over the same local host authority.
5. Brunch must support structured `needs_human` outcomes for human-only actions in headless modes.
6. Brunch must support three authority tiers (autonomous / requires confirmation / human-only) with consistent enforcement across modes.

#### Persistence & data model

7. Brunch must store spec-workspace graph truth in SQLite-backed graph-native persistence.
8. Brunch must prove that transcript persistence is rich enough for raw assistant and user payloads plus custom turn data — using pi JSONL sessions if sufficient, or a justified fallback otherwise.
9. Brunch must treat the intent graph as canonical specification meaning, with oracle, design, and plan graphs as accountable downstream planes.

#### Mutation, transport & subscriptions

10. Brunch must route all graph mutations through one Brunch-owned command layer.
11. Brunch must use JSON-RPC as the primary browser and RPC transport.
12. Brunch must support subscriptions as a first-class transport primitive for both session and graph state.

#### Continuity & coherence

13. Brunch must detect relevant cross-session graph changes between turns and surface them via a `worldUpdate` custom-message role.
14. Brunch must surface coherence as shared product state to both user and agent.
15. Brunch must preserve graph and coherence anchors across compaction.

#### Elicitation product shape

16. Brunch must open every session with a concrete offer (action or question) rather than an empty prompt.
17. Brunch must support radio (single-select), checkbox (multi-select), and freeform-plus-choice answer interfaces over one offer envelope.
18. Brunch must support `#`-mentions of graph entities anchored to stable IDs, with session-scoped staleness tracking that produces discretionary re-read hints during `prepareNextTurn`.
19. Brunch must enforce a workspace state hierarchy `cwd → spec → session`, where the active spec is selected before any agent loop runs and persists across `/new`.

#### Verification & fixtures

20. Brunch must ship a brief library and an agent-as-user driver over the JSON-RPC stdio surface to capture replayable golden runs and property-checkable fixtures.

## Live Architecture Register

### Open Assumptions

| # | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | --- | --- | --- | --- | --- |
| A1-L | `pi-coding-agent` exposes enough seams (services, custom message roles, `prepareNextTurn`, `transformContext`, RPC mode, JSONL sessions, extension UI surface) to host all M0–M9 capabilities without forking pi. | high | open | D1-L | M0–M2: walking skeleton + mode shell + JSONL viability prove the substrate. |
| A2-L | pi JSONL sessions can faithfully hold raw assistant/user payloads, Brunch custom turn data, and continuity metadata (`lastSeenLsn`, interest sets, compaction anchors) through reload. | medium | open | D6-L, I3-L | M2 — JSONL session viability slice. If false, fall back per the three options in PRD §6. |
| A3-L | A single Brunch-owned command layer (with optimistic concurrency, validation, audit, and coherence triggers) is sufficient for both agent and human writers across all four modes for the POC's graph scale. | medium | open | D4-L | M4 + M5 + M6: graph plane, agent-↔-graph wiring, and authority tiers all routed through the same surface. |
| A4-L | A monotonic global LSN per commit (one-LSN-per-transaction) is adequate for change-log replay, reconciliation-need ordering, and mention staleness without per-row vector clocks. | high | open | I1-L, I4-L | M4 + M7: replay fidelity and `worldUpdate` ordering tests. |
| A5-L | An agent-as-user driver running over JSON-RPC stdio can produce regression-quality fixtures across a curated brief library. | medium | open | D5-L | M1 — first replay-regression fixtures land. |
| A6-L | The graph-native vocabulary can be deferred from explicit per-plane namespacing (`intent.*`, `oracle.*`, etc.) and start unified under `graph.*` without painful rework later. | medium | open | D3-L | M4–M5: if intent-plane plus oracle-plane stubs both fit under one namespace cleanly, the assumption holds. |
| A7-L | `framing_as` as an orthogonal modality on existing node kinds is sufficient for product-intent ontology (problem, persona, JTBD, etc.) and does not need to become first-class node kinds in the POC. | medium | open | D7-L | Fixture runs across briefs #1–#7: if a framing repeatedly demands unique relation policy, promote per the seam-extensions Open Question #8. |
| A8-L | One reconciliation-need substrate, sharing the same global LSN as the change log, can absorb impasses, conflicts, gaps, and process debt without needing finer kind subtypes in the POC. | medium | open | D8-L | M8 + adversarial fixtures ("contradictory requirements") exercise the substrate; subtype split deferred per Open Question #10. |
| A9-L | A session-scoped mention ledger of (`entity_id`, `snapshotted_lsn`) is the right granularity for staleness hints; transcript-scoped or graph-scoped ledgers are not needed for the POC. | low | open | I7-L | M7 — turn-boundary reconciliation slice; observed via fixture runs that stress re-read decisions. |
| A10-L | A persistent TUI chrome region showing cwd / spec / phase / chat-mode can be added on top of `pi-tui`'s root layout without modifying pi. | medium | open | D2-L | M0 — walking skeleton attempts to mount the chrome; escalates to a pi upstream issue only if blocked. |

### Active Decisions

#### Substrate & posture

- **D1-L — Depend on `pi-coding-agent`, not only `pi-agent-core`.** The POC reuses the coding-agent service bundle, TUI/print adapters, RPC machinery, session logging, and tool plumbing. Dropping down to `pi-agent-core` is a fallback if Brunch proves too different. Depends on: A1-L. Supersedes: —.
- **D2-L — Brunch is an opinionated product, not a pi platform shell.** The POC hardcodes its toolset, system prompt, and policy doctrine; scopes state to `.brunch/`; and hides pi's generic extension surface from end users. Depends on: A1-L. Supersedes: —.

#### Data model & vocabulary

- **D3-L — Graph-native, session-native vocabulary; no generic `records.*` surface.** Commands converge on `graph.*` / `session.*` (with per-plane families `intent.*`, `oracle.*`, `design.*`, `plan.*` available when sharper semantics are useful). Depends on: A6-L. Supersedes: —.
- **D7-L — `framing_as` modality, not first-class kinds, for product-intent framings.** Product framings (problem, persona, JTBD, non-goal, etc.) are an orthogonal modality on existing intent/constraint node kinds, gated by an allowed matrix. Depends on: A7-L. Supersedes: —.
- **D8-L — Reconciliation needs are a first-class substrate alongside graph truth, change log, and coherence verdict.** Needs (impasses, gaps, contradictions, process debt) share the same global LSN as the change log and follow the same mutation invariant. Depends on: A8-L. Supersedes: —.
- **D9-L — Reasoning records split by shape.** `decision` is graph-native; `impasse` is a reconciliation need, not a graph node; `justification` stays compact (rendered text on the decision) until forced otherwise. Depends on: D8-L. Supersedes: —.

#### Authority & mutation

- **D4-L — One shared mutation surface owns graph truth.** Every semantic graph mutation routes through Brunch-owned typed command handlers responsible for validation, structural legality, optimistic concurrency, event emission, audit attribution, and coherence triggering. Agents and adapters must not touch the ORM or SQLite directly. Depends on: A3-L. Supersedes: —.

#### Transport & client

- **D5-L — JSON-RPC is the primary product protocol.** Same command surface over stdio (RPC mode), WebSocket (browser), and in-process (TUI/agent tools). HTTP exists only as a transport shim (static bundle, health, uploads, webhooks). The RPC stdio surface is also the agent-as-user fixture-capture interface. Depends on: A5-L. Supersedes: —.
- **D10-L — Web client is a native Brunch React app over one WebSocket RPC client.** TanStack Router + TanStack Query + Brunch-owned chat primitives (Vercel AI SDK UI or TanStack AI style). `pi-web-ui` is not reused. Depends on: D5-L. Supersedes: —.

#### Persistence

- **D6-L — JSONL-first transcript persistence in `.brunch/sessions/`; SQLite-backed graph persistence in `.brunch/`.** Two durability surfaces with distinct responsibilities. Transcript starts on pi `SessionManager` redirected to the project-local directory; graph plane is SQLite from M4. Depends on: A2-L. Supersedes: —.

#### Interaction & UI shape

- **D11-L — Workspace state hierarchy `cwd → spec → session`, with spec selection gated before any agent loop.** Spec selection is durable across `/new` and persisted in `.brunch/state.json`. Spec switching always emits a `brunch.spec_switch` custom entry through the command layer. Depends on: A10-L. Supersedes: —.
- **D12-L — Offer-first interaction, one envelope, multi-shape overlay.** `brunch.offer` is a single custom-message envelope with `multi` (radio vs checkbox), `freeform`, `allowSkip`, `expiresOn`, and `captureHint?` fields. Selections are durable transcript truth, not ephemeral UI state. Depends on: D4-L. Supersedes: —.
- **D13-L — Capture-aware offer envelope.** Substantive questions may carry a `captureHint` private to the observer (expected kinds, candidate relations, target items, capture mode, optional per-option mapping). Hints are advisory priors; the observer must abstain when responses do not match. Depends on: D12-L. Supersedes: —.
- **D14-L — `#`-mentions are ID-anchored, with a session-scoped mention ledger.** Autocomplete may resolve by title but insertion always rewrites to ID-anchored. Per-session `(entity_id, snapshotted_lsn)` ledger drives discretionary `brunch.mention_staleness_hint` entries in `prepareNextTurn`. Depends on: A9-L, I4-L. Supersedes: —.

### Critical Invariants

| # | Invariant | Protected by | Proves |
| --- | --- | --- | --- |
| I1-L | One global LSN per commit; every change-log entry, graph-node version, and reconciliation-need carries an LSN strictly monotonic with the global clock. | planned (M4 invariant tests) | D4-L, D6-L, D8-L |
| I2-L | All durable graph mutations originate from the Brunch command layer; no caller bypasses validation, audit, or coherence triggering. | planned (M5 architectural test + lint rule) | D4-L |
| I3-L | Transcript reload reproduces raw assistant/user payloads plus all Brunch custom turn entries byte-equivalently (modulo timestamps). | planned (M2 viability tests) | A2-L, D6-L |
| I4-L | For every `worldUpdate` entry, all named graph items have LSNs strictly greater than the session's pre-update `lastSeenLsn`. | planned (M7 property test) | D6-L, I1-L |
| I5-L | For every `brunch.lens_switch` and `brunch.spec_switch` entry, the session interest set is recomputed before the next agent turn. | planned (M7 property test) | D11-L |
| I6-L | Every reconciliation need has `created_at_lsn ≤` current global LSN; `kind='impasse'` needs reference at least two graph nodes; resolved needs carry a strictly later `resolved_at_lsn`. | planned (M8 property test) | D8-L, I1-L |
| I7-L | Every `framing_as` value belongs to the allowed matrix for that node's base kind. | planned (fixture property check) | D7-L |
| I8-L | Spec selection persists across pi `switchSession` (i.e. `/new`); spec change happens only through the selector overlay and emits a `brunch.spec_switch` command-layer entry. | planned (TUI integration test, M0) | D11-L |
| I9-L | Every `brunch.mention` payload is anchored to a stable `id`; the ledger never stores title-anchored references. | planned (M7 invariant) | D14-L |
| I10-L | Offer envelopes, their responses, and capture hints all live in the transcript via `pi.appendEntry`; no parallel ephemeral channel carries elicitation state. | planned (M1+ invariant) | D12-L, D13-L |

## Future Direction Register

### Framework alignment & deferred subsystems

- **Geolog (TA1.2 data store).** Datalog-shaped logical store eventually backing intent/oracle queries. Domain modelling itself is non-trivial and parallel to Brunch. See pi-seam-extensions §Framework alignment.
- **Plan execution & Petri-net compatibility.** Plan-graph compiled alongside an execution petri-net carrying colored tokens that refer back to plan nodes by ID. Currently exploratory; not part of POC scope.
- **Context subsystem.** Acknowledged as large-scope; deferred. Brunch may stub minimal structure (e.g. an explicit per-turn `Context` namespace under `prepareNextTurn`) without implementing the full subsystem.
- **Capability tiers** (distinct from authority tiers). A future second axis classifying what an agent *can* do versus what it *may* do. Stub deferred.
- **Candidate artefacts.** Pre-graph, agent-proposed nodes/edges awaiting user adjudication. Currently absorbed by the reconciliation-need substrate; may graduate to a first-class plane later.

### Adoption patterns from Flue

- Sandbox abstraction modeled on Flue's `SessionEnv` / `SandboxApi` interface, retrofitted onto pi via a Brunch-side adapter.
- Remote deployment shape (headless HTTP/SSE host) modeled on Flue, as a later mode beyond TUI/web/RPC/print.
- MCP adapter style and per-run event-stream style — Flue's patterns observed and selectively adopted post-POC.

### Vocabulary evolution

- Whether public graph commands eventually split from one `graph.*` umbrella into `intent.*` / `oracle.*` / `design.*` / `plan.*` namespaces is deferred; current posture is unified `graph.*` for the POC.
- Whether `framing_as` values graduate to first-class node kinds (seam-extensions Open Question #8) is deferred until fixture pressure shows the need.

### Chat UI primitive choice

- Whether the chat UI leans more heavily on Vercel AI SDK, TanStack AI primitives, or a thin Brunch-owned spanning abstraction is a post-M3 decision.

## Lexicon

| Term | Definition |
| --- | --- |
| **Brunch host** | The local process-level authority. Owns `.brunch/` resolution, agent session lifecycle, mode dispatch, and event fanout. |
| **Mode** | One of TUI, web, RPC, print. All four drive the same host; they are presentation surfaces, not separate products. |
| **Spec** | A specification workspace, identified by its intent-graph root. Lives under `.brunch/`. Multiple specs may coexist per project. |
| **Session** | A chat belonging to one spec. Backed by a pi JSONL session under `.brunch/sessions/`. A spec may have many sessions over time. |
| **Workspace state hierarchy** | `cwd → spec → session`. Each level scopes the one below it; spec is selected before any agent loop runs and persists across `/new`. |
| **Intent graph** | The canonical specification-meaning plane. Authority over what the system is for. |
| **Oracle graph** | Verification-strategy plane accountable to intent. Houses Checks, Validation Methods, Evidence, Obligations. |
| **Design graph** | Modules, interfaces, seams, and adapters accountable to intent. Stubbed in POC. |
| **Plan graph** | Milestone/frontier/slice delivery claims accountable to intent, oracle, and design. Stubbed in POC. |
| **LSN** | Log Sequence Number. A single monotonic counter, one-LSN-per-commit, shared by the change log, graph-node versions, and reconciliation needs. |
| **Change log** | The audit trail of graph mutations. Authoritative for replay, `worldUpdate` synthesis, and reconciliation-need ordering. |
| **Reconciliation need** | First-class record of an open impasse, gap, contradiction, or process debt; carries `created_at_lsn`, optional `resolved_at_lsn`, `concerns` edges to graph nodes. |
| **Coherence verdict** | Per-spec product state (`coherent` / `incoherent`) emitted by validators and visible to both UI and agent. |
| **Command layer** | The single Brunch-owned mutation surface. Validates, gates concurrency, audits, emits events, triggers coherence. |
| **Offer envelope** | `brunch.offer` custom message: actions or questions with options, `multi`, `freeform`, `allowSkip`, `expiresOn`, optional `captureHint`. |
| **Capture hint** | Private observer-facing prior on an offer (expected kinds, candidate relations, target items, capture mode). Advisory, not commanding. |
| **Lens** | A switchable framing of the active agent (e.g. interview, clarify, oracle-active). Switches are durable transcript entries. |
| **Side task** | A scoped sub-agent invocation whose result returns through the shared command layer. |
| **World update** | `worldUpdate` custom message synthesised in `prepareNextTurn` summarising relevant graph changes since the session's `lastSeenLsn`. |
| **Mention ledger** | Per-session `(entity_id, snapshotted_lsn)` record driving discretionary staleness hints when an entity has changed since the agent last saw it. |
| **Authority** | Source of a node's claim: `stakeholder | technical | external | derived`. |
| **Epistemic status** | Confidence basis: `observed | asserted | assumed | inferred`. |
| **Framing-as** | Orthogonal modality classifying a node's product role (e.g. `problem`, `persona`, `non_goal`) within an allowed matrix. |
| **Kernel** | A behavioural elicitation pattern from `docs/design/BEHAVIORAL_KERNELS.md` (state/lifecycle, containment, concurrency, etc.). |
| **Brief** | A short curated product brief in `.brunch-fixtures/briefs/`, run by the agent-as-user driver to produce golden captures. |
| **Capture / Run / Fixture** | A captured agent-as-user run produces a `.jsonl` transcript, `.graph.json`, `.coherence.json`, and `.meta.json` bundle under `.brunch-fixtures/<brief-id>/<run-id>/`. |

## Verification Design

### Verification Commands

Infrastructure is not yet laid (Phase 3 of POC bootstrapping). Commands below follow `AGENTS.md` conventions and will be filled in by `pragma-skeleton` / M0:

| Step | Check | Command |
| --- | --- | --- |
| 1 | Lint-fix + format (inner loop) | `npm run fix` |
| 2 | Format check + lint (no writes) | `npm run check` |
| 3 | Unit tests | `npm run test` |
| 4 | Build | `npm run build` |
| all | Full gate | `npm run verify` (= check + test + build) |

### Verification Policy

- **Inner loop:** run `npm run fix` after every meaningful edit. Tooling: oxlint (lint + type-aware via tsgolint), oxfmt (format), vitest (test). See AGENTS.md.
- **Gate before commit:** `npm run verify`. All steps must pass; no override.
- **Failure protocol:** stop on first failure; the failure becomes the must-fix task; re-run the stack from step 1; only proceed when all checks pass.
- **Frontier-item completion** additionally requires that fixture-property assertions for the frontier's milestone pass (see [fixture-strategy.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md)).
- **Middle/outer loop verification design** (oracle strategy, diagnostic assessment, blind spots) is owned by `ln-oracles`. The fixture-strategy doc is the de-facto outer-loop oracle for the POC until `ln-oracles` runs a dedicated pass.

### Acceptance Criteria

1. The POC milestone ladder M0–M9 can be sequenced as PLAN.md frontier items with each milestone establishing one durable architectural claim.
2. Cross-session graph changes are surfaced to the agent coherently at turn boundaries through `worldUpdate`.
3. Coherence is explicit product state, queryable through `graph.*` reads and visible in the TUI chrome.
4. The browser does not require a second primary data plane.
5. The transcript strategy is validated: pi JSONL sessions either suffice for the POC, or their insufficiency is sharply bounded with a justified fallback.
6. A fixture library of at least the seven starter briefs is captured and replayable; property invariants from the fixture-strategy doc pass against captured runs.
7. Brunch can be built as a local product over pi without forking pi.
