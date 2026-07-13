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

Brunch-next has delivered the original composition spine: the host, sealed Pi profile, transcript substrate, SQLite graph plane, public RPC, TUI/web observer shape, generalized capture, review-set commitment path, and public-entry ship gate all have evidence. Capability work routes through the code-owned first-level skill manifest and activity-named skill homes (the strategy/lens/method runtime trees are retired, D98-L).

**Ship gate (2026-07-03 grill) — nearly closed.** The shippable cut: working e2e flows and throughlines, clean simple invariants, complete contracts — minimal and pragmatic within those constraints, enhancements deferred. Four of the five gate frontiers are done and merged; all remaining gate evidence rides `walkthrough-evidence-batch` (FE-1167), the closing member of arc `deterministic-orientation`. The grill's settled calls live as decisions: two operational modes only (D98-L), concentric authority as a code contract (D40-L), generative flows offered at deterministic junctures (D109-L). Standing obligation while the gate is open: gate frontiers chart their decision flows (all paths and endpoints) at `ln-scope` time.

**Execute-mode substrate (KA lane, merged 2026-07-06/08).** `src/executor/` is a pure run-lifecycle core over injected `ExecutionPorts` (D111-L, D112-L, I58-L), exposed as executor-only `execute_*` tools, with a web-facing `execute.*` read surface. KA-conversation residue (FE-1107 close-or-narrow, executor-card GC, demo session, post-KA plan pass) rides FE-1167.

**Alpha release lane — shipped.** Brunch ships as `@hashintel/brunch@1.0.0-alpha.x` from the `next` trunk. `alpha-release-readiness` (FE-1159) closed 2026-07-09 with `1.0.0-alpha.0` live on npm under dist-tag `alpha` (D113-L allowlist, D114-L login, D115-L no-auth gate, `check:release-pack`). Subsequent alphas: `npm run release` from `next`.

**Exchange-ask cutover (D116-L, merged 2026-07-08).** A one-shot **ask** tool is now the only interactive structured-exchange terminal; `present_question` and the registered `request_response` collector are retired; offer presents declare their ask continuation in details. "Pending exchange" dissolved as a concept; headless RPC discovery of open asks is deferred (A39-L → Horizon `headless-ask-discovery`). Unwitnessed outer-loop residue rides `walkthrough-evidence-batch`.

**Merge waves (2026-07-08/09) + plan consolidation.** The braided ship-gate stack, alpha-readiness PR, component-DX PR, ask cutover, KA executor lanes (#286–#304), and the FE-1169 chrome batch (#305, 2026-07-09) are all merged to `next`. The 2026-07-08 `ln-plan` hygiene pass batched straggling outer-loop residue into `walkthrough-evidence-batch` (FE-1167), pruned non-frontier Horizon rows, and folded `blank-carrier-sweep` into the FE-1163 ledger. No open PRs remain from these lanes.

**Capture-sweep reliability lane (grilled 2026-07-08).** A trace of the capture-sweep mechanism surfaced that the watermark advance is optimistic (`sweptAt` asserts intent, not completion) and that agent-action provenance — product-wired vs event-nudged vs freely chosen — is illegible during walkthroughs. Settled as D117-L (include-list stays, fail-closed), A40-L (`turn_end` as a future capture-conditional upgrade, not now), and the "Sweep ingestion reliability" blind spot. The plan-level answer is one new frontier, `mechanism-trace`: a post-hoc carrier-classified transcript trace as the spine, with the sweep-debt tripwire riding it as a scenario-scoped outer-loop oracle. The D117-L constant-anchoring hardening is a direct fix outside that frontier.

**Alpha walkthrough lane (2026-07-09/10).** Post-PR-305 outer-loop walkthroughs (TESTING_PLAN.md concern groups; findings in TESTING_FINDINGS.md) ran A and C, then a same-day induct → grill → spec pass settled D118-L (spec posture persistence), D119-L (unified `/continue` + continue/wait lexicon), the D99-L digest-conduct clarification, and A41-L. The 2026-07-10 FE-1180 review/witness pass reopened `walkthrough-remediation-1`: required rows WR1–WR8 were built, but Execute labels diverged from their provider directives and several security/conduct/debug claims lacked discriminating evidence. D120-L/I62-L now settle the Execute workflows. FE-1180 closed by explicit WR18 promotion of remaining failures/unknowns into `walkthrough-remediation-2` / FE-1187. FE-1187 now owns the reshaped auth/model-policy, ask/recovery, debug/prompt, conduct, Execute, and both-theme evidence before later walkthrough beats depend on those surfaces.

**Petri execution lane (2026-07-12/13).** FE-1190's live stream merged (#322, 2026-07-13) after two Bugbot findings closed with deterministic oracles (fail-closed journal appends; terminal-lagging snapshot backfill from replay truth). The admitted Petri sequence is now live: `executor-slice-attempt-lifecycle` (FE-1192, picked up 2026-07-13 — shape settled at pickup: attempt facts first, constant retry bound, agent step only) → `petri-slice-isolation-fan-in` → `petri-epic-integration` → `petri-durable-parallel-authority`.

**Topology and evidence discipline.** Directory `TOPOLOGY.md` files under `src/**` own current topology state. `memory/SPEC.md` owns the thin product contract and live decision/invariant index; long-form SPEC history is archived in `docs/archive/SPEC_HISTORY.md`. `memory/PLAN.md` owns only rolling frontier state. Scratch probe artifacts under `.fixtures/scratch/` are not durable evidence until reviewed and promoted to `.fixtures/runs/`.

## Initiatives

<!-- Initiative (arc) = a multi-frontier architectural through-line. This is NOT a tracker/branch
     altitude — frontiers stay flat (one Linear issue + branch each) per AGENTS.md. The arc index is
     a legibility + completability layer only: it names the through-line so "was this captured
     thoroughly?" is a lookup, not a reconstruction from scattered SPEC decisions.
     Created/updated by ln-plan; closed and reconciled by ln-sync. Keep each arc thin (goals,
     members, done-definition, anchors). An arc closes only when its done-definition holds —
     including reconciliation of co-located topology files and discharge of any standing-obligation
     residue scoped to it. Arc completion is the trigger for residue that no future frontier touches. -->

### Closed arcs

- **elicitor-capability-spine** — ✓ done. `capture` / `generate` / `project` built over the capability spine without reviving retired runtime axes. Anchors: D95-L, D96-L, D100-L; I51-L.
- **exchange-presentation** — ✓ done 2026-07-06 (`exchange-rendering` + `exchange-answering-chrome`). Durable truth: D104-L/D108-L, `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`, exchange topology homes. Deferred, not owed: per-item review commentary (Horizon). Full closure record: `docs/archive/PLAN_HISTORY.md`.
- **capture-ingest-throughline** — ✓ done 2026-07-06 (`exchange-capture-contract` + `present-digest`). Durable truth: I57-L, D110-L, ingest/map conduct homes. Full closure record: `docs/archive/PLAN_HISTORY.md`.

### deterministic-orientation — ◐ active

- **Goal:** users choose how to operate at every settle-point, deterministically — no model volition, no mode ping-pong. The mechanism (settled 2026-07-03): product-owned `ctx.ui.select` dialogs record `brunch.session_orientation` entries that feed kick composition. Entry boot rides the Brunch orientation extension's `session_start(startup)` handler because Pi binds extension UI before emitting that event; mid-session junctures use Pi events/commands (`session_start` for post-switch `new`/`resume`, `session_tree`, detectable abort settle, mode switch, `/consult`) where the UI exists. No-UI print/json modes synthesize no orientation entry and follow the default kick path. Mid-session discretionary consults stay ordinary exchange tuples; `/consult` forces the dialog. Two modes only (`specify` / Specify and `execute` / Execute, D98-L); concentric authority becomes a code contract; generative flows are menu-routed to the existing `propose`/`project`/`elicit`/`ingest` skills.
- **Members:**
  - `session-entry-orientation` — ✓ built + merged (#289, 2026-07-08); its outer walkthrough evidence rides `walkthrough-evidence-batch` (FE-1167).
  - `execute-entry-readiness` — ✓ built + merged (#290, 2026-07-08); its outer walkthrough evidence + the two deferred orientation-choice questions ride `walkthrough-evidence-batch` (FE-1167).
  - `walkthrough-evidence-batch` (FE-1167, definition below) — the arc's remaining member: one witnessed e2e run per generative flow, thin/rich Execute beats, menu→conduct routing evidence. The arc closes when it closes.
- **Done-definition:** dialog fires on every named UI-capable juncture in TUI and RPC modes (extension-UI sub-protocol relay confirmed); escape/timeout resolves to the inert `dismissed` — entry recorded, no kick, so the menu is never a wall and esc always means "wait for me" (2026-07-06 revision, supersedes the earlier escape→`continue` mapping); no-UI modes leave no orientation trace; orientation entries are excluded from capture sweep (process state, not spec material) and readable by kick assembly; concentricity holds as an executable contract (executor tool + skill grants ⊇ elicitor's, write-execution tooling stays executor-only); **one witnessed e2e run per generative flow — intent, design, oracle, frontier-level plan — each entered through a deterministic juncture** (the ship gate's "all flows proven" obligation lives here); topology homes for `src/.pi/extensions/` and `src/agents/runtime/` reconciled.
- **Anchors:** D98-L (two modes, 1:1 mode↔agent), D37-L (offer-owns-response grammar — the dialog lives on the product side of it), D40-L (authority matrix), D74-L (capability-readiness), D101-L/D102-L (session seed facts); `src/agents/references/readiness-bands.md` §Agent Use (the Proceed/Negotiate/Ask postures both foreground roles share).

## Sequencing

### Active

- **Alpha walkthrough lane** — the post-publish outer-loop audit over the merged surface (`TESTING_PLAN.md` concern groups; findings in `TESTING_FINDINGS.md`). Runs A, C, and WR18 are the source evidence. FE-1187 now owns WR18 residue before later walkthrough beats depend on the reshaped auth/ask/Execute surfaces; run D stays the outer oracle for `spec-posture` after that surface is settled. Not a frontier itself.

### Recently Completed

- 2026-07-13 `petrinaut-live-run-stream` (FE-1190) — merged #322 to `next`; live-from-start Petrinaut observation with frozen run plan, journal-ordered completion, reconnect equivalence, fail-closed journal appends, and terminal-lagging-snapshot backfill (both Bugbot findings closed with deterministic oracles). FE-1183 (`petri-interpreter-port`) closed with it — #320 merged the finite replay/export surface.
- 2026-07-10 `walkthrough-remediation-1` (FE-1180) — **✓ closed by explicit promotion, not false pass**. WR1–WR8 and WR13–WR17 built; WR18 evidence is recorded in `TESTING_FINDINGS.md`; every remaining failure/unknown moved to `walkthrough-remediation-2` / FE-1187; the exhausted ledger and stale handoff were deleted.
- 2026-07-10 `default-tool-rendering` (FE-1186) — all 41 fallback-rendered Brunch tools use `defineBrunchTool`; the production registry pins the 41 shared-default / 11 intentional-custom / 4 Pi-owned classification. D122-L/I61-L scope the renderer contract to Pi's live interactive TUI; Pi HTML export remains unsupported under D34-L.
- 2026-07-10 `main-editor-chrome` execute-card follow-up (#313) — structured, status-first renderers landed for `execute_orchestrate`, `execute_plan_check`, `execute_snapshot`, and `execute_status`; literal snapshots plus lifecycle negative-space tests preserve D111-L/D112-L/I58-L. The scope card was exhausted and deleted; the normal-width manual readability beat remains outer evidence, not unfinished implementation.

Older completion history: [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md).

### Next

- `walkthrough-remediation-2` ([FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure)) — evidence-gated/proving follow-up for WR18 residue. **Entry is spec-first through `ln-spec` / disambiguation for the D113-L–D115-L reversal**: current auth/model-policy decisions cannot silently coexist with the user's direction to remove provider/model restrictions, retire `brunch login` as the preferred path, and remove the startup warning. Bounded findings inventory: Shift+Tab extension/built-in shortcut conflict; Brunch provider/model restrictions; startup-menu auth warning and `brunch login` guidance/product path; duplicated records in `.brunch/debug/origination.md`; unintended Pi-documentation references in `system-prompt.md`; missing `/continue` / `/consult` / `/mode` hints after ask cancellation; repeated offer content in present→ask continuation; no-model `/brunch:continue` plus no seed/kick carrier observation; extraction breadth after a thin first pass; O7/O8/O9 live D120-L Execute workflows; O10 both-theme component/live-TUI checks. Owns all FE-1180-promoted residue and precedes later walkthrough evidence that depends on reshaped auth/ask/Execute surfaces.
- `spec-posture` (Linear at pickup) — structural: persisted spec-row posture (D118-L, A41-L) + deterministic establishment flow. Start after FE-1187 resolves reshaped auth/ask surface residue so run D witnesses the corrected surface; its outer oracle is exactly run D's populated-cwd/brownfield beats. Definition below.
- `walkthrough-evidence-batch` ([FE-1167](https://linear.app/hash/issue/FE-1167/walkthrough-evidence-batch-outer-loop-checks-for-merged-orientation)) — the one batch owning all outer-loop residue from the merged lanes (FE-1134 generative-menu evidence, FE-1137 thin/rich Execute beats + deferred orientation-choice questions, FE-1124 Card 3 + seed worklist, FE-1107 KA-conversation residue, and — folded 2026-07-08 from the retired handoff — the FE-1164 walkthrough items). FE-1164/FE-1169 are merged, but the batch now waits for FE-1187 so its beats witness D120-L-consistent and WR18-remediated ask/consult/Execute surfaces (and note remediation row 5's conduct changes shift what "expected conduct" means for the generative beats). Closes arc `deterministic-orientation`. Definition below.
- `mechanism-trace` (Linear at pickup) — post-hoc mechanism-provenance trace over session transcripts (carrier classes `wiring` / `nudge` / `conduct`), a static wiring inventory, and the sweep-debt tripwire as a derived scenario-scoped assertion. Best run **before or alongside** `walkthrough-evidence-batch` (FE-1167) — the trace is exactly the instrument those walkthrough beats lack. Definition below. The D117-L constant-anchoring hardening in `sweep-watermark.ts` is a direct fix, not part of this frontier — land it on the next branch that touches the exchanges family or as a standalone commit.
- `legacy-question-read-path-retirement` (Linear at pickup) — earned deletion frontier for the remaining `present_question`-era read branches and fixtures. The interim pending-exchange scan stays until Horizon `headless-ask-discovery` (A39-L). Definition below.

### Parallel / Low-Conflict

- `executor-slice-attempt-lifecycle` ([FE-1192](https://linear.app/hash/issue/FE-1192/executor-slice-attempt-lifecycle)) — **active in the KA lane, picked up 2026-07-13** on `ka/fe-1192-executor-slice-attempt-lifecycle`. First member of the Petri sequence: first-class slice attempts (identity, bounded in-run retry, honest failed-attempt facts). Shape settled at pickup: attempt facts first (topology unchanged), constant retry bound with `ceiling:`, agent step only. Definition below.
- `petri-slice-isolation-fan-in` — admitted 2026-07-13, behind `executor-slice-attempt-lifecycle`: isolated per-slice side effects + explicit fan-in under unchanged serial `run.json` authority. Definition below.
- `executor-run-environment` (FE-1166 follow-up) — the substrate/verify policy is merged; the real-run failure remains prepared in [`memory/cards/executor-run-environment--actionable-slice-request.md`](cards/executor-run-environment--actionable-slice-request.md). Before build, `ln-plan` must settle whether this remains FE-1166 work or becomes a fresh frontier/branch; do not let the prepared card bypass the tracker/branch boundary.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

- `planning-process-model` — **demoted from Next #1 on 2026-07-03 (grill):** exploratory D103-L bet-proving, not ship-blocking. Behind the gate. Guard: the orientation menus' "project a plan" option routes to the existing `project`/`map-plans` seam at frontier-level depth (D103-L boundary) and must **not** pull this frontier forward. Groundwork stays parked on `ln/fe-xxx-plan-plane-redesign`; full definition below.
- `review-commentary-widening` — GitHub-style per-item review commentary: widen the review answered payload (`comments: [{on: draft|edge|set, body}]`, a SPEC decision) plus the collection UI. Deferred post-gate at FE-1138 scope (2026-07-03): the payload ripples into the review schema that capture-contract rows and the digest terminal consume. Once `exchange-ask-refinement` lands, the widening re-expresses over the D116-L declared-ask/answer payload rather than `request_response` details. Sketch: `src/agents/contexts/exchanges/design-permutations.md` §Review-set evaluation.
- `develop-mode` — third operational mode `develop` / Develop running a new `engineer` agent: a Brunch-aware coding assistant *without* the `execute_*` tool set and with kick/consult mechanisms inert (user-driven turns, not agent-driven). Split out of `main-editor-chrome` at the 2026-07-08 grill. Entry is a SPEC revision, not a feature slice: D98-L ("two modes only" — though Develop is a distinct agent with different grants, not the conduct-bias `Enhance` that grill rejected), req 26, and D40-L placement of `engineer` in the concentric authority matrix (executor-minus-`execute_*`? elicitor-plus-coding?), plus a new per-mode kick/consult-suppression policy axis. Route through `ln-grill`/`ln-spec` at pickup. Groundwork (mode-cycling keybinding, border-by-mode) lands mode-agnostically in `main-editor-chrome`.
- `headless-ask-discovery` — the A39-L follow-up to D116-L: RPC discovery of open `ask` calls (streamed session events or a pending-interactive-call read method) replacing `session.pendingExchange` transcript scanning, so an agent-as-user driver can generatively build specs against a goal over the headless surface. Not first-release-critical; headless asks resolve `unavailable` until this lands. Broker (`awaitAnswer`/`session.submitExchangeResponse`) is unchanged by design.
- `petri-epic-integration` — epics become integration gates, not just identity labels: an epic-complete transition gated on member slices, with epic-level verification/fan-in in the compiled topology (`epicId` identity already flows through subnets and emitted facts). Behind `petri-slice-isolation-fan-in`; shape via `ln-grill`/`ln-scope` at pickup.
- `petri-durable-parallel-authority` — the repeatedly deferred authority flip (SPEC §Future Direction): durable marking/journal authority for concurrently firing side effects once `run.json`'s single-status ladder cannot represent in-flight parallelism. Final member of the admitted Petri sequence, discharging the former "Petri follow-up trigger" row. Promote to Next only when `petri-slice-isolation-fan-in` evidence shows serial authority is the binding constraint — do not pull it forward for old-`main` Petrinaut parity.
- `reconciliation-derivation` — derive `edge_revalidation` reconciliation needs from LSN comparison instead of persisting them; full definition below (inventory findings from 2026-07-02, worth keeping). **Confirmed behind the gate 2026-07-03 (grill G7):** the ingest throughline's conflict routing rides the existing persisted `reconciliation_need` substrate (`create_reconciliation_need` is live); nothing in the gate needs the LSN-derived generator. Honor the convergence: the `contradictory` seed variant capture now rides `walkthrough-evidence-batch` (FE-1167).
- `reviewer-agent-mode` — D29-L's async advisory reviewer remains designed but unbuilt: narrow write authority to `reconciliation_need`, batch-acceptance trigger keyed by session/batch entry, A16-L trigger/scope questions still open. Behind the ship gate; no frontier until post-acceptance review becomes POC-blocking or reviewer residues need executable closure.
- `session-branching` — support session branching (D24-L reversal); needs branch-aware continuity/coherence design (A37-L).
- `compaction-and-conflict-widening` — long-horizon continuity through compaction.
- `agent-tracing` — passive trace instrumentation over Pi lifecycle events for debugging plus conduct/quality evaluation: NDJSON emitter extension (introspection-tap discipline), subagent span joining via SDK `session.subscribe`, and a mechanical-trace × semantic-JSONL join for deterministic conduct checks and judged passes. Entry move is an `ln-spike` (dev-gated `nikiforovall/pi-otel` import: do span trees beat `.brunch/debug/` + JSONL projections?) before any port of `JoshMock/the-agency` observability as the in-product base. Traces are dev/eval artifacts, never product truth (no event-spine backdoor). Design: `docs/design/AGENT_TRACING.md`; sibling idea note `docs/design/RLM_INVESTIGATION_PATTERN.md`. Relation: Next `mechanism-trace` is the transcript-native sibling (carrier classification, no event plane); if both land they may join on a shared trace vocabulary.
- `web-driver-streaming` — remaining consumer/UI and non-freeform answer legs after the built topology-A relay battery.

### Retired / Never

- `coherence-first-class` — retired as an independent frontier; future coherence work should be driven only by a concrete triggering frontier that needs it.
- `flue-pattern-adoption` + `framework-direction-stubs` — removed from Horizon 2026-07-08: both are postures/directions, not work items, and both already live in `memory/SPEC.md` §Future Direction ("Adoption patterns from Flue"; "Framework alignment & deferred subsystems"). Re-enter only via a concrete triggering frontier.
- `geolog-and-petri-execution` — split 2026-07-08: Petri moved into FE-1183 `petri-interpreter-port`, now review-clean and closing; geolog can re-enter only when it has its own triggering seam instead of sharing a vague exploratory bucket.
- `fixture-vs-real-audit` — dropped 2026-07-08 (action-or-drop call): its operative content graduated into `ln-review`'s contract-lens catalog (the opaque-companion lens carries the untested-against-real angle); run `ln-induct` on fresh evidence rather than keeping a standing audit bucket.
- `roving-suite-flake` — dropped 2026-07-08 (action-or-drop call), re-opened and closed by same-day `ln-diagnose`: repeated full-suite runs reproduced the `git-host-promotion-port` timeout while isolation stayed green; phase timestamps showed no `git apply` hang, only cumulative spawned-git slowdown under default Vitest worker load, with the real-TUI harness showing the same scheduling sensitivity. Fix: `npm test` caps Vitest at 4 workers and the promotion real-git fixture removes clone/pull/config churn while preserving the real patch/apply witness. Oracle: default `npm test -- --reporter=dot` passed after the cap (228 files passed / 1 skipped, 1561 tests passed / 3 skipped, ~53s).
- `blank-carrier-sweep` — folded 2026-07-08 into the FE-1163 ledger as row 13 (`exchanges-blank-carriers`); no longer a standalone Horizon item.

## Frontier Definitions

<!-- component-dx (FE-1115) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08 hygiene pass);
     frontier closed as done for DX. Durable truth: src/dev/TOPOLOGY.md §Component Preview Harness,
     src/.pi/components/TOPOLOGY.md. UX component work opens fresh frontiers in the chrome batch. -->

<!-- exchange-ask-refinement (FE-1164) archived to docs/archive/PLAN_HISTORY.md (2026-07-10 ln-sync); durable truth: D116-L, A39-L, exchange topology homes, runtime-mount and supersession probes. -->

<!-- exchange-rendering (FE-1123) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D104-L, D108-L, exchange-family-completeness.test.ts, src/exchanges/TOPOLOGY.md. -->

<!-- exchange-answering-chrome (FE-1138) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-06 ln-sync);
     durable truth: docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md (mechanism + coverage matrix + pi-bump
     re-verification checklist), src/.pi/components/TOPOLOGY.md + src/.pi/extensions/exchanges/TOPOLOGY.md,
     the session.submitExchangeResponse ctx.ui.*-independence contract test, and the component direct/harness
     test families. Deferred post-gate residue: per-item review commentary (see Horizon `review-commentary-widening`). -->


<!-- exchange-capture-contract (FE-1135) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: I57-L, the five governing invariants in the ingest/elicit/map conduct homes (pinned by
     src/probes/__tests__/exchange-capture-contract-proof.test.ts), sweep-window exclusions in
     sweep-watermark.test.ts, and the canonical formatMutateGraphResult approval receipt in
     session.submitExchangeResponse. Consumed sweep ledger deleted. -->

<!-- present-digest (FE-1136) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-06 ln-sync);
     durable truth: D110-L, D106-L echo, I57-L digest chain witness (present-digest-supersession-proof.test.ts
     + 2026-07-06 live walkthrough beat), retired DIGEST_CUSTOM_TYPES, topology homes named in D110-L.
     Consumed scope card memory/cards/present-digest--exchange-kind.md deleted. -->


<!-- main-editor-chrome (FE-1169) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-09 sync, merged #305);
     durable truth: D22-L/D35-L chrome projections, D104-L revision, src/.pi/components/TOPOLOGY.md,
     src/.pi/extensions/chrome/TOPOLOGY.md, src/.pi/extensions/exchanges/TOPOLOGY.md, src/dev/TOPOLOGY.md.
     Outer manual beats ride the alpha walkthrough lane (TESTING_PLAN.md Concern 7). -->

<!-- walkthrough-remediation-1 (FE-1180) archived to docs/archive/PLAN_HISTORY.md (2026-07-10 ln-sync); WR18 residue lives in walkthrough-remediation-2 / FE-1187. -->

### legacy-question-read-path-retirement

- **Name:** Retire legacy `present_question` read paths and fixtures
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (off `next`)
- **Kind:** earned deletion / vocabulary convergence
- **Certainty:** earned — D116-L's ask write path is settled; this frontier removes only persisted-read compatibility branches and stale fixtures.
- **Deletes / retires:** `present_question` branches in pending-exchange scan and recovery skip; `src/.pi/README.md`'s legacy-vocabulary section; old-tuple fixtures in session/RPC/editor/probe tests after checking committed `.fixtures/runs/` for required historical evidence.
- **Keeps:** the pending-exchange scan itself as the interim projection until `headless-ask-discovery` (A39-L); current ask/request-detail transcript semantics.
- **Traceability:** D116-L, A39-L; 2026-07-09 `ln-induct` finding 4 over PR #304. The write-path half already landed on #305.

### walkthrough-remediation-2

- **Name:** Walkthrough remediation sweep 2 — WR18 follow-up closure
- **Linear:** [FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure)
- **Branch:** tbd at pickup.
- **Kind:** coverage-shaped remediation sweep over WR18-promoted failures/unknowns.
- **Certainty:** proving.
- **Classification:** evidence-gated.
- **Entry:** spec-first through `ln-spec` / disambiguation before implementation. D113-L–D115-L currently encode the alpha allowlist/login/no-auth gate; they must be reconciled with the user's direction to remove provider/model restrictions, stop treating `brunch login` as the preferred path, and remove the startup warning.
- **Boundary / findings inventory:** Shift+Tab extension/built-in shortcut conflict; provider/model restrictions; startup-menu auth warning and `brunch login` guidance/product path; duplicated `.brunch/debug/origination.md` records; unintended Pi-documentation references in `system-prompt.md`; missing `/continue` / `/consult` / `/mode` hints after ask cancellation; repeated offer content in present→ask continuation; no-model `/brunch:continue` plus no seed/kick carrier observation; extraction breadth after a thin first pass; O7/O8/O9 live D120-L Execute workflows; O10 both-theme component/live-TUI checks.
- **Dependencies:** owns all WR18 residue promoted out of FE-1180 and precedes `spec-posture`, `walkthrough-evidence-batch`, and later walkthrough evidence that depends on the reshaped auth/ask/Execute surfaces.
- **Traceability:** WR18 closure record in `TESTING_FINDINGS.md`; evidence at `testing/walkthroughs/2026-07-10/WR18-manual.md`; D113-L–D115-L reversal/disambiguation; D119-L, D120-L/I62-L, D99-L conduct; TESTING_PLAN concerns 1/3/4/6/7.

### spec-posture

- **Name:** Spec posture persistence + deterministic establishment
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (off `next`; low conflict with remediation rows except the workspace-dialog seam — coordinate if parallel)
- **Kind:** structural — new spec-row field(s) + a new establishment step in the spec creation/resume flow.
- **Certainty:** proving — whether deterministic posture questions feel like orientation or like peppering (the 0.x failure mode) is the open question; the schema change itself is small.
- **Objective:** materialize D118-L: `origin: greenfield|brownfield` on the spec row, confirmed-not-defaulted `spec.kind` (D89-L), and a relates-to-spec reference (A41-L — includes the root-spec-as-plain-reference bet and the `function`-vs-`story` third-term call). Establishment is a product-owned ask/confirm step at spec creation/resume (D109-L juncture family / workspace-dialog seam), branching on workspace-populated vs bare per the TESTING_PLAN Concern 2 matrix; readers: kick assembly, capture conduct (brownfield facts enter as advisory, D99-L), orientation-question skipping. Keep the question sequence minimal — skip anything inferable.
- **Verification:** schema + establishment-flow tests inner-loop; run D (populated cwd, brownfield confirm) and run B's orientation beats are the outer oracle; the Concern 2 matrix is the behavioral contract.
- **Traceability:** D118-L, A41-L, D89-L, D99-L, D102-L (amended), D109-L; `docs/design/SPEC_INITIATIVE_MODEL.md` (deferred spec-relationship model — do not pull it forward).

### walkthrough-evidence-batch

- **Name:** Walkthrough evidence batch — outer-loop checks for the merged orientation and executor lanes
- **Linear:** [FE-1167](https://linear.app/hash/issue/FE-1167/walkthrough-evidence-batch-outer-loop-checks-for-merged-orientation)
- **Branch:** tbd at pickup (off `next`; the beats must witness the current ask surfaces, not the retired ones)
- **Kind:** verification batch / walkthrough evidence + external-residue closure. Arc: `deterministic-orientation` (closing member).
- **Certainty:** proving — the evidence is the point; conduct quality on the generative flows and Execute-mode assessment is unwitnessed.
- **Why now / unlocks:** created by the 2026-07-08 hygiene fold — FE-1134, FE-1137, FE-1124, and FE-1107 all merged with the *same* unowned residue ("outer walkthrough evidence on a re-braided branch"), leaving three frontiers permanently un-closable. This batch owns all of it in one place with one trigger.
- **Objective (five residue groups):**
  1. **FE-1134 evidence:** live walkthrough beats for the orientation menu's generative options (propose/project), using the FE-1124 seed variants; menu→conduct routing evidence via session JSONL skill reads.
  2. **FE-1137 evidence:** Execute-mode entry beats on thin vs rich seeds (assessment honesty: Ask on thin, Proceed on rich); capture evidence on the two deferred orientation-choice questions — `continue`/`proceed` semantics and the sticky-posture candidate (a D98-L-sensitive reversal; route through `ln-grill`/`ln-spec` if evidence says revisit).
  3. **FE-1124 remainder:** Card 3 review variants (`memory/cards/walkthrough-batch-2--seed-variants.md`) + the seed-variation worklist; findings continue in `TESTING_FINDINGS.md`.
  4. **FE-1107/KA residue:** executor-card GC completed in the 2026-07-08 sync; remaining: settle FE-1107 close-or-narrow, hold the demo session (`docs/DEMO_STACK_OVERVIEW_2026-07-06.md`, delete after), then the owed post-KA `ln-plan` pass.
  5. **FE-1164 walkthrough residue (folded from the retired 2026-07-08 handoff — FE-1164 merged without these witnessed):** declared continuations driven live (digest/review/candidates chain); capture sweep after ask answers (highest-value — the outer witness of the `64aad51a` sweep-classifier fix); resume re-render of persisted ask results; web sidecar behavior during an open ask; `dev:components` gallery re-check in both themes. Workbench: `.fixtures/workbenches/workspace-alpha-grounding` (`npm run dev -- --workspace …`; reseed `npm run seed -- --seed workspace-alpha-grounding/base --reset`). Note: the ask surfaces have since been reshaped by FE-1169 (compact result content, hierarchical esc, mode-reactive borders) — witness the current surfaces, not FE-1164's originals.
- **Annotations:** Retires: the unwitnessed-conduct uncertainty on generative menus and Execute entry (the arc's "one witnessed e2e run per generative flow" obligation). Closes: arc `deterministic-orientation`; the FE-1107 disposition question.
- **Acceptance sketch:** per-flow walkthrough beats recorded against `TESTING_FINDINGS.md` with session JSONL evidence; the two deferred FE-1137 questions answered or explicitly re-routed; KA residue dispositions recorded in PLAN; arc marked done only when its done-definition holds (incl. topology reconciliation).
- **Verification:** manual outer loop per `docs/praxis/manual-testing.md`, with session JSONL + debug-mirror artifacts as the recorded oracles.
- **Traceability:** D98-L, D109-L, D40-L, D74-L, D101-L/D102-L; TESTING_PLAN.md goals 6/7; arc `deterministic-orientation` done-definition.

### mechanism-trace

- **Name:** Mechanism-provenance trace — carrier-classified transcript timeline + sweep-debt tripwire
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (off `next`; no stack dependency)
- **Kind:** structural — a new dev/observability projection seam over the transcript substrate. Dev/eval artifact, never product truth (same discipline as Horizon `agent-tracing`: no event-spine backdoor).
- **Certainty:** proving — whether a carrier-classified timeline actually makes provenance legible during a walkthrough (and whether the tripwire fires cleanly without false positives) is the open question; the classification substrate itself is well-understood.
- **Why now / unlocks:** the 2026-07-08 capture-sweep grill established that during manual walkthroughs the user cannot tell whether an agent action was product-forced, event-nudged, or freely chosen — and that sweep ingestion has no conduct-level oracle (SPEC blind spot "Sweep ingestion reliability", A40-L). The trace is the instrument; the tripwire is its first paying customer. FE-1167's walkthrough beats become materially cheaper to interpret with it.
- **Objective (three parts, grilled 2026-07-08 — Q1–Q7 record in the grill session):**
  1. **Mechanism trace (the spine):** a post-hoc projection over a session JSONL that renders an interleaved timeline of entries classified by carrier — `wiring` (ledger-only product appends: `brunch.capture_sweep_watermark`, `brunch.own_mutation`, orientation entries — the `PreparedLedgerEntry` class), `nudge` (provider-visible product injections — the `PreparedMessageEntry` class, e.g. `worldUpdate`), `conduct` (agent tool calls / toolResults). Consumable as an extended `.brunch/debug/` mirror or a standalone read command; post-hoc first (Q7), no live surface.
  2. **Static wiring inventory:** a short canonical document enumerating every deterministic product append site and visible nudge, so the trace's carrier classes are auditable against code rather than folklore. Home: co-located topology or `docs/design/`, decided at scope time.
  3. **Sweep-debt tripwire (derived assertion, Q1/Q3/Q5):** over the trace, assert per scenario — on expected-capture scenarios the conversational tail preceding a watermark shows capture evidence (`mutate_graph`/scratchpad conduct); on deliberately-ignored-material scenarios it does not fire. Outer-loop oracle first; a runtime nudge only if walkthroughs show actual stranding. No change to the `before_agent_start` advance (Q2 — `turn_end` stays a future upgrade under A40-L).
- **Annotations:** Lights up: provenance legibility over any session transcript (the walkthrough instrument). Stabilizes: the three-carrier classification as the canonical provenance vocabulary. Retires (partially): the "Sweep ingestion reliability" blind spot's *detection* half — A40-L's capture-conditional advance stays open.
- **Explicitly out:** capture-conditional watermark advance / `turn_end` rewiring (A40-L, future); live in-session trace surface (Q7 — post-hoc first); the D117-L constant-anchoring hardening (direct fix, not frontier work); Pi lifecycle-event span tracing (Horizon `agent-tracing` — that frontier is event-plane instrumentation; this one is transcript-native classification; they may later join).
- **Convergence:** `walkthrough-evidence-batch` (FE-1167) — group 5's "capture sweep after ask answers" beat is the tripwire's first live scenario; prefer having the trace available before or during that batch. Refresh pressure on `src/probes/capture-quality-loop.ts` (last promoted run 2026-06-08) can ride this frontier's tripwire scenarios rather than a separate pass.
- **Traceability:** A40-L, D117-L, D80-L (capture as conduct), D81-L (commitment gradient), I57-L (accepted-terminal read rules), SPEC blind spot "Sweep ingestion reliability (optimistic watermark)"; `src/projections/session/sweep-watermark.ts`, `src/session/prepare-next-turn.ts` (`PreparedLedgerEntry`/`PreparedMessageEntry`), `src/.pi/extensions/dev-mode/introspection/`.

<!-- alpha-release-readiness (FE-1159) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-09 sync,
     1.0.0-alpha.0 published under dist-tag alpha); durable truth: D113-L/D114-L/D115-L, I59-L,
     check:release-pack, src/app/TOPOLOGY.md. -->

<!-- session-entry-orientation (FE-1134) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #289);
     durable truth: D109-L, src/.pi/extensions/TOPOLOGY.md, src/session/TOPOLOGY.md.
     Outer walkthrough evidence rides walkthrough-evidence-batch (FE-1167). -->

<!-- execute-entry-readiness (FE-1137) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #290);
     durable truth: D40-L concentric matrix (agent-runtime-authority-matrix.test.ts), D109-L esc-inert revision,
     readiness-bands.md §Agent Use. Outer evidence + the two deferred orientation-choice questions ride FE-1167. -->

<!-- walkthrough-fixes (FE-1122) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #286);
     findings ledger TESTING_FINDINGS.md; walkthrough continuation rides FE-1167. -->

<!-- orchestrator-tool-port (FE-1107) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #298);
     mechanism delivered by the KA executor lane (D111-L/D112-L/I58-L; src/executor/TOPOLOGY.md).
     KA-conversation residue (card GC, close-or-narrow, demo session, post-KA plan pass) rides FE-1167. -->

### executor-run-environment

- **Name:** Greenfield executor run substrate and verify policy
- **Linear:** [FE-1166](https://linear.app/hash/issue/FE-1166/greenfield-executor-run-substrate-and-verify-policy)
- **Branch:** original `ka/fe-1166-greenfield-executor-harness` merged in PR #302; follow-up branch disposition pending `ln-plan`.
- **Kind:** structural / executor run environment policy
- **Status:** original frontier delivered; one real-run failure is prepared in `memory/cards/executor-run-environment--actionable-slice-request.md`. Do not build until `ln-plan` decides whether it remains FE-1166 work or becomes a fresh frontier/branch.
- **Objective:** Separate run substrate and verify target from source-copy policy so greenfield fixture runs can use an isolated run directory and product-owned verification profile instead of always starting from a host git worktree and hardcoded `npm run verify`.
- **Traceability:** FE-1114 follow-up live-run evidence; `src/executor/worktree.ts`, `src/executor/test-result.ts`, `src/app/test-runner-port.ts`, `src/.pi/extensions/executor/execute-run-create/index.ts`; follow-up worker-request evidence from run `run-mrbyf8u9` recorded in `memory/cards/executor-run-environment--actionable-slice-request.md`.

<!-- elicitation-gap-guidance (FE-1116) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D99-L, D101-L, D102-L, I52-L, I56-L, closure oracle
     src/graph/__tests__/elicitation-gap-guidance-closure.test.ts, docs/archive/SESSION_LOCAL_ELICITATION_GAPS.md. -->

<!-- executor-run-observer (FE-1141) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #295);
     durable truth: execute.* read projections, run-scoped brunch.updated topics, src/executor/TOPOLOGY.md,
     src/web/TOPOLOGY.md. Follow-on KA work continues on #300/#302/#303. -->

<!-- executor-run-integrity (FE-1154) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #297);
     retained executor card GC completed in the 2026-07-08 sync. -->

### planning-process-model

- **Name:** Planning-process model — plan-as-projection, epistemic horizon, and the `scope`-node question
- **Linear:** unassigned
- **Branch:** `ln/fe-xxx-plan-plane-redesign` (plan-plane groundwork already landed here: `slice` removal + D103-L + CueLoop liftout)
- **Kind:** structural / plan-plane semantics
- **Status:** proving candidate opened by D103-L; **demoted to Horizon 2026-07-03 (grill)** — exploratory bet-proving, behind the ship gate. The orientation menus' "project a plan" option routes to the existing `project`/`map-plans` seam at frontier-level depth and does not depend on or advance this frontier. Mostly SPEC/skill work at first, low code-conflict.
- **Certainty:** proving.
- **Lights up:** plan generation as *projection* from committed graph truth (milestone/frontier) — a `project` (D100-L) plan-plane path, first exercised as a read-only plan projection, optionally exported to an external format (CueLoop, `docs/design/CUELOOP_PATTERN_LIFTOUT.md`) as design pressure.
- **Stabilizes:** the plan-plane boundary set by D103-L (plane stops at `frontier`) — by proving what *is* projectable there, and by locating whether a durable accountability node below `frontier` (candidate `scope`) is needed or stays process-only (`ln-scope`/`ln-build` scope cards).
- **Objective:** Turn the D103-L future-direction bet into evidence: model how Brunch's plan plane handles (1) projection from intent/oracle/design down to milestones/frontiers, (2) the epistemic horizon (fog-of-war) and non-structural sequential dependency that bite at scoping, and (3) the trade-offs (extend horizon vs gain parallelism) as design-style decision flows. Fire the cheapest tracer — plan-as-projection — before deciding whether horizon/decision-flow state or a `scope` node earns durable representation.
- **Acceptance:**
  - A plan projection is derived from committed graph truth (milestone/frontier plus their intent/oracle/design anchors) and rendered thinly, reusing the `project` (D100-L) seam rather than a new graph-write path or exchange schema family.
  - The projection is demonstrably *projection*, not free generation: it starts from accepted upstream anchors and never commits plan-plane graph truth itself (I51-L discipline).
  - An external-format export (e.g. CueLoop) is proven as an optional downstream rendering of that projection, or explicitly rejected with a recorded reason — used only as design pressure, not as product architecture.
  - The `scope`-node question is resolved with evidence: either a durable below-`frontier` accountability node is specified (routing back to `ln-spec`) or it is confirmed process-only. Until then the epistemic-horizon/decision-flow model stays behind the fog (D103-L future direction), not built.
- **Traceability:** D103-L (plane stops at frontier; opens this model), D100-L (`project` seam), D56-L / D94-L (kind set + REQ/AC boundary), D87-L (`unknown` = horizon on the intent plane), D99-L (advisory/settled); relates to `orchestrator-tool-port` (D98-L executor may own execution/scope concerns). SPEC §Future Direction "Planning persistence evolution".


### petri-interpreter-port

- **Name:** Execute-mode Petri interpreter port — subnet-preserving scheduler/runtime
- **Linear:** [FE-1183](https://linear.app/hash/issue/FE-1183/port-petri-interpreter-to-alpha-orchestrator)
- **Branch:** interpreter landed through PR #311; plan alignment through #319; final replay/export closure on `ka/fe-1183-petrinaut-replay-export` (PR #320)
- **Kind:** structural / executor run substrate
- **Status:** implementation complete; PR #320 is the final FE-1183 observer-only closure. It adds validated SDCPN v1 projection plus finite artifact-backed replay/SSE/launcher surfaces. Live-from-start streaming and durable parallel side-effect authority are separate frontier decisions.
- **Certainty:** proving.
- **Why now / unlocks:** D112-L shaped `RunScheduler.ready()` as a set-returning seam so the Petri scheduler could replace the flat status ladder without reshaping callers. FE-1183 materialized that executor runtime structure; later questions such as durable parallel side-effect authority and semantic/review lanes can now be scoped over a real net instead of another round of status-enum surgery.
- **Objective:** Port the `main` Petri substrate (interpreter, transition contracts, firing-policy seam, structured transition events) into `src/executor/` as an internal runtime that drives today's step handlers. Compile the current execute lifecycle into **explicit subnets**, not a flat list of ready steps: at minimum a run-control subnet plus per-slice subnets keyed by stable slice ids, with subnet/lane identity preserved in the compiled topology even if the first tracer still fires serially. The first landing must preserve current product truth — existing lifecycle step functions remain the only side-effecting boundaries; `run.json` stays loop state for observers/recovery; `execute_petri_export` remains a projection/export surface, not a second runtime.
- **Acceptance sketch:**
  - (1) A Petri runtime under `src/executor/` can drive the current lifecycle end-to-end through injected step handlers, and `drive()` can be backed by either the existing linear scheduler or the new Petri scheduler without changing callers.
  - (2) The compiler emits explicit subnet metadata/ids for run-control and slice-control groups rather than flattening directly to `ReadyStep`s; current topology may remain serial, but the grouping is structural from day one.
  - (3) The first compiled net reproduces today's lifecycle ordering exactly (`created` → `worktree_created` → `worktree_populated` → `source_policy_selected` → `source_copied` → `reports_initialized` → slice loop → `run_completed` → `petri_exported` → `promotion_prepared`) and halts in the same places the current steps hold status unchanged.
  - (4) Structured transition events are emitted as Brunch-owned executor runtime facts rather than inferred later from `run.json` diffs.
  - (5) Naming and read surfaces stay honest: the existing `petrinaut/net.json` export/read path is clearly treated as a raw projection of run state, not confused with the interpreter's internal runtime representation.
  - (6) Non-goals for the first tracer: graph compilation, semantic/oracle/review lanes, durable marking persistence, Petrinaut live sync, and any geolog coupling.
- **First tracer:** compile a serial net for the current executor lifecycle using today's step functions as transition actions, preserving subnet ids and transition contracts now while explicitly deferring parallel firing and marking persistence. The tracer should prove the topology split (`compileExecutorTopology(...) -> blueprint`, `wireExecutorHandlers(...) -> runtime net`) before any attempt to outgrow the current lifecycle.
- **Current execution pointer:** the alpha-orchestrator tracer, compiled export, raw runtime-event journal, replay read model, export-honesty hardening, and first durable-marking seam are landed on [`ka/fe-1183-petri-interpreter-port`](https://github.com/hashintel/brunch/pull/311) via [`src/executor/orchestrate-topology.ts`](../src/executor/orchestrate-topology.ts), [`src/executor/orchestrate.ts`](../src/executor/orchestrate.ts), [`src/executor/petri-runtime.ts`](../src/executor/petri-runtime.ts), [`src/executor/petri-terminal.ts`](../src/executor/petri-terminal.ts), [`src/executor/petri-events.ts`](../src/executor/petri-events.ts), [`src/executor/petri-marking.ts`](../src/executor/petri-marking.ts), [`src/executor/petri.ts`](../src/executor/petri.ts), [`src/executor/petri-replay-eligibility.ts`](../src/executor/petri-replay-eligibility.ts), and [`src/executor/petri-replay.ts`](../src/executor/petri-replay.ts), plus the executor/RPC/web tests: explicit run/slice subnet compilation, explicit place/arc + `initialMarking` export, duplicate slice-id rejection, `petriScheduler` lifecycle parity, executor-owned transition events, preserved epic identity in compiled subnets/transitions and emitted `transition_fired` facts, graph-derived slice provenance (`definition`, `verification`, `derived_from`) preserved through scheduler projection into slice subnets/export and surfaced as `derivedFrom` on emitted slice transition facts, shared transition readiness/terminal classification helpers, a materialized serial runtime (`currentMarking`, enabled transitions, ready steps) plus bound transition executors that dispatch through the existing lifecycle step handlers, persisted `petrinaut/events.jsonl` tails through `execute.run`, a persisted `petrinaut/marking.json` snapshot for current marking / fired-count / terminal summary with replay fallback when absent or unreadable, a persisted claim-set inside that marking snapshot so read surfaces can distinguish "currently reserved by Petri" from lifecycle facts already reflected in `run.json` and a restarted drive can honor the same claimed firing order when provenance still matches, including through the default linear execute loop, while refusing corrupted overclaimed claim-sets that do not co-fire from the live marking, stripping impossible or uncheckable claim sets from read projections, rejecting provenance-matching snapshots whose persisted `currentMarking`, `firedTransitionCount`, or terminal summary contradict replay-backed or lifecycle-checkable truth, rejecting malformed terminal payload pairings at both the persisted-snapshot and live-update boundaries, and now stripping replay terminal summaries too when the raw journal reports contradictory or under-specified terminal tails instead of trusting the last one, a derived `petriProjection` surfaced through `execute.run` and now through live `execute.run` product updates/cache patches with explicit replay-reason clears when later snapshot-backed updates supersede replay hints plus boundary validation that rejects malformed projection payloads instead of desynchronizing cached source/replay metadata, and epic-aware `petriReadySteps` / `petriBlockedSteps` surfaced through executor/RPC/web read paths with active slice identity preserved on in-flight slice steps rather than collapsing to anonymous `slice_execute` / `agent_result` / `test_result` / `slice_complete` labels. Durable parallel side effects remain deferred because `run.json` is still the only lifecycle authority.
- **Traceability:** D111-L (executor lifecycle ownership in `src/executor/`), D112-L (set-returning scheduler seam now materialized by the Petri runtime), `memory/SPEC.md` §Future Direction "Plan execution & Petri-net compatibility", and the proven prior-art substrate on `main` (`src/orchestrator/src/petri-net.ts`, `docs/next/architecture/plan-graph-petri-orchestration.md` — especially the slice-net/subnet model).
- **Review-clean reconciliation (`5ae01c98`):** [`src/executor/petri-runtime-plan.ts`](../src/executor/petri-runtime-plan.ts) now owns one populated-plan fallback set for `drive()` and observer reads, preventing read-side ready/blocked hints from diverging from driver semantics when metadata omits `populatedPlanPath`. Runtime materialization now fails closed: duplicate slice ids or otherwise invalid topology halt `drive()` with `petri_input_unreadable` and emit `net_halted` instead of rejecting the tool call. Focused regressions cover both seams; the full `npm run verify` gate passed.
- **Post-review correctness closure:** explicit populated plans are authoritative; duplicate, dangling, self-referential, and cyclic topology plus unreplayable lifecycle history fail closed at every drive status; persisted claims require matching marking and firing count; nonterminal exhaustion is `net_deadlocked`; empty journals cannot project replay state; unreadable runtime updates clear cached ready/blocked hints.

### petrinaut-live-run-stream

- **Name:** Petrinaut live run stream — pre-execution definition through terminal replay
- **Linear:** [FE-1190](https://linear.app/hash/issue/FE-1190/petrinaut-live-run-stream)
- **Branch:** `ka/fe-1190-petrinaut-live-run-stream` ([PR #322](https://github.com/hashintel/brunch/pull/322), off `next`)
- **Kind:** structural observer transport over the executor event journal.
- **Certainty:** proving.
- **Lights up:** a Petrinaut connection established before the first executor transition, with late-join replay equivalent to the observed live sequence.
- **Objective:** materialize the immutable SDCPN definition and empty event journal before execution, attach a run-scoped stream before the initial marking/first transition, and deliver validated definition → initial state → firings → terminal frames without changing `run.json` lifecycle authority.
- **Acceptance sketch:** production lifecycle test connects before the first transition; reconnect receives the same ordered timeline; terminal closes the stream; malformed artifacts fail closed; configured-origin CORS remains enforced; stream observers cannot mutate or claim execution.
- **Depends on:** FE-1183 / PR #320 finite replay contract. Explicitly excludes durable parallel side-effect authority.
- **Traceability:** D111-L, D112-L, I58-L; `src/executor/TOPOLOGY.md`, `src/rpc/TOPOLOGY.md`.
- **Status:** ✓ merged (#322, 2026-07-13); FE-1190 closed. Durable truth: SPEC §Future Direction "Plan execution & Petri-net compatibility" (journal-ordered completion, fail-closed appends, terminal-lagging-snapshot backfill), `src/executor/TOPOLOGY.md`, `src/rpc/TOPOLOGY.md`. Definition retained while the Petri sequence builds on its contracts; archive at next `ln-sync`.


### executor-slice-attempt-lifecycle

- **Name:** Slice attempt lifecycle — first-class attempts in the executor net
- **Linear:** [FE-1192](https://linear.app/hash/issue/FE-1192/executor-slice-attempt-lifecycle)
- **Branch:** `ka/fe-1192-executor-slice-attempt-lifecycle` (off `next`)
- **Kind:** structural — executor lifecycle + Petri topology semantics (new attempt seam).
- **Certainty:** proving.
- **Shape (settled at pickup 2026-07-13):** attempt facts first — compiled net topology unchanged, attempts are journal facts, drive owns the bounded retry; retry bound is a named constant with a `ceiling:` to plan-declared; first slice covers the agent step only. Petri-native self-loop topology and `test_run_failed` coverage are named follow-ups.
- **Status:** implementation complete 2026-07-13 — `attempt_failed` journal facts (non-marking; replay/export skip them) for agent and verify-runner failures, bounded in-run retry with per-stage `run.json` attempt counters (success clears; HITL retry resets), Petrinaut frame contract unchanged. Petri-native attempt topology **explicitly deferred** to `petri-slice-isolation-fan-in`, where concurrent subnets make Petrinaut-visible attempts earn their place. Review/submit pending.
- **Why now / unlocks:** today a failed slice step halts the whole drive, recovery exists only as the run-scoped HITL `execute_replan_*` family, and a failed attempt is invisible in the compiled net (the transition simply never fires). Attempt identity is the prerequisite for everything downstream in this sequence: isolation/fan-in needs per-attempt workspaces, and epic integration needs to represent partial failure without abandoning the run.
- **Objective:** make slice execution attempts first-class executor facts — attempt identity and verdict on agent/verify steps, bounded in-run retry expressed as topology (attempt-scoped places/transitions or attempt provenance) rather than driver special-cases, and honest journal/stream representation of failed attempts. `run.json` remains lifecycle authority; `execute_replan_*` remains the escalation path when attempts exhaust.
- **Lights up:** an in-run attempt loop (failed agent/verify attempt → bounded retry) visible in the journal and the Petrinaut stream.
- **Stabilizes:** attempt identity as the vocabulary `petri-slice-isolation-fan-in` and `petri-epic-integration` build on.
- **Acceptance sketch (validate at pickup — the 2026-07-11 session settled only the ordering):** a slice whose first attempt fails can retry in-run within a declared bound without abandoning the run; attempts carry stable identity through executor facts (journal, reports, read surfaces); exhausted attempts land in the existing halted/replan flow; serial lifecycle ordering, journal-truth ordering (hints never outrun durable append), and I58-L side-effect honesty are preserved.
- **Traceability:** D111-L, D112-L, I58-L; SPEC §Future Direction "Plan execution & Petri-net compatibility"; `src/executor/TOPOLOGY.md`; the run-scoped recovery family (PR #303 stack).

### petri-slice-isolation-fan-in

- **Name:** Parallel slice isolation and fan-in under serial authority
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (stacks on `executor-slice-attempt-lifecycle`)
- **Kind:** structural — per-slice side-effect isolation + an explicit integration seam.
- **Certainty:** proving.
- **Blocked by:** `executor-slice-attempt-lifecycle` (attempt identity), which itself waits on the #322 merge.
- **Objective:** let independently enabled slice subnets execute with isolated side effects (per-slice/per-attempt workspace isolation over the FE-1166 substrate policy) and fan their outputs back into the run workspace through an explicit integration step that surfaces conflicts — parallelism in side-effect *execution* while `run.json` stays the serial lifecycle authority. Durable parallel authority is explicitly excluded (it is the sequence's final member).
- **Lights up:** two independent slices executing in isolated substrates with an explicit fan-in/integration transition in the compiled topology.
- **Stabilizes:** the isolation/fan-in seam that `petri-durable-parallel-authority` would later govern; `frontierFiringPolicy`'s co-firable selection becomes load-bearing instead of latent.
- **Acceptance sketch (validate at pickup):** independent slices run in isolated workspaces without cross-contamination; integration conflicts fail closed with an honest halted/replan outcome rather than silent clobber; the Petrinaut stream renders concurrent slice subnets truthfully; serial `run.json` ordering survives.
- **Inherited from FE-1192 (2026-07-13):** Petrinaut-visible attempt topology (static self-loop transitions / retry-budget places compiled into the frozen definition) is owned here — the `attempt_failed` journal vocabulary is settled; this frontier decides whether it graduates into the compiled net. Review residue riding along: extract the mirrored failure-path counter pattern out of `agent-result.ts`/`test-result.ts` when touching the attempt seam (the `attempts`-field presence should become the single retry discriminant in `drive()`), and settle `DriveContext.onNetEvent` — zero production consumers today; become its first real consumer for live hints or delete the hook and correct the executor `TOPOLOGY.md` fan-out claim.
- **Traceability:** D112-L (set-returning scheduler + `frontierFiringPolicy`), FE-1166 substrate/verify policy, `docs/praxis/worktree-agents.md`; SPEC §Future Direction (durable parallel authority stays excluded).

### reconciliation-derivation

- **Name:** Derive `edge_revalidation` reconciliation needs from LSN comparison; keep the table for judgment-shaped kinds
- **Linear:** unassigned (create on pickup)
- **Branch:** tbd
- **Kind:** structural — changes how one reconciliation-need kind originates (derived query vs persisted row) and adds a clearing watermark to the edge schema.
- **Status:** Horizon; inventoried 2026-07-02 (doctor-pass session), not started. This is the "concrete triggering frontier" pattern the retired `coherence-first-class` entry demands — reconciliation work now has a specific mechanism and trigger, not a generic coherence bucket.
- **Certainty:** proving (the derivation is computable today, but whether derived needs are *better product* than persisted ones — noise level, clearing UX — is unproven).
- **Premise (validated by inventory):** for every edge category, `EDGE_CATEGORY_METADATA` (`src/graph/policy/category-policy.ts`, D51-L) already declares the downstream endpoint (`affected`) and `impactKind` (`none`/`advisory`/`cascade`), and nodes/edges carry `updated_at_lsn` — so "upstream updated later than downstream last acknowledged" is directly computable. `src/graph/projection/direction.ts` already derives upstream/downstream from this metadata for three projection consumers.
- **Three corrections that bound the scope:**
  1. Only `edge_revalidation` is LSN-derivable. `possible_relation` / `possible_duplicate` target node pairs with **no edge** (nothing to compare); `semantic_conflict` is a judgment, not staleness. The `reconciliation_need` table **stays** for those three (A8-L one-substrate assumption holds); only `edge_revalidation` flips from persisted row to derived view.
  2. Nothing auto-generates needs today — every row is agent-authored via `create_reconciliation_need`. The `direction.ts` docstring describes an intended "log downstream impacts on edit" flow that was never built. This frontier **adds the missing generator** (as a derived read, cheaper than a write-side trigger), it does not replace a live one — lower risk than "replace the table" suggests.
  3. Clearing needs a **per-edge acknowledged-LSN watermark** (new schema field). A per-node watermark is ambiguous when a node has multiple upstreams with differing categories/policies. Review/clear = bump the edge watermark; a fuller downstream update advances `updated_at_lsn` too.
- **Retires:** the open question "can reconciliation_needs be replaced by LSN/changelog?" (answer: partially — one kind); the never-implemented intent in the `direction.ts` docstring becomes real or gets rewritten.
- **Lights up:** automatic staleness surfacing — the first reconciliation signal a user gets without the agent choosing to author one.
- **Depends on:** D8-L (needs substrate + spec-local LSN), D51-L (closed edge categories + per-category policy), I16-L (reviewer writes target only the need substrate — a derived view must not break this), A8-L (one substrate absorbs all impasse kinds).
- **Convergence:** `walkthrough-evidence-batch` (FE-1167) fixture prep — the planned `contradictory` seed variant exercises `semantic_conflict` (the table-backed kind), and an `advisory-pending`/staleness variant would give the derived `edge_revalidation` view a repeatable test state. `src/projections/graph/reconciliation-needs.ts` is still an intentional stub — do not build that projection before this frontier decides derived-vs-persisted shape.
- **First tracer candidate:** a read-only derived `edge_revalidation` query (projection over `updated_at_lsn` + category metadata, no schema change, no watermark yet) surfaced alongside the persisted needs — proves signal quality and noise level before committing to the watermark schema and any retirement of persisted `edge_revalidation` rows.

### session-branching

- **Name:** Session branching support (branch-aware continuity/coherence)
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** structural / transcript + continuity seam
- **Status:** horizon; direction approved (D24-L reversal), design not yet started.
- **Certainty:** proving.
- **Objective:** Design and implement branch-aware transcript continuity, staleness, and coherence so Brunch supports session branching, lifting the current linear-only guards (I10-L, I13-L, I19-L) once branch-aware semantics exist.
- **Depends on:** turn-boundary continuity choreography (D76-L, D77-L, D78-L) and the coherence model.
- **Traceability:** D24-L; A37-L; req 8; I10-L, I13-L, I19-L.

## Dependencies

```text
frontiers:
  walkthrough-remediation-2 (FE-1187)
    -[hard]-> spec-posture
    -[hard]-> walkthrough-evidence-batch (FE-1167)
    depends_on: D113-L-D115-L disambiguation, D119-L, D120-L/I62-L, D99-L

  spec-posture
    owns: D118-L materialization + A41-L vocabulary/root-spec validation
    outer_oracle: run D populated-cwd/brownfield beats + run B orientation beats

  Parallel / Low-conflict:
    # petri-interpreter-port (FE-1183) and petrinaut-live-run-stream (FE-1190) merged
    # 2026-07-11/13; run.json remains lifecycle truth, Petri artifacts remain
    # projection/evidence/resume hints, journal appends are fail-closed.

    executor-slice-attempt-lifecycle (FE-1192)
      status: active; picked up 2026-07-13 on ka/fe-1192-executor-slice-attempt-lifecycle
      live_card: memory/cards/executor-slice-attempt-lifecycle--agent-attempt-facts.md
      -[hard]-> petri-slice-isolation-fan-in
      stabilizes: attempt identity for the whole Petri sequence

    petri-slice-isolation-fan-in
      status: admitted 2026-07-13; Linear/branch at pickup
      -[hard]-> petri-epic-integration (horizon)
      -[hard]-> petri-durable-parallel-authority (horizon; promote only on serial-authority evidence)
      excludes: durable parallel side-effect authority

  mechanism-trace
    -[optional instrument]-> walkthrough-evidence-batch (FE-1167)
    excludes: A40-L turn_end rewiring, D117-L direct hardening

  walkthrough-evidence-batch (FE-1167)
    closes_arc: deterministic-orientation
    live_card: memory/cards/walkthrough-batch-2--seed-variants.md (Card 3)

  legacy-question-read-path-retirement
    status: admitted; Linear/branch at pickup
    depends_on: D116-L ask cutover
    preserves: interim pending-exchange scan until A39-L/headless-ask-discovery

  executor-run-environment (FE-1166 follow-up)
    status: prepared, low-conflict; tracker/branch disposition required before build
    live_card: memory/cards/executor-run-environment--actionable-slice-request.md

rules:
  candidates never commit graph truth (I51-L)
  topology files own current subtree state
  scratch evidence is not durable until promoted to .fixtures/runs/
  arcs close only after topology reconciliation and residue discharge
```
