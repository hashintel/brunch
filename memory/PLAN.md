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

All delivery frontiers must also continue materializing the locked source topology (D52-L): target `src/{app, workspace, scripts, .pi, db, graph, session, projections, renderers, rpc, web}` with directed dependencies and explicit migration notes where current files have not moved yet. Treat topology completion as a product-delivery dimension, not cleanup. Each frontier definition names the files/directories it should move toward their final home.

The multi-spec workspace model is now explicit: a workspace is the cwd; multiple specs may coexist under it; each session binds to exactly one spec; each POC spec owns its own intent graph; cross-spec claim sharing/adoption is deferred (D11-L, D21-L, D61-L). Delivery work must target an explicit selected/current spec and must not accidentally recreate a workspace-global graph.

## Sequencing

### Active

1. `project-graph-review-cycle` — P1 unless demo narrative promotes it: real `project-graph` review-set proposal/approval loop.

### Next

1. `minimal-authority-shell` — P1 safety: thin POC authority posture over already-existing command-result seams and `elicit` tool policy.
2. `poc-live-ship-gate` — P1 final gate: fresh-cwd runbook exercising the composed product path end to end.

### Parallel / Low-conflict

- `probes-and-transcripts-evolution` — continuous probe/report/transcript hardening as each delivery frontier lands evidence.
- `topology-readmes-and-boundaries` — small doc/test hardening when a frontier moves files or exposes a boundary; should remain attached to the frontier when possible rather than becoming an abstract cleanup project.
- `dev-seed-fixtures` — rich, real seed data for local dev / manual / observer testing: the consolidated seed contract, the `npm run seed` loader, and growing/enhancing fixture sets (Bilal-port + legacy).

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

### project-graph-review-cycle

- **Name:** Project-graph review-set proposal and atomic acceptance
- **Linear:** [FE-809](https://linear.app/hash/issue/FE-809/project-graph-review-set-proposal-and-atomic-acceptance)
- **Branch:** `ln/fe-809-project-graph-review-cycle`
- **Kind:** structural / bounded feature
- **Status:** active
- **Certainty:** proving
- **Stabilizes:** I15-L, I20-L, I34-L, I40-L — exact review approval must become one explicit-basis atomic graph batch, not a path-shaped basis value or partial commit; only structurally valid review payloads may become user-reviewable.
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
- **Topology materialization:** Review payload schemas live under `.pi/extensions/exchanges` as the current structured-exchange schema seam; reusable review payload construction/rendering lives under `projections/structured-exchange/` and `renderers/structured-exchange/`; proposal validation/translation lives in `graph/` review modules; agent strategy resource lives in `.pi/skills/strategies/project-graph.md`; web observes via RPC projections.
- **Cross-cutting obligations:** Preserve D27-L: review-set proposal is a structured-exchange payload, not a standalone public review-set entity. Reviewer advisory writes remain deferred unless explicitly scoped. Existing-node references and review payloads use projected graph codes at adapter/UI boundaries, not raw DB ids.
- **Traceability:** R21, R23 / D4-L, D20-L, D26-L, D27-L, D51-L, D53-L, D62-L, D63-L / I11-L, I15-L, I20-L, I34-L, I40-L / A14-L, A16-L.
- **Design docs:** `docs/design/REVIEW_SETS.md`; `docs/design/GRAPH_MODEL.md`; `memory/SPEC.md` D27-L.
- **Current execution pointer:** Structured-exchange schema/emission lock and approval wiring are complete: active details/params are Zod-authored; the only Pi `TSchema` accommodation is `src/.pi/extensions/exchanges/pi-schema.ts`; active Pi tools, session-triggered present/request emissions, the intentional RPC/editor relay, and `session.submitExchangeResponse` review decisions route through canonical `src/projections/structured-exchange/*` projectors/adapters and durable markdown through `src/renderers/structured-exchange/*`; approve commits through `CommandExecutor.acceptReviewSet` with explicit basis and graph invalidations, while request-changes/reject stay transcript-visible non-mutating outcomes. Source-boundary tests guard against inline detail construction, scattered TypeBox, duplicate `tool_meta`, and missing projector parse validation. Remaining FE-809 work is the real `project-graph` proposal probe.

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
- **Topology materialization:** Policy lives in `graph/policy` and `.pi/extensions/runtime/` / command-policy adapters as appropriate; no caller-side policy snippets in `web/`, `rpc/`, or agent resources.
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
- **Current execution pointer:** A prepared live-mention autocomplete scope exists at `memory/cards/poc-live-ship-gate--live-mention-autocomplete.md`; it is a narrow product-path defect slice inside the ship-gate frontier, not M7 mention-ledger work.

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
- **Objective:** Keep the D52-L source topology legible as delivery work moves files: update local READMEs, add no-bypass/import-boundary checks where a new seam appears, and remove retired compatibility paths. The adapter/domain-local `project` / `format` helper migration has landed under top-level `projections/` and `renderers/`; future hardening should preserve those as narrow boundary layers rather than vague utility buckets.
- **Why now / unlocks:** The topology is itself a delivery asset: future agents and humans need to know where product behavior lives without rediscovering old `src/.pi/context`, root-level entrypoint scattering, or Pi-extension-owned projection/formatting helpers.
- **Acceptance:** When a frontier materially changes `src/{app, workspace, scripts, .pi, db, graph, session, projections, renderers, rpc, web}`, its README/boundary tests reflect the responsibility split; stale paths are deleted rather than aliased unless the current slice truly needs a transition.
- **Verification:** File-scoped documentation review and existing no-bypass/import-boundary tests; add grep/architecture tests only where they protect a real seam.
- **Topology materialization:** This frontier should usually be implemented as part of the frontier that caused the topology change; keep it separate only for doc/test-only hardening with low conflict. Completed 2026-06-06: root entrypoints moved to `app/`/`workspace/`/`scripts/`, reusable projection/rendering helpers moved to `projections/`/`renderers/`, and D40-L runtime-state policy now uses shared projected policy while `.pi` remains the adapter.
- **Cross-cutting obligations:** Do not create speculative folders. A directory earns existence by carrying present code/resources or by making an already-used seam legible.
- **Traceability:** D52-L, D39-L, D4-L.
- **Design docs:** `src/README.md`; `src/.pi/README.md`; `src/.pi/agents/README.md`; `src/.pi/skills/README.md`; `src/.pi/extensions/README.md`; `src/db/README.md`; `src/graph/README.md`; `src/projections/README.md`; `src/renderers/README.md`; `src/rpc/README.md`; `src/session/README.md`; `src/web/README.md`.

### dev-seed-fixtures

- **Name:** Development seed-fixture substrate (Bilal-port + legacy specs)
- **Linear:** unassigned
- **Kind:** tooling / dev-substrate
- **Status:** parallel / continuous
- **Objective:** Maintain rich, real seed data for local dev and manual/observer testing: the consolidated `{spec,nodes,edges}` seed contract under `.fixtures/seeds/<set>/<slug>.json`, the `src/graph/seed-fixtures.ts` loader (`npm run seed`) that commits each fixture through `CommandExecutor`, and the throwaway per-set port scripts that produce seed files. Grow set coverage and graph quality as delivery frontiers need data to exercise.
- **Why now / unlocks:** Delivery frontiers (`capture-response-to-graph`, the live-graph observer follow-on, `poc-live-ship-gate`) need real multi-spec graph data to exercise UI/agent/observer behavior without hand-authoring. The Bilal port already provides three loadable specs; enhancing them surfaces under-represented planes/kinds (notably `thesis`/`goal`) for richer capture and observer demos.
- **Acceptance:**
  - Seed contract stays loadable: each set's port script self-validates every `<slug>.json` through the real loader (same structural checks `commitGraph` enforces) before writing.
  - `npm run seed` loads every `.fixtures/seeds/<set>/<slug>.json` into the workspace DB through `CommandExecutor` (never direct row inserts), preserving spec-local graph clock / change log / LSN coherence.
  - New seed sets follow the established shape: vendored `_originals/`, throwaway `_port-script.ts`, consolidated `<slug>.json`, generated `README.md`; derived variant sets may instead document the deterministic filter over an existing seed set and keep mixed-basis product-run output under `.fixtures/runs/`.
  - Product curation runs over seeds leave transcript-backed artifacts (`session.jsonl`, `transcript.md`, `report.json`, and graph readback when graph truth is the proof target) and prove real `commit_graph` transcript evidence plus implicit graph rows; mixed-basis snapshots are not registered as reusable seeds.
- **Enhancement backlog (captured, not yet scoped):**
  1. Enhance Bilal-port fixtures *through Brunch itself* by feeding the original briefs Bilal authored, to recover `thesis`/`goal` structure the current ported graphs under-express.
  2. Port and enhance the earlier product version's fixtures (the legacy walkthrough scenarios in `docs/praxis/manual-testing.md`), raising quality through better semantic definition (kinds, detail) and internal connection (edges).
- **Verification:** Inner — `src/graph/seed-fixtures.test.ts` seeds real fixtures into an in-memory DB and asserts spec/node/edge counts plus spec-local change-log/clock coherence independent of seed order, rejects non-`explicit` basis, and covers the `macro-view-grounded-intent` explicit intent-only variant; `src/probes/fixture-curation-loop.test.ts` proves curation report/artifact evidence detection without an LLM. Outer — `npm run seed` smoke against a fresh cwd; real fixture-curation runs under `.fixtures/runs/fixture-curation/`; seeded-dev-rpc smoke proves `dev.graph.commitGraph` advances only the mutated spec's overview LSN.
- **Topology materialization:** Seed data and throwaway prep scripts live under `.fixtures/seeds/`; the loader lives in `src/graph/seed-fixtures.ts` (graph/ owns `CommandExecutor` orchestration; db/ is imported only by graph/, never the reverse); no seed-only graph runtime the product launch does not use.
- **Cross-cutting obligations:** Seeds commit only through `CommandExecutor`; directly-authored items use `basis: explicit` (the retired `accepted_review_set` value is not a basis). Respect multi-spec discipline — each fixture is one spec's own graph (D61-L). Pre-release posture: regenerate fixtures when the schema moves rather than preserving stale shapes. **Known drift:** `docs/praxis/manual-testing.md` still describes the earlier seed system (scenario-arg `npm run seed`, `.brunch/brunch.db`); reconcile it to the current loader (all-sets `npm run seed`, `.brunch/data.db`) when the legacy port (backlog item 2) lands — coordinate with the doc-reconciliation track rather than double-editing.
- **Current execution pointer:** Active semantic-mutation curation scope exists at `memory/cards/dev-seed-fixtures--semantic-graph-mutations.md`; it is not parallel-safe with FE-809 graph/review work on the same worktree because it touches `CommandExecutor` and review-set graph code. Product-driven fixture-curation tracer evidence remains the quality-review input: `macro-view-grounded-intent` is a deterministic explicit-basis Bilal variant, and `.fixtures/runs/fixture-curation/fixture-curation-2026-06-05T104440Z/` proves one real `propose-graph`/`commit_graph` run created implicit intent nodes from that base.
- **Traceability:** D4-L, D16-L, D19-L, D20-L, D52-L, D61-L, D62-L, D63-L / I1-L / A4-L, A14-L.
- **Design docs:** `.fixtures/seeds/bilal-port/README.md`; `docs/design/GRAPH_MODEL.md`; `docs/praxis/manual-testing.md`.

## Recently Completed
- 2026-06-06 `topology-readmes-and-boundaries` — Done: root product entrypoints moved to `app/`/`workspace/`/`scripts`; reusable graph/session/structured-exchange/workspace projection helpers moved to `projections/`; reusable markdown/text renderers moved to `renderers/`; `src/projections/topology-boundaries.test.ts` now guards the projection/renderer adapter boundary; and D40-L runtime-state policy now shares `elicit-read-only` tool-policy definitions from `projections/session/runtime-policy.ts` while `.pi/extensions/runtime` remains the Pi tool adapter. Verified: targeted topology/runtime tests and `npm run verify`.

- 2026-06-05 `capture-response-to-graph` (FE-807) — Done: synchronous response-capture tracer. Added a narrow labeled-text translator for `Goal:`, `Context:`, `Constraint:`, and `Criterion:` facts; wired public `session.submitExchangeResponse` to capture through the transcript binding's spec and `CommandExecutor.commitGraph({basis: explicit})`; returned loud capture outcomes; published graph invalidations; and added a public-RPC proof that activation/trigger/submit/overview exposes captured projected codes. Verified: `src/graph/capture/structured-response.test.ts`, `src/rpc/handlers.test.ts`, `src/probes/capture-response-to-graph-proof.test.ts`.

- 2026-06-05 `dev-seed-fixtures` — Done: first product-driven fixture curation tracer. Added deterministic `bilal-port-variants/macro-view-grounded-intent` explicit-only intent base, a `fixture-curation` probe runner/report summarizer, and run artifacts proving `gpt-5.5` used real `read_graph`/`commit_graph` product tools to persist two implicit requirement nodes plus six implicit edges through `CommandExecutor`. Verified: `src/probes/fixture-curation-loop.test.ts`, `src/graph/seed-fixtures.test.ts`, real run `.fixtures/runs/fixture-curation/fixture-curation-2026-06-05T104440Z/`.

Older history (including `graph-tool-resilience`, spec-scoped graph-clock hardening, `agents-composition-layer`, `live-graph-observer`, `agent-graph-integration`, `spec-persistence-and-startup`, `sealed-pi-profile-runtime-state`, `pi-ui-extension-patterns`, `web-shell`, `jsonl-session-viability`, `mode-shell-and-fixture-driver`, `walking-skeleton`): `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
nodes:
  graph-tool-resilience          [done · P0]         materialized graph write contract and broadened A14 proof
  capture-response-to-graph      [done · P0]         structured answer -> graph truth -> observer update
  project-graph-review-cycle     [active · P1]       real project-graph review-set approval loop
  minimal-authority-shell        [next · P1]         thin safety posture for current POC paths
  poc-live-ship-gate             [next · P1]         final fresh-cwd composed product runbook
  probes-and-transcripts-evolution [parallel]        continuous evidence substrate
  topology-readmes-and-boundaries  [parallel]        attach-to-frontier topology hardening
  dev-seed-fixtures                [parallel]        rich seed data substrate for dev/observer testing

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
  dev-seed-fixtures                -[data]->     capture-response-to-graph, poc-live-ship-gate (real multi-spec graphs to exercise observer/capture)

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
