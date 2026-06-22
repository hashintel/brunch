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

Brunch-next is now in a **POC delivery cut**. The earlier concept-driven frontier work proved the host, transcript, public RPC, sealed Pi profile, SQLite graph data plane, `CommandExecutor`, real graph tools, and one real `propose-graph → graph-mutation` agent proof. The remaining POC work is not to prove Brunch is good at specification work in the broad product-quality sense; that belongs beyond this POC. The delivery question is narrower and stricter: can the real product entrypoints compose without the harness secretly supplying wiring?

The delivery cut's black triangles are (live graph observability is now landed; the rest remain in sequence):

1. **Live graph observability (landed):** the TUI remains the writer/agent session while the web app attaches over Brunch WebSocket RPC and shows the selected spec's graph changing.
2. **Behavioral runtime posture:** operational goal/strategy/lens state changes the actual prompt/resource/tool posture, not just a stored label.
3. **Capture to graph truth:** a structured elicitation response can become high-confidence graph truth through `CommandExecutor`, visible to web/TUI projections.
4. **Graph tool resilience:** the direct agent graph path survives more than the one A14 happy path: existing-node refs, structural-illegal diagnostics/retry, and ambiguity/no-overcommit cases.
5. **Review cycle, if included in the POC story:** `project-graph` proposal generation surfaces a dry-run-valid review set, and approval commits atomically.

All delivery frontiers must also continue materializing the locked source topology (D52-L): target `src/{app, workspace, scripts, .pi, db, graph, session, projections, renderers, rpc, web}` with directed dependencies and explicit migration notes where current files have not moved yet. Treat topology completion as a product-delivery dimension, not cleanup. Each frontier definition names the files/directories it should move toward their final home.

The multi-spec workspace model is now explicit: a workspace is the cwd; multiple specs may coexist under it; each session binds to exactly one spec; each POC spec owns its own intent graph; cross-spec claim sharing/adoption is deferred (D11-L, D21-L, D61-L). Delivery work must target an explicit selected/current spec and must not accidentally recreate a workspace-global graph.

The temporary `memory/CROSS_CUT_PLAN.md` elicitor capability ledger is **retired** (2026-06-12): every READ/WRITE/KNOW row landed or was promoted; its last open row — Seam 3a capture-reflection writeback — is designed (D81-L noticings-spawn-gaps + close-on-answered) and owned by `generalized-capture` (FE-861) acceptance. Cross-cut history: `docs/archive/PLAN_HISTORY.md`.

**Landed substrate (full definitions in `docs/archive/PLAN_HISTORY.md`).** The coverage layer is essentially closed: `graph-observed-shapes`, `runtime-affordances-and-legality`, `projection-shape-coverage`, and `prompt-composition-golden-coverage` are done; `renderer-golden-coverage` is the **only open coverage frontier** (deferred below the demo line). Also complete: `minimal-authority-shell`; `role-safe-graph-mutations` (the canonical role-named `mutateGraph` grammar); the `dx-feedback-loops` + `dx-introspection-live` dev substrate (D67-L–D71-L; never POC-ship-critical, D39-L sealing preserved); the readiness/elicitation-gaps remodel (D65-L/D75-L obligation register + D74-L `capability-readiness`, retiring stored grades and `chrome.phase`/`chrome.chatMode`); and FE-847 turn-boundary choreography (D76-L–D78-L, I45-L–I47-L). The former `exchanges-and-generalized-capture` was split (2026-06-11 demo cut) into `generalized-capture` (block 3) and the deferred `exchange-symmetry-audit`.

**POC demo/alpha two-deadline cut (2026-06-11 ln-plan).** A hard two-deadline cut now overrides the coverage-trio sequencing for *design attention*: a **minimal live demo (2026-06-12)** and an **alpha the following week**. The demo claim is locked to **elicitation-rich + generalized capture, minus the exchange audit**: fresh cwd → spec/session select → TUI drives → web observes → posture switch (with a named observable) → the agent asks the next-best question and **updates gaps from answers** (elicitation writeback) → **high-confidence generalized capture** of directly-stated facts → graph truth → visible graph update → durable runbook artifact. Exchange-surface symmetry work and renderer golden coverage are explicitly **out** of the demo bet.

Two oracles must stay distinct (PLAN previously fused them into one `poc-live-ship-gate`): **ship-correctness** ("the real product composes through public entrypoints, no harness wiring") vs **demo-credibility** ("it looks and behaves like a product to a live viewer"). Load-bearing finding: **no existing full graph-write / runbook proof exercises the whole product path via the public entrypoint.** A startup smoke (`src/probes/scripts/verify-startup-no-resume.sh`) *does* launch `dist/app/brunch.js --mode tui`, but it proves startup-no-resume only; every *graph-write/capture* proof (`capture-response-to-graph-proof.ts`, `propose-graph-commit-proof.ts`, …) hand-wires `createRpcHandlers` / `createWorkspaceSessionCoordinator` / `createBrunchAgentSessionRuntimeFactory` instead of driving the product through `runBrunchCli`. The ship gate is therefore non-redundant. Its **anti-cheat guard** is scoped to the **ship-gate driver/probe only** (it must launch the public CLI/subprocess and exercise the product over RPC, not import the wiring modules above); it does **not** ban private helpers across all probes, and the gate's *setup* may use the public seed CLI where one exists. Without that scoped guard the gate re-commits the harness-proving failure mode.

**Worktree topology (two simultaneous worktrees / branches).** The line is **product/contract (producer) below, clients/presentation (consumers) above** — and **both the web observer and the TUI are clients**. The producer owns behavior + the public contract; the client tier owns how that behavior is presented.

- **Lower / substantial — the elicitation-rich live product path** (producer + contract + ship gate). Owns `app/` (launch/host wiring), `rpc/` (the contract), `probes/`, `session/`, `graph/`, and the agent/runtime `.pi` **wiring** those blocks need. Frontier-stacked internally; worked as one substantial lower line.
- **Top / client tier — `demo-polish`** (presentation grab-bag noticed while testing). Two client surfaces: the **web** observer (`src/web/**` + web tests) and **TUI chrome/presentation** (`src/.pi/components`, `src/app/brunch-tui.ts` layout/formatting). Stacks on the lower line, restacked frequently. **Must not** change product wiring, add backend fallbacks, invent client-local truth, read SQLite/JSONL directly, or require write methods on the read-only sidecar; a needed new RPC field or runtime/wiring change is pushed **down** into the lower line and restacked.

Two seams, two strengths:

- **Web client** has a *clean directory seam* (`src/web/**` over RPC/WS). It consumes RPC projections at runtime and at build time imports only protocol types plus **pure shared presentation/type metadata** (e.g. `GraphSlice`, projection DTO types, the drizzle-free `NODE_KIND_METADATA` leaf) — no DB/session logic, no domain orchestration, no text renderers, no direct persistence.
- **TUI client** shares directories (`src/.pi`, `src/app/brunch-tui.ts`) with lower-line wiring, so its above/below split is **by concern (presentation vs wiring), not by path** — enforced by discipline and frequent restack, not a clean boundary. Presentation/chrome tweaks ride the top; anything touching runtime/wiring goes down.

The one coordination cost is the RPC contract (the web client's seam): **first confirm the existing notification/LSN surface is enough** (`brunch.updated` notification + `graph.overview` LSN + `session.runtimeState`); add a new contract field only if lower-line testing proves it missing. Whatever the contract ends up being, freeze it early in the lower line so the web client builds against a stable wire (the shared types/metadata are compile-time, so contract drift breaks the web build loudly).

**Thin-path discipline (per the user, 2026-06-11).** We are **not** fully analyzing the thin path now. Each lower-line work block opens with a short **practical-testing + analysis + `ln-grill`** prelude before `ln-scope`, to find the thinnest cut and defer every enhancement that can be deferred. This Context maps **intentions and the closed checklists/matrices where completeness is required**; per-block scoping resolves the rest.

**Completeness obligations for this cut (closed checklists/matrices — *not* coverage frontiers; the coverage-frontier protocol does not apply):**

- **poc-live-ship-gate runbook checklist / oracle matrix** — the acceptance list (in its frontier def) is the closed runbook; every step must launch a public entrypoint and emit a durable artifact (no hand-wired step).
- **generalized-capture false-commit scenario matrix** — the closed scenario family from `capture-quality-spike`, re-aimed at the D81-L commitment gradient (stated → explicit commit; confidently-materialized → implicit commit; low-confidence noticings → never committed, spawned as elicitation gaps); completeness = every scenario class has a probe-tier regression guard, with expected gap-spawns assertable.
- **elicitation-writeback gap-disposition checklist** — the `createElicitationGap` / `setElicitationGapDisposition` boundary (exists on `CommandExecutor`, **no non-test callers yet**) must cover spawn-on-reflection + close-on-answered through the existing `{specId, lsn}` / `change_log` clock (no second mutation clock).

Everything else still open (renderer golden coverage, exchange symmetry audit) is fitness/hardening and stays below the demo line; `runtime-vocab-leaf` is closed under `alpha-hardening`.

### Context-pipeline coverage (the next design/lock spine)

The four LLM-facing context concerns are not independent — they are the stages of **one pipeline** (D60-L): **PULL → PROJECT → RENDER → COMPOSE → surface**. Coverage means *each stage carries its appropriate oracle over a complete, ledgered inventory*. The stages must be closed **in dependency order**, because each downstream lock is only stable once its upstream shape is locked (projection invariants churn while read shapes still move; renderer goldens churn while projection shapes still move; prompt goldens churn while renderer output still moves).

**PULL is now ledgered on both halves.** The *graph* read surface is the template and is **done**: ledgered (`src/graph/README.md` observed-read-shape ledger) + drift-guarded (`observed-shapes-coverage.test.ts`). The *session* read surface (`session/workspace-context.ts`, `session/workspace-session-coordinator.ts`, `session/runtime-state.ts`, …) is now inventoried in `src/session/README.md` and was the upstream prerequisite for the completed PROJECT locks.

The oracle *kind* differs by stage — this is the load-bearing distinction the flat "lock everything" framing hid:

- **info-preserving stages (PULL, PROJECT)** want **invariant / no-loss / shape** oracles. A golden here is the wrong tool — brittle, and it cannot even catch the failure that matters (a projection silently dropping a field the renderer also hides).
- **lossy stages (RENDER, COMPOSE)** want **golden locks + semantic invariants**, because output wording/shape is itself the contract.

```
context-pipeline/                                          D60-L
├── PULL      graph reads    queries.ts          invariant + drift   ✓ DONE   #pull
│             session reads  session/*           ledger + invariants ✓ DONE
├── PROJECT   @projections  projections/        no-loss / shape     ✓ DONE   #project
├── RENDER    @renderers    renderers/          golden + invariant  ◐ open   #render
└── COMPOSE   @pi-agents    compose.ts+skills/  golden + invariant  ✓ DONE*  #compose

*COMPOSE goldens bracket renderer output with fixture `renderedContexts`; the full-stack real-rendered-context golden remains tripwired on RENDER.

dependency:  pull(session) -> #project -> #render; #compose is closed except for its explicit full-stack-renderer tripwire.
```

**Per-frontier deliverable:** the *complete* ledger for that plane (every module given a disposition — `✓` locked / `●` keep+lock / `◐` keep-decide / `✗` delete-inline / `○` leave — with owner + oracle), authored in the plane's README. The PROJECT ledger is now authored in `src/projections/README.md` (it applies an **earns-its-place gate before the oracle gate**: a single-consumer pass-through that only re-wraps its source is indirection to delete, not a row to lock). `renderers/README.md` does not yet carry its ledger; authoring it is the first card of `renderer-golden-coverage`. Not "close the gaps" — close the inventory.

**Human-in-the-loop design→lock rhythm** (so the user reviews each row before it is frozen):

```
per ledger row:
  1. enumerate        — name the module/case and its consumers
  2. preview/contract — golden-kind: generate output via harness (npm run render / new compose preview), user eyeballs
                        invariant-kind: state the no-loss/shape contract, user reviews "what must be preserved"
  3. design checkpoint — user approves the shape/wording/contract        [USER IN LOOP]
  4. lock             — golden-kind: toMatchFileSnapshot writes on first run, diffs after
                        invariant-kind: shape/round-trip assertion
  5. mark ●           — update the plane ledger
```

## Sequencing

### Active

**Demo lane — lower line (substantial; one worktree, one shared branch `ln/fe-852-below-the-line` for all lower-line blocks — user decision 2026-06-11 overriding the one-branch-per-frontier default).** Thinnest path per block is resolved by a short practical-testing + analysis + `ln-grill` prelude before `ln-scope`; defer every deferrable enhancement. Demo blocks 1 (`elicitation-driver`, FE-852), 2 (`context-seed-payload`, FE-857), 2½ (`origination-kick-live`), and 2¾ (`origination-native-elicitation`) are **done** — see Recently Completed and `docs/archive/PLAN_HISTORY.md`. Remaining blocks:

| Block | Frontier | Linear | Status |
| --- | --- | --- | --- |
| 3 | `generalized-capture` | FE-861 | done — post-demo immediate |
| 4 | `poc-live-ship-gate` | FE-811 (existing) | next — stacks on block 3 |

3. `generalized-capture` (FE-861) — **block 3**: the banded capture sweep under the commitment gradient with the acquisition/digest layer (D80-L/D81-L/D82-L; 2026-06-12 grill). Its own frontier (promoted out of `exchanges-and-generalized-capture`); **not** an FE-811 slice. Relation-bearing capture uses the `mutateGraph` grammar from `role-safe-graph-mutations`. Decoupled from the immediate 2026-06-12 demo (startup + interface only); post-demo immediate.
4. `poc-live-ship-gate` (FE-811) — **demo block 4**: the fresh-cwd runbook that composes blocks 1–3 through **public entrypoints only**, with the scoped anti-cheat import guard, a named posture observable, and real product renderers / web output as evidence.

**Demo lane — top line (client presentation: web readout + TUI chrome; second simultaneous worktree).**

- `demo-polish` (FE-858 "Client-side POC prep", branch `ln/fe-858-above-the-line`, PR #209) — client-tier presentation across two surfaces: **web** (`src/web/**` + web tests: posture panel, "graph updated" signal, spec/session display) and **TUI chrome** (presentation/layout in `src/.pi/components` / `src/app/brunch-tui.ts` that does **not** change wiring). Both are clients consuming the lower line's behavior/contract. Restacked frequently; no backend writes/fallbacks, no client-local truth, no product-wiring edits. New RPC fields or any runtime/wiring change are pushed **down** into the lower line. The web seam is path-clean (`src/web/**`); the TUI seam is concern-based (presentation vs wiring) and enforced by discipline + restack.

Each lower-line block carries its own completeness obligation (see Context §Completeness obligations): the ship-gate runbook checklist, the generalized-capture false-commit scenario matrix, and the elicitation-writeback gap-disposition checklist.

### Recently Completed

- 2026-06-22 `prompt-skill-topology` (FE-898) — aligned Brunch prompt resources to Agent Skills topology: every strategy/lens/method now lives at `src/.pi/skills/<family>/<name>/SKILL.md` with frontmatter, `state.ts` loads `name`/`description` through Pi `loadSkills({ skillPaths, includeDefaults: false })` over the code-owned legal set, `compose.ts` emits `<brunch-skills>` with Pi-style `<skill>` elements plus `<kind>`, and the sealing tests prove an unlisted `SKILL.md` is not advertised. Scope card retired; durable contract lives in SPEC D58-L/D85-L and `src/.pi/skills/README.md`.
- 2026-06-19 `alpha-hardening` (FE-897) — closed the three loose residues: explicit `--all-seeds` workbench seeding plus seed disposition catalog, the import-free `src/session/schema/kinds.ts` runtime-vocab leaf, and explicit deferral/adoption decisions for the FE-893 prompt-shape questions (`SKILL.md + references/`, `[sub]`, `_generated/`, and adopted `SYSTEM.md`).
- 2026-06-18 `prompt-skill-consolidation` (FE-893, merged #235) — materialized D85-L: runtime manifest collapsed to two AUTO axes (`strategy`, `lens`; `goal` inlined into `elicitor/SYSTEM.md`), `propose-graph`/`project-graph` re-filed as graph-write methods gated by capability ids, the `methods/capture` skill home created (FE-861 fills its body), `review-for-gaps` demoted to audit-only, and the `elicitation backlog` lexicon swept. Full definition + deferred-shape residue (now under `alpha-hardening`): `docs/archive/PLAN_HISTORY.md`.
- 2026-06-17 review-induced contract hardening — the exhausted `memory/REFACTOR.md` plan is retired after landing both induced findings: ordinary TUI sidecar `/rpc` observer connections stay read-only while the explicit `/rpc/driver` connection carries live driver/answer methods when handles exist (`88b3fe2e`), `read_graph list_by_band` renders dual-band nodes under the requested band and fails loud on nonmatching filtered renders (`54d187ac`), and SPEC records the sidecar authority invariant (`dd300e76`). Evidence: `src/rpc/README.md`, `src/renderers/README.md`, web-host/streaming tests, and graph renderer tests.
- 2026-06-17 `web-driver-streaming` streaming battery (FE-873, branch `ln/fe-873-web-as-driver`) — the full topology-A oracle battery landed on the tier-2 faux substrate: observer relay claims 1–4 (`291c5d93`), replay-less reconnect/resume claim 6 (`dab95b7d`), one-driver/many-observer fan-out claim 7 (`181c46da`), command-intake `session.driveTurn` plain-turn driving (`58204632`/`4ca87e62`/`79ca68f1`), and the claim-5 live `request_answer` answered leg via the Brunch-owned `LiveExchangeBroker` + `session.answerExchange` (`e3916c79`), plus two review-driven tidies (`625d2cbe`/`946df517`). Sidecar driver/answer methods are discoverable only on the explicit `/rpc/driver` connection when their handle is attached; ordinary `/rpc` observer connections remain read-only. Remaining web-driver legs (non-freeform `request_*` variants, React web consumer, `--mode web`, agent-as-user split) stay in the `web-driver-streaming` Horizon frontier. Evidence: SPEC §Verification Design streaming battery row + `src/rpc/README.md` §Streaming transport coverage.
- Older completed frontiers and the 2026-06-12 window: `docs/archive/PLAN_HISTORY.md`.

### Next (alpha-week / deferred below the demo line)

Deferred below the demo line until the demo lands. The earlier context-pipeline coverage trio is now **mostly done** (`projection-shape-coverage`, `prompt-composition-golden-coverage` complete; definitions archived in `docs/archive/PLAN_HISTORY.md`); only `renderer-golden-coverage` remains and it is **not** a demo blocker.

- `renderer-golden-coverage` — **reshaped 2026-06-16 by D83-L** (context-render house style: md-pen + TOON + stringify-tree, `<workspace>`/`<specification>`/`<session>` scope clustering); **actively worked on `ln/fe-870-renderer-golden-context-tools`** (FE-870), below the demo lane and **never a ship gate**. **Landed:** substrate, `<workspace>`, `<specification>`, the full graph-render migration (overview → G-D, neighborhood → G-C, `<specification>` graph block embedded; dead `formatGraphSlice` retired), and the band-filtered graph-slice hardening (`list_by_band` groups dual-band nodes by the requested band) — scope cards retired. **Remaining (fresh `ln-scope` pass):** the `<session>` render, `renderGraphSeed`'s seed migration, the `exchanges/*` tool-result migration, the `formatRelatedNodesResult` (`related`-mode) structural-leak repair + relocation into `renderers/`, and the `brunch print` house-style-vs-status fork. Open prioritization question: keep below the demo line or treat the active branch as a parallel track.
- `exchange-symmetry-audit` — the delete-oriented exchange three-layer audit split out of `exchanges-and-generalized-capture` (its capture vertical is promoted to block 3 as `generalized-capture`). Earned/cleanup, not demo-blocking.
- `role-safe-graph-mutations` — done; the `mutateGraph` grammar that `generalized-capture` relation-bearing writes must target. Listed here only as the dependency the capture block aims at.

### Parallel / Low-conflict

- **Standing cross-cutting obligations (not frontiers):** `probes-and-transcripts-evolution` (transcript-backed probe evidence rides every P0/P1 frontier) and `topology-readmes-and-boundaries` (README/import-boundary upkeep rides whatever frontier moves files) — tracked in the Dependencies `parallel obligations` block, implemented inside the triggering frontier, never as abstract cleanup.
- `fixture-vs-real-audit` (`ln-induct` candidate, 2026-06-12): three confirmed instances of shapes validated only against hand-built fixtures, each caught only by a live run — Anthropic `tool_use_id` charset, orphan `tool_result` without paired `tool_use`, and the `system`-as-array-of-blocks mirror bug. Audit candidate areas: exchange details schemas vs. real tool events, pi event payload shapes in extensions, provider payload assumptions in introspection/compaction. Lesson partially recorded (provider-legality rule in `src/session/README.md`); the systematic survey is unstarted.
- `subagent-adoption` (split from `core-tools-adoption` 2026-06-19; PR #239 / FE-899) — the Brunch-native execution model is now the sealed in-process SDK child session, not a raw `pi` subprocess. Implemented so far: bundled agent definitions, config, `subagent` registrar, sealed child-session runner, read-only/no-tool allowlists, concurrency/abort/caller-shape hardening, and app-layer dep assembly. Remaining decision: which launch path supplies `subagents` deps to `createBrunchPiExtensions(...)`; until then the tool is absent/default-off in ordinary startup.
- `elicitation-gap-guidance` (noted 2026-06-12; the gap-register-source-of-truth split and the seeded-floor design both landed via `prompt-skill-consolidation`/D85-L and the D82-L situating gap): remaining open question is a **gap-analysis skill** — how to analyze the existing graph for what-next / new elicitation gaps (generative discovery from graph shape, distinct from `read_elicitation_gaps` ranking of already-registered gaps).
- `graph-model-doc-retirement` (named 2026-06-17 sync): decompose and **retire `docs/design/GRAPH_MODEL.md`** — move its taxonomy tables to code/READMEs, its invariants into SPEC, its prompting guidance to a real home, and re-point the ~15 SPEC citations — then delete the doc. Folds in **`graph--edge-impact-remodel`** (prepared card `memory/cards/graph--edge-impact-remodel.md`): replace `EDGE_CATEGORY_METADATA.impactOnSourceChange`/`impactOnTargetChange` with declared `affected` + `impactKind` (+ `stanceRequired`), making `edgeImpact()` a thin accessor — same `graph/schema` + `policy` area, so land the per-category table change with the doc retirement. Follow-on of the **done** `kind-metadata-drift` reconciliation (bands fixed to the doc, taxonomy banner added — card retired this sync); do **after** the renders land.

### Horizon

- `web-driver-streaming` ([FE-873](https://linear.app/hash/issue/FE-873/web-as-driver-streaming-chat-transport-topology-a)) — Web-as-driver streaming chat transport (**topology A confirmed**, 2026-06-15). Post-alpha, **spike-first**, not a demo/alpha blocker. Consolidates R12 first-class subscriptions, reconnect/resume, the read-only→driver web staging, the deferred `--mode web`, and the agent-as-user substrate split. Full definition in Frontier Definitions.
- `coherence-first-class` — M8; bounded coherence verdicts backed by reconciliation needs.
- `compaction-and-conflict-widening` — M9; long-horizon continuity through compaction.
- `subagents-for-proposal-diversity` — optional proposal-quality enhancement; never a POC blocker.
- `oracle-design-plan-graphs` — lift oracle/design/plan planes from stubs after the POC delivery spine works.
- `flue-pattern-adoption` — post-POC harness-pattern adoption.
- `framework-direction-stubs` — discretionary structural stubs only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

## Frontier Definitions

### poc-live-ship-gate

- **Name:** POC live ship gate and runbook oracle
- **Linear:** [FE-811](https://linear.app/hash/issue/FE-811/poc-live-ship-gate-and-runbook-oracle)
- **Branch:** `ln/fe-811-poc-live-ship-blockers`
- **Kind:** hardening / release gate
- **Status:** active — **demo block 4** of the lower line (stacks on `generalized-capture`)
- **Certainty:** proving
- **Lights up:** fresh-cwd composed product path across TUI, web observer, runtime posture, structured exchange, and graph write surfaces.
- **Stabilizes:** harness-as-false-proof guard for I22-L, I35-L, I38-L, I39-L, I40-L.
- **Objective:** Create and pass the final POC runbook that exercises the real entrypoints together: fresh cwd, multi-spec selection, TUI session, web observer, runtime switch, structured exchange, capture/commit, graph update, and probe artifacts.
- **Why now / unlocks:** This is the harness-as-false-proof guard. If a test path had to inject modules the product never wires, the POC is not shipped.
- **Demo cut (2026-06-11):** this is **demo block 4** of the lower line, and is now scoped as a **ship-correctness** gate (does the real product compose) distinct from the `demo-polish` top line (does it look like a product). The runbook acceptance list below is the **closed coverage ledger**: every `●` step must launch a public entrypoint and emit a durable artifact, with **no hand-wired step**. Open with a practical-testing + analysis + `ln-grill` prelude to find the thinnest runbook before `ln-scope`.
- **Acceptance:**
  - **Public entrypoints only:** the gate launches via `runBrunchCli` / `bin/brunch.js` (subprocess preferred) and **imports no private wiring** (`createRpcHandlers`, `createWorkspaceSessionCoordinator`, `createBrunchAgentSessionRuntimeFactory`). A mechanical **anti-cheat guard** fails the gate if those modules are imported. *(This is the load-bearing new row — no existing probe launches via the product entrypoint today.)*
  - Fresh cwd launches Brunch, creates or resumes an explicit spec/session, and does not implicitly resume stale transcripts.
  - A second spec can exist in the same workspace; the runbook confirms the active session/graph target is the selected spec.
  - Web attaches as read-only observer over WebSocket RPC and shows the selected spec graph (real product render path, not fixture-rendered strings).
  - Runtime strategy/lens/goal state is switchable/inspectable and changes composed prompt/resource posture, surfaced through a **named posture observable** (`session.runtimeState` RPC and/or `.brunch/debug/system-prompt.md`) captured as evidence.
  - The elicitation-rich demo path composes: the session opens with **seeded context and a gap-grounded question** (demo block 2), the agent asks the next-best question and **gaps update from answers** (writeback affordance from demo block 1, reflection behavior from demo block 3) and **high-confidence generalized capture** (demo block 3) commits directly-stated facts to graph truth through `CommandExecutor`; web updates.
  - Probe/runbook artifacts record transcript, graph summary, report/friction, accepted gaps, and the posture-observable capture.
- **Verification:** Middle/Outer — executable where practical (subprocess + RPC/projection readback), manual where TUI/browser interaction is unavoidable. Pair every visual assertion with a durable artifact or projection query. The anti-cheat import guard is an inner-loop test.
- **Topology materialization:** Runbook/probe code lives in `src/probes/` and `.fixtures/runs/`; it must launch product entrypoints rather than import private modules to fake the product path.
- **Cross-cutting obligations:** Keep the gate small and real. Do not turn it into a generic e2e framework or use it to backfill unrelated polish.
- **Traceability:** R4, R7, R10, R11, R12, R16, R19, R24, R28 / D5-L, D11-L, D19-L, D21-L, D33-L, D36-L, D52-L, D61-L, D62-L, D63-L, D64-L / I22-L, I32-L, I35-L, I38-L, I39-L, I40-L / A5-L.
- **Design docs:** `docs/architecture/probes-and-transcripts.md`; `docs/architecture/pi-ui-extension-patterns.md`; `memory/SPEC.md` verification stance.
- **Current execution pointer:** FE-811 ship-gate hardening landed on `ln/fe-811-ship-gate-residue-and-mentions`: stale graph-snapshot/report residue in the committed fixture-curation and project-graph-review-cycle runs was regenerated to the graph-overview/workspace.state contract, the related-edge formatter now labels non-anchor edges `lateral`, and the live mention autocomplete slice now sources selected-spec graph nodes instead of fixture candidates. The remaining frontier work is the final fresh-cwd runbook gate.

### demo-polish

- **Name:** Demo readout + refinement grab-bag (web observer + TUI polish)
- **Linear:** [FE-858](https://linear.app/hash/issue/FE-858/client-side-poc-prep) "Client-side POC prep" (PR #209)
- **Branch:** `ln/fe-858-above-the-line`
- **Kind:** hardening / presentation
- **Status:** active — top line; second simultaneous worktree, stacks on the lower line and is restacked frequently
- **Certainty:** earned (presentation over a settled contract; closes legibility gaps, not unknowns)
- **Demo cut (2026-06-11):** the **demo-credibility** half of the cut, kept distinct from the `poc-live-ship-gate` ship-correctness gate. A deliberately loose catch-all for superficial things noticed while manually testing the lower line — it should stay shallow and never block the lower line.
- **Objective:** Make the demo legible to a live viewer: `src/web` observer panels (runtime-posture readout, graph-LSN "updated" pulse, selected spec/session display, node counts / overview clarity) plus superficial TUI refinements caught during testing. Optionally a *targeted* renderer-quality pass on only the surfaces the demo shows (distinct from the deferred `renderer-golden-coverage` frontier).
- **Boundary:** In — `src/web/**` (+ web tests), small presentational TUI tweaks under `src/.pi/components` / `src/app/brunch-tui.ts` that do not change wiring. Out — backend domain logic, new RPC methods/fields (push those **down** into the lower line and restack), SQLite/JSONL direct reads, client-local truth, write paths on the read-only sidecar, and the full renderer golden-coverage frontier.
- **Why now / unlocks:** Lets the user absorb presentation friction (web + TUI chrome) in a separate branch without disturbing the substantial lower line; the web client's compile-time RPC type/metadata dependency makes any contract drift break the web build loudly, and TUI chrome edits stay on the presentation side of the wiring seam.
- **Acceptance:**
  - The web observer legibly shows: selected spec/session, runtime posture, and a visible "graph updated" signal when the lower line writes graph truth.
  - No new RPC surface is invented here; any contract need is pushed down to the lower line first.
  - TUI refinements are presentational only (no runtime/wiring change).
- **Verification:** web component tests + manual walkthrough against a seeded workbench; pair visual claims with the lower line's durable artifacts where possible.
- **Cross-cutting obligations:** Consume the public RPC/WS contract only (D52-L web boundary; `src/web` stays Drizzle-free per I44-L); do not read persistence directly or add fallbacks.
- **Traceability:** D52-L, D62-L, I44-L.
- **Design docs:** `src/web/README.md`; `src/rpc/README.md`.
- **Grab-bag backlog (noticed in manual testing, 2026-06-12):**
  - **Kick pending-action indicator:** on a new session the automated kick shows no in-flight indicator, so the TUI looks stuck until the assistant's opening arrives. Presentation of an existing lower-line signal if one suffices; if a new runtime observable is needed, push it down first. (The *resume*-kick sometimes not firing at all is a lower-line defect — see `origination-follow-ups` (c).)
  - **Keyboard-shortcut lookup overlay:** a Brunch chrome overlay listing the active shortcuts.
  - **Spec picker scrollability:** the spec menu has no scrolling when the spec list outgrows the viewport.
  - **Runtime axis toggle dismissal/UX:** the toggles dismiss with `q` but not `esc` — add `esc`. Ideal TUX: repeated presses of the invoking shortcut cycle through the values; note dismiss-on-key-*release* is generally not expressible in terminals (no keyup outside the kitty protocol), so the realistic shape is cycle-on-repeat plus settle-timeout or explicit dismiss.
- **Current execution pointer (2026-06-12 burst on `ln/fe-858-above-the-line`):** landed — package identity (`@hashintel/brunch`, bin renamed `brunch-cli` → `brunch`, `1.0.0-alpha` release line, `dist/build-info.json` via `scripts/write-build-info.mjs`); web sidecar browser launch made opt-in (`--open-web`); TUI chrome remodel (header/footer, single-line picker options, runtime axis pickers rendered in place of the input editor, disabled-choice support, `/brunch:mode` re-enabled with planned modes disabled via `PLANNED_OPERATIONAL_MODE_IDS`, `ctrl+shift+b` switch shortcut); capability-readiness picker gating softened to advisory caution styling with a new `pinnableAxisOptionsForRuntimeState` pin surface (D74-L-consistent: pins stay legible, AUTO exclusion applies only to the manifest view); web sidecar follows TUI spec switches (`follow-workspace-spec.ts` + SPEC capability-req-12 corollary); legacy seeded elicitation-gap floor repair on workspace open (`workspace-store.ts` through `CommandExecutor`). **Boundary note:** the gap-floor repair, pin-surface projection change, and package identity are wiring-adjacent (lower-line-shaped) but landed on this top-line branch — account for this at restack/tie-off rather than assuming the top line is presentation-only.

### renderer-golden-coverage

- **Name:** Adopt the D83-L context-render house style and lock the scope-clustered renders (RENDER stage)
- **Linear:** [FE-870](https://linear.app/hash/issue/FE-870) — renderer golden / context tools
- **Branch:** `ln/fe-870-renderer-golden-context-tools`
- **Kind:** coverage + build (house-style adoption) / hardening
- **Status:** active on `ln/fe-870-...`. **Reshaped 2026-06-16 by D83-L**: no longer "lock the existing flat-bullet renderers" but "rewrite the LLM-facing context renders into the house style (md-pen + TOON + stringify-tree), `<workspace>` + `<specification>` first, then migrate the rest, locking goldens as we go." Fitness evidence, **never a ship gate**; not a demo blocker (priority still below the demo lane, but actively worked on its own branch). **Progress (2026-06-17 sync):** substrate + `<workspace>` + `<specification>` + the graph-render migration (overview G-D, neighborhood G-C, `<specification>` graph block, dead-renderer retirement) are landed and their scope cards retired; the `<session>` render, `renderGraphSeed` seed migration, `exchanges/*` migration, the `formatRelatedNodesResult` leak repair, and the `brunch print` fork remain.
- **Certainty:** proving — the first two scope renders (`<workspace>`, `<specification>`) prove the house style actually reads well for our data before the rest migrate.
- **Pipeline position:** RENDER — the lossy stage consuming PROJECT outputs; upstream of `prompt-composition-golden-coverage` (composed prompts embed rendered context).
- **House-style dialect (D83-L):** LLM-facing agent context = a markdown frame (**md-pen**, the `renderers/markdown.ts` wrapper seam) + uniform record sets as **TOON** (`@toon-format/toon`, the `renderers/toon.ts` wrapper seam) + file hierarchy as a fenced `tree` block (**stringify-tree** over `workspace/cwd-inventory.ts`, never the system `tree` binary) + XML-style `<section>` wrappers. Format follows reader legibility, not internal shape (prose where structure misleads). Agent context clusters into `<workspace>` (project / documents / spec-roster, no sessions), `<specification>` (spec header / graph / ranked gaps / sessions), `<session>` (runtime posture / mentions / transcript) — mirroring `workspace → spec → session` (D19-L). Distinct from the `workspace.state` print product-state projection (D60-L), which shares the md-pen substrate but not the clustering.
- **Landed substrate (2026-06-16):** the preview/golden test apparatus was de-scaffolded to stock Vitest `toMatchFileSnapshot` in co-located `__tests__/` with no custom helper, `test:prompts*` scripts repointed (commit `70f0da81`); `src/renderers/README.md` carries the renderer/tool/entry-copy ledger (former Card 1, done 2026-06-15); D83-L (the house style) is committed (`0b210df1`); the substrate deps/wrappers now exist (`md-pen`, `@toon-format/toon`, `stringify-tree`, plus `markdown.ts` / `toon.ts` / `tree.ts` / `section.ts`) with unit tests and unchanged graph renderer goldens. Node-kind metadata drift is reconciled: `NODE_KIND_METADATA` now owns the merged code-label + D64-L band truth, GRAPH_MODEL's duplicate taxonomy copy is bannered as superseded, and the band-dependent graph-render sort is unblocked.
- **Boundary:** In — the LLM-facing context renders restructured into `<workspace>` / `<specification>` / `<session>` scope renders, the tool-result renders (`graph/*`, `exchanges/*`) migrated onto the shared substrate, and the substrate seams themselves (`renderers/markdown.ts` → md-pen, `renderers/toon.ts` → `@toon-format/toon`, a new `renderers/tree.ts` → stringify-tree, a `<section>` wrapper helper). Out — the `workspace.state` print product-state render (shares the md-pen substrate but stays a terse status register, not agent context; its house-style-vs-status fork is an open question below), trivial JSON serializers (`○`), non-renderer projection DTOs, intentional topology stubs not yet owning a renderer (e.g. `present-candidates`), and any new renderer introduced merely for symmetry.
- **Agent-tool render anchor (2026-06-12 user direction):** this frontier connects intimately to a careful review and shaping of the **agent tools** — what each tool renders into the agent's context (toolResult content; the RENDER-stage LLM-facing surface) **and what it renders in the TUI** (the presenter-side display of the same call/result). The TUI aspect is a **necessary focus**, previously uncaptured: the ledger walk (Card 1) enumerates per tool both render targets, even though the lock mechanism for TUI presentation (component test vs golden vs review-only) is decided per row and any wiring change still pushes down per the worktree rule. The tool catalog the walk is anchored on: **graph** (`extensions/graph`): `read_graph` (overview · list-by-kind · list-by-readiness-band · related-to-anchor neighborhood · `hasEdge`/`lacksEdge` absence filters; the `gaps` topology mode retired in demo block 1) and `mutate_graph` (the one authored write: atomic create/patch/delete nodes + role-named edges, one LSN). **Elicitation-gaps register** (`extensions/elicitation`): `read_elicitation_gaps` (ranked agenda) and `update_elicitation_gaps` (spawn + disposition; no live conduct callers until FE-861). **Agent context** (`extensions/context`): `read_workspace_context` (cwd inventory / workspace overview) and `read_session_context`. **Structured-exchange family** (UI tools, not data): `present_question`, `present_options`, `present_review_set`, `request_answer`, `request_choice`, `request_choices`, `request_review`, plus `present_candidates` as a registered named stub. **Base file floor:** `read`, `grep`, `find`, `ls` (`bash`/`edit`/`write` blocked in elicit mode). **Dev-only** (`BRUNCH_DEV`-gated): `brunch_session_query`, `brunch_introspect_query`. The ledger walk also covers **entry-copy surfaces** (2026-06-12 `ln-induct`): provider-visible strings composed outside `renderers/`/compose — `kickTurnMessage` (`originate-assistant-turn.ts`), mention-staleness hints (`mention-ledger.ts`), session lifecycle notices (`.pi/extensions/session/lifecycle.ts`), compaction copy (`.pi/extensions/compaction/index.ts`), and the seed framing in `context-seed.ts` — which carry the same drift exposure as tool renders (the kick copy drifted exactly this way when D78-L revised: the module's comments were swept, the LLM-visible string was not).
- **Aggregate DoD:** Every `●` durable LLM-facing context render is **built in the house style** and locked (stock `toMatchFileSnapshot` + ≥1 semantic invariant); tool-result renders sit on the shared md-pen substrate; `src/renderers/README.md` marks each `●` row covered in the house style.
- **Dependencies (new, D83-L):** `md-pen` (zero-dependency markdown), `@toon-format/toon` (compact LLM-input data), `stringify-tree` (ASCII tree; `@gulujs/archy` is the equivalent alternative) — each retires owned format-generation code; the `markdown.ts` / `toon.ts` stubs already name md-pen / TOON, so net owned surface decreases (justifies them under the `sourcing: strip-or-build` posture).
- **Inventory authority:** the closed ledger lives in `src/renderers/README.md`; golden artifacts co-locate with the renderer test (`src/renderers/<domain>/__previews__/<fixture>.md`), not under `.fixtures/`.
- **Why now / unlocks:** D83-L settled the house style; the renders must now adopt it so the LLM-facing context is consistent, token-efficient (TOON), and drift-protected. Landing `<workspace>` + `<specification>` first proves the dialect reads well; the rest migrate incrementally.
- **Sequencing:** unblocked — `projection-shape-coverage` (the upstream DTO shapes) is done, and the substrate + ledger have landed (see Landed substrate). Now actively worked on `ln/fe-870-...`. Renderer text quality is **fitness evidence**, so it stays **never a ship gate** and does not block `poc-live-ship-gate`; the open question is only whether it runs below or parallel to the demo lane.
- **Human-in-the-loop:** per-render design checkpoint = user eyeballs the generated house-style golden and approves shape/wording before lock (see Context §design→lock rhythm).
- **Acceptance:**
  - **Substrate:** `renderers/markdown.ts` wraps md-pen; `renderers/toon.ts` wraps `@toon-format/toon`; a new `renderers/tree.ts` wraps stringify-tree fed by `workspace/cwd-inventory.ts`; a `<section>` wrapper helper exists. Hand-rolled markdown string concatenation is retired from migrated renderers.
  - **`<workspace>`** context render (project identity + documents tree + spec roster; **no sessions**) is built and golden-locked; the old flat-bullet `workspace-context` cwd-inventory shape is retired.
  - **`<specification>`** context render is built and golden-locked as **Overview** (spec id/title + graph size + soft readiness, md bullets) · **Sessions** (per-spec, md table — small bounded roster per the D83-L size-aware rule; columns name/file/turns) · **Gaps** (ranked `read_elicitation_gaps` as TOON, sorted band-then-priority). The **graph overview is now embedded** (Card 2: `<specification>` renders the shared G-D overview in `Overview → Graph → Gaps → Sessions` order); the per-turn seed's `renderGraphSeed` still delivers full topology to the agent independently, and the older origination `brunch.context_seed` path still consumes `formatGraphOverview` until the `<session>`/seed re-cluster decides whether to keep or retire that sharing. **`countTurnEntries` is audited** against the current JSONL entry model — both its filter and its messages-vs-turns semantics — before the count is surfaced. The `name` column renders `—` for now. Note (2026-06-16 refactor): `latestSessionName(entries)` in `canonical-session-files.ts` **already extracts an existing session name** when one is present — wiring it into the column is a small behavior-change follow-up (moves the golden off `—`), distinct from **session auto-naming** (auto-*generating* names, the named adjacent capability not built here). When either lands, this render is revised to populate `name` and its golden re-locked.
  - **`<session>`** context render migrates runtime-frame + mentions + world-update + transcript onto the house style; goldens re-locked.
  - **Tool-result renders** migrate onto the md-pen substrate; goldens re-locked; the legibility rule (neighborhood projects relations to prose, no structural leak) preserved. **Graph renders — DONE (Cards 0–3, scope card retired):** dead `formatGraphSlice` + variants retired (Card 0); `formatGraphOverview` → **G-D** dual markdown tables (plane·band node sections + impact-normalized edge table; codes primary, integer ids secondary — Card 1); `<specification>` embeds that shared overview (Card 2); `formatNeighborhood` → **G-C** prose (anchor + upstream/downstream/lateral, per-section compact density via `maxExpandedEdges`, `{hard}`-only strength, deeper-hop codes line — Card 3). Uniform sets (gaps etc.) stay TOON. **Remaining:** (a) `exchanges/*` migrate onto the substrate; (b) **`formatRelatedNodesResult` (the `read_graph` `related` mode, `src/.pi/extensions/graph/command-adapter.ts`) still emits structural leaks** — `SRC -[category/direction]-> TGT` arrows, raw `#id`, `plane/kind`, raw categories — **and lives in the extension adapter, not `renderers/`**; migrate it onto the same prose vocabulary (`relationFromAnchor` + `edgeLabel`) and relocate it into `renderers/` per D52-L (surfaced in the Card 3 design pass; it violates the same no-structural-leak invariant the neighborhood render enforces); (c) `renderGraphSeed`'s migration belongs with the `<session>`/seed re-cluster.
  - **`brunch print` fork resolved:** decide whether print renders the house-style human views or keeps the terse `workspace.state` status dump.
  - `src/renderers/README.md` ledger marks every `●` row covered in the house style; `○` stubs stay explicit. No new renderer is introduced merely to fill a symmetric cell.
- **Verification:** stock vitest `toMatchFileSnapshot` co-located in `__tests__/`; semantic invariants per render (TOON parse-shape / round-trip where applicable; no-structural-leak for neighborhood; scope-clustering — `<workspace>` carries no sessions). Route through `ln-oracles` for the TOON/tree determinism + scope-clustering invariants before building.
- **Cross-cutting obligations:** Goldens co-locate with renderer tests (not `.fixtures/`); keep `renderers/` free of adapter/transport imports (D52-L); preserve the human eyeball before lock; leave intentional topology stubs (`present-candidates`) alone until they own a real renderer; do not regrow deleted renderers for symmetry.
- **Traceability:** D19-L, D52-L, D60-L, D62-L, D83-L.
- **Design docs:** `src/renderers/README.md`; `memory/SPEC.md` §D83-L.
- **Current execution pointer:** Substrate, `<workspace>`, and `<specification>` are done (the house-style-chain scope card was retired). Follow-on repair closed the local A1–A7 renderer findings: readiness rendering now lives in `renderers/session/readiness-estimate.ts`, `<specification>` computes soft readiness over the full gap register while rendering only the ask-eligible agenda, selected-spec binding resolution is shared across context tools, the renderers ledger no longer points at deleted cards, and the `countTurnEntries` audit is closed by reusing the canonical session-file inspection. Graph-render migration is complete (scope card retired): Card 0 retired dead `formatGraphSlice` variants, Card 1 migrated `formatGraphOverview` to G-D, Card 2 embedded that shared overview in `<specification>`, and Card 3 migrated `formatNeighborhood` to G-C prose. **Remaining for a fresh `ln-scope` pass:** the `<session>` render, `renderGraphSeed`'s seed migration, the `exchanges/*` migration, the `formatRelatedNodesResult` (`related`-mode) structural-leak repair + relocation into `renderers/`, and the `brunch print` fork.

### generalized-capture

> **Split from `exchanges-and-generalized-capture` (2026-06-11 demo cut).** Promoted to its own frontier (objective 1 of the former combined item) because the demo claim needs natural-ish capture; the delete-oriented audit half is now the separate `exchange-symmetry-audit` frontier below.

- **Name:** Generalized capture (narrow high-confidence extractive) + false-commit guard
- **Linear:** FE-861 (created 2026-06-12; demo block 3, rides the shared lower-line branch)
- **Kind:** bounded feature
- **Status:** done — **demo block 3** of the lower line
- **Certainty:** proving
- **Demo cut (revised 2026-06-12):** the immediate demo (2026-06-12) shows startup + interface only — no capture mode is in it; all acquisition modes are **post-demo immediate** work. The `ln-grill` prelude ran 2026-06-12 (architecture settled as D80-L/D81-L/D82-L); the practical-testing prelude was deliberately skipped on spike + A14-L evidence. Completeness obligation = the **false-commit scenario matrix**, re-aimed at the low-confidence line (some implication rows become legitimate implicit commits under the D81-L gradient; expected gap-spawns become assertable outcomes); probe-tier, closed matrix, not a coverage frontier.
- **Unblocked by:** `capture-quality-spike` (2026-06-08) measured fixed free-prose, file/ref-bearing, and implication-heavy scenarios, reached precision 1.0 / recall 1.0 with zero false commits in the sample extraction report, and recommended graduating a narrow generalized-capture feature with an explicit false-commit guard.
- **Objective:** Build the banded capture sweep (D80-L) under the commitment gradient (D81-L) with the acquisition/digest layer (D82-L): elicitor in-turn sync capture over the un-swept transcript tail, confidence-gated commitment (noticings spawn gaps), acquisition modes as skills with digests for bulk material.
- **Why now / unlocks:** The capture-quality spike closed the evidence gate for the capture vertical; natural-ish capture composed with elicitation writeback (block 1) is the post-demo immediate need, proven by the ship gate (block 4).
- **Acceptance:**
  - **Banded capture sweep (D80-L):** one band-ordered in-turn pass over the un-swept tail behind a sweep watermark; capture-then-ask choreography; bulk escalation valve; probe invariant — after any elicitor turn, no conversational content remains behind the watermark.
  - **Commitment gradient (D81-L):** stated → explicit basis; confidently-materialized (incl. implied edges/structure) → implicit basis; low-confidence noticings → never committed, spawned as elicitation gaps (this *is* the inherited capture-reflection writeback: spawn-on-noticing + close-on-answered proven as live conduct).
  - Relation-bearing capture uses the role-named `mutateGraph` grammar from `role-safe-graph-mutations`; do not revive `{category, source, target}` in a capture-local edge dialect.
  - **Acquisition modes (D82-L):** elicit-by-question, ingest-paste, read-referenced-documents, explore-and-characterize as skills; bulk modes interpose a digest; the seeded situating gap routes modes from the opening agenda.
  - **Fossil retirement:** the deterministic labeled-prefix capture core (`graph/capture/structured-response.ts`), its submit-path wiring, and the `capture-response-to-graph` proof are deleted; `src/graph/README.md` capture rows and A22-L evidence trail updated in the same slices.
  - The false-commit scenario matrix is wired as a probe-tier regression guard of the low-confidence line.
- **Verification (oracle design 2026-06-18, lean steer):** Two deterministic capture oracles only — (1) the **commit/spawn/recon routing gate** (false-commit guard) on the faux substrate with fixed gradient-tagged extraction: explicit/implicit commits route via `mutateGraph`, low-confidence noticings never commit and each maps to exactly one existing-or-new gap, contradictions route to one `semantic_conflict` reconciliation need, structural gaps derive `answered`, `manual`-gap close routes through the one `{specId, lsn}`/`change_log` clock, and the closed capture-quality-spike scenario family is re-aimed to D81-L outcomes (`commit_explicit` / `commit_implicit` / `spawn_gap` / `reconciliation_need`) with every scenario class guarded through the real adapters; and (2) the **sweep-watermark property** (after any elicitor turn, no conversational content remains behind the watermark; prior art I45-L). Everything else — confidence-classification accuracy, banded-traversal quality, gap abstract-map/dedup quality, carry-forward/reweight feel, digest quality — is outer-loop **fitness** judged manually + via `.brunch/debug/*`, not gated. CI guards structural legality only at the `CommandExecutor` boundary. Remaining named blind spots: classification/dedup quality and digest quality. Full design in SPEC §Verification Design (capture routing gate row + blind spots).
- **Cross-cutting obligations:** Low-confidence material never becomes graph truth (it becomes agenda); do not regrow deleted `capture-*` topology, observer queues, or product-side extraction passes.
- **Traceability:** D8-L, D18-L, D27-L, D65-L, D66-L, D80-L, D81-L, D82-L; A22-L.
- **Design docs:** `memory/SPEC.md` D80-L/D81-L/D82-L (mechanism/policy/acquisition), D65-L/D66-L; `src/projections/README.md`.
- **Known discovery candidate (2026-06-12): contradiction outlet = reconciliation needs, not gaps.** No `read_reconciliation_needs` / recon-need mutation tool is registered — agent-facing access was never built because the *retrospective* register is designed reviewer-owned (the async reviewer pipeline, still wait-gated). But the substrate exists (`CommandExecutor` recon-need create/resolve on the spec-local LSN, D8-L), and D18-L's capture design explicitly listed concrete reconciliation needs among what post-exchange capture may commit. The banded sweep will hit this for real: when an answer **contradicts existing graph truth**, that is not a gap (a coverage obligation to ask about) — it is a recon need targeting the conflicting node-pair, and today the sweep's only outlet would be a gap-shaped question. A thin `read`/`update` recon-need tool pair (mirroring the `read_elicitation_gaps` / `update_elicitation_gaps` naming) may therefore be an FE-861 discovery; the `ln-oracles`/`ln-scope` prelude decides whether it lands in block 3 or is carded as its own follow-up — do not add it preemptively.
- **Near-future successor (named, not this block):** `subagent-adoption` — exploration/research modes delegated to side/sub-agents with the digest as handback (SPEC Future Direction §Subagent acquisition). Candidate reference flow (2026-06-12): the `flow-shape-liftout` skill shape as a sub-agent flow for deep **codebase-to-spec extraction** (an `explore-and-characterize` acquisition); web fetch/search prerequisite is satisfied by the 2026-06-19 FE-861 core-tools slice.
- **Current execution pointer (2026-06-22):** FE-861 and its immediate prompt-skill successor FE-898 are complete. Landed FE-861 slices: D80-L banded sweep + watermark, D81-L commitment-gradient routing gate, contradiction→`reconciliation_need` outlet, submit-time labeled-prefix fossil retirement, `web_fetch`/`web_search` prerequisite, D82-L acquisition-modes + digest + situating-gap layer, and the false-commit scenario matrix. The closed capture-quality-spike family now uses gradient `expectedOutcome` rows instead of binary `shouldCommit`; every scenario class (free prose, file refs, implication-heavy, contradiction) has deterministic routing coverage through the real `mutate_graph` / `update_elicitation_gaps` / `update_reconciliation_needs` adapters, while the probe remains a fitness scorer over gradient-routing accuracy. FE-898 then moved all prompt-resource skills to Agent Skills `SKILL.md` topology and retired its scope card. Next stack tie-off: submit/update FE-898, then return to the POC ship-gate lane unless the user reprioritizes renderer coverage.

### exchange-symmetry-audit

> **Split from `exchanges-and-generalized-capture` (2026-06-11 demo cut).** The delete-oriented audit half (objective 2 of the former combined item); the capture vertical is now the separate `generalized-capture` frontier above. **Deferred below the demo line** (earned/cleanup, not demo-blocking).

- **Name:** Exchange-surface three-layer symmetry audit (delete-oriented)
- **Linear:** unassigned
- **Kind:** refactor / earned cleanup
- **Status:** deferred — below the demo line (alpha-week or later)
- **Certainty:** earned
- **Context:** The exchange surface is largely built across {`.pi/extensions/exchanges`, `projections/exchanges`, `renderers/exchanges`}, with some breadth deferred / topology-stubbed (e.g. the `present-candidates` candidate-family stub mirrored across all three layers). The open work is **not** breadth closure (so this is **not** a coverage frontier) — it is confirming each mirrored file earns its place and deleting symmetry regrowth.
- **Objective:** Run an **earned symmetry audit** of the already-built exchange three-layer split: confirm each `projections/exchanges` and `renderers/exchanges` file earns its place (genuine multi-consumer reuse or shared semantics), and delete symmetry regrowth where a single-owner read was mirrored into a shared layer "for symmetry."
- **Acceptance:**
  - Each retained `projections/exchanges` / `renderers/exchanges` file has a named multi-consumer or shared-semantics justification; unjustified symmetric mirrors are deleted (delete-as-progress), not documented as "covered."
  - Single-owner reads or orchestration state stay in their owning domains; `renderers/exchanges` stays durable markdown/text/toon only.
- **Verification:** The existing topology-boundary test plus a per-file justification check.
- **Cross-cutting obligations:** Keep `renderers/exchanges` for durable markdown/text/toon only, keep TUI presenters local, and do not reintroduce `snapshot` as an architecture noun.
- **Traceability:** D27-L, D65-L, D66-L.
- **Design docs:** `src/projections/README.md`; `src/renderers/README.md`.

### web-driver-streaming

- **Name:** Web-as-driver streaming chat transport (topology A: in-process AgentSession relay)
- **Linear:** [FE-873](https://linear.app/hash/issue/FE-873/web-as-driver-streaming-chat-transport-topology-a) · **Branch:** `ln/fe-873-web-as-driver`
- **Kind:** capability / transport + verification design
- **Status:** Horizon — transport battery **built** (claims 1–4 observer relay, claim 6 reconnect/resume, claim 7 fan-out, command-intake `session.driveTurn`, claim-5 `request_answer` answer broker), all production-wired through the real TUI sidecar `/rpc`, with `/rpc/driver` the explicit live-driver connection. Post-alpha; not a demo/alpha blocker. Build commits + per-test evidence: Recently Completed (2026-06-17), SPEC §Verification Design streaming battery row, `src/rpc/README.md` §Streaming transport coverage.
- **Certainty:** proving → partially built (D84-L confirmed; relay + stream↔transcript differential + ordered delivery + domain multiplex + reconnect + fan-out + plain-turn driving + live `request_answer` answering all green through the real sidecar; remaining work is consumer/UI + broader `request_*` variants, not the answer-broker uncertainty).
- **Topology A (confirmed 2026-06-15):** relay the in-process `AgentSession` `AgentSessionEvent` stream over the existing Brunch WS, multiplexed with Brunch domain notifications (graph LSN / gap agenda / runtime posture), plus a command-intake path. A′ (TUI-over-RPC) rejected — Pi ships no remote-attach; B (`pi --mode rpc` bridge) is a documented alternative for a future process-isolation need only.
- **Remaining (not built):** non-freeform `request_*` variants (choice/choices/review) + terminal-vs-web answer racing; the React web consumer wired to `session.driveTurn` / `session.answerExchange`; the deferred standalone `--mode web` (topology-A specialization: AgentSession + WS, no terminal head); the agent-as-user substrate split (generative mission engine on the tier-2 substrate vs the public-RPC contract/parity probe).
- **Verification:** Middle — the oracle battery on the tier-2 faux substrate (differential / ordering / multiplex / reconnect / fan-out / command-intake / live answer broker). Outer — manual render-feel walkthrough for the eventual web consumer. Relaxation (2026-06-15): one driver, many observers — no concurrent multi-driver arbiter.
- **Cross-cutting obligations:** keep the bridge thin (reuse Pi `AgentSession`; no reinvented turns/tools/compaction/persistence); the live stream is never a second canonical truth (D19-L); domain-projection multiplexing is the irreducible Brunch responsibility (no raw Pi RPC to the browser); the public client speaks Brunch method names (D5-L); do not regrow a concurrent multi-driver arbiter.
- **Traceability:** R12, R24 / D5-L, D19-L, D37-L, D49-L, D72-L, D84-L / A5-L, A28-L, A29-L / I22-L.
- **Design docs:** `src/rpc/README.md`; `src/web/README.md`; `src/session/README.md`; Pi `docs/rpc.md` + `docs/sdk.md`; `memory/SPEC.md` §Verification Design.

### subagent-adoption

- **Name:** Subagent adoption in Brunch's sealed profile
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** structural / capability
- **Status:** parallel / low-conflict — implementation built on PR #239 / FE-899; startup launch-path gate remains
- **Certainty:** proving
- **Depends on:** D39-L sealed profile (validated enough by FE-744/FE-893), D40-L runtime posture, A19-L sealed-profile assumption
- **Blocked by:** D39-L/D2-L no-ambient-discovery invariant; a child-agent execution strategy that violates the sealed profile must not be adopted
- **Lights up:** a delegated agent path inside Brunch's sealed Pi profile
- **Stabilizes:** the boundary between the product agent session and delegated child work
- **Objective:** Adopt Brunch-owned isolated child-agent delegation without breaking the sealed profile or reintroducing ambient discovery; current code uses sealed in-process SDK child sessions and leaves startup wiring default-off until a launch gate is chosen.
- **Why now / unlocks:** `generalized-capture`'s D82-L successor needs delegated acquisition (`explore-and-characterize` research); the 2026-06-19 survey showed every reference implementation spawns raw `pi` subprocesses, which conflicts with Brunch's sealed model. Resolving this before capture design assumes delegated acquisition prevents a late-stage seal breach.
- **Design context (reference survey):**
  - Canonical pi example (`~/.pi/pi-mono/packages/coding-agent/examples/extensions/subagent`) — rich subprocess model with project/user agent scope, workflow prompts, streaming UI; designed as a user-installed direct-Pi extension.
  - `amosblomqvist/pi-config/extensions/subagents` — thinner single `subagent` tool, explicit agent `.md` configs, still spawns `pi` via `spawn(...)`.
  - `nicobailon/pi-subagent-enhanced` and `nicobailon/pi-subagents` — production-oriented subprocess subagents with async/background, chains, parallel, artifacts, and intercom.
  - `ogulcancelik/pi-spar` — agent-to-agent sparring; also spawns a child `pi` process and uses user config under `~/.pi/agent/spar`.
  - `hjanuschka/shitty-extensions/oracle.ts` and `loop.ts` — SDK-based (`complete()` from `@earendil-works/pi-ai`) single-call second-opinion / loop, but not tool-bearing subagents.
  - **Revised implication (post-sdk.md read):** tool-bearing subagents *are* possible through the SDK via `createAgentSession()` with a custom `ResourceLoader`, explicit `tools`/`customTools`, in-memory `SettingsManager`/`SessionManager`, and explicit system prompt. The reference extensions spawn `pi` because they are direct-Pi user extensions, not because the SDK lacks the capability. The Brunch-native path is therefore an SDK-based child session with a *sealed* ResourceLoader, not a subprocess.
  - **Execution-model boundary:** SDK in-process with sealed ResourceLoader / explicit tool manifest is the POC implementation. Raw `pi --mode rpc/json` subprocesses are ruled out by D39-L because they depend on a globally-installed `pi` and ambient discovery. A Brunch-CLI subprocess with a dedicated `--mode subagent` or equivalent flag remains only a future fallback if process isolation becomes necessary.
- **Acceptance:**
  - Documented decision on the child-agent execution model: SDK-based sealed child sessions are canonical; raw `pi --mode rpc/json` subprocesses are rejected under D39-L, and a Brunch-CLI subprocess remains only a future fallback if stronger process isolation becomes necessary.
  - A single `subagent` registrar exists, backed by SDK `createAgentSessionFromServices()` over explicit settings/resource/model/session/tool deps (no ambient discovery), with static Brunch-owned agent definitions.
  - Runtime legality keeps `subagent` out of the ordinary `elicit` base-allowed set; it is registered/advertised only when a launch path passes subagent deps.
  - Static registration only; no import or discovery from `~/.pi/agent/extensions/` or `.pi/`.
  - Parser/caller/concurrency/lifecycle hardening is covered: duplicate frontmatter keys fail loud, `{tasks, agent, task}` is a usage error before runner invocation, semaphore fairness holds under waiter/new-arrival race, and parent aborts prevent/abort child prompts.
- **Verification:**
  - Inner: `src/.pi/extensions/subagents/subagents.test.ts` covers parser/config/model/tool planning, sealed faux-provider child sessions, invalid caller shape, semaphore fairness, and abort lifecycle; docs reconciliation in SPEC D44-L/I29-L records the SDK model.
  - Middle/Outer: after startup wiring, prove the chosen launch gate registers/advertises `subagent` only when intended and returns without relying on a globally-installed `pi` binary; manual end-to-end if a real LLM call is involved.
- **Topology:** registrar/runner/config/definitions live in `src/.pi/extensions/subagents/`; app-layer dep assembly lives in `src/app/pi-subagents.ts`; opt-in registration path lives in `src/app/pi-extensions.ts` / `createBrunchPiExtensions(...)`; operational policy advertises the tool only when registered through the opt-in channel; topology is recorded in `src/.pi/extensions/README.md`, `src/.pi/extensions/subagents/README.md`, and SPEC D44-L/I29-L.
- **Cross-cutting obligations:** preserve D39-L sealed profile (no ambient discovery); D40-L keeps subagent out of the default `elicit` base-allowed tool set; any subprocess strategy must be executable from the Brunch CLI or packaged artifact, not assume a separate `pi` install; child agents must not accidentally inherit parent session context or bypass the product command layer.
- **Traceability:** D39-L, D40-L, A19-L, D82-L successor note / SPEC Future Direction §Subagent acquisition.
- **Design docs:** `memory/SPEC.md` D39-L/D40-L; `src/.pi/extensions/README.md`.

## Dependencies

```text
nodes:
  poc-live-ship-gate             [next · P1]         final fresh-cwd composed product runbook
  generalized-capture            [done · proving · block 3] banded capture sweep + commitment gradient + acquisition/digest layer (D80-L/D81-L/D82-L); false-commit matrix at probe tier
  demo-polish                    [active · earned · top line · FE-858] client presentation: web readout (src/web/**) + TUI chrome (presentation, not wiring); consumes the lower line's behavior/contract; no product-wiring edits
  renderer-golden-coverage       [deferred · coverage] TRIO stage 2 (#render): below the demo line (alpha); renderer ledger + goldens for durable renderers; never a ship gate
  exchange-symmetry-audit        [deferred · earned] delete-oriented exchange three-layer symmetry audit; below the demo line
  graph-model-doc-retirement     [parallel] retire docs/design/GRAPH_MODEL.md (tables->code/README, invariants->SPEC, re-point ~15 citations) + fold in edge-impact-remodel (affected+impactKind+stanceRequired); after renders land; card memory/cards/graph--edge-impact-remodel.md
  subagent-adoption              [parallel · proving · PR #239] sealed SDK subagent tool built/default-off; launch-path gate remains
  web-driver-streaming             [horizon · proving · observer+command relay built · FE-873] topology A: in-process AgentSession event relay + Brunch-domain multiplex + explicit `/rpc/driver` command-intake/live answer broker; consolidates R12 subscriptions / reconnect-resume / web-as-driver staging / agent-as-user substrate split
  # done anchors still carrying live edges (full definitions: docs/archive/PLAN_HISTORY.md):
  prompt-skill-consolidation     [done · D85-L · #235]
  elicitation-driver             [done · demo block 1]
  context-seed-payload           [done · demo block 2]
  origination-native-elicitation [done · demo block 2¾ · walkthrough passed 2026-06-12]
  role-safe-graph-mutations      [done]
  capture-quality-spike          [done · spike]
  alpha-hardening                [done · FE-897 · 2026-06-19] seed all-seeds flag + disposition catalog, runtime-vocab leaf (D73-L), FE-893 prompt-shape closure
  minimal-authority-shell        [done]
  projection-shape-coverage      [done · coverage]
  prompt-composition-golden-coverage [done · coverage]

edges:
  elicitation-driver        -[hard · demo]->  poc-live-ship-gate   (block 1: self-updating gaps; writeback conduct now rides generalized-capture per D81-L)
  origination-native-elicitation -[hard · demo]-> poc-live-ship-gate (opening beat: content-rich seed → kick → assistant-authored gap-grounded first question, no canned offer)
  generalized-capture       -[hard · demo]->  poc-live-ship-gate   (block 3: banded-sweep capture the ship gate composes)
  role-safe-graph-mutations -[hard]->         generalized-capture  (relation-bearing capture uses the role-named mutateGraph grammar)
  prompt-skill-consolidation -[hard]->        generalized-capture  (the `capture` skill home + two-axis manifest must exist before the D80/81/82 sweep conduct lands)
  capture-quality-spike     -[evidence]->     generalized-capture
  generalized-capture     -[optional]->     subagent-adoption  (delegated acquisition is a post-block-3 successor, not required for the demo/alpha cut)
  minimal-authority-shell   -[hard]->         poc-live-ship-gate
  poc-live-ship-gate        -[contract]->     demo-polish          (top line consumes the lower line: web over RPC/WS + compile-time types/metadata; TUI chrome over the presentation/wiring seam)
  projection-shape-coverage -[hard]->         renderer-golden-coverage     (lock DTO shape before renderer goldens)
  renderer-golden-coverage  -[tripwire]->     prompt-composition-golden-coverage  (COMPOSE done except the deferred full-stack real-rendered-context golden)

parallel obligations:
  probes-and-transcripts-evolution -[evidence]-> every P0/P1 frontier
  topology-readmes-and-boundaries  -[boundary]-> every frontier that moves/claims source topology
  alpha-hardening (seed residue)   -[data]->     generalized-capture, poc-live-ship-gate (explicit seeded workbenches provide reproducible real graphs for capture/ship-gate evidence)

horizon:
  web-driver-streaming               (topology A observer relay, replay-less reconnect, fan-out, plain command-intake, and live `request_answer` answer broker built; next: non-freeform `request_*` variants, terminal-vs-web answer racing, React web consumer, `--mode web`)
  coherence-first-class
  compaction-and-conflict-widening
  subagents-for-proposal-diversity   (now tracked as `subagent-adoption` for capture delegation; still optional proposal-diversity use post-POC — SPEC Future Direction §Subagent acquisition)
  oracle-design-plan-graphs
  flue-pattern-adoption
  framework-direction-stubs
  geolog-and-petri-execution

notes:
  - The temporary `memory/CROSS_CUT_PLAN.md` capability ledger is retired (2026-06-12): its last open row — Seam 3a capture-reflection writeback — is designed (D81-L noticings-spawn-gaps + close-on-answered) and owned by `generalized-capture` (FE-861) acceptance. Cross-cut history: docs/archive/PLAN_HISTORY.md.
  - `role-safe-graph-mutations` guardrail: the canonical authored graph command is `mutateGraph` / `mutate_graph`; role-named endpoint fields normalize through `EDGE_CATEGORY_METADATA`. Downstream capture and dev curation must not reintroduce `{category, source, target}` at authored boundaries.
  - `exchanges-and-generalized-capture` was split (2026-06-11 demo cut) into `generalized-capture` (now the D80-L/D81-L/D82-L banded-sweep frontier) and `exchange-symmetry-audit` (deferred delete-oriented cleanup — do not regrow deleted `capture-*` symmetry; `present-candidates` stays topology-stubbed).
  - **Context-pipeline coverage trio.** PULL → PROJECT → RENDER → COMPOSE (D60-L). Stages 1 (#project) and 3 (#compose) are done (ledgers in `src/projections/README.md` + `src/session/README.md`; goldens in `src/.pi/extensions/system-prompts/__previews__/`); stage 2 `renderer-golden-coverage` (#render) is the only open coverage frontier (substrate + `<workspace>` + `<specification>` + graph-render migration landed; `<session>` / `renderGraphSeed` / `exchanges/*` / the `related`-mode leak repair remain), deferred below the demo line; its scope cards are retired.
  - `topology-readmes-and-boundaries` is not a license for abstract cleanup; it rides with concrete delivery seams.
  - Tripwire (origination, from the retired `origination-kick-live` definition): a foreign/user `label` entry at the transcript tail is not in the continuity-only set and reads as a non-debt leaf in `latestTailOwesAssistant` — harden only if `/tree` labeling becomes a real Brunch flow.
  - Multi-spec workspace discipline applies throughout: target the selected/current spec explicitly; no workspace-global graph truth in the POC.
  - `web-driver-streaming` (2026-06-15) consolidates the web-as-driver / streaming / subscriptions intentions into one Horizon frontier with **topology A confirmed** (in-process `AgentSession` event relay + Brunch-domain multiplex + web command-intake). A′ rejected (Pi has no TUI-over-RPC), B documented alternative. Its oracle battery (stream↔transcript differential + multiplex + exchange-convergence + reconnect + fan-out) runs on the tier-2 faux substrate; render feel stays outer-loop manual. The generative agent-as-user mission/fixture engine moves to the tier-2 substrate; the public-RPC contract/parity probe stays the RPC agent-as-user driver. Relaxation: no concurrent multi-driver (one driver, many observers).
```
