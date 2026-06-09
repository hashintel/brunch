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

Planning is currently carrying two shapes at once: canonical frontier sequencing in this file, and a temporary elicitor capability ledger in `memory/CROSS_CUT_PLAN.md`. The authority split must stay hard: `PLAN.md` owns frontier ids, ordering, and dependency judgments; `CROSS_CUT_PLAN.md` only inventories the temporary READ/WRITE/KNOW row surface. The current planning move is therefore to promote any cross-cut row that has escaped row-sized work back into a real frontier. `elicitation-backlog` (the D65-L *substrate*) was the first such promotion and is landed; the prompt-resource body-depth pass is also built (1ca02e38). **The cross-cut is not yet exhausted:** its Seam 3a `"what to ask next" driver` row is still `partial · ●`, and the seam DoD holds a seam open while any `●` row is `partial`. That row — the *live per-turn elicitation-backlog driver* (read open entries → rank → select next question; capture-reflection grows/closes entries) — is a required elicitor capability that has escaped row-sized work, so per the cross-cut's own rule it is promoted here as the `elicitation-driver` frontier. It is buildable now (the FE-823 read-back exists) and is **not** POC-ship-critical (the POC delivery cut de-scopes elicitation quality). It is itself a bounded feature, not a coverage frontier; as the cross-cut's promoted closing row it sequences ahead of fresh coverage breadth, but it is not a ship-gate blocker.

The `graph-observed-shapes` coverage frontier has now landed (the consumer-specific read-shape inventory is ratified in `src/graph/README.md` and guarded by a drift test). With `minimal-authority-shell` also done, the active delivery path is `poc-live-ship-gate` (now unblocked).

The remaining coverage frontiers are being deliberately de-fogged rather than left parked, because "wait for a forcing function" can hide capability layers we simply never built. Each is reclassified: `runtime-affordances-and-legality` is mostly **buildable-now** — its core is one Brunch-owned `affordances(resolvedState)` derivation over legality/default tables that already exist, so it is being re-inventoried as a coverage ledger (only its `active-review-set` / `turn-mode` rows are genuinely product-state-gated and stay tripwired). `exchanges-and-generalized-capture` is **evidence-gated**: the exchange topology is enumerable now, but capture quality beyond directly-labeled facts (A22-L) needs a measurement, so it is being attacked with a capture-quality spike rather than awaited. The `elicitation-driver` frontier (promoted above) is likewise buildable now.

**Coverage-layer re-classification (2026-06-08 ln-plan, applying the hardened coverage protocol).** Re-asking "where are the *real* coverage frontiers" gives a tight answer: the coverage layer is mostly already closed. `graph-observed-shapes` and `runtime-affordances-and-legality` are both done genuine coverage. `exchanges-and-generalized-capture` **fails the coverage admission gate** — the remaining load-bearing unknown is capture *semantics* (a vertical proving slice with false-commit protection), not breadth closure; the exchange surface is largely built, with some breadth still explicitly deferred / topology-stubbed (e.g. `present-candidates` across all three layers), so it is reclassified to a bounded proving feature plus a delete-oriented symmetry audit, not a breadth fill. The genuinely-open coverage is **one pipeline, not scattered locking chores** — see the next subsection. The remaining open stages are `projection-shape-coverage`, `renderer-golden-coverage`, and `prompt-composition-golden-coverage`, and per the 2026-06-08 deep per-plane pass (below) they are now the **near-term spine**, sequenced in dependency order, each completing its **full ledger** with a human-in-the-loop design→lock rhythm. This revises the earlier "parallel/discretionary, never preempt `elicitation-driver`" disposition: the user has elevated the pipeline-coverage trio to the next 2–3 frontiers. `elicitation-driver` and `exchanges-and-generalized-capture` remain bounded features sequenced after the trio (`elicitation-driver` pairs naturally with the COMPOSE stage, which locks the oracle its behavior rides on); `poc-live-ship-gate` remains the in-flight delivery gate, proceeding independently on the FE-811 branch.

A new graph-mutation planning result has been promoted into the rolling plan as `role-safe-graph-mutations`. It folds the prior role-named edge-surface scope and semantic seed-curation mutation scope into one initiative: `mutateGraph` / `mutate_graph` becomes the canonical authored graph-mutation grammar, create-edge ops use role-named endpoint fields, and exposed `commitGraph` / `commit_graph` is retired by break-and-repair rather than preserved as a weaker parallel API. This frontier is orthogonal to the context-pipeline coverage trio, but it is load-bearing for any future relation capture from unstructured data and for dev fixture curation; downstream capture/curation work must aim at `mutateGraph`, not recreate `{category, source, target}` at a new boundary.

**Developer experience promoted to a first-class frontier (2026-06-09 ln-plan).** Working over the pi harness has been slow because the only fast path was ad hoc faux wiring scattered across probes; the user has elevated development feedback loops to first-class product DX (SPEC §Development Feedback Loops, D67-L–D69-L, A25-L). Promoted as `dx-feedback-loops`: bump `@earendil-works/pi-*` to latest and add a dev source-alias to the sibling `pi-mono` `src/` checkout (D67-L); consolidate three named loops (faux / real-provider / introspection) behind one `src/dev/` front door with a shared faux-harness factory (D68-L); and add one read-only, dev-gated introspection extension that captures exactly what the model receives, with mechanical and subjective modes sharing one run (D69-L). It is a DX substrate that accelerates every later frontier, so it leads the `Next` track; its version-bump+alias slice is a shared unblocker that should land before other frontiers' pi-facing churn. It is **not** POC-ship-critical and must preserve the D39-L sealed-profile boundary (introspection observes, never shapes product behavior; offline-lift and extension inclusion are dev-gated only). The context-pipeline coverage trio remains the elevated product-coverage spine right after.

### Context-pipeline coverage (the next design/lock spine)

The four LLM-facing context concerns are not independent — they are the stages of **one pipeline** (D60-L): **PULL → PROJECT → RENDER → COMPOSE → surface**. Coverage means *each stage carries its appropriate oracle over a complete, ledgered inventory*. The stages must be closed **in dependency order**, because each downstream lock is only stable once its upstream shape is locked (projection invariants churn while read shapes still move; renderer goldens churn while projection shapes still move; prompt goldens churn while renderer output still moves).

**PULL is not one done stage — it has two halves.** The *graph* read surface is the template and is **done**: ledgered (`src/graph/README.md` observed-read-shape ledger) + drift-guarded (`observed-shapes-coverage.test.ts`). The *session* read surface (`session/workspace-context.ts`, `session/workspace-session-coordinator.ts`, `session/runtime-state.ts`, …) is behaviorally tested but **not yet inventoried as a closed read-shape ledger**. Because the session/workspace projections lock against those session reads, that PULL half must be ledgered before its downstream projection invariants are frozen. (The earlier "Stage 1 PULL is done" claim was graph-only.)

The oracle *kind* differs by stage — this is the load-bearing distinction the flat "lock everything" framing hid:

- **info-preserving stages (PULL, PROJECT)** want **invariant / no-loss / shape** oracles. A golden here is the wrong tool — brittle, and it cannot even catch the failure that matters (a projection silently dropping a field the renderer also hides).
- **lossy stages (RENDER, COMPOSE)** want **golden locks + semantic invariants**, because output wording/shape is itself the contract.

```
context-pipeline/                                          D60-L
├── PULL      graph reads    queries.ts          invariant + drift   ✓ DONE   #pull
│             session reads  session/*           behaviorally tested ◐ un-ledgered
├── PROJECT   @projections  projections/        no-loss / shape     ○ open   #project   -> renderer
├── RENDER    @renderers    renderers/          golden + invariant  ◐ open   #render    -> compose
└── COMPOSE   @pi-agents    compose.ts+skills/  golden + invariant  ◐ open   #compose

dependency:  pull(session) -> #project -> #render -> #compose   (lock upstream before downstream)
```

**Per-frontier deliverable:** the *complete* ledger for that plane (every module given a disposition — `✓` locked / `●` keep+lock / `◐` keep-decide / `✗` delete-inline / `○` leave — with owner + oracle), authored in the plane's README. The PROJECT ledger is now authored in `src/projections/README.md` (it applies an **earns-its-place gate before the oracle gate**: a single-consumer pass-through that only re-wraps its source is indirection to delete, not a row to lock). `renderers/README.md` still claims a ledger that does not yet exist. Not "close the gaps" — close the inventory.

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

- None.

### Next

The near-term spine has two tracks. The **context-pipeline coverage trio** remains the elevated product-coverage spine, sequenced in strict dependency order (lock upstream shape before downstream output). `role-safe-graph-mutations` is a graph-mutation grammar frontier that can run before or alongside the trio, and must land before relation-bearing generalized capture or semantic fixture curation rely on the new mutation surface. The `dx-feedback-loops` DX substrate is complete and no longer gates this list. `dx-introspection-live` is its low-conflict follow-on (wire the dormant introspection extension into the real TUI, harden `.fixtures/` topology + `--cwd`, make introspection conversational); it is DX substrate, parallel to the product trio, and not POC-ship-critical.

1. `projection-shape-coverage` — **PROJECT stage** (`#project`); invariant / no-loss kind. Ledger authored in `src/projections/README.md`. Two sub-steps: (a) **PULL-session prerequisite** — ledger the session read surface (`session/workspace-context`, `workspace-session-coordinator`, `runtime-state`) the session/workspace projections lock against; (b) **earns-its-place audit then lock** — delete/inline the `✗` indirection (`workspace/workspace-context`: single-consumer tag wrapper), resolve the `◐` exchange family (direct-lock vs keep-transitive), and add a shape/no-loss invariant to each `●` survivor (`graph/neighborhood`, `session/transcript-context`, `session/runtime-state`, `workspace/workspace-state`). The graph projection stubs (`overview`, `commit-result`, `reconciliation-needs`) are `export {}` topology stubs, **not** dark implementations — leave them. Upstream of everything else in the trio; do this first so renderer goldens lock against stable shapes.
2. `renderer-golden-coverage` — **RENDER stage** (`#render`); golden + invariant kind. **Depends on `projection-shape-coverage`.** Create the renderer ledger (README claims one that does not exist), extend the preview harness past `graph-neighborhood`, and golden-lock every durable renderer (only `graph/neighborhood` + `session/runtime-frame` are locked; the rest are dark or only transitively covered via the `.pi` adapter).
3. `prompt-composition-golden-coverage` — **COMPOSE stage** (`#compose`); golden + invariant kind. **Depends on `renderer-golden-coverage`.** Add a composed-prompt preview harness, golden-lock partial bodies and a representative composed-prompt matrix (axis × grade × pin) on top of the existing invariants. `elicitation-driver` rides on this stage's locked oracle, so it follows.

### After the trio

6. `elicitation-driver` — **bounded feature; cross-cut closing row** (not itself coverage): closes the last open required cross-cut row (Seam 3a `"what to ask next" driver`) and retires the temporary dual-plan state. Buildable-now on the FE-823 substrate; pairs with the COMPOSE stage (it adds per-turn behavior over the composition oracle locked there); not POC-ship-critical.
7. `exchanges-and-generalized-capture` — **bounded proving feature** (not coverage): the remaining load-bearing unknown is capture *semantics*, not breadth closure. Narrow high-confidence extractive capture with a false-commit guard; treat any exchange-layer cleanup as delete-oriented audit, not breadth fill. Relation-bearing capture must use the role-named `mutateGraph` grammar from `role-safe-graph-mutations`; do not revive `{category, source, target}` in a capture-local edge dialect.

### Delivery gate (in flight, independent)

- `poc-live-ship-gate` — FE-811 delivery gate; only the final fresh-cwd runbook remains (live-mention-autocomplete + ship-gate residue landed 2026-06-08 on `ln/fe-811-ship-gate-residue-and-mentions`, PR #179). Proceeds on its own branch; not a coverage frontier and does not compete with the trio for design attention.

### Parallel / Low-conflict

- `probes-and-transcripts-evolution` — continuous probe/report/transcript hardening as each delivery frontier lands evidence.
- `topology-readmes-and-boundaries` — small doc/test hardening when a frontier moves files or exposes a boundary; should remain attached to the frontier when possible rather than becoming an abstract cleanup project.
- `dev-seed-fixtures` — rich, real seed data for local dev / manual / observer testing: the consolidated seed contract, the `npm run seed` loader, and growing/enhancing fixture sets (Bilal-port + legacy). Its semantic curation mutation slice is folded into / blocked by `role-safe-graph-mutations`; ongoing seed-data maintenance remains low-conflict.
- `dx-introspection-live` — DX follow-on to `dx-feedback-loops`: harden the four-role `.fixtures/` topology + `--cwd` launch (D70-L), unify dev gating under `BRUNCH_DEV` and wire the dormant introspection extension into the real TUI (D71-L), and make introspection conversational (A26-L). Three sequenced slices; ready for a scoping thread. Low-conflict with the product trio; touches `.fixtures/`, `src/app/`, `src/dev/`, `src/.pi/extensions/introspection/`.

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
- **Status:** done
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
- **Topology materialization:** Review payload schemas live under `.pi/extensions/exchanges` as the current structured-exchange schema seam; reusable review payload construction/rendering lives under `projections/exchanges/` and `renderers/exchanges/`; proposal validation/translation lives in `graph/` review modules; agent strategy resource lives in `.pi/skills/strategies/project-graph.md`; web observes via RPC projections.
- **Cross-cutting obligations:** Preserve D27-L: review-set proposal is a structured-exchange payload, not a standalone public review-set entity. Reviewer advisory writes remain deferred unless explicitly scoped. Existing-node references and review payloads use projected graph codes at adapter/UI boundaries, not raw DB ids.
- **Traceability:** R21, R23 / D4-L, D20-L, D26-L, D27-L, D51-L, D53-L, D62-L, D63-L / I11-L, I15-L, I20-L, I34-L, I40-L / A14-L, A16-L.
- **Design docs:** `docs/design/REVIEW_SETS.md`; `docs/design/GRAPH_MODEL.md`; `memory/SPEC.md` D27-L.
- **Current execution pointer:** Done 2026-06-06. Structured-exchange schema/emission lock and approval wiring are complete, and `.fixtures/runs/project-graph-review-cycle/2026-06-06-project-graph-review-cycle/` proves the real `project-graph` agent path: selected-spec graph read, dry-run-gated `present_review_set`, public-RPC approval through `session.submitExchangeResponse`, one explicit-basis `acceptReviewSet` graph commit, and graph invalidations with `{specId, lsn}`. The probe also fixed a real policy gap: commitment-grade `generate-proposal` now activates `present_review_set` / `request_review` for the Brunch runtime tool posture.

### elicitation-backlog

- **Name:** Elicitation backlog substrate and agenda read-back
- **Linear:** [FE-823](https://linear.app/hash/issue/FE-823/elicitation-backlog-substrate-and-agenda-read-back)
- **Kind:** structural / bounded feature
- **Status:** done
- **Certainty:** proving
- **Retires:** A24-L — test whether a flat prospective register is sufficient before any plane/pointer promotion.
- **Lights up:** `createSpec` seed → `CommandExecutor` backlog mutation → per-spec read-back on the real graph boundary.
- **Stabilizes:** D65-L's missing "what to ask next" substrate and the rule that prospective agenda state shares the spec-local LSN / change-log boundary.
- **Objective:** Materialize D65-L `elicitation_backlog` as a flat table routed through `CommandExecutor`, seed it at spec creation, and provide per-spec read-back so the current elicitor coverage push has a real substrate instead of a homeless driver row.
- **Why now / unlocks:** This is the remaining required elicitor-coverage row that has escaped row-sized work. Promoting it back into `PLAN.md` keeps PLAN authoritative, gives the temporary cross-cut a named completion target, and unlocks later per-turn "what to ask next" behavior without prematurely inventing either a second planning system or a graph plane.
- **Acceptance:**
  - The flat table exists with a generated migration and a reconciliation-need-mirroring shape.
  - Create/close operations route through `CommandExecutor`, allocate one spec-local LSN + one `change_log` row each, and return structured failures on malformed input.
  - `createSpec` seeds the grounding-band starter agenda for the new spec only.
  - A graph-owned read path returns open backlog entries per spec with stable fields.
- **Verification:** Inner — schema/migration and `CommandExecutor` tests for create/close/seed/LSN/change-log behavior. Middle — graph query read-back and sibling-spec isolation. Outer — none yet; the per-turn driver remains a follow-on once the substrate proves useful.
- **Cross-cutting obligations:** Preserve D4-L/D20-L command boundary, D16-L/A4-L one `{specId, lsn}` mutation clock, D63-L basis-as-provenance-directness, D52-L graph-owned table + read, and D65-L flat-table-only modeling — no graph node/plane and no unknown→unknown edges.
- **Traceability:** D4-L, D8-L, D16-L, D20-L, D52-L, D63-L, D64-L, D65-L / A24-L.
- **Design docs:** `memory/SPEC.md` D65-L; `docs/design/GRAPH_MODEL.md`.
- **Current execution pointer:** Done 2026-06-08 on FE-823. Materialized `elicitation_backlog` as a flat table plus generated migration, seeded grounding questions at `createSpec`, routed create/close mutations through `CommandExecutor` on the shared spec-local LSN/change-log seam, and added graph-owned per-spec read-back. The remaining prompt-resource body pass stays in `memory/CROSS_CUT_PLAN.md` as temporary coverage completion work; the live per-turn driver remains a follow-on, not frontier completion debt.

### elicitation-driver

- **Name:** Live per-turn "what to ask next" driver
- **Linear:** unassigned
- **Kind:** structural / bounded feature
- **Status:** next
- **Certainty:** proving
- **Promoted from:** `memory/CROSS_CUT_PLAN.md` Seam 3a `"what to ask next" driver` row (D65-L), which remained `partial · ●` after the `elicitation-backlog` substrate landed. Per the cross-cut's own DoD a seam stays open while any `●` row is partial, so the row is disposed here as a real frontier rather than residue.
- **Lights up:** open backlog entries → rank → select next question per turn; capture-reflection grows/closes entries.
- **Stabilizes:** D65-L's live elicitation behavior on top of the flat `elicitation_backlog` substrate; closes the cross-cut Seam 3a row.
- **Objective:** Add the per-turn driver that reads open backlog entries for the selected spec, ranks them (band/priority), selects the next question to surface, and reconciles entries from capture-reflection (open new, close answered) — all on the existing FE-823 read/write substrate.
- **Why now / unlocks:** This is buildable now (the FE-823 substrate and per-spec read-back exist) and it closes the last required cross-cut row. It is itself a **bounded feature, not coverage**; as the cross-cut's promoted closing row it sequences ahead of fresh coverage breadth, but it is **not** POC-ship-critical (the POC delivery cut de-scopes elicitation quality), so it is not a ship-gate blocker.
- **Acceptance:**
  - A driver reads open entries for the selected spec and produces a deterministic ranked selection of the next question.
  - Capture-reflection can open new entries and close answered ones through the existing `CommandExecutor` path; no second mutation clock.
  - Selection is observable enough for a probe/transcript to prove the loop without inventing a planning plane or pointer.
  - The cross-cut Seam 3a row flips from `partial · ●` to done when this lands.
- **Verification:** Inner — ranking/selection and reconciliation tests over seeded backlog. Middle — per-turn driver read-back over a real graph boundary; sibling-spec isolation. Outer — probe showing rank → select → capture-reflection close across turns.
- **Cross-cutting obligations:** Preserve the D4-L/D20-L command boundary and the D16-L/A4-L one-`{specId, lsn}` clock; keep the substrate flat (no graph plane, no unknown→unknown edges); no second planning system.
- **Traceability:** D16-L, D20-L, D52-L, D63-L, D64-L, D65-L / A24-L.
- **Design docs:** `memory/SPEC.md` D65-L; `docs/design/GRAPH_MODEL.md`.

### minimal-authority-shell

- **Name:** Minimal POC authority shell over graph/session actions
- **Linear:** [FE-810](https://linear.app/hash/issue/FE-810/minimal-poc-authority-shell-over-graphsession-actions)
- **Branch:** to create — `ln/fe-810-minimal-authority-shell`
- **Kind:** hardening
- **Status:** done
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
- **Current execution pointer:** Done 2026-06-08. Added `src/.pi/extensions/runtime/authority-matrix.test.ts` as the minimal authority guard: it locks the `CommandResult` discriminant vocabulary (including structured `needs_human` representability), proves `elicit-read-only` derives allowed/blocked tool authority from the shared projected runtime policy, and verifies the POC side-effecting tools (`bash`, `edit`, `write`) are not reachable in `elicit`. No standalone authority service was introduced, `src/.pi/agents/state.ts` stayed untouched, and A18-L strict built-in suppression remains named residue rather than closed.

### poc-live-ship-gate

- **Name:** POC live ship gate and runbook oracle
- **Linear:** [FE-811](https://linear.app/hash/issue/FE-811/poc-live-ship-gate-and-runbook-oracle)
- **Branch:** `ln/fe-811-poc-live-ship-blockers`
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
- **Current execution pointer:** FE-811 ship-gate hardening landed on `ln/fe-811-ship-gate-residue-and-mentions`: stale graph-snapshot/report residue in the committed fixture-curation and project-graph-review-cycle runs was regenerated to the graph-overview/workspace.state contract, the related-edge formatter now labels non-anchor edges `lateral`, and the live mention autocomplete slice now sources selected-spec graph nodes instead of fixture candidates. The remaining frontier work is the final fresh-cwd runbook gate.

### graph-observed-shapes

- **Name:** Graph observed-shape inventory by consumer
- **Linear:** unassigned
- **Kind:** structural
- **Status:** done
- **Certainty:** proving
- **Lights up:** One canonical observed-shape matrix across graph readers, RPC methods, and web observer surfaces.
- **Stabilizes:** D60-L read-shape ownership, D33-L web read-only observer scope, and the rule that `src/projections/` exists only for reusable multi-consumer DTOs.
- **Objective:** Decide the canonical graph read-shape set per consumer (agent/tooling, RPC, web) and align `graph/`, `rpc/`, and `web/` to that inventory without forcing every agent-oriented shape onto the web.
- **Why now / unlocks:** The read-shape story is currently fragmented across domain queries, Pi adapter helpers, RPC methods, and web features. This is the strongest follow-on coverage frontier because it keeps `projections/` from becoming an indirection grab bag and makes the observed-shape story legible before more surfaces accrete.
- **Acceptance:**
  - A closed enumerated coverage ledger exists with required vs deferred shapes per consumer.
  - Each required consumer shape has one canonical owner; adapter-local formatting no longer stands in for a durable read shape.
  - Web remains a read-only observer; web adoption is deliberate, not accidental bleed-through from agent/RPC needs.
  - Any DTOs that survive in `src/projections/` justify multi-consumer reuse; single-owner reads stay in their owning domains.
- **Verification:** Inner — graph query / RPC / web query tests for adopted shapes. Middle — selected-spec observer/read-path smoke over seeded graph data. Outer — manual spot-check only if the web observer UX changes materially.
- **Cross-cutting obligations:** Do not promote all read shapes everywhere. `list_by_kind` / `list_by_band` are plausible web shapes; `related` / `gaps` may remain agent/RPC-only. Keep graph-owned read logic out of `db/`, and keep `src/renderers/` limited to durable LLM/session text rather than arbitrary observer DTOs.
- **Traceability:** D33-L, D51-L, D52-L, D60-L, D64-L.
- **Design docs:** `src/graph/README.md`; `src/rpc/README.md`; `src/web/README.md`.
- **Current execution pointer:** Done 2026-06-08. `src/graph/README.md` now owns the closed observed-shape ledger: `read_graph` requires the six agent shapes, RPC and web require only `overview` + `neighborhood`, `list_by_kind` / `list_by_band` remain web-eligible deferred, and register reads remain deferred until a per-turn driver/consumer needs them. `src/graph/observed-shapes-coverage.test.ts` guards the tool/RPC/web required subsets; no transport shape shipped in this frontier.

### runtime-affordances-and-legality

- **Name:** Runtime affordances and legality surface
- **Linear:** unassigned
- **Kind:** structural
- **Status:** done
- **Certainty:** proving
- **Lights up:** A shared affordance/default-on-switch projection across TUI, web, and RPC if runtime posture controls widen again.
- **Stabilizes:** D40-L's projection-as-truth model and the shared legality/default semantics over goal/strategy/lens.
- **Objective:** Consolidate what runtime posture options are legal, default-on-switch, and visible across transport boundaries without replacing the append-only runtime-state projection model with a state machine.
- **Why now / unlocks:** The shared legality tables already exist, but the next UI/control pass could fork them client-side if this surface stays implicit. Keeping it queued protects the "Brunch-owned shared affordance logic" rule before another posture pass lands piecemeal.
- **Acceptance:**
  - The scoped frontier closes the required affordance rows across user/system switch surfaces, resolved-state read-back, and shared legality/default projections.
  - No client reimplements availability/legality rules locally.
  - Active review-set state or freestyle-vs-structured turn mode only joins when it becomes real product state, not as speculative scaffolding.
- **Verification:** Inner — shared affordance projection and switch-reducer tests. Middle — TUI/RPC/web parity checks if a new surface lands. Outer — manual only when a user-visible posture control changes.
- **Cross-cutting obligations:** Keep truth append-only in `brunch.agent_runtime_state`; affordances are pure derivations over shared tables. Do not add xstate or a persisted machine without new evidence.
- **Traceability:** D25-L, D40-L, D59-L, D66-L.
- **Design docs:** `memory/SPEC.md` D40-L/D59-L; `src/projections/README.md`; `src/session/README.md`.
- **Current execution pointer:** Done 2026-06-08. `src/projections/session/affordances.ts` now owns the shared `(resolvedState, readinessGrade)` derivation for legal goal/strategy/lens options plus default-on-switch values, reusing the same grade/AUTO legality source consumed by `.pi/agents/state.ts`; `src/session/README.md` owns the closed coverage ledger and `src/session/runtime-affordances-coverage.test.ts` guards required agent/RPC rows while leaving `active-review-set` and `turn-mode` as explicit product-state-gated deferrals.

### role-safe-graph-mutations

- **Name:** Role-safe `mutateGraph` / `mutate_graph` as the canonical graph mutation grammar
- **Linear:** unassigned
- **Kind:** structural / bounded feature
- **Status:** done
- **Certainty:** proving
- **Folded scopes:** the former role-named edge-surface and semantic graph-mutation curation cards were consumed by this frontier and deleted during sync; `mutateGraph` / `mutate_graph` is now the one authored grammar.
- **Lights up:** one authored graph-mutation grammar across direct agent graph writes, review-set proposal drafts, capture writes, seed-fixture loading, and dev curation RPC.
- **Stabilizes:** D51-L/D53-L/D27-L edge-authoring boundary; agents express edges by category + endpoint roles, while `sourceId`/`targetId` stays internal storage geometry derived from `EDGE_CATEGORY_METADATA`.
- **Objective:** Replace exposed create-only `commitGraph` / `commit_graph` with `mutateGraph` / `mutate_graph` as the canonical authored mutation command/tool. The grammar supports create/patch/delete operations, uses role-named create-edge variants (`oracle/claim`, `dependency/dependent`, `abstract/concrete`, etc.), normalizes those variants through `EDGE_CATEGORY_METADATA`, and preserves one `CommandExecutor` transaction, one spec-local LSN, one change-log row, and the existing stored edge shape.
- **Why now / unlocks:** The edge model was intended to help agents map relations from unstructured material, but `{category, source, target}` leaves the most error-prone directionality burden at the agent boundary. The earlier semantic-mutation curation scope would otherwise mint a richer graph-write path with a different API pattern. Taking the bigger step now prevents two graph mutation dialects, gives generalized capture one safe relation grammar, and gives fixture curation patch/delete without creating a second mutation model.
- **Break-and-repair path:** Change the canonical shape first, then let type/test failures enumerate callers. Add `RoleNamedEdgeDraft` + a drift-tested normalizer over `EDGE_CATEGORY_METADATA`; introduce `CommandExecutor.mutateGraph` / a shared mutation planner; remove/rename exposed `commit_graph` and repair prompt resources, Pi graph tool schemas/adapters, capture, seed loader, review-set translation, dev RPC, probes, and docs to `mutate_graph`. `acceptReviewSet` remains the workflow/audit command but reuses the same mutation planner. Do not keep a compatibility bridge accepting both role-named and generic source/target edge drafts; any temporary create-only helper must be private, delegate to `mutateGraph`, and be removed before frontier completion unless a same-slice caller proves it still earns its place.
- **Acceptance:**
  - `mutateGraph` / `mutate_graph` is the one exposed authored graph-mutation grammar; exposed `commitGraph` / `commit_graph` is retired or private-only over the same engine.
  - Create-edge ops are an 8-variant role-named union at category/role granularity; no tuple-specific relation catalogue is introduced.
  - Role field names are test-pinned to `EDGE_CATEGORY_METADATA`; normalization to private `source`/`target` is table-driven, and generic `{category, source, target}` authored drafts are rejected at graph tool and review-set boundaries.
  - Create/patch/delete batches are atomic: one transaction, one selected-spec LSN, one change-log row; invalid ops reject the whole batch without writes or clock advancement.
  - Edge identity remains immutable: category, semantic endpoints / stored endpoints, stance, and basis cannot be patched; changing them requires delete+create or supersession.
  - Policy gates op kinds by caller/posture, so the unified tool grammar does not silently grant autonomous agents deletion authority.
  - Product writers are ported: propose-graph uses create-only ops with `createBasis: implicit`; capture and seed loading use create-only ops with `createBasis: explicit`; review-set proposals use role-named edge drafts and acceptance reuses the shared planner; dev curation RPC exposes projected-code create/patch/delete through the same command.
- **Verification:** Inner — normalizer/drift/schema tests over all eight categories; `CommandExecutor` mutation tests for creation parity, patch/delete legality, rollback, sibling-spec rejection, LSN/change-log behavior, and no-reuse ordinals. Middle — graph tool/review-set/capture/seed/dev-RPC tests repaired to `mutateGraph`; dry-run/accept parity for review sets; grep/source tests quarantine `source`/`target` to internal planner/storage/projection code. Outer — product probes and docs point at `mutate_graph`; any retained pre-migration `commit_graph` artifacts are explicitly historical until regenerated.
- **Cross-cutting obligations:** Preserve D4-L/D20-L command boundary, D16-L/A4-L spec-local mutation clock, D51-L stored edge identity, D62-L projected node codes, D63-L `basis` semantics, and D52-L ownership (`graph/` owns mutation semantics; adapters translate only at boundaries). Do not re-orient persistence to upstream/downstream and do not add a read DTO merely to mirror direction; `projection/direction.ts` remains the read projection.
- **Traceability:** D4-L, D16-L, D20-L, D27-L, D51-L, D52-L, D53-L, D62-L, D63-L / A14-L / I1-L, I11-L, I15-L, I20-L, I34-L, I39-L, I40-L, I41-L.
- **Design docs:** `docs/design/GRAPH_MODEL.md`; `memory/SPEC.md` D27-L/D51-L/D53-L; `src/graph/README.md`; `src/rpc/README.md`; `docs/testing/seeded-dev-rpc.md`.
- **Current execution pointer:** Done 2026-06-09. `CommandExecutor` now exposes one public authored mutation seam (`mutateGraph` / `dryRunMutateGraph`) over the extracted planner/writer modules; direct tool writes, review-set acceptance, capture, seed loading, and dev curation all converge on that grammar. The dev-only RPC boundary is now `dev.graph.mutateGraph`, using role-named create-edge ops plus projected node-code / selected-spec edge-id resolution before it enters `CommandExecutor`. Follow-up closure on the same date: the product probes now prompt for and parse `mutate_graph`, current docs describe `mutate_graph` as the active tool, the checked-in 2026-06-05 fixture-curation run is labeled historical pre-migration `commit_graph` evidence, and schema coverage guards the authored edge surfaces against endpoint-role drift.

### projection-shape-coverage

- **Name:** Close the projections ledger with no-loss / shape invariants (PROJECT stage)
- **Linear:** unassigned
- **Kind:** coverage (buildable-now) / hardening
- **Status:** next — trio stage 1 (`#project`)
- **Certainty:** proving
- **Pipeline position:** PROJECT — the info-preserving DTO stage between PULL and RENDER (`renderers/`). PULL has two halves: the *graph* read surface is locked/ledgered (`graph/queries.ts` + `src/graph/README.md`), but the *session* read surface the session/workspace projections lock against is tested-but-un-ledgered, so this frontier carries a PULL-session prerequisite. Upstream of `renderer-golden-coverage`; lock projection shapes before renderer goldens so the goldens do not churn against moving DTOs.
- **Coverage-gate verdict (2026-06-08 deep per-plane pass; refined at design checkpoint):** **Passes the admission gate, and is the genuinely-new finding.** Named load-bearing layer (`src/projections/`), closeable inventory. The ledger is now authored in `src/projections/README.md`. Direct-coverage today: only `request-choice` (`✓`) and `affordances` (`✓`) plus the `topology-boundaries` import guard. The enumeration **corrected the plan's dark-zone claim**: `graph/{overview,commit-result,reconciliation-needs}` and `exchanges/present-candidates` are `export {}` **topology stubs**, not dark implementations (nothing to lock — `○`). The real `●` survivors needing invariants are `graph/neighborhood`, `session/transcript-context`, `session/runtime-state`, and `workspace/workspace-state`. The enumeration also found one `✗` indirection: `workspace/workspace-context` is a single-consumer `{ mode, data }` tag wrapper with zero transform — **delete/inline**, feed its consumer from the source read. The exchange family (`present-*`, `request-answer/choices/review`, `review-set-payload`) is `◐`: covered transitively via `.pi` tests, direct-lock optional.
- **Oracle kind:** **invariant / no-loss / shape — NOT golden.** Projections are info-preserving (D60-L); a golden would be brittle and could not catch the failure that matters (a projection dropping a field the renderer also hides). Lock with shape assertions (required fields present, types correct) and round-trip / no-loss properties where a projection re-shapes a typed read. An **earns-its-place gate runs before the oracle gate**: a single-consumer pass-through is deleted, not locked.
- **Boundary:** In — the `●` DTO transforms (`graph/neighborhood`, `session/transcript-context`, `session/runtime-state`, `workspace/workspace-state`), the `✗` delete (`workspace/workspace-context`), the `◐` exchange-family decision, and the PULL-session read-shape ledger. Out — `○` topology stubs (`graph/{overview,commit-result,reconciliation-needs}`, `exchanges/present-candidates`), `session/runtime-policy` (policy data, not a transform), `topology-boundaries` (already an import guard), and the already-locked `✓` rows.
- **Aggregate DoD:** Every `●` projection carries a shape/no-loss invariant; every `✗` row is deleted/inlined with its consumer fed from source; `◐` rows resolved by explicit decision; `○` rows untouched. The session-PULL read-shape ledger exists. Every `projections/` module appears in `src/projections/README.md` with a disposition (`✓`/`●`/`◐`/`✗`/`○`) + owner + oracle.
- **Inventory authority:** the closed ledger lives in `src/projections/README.md` (authored 2026-06-08), mirroring the `src/graph/README.md` read-shape ledger form (module × consumers × disposition × oracle). The PULL-session half gets a sibling read-shape ledger in `src/session/README.md`.
- **Why now / unlocks:** It is the missing middle of the pipeline and the prerequisite for stable renderer goldens. Closing it makes the info-preserving half of the context pipeline (PULL+PROJECT) fully oracle-backed, matching the graph PULL template.
- **Human-in-the-loop:** per-row design checkpoint = user reviews "what must be preserved" for each load-bearing DTO (and approves each `✗` delete) before the invariant is locked (see Context §design→lock rhythm). The enumeration/ledger pass itself was the first design checkpoint.
- **Acceptance:**
  - `src/projections/README.md` carries the full projections ledger (done) and `src/session/README.md` carries the session-PULL read-shape ledger.
  - Each `●` DTO carries a shape/no-loss invariant; `workspace/workspace-context` is deleted/inlined; the `◐` exchange family is dispositioned; `○` stubs are left untouched.
  - No golden snapshots are introduced for projections (wrong tool); `projections/` stays free of adapter/transport imports (D52-L, enforced by `topology-boundaries.test.ts`).
- **Verification:** vitest shape/round-trip asserts co-located with each projection (or a `projections/<domain>/*.test.ts`); the existing `topology-boundaries.test.ts` continues to guard imports.
- **Cross-cutting obligations:** Keep projections info-preserving (no lossy text — that is RENDER's job); do not duplicate a typed read as a projection just to fill a ledger row (D60-L: many callers consume the typed read directly).
- **Traceability:** D52-L, D60-L.
- **Design docs:** `src/projections/README.md`; `src/graph/README.md` (ledger form to mirror).

### renderer-golden-coverage

- **Name:** Complete the uneven renderer text-regression (golden + invariant) coverage (RENDER stage)
- **Linear:** unassigned
- **Kind:** coverage (buildable-now) / hardening
- **Status:** next — trio stage 2 (`#render`); **depends on `projection-shape-coverage`**
- **Certainty:** proving
- **Pipeline position:** RENDER — the first lossy stage, consuming PROJECT outputs. Locks only after projection shapes are stable; upstream of `prompt-composition-golden-coverage` (composed prompts embed rendered context).
- **Coverage-gate verdict (2026-06-08 ln-plan):** **Passes the admission gate** — an open coverage frontier. Named load-bearing layer (`src/renderers/`), closeable inventory, honest ●/○ marking, owner+oracle per row, explicit ledger authority. Classified **buildable-now**, and framed as **partial-oracle completion, not greenfield adoption**: the preview→lock→formalize loop already exists and is adopted unevenly. `toMatchFileSnapshot` goldens are live for `graph/neighborhood` and `session/runtime-frame` (`src/renderers/**/__previews__/`); what remains is closing the gaps — `workspace-state` is still invariant-only, `renderers/exchanges` has no goldens, and `src/scripts/render-preview.ts` (`npm run render`) only supports the `graph-neighborhood` renderer.
- **Boundary:** In — the durable LLM-facing renderers under `src/renderers/{graph,workspace,session,exchanges}` (per `src/renderers/README.md`). Out — format helpers/primitives (`markdown.ts`, `toon.ts`), trivial JSON serializers (`○`), non-renderer projection DTOs, intentional topology stubs not yet owning a renderer (e.g. `present-candidates`), and any new renderer not already built (no symmetry regrowth).
- **Aggregate DoD:** No required (`●`) durable renderer remains without a locked golden (`toMatchFileSnapshot`) plus targeted invariant asserts (e.g. "renders projected code, never raw id"; "active-context omits superseded nodes"; "no dangling edge endpoints"). Extend `render-preview.ts` to the renderers being locked.
- **Inventory authority:** the closed ledger lives in `src/renderers/README.md`; golden artifacts co-locate with the renderer test (`src/renderers/<domain>/__previews__/<fixture>.md`), not under `.fixtures/`.
- **Why now / unlocks:** The cross-cut named the preview→lock→formalize loop a prerequisite oracle; it shipped for two renderers but not the rest, so the un-locked renderers can drift silently. Closing the gaps makes every durable renderer-bearing surface drift-protected.
- **Sequencing:** trio stage 2 — starts once `projection-shape-coverage` has stabilized the DTO shapes it renders. Renderer text quality is **fitness evidence**, so it is still **never a ship gate** and does not block `poc-live-ship-gate`; but per the 2026-06-08 elevation it is near-term spine work, not background discretionary hardening.
- **Human-in-the-loop:** per-row design checkpoint = user eyeballs the `npm run render` preview and approves the wording/shape before the golden is written (see Context §design→lock rhythm).
- **Acceptance:**
  - Each `●` durable renderer has a golden lock that writes on first run and diffs after (matching the existing `graph/neighborhood` + `session/runtime-frame` pattern).
  - Each `●` renderer carries at least one semantic invariant assert beyond the snapshot.
  - `src/renderers/README.md` carries the closed ledger (renderer × required/deferred × golden-present).
  - `render-preview.ts` covers each newly-locked renderer; no new renderer is introduced merely to fill a symmetric cell.
- **Verification:** `npm run render` for sketch; vitest `toMatchFileSnapshot` for lock; existing invariant-style asserts for formalize. All in the renderer's co-located test file.
- **Cross-cutting obligations:** Goldens co-locate with renderer tests (not `.fixtures/`); keep `renderers/` free of adapter/transport imports (D52-L); do not promote a renderer shape to a new consumer just to fill the ledger (consumer bleed-through); leave intentional topology stubs (`present-candidates`) alone until they own a real renderer.
- **Traceability:** D52-L, D60-L, D62-L.
- **Design docs:** `src/renderers/README.md`; `memory/CROSS_CUT_PLAN.md` §Renderer feedback loops.

### prompt-composition-golden-coverage

- **Name:** Lock the prompt partials and composition output (golden + invariant) over the agent prompt family (COMPOSE stage)
- **Linear:** unassigned
- **Kind:** coverage (buildable-now) / hardening
- **Status:** next — trio stage 3 (`#compose`); **depends on `renderer-golden-coverage`**
- **Certainty:** proving
- **Pipeline position:** COMPOSE — the last lossy stage; composed prompts embed rendered context strings, so lock only after RENDER goldens are stable. `elicitation-driver` rides on this stage's locked oracle and follows it.
- **Coverage-gate verdict (2026-06-08 ln-plan):** **Passes the admission gate** — an open coverage frontier of the same golden-locking kind as `renderer-golden-coverage`, surfaced from manual feedback-loop work. Named load-bearing layer (`src/.pi/skills/**` partials + `src/.pi/agents/compose.ts` composition), closeable inventory, owner+oracle per row, explicit ledger authority. Classified **buildable-now** and framed as **partial-oracle completion, not greenfield**: composition is already **invariant-rich** — `compose.test.ts` and `prompting.test.ts` assert structure, manifest legality, grade filtering, pinned/AUTO axis behavior, illegal-pin rejection, plus a `≥700`-char depth floor and a readable-resource check on every partial. What is missing is the **lock** stage: there is **no golden** of either the partial bodies or the composed-prompt output (no `__previews__`, no `toMatchFileSnapshot` for prompts; the only `.pi` inline snapshots are tool-output, not prompts), and there is **no preview harness** for composed prompts (`npm run render` only supports `graph-neighborhood`).
- **Boundary:** In — the agent prompt partials under `src/.pi/skills/{goals,strategies,lenses,methods}` and `src/.pi/agents/definitions/{elicitor,reviewer}.md`, and the `composeAgentPrompt` output for a representative matrix of axis/grade/pin combinations. Out — tool-output snapshots (already inline-locked where useful), `state.ts` legality source (guarded elsewhere), and any new partial/axis introduced merely to fill a symmetric cell (no symmetry regrowth).
- **Aggregate DoD:** No required (`●`) prompt partial body or representative composed-prompt output remains without a locked golden plus the existing structural/legality invariants. Add a composed-prompt preview path (extend `render-preview.ts` or a sibling script) so goldens can be regenerated deterministically.
- **Inventory authority:** the closed ledgers live in `src/.pi/skills/README.md` (partials) and `src/.pi/agents/README.md` (composition); golden artifacts co-locate with the owning test (`src/.pi/agents/__previews__/<case>.md`), not under `.fixtures/`.
- **Why now / unlocks:** Prompt partials and composition shape every agent turn; today they can drift in wording/depth/order while invariants stay green, because the lock stage was never adopted for prompts. Locking them makes the manual feedback loop (eyeball → lock → diff) durable instead of re-eyeballed each change.
- **Sequencing:** trio stage 3 — starts once `renderer-golden-coverage` has stabilized the rendered context strings the composed prompt embeds. Still **never a ship gate**; `elicitation-driver` follows it (it adds per-turn behavior over the composition oracle locked here), so the two pair naturally.
- **Human-in-the-loop:** per-row design checkpoint = user eyeballs the composed-prompt preview (new harness) and approves partial body / composed wording before each golden is written (see Context §design→lock rhythm).
- **Acceptance:**
  - A representative composed-prompt matrix (axis/grade/pin) has golden locks that write on first run and diff after.
  - Each `●` partial body has at least the existing depth/readability invariant plus a body golden where wording is load-bearing.
  - `src/.pi/skills/README.md` + `src/.pi/agents/README.md` carry the closed ledger (partial/composition-case × required/deferred × golden-present).
  - A composed-prompt preview path exists for deterministic golden regeneration; no new partial/axis is introduced merely to fill a symmetric cell.
- **Verification:** preview script for sketch; vitest `toMatchFileSnapshot` for lock; the existing `compose.test.ts` / `prompting.test.ts` invariants for formalize.
- **Cross-cutting obligations:** Goldens co-locate with prompt tests (not `.fixtures/`); keep `state.ts` the single legality source (do not fork it for previews); do not promote a partial to a new agent just to fill the ledger.
- **Traceability:** D25-L, D39-L, D40-L, D52-L, D58-L, D59-L, D60-L.
- **Design docs:** `src/.pi/skills/README.md`; `src/.pi/agents/README.md`; `memory/CROSS_CUT_PLAN.md` §Renderer feedback loops.

### exchanges-and-generalized-capture

- **Name:** Generalized capture (narrow extractive) + exchange-surface symmetry audit
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** next
- **Certainty:** proving
- **Coverage-gate verdict (2026-06-08 ln-plan):** **Not a coverage frontier.** It was sitting in the coverage slot, but the admission gate fails on the load-bearing question: the remaining required work is **vertical capture semantics** (high-confidence extractive capture with false-commit protection), not breadth closure. The exchange surface is largely built across {`.pi/extensions/exchanges`, `projections/exchanges`, `renderers/exchanges`}, with some breadth still explicitly deferred / topology-stubbed (e.g. the `present-candidates` candidate-family stub mirrored across all three layers). So the open unknown is the capture vertical, not an unbuilt inventory; reclassified as a bounded proving feature plus a delete-oriented symmetry audit.
- **Unblocked by:** `capture-quality-spike` (2026-06-08) measured fixed free-prose, file/ref-bearing, and implication-heavy scenarios, reached precision 1.0 / recall 1.0 with zero false commits in the sample extraction report, and recommended graduating a narrow generalized-capture feature with an explicit false-commit guard.
- **Objective:** (1) Build narrow generalized capture around high-confidence extractive facts with an explicit false-commit oracle for implication-heavy text — keep implication-heavy material out of graph truth unless a later slice proves a safe commitment path. (2) Run an **earned symmetry audit** of the already-built exchange three-layer split: confirm each `projections/exchanges` and `renderers/exchanges` file earns its place (genuine multi-consumer reuse or shared semantics), and delete symmetry regrowth where a single-owner read was mirrored into a shared layer "for symmetry."
- **Why now / unlocks:** The capture-quality spike closed the evidence gate for the capture vertical. The audit rides along because the same symmetry the frontier would have "enumerated" is exactly where consumer-bleed-through/symmetry-regrowth hides. Start with the vertical + false-commit protection and treat the audit as deletion-oriented, not as breadth-building; do not regrow deleted `capture-*` topology or broad LLM commitment behavior.
- **Acceptance:**
  - Capture beyond directly labeled facts starts with high-confidence extractive facts and carries an explicit false-commit oracle for implication-heavy text.
  - Each retained `projections/exchanges` / `renderers/exchanges` file has a named multi-consumer or shared-semantics justification; unjustified symmetric mirrors are deleted (delete-as-progress), not documented as "covered."
  - Single-owner reads or orchestration state stay in their owning domains; `renderers/exchanges` stays durable markdown/text/toon only.
- **Verification:** Probe-backed transcript and capture read-back oracles; include the capture-quality false-commit scenario family as a regression guard. For the audit, the oracle is the existing topology-boundary test plus a per-file justification check.
- **Cross-cutting obligations:** Keep `renderers/exchanges` for durable markdown/text/toon only, keep TUI presenters local, and do not reintroduce `snapshot` as an architecture noun.
- **Traceability:** D27-L, D65-L, D66-L.
- **Design docs:** `memory/SPEC.md` D65-L/D66-L; `src/projections/README.md`; `src/renderers/README.md`.

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

### dx-feedback-loops

- **Name:** First-class developer feedback loops over the pi harness
- **Linear:** FE-825 — https://linear.app/hash/issue/FE-825/first-class-developer-feedback-loops-over-the-pi-harness
- **Kind:** structural / dev-substrate
- **Status:** done
- **Certainty:** proving
- **Retires:** A25-L — first validation that tracking the latest `pi-coding-agent` line (via dep bump + dev source-alias) lands without sealed-profile regression.
- **Lights up:** A consolidated `src/dev/` front door exposing three named end-to-end loops (faux / real-provider / introspection) that did not exist as a first-class iteration surface, with vite/vitest able to run against pi *source* with no rebuild.
- **Stabilizes:** The DX-loop seam (D68-L) and the read-only introspection capture contract (D69-L) that future contributors aim from.
- **Objective:** Make working over the pi harness fast and observable. (1) Bump `@earendil-works/pi-*` to latest (`0.79.0`) and add a dev source-alias resolving those packages to the sibling `pi-mono` `src/` checkout in `vitest` + `vite`, mirroring pi's own alias list, while published builds keep resolving `dist`; `tsx` source mode remains an explicit future opt-in via a dev tsconfig, not the default path (D67-L). (2) Consolidate three loops behind one `src/dev/` front door owning the launchers plus a shared faux-harness factory; migrate ad hoc faux wiring onto the factory (D68-L). (3) Add one read-only, dev-gated introspection extension wired through `brunch-pi-extensions.ts` that captures exactly what the model receives — mechanical via passive `before_provider_request`/`before_agent_start` tap + on-demand `/introspect` (`ctx.getSystemPromptOptions()`), subjective via launcher `session.prompt` — both writing one `.fixtures/scratch/introspection/<run-id>/` run (D69-L/D70-L).
- **Why now / unlocks:** The only fast iteration path today is ad hoc faux wiring scattered across `src/probes/`; the user has elevated DX loops to first-class. This is a substrate that accelerates every later frontier, and its version-bump+alias slice is a shared unblocker best landed before the trio's pi-facing churn. Not POC-ship-critical.
- **Acceptance:**
  - pi deps are at latest and a dev source-alias resolves `@earendil-works/pi-{ai,agent-core,tui,coding-agent}` to the `pi-mono` `src/` checkout in `vitest` and `vite`; the published/`dist` resolution path is unchanged, and `tsx` source mode is deferred to an opt-in dev tsconfig if a later real-provider loop needs it.
  - A single `src/dev/` front door owns the faux, real-provider, and introspection launchers plus one shared faux-harness factory; existing ad hoc faux setup (e.g. `src/probes/structured-exchange-ordering-proof.ts`, `src/.pi/brunch-pi-settings.ts`) is migrated onto the factory or explicitly justified in place.
  - The faux launcher boots an in-memory `AgentSession` over the pi faux provider and runs a scripted turn end-to-end with no network, keys, or tokens.
  - One read-only, dev-gated introspection extension loads only through the explicit `brunch-pi-extensions.ts` bundle, returns every captured payload unchanged, and produces a well-formed paired `.fixtures/scratch/introspection/<run-id>/` run (mechanical payload + subjective answer correlated by turn).
  - Product runs are unaffected: outside dev/introspection mode the introspection extension is absent and the D39-L offline default holds.
- **Verification:** Inner — alias-resolution + faux-harness-factory boot unit tests; a test asserting the introspection extension returns payloads unchanged (observation-only); a sealed-profile test that the extension is absent and offline default intact under product mode. Middle — faux launcher scripted-turn smoke; introspection run-artifact shape assertion under `.fixtures/scratch/introspection/`. Outer — manual real-provider introspection session against a live model: ask the model to enumerate and critique tools/skills and eyeball the paired capture (the I38-L discretionary-loading fitness check; tracked, not gated).
- **Cross-cutting obligations:** Preserve the D39-L sealed-profile boundary — introspection loads via the explicit static bundle (never ambient discovery), observes but never mutates payloads, and its offline-lift + extension inclusion are dev-gated, never product defaults. Dev loops are means-of-building and stay distinct from `src/probes/` product-verification probe runs; any durable evidence a dev loop produces lands as a probe run under the `.fixtures/runs/` contract, not a parallel artifact path (D68-L). Pi version bumps are routine adaptation, not deferred migrations; keep the dev alias mirroring pi's own `tsconfig.json` paths list and do not pin back (D67-L).
- **Topology materialization:** `src/dev/` becomes the dev front door (launchers + shared faux-harness factory); the introspection extension lives under `src/.pi/extensions/` per D39-L topology and is wired in `src/.pi/brunch-pi-extensions.ts`; dev source-alias config lives in `vite.config.ts` through the `PI_SOURCE`-gated runtime alias, while base `tsconfig.json` stays paths-free; introspection artifacts are written under `.fixtures/scratch/introspection/`.
- **Traceability:** D39-L, D58-L, D67-L, D68-L, D69-L; A25-L; I38-L.
- **Design docs:** `memory/SPEC.md` §Development Feedback Loops (DX) and D67-L–D69-L; a new `src/dev/README.md`; `pi-mono/packages/coding-agent/docs/development.md` and `vitest.config.ts` for the alias pattern.
- **Current execution pointer:** Done 2026-06-09. The chain landed the latest-pi bump and `PI_SOURCE`-gated runtime alias, the `src/dev/` faux front door and shared faux harness, and the dev-gated read-only introspection extension plus paired run-artifact launcher. Verification: `npm run verify` (608 tests, tsc build, web build). **Follow-on:** `dx-introspection-live` carries the remaining gaps — the introspection extension is built but not wired into the real TUI launch path, `--cwd` is not yet supported by the main CLI, and there is no conversational self-report surface yet.

### dx-introspection-live

- **Name:** Live, conversational agent-input introspection in the real dev TUI
- **Linear:** unassigned — create in FE / brunch when the frontier starts (do not parent under FE-531; sibling of FE-825, not a child).
- **Kind:** structural / dev-substrate (capability expansion over `dx-feedback-loops`)
- **Status:** next (DX substrate; not POC-ship-critical)
- **Certainty:** proving
- **Retires:** A26-L — first proof that conversational introspection (agent reporting in chat on tool I/O, understandability, errors/uncertainty, skill activation) is buildable as read-only dev instrumentation without weakening D39-L sealing.
- **Lights up:** Running `BRUNCH_DEV=1 npm run dev -- --cwd .fixtures/workbenches/<name>` boots the *real* Brunch TUI against a chosen fixture workspace with the introspection extension live and the model able to report back, in chat, on how it reads Brunch's tools/skills — a loop that does not exist today (the extension is built but dormant, and dev runs pollute the operating cwd).
- **Stabilizes:** The four-role `.fixtures/` topology (D70-L), the unified `BRUNCH_DEV` dev gate + `--cwd` launch surface (D71-L), and the conversational self-report contract (A26-L) that future introspection work aims from.
- **Objective:** Make introspection actually *usable live* and *conversational*. Preflight hardening has already formalized scratch artifact routing and moved probe faux wiring out of `src/dev/**`; the remaining sequence is: (1) add `--cwd <dir>` parsing and unify dev gating under `BRUNCH_DEV`, wiring the introspection extension into the real TUI launch path only when enabled; (2) extend the read-only D69-L tap with `tool_call`/`tool_result` observation and add a small structured self-report schema (not free prose) the agent emits on demand covering tool sent/returned data, input/output understandability, errors/uncertainty, and skill-activation quality. Choose the in-chat-vs-artifact surface during that conversational slice (the open A26-L unknown).
- **Why now / unlocks:** `dx-feedback-loops` built the introspection machinery but left it dormant — the capability the user actually wants (interrogate the live in-product agent about how it reads Brunch's tools/skills, and get clarity feedback in chat) is not reachable yet. This closes that gap and hardens the fixtures topology every dev loop and probe shares. Not POC-ship-critical; a DX substrate that accelerates later product frontiers (especially the I38-L discretionary-loading and tool/skill-clarity questions).
- **Acceptance:**
  - `runBrunchCli` accepts `--cwd <dir>` (defaulting to `process.cwd()`) so a dev session can target `.fixtures/workbenches/<name>` without `cd`.
  - A single `BRUNCH_DEV` switch enables dev RPC, introspection registration, scratch routing, and the offline lift together; `BRUNCH_DEV_RPC` is fully retired (no remaining references in code or docs).
  - With `BRUNCH_DEV=1`, the real Brunch TUI registers the introspection extension last in the `before_provider_request` chain and a live model turn produces a paired scratch run; without `BRUNCH_DEV`, the extension never registers and the D39-L offline default holds.
  - The agent can emit a parseable structured self-report (tool I/O, understandability, errors/uncertainty, skill activation) on demand, rendered back paired to the same scratch run; the report is dev instrumentation, never a product behavior.
- **Verification:** Inner — `--cwd` parse unit test; scratch-path resolution test (artifact root is repo-`.fixtures/scratch/`, independent of operating cwd); `BRUNCH_DEV` gating test at the `brunch-tui.ts` call site (extension absent when unset, present + last-ordered when set); build-exclusion assertion for `src/dev/**`; offline-lift save/restore test; self-report schema parse test. Middle — faux-driven introspection scratch-run shape assertion; `tool_call`/`tool_result` observation smoke over a scripted faux turn. Outer — manual `BRUNCH_DEV=1 npm run dev -- --cwd .fixtures/workbenches/<name>` session against a live model: interrogate the agent about tool/skill clarity and eyeball the conversational self-report + paired scratch capture (the A26-L / I38-L fitness check; tracked, not gated).
- **Cross-cutting obligations:** Preserve the D39-L sealed-profile boundary — introspection stays read-only (observes, never mutates payloads), loads only via the explicit `brunch-pi-extensions.ts` bundle (never ambient discovery), and all dev affordances stay behind `BRUNCH_DEV`; the offline lift is save/restore-scoped at the session-construction site, never a naked global `process.env` mutation (I42-L). Dev scratch output stays distinct from `src/probes/` product-verification runs; durable evidence is reached only by explicit promotion into the tracked `runs/` contract (D70-L), not a parallel artifact path. Conversational self-report is dev instrumentation; it must not leak into product behavior or the sealed profile.
- **Topology materialization:** `.fixtures/scratch/` (gitignored) has joined `seeds/`/`workbenches/`/`runs/`; `--cwd` parsing lands in `src/app/brunch.ts` / `runBrunchCli`; `BRUNCH_DEV` gating and the introspection `{ enabled }` wire-up land in `src/app/brunch-tui.ts`; the `tool_call`/`tool_result` observation + self-report schema + in-chat surface extend `src/.pi/extensions/introspection/`; `.gitignore`, `.fixtures/README.md`, `src/dev/README.md`, and `src/.pi/extensions/README.md` reconcile to the new topology and gate.
- **Traceability:** D39-L, D58-L, D67-L, D68-L, D69-L, D70-L, D71-L; A26-L; I38-L, I42-L.
- **Design docs:** `memory/SPEC.md` §Development Feedback Loops and D69-L–D71-L, A26-L, I42-L; `.fixtures/README.md`; `src/dev/README.md`; `src/.pi/extensions/introspection/README.md`.
- **Current execution pointer:** Preflight hardening done 2026-06-09. The completed chain made the D67-L vite/vitest source alias portable/exact, moved ordering-proof faux-provider wiring out of build-excluded `src/dev/**`, routed introspection artifacts to repo-root `.fixtures/scratch/introspection/<run-id>/`, and deleted the exhausted scope file. Next scope should start the live TUI `BRUNCH_DEV` + `--cwd` wiring slice, then conversational self-report.

### dev-seed-fixtures

- **Name:** Development seed-fixture substrate (Bilal-port + legacy specs)
- **Linear:** unassigned
- **Kind:** tooling / dev-substrate
- **Status:** parallel / continuous
- **Objective:** Maintain rich, real seed data for local dev and manual/observer testing: the consolidated `{spec,nodes,edges}` seed contract under `.fixtures/seeds/<set>/<slug>.json`, the `src/graph/seed-fixtures.ts` loader (`npm run seed`) that commits each fixture through `CommandExecutor`, and the throwaway per-set port scripts that produce seed files. Grow set coverage and graph quality as delivery frontiers need data to exercise.
- **Why now / unlocks:** Delivery frontiers (`capture-response-to-graph`, the live-graph observer follow-on, `poc-live-ship-gate`) need real multi-spec graph data to exercise UI/agent/observer behavior without hand-authoring. The Bilal port already provides three loadable specs; enhancing them surfaces under-represented planes/kinds (notably `thesis`/`goal`) for richer capture and observer demos.
- **Acceptance:**
  - Seed contract stays loadable: each set's port script self-validates every `<slug>.json` through the real loader (same structural checks `CommandExecutor.mutateGraph` enforces) before writing.
  - `npm run seed` loads every `.fixtures/seeds/<set>/<slug>.json` into the workspace DB through `CommandExecutor` (never direct row inserts), preserving spec-local graph clock / change log / LSN coherence.
  - New seed sets follow the established shape: vendored `_originals/`, throwaway `_port-script.ts`, consolidated `<slug>.json`, generated `README.md`; derived variant sets may instead document the deterministic filter over an existing seed set and keep mixed-basis product-run output under `.fixtures/runs/`.
  - Product curation runs over seeds leave transcript-backed artifacts (`session.jsonl`, `transcript.md`, `report.json`, and graph readback when graph truth is the proof target) and prove real `mutate_graph` transcript evidence plus implicit graph rows; any retained pre-migration `commit_graph` runs are historical only. Mixed-basis graph readbacks are not registered as reusable seeds.
- **Enhancement backlog (captured, not yet scoped):**
  1. Enhance Bilal-port fixtures *through Brunch itself* by feeding the original briefs Bilal authored, to recover `thesis`/`goal` structure the current ported graphs under-express.
  2. Port and enhance the earlier product version's fixtures (the legacy walkthrough scenarios in `docs/praxis/manual-testing.md`), raising quality through better semantic definition (kinds, detail) and internal connection (edges).
- **Verification:** Inner — `src/graph/seed-fixtures.test.ts` seeds real fixtures into an in-memory DB and asserts spec/node/edge counts plus spec-local change-log/clock coherence independent of seed order, rejects non-`explicit` basis, and covers the `macro-view-grounded-intent` explicit intent-only variant; `src/probes/fixture-curation-loop.test.ts` proves curation report/artifact evidence detection without an LLM. Outer — `npm run seed` smoke against a fresh cwd; real fixture-curation runs under `.fixtures/runs/fixture-curation/`; seeded-dev-rpc smoke proves `dev.graph.mutateGraph` advances only the mutated spec's overview LSN.
- **Topology materialization:** Seed data and throwaway prep scripts live under `.fixtures/seeds/`; the loader lives in `src/graph/seed-fixtures.ts` (graph/ owns `CommandExecutor` orchestration; db/ is imported only by graph/, never the reverse); no seed-only graph runtime the product launch does not use.
- **Cross-cutting obligations:** Seeds commit only through `CommandExecutor`; directly-authored items use `basis: explicit` (the retired `accepted_review_set` value is not a basis). Respect multi-spec discipline — each fixture is one spec's own graph (D61-L). Pre-release posture: regenerate fixtures when the schema moves rather than preserving stale shapes. **Known drift:** `docs/praxis/manual-testing.md` still describes the earlier seed system (scenario-arg `npm run seed`, `.brunch/brunch.db`); reconcile it to the current loader (all-sets `npm run seed`, `.brunch/data.db`) when the legacy port (backlog item 2) lands — coordinate with the doc-reconciliation track rather than double-editing.
- **Current execution pointer:** The semantic-mutation curation scope is complete via `role-safe-graph-mutations`, so dev curation no longer mints a second graph-write dialect. Product-driven fixture-curation tracer evidence remains the quality-review input: `macro-view-grounded-intent` is a deterministic explicit-basis Bilal variant; fresh runs now prove `mutate_graph`, while the checked-in `.fixtures/runs/fixture-curation/fixture-curation-2026-06-05T104440Z/` artifact is historical pre-migration `commit_graph` evidence until regenerated.
- **Traceability:** D4-L, D16-L, D19-L, D20-L, D52-L, D61-L, D62-L, D63-L / I1-L / A4-L, A14-L.
- **Design docs:** `.fixtures/seeds/bilal-port/README.md`; `docs/design/GRAPH_MODEL.md`; `docs/praxis/manual-testing.md`.

### web-design-system-port

- **Name:** Web client visual design-system port
- **Linear:** unassigned
- **Kind:** bounded feature (web presentation)
- **Certainty:** earned — the target design exists and works in `../brunch/src/client`; the closure is *materialize the port + delete the invented aesthetic*, not retire an unknown. (Project default is `proving`; this frontier overrides because the design is known.)
- **Status:** done (all three cards landed 2026-06-09; exhausted scope files deleted during sync)
- **Objective:** Replace the agent-invented "warm brunch" web aesthetic with the prior trunk's restrained design language (D72-L). Two materializations and one deletion: (a) **tokens** — port the token system into `src/web/styles.css` (Inter + Geist Mono; `ink/sub/hint/rule/wash/tint` ramp + link/plane accents; 11–16px type scale; `--shadow-card` family); (b) **primitives** — copy `DrawerCard`, `KindBadge`, `CountBadge`, `RefBadge` into a new `src/web/components/`, adapted from the old `KnowledgeKind` knowledge-card pattern to this trunk's `NodeKind`/`NodePlane` with a plane-organized accent map; (c) **re-skin** the three existing views (`WorkspaceChrome`, `GraphOverviewPanel`, `SessionPanel`) as a *style + component-pattern port of the views we have* (scope correction, user 2026-06-09) — preserving behavior except invented dead scaffolding — and delete the warm gradients, `backdrop-blur`, oversized radii/shadows, translucent surfaces, and wide-tracked uppercase labels. The non-functional "Focus node" placeholder (never called `graph.nodeNeighborhood`) was removed; the "Edge categories" summary was kept (restyled, user finds it useful).
- **Why now / unlocks:** The current web UI's visual language was invented wholesale by the agent that built it and does not match the product's established look. Realigning now keeps the read-only observer surface presentable for manual/observer testing and stops the invented aesthetic from being copied forward into future web views. Independent of the delivery spine — touches no data, RPC, query, subscription, or routing code.
- **Acceptance:**
  - `src/web/styles.css` carries the ported token system; no warm-palette tokens, body gradients, or `backdrop-blur` remain.
  - `src/web/components/` holds the ported primitives; the accent map is exhaustive over `NodePlane`, with a compile-time `satisfies Record<NodePlane, PlaneAccent>` guard, while reference-code labels stay canonical via `NODE_KIND_METADATA` + `kindOrdinal` (I43-L).
  - The three views render in the ported language: quiet metadata-row chrome, `plane / kind`-grouped node cards with canonical reference codes (`NODE_KIND_METADATA` labels + `kindOrdinal`) and plane-accented `KindBadge`/`CountBadge`, plain session card. The "Edge categories" summary is kept (restyled as `RefBadge` chips); the non-functional "Focus node" placeholder is removed.
  - Read-only contract preserved: no change to queries, RPC client, subscriptions, routes, or projection inputs.
  - Existing web tests preserved; only the two Focus-node assertions removed; `npm run verify` is green (28 web tests, oxlint type-aware clean, build clean).
- **Verification:** Inner — `npm run verify` (oxlint type-aware + oxfmt + vitest + build); update `src/web/app.test.tsx` and any view tests that assert retired class names / `aria-label`s. Outer — manual browser check of `/` and `/spec/$specId` against a seeded spec (`npm run seed` then launch web mode) to confirm the chrome, kind-grouped graph cards, and session panel match the prior trunk's look.
- **Topology materialization:** Stays inside `src/web` per D52-L (`web/` is a standalone build target; must not read SQLite/Pi RPC/JSONL directly). New `src/web/components/` owns ported primitives; only `src/web` imports from it. Component/style patterns are copied (not shared) from `../brunch`. Exception to `sourcing: strip-or-build`: the webfont packages `@fontsource-variable/inter` + `@fontsource-variable/geist-mono` were added with user approval (2026-06-09) — the fonts are the most visible design token; the "no new packages" line was not a hard rule.
- **Cross-cutting obligations:** Pre-release posture (`migration: free-rewrite`) — discard the invented design freely; do not preserve it for compatibility. Read-only invariant (D33-L one-writer/many-observer): this frontier adds no web write paths. Node reference codes must use the canonical `NODE_KIND_METADATA` projection (D62-L), not a web-local relabeling.
- **Traceability:** D10-L, D52-L, D62-L, D72-L / I43-L, I39-L.
- **Design docs:** `../brunch/src/client/index.css`, `../brunch/src/client/components/drawer-card.tsx`, `../brunch/src/client/components/knowledge-card.tsx` (reference source — separate checkout, not imported).

## Recently Completed
- 2026-06-09 `role-safe-graph-mutations` — Done: retired the remaining public `commitGraph` residue, extracted the shared mutation planner/writer out of `CommandExecutor`, and completed the last boundary migration so dev curation now exposes `dev.graph.mutateGraph` with role-named create-edge ops plus projected node-code / selected-spec edge-id resolution. Follow-up closure on the same frontier: reconciled the remaining product probes and current docs to the canonical `mutateGraph` / `mutate_graph` grammar, explicitly marked the checked-in 2026-06-05 fixture-curation artifact as historical pre-migration `commit_graph` evidence, and added role-named edge schema coverage across the Pi tool and dev RPC boundaries. Verified: `npx vitest run src/rpc/handlers.test.ts src/app/brunch.test.ts src/probes/fixture-curation-loop.test.ts src/probes/propose-graph-commit-proof.test.ts src/graph/mutate-graph-edge-schema.test.ts` and `npm run verify`.

- 2026-06-09 `dx-feedback-loops` (FE-825) — Done: bumped Brunch to the pi 0.79 line with a dev-only `PI_SOURCE` runtime alias, consolidated the dev front door around a shared faux harness and scripted faux launcher, and added the dev-gated read-only introspection extension plus `runBrunchIntrospectionTurn()` paired artifact writer now routed under `.fixtures/scratch/introspection/<run-id>`. Product runs omit introspection by default and keep the D39-L offline default; the dev launcher explicitly lifts offline mode for real-provider introspection. Verified: `src/.pi/__tests__/introspection.test.ts`, `src/dev/introspection-launcher.test.ts`, and `npm run verify`.

- 2026-06-08 `runtime-affordances-and-legality` — Done (00105108): added `src/projections/session/affordances.ts` owning the pure `(resolvedState, readinessGrade) → legal goal/strategy/lens options + default-on-switch` derivation; lifted the shared grade/AUTO legality tables into `src/projections/session/runtime-policy.ts` and refactored `src/.pi/agents/state.ts` to reuse that single legality source (no client-local reimplementation); added the closed coverage ledger to `src/session/README.md` with `src/session/runtime-affordances-coverage.test.ts` guarding the required agent rows while tripwiring `active-review-set` / `turn-mode` as explicit product-state-gated deferrals. Reconciled D40-L. Verified: `src/projections/session/affordances.test.ts`, `src/session/runtime-affordances-coverage.test.ts`, and `npm run verify`.

- 2026-06-08 `capture-quality-spike` — Done: added `src/probes/capture-quality-loop.ts` and a deterministic report test over free-prose, file/ref-bearing, and implication-heavy capture scenarios. The run artifact `.fixtures/runs/capture-quality/2026-06-08-capture-quality-sample/` records precision 1.0 / recall 1.0 with zero false commits from the sample extraction set and recommends graduating `exchanges-and-generalized-capture` narrowly, preserving a false-commit oracle for implication-heavy text. Verified: `src/probes/capture-quality-loop.test.ts` and `npm run verify`.

- 2026-06-08 `minimal-authority-shell` (FE-810) — Done: added the authority-matrix guard test over the current POC authority seam. The guard locks `CommandExecutor` mutation-result discriminants as the graph outcome vocabulary, proves `needs_human` is structured data rather than a TUI-only dialog, and asserts `elicit` tool authority comes from the shared projected runtime policy while blocking the identified side-effecting tools (`bash`, `edit`, `write`). No new authority service; `src/.pi/agents/state.ts` untouched; A18-L strict built-in suppression remains accepted Pi-upstream/API residue. Verified: `src/.pi/extensions/runtime/authority-matrix.test.ts` and `npm run verify`.

- 2026-06-08 cross-cut prompt-resource body-depth pass (Seam 3a/3b) — Done (1ca02e38): deepened every thin `src/.pi/skills/{goals,strategies,lenses,methods}` body to carry its per-axis facet guidance (goals→D59-L, strategies/lenses→README+D25-L, methods→D58-L tool-routing role), and added a manifest-wide readability/depth test in `src/.pi/agents/compose.test.ts` asserting every `{GOAL,STRATEGY,LENS,METHOD}_RESOURCES` location resolves and clears a ≥700-char floor. `state.ts` untouched. This closed the prompt-resource body-depth row, but the cross-cut is **not** exhausted: its Seam 3a `"what to ask next" driver` row (`partial · ●`) remains the last required row, now promoted to the `elicitation-driver` frontier. Verified: `npm run verify` (551 tests, build).

- 2026-06-08 `elicitation-backlog` (FE-823) — Done: materialized `elicitation_backlog` as a flat spec-scoped table with generated migration, seeded the grounding agenda at `createSpec`, routed create/close entry mutations through `CommandExecutor` on the shared `{specId, lsn}` / `change_log` boundary, and added graph-owned per-spec open-entry read-back. Reconciled D65-L/A24-L and updated graph/db topology docs. Verified: `src/graph/command-executor.test.ts`, `src/graph/queries.test.ts`, and `npm run verify`.

Older history (including `project-graph-review-cycle`, `topology-readmes-and-boundaries`, `capture-response-to-graph`, `dev-seed-fixtures` first tracer, `graph-tool-resilience`, spec-scoped graph-clock hardening, `agents-composition-layer`, `live-graph-observer`, `agent-graph-integration`, `spec-persistence-and-startup`, `sealed-pi-profile-runtime-state`, `pi-ui-extension-patterns`, `web-shell`, `jsonl-session-viability`, `mode-shell-and-fixture-driver`, `walking-skeleton`): `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
nodes:
  graph-tool-resilience          [done · P0]         materialized graph write contract and broadened A14 proof
  capture-response-to-graph      [done · P0]         structured answer -> graph truth -> observer update
  project-graph-review-cycle     [done · P1]         real project-graph review-set approval loop
  elicitation-backlog            [done · proving]    materialized D65-L prospective agenda substrate and read-back
  minimal-authority-shell        [done · P1]         thin safety posture for current POC paths
  poc-live-ship-gate             [next · P1]         final fresh-cwd composed product runbook
  dx-feedback-loops              [done · proving]    consolidated src/dev front door (faux/real/introspection loops) + latest-pi source-alias; sealed-profile-safe read-only introspection capture
  dx-introspection-live          [next · proving]    wire dormant introspection into real TUI; four-role .fixtures topology + --cwd; unify BRUNCH_DEV; conversational self-report
  graph-observed-shapes          [done · proving]    ratified consumer-specific observed-shape ledger + drift guard; no transport shape shipped
  runtime-affordances-and-legality [done · proving]  shared affordance(resolvedState, grade) derivation + coverage ledger; review-set/turn-mode rows tripwired
  role-safe-graph-mutations    [done · proving]    canonical mutateGraph/mutate_graph authored grammar; role-named edges; retire exposed commitGraph/commit_graph
  projection-shape-coverage      [next · coverage]   TRIO stage 1 (#project, PROJECT): create projections ledger + no-loss/shape invariants over dark graph/transcript DTOs; invariant-kind, NOT golden
  renderer-golden-coverage       [next · coverage]   TRIO stage 2 (#render, RENDER): create renderer ledger + golden-lock every durable renderer; depends on projection-shape-coverage
  prompt-composition-golden-coverage [next · coverage] TRIO stage 3 (#compose, COMPOSE): composed-prompt preview + golden-lock partials/composition matrix; depends on renderer-golden-coverage
  elicitation-driver             [after-trio · proving] live per-turn what-to-ask-next driver on FE-823 substrate; rides COMPOSE oracle; closes cross-cut Seam 3a
  exchanges-and-generalized-capture [after-trio · proving] bounded feature (NOT coverage): narrow extractive capture + false-commit guard + exchange symmetry audit
  capture-quality-spike          [done · spike]      A22-L fitness evidence graduated the narrow exchanges-and-generalized-capture feature
  probes-and-transcripts-evolution [parallel]        continuous evidence substrate
  topology-readmes-and-boundaries  [parallel]        attach-to-frontier topology hardening
  dev-seed-fixtures                [parallel]        rich seed data substrate for dev/observer testing
  web-design-system-port           [done · earned]     ported prior-trunk tokens + card primitives into src/web; retired invented warm aesthetic; read-only, no spine deps

edges:
  graph-tool-resilience     -[hard]->         capture-response-to-graph
  graph-tool-resilience     -[hard]->         project-graph-review-cycle
  capture-response-to-graph -[hard]->         poc-live-ship-gate
  graph-tool-resilience     -[hard]->         poc-live-ship-gate
  project-graph-review-cycle -[optional]->    poc-live-ship-gate
  minimal-authority-shell   -[hard]->         poc-live-ship-gate
  elicitation-backlog       -[hard]->         elicitation-driver
  graph-tool-resilience     -[hard]->         role-safe-graph-mutations      (current graph tool + edge model exist)
  project-graph-review-cycle -[hard]->        role-safe-graph-mutations      (current review-set proposal/accept path exists)
  role-safe-graph-mutations -[hard]->         exchanges-and-generalized-capture (relation-bearing capture uses mutateGraph grammar)
  role-safe-graph-mutations -[hard]->         dev-seed-fixtures              (semantic curation slice uses mutateGraph grammar)
  capture-quality-spike     -[evidence]->     exchanges-and-generalized-capture
  projection-shape-coverage -[hard]->         renderer-golden-coverage     (lock DTO shape before renderer golden)
  renderer-golden-coverage  -[hard]->         prompt-composition-golden-coverage  (lock rendered text before prompt golden)
  prompt-composition-golden-coverage -[oracle]-> elicitation-driver         (compose oracle underwrites per-turn driver)
  dx-feedback-loops         -[optional]->      role-safe-graph-mutations      (version-bump+alias is a shared unblocker; land before concurrent pi-facing churn)
  dx-feedback-loops         -[optional]->      projection-shape-coverage      (same shared unblocker; soft, not a hard gate — buildable independently)
  dx-feedback-loops         -[hard]->         dx-introspection-live          (built the dormant introspection machinery this frontier wires live + makes conversational)

parallel obligations:
  probes-and-transcripts-evolution -[evidence]-> every P0/P1 frontier
  topology-readmes-and-boundaries  -[boundary]-> every frontier that moves/claims source topology
  dev-seed-fixtures                -[data]->     capture-response-to-graph, poc-live-ship-gate (real multi-spec graphs to exercise observer/capture; semantic curation waits on role-safe-graph-mutations)

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
  - `elicitation-backlog` was the promoted D65-L *substrate* row from `memory/CROSS_CUT_PLAN.md`; the prompt-resource body-depth pass landed in 1ca02e38. The cross-cut is **not** exhausted: its Seam 3a `"what to ask next" driver` row is still `partial · ●`, which by the seam DoD keeps the seam open. That row is now disposed as the `elicitation-driver` frontier (not residue), so the remaining cross-cut obligation has a named owner in `PLAN.md`.
  - Parallel worktree streams (2026-06-08): all three landed — (A) `crosscut-know--resource-body-depth` (1ca02e38), (B) `graph-observed-shapes--coverage-ledger` (85e73ba7), (C) `minimal-authority-shell--audit-and-guard` (68474e3f); each kept to its declared write paths and left `src/.pi/agents/state.ts` untouched, so the parallel run produced no collisions. `poc-live-ship-gate` is now unblocked (its hard dependency `minimal-authority-shell` is done). `runtime-affordances-and-legality` has since landed (00105108). The 2026-06-08 ln-plan coverage re-classification then found the coverage layer mostly closed: `graph-observed-shapes` + `runtime-affordances` are done coverage, `exchanges-and-generalized-capture` is reclassified to a bounded proving feature (the remaining unknown is capture semantics, not breadth closure), and the genuinely-open coverage was then deepened (same-day per-plane pass) into the **context-pipeline coverage trio** — `projection-shape-coverage` → `renderer-golden-coverage` → `prompt-composition-golden-coverage`, now the dependency-ordered near-term spine (see the trio note below and the Context §Context-pipeline coverage section). This superseded the earlier "two discretionary locking frontiers, precedence to `elicitation-driver`" disposition.
  - Completed prerequisites: `agents-composition-layer` supplies runtime prompt/resource posture, and `live-graph-observer` supplies the read-only web observer path expected by `capture-response-to-graph` and `poc-live-ship-gate`.
  - `graph-observed-shapes` is intentionally consumer-specific: do not assume every agent read shape belongs on the web observer.
  - `role-safe-graph-mutations` folds the prior role-named edge-surface card and semantic graph-mutation curation card into one frontier. The canonical authored graph command becomes `mutateGraph` / `mutate_graph`; role-named endpoint fields are normalized through `EDGE_CATEGORY_METADATA`; exposed `commitGraph` / `commit_graph` is retired by break-and-repair rather than kept as a weaker parallel API. Downstream capture and dev curation must not reintroduce `{category, source, target}` at authored boundaries.
  - `exchanges-and-generalized-capture` is a bounded proving feature, not coverage: the remaining load-bearing unknown is capture semantics, not breadth closure. The exchange surface is largely built across the three layers, with some breadth still deferred / topology-stubbed (`present-candidates`). Scope high-confidence extractive capture with a false-commit guard, do not regrow deleted `capture-*` symmetry, and treat the exchange three-layer audit as delete-oriented (drop unjustified `projections/exchanges` / `renderers/exchanges` mirrors), not breadth-building.
  - **Context-pipeline coverage trio (the near-term spine, 2026-06-08 deep per-plane pass).** The four LLM-facing context concerns are one pipeline — PULL → PROJECT → RENDER → COMPOSE (D60-L). PULL has **two halves**: the *graph* read surface is the done template (`graph/queries.ts` + `src/graph/README.md`: behavioral oracle for all 8 shapes + drift guard + real ledger), but the *session* read surface (`session/workspace-context`, `workspace-session-coordinator`, `runtime-state`) is tested-but-un-ledgered and must be ledgered before the session/workspace projections lock against it. The trio closes the other three stages **in dependency order**, each completing its plane's **full ledger** via the human-in-the-loop design→lock rhythm. Oracle kind differs by stage: info-preserving stages want **invariant/no-loss** locks, lossy stages want **golden** locks. The PROJECT ledger (`src/projections/README.md`, authored 2026-06-08) applies an **earns-its-place gate before the oracle gate** — `workspace/workspace-context` is `✗` delete/inline (single-consumer tag wrapper), and the plan's earlier "dark zone = graph/{overview,commit-result,reconciliation-needs}" was wrong: those are `export {}` topology stubs (`○`), not dark implementations.
  - `projection-shape-coverage` (TRIO stage 1, `#project`) is the genuinely-new finding. Ledger authored in `src/projections/README.md`. The real `●` survivors are `graph/neighborhood`, `session/transcript-context`, `session/runtime-state`, `workspace/workspace-state`; `workspace/workspace-context` is `✗` delete/inline; the graph projection stubs (`overview`, `commit-result`, `reconciliation-needs`) are `○` topology stubs, not dark. Also carries the PULL-session read-shape ledger prerequisite. Lock with shape/no-loss invariants — **not goldens** (wrong tool for an info-preserving DTO; can't catch silent field-drop). Do it first; it stabilizes the shapes renderer goldens lock against.
  - `renderer-golden-coverage` (TRIO stage 2, `#render`) **depends on stage 1**: only `graph/neighborhood` + `session/runtime-frame` are golden-locked; the rest are dark or only transitively covered via the `.pi` adapter. Create the renderer ledger (README claims one that does not exist), extend the preview harness past `graph-neighborhood`. Bound to durable renderers (exclude `markdown.ts` / `toon.ts` helpers and topology stubs). Never a ship gate.
  - `prompt-composition-golden-coverage` (TRIO stage 3, `#compose`) **depends on stage 2**: `compose.test.ts` / `prompting.test.ts` are invariant-rich but no golden of partial bodies or composed output exists and there is no composed-prompt preview harness. Add the preview, golden-lock partials + a composed-prompt matrix. `elicitation-driver` rides on this stage's locked oracle and follows it. Never a ship gate.
  - `project-graph-review-cycle` is complete evidence for the optional batch proposal/review story; keep future review-quality work as follow-up, not FE-809 completion debt.
  - `topology-readmes-and-boundaries` is not a license for abstract cleanup; it rides with concrete delivery seams.
  - Multi-spec workspace discipline applies throughout: target the selected/current spec explicitly; no workspace-global graph truth in the POC.
```
