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

The POC's purpose is to prove three things: (a) that pi's coding-agent harness can be the substrate without forking it; (b) that a graph-native spec workspace plus a JSONL-first transcript can coexist coherently under one mutation authority; (c) that elicitation-first sessions can project inspectable prompt/response exchanges for observer extraction, replay, and fixture pressure without reintroducing a parallel chat/turn store.

### Constraints & Non-goals

- Do not expose pi's extension, skill, prompt-template, or theme APIs to Brunch users in the POC.
- Do not make REST the primary product API. JSON-RPC is the primary protocol; HTTP is a thin transport shim only.
- Do not target cloud-hosted, multi-machine, or organization-wide deployment in the POC.
- Do not solve mid-turn distributed consistency; the contract is turn-boundary clean only.
- Do not reuse `pi-web-ui` for the browser surface; the web client is a native Brunch React app.
- Do not expose a generic `records.*` data model. The vocabulary is graph-native (`graph.*`, `intent.*`, `oracle.*`, `design.*`, `plan.*`) or session-native (`session.*`).
- Do not support Pi's in-place session branching (`/tree`) or branch-derived replacement flows (`/fork`, `/clone`) as Brunch product behavior in the POC. Branch-aware continuity, staleness, and coherence are deferred; Brunch-controlled flows should block branch creation/navigation, and Brunch transcript readers should reject branched JSONL rather than flattening or adapting it.
- Do not build a generic read-model platform, REST read API, DB-backed chat/turn projection, or canonical cross-store event spine just to keep clients synchronized. Prefer thin named RPC method families and projection handlers over canonical stores.
- Do not require TUI or agent internals to serialize through JSON-RPC when they can call the same handlers in-process; sameness of handlers matters more than sameness of transport.
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
8. Brunch must prove that transcript persistence is rich enough for raw assistant and user payloads, session binding, structured elicitation entries, and continuity metadata — using pi JSONL sessions if sufficient, or a justified fallback otherwise. For the POC, Brunch-supported Pi JSONL sessions are linear and coordinator-bound; branch-aware transcript semantics are unsupported until explicitly designed.
9. Brunch must treat the intent graph as canonical specification meaning, with oracle, design, and plan graphs as accountable downstream planes.

#### Mutation, transport & subscriptions

10. Brunch must route all graph mutations through one Brunch-owned command layer whose public mutation entry point returns structured command results.
11. Brunch must use JSON-RPC as the primary browser and RPC transport through named method families, not a generic data API.
12. Brunch must support subscriptions as a first-class transport primitive for both session and graph state; live views should subscribe to projection handlers over canonical stores rather than read from a parallel view store.

#### Continuity & coherence

13. Brunch must detect relevant cross-session graph changes between turns and surface them via a `worldUpdate` custom-message role.
14. Brunch must surface coherence as shared product state to both user and agent.
15. Brunch must preserve graph and coherence anchors across compaction.

#### Elicitation product shape

16. Brunch must keep sessions elicitation-first: at idle, the user is responding to a system/assistant-originated elicitation prompt rather than initiating ambient free chat.
17. Brunch must support action, radio (single-select), checkbox (multi-select), and freeform-plus-choice response surfaces as optional typed transcript entries, and must be able to project elicitation exchanges from Pi JSONL for observer extraction.
18. Brunch must support `#`-mentions of graph entities anchored to stable IDs, with session-scoped staleness tracking that produces discretionary re-read hints during `prepareNextTurn`.
19. Brunch must enforce a workspace state hierarchy `cwd → spec → session`, where the active spec is selected before any agent loop runs, persists across `/new`, and binds each session to exactly one spec.
20. Brunch must support multiple elicitation lenses within the `elicitor` agent-mode, with the agent owning lens selection and offer through transcript-native establishment offers; lens metadata is carried on elicitor-emitted custom entries for downstream routing.
21. Brunch must distinguish *extractive* lenses (single-exchange, observer-extracted) from *generative* lenses (batch-proposal, captured at proposal time as structured entity-draft payloads, reviewer-analyzed post-acceptance).
22. Brunch must establish a minimum grounding bundle (domain, protagonist, pain/pull, and constraint anchors) before generative lenses produce non-speculative output; lenses remain always-available with epistemic-status signaling honestly reflecting grounding density.
23. Brunch must support a review-cycle acceptance pattern for generative-lens proposals — approve / request changes (triggering regeneration) / reject — with batch acceptance committed atomically as one CommandExecutor call; partial acceptance is not representable.

#### Verification & fixtures

24. Brunch must ship a brief library and an agent-as-user driver over the JSON-RPC stdio surface to capture replayable golden runs and property-checkable fixtures.

## Live Architecture Register

### Open Assumptions

<!-- Retired during sync: A2-L and A12-L were validated by M2 and promoted into R8, D6-L, D13-L, D24-L, I3-L, I10-L, and I19-L. -->

| # | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | --- | --- | --- | --- | --- |
| A1-L | `pi-coding-agent` exposes enough seams (services, custom message roles, `prepareNextTurn`, `transformContext`, RPC mode, JSONL sessions, extension UI surface) to host all M0–M9 capabilities without forking pi. | high | open | D1-L | M0–M2: walking skeleton + mode shell + JSONL viability prove the substrate. |
| A3-L | A single Brunch-owned command layer (with optimistic concurrency, validation, audit, and coherence triggers) is sufficient for both agent and human writers across all four modes for the POC's graph scale. | medium | open | D4-L | M4 + M5 + M6: graph plane, agent-↔-graph wiring, and authority tiers all routed through the same surface. |
| A4-L | A monotonic global LSN per commit (one-LSN-per-transaction) is adequate for change-log replay, reconciliation-need ordering, and mention staleness without per-row vector clocks. | high | open | I1-L, I4-L | M4 + M7: replay fidelity and `worldUpdate` ordering tests. |
| A5-L | An agent-as-user driver running over JSON-RPC stdio can produce regression-quality fixtures across a curated brief library. | medium | open | D5-L | M1 — first replay-regression fixtures land. |
| A6-L | The graph-native vocabulary can be deferred from explicit per-plane namespacing (`intent.*`, `oracle.*`, etc.) and start unified under `graph.*` without painful rework later. | medium | open | D3-L | M4–M5: if intent-plane plus oracle-plane stubs both fit under one namespace cleanly, the assumption holds. |
| A7-L | `framing_as` as an orthogonal modality on existing node kinds is sufficient for product-intent ontology (problem, persona, JTBD, etc.) and does not need to become first-class node kinds in the POC. | medium | open | D7-L | Fixture runs across briefs #1–#7: if a framing repeatedly demands unique relation policy, promote per the seam-extensions Open Question #8. |
| A8-L | One reconciliation-need substrate, sharing the same global LSN as the change log, can absorb impasses, conflicts, gaps, and process debt without needing finer kind subtypes in the POC. | medium | open | D8-L | M8 + adversarial fixtures ("contradictory requirements") exercise the substrate; subtype split deferred per Open Question #10. |
| A9-L | A session-scoped mention ledger of (`entity_id`, `snapshotted_lsn`) is the right granularity for staleness hints; transcript-scoped or graph-scoped ledgers are not needed for the POC. | low | open | I7-L | M7 — turn-boundary reconciliation slice; observed via fixture runs that stress re-read decisions. |
| A10-L | A persistent TUI chrome region showing cwd / spec / phase / chat-mode can be added on top of `pi-tui`'s root layout without modifying pi. | medium | open | D2-L | M0 — walking skeleton attempts to mount the chrome; escalates to a pi upstream issue only if blocked. |
| A11-L | Pi's `prepareNextTurn` plus custom-message delivery are sufficient to express side-task result delivery without inventing a second event plane or forking pi. | medium | open | D15-L | M5 + M7: side-task registry wiring and next-turn delivery proof. |
| A13-L | A durable observer-job queue keyed by session id and elicitation-exchange entry range can recover async extraction after process interruption without reintroducing canonical chat/turn tables; whether this shares storage with a generalized work-item/reconciliation table can be deferred. | medium | open | D18-L, I14-L | M5: observer extraction tests exercise restart/idempotence once graph writes exist. |
| A14-L | LLM elicitor agents can reliably produce graph-structurally-legal intent-graph proposals (well-formed entity drafts and semantic edges that pass `CommandExecutor` structural validation) for generative lenses. | medium | open | D27-L | Fixture replay across briefs that exercise `propose-scenarios-with-tradeoffs`-shaped lenses; dry-run `CommandExecutor` validation at proposal time before user review. Fallback (constrained generation, retry-with-feedback, or NL-parse-at-accept) preserves the user-facing review-cycle if reliability is insufficient. |
| A15-L | Establishment hints as transcript-native custom entries (`brunch.establishment_offer`) provide sufficient inspectability, fixture-ability, and ambient-affordance source without a separate establishment-needs graph substrate; whether such a substrate ever shares storage with reconciliation needs can be deferred. | medium | open | D25-L, D30-L | M5+: fixture inspection confirms lens offers are reconstructable from transcript; chrome region renders ambient affordances from the latest such entry. |
| A16-L | Reviewer triggering policy (always-on vs lens-keyed) and reviewer scope (batch + how-far-neighborhood) can be deferred to per-lens decisions without architectural commitment now. | low | open | D29-L | M5+: empirical — observer/reviewer integration reveals which policy avoids unacceptable next-turn latency without losing relevant findings. |
| A17-L | A user-level temperamental preference for extractive vs generative lenses meaningfully affects adoption and eventually warrants expression as a user-level setting. | low | open | D25-L, D26-L | Deferred; surfaces from outer-loop walkthroughs and adversarial fixtures once both lens families exist in product. |

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
- **D20-L — Command execution owns the pre-M6 authority seam.** Callers submit product commands to a Brunch `CommandExecutor` and receive a structured result; they do not call a standalone authority service or graph persistence directly. The executor is the public mutation boundary that hides attribution, optimistic concurrency, structural validation, the minimal pre-M6 policy classifier, transaction execution, LSN allocation, change-log append, and coherence-trigger hooks. Before M6, the policy logic may be deliberately small, but the result shape must already include `needs_human`, `policy_blocked`, `version_conflict`, and `structural_illegal` so early RPC, print, agent-tool, observer-job, and side-task code cannot bake in permissive mode-specific shortcuts. Depends on: D4-L, D16-L. Supersedes: the separate optional `AuthorityGate` / generic policy-service mental model.
- **D27-L — Generative-lens proposals are structured entity-draft payloads; batch acceptance is one atomic `CommandExecutor` call.** The elicitor's proposal custom entry (`brunch.review_set_proposal`) contains the graph entities and edges that *would* be created on acceptance, in a form `CommandExecutor` can dry-run-validate at proposal time so `structural_illegal` / `policy_blocked` discriminants surface before the user reviews. Only proposals that pass this dry-run validation are surfaced as user-reviewable review sets; invalid generations stay internal to retry/regeneration paths rather than becoming review UI state. Acceptance is one `acceptReviewSet` command that consumes one LSN, writes the entire batch in one transaction, appends one change-log entry attributed to the user, triggers coherence updates, and enqueues the reviewer job. "Accept with edits" does not exist as a primitive: the cycle is approve / request changes (triggers regeneration of a successor proposal) / reject. Depends on: A14-L, D4-L, D20-L, D26-L. Supersedes: any caller-side multi-step "patch then commit" mental model.

#### Transport & client

- **D5-L — JSON-RPC is the primary product protocol.** Same command surface over stdio (RPC mode), WebSocket (browser), and in-process handler calls (TUI/agent tools). HTTP exists only as a transport shim (static bundle, health, uploads, webhooks). The RPC stdio surface is also the agent-as-user fixture-capture interface. Depends on: A5-L. Supersedes: —.
- **D10-L — Web client is a native Brunch React app over one WebSocket RPC client.** TanStack Router + TanStack Query + Brunch-owned elicitation/transcript primitives (Vercel AI SDK UI or TanStack AI style). `pi-web-ui` is not reused. The browser is a thin remote head over Brunch RPC method families, not a second product runtime or REST-backed data client. Depends on: D5-L. Supersedes: —.
- **D17-L — Brunch semantics ride one event substrate, not parallel channels.** Custom-message transcript entries plus `deliverAs: "nextTurn" | "followUp"` and `prepareNextTurn` are the load-bearing mechanism for structured elicitation prompts/responses, `worldUpdate`, mention-staleness hints, and side-task-result delivery. New product semantics should compose onto this substrate before inventing a second event plane. Depends on: D5-L, D6-L, D12-L, D15-L. Supersedes: —.
- **D19-L — Keep transport/read architecture thin: named RPC method families over projection handlers.** Brunch exposes named method families such as `session.*`, `workspace.*`, `graph.*`, and `coherence.*`; each handler projects from the canonical store that owns the fact (Pi JSONL, `.brunch/state.json`, or SQLite graph/change log). Subscriptions are first-class and may provide initial state plus updates, but Brunch must not create a generic read-gateway platform, REST read model, DB-backed chat/turn projection, or canonical cross-store event spine merely to keep clients in sync. Depends on: D5-L, D6-L, D10-L, D16-L. Supersedes: the heavier “unified read gateway” mental model.
- **D23-L — Transport modes are distinct from agent modes and lenses.** TUI, RPC, print, and web are transport modes: ways of driving or observing the same Brunch host through Pi/Brunch harness seams. Agent modes are coarse operational strategies such as `elicitor`, `observer`, `reviewer`, `reconciler`, or future `generalist`; lenses are narrower perspectives such as technical-design, verification-design, or disambiguation that may later be skill-driven. M1 print mode is therefore only a transport proof-of-life: it boots through the same host/coordinator, renders a snapshot of product-shaped state, and exits without running an agent turn. A future single-turn headless print run is deferred until agent-mode selection/defaults are explicit. Depends on: D1-L, D5-L, D19-L, D21-L. Supersedes: overloading “mode” to mean both transport and agent strategy.

#### Persistence

- **D6-L — JSONL-first transcript persistence in `.brunch/sessions/`; SQLite-backed graph persistence in `.brunch/`.** Two durability surfaces with distinct responsibilities. Transcript starts on pi `SessionManager` redirected to the project-local directory; graph plane is SQLite from M4. Brunch does not recreate canonical `chat` or `turn` tables while Pi JSONL remains viable for Brunch-supported linear sessions. Validated by M2. Supersedes: —.
- **D15-L — Side tasks are a first-class Brunch subsystem delivered through the same transcript/event substrate.** Background sub-agents are tracked by a Brunch-owned `SideTaskRegistry`; results are never injected mid-turn and instead arrive at the next-turn boundary through the existing custom-message plus `prepareNextTurn` path. Side-task writes remain subject to the same command-layer authority as primary-agent writes. Depends on: A11-L, D4-L. Supersedes: —.
- **D16-L — Graph persistence uses Drizzle over `better-sqlite3`, with one-LSN-per-commit and no bypass paths.** The command layer owns precondition checks, structural validation, entity writes, LSN allocation, change-log append, and any coherence updates inside one transaction. This rule applies equally to migrations and maintenance code; there is no privileged write path outside the command-executor protocol. Depends on: A3-L, A4-L. Supersedes: —.
- **D18-L — Observer extraction is exchange-keyed durable work, not a chat/turn store.** After a user response closes an elicitation exchange, Brunch may enqueue an observer job keyed by session id plus exchange entry ids; jobs survive process restart and graph writes still route through the command layer. Routine observer jobs are operational queue state, not reconciliation needs by default; low-confidence or conflicting findings may create reconciliation needs. Depends on: A13-L, D4-L, D13-L, D16-L. Supersedes: the old DB-backed `chat` / `turn` mental model.
- **D28-L — Regenerated review-set proposals are appended as successor entries in the linear Pi JSONL session; projection helpers filter to the accepted set for context economy.** When the user requests changes, the agent appends a successor proposal entry that references its predecessor via `supersedes`; prior proposals are *not* deleted from JSONL but remain visible as raw transcript history. This stays within Brunch's linear transcript policy — no Pi branching is created. Pi JSONL is treated as a "capture everything" store for replay and audit. Projection helpers used to drive the agent (context injection, summarization) walk the `supersedes` chain and surface only the latest (or ultimately accepted) proposal — the agent does not re-process every superseded proposal as live context. The reviewer likewise sees only the accepted set, not the regeneration history. Depends on: D6-L, D12-L, D17-L, D24-L, D27-L. Supersedes: any "in-place edit" or "fork-on-regenerate" mental model.
- **D29-L — Reviewer is an `observer`-shaped agent-mode with narrow write authority.** After a batch acceptance closes, Brunch may enqueue a reviewer job keyed by session id plus the batch-acceptance entry id; the job survives process restart and analyzes the accepted batch plus its graph neighborhood for coherence, completeness, and gaps. **Reviewer writes only `reconciliation_need` records via the `CommandExecutor`**; it never writes graph entities, edges, change-log entries directly, or any other record class. Findings reach the user through next-turn delivery as advisory items on the reconciliation-need surface — the batch acceptance remains the user's atomic commitment and the reviewer cannot amend it. (Suggestion-shaped findings may later route to candidate-artefacts when that substrate exists; the POC routes everything to reconciliation needs.) Depends on: A16-L, D4-L, D8-L, D15-L, D17-L, D18-L, D20-L, D27-L. Supersedes: any "reviewer may quietly amend the graph" mental model.
- **D24-L — Brunch POC enforces a linear transcript policy over Pi JSONL.** Pi's session tree is a substrate capability, not a Brunch product surface. Until branch-aware continuity/coherence is explicitly designed, Brunch-controlled interactive/runtime flows block `/tree`, `/fork`, and `/clone` through the thinnest available Pi hooks; transcript readers reject non-linear session files instead of flattening, adapting, migrating, or selecting a branch. This is intentional fail-fast pre-release posture: avoid compatibility debt with Pi internals or earlier Brunch revisions, and keep wrapper/adapter layers minimal. Depends on: D6-L, D11-L, D13-L. Supersedes: treating active-branch projection as Brunch product semantics.

#### Interaction & UI shape

- **D11-L — Workspace state hierarchy `cwd → spec → session`, with spec selection gated before any agent loop.** Spec selection is durable across `/new` and persisted in `.brunch/state.json`. Each Pi session is bound to exactly one spec by a `brunch.session_binding` custom entry at session start; switching specs selects or creates another session rather than mutating the spec of the current session. Depends on: A10-L. Supersedes: —.
- **D21-L — Workspace session coordination is the spec/session boot seam.** Brunch owns a narrow `WorkspaceSessionCoordinator` for boot, spec selection, selected-session reopening, and `/new` session creation. It is the only product module allowed to create or open Pi sessions for Brunch user flows and the only module allowed to write `brunch.session_binding`; callers receive `ready | select_spec | needs_human` workspace-session state and never mutate a session's bound spec. The coordinator hides `SessionManager.create/open/continueRecent(cwd, ".brunch/sessions/")`, internal session-start binding for pi-created replacement sessions, `.brunch/state.json` current-spec and current-session-file acceleration, binding validation, and chrome-state derivation. Because pi defers appending session JSONL until an assistant message exists, the coordinator flushes Brunch's binding when it is created, refreshes it at `before_agent_start`, and performs the final pre-assistant flush from Brunch's internal assistant `message_start` hook after pi has persisted the user message but before assistant persistence; each flush reloads the session file so pi's next assistant append does not duplicate the already-written prefix. Depends on: D6-L, D11-L. Supersedes: the loose `SpecRegistry` + caller-orchestrated session-binding mental model.
- **D22-L — M0 TUI chrome rides pi's extension UI widget seam.** Brunch's initial persistent chrome is mounted by an internal Brunch extension using pi's public `ExtensionUIContext.setWidget(..., { placement: "aboveEditor" })`, while spec selection remains a Brunch-owned boot gate before `InteractiveMode.run()`. Brunch does not fork pi, monkeypatch `InteractiveMode`, or expose generic pi extension configuration to users for M0 chrome. Depends on: A10-L, D2-L, D21-L. Supersedes: private-header/monkeypatch approaches for M0 chrome.
- **D12-L — Elicitation-first interaction, transcript-native structured prompts.** Brunch treats system/assistant prompts and user responses as Pi transcript truth. Structured action/choice/freeform surfaces may be represented by Brunch custom entries when needed, but there is no DB-owned prompt/response entity; at idle, the session waits on a system/assistant-originated elicitation prompt. Depends on: D6-L, D11-L. Supersedes: —.
- **D13-L — Capture-aware elicitation exchange projection.** Observer extraction consumes derived elicitation exchanges: a prompt-side span (all system/assistant/tool-side entries since the previous user response, including any structured/internal prompt content) plus a response-side span (user text and/or structured action entries). Role/span alternation is the default projection in Brunch-supported linear sessions; typed markers are added only where structure/actions need deterministic replay. Depends on: D12-L, D24-L. Supersedes: —.
- **D14-L — `#`-mentions are ID-anchored, with a session-scoped mention ledger.** Autocomplete may resolve by title but insertion always rewrites to ID-anchored. Per-session `(entity_id, snapshotted_lsn)` ledger drives discretionary `brunch.mention_staleness_hint` entries in `prepareNextTurn`. Depends on: A9-L, I4-L. Supersedes: —.
- **D25-L — Elicitation strategies are *lenses* within the `elicitor` agent-mode, not separate agent-modes.** Lens is metadata on elicitor-emitted custom transcript entries (`brunch.elicitor_intent_hint`, `brunch.establishment_offer`, `brunch.review_set_proposal`, etc.); agent-modes (`elicitor`, `observer`, `reviewer`, `reconciler`) remain orthogonal. The known starter lens set is `step-by-step`, `disambiguate-via-examples`, `propose-scenarios-with-tradeoffs`, `propose-design-shapes`, `propose-oracle-ensembles`, and `project-requirements-from-upstream`; the catalogue is expected to grow. Observer-job and reviewer-job routing filters on lens. Depends on: D12-L, D17-L, D23-L. Supersedes: collapsing strategy and agent-mode into one vocabulary axis.
- **D26-L — Lenses split into *extractive* and *generative* families by capture mechanism.** Extractive lenses produce single-exchange interactions whose implicit content is captured by the `observer` agent-mode post-exchange (e.g. `step-by-step`, `disambiguate-via-examples`). Generative lenses produce batch proposals whose entity-draft payloads are captured by the elicitor *at proposal time*, with the `reviewer` agent-mode running advisory analysis post-acceptance (e.g. `propose-scenarios-with-tradeoffs`, `propose-design-shapes`, `propose-oracle-ensembles`, `project-requirements-from-upstream`). The family distinction is durable; the specific lens list is expected to evolve. Depends on: D18-L, D25-L. Supersedes: a single uniform "agent asks questions" mental model.
- **D30-L — Grounding is a precondition gate for generative-lens output, with epistemic-status signaling honestly tracking grounding density; lenses themselves are always available.** A minimum grounding bundle — *domain anchor*, *protagonist anchor*, *pain/pull anchor*, *constraint anchor* — must be established before generative lenses produce non-speculative output. Generative-lens proposals declare `epistemic_status` (`inferred | assumed | asserted | observed`) consistent with grounding density at proposal time, and proposal/offer payloads carry explicit grounding-bundle coverage for those four anchors so UI copy, fixture assertions, and reviewer/debug tooling can justify that status rather than infer it from free text. UI renderings reflect this status so low-status proposals *feel* speculative (visible hedging, lower visual weight, explicit "speculative — based on N anchors so far" footers). The lens is never refused: the agent always produces *some form* of what was asked for, but its output resolution and epistemic load honestly reflect what grounding supports. Rendering mode scales with density: empty/thin → framing proposals (Shape Up pitches); moderate → scenario sketches; rich → completion proposals; mature → refactor proposals. Depends on: D26-L. Supersedes: gating-by-refusal as a UX move.
- **D32-L — Establishment offers are orientation artifacts, not a default next-action menu.** `brunch.establishment_offer` records the agent's current offer tree and recommended next move as durable transcript state. Ambient chrome or web affordances may render the latest offer, and Brunch may expose a user-invoked orientation view summarizing what is established vs open, but Brunch does not surface an exhaustive lens/offer chooser by default; the agent still owns next-move selection unless the user explicitly asks to inspect alternatives. Depends on: D25-L, D30-L, A15-L. Supersedes: UI interpretations that turn establishment offers into a persistent strategy menu.
- **D31-L — A four-axis meta-rubric is a soft heuristic for fan-out comparison rubrics across all three flows; not architecturally enforced.** When generating comparison rubrics for fan-out alternatives across candidate-spec, technical-design, and verification-design flows, the elicitor attempts to express each axis in terms of (*legibility / cost-of-knowing*, *failure modes*, *coverage / range*, *commitment*). Project-specific axes are allowed alongside; the meta-frame is dropped when it doesn't fit. The hypothesis (uniform comparison UI across all three flows) is testable via fixture comparison; promote to schema/UI only if it holds up. Depends on: D25-L, D26-L. Supersedes: a hardcoded per-flow rubric.

### Critical Invariants

| # | Invariant | Protected by | Proves |
| --- | --- | --- | --- |
| I1-L | One global LSN per commit; every change-log entry, graph-node version, and reconciliation-need carries an LSN strictly monotonic with the global clock. | planned (M4 invariant tests) | D4-L, D6-L, D8-L |
| I2-L | All durable graph mutations originate from the Brunch command layer; no caller bypasses validation, audit, or coherence triggering. | planned (M5 architectural test + lint rule) | D4-L |
| I3-L | Transcript reload reproduces raw assistant/user payloads plus Brunch session binding, structured elicitation entries, and other custom transcript entries byte-equivalently (modulo timestamps). | covered (M2 JSONL viability round-trip tests) | D6-L |
| I4-L | For every `worldUpdate` entry, all named graph items have LSNs strictly greater than the session's pre-update `lastSeenLsn`. | planned (M7 property test) | D6-L, I1-L |
| I5-L | For every `brunch.lens_switch` entry and every session/spec binding transition, the session interest set is recomputed before the next agent turn. | planned (M7 property test) | D11-L |
| I6-L | Every reconciliation need has `created_at_lsn ≤` current global LSN; `kind='impasse'` needs reference at least two graph nodes; resolved needs carry a strictly later `resolved_at_lsn`. | planned (M8 property test) | D8-L, I1-L |
| I7-L | Every `framing_as` value belongs to the allowed matrix for that node's base kind. | planned (fixture property check) | D7-L |
| I8-L | Spec selection persists across pi `switchSession` (i.e. `/new`); the selected session file is reopened consistently by headless projection/capture paths; each session has exactly one `brunch.session_binding`, and a session's bound spec never changes. | partially covered (M0 coordinator/TUI boot integration tests + store-only runbook checker; M1 no-injected-coordinator capture regression; M2 coordinator-created JSONL reload tests; manual TUI smoke still planned) | D11-L, D21-L |
| I9-L | Every `brunch.mention` payload is anchored to a stable `id`; the ledger never stores title-anchored references. | planned (M7 invariant) | D14-L |
| I10-L | Structured elicitation prompts/responses live in the Pi transcript when structure is needed; Brunch-supported elicitation exchanges are projected only from linear coordinator-bound sessions, and no parallel canonical chat/turn table carries elicitation state. | covered for projection shape (M1 exchange projection tests + M2 JSONL/RPC projection tests); linearity enforcement planned with D24-L hardening | D12-L, D13-L, D18-L, D24-L |
| I11-L | No durable graph mutation path — including migrations, maintenance scripts, observer-job writes, or side-task-attributed writes — may bypass the `CommandExecutor` path that performs authority/result classification, version checks, structural validation, transaction execution, LSN allocation, and change-log append. | planned (M4 architectural + migration invariants; M5 caller-boundary tests) | D4-L, D15-L, D16-L, D20-L |
| I12-L | Side-task results are delivered only at turn boundaries; no side-task result may steer or mutate the active turn outside the next-turn delivery path. | planned (M7 side-task delivery invariant) | D15-L |
| I13-L | At any idle linear session leaf, the latest unresolved interaction state is system/assistant-originated: user input is a response to an elicitation prompt, not ambient chat. | planned (M1 fixture + transcript projection tests) | D12-L, D24-L |
| I14-L | Observer jobs are keyed by session id plus elicitation-exchange entry-range ids and have durable status; replay/restart cannot enqueue duplicate observer jobs for the same exchange. | planned (M5 observer queue tests) | D18-L, D4-L |
| I15-L | Every review-set acceptance routes through `CommandExecutor` as one atomic `acceptReviewSet` command producing one LSN, one change-log entry, and one transaction over the entire batch. Partial acceptance is not representable through any product API. | planned (M5+ batch-acceptance command tests; review-set fixture parity) | D20-L, D27-L; I1-L, I11-L |
| I16-L | Reviewer-attributed writes target only the `reconciliation_need` substrate; no reviewer-attributed `CommandExecutor` call writes graph entities, edges, change-log entries directly, or any other record class. | planned (M5+ architectural test on reviewer command writers; reviewer-attributed command-result audit) | D29-L; I2-L, I11-L |
| I17-L | Every generative-lens proposal entry (`brunch.review_set_proposal`) declares an `epistemic_status` (`inferred | assumed | asserted | observed`) and explicit grounding-bundle coverage for the four grounding anchors, with the status consistent with that coverage at proposal time; UI renderings honor this status as a presentation contract. | planned (M5+ proposal-entry schema test; fixture asserts status under thin and rich grounding) | D30-L; A14-L |
| I18-L | Every elicitor-emitted prompt or proposal custom entry (`brunch.elicitor_intent_hint`, `brunch.establishment_offer`, `brunch.review_set_proposal`) carries a `lens` field; observer-job and reviewer-job routing filters on this field. | planned (M5+ observer/reviewer routing tests; transcript-shape contract test) | D25-L, D26-L, D29-L |
| I19-L | Brunch-controlled flows do not create or navigate Pi session branches, and Brunch transcript readers fail fast on non-linear JSONL rather than flattening, migrating, or branch-selecting. | planned (linear transcript policy guard tests before/within M3 web-shell) | D24-L, D6-L, D11-L, D13-L |
| I20-L | Every user-reviewable generative-lens proposal has already passed proposal-time dry-run structural/policy validation against `CommandExecutor`; proposals that fail dry-run validation do not surface as reviewable review sets. | planned (M5+ proposal-validation contract + differential tests) | D27-L; A14-L |

## Future Direction Register

### Framework alignment & deferred subsystems

- **Geolog (TA1.2 data store).** Datalog-shaped logical store eventually backing intent/oracle queries. Domain modelling itself is non-trivial and parallel to Brunch. See pi-seam-extensions §Framework alignment.
- **Plan execution & Petri-net compatibility.** Plan-graph compiled alongside an execution petri-net carrying colored tokens that refer back to plan nodes by ID. Currently exploratory; not part of POC scope.
- **Context subsystem.** Acknowledged as large-scope; deferred. Brunch may stub minimal structure (e.g. an explicit per-turn `Context` namespace under `prepareNextTurn`) without implementing the full subsystem.
- **Capability tiers** (distinct from authority tiers). A future second axis classifying what an agent *can* do versus what it *may* do. Stub deferred.
- **Candidate artefacts.** Pre-graph, agent-proposed or observer-proposed nodes/edges awaiting user adjudication. Low-confidence observer findings may flow here or into reconciliation needs; routine observer jobs themselves remain operational queue state unless future pressure justifies a more generic work-item substrate.

### Adoption patterns from Flue

- Sandbox abstraction modeled on Flue's `SessionEnv` / `SandboxApi` interface, retrofitted onto pi via a Brunch-side adapter.
- Remote deployment shape (headless HTTP/SSE host) modeled on Flue, as a later mode beyond TUI/web/RPC/print.
- MCP adapter style and per-run event-stream style — Flue's patterns observed and selectively adopted post-POC.

### Vocabulary evolution

- Whether public graph commands eventually split from one `graph.*` umbrella into `intent.*` / `oracle.*` / `design.*` / `plan.*` namespaces is deferred; current posture is unified `graph.*` for the POC.
- Whether `framing_as` values graduate to first-class node kinds (seam-extensions Open Question #8) is deferred until fixture pressure shows the need.

### Thin transport/read posture

- Browser, RPC driver, TUI, and agent tools should share named Brunch handlers. Transports adapt those handlers; they do not define product semantics.
- Live client views should use subscriptions over the same RPC method families rather than pair REST GETs with a separate event channel.
- Query/subscription helpers may exist as implementation conveniences, but they must remain subordinate to concrete product methods (`session.*`, `workspace.*`, `graph.*`, `coherence.*`) and must not become a generic platform Brunch now owns.
- Initial POC read methods should stay close to current needs: linear transcript validation, elicitation-exchange projection, chrome/workspace state, and later graph/coherence projections.

### Elicitation UI primitive choice

- Whether the elicitation/transcript UI leans more heavily on Vercel AI SDK, TanStack AI primitives, or a thin Brunch-owned spanning abstraction is a post-M3 decision.

### Durable state framing

- Brunch's durable state is intentionally split across four semantic substrates: graph truth (nodes/edges), `change_log` audit/history, `coherence_state` verdict, and `reconciliation_need` actionable semantic queue. Routine async work such as observer jobs may use a separate operational queue; if later generalized, table naming may become `work_item` with subtypes, but the POC should not make every observer job a reconciliation need.

## Lexicon

| Term | Definition |
| --- | --- |
| **Brunch host** | The local process-level authority. Owns `.brunch/` resolution, agent session lifecycle, mode dispatch, and event fanout. |
| **Transport mode** | One of TUI, web, RPC, print. All four drive the same host; they are presentation/protocol surfaces, not separate products or agent strategies. |
| **Agent mode** | A coarse operational strategy/persona for an agent run, such as `elicitor`, `observer`, `reviewer`, `reconciler`, or a future `generalist`. Agent modes are selected independently from transport modes. |
| **Lens** | A narrower interpretive or task perspective applied within or alongside an agent mode, such as technical-design, verification-design, or disambiguation. Lenses may eventually be driven by skills, but are not part of M1 transport-mode proof. |
| **Print snapshot** | The M1 meaning of the print transport mode: boot the Brunch host, resolve workspace/spec/session state through the coordinator, render product-shaped state, and exit without running an agent turn. |
| **Spec** | A specification workspace, identified by its intent-graph root. Lives under `.brunch/`. Multiple specs may coexist per project. |
| **Session** | An elicitation transcript belonging to one spec. Backed by a linear pi JSONL session under `.brunch/sessions/`. A spec may have many sessions over time; a session never changes specs. Pi branch/tree mechanics are unsupported Brunch product behavior in the POC. |
| **Session binding** | The first Brunch custom entry in a session that binds the Pi session id to exactly one spec id and schema version. Makes JSONL self-describing; registry/index state is an acceleration, not the canonical binding. |
| **Workspace session coordinator** | The Brunch boot seam that returns `ready | select_spec | needs_human` workspace-session state for a cwd/mode, owns spec selection, selected-session reopening, and `/new`, creates/opens Pi sessions through `SessionManager`, writes `brunch.session_binding`, persists current spec/session acceleration in `.brunch/state.json`, and derives chrome state for callers. |
| **Workspace state hierarchy** | `cwd → spec → session`. Each level scopes the one below it; spec is selected before any agent loop runs and persists across `/new`. |
| **Intent graph** | The canonical specification-meaning plane. Authority over what the system is for. |
| **Oracle graph** | Verification-strategy plane accountable to intent. Houses Checks, Validation Methods, Evidence, Obligations. |
| **Design graph** | Modules, interfaces, seams, and adapters accountable to intent. Stubbed in POC. |
| **Plan graph** | Milestone/frontier/slice delivery claims accountable to intent, oracle, and design. Stubbed in POC. |
| **LSN** | Log Sequence Number. A single monotonic counter, one-LSN-per-commit, shared by the change log, graph-node versions, and reconciliation needs. |
| **Change log** | The audit trail of graph mutations. Authoritative for replay, `worldUpdate` synthesis, and reconciliation-need ordering. |
| **Reconciliation need** | First-class record of an open impasse, gap, contradiction, or process debt; carries `created_at_lsn`, optional `resolved_at_lsn`, `concerns` edges to graph nodes. Routine observer jobs are not reconciliation needs unless they surface semantic work to resolve. |
| **Coherence verdict** | Per-spec product state (`coherent` / `incoherent`) emitted by validators and visible to both UI and agent. |
| **Command layer** | The single Brunch-owned mutation surface. Validates, gates concurrency, audits, emits events, triggers coherence. Its public mutation entry point is the `CommandExecutor`, not direct ORM calls or caller-side authority gates. |
| **Command executor** | The deep module that accepts Brunch product commands plus execution context and returns structured command results (`ok`, `needs_human`, `policy_blocked`, `version_conflict`, `structural_illegal`). It hides attribution, minimal pre-M6 authority classification, validation, transaction, LSN, change-log, and coherence-trigger mechanics from callers. |
| **RPC method family** | A named group of JSON-RPC methods (`session.*`, `workspace.*`, `graph.*`, `coherence.*`) that exposes product behavior through stdio, WebSocket, or in-process handler calls without creating a second API surface. |
| **Projection handler** | A thin handler that reads or subscribes to a canonical store and returns product-shaped state for a mode/client. It is not a canonical store itself. |
| **Subscription** | A long-lived RPC operation that delivers live updates, often with an initial snapshot, for views that must stay current with session, workspace, graph, or coherence state. |
| **Transport adapter** | The stdio, WebSocket, HTTP-shim, or in-process wrapper around the same Brunch handlers. Transport adapters do not own product semantics. |
| **Canonical store** | The persistence surface that owns a fact: Pi JSONL for session transcript truth, `.brunch/state.json` for lightweight workspace binding state, SQLite graph/change log for graph truth and coherence substrates. |
| **Elicitation prompt** | System- or assistant-originated transcript span that prompts/directs the user's next response. At idle, a Brunch-supported linear session ends with an unresolved elicitation prompt. |
| **User response** | User-originated text and/or structured action selection responding to the current elicitation prompt. There is no ambient chat input in the POC model. |
| **Elicitation exchange** | A derived projection over Brunch-supported linear Pi JSONL: prompt-side span (system/assistant/tool-side entries since the prior user response) plus response-side span (the user's text and/or structured action entries). This is the observer's default extraction unit. |
| **Structured elicitation entry** | Optional Brunch custom transcript entry used when an elicitation prompt or response carries actions, choices, or other deterministic UI structure. Plain generative prompts can remain ordinary Pi messages. |
| **Observer job** | Durable async work item keyed by session id and elicitation-exchange entry-range ids. It analyzes an exchange for graph mutations or low-confidence suggestions, and survives process restart. |
| **Lens switch** | A durable `brunch.lens_switch` transcript entry recording that the active agent/session changed lenses. The switch event is distinct from the lens concept itself. |
| **Side task** | A scoped sub-agent invocation whose result returns through the shared command layer. |
| **World update** | `worldUpdate` custom message synthesised in `prepareNextTurn` summarising relevant graph changes since the session's `lastSeenLsn`. |
| **Mention ledger** | Per-session `(entity_id, snapshotted_lsn)` record driving discretionary staleness hints when an entity has changed since the agent last saw it. |
| **Authority** | Source of a node's claim: `stakeholder | technical | external | derived`. |
| **Epistemic status** | Confidence basis: `observed | asserted | assumed | inferred`. Like `authority`, this is a context-shaping label for attention, grouping, and compression rather than a complete theory of truth. |
| **Framing-as** | Orthogonal modality classifying a node's product role (e.g. `problem`, `persona`, `non_goal`) within an allowed matrix. |
| **Kernel** | A behavioural elicitation pattern from `docs/design/BEHAVIORAL_KERNELS.md` (state/lifecycle, containment, concurrency, etc.). |
| **Brief** | A short curated product brief in `.brunch-fixtures/briefs/`, run by the agent-as-user driver to produce golden captures. Dev-only fixture input; distinct from runtime user-facing **scenarios**. |
| **Capture / Run / Fixture** | A captured agent-as-user run produces a `.jsonl` transcript, `.graph.json`, `.coherence.json`, and `.meta.json` bundle under `.brunch-fixtures/<brief-id>/<run-id>/`. |
| **Elicitation lens** | A narrower interpretive strategy applied within the `elicitor` agent-mode — e.g. `step-by-step`, `disambiguate-via-examples`, `propose-scenarios-with-tradeoffs`, `propose-design-shapes`, `propose-oracle-ensembles`, `project-requirements-from-upstream`. Lens is metadata on elicitor-emitted custom transcript entries. Agent-modes (`elicitor` / `observer` / `reviewer` / `reconciler`) remain orthogonal. |
| **Extractive lens** | A lens producing single-question / single-answer exchanges; implicit content is captured post-exchange by the `observer` agent-mode. Low cognitive load per move; small graph mutations. |
| **Generative lens** | A lens producing batch proposals (structured entity-draft payloads in `brunch.review_set_proposal` entries); proposals are captured by the elicitor at proposal time, with the `reviewer` agent-mode running advisory analysis post-acceptance. Higher cognitive load per move; large graph mutations on acceptance. |
| **Grounding bundle** | The minimum set of session-level anchors required before generative lenses produce non-speculative output: a *domain anchor*, a *protagonist anchor*, a *pain/pull anchor*, and a *constraint anchor*. Captured technical constraints land in the constraint anchor and bound subsequent technical-design fan-outs. |
| **Grounding anchor** | One sentence-scale fact captured during early elicitation that contributes to the grounding bundle. |
| **Establishment offer** | A `brunch.establishment_offer` custom transcript entry summarising the elicitor's perceived gaps, the available lens strategies for the next move, the recommended lens, and the agent's confidence. Source of ambient affordances rendered in the chrome region; inspectable post-hoc and fixture-able. Orientation artifact, not a default exhaustive strategy menu. |
| **Elicitor intent hint** | A `brunch.elicitor_intent_hint` custom transcript entry emitted alongside a prompt or proposal, declaring `lens` and semantic targets (e.g. expected ontological sub-type) for downstream observer/reviewer routing and extraction guidance. |
| **Review set** | A batch proposal generated by a generative lens, presented to the user for review-cycle acceptance (approve / request changes / reject), modeled on the GitHub PR-review-cycle. |
| **Batch acceptance** | The single `CommandExecutor` call (`acceptReviewSet`) that commits an entire review set atomically as one LSN and one change-log entry, attributed to the user. The only mutation a generative-lens acceptance produces. |
| **Reviewer** | An agent-mode that runs async after batch acceptance, scoped to the accepted batch plus graph neighborhood, analyzing for coherence / completeness / gaps. Authority is narrow: writes only `reconciliation_need` records via `CommandExecutor`. Architecturally a mirror of `observer`. |
| **Anchor scenario** | A particular vignette embedded inside one alternative pitch to ground its framing. Transcript-rendered; not persisted as a graph entity. |
| **Contrastive scenario** | A particular vignette distinguishing two alternatives, surfaced in comparison UI. Transcript-rendered. |
| **Probing scenario** | A particular vignette posed by the elicitor to force a user response that disambiguates intent. Transcript-rendered; user response persists per existing elicitation mechanics. |
| **Meta-rubric** | The soft heuristic axis set (*legibility / cost-of-knowing*, *failure modes*, *coverage / range*, *commitment*) the elicitor attempts when generating fan-out comparison rubrics across candidate-spec, technical-design, and verification-design flows. Not architecturally enforced. |

## Verification Design

### Verification Stance

Verification is first-class product work for Brunch because the POC's claims are mostly seam claims: pi harness reuse, JSONL transcript truth, one mutation authority, thin RPC/projection handlers, graph continuity, and fixture-driven elicitation. A frontier is not complete merely because the UI appears alive; durable architectural claims must be proven against canonical stores or projection handlers.

Brunch uses a three-layer stance:

1. **Inner loop:** fast static and unit checks prove local contracts and keep the codebase shippable.
2. **Middle loop:** runbook oracles, round-trip/property tests, contract tests, and fixture replay prove frontier seams against durable artifacts.
3. **Outer loop:** adversarial/generative fixtures and manual walkthroughs assess LLM elicitation quality, UX feel, and long-horizon coherence that cannot be reduced to schema checks.

**POC-phase posture (M0–M9): viable-and-reasonable, not hardened.** Across the POC milestone ladder, the goal is "the system is viable and works at least reasonably well" — proof-of-life for each architectural claim, not statistical robustness. The implications for oracle design:

- **Structural invariants stay hard gates** (atomicity, no-bypass, write-target restrictions, schema conformance, supersedes acyclicity). These don't get cheaper to defer; getting them wrong corrupts the substrate.
- **LLM-behavioral metrics — proposal structural-legality rate, lens-recommendation appropriateness, reviewer-finding precision — are *tracked as fitness*, not gated.** Captured per-run in fixture metadata; surfaced for human review; thresholds noted as targets (e.g. ≥95% legality on first attempt) but failure to hit them does not block merges during POC.
- **Multi-run variance probes use conservative replication** (3 runs middle-loop, 5 outer-loop) — enough to detect catastrophic instability, not enough to characterize tail distributions. Higher replication is post-POC.
- **Adversarial/generative fixture campaigns stay small and targeted** during POC: one or two known-bad scenarios per relevant invariant, not exhaustive coverage. Coverage breadth is post-POC.
- **Deferred to post-POC hardening:** mutation testing, large-seed campaigns, performance budgets, accessibility audits, formal pass-rate thresholds as merge gates, exhaustive adversarial coverage.

The structural/behavioral split is the key discipline: never let a behavioral fitness metric weaken a structural gate, and never demand statistical confidence on a behavioral metric during POC that the LLM-budget cost cannot bear.

### Diagnostic Assessment

| Dimension | Score | Notes | Raised by |
| --- | --- | --- | --- |
| Observability | partial, improving to high by M4/M5 | Text-native artifacts are planned (`.brunch/state.json`, Pi JSONL, command results, graph exports, coherence exports, fixture bundles). Generative-lens material adds further text-native surfaces: `brunch.review_set_proposal`, `brunch.establishment_offer`, `brunch.elicitor_intent_hint` entries plus reviewer-finding `reconciliation_need` records. *Structural* observability is high; *behavioral* observability (proposal quality, lens-recommendation appropriateness, reviewer precision) remains low and outer-loop only. M0 TUI chrome and M3 browser UX remain partly visual unless paired with artifact/query checks. | Runbook oracles; projection handlers; graph/coherence exports; transcript projection of lens/establishment/proposal entries. |
| Reproducibility | partial | Fixture briefs and captured runs create a repeatable path. M1/M2 proved the agent-as-user harness and JSONL projection/reload discipline. LLM runs remain variable, so deterministic postcondition checks and property assertions are required; generative-lens flows additionally need seeded multi-run probes to characterize structural-legality rate at all. Driver extension for review-cycle flows (approve / request-changes / reject) is conditional on cost being worth the controllability gain. | Deterministic runbook checks; captured-run metadata; replay/property fixtures; (planned) review-cycle driver extension. |
| Controllability | partial → high (conditional) | `npm run fix` / `npm run verify` are agent-controllable. The agent-as-user stdio RPC driver covers extractive-lens flows end-to-end; extending it to drive review-cycle acceptance/regeneration would lift generative-lens controllability to "high" but carries implementation cost. TUI/browser/manual flows for ambient affordances, in-flight reviewer signals, and chrome rendering remain runbook-oracle territory. | Store/projection postcondition checkers; stdio/WebSocket drivers; (planned) review-cycle driver extension; runbook oracles for chrome surfaces. |

### Verification Commands

Infrastructure is not yet fully laid (Phase 3 of POC bootstrapping). Commands follow `AGENTS.md` conventions:

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
- **Frontier completion:** manual smoke can prove presentation life, but any durable product claim must also have an artifact/query oracle, property/round-trip test, contract test, or fixture assertion tied to the canonical store or projection handler that owns the fact.
- **Fixture architecture:** the POC adopts the three-layer model from [fixture-strategy.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md): replay regression, property regression, and adversarial / generative probes. Captured-run bundles converge on `.jsonl`, `.graph.json`, `.coherence.json`, and `.meta.json` artifacts under `.brunch-fixtures/`.

### Oracle Strategy by Loop Tier

| Loop | Oracle family | Proves | Primary claims |
| --- | --- | --- | --- |
| Inner | Type-aware lint, type checks, fast unit tests | Local module correctness, typed command/result shapes (including `acceptReviewSet` and reviewer-writable record-class types), projection helper behavior (including `supersedes`-chain filtering). | D12-L, D13-L, D20-L, D21-L, D27-L, D28-L, D29-L. |
| Inner | Schema/shape validation at boundaries | JSON-RPC payloads, command results, structured elicitation entries, fixture metadata, graph exports, `brunch.review_set_proposal` / `brunch.establishment_offer` / `brunch.elicitor_intent_hint` custom-entry payloads (lens presence, `epistemic_status`, grounding coverage, entity-draft shape). | R8, R10, R11, R17, R20, R21, R23; I3-L, I10-L, I11-L, I17-L, I18-L. |
| Middle | **Runbook oracles**: prose manual actions plus executable postcondition checkers | Interactive seams leave correct durable state. Early M0 checkers may inspect stores only; once handlers exist, prefer projection-including checks. Extends to in-flight reviewer-signal chrome behavior and ambient-affordance rendering from latest establishment-offer entry. | D11-L, D21-L, D25-L, D29-L; I8-L, I13-L; A10-L. |
| Middle | Round-trip tests | JSONL reload, linear transcript validation, elicitation exchange projection, compaction, graph export/import, command result serialization, `supersedes`-chain reconstruction across regeneration. | D6-L, D13-L, D24-L, D28-L; I3-L, I8-L, I10-L, I19-L. |
| Middle | Property-based / model-based tests | LSN monotonicity, change-log replay, reconciliation-need invariants, mention staleness, interest-set recomputation, side-task delivery ordering, **batch-acceptance atomicity (one LSN / one change-log entry, partial-batch impossible even under mid-batch validation failure)**, **`supersedes`-chain acyclicity and unique-leaf-per-thread**, **lens-routing correctness (generated elicitor entries route to the right consumer)**, **reviewer-finding turn-boundary delivery ordering**. | A4-L, A8-L, A9-L, A11-L; I1-L, I4-L, I5-L, I6-L, I9-L, I12-L, I15-L, I16-L, I18-L. |
| Middle | Contract tests | Named RPC method families and transport adapters share handler semantics; subscriptions deliver initial snapshot plus ordered updates; `CommandExecutor` hides policy/transaction details; `acceptReviewSet` returns expected structured discriminants; only prevalidated proposals become reviewable review sets. | D5-L, D19-L, D20-L, D27-L; R11, R12. |
| Middle | Architectural boundary tests | No direct ORM/SQLite mutation outside `CommandExecutor`; no canonical chat/turn store; TUI/RPC/fixture code does not write `brunch.session_binding`; Brunch wrappers do not expose Pi branch creation/navigation as product behavior; reviewer-attributed writes target only `reconciliation_need`. | D4-L, D6-L, D18-L, D21-L, D24-L, D29-L; I2-L, I10-L, I11-L, I16-L, I19-L. |
| Middle | **Differential testing** | Dry-run validation at proposal time matches real-run validation at acceptance time (no drift between modes); free-form-generation vs constrained-generation legality rates (informs whether fallback path is needed per A14-L). | D27-L; A14-L. |
| Middle | Fixture replay and property assertions | Brief-driven sessions still produce structurally valid transcript/graph/coherence artifacts despite model drift. For generative lenses: **structural-legality rate of LLM proposals tracked per-run in fixture metadata as POC-phase fitness, not a merge gate**; first-attempt vs retry-with-feedback rates surfaced for human review. | A5-L, A6-L, A7-L, A14-L; I7-L; R20, R21, R22, R23. |
| Outer | Manual walkthrough with checklist | UX/presentation life: TUI chrome, spec selector, web shell feel, coherence visibility, elicitation usefulness. Adds: ambient-affordance rendering from establishment-offer entries; proposal/framing quality review; lens-recommendation appropriateness; review-cycle UX (approve / request-changes / reject); meta-rubric comparative-usefulness review (D31-L hypothesis test). | A10-L, A17-L; R4, R14, R16, R20, R21. |
| Outer | Adversarial / generative fixture probes | Elicitation quality, human-gated `needs_human`, contradictory requirements, cross-session updates, long-horizon compaction, **reviewer-finding precision via small targeted set of briefs designed to produce *known* coherence problems** (POC-scope: 1–2 known-bad scenarios per relevant invariant, not exhaustive coverage). | A5-L, A8-L, A9-L, A11-L, A14-L; I4-L, I6-L, I12-L, I13-L, I16-L. |

### Runbook Oracle Design

A **runbook oracle** is the preferred bridge for seams that require human interaction but leave durable state. It has two parts:

1. **Manual checklist** — what the human does or observes (for example: launch TUI, select/create spec, confirm chrome, run `/new`).
2. **Executable postcondition checker** — what the agent/test harness inspects afterward in canonical stores or projection handlers.

Runbook postconditions should be boring and product-shaped: paths exist, JSON fields match, JSONL entries are present and unique, projections reconstruct the same state, command results carry expected discriminants. Store-only checks are acceptable before projection handlers exist; projection-including checks become the default once `workspace.*`, `session.*`, `graph.*`, or `coherence.*` handlers exist.

The first required runbook is M0: after manual TUI interaction, a checker proves `.brunch/` creation, `.brunch/state.json` current spec acceleration, Pi session JSONL files, exactly one `brunch.session_binding` per session, same-spec `/new`, and workspace/session reconstruction when available.

### Invariant Oracle Coverage

| Invariant | Assigned oracle(s) |
| --- | --- |
| I1-L | M4 property/model-based LSN and replay tests. |
| I2-L | M5 architectural boundary test plus `CommandExecutor` contract tests. |
| I3-L | M2 JSONL round-trip tests and fixture replay parity. |
| I4-L | M7 generated LSN/change traces and paired-session fixture assertions. |
| I5-L | M7 property tests over binding/lens transitions and interest-set recomputation. |
| I6-L | M4/M8 reconciliation-need property tests and contradictory-requirements fixture. |
| I7-L | M4+ schema/property tests over framing matrix plus brief fixture assertions. |
| I8-L | M0 runbook oracle plus M2 coordinator-created JSONL reload tests. |
| I9-L | M7 mention parser/ledger unit tests and staleness property tests. |
| I10-L | M1/M2 exchange projection tests, linear transcript validation, and no chat/turn architectural test. |
| I11-L | M4/M5 no-bypass architectural test plus command transaction integration tests. |
| I12-L | M7 side-task delivery invariant tests and adversarial fixture when side tasks are active. |
| I13-L | M1 fixture/projection checks for idle linear-session leaf state. |
| I14-L | M5 observer-job restart/idempotence tests. |
| I15-L | M5+ middle-loop property tests for batch-acceptance atomicity (one LSN / one change-log entry, partial-batch impossible under mid-batch validation failure) paired with `acceptReviewSet` contract tests; review-set fixture parity in replay. |
| I16-L | M5+ middle-loop architectural boundary test on reviewer-attributed `CommandExecutor` writers (rejects any non-`reconciliation_need` target); paired with reviewer-attributed command-result audit fixture. |
| I17-L | M5+ inner-loop schema validation on `brunch.review_set_proposal` entries (must declare `epistemic_status`); paired with outer-loop fixture assertion that status varies appropriately with grounding density (POC-phase fitness, not gate). |
| I18-L | M5+ inner-loop schema validation on elicitor-emitted custom entries (must declare `lens`); paired with middle-loop property test that generated entries route to the correct observer/reviewer consumer. |
| I19-L | Brunch extension/runtime guard tests for `/tree`/`/fork`/`/clone` blocking plus transcript-reader non-linearity rejection tests. |
| I20-L | M5+ proposal-validation contract and differential tests proving only dry-run-valid proposals become reviewable review sets. |

### Design Notes

- **Deterministic before generative.** M1 should prefer a deterministic or tightly scripted user-agent path for the first captured run before relying on LLM persona variance. Generative/adversarial probes come after the transcript and fixture substrate is trusted. M1 scripted captures prove the transport/projection/fixture substrate on its current terms; they do not settle the final elicitation interaction logic, knowledge flow, or prompt/response expectation model.
- **Projection handlers are oracles, not stores.** Read/subscription tests should prove handlers reconstruct truth from Brunch-supported linear Pi JSONL, `.brunch/state.json`, or SQLite graph/change log; they should not introduce a canonical view-store just for testing.
- **Behavioral quality boundary.** Inner/middle loops prove structural validity, durable state, invariants, and expected graph/property coverage. “Good interview”, “good question”, and “coherent UX feel” remain outer-loop checklist/generative-fixture judgments until enough examples justify sharper metrics.
- **Subscriptions are scoped for the POC.** Initial subscription oracles should prove initial snapshot plus ordered live updates. Reconnect/resume semantics are acknowledged but deferred unless a frontier explicitly depends on them.

### Acknowledged Blind Spots

| Blind spot | Reason | Mitigation | Revisit trigger |
| --- | --- | --- | --- |
| Full TUI automation | Cost exceeds value before the product state seams are proven. | Manual checklist plus artifact/query runbook oracle. | Manual TUI steps become frequent/flaky or block CI confidence. |
| LLM elicitation quality and interaction flow | No stable deterministic ground truth for “good interview” early in the POC, and M1 scripted exchanges intentionally encode only a thin current exchange model. | Brief library, human-reviewed golden captures, adversarial probes, expected structural coverage, and later review of knowledge flow through real elicitation loops. | Repeated fixture failures where structure passes but elicitation is judged poor, or M2/M3 reveals that prompt/response markers, offer envelopes, or knowledge-flow assumptions need sharper transcript semantics. |
| Subscription reconnect/resume | POC can prove snapshot + live update without hardening network recovery yet. | Contract tests for initial snapshot and ordered update sequence. | Web/RPC clients need robust reconnect semantics or long-running fixture runs expose drift. |
| Performance and scale | Local POC graph/session sizes are small; premature budgets may distort design. | Keep exports/checkers text-native and simple; add budgets when slow tests appear. | `npm run verify` or fixture runs exceed acceptable local iteration time. |
| Cross-platform terminal rendering | TUI chrome visuals may differ by terminal. | Test state derivation and keep manual smoke on primary dev environment. | Distribution target broadens or terminal rendering bugs recur. |
| Lens-recommendation appropriateness | No deterministic ground truth for "did the agent offer the right strategy at the right time" given temperament + grounding density inputs. | Brief-driven outer-loop walkthrough; small targeted scenarios where recommended lens is judged by reviewer; tracked as fitness, not gated. | Repeated user complaints that the offered strategies feel wrong, or fixture review reveals systematic mis-offers. |
| Framing/proposal quality at thin grounding | Generative-lens proposals may be syntactically legal but semantically weak when grounding is thin; `epistemic_status` honesty may not be enforceable without human judgment. | A14-L proposal-legality rate tracked as fitness; outer-loop walkthrough of proposals under thin vs rich grounding; `epistemic_status` distribution surfaced per run. | Acceptance-without-rework rates drop, or reviewers consistently mark proposals as `inferred`/`asserted` despite asserted grounding. |
| Reviewer finding precision (false positives/negatives) | Advisory-only reviewer can spam reconciliation needs (false positives) or miss real coherence gaps (false negatives); both erode trust. | Targeted adversarial briefs with known-bad coherence problems; precision/recall surfaced per run as fitness; user can dismiss reviewer findings without consequence. | Users systematically ignore reviewer findings, or coherence gaps slip past reviewer in known-bad fixtures. |
| In-flight reviewer-signal UX | Chrome rendering of "reviewer running / has findings" before next-turn delivery is not yet designed; cost may exceed value in POC. | Runbook oracle on chrome state after batch-accept; defer in-flight progress affordances unless a frontier explicitly demands them. | Users report confusion about whether reviewer ran or completed; or async job latency makes silence feel like failure. |
| Meta-rubric usefulness (D31-L) | Universal evaluative dimensions (complexity, lock-in, etc.) may or may not be productive across lens types; this is an unproven hypothesis. | Comparative outer-loop walkthrough: same proposal scenario with and without meta-rubric framing; user judgment captured in fixture metadata. | Meta-rubric framings are consistently ignored by users, or consistently produce better decisions — either signal warrants spec revision. |

### Acceptance Criteria

1. The POC milestone ladder M0–M9 can be sequenced as PLAN.md frontier items with each milestone establishing one durable architectural claim.
2. Cross-session graph changes are surfaced to the agent coherently at turn boundaries through `worldUpdate`.
3. Coherence is explicit product state, queryable through `graph.*` reads and visible in the TUI chrome.
4. The browser does not require a second primary data plane.
5. The transcript strategy is validated: pi JSONL sessions either suffice for the POC, or their insufficiency is sharply bounded with a justified fallback.
6. A fixture library of at least the seven starter briefs is captured and replayable; property invariants from the fixture-strategy doc pass against captured runs.
7. Brunch can be built as a local product over pi without forking pi.
