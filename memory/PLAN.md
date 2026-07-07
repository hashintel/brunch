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

**Ship gate (2026-07-03 grill).** The shippable cut is now explicit: working e2e flows and throughlines, clean simple invariants, complete contracts — minimal and pragmatic within those constraints, enhancements deferred. Five frontiers composed the gate, across three arcs: `session-entry-orientation` + `execute-entry-readiness` (arc `deterministic-orientation` — inner loops closed, outer walkthrough evidence pending), `exchange-capture-contract` + `present-digest` (arc `capture-ingest-throughline` — **✓ both done, arc closed 2026-07-06**), and `exchange-answering-chrome` (arc `exchange-presentation` — **✓ done, arc closed 2026-07-06**; raw `ctx.ui.select` pickers do not ship, honored: raw select is retired outright). Everything else — `planning-process-model` (demoted from Next), `reconciliation-derivation`, `main-editor-chrome`, and the rest of Horizon — sits behind the gate. Settled during the grill: **two operational modes only** (no "Enhance" third mode — the D98-L reasoning holds; conduct bias is not runtime state); **concentric authority as a code contract** at the authority-matrix seam (bands stay heuristic); **generative flows offered at deterministic junctures** via a product-owned dialog, not model volition — the generative capability layer itself is already live (`propose`/`project` skills, FE-1059/FE-1085 evidence); the gate proves the *throughline through the affordances*, not new capability.

**Cross-cutting obligation (ship gate):** every gate frontier charts its decision flows — all paths and endpoints (outcomes, cancellations, request-changes chains, resumptions, escape/timeout defaults) — as a scoping deliverable at `ln-scope` time, in the scope card or a `docs/design/` doc if the chart outgrows the card. Charting is not a separate frontier.

**Parallel executor lane (landed on `next`, 2026-07-06).** A sibling lane (KA) landed the execute-mode run machinery before the current stack rebased onto it: FE-1089 (orchestrator cutover), FE-1109 (sandbox worktrees + test-runner ports), FE-1111 (sealed-worker agent runner), FE-1112 (run-local promotion), FE-1118 (host-promotion preflight/apply), FE-1125 (run driver). `src/executor/` is now a pure run-lifecycle core over injected `ExecutionPorts` (D111-L, D112-L, I58-L), exposed as executor-only `execute_*` tools. This substantially delivers what `orchestrator-tool-port` (FE-1107) was scoped to open — see its re-baselined entry below. The new `executor-run-observer` frontier builds the first web-facing read surface over that substrate.

**Alpha release lane (opened 2026-07-07).** Brunch ships as `@hashintel/brunch@1.0.0-alpha.x` from the `next` trunk. A same-day spike → grill → spec pass admitted `alpha-release-readiness` (FE-1159): two release-blocking packaging defects, a pinned model-allowlist policy (D113-L), Pi-auth-riding onboarding with `brunch login` (D114-L), and a no-auth upstream gate (D115-L). The KA-dependent plan decisions from the 2026-07-06 handoff (FE-1107 close-or-narrow, executor-card GC, walkthrough-evidence branch sequencing) remain deferred until the KA conversation happens.

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

- **Goal (met):** `capture` / `generate` / `project` built over the elicitor capability spine without reviving the retired `strategy` / `lens` / `method` runtime axes (A35-L); `acquire` rode the completed subagent-reconciliation substrate (A34-L), not its own frontier. Evidence: generalized capture (D80-L–D82-L), promoted real-model fan-out for `generate` (FE-1059, I51-L no-write evidence), prompt-resource `project` guidance (FE-1085, D100-L).
- **Anchors:** D95-L, D96-L; A31-L–A35-L; I51-L.

### exchange-presentation — ✓ done (2026-07-06)

- **Goal (met):** lock down every user-facing surface of the structured-exchange family — persisted transcript renders, live TUI answer collection, and their dev-preview loop — so exchanges read as designed product, not raw scaffolding.
- **Members:** `exchange-rendering` ✓ done 2026-07-03 · `exchange-answering-chrome` ✓ done 2026-07-06 (both threads built; physical-terminal smoke confirmed 2026-07-06, gallery + live session).
- **Done-definition held at closure:** every exchange kind in the closed inventory renders honestly in transcript and re-render; live local-TUI answer collection routes through Brunch-owned bordered chrome for all response kinds (raw `ctx.ui.select` retired outright; the sealed `ctx.ui.editor` survives only as the free-text fallback behind `ctx.ui.custom`); each renderer and live answering component has a `dev:components` preview entry; `src/.pi/extensions/exchanges/TOPOLOGY.md`, `src/exchanges/schemas/TOPOLOGY.md`, `src/projections/TOPOLOGY.md` shape ledger, and `src/.pi/components/TOPOLOGY.md` reconciled; formatter-home decision recorded (D104-L/D108-L). Post-gate residue deliberately deferred, not owed: per-item review commentary (see Horizon).
- **Anchors:** D37-L, D38-L, D41-L (exchange schema/UI seam); D52-L, D60-L, D75-L (projection pipeline); `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`; TESTING_FINDINGS.md F7/F8/F11.


### capture-ingest-throughline — ✓ done (2026-07-06)

- **Goal (met):** resolve and prove how general capture/ingest works, end to end — the 2026-07-03 grill's center of gravity. All three throughlines witnessed on live seams: (1) free input → banded sweep → D81-L gradient (capture-quality-loop probes); (2) exchange tuple → outcome-correct sweep read (`exchange-capture-contract`, FE-1135); (3) large source → digest exchange → accept → advisory map with honest `formatMutateGraphResult` receipt (`present-digest`, FE-1136, incl. the 2026-07-06 live walkthrough beat).
- **Members:** `exchange-capture-contract` ✓ done 2026-07-03 · `present-digest` ✓ done 2026-07-06.
- **Done-definition held at closure:** I57-L probed per chain kind (`present-digest-supersession-proof.test.ts` regeneration + cancel chains on the real `projectCaptureSweepWindow`, plus the product-minted RPC terminal witness); `DIGEST_CUSTOM_TYPES` retired from `src/projections/session/sweep-watermark.ts`; topology homes (`src/exchanges/TOPOLOGY.md`, `src/projections/TOPOLOGY.md`, ingest/map conduct homes) reconciled by the FE-1136 commits.
- **Anchors:** D80-L–D82-L, D28-L, D50-L/I33-L, D101-L, D106-L, D107-L, D108-L, D110-L; I57-L.

### deterministic-orientation — ◐ active

- **Goal:** users choose how to operate at every settle-point, deterministically — no model volition, no mode ping-pong. The mechanism (settled 2026-07-03): product-owned `ctx.ui.select` dialogs record `brunch.session_orientation` entries that feed kick composition. Entry boot rides the Brunch orientation extension's `session_start(startup)` handler because Pi binds extension UI before emitting that event; mid-session junctures use Pi events/commands (`session_start` for post-switch `new`/`resume`, `session_tree`, detectable abort settle, mode switch, `/consult`) where the UI exists. No-UI print/json modes synthesize no orientation entry and follow the default kick path. Mid-session discretionary consults stay ordinary exchange tuples; `/consult` forces the dialog. Two modes only (`specify` / Specify and `execute` / Execute, D98-L); concentric authority becomes a code contract; generative flows are menu-routed to the existing `propose`/`project`/`elicit`/`ingest` skills.
- **Members:**
  - `session-entry-orientation` (superseded in place, below) — the dialog mechanism + all junctures + the Specify-mode menu. ◐ inner-loop closed; outer walkthrough evidence for generative menu options pending.
  - `execute-entry-readiness` (below) — the Execute-mode entry assessment + concentric authority widening. ◐ branch tied off 2026-07-06 (PR submitted); outer walkthrough evidence deferred to a continued walkthrough/testing branch stacked after the five open branches are re-braided.
- **Done-definition:** dialog fires on every named UI-capable juncture in TUI and RPC modes (extension-UI sub-protocol relay confirmed); escape/timeout resolves to the inert `dismissed` — entry recorded, no kick, so the menu is never a wall and esc always means "wait for me" (2026-07-06 revision, supersedes the earlier escape→`continue` mapping); no-UI modes leave no orientation trace; orientation entries are excluded from capture sweep (process state, not spec material) and readable by kick assembly; concentricity holds as an executable contract (executor tool + skill grants ⊇ elicitor's, write-execution tooling stays executor-only); **one witnessed e2e run per generative flow — intent, design, oracle, frontier-level plan — each entered through a deterministic juncture** (the ship gate's "all flows proven" obligation lives here); topology homes for `src/.pi/extensions/` and `src/agents/runtime/` reconciled.
- **Anchors:** D98-L (two modes, 1:1 mode↔agent), D37-L (offer-owns-response grammar — the dialog lives on the product side of it), D40-L (authority matrix), D74-L (capability-readiness), D101-L/D102-L (session seed facts); `src/agents/references/readiness-bands.md` §Agent Use (the Proceed/Negotiate/Ask postures both foreground roles share).

## Sequencing

### Active

- `alpha-release-readiness` (FE-1159) — get the `1.0.0-alpha` line publishable and onboardable (packaging fixes, pinned model allowlist, Pi-auth ride + `brunch login`, no-auth gate). Admitted 2026-07-07 from spike + grill + spec (D113-L/D114-L/D115-L, req 29, A38-L, I59-L). Branch `ln/fe-1159-alpha-release` (renamed from `ln/fe-xxx-executor-wiring`). Definition below.
- `walkthrough-batch-2` (FE-1124) — continued doctor-pass scenarios (those not blocked on exchange-rendering) + fixture/seed preparation and generative-scenario variation sets (seed-variation worklist: TESTING_PLAN.md scenario 2). Branch `ln/fe-1124-walkthrough-batch-2` is the planning/seed base for the sibling ship-gate lanes. Findings ledger: `TESTING_FINDINGS.md`. Beat-5 findings F16/F17 spawned `session-entry-orientation`; its generative-option verification now has the propose/project variants and still needs live walkthrough evidence. Current execution pointer: `memory/cards/walkthrough-batch-2--seed-variants.md` (Card 3 remains: review variants).
- `walkthrough-fixes` (FE-1122) — **built 2026-07-02** (all cards incl. F10 addendum; commits `e0701b4`…`486824b` on `ln/fe-1122-walkthrough-fixes`); pending PR tie-off. Walkthrough continues on a stacked follow-on branch.
- `executor-run-observer` (FE-1141) — **tracer built 2026-07-06** (atomic run.json writer → `execute.runs`/`execute.run` projections → `/runs` + `/runs/$runId` routes → run-scoped `brunch.updated` topics; commits `2b3507c5`…`95e4cd2f` on `ka/fe-1141-executor-run-observer`). Remaining before tie-off: Petri raw `net.json` view (small slice) and the live-browser outer walkthrough.
- `orchestrator-tool-port` (FE-1107) — **executor surface reconciliation built 2026-07-07.** The `execute_*` tool seam, ports architecture, and run driver exist; `src/.pi/extensions/executor/` is now the Pi adapter home for execute tools and passive run-update observers, `agent-runtime/` owns only runtime-state/prompt hooks, and executor conduct names the live `execute_*` plus explicit-acceptance host-promotion boundary. Remaining before closing: confirm with KA which of his six remaining `memory/cards/executor-*` cards are truly open vs exhausted (all read as built, every acceptance box checked).

### Recently Completed

- 2026-07-06 **executor lane (KA, external to this stack):** FE-1089 / FE-1109 / FE-1111 / FE-1112 / FE-1118 / FE-1125 merged to `next` — execute-mode run lifecycle as pure core over injected `ExecutionPorts` with executor-only `execute_*` tools, run driver, run-local promotion, and explicit-acceptance host promotion. Registered in SPEC 2026-07-06 as D111-L / D112-L / I58-L (the lane's own doc sync had partially evaporated in merge; its code cited IDs colliding with D101-L/D102-L/I56-L, now repaired). Current state: `src/executor/TOPOLOGY.md`.
- 2026-07-06 `exchange-answering-chrome` (FE-1138) — the live answering chrome frontier is done (physical-terminal smoke confirmed 2026-07-06; closes arc `exchange-presentation`): every response kind now collects through Brunch-owned bordered `ctx.ui.custom` chrome — `ExchangeDecisionPickerComponent` for choice/candidate/review (raw `ctx.ui.select` retired outright), the bordered `MultiChoicePickerComponent` for multi-select, and `ExchangeAnswerEditorComponent` hosting pi-tui `Editor` for free-text (sealed `ctx.ui.editor` fallback, headless broker third, `hasUI`-first guards for pi 0.80.x stub contexts). Walkthrough-sourced hardening folded in: same-turn present/request batching guidance, Other write-in collection, required-field re-prompt discipline, None exclusivity + symmetric single-select `allowNone` with reserved escape ids, empty-answer rejection at TUI/RPC/schema boundaries, working-indicator hidden while awaiting input (scrollback stays free), box-owned spacing, and the pi 0.79.10→0.80.3 bump with its answering-paths re-verification checklist run. Full definition archived to `docs/archive/PLAN_HISTORY.md`.
- 2026-07-06 `present-digest` (FE-1136) — the digest exchange kind is live end to end (D110-L): prose-only `present_digest` offer → existing review terminal vocabulary → accepted-abstract echo as the sole sweep carrier (`DIGEST_CUSTOM_TYPES` retired); the review projection unified over a required `respondsToPresentTool` discriminator so the local TUI and public RPC answering paths behave identically; I57-L digest supersession/cancel probes ride the real `projectCaptureSweepWindow` and the product-minted RPC terminal. Live walkthrough beat observed 2026-07-06 (foreign design notes → digest → request changes → regenerate → approve → advisory review-set commit with honest `formatMutateGraphResult` receipt, reconciliation need, scratchpad routing): abstract-size pressure not observed (echo is authored compression, 856 chars from a 5.8 KB source; two-carrier fallback stays rejected), no conduct findings to route. Closes arc `capture-ingest-throughline`. Follow-ups noted at review, deliberately unscheduled: hoist the 5× duplicated `normalizeOptionalText` in `src/exchanges/projections/`; a derived per-kind terminal mapping to replace hand-taught `exchange-projection.ts` rows.
- 2026-07-03 `exchange-capture-contract` (FE-1135) — the outcome-capture contract sweep is closed for all required rows: model-facing ingest/elicit/map guidance states the five governing invariants (presence pinned by an executable conduct-home check), sweep-window tests exclude `present_*`/reserved `capture_*` tool results, and `session.submitExchangeResponse` approval transcript text states the persisted graph result through the canonical `formatMutateGraphResult` receipt (RPC readback proves `ref → code` in the session file). Residuals owed: the live chain probe (request-changes → regenerated successor → approve reads only the terminal payload) was not built here and is absorbed by FE-1136's supersession probes per SPEC I57-L; `present_digest` remains an explicit FE-1136 tripwire.
- 2026-07-06 **`orchestrator-cutover` arc closed** — six frontiers merged into `next` (PRs #274, #275, #278, #279, #284, #285; roster + done-definition in §Initiatives). The executor is real end-to-end: worktree → sealed worker → verify → run-local promotion → host apply → `execute_orchestrate` driver.
- 2026-07-06 `executor-run-integrity` (FE-1154) — execute-mode false-positive success is blocked: failed or missing slice verification now prevents `run_completed` and `promotion_prepared`; dependency edges project through snapshot/outline/draft into slice `depends_on`; greenfield orchestration defaults to `plan_only` so host source does not bleed into fixture worktrees. `npm run verify` passed.
- Older completed frontiers (incl. `exchange-rendering` FE-1123, `elicitation-gap-guidance` FE-1116, and the two 2026-07-01 `component-dx` slices): `docs/archive/PLAN_HISTORY.md`.

### Next (= the ship gate, lane-shaped)

- **Lane A — deterministic orientation:**
  1. `session-entry-orientation` ([FE-1134](https://linear.app/hash/issue/FE-1134/session-orientation-dialog-at-deterministic-junctures)) — active, inner-loop closed. The mechanism question is answered (deterministic product-owned dialog, not an exchange); all scoped product junctures/chrome slices are landed, including J5 mode-switch, the RPC timeout floor, and the automated boot/web-driver J1 degradation harnesses. Closeout also fixed the masked FE-1124 boot regressions: live junctures now deliver `brunch.context_seed` through Pi's live message surface before `brunch.kick`, and resume-debt skips boot infrastructure entries when finding unresolved user debt. The propose/project seed variants are now available; outstanding outer-loop walkthrough evidence for the generative menu options remains to be run. Arc: `deterministic-orientation`.
  2. `execute-entry-readiness` ([FE-1137](https://linear.app/hash/issue/FE-1137/executor-entry-readiness-and-concentric-authority)) — branch tied off 2026-07-06 (inner loop closed incl. the esc-inert/J5-race/exchange-terminate revision; PR submitted). Outer walkthrough evidence (thin/rich seed assessment, menu→conduct routing) deferred to a continued walkthrough/testing branch stacked after the five open branches are re-braided; frontier closes when that evidence lands. Arc: `deterministic-orientation`.
- **Lane D — tool-surface hardening:**
  1. `tool-schema-convergence` — coverage frontier / sweep: converge all 47 Brunch-authored provider-facing tool schemas on one adapter + two permitted runtime-schema sources (Zod v4 boundary-owned, TypeBox graph/DB-owned), with build-time provider-legality. Admitted 2026-07-07 out of the FE-1159 walkthrough's live Anthropic 400 (`read_graph` top-level `oneOf`). Buildable-now; runs on its own stacked worktree/branch, low conflict with the open lanes (touches `src/.pi/extensions/**` schema declarations only). Ledger: `memory/cards/tool-schema-convergence--ledger.md`. Definition below.
- **Lane B — capture/ingest: ✓ closed 2026-07-06.** Both members done (`exchange-capture-contract` FE-1135 2026-07-03; `present-digest` FE-1136 2026-07-06); arc `capture-ingest-throughline` closed. See Recently Completed.
- **Lane C — exchange presentation: ✓ closed 2026-07-06.** `exchange-answering-chrome` ([FE-1138](https://linear.app/hash/issue/FE-1138/bordered-answering-chrome-for-structured-exchanges)) done, smoke confirmed; arc `exchange-presentation` closed. Branch braided atop Lane B (`ln/fe-1136-present-digest`) 2026-07-06; pending PR tie-off. See Recently Completed.

### Parallel / Low-Conflict

- **In-flight `ln/*` wave (open PRs, definitions ride their branches; fold in on merge):** FE-1124 walkthrough batch 2 (#288) · FE-1134 session orientation dialog (#289) · FE-1135 exchange-outcome capture contract sweep (#291) · FE-1136 present-digest exchange (#292) · FE-1137 executor entry readiness / concentric authority (#290) · FE-1152 post-gate chrome refinements (#294).
- `component-dx` (FE-1115) — **paused.** Preview harness plus shared presentation primitives shipped; open for further dev-tooling refinement if a concrete need surfaces, but nothing is actively scoped. Production-wiring follow-on split to `exchange-answering-chrome` (né `bordered-chrome-production`) and `main-editor-chrome`.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

- `planning-process-model` — **demoted from Next #1 on 2026-07-03 (grill):** exploratory D103-L bet-proving, not ship-blocking. Behind the gate. Guard: the orientation menus' "project a plan" option routes to the existing `project`/`map-plans` seam at frontier-level depth (D103-L boundary) and must **not** pull this frontier forward. Groundwork stays parked on `ln/fe-xxx-plan-plane-redesign`; full definition below.
- `main-editor-chrome` — wire `BrunchEditorComponent` as the persistent input editor via `ctx.ui.setEditorComponent` (D22-L/D35-L chrome territory). Split out of the former `bordered-chrome-production` on 2026-07-02 because it is not exchange work; carries the unverified render-height assumption its first tracer must resolve. De-risked by FE-1138: `ExchangeAnswerEditorComponent` proved `Editor`-inside-Brunch-chrome on the one-shot seam, and the rule-strip helpers are shared in `.pi/components/editor-lines.ts`.
- `review-commentary-widening` — GitHub-style per-item review commentary: widen the review answered payload (`comments: [{on: draft|edge|set, body}]`, a SPEC decision) plus the collection UI. Deferred post-gate at FE-1138 scope (2026-07-03): the payload ripples into the review schema that capture-contract rows and the digest terminal consume. Sketch: `src/agents/contexts/exchanges/design-permutations.md` §Review-set evaluation.
- `workspace-dialog-headless-guard` — `workspace/index.ts:51` ungated `ctx.ui.custom` plus `activateWorkspace` dereferencing `decision.action` is a latent headless throw; predates pi 0.80.x and is TUI-command-driven in practice, so no live path hits it today.
- `blank-carrier-sweep` — extend the trim-based `zNonBlankMarkdown` boundary (landed 2026-07-06 for digest `abstract` / `accepted_abstract`) across the remaining required prose carriers that still accept blank: candidate rubric fields, `zPresentOption.content`, `zAnsweredOptionEcho.content` (`src/exchanges/schemas/present.ts` / `request.ts`). Sweep-shaped, no new behavior.
- `reconciliation-derivation` — derive `edge_revalidation` reconciliation needs from LSN comparison instead of persisting them; full definition below (inventory findings from 2026-07-02, worth keeping). **Confirmed behind the gate 2026-07-03 (grill G7):** the ingest throughline's conflict routing rides the existing persisted `reconciliation_need` substrate (`create_reconciliation_need` is live); nothing in the gate needs the LSN-derived generator. Honor the convergence: `walkthrough-batch-2` fixture prep still captures the `contradictory` seed variant.
- `reviewer-agent-mode` — D29-L's async advisory reviewer remains designed but unbuilt: narrow write authority to `reconciliation_need`, batch-acceptance trigger keyed by session/batch entry, A16-L trigger/scope questions still open. Behind the ship gate; no frontier until post-acceptance review becomes POC-blocking or reviewer residues need executable closure.
- `session-branching` — support session branching (D24-L reversal); needs branch-aware continuity/coherence design (A37-L).
- `compaction-and-conflict-widening` — long-horizon continuity through compaction.
- `agent-tracing` — passive trace instrumentation over Pi lifecycle events for debugging plus conduct/quality evaluation: NDJSON emitter extension (introspection-tap discipline), subagent span joining via SDK `session.subscribe`, and a mechanical-trace × semantic-JSONL join for deterministic conduct checks and judged passes. Entry move is an `ln-spike` (dev-gated `nikiforovall/pi-otel` import: do span trees beat `.brunch/debug/` + JSONL projections?) before any port of `JoshMock/the-agency` observability as the in-product base. Traces are dev/eval artifacts, never product truth (no event-spine backdoor). Design: `docs/design/AGENT_TRACING.md`; sibling idea note `docs/design/RLM_INVESTIGATION_PATTERN.md`.
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


### alpha-release-readiness

- **Name:** Alpha release readiness — packaging, model allowlist, auth onboarding
- **Linear:** [FE-1159](https://linear.app/hash/issue/FE-1159/alpha-release-readiness-packaging-model-allowlist-auth-onboarding)
- **Branch:** `ln/fe-1159-alpha-release`
- **Kind:** structural — distribution/packaging seam + a new auth/model-policy seam + first-run onboarding behavior.
- **Status:** active. Admitted 2026-07-07 (spike → grill → spec, same day); all five alpha-readiness implementation threads are built (model allowlist, packaging fixes, release verification smoke, `brunch login`, and no-auth gate). The outer walkthrough ran 2026-07-07 (evidence below); remaining closeout is branch tie-off + publish.
- **Certainty:** mixed — packaging fixes are `earned` (spike-witnessed defects, closure-shaped); allowlist/no-auth-gate/login are `proving` (first tracer through a new seam).
- **Why now / unlocks:** the ship gate's audience is colleagues/collaborators including non-Pi users; the published package currently crashes at boot for any fresh install, and a no-auth user gets a silent dead TUI. Nothing else on the plan makes Brunch installable.
- **Objective (five threads, from spike evidence + settled design):**
  1. **Packaging fixes (earned, built 2026-07-07):** `build:pi-assets` preserves compiled output while copying prompt/subagent/reference markdown assets, and `drizzle-orm`/`drizzle-typebox` are runtime dependencies.
  2. **Model allowlist (proving, built 2026-07-07):** code-owned ordered fall-through list of `provider/model/thinking` entries (`anthropic/claude-sonnet-4-6` then `openrouter/anthropic/claude-sonnet-4.6`, both `thinking: low`); first entry with resolvable auth wins; enforced by a Brunch-owned `ModelRegistry` through the existing `agentServices.modelRegistry` seam (D113-L), with scoped `/model` cycling limited to the allowlist.
  3. **No-auth gate (proving, built 2026-07-07):** workspace-dialog warning banner (non-blocking); UI-capable orientation junctures + kick do not fire when no allowlisted model resolves (D115-L, I59-L); no-UI degraded paths keep the `no_model_available` origination backstop.
  4. **`brunch login` (proving, built 2026-07-07):** standalone CLI subcommand over Pi's public `AuthStorage` (OAuth callbacks + API-key set), writing to `~/.pi/agent/auth.json` (D114-L). No `pi login` CLI exists to delegate to. The implementation uses Pi 0.80.3's canonical API-key credential tag (`type: 'api_key'`) and re-runs Brunch model-policy resolution for the exit report.
  5. **Release verification loop (built 2026-07-07):** `npm run check:release-pack` packs the tarball, asserts the release-critical prompt registry and 8 live skill files in the tar listing, installs into an isolated prefix, and runs the installed `brunch --mode print` from a foreign cwd so the clobber/dependency class of defect cannot silently return.
- **Retires:** the "does the built package work elsewhere?" uncertainty (spike answered: yes, once the two defects are fixed); the implicit "first Pi-available model" default; the silent no-auth boot.
- **Lights up:** installability for non-Pi colleagues; the first onboarding surface (`brunch login` + warning copy); a release check that can join `npm run verify` or CI.
- **Depends on:** D39-L (sealed profile), D34-L (built-in command containment — registry-layer enforcement, not chrome suppression), D109-L (juncture semantics the no-auth gate sits upstream of), D113-L/D114-L/D115-L, A38-L, I59-L, req 1/29.
- **Blocked by:** nothing hard. The KA stack merged to `next` 2026-07-07; this branch sits directly on `next`.
- **Publish mechanics (resolved 2026-07-07):** manual-local via release-it from a `next`-trunk checkout, matching how `main` published 0.2.0–0.8.0 (no publish CI exists; npm already hosts the old product at `latest: 0.8.0`, so the alpha rides dist-tag `alpha` and leaves `latest` untouched). `.release-it.json` enforces `requireBranch: next`, tags with the bare version (matching main's tag style), and runs `npm run check:release-pack` as the pre-publish hook (the smoke now includes a DB-touching rpc leg that proves the installed better-sqlite3 native binding). First publish: `npm run release -- --no-increment` (ships the already-set `1.0.0-alpha.0`); subsequent alphas: `npm run release` (release-it bumps the prerelease). Requires npm auth with `@hashintel` publish rights — the only human-gated step. `better-sqlite3` is pinned exact (`12.11.1`) so the repo `allowScripts` entry stays verifiable; note that consumer installs are governed by the *user's* script policy, not our package.json — `npx @hashintel/brunch@alpha` works because better-sqlite3 resolves its prebuilt binding, which the smoke's DB leg now witnesses.
- **Verification:** the release-verification loop (thread 5) is the frontier's own oracle family; I59-L is covered by no-auth `ModelRegistry` juncture tests (including no-UI degradation), workspace-dialog banner assertion, boot preflight propagation, single-source copy checks, and the unchanged origination backstop test; `brunch login` is exercised against a scratch `PI_CODING_AGENT_DIR`. A38-L conduct reproducibility continues to validate via alpha-user walkthroughs.
- **Outer walkthrough evidence (2026-07-07, scratch `PI_CODING_AGENT_DIR` + seeded `workspace-alpha-grounding` workbench):** (1) no-auth boot showed the workspace-dialog warning banner, entered the session without a J1 juncture, and wrote an empty `auth.json`; (2) `brunch login` with a real OpenRouter key wrote Pi's `auth.json` and the exit report resolved the OpenRouter allowlist entry; (3) the *first real provider turn then 400ed on every Anthropic-family backend* — `read_graph`'s params schema carried a top-level `oneOf` (FE-1053) that Anthropic rejects; the faux-provider suite structurally could not catch this. Fixed on-branch (commit `FE-1159: Drop read_graph top-level oneOf…`): union removed, companions enforced by the executor's `structural_illegal` diagnostics, Tier-2 regression oracle asserts no provider-facing tool schema has a top-level union. (4) Post-fix: junctures fire, banner gone, full elicitation loop verified live on both allowlist entries — OpenRouter kick ≈11s, question turn ≈13s incl. one tool call, graph writes landed (incl. an agent self-recovery from a `STRUCTURAL_ILLEGAL` batch); Anthropic-direct kick ≈14.5s after `brunch login` with an Anthropic API key. A38-L latency at `thinking: low` felt acceptable; no conduct anomalies observed.
- **Current execution pointer:** branch tie-off (`gt submit`) and publish; no prepared scope file. Packaging, allowlist, release-check, `brunch login`, no-auth gate, and the walkthrough-found `read_graph` schema fix all landed as FE-1159 commits on this branch (SHAs churn under gt restacks; find them by the `FE-1159:` prefix). Post-A38-L allowlist revision candidates named by the user: `openai/gpt-5.5`, `openai/gpt-5.4-mini` (verify exact pi-ai catalog ids before adding).
- **Traceability:** req 1, req 29; D113-L, D114-L, D115-L; A38-L; I59-L; SPEC §Future Direction (Brunch-owned config home, role-tiered model picks — both deferred).

### tool-schema-convergence

- **Name:** Tool-schema convergence sweep — one adapter, two schema sources, build-time provider legality
- **Linear:** [FE-1163](https://linear.app/hash/issue/FE-1163/tool-schema-convergence-one-adapter-two-schema-sources-build-time)
- **Branch:** `ln/fe-1163-tool-schema-convergence` (stacked worktree off `next`, after `ln/fe-1159-alpha-release` ties off)
- **Kind:** coverage frontier / sweep (frontier shape, not posture). **Certainty: earned** — every row is closure over an already-understood seam; nothing material is unknown.
- **Status:** admitted 2026-07-07; ledger authored, not yet scoped/built.
- **Why now / unlocks:** the FE-1159 outer walkthrough proved the failure class is real and total — one top-level `oneOf` in `read_graph` 400ed *every* provider turn on every Anthropic-family backend, and the faux-provider suite structurally cannot see it. Today the tool surface has a three-way authoring split (Zod-via-adapter ×2 duplicate adapters, TypeBox builders, hand `as const` JSON literals), so nothing enforces provider legality at authoring time. Converging now, right after the alpha cut, hardens the entire tool surface before alpha users hit it.
- **Boundary:** all 47 Brunch-authored tool schemas reaching providers as `input_schema` (9 families under `src/.pi/extensions/**`). **Out:** Pi-owned schemas (incl. the 4 read-only re-registrations in `agent-runtime`), RPC/web/graph-command schemas (canonical *sources* for rows, not rows).
- **Aggregate DoD:** no required ledger row remains `spec`/`partial`: both legacy adapters (`exchanges/pi-schema.ts`, `shared/pi-tool-schema.ts`) deleted; every in-boundary `parameters:` site routes through the single shared adapter; the registry-wide legality oracle (elicitor + executor toolsets) is green.
- **Inventory authority:** `memory/cards/tool-schema-convergence--ledger.md` (12 rows: adapter seam, 9 families, registry oracle, 1 tripwired deferred row). PLAN owns the frontier id and sequencing; the ledger owns rows only.
- **Classification:** buildable-now. All rows derive from current source; pi-ai's pre-execute `validateToolArguments` (TypeBox `Value.Check`) already gives uniform runtime validation, so no row adds a validation layer — this is authoring/derivation closure only.
- **Closes:** the three-way schema-authoring split; the "illegal schema discovered on a live turn" failure class.
- **Canonicalizes:** one adapter seam (`src/.pi/extensions/shared/tool-schema.ts`) and the two-source rule (Zod where the tool boundary owns the shape; TypeBox where graph/DB truth owns it — no re-declaring graph shapes in Zod).
- **Deletes / retires:** `exchanges/pi-schema.ts`, `shared/pi-tool-schema.ts`, and hand-authored `as const` schema literals as an authoring style.
- **Locks in:** "every provider-facing tool schema is provider-legal at build time" — SPEC invariant candidate at first landing, with the two-source rule as a SPEC decision candidate (record via `ln-sync`).
- **Promotion / disposal rule:** rows escape to their own frontier only if they stop being row-sized; >1 newly discovered row means the inventory wasn't closed — back through `ln-plan`. Ledger deleted at exhaustion.
- **Traceability:** motivating evidence rides FE-1159's walkthrough record (this file, alpha-release-readiness §Outer walkthrough evidence) and commit `FE-1159: Drop read_graph top-level oneOf…`; D39-L (sealed profile) constrains where the adapter lives; SPEC decision/invariant ids assigned when the first row lands.

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
  3. **Orientation dialog (superseded shape):** a Brunch-owned orientation extension fires `ctx.ui.select` at the scoped junctures and records the outcome via `pi.appendEntry('brunch.session_orientation', { choice, trigger })` (dialog results do not enter the session log automatically); the entry feeds the next kick so no model turn is spent asking. TUI boot entry is handled by the extension `session_start(startup)` handler because Pi binds UI before emitting `session_start`; post-switch `session_start`, `session_tree`, abort settle (if detectable), mode-switch, and `/consult` use the same extension event/command home. Specify-mode choice ids: `continue`, `elicit_decisions`, `elicit_examples`, `propose_intent`, `propose_design`, `propose_oracle`, `ingest`. Mid-session *discretionary* consults remain ordinary `present_question` tuples (D37-L grammar untouched); the mode-switch juncture is defined here but its Execute-side menu content belongs to `execute-entry-readiness`.
- **Pinned checks (from grill + scope adjudication):** escape/timeout on the dialog resolves to `continue` — the menu must never be a wall; no-UI print/json modes show no dialog and write no orientation entry; confirm Brunch's RPC client surface relays the extension-UI sub-protocol (Pi supports it; Brunch-side handling is a check, not a design question); `brunch.session_orientation` entries must be excluded from the capture sweep (they are process state — the custom-entry filter in `src/projections/session/sweep-watermark.ts` excludes all custom types since FE-1136 retired the digest special case; add the probe, not new mechanism); abort-settle rides `agent_end` only if the tail assistant stop reason makes genuine user aborts distinguishable from retryable compaction aborts.
- **Decision-flow chart (cross-cutting obligation):** at scope time, chart every juncture × outcome path — choice taken / escape / timeout / dialog-unavailable (print/json modes, `ctx.hasUI` false) — and each path's endpoint in kick composition.
- **Lights up:** the first user-*directed* skill routing; the juncture seam `execute-entry-readiness` extends.
- **Retires:** the "deterministic kick chrome vs prompt-directed agent behavior" open question (answered: deterministic); the F17 failure mode (model volition deciding whether to offer the choice).
- **Depends on:** F1 fix (landed, FE-1122); context-seed graph facts (D101-L/D102-L); Pi extension dialog + event surfaces (verified in `docs/extensions.md` / `docs/rpc.md` §Extension UI Protocol).
- **Blocked by (verification only, not build):** conduct verification for the generative menu options can now use `walkthrough-batch-2`'s `intent-settled` and `requirements-accepted` variants; elicit-path options remain verifiable on existing seeds.
- **Verification:** live walkthrough re-observation — cold-open and resume beats — plus captured `system-prompt.md`/`origination.md` debug oracles for kick composition; menu→conduct routing evidence via session JSONL skill `read` calls; injected-event extension tests for each juncture trigger; sweep-exclusion probe for the orientation entry.
- **Traceability:** D98-L (mode→role→prompt composition), D101-L/D102-L (session seed facts), D37-L (offer-owns-response grammar — dialog lives outside it, on the product side), D40-L (authority matrix, mode-switch juncture); TESTING_PLAN.md goal 6 + scenarios 1/2/7.

### execute-entry-readiness

- **Name:** Executor entry readiness — concentric authority as code contract + the Execute-mode assessment menu
- **Linear:** [FE-1137](https://linear.app/hash/issue/FE-1137/executor-entry-readiness-and-concentric-authority)
- **Branch:** `ln/fe-1137-executor-readiness` (stacks on `session-entry-orientation` — shares the dialog/juncture extension seam)
- **Kind:** structural — widens the D40-L authority matrix for Execute mode and adds the mode-switch entry behavior. Arc: `deterministic-orientation`.
- **Status:** active; inner-loop implementation is closed: card 1 materialized the concentric Execute authority matrix, card 2 landed the Execute-side orientation menu (J5 mode-switch kicks after every Execute dialog resolution), and card 3 added executor readiness/backfill conduct guidance. A follow-up judo-cleanup slice (2026-07-04, `b5ffb876`) collapsed the Specify/Execute mode-switch paths into one table-driven juncture call — kick suppression is now the menu descriptor's `noKickChoice` (Specify `continue`; Execute none), the separate `'always-kick'` juncture mode is retired, and readiness posture definitions are single-sourced in `readiness-bands.md` §Agent Use. A second revision (2026-07-06, `2753430a`, from walkthrough Beat 1's race finding) made escape/timeout resolve to the inert `dismissed` on every orientation menu (D109-L revision — no kick, no directive; supersedes the escape→`proceed` always-kick default), made mode switch abort any in-flight assistant turn before showing the J5 menu (with the J4 esc-abort juncture suppressed for that programmatic abort via a shared gate), and made cancelled `request_*` exchanges terminate the turn. Branch tied off 2026-07-06; remaining frontier work is outer walkthrough evidence for thin/rich seeds and menu→conduct routing, deferred to a continued walkthrough/testing branch stacked after the open branches are re-braided. Rejects the "Enhance" third-mode idea from the 2026-07-02 kickoff notes: conduct bias is not runtime state (the D98-L flattening argument applies with full force); "enhancer" = elicitor with a different opening move, which is kick posture + skill routing, not an agent.
- **Certainty:** proving — the executor-side conduct (readiness assessment quality, backfill UX) is unwitnessed; the authority widening itself is a bounded, near-`earned` matrix change.
- **Grounding:** concentricity is materialized as code contract — `EXECUTOR_ALLOWED_TOOL_NAMES` (`src/agents/runtime/executor/active-tools.ts`) is composed from the live elicitor allowlist plus executor-only `execute_*` grants, with the blocked-tool floor still applied. The Execute-side J5 switch records a `brunch.session_orientation` resolution and kicks the executor with a matching directive. Executor prompt/reference guidance opens Execute mode with capability-readiness postures (Proceed / Proceed-advisory / Negotiate / Ask) from `src/agents/references/readiness-bands.md` §Agent Use; this frontier does not invent a new readiness model.
- **Objective (three threads):**
  1. **Concentric authority as code contract (grill G6a — fully concentric):** Execute-mode grants become a superset of Specify-mode's — executor gains `present_*`/`request_response`, `mutate_graph`, scratchpad tools, and the elicitor skill set; enforced by a test-level invariant `EXECUTOR_ALLOWED_TOOL_NAMES ⊇ LIVE_ELICITOR_ALLOWED_TOOL_NAMES` (minus dev-only grants) plus the skill-manifest equivalent, in the existing authority-matrix test family (`agent-runtime-authority-matrix.test.ts`). Floor: write-execution tooling (`execute_*`) stays executor-only — later contains earlier, never the reverse. Bands themselves stay heuristic ("bands do not gate graph truth"); only *authority* hardens into contract. This is a D40-L SPEC decision + sealed-profile/authority-matrix test updates.
  2. **Mode-switch entry assessment:** on switch to Execute, the executor's kick opens with a readiness assessment over existing reads (bands, settlement, capability-readiness D74-L) and the orientation dialog offers five endpoints: `proceed` (escape/timeout default readiness assessment), `backfill` missing information via questions [Negotiate/Ask posture], `design_first` [propose/project:design], `oracle_first` [propose/project:oracle], and `project_plan` at frontier-level depth [existing `project`/`map-plans` seam, D103-L] — with the honest back-out at the far edge. The live execution boundary is now the `execute_*` tool family, with host apply gated by explicit acceptance.
  3. **Gentle-backfill conduct:** executor prompt guidance for agreeable capability-readiness — accept the user's requested move, then gather what it needs (scratchpad-obligation-driven questions) instead of relegating the user back to Specify mode. No mode ping-pong (grill G6b rejected).
- **Decision-flow chart (cross-cutting obligation):** at scope time, chart mode-switch → assessment → (proceed | negotiate → questions → proceed | ask → backfill loop | offer design flows | project plan → stub boundary) — every endpoint named, including dialog-escape ("proceed" default) and the not-implemented back-out.
- **Depends on:** `session-entry-orientation` (dialog seam + juncture events); D98-L (two modes, 1:1), D40-L (matrix), D74-L (capability-readiness), D99-L/I52-L (settlement reads); `readiness-bands.md` postures.
- **Blocked by:** nothing hard; generative-option verification shares the `walkthrough-batch-2` seed-variant gate with `session-entry-orientation`.
- **Lights up:** Execute mode as a usable product surface — assess, backfill, design, plan-project, and run execution through `execute_*` tools — plus the arc's "one witnessed e2e run per generative flow" obligation for the design/oracle/plan flows entered via mode switch.
- **Retires:** the "Enhance mode / third agent" direction (recorded as rejected with rationale); the executor-as-dead-end walkthrough experience (scenario 7 probe).
- **Guards:** does not touch `orchestrator-tool-port`'s scope (cook tooling, sandboxes) — that frontier stays deferred; flow "project a plan" must not pull `planning-process-model` forward (frontier-level depth only).
- **Deferred decision (decide after practical testing):** orientation-choice *meaning and statefulness*. Scoping (2026-07-04) settled the Execute-side entry as Option A — escape/timeout defaulted to a new `proceed` id with an always-kick J5 — but the 2026-07-06 revision (`2753430a`) replaced the escape default on every menu with the inert `dismissed` (no kick; esc means "wait for me"), so a kick now only follows an explicit selection. Orientation entries stay one-shot kick-consumed directives (never standing style, per D98-L). Two questions are explicitly deferred until walkthrough evidence exists: (1) whether `continue`/`proceed` semantics are right — "no directed move / user keeps floor" vs "resume prior style" vs "assess and go"; (2) whether any orientation posture should become sticky session state (a D98-L-sensitive reversal — route through `ln-grill`/`ln-spec`, not a scope card). Walkthrough beats should capture evidence on both.
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

- **Name:** Port cook orchestration into Execute/executor tools
- **Linear:** [FE-1107](https://linear.app/hash/issue/FE-1107/port-cook-orchestration-into-codeexecutor-tools)
- **Branch:** `ka/fe-1107-executor-surface-reconciliation` ([draft PR #298](https://github.com/hashintel/brunch/pull/298), stacked on FE-1154)
- **Kind:** structural / execute-mode tool boundary
- **Status (drafted 2026-07-07):** substantially delivered externally — the KA executor lane (FE-1089–FE-1125, merged to `next`) built the tool seam this frontier was scoped to open: `src/executor/` pure core over injected `ExecutionPorts`, thin `.pi/extensions/executor/` adapters, `execute_plan_check`, the run driver, run-local promotion, and explicit-acceptance host promotion (D111-L, D112-L, I58-L). PR #298 reconciles Specify/Execute vocabulary, executor adapter topology, prompt conduct, and observer contracts. Remaining residue before closing is KA card confirmation only.
- **Certainty:** earned for the delivered mechanism; the residue below is bounded.
- **Remaining residue (confirm with KA before closing FE-1107):**
  - Confirm with KA whether remaining `memory/cards/executor-*` files are truly open vs exhausted; do not delete them without that confirmation.
  - Decide whether FE-1107 closes as absorbed or narrows to any genuinely-unported `../brunch` cook CLI behavior.
- **Traceability:** D39-L, D40-L, D90-L, D91-L, D92-L, D93-L, D98-L / I49-L, D111-L, D112-L, I58-L; `src/executor/TOPOLOGY.md`, `src/.pi/extensions/TOPOLOGY.md`.

<!-- elicitation-gap-guidance (FE-1116) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D99-L, D101-L, D102-L, I52-L, I56-L, closure oracle
     src/graph/__tests__/elicitation-gap-guidance-closure.test.ts, docs/archive/SESSION_LOCAL_ELICITATION_GAPS.md. -->

### executor-run-observer

- **Name:** Executor run observer — watch a run crank live in the web sidecar
- **Linear:** [FE-1141](https://linear.app/hash/issue/FE-1141/executor-run-observer-watch-a-run-crank-live-in-the-web-sidecar)
- **Branch:** `ka/fe-1141-executor-run-observer` (rooted on `next`; the executor stack landed 2026-07-06)
- **Kind:** structural / executor read-projection + web observer surface
- **Status:** code acceptance complete 2026-07-06 (tracer + closeout: Petri raw view landed; review contract locks landed — execute-family sideEffects sentinel, executor purity boundary test, explicit `execute.run` runId validation). Remaining before tie-off: outer live-browser walkthrough per `docs/praxis/manual-testing.md`, then PR submit.
- **Current execution pointer:** none — build queue exhausted (tracer, closeout, intra-drive hook all landed); remaining: outer walkthrough, then merge #295.
- **Certainty:** proving.
- **Build notes (2026-07-06/07):** run-scoped topics landed as one passive `tool_result` observer extension (`executor/execute-run-updates`) publishing on successful explicit side effects, not per-tool publisher threading. Intra-drive liveness closed the same day: `drive()` exposes an optional `onStepComplete` hook (fired per real step advance, observer errors swallowed) that the orchestrate extension wires to run-scoped publishes — driver-cranked runs now update `/runs` per step, not once per drive. Executor observer contracts are explicit: local run artifact reads are best-effort/tolerant, requirement status prefers `populatedPlanPath ?? planPath`, active-slice stream tails are readable, and producer-serialized agent/verify stream appends preserve emitted order.
- **Lights up:** the first end-to-end read path from `.brunch/cook/runs/**` artifacts → `execute.runs` / `execute.run` / `execute.runReports` product RPC projections → web `/runs` routes, plus run-scoped `brunch.updated` topics.
- **Stabilizes:** the `execute.*` read-projection seam as the firewall that keeps run-bundle file shapes out of the browser contract.
- **Why now / unlocks:** the executor stack lands a real run crank — and FE-1125's `execute_orchestrate` driver cranks it unattended — but run truth lives only on the filesystem; the recurring "metadata says X, reality is Y" pain is invisible without a surface. Read-only observer first; seeds later worker/verify tails, Petri visualization, and promotion-acceptance UI without opening the web write seam.
- **Objective:** Watch an executor run crank live: `/runs` and `/runs/$runId` (surface name "Runs") render recorded run state, slice progression, and `reports.jsonl` events via new `execute.*` RPC read projections, freshened by run-scoped `brunch.updated` topics published through the in-process `ProductUpdatePublisher`. Strictly read-only.
- **Acceptance (to refine via `ln-scope`):**
  - `execute.*` read projections live at the rpc/app layer over `.brunch/cook/runs/**`; executor core stays pure (rpc→executor DTO direction only); raw artifact file shapes do not leak to the browser.
  - `/runs` + `/runs/$runId` show crank position, slice progression, and the reports timeline, with honest "agent running…" / "verify running…" indicators through long silent states.
  - Run-state advances publish run-scoped topics (new `execute.*` members of the `ProductUpdateTopic` union) mapped to exact query-key invalidations; refetch-on-navigation is the cross-process fallback.
  - Projections carry recorded state plus presence flags (worktree dir, petri/promotion artifacts, reports length) so metadata-vs-reality divergence is visible; no active git probes (those stay in host-promotion preflight).
  - Petri artifact: presence + raw `net.json` view only; the reports projection is tail/limited from day one.
  - Strictly read-only: no promotion acceptance or run control; worker/verify output tails and streaming frames stay in the `web-driver-streaming` lane.
  - Run-bundle reads are torn-read-safe (see spike finding): preferred shape is an atomic-writer precursor slice (`persistRunMetadata` goes write-temp+rename; the direct write site in `createRun` folds through it) so projections read naively; otherwise projections read tolerantly (retry/last-good `run.json`, partial-tail-skip `reports.jsonl`).
- **Spike finding (2026-07-06, torn-read spike):** `run.json` status writes are in-place `writeFile` (O_TRUNC, no rename) — concurrent readers can catch empty/partial JSON; `reports.jsonl` events are single-write complete lines (effectively atomic; skip a partial tail line). Step ordering is artifacts → report append → `run.json` last, so the event log *leads* the metadata snapshot by up to one step; projections must treat reports as progression truth and `run.json` as a lagging snapshot. In-tree precedent: `readRunMetadata` already swallows parse failures.
- **Traceability:** D23-L, D84-L, D98-L; one-writer/many-observer POC dashboard corollary; `src/executor/TOPOLOGY.md`, `src/web/TOPOLOGY.md`, `src/rpc/TOPOLOGY.md`.

### executor-run-integrity

- **Name:** Executor run integrity hardening
- **Linear:** [FE-1154](https://linear.app/hash/issue/FE-1154/executor-run-integrity-hardening)
- **Branch:** `ka/fe-1154-executor-run-integrity`
- **Kind:** executor-core hardening / fixture-backed correctness
- **Status:** ✓ done (2026-07-06). Scope file consumed and deleted.
- **Certainty:** proving.
- **Lights up:** the first regression path for a real reversed cook fixture whose reports show failed slice verification but whose metadata previously reached `promotion_prepared`.
- **Stabilizes:** execute-mode lifecycle truth: reports and metadata may lag, but failed verification must never be laundered into completed/promoted state.
- **Objective:** Prevent false-positive executor runs by making failed verification terminal for completion/promotion, preserving executable dependency topology, and keeping greenfield plan-only worktrees isolated from host-source tests.
- **Acceptance:** closed by `npm run verify`: failed or missing `slice_test_result` evidence blocks `execute_run_complete`; failed/missing verification blocks `execute_promotion_prepare` before `GitLandPort`; accepted dependency edges survive projection into executable slice dependencies; greenfield orchestration defaults to `plan_only` while explicit `host_source_deferred` still copies host source.
- **Traceability:** D98-L, D101-L, I52-L/I56-L; `src/executor/TOPOLOGY.md`.

<!-- elicitation-gap-guidance (FE-1116) definition retired 2026-07-06 ln-sync: done 2026-07-01, merged as #280; closure oracle src/graph/__tests__/elicitation-gap-guidance-closure.test.ts; detail in docs/archive/PLAN_HISTORY.md. -->

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
    alpha-release-readiness (FE-1159)
      status: active; all five threads built + outer walkthrough done 2026-07-07; tie-off + publish remain
      branch: ln/fe-1159-alpha-release (directly on next; KA stack merged)
      depends_on: D39-L, D34-L, D109-L, D113-L, D114-L, D115-L
      threads: packaging fixes -[earned]->; allowlist/no-auth-gate/login walkthrough-witnessed -[proving]->
      note: walkthrough found+fixed read_graph top-level oneOf (Anthropic 400); publish = merge -> check:release-pack -> npm publish
    tool-schema-convergence (FE-1163)
      status: admitted 2026-07-07 (sweep, buildable-now, earned); ledger authored, awaiting branch
      shape: coverage frontier; ledger memory/cards/tool-schema-convergence--ledger.md (12 rows / 47 tools)
      depends_on: -[optional]-> alpha-release-readiness (sequenced after the alpha cut; no hard edge)
      note: own stacked worktree; low conflict (schema declaration sites only)
    walkthrough-batch-2 (FE-1124)
      status: active planning/seed base for sibling ship-gate lanes
      feeds: -[verification seeds]-> session-entry-orientation, execute-entry-readiness (generative options)
             -[fixture variants]-> reconciliation-derivation (contradictory / advisory-pending, capture-only)
    walkthrough-fixes (FE-1122)
      status: built, pending PR tie-off
    orchestrator-tool-port (FE-1107)
      status: re-baselined 2026-07-06 — mechanism delivered by KA executor lane (FE-1089..FE-1125, D111-L/D112-L/I58-L)
      depends_on: D39-L, D90-L, D91-L, D92-L, D93-L, I49-L, D98-L, D111-L, D112-L
      residue: executor.md stub-boundary conduct realignment; confirm+GC six executor-* cards with KA; close-or-narrow decision
      note: execute-entry-readiness landed the entry menu on top of this seam; the two lanes meet at active-tools.ts / executor.md / pi-extensions.ts
    executor-run-observer
      status: planned; grilled 2026-07-03
      depends_on: executor stack run crank + artifacts (FE-1089..FE-1125), D23-L, D84-L, D98-L
      seam: execute.* RPC read projections + run-scoped brunch.updated topics
      boundary_with: web-driver-streaming -[optional]-> streaming frames / worker-verify tails stay there

  Next (ship gate):
    session-entry-orientation (FE-1134)
      arc: deterministic-orientation
      status: inner-loop closed (all cards + judo cleanup landed); outer walkthrough evidence pending
      branch: ln/fe-1134-session-orientation (base of the 2026-07-06 braided stack:
              fe-1124 -> fe-1134 -> fe-1137 -> fe-1135 -> fe-1136 -> fe-1138)
      depends_on: FE-1122 F1 fix (landed), D101-L/D102-L, pi extension dialog/event surfaces
      verification_gated_by: walkthrough-batch-2 seed variants -[optional]-> generative menu options only
    present-digest (FE-1136)
      arc: capture-ingest-throughline (closed 2026-07-06 with this frontier)
      status: done 2026-07-06; pending PR tie-off on ln/fe-1136-present-digest
              (stacks on done exchange-capture-contract FE-1135, ln/fe-1135-capture-contract)
    execute-entry-readiness (FE-1137)
      arc: deterministic-orientation
      status: inner-loop closed 2026-07-06 (3 cards + judo cleanup + esc-inert/J5-race revision); outer walkthrough evidence pending
      branch: ln/fe-1137-executor-readiness (stacks on ln/fe-1134-session-orientation)
      depends_on: -[hard]-> session-entry-orientation (dialog/juncture seam)
      guards: no orchestrator-tool-port scope; plan option stays at D103-L frontier depth
    exchange-answering-chrome (FE-1138)
      arc: exchange-presentation (closed 2026-07-06 with this frontier)
      status: done 2026-07-06 (smoke confirmed); pending PR tie-off on ln/fe-1138-answering-chrome
              (braided atop ln/fe-1136-present-digest)
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
  exchange-answering-chrome -> main-editor-chrome (Editor-in-chrome proof + shared editor-lines helpers)
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
