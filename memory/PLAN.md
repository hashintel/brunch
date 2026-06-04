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

Brunch-next is now in a **POC delivery cut**. The earlier concept-driven frontier work proved the host, transcript, public RPC, sealed Pi profile, SQLite graph data plane, `CommandExecutor`, real graph tools, and one real `propose-graph → commitGraph` agent proof. The remaining POC work is not to prove Brunch is good at specification work in the broad product-quality sense; that belongs beyond this POC. The delivery question is narrower and stricter: can the real product entrypoints compose without the harness secretly supplying wiring?

The delivery cut's black triangles are (live graph observability is now landed; the rest remain in sequence):

1. **Live graph observability (landed):** the TUI remains the writer/agent session while the web app attaches over Brunch WebSocket RPC and shows the selected spec's graph changing.
2. **Behavioral runtime posture:** operational goal/strategy/lens state changes the actual prompt/resource/tool posture, not just a stored label.
3. **Capture to graph truth:** a structured elicitation response can become high-confidence graph truth through `CommandExecutor`, visible to web/TUI projections.
4. **Graph tool resilience:** the direct agent graph path survives more than the one A14 happy path: existing-node refs, structural-illegal diagnostics/retry, and ambiguity/no-overcommit cases.
5. **Review cycle, if included in the POC story:** `project-graph` proposal generation surfaces a dry-run-valid review set, and approval commits atomically.

All delivery frontiers must also continue materializing the locked source topology (D52-L): `src/{.pi, agents, db, graph, session, rpc, web}` with directed dependencies. Treat topology completion as a product-delivery dimension, not cleanup. Each frontier definition names the files/directories it should move toward their final home.

The multi-spec workspace model is now explicit: a workspace is the cwd; multiple specs may coexist under it; each session binds to exactly one spec; each POC spec owns its own intent graph; cross-spec claim sharing/adoption is deferred (D11-L, D21-L, D61-L). Delivery work must target an explicit selected/current spec and must not accidentally recreate a workspace-global graph.

## Sequencing

### Active

_None._

### Next

1. `graph-tool-resilience` — P0 structural hardening: materialize the locked graph write contract (projected node codes, explicit/implicit basis, supersession acyclicity) before more graph-writing frontiers build on stale schema.
2. `capture-response-to-graph` — P0 product loop: structured exchange answer → narrow high-confidence capture → `CommandExecutor` commit → web graph update.
3. `project-graph-review-cycle` — P1 unless demo narrative promotes it: real `project-graph` review-set proposal/approval loop.
4. `minimal-authority-shell` — P1 safety: thin POC authority posture over already-existing command-result seams and `elicit` tool policy.
5. `poc-live-ship-gate` — P1 final gate: fresh-cwd runbook exercising the composed product path end to end.

### Parallel / Low-conflict

- `probes-and-transcripts-evolution` — continuous probe/report/transcript hardening as each delivery frontier lands evidence.
- `topology-readmes-and-boundaries` — small doc/test hardening when a frontier moves files or exposes a boundary; should remain attached to the frontier when possible rather than becoming an abstract cleanup project.

### Horizon

- `turn-boundary-reconciliation` — M7; graph revisions, `worldUpdate`, mention staleness, side-task/reviewer drains.
- `coherence-first-class` — M8; bounded coherence verdicts backed by reconciliation needs.
- `compaction-and-conflict-widening` — M9; long-horizon continuity through compaction.
- `subagents-for-proposal-diversity` — optional proposal-quality enhancement; never a POC blocker.
- `oracle-design-plan-graphs` — lift oracle/design/plan planes from stubs after the POC delivery spine works.
- `flue-pattern-adoption` — post-POC harness-pattern adoption.
- `framework-direction-stubs` — discretionary structural stubs only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

## Frontier Definitions

### agents-composition-layer

- **Name:** Agent prompt-resource composition, runtime manifests, and snapshot contexts
- **Linear:** [FE-806](https://linear.app/hash/issue/FE-806/agent-prompt-resource-composition-runtime-manifests-and-snapshot)
- **Branch:** `ln/fe-806-agents-composition-layer`
- **Kind:** structural
- **Status:** done
- **Objective:** Build the D58-L/D59-L/D60-L `agents/` layer so runtime state changes behavior: `agents/state.ts` legal tuples and resource manifest metadata; `agents/compose.ts` runtime header + gated manifests; Brunch-owned markdown resources for definitions/goals/strategies/lenses/methods; agent-context snapshot renderers; and migration/deletion of the old `src/.pi/context` composer.
- **Why now / unlocks:** Runtime vocabulary has landed, but stored axes are not enough. The POC needs switchable strategies/lenses/goals to change prompt posture and available resources before capture and review-cycle behavior can be judged plausibly.
- **Acceptance:**
  - `compose(agentId, sessionState, spec, workspace, snapshots)` emits the agent-control header, runtime-state header, compact context handles, and gated `<available_goals>`, `<available_strategies>`, `<available_lenses>`, and `<available_methods>` manifests.
  - AUTO axes list exactly the legal set for the current agent/op-mode/grade/allow-list; pinned axes point to the pinned resource; illegal tuples are rejected in code.
  - At least the P0 behavior resources exist and are readable: `step-wise-disambiguate`, `propose-graph`, `intent` lens, `design` lens, grounding/capture objectives, and structured-exchange/capture/graph-commit methods as needed for following frontiers.
  - Snapshot rendering is split correctly: PULL in `graph/`/`session/`, RENDER in `agents/contexts/`, SURFACE through composition or snapshot tools.
  - `src/.pi/context/` is removed or reduced to a compatibility-free tombstone; prompt composition lives in `src/agents/`.
- **Verification:** Inner — manifest filtering/gating tests, legal/illegal tuple tests, resource location tests, snapshot render tests. Middle — compose legality across projected runtime states and spec grades; probe/manual prompt review showing two strategies/lenses produce materially different manifests/posture. Behavioral quality remains a fitness signal, not a merge gate.
- **Topology materialization:** Complete `src/agents/{definitions,goals,strategies,lenses,methods,contexts}` as the prompt/control subtree; `.pi/extensions/` only adapts Pi seams; `agents/` may import from `graph/` and `session/`, never the reverse; context string rendering does not leak into `graph/` pull functions.
- **Cross-cutting obligations:** Preserve D39-L sealed resource policy: manifest metadata is code-owned, not filesystem-discovered. Workspace posture is workspace-scoped header input, not spec/session/graph truth. Multi-spec discipline: composition reads the selected spec's grade/graph snapshots only.
- **Traceability:** D25-L, D39-L, D40-L, D52-L, D58-L, D59-L, D60-L / I18-L, I33-L, I35-L, I38-L / A14-L, A22-L.
- **Design docs:** `memory/SPEC.md` §Prompt/runtime profile architecture; `src/agents/README.md`; `src/.pi/README.md`.
- **Current execution pointer:** Complete. Prompt manifests, selected-spec context renderers, product prompt-path snapshot wiring, legacy `.pi/context` deletion, and deterministic runtime-posture proof are landed.

### capture-response-to-graph

- **Name:** Structured response capture into selected-spec graph truth
- **Linear:** [FE-807](https://linear.app/hash/issue/FE-807/structured-response-capture-into-selected-spec-graph-truth)
- **Branch:** to create — `ln/fe-807-capture-response-to-graph`
- **Kind:** structural / tracer bullet
- **Status:** next
- **Certainty:** proving
- **Stabilizes:** I30-L, I31-L, I39-L, I40-L — capture must aim at the selected-spec graph through stable projected node-code/basis semantics rather than raw ids or path-shaped basis values.
- **Lights up:** structured exchange response → explicit-basis graph truth → selected-spec web observer update.
- **Objective:** Prove the single-exchange path: a typed structured-exchange response is captured synchronously into high-confidence graph mutations through `CommandExecutor`, and the resulting graph change is visible through web/TUI projections.
- **Why now / unlocks:** Structured exchanges and graph commits work separately. This frontier makes elicitation actually graph-native for the POC. It directly attacks A22-L while preserving the single mutation authority.
- **Acceptance:**
  - A narrow capture path exists for 2–4 high-confidence intent facts, starting with basic/grounding kinds such as `goal`, `context`, `constraint`, `criterion`, or `assumption`; low-confidence implications remain out of graph truth and can be rendered as preface/disambiguation material.
  - Capture targets the spec bound to the session's `brunch.session_binding`; it never writes to a workspace-global graph or an unbound/default spec.
  - Captured graph mutations route only through `CommandExecutor`, write directly stated/exactly captured items with `basis: explicit`, allocate stable kind ordinals, and produce normal LSN/change-log entries.
  - The transcript retains the source structured exchange; graph readers expose the committed nodes/edges; the live web observer updates after capture.
  - Capture failures are loud and diagnosable (`structural_illegal`, policy/authority result, or explicit no-capture), not silent partial writes.
- **Verification:** Inner — capture classification fixtures; command-input shape tests; no-bypass tests. Middle — replay a structured-exchange response fixture through capture and assert graph/change-log/projection results; negative fixtures for low-confidence material and malformed responses. Outer — manual/probe run: user answers a structured prompt, capture commits a small graph slice, web observer updates.
- **Topology materialization:** `session/` owns transcript/exchange extraction; `graph/capture/` owns capture-to-command translation and structural/domain policy; `.pi/extensions/structured-exchange` remains an adapter; `.pi/extensions/graph` remains a tool adapter; `rpc/` and `web/` observe through projection handlers only.
- **Cross-cutting obligations:** Preserve D4-L/D20-L single-authority mutation; keep capture synchronous and bounded for POC; do not introduce deferred observer/auditor queues or canonical chat/turn tables here. Capture must respect D61-L: claims are node-level truth inside the selected spec. Preserve D62-L/D63-L/D64-L: projected codes are presentation handles, basis is approval strength, and readiness bands guide capture objectives without becoming kind whitelists.
- **Traceability:** R10, R16, R17, R21, R22 / D4-L, D17-L, D18-L, D20-L, D21-L, D45-L, D52-L, D54-L, D56-L, D57-L, D61-L, D62-L, D63-L, D64-L / I30-L, I31-L, I39-L, I40-L / A22-L, A3-L.
- **Design docs:** `docs/design/GRAPH_MODEL.md`; `docs/design/ELICITATION_LENSES.md`; `memory/SPEC.md` D17-L/D18-L/D61-L.

### graph-tool-resilience

- **Name:** Materialize graph write contract and broaden direct graph-tool proof
- **Linear:** [FE-808](https://linear.app/hash/issue/FE-808/broaden-direct-graph-tool-proof-beyond-the-a14-happy-path)
- **Branch:** `ln/fe-808-graph-tool-resilience`
- **Kind:** structural hardening / tracer bullet
- **Status:** in progress
- **Certainty:** proving
- **Stabilizes:** I34-L, I39-L, I40-L, I41-L — graph writes need stable node handles, correct approval basis, and supersession acyclicity before capture/review frontiers build on them.
- **Lights up:** real `read_graph` / `commit_graph` path with projected existing-node references, diagnostics/retry, and no-overcommit behavior through the default Brunch runtime factory.
- **Objective:** Materialize the locked graph write contract in schema, domain types, CommandExecutor validation, tool adapters, and snapshots, then extend the real `read_graph`/`commit_graph` product-path proof to representative failure and complexity cases.
- **Why now / unlocks:** The A14 commitGraph subclaim is partially validated by one successful run, but the canonical graph contract has moved: projected node codes, `basis: explicit | implicit`, per-kind ordinal allocation, and supersession acyclicity are now structural invariants. Capture and review-cycle work should not land against the old raw-id / `accepted_review_set` model.
- **Acceptance:**
  - DB/domain schema stores `kind_ordinal`, allocates it monotonically per `(spec_id, plane, kind)` through `CommandExecutor` counter rows or equivalent, and rejects duplicate `(spec_id, plane, kind, kind_ordinal)` tuples.
  - Graph node metadata owns globally unique 1–3 letter presentation labels plus non-exclusive readiness-band membership; snapshots/prompts/tools render projected codes without storing code strings.
  - Accepted nodes/edges use only `basis: explicit | implicit`; `propose-graph` direct commits are `implicit`, exact user/reviewed writes are `explicit`, and retired `accepted_review_set` values are rejected.
  - `commitGraph` accepts one approval basis for the batch, returns created ids/kind ordinals, resolves existing-node references from projected codes through adapters, and no longer requires agents to use raw DB ids.
  - Supersession edge creation validates acyclicity against existing same-spec supersession edges plus proposed batch edges, including intra-batch and mixed cycles.
  - Graph-truth vs active-context reads are explicit enough that active-context snapshots do not return dangling edges to hidden superseded nodes.
  - At least three additional probe scenarios land under `.fixtures/runs/`: existing-node reference, illegal edge/category/stance with retry, and ambiguous prompt where the agent should avoid overcommitting or ask/emit no-op diagnostics according to strategy guidance.
  - Probe reports record attempts, retry count, diagnostics seen, final graph counts/LSN, and friction.
  - Tool guidance and `structural_illegal` diagnostics are sufficient for at least one corrected retry path; if not, the report names the gap.
  - Existing-node refs target the selected spec's graph only.
- **Verification:** Inner — schema/domain/CommandExecutor tests for ordinal allocation, basis enum rejection, existing-code resolution, supersession acyclicity, active-context filtering, and tool adapter schema/results. Middle/Outer — real model probe runs with transcript/report artifacts; no artificial injection of the module under test that bypasses the default Brunch runtime factory.
- **Topology materialization:** Keep probes in `src/probes/` and `.fixtures/runs/`; keep tool adapter code in `src/.pi/extensions/graph/`; keep validators/diagnostics in `src/graph/`; no probe-only graph runtime wiring that product launch does not use.
- **Cross-cutting obligations:** Avoid harness-as-false-proof: the probe must exercise the same default Brunch runtime factory and registered tools that the product uses. Record fitness, not just pass/fail. Preserve D62-L/D63-L/D64-L as graph-wide contracts rather than adapter-local conveniences.
- **Traceability:** D4-L, D20-L, D51-L, D53-L, D60-L, D62-L, D63-L, D64-L / I34-L, I35-L, I39-L, I40-L, I41-L / A14-L, A5-L.
- **Design docs:** `docs/architecture/probes-and-transcripts.md`; `docs/design/GRAPH_MODEL.md`.
- **Current execution pointer:** Graph write contract materialization chain completed and removed from `memory/cards/`; remaining frontier work is direct product-path probe coverage for existing-code refs, retry diagnostics, and no-overcommit behavior.

### project-graph-review-cycle

- **Name:** Project-graph review-set proposal and atomic acceptance
- **Linear:** [FE-809](https://linear.app/hash/issue/FE-809/project-graph-review-set-proposal-and-atomic-acceptance)
- **Branch:** to create — `ln/fe-809-project-graph-review-cycle`
- **Kind:** structural / bounded feature
- **Status:** next
- **Certainty:** proving
- **Stabilizes:** I34-L, I40-L — exact review approval must become one explicit-basis atomic graph batch, not a path-shaped basis value or partial commit.
- **Lights up:** `project-graph` proposal → dry-run-valid `present_review_set` → approval → `acceptReviewSet` graph commit.
- **Objective:** Wire the `project-graph` strategy from real agent proposal generation through `present_review_set` / `request_review`, dry-run gating, approve/request-changes/reject response handling, and atomic `acceptReviewSet` commit.
- **Why now / unlocks:** This is the P1 proposal/review story. It is only P0 if the POC demo requires user-reviewed batch graph commitments rather than direct `propose-graph` and capture paths.
- **Acceptance:**
  - The agent can generate a review-set payload with required lens, epistemic status, and grounding/support metadata.
  - Only dry-run-valid proposals surface as reviewable; invalid generations remain internal to retry/regeneration.
  - Approve commits the entire batch through one `CommandExecutor` call, one LSN, one change-log entry, and `basis: explicit`; partial acceptance is not representable.
  - Request-changes and reject are transcript-visible outcomes; request-changes can trigger a successor proposal or an explicit deferred path.
  - Web/TUI can observe the proposal/decision state enough for the POC; full review UX polish may remain thin.
- **Verification:** Inner — review-set schema tests, dry-run/real-run differential tests, accept atomicity tests. Middle — structured-exchange review-cycle fixture; no-bypass checks. Outer — targeted probe: `project-graph` proposes, user approves, graph updates and web observer sees it.
- **Topology materialization:** Review payload schemas/renderers live under `.pi/extensions/structured-exchange` or `.pi/extensions/graph` only as adapter surfaces; proposal validation/translation lives in `graph/` review modules; agent strategy resource lives in `agents/strategies/project-graph.md`; web observes via RPC projections.
- **Cross-cutting obligations:** Preserve D27-L: review-set proposal is a structured-exchange payload, not a standalone public review-set entity. Reviewer advisory writes remain deferred unless explicitly scoped. Existing-node references and review payloads use projected graph codes at adapter/UI boundaries, not raw DB ids.
- **Traceability:** R21, R23 / D4-L, D20-L, D26-L, D27-L, D51-L, D53-L, D62-L, D63-L / I11-L, I34-L, I40-L / A14-L, A16-L.
- **Design docs:** `docs/design/REVIEW_SETS.md`; `docs/design/GRAPH_MODEL.md`; `memory/SPEC.md` D27-L.

### minimal-authority-shell

- **Name:** Minimal POC authority shell over graph/session actions
- **Linear:** [FE-810](https://linear.app/hash/issue/FE-810/minimal-poc-authority-shell-over-graphsession-actions)
- **Branch:** to create — `ln/fe-810-minimal-authority-shell`
- **Kind:** hardening
- **Status:** next
- **Certainty:** proving
- **Stabilizes:** D20-L/D40-L command-result and elicit-mode authority seams for the current POC graph/session paths.
- **Objective:** Fill only the authority behavior required for a credible POC: graph writes keep returning structured command results, `elicit` suppresses obvious side-effecting tools, and headless/RPC paths surface structured `needs_human` where the POC actually reaches human-only actions.
- **Why now / unlocks:** Full M6 can remain horizon, but the POC must not look unsafe or mode-specific when graph/capture/review paths are exercised.
- **Acceptance:**
  - `CommandExecutor` result discriminants remain the only graph mutation outcome surface for agent, RPC, and capture writes.
  - `elicit` operational mode blocks or hides side-effecting Pi tools already identified as unsafe for the POC; remaining strict built-in suppression limits are named as A18-L residue, not ignored.
  - Any human-only action encountered by current POC paths returns structured `needs_human` in headless/RPC rather than throwing a TUI-only dialog assumption.
  - No new standalone authority service is introduced.
- **Verification:** Inner — policy/result-shape tests for touched actions. Middle — small authority matrix over current POC paths (agent graph tool, capture write, review approve if present, RPC/headless selection). Outer — manual smoke only if a TUI-visible policy path changes.
- **Topology materialization:** Policy lives in `graph/policy` and `.pi/extensions/operational-mode.ts` / command-policy adapters as appropriate; no caller-side policy snippets in `web/`, `rpc/`, or agent resources.
- **Cross-cutting obligations:** This is a minimal shell, not full M6. Do not widen into comprehensive RBAC/permissions unless a current POC path needs it.
- **Traceability:** R5, R6, R10 / D20-L, D34-L, D40-L / A18-L, A3-L.
- **Design docs:** `memory/SPEC.md` D20-L/D34-L/D40-L; `docs/reference/pi-extensions.md`.

### poc-live-ship-gate

- **Name:** POC live ship gate and runbook oracle
- **Linear:** [FE-811](https://linear.app/hash/issue/FE-811/poc-live-ship-gate-and-runbook-oracle)
- **Branch:** to create — `ln/fe-811-poc-live-ship-gate`
- **Kind:** hardening / release gate
- **Status:** next
- **Certainty:** proving
- **Lights up:** fresh-cwd composed product path across TUI, web observer, runtime posture, structured exchange, and graph write surfaces.
- **Stabilizes:** harness-as-false-proof guard for I22-L, I35-L, I38-L, I39-L, I40-L.
- **Objective:** Create and pass the final POC runbook that exercises the real entrypoints together: fresh cwd, multi-spec selection, TUI session, web observer, runtime switch, structured exchange, capture/commit, graph update, and probe artifacts.
- **Why now / unlocks:** This is the harness-as-false-proof guard. If a test path had to inject modules the product never wires, the POC is not shipped.
- **Acceptance:**
  - Fresh cwd launches Brunch, creates or resumes an explicit spec/session, and does not implicitly resume stale transcripts.
  - A second spec can exist in the same workspace; the runbook confirms the active session/graph target is the selected spec.
  - Web attaches as read-only observer over WebSocket RPC and shows the selected spec graph.
  - Runtime strategy/lens/goal state is switchable/inspectable and changes composed prompt/resource posture.
  - A structured exchange answer or direct graph tool call commits graph truth through `CommandExecutor`; web updates.
  - Probe/runbook artifacts record transcript, graph summary, report/friction, and any accepted gaps.
- **Verification:** Middle/Outer — executable where practical, manual where TUI/browser interaction is unavoidable. Pair every visual assertion with a durable artifact or projection query when possible.
- **Topology materialization:** Runbook/probe code lives in `src/probes/` and `.fixtures/runs/`; it must launch product entrypoints rather than import private modules to fake the product path.
- **Cross-cutting obligations:** Keep the gate small and real. Do not turn it into a generic e2e framework or use it to backfill unrelated polish.
- **Traceability:** R4, R7, R10, R11, R12, R16, R19, R24, R28 / D5-L, D11-L, D19-L, D21-L, D33-L, D36-L, D52-L, D61-L, D62-L, D63-L, D64-L / I22-L, I32-L, I35-L, I38-L, I39-L, I40-L / A5-L.
- **Design docs:** `docs/architecture/probes-and-transcripts.md`; `docs/architecture/pi-ui-extension-patterns.md`; `memory/SPEC.md` verification stance.

### probes-and-transcripts-evolution

- **Name:** Evolve probe/transcript strategy as captures land
- **Linear:** unassigned
- **Kind:** hardening
- **Status:** continuous
- **Objective:** Keep probe/transcript artifacts honest as delivery frontiers land: report envelopes, Brunch-semantic transcript rendering, graph summaries, selected-spec metadata, friction fields, and per-assumption fitness notes.
- **Acceptance:** Each P0/P1 frontier either lands a transcript-backed probe/runbook artifact under `.fixtures/runs/<probe-id>/<run-id>/`, extends the report/transcript contract, or explicitly records why no probe change is needed.
- **Verification:** PR review plus cross-check that probe assertions map to SPEC assumptions/invariants or acknowledged blind spots.
- **Topology materialization:** Probe code lives in `src/probes/`; artifacts live in `.fixtures/runs/`; probes exercise public product surfaces unless explicitly marked as source/API spike evidence.
- **Cross-cutting obligations:** Treat probes as product-path evidence, not harness-only green paths.
- **Traceability:** A5-L, I32-L.
- **Design docs:** `docs/architecture/probes-and-transcripts.md`.

### topology-readmes-and-boundaries

- **Name:** Source topology README and boundary hardening
- **Linear:** unassigned
- **Kind:** hardening
- **Status:** parallel / attach-to-frontier
- **Objective:** Keep the D52-L source topology legible as delivery work moves files: update local READMEs, add no-bypass/import-boundary checks where a new seam appears, and remove retired compatibility paths.
- **Why now / unlocks:** The topology is itself a delivery asset: future agents and humans need to know where product behavior lives without rediscovering old `src/.pi/context` or root-level scattering.
- **Acceptance:** When a frontier materially changes `src/{.pi, agents, db, graph, session, rpc, web}`, its README/boundary tests reflect the new responsibility split; stale paths are deleted rather than aliased unless the current slice truly needs a transition.
- **Verification:** File-scoped documentation review and existing no-bypass/import-boundary tests; add grep/architecture tests only where they protect a real seam.
- **Topology materialization:** This frontier should usually be implemented as part of the frontier that caused the topology change; keep it separate only for doc/test-only hardening with low conflict.
- **Cross-cutting obligations:** Do not create speculative folders. A directory earns existence by carrying present code/resources or by making an already-used seam legible.
- **Traceability:** D52-L, D39-L, D4-L.
- **Design docs:** `src/README.md`; `src/.pi/README.md`; `src/agents/README.md`; `src/db/README.md`; `src/graph/README.md`; `src/rpc/README.md`; `src/session/README.md`; `src/web/README.md`.

## Recently Completed
- 2026-06-04 `graph-tool-resilience` graph write contract chain — Done: graph nodes persist per-kind ordinals and expose projected codes; `commitGraph` applies one explicit/implicit batch basis; adapters resolve existing-node codes inside the selected spec; same-spec supersession cycles are rejected atomically; active-context graph reads omit hidden superseded nodes and dangling edges while graph-truth reads remain available.

- 2026-06-04 `agents-composition-layer` (FE-806) — Done: `agents/state.ts`/`compose.ts` emit runtime headers and gated prompt-resource manifests; `agents/contexts/{cwd,graph,node}.ts` renders selected-spec context with lens-specific emphasis; the real `.pi` `before_agent_start` product path supplies selected-spec-bound graph snapshots from the Brunch runtime factory; the legacy `src/.pi/context/` prompt-pack subtree is deleted after folding its useful guidance into `src/agents/methods/*.md`; deterministic product-path proof records strategy/lens posture differences and accepted blind spots. Verified: context/compose/prompting/architecture tests and `npm run verify`. Watch: prompt quality is fitness evidence only; graph-write resilience and capture quality remain with the next P0 frontiers.
- 2026-06-04 `live-graph-observer` (FE-795) — Done: `graph.overview` and `graph.nodeNeighborhood` are discoverable selected-spec RPC reads; graph readers remain in `graph/`; TUI/agent `commit_graph` publishes graph invalidation topics through the shared product-update bus; the TUI launch path starts a read-only web sidecar over the same bus; the React web app attaches over one WebSocket RPC client, renders the selected-spec graph overview, and invalidates/refetches canonical graph readers on `brunch.updated`. Verified: targeted FE-795 test set (`src/rpc/handlers.test.ts`, `src/rpc/web-host.test.ts`, `src/web/app.test.tsx`, `src/brunch-tui.test.ts`, `src/graph/snapshot.test.ts`, `src/graph/spec-ownership.test.ts`), `npm run build`, and a 2026-06-04 `agent-browser` smoke that observed empty graph state then a `commit_graph`-created node in the browser without reload. Watch: richer node-neighborhood UI remains optional polish; the current proof exposes/query-backs the focused read and renders the overview.
- 2026-06-02 `agent-graph-integration` enabling slices — Done inside FE-785: runtime vocabulary fixed; source moved from `src/tui-client/.pi` to `src/.pi`; real `read_graph`/`commit_graph` Pi tools route through `CommandExecutor`; default Brunch runtime factory registers graph tools; A14 `propose-graph → commitGraph` probe persisted 4 nodes + 4 edges on first attempt; review-set dry-run gate validates/filters proposal payloads. Verified: targeted tests, `.fixtures/runs/propose-graph-commit/2026-06-02-propose-graph-commit/`, and `npm run verify`. Watch: broad FE-785 bucket is now split into delivery frontiers above.
- 2026-06-02 `spec-persistence-and-startup` — Done: specs are DB rows with integer ids and `readiness_grade`; `createSpec` / `getSpec` / `updateReadinessGrade` route through `CommandExecutor` with change-log audit; startup scaffolds `.brunch/workspace.json` + `.brunch/data.db`; session binding collapsed to `{schemaVersion,specId}` and is fork-portable; inventory resolves spec names from DB. Verified: `npm run verify` and real `brunch --mode print` against a fresh cwd. Watch: richer multi-spec initiative/claim model remains deferred by D61-L.

Older history (including `sealed-pi-profile-runtime-state`, `pi-ui-extension-patterns`, `web-shell`, `jsonl-session-viability`, `mode-shell-and-fixture-driver`, `walking-skeleton`): `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
nodes:
  graph-tool-resilience          [next · P0]         materializes graph write contract and broadens A14 proof
  capture-response-to-graph      [next · P0]         structured answer -> graph truth -> observer update
  project-graph-review-cycle     [next · P1]         real project-graph review-set approval loop
  minimal-authority-shell        [next · P1]         thin safety posture for current POC paths
  poc-live-ship-gate             [next · P1]         final fresh-cwd composed product runbook
  probes-and-transcripts-evolution [parallel]        continuous evidence substrate
  topology-readmes-and-boundaries  [parallel]        attach-to-frontier topology hardening

edges:
  graph-tool-resilience     -[hard]->         capture-response-to-graph
  graph-tool-resilience     -[hard]->         project-graph-review-cycle
  capture-response-to-graph -[hard]->         poc-live-ship-gate
  graph-tool-resilience     -[hard]->         poc-live-ship-gate
  project-graph-review-cycle -[optional]->    poc-live-ship-gate
  minimal-authority-shell   -[hard]->         poc-live-ship-gate

parallel obligations:
  probes-and-transcripts-evolution -[evidence]-> every P0/P1 frontier
  topology-readmes-and-boundaries  -[boundary]-> every frontier that moves/claims source topology

horizon:
  turn-boundary-reconciliation
  coherence-first-class
  compaction-and-conflict-widening
  subagents-for-proposal-diversity
  oracle-design-plan-graphs
  flue-pattern-adoption
  framework-direction-stubs
  geolog-and-petri-execution

notes:
  - Completed prerequisites: `agents-composition-layer` supplies runtime prompt/resource posture, and `live-graph-observer` supplies the read-only web observer path expected by `capture-response-to-graph` and `poc-live-ship-gate`.
  - `project-graph-review-cycle` is P1 unless the POC demo narrative requires batch proposal/review as a central story; promote it to P0 if so.
  - `topology-readmes-and-boundaries` is not a license for abstract cleanup; it rides with concrete delivery seams.
  - Multi-spec workspace discipline applies throughout: target the selected/current spec explicitly; no workspace-global graph truth in the POC.
```
