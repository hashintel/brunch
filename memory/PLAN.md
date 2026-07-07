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

Brunch-next has delivered the original composition spine: the host, sealed Pi profile, transcript substrate, SQLite graph plane, public RPC, TUI/web observer shape, generalized capture, review-set commitment path, and public-entry ship gate all have evidence. The **elicitor-capability-spine** arc (`capture` / `generate` / `project`) is done for the current POC capability surface; elicitation/readiness truthfulness (graph-as-truth, session-local asking agenda, advisory settlement) was delivered by the closed **`elicitation-gap-guidance`** frontier. The retired strategy/lens/method runtime trees are no longer part of live product topology; capability work routes through the code-owned first-level skill manifest and activity-named skill homes.

**Ship gate (2026-07-03 grill).** The shippable cut is now explicit: working e2e flows and throughlines, clean simple invariants, complete contracts — minimal and pragmatic within those constraints, enhancements deferred. Five open frontiers compose the gate, across three arcs: `session-entry-orientation` + `execute-entry-readiness` (arc `deterministic-orientation`), `exchange-capture-contract` + `present-digest` (arc `capture-ingest-throughline`), and `exchange-answering-chrome` (closing the `exchange-presentation` arc — raw `ctx.ui.select` pickers do not ship). Everything else — `planning-process-model` (demoted from Next), `reconciliation-derivation`, `main-editor-chrome`, and the rest of Horizon — sits behind the gate. Settled during the grill: **two operational modes only** (no "Enhance" third mode — the D98-L reasoning holds; conduct bias is not runtime state); **concentric authority as a code contract** at the authority-matrix seam (bands stay heuristic); **generative flows offered at deterministic junctures** via a product-owned dialog, not model volition — the generative capability layer itself is already live (`propose`/`project` skills, FE-1059/FE-1085 evidence); the gate proves the *throughline through the affordances*, not new capability.

**Cross-cutting obligation (ship gate):** every gate frontier charts its decision flows — all paths and endpoints (outcomes, cancellations, request-changes chains, resumptions, escape/timeout defaults) — as a scoping deliverable at `ln-scope` time, in the scope card or a `docs/design/` doc if the chart outgrows the card. Charting is not a separate frontier.

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

### elicitor-capability-spine — ✓ done

- **Goal:** build `capture` / `generate` / `project` over the elicitor capability spine without reviving the retired `strategy` / `lens` / `method` runtime axes (A35-L), on top of the skill-substrate arc.
- **Members:**
  - `capture` ✓ done via generalized capture (D80-L–D82-L).
  - `generate` ✓ done through promoted real-model fan-out evidence (FE-1059): one plane-parameterized `generate-proposal` method, `present_candidates` unstubbed, fan-in as method conduct (`pick` / `synthesize` / `compose`), promoted I51-L no-write evidence.
  - `project` ✓ done via FE-1085: distinct first-level live `project` guidance derives downstream plane material from accepted graph anchors over existing exchange and review-set seams (D100-L).
  - `acquire` rides the completed subagent-reconciliation substrate (A34-L), not its own frontier.
- **Done-definition:** all three capabilities have live non-stub homes/evidence appropriate to their seam: `capture` and `generate` carry promoted model/runtime evidence; `project` is prompt-resource guidance only, witnessed through the live manifest/prompt path because FE-1085 adds no product tool or schema seam.
- **Anchors:** D95-L, D96-L; A31-L–A35-L; I51-L.

### exchange-presentation — ◐ active

- **Goal:** lock down every user-facing surface of the structured-exchange family — persisted transcript renders, live TUI answer collection, and their dev-preview loop — so exchanges read as designed product, not raw scaffolding.
- **Members:**
  - `exchange-rendering` ✓ done (2026-07-03) — transcript render surfaces: content formatters, Markdown pass-through render (D104-L), preview fixtures, render-honesty oracles, family-completeness aggregate DoD. Closed on its own terms; `present_digest` extends the family inventory from the `capture-ingest-throughline` arc, not by reopening this member.
  - `exchange-answering-chrome` (né `bordered-chrome-production`) — live answering UI: bordered picker/dialog replacements for the `ctx.ui.select`/`ctx.ui.editor` answering paths. **Inside the ship gate.**
- **Done-definition:** every exchange kind in the closed inventory renders honestly in transcript and re-render; live single-choice answering no longer routes through pi's plain `ctx.ui.select`; each renderer has a `dev:components` preview entry; `src/.pi/extensions/exchanges/TOPOLOGY.md`, `src/projections/TOPOLOGY.md` shape ledger, and `src/.pi/components/TOPOLOGY.md` reconciled; the formatter-home decision recorded in `memory/SPEC.md` (done: D104-L/D108-L).
- **Anchors:** D37-L, D38-L, D41-L (exchange schema/UI seam); D52-L, D60-L, D75-L (projection pipeline); TESTING_FINDINGS.md F7/F8/F11.


### capture-ingest-throughline — ◐ active

- **Goal:** resolve and prove how general capture/ingest works, end to end — the 2026-07-03 grill's center of gravity. Three throughlines with evidence:
  1. free user input → per-turn banded sweep (watermark-shaped window, D80-L conduct) → graph under the D81-L confidence gradient;
  2. any exchange tuple → outcome-correct sweep read (accepted / cancelled / rejected / request-changes-superseded chains);
  3. large source material → digest exchange → accept → map with correct settlement (advisory per `src/agents/references/readiness-bands.md` §Arbitrary Source Capture) → honest `mutate_graph` receipt (already carried by `formatMutateGraphResult` + own-mutation watermark stamp).
- **Members:**
  - `exchange-capture-contract` ✓ done — the full contract sweep ledger: outcome-interpretation invariants as conduct + probes over settled deterministic seams.
  - `present-digest` (new, below) — the digest exchange kind end to end; proves throughline 3; stacks on the contract.
- **Done-definition:** all three throughlines witnessed on live seams (not harness-injected paths); I57-L's generalized supersession invariant — *for any superseding proposal chain (review set, candidates, digest), sweep/projection consume only the accepted terminal payload; a cancelled chain contributes no offer payload* — probed per chain kind; the `DIGEST_CUSTOM_TYPES` special case in `src/projections/session/sweep-watermark.ts` retired; co-located topology homes (`src/exchanges/TOPOLOGY.md`, `src/projections/TOPOLOGY.md`, ingest/map skill guidance) reconciled.
- **Anchors:** D80-L–D82-L (capture conduct + gradient), D28-L (supersession), D50-L/I33-L (`capture_*` reserved for pre-persistence analysis — *not* receipts), D101-L (one-carrier scratchpad), D106-L (self-contained option echo), D107-L (proposed-code fidelity), D108-L (`src/exchanges/` consolidation).

### capture-ingest-throughline — ◐ active

- **Goal:** resolve and prove how general capture/ingest works, end to end — the 2026-07-03 grill's center of gravity. Three throughlines with evidence:
  1. free user input → per-turn banded sweep (watermark-shaped window, D80-L conduct) → graph under the D81-L confidence gradient;
  2. any exchange tuple → outcome-correct sweep read (accepted / cancelled / rejected / request-changes-superseded chains);
  3. large source material → digest exchange → accept → map with correct settlement (advisory per `src/agents/references/readiness-bands.md` §Arbitrary Source Capture) → honest `mutate_graph` receipt (already carried by `formatMutateGraphResult` + own-mutation watermark stamp).
- **Members:**
  - `exchange-capture-contract` ✓ done — the full contract sweep ledger: outcome-interpretation invariants as conduct + probes over settled deterministic seams.
  - `present-digest` (new, below) — the digest exchange kind end to end; proves throughline 3; stacks on the contract.
- **Done-definition:** all three throughlines witnessed on live seams (not harness-injected paths); I57-L's generalized supersession invariant — *for any superseding proposal chain (review set, candidates, digest), sweep/projection consume only the accepted terminal payload; a cancelled chain contributes no offer payload* — probed per chain kind; the `DIGEST_CUSTOM_TYPES` special case in `src/projections/session/sweep-watermark.ts` retired; co-located topology homes (`src/exchanges/TOPOLOGY.md`, `src/projections/TOPOLOGY.md`, ingest/map skill guidance) reconciled.
- **Anchors:** D80-L–D82-L (capture conduct + gradient), D28-L (supersession), D50-L/I33-L (`capture_*` reserved for pre-persistence analysis — *not* receipts), D101-L (one-carrier scratchpad), D106-L (self-contained option echo), D107-L (proposed-code fidelity), D108-L (`src/exchanges/` consolidation).

### deterministic-orientation — ◐ active

- **Goal:** users choose how to operate at every settle-point, deterministically — no model volition, no mode ping-pong. The mechanism (settled 2026-07-03): product-owned `ctx.ui.select` dialogs record `brunch.session_orientation` entries that feed kick composition. Entry boot rides the Brunch orientation extension's `session_start(startup)` handler because Pi binds extension UI before emitting that event; mid-session junctures use Pi events/commands (`session_start` for post-switch `new`/`resume`, `session_tree`, detectable abort settle, mode switch, `/consult`) where the UI exists. No-UI print/json modes synthesize no orientation entry and follow the default kick path. Mid-session discretionary consults stay ordinary exchange tuples; `/consult` forces the dialog. Two modes only (SPEC/CODE, D98-L); concentric authority becomes a code contract; generative flows are menu-routed to the existing `propose`/`project`/`elicit`/`ingest` skills.
- **Members:**
  - `session-entry-orientation` (superseded in place, below) — the dialog mechanism + all junctures + the SPEC-mode menu. ◐ inner-loop closed; outer walkthrough evidence for generative menu options pending.
  - `execute-entry-readiness` (below) — the CODE-mode entry assessment + concentric authority widening. ◐ branch tied off 2026-07-06 (PR submitted); outer walkthrough evidence deferred to a continued walkthrough/testing branch stacked after the five open branches are re-braided.
- **Done-definition:** dialog fires on every named UI-capable juncture in TUI and RPC modes (extension-UI sub-protocol relay confirmed); escape/timeout resolves to the inert `dismissed` — entry recorded, no kick, so the menu is never a wall and esc always means "wait for me" (2026-07-06 revision, supersedes the earlier escape→`continue` mapping); no-UI modes leave no orientation trace; orientation entries are excluded from capture sweep (process state, not spec material) and readable by kick assembly; concentricity holds as an executable contract (executor tool + skill grants ⊇ elicitor's, write-execution tooling stays executor-only); **one witnessed e2e run per generative flow — intent, design, oracle, frontier-level plan — each entered through a deterministic juncture** (the ship gate's "all flows proven" obligation lives here); topology homes for `src/.pi/extensions/` and `src/agents/runtime/` reconciled.
- **Anchors:** D98-L (two modes, 1:1 mode↔agent), D37-L (offer-owns-response grammar — the dialog lives on the product side of it), D40-L (authority matrix), D74-L (capability-readiness), D101-L/D102-L (session seed facts); `src/agents/references/readiness-bands.md` §Agent Use (the Proceed/Negotiate/Ask postures both foreground roles share).

## Sequencing

### Active

- `walkthrough-batch-2` (FE-1124) — continued doctor-pass scenarios (those not blocked on exchange-rendering) + fixture/seed preparation and generative-scenario variation sets (seed-variation worklist: TESTING_PLAN.md scenario 2). Branch `ln/fe-1124-walkthrough-batch-2` is the planning/seed base for the sibling ship-gate lanes. Findings ledger: `TESTING_FINDINGS.md`. Beat-5 findings F16/F17 spawned `session-entry-orientation`; its generative-option verification now has the propose/project variants and still needs live walkthrough evidence. Current execution pointer: `memory/cards/walkthrough-batch-2--seed-variants.md` (Card 3 remains: review variants).
- `walkthrough-fixes` (FE-1122) — **built 2026-07-02** (all cards incl. F10 addendum; commits `e0701b4`…`486824b` on `ln/fe-1122-walkthrough-fixes`); pending PR tie-off. Walkthrough continues on a stacked follow-on branch.
- `orchestrator-tool-port` (FE-1107) — **D98-sensitive proving frontier, intentionally deferred.** Parked on its own branch while the remaining SPEC-mode frontiers are clarified first.

### Recently Completed

- 2026-07-03 `exchange-capture-contract` (FE-1135) — the outcome-capture contract sweep is closed for all required rows: model-facing ingest/elicit/map guidance now states the five governing invariants, focused probes pin request/choice/review outcome interpretation, sweep-window tests exclude `present_*`/reserved `capture_*` tool results, `session.submitExchangeResponse` approval transcript text states persisted `ref → code` results, and the no-forbidden-carrier audit guards against `capture_*` receipts, outcome-span annotations, and exchange-linkage provenance params. `present_digest` remains an explicit FE-1136 tripwire.
- 2026-07-03 `exchange-rendering` (FE-1123) — the structured-exchange transcript render frontier is closed: every ● row in its sweep ledger is built (ledger + closeout card consumed and deleted; full definition archived in docs/archive/PLAN_HISTORY.md); request-response discriminants now have per-formatter render-honesty coverage and `dev:components` preview entries; structural-illegal preview fixture no longer carries an invented schema tag; `src/.pi/extensions/__tests__/exchange-family-completeness.test.ts` is the executable aggregate DoD across registered tools, formatters, preview entries, and snapshots. `npm run verify` passed. Human outer oracles remain owed: walkthrough re-observation for `TESTING_PLAN.md` scenarios 3/5 and preview-gallery aesthetic review.
- 2026-07-01 `elicitation-gap-guidance` (FE-1116) — the spec-global persisted `elicitation_gaps` register and its count-based readiness scoring are retired; the asking agenda is now a session-local `brunch.elicitation_scratchpad` fold seeded from a thin graph-fact seed; `latestExpectedBand(kind)` is the single band scalar; and settlement (`advisory` | `settled`, orthogonal to `basis`) is materialized and command-enforced (D99-L, I52-L). Closure oracle: `src/graph/__tests__/elicitation-gap-guidance-closure.test.ts` grep-guards the retired names. All co-located `TOPOLOGY.md` homes named in `docs/archive/SESSION_LOCAL_ELICITATION_GAPS.md` are reconciled; that doc landed and is archived.
- Older completed frontiers (incl. the two 2026-07-01 `component-dx` slices): `docs/archive/PLAN_HISTORY.md`.

### Next (= the ship gate, lane-shaped)

- **Lane A — deterministic orientation:**
  1. `session-entry-orientation` ([FE-1134](https://linear.app/hash/issue/FE-1134/session-orientation-dialog-at-deterministic-junctures)) — active, inner-loop closed. The mechanism question is answered (deterministic product-owned dialog, not an exchange); all scoped product junctures/chrome slices are landed, including J5 mode-switch, the RPC timeout floor, and the automated boot/web-driver J1 degradation harnesses. Closeout also fixed the masked FE-1124 boot regressions: live junctures now deliver `brunch.context_seed` through Pi's live message surface before `brunch.kick`, and resume-debt skips boot infrastructure entries when finding unresolved user debt. The propose/project seed variants are now available; outstanding outer-loop walkthrough evidence for the generative menu options remains to be run. Arc: `deterministic-orientation`.
  2. `execute-entry-readiness` ([FE-1137](https://linear.app/hash/issue/FE-1137/executor-entry-readiness-and-concentric-authority)) — branch tied off 2026-07-06 (inner loop closed incl. the esc-inert/J5-race/exchange-terminate revision; PR submitted). Outer walkthrough evidence (thin/rich seed assessment, menu→conduct routing) deferred to a continued walkthrough/testing branch stacked after the five open branches are re-braided; frontier closes when that evidence lands. Arc: `deterministic-orientation`.
- **Lane B — capture/ingest:**
  1. `exchange-capture-contract` ([FE-1135](https://linear.app/hash/issue/FE-1135/exchange-outcome-capture-contract-sweep)) — ✓ done 2026-07-03. The invariant layer everything else cites: the full contract sweep ledger over exchange outcomes. Arc: `capture-ingest-throughline`.
  2. `present-digest` ([FE-1136](https://linear.app/hash/issue/FE-1136/present-digest-exchange-for-large-source-ingest)) — stacks on `exchange-capture-contract`. Arc: `capture-ingest-throughline`.
- **Lane C — exchange presentation:**
  1. `exchange-answering-chrome` ([FE-1138](https://linear.app/hash/issue/FE-1138/bordered-answering-chrome-for-structured-exchanges)) — independent of Lanes A/B and can proceed in parallel when capacity allows. Arc: `exchange-presentation`.

### Parallel / Low-Conflict

- `component-dx` (FE-1115) — **paused.** Preview harness plus shared presentation primitives shipped; open for further dev-tooling refinement if a concrete need surfaces, but nothing is actively scoped. Production-wiring follow-on split to `exchange-answering-chrome` (né `bordered-chrome-production`) and `main-editor-chrome`.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

- `planning-process-model` — **demoted from Next #1 on 2026-07-03 (grill):** exploratory D103-L bet-proving, not ship-blocking. Behind the gate. Guard: the orientation menus' "project a plan" option routes to the existing `project`/`map-plans` seam at frontier-level depth (D103-L boundary) and must **not** pull this frontier forward. Groundwork stays parked on `ln/fe-xxx-plan-plane-redesign`; full definition below.
- `main-editor-chrome` — wire `BrunchEditorComponent` as the persistent input editor via `ctx.ui.setEditorComponent` (D22-L/D35-L chrome territory). Split out of the former `bordered-chrome-production` on 2026-07-02 because it is not exchange work; carries the unverified render-height assumption its first tracer must resolve (see `exchange-answering-chrome` rename note).
- `reconciliation-derivation` — derive `edge_revalidation` reconciliation needs from LSN comparison instead of persisting them; full definition below (inventory findings from 2026-07-02, worth keeping). **Confirmed behind the gate 2026-07-03 (grill G7):** the ingest throughline's conflict routing rides the existing persisted `reconciliation_need` substrate (`create_reconciliation_need` is live); nothing in the gate needs the LSN-derived generator. Honor the convergence: `walkthrough-batch-2` fixture prep still captures the `contradictory` seed variant.
- `reviewer-agent-mode` — D29-L's async advisory reviewer remains designed but unbuilt: narrow write authority to `reconciliation_need`, batch-acceptance trigger keyed by session/batch entry, A16-L trigger/scope questions still open. Behind the ship gate; no frontier until post-acceptance review becomes POC-blocking or reviewer residues need executable closure.
- `session-branching` — support session branching (D24-L reversal); needs branch-aware continuity/coherence design (A37-L).
- `compaction-and-conflict-widening` — long-horizon continuity through compaction.
- `fixture-vs-real-audit` — `ln-induct` candidate for real-vs-fixture shape gaps (tool ids, orphan tool results, provider payload assumptions).
- `web-driver-streaming` — remaining consumer/UI and non-freeform answer legs after the built topology-A relay battery.
- `flue-pattern-adoption` — post-POC harness-pattern adoption.
- `framework-direction-stubs` — discretionary structural stubs only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

### Retired / Never

- `coherence-first-class` — retired as an independent frontier; future coherence work should be driven only by a concrete triggering frontier that needs it.

## Frontier Definitions

### component-dx

- **Name:** Pi TUI component DX — preview harness, component refinement, and new components
- **Linear:** [FE-1115](https://linear.app/hash/issue/FE-1115/refine-pi-tui-component-dx-preview-harness-component-refinements-and)
- **Branch:** `ln/fe-1115-component-preview-dx`
- **Kind:** bounded feature / dev-DX + presentation-component work.
- **Status:** paused (2026-07-01). The preview harness plus three shared presentation primitives (`projectScrollViewport`, `.pi/components/mouse-wheel.ts`'s wheel decoder, `projectRoundedBox`) shipped, all either preview-harness-only or behavior-preserving refactors of an already-shipped component — zero production UX change. The next step (wiring `BrunchEditorComponent` into real production surfaces and rebuilding the `request_*` response components) is a genuine production UX decision, a different risk category from everything landed here, and has split into its own frontier: `bordered-chrome-production`. This frontier stays open for further preview-harness/dev-tooling refinement if a concrete product need surfaces, but nothing is actively scoped against it right now. Refinement/new-component slices may still use their own `memory/cards/component-dx--<slug>.md` card while in progress, retired once reconciled here plus the co-located `TOPOLOGY.md` homes.
- **Objective:** Give `.pi/components` authors a fast, faithful iteration loop, then use it to refine existing components and build new ones as product needs surface them.
- **Acceptance (first slice, done):**
  - `npm run dev:components` boots a real `ProcessTerminal` + `TUI`; no workspace, session, or DB is required. A `tsx watch`-backed variant was intentionally removed because `tsx watch` reruns on stdin bytes, which conflicts with `pi-tui` startup terminal-capability replies and creates a self-triggering reload loop.
  - A registry maps each previewable component to the same presentation contract its real call site uses (`ctx.ui.custom(factory, options)`): `{ overlay: true, overlayOptions }` for overlay components (workspace-dialog), no options for inline-swap components (axis-picker, multi-choice-picker) — not a uniform "always overlay" assumption.
  - A small `custom()` shim mirrors pi-coding-agent's real `showExtensionCustom` branching closely enough that nested overlays (a previewed component calling `tui.showOverlay` on the `tui` it's given) work without special-casing.
  - Theme is a real `Theme` instance (constructed via the public `Theme` class from `@earendil-works/pi-coding-agent`), not a duck-typed stand-in; it satisfies both `LabTheme` and `WorkspaceDialogTheme` call sites structurally.
- **Open (not yet scoped):** refine existing components' rendering/affordances/copy; build new `.pi/components` as needed. Both carried-forward findings from the first slice are resolved: the axis-picker harness/production presentation drift is fixed (harness now drives the picker via `tui.addChild`/`tui.setFocus`, matching production's inline swap), and the unwired `tui-lab` slash command (`registerBrunchTuiLab`) is retired — `TuiStyleLabComponent` now lives at `.pi/components/tui-lab/style-lab-component.ts` as a preview-harness-only reference component. The harness's lane coverage gap is also closed: `static-preview.ts` adds the transcript-message-renderer lane (`alternatives`, via a captured `registerBrunchAlternatives` renderer) and the persistent-chrome lane (`chrome-header`), alongside the original `ctx.ui.custom` lane. The footer lane (`ui.setFooter`) is deliberately deferred — driven by live session state, and rides the scope the user wants to refine later. A fourth, `[experimental]` entry (`brunch-editor`) previews the `ctx.ui.setEditorComponent` slot: `BrunchEditorComponent` wraps `CustomEditor` in a runtime-state-labeled bordered box (design exploration only, not yet wired into production chrome) — first of a planned family that also covers the `request_*` question-form pickers (`request_response` etc.) — that production wiring now lives in the `bordered-chrome-production` frontier, below, not here. A sibling primitive, `projectScrollViewport` (`.pi/components/scroll-viewport.ts`), landed for a converged scroll-viewport pattern (keyboard scroll, selection-follow windowing, a `▐`-in-border scroll thumb), confirmed against pi-tui's own `Editor`/`SelectList` windowing plus glyph/opentui/lazygit precedent, and wired into `WorkspaceDialogComponent`'s real unwindowed option-list gap (demoed via the `workspace-dialog-scroll` preview entry). Wheel-scroll passthrough is now implemented for that preview entry only: `showComponentPreview` can opt into SGR mouse enable/disable and translates recognized wheel events to ordinary arrow-key bytes via `.pi/components/mouse-wheel.ts`, leaving `WorkspaceDialogComponent`'s input API unchanged. Follow-ons remain: true pointer-hover hit-testing (scroll whatever's under the cursor, not just the focused component) is out of scope for a brunch component entirely — pi-tui has no per-render row→component ownership map, and building one is an upstream pi-tui change, not a component-dx slice; native-text-selection UX and session-scoped mouse-mode ownership are still production-design questions, not answered by this preview-only opt-in. A manual real-terminal smoke test still needs to confirm physical wheel emission matches the injected SGR shape proved in harness.
- **Traceability:** none required for the harness itself — dev tooling only. Component refinement/creation slices add SPEC links only if they change durable product boundaries. Extends the "Build/test convention" section of `src/.pi/components/TOPOLOGY.md` and the "Launcher Surface" section of `src/dev/TOPOLOGY.md`.

<!-- exchange-rendering (FE-1123) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D104-L, D108-L, exchange-family-completeness.test.ts, src/exchanges/TOPOLOGY.md. -->

### exchange-answering-chrome

- **Name:** Bordered Brunch-owned answering UI for the `request_*` response kinds
- **Linear:** [FE-1138](https://linear.app/hash/issue/FE-1138/bordered-answering-chrome-for-structured-exchanges)
- **Branch:** `ln/fe-1138-answering-chrome`
- **Kind:** bounded feature / presentation-layer production wiring. Arc: `exchange-presentation` (transcript-render counterpart: `exchange-rendering`; this frontier owns the live answering surfaces — pickers, one-shot answer dialog).
- **Renamed 2026-07-02:** was `bordered-chrome-production`. Its former thread 1 (persistent main editor via `ctx.ui.setEditorComponent`) is NOT exchange work and split out to `main-editor-chrome` (Horizon). Threads 2–3 below are the retained scope, folded into the `exchange-presentation` arc and sequenced directly behind `exchange-rendering`.
- **Status:** not started; split off `component-dx` (FE-1115) on 2026-07-01, once that frontier's harness + shared-primitive work (`projectRoundedBox`, `projectScrollViewport`) shipped with zero production behavior change. This is the first production UX change either primitive will drive.
- **Certainty:** proving.
- **Depends on:** `component-dx`'s shipped primitives (`.pi/components/rounded-box.ts`, `.pi/components/scroll-viewport.ts`) and `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md` (the answering-path mechanism this frontier's exchanges threads must not break).
- **Lights up:** the first Brunch-owned `.pi/components` wired into a real, live-user-facing surface rather than the preview harness or an already-shipped component's internals.
- **Objective:** Two threads (formerly threads 2–3 of `bordered-chrome-production`; the main-editor thread moved to `main-editor-chrome`, Horizon). `ctx.ui.setEditorComponent` and `ctx.ui.editor(...)` are two structurally distinct mechanisms in `pi-coding-agent` (the former replaces the persistent main chat input editor; the latter is `request_response`'s own one-shot free-text answer dialog, `ExtensionEditorComponent`, entirely unaffected by `setEditorComponent`), which is exactly why the main-editor work could split away cleanly:
  1. **`answer` (free-text) response kind**: give `request_response`'s `collectAnswerFromSources` path a Brunch-owned bordered component via `ctx.ui.custom` (not `setEditorComponent` — independent of thread 1), following `choices`'/`MultiChoicePickerComponent`'s proven `ctx.ui.custom` + `ctx.ui.editor`-fallback pattern; keep the existing `answerBroker` branch as a third fallback.
  2. **`choice` and review response kinds**: give `collectChoiceFromUi`/`collectReviewFromUi` the same `ctx.ui.custom`-backed bordered-picker treatment, reusing `projectRoundedBox` + `projectScrollViewport` — this retires the raw `ctx.ui.select` path behind walkthrough findings F8 (raw `**`, unnumbered, bare "Other"). Most ready-to-build of the two — `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`'s coverage matrix already proves this cannot regress `session.submitExchangeResponse` (Brunch's real RPC-driven answering path bypasses `ctx.ui.*` entirely, so it's unaffected by whichever UI mechanism the local-TUI path uses).
- **Acceptance:** to be defined per-thread when scoped; likely two separate `ln-design`/`ln-scope` passes given the differing risk profiles above, not one combined scope card.
- **Carried design question (2026-07-02, from `exchange-rendering`):** GitHub-style per-item review commentary — widening the review answered payload (`comments: [{on: draft|edge|set, body}]`) plus the collection UI to gather it. The payload half is a SPEC decision; the collection half belongs to this frontier's review-answering surface. Evaluate when scoping; transcript sketch in `src/agents/contexts/exchanges/design-permutations.md` §Review-set evaluation.
- **Verification:** answering-path non-regression contract test — `session.submitExchangeResponse` never touches `ctx.ui.*` (locks `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`); injected-key VirtualTerminal tests for the new pickers (workspace-dialog-scroll precedent); manual physical-terminal smoke carried from `component-dx`. See `memory/SPEC.md` §Design Notes "Exchange-presentation oracle design".
- **Traceability:** D22-L, D35-L (chrome, thread 1); D37-L, D38-L (structured-exchange UI seam, threads 2–3); `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`; `src/.pi/components/TOPOLOGY.md`, `src/.pi/extensions/chrome/TOPOLOGY.md`, `src/.pi/extensions/exchanges/TOPOLOGY.md`.

<!-- exchange-capture-contract (FE-1135) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: I57-L, the five governing invariants in the ingest/elicit/map conduct homes (pinned by
     src/probes/__tests__/exchange-capture-contract-proof.test.ts), sweep-window exclusions in
     sweep-watermark.test.ts, and the canonical formatMutateGraphResult approval receipt in
     session.submitExchangeResponse. Consumed sweep ledger deleted. -->

### present-digest

- **Name:** `present_digest` — the digest proposal exchange for large source material
- **Linear:** [FE-1136](https://linear.app/hash/issue/FE-1136/present-digest-exchange-for-large-source-ingest)
- **Branch:** `ln/fe-1136-present-digest` (stacks on `exchange-capture-contract`)
- **Kind:** bounded feature / new exchange kind end to end. Arc: `capture-ingest-throughline`.
- **Status:** not started; opened 2026-07-03 (grill Q3).
- **Certainty:** proving — new schema/tool seam; the payload shape (prose abstract + analysis/recommendation, **no graph material**) and the sweep-read semantics are designed but unwitnessed.
- **Shape (settled in the grill):** a digest is *not* a review-set-shaped proposal (a review set is entity drafts dry-run-validated against `CommandExecutor`, I20-L; a digest carries no graph payload). New `present_*` kind; terminal stays the **existing** review response kind (`approve | request_changes | reject`) — zero new response vocabulary; D28-L supersession applies to regeneration chains; projection to nodes/edges is a separate following step whose receipt is already honest (`formatMutateGraphResult`). The accepted terminal response **echoes the accepted abstract** (D106-L self-containment); the raw digested material stays a non-swept artifact; the `DIGEST_CUSTOM_TYPES` special case in `isSweepConversationalEntry` (`brunch.acquisition_digest` / `brunch.capture_digest` / `brunch.digest`) **retires** — one carrier for one fact, the same pattern D101-L enforced for gaps. (Named fallback if abstract size becomes real pressure: keep the custom entry sweepable and point at it — rejected by default as a two-carrier shape.)
- **Scope:** schema in `src/exchanges/schemas/` + detail projection; tool registration + elicitor grant; formatter (`src/agents/contexts/exchanges/`) + renderer (`src/.pi/extensions/exchanges/`) + `dev:components` preview entry + family-completeness row (extends `exchange-family-completeness.test.ts` — this is how the closed `exchange-rendering` inventory grows without reopening it); ingest-skill guidance update (`src/agents/skills/ingest/SKILL.md` digest step binds to the tool; bulk-acquisition path in `readiness-bands.md` cites the exchange); sweep-filter retirement + migration of the three custom types.
- **Decision-flow chart (cross-cutting obligation):** at scope time, chart the digest lifecycle — present → (accept → map | request-changes → regenerate (×N, superseding) | reject | cancel) — with the sweep consequence at each endpoint (accept: latest set only; cancel/reject: all entries from the exchange ignored; mapping: per-plane settlement status settled/advisory).
- **Depends on:** `exchange-capture-contract`'s landed governing invariants — cancel-demotes / reject-kills / accepted-terminal-only (I57-L + the ingest/elicit/map conduct homes; full definition in `docs/archive/PLAN_HISTORY.md`) — the digest's read rules are instances of them; D28-L, D104-L–D108-L; ingest skill (live).
- **Lights up:** throughline 3 of the arc — the "kick off a spec from a foreign SPEC.md / liftout analysis" ingest story with deterministic accept/ignore semantics.
- **Retires:** the unstructured digest custom-entry path (D82-L status quo) as a capture carrier; the sweep filter's digest special case.
- **Verification:** the `exchange-rendering` four-oracle compound extends to the new family member (content + render snapshots, render-honesty with elision list, family-completeness row, preview entry); supersession-chain probe (regenerate ×2 then accept → sweep reads only the accepted abstract); cancel-chain probe (nothing captured, scratchpad obligation optional); live walkthrough beat: paste a large document → digest → request changes → accept → map advisory.
- **Traceability:** D28-L, D82-L (superseded carrier), D104-L, D105-L, D106-L, D108-L, I20-L (why not review-set), I51-L (digest commits nothing); `src/exchanges/TOPOLOGY.md`, `src/projections/session/sweep-watermark.ts`, `src/agents/skills/ingest/SKILL.md`, `src/agents/references/readiness-bands.md` §Arbitrary Source Capture.


### session-entry-orientation

- **Name:** Session orientation dialog — entry chrome, re-entry assessment, and the deterministic process-move menu at every settle-point
- **Linear:** [FE-1134](https://linear.app/hash/issue/FE-1134/session-orientation-dialog-at-deterministic-junctures)
- **Branch:** `ln/fe-1134-session-orientation`
- **Kind:** bounded feature / kick-design + chrome + extension events; introduces the deterministic orientation-dialog seam. Arc: `deterministic-orientation`.
- **Status:** active, inner-loop closed; opened 2026-07-02 from walkthrough beat-5 findings; **superseded in place 2026-07-03 (grill)** — the mechanism question this frontier's first tracer was meant to answer ("deterministic kick chrome vs prompt-directed agent behavior") is decided: deterministic, product-owned. Card 1 is landed via option-2 J1 (`session_start(startup)` after UI binding); Card 2 is complete across J2/J3/J4/J5/J6 plus the RPC timeout floor; Cards 3–4 are landed; Card 5 verification closeout is landed. The post-review judo cleanup is also closed: scaffolding-only sanity calls, duplicate startup-header shapes, kick-copy boilerplate, silent mode-switch degradation, and invisible session-manager narrow failures are retired without changing juncture semantics. The closeout makes automated boot/web-driver harnesses explicitly degrade J1 when no UI exists and fixes the masked FE-1124 boot regressions: live seed delivery precedes live kick delivery, and resume-debt skips boot infrastructure entries when looking for unresolved user debt. Remaining outer-loop work is walkthrough evidence for the menu's propose/project options; `walkthrough-batch-2` now provides the discriminating seed variants.
- **Certainty:** mechanism `earned` (Pi affordances verified in docs: `ctx.ui.select` works in TUI + RPC via the extension-UI sub-protocol; `session_start` carries `reason: "startup" | "reload" | "new" | "resume" | "fork"`; `session_tree` fires after `/tree`; `pi.registerCommand` covers `/consult`); menu *content/conduct* still `proving` (which options at which junctures, threshold gating).
- **Source findings:** TESTING_FINDINGS.md F16 (no "where are we" orientation on resume), F17 (resume dives into elicitation instead of asking what to do), absorbing F13 (welcome block placement/styling), F14 (kick indicator salience), F15 option (a).
- **Why now / unlocks:** both MAJOR findings sit on the first thing every user experiences; the dialog is the user-facing surface of skill-manifest routing (TESTING_PLAN.md goal 6, scenario 7), and it is the juncture seam `execute-entry-readiness` stacks on.
- **Objective (three threads, thread 3 superseded):**
  1. **Deterministic entry chrome** (unchanged): welcome block as its own styled element after the header (F13); kick activity via `setWorkingMessage`/`setWorkingVisible` (F14); resume-variant state/status insertion (F16a); optionally the turn_end "Worked for Ns" global label (F15a).
  2. **Elicitor re-entry assessment** (unchanged): kick/persona guidance so re-entry opens with an *assessment* — graph summary, TODO forecast, teaching surface (F16b). Prompt shaping over existing seed facts (D101-L/D102-L), not new plumbing.
  3. **Orientation dialog (superseded shape):** a Brunch-owned orientation extension fires `ctx.ui.select` at the scoped junctures and records the outcome via `pi.appendEntry('brunch.session_orientation', { choice, trigger })` (dialog results do not enter the session log automatically); the entry feeds the next kick so no model turn is spent asking. TUI boot entry is handled by the extension `session_start(startup)` handler because Pi binds UI before emitting `session_start`; post-switch `session_start`, `session_tree`, abort settle (if detectable), mode-switch, and `/consult` use the same extension event/command home. SPEC-mode choice ids: `continue`, `elicit_decisions`, `elicit_examples`, `propose_intent`, `propose_design`, `propose_oracle`, `ingest`. Mid-session *discretionary* consults remain ordinary `present_question` tuples (D37-L grammar untouched); the mode-switch juncture is defined here but its CODE-side menu content belongs to `execute-entry-readiness`.
- **Pinned checks (from grill + scope adjudication):** escape/timeout on the dialog resolves to `continue` — the menu must never be a wall; no-UI print/json modes show no dialog and write no orientation entry; confirm Brunch's RPC client surface relays the extension-UI sub-protocol (Pi supports it; Brunch-side handling is a check, not a design question); `brunch.session_orientation` entries must be excluded from the capture sweep (they are process state — the existing custom-entry filter in `src/projections/session/sweep-watermark.ts` already excludes non-digest custom types; add the probe, not new mechanism); abort-settle rides `agent_end` only if the tail assistant stop reason makes genuine user aborts distinguishable from retryable compaction aborts.
- **Decision-flow chart (cross-cutting obligation):** at scope time, chart every juncture × outcome path — choice taken / escape / timeout / dialog-unavailable (print/json modes, `ctx.hasUI` false) — and each path's endpoint in kick composition.
- **Lights up:** the first user-*directed* skill routing; the juncture seam `execute-entry-readiness` extends.
- **Retires:** the "deterministic kick chrome vs prompt-directed agent behavior" open question (answered: deterministic); the F17 failure mode (model volition deciding whether to offer the choice).
- **Depends on:** F1 fix (landed, FE-1122); context-seed graph facts (D101-L/D102-L); Pi extension dialog + event surfaces (verified in `docs/extensions.md` / `docs/rpc.md` §Extension UI Protocol).
- **Blocked by (verification only, not build):** conduct verification for the generative menu options can now use `walkthrough-batch-2`'s `intent-settled` and `requirements-accepted` variants; elicit-path options remain verifiable on existing seeds.
- **Verification:** live walkthrough re-observation — cold-open and resume beats — plus captured `system-prompt.md`/`origination.md` debug oracles for kick composition; menu→conduct routing evidence via session JSONL skill `read` calls; injected-event extension tests for each juncture trigger; sweep-exclusion probe for the orientation entry.
- **Traceability:** D98-L (mode→role→prompt composition), D101-L/D102-L (session seed facts), D37-L (offer-owns-response grammar — dialog lives outside it, on the product side), D40-L (authority matrix, mode-switch juncture); TESTING_PLAN.md goal 6 + scenarios 1/2/7.

### execute-entry-readiness

- **Name:** Executor entry readiness — concentric authority as code contract + the CODE-mode assessment menu
- **Linear:** [FE-1137](https://linear.app/hash/issue/FE-1137/executor-entry-readiness-and-concentric-authority)
- **Branch:** `ln/fe-1137-executor-readiness` (stacks on `session-entry-orientation` — shares the dialog/juncture extension seam)
- **Kind:** structural — widens the D40-L authority matrix for CODE mode and adds the mode-switch entry behavior. Arc: `deterministic-orientation`.
- **Status:** active; inner-loop implementation is closed: card 1 materialized the concentric CODE authority matrix, card 2 landed the CODE-side orientation menu (J5 mode-switch kicks after every CODE dialog resolution), and card 3 added executor readiness/backfill conduct guidance. A follow-up judo-cleanup slice (2026-07-04, `b5ffb876`) collapsed the SPEC/CODE mode-switch paths into one table-driven juncture call — kick suppression is now the menu descriptor's `noKickChoice` (SPEC `continue`; CODE none), the separate `'always-kick'` juncture mode is retired, and readiness posture definitions are single-sourced in `readiness-bands.md` §Agent Use. A second revision (2026-07-06, `2753430a`, from walkthrough Beat 1's race finding) made escape/timeout resolve to the inert `dismissed` on every orientation menu (D109-L revision — no kick, no directive; supersedes the escape→`proceed` always-kick default), made mode switch abort any in-flight assistant turn before showing the J5 menu (with the J4 esc-abort juncture suppressed for that programmatic abort via a shared gate), and made cancelled `request_*` exchanges terminate the turn. Branch tied off 2026-07-06; remaining frontier work is outer walkthrough evidence for thin/rich seeds and menu→conduct routing, deferred to a continued walkthrough/testing branch stacked after the open branches are re-braided. Rejects the "Enhance" third-mode idea from the 2026-07-02 kickoff notes: conduct bias is not runtime state (the D98-L flattening argument applies with full force); "enhancer" = elicitor with a different opening move, which is kick posture + skill routing, not an agent.
- **Certainty:** proving — the executor-side conduct (readiness assessment quality, backfill UX) is unwitnessed; the authority widening itself is a bounded, near-`earned` matrix change.
- **Grounding:** concentricity is materialized as code contract — `EXECUTOR_ALLOWED_TOOL_NAMES` (`src/agents/runtime/executor/active-tools.ts`) is composed from the live elicitor allowlist plus executor-only `orchestrator_stub`, with the blocked-tool floor still applied. The CODE-side J5 switch records a `brunch.session_orientation` resolution and kicks the executor with a matching directive. Executor prompt/reference guidance now opens CODE mode with capability-readiness postures (Proceed / Proceed-advisory / Negotiate / Ask) from `src/agents/references/readiness-bands.md` §Agent Use; this frontier does not invent a new readiness model.
- **Objective (three threads):**
  1. **Concentric authority as code contract (grill G6a — fully concentric):** CODE-mode grants become a superset of SPEC-mode's — executor gains `present_*`/`request_response`, `mutate_graph`, scratchpad tools, and the elicitor skill set; enforced by a test-level invariant `EXECUTOR_ALLOWED_TOOL_NAMES ⊇ LIVE_ELICITOR_ALLOWED_TOOL_NAMES` (minus dev-only grants) plus the skill-manifest equivalent, in the existing authority-matrix test family (`agent-runtime-authority-matrix.test.ts`). Floor: write-execution tooling (`orchestrator_stub` successors) stays executor-only — later contains earlier, never the reverse. Bands themselves stay heuristic ("bands do not gate graph truth"); only *authority* hardens into contract. This is a D40-L SPEC decision + sealed-profile/authority-matrix test updates.
  2. **Mode-switch entry assessment:** on switch to CODE, the executor's kick opens with a readiness assessment over existing reads (bands, settlement, capability-readiness D74-L) and the orientation dialog offers five endpoints: `proceed` (escape/timeout default readiness assessment), `backfill` missing information via questions [Negotiate/Ask posture], `design_first` [propose/project:design], `oracle_first` [propose/project:oracle], and `project_plan` at frontier-level depth [existing `project`/`map-plans` seam, D103-L] — with the honest back-out at the far edge: execution beyond the stub states "not implemented yet" (`orchestrator_stub` is the truth boundary until `orchestrator-tool-port`).
  3. **Gentle-backfill conduct:** executor prompt guidance for agreeable capability-readiness — accept the user's requested move, then gather what it needs (scratchpad-obligation-driven questions) instead of relegating the user back to SPEC mode. No mode ping-pong (grill G6b rejected).
- **Decision-flow chart (cross-cutting obligation):** at scope time, chart mode-switch → assessment → (proceed | negotiate → questions → proceed | ask → backfill loop | offer design flows | project plan → stub boundary) — every endpoint named, including dialog-escape ("proceed" default) and the not-implemented back-out.
- **Depends on:** `session-entry-orientation` (dialog seam + juncture events); D98-L (two modes, 1:1), D40-L (matrix), D74-L (capability-readiness), D99-L/I52-L (settlement reads); `readiness-bands.md` postures.
- **Blocked by:** nothing hard; generative-option verification shares the `walkthrough-batch-2` seed-variant gate with `session-entry-orientation`.
- **Lights up:** CODE mode as a usable product surface pre-orchestration — assess, backfill, design, plan-project — and the arc's "one witnessed e2e run per generative flow" obligation for the design/oracle/plan flows entered via mode switch.
- **Retires:** the "Enhance mode / third agent" direction (recorded as rejected with rationale); the executor-as-dead-end walkthrough experience (scenario 7 probe).
- **Guards:** does not touch `orchestrator-tool-port`'s scope (cook tooling, sandboxes) — that frontier stays deferred; flow "project a plan" must not pull `planning-process-model` forward (frontier-level depth only).
- **Deferred decision (decide after practical testing):** orientation-choice *meaning and statefulness*. Scoping (2026-07-04) settled the CODE-side entry as Option A — escape/timeout defaulted to a new `proceed` id with an always-kick J5 — but the 2026-07-06 revision (`2753430a`) replaced the escape default on every menu with the inert `dismissed` (no kick; esc means "wait for me"), so a kick now only follows an explicit selection. Orientation entries stay one-shot kick-consumed directives (never standing style, per D98-L). Two questions are explicitly deferred until walkthrough evidence exists: (1) whether `continue`/`proceed` semantics are right — "no directed move / user keeps floor" vs "resume prior style" vs "assess and go"; (2) whether any orientation posture should become sticky session state (a D98-L-sensitive reversal — route through `ln-grill`/`ln-spec`, not a scope card). Walkthrough beats should capture evidence on both.
- **Current execution pointer:** none — the executor-entry 3-card scope, the 2-card judo cleanup scope, and the esc-inert/J5-race revision are consumed; branch tied off. Outer walkthrough evidence remains before frontier closeout, on the deferred continued-walkthrough branch.
- **Verification:** authority-matrix superset invariant test; sealed-profile test updates; live walkthrough mode-switch beats on thin vs rich seeds (assessment honesty: Ask on thin, Proceed on rich); menu→conduct routing evidence via session JSONL (same oracle family as `session-entry-orientation`).
- **Traceability:** D40-L, D74-L, D93-L, D98-L, D99-L/I52-L, D103-L (plan depth boundary); `src/agents/runtime/executor/active-tools.ts`, `src/agents/runtime/elicitor/active-tools.ts`, `src/agents/runtime/foreground-policy.ts`, `src/.pi/extensions/__tests__/agent-runtime-authority-matrix.test.ts`, `src/agents/references/readiness-bands.md`.

### walkthrough-fixes

- **Name:** Doctor-pass walkthrough fixes (batch 1)
- **Linear:** [FE-1122](https://linear.app/hash/issue/FE-1122/walkthrough-doctor-pass-fixes-kick-prompt-origination-record-kick)
- **Branch:** `ln/fe-1122-walkthrough-fixes` (stacked on `ln/fe-xxx-plan-plane-redesign` / PR #283)
- **Kind:** defect-closure batch inside settled seams, sourced from the 2026-07-02 TESTING_PLAN.md walkthrough.
- **Status:** built 2026-07-02 (all cards incl. F10 addendum); pending PR tie-off. Findings ledger: `TESTING_FINDINGS.md`. Walkthrough continues on the stacked batch-2 branch.
- **Certainty:** earned (settled seams; each card closes a named defect).
- **Objective:** Close the beat-1 walkthrough findings: kick turn must carry the composed foreground prompt (F1 — pi `triggerTurn` path bypasses `before_agent_start`); origination decision record written at decision time (F2); kick-time chrome (activity indicator F3, welcome intro F4, collapsed thinking F6); elicitor prompt refinements (concision F5, multi-select nudge F9, retired "ranked elicitation gaps" vocabulary).
- **Current execution pointer:** none — all cards consumed and deleted. Excluded/deferred: F7/F8 (`present_question`/`request_response` rendering refinements; landed via `exchange-rendering`).
- **Traceability:** D78-L, I46-L/I47-L (origination honesty); D98-L (mode→role→prompt); D101-L (retired gap vocabulary); D40-L (tool policy).

### orchestrator-tool-port

- **Name:** Port cook orchestration into CODE/executor tools
- **Linear:** [FE-1107](https://linear.app/hash/issue/FE-1107/port-cook-orchestration-into-codeexecutor-tools)
- **Branch:** tbd
- **Kind:** structural / execute-mode tool boundary
- **Status:** active but intentionally deferred; first tracer is scoped on its branch when we are ready to switch to the CODE-mode tool seam.
- **Certainty:** proving.
- **Current execution pointer:** `memory/cards/orchestrator-tool-port--plan-check-tool.md`.
- **Lights up:** executor-owned product tooling for cook-plan inspection.
- **Stabilizes:** D39-L sealed-profile discipline and D90-L-D93-L/I49-L code-owned authority for future write-capable cook tooling.
- **Objective:** Replace the old execute-mode standup stub direction with CODE/executor tooling by porting reusable `brunch cook` core logic into product-owned modules and exposing it through thin `.pi/extensions` adapters. D98-L changes the target agent from a separate no-write orchestrator to the Brunch-aware executor; the first read-only plan-check tool can still establish the tool seam, but the frontier must not preserve the old orchestrator/pi-coder split as product architecture.
- **Acceptance:**
  - First tracer replaces the old standup stub with a read-only `cook_plan_check` tool that validates a cook plan and returns typed plan shape/findings without creating a run sandbox.
  - Later `cook_run` tooling is bounded behind executor-owned sandbox/worktree machinery; write-capable worker sessions, if any, are code-owned child execution boundaries.
  - External `../brunch` CLI behavior is ported as reusable product core plus Pi adapter, not wrapped as a shell command.
- **Traceability:** D39-L, D40-L, D90-L, D91-L, D92-L, D93-L, D98-L / I49-L; `src/.pi/extensions/TOPOLOGY.md`.

<!-- elicitation-gap-guidance (FE-1116) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D99-L, D101-L, D102-L, I52-L, I56-L, closure oracle
     src/graph/__tests__/elicitation-gap-guidance-closure.test.ts, docs/archive/SESSION_LOCAL_ELICITATION_GAPS.md. -->

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
- **Convergence:** `walkthrough-batch-2` fixture prep — the planned `contradictory` seed variant exercises `semantic_conflict` (the table-backed kind), and an `advisory-pending`/staleness variant would give the derived `edge_revalidation` view a repeatable test state. `src/projections/graph/reconciliation-needs.ts` is still an intentional stub — do not build that projection before this frontier decides derived-vs-persisted shape.
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
    walkthrough-batch-2 (FE-1124)
      status: active planning/seed base for sibling ship-gate lanes
      feeds: -[verification seeds]-> session-entry-orientation, execute-entry-readiness (generative options)
             -[fixture variants]-> reconciliation-derivation (contradictory / advisory-pending, capture-only)
    walkthrough-fixes (FE-1122)
      status: built, pending PR tie-off
    orchestrator-tool-port (FE-1107)
      status: deferred / D98-sensitive
      depends_on: D39-L, D90-L, D91-L, D92-L, D93-L, I49-L, D98-L
      active_scope: memory/cards/orchestrator-tool-port--plan-check-tool.md
      note: execute-entry-readiness does NOT touch this scope; orchestrator_stub stays the truth boundary

  Next (ship gate):
    session-entry-orientation (FE-1134)
      arc: deterministic-orientation
      status: inner-loop closed (all cards + judo cleanup landed); outer walkthrough evidence pending
      branch: ln/fe-1134-session-orientation (sibling of FE-1135/FE-1138 atop FE-1124)
      depends_on: FE-1122 F1 fix (landed), D101-L/D102-L, pi extension dialog/event surfaces
      verification_gated_by: walkthrough-batch-2 seed variants -[optional]-> generative menu options only
    exchange-capture-contract (FE-1135)
      arc: capture-ingest-throughline
      status: done 2026-07-03; residuals (chain probe, present_digest tripwire) absorbed by FE-1136
      branch: ln/fe-1135-capture-contract
    present-digest
      arc: capture-ingest-throughline
      status: new 2026-07-03; proving
      depends_on: -[hard]-> exchange-capture-contract (invariants 1-3 are its read rules)
      extends: exchange-family-completeness inventory (exchange-rendering stays closed)
    execute-entry-readiness (FE-1137)
      arc: deterministic-orientation
      status: inner-loop closed 2026-07-04 (3 cards + judo cleanup); outer walkthrough evidence pending
      branch: ln/fe-1137-executor-readiness (stacks on ln/fe-1134-session-orientation)
      depends_on: -[hard]-> session-entry-orientation (dialog/juncture seam)
      guards: no orchestrator-tool-port scope; plan option stays at D103-L frontier depth
    exchange-answering-chrome (FE-1138)
      arc: exchange-presentation
      status: not started; sibling lane atop FE-1124; independent of orientation/capture lanes -[parallel-ok]->
      branch: ln/fe-1138-answering-chrome
      depends_on: component-dx primitives (shipped), STRUCTURED_EXCHANGE_ANSWERING_PATHS.md

  Parallel / Low-Conflict:
    component-dx (FE-1115) -[paused]-> exchange-answering-chrome

  Horizon (behind the gate):
    planning-process-model
      status: demoted 2026-07-03; orientation plan option must not pull it forward
    reconciliation-derivation
      status: confirmed behind gate 2026-07-03 (grill G7); ingest conflict routing rides the persisted substrate
    main-editor-chrome
    session-branching
    compaction-and-conflict-widening
    fixture-vs-real-audit
    web-driver-streaming
    flue-pattern-adoption
    framework-direction-stubs
    geolog-and-petri-execution

  Retired:
    coherence-first-class
    enhance-third-mode (rejected 2026-07-03, grill: conduct bias is not runtime state; D98-L reasoning holds)

done anchors:
  generalized-capture -> elicitor-generate, elicitor-project
  elicitor-generate -> elicitor-project
  elicitor-capability-spine (arc) -> deterministic-orientation menus route to its live skills
  exchange-rendering -> present-digest (family-completeness extension), exchange-answering-chrome
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
