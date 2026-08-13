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

- **Ship gate:** FE-1187 `walkthrough-remediation-2` is still the sole remaining ship-gate frontier. `remediation-4` landed the mixed-settlement review contract, populated-only Impact Ledger rendering, terminal-adaptive shell, persistent Specify elicitation style, deterministic menus, Ask mechanics, Continue-language cleanup, KA handoff, and the R6 terminal-status rail; extractor/oracle hardening and the fresh R8–R10 0/3 campaign remain paused at user direction. Execute evidence O7–O9 is still KA-owned.
- **Session-runtime convergence:** FE-1200 proved the standalone web foundation. FE-1321 then falsified the stronger independent-host attachment premise against Pi 0.83.0: public `InteractiveMode.stop()` preserves the runtime but leaves `run()` and its input callback pending. The selected replacement converges contracts rather than forcing one process shape: normal TUI mode owns its real Pi runtime and exposes a Brunch-semantic React companion; standalone web owns its `LiveSessionHost`; both use the same runtime factory, semantic projections/RPC vocabulary, JSONL truth, and a per-target cross-process writer guard. Independent TUI-detach survival and remote terminal presentation are deferred until real demand.
- **Comparison lanes:** the repo keeps two distinct evaluation doors: seed-based intra-product testing and mission-driven cross-product comparison. FE-1241 closed the brownfield comparison cases; FE-1215 landed the approachable operator workflow; FE-1320 structurally separated controller-private mission material from fresh external harness targets. D142-L then exposed a control-topology gap: the prompts still use interactive shells even when rendering is not the claim, stdio Brunch RPC has no live session driver, and hosted web RPC cannot select an Execute process move. `cli-mode-entry` now owns terminal-independent mode activation; `comparison-machine-interface-cutover` then replaces eligible Brunch/Claude shell control before the real saved-mission witness.
- **Executor / Execute evidence queue:** several KA fronts are implementation-merged but still carry explicit outer evidence: `host-landing`, `executor-plan-synthesis`, `execution-comparison-tracer`, `executor-plan-coherence`, `executor-slice-verification-repair`, and `greenfield-secure-drop-demo`.
- **Current seams and discipline:** Brunch ships on `1.0.0-alpha.x`. D125-L's live ask registry is the structured-exchange headless surface; the transcript-backed pending projection remains compatibility-only. Sweep classification remains fail-closed on exchange-schema terminal names (D117-L); the larger capture-conditional watermark question remains A40-L. Co-located `src/**/TOPOLOGY.md` files own current topology; scratch evidence is not durable until promoted to `.fixtures/runs/`.
- **Post-hardening validation:** FE-1348 freezes the current alpha boundary into a closed usage/verification-path inventory. A51-L's colleague walkthrough and cross-surface graph/session settlement are built; the successful post-SW3 journey carried exactly one approval through receipt LSN 2 and exactly one reload, with React, JSONL, public presentation/graph reads, and stopped-host SQLite converging on one settled requirement and zero edges. CS1/SW2/SW3 are fixed and outer-witnessed; prior failed-run provenance remains retained. Execute evidence is the sole open required product row, so FE-1348 remains active. The sweep records incidental simplification findings without widening into fixes. Existing provider campaigns, KA evidence, comparison witnesses, legacy-data migration, cross-platform rendering, and actual publication retain their current owners and gates.

## Initiatives

### Closed arcs

- **elicitor-capability-spine** — ✓ done. Durable truth: D95-L, D96-L, D100-L; I51-L.
- **exchange-presentation** — ✓ done 2026-07-06. Durable truth: D104-L/D108-L, `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`, exchange topology homes. Full closure record: `docs/archive/PLAN_HISTORY.md`.
- **capture-ingest-throughline** — ✓ done 2026-07-06. Durable truth: I57-L, D110-L, ingest/map conduct homes. Full closure record: `docs/archive/PLAN_HISTORY.md`.

### shared-session-host-convergence — ◐ active, reshaped

- **Goals:** preserve first-class TUI and web presentations while converging runtime construction, semantic browser contracts, durable truth, and single-writer authority; do not require one physical process shape where Pi's real TUI lifecycle makes that costly; retire the raw relay and sidecar-only driver vocabulary.
- **Members:** `shared-session-host-tracer` ✓ → FE-1348 `post-hardening-alpha-validation` A51-L, standalone-web, and cross-surface settlement rows ✓ (the frontier's other rows are product-wide) → `shared-session-host-cutover` (CS1/SW2/SW3 are fixed and outer-witnessed through one approval, receipt, and reload; the cutover itself remains unbuilt).
- **Done-definition:** normal TUI and standalone web each own exactly one legitimate runtime composition; both use the same sealed runtime factory, target-addressed Brunch RPC/semantic projection contract, JSONL truth, and per-target cross-process writer exclusion; companion React remains useful beside the real TUI without raw Pi events; `SessionEventRelay`, `brunch.sessionEvent`, `/rpc/driver`, and duplicate browser semantics are deleted; `memory/SPEC.md`, `README.md`, `CONTRIBUTING.md`, `docs/design/WEB_UI_ARCHITECTURE.md`, and the app/session/rpc/web topology homes describe the two compositions and their shared contracts without claiming an independent shared daemon.
- **Anchors:** A51-L; D39-L, D84-L (to retire), D132-L, D133-L, D141-L; I64-L, I65-L.
- **Confirmation (2026-08-03):** an independent architecture review re-derived this arc unprompted as the top structural priority (split roots: `brunch-tui.ts` raw `SessionEventRelay` vs `LiveSessionHost`). Its separate observation about `workspace-session-coordinator.ts` breadth is not an obligation of this arc; re-enter decomposition only when concrete coordinator change pressure justifies it.

### deterministic-orientation — ◐ active

- **Goal:** users deliberately choose how to work without repeated menu interruption, model volition, or mode ping-pong. Revised D98-L/D109-L separate a persistent active-branch Specify elicitation style (`interrogate | disambiguate | propose`) from one-shot process moves.
- **Members:** `session-entry-orientation` ✓ · `execute-entry-readiness` ✓ · `walkthrough-remediation-2` (FE-1187) is the closing member.
- **Done-definition:** style is reconstructed last-entry-wins from the active branch, injected into elicitor prompting, retained across resume/session switch/tree navigation, and distinct from one-shot process moves; only style-less new sessions and operational-mode switches auto-open; `/brunch:consult` explicitly reopens; no-UI modes leave no style trace; persistent-style entries and process-move entries are excluded from capture sweep; concentricity remains executable; one witnessed e2e run per generative flow still closes through FE-1187 plus the KA-carved Execute beats; topology homes for `src/.pi/extensions/` and `src/agents/runtime/` are reconciled.
- **Anchors:** D98-L, D37-L, D40-L, D74-L, D101-L, D102-L.

## Sequencing

### Active

- `post-hardening-alpha-validation` ([FE-1348](https://linear.app/hash/issue/FE-1348/validate-current-brunch-usage-and-testing-paths)) — **active, evidence-gated coverage frontier:** validate the frozen current alpha entry/usage/verification inventory through real source, product, dev, comparison-gate, and installed-package paths; disposition incidental audit findings without implementing them in the sweep. A51-L and cross-surface graph/session settlement are built. The successful post-SW3 witness outer-proved CS1/SW2/SW3 through exactly one approval, receipt LSN 2, one reload, byte-equal public A/B projections, one settled requirement, zero edges, and stopped-host SQLite agreement. Execute mode interaction is the sole open required product row; FE-1348 is not frontier-complete. Definition and active sweep ledger below.
- `walkthrough-remediation-2` ([FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure)) — **paused after `remediation-4` tie-off:** mixed-settlement review preservation and populated-group-only Impact Ledger rendering are built. Re-entry requires an explicit decision to resume extractor/oracle hardening, then restart R8–R10 from 0/3; A48-L, the separate web graph audit, and the consolidated outer checkpoint remain behind that gate. Execute O7–O9 stay KA-owned. Closing member of arc `deterministic-orientation`. Definition below.
- **Alpha walkthrough lane** — historical runs A, C, and WR18 remain source evidence in `TESTING_FINDINGS.md`; FE-1348 now owns the frozen current-surface pass. `TESTING_PLAN.md` is reconciled as outer-loop guidance rather than retained as a parallel live plan.

### Recently Completed

- 2026-08-11 `shared-session-host-tracer` ([FE-1321](https://linear.app/hash/issue/FE-1321/prove-shared-session-host-attachment-for-tui-and-react)) — **✓ complete:** production TUI and companion React converge through target-addressed semantic contracts and one canonical JSONL; structured asks preserve TUI-only answer authority; rival runtimes fail closed; normal shutdown permits standalone takeover; the A51-L colleague walkthrough found the companion useful and retired SA1/SA2 without contract changes.
- 2026-08-05 `comparison-mission-isolation-hardening` (FE-1320) — **✓ complete:** `/compare-specs` now places every harness in a fresh system-temporary external target root outside controller checkout, scratch, and retained trees; actual-entry-point tests cover the CS2 `../../private-mission.md` rival, target-root visibility, controller-owned transcript retention, unchanged target output, and target cleanup without claiming whole-host isolation.
- 2026-08-05 `canonical-document-reconciliation` (FE-1318) — **✓ complete:** the unadopted PLAN-replacement proposal is historical, seven superseded design surfaces now point to current authority, comparison prose distinguishes four execution cases from three configured E2E contracts and one retained witness, and active document links resolve.
- 2026-08-05 `host-landing-oracle-identity` (FE-1317) — **✓ complete:** the immutable host-landing oracle pack now includes all five behavior-bearing PTY inputs, with regression coverage for one-file-at-a-time hash sensitivity and identical-input stability.
- 2026-08-06 `system-reorientation-audit` (FE-1316) — **✓ complete:** thirteen post-cleanup concerns received evidence-backed dispositions; one stale exchange-guidance defect was fixed, two bounded frontiers were admitted, and existing owners absorbed the remaining promoted work without creating a parallel queue.
- 2026-08-05 `integrity-cleanup` (FE-1311) — **✓ complete:** the verified deletion/consolidation sweep and final five-row closure aligned the published package, probe topology, comparison public root, path-existence ownership, DB test naming, and portable repo-root Pi extension discovery without reopening falsified deletion targets.
- 2026-07-22 `brownfield-comparison-cases` (FE-1241) — **✓ complete, learning-first:** frozen Brunch and Petrinaut packets, pinned-source preparation, deterministic oracles, publication-compatible attempt evidence, and portable CI are built.

Older completion history and archived completed frontier definitions live in [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md).

### Next

- `cli-mode-entry` — next proving frontier after FE-1348: make `brunch specify [spec-id]` / `brunch execute <spec-id>` select operational mode before either TUI or hosted-web composition starts, so machine control does not need to synthesize a TUI-only process-move entry. D98-L/D109-L are materialized; the former FE-1187 implementation block is retired. Definition below.
- `comparison-machine-interface-cutover` — replace eligible Brunch/Claude `interactive_shell` conduct with hosted Brunch JSON-RPC and Claude stream-JSON, reusing existing adapters; depends on `cli-mode-entry` for Brunch Execute. Definition below.
- `saved-mission-comparison-witness` — operator-owned real Brunch + Claude `/compare-specs` witness after the machine-interface cutover, then mission revision/rerun proving historical snapshots remain immutable. Definition below.
- `shared-session-host-cutover` — tracer, A51-L, standalone-web, and cross-surface settlement evidence are complete; FE-1348's CS1/SW2/SW3 contracts are fixed and outer-witnessed. Cutover still closes the remaining enumerated shared-contract surface without forcing physical host unification; this evidence does not claim the cutover is implemented. Definition below.

### Parallel / Low-conflict

- `capture-ledger-tracer` — pickup-ready proving follow-on to the completed `agent-control-plane-closure`: compare current ingest conduct with a versioned four-section capture ledger over one fixed mixed-source mission, using separate masked outcome and unblinded conduct judgments. Definition below.

### Horizon

- **Mode / reviewer follow-ons:** `develop-mode` (flag-gated third operational mode with execute-tier authority), `reviewer-agent-mode` (reviewer remains a subagent, not a primary mode), and `review-commentary-widening` (TUI-realistic `#`-mention review comments over D116-L payloads).
- **Cleanups:** `named-inline-extension-identity`, `web-driver-streaming-residue`, and `test-tmpdir-hygiene` remain independent small follow-ons.
- **Integrity follow-ons (trigger-gated, not admitted):** exact FE-1311 audit evidence remains in git history. Re-enter `src/utils/strings.ts` / `.npmcheckrc` only through a future repository-hygiene frontier; the `source-policy.ts` readability-vs-existence divergence only when populated-plan acceptance changes or fails; TOON only through the D83-L product call; and a production-dependency-closure oracle on the next `dependencies` edit. Do not fold these into the active closure ledger.
- **Release automation later:** FE-1050 closed the reviewed Changesets alpha path on `next` → npm `alpha`; the still-intended `main`/`latest` stable-release automation remains a separate deferred promotion follow-on rather than part of the current alpha automation. Pointer: [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md#recently-completed-entries-archived-from-live-plan).
- `host-landing` ([FE-1201](https://linear.app/hash/issue/FE-1201/mode-aware-host-landing-of-promoted-runs)) — **KA stream · owner: Kostandin.** Owes the real TUI+RPC `/brunch:land` walkthrough from `promotion_prepared` into a fresh target (A42-L live half / FE-1197 oracle 9 landing leg). Re-enter at the next live FE-1197 walkthrough. Pointers: SPEC A42-L, D111-L/I58-L; `src/app/TOPOLOGY.md`.
- `executor-plan-synthesis` ([FE-1197](https://linear.app/hash/issue/FE-1197/synthesize-and-validate-executor-plans-from-approved-scopes)) — **KA stream · owner: Kostandin.** Owes live-capability oracles 1–5 on real elicited specs plus oracle 9's committed-scope → conforming-promotion tail. Re-enter in the next model-backed FE-1197 walkthrough. Pointers: SPEC D130-L and A42-L; `src/executor/TOPOLOGY.md`; `docs/praxis/manual-testing.md`.
- `execution-comparison-tracer` ([FE-1230](https://linear.app/hash/issue/FE-1230/greenfield-execution-comparison-tracer)) — **KA stream · owner: Kostandin.** Owes replay of unchanged `petri-editor-browser-v2` against both retained outputs and bounded evidence promotion. Re-enter when the exact immutable attempt/output paths are restored. Pointers: [`memory/cards/execution-comparison-tracer--brunch-oracle-smoke.md`](cards/execution-comparison-tracer--brunch-oracle-smoke.md); SPEC “FE-1230 execution-comparison oracle boundary”; `testing/execution-comparisons/cases/minimal-petri-net-editor/spec.md`; `docs/praxis/comparison-runs.md`.
- `executor-plan-coherence` ([FE-1250](https://linear.app/hash/issue/FE-1250/build-coherent-execution-plans)) — **KA stream · owner: Kostandin.** Owes one explicitly authorized unchanged frozen-Petri rerun with the controller-owned browser oracle. Re-enter only on that explicit authorization. Pointers: SPEC I69-L and Verification Design “I69-L unchanged frozen Petri comparison witness”; `testing/execution-comparisons/cases/minimal-petri-net-editor/spec.md`.
- `executor-slice-verification-repair` ([FE-1254](https://linear.app/hash/issue/FE-1254/repair-failed-slice-verification-before-halting)) — **KA stream · owner: Kostandin.** Owes its unchanged Petri comparison rerun after the merged finite repair ladder. Re-enter only for the owned, explicitly authorized unchanged rerun. Pointers: SPEC D112-L/D127-L–D130-L/I58-L; `src/executor/TOPOLOGY.md`; PR #370 evidence.
- `greenfield-secure-drop-demo` ([FE-1289](https://linear.app/hash/issue/FE-1289/close-the-greenfield-secure-drop-demo)) — **KA stream · owner: Kostandin.** Owes one fresh full Secure Drop run proving the corrected graph/harness/build path on the current runtime baseline before any diagonal comparison claim. Re-enter from the retained witness card after the merged corrections; SD9 remains failed evidence. Pointers: [`memory/cards/greenfield-secure-drop-demo--mission-and-witness.md`](cards/greenfield-secure-drop-demo--mission-and-witness.md); `TESTING_FINDINGS.md` SD9; SPEC D120-L/D126-L/D127-L/D130-L and I58-L/I69-L.
- **Conditional comparison gate witness:** [`memory/cards/tooling--conditional-comparison-gate.md`](cards/tooling--conditional-comparison-gate.md) remains an active non-frontier evidence card for D1-K. Re-enter on the first pull request whose complete diff is wholly inside the closed non-runtime allowlist; capture that the stable `Full gate` succeeds without executing the comparison lane, then reconcile and retire the card. Do not delete it as completed FE-1266 residue before that witness exists.
- **Canonical-memory paydown (trigger-gated):** after `shared-session-host-convergence` closes, and before admitting another architecture-sensitive frontier, run a bounded `ln-sync` pass over the 500KB SPEC register: migrate current-state bodies to co-located topology homes, preserve only durable event/rationale pointers, merge equivalent live rows, and retire embedded history. Do not churn the register while D141-L and its cutover are still actively changing it.
- **Planning / instrumentation later:** `planning-process-model`, `tier-2-regression-probes`, `mechanism-trace`, and `agent-tracing` re-enter only with an explicit trigger.
- **Standing obligations:** the colleague-facing [`Brunch 1.x data-model handoff`](../docs/architecture/BRUNCH_1X_DATA_MODEL_HANDOFF.md) is delivered; `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them rather than standing as their own buckets.

### Later

Legacy link target; see Horizon.

## Frontier Definitions

<!-- Closed frontier definitions live in docs/archive/PLAN_HISTORY.md. Keep live definitions for active/next pickup items. -->

### post-hardening-alpha-validation

- **Name:** Current alpha usage and verification path validation
- **Linear:** [FE-1348](https://linear.app/hash/issue/FE-1348/validate-current-brunch-usage-and-testing-paths)
- **Branch:** `ln/fe-1348-audit-all-usage-and-testing-paths`; stacked after FE-1321 so the sweep validates the complete current runtime-contract tracer.
- **Kind:** evidence-gated coverage frontier over the frozen current alpha boundary; verification and finding disposition by default, not implementation.
- **Certainty:** proving.
- **Stabilizes:** the current product-entry, runtime-authority, durable-state, developer-verification, comparison-gate, and installed-package evidence boundary; A51-L retired after its required colleague walkthrough passed.
- **Boundary:** required rows cover supported source/product entry points (TUI, companion React, standalone web, stdio/WebSocket RPC, print), workspace/spec/session activation and resume/tree behavior, one bounded Specify and Execute interaction path, canonical graph/session settlement, current dev/probe observability, repository/full/comparison gates, conditional CI selection, and installed-package smoke. Explicitly out: new capabilities or fixes, full provider-quality campaigns, KA-owned Execute evidence, saved-mission and execution-comparison reruns, legacy 0.x migration without a disposable fixture, cross-platform terminal claims, and actual npm publication.
- **Classification:** evidence-gated — the inventory and existing oracles are available, but required outer rows need fresh structured-interface, human, PTY, or browser evidence on the current stack. D142-L's completed harness-routing spike makes structured machine interfaces the default for conduct; PTY evidence remains required only where terminal semantics or deliberate human observation are part of the claim.
- **Inventory authority:** [`memory/cards/post-hardening-alpha-validation--usage-and-verification-sweep.md`](cards/post-hardening-alpha-validation--usage-and-verification-sweep.md) (`Mode: sweep`). `TESTING_PLAN.md` supplies historical concern inputs only and must be reconciled to the frozen current-path checklist rather than expanded during execution.
- **Aggregate DoD:** every required ledger row is `have` or `built`; every observation in `TESTING_FINDINGS.md` is fixed, promoted to a named owner, or retired with rationale; every deferred row retains an owner and re-entry trigger; required evidence is retained or linked; canonical testing guidance matches the current surface; `npm run check`, `npm run verify:full`, and `npm run check:release-pack` pass.
- **Promotion / disposal:** the sweep never fixes incidental defects inline. A row-sized verification defect may be routed to a separate scope file on this frontier; behavior/design/refactor work promotes to its owning existing or new PLAN frontier. Delete the sweep ledger only after every required row and every promoted required-row dependency closes.
- **Why now / unlocks:** FE-1311–FE-1321 pruned, reconciled, isolated, and hardened the live stack, but the broad alpha walkthrough script predates those changes. The frozen current-boundary pass supplied the A51-L judgment and successful cross-surface settlement witness; the remaining Execute row supplies the last product-level evidence before this coverage frontier can close.
- **Verification:** each row binds a real entry point to a canonical artifact/query/contract oracle. Under D142-L, agent conduct uses public Brunch JSON-RPC, Pi RPC, or Claude stream-JSON/Agent SDK where the required operation is represented; Herdr or the headless `tui-driver` remains valid for terminal-specific claims and for the current Brunch Execute process-move gap, while browser claims stay browser-driven. The Execute RPC spike confirmed that stdio has no live session driver and hosted web RPC has no process-move operation. Qualitative UI/conduct claims use owned outer walkthroughs. Incidental simplicity/quality observations are evidence, never completion criteria unless promoted.
- **Traceability:** product requirements 1–5, 7–12, 16–19, 24–32; A5-L, A42-L, A48-L, A51-L; D39-L, D123-L, D132-L, D133-L, D141-L, D142-L; I24-L, I32-L, I54-L, I59-L, I64-L–I69-L; SPEC §Verification Design.

### walkthrough-remediation-2

- **Name:** Walkthrough chapter closure — remediation, evidence, and design follow-through (absorbs FE-1167)
- **Linear:** [FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure); absorbs closed FE-1167.
- **Branches:** `ln/fe-1187-walkthrough-remediation-2` → `ln/fe-1187-remediation-3` → `ln/fe-1187-remediation-4`.
- **Kind:** coverage-shaped closure batch: WR18-promoted remediation rows + absorbed LN evidence beats + folded design rows + the tripwire row.
- **Certainty:** proving.
- **Classification:** evidence-gated.
- **Built:** D123-L model/auth reversal; deterministic remediation rows; sweep-debt tripwire; digest feedback → bounded questionnaire/confirmation carrier; shared atomic local-TUI/RPC mixed-settlement review preservation with required per-node/per-edge status, exact readback, and no post-approval completion path; discriminating seed variants for propose/project/review routing plus settlement visibility; the borderless Impact Ledger with narrow/normal/wide goldens, render-honesty oracles, and a deterministic 17-node/11-edge variant gallery; the R6 ask-only valid-terminal status rail; authenticated live-TUI presentation corrections; canonical orientation treatment; persistent elicitation style; deterministic action menus; full Ask mechanics; Continue-language cleanup; and the KA 1.x data-model handoff.
- **Next action:** paused at user direction after `remediation-4` tie-off. On explicit re-entry, reconcile the accepted provider-conduct extractor/oracle against the landed mixed-settlement contract, then restart Card 2 from 0/3. No provider run counts precede extractor/oracle reconciliation.
- **Remaining routes:** extractor/oracle reconciliation; the fresh R8–R10 campaign (current count 0/3); A48-L after that campaign; and the [`consolidated outer checkpoint`](cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md). Execute O7–O9 remain KA-owned D120-L evidence.
- **Live scope files:** paused [`R8–R10 controlled provider-conduct evidence`](cards/walkthrough-remediation-2--provider-conduct-evidence.md); paused [`consolidated outer checkpoint`](cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md).
- **Dependencies:** closes `deterministic-orientation` jointly with the KA-carved Execute evidence; `cli-mode-entry` remains stacked after this frontier.
- **Verification:** one normalized 17-node/11-edge semantic fixture; compact text and live/persisted render equivalence with visible per-node/per-edge settlement; exact local/RPC preservation in one atomic effect; three fresh controlled provider runs; a normal-width human walkthrough on question materiality, settlement honesty, proposition cohesion, inspectability, and fatigue; Ask matrix coverage; lexical negative-space audit rejecting live misuse of “continue”; both-theme human outer evidence. See SPEC §Verification Design.
- **Traceability:** WR18 closure record in `TESTING_FINDINGS.md`; evidence at `testing/walkthroughs/2026-07-10/WR18-manual.md`; D98-L, D109-L, D119-L, D120-L, I62-L; D113-L–D115-L; D99-L; TESTING_PLAN concerns 1/3/4/6/7.

### cli-mode-entry

- **Name:** Direct operational-mode entry — `brunch specify [spec-id]` / `brunch execute <spec-id>`
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup; stack after FE-1348 because that frontier found and bounded the machine-control gap.
- **Kind:** structural bounded feature — one presentation-neutral activation decision with CLI subcommands as its product-facing entry.
- **Certainty:** proving.
- **Status:** next; the revised D98-L/D109-L entry semantics are materialized, so the former FE-1187 implementation block is retired.
- **Lights up:** terminal-independent Specify/Execute activation before TUI or hosted-web runtime composition.
- **Objective:** add `specify [spec-id]` (default new spec) and `execute <spec-id>` subcommands, reserve `develop`, and apply one explicit workspace/spec/session/operational-mode activation decision before launching either TUI or hosted web. Preserve revised style/process-move policy without requiring a controller to append a TUI-only process-move entry. Do not add a second runtime or raw Pi transport.
- **Acceptance:** source and installed CLIs validate spec ids and select the same canonical session/mode under TUI and `--mode web`; a hosted-web `execute <spec-id>` open reports Execute runtime state and can accept a public `session.driveTurn` without terminal input; ordinary bare `brunch` behavior is unchanged. This frontier establishes entry and one driven-turn proof only—it does not run a provider execution campaign or add a generic remote command API.
- **Verification:** inner — argv→activation-decision mapping, mode/session persistence, invalid-id and unchanged-default rivals, orientation/kick composition, hosted-runtime state and driver contracts; outer — one bounded TUI entry observation and one machine-facing hosted-web entry/turn observation.
- **Why now / unlocks:** D142-L's Execute RPC spike proved that stdio has no live session and hosted web has no process-move method. Pre-runtime mode selection is the smallest existing-seam path to machine-controlled Execute entry and unblocks the comparison adapter cutover without exposing TUI mechanics as product RPC.
- **Traceability:** D98-L, D109-L, D101-L, D102-L, D132-L, D142-L; req 4, req 24, req 28.

### comparison-machine-interface-cutover

- **Name:** Comparison harness machine-interface cutover
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup; stack after `cli-mode-entry`.
- **Kind:** structural developer-tooling cutover across the two current approachable comparison prompts; no product protocol expansion.
- **Certainty:** proving.
- **Depends on:** `cli-mode-entry` for Brunch Execute activation; existing hosted Brunch RPC, Claude stream-JSON execution adapter, and comparison artifact/isolation contracts are validated enough.
- **Lights up:** text-native Brunch/Claude conduct and transcript capture without terminal rendering as an accidental control plane.
- **Objective:** make `/compare-specs` and `/compare-execution` use target-native machine interfaces whenever rendering is not part of the claim: hosted public Brunch JSON-RPC for Brunch, Claude stream-JSON for Claude, and the existing controller-owned artifact/cleanup boundaries. Reuse `src/dev/end-to-end-comparison/claude-adapter.ts` behavior rather than authoring a second Claude launcher. Keep PTY/Herdr only as an explicitly selected visual/TUI evidence path.
- **Acceptance:** both prompts and their tests name the structured adapters; Brunch Specify and Execute lanes retain exact target-visible messages, asks/answers, streamed outcomes, canonical JSONL, terminal state, and cleanup without reading private controller material; Claude lanes retain equivalent stream-JSON interaction evidence; no `interactive_shell` dependency remains in these Brunch/Claude nonvisual conduct paths. Existing target isolation, immutable packets, intervention ledgers, and no-winner boundaries remain unchanged. Codex, Cursor, and Pi roster migration is out until a scheduled witness selects them.
- **Verification:** focused adapter protocol/cleanup tests with wrong-interface rivals; actual-entry-point prompt tests; one deterministic Brunch hosted-RPC conduct smoke and one Claude stream-JSON command-construction smoke. Real provider comparisons remain owned by their existing witness/campaign frontiers.
- **Why now / unlocks:** D142-L selected machine-first verification, but the current prompts still prescribe interactive shells. This cutover removes that policy/runtime contradiction before the saved-mission witness and later execution-comparison reruns generate new evidence on the obsolete control path.
- **Traceability:** D70-L, D132-L, D134-L, D142-L; req 24, req 28; I67-L.

### saved-mission-comparison-witness

- **Name:** Operator-led saved-mission comparison witness
- **Linear:** unassigned — create at pickup in Frontend / brunch, with no parent unless the plan or user then names one.
- **Branch:** tbd at pickup; FE-1215 is landed, so create from the then-current stack base when the operator witness is scheduled.
- **Kind:** bounded behavioral-evidence frontier over the real project prompt; no implementation by default.
- **Certainty:** proving.
- **Classification:** wait-gated on operator availability.
- **Status:** planned; FE-1215's D134-L remediation is landed. The retained failed run `minimal-petri-net-editor-20260717T132344Z` remains FE-1215 design evidence, not this frontier's witness.
- **Objective:** prove that the corrected approachable saved-mission workflow works through its actual entry point and that mission revision affects future runs without rewriting historical evidence.
- **Acceptance:** a stock Pi session runs the real `/compare-specs` prompt through ordinary-text approvals; the top-level session is the sole simulated-user actor and drives one hosted Brunch JSON-RPC target then one Claude stream-JSON target through the cutover adapters; the first run proves mission-consistent conduct, no mission leakage, honest outcomes/cleanup, unchanged target-authored documents, one aggregate notification, and a readable report; the operator then revises the mission and approves a second run whose edits do not rewrite the first run's retained snapshots.
- **Verification:** outer only — operator-led first run plus revision/rerun through the real stock-Pi prompt, with artifact inspection and snapshot fingerprints.
- **Dependencies:** hard on `comparison-machine-interface-cutover` and operator scheduling; FE-1215 direct-control remediation and FE-1320 target-placement hardening are satisfied.
- **Traceability:** req 24/A5-L; D70-L; D134-L/I67-L; FE-1210 evidence discipline; SPEC Verification Design `saved-mission-comparison-witness` gate.

### shared-session-host-cutover

- **Name:** Session runtime contract cutover — retire raw sidecar divergence
- **Linear:** unassigned (create at pickup in the FE team / brunch project; no parent unless the then-current plan names one)
- **Branch:** tbd; stacks on `shared-session-host-tracer`.
- **Kind:** coverage-shaped architectural replacement over the closed TUI/web host capability surface.
- **Certainty:** earned; A51-L retired and the reshaped tracer landed. Regress to proving if cross-process writer exclusion or semantic companion coverage becomes unknown.
- **Classification:** tracer, A51-L, standalone-web, and cross-surface settlement evidence complete. CS1/SW2/SW3 are fixed and outer-witnessed through one canonical settled review set, exactly one approval, receipt LSN 2, and exactly one reload. The remaining cutover inventory is still unbuilt; settlement evidence does not claim raw-relay retirement or cutover completion.
- **Objective:** make the traced runtime/projection/writer contracts canonical across normal TUI and standalone web, preserve every required presentation capability, and delete the singleton raw relay, raw event contract, `/rpc/driver`, and duplicate driver/broker semantics without forcing one physical host process.
- **Inventory authority:** create `memory/cards/shared-session-host-cutover--surface-ledger.md` (`Mode: sweep`) at scope time from the production composition/registries plus existing TUI, RPC, standalone-host, and web-route oracles.
- **Aggregate DoD:** no required row remains `spec` / `new` / `partial`; normal TUI and standalone web use the same target-addressed semantic contract and enforce one writable runtime per durable target; the deletion list is absent from production and test code; no topology or onboarding doc teaches the retired raw-sidecar architecture.
- **Verification:** per-row inner tests; middle differentials prove both launch compositions project the same durable JSONL meaning while each owns its own runtime lifetime, including active-branch/reconnect and graph-update rivals; full `npm run verify`; outer colleague walkthrough of the TUI companion plus normal TUI shutdown and standalone reopen. A deletion oracle rejects `SessionEventRelay`, `brunch.sessionEvent`, `/rpc/driver`, and targetless live-session calls outside archive/history docs.
- **Traceability:** D84-L retirement; D132-L, D133-L; I64-L, I65-L; `shared-session-host-convergence` arc done-definition; [`docs/design/WEB_UI_ARCHITECTURE.md`](../docs/design/WEB_UI_ARCHITECTURE.md).

### capture-ledger-tracer

- **Name:** Sectioned capture-ledger conduct tracer
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup; stack after `agent-control-plane-closure`
- **Kind:** bounded agent-control intervention + behavioral evaluation tracer; not durable capture IR, graph-schema change, or production subagent fan-out.
- **Certainty:** proving.
- **Classification:** buildable-now.
- **Status:** planned; scope prepared at [`memory/cards/capture-ledger-tracer--conduct-falsifier.md`](cards/capture-ledger-tracer--conduct-falsifier.md).
- **Objective:** produce a predeclared matched verdict on whether a versioned Intent / Implementation / Assurance / Planning capture rubric plus a separate relations/conflicts/abstentions pass improves accepted-source capture over current ingest conduct without increasing false commitment or laundering uncertainty.
- **Why now / unlocks:** FE-1210 proved the general push-driven actor and split outcome/process judgment pattern, while its promoted witness exposed the target seam: Brunch elicited broad consequential material but the settled graph-derived document still omitted one revealed fact. The result decides whether the next architecture should remain prompt-carried, graduate to a foreground typed capture compiler, or earn focused subagent fan-out.
- **Lights up:** accepted source carrier → real elicitor prompt/resources → graph/scratchpad/reconciliation outcomes → masked outcome packet + unblinded Brunch conduct packet → human-adjudicated adoption/rejection verdict.
- **Stabilizes:** one versioned capture-conduct intervention, one atomic controller-only capture key, and one reusable control/treatment oracle that counts facts and relations individually rather than crediting a compound interaction as one success.
- **Acceptance:**
  - One canonical `capture-ledger-v1` conduct pack lives in `ingest`; a short elicitor activation directive requires the relevant skill/map reads at a capture trigger without copying the rubric into multiple prompt homes. Intent / Implementation / Assurance / Planning remain extraction views, not graph ontology or readiness stages; relations remain cross-cutting.
  - A dev/eval-only control/treatment seam changes only the capture-ledger conduct. Stable ids/hashes and prompt differentials prove the intervention; normal product launches cannot select an evaluation arm.
  - One frozen accepted-digest mission contains atomic material across all four concern groups, cross-group relations, uncertainty, contradiction, concrete prior evidence, a future-evidence decoy, unsupported implication, and superseded/option-echo contamination.
  - Matched retained runs use the same model, source, graph seed, budgets, actor policy, and validity rules. A masked terminal-state packet judges supported recall, relation preservation, routing/settlement fidelity, abstention, invention, and downstream coherence; a separate unblinded Brunch conduct packet judges actual resource reads, carrier integrity, action ordering, retries, and cost.
  - The predeclared verdict records positive, negative, and invalid evidence without post-hoc rubric changes. A gain supports scoping the foreground typed capture compiler; persistent category-specific omissions may support a later Markdown-returning specialist fan-out; no gain rejects further ledger machinery.
- **Verification:** inner — exact prompt/resource composition, stable intervention identity, carrier contamination negatives, graph legality, settlement/routing, and packet schema tests; middle — deterministic replay through the real prompt/composition and evaluator seams plus matched real-provider actor runs; outer — criterion-level human adjudication of masked outcome and unblinded conduct drafts before promotion.
- **Boundary:** reuse FE-1210's proven actor and split-judgment discipline plus the landed FE-1208 evaluator/report primitives where they fit; do not revive the old fixed actor, create a second artifact system, add durable IR, or require specialist fan-out. If later earned, specialists may use task-bundled rubrics or the named grants materialized by `agent-control-plane-closure` and return Markdown; foreground still owns collation, mapping, and writes.
- **Traceability:** D99-L (accepted-source advisory routing), D131-L (concern groups and assurance semantics), A22-L (foreground capture quality), A34-L (subagent acquisition remains open), A40-L (watermark intent is not proven capture completion); FE-1210 split-judgment evidence architecture.

### operator-comparison-workflow

- **Name:** Approachable saved-mission comparison workflow
- **Linear:** [FE-1215](https://linear.app/hash/issue/FE-1215/approachable-saved-mission-comparison-workflow) — Frontend / brunch, assigned to Lu, no parent.
- **Branch:** `ln/fe-1215-saved-mission-comparison`, stacked on completed FE-1210 `ln/fe-1210-agent-as-user-comparison`.
- **Kind:** bounded operator tooling — one project Pi prompt plus a durable mission/report artifact flow; not Brunch product runtime and not a generic campaign framework.
- **Certainty:** proving.
- **Status:** focused remediation and #343 stack closeout corrections complete. The first operator-led run validated the mission interview but falsified the fresh nested Pi actor topology, exposed stock-Pi portability risk from `ask_user_question`, and showed that synthetic provider/actor preflights are too heavy for every launch. The autonomous prompt/docs correction is built and statically verified, and the focused real-entry smoke passed on run `minimal-petri-net-editor-20260717T191333Z`: a Brunch-only direct-shell `/compare-specs` interaction reached a real Specify exchange beyond the splash and exported a review-ready spec with no private-mission leakage (`TESTING_FINDINGS.md` CS1–CS2). Review induction's remaining bounded defects are now closed on #343: document export accepts no fixture-only visibility control and reads active settled graph state, live Brunch recipes thread target-rooted output paths, and the mission namespace reserves its README. Separately, the private mission was stored inside the target-reachable run tree (isolation held behaviorally, not by a filesystem jail) — routed to follow-up `comparison-mission-isolation-hardening` (CS2).
- **Objective:** give an operator one approachable conversational door for creating, revising, and running agent-as-user specification comparisons. The saved mission privately defines the simulated user—what they are trying to accomplish, their context, priorities, preferences, constraints, knowledge, uncertainties, decision latitude, and conversational posture. The invoking top-level Pi session follows that mission and directly performs the user's side of each interaction while driving one comparison harness at a time. Harness setup is a separate, minimal run concern: each selected harness receives only its small specification-task framing plus the opening user message and subsequent mission-grounded answers, never the mission wholesale. After the run, the operator can compare the full private mission, what each harness actually elicited, and each target-authored document in one readable report.
- **Why now / unlocks:** FE-1210 proved the rigorous fresh-actor/adapters substrate, but the first operator-led FE-1215 handover run showed that reusing it through a nested actor shell makes the approachable path unusable: nested viewport dimensions hid Brunch's interactive surface, actor-vs-harness roles were opaque, and live smoke preflights added ceremony. Correcting the control topology on the active branch is required before a later full witness or browser workspace is meaningful.
- **Lights up:** one invocation → conversational private user-mission interview → separate minimal comparison-harness setup → top-level session acting as simulated user → one direct harness interaction at a time → completion notification → target-authored documents → readable operator report.
- **Stabilizes:** D134-L/I67-L's single-level control topology, stock-Pi text portability, and the separation among an editable private agent-as-user mission, minimal per-run harness setup, target-visible interaction, and immutable run snapshots. Saved missions live under `testing/comparisons/missions/`; ephemeral target workspaces/evidence assembly stay under `.fixtures/scratch/comparisons/`; reviewed run snapshots, outputs, and reports use `.fixtures/runs/agent-as-user-comparison/`. This preserves D70-L's four-role fixture taxonomy and keeps product-neutral missions distinct from Brunch seeds.
- **Acceptance:**
  - `.pi/prompts/compare-specs.md` remains the single operator entry point. With no argument it offers create/revise/run; with a mission id or path it resolves only an unambiguous mission Markdown file under `testing/comparisons/missions/` and offers review/revise/run. `README.md` is a reserved control file and is never selectable, revisable, or writable as mission payload. Mission usefulness depends on its ordinary-language content, not exact heading names.
  - New-mission intake remains conversational in ordinary product language, one material question at a time, establishing the simulated user's objective, context, priorities, preferences, constraints, known facts, uncertainties, decision latitude, conversational/disclosure posture, and natural opening request. It never assumes that the simulated user is a PM and does not configure a harness while defining the user.
  - The generated mission remains readable private Markdown rather than controller YAML. It contains no comparison-harness selection or adapter instructions. Only the invoking top-level Pi agent receives it wholesale.
  - Run setup selects **comparison harnesses** from the concrete v1 roster and shows the minimal exact framing each receives. Future run snapshots use `harness-setup.md`; immutable historical `contender-setup.md` snapshots are not renamed or rewritten.
  - The invoking project Pi session is the sole simulated-user actor for the approachable run. It launches exactly one selected harness in one direct `interactive_shell` session at a time, at normal host dimensions, with a fresh isolated target cwd/session. It never spawns a Pi actor that launches another interactive shell.
  - Each harness receives only its approved framing plus the natural opening and later answers chosen by the top-level agent from mission truth. The private mission text/file/path never enters the harness context or cwd. Lane order and the shared top-level actor context are disclosed; this exploratory workflow does not claim rigorous per-lane actor-process isolation.
  - Operator choices, mission approval, and run approval always work through ordinary text in stock Pi. If a custom structured-question tool exists, it may improve presentation but cannot be required for correctness or progress.
  - Setup checks are lean and selected-harness-specific: verify filesystem/adapter prerequisites without synthetic Pi actor launches or throwaway provider conversations. Provider/model failure is reported honestly at the real harness launch. Pi is checked as a comparison harness only when Pi is selected.
  - Revision updates only the editable mission. Every run copies the exact approved private mission and separate harness setup into operator-only evidence, so later revisions cannot rewrite earlier comparisons.
  - One approved kickoff sequences selected harnesses with visible `ready | running | waiting | finished | failed` status. The operator is notified only when all selected harnesses resolve; v1 does not promise parallel execution.
  - Each completed run retains the private mission snapshot, exact harness setup, target-visible interaction, every target-authored document, lane outcomes, and one `report.md`. The report distinguishes the private baseline from what each harness saw; observations are free-form and it declares no automatic winner or fixed rubric.
- **Boundary:** no browser workspace, database, standalone mission service, automatic winner, scripted/API judge, statistics, unattended multi-run campaign, or generic harness abstraction. The approachable path reuses FE-1210's direct target adapters and rendered-state cadence, not its fresh-per-lane nested actor recipe. Rigorous frozen-packet/matched-budget/blinded studies retain that separate recipe. Do not extract a skill or package unless the prompt remains unreliable after this correction.
- **Verification:** inner — direct prompt/README review, prompt-template discovery/frontmatter, stock-Pi built-in tool audit, targeted Markdown checks, and repository read-only checks. Focused outer remediation smoke — invoke the real prompt from stock Pi, use plain-text choices/approvals, and reach one normal-width Brunch Specify interaction through a single direct shell with no nested actor process. The later `saved-mission-comparison-witness` still owns the full Brunch + Claude run, report usefulness, and revision immutability proof.
- **Traceability:** req 24/A5-L evidence lifecycle; D70-L fixture taxonomy; D134-L/I67-L control topology and portability; FE-1210 closeout and promoted `lockers-r1-20260716` rigorous actor/adapter evidence; retained failed run `minimal-petri-net-editor-20260717T132344Z` and its operator observations.
- **Current execution pointer:** no active scope or refactor file. The focused smoke and #343 review closeout are complete; tie off and land the stack. `comparison-mission-isolation-hardening` remains a separate follow-up.

### saved-mission-comparison-witness

- **Name:** Operator-led saved-mission comparison witness
- **Linear:** unassigned — create at pickup in Frontend / brunch, with no parent unless the plan or user then names one.
- **Branch:** tbd at pickup; stack on the landed D134-L-remediated `operator-comparison-workflow` / FE-1215 branch.
- **Kind:** bounded behavioral-evidence frontier over the real project prompt; no implementation by default.
- **Certainty:** proving.
- **Classification:** wait-gated on operator availability and FE-1215's D134-L remediation landing.
- **Status:** planned for a later PR; not started. The retained failed run `minimal-petri-net-editor-20260717T132344Z` is design evidence for FE-1215, not this frontier's passing witness.
- **Objective:** prove that the corrected approachable saved-mission workflow works through its actual entry point and that mission revision affects future runs without rewriting historical evidence.
- **Why now / unlocks:** FE-1215 must first remove its nested actor topology and stock-Pi portability assumptions. A separately scheduled operator-owned frontier then proves the full multi-harness workflow without letting static prompt review stand in for behavior.
- **Lights up:** real operator-authored private user mission → top-level agent acting as simulated user → one direct Brunch shell then one direct Claude shell → target-authored documents → readable retained report → revised mission and second immutable run.
- **Stabilizes:** D134-L/I67-L single-level control, private-mission isolation, mission-consistent simulated-user conduct, exact target-visible disclosure, aggregate completion notification, operator-report usefulness, and immutable run history across mission revision.
- **Boundary:** first run uses Brunch + Claude and one operator-authored mission; second run revises that same mission. No surrogate lifecycle test, automatic judge, roster-wide campaign, browser UI, generic runner, orchestration implementation, or fresh nested actor process. Rigorous per-lane actor isolation remains FE-1210 campaign territory, not an acceptance criterion here.
- **Acceptance:**
  - A newly started project-trusted stock Pi session discovers and runs the actual `/compare-specs` template using ordinary-text choices/approvals, with no dependency on `ask_user_question` or another custom question tool.
  - That top-level session is the sole simulated-user actor and drives only one direct comparison-harness interactive shell at a time; Brunch and Claude each receive fresh isolated target cwd/session identities, and no interactive shell is launched from inside another actor shell.
  - The first Brunch + Claude run demonstrates mission-consistent opening/answers/decisions, explicit unknown/undecided behavior where required, no wholesale mission or mission-path leakage, honest lane outcomes/cleanup, unchanged target-authored documents, one aggregate notification, and a cold-readable operator report separating private baseline from target-visible evidence.
  - The operator revises the saved mission through actual `/compare-specs` and approves a second run setup; the editable mission changes while the first run's private-mission and harness-setup snapshots remain byte-for-byte unchanged.
  - Only the second run receives the revised mission/setup; no first-run directory, transcript, target output, or report is overwritten.
- **Verification:** outer only — operator-led first run plus revision/rerun through the real stock-Pi prompt, with repository-relative artifact inspection and snapshot fingerprints. Static checks may support artifact hygiene but cannot satisfy behavioral acceptance.
- **Dependencies:** hard on FE-1215's D134-L remediation landing and operator scheduling. Create its Linear issue and Graphite branch only when the frontier starts.
- **Traceability:** req 24/A5-L evidence lifecycle; D70-L fixture taxonomy; D134-L/I67-L control topology; FE-1210's separate rigorous actor/adapter evidence; SPEC Verification Design `saved-mission-comparison-witness` outer gate.
- **Current execution pointer:** none; run `ln-scope` at pickup after the operator witness session is scheduled.

### cli-mode-entry

- **Name:** Direct-mode CLI entry — `brunch specify [spec-id]` / `brunch execute <spec-id>`
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** stacked on FE-1187's auth-reversal branch (both reshape the entry surface; shared workspace-dialog seam)
- **Kind:** bounded feature — new CLI entry behavior over existing activation/orientation seams.
- **Certainty:** proving — the activation seams exist; the open question is direct mode entry under the new persistent Specify-style / one-shot-process-move policy.
- **Blocked by:** `walkthrough-remediation-2` materializing revised D98-L/D109-L. The earlier assumption that direct mode entry should synthesize one generic orientation entry and suppress the boot menu is retired.
- **Objective:** subcommands `specify [spec-id]` (spec optional — default is a new spec, which still requires a title prompt), `execute <spec-id>` (spec required), and a reserved `develop` name. Parse via the existing `parseArgs` router (`src/app/brunch.ts`, where `login` routes today); pre-answer the workspace dialog through the injected decision seam (`chooseSpecSessionActivationDecision` overrides + `findSpec` lookup, decision union `newSpec{title}` / `newSession{specId}`); seed `operationalMode` via `appendBrunchAgentRuntimeInit`, then follow the revised style/process-move policy rather than fabricating an obsolete generic orientation choice.
- **Distinctions:** `--mode` remains the host-mode axis (`tui`/`print`/`rpc`); operational mode enters only via subcommand. Execute-mode entry semantics stay D98-L-consistent (1:1 mode↔agent) — coordinate the `execute` subcommand's semantics with the KA stream.
- **Verification:** inner — argv→activation-decision mapping, spec-id validation, orientation-suppression + kick-composition regressions; outer — one manual walkthrough per subcommand.
- **Why now / unlocks:** shares FE-1187's entry-friction motivation (alpha users must reach a working session with minimum ceremony); reserves the `develop` name ahead of the Horizon mode. Cost read 2026-07-13: ~2–3 focused days.
- **Traceability:** D98-L, D109-L (juncture family), D101-L/D102-L (seed facts); riskiest seam: boot-menu suppression vs `session-orientation` registrar/kick bookkeeping.

<!-- executor-run-environment (FE-1166) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-15 ln-sync);
     original frontier delivered (PR #302), live remainder folded into executor-plan-synthesis (FE-1197),
     and the actionable-slice-request card consumed/deleted. Durable truth: D111-L/D112-L/D130-L,
     src/executor/TOPOLOGY.md; run-substrate/verify-policy residue now rides FE-1197. -->

<!-- elicitation-gap-guidance (FE-1116) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D99-L, D101-L, D102-L, I52-L, I56-L, closure oracle
     src/graph/__tests__/elicitation-gap-guidance-closure.test.ts, docs/archive/SESSION_LOCAL_ELICITATION_GAPS.md. -->

<!-- executor-run-observer (FE-1141) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #295);
     durable truth: execute.* read projections, run-scoped brunch.updated topics, src/executor/TOPOLOGY.md,
     src/web/TOPOLOGY.md. Follow-on KA work continues on #300/#302/#303. -->

<!-- executor-run-integrity (FE-1154) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #297);
     retained executor card GC completed in the 2026-07-08 sync. -->

### planning-process-model

- **Name:** Planning-process model — plan-as-projection and epistemic horizon beyond the settled scope handoff
- **Linear:** unassigned
- **Branch:** `ln/fe-xxx-plan-plane-redesign` (plan-plane groundwork already landed here: `slice` removal + D103-L + CueLoop liftout)
- **Kind:** structural / plan-plane semantics
- **Stream:** KA (Kostandin) — moved 2026-07-13: plan-plane semantics sit with executor/orchestration concerns.
- **Status:** Horizon candidate, reshaped by D126-L. The durable `scope` question is closed; this frontier now owns only plan projection beyond committed scopes and the remaining epistemic-horizon/decision-flow questions. The orientation menus' "project a plan" option does not depend on or advance it.
- **Certainty:** proving.
- **Lights up:** plan generation as *projection* from committed `{milestone, frontier, scope}` truth through the existing `project` seam, optionally exported to an external format such as CueLoop as design pressure.
- **Stabilizes:** D126-L's durable-scope/runtime-slice boundary while locating whether richer epistemic-horizon or decision-flow state earns representation.
- **Objective:** Model how Brunch projects committed scope packages through fog-of-war and non-structural sequential dependency, and whether extending the planning horizon or gaining parallelism needs additional durable truth. Do not reopen the settled `scope` kind or its execution-handoff contract.
- **Acceptance:**
  - A plan projection is derived from committed graph truth (milestone/frontier/scope plus their intent/oracle/design anchors) and rendered thinly, reusing the `project` (D100-L) seam rather than a new graph-write path or exchange schema family.
  - The projection is demonstrably *projection*, not free generation: it starts from accepted upstream anchors and never commits plan-plane graph truth itself (I51-L discipline).
  - An external-format export (e.g. CueLoop) is proven as an optional downstream rendering of that projection, or explicitly rejected with a recorded reason — used only as design pressure, not as product architecture.
  - Any richer horizon/decision-flow representation is justified by evidence from the settled D126-L scope consumer path; otherwise it remains process-only.
- **Traceability:** D126-L (settled scope handoff), D103-L (durable slice retirement), D100-L (`project` seam), D87-L (`unknown` = horizon on the intent plane), D99-L (advisory/settled); KA owns executor/orchestration consequences. SPEC §Future Direction "Planning persistence evolution".


### execution-comparison-tracer

- **Name:** Greenfield execution comparison tracer
- **Linear:** [FE-1230](https://linear.app/hash/issue/FE-1230/greenfield-execution-comparison-tracer), child of [FE-1211](https://linear.app/hash/issue/FE-1211/brunch-testing-execution-side-evaluation-of-outputs).
- **Branch:** `ka/fe-1230-independent-oracle-journeys` (continuation off `next`; original implementation landed in #345).
- **Kind:** bounded evaluation tracer — frozen execution input, isolated adapters, controller-only oracles, and immutable evidence; no product operator command yet.
- **Certainty:** proving.
- **Status:** active; independent-journey implementation complete 2026-07-21. One clean Brunch run and one clean isolated Claude Code run used the frozen Petri-editor packet. Both passed their own tests/build and failed the original sequential accessibility oracle at different points; failed/invalid launches remain retained. `petri-editor-browser-v2` now runs all five claim-linked journeys from fresh contexts with public-only setup and per-journey evidence. Retained-pair replay/promotion is blocked only on restoring the exact immutable output paths. Mutants, masked/process judging, and repetitions are deferred.
- **Objective:** preserve claim-level mechanical evidence from the retained Brunch/Claude pair by removing sequential blocking from the controller-owned browser oracle.
- **Lights up:** frozen lane output → independently executable hidden browser/Petri journeys → complete claim-level verdicts despite earlier failures.
- **Stabilizes:** immutable attempt retention, journey identity and claim linkage, setup-vs-assertion failure semantics, and the no-landing boundary.
- **Acceptance:** preserve every v1 attempt byte-for-byte; build/test once, then run mount, node lifecycle, weighted behavior, invalid/cascade behavior, and persistence/round-trip from fresh browser contexts and public setup; retain a verdict for every journey even after another fails; replay one unchanged independent-journey oracle version against both retained outputs when their exact paths are restored; publish bounded findings only and no retrospective winner.
- **Verification:** inner — injected journey-runner scheduling, claim linkage, failure classification, and cleanup; middle — known-good slow browser run from five fresh contexts plus eventual retained-output replay; outer — retained attempt completeness and bounded report review only.
- **Cross-cutting obligations:** preserve FE-1210 failure-retention and reviewed-promotion discipline without mixing execution cases into the private elicitation-mission namespace; record exact provider/model/harness versions; never expose controller-only oracles to a lane; never invoke `/brunch:land`.
- **Explicitly out:** sensitivity mutants, masked/process judging, determinism repetitions, generalized campaign machinery, Pi Campaign Machine/Clay, brownfield Brunch/Petrinaut cases, automatic landing, Cursor/Codex lanes, production `/compare-execution`, and broad reliability/cost/speed claims.
- **Traceability:** D40-L, D120-L, I62-L; FE-1210/FE-1215 comparison evidence discipline; [`testing/execution-comparisons/cases/minimal-petri-net-editor/spec.md`](../testing/execution-comparisons/cases/minimal-petri-net-editor/spec.md); origin mission [`testing/comparisons/missions/minimal-petri-net-editor.md`](../testing/comparisons/missions/minimal-petri-net-editor.md); `docs/praxis/comparison-runs.md`; `src/executor/TOPOLOGY.md`.
- **Current execution pointer:** no active scope card. Retained-pair replay/promotion re-enters through `ln-scope` when the exact immutable attempt/output paths are restored.

### end-to-end-comparison-tracer

- **Name:** Trace elicitation through execution
- **Linear:** [FE-1239](https://linear.app/hash/issue/FE-1239/trace-elicitation-through-execution), child of [FE-1211](https://linear.app/hash/issue/FE-1211/brunch-testing-execution-side-evaluation-of-outputs).
- **Branch:** `ka/fe-1239-end-to-end-comparison-tracer`, restacked on `next` after FE-1230 landed.
- **Kind:** bounded staged 2×2 evaluation tracer — rigorous elicitation, immutable exact-spec handoff, isolated execution, common controller oracle, and requirement traceability; no product operator command or generalized campaign runner.
- **Certainty:** proving.
- **Status:** ✓ implementation and one-case witness complete 2026-07-21. Both exact handoffs and all four valid failed execution cells are retained; the common oracle, audience-safe ledger, and bounded report are promoted without a winner claim.
- **Objective:** determine whether differences between one Brunch-elicited and one Claude-elicited approved specification remain associated with requirement-level implementation outcomes when each exact specification is executed by both Brunch and Claude under the same frozen case, budgets, and oracle.
- **Lights up:** product-neutral mission + shared public baseline → two fresh valid elicitation artifacts → two immutable handoffs → four execution cells → unchanged independent browser journeys → validity-first requirement ledger.
- **Stabilizes:** exact elicitation-to-execution byte identity, study/matrix closure, shared-baseline versus controller-only requirement provenance, and FE-1232's end-to-end reporting input contract without widening FE-1230's immutable `ExecutionAttempt` schema.
- **Depends on:** FE-1210's rigorous fresh-actor recipe and FE-1230's execution artifacts/oracle contracts. FE-1230 retained-pair promotion is sibling evidence, not an input substitute; FE-1239 runs fresh outputs for both handoffs.
- **Acceptance:** freeze the study before provider work; disclose shared accessibility/interoperability requirements before elicitation; retain two valid target-authored specifications; reject any handoff drift, normalization, target-visible controller material, or target workspace that can reach the controller root; retain exactly four matrix cells referencing immutable execution attempts; run `petri-editor-browser-v2` unchanged against every output; close every predeclared requirement-ledger row with evidence or `not_assessable`; promote an operator/controller bundle plus audience-safe report with no winner or generalized causal claim.
- **Verification:** inner — runtime-boundary tests for study/handoff/matrix/ledger/redaction contracts; middle — known-good synthetic four-cell composition plus unchanged browser-oracle regression; outer — two fresh rigorous elicitation runs, four real execution runs, retained invalidity/cleanup review, requirement-ledger adjudication, and deliberate promotion.
- **Cross-cutting obligations:** missions and controller reveal material never enter execution lanes; shared public baseline rows cannot be credited as elicitation gains; failed/invalid attempts remain retained; common claims use only common evidence; Brunch stops at `promotion_prepared` and never invokes `/brunch:land`; comparison reporting consumes retained artifacts but does not own or mutate run conduct.
- **Explicitly out:** `/compare-specs` retrofit, production `/compare-execution` or `/compare-end-to-end`, automatic scoring/winner, reliability repetitions, mutants, multi-case generalization, Cursor/Codex lanes, host landing, and FE-1230 `ExecutionAttempt` schema changes.
- **Traceability:** D70-L fixture taxonomy; D134-L/I67-L comparison control topology and isolation; D40-L/D120-L/I62-L execution/no-landing boundaries; FE-1210/FE-1230/FE-1232; [`docs/praxis/comparison-runs.md`](../docs/praxis/comparison-runs.md); [`end-to-end-comparisons.md`](../.agents/skills/comparison-reporting/references/end-to-end-comparisons.md).
- **Retained witness:** [`.fixtures/runs/end-to-end-comparison/petri-editor-e2e-20260721T132600Z/`](../.fixtures/runs/end-to-end-comparison/petri-editor-e2e-20260721T132600Z/); completion evidence in [`memory/cards/end-to-end-comparison-tracer--factorial-matrix.md`](cards/end-to-end-comparison-tracer--factorial-matrix.md).

### greenfield-secure-drop-demo

- **Name:** Close the greenfield Secure Drop demo
- **Linear:** [FE-1289](https://linear.app/hash/issue/FE-1289/close-the-greenfield-secure-drop-demo)
- **Branch:** `ka/fe-1289-greenfield-secure-drop-demo`
- **Kind:** bounded product/evidence tracer over settled Specify, Execute, Petrinaut, landing, and comparison seams.
- **Certainty:** proving.
- **Objective:** prove one colleague-repeatable path from a product-neutral Secure Drop mission through real elicitation and accepted graph truth into an executable parallel plan, live Petrinaut-observed production execution, confirmed greenfield landing, and deterministic application V&V; fix only observed demo-critical failures.
- **Lights up:** mission → accepted spec graph → authored harness and committed scopes → synthesized parallel plan → production cook → live Petrinaut terminal state → landed verified application.
- **Stabilizes:** existing security representation through `constraint` / `invariant` / `criterion` / `vv_method` / `check` / `evidence`, without a new security kind or newly generated legacy `vv_obligation`.
- **Acceptance:**
  - The settled graph states product intent and user flows, explicit threat/security constraints, executable criteria, frontend/backend boundaries, at least three scopes with at least two dependency-independent, and one deterministic authored execution harness.
  - A fresh greenfield run uses production plan/cook paths, visibly streams Petrinaut state, reaches `promotion_prepared`, lands only through confirmed `/brunch:land`, and passes the mission-owned browser/API/SQLite/test/build checks without repository surgery.
  - Two consecutive clean Brunch runs reproduce the result; one reviewed portable run retains graph, plan, Petri, terminal, application, blocker, and limitation evidence.
  - A separate frozen diagonal pair runs Brunch own-spec→Brunch execution and Claude own-spec→Claude execution under matched public mission, reveal, budget, validity, and external-oracle rules; no factorial, winner, reliability, or landing claim.
  - Every blocker is classified `demo-critical`, `acceptable demo limitation`, or `software-specific deferred work`; only the first class changes product code.
- **Verification:** inner — mission/case contract tests and focused regressions for observed blockers; middle — controller-owned browser/API/SQLite security oracle plus authored `npm test` and `npm run build`; outer — two clean product walkthroughs with Petrinaut and landing, then one retained paired comparison. Full local gate only when slow executor/landing/comparison seams change.
- **Excludes:** brownfield repositories, merge/dependency-reconciliation work, generic coding-agent parity, new graph kinds, production cryptographic certification, messaging/conversation/presence/notification behavior, and unrelated harness abstractions.
- **Current execution pointer:** `memory/cards/greenfield-secure-drop-demo--mission-and-witness.md`.
- **Traceability:** D120-L, D126-L, D127-L, D130-L; I58-L, I69-L; `src/executor/TOPOLOGY.md`, `src/rpc/TOPOLOGY.md`, `docs/praxis/comparison-runs.md`.

### executor-slice-admission-parity

- **Name:** Prevent invalid scoped slices from reaching execution
- **Linear:** [FE-1240](https://linear.app/hash/issue/FE-1240/prevent-invalid-scoped-slices-from-reaching-execution).
- **Branch:** `ka/fe-1240-slice-admission-parity`, restacked on `next` after FE-1239 landed.
- **Kind:** bounded bugfix — deterministic admission parity between model-authored candidate plans and the fail-closed worker-request boundary.
- **Certainty:** proving.
- **Status:** ✓ complete 2026-07-21; scoped from the retained FE-1239 witness, where both Brunch cells admitted plans whose first scoped slice carried no executable criterion and then halted with `plan_slice_invalid`.
- **Objective:** make candidate-plan admission reject every scoped slice that cannot produce complete worker-request context, feeding exact findings through the existing bounded repair loop instead of discovering the defect after a run starts.
- **Stabilizes:** D126-L committed-scope/runtime-slice handoff, deterministic planner admission, and `slice_execute`'s zero-side-effect corruption guard.
- **Depends on:** the settled FE-1197 synthesis/validation seam and D126-L plan-ready scope contract; no SPEC revision or execution-time plan repair.
- **Acceptance:** validation rejects scoped slices missing executable criteria, design context, or verification-machinery context even when aggregate scope coverage is complete; exact findings reach bounded repair; an admitted repaired plan survives preview serialization and worker-request parsing for every slice; externally supplied malformed populated plans remain fail-closed at `slice_execute`.
- **Verification:** inner — candidate-validation and repair-loop regressions; middle — plan synthesis → preview payload → worker-request-context parity; outer — owned by a separately authorized rerun of the frozen end-to-end comparison after this fix lands.
- **Current execution pointer:** none; the single scope card is consumed.

### executor-plan-coherence

- **Name:** Build coherent execution plans
- **Linear:** [FE-1250](https://linear.app/hash/issue/FE-1250/build-coherent-execution-plans).
- **Branch:** `ka/fe-1250-coherent-execution-plans`, based on `next`.
- **Kind:** bounded proving frontier — planner conduct and deterministic plan-shape admission over settled D126-L/D130-L and FE-1195 executor seams.
- **Certainty:** proving.
- **Status:** implementation complete 2026-07-24, including I69-L worker-contract carry; the explicitly authorized unchanged frozen Petri rerun remains outer evidence and is not a merge gate.
- **Objective:** make integration-sensitive multi-slice plans converge on one working result without adding a browser-specific executor gate or a new durable planning concept.
- **Lights up:** committed scope context → dependency-aware candidate plan → ordinary terminal reconciliation slice → canonical slice verification → existing fan-in and epic verification.
- **Stabilizes:** the model-planner/admission seam between FE-1240's complete worker context and FE-1195's integrated executor worktree.
- **Depends on:** FE-1240 candidate-admission parity and the landed FE-1195 slice integration/epic verification topology; FE-1230/FE-1239 provide evaluation evidence only, not target-visible oracle material.
- **Acceptance:** an integration-sensitive multi-slice fixture produces an explicit shared foundation, dependency ordering, and one ordinary terminal slice that transitively depends on its sibling implementation work and carries exact cumulative approved requirement content plus the relevant criterion, design, verification, and target-visible packet anchors; workers are told to preserve prior public-contract behavior and use the canonical authored harness cumulatively; the admitted plan lowers unchanged through preview and worker-request parsing; existing slice integration and epic verification execute the shape without a new transition or lifecycle phase; non-integrating plans are not forced to acquire ceremonial closure work.
- **Verification:** inner — planner prompt/candidate-validation plus I69-L exact requirement-carry differentials that reject ids-only, paraphrase-loss, wrong-link, malformed/duplicate context, hash-divergent packet, symlink destination, and hidden-oracle rivals; middle — synthesis → preview → request → rendered sealed-worker brief plus cumulative terminal-slice integration and serial/parallel artifact parity through the existing epic harness; outer — one explicitly authorized rerun of the frozen Petri comparison unchanged, retaining its controller-owned browser oracle outside execution and outside the merge gate. See SPEC §Verification Design “I69-L worker-contract-carry”.
- **Boundary:** no hidden-oracle exposure, inferred browser command, new plan-plane node, candidate command surface, execution-time plan repair, or FE-1241 comparison-framework change.
- **Current execution pointer:** none; the worker-contract-carry card is implemented. Re-enter only for an explicitly authorized unchanged frozen Petri comparison rerun.

### prospect-research-workspace-regression

- **Name:** Thin prospect research into a regression case
- **Linear / branch:** [FE-1253](https://linear.app/hash/issue/FE-1253/thin-prospect-research-into-a-regression-case); `ka/fe-1253-prospect-research-e2e`, stacked on FE-1241 with no parent issue.
- **Kind:** earned evaluation simplification — retain a deterministic full-stack regression oracle and retire unproven campaign expansion.
- **Certainty:** earned.
- **Status:** active 2026-07-23. The mission, public packet, opaque Brunch seed, closed compiled oracle, known-good full stack, and focused rivals remain. The prospect-specific end-to-end study profile and provider campaign gate are being retired before any scored lane exists.
- **Objective:** provide one deterministic implementation-level acceptance case for the prospect research workflow without making ordinary regression value depend on a rigorous 2×2 campaign.
- **Closes:** the accidental coupling between a useful full-stack oracle and an unexecuted prospect-specific campaign.
- **Deletes / retires:** the prospect end-to-end study contract, shared baseline, reveal registry, matrix registration, requirement-ledger obligation, scored-provider gate, and campaign claims.
- **Stabilizes:** the fixed React + Node.js + TypeScript + SQLite public packet; `npm test` / `npm run build` / `npm start`; fresh database and fixture isolation; runtime-network denial; independent browser/API/SQLite/export journeys; focused rivals; and opaque specification seeding.
- **Depends on:** FE-1241 for the finalized execution-case registry and oracle dispatch only. No provider or strict greenfield Claude-isolation witness blocks completion.
- **Boundary:** manually initiated prospect research, evidence-backed qualification, deduplication/provenance, suppression, review, audited override, approval, export, provider failure, and restart persistence are in. Outreach delivery, live Pi/Clay quality, campaign composition, scored provider lanes, reliability claims, and `ExecutionAttempt` widening are out.
- **Acceptance:** the known-good full stack passes; focused rivals for unapproved research, confidence-only qualification, lost provenance, weak suppression, reasonless/destructive override, overbroad export, provider-failure laundering, non-durable state, and external runtime requests fail their owning claims; the prospect case is absent from end-to-end study registration; existing Petri and brownfield study bytes/oracles remain unchanged.
- **Verification:** inner — exact public/oracle parsers, oracle-pack hash, claim coverage, and opaque Brunch seed. Middle — independent browser + API + SQLite journeys over fresh database/fixture state, paired with the controller reference model and focused rivals. No outer campaign evidence is required.
- **Cross-cutting obligations:** controller fixtures and expected states remain outside targets; runtime network stays denied; compiled oracle dispatch remains fail-closed; historical comparison evidence remains unchanged.
- **Traceability:** D70-L, D139-L; FE-1230/FE-1241; [`docs/praxis/comparison-runs.md`](../docs/praxis/comparison-runs.md).
- **Current execution pointer:** thin the materialized branch to this regression boundary, then close through deterministic verification.

### executor-slice-verification-repair

- **Name:** Finite slice verification repair ladder
- **Linear:** [FE-1254](https://linear.app/hash/issue/FE-1254/repair-failed-slice-verification-before-halting).
- **Branch:** `ka/fe-1254-slice-verification-repair`.
- **Kind:** bounded executor proving frontier over D112-L/D127-L/D128-L/D130-L and I58-L.
- **Certainty:** proving.
- **Status:** implementation complete 2026-07-23; the full suite, repository checks, and build pass. The unchanged Petri comparison rerun remains as owned outer evidence.
- **Objective:** let a completed failed slice-verification verdict re-dispatch the same stable-workspace worker through a structurally finite, cycle-qualified repair ladder without conflating runner retries, replay authority, or frozen command authority.
- **Acceptance:** three total repair cycles and three runner attempts per stage are independent policy dimensions; history is grouped and strictly validated by cycle; context bytes are canonical, bounded, atomically materialized, and provenance-checked; serial pending state recovers without verifier replay or duplicate effects; parallel pending state is durable in D127-L marking authority before materialization and fails closed on restart; only a cycle-qualified pass integrates; active RPC surfaces expose cycle/phase without diagnostics or premature failure.
- **Boundary:** no generic event store, compatibility adapter for `sliceAttemptHistory`, browser/controller oracle, inferred command authority, duplicate worker/verifier effect, or host mutation.
- **Verification:** focused FE-1254 suites pass with 404 tests and 0 skipped; the full suite passes with 2664 tests and 2 pre-existing skips; `npm run check` and `npm run build` pass. Coverage includes parent-chain directory fsync and restart, production persistence boundaries, direct durable parallel-pending restart, explicit `marking.json` reads, grouped/active-authority corruption, app payload/path rejection, live observer/RPC repair phases, cycle-2 runner retry, and real-adapter multi-repair result binding.
- **Current execution pointer:** none; the finite-ladder scope is consumed. Re-enter only for the unchanged frozen Petri comparison rerun.

### comparison-reporting-skills

- **Name:** Report comparison evidence
- **Linear:** [FE-1232](https://linear.app/hash/issue/FE-1232/report-comparison-evidence).
- **Branch:** `ka/fe-1232-comparison-reporting-skills`, restacked on `next` after FE-1230 landed.
- **Kind:** project workflow tooling — reusable Notion publication plus comparison-study design and evidence interpretation; no product runtime or automatic adjudicator.
- **Certainty:** proving.
- **Status:** ✓ implementation complete 2026-07-20, extended and review-hardened 2026-07-21. The two skills, evaluation/end-to-end references, and dependency-free contract/link check are built; the restacked PR's full CI gate passes.
- **Objective:** give project agents one safe, discoverable reporting path that turns ordinary evidence into verified Notion reports and turns elicitation, execution, or end-to-end comparison artifacts into validity-aware, redaction-safe findings under a frozen test strategy without inventing a winner.
- **Lights up:** source evidence → comparison classification and report structure → smallest safe Notion mutation → post-write verification.
- **Stabilizes:** overview/problem/result grammar; fetch-before-edit and verify-after-edit discipline; active-command precedence over post-run interpretation; implementation/runtime/protocol/validity taxonomy; private/public/masked/unblinded/controller-only boundaries; audience-shaped hidden-requirement rows; frozen test axes, rubric, judge protocol, and 3/5-run prototype repeat contract; procedure-vs-output determinism; requirement-level elicitation-to-implementation traceability; invalid-attempt retention.
- **Acceptance:** two project-shared skills remain separately invocable but composable; the general Notion writer does not acquire comparison semantics; an active complete operating procedure such as `/compare-specs` cannot be retrofitted with campaign machinery; the comparison reporter covers FE-1210/FE-1215 elicitation evidence, FE-1230 execution packets, the test-plan axes and judging protocol, bounded repeated-run determinism, and audience-safe end-to-end traceability; static checks pin safety-critical phrases and resolve every relative Markdown link; no reporting-related verification failure is introduced.
- **Boundary:** in — `.agents/skills/notion-reporting`, `.agents/skills/comparison-reporting`, their direct references, and a dependency-free consistency check. Out — Notion API wrappers, automatic report publication, new comparison runners, oracle execution, automatic scoring/adjudication, or changes to FE-1230 attempt schemas.
- **Dependencies:** builds on FE-1230's execution artifact/redaction contracts and FE-1210/FE-1215's elicitation evidence discipline; may stack before FE-1230 lands but must not weaken or duplicate its controller-only boundary.
- **Verification:** structural skill-contract plus recursive relative-link check chained into `npm run check:skills`; Markdown links and promoted-run paths; tracked-file lint/format; default tests and build; authoritative full CI gate.
- **Traceability:** FE-1210/FE-1215; `agent-as-user-comparison`; `docs/praxis/comparison-runs.md`; FE-1230 `ExecutionAttempt`, masked outcome, and unblinded process packets.

### comparison-publication-workflow

- **Name:** Publish comparison reports with immutable provenance
- **Linear / branch:** [FE-1251](https://linear.app/hash/issue/FE-1251/publish-traceable-comparison-reports); `ka/fe-1251-comparison-publication`, stacked on FE-1250.
- **Kind:** project workflow tooling — write-once run-start provenance plus explicitly invoked, verified Notion publication; no product runtime mutation or autonomous experiment conduct.
- **Certainty:** proving.
- **Status:** active 2026-07-22.
- **Objective:** make retained comparison reports reproducibly attributable to the tested Brunch release and controller checkout, then publish each `Run ID + Phase` exactly once into the canonical Comparison Reports database with safe update semantics.
- **Acceptance:** elicitation, execution, and end-to-end flows capture a schema-versioned `provenance.json` before their first lane and reject collisions or malformed inputs; `/comparison-publish <run-directory>` requires retained provenance and report evidence, applies validity-first interpretation and controller-only redaction, creates or updates exactly one matching database row, stops on duplicates, and verifies every mutation by re-query and fetch; Release and Commit are filterable Notion properties and remain absent on historical rows without exact retained evidence.
- **Boundary:** in — dev-only provenance contract/CLI, comparison prompts and run documentation, project-local publication skill, reporting-skill guardrails, and the live Testing Scenarios schema/legend. Out — product runtime publication, inferred historical provenance, automatic scoring, unsupervised experiment conduct, or changes to comparison artifact contracts.
- **Dependencies:** operationally stacked after FE-1250; builds on FE-1232 reporting and Notion safety contracts plus retained comparison artifacts established by FE-1210/FE-1230/FE-1239.
- **Verification:** focused provenance tests; reporting skill checks; default verify gate; disposable create-then-update publication exercise plus duplicate detection; final Notion schema, row, and legend readback.

### executor-plan-synthesis

- **Name:** Synthesize and validate executor plans from approved scopes
- **Linear:** [FE-1197](https://linear.app/hash/issue/FE-1197/synthesize-and-validate-executor-plans-from-approved-scopes)
- **Branch:** `ka/fe-1197-executor-plan-synthesis` (stacked on `ka/fe-1195-petri-execution-parity`, PR #325)
- **Kind:** structural — a new planning/admission seam between committed scope truth (D126-L) and the frozen-plan Petri pipeline (PR #325).
- **Stream:** KA (Kostandin).
- **Certainty:** proving.
- **Shape (settled at admission — the one-vs-two-frontier question):** one coherent vertical frontier with three slices on one branch. The load-bearing belief — approved scope truth can be lowered through a model-authored, deterministically admitted plan into PR #325 execution such that a run can no longer contradict approved commitments — is falsified only by the combined witness (approved scope → synthesized plan → admitted contract → PR #325 run → conforming promotion). The plan contract (slice A) is proven right only when a synthesized plan flows through it; splitting would stack an unproven contract under a planner branch that must reshape it. Escape hatch: if the branch grows unreviewably broad, re-run `ln-plan` and split at the contract+profile-admission / synthesis+repair boundary, preserving that order.
- **Why now / unlocks:** the witnessed greenfield failure (wrong-stack implementation reaching `promotion_prepared` under a self-selected `npm_test` profile) proved the admission boundary is broken exactly when its two neighbors finished: FE-1173/1175/1179 delivered committed-scope handoff above, FE-1195 delivered execution semantics below; planning is the missing middle. Unlocks: run creation that cannot contradict approved truth; non-trivial decomposition (multiple slices per scope, meaningful epics) that finally exercises PR #325's parallel/fan-in/epic semantics.
- **Ownership model (deterministic boundaries around a non-deterministic core):** elicitation decides commitments (stack, framework, package manager, deployment, quality obligations) and authors argv-only `execute.*` recipes; repository detection reports evidence and never authorizes commands or overrides approved commitments; the planner synthesizes and lowers; deterministic validation judges; bounded repair corrects or rejects with exact findings; the executor enforces only the admitted frozen plan. There is no built-in ecosystem catalogue or ambient/default command provider: the sole production provider is derived from spec-authored recipes, and absent, malformed, or contradictory authored execution intent blocks rather than silently substituting an inferred/default harness.
- **Slices (same issue + branch; scope via `ln-scope`):**
  - **A — planning projection + execution contract:** bounded provenance-preserving planning projection (committed frontier/scope identity, linked requirements + criteria, requirement dependencies, technical-design nodes, relevant decisions/constraints incl. implementation-stack/environment/delivery commitments, verification obligations, greenfield/brownfield mode, detected repository facts) — today the snapshot's `context` block (decisions/constraints/design/oracle) is projected then dropped by the outline; typed candidate/admitted plan contract (plan + source provenance, executable epics with integration boundaries, one-or-more slices per scope, explicit deps/ordering, worker goals + done criteria, epic verification intent, plan-owned execution contract distinguishing requiredCapabilities / detectedCapabilities / resolvedActions); command safety through typed product-owned capability providers and action resolvers (model selects/composes supported intents; deterministic code resolves what may run; unknown capabilities produce actionable blocks, never guessed commands; per-scope/per-epic capability sets for polyglot workspaces); remove or constrain the foreground `verifyProfile` enum (`execute-run-create`'s `default|npm_test` + `executor.md` prose heuristic + `test-runner-port.ts` hardcoded `npm run verify` fallback) so run creation consumes admitted plan truth only.
  - **B — LLM plan synthesis, deterministic validation, bounded repair:** planner behind a sealed app/agent port (`PlannerPort` in `ExecutionPorts`, mirroring `AgentRunnerPort`'s untyped-runtime pattern; implementation over the sealed subagent substrate in `src/app/`; no model SDKs, graph mutation, or unrestricted subprocess in `src/executor/` — `boundaries.test.ts` enforced); synthesizes meaningful epics/slices/dependencies/worker briefs/verification gates; total pure validation (every slice in exactly one epic + one committed scope; scope-obligation coverage; acyclic valid-id deps; ordering compatibility; criteria/verification preservation; design/decision/constraint provenance retention; capability/action compatibility with approved commitments and detected facts; polyglot boundary correctness; PR-#325-executable epic gates; no gate bypass; unsafe command/profile rejection; malformed output fails closed); bounded repair fed exact findings, then revalidate; admit or block with persisted findings/repair history — no silent trivial-plan fallback (an explicit deterministic fallback is admissible only if contract-stated and obligation-preserving).
  - **C — PR #325 composition witness:** one admitted synthesized plan through the frozen topology — overlapping dependency-independent isolated slices, ordered fan-in, planner-driven epic verification, failed slice/epic verification blocking completion/promotion, promoted output conforming to approved implementation/execution commitments; one live Specify → committed scope → synthesized/admitted plan → PR #325 execution → promotion witness recorded with graph/plan/brief/verification/run evidence.
- **Verification:** nine contrastive oracles fixed at admission — (1) greenfield capability derivation from approved truth with contradictory-profile rejection before worker launch; (2) a second materially different elicited capability set resolving a different provider/action set without schema change and without ambient-default leakage; (3) brownfield agreement reusing detected workspace/package-manager/test-runner conventions; (4) brownfield conflict blocking actionably with neither side silently overridden; (5) polyglot/multi-package resolution at the correct scope/epic boundary with explicit shared integration verification; (6) context preservation — a rival implementation that drops an elicited stack commitment or assurance node must fail; (7) invalid model plans (dependency cycles, missing scope coverage, invalid ids, incompatible profile) rejected by the validator, then boundedly repaired or explicitly blocked; (8) PR #325 execution of a valid plan exercising parallel isolation, ordered fan-in, epic gating; (9) the live composition witness. Deterministic tests first; fixture-backed or live witness for composition.
- **Prior art (selective port only — old `main` `src/orchestrator/src/plan-{projection,architect,contract,emitter,reconciliation}.ts`, `project-profile.ts`):** port `checkPlan`'s total/pure producer-agnostic predicate with typed severity findings; the single shared cycle policy between detection and repair; the mechanical-class vs design-class repair split (never auto-rewrite ownership/decomposition); coverage-by-provenance (requirementIds/covered/nonBuildable); typed repair/warning records; loud detection failure. Repudiate: the silent trivial-plan fallback (incl. the vacuous-coverage all-non-buildable empty plan); the absent LLM repair loop; the closed six-ecosystem `ProfileId` catalogue as planning truth; absent-profile → bun defaulting; file-write conflicts as shippable warnings; criteria stringified into prose; discarded `derivedFrom` provenance; dual reconcile/repair transformers.
- **Explicitly out:** external Petrinaut HTTP interop beyond the existing observer/live-stream contract; split-process execution authority; richer browser authoring or side chats; post-execution semantic spec-to-code drift detection; generic human halt/replan/resume UX; reimplementing PR #325 isolation/concurrency/fan-in/attempt-authority/epic-lifecycle semantics (the planner targets them, never re-owns them). The executor/Pi integration follow-up renamed the machine-owned plan artifact to `plan.json` and added the durable `brunch/review/<runId>` promotion ref without changing explicit host-apply acceptance.
- **Slice A landed (2026-07-13, D130-L; author-first correction 2026-07-14):** the plan artifact carries the typed execution contract (planning projection incl. constraint/invariant/decision commitments; recipe-resolved actions; evidence-only detected facts; blocked/conflict findings), `execute_plan_file` rejects absent or malformed authored verification before writing, and `execute_run_create` admits or rejects the frozen contract before any run artifact. The npm built-in/default and test-runner command-specific handling are removed.
- **Slice B landed (2026-07-13):** model-authored `CandidatePlan` (schema with no command surface), fail-closed parse, total pure validation (membership, scope-obligation coverage, provenance retention, shared-cycle-policy dependency checks, capability support/conflict), executor-owned bounded repair loop with findings history and no fallback plan on any path, `PlannerPort` over the sealed planner subagent, and `execute_plan_file` synthesis with explicit labeled planner-unavailable fallback (invalid candidates always block). Commits `ce93d8b2`/`b54c4321`.
- **Slice C fixture witness landed (2026-07-13; model-seam strengthening 2026-07-14):** `plan-synthesis-composition.test.ts` drives an admitted synthesized plan through the frozen topology under `petriScheduler` + `frontierFiringPolicy` — the real sealed `PlannerPort` adapter receives Pi model context and a scripted planner response, then overlapping dependency-independent isolated slices (barrier witness), ordered fan-in, epic integration/verification, promotion preparation, contract-only verify commands on every slice/epic invocation, and the failed-verification gate (oracle 8). This is deterministic model-seam coverage, not the still-open live-provider witness.
- **Spec-commanded recipe (2026-07-14):** the elicitor captures the canonical settled `oracle/vv_method` `Project execution harness` with `execute.setup|build|verify: <command>` lines; a generic extractor turns authored recipe commitments into the sole production recipe provider plus spec-mandated base requirements the planner cannot drop (argv-only, shell operators fail closed as `malformed_recipe`). Workspace detection remains provenance-only. The planner subagent registry omission that blocked the first live witness is fixed.
- **Live walkthrough (2026-07-14, rust-todo-cli workbench):** a five-run arc reached the first fully green pass — synthesized plan (3 epics / 4 slices) → real workers → spec-commanded `cargo test -- --test-threads=1` green at every slice gate → ordered integration → `promotion_prepared` (`run-mrkko0ld`), with every failure fixed in the spec (recipe added, `--test-threads=1`, dependency edges, `.gitignore` requirement) and recompiled. The two planner-loop blocks it exposed are fixed deterministically: verification citations are legal and lowerable from the projection-visible set (scope anchors ∪ V&V commitments), and blank `scopeId` normalizes to no-scope. Runtime defects moved to the executor/Pi integration follow-up.
- **Planner hardening (2026-07-16):** the Rust Todo CLI silent malformed-candidate witness now has a schema-backed, exactly-once `submit_candidate_plan` child-session output contract instead of outermost-JSON text recovery; every planner round emits lifecycle-only foreground progress and has a 120-second aborting deadline that blocks as `planner_timeout` without starting another round. The packaged runtime now includes `planner.md`.
- **Ordering compatibility (FE-1428):** `validateCandidatePlan` now rejects LLM candidate slice DAGs that do not honor projected `requirement.dependsOn` (`requirement_dependency_unhonored`); outline lowering already did. The Wisp seed schedules the shared shell as predecessor of sender/recipient UI requirements.
- **Open acceptance:** oracle 9's tail — the walkthrough stopped at `promotion_prepared` because host promotion carries no source for an `empty_dir` run on a non-git host (the fix is owned by `host-landing`/FE-1201 since 2026-07-14; the conforming-promotion witness stays owned here) — plus a live run through the committed-scope path (the walkthrough spec lowered from bare requirements) and live-capability oracles 1–5 on real elicited specs; requires a model-backed session per `docs/praxis/manual-testing.md`. Re-entry trigger: next live FE-1197 walkthrough. All scope files consumed.
- **Traceability:** D126-L (scope = elicitation-owned committed handoff; executor lowers only committed scopes), D111-L/D112-L/I58-L (executor purity over injected ports), D127-L/D128-L/D129-L (FE-1195 authority + canonical execution model), D103-L (runtime slice stays executor-derived), D98-L (executor owns execution/scope concerns); FE-1166 card residue + run `run-mrbyf8u9`; the 2026-07-13 wrong-stack greenfield run; `src/executor/TOPOLOGY.md`; old-`main` planner modules as named prior art.

### host-landing

- **Name:** Mode-aware host landing of promoted runs
- **Linear:** [FE-1201](https://linear.app/hash/issue/FE-1201/mode-aware-host-landing-of-promoted-runs)
- **Kind:** structural — replaces the host-promotion lifecycle seam and its port/tool surface
- **Certainty:** proving
- **Status:** branch-complete (code) — tracer + full cutover landed 2026-07-14 (`448f0f56` on `ka/fe-1201-host-landing`): durable `runBaseSha` recorded for both substrates, `promotion.ts` promotes against it (clean integrated runs promote; `promotionBaseSha` deleted), slice-integration/promotion commits exclude `.brunch`, and `GitHostLandPort` (`inspect`/`integrate`/`materialize`, adapter `src/app/git-host-land-port.ts`) passes the multi-commit contrastive oracle in both modes. Slice 2 (cutover, four cards, `19c575e4`..`273ca5e8`) landed the same day: `landing.ts` preflight/apply + terminal `landed` lifecycle; `/brunch:land` (preflight → read-only full-range/target/conflict inspection → `ctx.ui.confirm` → apply) as the sole host-mutation path with read-only `execute_land_preflight`; deletion of `host-promotion.ts`, `git-host-promotion-port.ts`, both `execute_host_promotion_*` tools, and `acceptedCommitSha`; mode-derived substrate (tool inputs deleted); `GitLandPort` → `GitRunPromotionPort`. Claims 1–2 witnessed by the contrastive oracle; claim 3's wiring half witnessed by stubbed-ctx command tests. Review hardening landed 2026-07-15 (consumed scope card `host-landing--review-hardening`): failed materialization restores the verified-empty target so retries land; host git failures classify as `failed`, not refusals; landed-lifecycle oracles added (including a fix — re-driving a landed run now reports `runStatus: 'landed'` instead of the journal-frozen `promotion_prepared`); promotion-report field `land` → `promotion`; `/brunch:land` notices carry command copy without the tool label; confirmation now names the complete commit/file range, target classification, and read-only conflict rehearsal. SPEC reconciled 2026-07-15 (`ln-sync`): I58-L/D111-L rewired to the landing seam, `Run promotion`/`Landing (host)` lexicon pins added, ln-design claims 1–2 validated-and-embedded, claim 3 recorded as A42-L. **Open before done:** the live TUI+RPC `/brunch:land` walkthrough beat (FE-1197 oracle 9 tail — re-entry: next live walkthrough; also A42-L's live half).
- **Objective:** Replace patch-apply host promotion with mode-aware landing per the 2026-07-14 `ln-design` synthesis. New `GitHostLandPort` (`src/app/git-host-land-port.ts`): `inspect` (read-only full-range `runBaseSha..reviewSha` commit/file evidence, target classification, merge-tree conflict rehearsal), `integrate` (brownfield: verbatim ff/merge of `brunch/review/<runId>` into a clean attached host branch; conflicts abort back to a pristine host; refuse staged/tracked-dirty, untracked coexist unless colliding), `materialize` (greenfield: tip tree → `git init -b main` + one clean brunch-authored initial commit into a missing or empty target; occupied targets refuse). Materializing into an existing repository is deliberately outside this frontier rather than an implied second mode. `src/executor/landing.ts` replaces `host-promotion.ts` with a pure strategy-selection core plus preflight/apply under run-execution authority. Durable `runBaseSha` recorded at worktree creation; `promotion.ts` promotes against it (clean integrated runs promote; `promotionBaseSha` deleted). `mode` becomes the sole authority; `substrate` is a derived record; the independent tool inputs die. Acceptance moves to a product-owned `/brunch:land` command (preflight → inspect → `ctx.ui.confirm` → apply in one invocation, handler-constructed bindings, drift refusal + git CAS); `execute_host_promotion_*` and `acceptedCommitSha` are deleted. Commit-time hygiene `git add -A -- . ':(exclude).brunch'` on slice-integration and promotion commits. Rename `GitLandPort` → `GitRunPromotionPort` (lexicon: "land" = host landing only).
- **Why now / unlocks:** the 2026-07-14 review proved a clean integrated run can land nothing while passing every test (the fixture had one commit above base — the missing multi-commit contrastive oracle). Unlocks FE-1197 oracle 9's conforming-promotion witness, truthful landing in both modes, and retirement of the agent SHA-echo acceptance channel.
- **Posture annotations:**
  - Lights up: the first true run→host landing path (review ref → host branch merge / materialized repository) in both modes.
  - Stabilizes: the landing seam (`GitHostLandPort` + `landing.ts`) that promotion UX and future remote/PR targets aim from; I58-L's host-mutation clause.
  - Retires: the three `ln-design` load-bearing claims — recorded 2026-07-15: (1) transport-free brownfield landing and (2) `runBaseSha..reviewSha` completeness validated by the contrastive oracle and embedded (D111-L, I58-L, `src/app/TOPOLOGY.md`); (3) Pi-confirm sole acceptance authority is SPEC A42-L, partially validated — its live half rides the walkthrough beat.
- **Acceptance:** a real multi-commit integrated run (≥2 slice-integration commits + optional final promotion commit) lands completely: brownfield host branch ff/merged with every slice's source, no `.brunch/**`, review ref intact, conflict variant leaves the host byte-identical; greenfield missing/empty target becomes a repository on `main` with one clean initial commit of the full tree; the confirmation shows complete range, target, and conflict-rehearsal evidence; host mutation is reachable only through `/brunch:land` confirmation; patch apply, `execute_host_promotion_*`, and the independent substrate input no longer exist.
- **Verification:** inner — the multi-commit contrastive oracle (real git; reddens the old `commitSha^` semantics by construction), read-only inspection/merge-tree tests, and pure strategy-selection unit tests; middle — executor lifecycle suites stay green (I58-L side-effect honesty: metadata unadvanced on refusal/conflict/failure) and command tests prove inspection precedes confirmation; outer — rust-todo-cli walkthrough tail past `promotion_prepared` into a fresh target (initial-release oracle 9).
- **Cross-cutting obligations:** discharged 2026-07-15 — I58-L host-mutation wording and D111-L port list amended, `src/executor/TOPOLOGY.md` reconciled at the cutover, ln-design claims recorded (A42-L + embedded claims 1–2), `HANDOFF.md` retired. Follow-up (not this frontier): source-copy one-authority fix — commit copied host source at `source_copied` so slices and the landing range share one baseline (2026-07-14 review finding 4's remainder; also listed in FE-1199's open residue as integration-worktree contamination).
- **Explicitly out:** materialization into an existing repository, squash/graft landing knobs (ceiling-marked), remote/PR targets, durable cross-session acceptance tokens, in-run remediation UX.
- **Traceability:** D111-L/I58-L (ports + explicit acceptance), D112-L (host landing stays outside the driven chain), FE-1197 oracle 9, FE-1199 residue transfer; prior art `main:src/orchestrator/src/promote-run.ts` (`promoteGreenfieldRun`/`landCookBranch`).
- **Design docs:** the 2026-07-14 `ln-design` four-design comparison (session record); the prior volatile `HANDOFF.md` was retired 2026-07-15 (`ln-sync`).
- **Current execution pointer:** none — both scope files consumed. Remaining work is the owned outer walkthrough beat and `ln-sync` reconciliation named in Status.

### automated-alpha-publishing

- **Name:** Automatic npm alpha publishing through reviewed release PRs
- **Linear:** [FE-1050](https://linear.app/hash/issue/FE-1050/set-up-automatic-npm-publishing-for-brunch-using-changesets)
- **Branch:** `ka/fe-1050-automatic-npm-publishing`, based on `next`
- **Kind:** release hardening over the proven single-package publish seam
- **Certainty:** earned
- **Status:** branch implementation complete and npm trusted publishing configured. PR #344 is stacked on the test-fixture repair in PR #347; merge the parent, restack this branch onto `next`, and re-confirm mergeability before landing. This infrastructure PR carries an empty Changeset and does not bump or publish the package. Its merge exercises Vault/App authentication before Changesets exits through its empty-intent path; the first subsequent package Changeset owns the reviewed version PR and full `1.0.0-alpha.6` publish canary.
- **Objective:** make one Changesets-owned `next` path carry release intent through a reviewed version PR into `@hashintel/brunch@alpha`, a protected Git tag, generated changelog, and GitHub Release, while retaining the installed-artifact/SQLite release-pack smoke.
- **Closes:** manual local npm authentication, hand-authored version commits/tags, and the split between an npm publish and absent GitHub release notes.
- **Locks in:** every ordinary pull request into `next` contributes either a releasing Changeset or an explicit empty Changeset, while the generated version PR is exempt; merging that version PR is the release approval; the publish command rejects local, wrong-repository, wrong-branch, and non-OIDC environments before doing release work; the accepted run uses npm OIDC, runs `check:release-pack` before `changeset publish`, advances only the npm `alpha` dist-tag, and creates source-linked provenance plus release artifacts from the same commit.
- **Acceptance:** Changesets remains in `alpha` prerelease mode from `1.0.0-alpha.5`; this infrastructure PR records explicit non-release intent without changing the package version; CI enforces explicit Changeset intent on ordinary `next` pull requests; the release workflow triggers only on `next`; a repository-scoped HASH worker token makes release PRs trigger normal CI and permits protected tag creation; protected-tag failure stops the release before GitHub can synthesize a tag from `main`; the first subsequent releasing Changeset publishes exactly `1.0.0-alpha.6`, leaves `latest` at `0.8.0`, and produces its changelog, native single-package `v1.0.0-alpha.6` tag, GitHub Release, and npm provenance.
- **Verification:** Changesets status reports no package bump for this PR; release-workflow contract tests and actionlint accept both workflows; `npm run check:release-pack`, `npm run check`, and `npm run build` pass locally; the parent repair and PR Full gate return green before merge; the empty-intent run authenticates through Vault/App and creates no version PR or publish; the first subsequent App-created version PR receives Test/Preflight, then its merge runs the release-pack smoke and npm/tag/release/install checks witness the canary.
- **Boundary:** `main` remains the stable `latest` channel. Stable automation, prerelease exit, and post-1.0 re-entry of `next` are a separate promotion frontier rather than a second path in this branch.

## Dependencies

```text
active:
  post-hardening-alpha-validation (FE-1348)
    classification: evidence-gated coverage frontier
    inventory: memory/cards/post-hardening-alpha-validation--usage-and-verification-sweep.md
    completed: A51-L colleague walkthrough -> shared-session-host-tracer ✓
    open: execute interaction
    built: cross-surface settlement (CS1 + SW2 + SW3 fixed and outer-witnessed through approval, receipt LSN 2, and one reload)
    includes: current alpha product entrances | current verification and installed-package paths
    excludes: provider campaigns | KA evidence | saved-mission/execution-comparison reruns | legacy migration | cross-platform claims | publish
    aggregate_done: every required row closed; every finding fixed/promoted/retired; canonical testing guidance reconciled
    relevant_rows: cross-surface settlement evidence complete -> shared-session-host-cutover contract outer-witnessed, cutover still unbuilt
  walkthrough-remediation-2 (FE-1187)
    closes_arc: deterministic-orientation
    blocked_reentry: extractor/oracle reconciliation -> fresh R8–R10 0/3 campaign -> A48-L -> consolidated outer checkpoint
    cross_stream: O7/O8/O9 + carved Execute beats stay KA-owned
next:
  cli-mode-entry
    lights_up: presentation-neutral Specify/Execute activation -> TUI | hosted web RPC
    unblocked_by: revised D98-L/D109-L entry semantics materialized
    -[hard]-> comparison-machine-interface-cutover
  comparison-machine-interface-cutover
    lights_up: hosted Brunch RPC + Claude stream-JSON control for nonvisual comparison conduct
    preserves: target isolation | immutable packets | transcript/intervention evidence | cleanup
    -[hard]-> saved-mission-comparison-witness
  saved-mission-comparison-witness
    gated_by: comparison-machine-interface-cutover | operator availability
    dependencies_satisfied: FE-1215 direct control | FE-1320 external target placement
  shared-session-host-cutover
    classification: FE-1348 CS1/SW2/SW3 repairs fixed and outer-witnessed; remaining cutover surface unbuilt
    closes: raw-event/driver divergence across legitimate TUI-owned and standalone-web runtime compositions
    deletes: SessionEventRelay | brunch.sessionEvent | /rpc/driver | sidecar handle wiring

parallel:
  capture-ledger-tracer
    depends_on: completed agent-control-plane-closure
    reuses: FE-1208 evaluator/report primitives | FE-1210 actor + split judgment

ka_evidence_queue:
  host-landing (FE-1201)
    oracle: live TUI+RPC /brunch:land -> fresh target (A42-L / FE-1197 oracle 9 landing leg)
    reentry: next live FE-1197 walkthrough
  executor-plan-synthesis (FE-1197)
    oracle: live-capability 1-5 + committed-scope conforming-promotion 9
    reentry: next model-backed FE-1197 walkthrough
  execution-comparison-tracer (FE-1230)
    oracle: unchanged petri-editor-browser-v2 replay against both retained outputs
    reentry: exact immutable attempt/output paths restored
  executor-plan-coherence (FE-1250)
    oracle: unchanged frozen Petri comparison + controller browser oracle
    reentry: explicit authorization
  executor-slice-verification-repair (FE-1254)
    oracle: owned unchanged Petri comparison rerun after finite repair ladder
    reentry: explicit authorization
  greenfield-secure-drop-demo (FE-1289)
    oracle: fresh full corrected Secure Drop graph/harness/build witness
    reentry: retained witness card on current runtime baseline

rules:
  candidates never commit graph truth (I51-L)
  topology files own current subtree state
  scratch evidence is not durable until promoted to .fixtures/runs/
  arcs close only after topology reconciliation and residue discharge
  deferred/design-question findings must name an owner (docs/praxis/manual-testing.md §Findings ledger discipline)
```
