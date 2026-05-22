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

The next product arc is the **Conversational Workspace Runtime** umbrella (`docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md`) plus a stronger semantic/generative substrate. The umbrella synthesizes MULTI_CHAT, SIDE_CHAT, PATCH_LEDGER, and CONTINUOUS_WORKSPACE_HYBRID into five sub-tracks: workspace shell (Track 1, shipped as `continuous-workspace` / FE-709), inline secondary-chat runtime over the existing chat/turn substrate (`chat-runtime-secondary-chats`), reconciliation runtime absorption (`reconciliation-runtime`), changeset ledger (`changeset-ledger`), and transcript-first chat context provision (`chat-context-provision`). The shell is now the stable host; schema-level `thread` is deferred until chat/turn proves insufficient. Secondary chats are the near-term runtime primitive for side, reconciliation, qa, and strategy conversations. The chat runtime is the critical unblocker for reconciliation absorption; chat context provision can proceed against chat/turn with explicit transcript snapshots and graph-item handles. The changeset ledger runs in parallel. The umbrella supersedes the independent side-chat V4a persistence horizon — persistent side-chat history becomes inline secondary chats in the workspace. The FE-705 branch contributes an integration substrate — a local agent capability CLI and external LLM-as-user probe harness — that should be reconciled into main before graph-review and scenario-options work depends on generated completed-spec fixtures. After that, the highest-coordination work is intent-graph semantics and the semantic changeset ledger; FE-701 should follow soon after the FE-705 reconciliation because the current schema already carries transitional multi-chat / reconciliation placeholders that only become coherent once `changeset` / `change` owns semantic mutation history. Lower-coordination provider, gitignore, and web-research work can proceed in parallel.

The **orchestrator / Petri-net execution substrate** is committed (2026-05-21) to Petri as the forward execution model, justified by parallelism, simulation, and resume value claims. The dual-engine PoC (FE-730 / PR #143) validated the substrate but left the engine as a serial first-enabled interpreter with hand-compiled nets, collapsed mechanical/semantic completion, and leaked control state outside the net. The next moves evolve the Petri engine through a phased plan: Phase 0 (compiler/interpreter/firing-policy extraction) closes `orchestrator-poc`; Phases 1–2 (`petri-semantic-lanes`, `petri-parallel-execution`) are the near-horizon new frontier items under umbrella H-6476; Phases 3–4 (graph compilation, simulation oracle) are on the horizon pending `intent-graph-semantics` (FE-700) and relation-policy readiness. The north-star design is `docs/next/architecture/plan-graph-petri-orchestration.md`.

The May 2026 intent-spec, multi-chat, changeset-ledger, prompt/context, and agent-mutation design notes are reconciled into one direction. `docs/design/MULTI_CHAT.md` is the substrate document. `docs/design/SIDE_CHAT.md` describes side-chat V1 / V2 / V3.0 / V3.1 / V4 phasing on top of that substrate. `docs/design/PATCH_LEDGER.md` remains historical deeper design pressure for semantic mutation history, but canonical future-facing vocabulary is `changeset` / `change`. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` and `docs/design/BEHAVIORAL_KERNELS.md`; broader synthesis lives in `docs/archive/design/INTENT_SPEC_EVOLUTION.md`. FE-705's branch-local strategy/proposal notes add scenario options, graph-review oracle, chat-local strategies, and concern/dependency mapping; those notes should become a canonical design doc when the branch is integrated. Coordination uses a substrate-strangler posture: keep existing frontend REST/SSE contracts stable while route adapters and capability adapters converge on shared server-owned handlers, then cut over UI flows only after parity and changeset-backed authority exist. The dev-layer self-tooling trajectory lives in `docs/design/ln-skills/EVOLUTION.md`.

## Sequencing

### Active

1. `agent-fixture-substrate` — branch-complete off main, reconciling — FE-705 integration substrate for JSONL agent capability CLI and LLM-as-user probes.
2. `chat-runtime-secondary-chats` — FE-716; V1 done — PR #141 merged to main.

### Recently Completed

- `petri-semantic-lanes` (FE-738) — two-lane subnet, compiler topology/wiring split, engine factory, semantic rework budget, §7 events. PR #148. Criterion (5) stale-graph deferred → `petri-graph-compilation`.

### Next

1. `petri-parallel-execution` — parallel firing, shared resource pools, worktree-per-slice coordination; the categorical break where petri earns its complexity. Decision gate: if petri doesn't beat proc on wall clock, pause petri investment. Follows `petri-semantic-lanes`.
3. `intent-graph-semantics` — highest-coordination semantic substrate after FE-705 reconciliation.
4. `changeset-ledger` — Track 4 of the runtime umbrella; parallel with Track 2; semantic history spine needed before canonical proposal acceptance, direct-edit atomicity, and productized scenario options.
5. `chat-context-provision` — Track 5 of the runtime umbrella recast as transcript-first context; can proceed against chat/turn once secondary-chat entry/anchor shape is settled.
6. `reconciliation-runtime` — Track 3 of the runtime umbrella; after Track 2 + Track 4 provide the secondary-chat surface and durable attribution.
7. `graph-review-scenario-options` — artifact-only critique/probe lane; can advance in parallel with FE-700 if it does not commit canonical graph truth.
8. `productized-scenario-options` — user-facing acceleration surface after FE-700 semantics, FE-701 changesets, and graph-review probes.

### Parallel / Low-conflict

- `first-run-provider-setup` — provider/key UX and runtime seam can progress independently of semantic-stack work.
- `workspace-gitignore-assist` — small workspace hygiene surface with low overlap.
- `productized-web-research` — waits on prompt/context scenario substrate for probe quality, but can remain separate from semantic schema work.

### Horizon

- `petri-graph-compilation` — compile Petri nets from workspace plan-graph + relation policy; depends on `intent-graph-semantics` (FE-700). Extends the existing FE-700 relation-policy registry.
- `petri-simulation-oracle` — reachability analysis, deadlock detection, resume from durable markings. Planning oracle for plan-shape defects. Depends on `petri-graph-compilation`.
- `relation-first-observer-enrichment`
- `architect-generator-loop`
- `server-mini-library-compartmentalization`
- `side-chat-v4b-item-versioning` (depends on `changeset-ledger`)
- `dashboard-summaries`
- `spatial-graph-layout`
- `graph-view-active-path-filter`
- `mcp-adapter`
- `file-based-persistence`
- `typed-fixture-builder-convergence`
- `structured-development-spec-registry`
- `portability-boundaries`

## Frontier Definitions

### orchestrator-poc

- **Name:** Orchestrator POC — dual-engine execution with contract tests + compiler extraction
- **Linear:** FE-730
- **Kind:** structural / experiment
- **Status:** done
- **Objective:** Two interchangeable execution engines (`proc` and `petri`) behind a shared `Orchestrator` seam, driven test-first with fake agents. Takes a plan YAML (epics → slices), dispatches actions inline (registry deferred), runs tests deterministically, writes structured events to `reports.jsonl`. **Phase 0 (closing):** extract `NetCompiler` + `Interpreter` + `FiringPolicy` types from `engine-petri.ts`; define `PetriNet`, `Transition`, `Guard` aligned with the spec doc; implement `compileSliceTddSubnet()` so the TDD inner loop is compiled from a template rather than hand-wired; proc engine calls the same compiler with a serial firing policy; adapter test confirms compiled net for fixture matches expected place/transition count.
- **Why now / unlocks:** The PoC validated that petri earns its complexity (2026-05-21 commitment). Phase 0 extracts the reusable compiler/interpreter substrate so Phases 1–2 can evolve the net template and firing policy independently without another round of topology bugs. Also: retry budget currently leaks outside the net (`ctx.retries` Map) — Phase 0 should move retry state into places.
- **Acceptance:** (1) `brunch cook <fixture-dir> --engine=proc` completes Fixture #1 end-to-end. (2) Same with `--engine=petri`. (3) `reports.jsonl` human-readable. (4) Both engines pass same contract suite. (5) Worktree isolation holds. (6) Mid-run halt produces coherent `OrchestratorResult`. **(Phase 0 addendum):** (7) `NetCompiler`, `Interpreter`, `FiringPolicy` are separate modules. (8) Both engines call `compileSliceTddSubnet()`. (9) Retry state is in-net, not on `ctx.retries`.
- **Verification:** Contract tests (fake agents, both engines identical), adapter tests (per-engine internals, optional in POC), integration fixture run (real pi-agent on Fixture #1). Phase 0: adapter test for compiled net shape.
- **Traceability:** Requirements 46–50; D155-K–D159-K; I121-K–I123-K.
- **Design docs:** `docs/design/orchestrator.md`; `docs/next/architecture/plan-graph-petri-orchestration.md` §4–§6; umbrella H-6476.

### petri-semantic-lanes

- **Name:** Petri semantic lanes — mechanical + semantic two-lane subnet template
- **Linear:** FE-738
- **Kind:** structural
- **Status:** done (criterion 5 deferred → `petri-graph-compilation`)
- **Objective:** Extend the extracted NetCompiler to produce a two-lane subnet template per slice: a mechanical lane (dispatch, artifact production, test execution, verification) and a semantic lane (oracle satisfaction, design exercise, intent establishment, completion claim review). Add the spec §7 structured event vocabulary (`transition_fired`, `oracle_passed`, `graph_revision_stale`, `semantic_review_requested`, `completion_claim_accepted`, `status_projection_suggested`, `net_deadlocked`, …) as the interpreter's durable event model. `TransitionContract` type (spec §6) governs each transition's kind, actor, guard, action binding, and emitted events. Mechanical transitions produce candidate evidence; semantic transitions judge that evidence against graph-derived requirements. `PlanDoneAccepted` is reachable only after both lanes complete.
- **Why now / unlocks:** First frontier where the Petri engine models a distinction the proc engine cannot express topologically: mechanical completion ≠ semantic completion. Unblocks Phase 2 parallel firing (lanes can fire concurrently) and Phase 3 graph compilation (semantic lane structure maps to relation-policy gates). Without this, the engine remains a serial task runner with token-shaped bookkeeping.
- **Acceptance:** (1) ✅ Compiled subnet has distinct mechanical and semantic places/transitions. (2) ✅ `PlanDoneAccepted` is unreachable unless both `VerifyPassed` and `OracleSatisfied` (or equivalent semantic tokens) are present. (3) ✅ Event log records §7 vocabulary events per transition firing. (4) ✅ `TransitionContract` type covers kind, actor, guard, and emits. (5) **Deferred → `petri-graph-compilation`**: stale-graph detection requires `GraphRevisionCurrent` tokens and graph revision semantics from `intent-graph-semantics` (FE-700); the current Plan-from-YAML substrate has no mutable graph revision to detect staleness against. (6) ✅ Existing contract test suite passes. (7) ✅ `compileTopology(plan, policy) → NetBlueprint` is pure (no runtime refs); `wireHandlers(blueprint, input, ctx) → PetriNet` attaches closures. (8) ✅ `createOrchestrator(policy)` factory replaces identical engine classes. (9) ✅ `RunCtx` lives in `types.ts`, not compiler. (10) ✅ Semantic rework budget (`semantic-budget` place) prevents infinite rework loops. (11) ✅ `HandlerDescriptor` discriminated union describes each transition's routing recipe declaratively.
- **Verification:** Contract tests extended with semantic-lane scenarios (happy-path Prototype A, stale-graph Prototype B, missing-oracle Prototype C from spec §10). Adapter test for two-lane net shape via `compileTopology` (pure topology, no runtime bindings needed). Event-log assertions for §7 vocabulary. Semantic rework exhaustion contract test.
- **Traceability:** Requirements 46–50; spec §2 (layer split), §4 (canonical slice-net), §6 (transition contracts), §7 (event model), §8 (failure-mode nets), §10 (prototypes A–C).
- **Design docs:** `docs/next/architecture/plan-graph-petri-orchestration.md`; `docs/design/orchestrator.md`; umbrella H-6476.

### petri-parallel-execution

- **Name:** Petri parallel execution — concurrent firing, resource pools, worktree-per-slice
- **Linear:** FE-743
- **Kind:** structural
- **Status:** in-progress
- **Objective:** Replace the serial `while(true) { transitions.find() }` interpreter with a parallel firing policy that can advance multiple enabled transitions concurrently. Convert per-slice `test-agent`/`code-agent` tokens (already present in PoC at `engine-petri.ts:134-149`) into shared capped resource pools that bound global concurrency. Add worktree-per-slice isolation (one worktree per active slice, not just per run). This is the categorical break where the Petri engine earns its complexity over proc.
- **Why now / unlocks:** Parallelism is the primary value claim for petri over proc (per PR #143's own verdict and the spec doc's working conclusion). Without it, both engines are serial and proc wins on simplicity. If petri doesn't beat proc on wall clock time for multi-slice plans, the investment should pause.
- **Acceptance:** (1) Multi-slice plans execute with real parallelism (multiple transitions firing concurrently). (2) Resource pool tokens limit global concurrency to configured agent capacity. (3) Each active slice has its own worktree. (4) No fan-out starvation, dead-place, or unreached-slice bugs (regressions from PoC bug-fix rounds). (5) Wall-clock improvement measurable on a 3+ slice fixture vs serial execution. (6) Contract test suite still passes for both engines (proc remains serial).
- **Decision gate:** If parallel petri does not beat proc on wall clock for a representative multi-slice fixture, pause further petri investment and revisit the substrate commitment.
- **Verification:** Contract tests with multi-slice concurrency scenarios. Wall-clock benchmark on 3+ slice fixture. Resource-exhaustion test (more slices than agents). Worktree isolation tests per slice.
- **Traceability:** Requirements 46–50; spec §3 (token taxonomy — resource tokens), §4 (canonical slice-net terminal join).
- **Design docs:** `docs/next/architecture/plan-graph-petri-orchestration.md`; `docs/design/orchestrator.md`; umbrella H-6476.

### continuous-workspace

- **Name:** Continuous workspace / phase-addressable interview surface (Conversational Workspace Runtime — Track 1)
- **Linear:** FE-709
- **Kind:** structural
- **Status:** done
- **Objective:** Replace per-phase rendering boundaries with a cumulative center pane, realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and preservation of the single actionable frontier at the current reachable phase.
- **Why now / unlocks:** Workflow read/write ownership is extracted, the multi-chat substrate ships chat containers below the specification, and side-chat V3.0/V3.1 closed the cascade surface. This gives future side-chat persistence, strategy chats, and graph/workspace routes a stable host without introducing a second durable workflow model.
- **Acceptance:** Realized phase sections remain legible, future sections stay unreachable until valid, navigation is focus/scroll state only, and the current phase retains exactly one actionable frontier/recovery/handoff/completion affordance.
- **Verification:** Manual workspace walkthroughs across kickoff-ready, active, review-active, recovery, close-to-next-phase, resume/reload, and future-phase deep-link states; regression tests around route/workflow state where available.
- **Traceability:** A58; D86, D87, D110, D113, D114; I24, I102.
- **Design docs:** `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`; umbrella synthesis in `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` (Track 1).

### chat-runtime-secondary-chats

- **Name:** Chat runtime — inline secondary chats (Conversational Workspace Runtime — Track 2)
- **Linear:** FE-716
- **Kind:** structural
- **Status:** **V1 done** on `ka/fe-716-chat-runtime-unified-secondary-chats`. Substrate (C0–C9) + unified chat shell (C11–C16) ship together: durable secondary chats over `chat`/`turn` (no `thread` table), per-mode tool gating (Ask/Edit), `#REF-CODE` injection, lightweight reconciliation panel, retired SideChatPopover, layoutable unified chat shell with Compact / Side-docked / Maximize / Full modes (localStorage-persisted, Esc-decrementing, prefers-reduced-motion-honoring spring transitions), kind-chip per collapsible, Jump-to-anchor link per chat, trigger-driven auto-expand. PR submits once #139 lands or per Lu's signal. C7 (agent-run inline) remains deferred until a producer exists; `$` mention symbol, snapshot builder family, item-version-gated refresh, full target-grouped reconciliation UX, QA composer refinements, strategy sub-chat UI, mode-chip + Shift+Tab toggle, suggestions row, per-kind kickoff copy variations, mention autocomplete chip UI, item-anchored badge in structured-list / graph view, and Ladle prototype stay parked per the V1 parking lot in `memory/CARDS.md`. Track 3 (`reconciliation-runtime`) target-grouped UX depends on this shell's spine + collapsible vocabulary.
- **Objective:** Render side, reconciliation, qa, and strategy chats inline as collapsible secondary chats in the workspace using the existing chat/turn substrate. Defer schema-level `thread`; do not add `thread` / `turn.thread_id` unless a later RFC proves chat/turn insufficient. Retire the SideChatPopover as a UI surface only after parity exists over durable secondary chats.
- **V1 narrowing (FE-716 scope):** Frame V1 as "every behavior the current side-chat (V3.1) supports today, surfaced through the elevated unified-workspace shape." Build only what that framing requires: substrate columns on `chat` (`parent_chat_id`, `invoked_in_turn_id`, `pinned_item_id`, `pinned_span_hint`) without enum changes; durable secondary-chat persistence; turn-zero kickoff with server-supplied snapshots; Ask/Edit modes; `#` knowledge-item symbol injection only; lightweight reconciliation-element view (full reconciliation runtime stays Track 3); agent-run inline rendering; SideChatPopover deletion; **layoutable unified chat shell with Compact / Side-docked / Maximize / Full layout modes from `docs/design/UNIFIED_CHAT_UX.md` §4 (no inline-under-turn rendering, no "secondary chat" label, kind chip per collapsible, localStorage-persisted layout state, motion-driven transitions).** Explicitly defer to follow-up frontiers: `$` secondary-chat mention symbol, full reconciliation target-grouped UX, QA composer refinements, strategy sub-chat UI, mention autocomplete chip UI, snapshot builders, item-version-gated refresh, mode chip + Shift+Tab toggle, suggestions row, per-kind kickoff copy variations, item-anchored badge in structured-list / graph view, Ladle prototype. Design brief `docs/design/UNIFIED_CHAT_UX.md` is the canonical reference for the broader ceiling and stays unedited.
- **Why now / unlocks:** Track 1 (workspace shell) ships, providing the stable host. Inline secondary chats are the critical unblocker for reconciliation absorption (Track 3) and give chat-context provision (Track 5) stable initiating anchors without creating a competing strategy/context substrate. Supersedes the prior side-chat V4a persistence horizon — persistent side-chat history becomes durable secondary chats rendered inline.
- **Acceptance:** Secondary chat kinds (`side`, `reconciliation`, `qa`, `strategy`) are representable with chat/turn; each active/resumable chat preserves one open assistant/system-first frontier turn; secondary chats render inline/collapsible in the unified workspace; SideChatPopover retires as cutover; transient staged-patches strip does not become a new source of semantic truth; turn-zero (`turn_kind='kickoff'`) seeds secondary chats with explicit context snapshots (full snapshot lifecycle deferred to Track 5).
- **Verification:** Chat/turn persistence and reload tests, inline secondary-chat rendering tests, one-open-frontier-per-chat tests, manual walkthroughs for side/qa/strategy chat creation/display/collapse, and regression on existing interview flow.
- **Open question (resolve in Card 1 / Card 6):** Agent-run inline rendering — fifth `chat.kind` enum value, system-authored sub-chat reusing an existing kind, or a derived projection over `first_turn_role`. HANDOFF flagged for explicit decision; default posture is to keep the enum at `interview` + `side_chat` and project agent-run from `first_turn_role='system'` unless substrate behavior justifies promotion.
- **Follow-on design notes (from FE-716 ln-review):** three deepening shapes selected post-V1 to land as separate slices.
  - **Anchor projection (Design C)** — drop `chat.anchored_item_ids`; pin is the projection seed; mention parsing + explicit add/remove emit `anchor_op` events on turns; bundle projector returns the current anchor set. Add `turn.anchor_ops` JSON or `turn_kind='anchor_op'`. Aligns with D154 transcript-first posture. Owned by `chat-context-provision` going forward.
  - **Tool-part → patch extractor seam (Design B)** — replace the in-effect if-ladder in `useSecondaryChatStream` with a pure `extractStagedIntents(messages, …) → ToolCallDecision[]` adapter returning explicit `{status: 'stage' | 'skip' | 'defer', reason}` decisions. Hook owns only dispatch dedupe + `patchList.stage` plumbing. Tests run pure. Refactor to per-tool adapter registry when proposal tools cross ~5.
  - **Shell decomposition + provider lifecycle (Design A)** — lift master-chat bootstrap into `MasterChatProvider` at workspace scope (so collapse/expand doesn't reset the latch); add `BackgroundChatBroadcastProvider` at shell scope with Subscribe/Publish split contexts and a small reducer; add `ActiveChatProvider` next to broadcast; delete `onStreamingChange` / `onAssistantTurnArrival` props from `SecondaryChatHost`. Shell becomes a leaf consumer ~80 LOC. Six-step revertable migration path captured in the review thread. **Status (2026-05-19):** Aα landed; Aβ premise under review — C32 Slice 5 (workspace-footer mount target) was retired, so the lifecycle move now needs a different surviving scope. Candidate is `<ChatShellPresenceProvider>` at the spec route, which survives shell unmount/remount. Re-scope before building Aβ.
- **Traceability:** Requirement 45; A49, A94; D86, D87, D110, D114, D138, D153, D154; I111, I116, I120.
- **Design docs:** `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` §3.2 + §5 Track 2; `docs/design/MULTI_CHAT.md`; `docs/design/SIDE_CHAT.md`; `docs/design/SPEC_EVOLUTION_STRATEGIES.md`; design brief `docs/design/UNIFIED_CHAT_UX.md` (to be brought forward verbatim from PR #138 in Card 0; do not edit).

### reconciliation-runtime

- **Name:** Reconciliation runtime — async-by-default with in-stream secondary chat (Conversational Workspace Runtime — Track 3)
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** not-started
- **Objective:** Absorb reconciliation into the unified chat surface as a target-grouped secondary chat with async-by-default classifier scheduling and a "Reconcile Now" user trigger. Retire the standalone PendingReviewSection. Auto-confirmed rows resolve invisibly; only `auto-edit` (one-click apply) and `substantive` (judgment affordances) reach the user.
- **Why now / unlocks:** Tracks 2 (chat runtime) and 4 (changeset ledger) provide the secondary-chat surface and durable attribution. The reconciliation chat replaces the V3.1 Pending review section and the side-chat popover's reconciliation surface with a conversational target-grouped chat inside the workspace.
- **Acceptance:** Reconciliation chat renders target-grouped (topologically sorted upstream-first per PATCH_LEDGER target ordering); async classifier runs in background; auto-confirmed never surfaces; auto-edit has one-click apply; substantive has judgment affordances; "Reconcile Now" trigger in workspace shell; standalone PendingReviewSection retired as cutover.
- **Verification:** Reconciliation chat rendering tests, classifier scheduling tests, target-ordering tests, manual walkthroughs for async classification + Reconcile Now trigger, regression on existing reconciliation flow.
- **Traceability:** Requirement 45; A49, A88, A96; D135, D137, D138, D146, D153; I111, I113, I114, I120.
- **Design docs:** `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` §3.3 + §5 Track 3; `docs/design/MULTI_CHAT.md` §5; `docs/design/PATCH_LEDGER.md` §Target Ordering, §Reconciliation Flow.

### chat-context-provision

- **Name:** Chat context provision — transcript-first snapshots, handles, `#` mention, turn-zero (Conversational Workspace Runtime — Track 5)
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** not-started
- **Objective:** Implement transcript-first context provision for chats: turn-zero inserts explicit context snapshots stored on turns and derived from chat kind/strategy/anchors; `#` mention resolves to item ids, an inserted context snapshot, and an active chat handle; before new assistant turns, stale handles detect newer graph item versions/fingerprints and insert fresh snapshots only for changed subjects. Do not persist a hidden context-spec table by default. TOON or another compact graph serializer may format inserted snapshots/context packs.
- **V1 anchor/handle shape (absorbed from FE-716 ln-review, Design C):** drop `chat.anchored_item_ids`; the chat's pin seeds the projection; `#REF` mention parsing and the anchor-manager's explicit add/remove emit `anchor_op` events on turns (either `turn.anchor_ops` JSON or `turn_kind='anchor_op'` — pick during ln-scope); the bundle projector returns the current anchor set. Handles become per-(chat, item) records that compose from the same transcript pattern when freshness lands.
- **ln-review pickup slices (post FE-716, scoped here):** (1) **mention-snapshot** — persist literal user text separately from resolved `#` context; store context as turn snapshot artifacts, not appended `user_parts`; wire prompt assembly + existing `buildIntentContextSnapshot` / resolver. (2) **transcript-regression** — test that mention/snapshot blocks do not render inside the user message bubble. (3) **anchor-projection** — implement Design C and remove `chat.anchored_item_ids`. FE-716 merge follow-up lands **lineage validation** (`parentChatId` / `invokedInTurnId` same-spec checks) and **legacy `POST …/side-chat` removal**.
- **Why now / unlocks:** Secondary chats and strategy chats need stable, replayable prompt context that survives multi-chat edits without ambient graph rehydration. Transcript-first snapshots let prompt/context engineering remain the authority while preserving replay and audit.
- **Acceptance:** Chat prompts use transcript context first; initial anchors and mentions insert visible/replayable context snapshot artifacts on turns; active chat handles store referenced item ids plus last-snapshotted version/fingerprint and refresh changed graph subjects by inserting new snapshots before the next assistant turn; unchanged handles do not duplicate snapshots; snapshots preserve old versions rather than mutating; context builders can render one-or-more item snapshots, item-neighborhood snapshots, and economic whole-graph snapshots via typed context packs; neighborhood modes cover immediate adjacency, dependencies, dependents/impact, evidence, and reconciliation, with changeset-historical neighborhoods added once the ledger can identify original-capture and last-update surroundings; handles are revocable or expire by explicit transcript event/policy.
- **Verification:** Context snapshot artifact tests; changeset-backed stale-handle refresh tests across changes from another chat; no-refresh tests for unchanged item versions; `#` mention resolution/disambiguation tests; structured JSON assertions plus selected golden renderings for item-list, neighborhood-mode, and economic-graph context builders; historical-neighborhood tests once changesets can identify original capture / last update context; turn-zero prompt assembly tests per chat kind/strategy; and manual walkthroughs for side/qa/strategy chat context. Handle freshness waits on real item versions from `changeset-ledger` rather than temporary fingerprints.
- **Traceability:** Requirement 45; A80, A81, A84, A85, A95; D136, D137, D139, D140, D154; I112, I120.
- **Design docs:** `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` §3.5 + §5 Track 5; `docs/design/SPEC_EVOLUTION_STRATEGIES.md`; prompt/context pack docs.

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
- **Acceptance:** `invariant` and `example` are first-class durable kinds; examples are subtyped; `decision` is narrowed; `constraint`, `criterion`, and `invariant` semantics are enriched; `checkability` and witness strength are represented; relation families, negative relations, edge epistemic metadata, relation-policy directionality, and endpoint-relative display labels for dependency/dependent context snapshots are explicit.
- **Verification:** Corpus/fixture observer probes comparing old vs refined ontology; relation-policy unit tests for mixed-direction relations and endpoint-relative labels; graph-review manual assessment for precision/noise; context-pack probe outputs show authority, witness, relation support, dependency/dependent grouping, and directionality labels.
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

- [2026-05-21] `orchestrator-poc` — Done: FE-730 / PR #143 + Phase 0 compiler extraction. Extracted `PetriNet` interpreter → `petri-net.ts`, net compiler → `net-compiler.ts`, `FiringPolicy` type. Both engines now call shared `compilePlan()`. Retry state moved from `ctx.retries` Map into in-net `retry-budget` places. Adapter tests pin net topology. Verified: `npm run verify` 120/120 files, 1384 tests pass. Watch: proc and petri are currently identical (same compiler + serial policy); Phase 2 re-introduces divergence via parallel firing policy.
- [2026-05-13] `continuous-workspace` — Done: FE-709 / PR #134. Replaced per-phase InterviewView with ContinuousWorkspaceView (cumulative center pane), extracted `useContinuousWorkspaceController`, added sidebar scroll-spy via WorkspaceFocusContext, extracted shared controller helpers to core, retired route-first test assumptions. Verified: `npm run verify` 1213 / 1214 pass (1 pre-existing flake). Watch: Step 5 route-collapse decision deferred — hybrid works as intended.
- [2026-05-11] `side-chat-v3-1-agent-grouped-reconciliation` — Done: FE-674 / PR #124 + downstack closed the V3.x arc end-to-end with spec-level classifier route, per-row reset route, agent classification lifecycle, chips, per-class actions, and bulk Confirm-all / Apply-all-suggested. Verified: `npm run verify` 1178 / 1179 pass with one unrelated `side-chat-route` flake. Watch: A88 outer-loop walkthrough on a dense spec remains open to assess legibility vs V3.0's flat list.
- [2026-05-11] `fe-698-reconciliation-context-pack` — Done: added proposal-only reconciliation prompt/context scenario rendering open reconciliation needs with source/target anchors, reason/status, prompt/context fingerprints, and read-only capability metadata. Verified: `npm run verify`. Watch: next FE-698 work can broaden read-only/proposal-only probes and Pi adapter spike without treating this pack as a resolution agent.
Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Conversational Workspace Runtime umbrella
continuous-workspace (Track 1, done — FE-709)
  └──→ chat-runtime-secondary-chats (Track 2; no schema-level thread)
        ├──→ reconciliation-runtime (Track 3, also needs Track 4)
        └──→ chat-context-provision (Track 5; transcript-first snapshots/handles)
changeset-ledger (Track 4, parallel with Track 2)
  ├──→ richer attribution in reconciliation-runtime (Track 3)
  ├──→ real item versions for chat-context-provision handle freshness (Track 5)
  ├──→ original-capture / last-update historical neighborhoods for context snapshots (Track 5)
  └──→ unlocks architect-generator-loop and side-chat-v4b-item-versioning

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

TRACK F — Petri-net execution substrate (umbrella H-6476)
orchestrator-poc (Phase 0: compiler extraction — closing)
  └──→ petri-semantic-lanes (Phase 1: two-lane subnet + §7 events)
        └──→ petri-parallel-execution (Phase 2: concurrent firing + resource pools)
              └──→ petri-graph-compilation (Phase 3: compile from plan-graph + relation policy)
                    ├──→ depends on intent-graph-semantics (FE-700) for relation-policy gates
                    └──→ petri-simulation-oracle (Phase 4: reachability, deadlock, resume)

LOWER-PRIORITY / DEFERRED
side-chat-v4b-item-versioning (depends on changeset-ledger)
spatial-graph-layout + graph-view-active-path-filter
dashboard-summaries
mcp-adapter / file-based-persistence / typed-fixture-builder-convergence
structured-development-spec-registry
portability-boundaries

RETIRED
side-chat-persistence-v4a — superseded by chat-runtime-secondary-chats (Track 2)
```
