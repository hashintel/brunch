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

**Readiness / elicitation-gaps remodel promoted (2026-06-09 ln-plan, post-`ln-spec`).** A SPEC pass reconceived the readiness and prospective-agenda model and must now land in code (D45-L, D57-L, D64-L, D65-L, D73-L, D74-L; A24-L, A27-L; I25-L, I30-L, I31-L). Four coupled implications: (1) **`elicitation_backlog` → `elicitation_gaps`** — the FE-823 question-instance / `open|closed` table is remodeled into typed coverage *obligations* (each gap carries a `name` typology key + meta `rationale`, a band, a `presence|field|coverage|manual` predicate union, an `importance` + derived `coverage`, and a `disposition`), seeded from the collated **grounding typology catalog** (floor `domain`/`protagonist`/`pain_pull`/`constraint` + progressive drivers `value`/`context_of_use`/`success_sketch`/`solution_boundary`) instead of four literal anchor questions; (2) **JIT capability-readiness** replaces the stored grade gate — readiness is judged on a capability request against the relevant gaps (proceed / proceed-at-low-epistemic-status / negotiate), retiring `readiness_grade`, `updateReadinessGrade`, `READINESS_GRADES`, and the `MIN_GRADE` proxy tables in `runtime-policy.ts`; (3) a soft derived **readiness estimate** (UI-only, gates nothing) plus removal of the vestigial `chrome.phase` / `chrome.chatMode` fields; (4) a small follow-on **session/runtime vocabulary leaf** (`src/session/schema/kinds.ts`) mirroring `graph/schema/kinds.ts` for the `op_mode`/`strategy`/`lens`/`goal` axes. These are promoted as `elicitation-gaps-remodel` → `capability-readiness` (hard chain) plus the parallel `runtime-vocab-leaf`; none are POC-ship-critical (the delivery cut de-scopes elicitation quality). **Sequencing tension with the trio:** `capability-readiness` mutates exactly the shapes the trio would lock (`workspace/workspace-state` drops phase/chatMode and gains the readiness estimate; `session/runtime-state` + composition drop grade). By the trio's own "lock upstream shape before downstream output" principle, the gaps/readiness remodel is *upstream* of the trio's readiness/chrome-touching locks and should land before stage 1 (`projection-shape-coverage`) freezes those shapes — otherwise the locks churn. Recommended order: `elicitation-gaps-remodel` → `capability-readiness` first, then the trio; or, if the trio leads, it must explicitly bracket the grade/phase/chatMode fields until the remodel lands. `elicitation-driver` now rides the remodeled gaps substrate, not the FE-823 backlog shape. **2026-06-10 follow-on (D75-L):** a further SPEC pass collapsed the parallel grounding-typology vocabulary onto the node-kind ontology — gaps now reference graph node kinds (`refersTo: NodeKind`) instead of a closed typology `name` enum. This inserts `gaps-node-kind-reference` at the head of the chain (`elicitation-gaps-remodel` → `gaps-node-kind-reference` → `capability-readiness`); it reshapes the gaps substrate and the `capability → NodeKind[]` map, and absorbs the now-retired refactor plan (which had planned to enshrine the typology catalog).

**Turn-boundary choreography promoted as core mechanics (2026-06-10 ln-plan, post-`ln-spec` D76-L–D78-L / I45-L–I47-L).** The runtime "Tier-2" layer — what enters the transcript at a turn boundary and who originates the next turn — is being specced and scoped *now*, not deferred to M7-as-fog, because it is core product choreography and the concept is fresh. SPEC locked three decisions (assistant-visible watermark D76-L; one-writer reconciler + aux seams/guard D77-L; honest kick + context seeding D78-L), sharpened I9-L, and added I45-L–I47-L plus a **coverage-first scaffold** design note (author the layer's whole invariant suite up front, skip/`todo` each test until its enabling slice lands). The layer decomposes into a slice map S0–S5: **S0** is the Tier-2 *chassis* (DX only, thin) on **FE-847** — real `runBrunchTui` boot, one faux model turn, provider-payload capture, transcript inspection, fixture resume — plus authoring the skipped coverage-first scaffold and the topology stubs the product slices fill. **S1–S3 + S5(share)** are product write-side mechanics owned by **`turn-boundary-reconciliation` (M7)**: S1 assistant-visible watermark projection, S2 the `prepareNextTurn` reconciler + `worldUpdate` + own-write/full-overview watermark stamping, S3 the submit-time mention ledger + staleness. **S4 + S5(share)** are the **`kick-and-context-seeding`** grouping: honest assistant-origination behind `session.triggerExchange` plus boot/resume context seeding. S5 (boot idempotence + carrier discipline, I47-L) is a cross-cutting obligation threaded through both product groupings, not its own frontier. The original 2026-06-10 FE-847 execution decision kept S0–S5 as one sequential closure chain rather than separate issues/frontiers; a 2026-06-11 branch-mechanics override then split that chain across two FE-847 branches for stack health: `dx-tier-2-harness` remained on `ln/fe-847-dx-introspection-tier-2`, while `turn-boundary-reconciliation` and `kick-and-context-seeding` continue together on stacked successor `ln/fe-847-turn-boundary-closure`. The scaffold's first tests must encode three edge cases locked into SPEC: (a) seed/full-overview snapshots advance the watermark while narrow `getNodes`/`queryNodes` reads do not; (b) no redundant `worldUpdate` immediately after a seed that named the current snapshot LSN; (c) the resume kick decision is taken on the **pre-reconcile** tail, so a user tail still earns a kick even after the reconciler inserts seed/staleness notices ahead of it. None of this is POC-ship-critical; the S0 chassis is buildable now.

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

- (none) — the FE-847 turn-boundary closure and `projection-shape-coverage` both completed 2026-06-11. Next sequenced work is `renderer-golden-coverage` via `memory/cards/renderer-golden-coverage--render-stage-chain.md`. The handed-off `0004_gaps_node_kind_reference` migration coherence concern is addressed by this branch's migration rewrite; verify `src/db/connection.test.ts` before treating that residue as closed.

### Recently Completed

- 2026-06-11 **Turn-boundary choreography (Tier-2 layer) complete** — `turn-boundary-reconciliation` and `kick-and-context-seeding` both done on FE-847 (`ln/fe-847-turn-boundary-closure`); every I45/I46/I47 scaffold row runs live through real boot/restart; full definitions retained below for re-entry. The same branch carried the review-fix remediation (PR-comment defects fixed at top of stack, user-routed) and the typing-collapse refactor (canonical editor envelope, projected outcome union, shared grounding-gap fixture builder).
- 2026-06-11 `projection-shape-coverage` — done on the top-of-stack coverage branch; the session PULL ledger and PROJECT invariants are closed, and the prepared renderer chain is the next trio move.
- 2026-06-11 `capability-readiness` — done after the grade-deletion sweep plus the remediation's live-wiring closure and prompt-authority follow-on (required `getElicitationGaps`, conservative-fallback deletion, Tier-2 legality oracle; role/mode-legal pins remain visible while gated methods/tools carry readiness negotiation); definition retained below.
- 2026-06-10 `gaps-node-kind-reference` — done; gaps reference node kinds per D75-L (definition archived).
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md` (12 definitions archived 2026-06-11).

### Next

The near-term spine has two tracks. The **context-pipeline coverage trio** remains the elevated product-coverage spine, sequenced in strict dependency order (lock upstream shape before downstream output). `role-safe-graph-mutations` is a graph-mutation grammar frontier that can run before or alongside the trio, and must land before relation-bearing generalized capture or semantic fixture curation rely on the new mutation surface. The `dx-feedback-loops` DX substrate, its `dx-introspection-live` follow-on, and the FE-847 turn-boundary closure are all complete and no longer gate this list.

1. `projection-shape-coverage` — **done 2026-06-11.** PROJECT stage (`#project`); invariant / no-loss kind. Ledger authored in `src/projections/README.md`. The session PULL read surface (`session/workspace-context`, `workspace-session-coordinator`, `runtime-state`) is inventoried in `src/session/README.md`; the false `workspace/workspace-context` wrapper is deleted/inlined; every surviving direct projection row now carries a co-located invariant (`session/transcript-context`, `workspace/workspace-state`, `session/runtime-state`); and the exchange family is explicitly resolved as **keep-transitive** via existing `.pi` / session / probe proofs rather than new symmetry tests. `graph/neighborhood` is demoted to a direct graph PULL read/topology stub rather than a PROJECT survivor. The graph projection stubs (`neighborhood`, `overview`, `commit-result`, `reconciliation-needs`) are `export {}` topology stubs, **not** dark implementations.
2. `renderer-golden-coverage` — **RENDER stage** (`#render`); golden + invariant kind. **Depends on `projection-shape-coverage`.** Create the renderer ledger (README claims one that does not exist), extend the preview harness past `graph-neighborhood`, and golden-lock every durable renderer (only `graph/neighborhood` + `session/runtime-frame` are locked; the rest are dark or only transitively covered via the `.pi` adapter).
3. `prompt-composition-golden-coverage` — **COMPOSE stage** (`#compose`); golden + invariant kind. **Depends on `renderer-golden-coverage`.** Add a composed-prompt preview harness, golden-lock partial bodies and a representative composed-prompt matrix (axis × readiness × pin) on top of the existing invariants. `elicitation-driver` rides on this stage's locked oracle, so it follows.

### After the trio

6. `elicitation-driver` — **bounded feature; cross-cut closing row** (not itself coverage): closes the last open required cross-cut row (Seam 3a `"what to ask next" driver`) and retires the temporary dual-plan state. Now rides the **remodeled `elicitation_gaps` substrate** (depends on `elicitation-gaps-remodel`), not the FE-823 backlog shape — read open gaps → rank by importance/coverage/band → select next question; capture-reflection spawns/closes gaps. Pairs with the COMPOSE stage (it adds per-turn behavior over the composition oracle locked there); not POC-ship-critical.
7. `exchanges-and-generalized-capture` — **bounded proving feature** (not coverage): the remaining load-bearing unknown is capture *semantics*, not breadth closure. Narrow high-confidence extractive capture with a false-commit guard; treat any exchange-layer cleanup as delete-oriented audit, not breadth fill. Relation-bearing capture must use the role-named `mutateGraph` grammar from `role-safe-graph-mutations`; do not revive `{category, source, target}` in a capture-local edge dialect.

### Delivery gate (in flight, independent)

- `poc-live-ship-gate` — FE-811 delivery gate; only the final fresh-cwd runbook remains (live-mention-autocomplete + ship-gate residue landed 2026-06-08 on `ln/fe-811-ship-gate-residue-and-mentions`, PR #179). Proceeds on its own branch; not a coverage frontier and does not compete with the trio for design attention.

### Parallel / Low-conflict

- `probes-and-transcripts-evolution` — continuous probe/report/transcript hardening as each delivery frontier lands evidence.
- `topology-readmes-and-boundaries` — small doc/test hardening when a frontier moves files or exposes a boundary; should remain attached to the frontier when possible rather than becoming an abstract cleanup project.
- `dev-seed-fixtures` — **partially built as a folded-in FE-848 DX hardening slice**: clarified the seed/workbench contract from SPEC D79-L, replaced the catch-all current-cwd `npm run seed` flow with explicit target-workspace + seed selection, and proved one seeded workbench through `npm run dev -- --cwd ...` / product RPC. Remaining follow-up is the seed disposition catalog and optional explicit all-seeds opt-in. Its semantic curation mutation slice is complete via `role-safe-graph-mutations`; ongoing seed-data maintenance remains low-conflict.
- `dx-introspection-live` — done 2026-06-11. DX follow-on to `dx-feedback-loops`: hardened the four-role `.fixtures/` topology + `--cwd` launch (D70-L), unified dev gating under `BRUNCH_DEV`, wired introspection into the real TUI (D71-L), made introspection conversational (A26-L), and added the workspace-local `.brunch/debug/` cache for final system prompt + Brunch-owned tool-result contents. `tool-renders` flattening remains deferred until a concrete renderer-debugging need appears.
- `runtime-vocab-leaf` — establish `src/session/schema/kinds.ts` as the drizzle-free source-of-truth leaf for the session/runtime axis enums (`op_mode`, `strategy`, `lens`, `goal`, `auto` sentinel), mirroring `graph/schema/kinds.ts` (D73-L ownership direction). The decision-3 follow-on; independent of the remodel chain and the trio. Must not recreate `READINESS_GRADES` (retired by `capability-readiness`).

### Horizon

- `coherence-first-class` — M8; bounded coherence verdicts backed by reconciliation needs.
- `compaction-and-conflict-widening` — M9; long-horizon continuity through compaction.
- `subagents-for-proposal-diversity` — optional proposal-quality enhancement; never a POC blocker.
- `oracle-design-plan-graphs` — lift oracle/design/plan planes from stubs after the POC delivery spine works.
- `flue-pattern-adoption` — post-POC harness-pattern adoption.
- `framework-direction-stubs` — discretionary structural stubs only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

## Frontier Definitions

### turn-boundary-reconciliation

- **Name:** Turn-boundary reconciliation — assistant-visible watermark, `worldUpdate`, mention staleness
- **Linear:** FE-847 — built as a slice group under the FE-847 issue; no separate issue.
- **Branch:** `ln/fe-847-turn-boundary-closure` (stacked successor FE-847 branch, shared with `kick-and-context-seeding`).
- **Kind:** structural / product mechanics (M7)
- **Status:** done 2026-06-11 (turn-boundary choreography; not POC-ship-critical)
- **Certainty:** proving
- **Retires:** A4-L (the remaining "M7 still needs generated `worldUpdate` traces" subclaim) and A9-L (session-scoped `(entity_id, seen_lsn)` mention-ledger granularity is the right staleness grain).
- **Depends on:** `dx-tier-2-harness` chassis + scaffold (same branch; the chassis is the oracle these slices assert through and supplies the topology stubs they fill).
- **Lights up:** The write-side of continuity — a single `prepareNextTurn` reconciler that projects the assistant-visible watermark, samples `current_lsn`, and inserts `worldUpdate` / mention-staleness / side-task drains, plus submit-time mention resolution and own-write watermark stamping.
- **Stabilizes:** I45-L (watermark advance correctness), I9-L (submit-time mention resolution, `(entity_id, seen_lsn)` ledger), and its share of I47-L (carrier discipline / boot idempotence).
- **Objective:** Build the product write-side of turn-boundary choreography behind the FE-847 chassis. **S1** — assistant-visible watermark projection (D76-L): project `{specId, lsn}` from the session's watermark carriers (boot/context seed + whole-spec overview snapshot, `worldUpdate`, own graph-mutation `toolResult`); narrow `getNodes`/`queryNodes` reads update per-entity read ledgers, never the global watermark. **S2** — the one-writer `prepareNextTurn` reconciler (D77-L): compute watermark, sample `current_lsn`, insert `worldUpdate` naming only strictly-greater items (I4-L), with own-mutation + full-overview watermark stamping and `before_provider_request` as a guard only. **S3** — submit-time mention resolution + staleness (I9-L): resolve `#` handles to stable graph ids at `session.submitMessage`, append `brunch.mention` ledger facts, emit discretionary staleness hints when an entity changed since `seen_lsn`. Flip the corresponding FE-847 scaffold tests live.
- **Why now / unlocks:** Specced now as core mechanics while the concept is fresh (Context §Turn-boundary choreography). The watermark + reconciler are the substrate `kick-and-context-seeding` and later M8 coherence build on. Not POC-ship-critical.
- **Acceptance:**
  - The watermark advances only via seed/full-overview snapshot, `worldUpdate`, or own mutation; narrow reads never advance the global watermark; a freshly seeded session whose seed named the current snapshot LSN does not synthesize a redundant `worldUpdate` (I45-L edge cases live).
  - `worldUpdate` is synthesized only when `current_lsn > watermark`, names only strictly-greater items, and is carried as a Brunch custom transcript entry (never a synthetic `toolCall` or prompt-only injection).
  - Mentions resolve to stable graph ids at submit time (not autocomplete time), the ledger stores `(entity_id, seen_lsn)`, and staleness hints fire only when an entity changed since it was last seen (I9-L).
  - The reconciler is the single continuity writer; `before_provider_request` only guards (asserts no stale unresolved continuity) and never double-writes.
  - The relevant FE-847 scaffold tests are flipped live (no slice lands green leaving its own tests skipped).
- **Verification:** Inner — watermark-projection property/unit tests (own-write stamping vs foreign `worldUpdate`; strict-greater set per I4-L; no-`worldUpdate` when `current==watermark`; seed/overview advance vs narrow-read no-advance). Middle — Tier-2 faux-turn-through-real-boot assertions over change-log-range fixtures driving a foreign writer; mention resolution against fixture graph data. (SPEC §Verification Design rows I45-L, I47-L.)
- **Cross-cutting obligations:** Continuity facts ride Brunch custom transcript entries (D37-L), never synthetic `toolCall`s or prompt-manifest injection (carrier discipline, I47-L). Multi-spec discipline: watermark is `{specId, lsn}`; never compare bare LSNs across sibling specs (I4-L). The reconciler runs **before prompt composition**; `before_provider_request` is a guard that on post-prepare drift **re-runs preparation once** (abort/retry), never a second writer (D77-L). Same-session submit/capture writes (D18-L/D66-L) are not own-mutation `toolResult`s — they advance `current_lsn` and must be surfaced by the next `worldUpdate`, not swallowed (I45-L). The watermark must survive compaction (preserved-anchor set retains the latest watermark carrier so projection never regresses, I47-L). Boot/resume reconciliation is idempotent, deriving dedupe from projected transcript state, not hidden flags (I47-L, shared with `kick-and-context-seeding`). Side-task/reviewer drains (D15-L) belong to this reconciler seam.
- **Topology materialization:** The `prepareNextTurn` reconciler and watermark projection land at their final homes (`src/session/` reconciler, `src/projections/session/` watermark) filling the FE-847 topology stubs; submit-time mention resolution at `session.submitMessage`; tool-result watermark stamping at the graph read/mutation adapters.
- **Traceability:** D14-L, D15-L, D17-L, D37-L, D43-L, D49-L, D76-L, D77-L; A4-L, A9-L; I1-L, I4-L, I9-L, I45-L, I47-L.
- **Design docs:** `memory/SPEC.md` D76-L–D77-L, I9-L, I45-L, I47-L; `src/session/README.md`; `src/projections/README.md`; `src/projections/session/runtime-state.ts`.
- **Current execution pointer:** Done 2026-06-11 on FE-847. The Tier-2 I45 scaffold is live, the live provider guard delegates to `guardBeforeProviderRequest`, submit-time mention facts feed the live reconciler staleness path, side-task/reviewer drains are threaded through the adapter, and the compaction anchor contract preserves the latest watermark carrier family (`brunch.context_seed`, `brunch.graph_overview_snapshot`, `brunch.own_mutation`, `worldUpdate`). **Residue closed 2026-06-11:** the S5/I47 rows now run live (dedicated post-seed `worldUpdate` row through real boot; boot/resume dedupe across an actual restart). The remediation pass also moved the live `before_provider_request` hook onto `guardBeforeProviderRequest` retry semantics and threaded transcript-projected mentions (plus the optional drains supplier) through the production adapter.

### kick-and-context-seeding

- **Name:** Session origination — honest kick + boot/resume context seeding
- **Linear:** FE-847 — built as a slice group under the FE-847 issue; no separate issue.
- **Branch:** `ln/fe-847-turn-boundary-closure` (stacked successor FE-847 branch, shared with `turn-boundary-reconciliation`).
- **Kind:** structural / product mechanics
- **Status:** done 2026-06-11 (turn-boundary choreography; not POC-ship-critical)
- **Certainty:** proving
- **Retires:** the R16 origination gap — proof that a structured-strategy session can originate its own offer-first turn honestly (no fabricated user entry) and seed context idempotently across real restart/resume.
- **Depends on:** `turn-boundary-reconciliation` (S1 watermark projection + S2 reconciler — the seed must advance the watermark and the kick decision interacts with reconciler-inserted notices) and the `dx-tier-2-harness` chassis. Sequenced last in the FE-847 slice chain.
- **Lights up:** Honest session origination — `startAssistantTurn({ origin })` surfaced through `session.triggerExchange`, plus boot/resume context seeding as custom continuity entries.
- **Stabilizes:** I46-L (honest origination + pre-reconcile-tail resume policy) and its share of I47-L (boot/resume seed idempotence + carrier discipline).
- **Objective:** Build the write-side of origination (S4) behind the FE-847 chassis, sequenced after the reconciliation slices on the shared successor FE-847 branch. A **new** session seeds workspace/spec-overview context as custom continuity entries (D76-L; the seed names the snapshot LSN and so initializes the watermark), then kicks an assistant-originated `present_*` exchange. A **resumed** session takes the kick decision from the **pre-reconcile** transcript tail: kick iff that tail owed assistant continuation (user message or incomplete exchange-tuple), even after the reconciler inserts seed/staleness notices ahead of it; otherwise rest at a `request_*`/system leaf. AUTO always originates offer-first (D66-L: AUTO never selects `freestyle`); only an explicit `freestyle` pin yields a wait-for-user idle. Carries its share of S5 — boot/resume seeding is idempotent (dedupe derived from projected transcript state, survives real restart) and continuity rides custom entries only. Flip the corresponding FE-847 scaffold tests live.
- **Why now / unlocks:** The offer-first default (R16, D12-L, I13-L) has a read side but no honest write-side origination; specced now as core mechanics. Kept a distinct planning unit from M7 reconciliation because it is origination, not reconciliation; executed as the final FE-847 slice group, not a separate branch. Not POC-ship-critical.
- **Acceptance:**
  - Origination never writes a fabricated user transcript entry and never injects a "user said begin" prompt; the kick is `startAssistantTurn({ origin })` surfaced via `session.triggerExchange`.
  - A new session seeds-then-kicks before the first provider call; the seed names the snapshot LSN so no redundant `worldUpdate` is synthesized immediately after seeding (I45-L edge case, with M7).
  - A resumed session's kick decision classifies the latest unresolved conversational debt (ignoring trailing continuity-only entries): a user tail still earns a kick after the reconciler inserts seed/staleness notices; a `request_*`/system leaf stays idle; a crash-after-notice-before-provider reboot still kicks when the underlying debt is unanswered (idempotent re-boot, I46-L edge cases).
  - AUTO never originates a `freestyle` turn; only an explicit `freestyle` pin idles for the user.
  - Boot/resume seeding is idempotent (repeated boot does not duplicate seed/`worldUpdate`; dedupe derived from projection) and survives real restart/resume (I47-L).
  - The relevant FE-847 scaffold tests are flipped live.
- **Verification:** Middle — Tier-2 faux-turn-through-real-boot assertions: new session seeds-then-kicks before the first provider call; resumed-session kick fires on a user pre-reconcile tail even behind inserted notices, and stays silent at a `request_*`/system leaf; no fabricated user entry in any path; AUTO never originates `freestyle`. Restart/resume idempotence property tests (repeated boot does not duplicate seed/`worldUpdate`). Outer — manual walkthrough of opening-offer quality (tracked, not gated). (SPEC §Verification Design rows I46-L, I47-L.)
- **Cross-cutting obligations:** Honest origination — no fabricated user turns, ever (I46-L). Continuity facts ride Brunch custom transcript entries (D37-L), never synthetic `toolCall`s or prompt-only injection (I47-L). Boot idempotence derives from projected transcript state, not hidden flags (I47-L, shared with `turn-boundary-reconciliation`). This is product behavior on the non-D39-L-seal side, not a `BRUNCH_DEV` affordance.
- **Topology materialization:** The origination primitive (`startAssistantTurn`) lands in the session orchestration layer (`src/session/`) filling the FE-847 stub; `session.triggerExchange` is the public surface (D49-L); context seeding writes custom continuity entries through the same carrier as `worldUpdate`.
- **Traceability:** D12-L, D37-L, D49-L, D66-L, D75-L, D76-L, D78-L; R16; I13-L, I46-L, I47-L.
- **Design docs:** `memory/SPEC.md` D78-L, I46-L, I47-L; `src/session/README.md`.
- **Current execution pointer:** Done 2026-06-11 on FE-847 (closure completed by the review-fix remediation pass). All I46/I47 Tier-2 scaffold rows run live with no skips/todos: new-session seed-then-kick through real boot; resume kick on the pre-reconcile user tail (including behind continuity notices and after earlier completed exchanges — the prior blanket exchange-result suppression was a real bug); `request_*` leaves idle against the **real** result envelope (outcome is `answered`/`cancelled`/`unavailable` key presence per `projections/exchanges`, not a status string — the prior classifier read a field that never exists and would have re-kicked answered tails); crash-after-notice reboot kicks without duplicating the seed; drains neither manufacture nor mask debt; boot/resume dedupe proven across an actual restart via `rebootTier2Runtime`. Kick origin now derives from projected transcript state (no message entries = new session), not entry counts.

### capability-readiness

- **Name:** JIT capability-readiness over gaps; retire the stored readiness grade
- **Linear:** unassigned — create in FE / brunch when the frontier starts.
- **Kind:** structural
- **Status:** done — completed 2026-06-11 after the grade-deletion sweep
- **Certainty:** proving
- **Depends on:** `gaps-node-kind-reference` (hard — the gate reads node-kind-referencing gaps and a `capability → NodeKind[]` map; transitively `elicitation-gaps-remodel`, done).
- **Retires:** the stored `readiness_grade` scalar and grade-as-authority (D45-L); A27-L (the `capability → relevant gaps` map carries enough signal to drive proceed / negotiate without a standing grade).
- **Lights up:** capability-readiness — on a capability request, evaluate the relevant `elicitation_gaps` → **proceed / proceed-at-low-epistemic-status / negotiate** (`establishment_offer`) — replacing `MIN_GRADE` gating.
- **Stabilizes:** I31-L (readiness never bars work; no grade scalar; no kind whitelist) and I25-L (legal affordances are projections over resolved runtime state plus capability-readiness over gaps).
- **Objective:** Replace the grade gate with JIT capability-readiness. (1) Remove `specs.readiness_grade`, `updateReadinessGrade`, and `READINESS_GRADES`; (2) replace `GRADE_RANK` / `GOAL_MIN_GRADE` / `STRATEGY_MIN_GRADE` / `LENS_MIN_GRADE` in `src/projections/session/runtime-policy.ts` with the `capability → NodeKind[]` map from `gaps-node-kind-reference` (D75-L) plus JIT evaluation (structural predicates checked mechanically; `manual` gaps consume an LLM satisficiency judgment, D57-L); (3) add the soft, derived, UI-only `readiness estimate` (per-band coverage rollup over gaps) projection; (4) remove the vestigial `chrome.phase` / `chrome.chatMode` fields from `workspace-session-coordinator.ts` and `workspace-state.ts` (the readiness estimate supersedes `phase`; `chatMode` was a redundant spec-selection restatement).
- **Why now / unlocks:** D45-L/D74-L retired the grade as a conflation of gate/display/milestone; this materializes the replacement so goal derivation, affordance legality, and prompt composition stop reading a grade. It also removes the grade/phase/chatMode fields the trio would otherwise lock prematurely.
- **Acceptance:**
  - No `readiness_grade` column, `updateReadinessGrade` mutation, or `READINESS_GRADES` enum remains; affected fixtures/seeds/probes regenerated.
  - `runtime-policy.ts` gates capabilities via an explicit `capability → relevant gaps` map; no `MIN_GRADE` proxy tables remain.
  - A capability request yields proceed / proceed-at-low-epistemic-status / negotiate; readiness never refuses outright (I31-L).
  - The readiness estimate is derived, UI-surfaced, and gates nothing (may regress honestly).
  - `chrome.phase` / `chrome.chatMode` are removed from the coordinator and workspace-state projection; the readiness estimate is the only readiness surface.
- **Verification:** Inner — capability-readiness unit tests (a structural gap flips readiness with no grade; a `manual` gap routes to satisficiency); readiness-estimate projection test (regresses honestly, gates nothing); affordance legality over gaps (replacing the grade-gate tests). Middle — D74-L tracer: a presence-derived grounding gap flips capability-readiness with no stored grade. Outer — composed-prompt + web observer surface the readiness estimate, not a grade.
- **Cross-cutting obligations:** Readiness never bars graph truth or work (I31-L); `CommandExecutor` must not reject a node for a later-band kind (D64-L). The deferred milestone gate for export/plan/execute op-modes stays deferred (D45-L). Replace grade-gate tests across `compose.test.ts` / `prompting.test.ts` and createSpec/getSpec rather than preserving them.
- **Traceability:** D25-L, D30-L, D32-L, D45-L, D57-L, D58-L, D59-L, D64-L, D65-L, D73-L, D74-L, D75-L / A27-L / I25-L, I31-L. Supersedes stored-grade gating and the `chrome.phase` / `chrome.chatMode` fields.
- **Design docs:** `memory/SPEC.md` D45-L / D74-L; `src/projections/session/runtime-policy.ts`; `src/projections/workspace/workspace-state.ts`.
- **Current execution pointer:** Done 2026-06-11. Slices 1–5 moved all legality and display consumers from the old grade/phase-era fields to selected-spec `ElicitationGap[]` / derived readiness estimates. The final grade-deletion sweep removed `specs.readiness_grade`, `updateReadinessGrade`, `READINESS_GRADES`, `ReadinessGrade`, and `AgentPromptSpecContext.readinessGrade`; regenerated migration metadata; stripped readiness grade from seed/export fixture contracts and JSON seed files; and removed probe setup calls that only advanced the legacy grade. `createSpec` / `getSpec` now carry only spec identity (`id`, `name`, `slug`), and readiness remains gap-derived at the consumers. The 2026-06-11 live-gap legality follow-on made `GraphReaders.getElicitationGaps` required, wired the live TUI composition root to the selected-spec reader, and deleted the silent conservative prompt fallback so missing legality reads are type-visible instead of floor-locking live sessions. The 2026-06-11 prompt-authority follow-on kept pinned goal/strategy/lens selections visible in manifests when role/mode-legal and moved readiness pressure onto gated methods/tool routes, so negotiation no longer crashes prompt composition.
- **Residual risks / follow-ons:** The current `capability → NodeKind[]` map still uses the coarse shared grounding floor (`context` / `thesis` / `goal` / `constraint`) for multiple capabilities, so finer per-capability obligation maps remain future work. `manual` gap satisficiency still lacks a real evaluator path, so D57-L is only structurally/tracer-proven today.

### runtime-vocab-leaf

- **Name:** Session/runtime vocabulary source-of-truth leaf
- **Linear:** unassigned
- **Kind:** tooling / dev-substrate (small structural)
- **Status:** parallel / low-conflict
- **Certainty:** proving (low blast radius)
- **Stabilizes:** D73-L's ownership direction extended to the runtime/session axes — a drizzle-free `src/session/schema/kinds.ts` leaf owning the closed enum arrays for the runtime axes (`op_mode`, `strategy`, `lens`, `goal`, and the `auto` selection sentinel), mirroring `src/graph/schema/kinds.ts`.
- **Objective:** Establish `src/session/schema/kinds.ts` as the single source of truth for the session/runtime axis vocabulary currently scattered (e.g. `MethodId` in `src/.pi/agents/state.ts`, axis ids in `runtime-policy.ts` / `affordances.ts`). Consumers import the closed arrays from the leaf; the leaf imports nothing (no drizzle, no pi). Must not recreate `READINESS_GRADES` (retired by `capability-readiness`).
- **Why now / unlocks:** The user asked (decision 3) for a runtime-state source-of-truth file parallel to `graph/schema/kinds.ts` so `op_mode` / `strategy` / `lens` / `goal` enums have one home. Independent of the remodel chain and the trio; low conflict.
- **Acceptance:**
  - `src/session/schema/kinds.ts` exists as a pure constants leaf and owns the runtime axis enums; axis-id consumers import from it.
  - No runtime axis enum is re-declared in `.pi/agents/state.ts`, `runtime-policy.ts`, or `affordances.ts`.
  - The leaf imports nothing runtime-heavy (drizzle-free, pi-free), matching the D73-L graph-leaf posture.
- **Verification:** Inner — import-boundary / architecture test that the leaf imports nothing and that consumers source axis enums from it.
- **Cross-cutting obligations:** Keep the leaf a pure constants module, not a behavior home; do not recreate the retired `READINESS_GRADES`.
- **Traceability:** D58-L, D59-L, D73-L / I25-L.
- **Design docs:** `src/session/README.md`; `src/graph/schema/kinds.ts` (template).

### elicitation-driver

- **Name:** Live per-turn "what to ask next" driver
- **Linear:** unassigned
- **Kind:** structural / bounded feature
- **Status:** next
- **Certainty:** proving
- **Promoted from:** `memory/CROSS_CUT_PLAN.md` Seam 3a `"what to ask next" driver` row (D65-L), which remained `partial · ●` after the `elicitation-backlog` substrate landed. Per the cross-cut's own DoD a seam stays open while any `●` row is partial, so the row is disposed here as a real frontier rather than residue.
- **Depends on:** `elicitation-gaps-remodel` (hard — the driver ranks/selects over the remodeled `elicitation_gaps` obligation shape, not the FE-823 question/`status` backlog).
- **Lights up:** open gaps → rank (importance / coverage / band) → select next question per turn; capture-reflection spawns/closes gaps.
- **Stabilizes:** D65-L's live elicitation behavior on top of the `elicitation_gaps` substrate; closes the cross-cut Seam 3a row.
- **Objective:** Add the per-turn driver that reads open gaps for the selected spec, ranks them (band + importance + derived coverage), selects the next question to surface, and reconciles gaps from capture-reflection (spawn new, set disposition on answered/scope-judged) — all on the remodeled `elicitation_gaps` read/write substrate.
- **Why now / unlocks:** Buildable once `elicitation-gaps-remodel` lands (substrate + per-spec read-back exist); it closes the last required cross-cut row. It is itself a **bounded feature, not coverage**; as the cross-cut's promoted closing row it sequences ahead of fresh coverage breadth, but it is **not** POC-ship-critical (the POC delivery cut de-scopes elicitation quality), so it is not a ship-gate blocker.
- **Acceptance:**
  - A driver reads open gaps for the selected spec and produces a deterministic ranked selection of the next question.
  - Capture-reflection can spawn new gaps and set dispositions through the existing `CommandExecutor` path; no second mutation clock.
  - Selection is observable enough for a probe/transcript to prove the loop without inventing a planning plane or pointer.
  - The cross-cut Seam 3a row flips from `partial · ●` to done when this lands.
- **Verification:** Inner — ranking/selection and reconciliation tests over seeded gaps. Middle — per-turn driver read-back over a real graph boundary; sibling-spec isolation. Outer — probe showing rank → select → capture-reflection close across turns.
- **Cross-cutting obligations:** Preserve the D4-L/D20-L command boundary and the D16-L/A4-L one-`{specId, lsn}` clock; keep the substrate flat (no graph plane, no gap→gap edges beyond the degenerate `arose_from`/`resolved_by` pointers); no second planning system.
- **Traceability:** D16-L, D20-L, D52-L, D63-L, D64-L, D65-L / A24-L.
- **Design docs:** `memory/SPEC.md` D65-L; `docs/design/GRAPH_MODEL.md`.

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

### projection-shape-coverage

- **Name:** Close the projections ledger with no-loss / shape invariants (PROJECT stage)
- **Linear:** unassigned
- **Kind:** coverage (buildable-now) / hardening
- **Status:** complete — trio stage 1 (`#project`) closed 2026-06-11 on the top-of-stack coverage branch; FE-847 closure continues below
- **Certainty:** proving
- **Pipeline position:** PROJECT — the info-preserving DTO stage between PULL and RENDER (`renderers/`). PULL has two halves: the *graph* read surface is locked/ledgered (`graph/queries.ts` + `src/graph/README.md`), and the *session* read surface the session/workspace projections lock against is now ledgered in `src/session/README.md`. Upstream of `renderer-golden-coverage`; lock projection shapes before renderer goldens so the goldens do not churn against moving DTOs.
- **Coverage-gate verdict (2026-06-08 deep per-plane pass; refined again on 2026-06-11 restack/scope):** **Passes the admission gate, and remains the genuinely-new finding.** Named load-bearing layer (`src/projections/`), closeable inventory. The ledger is now authored in `src/projections/README.md`, and the session PULL half is now inventoried in `src/session/README.md`. Direct-coverage today: `request-choice` (`✓`), `affordances` (`✓`), `transcript-context` (`✓`), `workspace-state` (`✓`), `runtime-state` (`✓`), plus the `topology-boundaries` import guard. The enumeration **corrected the plan's dark-zone claim**: `graph/{overview,commit-result,reconciliation-needs}` and `exchanges/present-candidates` are `export {}` **topology stubs**, not dark implementations (nothing to lock — `○`). The 2026-06-11 graph-neighborhood disposition checkpoint demoted `graph/neighborhood` as well: current consumers already read `NodeNeighborhood` directly from `graph/queries.ts`, and a projection would be a pass-through layer for symmetry rather than earned PROJECT work. The false `workspace/workspace-context` indirection is deleted/inlined, feeding its consumer from the source read. The exchange family is now explicitly `✓ keep-transitive`: `.pi` structured-exchange tests prove emitted `toolResult.details`, `session/exchange-projection.test.ts` proves tuple reconstruction, and the review-set path is covered through `session/structured-exchange-loop.test.ts` plus `project-graph-review-cycle-proof.test.ts`.
- **Oracle kind:** **invariant / no-loss / shape — NOT golden.** Projections are info-preserving (D60-L); a golden would be brittle and could not catch the failure that matters (a projection dropping a field the renderer also hides). Lock with shape assertions (required fields present, types correct) and round-trip / no-loss properties where a projection re-shapes a typed read. An **earns-its-place gate runs before the oracle gate**: a single-consumer pass-through is deleted, not locked.
- **Boundary:** In — the direct invariants on `session/transcript-context`, `session/runtime-state`, and `workspace/workspace-state`; the `✗` delete (`workspace/workspace-context`); the exchange-family disposition checkpoint; and the PULL-session read-shape ledger. Out — `○` topology stubs (`graph/{neighborhood,overview,commit-result,reconciliation-needs}`, `exchanges/present-candidates`), direct-read graph neighborhood consumers, `session/runtime-policy` (policy data, not a transform), `topology-boundaries` (already an import guard), and the already-resolved `✓` rows.
- **Aggregate DoD:** Every surviving `●` projection carries a shape/no-loss invariant; every `✗` row is deleted/inlined with its consumer fed from source; `◐` rows are resolved by explicit decision; `○` rows untouched. The session-PULL read-shape ledger exists. The `graph/neighborhood` row is no longer ambiguous: it is explicitly demoted to direct-read/stub status, with consumers kept on `NodeNeighborhood` from `graph/queries.ts`. Every `projections/` module appears in `src/projections/README.md` with a disposition (`✓`/`●`/`◐`/`✗`/`○`) + owner + oracle.
- **Inventory authority:** the closed ledger lives in `src/projections/README.md` (authored 2026-06-08), mirroring the `src/graph/README.md` read-shape ledger form (module × consumers × disposition × oracle). The PULL-session half gets a sibling read-shape ledger in `src/session/README.md`.
- **Why now / unlocks:** It is the missing middle of the pipeline and the prerequisite for stable renderer goldens. Closing it makes the info-preserving half of the context pipeline (PULL+PROJECT) fully oracle-backed, matching the graph PULL template.
- **Human-in-the-loop:** per-row design checkpoint = user reviews "what must be preserved" for each load-bearing DTO (and approves each `✗` delete) before the invariant is locked (see Context §design→lock rhythm). The enumeration/ledger pass itself was the first design checkpoint.
- **Acceptance:**
  - `src/projections/README.md` carries the full projections ledger (done) and `src/session/README.md` carries the session-PULL read-shape ledger.
  - Each `●` DTO carries a shape/no-loss invariant; `workspace/workspace-context` is deleted/inlined; the exchange family is explicitly resolved keep-transitive; `○` stubs are left untouched.
  - No golden snapshots are introduced for projections (wrong tool); `projections/` stays free of adapter/transport imports (D52-L, enforced by `topology-boundaries.test.ts`).
- **Verification:** vitest shape/round-trip asserts co-located with each direct projection lock (or a `projections/<domain>/*.test.ts`); the existing `topology-boundaries.test.ts` continues to guard imports; exchange-family rows cite their owning `.pi` / session / probe proofs instead of adding symmetry tests.
- **Cross-cutting obligations:** Keep projections info-preserving (no lossy text — that is RENDER's job); do not duplicate a typed read as a projection just to fill a ledger row (D60-L: many callers consume the typed read directly).
- **Traceability:** D52-L, D60-L.
- **Design docs:** `src/projections/README.md`; `src/graph/README.md` (ledger form to mirror).
- **Current execution pointer:** Closed on the top-of-stack coverage branch. The scope card is retired; next sequenced trio work is `renderer-golden-coverage`.

### renderer-golden-coverage

- **Name:** Complete the uneven renderer text-regression (golden + invariant) coverage (RENDER stage)
- **Linear:** unassigned
- **Kind:** coverage (buildable-now) / hardening
- **Status:** next — trio stage 2 (`#render`); **depends on `projection-shape-coverage`**
- **Certainty:** proving
- **Pipeline position:** RENDER — the first lossy stage, consuming PROJECT outputs. Locks only after projection shapes are stable; upstream of `prompt-composition-golden-coverage` (composed prompts embed rendered context).
- **Coverage-gate verdict (2026-06-08 ln-plan):** **Passes the admission gate** — an open coverage frontier. Named load-bearing layer (`src/renderers/`), closeable inventory, honest ●/○ marking, owner+oracle per row, explicit ledger authority. Classified **buildable-now**, and framed as **partial-oracle completion, not greenfield adoption**: the preview→lock→formalize loop is adopted unevenly. `toMatchFileSnapshot` goldens are live for `graph/neighborhood` and `session/runtime-frame` (`src/renderers/**/__previews__/`); what remains is closing the gaps — `workspace-state` is still invariant-only, `renderers/exchanges` has no goldens, `renderers/session/transcript.ts` is only locked indirectly through `session/session-transcript.test.ts`, and the planned sketch harness (`src/scripts/render-preview.ts` / `npm run render`) is not yet in tree.
- **Boundary:** In — the durable LLM-facing renderers under `src/renderers/{graph,workspace,session,exchanges}` (per `src/renderers/README.md`). Out — format helpers/primitives (`markdown.ts`, `toon.ts`), trivial JSON serializers (`○`), non-renderer projection DTOs, intentional topology stubs not yet owning a renderer (e.g. `present-candidates`), and any new renderer not already built (no symmetry regrowth).
- **Aggregate DoD:** No required (`●`) durable renderer remains without a locked golden (`toMatchFileSnapshot`) plus targeted invariant asserts (e.g. "renders projected code, never raw id"; "active-context omits superseded nodes"; "no dangling edge endpoints"). Establish one honest sketch path for the renderers being locked before snapshotting them.
- **Inventory authority:** the closed ledger lives in `src/renderers/README.md`; golden artifacts co-locate with the renderer test (`src/renderers/<domain>/__previews__/<fixture>.md`), not under `.fixtures/`.
- **Why now / unlocks:** The cross-cut named the preview→lock→formalize loop a prerequisite oracle; it shipped for two renderers but not the rest, so the un-locked renderers can drift silently. Closing the gaps makes every durable renderer-bearing surface drift-protected.
- **Sequencing:** trio stage 2 — starts once `projection-shape-coverage` has stabilized the DTO shapes it renders. Renderer text quality is **fitness evidence**, so it is still **never a ship gate** and does not block `poc-live-ship-gate`; but per the 2026-06-08 elevation it is near-term spine work, not background discretionary hardening.
- **Human-in-the-loop:** per-row design checkpoint = user eyeballs the chosen sketch output and approves the wording/shape before the golden is written (see Context §design→lock rhythm).
- **Acceptance:**
  - Each `●` durable renderer has a golden lock that writes on first run and diffs after (matching the existing `graph/neighborhood` + `session/runtime-frame` pattern).
  - Each `●` renderer carries at least one semantic invariant assert beyond the snapshot.
  - `src/renderers/README.md` carries the closed ledger (renderer × required/deferred × golden-present).
  - A deterministic sketch path exists for each newly-locked renderer; if `npm run render` is adopted, it covers those rows explicitly. No new renderer is introduced merely to fill a symmetric cell.
- **Verification:** sketch through the chosen preview path; vitest `toMatchFileSnapshot` for lock; existing invariant-style asserts for formalize. All in the renderer's co-located test file.
- **Cross-cutting obligations:** Goldens co-locate with renderer tests (not `.fixtures/`); keep `renderers/` free of adapter/transport imports (D52-L); do not promote a renderer shape to a new consumer just to fill the ledger (consumer bleed-through); leave intentional topology stubs (`present-candidates`) alone until they own a real renderer.
- **Traceability:** D52-L, D60-L, D62-L.
- **Design docs:** `src/renderers/README.md`; `memory/CROSS_CUT_PLAN.md` §Renderer feedback loops.
- **Current execution pointer:** Scope with `memory/cards/renderer-golden-coverage--render-stage-chain.md`; start with Card 1 (`renderer ledger + preview-loop authority`).

### prompt-composition-golden-coverage

- **Name:** Lock the prompt partials and composition output (golden + invariant) over the agent prompt family (COMPOSE stage)
- **Linear:** unassigned
- **Kind:** coverage (buildable-now) / hardening
- **Status:** next — trio stage 3 (`#compose`); **depends on `renderer-golden-coverage`**
- **Certainty:** proving
- **Pipeline position:** COMPOSE — the last lossy stage; composed prompts embed rendered context strings, so lock only after RENDER goldens are stable. `elicitation-driver` rides on this stage's locked oracle and follows it.
- **Coverage-gate verdict (2026-06-08 ln-plan):** **Passes the admission gate** — an open coverage frontier of the same golden-locking kind as `renderer-golden-coverage`, surfaced from manual feedback-loop work. Named load-bearing layer (`src/.pi/skills/**` partials + `src/.pi/agents/compose.ts` composition), closeable inventory, owner+oracle per row, explicit ledger authority. Classified **buildable-now** and framed as **partial-oracle completion, not greenfield**: composition is already **invariant-rich** — `compose.test.ts` and `prompting.test.ts` assert structure, manifest legality, capability-readiness filtering, pinned/AUTO axis behavior, readiness-thin pin retention, role/mode-illegal pin rejection, plus a `≥700`-char depth floor and a readable-resource check on every partial. What is missing is the **lock** stage: there is **no golden** of either the partial bodies or the composed-prompt output (no `__previews__`, no `toMatchFileSnapshot` for prompts; the only `.pi` inline snapshots are tool-output, not prompts), and there is **no preview harness** for composed prompts (`npm run render` only supports `graph-neighborhood`).
- **Boundary:** In — the agent prompt partials under `src/.pi/skills/{goals,strategies,lenses,methods}` and `src/.pi/agents/definitions/{elicitor,reviewer}.md`, and the `composeAgentPrompt` output for a representative matrix of axis/readiness/pin combinations. Out — tool-output snapshots (already inline-locked where useful), `state.ts` legality source (guarded elsewhere), and any new partial/axis introduced merely to fill a symmetric cell (no symmetry regrowth).
- **Aggregate DoD:** No required (`●`) prompt partial body or representative composed-prompt output remains without a locked golden plus the existing structural/legality invariants. Add a composed-prompt preview path (extend `render-preview.ts` or a sibling script) so goldens can be regenerated deterministically.
- **Inventory authority:** the closed ledgers live in `src/.pi/skills/README.md` (partials) and `src/.pi/agents/README.md` (composition); golden artifacts co-locate with the owning test (`src/.pi/agents/__previews__/<case>.md`), not under `.fixtures/`.
- **Why now / unlocks:** Prompt partials and composition shape every agent turn; today they can drift in wording/depth/order while invariants stay green, because the lock stage was never adopted for prompts. Locking them makes the manual feedback loop (eyeball → lock → diff) durable instead of re-eyeballed each change.
- **Sequencing:** trio stage 3 — starts once `renderer-golden-coverage` has stabilized the rendered context strings the composed prompt embeds. Still **never a ship gate**; `elicitation-driver` follows it (it adds per-turn behavior over the composition oracle locked here), so the two pair naturally.
- **Human-in-the-loop:** per-row design checkpoint = user eyeballs the composed-prompt preview (new harness) and approves partial body / composed wording before each golden is written (see Context §design→lock rhythm).
- **Acceptance:**
  - A representative composed-prompt matrix (axis/readiness/pin) has golden locks that write on first run and diff after.
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

### dev-seed-fixtures

- **Name:** Explicit dev seeding and launchable workbench flow
- **Linear:** FE-848 — folded into the current prompt-context refinement branch by user decision on 2026-06-11; no separate Linear issue for this low-conflict DX hardening slice.
- **Kind:** hardening / dev-substrate
- **Status:** parallel / partially built (folded into FE-848 branch)
- **Certainty:** proving
- **Lights up:** A fresh `.fixtures/workbenches/<name>` can be seeded with one named fixture, launched with `npm run dev -- --cwd .fixtures/workbenches/<name>`, and inspected as that workbench's DB — not the repo-root `.brunch/` and not an accidental all-seeds dump.
- **Stabilizes:** D70-L/D79-L fixture topology and I48-L target-workspace-scoped seeding; gives later manual, observer, and capture probes a reproducible local graph state to aim from.
- **Objective:** Clarify and harden the dev DB seeding flow around the four-role `.fixtures/` contract. Replace the current ambiguous mental model — `npm run seed` loads every tracked seed into whatever shell cwd happens to be active — with an explicit seed command that names the target workspace and selected seed set/slug (with all-seeds as an explicit opt-in). Catalog the captured seed fixtures by consumer disposition, update workbench docs to name the seed(s) they expect, and prove a seeded workbench through the real launch path.
- **Why now / unlocks:** The current root-dev behavior and `--cwd` workbench convention now conflict: root `.brunch/` can contain stale local DB state, workbench `.brunch/` is untracked but under-documented, and several newly captured seeds exist without a consumer. This frontier is the cheapest tracer bullet for D79-L/I48-L and prevents later manual/observer tests from depending on invisible local state.
- **Acceptance:**
  - ✅ Seed CLI supports selecting one fixture by set/slug and target workspace by path; malformed, unknown, duplicate, or unsafe flag input fails with usage before any workspace DB opens.
  - ◐ An all-seeds batch remains possible only through a future explicit flag or explicit command name; no ambient all-seeds default remains.
  - ✅ Every seeded spec routes through `seedFixture`/`CommandExecutor`, preserving spec-local LSN, change-log, elicitation-gap seeding, and structural validation; no seed path writes SQLite rows directly.
  - ✅ CLI output names the destination `.brunch/data.db` and each selected `set/slug → specId`; defaults are explicit in help text and tests.
  - ✅ `npm run dev` / `npm run dev -- --cwd <workbench>` never seeds implicitly; launch observes existing workspace DB state only.
  - ✅ `.fixtures/README.md` and the `live-graph-observer` workbench README document the canonical flow (`seed` then `dev -- --cwd`) and clarify root/workbench `.brunch/` as local runtime state, not canonical fixture truth; the workbench docs name the TUI sidecar instead of unsupported standalone `--mode web`.
  - ◐ Captured seeds (`brunch-self`, `dumpchat`, `fable`, `rd-loop`, `yamlbase`, plus existing Bilal/coverage sets) still need a small disposition catalog: `test`, `preview`, `manual workbench`, `probe input`, or `parked`.
  - ✅ A fresh-workbench tracer seeds one named fixture, reads `workspace.selectionState` through product RPC with `--cwd`, and proves graph state came from the workbench `.brunch/data.db` only.
- **Verification:** Inner — seed CLI parse/target-resolution tests; set/slug filtering tests; explicit all-seeds mode test; CommandExecutor/change-log assertions on a temp workspace DB; docs/help snapshot or string tests for visible destination reporting. Middle — fresh workbench smoke using a temp or fixture workbench: seed one fixture, launch via `runBrunchCli({ argv: ['--cwd', workbench, '--mode', 'print' | 'rpc'] })` or equivalent, assert selected workspace state plus graph overview are scoped to that workbench. Optional outer — manual `BRUNCH_DEV=1 npm run dev -- --cwd .fixtures/workbenches/<name>` against a live model after the deterministic tracer passes.
- **Topology materialization:** Seed data and throwaway prep scripts remain under `.fixtures/seeds/`; launchable cwd containers remain under `.fixtures/workbenches/`; the graph-domain seed loader remains in `src/graph/seed-fixtures.ts` unless the CLI grows enough to warrant a thin `src/scripts/` wrapper; workbench runtime DBs stay under gitignored `.brunch/` and are never committed.
- **Cross-cutting obligations:** Preserve D20-L/D52-L graph ownership — the loader orchestrates `CommandExecutor`, not DB internals. Preserve D70-L role separation — seed JSON is input, workbench DB state is local runtime, runs are curated evidence, scratch is ephemeral. Do not add auto-seeding to app startup, and do not treat repo-root `.brunch/` as canonical test fixture state. Pre-release posture allows regenerating or reclassifying stale seed files rather than maintaining compatibility with obsolete local DBs.
- **Branch:** `ln/fe-848-prompt-context-refine` (folded-in slice; no separate Graphite branch).
- **Traceability:** D16-L, D20-L, D52-L, D61-L, D63-L, D70-L, D71-L, D79-L; I1-L, I11-L, I48-L.
- **Design docs:** `.fixtures/README.md`; `.fixtures/workbenches/live-graph-observer/README.md`; `docs/design/GRAPH_MODEL.md`.

## Recently Completed
- 2026-06-09 `role-safe-graph-mutations` — Done: retired the remaining public `commitGraph` residue, extracted the shared mutation planner/writer out of `CommandExecutor`, and completed the last boundary migration so dev curation now exposes `dev.graph.mutateGraph` with role-named create-edge ops plus projected node-code / selected-spec edge-id resolution. Follow-up closure on the same frontier: reconciled the remaining product probes and current docs to the canonical `mutateGraph` / `mutate_graph` grammar, explicitly marked the checked-in 2026-06-05 fixture-curation artifact as historical pre-migration `commit_graph` evidence, and added role-named edge schema coverage across the Pi tool and dev RPC boundaries. Verified: `npx vitest run src/rpc/handlers.test.ts src/app/brunch.test.ts src/probes/fixture-curation-loop.test.ts src/probes/propose-graph-commit-proof.test.ts src/graph/mutate-graph-edge-schema.test.ts` and `npm run verify`.

- 2026-06-09 `dx-feedback-loops` (FE-825) — Done: bumped Brunch to the pi 0.79 line with a dev-only `PI_SOURCE` runtime alias, consolidated the dev front door around a shared faux harness and scripted faux launcher, and added the dev-gated read-only introspection extension plus `runBrunchIntrospectionTurn()` paired artifact writer now routed under `.fixtures/scratch/introspection/<run-id>`. Product runs omit introspection by default and keep the D39-L sealed profile intact; the later `dx-introspection-live` closure wired the real TUI path under `BRUNCH_DEV` while keeping Pi startup-update suppression scoped at launch rather than globally lifting offline mode. Verified: `src/.pi/__tests__/introspection.test.ts`, `src/dev/introspection-launcher.test.ts`, and `npm run verify`.

- 2026-06-08 `runtime-affordances-and-legality` — Done (00105108): added `src/projections/session/affordances.ts` owning the pure `(resolvedState, readinessGrade) → legal goal/strategy/lens options + default-on-switch` derivation; lifted the shared grade/AUTO legality tables into `src/projections/session/runtime-policy.ts` and refactored `src/.pi/agents/state.ts` to reuse that single legality source (no client-local reimplementation); added the closed coverage ledger to `src/session/README.md` with `src/session/runtime-affordances-coverage.test.ts` guarding the required agent rows while tripwiring `active-review-set` / `turn-mode` as explicit product-state-gated deferrals. Reconciled D40-L. Verified: `src/projections/session/affordances.test.ts`, `src/session/runtime-affordances-coverage.test.ts`, and `npm run verify`.

- 2026-06-08 `capture-quality-spike` — Done: added `src/probes/capture-quality-loop.ts` and a deterministic report test over free-prose, file/ref-bearing, and implication-heavy capture scenarios. The run artifact `.fixtures/runs/capture-quality/2026-06-08-capture-quality-sample/` records precision 1.0 / recall 1.0 with zero false commits from the sample extraction set and recommends graduating `exchanges-and-generalized-capture` narrowly, preserving a false-commit oracle for implication-heavy text. Verified: `src/probes/capture-quality-loop.test.ts` and `npm run verify`.

- 2026-06-08 `minimal-authority-shell` (FE-810) — Done: added the authority-matrix guard test over the current POC authority seam. The guard locks `CommandExecutor` mutation-result discriminants as the graph outcome vocabulary, proves `needs_human` is structured data rather than a TUI-only dialog, and asserts `elicit` tool authority comes from the shared projected runtime policy while blocking the identified side-effecting tools (`bash`, `edit`, `write`). No new authority service; `src/.pi/agents/state.ts` untouched; A18-L strict built-in suppression remains accepted Pi-upstream/API residue. Verified: `src/.pi/extensions/runtime/authority-matrix.test.ts` and `npm run verify`.

- 2026-06-08 cross-cut prompt-resource body-depth pass (Seam 3a/3b) — Done (1ca02e38): deepened every thin `src/.pi/skills/{goals,strategies,lenses,methods}` body to carry its per-axis facet guidance (goals→D59-L, strategies/lenses→README+D25-L, methods→D58-L tool-routing role), and added a manifest-wide readability/depth test in `src/.pi/agents/compose.test.ts` asserting every `{GOAL,STRATEGY,LENS,METHOD}_RESOURCES` location resolves and clears a ≥700-char floor. `state.ts` untouched. This closed the prompt-resource body-depth row, but the cross-cut is **not** exhausted: its Seam 3a `"what to ask next" driver` row (`partial · ●`) remains the last required row, now promoted to the `elicitation-driver` frontier. Verified: `npm run verify` (551 tests, build).

- 2026-06-10 `elicitation-gaps-remodel` — Done: replaced the FE-823 `elicitation_backlog` question-instance table with the D65-L `elicitation_gaps` typed obligation register; seeded the grounding typology catalog; added create/disposition commands on the shared `{specId, lsn}` / `change_log` boundary; and proved live `presence` coverage/answered derivation from graph truth with sibling-spec isolation. Verified: `src/graph/command-executor.test.ts`, `src/graph/queries.test.ts`, `src/graph/architecture.test.ts`, `src/graph/observed-shapes-coverage.test.ts`, full `npm run test`, and `npm run build`.
- 2026-06-08 `elicitation-backlog` (FE-823) — Done: materialized the pre-remodel flat spec-scoped prospective register with generated migration, seeded the grounding agenda at `createSpec`, routed create/close entry mutations through `CommandExecutor` on the shared `{specId, lsn}` / `change_log` boundary, and added graph-owned per-spec open-entry read-back. Superseded by `elicitation-gaps-remodel` on 2026-06-10. Verified: `src/graph/command-executor.test.ts`, `src/graph/queries.test.ts`, and `npm run verify`.

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
  dx-introspection-live          [done · proving]    live real-TUI introspection + four-role .fixtures topology + --cwd + unified BRUNCH_DEV + conversational query tools + .brunch/debug cache
  graph-observed-shapes          [done · proving]    ratified consumer-specific observed-shape ledger + drift guard; no transport shape shipped
  runtime-affordances-and-legality [done · proving]  shared affordance derivation + coverage ledger; review-set/turn-mode rows tripwired (superseded by gap-based capability-readiness)
  role-safe-graph-mutations    [done · proving]    canonical mutateGraph/mutate_graph authored grammar; role-named edges; retire exposed commitGraph/commit_graph
  projection-shape-coverage      [next · coverage]   TRIO stage 1 (#project, PROJECT): create projections ledger + no-loss/shape invariants over dark graph/transcript DTOs; invariant-kind, NOT golden
  renderer-golden-coverage       [next · coverage]   TRIO stage 2 (#render, RENDER): create renderer ledger + golden-lock every durable renderer; depends on projection-shape-coverage
  prompt-composition-golden-coverage [next · coverage] TRIO stage 3 (#compose, COMPOSE): composed-prompt preview + golden-lock partials/composition matrix; depends on renderer-golden-coverage
  elicitation-gaps-remodel       [done · proving]    remodeled elicitation_gaps obligation register; live presence derivation (grounding typology catalog superseded by gaps-node-kind-reference, D75-L)
  gaps-node-kind-reference       [done · proving]    D75-L node-kind gap reference landed; typology name/RelevantGapName retired; same-kind discrimination probe covered
  capability-readiness           [done · proving]    JIT capability->relevant-gaps gate + readiness estimate (UI-only); stored grade / MIN_GRADE / chrome.phase+chatMode retired; residue = manual satisficiency + capability-map refinement
  runtime-vocab-leaf             [parallel · proving] src/session/schema/kinds.ts source-of-truth leaf for op_mode/strategy/lens/goal (D73-L direction); decision-3 follow-on
  elicitation-driver             [after-trio · proving] live per-turn what-to-ask-next driver on remodeled elicitation_gaps; rides COMPOSE oracle; closes cross-cut Seam 3a
  exchanges-and-generalized-capture [after-trio · proving] bounded feature (NOT coverage): narrow extractive capture + false-commit guard + exchange symmetry audit
  capture-quality-spike          [done · spike]      A22-L fitness evidence graduated the narrow exchanges-and-generalized-capture feature
  probes-and-transcripts-evolution [parallel]        continuous evidence substrate
  topology-readmes-and-boundaries  [parallel]        attach-to-frontier topology hardening
  dev-seed-fixtures                [parallel · proving] explicit seed selection + target-workspace-scoped workbench launch; catalog captured seeds; prove D79/I48 tracer
  web-design-system-port           [done · earned]     ported prior-trunk tokens + card primitives into src/web; retired invented warm aesthetic; read-only, no spine deps
  dx-tier-2-harness              [done · proving]    FE-847 Tier-2 DX chassis (real boot + faux turn + payload/transcript oracle + fixture resume) + coverage-first scaffold + topology stubs
  turn-boundary-reconciliation   [next · proving]   M7 product write-side: watermark projection (S1) + prepareNextTurn reconciler/worldUpdate/own-write stamping (S2) + submit-time mention ledger/staleness (S3)
  kick-and-context-seeding       [next · proving]   shared FE-847 successor branch: honest kick via triggerExchange + boot/resume context seeding (S4); pre-reconcile-tail policy; boot idempotence (S5 share)

edges:
  graph-tool-resilience     -[hard]->         capture-response-to-graph
  graph-tool-resilience     -[hard]->         project-graph-review-cycle
  capture-response-to-graph -[hard]->         poc-live-ship-gate
  graph-tool-resilience     -[hard]->         poc-live-ship-gate
  project-graph-review-cycle -[optional]->    poc-live-ship-gate
  minimal-authority-shell   -[hard]->         poc-live-ship-gate
  elicitation-backlog       -[supersedes]->   elicitation-gaps-remodel       (FE-823 backlog row shape remodeled into D65-L gaps)
  elicitation-gaps-remodel  -[hard]->         gaps-node-kind-reference       (reshape gaps onto node kinds; refersTo NodeKind replaces the typology name enum, D75-L)
  gaps-node-kind-reference  -[hard]->         capability-readiness           (gate + readiness estimate read node-kind-referencing gaps and a capability->NodeKind[] map)
  gaps-node-kind-reference  -[hard]->         elicitation-driver             (driver ranks/selects over the final gap shape: refersTo NodeKind + question)
  capability-readiness      -[shape]->        projection-shape-coverage      (workspace-state/runtime-state readiness shape is now gap-derived; lock after this completed frontier)
  gaps-node-kind-reference  -[shape]->        projection-shape-coverage      (gaps register surfaces through projections; lock upstream shape first)
  graph-tool-resilience     -[hard]->         role-safe-graph-mutations      (current graph tool + edge model exist)
  project-graph-review-cycle -[hard]->        role-safe-graph-mutations      (current review-set proposal/accept path exists)
  role-safe-graph-mutations -[hard]->         exchanges-and-generalized-capture (relation-bearing capture uses mutateGraph grammar)
  role-safe-graph-mutations -[already-satisfied]-> dev-seed-fixtures          (semantic curation now uses the canonical mutateGraph grammar; D79 hardening no longer needs a second graph-write dialect)
  capture-quality-spike     -[evidence]->     exchanges-and-generalized-capture
  projection-shape-coverage -[hard]->         renderer-golden-coverage     (lock DTO shape before renderer golden)
  renderer-golden-coverage  -[hard]->         prompt-composition-golden-coverage  (lock rendered text before prompt golden)
  prompt-composition-golden-coverage -[oracle]-> elicitation-driver         (compose oracle underwrites per-turn driver)
  dx-feedback-loops         -[optional]->      role-safe-graph-mutations      (version-bump+alias is a shared unblocker; land before concurrent pi-facing churn)
  dx-feedback-loops         -[optional]->      projection-shape-coverage      (same shared unblocker; soft, not a hard gate — buildable independently)
  dx-feedback-loops         -[hard]->         dx-introspection-live          (built the dormant introspection machinery this frontier wires live + makes conversational)
  dx-feedback-loops         -[hard]->         dx-tier-2-harness              (Tier-2 chassis reuses the src/dev faux harness + real-boot front door)
  dx-tier-2-harness         -[hard]->         turn-boundary-reconciliation   (S1-S3 mechanics are proven through the Tier-2 chassis + flip its skipped scaffold tests live)
  dx-tier-2-harness         -[hard]->         kick-and-context-seeding        (S4 origination is proven through the Tier-2 chassis; same FE-847 closure chain, last slice group on the successor branch)
  turn-boundary-reconciliation -[hard]->      kick-and-context-seeding        (seed must advance the watermark (S1) and the kick decision interacts with reconciler-inserted notices (S2))

parallel obligations:
  probes-and-transcripts-evolution -[evidence]-> every P0/P1 frontier
  topology-readmes-and-boundaries  -[boundary]-> every frontier that moves/claims source topology
  dev-seed-fixtures                -[data]->     capture-response-to-graph, poc-live-ship-gate (explicit seeded workbenches provide reproducible real graphs for observer/capture; ongoing semantic curation already rides mutateGraph)

horizon:
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
  - **Context-pipeline coverage trio (the near-term spine, 2026-06-08 deep per-plane pass).** The four LLM-facing context concerns are one pipeline — PULL → PROJECT → RENDER → COMPOSE (D60-L). PULL has **two halves**: the *graph* read surface is the done template (`graph/queries.ts` + `src/graph/README.md`: behavioral oracle for all 8 shapes + drift guard + real ledger), and the *session* read surface (`session/workspace-context`, `workspace-session-coordinator`, `runtime-state`) is now ledgered in `src/session/README.md` for the session/workspace projection locks. The trio closes the other three stages **in dependency order**, each completing its plane's **full ledger** via the human-in-the-loop design→lock rhythm. Oracle kind differs by stage: info-preserving stages want **invariant/no-loss** locks, lossy stages want **golden** locks. The PROJECT ledger (`src/projections/README.md`, authored 2026-06-08) applies an **earns-its-place gate before the oracle gate** — the false `workspace/workspace-context` wrapper has now been deleted/inlined, and the plan's earlier "dark zone = graph/{overview,commit-result,reconciliation-needs}" was wrong: those are `export {}` topology stubs (`○`), not dark implementations. `graph/neighborhood` is now the same class: a direct graph PULL read/topology stub, not a PROJECT survivor.
  - `projection-shape-coverage` (TRIO stage 1, `#project`) is complete on the top-of-stack coverage branch. Ledger authored in `src/projections/README.md`. `session/transcript-context`, `workspace/workspace-state`, and `session/runtime-state` are all locked directly; `workspace/workspace-context` is deleted/inlined; the graph projection stubs (`neighborhood`, `overview`, `commit-result`, `reconciliation-needs`) are `○` topology stubs, not dark; and the exchange family is explicitly resolved keep-transitive via existing `.pi` / session / probe proofs. The session PULL read-shape prerequisite is closed in `src/session/README.md`. This stabilizes the shapes renderer goldens lock against.
  - `renderer-golden-coverage` (TRIO stage 2, `#render`) **depends on stage 1**: only `graph/neighborhood` + `session/runtime-frame` are golden-locked; the rest are dark or only transitively covered via the `.pi` adapter. Create the renderer ledger (README claims one that does not exist), extend the preview harness past `graph-neighborhood`. Bound to durable renderers (exclude `markdown.ts` / `toon.ts` helpers and topology stubs). Never a ship gate.
  - `prompt-composition-golden-coverage` (TRIO stage 3, `#compose`) **depends on stage 2**: `compose.test.ts` / `prompting.test.ts` are invariant-rich but no golden of partial bodies or composed output exists and there is no composed-prompt preview harness. Add the preview, golden-lock partials + a composed-prompt matrix. `elicitation-driver` rides on this stage's locked oracle and follows it. Never a ship gate.
  - `project-graph-review-cycle` is complete evidence for the optional batch proposal/review story; keep future review-quality work as follow-up, not FE-809 completion debt.
  - `topology-readmes-and-boundaries` is not a license for abstract cleanup; it rides with concrete delivery seams.
  - **Readiness / elicitation-gaps remodel (2026-06-09 ln-plan, post-`ln-spec`).** The SPEC pass (D45-L, D57-L, D64-L, D65-L, D73-L, D74-L; A24-L, A27-L; I25-L, I30-L, I31-L) promotes a hard chain `elicitation-gaps-remodel` → `capability-readiness` plus the parallel `runtime-vocab-leaf`. `elicitation_backlog` is remodeled into the D65-L `elicitation_gaps` obligation register (name + rationale, band, `presence|field|coverage|manual` predicate, importance + derived coverage, disposition; seeded from the grounding typology catalog). Capability-readiness becomes a JIT `capability → relevant gaps` judgment that retires the stored `readiness_grade` / `updateReadinessGrade` / `READINESS_GRADES` / `MIN_GRADE` proxies, adds a soft UI-only `readiness estimate`, and removes `chrome.phase` / `chrome.chatMode`. **These are upstream of the trio's readiness/chrome-touching locks** (`capability-readiness` mutates `workspace/workspace-state` + `session/runtime-state` shapes that `projection-shape-coverage` would freeze): land the chain before trio stage 1, or have the trio explicitly bracket the grade/phase/chatMode fields until the remodel lands. None are POC-ship-critical. `elicitation-driver` now depends on `elicitation-gaps-remodel`, not the FE-823 backlog shape. `runtime-vocab-leaf` is the decision-3 follow-on (session/runtime enum source-of-truth leaf) and does **not** relocate the retired `READINESS_GRADES`. Decision-2 (readiness-grade vs band term overlap → `capture_band`/`readiness_gate`) was explicitly **left alone**.
  - **Turn-boundary choreography (Tier-2 layer, 2026-06-10).** Promoted from the `turn-boundary-reconciliation` horizon stub into three frontiers after a SPEC pass locked D76-L–D78-L / I45-L–I47-L. `dx-tier-2-harness` (FE-847) is the thin DX chassis + coverage-first scaffold (skipped tests + topology stubs); `turn-boundary-reconciliation` (M7) owns the watermark/reconciler/mention write-side (S1–S3); `kick-and-context-seeding` is the honest-origination + seeding grouping (S4). S5 (boot idempotence + carrier discipline, I47-L) is a cross-cutting obligation on both product groupings, not its own frontier. The original FE-847 execution decision kept S0–S5 as one sequential closure chain; the later 2026-06-11 branch-mechanics override split that chain across two FE-847 branches for stack health: `dx-tier-2-harness` stayed on `ln/fe-847-dx-introspection-tier-2`, while `turn-boundary-reconciliation` and `kick-and-context-seeding` continue together on `ln/fe-847-turn-boundary-closure`. The scaffold encodes three edge cases: seed/full-overview snapshots advance the watermark while narrow reads do not; no redundant `worldUpdate` after a seed naming the current snapshot LSN; the resume kick decision is taken on the pre-reconcile tail. Each grouping flips its own scaffold tests live (no slice lands green leaving its tests skipped). None POC-ship-critical; the S0 chassis is buildable now.
  - **Oracle pre-build review (2026-06-10).** Endorsed the architecture (projected watermark + one reconciler writer + honest origination) and surfaced four pre-build hazards, all folded into SPEC: (1) **same-session capture** — `worldUpdate` now covers any write not already assistant-visible via a carrier, incl. submit-time/freestyle capture (D18-L/D66-L), not just foreign writes (D76-L/I45-L); (2) **kick = conversational-debt classification** ignoring trailing continuity-only entries, so reboot-after-notice stays idempotent (D78-L/I46-L); (3) **compaction must preserve the watermark carrier** so projection never regresses (I47-L); (4) **guard-as-retry** — `before_provider_request` re-runs prepare once on drift, never writes; reconciler runs before prompt composition (D77-L). Also: keep S1 a separate watermark projection, not an overload of `runtimeState.world.latestLsn`. **Optional S2 split** if it grows too wide: S2a = watermark + core reconciler + `worldUpdate`; S2b = adapter stamping + side-task/reviewer drains. Defer to `ln-scope`.
  - Multi-spec workspace discipline applies throughout: target the selected/current spec explicitly; no workspace-global graph truth in the POC.
```
