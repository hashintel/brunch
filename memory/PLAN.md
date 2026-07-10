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

**Alpha walkthrough lane (2026-07-09/10).** Post-PR-305 outer-loop walkthroughs (TESTING_PLAN.md concern groups; findings in TESTING_FINDINGS.md) ran A and C, then a same-day induct → grill → spec pass settled D118-L (spec posture persistence), D119-L (unified `/continue` + continue/wait lexicon), the D99-L digest-conduct clarification, and A41-L. The 2026-07-10 FE-1180 review/witness pass reopened `walkthrough-remediation-1`: required rows WR1–WR8 were built, but Execute labels diverged from their provider directives and several security/conduct/debug claims lacked discriminating evidence. D120-L/I60-L now settle the Execute workflows. Close the reopened audit rows, run the focused no-auth/Run-B/Execute evidence, then let `spec-posture` use run D as its outer oracle.

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

- `walkthrough-remediation-1` (FE-1180) — **reopened by 2026-07-10 review/witness**. WR1–WR8 and WR13–WR15 remain built; close WR16–WR18 from `memory/cards/walkthrough-remediation-1--closure-ledger.md` before restoring closed status. Existing issue/branch; WR16 is next. Definition below.
- **Alpha walkthrough lane** — the post-publish outer-loop audit over the merged surface (`TESTING_PLAN.md` concern groups; findings in `TESTING_FINDINGS.md`). Runs A and C are the source evidence. After FE-1180's deterministic audit rows land, rerun Concern 1A plus Run B and a focused Execute/gallery beat for FE-1180 closure; run D stays the outer oracle for `spec-posture`. Not a frontier itself.
- `tool-schema-convergence` (FE-1163) — next independent build: sweep over the 46-tool provider-facing schema surface. Base: **off `next`** now that FE-1164 merged (supersedes the stack-on-FE-1164 note). Ledger: `memory/cards/tool-schema-convergence--ledger.md` (includes the folded blank-carrier row). Candidate row from the 2026-07-09 `ln-induct` pass (finding 5), admit at pickup: derive test `getAllTools()` inventory stubs from the canonical active-tool constants instead of hand-listing (three fixture sites drifted in PR #304). Definition below.

### Recently Completed

- 2026-07-09 `alpha-release-readiness` (FE-1159) — **✓ closed: `1.0.0-alpha.0` published to npm under dist-tag `alpha`** (git tag on `next`; `latest` untouched at 0.8.0). Durable truth: D113-L/D114-L/D115-L, I59-L, `check:release-pack`. Definition archived to `docs/archive/PLAN_HISTORY.md`. A38-L conduct reproducibility continues validating via the alpha walkthrough lane.
- 2026-07-09 `main-editor-chrome` (FE-1169) — **merged #305**. All six threads delivered; `memory/REFACTOR.md` and all nine scope cards consumed. Outer manual beats transferred to the walkthrough lane (TESTING_PLAN.md Concern 7); its `/brunch:continue` semantics are superseded post-merge by D119-L (widening rides `walkthrough-remediation-1`). Named residue: `requestClosesPresent` reconciliation waits for Horizon `headless-ask-discovery`. Definition archived to `docs/archive/PLAN_HISTORY.md`.
- Older completions (2026-07-08 merge wave incl. FE-1164, the 2026-07-06 wave, and earlier): `docs/archive/PLAN_HISTORY.md`.

### Next

- `spec-posture` (Linear at pickup) — structural: persisted spec-row posture (D118-L, A41-L) + deterministic establishment flow. Start after FE-1180's deterministic audit rows so run D witnesses the corrected surface; its outer oracle is exactly run D's populated-cwd/brownfield beats. Definition below.
- `walkthrough-evidence-batch` ([FE-1167](https://linear.app/hash/issue/FE-1167/walkthrough-evidence-batch-outer-loop-checks-for-merged-orientation)) — the one batch owning all outer-loop residue from the merged lanes (FE-1134 generative-menu evidence, FE-1137 thin/rich Execute beats + deferred orientation-choice questions, FE-1124 Card 3 + seed worklist, FE-1107 KA-conversation residue, and — folded 2026-07-08 from the retired handoff — the FE-1164 walkthrough items). FE-1164/FE-1169 are merged, but the batch now waits for reopened `walkthrough-remediation-1` so its beats witness D120-L-consistent ask/consult surfaces (and note remediation row 5's conduct changes shift what "expected conduct" means for the generative beats). Closes arc `deterministic-orientation`. Definition below.
- `mechanism-trace` (Linear at pickup) — post-hoc mechanism-provenance trace over session transcripts (carrier classes `wiring` / `nudge` / `conduct`), a static wiring inventory, and the sweep-debt tripwire as a derived scenario-scoped assertion. Best run **before or alongside** `walkthrough-evidence-batch` (FE-1167) — the trace is exactly the instrument those walkthrough beats lack. Definition below. The D117-L constant-anchoring hardening in `sweep-watermark.ts` is a direct fix, not part of this frontier — land it on the next branch that touches the exchanges family or as a standalone commit.
- **Legacy question read-path retirement** (hygiene slice, no Linear issue until pickup; from the 2026-07-09 `ln-induct` pass over PR #304 — finding 4, delete-over-fence decision agreed): remove the `present_question`-era branches from the pending-exchange scan and recovery skip, drop the `src/.pi/README.md` "Legacy persisted transcript vocabulary" section, regenerate old-tuple fixtures (`session-transcript`, `rpc/handlers`, `exchanges-editor-envelope`, `public-rpc-parity-proof` coverage assertion, `project-graph-review-cycle-proof` probe), and check committed `.fixtures/` runs for old tuples first. The pending-exchange scan machinery itself **stays** — D116-L names it as the interim until Horizon `headless-ask-discovery` (A39-L). Run off `next` (FE-1169 merged). The write-path half of the same induction (retired-vocabulary minting fallback, TOPOLOGY drift, echo guard) is fixed on #305: standalone ask single-select answers use `ask` details, explicit legacy question single-select answers fail loudly, and broker topology uses ask vocabulary.
- **Chrome batch (work area, user-declared 2026-07-08):** opener `main-editor-chrome` (FE-1169) merged 2026-07-09 (#305). Further chrome frontiers open here as scoped; the review-set TUI visual design (remediation ledger row 11, deferred) is the first named candidate.

### Parallel / Low-Conflict

- **Open PRs:** none from the merged lanes (FE-1169 #305 landed 2026-07-09; the 2026-07-08 wave landed FE-1159 #299, FE-1115 #301, FE-1164 #304 + stack, KA FE-1114 #300, FE-1166 #302, FE-1141 #303).
- `component-dx` (FE-1115) — **✓ closed 2026-07-08 as a frontier**: the DX goal is delivered (preview harness, theme toggle + hot reload + testbed, `matchesKey` sweep, theme value rework, scrollback-safe indicator; outer manual checks confirmed 2026-07-07; PR #301). UX-level component work is *not* covered by this closure — it opens fresh frontiers in the upcoming chrome batch. Definition archived to `docs/archive/PLAN_HISTORY.md`.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

- `planning-process-model` — **demoted from Next #1 on 2026-07-03 (grill):** exploratory D103-L bet-proving, not ship-blocking. Behind the gate. Guard: the orientation menus' "project a plan" option routes to the existing `project`/`map-plans` seam at frontier-level depth (D103-L boundary) and must **not** pull this frontier forward. Groundwork stays parked on `ln/fe-xxx-plan-plane-redesign`; full definition below.
<!-- main-editor-chrome promoted from Horizon to Active 2026-07-08 (FE-1169); definition in Frontier Definitions. -->
- `review-commentary-widening` — GitHub-style per-item review commentary: widen the review answered payload (`comments: [{on: draft|edge|set, body}]`, a SPEC decision) plus the collection UI. Deferred post-gate at FE-1138 scope (2026-07-03): the payload ripples into the review schema that capture-contract rows and the digest terminal consume. Once `exchange-ask-refinement` lands, the widening re-expresses over the D116-L declared-ask/answer payload rather than `request_response` details. Sketch: `src/agents/contexts/exchanges/design-permutations.md` §Review-set evaluation.
- `develop-mode` — third operational mode `develop` / Develop running a new `engineer` agent: a Brunch-aware coding assistant *without* the `execute_*` tool set and with kick/consult mechanisms inert (user-driven turns, not agent-driven). Split out of `main-editor-chrome` at the 2026-07-08 grill. Entry is a SPEC revision, not a feature slice: D98-L ("two modes only" — though Develop is a distinct agent with different grants, not the conduct-bias `Enhance` that grill rejected), req 26, and D40-L placement of `engineer` in the concentric authority matrix (executor-minus-`execute_*`? elicitor-plus-coding?), plus a new per-mode kick/consult-suppression policy axis. Route through `ln-grill`/`ln-spec` at pickup. Groundwork (mode-cycling keybinding, border-by-mode) lands mode-agnostically in `main-editor-chrome`.
- `headless-ask-discovery` — the A39-L follow-up to D116-L: RPC discovery of open `ask` calls (streamed session events or a pending-interactive-call read method) replacing `session.pendingExchange` transcript scanning, so an agent-as-user driver can generatively build specs against a goal over the headless surface. Not first-release-critical; headless asks resolve `unavailable` until this lands. Broker (`awaitAnswer`/`session.submitExchangeResponse`) is unchanged by design.
- `reconciliation-derivation` — derive `edge_revalidation` reconciliation needs from LSN comparison instead of persisting them; full definition below (inventory findings from 2026-07-02, worth keeping). **Confirmed behind the gate 2026-07-03 (grill G7):** the ingest throughline's conflict routing rides the existing persisted `reconciliation_need` substrate (`create_reconciliation_need` is live); nothing in the gate needs the LSN-derived generator. Honor the convergence: the `contradictory` seed variant capture now rides `walkthrough-evidence-batch` (FE-1167).
- `reviewer-agent-mode` — D29-L's async advisory reviewer remains designed but unbuilt: narrow write authority to `reconciliation_need`, batch-acceptance trigger keyed by session/batch entry, A16-L trigger/scope questions still open. Behind the ship gate; no frontier until post-acceptance review becomes POC-blocking or reviewer residues need executable closure.
- `session-branching` — support session branching (D24-L reversal); needs branch-aware continuity/coherence design (A37-L).
- `compaction-and-conflict-widening` — long-horizon continuity through compaction.
- `agent-tracing` — passive trace instrumentation over Pi lifecycle events for debugging plus conduct/quality evaluation: NDJSON emitter extension (introspection-tap discipline), subagent span joining via SDK `session.subscribe`, and a mechanical-trace × semantic-JSONL join for deterministic conduct checks and judged passes. Entry move is an `ln-spike` (dev-gated `nikiforovall/pi-otel` import: do span trees beat `.brunch/debug/` + JSONL projections?) before any port of `JoshMock/the-agency` observability as the in-product base. Traces are dev/eval artifacts, never product truth (no event-spine backdoor). Design: `docs/design/AGENT_TRACING.md`; sibling idea note `docs/design/RLM_INVESTIGATION_PATTERN.md`. Relation: Next `mechanism-trace` is the transcript-native sibling (carrier classification, no event plane); if both land they may join on a shared trace vocabulary.
- `web-driver-streaming` — remaining consumer/UI and non-freeform answer legs after the built topology-A relay battery.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

### Retired / Never

- `coherence-first-class` — retired as an independent frontier; future coherence work should be driven only by a concrete triggering frontier that needs it.
- `flue-pattern-adoption` + `framework-direction-stubs` — removed from Horizon 2026-07-08: both are postures/directions, not work items, and both already live in `memory/SPEC.md` §Future Direction ("Adoption patterns from Flue"; "Framework alignment & deferred subsystems"). Re-enter only via a concrete triggering frontier.
- `fixture-vs-real-audit` — dropped 2026-07-08 (action-or-drop call): its operative content graduated into `ln-review`'s contract-lens catalog (the opaque-companion lens carries the untested-against-real angle); run `ln-induct` on fresh evidence rather than keeping a standing audit bucket.
- `roving-suite-flake` — dropped 2026-07-08 (action-or-drop call), re-opened and closed by same-day `ln-diagnose`: repeated full-suite runs reproduced the `git-host-promotion-port` timeout while isolation stayed green; phase timestamps showed no `git apply` hang, only cumulative spawned-git slowdown under default Vitest worker load, with the real-TUI harness showing the same scheduling sensitivity. Fix: `npm test` caps Vitest at 4 workers and the promotion real-git fixture removes clone/pull/config churn while preserving the real patch/apply witness. Oracle: default `npm test -- --reporter=dot` passed after the cap (228 files passed / 1 skipped, 1561 tests passed / 3 skipped, ~53s).
- `blank-carrier-sweep` — folded 2026-07-08 into the FE-1163 ledger as row 13 (`exchanges-blank-carriers`); no longer a standalone Horizon item.

## Frontier Definitions

<!-- component-dx (FE-1115) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08 hygiene pass);
     frontier closed as done for DX. Durable truth: src/dev/TOPOLOGY.md §Component Preview Harness,
     src/.pi/components/TOPOLOGY.md. UX component work opens fresh frontiers in the chrome batch. -->

### exchange-ask-refinement

- **Name:** One-shot ask terminal + structured-exchange presentation refinement
- **Linear:** [FE-1164](https://linear.app/hash/issue/FE-1164/one-shot-ask-terminal-and-exchange-presentation-refinement)
- **Branch:** `ln/fe-1164-ask-terminal`, stacked on `ln/fe-1115-tui-refinements-1` (PR #301; carries this frontier's planning commits — revised 2026-07-07 from the earlier branch-per-category call)
- **Kind:** structural (tool-family cutover per D116-L) + bounded presentation refinement
- **Certainty:** proving
- **Objective:** Simple questions become one `ask` tool call — rich markdown question body + options rendered inside the shared rounded-box UI while open, one durable toolResult carrying question + answer together — and the surviving offer presents (`present_candidates` / `present_digest` / `present_review_set`) declare their expected ask continuation in details (reference-invoked via `continues: <exchange_id>`, runtime-filled, never model-re-authored). `present_question`, the question discriminants of `request_response`, and the pending-exchange scan machinery for questions retire. The shared answering surface gains the markdown body (exchange markdown theme inside `projectRoundedBox`, scroll-viewport options) and keeps the border-label channel available for session-chrome annotations (operational mode / spec title, per `BrunchEditorComponent`'s pattern).
- **Annotations:** Lights up: the one-shot ask path (params → custom UI → single durable result) — the shape model priors already expect. Stabilizes: the exchange terminal seam (declared continuation replaces hand-taught per-kind dispatch) and the shared rounded-box answering surface.
- **Acceptance sketch (slices via `ln-scope`):** (1) rich-body picker: decision/multi-choice pickers render a markdown body inside the box, previewable in `dev:components`; (2) standalone ask cutover: `ask` registered, `present_question` + question discriminants retired, TUI collection + broker fallback + `unavailable` headless behavior, one durable result rendering question+answer; (3) offer declared continuations: details carry the declaration, `ask` accepts `continues:`, review/candidate vocabulary flows as declared payload, capture semantics (I57-L probes, `respondsToPresentTool` reads) stay green. Conduct/prompt guidance, `exchange-family-completeness` and sweep-window tests, and content-golden families updated per slice.
- **Absorbed follow-ups:** the FE-1136 "derived per-kind terminal mapping" follow-up is retired by design (declaration replaces the mapping); the 5× duplicated `normalizeOptionalText` hoist in `src/exchanges/projections/` rides this lane. `blank-carrier-sweep` (Horizon) stays separate but the new ask params should be born with `zNonBlankMarkdown` boundaries, not swept later.
- **Deferred:** headless RPC discovery of open asks → Horizon `headless-ask-discovery` (A39-L).
- **Current execution pointer:** none — witness-gap closure consumed 2026-07-08 (`src/.pi/extensions/__tests__/ask-runtime-mount.test.ts`, `src/probes/__tests__/present-candidates-supersession-proof.test.ts`) before tie-off.
- **Traceability:** D116-L (design), A39-L (deferred seam), D37-L (details carry semantics; renderCall non-semantic), D105-L (boundary validation), D106-L (self-contained echoes), D110-L/I57-L (digest/review capture semantics survived the rewiring), D104-L (render-honesty contract extends to ask results).

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

### walkthrough-remediation-1

- **Name:** Walkthrough remediation sweep 1 — run-A/run-C findings closure
- **Linear:** [FE-1180](https://linear.app/hash/issue/FE-1180/walkthrough-remediation-sweep-1-run-ac-findings-closure)
- **Branch:** `ln/fe-1180-walkthrough-remediation` (off `next`; renamed from `ln/fe-TEMP-alpha-walkthroughs` — carries the run A/C evidence commits and the 2026-07-09 collation)
- **Status:** ◐ reopened 2026-07-10 by post-build review/witness. Required rows WR1–WR8 remain built; the consumed ledger was correctly deleted at first exhaustion, but the audit found more than one new required row. The replacement WR13–WR18 sweep ledger is now active.
- **Kind:** coverage-shaped remediation sweep (frontier shape per `ln-plan/references/coverage.md`, generalized: the closed inventory is a **findings contract**, not a code layer — the 2026-07-09 walkthrough findings ledger). Rows map to owning seams, findings n:1 to rows.
- **Certainty:** earned for WR13–WR17 after D120-L disambiguation; WR18 is evidence-gated outer closure.
- **Closes:** the mechanism-vs-meaning gap exposed by the FE-1180 witness audit: visible Execute promises diverging from provider conduct, successful-looking recovery without a fired kick, non-TTY security evidence, source-only conduct sentinels, and callback-only debug evidence.
- **Locks in:** I60-L label/id/directive/workflow identity plus discriminating security, conduct-composition, debug-mirror, and focused outer UX evidence.
- **Why now / unlocks:** user-declared 2026-07-09 — walkthrough runs B/D address concerns (seed legibility, orientation sequencing, populated-cwd entry) better served after remediation; remediation first, then B/D as closure evidence. Findings: `TESTING_FINDINGS.md` (A1–A10, C1–C5); induction record in the 2026-07-09 session (promoted lenses below).
- **Boundary:** run-A/run-C findings and the induction lenses only. **Out:** spec-posture persistence (own frontier below), FE-1167's residue groups (unchanged), model-policy/dynamic-model changes (evidence-gathering only, per TESTING_PLAN Concern 4), review-set visual design (needs a design session — deferred row).
- **Candidate row inventory (ledger authored at `ln-scope`, `Mode: sweep`, findings mapped n:1 to seam rows):**
  1. ● mode-aware orientation menus — derive menu from `projectBrunchAgentState(...).operationalMode` at the juncture seam; fixes the observed Execute-consult bug (C2) **and** the unsampled J2/J3/J4 registrar sites (induction 1a/1b). Owner: `session-orientation/juncture.ts` + `registrar.ts` + `commands/index.ts`. Oracle: per-mode juncture tests.
  2. ● consult-menu chrome + content — role/spec border labels (thread `topLabel`/`bottomLabel` like the pickers), consistent option rendering, drop agent-discretionary options from Execute menu, tighter style/action sets (elicitor: by-decision / by-example / by-proposal / prep-for-execution; executor: design-oracle-commit / plan compilation / plan execution), wait-flavored rename + reposition of `noKickChoice` (D119-L), overflow legibility (C1/C2, A9). Owner: `consult-menu.ts` + menu descriptors. Oracle: component tests + `dev:components` gallery.
  3. ● `/continue` unification — D119-L semantics (re-present open declared ask, else originate+kick via `manual_trigger`; overrides dismissals), command-string centralization, cancellation recovery notice (A4). Owner: `commands/` + `exchanges/ask/continuation.ts`. Oracle: command tests incl. the no-auth-then-login kick case.
  4. ● ask framing echo — carry `commentPrompt` (and Other-elaboration framing) into `AskQuestionEcho`/`projectAsk`/`formatAsk` so recorded comments keep their framing (A6, induction 2 — D106-L self-containment). Owner: `exchanges/schemas` + `projections/ask.ts` + `agents/contexts/exchanges/ask.ts`. Oracle: ask-tuples writer goldens.
  5. ● ask/present conduct contracts — negative guidance: never author an Other-equivalent option; never restate present pretext in a continuation body (large digests sit outside the ask); digest structure guidance + digest-approval→direct-advisory-mutation default + multi-pass extraction (D99-L conduct clarification; A6, A7, A8). Owner: `ask` promptGuidelines + ingest/elicit conduct homes. Oracle: dual-audience probe + run-B/D re-observation.
  6. ● JSON leak on exchange-tool failure paths — `ln-diagnose` first (locate the raw-payload render path: ask invocation A6, `present_candidates` retry C3), then themed failure rendering. Owner: tbd by diagnosis. **Evidence-gated.**
  7. ● seed insertion legibility — `ln-diagnose` the no-auth→post-login seed path (agent read information it should have been seeded with, A5); fix shape follows diagnosis. **Evidence-gated.** Run B's "seed inserted before first useful action" beat is the closure oracle.
  8. ● no-auth onboarding surface — gate dead-end startup options, shorten warning copy without leaking model policy, fix footer `unknown`, mask pasted API keys in `brunch login`, steer toward in-session `/login` (A1, A2). Owner: workspace-dialog + login CLI. Oracle: no-auth boot test + manual re-run of TESTING_PLAN 1A.
  9. ○ compact `renderShell`/tool-result rendering for Brunch tools (A5) — deferred unless cheap alongside row 6.
  10. ○ `/introspect` legibility (A10) — deferred, low.
  11. ○ review-set TUI visual design (A6/run-A observation) — deferred to a design session; not row-sized.
  12. ○ markdown polish: `\n\n` inline rendering, node-id styling convention (A9) — deferred unless cheap alongside row 2.
- **Audit reopening inventory (replacement ledger authored at `ln-scope`):**
  13. built Execute orientation semantic identity — materialized D120-L/I60-L across visible menu descriptions, canonical semantic ids, provider seed directives, and the three resulting preparation/readiness/execution workflows. Retired the broadened-label-over-legacy-directive shape. Oracle: table-driven menu choice → persisted entry → composed seed contract plus workflow-level tests.
  14. built Honest general-continue completion — classified kick outcomes now return through `completeAssistantKick` into juncture/manual-trigger results; `kickFired` means `status: fired`, no-model/idle skips do not append seed/kick carriers on retry, failed sends notify honestly, and fired manual resume is preserved. Oracle: parameterized command/helper tests over fired/skipped/idle/failed outcomes.
  15. built Interactive API-key secrecy — `src/probes/scripts/verify-brunch-login-secret.sh` drives `brunch login` through a real Python-stdlib PTY, proves terminal bytes omit the pasted sentinel while isolated Pi auth storage receives the exact key, and proves cancellation exits nonzero without API-key auth.
  16. ● Live WR5 guidance composition — replace source-file substring sentinels with consumer-level evidence that registered tool guidance and live skill/manifest composition carry the Other/digest/multi-pass rules. Model adherence stays WR18 outer evidence.
  17. ● Production debug-mirror legibility — drive the wired manual-trigger continuation against a temporary workspace and prove `entry-contents.md`/`origination.md` expose seed contents, trigger, and seed-before-kick order.
  18. ● Focused outer closure evidence — after WR13–WR17, rerun TESTING_PLAN Concern 1A, Run B, and a focused Execute/component-gallery beat in both themes. Record whether conduct follows WR5, the agent uses seeded facts, recovery hints are noticed, Execute choices produce their promised workflows, and consult border/overflow treatment is legible. New product defects route through planning; this row does not silently absorb them.
- **Aggregate DoD:** WR1–WR8 remain built; no required WR13–WR18 row remains open; D120-L/I60-L are materialized in topology/code; `TESTING_FINDINGS.md` distinguishes automated mechanism evidence from the new outer observations; the focused outer beats pass or any failures are promoted explicitly.
- **Inventory authority:** the original consumed ledger is historical in git; a replacement `memory/cards/walkthrough-remediation-1--closure-ledger.md` is authored by `ln-scope` and owns WR13–WR18 only. PLAN owns frontier identity/sequencing; findings remain evidence, not a second plan.
- **Classification:** evidence-gated — WR13–WR17 are buildable now; WR18 runs only after they land.
- **Current execution pointer:** `memory/cards/walkthrough-remediation-1--closure-ledger.md` — WR16 next.
- **Promotion / disposal rule:** any row escaping row size promotes to its own frontier and stays open in the replacement ledger until landed; more than one further discovered capability or a new seam routes back through `ln-plan`. Delete the replacement ledger only after WR18 closes.
- **Traceability:** D119-L (WR3/WR14), D99-L (WR5/WR16), D106-L (WR4), D109-L/D120-L/I60-L (WR1/WR2/WR13/WR18), D115-L/I59-L (WR8/WR15/WR18), D104-L (WR6), D69-L/D97-L (WR17); TESTING_PLAN.md concerns 1/3/4/5/6/7.

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

### tool-schema-convergence

- **Name:** Tool-schema convergence sweep — one adapter, two schema sources, build-time provider legality
- **Linear:** [FE-1163](https://linear.app/hash/issue/FE-1163/tool-schema-convergence-one-adapter-two-schema-sources-build-time)
- **Branch:** `ln/fe-1163-tool-schema-convergence`, off `next` now that FE-1164 merged (supersedes the earlier stack-on-FE-1164 note; the ask cutover still shapes the exchanges family this sweep normalizes)
- **Kind:** coverage frontier / sweep (frontier shape, not posture). **Certainty: earned** — every row is closure over an already-understood seam; nothing material is unknown.
- **Status:** admitted 2026-07-07; ledger authored, not yet scoped/built.
- **Why now / unlocks:** the FE-1159 outer walkthrough proved the failure class is real and total — one top-level `oneOf` in `read_graph` 400ed *every* provider turn on every Anthropic-family backend, and the faux-provider suite structurally cannot see it. Today the tool surface has a three-way authoring split (Zod-via-adapter ×2 duplicate adapters, TypeBox builders, hand `as const` JSON literals), so nothing enforces provider legality at authoring time. Converging now, right after the alpha cut, hardens the entire tool surface before alpha users hit it.
- **Boundary:** all 46 Brunch-authored tool schemas reaching providers as `input_schema` (9 families under `src/.pi/extensions/**`; re-based 2026-07-08 after the FE-1164 ask cutover). **Out:** Pi-owned schemas (incl. the 4 read-only re-registrations in `agent-runtime`), RPC/web/graph-command schemas (canonical *sources* for rows, not rows).
- **Aggregate DoD:** no required ledger row remains `spec`/`partial`: both legacy adapters (`exchanges/pi-schema.ts`, `shared/pi-tool-schema.ts`) deleted; every in-boundary `parameters:` site routes through the single shared adapter; the registry-wide legality oracle (elicitor + executor toolsets) is green.
- **Inventory authority:** `memory/cards/tool-schema-convergence--ledger.md` (13 rows: adapter seam, 9 families, registry oracle, 1 tripwired deferred row, plus the folded `exchanges-blank-carriers` row — absorbed from the retired Horizon `blank-carrier-sweep` 2026-07-08). PLAN owns the frontier id and sequencing; the ledger owns rows only.
- **Classification:** buildable-now. All rows derive from current source; pi-ai's pre-execute `validateToolArguments` (TypeBox `Value.Check`) already gives uniform runtime validation, so no row adds a validation layer — this is authoring/derivation closure only.
- **Closes:** the three-way schema-authoring split; the "illegal schema discovered on a live turn" failure class.
- **Canonicalizes:** one adapter seam (`src/.pi/extensions/shared/tool-schema.ts`) and the two-source rule (Zod where the tool boundary owns the shape; TypeBox where graph/DB truth owns it — no re-declaring graph shapes in Zod).
- **Deletes / retires:** `exchanges/pi-schema.ts`, `shared/pi-tool-schema.ts`, and hand-authored `as const` schema literals as an authoring style.
- **Locks in:** "every provider-facing tool schema is provider-legal at build time" — SPEC invariant candidate at first landing, with the two-source rule as a SPEC decision candidate (record via `ln-sync`).
- **Promotion / disposal rule:** rows escape to their own frontier only if they stop being row-sized; >1 newly discovered row means the inventory wasn't closed — back through `ln-plan`. Ledger deleted at exhaustion.
- **Traceability:** motivating evidence rides FE-1159's walkthrough record (this file, alpha-release-readiness §Outer walkthrough evidence) and commit `FE-1159: Drop read_graph top-level oneOf…`; D39-L (sealed profile) constrains where the adapter lives; SPEC decision/invariant ids assigned when the first row lands.

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
- **Branch:** `ka/fe-1166-greenfield-executor-harness` (stacks on `ka/fe-1114-executor-replanning` / PR #300)
- **Kind:** structural / executor run environment policy
- **Status:** active follow-up. Substrate/verify policy is built and merged on PR #302; the consumed substrate/verify scope card was deleted in the 2026-07-08 sync. Follow-up live failure scope is open in `memory/cards/executor-run-environment--actionable-slice-request.md` (buildable next after FE-1166 tie-off).
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
  Active:
    walkthrough-remediation-1 (FE-1180)
      status: reopened 2026-07-10; branch ln/fe-1180-walkthrough-remediation
      shape: evidence-gated coverage-shaped remediation sweep; WR1-WR8 and WR13-WR15 built; WR16-WR18 ledger active at memory/cards/walkthrough-remediation-1--closure-ledger.md
      closes: Execute label/id/directive/workflow divergence, dishonest continue outcome, PTY secrecy gap,
              source-only conduct oracle, callback-only debug evidence, focused outer UX/conduct evidence
      -[hard]-> spec-posture (start after FE-1180 deterministic rows; run D belongs to spec-posture)
      leaves_open: FE-1167 outer-loop residue, deferred non-DoD polish rows WR9-WR12
      depends_on: D120-L, I60-L, D119-L, D99-L, D106-L, D109-L, D115-L
    alpha-walkthrough-lane (not a frontier)
      status: runs A + C done; Concern 1A / Run B / focused Execute-gallery evidence wait on FE-1180 WR13-WR17; run D waits on spec-posture
      feeds: walkthrough-remediation-1 (WR18), spec-posture (run D outer oracle), walkthrough-evidence-batch (FE-1167 overlap rows when naturally witnessed)
    tool-schema-convergence (FE-1163)
      status: independent build; ledger authored + re-based 2026-07-08 (13 rows / 46 tools, incl. folded blank-carriers row)
      branch: ln/fe-1163-tool-schema-convergence -[hard]-> off next (FE-1164 merged; supersedes stack-on decision)
      shape: coverage frontier; ledger memory/cards/tool-schema-convergence--ledger.md

  Next:
    spec-posture
      status: admitted 2026-07-09; promoted row from walkthrough-remediation-1
      owns: D118-L materialization (origin field, confirmed spec.kind, relates-to reference), deterministic
            establishment at spec creation/resume, A41-L vocabulary + root-spec call
      outer oracle: run D populated-cwd/brownfield beats + run B orientation beats (Concern 2 matrix)
      depends_on: D118-L, A41-L, D89-L, D109-L
    walkthrough-evidence-batch (FE-1167)
      arc: deterministic-orientation (closing member)
      status: admitted 2026-07-08 (hygiene fold); UNBLOCKED — FE-1164 + FE-1169 merged; prefer running after
              walkthrough-remediation-1 so beats witness the remediated ask/consult surfaces
      branch: tbd (off next)
      owns: generative-menu evidence, thin/rich Execute beats + deferred orientation-choice questions,
            FE-1124 Card 3 + seed worklist, FE-1107/KA residue (close-or-narrow, demo session,
            post-KA plan pass; executor-card GC done 2026-07-08 sync), FE-1164 walkthrough residue (group 5: declared continuations, capture
            sweep after answers, resume re-render, sidecar during open ask, gallery re-check)
    mechanism-trace
      status: admitted 2026-07-08 (capture-sweep grill); branch/Linear at pickup (off next)
      owns: carrier-classified transcript trace (wiring/nudge/conduct), static wiring inventory,
            sweep-debt tripwire (scenario-scoped outer-loop assertion over the trace)
      -[optional]-> walkthrough-evidence-batch (the trace instruments FE-1167's beats; prefer trace first)
      relates: agent-tracing (Horizon; event-plane spans vs this transcript-native classification — may join later)
      excludes: A40-L turn_end rewiring (future), D117-L constant-anchoring (direct fix, non-frontier)
      depends_on: D80-L, D81-L, D117-L, I57-L; A40-L (named, not retired)

  Horizon (behind the gate):
    planning-process-model
      status: demoted 2026-07-03; orientation plan option must not pull it forward
    reconciliation-derivation
      status: confirmed behind gate 2026-07-03 (grill G7); ingest conflict routing rides the persisted substrate
    headless-ask-discovery (A39-L)
    review-commentary-widening
    develop-mode (split from main-editor-chrome 2026-07-08; entry via ln-grill/ln-spec — D98-L/req-26/D40-L revision)
    reviewer-agent-mode
    session-branching
    compaction-and-conflict-widening
    agent-tracing
    web-driver-streaming
    geolog-and-petri-execution

  Retired:
    coherence-first-class
    enhance-third-mode (rejected 2026-07-03, grill: conduct bias is not runtime state; D98-L reasoning holds)
    flue-pattern-adoption / framework-direction-stubs (2026-07-08: postures, not work items; live in SPEC §Future Direction)
    fixture-vs-real-audit (2026-07-08: graduated into ln-review contract lenses)
    roving-suite-flake (2026-07-08: re-open condition met same day — 2x verify timeout in git-host-promotion-port; ln-diagnose owed)
    blank-carrier-sweep (2026-07-08: folded into FE-1163 ledger row 13)

done anchors:
  generalized-capture -> elicitor-generate, elicitor-project
  elicitor-generate -> elicitor-project
  elicitor-capability-spine (arc) -> deterministic-orientation menus route to its live skills
  exchange-rendering -> present-digest (family-completeness extension), exchange-answering-chrome
  exchange-answering-chrome -> main-editor-chrome (Editor-in-chrome proof + shared editor-lines helpers)
  main-editor-chrome -> walkthrough-remediation-1 (the merged chrome/ask surfaces are the remediation target)
  alpha-release-readiness -> alpha-walkthrough-lane (published alpha is the surface under audit)
  exchange-capture-contract -> present-digest (I57-L accepted-terminal read rules + conduct homes)
  elicitation-gap-guidance -> exchange-capture-contract (scratchpad outlet), execute-entry-readiness (postures)
  subagent-reconciliation -> acquisition arm + future subagent diversity

rules:
  candidates never commit graph truth (I51-L)
  topology files own current subtree state
  scratch evidence is not durable until promoted to .fixtures/runs/
  an arc (§Initiatives) closes only when its done-definition holds, incl. topology-README reconciliation + residue discharge
  ship-gate frontiers chart their decision flows (paths + endpoints) at ln-scope time
```
