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

Brunch-next has delivered the original composition spine: the host, sealed Pi profile, transcript substrate, SQLite graph plane, public RPC, TUI/web observer shape, generalized capture, review-set commitment path, and public-entry ship gate all have evidence. The live plan is no longer organized around the old delivery cut. Active work is now the elicitor capability spine and the remaining hardening frontiers that build on that substrate.

**Live arc.** The **elicitor-capability-spine** arc (`capture` / `generate` / `project`) is done for the current POC capability surface. The retired strategy/lens/method runtime trees are no longer part of live product topology; current capability work routes through the code-owned first-level skill manifest and activity-named skill homes. Closed arc detail no longer lives in the rolling plan. Elicitation/readiness truthfulness (graph-as-truth, session-local asking agenda, advisory settlement) was delivered by the now-closed **`elicitation-gap-guidance`** frontier, which folded in settlement materialization; there was no separate settlement frontier.

**Executor substrate.** The **orchestrator-cutover** arc is done and merged into `next` (2026-07-06): the CODE-mode executor now plans, sandboxes, agent-executes, verifies, promotes (run-local + host apply), and drives runs for real behind injected `ExecutionPorts` (see §Initiatives). `executor-run-observer` (FE-1141) builds the first web-facing read surface over that substrate.

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
  - `exchange-rendering` (new, below) — transcript render surfaces: content formatters, `renderResult`-from-details, preview fixtures, render-honesty oracles.
  - `exchange-answering-chrome` (FE-1138, né `bordered-chrome-production`) — live answering UI: bordered picker/dialog replacements for the `ctx.ui.select`/`ctx.ui.editor` answering paths. In flight (PR #293).
- **Done-definition:** every exchange kind in the closed inventory renders honestly in transcript and re-render; live single-choice answering no longer routes through pi's plain `ctx.ui.select`; each renderer has a `dev:components` preview entry; `src/.pi/extensions/exchanges/TOPOLOGY.md`, `src/projections/TOPOLOGY.md` shape ledger, and `src/.pi/components/TOPOLOGY.md` reconciled; the formatter-home decision (see `exchange-rendering`) recorded in `memory/SPEC.md`.
- **Anchors:** D37-L, D38-L, D41-L (exchange schema/UI seam); D52-L, D60-L, D75-L (projection pipeline); TESTING_FINDINGS.md F7/F8/F11.

### orchestrator-cutover — ✓ done (2026-07-06)

- **Goal:** re-grow the old `main` cook orchestrator natively on the CODE/executor substrate, layer by layer behind injected capability ports, hard-to-reverse git seams last.
- **Members (all merged into `next`):** `orchestrator-alpha-cutover` FE-1089 ✓ (#274, descriptive lifecycle scaffold + `ExecutionSpecSnapshot` seam) · `executor-sandbox` FE-1109 ✓ (#275, real `GitWorktreePort` + `TestRunnerPort`) · `executor-agent-runner` FE-1111 ✓ (#278, sealed `worker` via `AgentRunnerPort`) · `executor-promotion` FE-1112 ✓ (#279, run-local `GitLandPort`) · `executor-host-promotion` FE-1118 ✓ (folded via the #284 close-sync, preflight + accepted host apply) · run driver FE-1125 ✓ (#285, `execute_orchestrate` over a scheduler seam).
- **Done-definition held at close:** a selected-spec run is planned, executed in a real git worktree by a real sealed worker, verified by the real test subprocess, promoted run-locally, and host-applied — every side effect explicit (I52-L), `execute_status` `pendingTools` empty; topology homes reconciled in #284. Named residue: `registerBrunchOrchestratorStub` retirement candidate (Parallel, below); intra-drive update liveness rides `executor-run-observer`'s build notes.
- **Anchors:** D98-L (executor merges orchestrator + pi-coder), D101-L port-refinement notes, I52-L; `src/executor/TOPOLOGY.md`, `src/app/TOPOLOGY.md`.

## Sequencing

### Active

- `exchange-answering-chrome` (FE-1138, `exchange-presentation` arc) — **in flight** on `ln/fe-1138-answering-chrome` (PR #293). Bordered answering chrome for structured exchanges; definition below.
- `executor-run-observer` (FE-1141) — **code-complete 2026-07-06; PR #295 open.** Read-only web run observer: atomic run.json writer, `execute.runs`/`execute.run` projections, `/runs` routes, run-scoped `brunch.updated` topics, Petri raw view, review contract locks. Remaining: live-browser outer walkthrough, then merge.

### Recently Completed

- 2026-07-06 **`orchestrator-cutover` arc closed** — six frontiers merged into `next` (PRs #274, #275, #278, #279, #284, #285; roster + done-definition in §Initiatives). The executor is real end-to-end: worktree → sealed worker → verify → run-local promotion → host apply → `execute_orchestrate` driver.
- 2026-07-03 `walkthrough-fixes` (FE-1122) — beat-1 doctor-pass findings closed and merged (#286): kick prompt carries the composed foreground prompt (F1), origination record at decision time (F2), kick-time chrome (F3/F4/F6), elicitor prompt refinements (F5/F9). Walkthrough continues on `ln/fe-1124-walkthrough-batch-2` (PR #288, in flight).
- 2026-07-03 `exchange-rendering` (FE-1123) — the structured-exchange transcript render frontier is closed: every ● row in `memory/cards/exchange-rendering--sweep.md` is built; request-response discriminants now have per-formatter render-honesty coverage and `dev:components` preview entries; structural-illegal preview fixture no longer carries an invented schema tag; `src/.pi/extensions/__tests__/exchange-family-completeness.test.ts` is the executable aggregate DoD across registered tools, formatters, preview entries, and snapshots. `npm run verify` passed. Human outer oracles remain owed: walkthrough re-observation for `TESTING_PLAN.md` scenarios 3/5 and preview-gallery aesthetic review.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

1. `planning-process-model` (FE-1127) — proving/exploratory, opened by D103-L. Groundwork merged 2026-07-03 (#283: `slice` kind removal, D103-L decision path, CueLoop liftout). Cheapest first tracer remains plan-as-projection; the epistemic-horizon/decision-flow model and the `scope`-node question stay behind that fog.

### Parallel / Low-Conflict

- **In-flight `ln/*` wave (open PRs, definitions ride their branches; fold in on merge):** FE-1124 walkthrough batch 2 (#288) · FE-1134 session orientation dialog (#289) · FE-1135 exchange-outcome capture contract sweep (#291) · FE-1136 present-digest exchange (#292) · FE-1137 executor entry readiness / concentric authority (#290) · FE-1152 post-gate chrome refinements (#294).
- `orchestrator-stub-retirement` — candidate cleanup: `registerBrunchOrchestratorStub` looks like dead weight now that D98-L merged the orchestrator into the executor and `execute_orchestrate` landed; verify no live policy/test references, then delete on the next executor-adjacent slice.
- `component-dx` (FE-1115) — **paused.** Preview harness plus shared presentation primitives shipped; open for further dev-tooling refinement if a concrete need surfaces, but nothing is actively scoped. Production-wiring follow-on split to `exchange-answering-chrome` (né `bordered-chrome-production`) and `main-editor-chrome`.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

- `main-editor-chrome` — wire `BrunchEditorComponent` as the persistent input editor via `ctx.ui.setEditorComponent` (D22-L/D35-L chrome territory). Split out of the former `bordered-chrome-production` on 2026-07-02 because it is not exchange work; carries the unverified render-height assumption its first tracer must resolve (see `exchange-answering-chrome` rename note).
- `session-branching` — support session branching (D24-L reversal); needs branch-aware continuity/coherence design (A37-L).
- `compaction-and-conflict-widening` — long-horizon continuity through compaction.
- `fixture-vs-real-audit` — `ln-induct` candidate for real-vs-fixture shape gaps (tool ids, orphan tool results, provider payload assumptions).
- `web-driver-streaming` — remaining consumer/UI and non-freeform answer legs after the built topology-A relay battery.
- `flue-pattern-adoption` — post-POC harness-pattern adoption.
- `framework-direction-stubs` — discretionary structural stubs only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

### Retired / Never

- `orchestrator-tool-port` (FE-1107) — superseded by the landed `orchestrator-cutover` arc: its plan-check tracer shipped as `execute_plan_check` and cook orchestration ported as the `execute_*` tool family under D98-L; the prepared scope card was deleted in #284.
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

### exchange-rendering

- **Name:** Structured-exchange transcript rendering — fix, unify, and lock the renderer family
- **Linear:** FE-1123
- **Branch:** `ln/fe-1123-exchange-rendering`
- **Status:** ✓ done (2026-07-03). Code DoD closed by `npm run verify`; human outer oracles remain owed: walkthrough re-observation for `TESTING_PLAN.md` scenarios 3/5 and preview-gallery aesthetic review.
- **Current execution pointer:** none. Ledger `memory/cards/exchange-rendering--sweep.md` is done at 12 of 12 rows built as of 2026-07-03; closeout slices are done in `memory/cards/exchange-rendering--closeout.md`. Head slice built 2026-07-02 (`beede8d5`, D104-L); its consumed scope card deleted per cleanup. The 2026-07-03 consolidation of core contracts into `src/exchanges/` is recorded as D108-L.
- **Kind:** coverage frontier (sweep shape) with a structural head slice. Arc: `exchange-presentation`.
- **Certainty:** head slice `proving` (new render-from-details seam + formatter-home decision); sweep rows `earned` (locking settled per-kind renderers).
- **Classification:** buildable-now. No product-state or evidence gate — all inputs (schemas, details contracts, preview harness) exist.
- **Source findings:** TESTING_FINDINGS.md F7 (present_question template noise), F8 (request_response picker re-list: raw `**`, unnumbered, bare "Other"), F11 (flat "# Response" answered template); beat-2 render-topology analysis (2026-07-02).
- **Why now / unlocks:** every elicitation beat flows through these renders; they are the product's face during Specify mode. The walkthrough showed the family is uneven (present_question/request_* are flat scaffolding; present_candidates has a rubric table; present_alternatives lives outside the family) and the render path is structurally wrong-way (renderResult re-renders the model-facing markdown string instead of the structured `details`).

- **The three surfaces (boundary):**
  1. **Persisted `content` markdown** — `src/agents/contexts/exchanges/*` formatters. **Dual-audience**: the same string is the model-facing tool result and the current TUI render source. In scope: template quality, honesty, concision-for-model.
  2. **`renderResult`** — `src/.pi/extensions/exchanges/*` + `shared/markdown.ts`. In scope. Original head bet was render-from-details; the built head slice revised D104-L to Markdown pass-through of the ★-grammar `content` string (details-built TUI render remains the named upgrade path if the TUI should diverge from the content register).
  3. **Live pickers** — **out of scope**; owned by `exchange-answering-chrome` (`ctx.ui.select` replacement, choices-editor restyle, answer dialog). Boundary rule: this frontier may not touch `shared/choice-source.ts` / `choices-editor.ts` UI collection; it may only consume their result details.

- **Head slice (structural, proving — before any sweep row):**
  - Establish render-from-details in one renderer (`present_question`) end-to-end, including a `dev:components` preview entry fed by fixture `{content, details}` (same static lane as the `alternatives` entry).
  - **Formatter-home decision — resolved.** D104-L kept the audience split (formatters in `agents/contexts/exchanges`, Pi adapters in `.pi/extensions/exchanges`, projections a distinct seam); D108-L (2026-07-03) then consolidated the core contracts — schemas, detail projections, recovery, editor envelope — into `src/exchanges/` with `request-response.ts` as the single public request-side surface. Current state: `src/exchanges/TOPOLOGY.md`.
  - Define the **render-honesty oracle** shape: for each renderer, every `details` field is either visibly rendered or deliberately elided by a named rule (extends the existing shape/no-loss invariant discipline from `src/projections/TOPOLOGY.md`).

- **Aggregate DoD:** no ● row open; head-slice decision recorded; `exchange-renderer-inventory.test.ts` extended to every row (snapshot per formatter); render-honesty invariant per renderer; boundary guards still green (`src/exchanges/schemas/__tests__/source-boundary.test.ts`, `src/projections/__tests__/topology-boundaries.test.ts`); preview registry has one entry per renderer family member.
- **Inventory authority:** `memory/cards/exchange-rendering--sweep.md` (authored 2026-07-02; rows only — sequencing stays here).
- **Oracles:**
  - Inner: per-row `toMatchFileSnapshot` (extends `exchange-renderer-inventory.test.ts`) for model-facing content; direct-render component tests for renderResult output (precedent: rounded-box/chrome direct-render tests).
  - Middle: render-honesty invariant (details ↔ visible-content no-loss) per renderer; boundaries test for the dependency rules in `src/.pi/extensions/exchanges/TOPOLOGY.md`.
  - Outer: walkthrough re-observation beats (TESTING_PLAN.md scenarios 3/5) after landing.
- **Cross-cutting obligations:** dual-audience discipline — changes to persisted `content` strings change model context; keep model-facing text concise and stable, do visual work in renderResult. Preview-harness parity: every new/changed renderer lands with its `dev:components` entry (extends `src/dev/component-preview/registry.ts`). Topology reconciliation: `src/exchanges/TOPOLOGY.md`, `src/.pi/extensions/exchanges/TOPOLOGY.md`, `src/agents/contexts/exchanges/TOPOLOGY.md` + `src/projections/TOPOLOGY.md` shape ledger on close.
- **Verification:** four-oracle compound per `memory/SPEC.md` §Design Notes "Exchange-presentation oracle design" — dual-family goldens (content vs render snapshots, inner), render-honesty invariant with declared elision lists (middle), live/persisted metamorphic render equality (middle), family-completeness registry test (middle, = executable aggregate DoD). Fixtures captured-then-normalized from live sessions + hand-authored terminal-state edges. Tier-2 dual-audience probe fires when model-facing content snapshots change. Preview-gallery + walkthrough re-observation outer.
- **Traceability:** D37-L, D38-L, D41-L (schema/UI seam); D52-L, D60-L, D75-L (projection pipeline); D104-L (audience split, Markdown pass-through render, render-honesty/elision convention, `present_alternatives` excluded from this sweep family); D105-L (boundary validation), D106-L (option echo), D107-L (proposed graph codes), D108-L (`src/exchanges/` consolidation).

### exchange-answering-chrome

- **Name:** Bordered Brunch-owned answering UI for the `request_*` response kinds
- **Linear:** FE-1138
- **Branch:** `ln/fe-1138-answering-chrome` (PR #293, in flight)
- **Kind:** bounded feature / presentation-layer production wiring. Arc: `exchange-presentation` (transcript-render counterpart: `exchange-rendering`; this frontier owns the live answering surfaces — pickers, one-shot answer dialog).
- **Renamed 2026-07-02:** was `bordered-chrome-production`. Its former thread 1 (persistent main editor via `ctx.ui.setEditorComponent`) is NOT exchange work and split out to `main-editor-chrome` (Horizon). Threads 2–3 below are the retained scope, folded into the `exchange-presentation` arc and sequenced directly behind `exchange-rendering`.
- **Status:** in flight (PR #293). Split off `component-dx` (FE-1115) on 2026-07-01 once the harness + shared primitives (`projectRoundedBox`, `projectScrollViewport`) shipped; this is the first production UX change either primitive drives. Definition detail rides the PR branch; fold outcomes in on merge.
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

<!-- walkthrough-fixes (FE-1122) definition retired 2026-07-06 ln-sync: merged as #286; summary in Recently Completed, detail in docs/archive/PLAN_HISTORY.md. -->
<!-- orchestrator-tool-port (FE-1107) definition retired 2026-07-06 ln-sync: superseded by the orchestrator-cutover arc (see Retired / Never). -->

### executor-run-observer

- **Name:** Executor run observer — watch a run crank live in the web sidecar
- **Linear:** [FE-1141](https://linear.app/hash/issue/FE-1141/executor-run-observer-watch-a-run-crank-live-in-the-web-sidecar)
- **Branch:** `ka/fe-1141-executor-run-observer` (rooted on `next`; the executor stack landed 2026-07-06)
- **Kind:** structural / executor read-projection + web observer surface
- **Status:** code acceptance complete 2026-07-06 (tracer + closeout: Petri raw view landed; review contract locks landed — execute-family sideEffects sentinel, executor purity boundary test, explicit `execute.run` runId validation). Remaining before tie-off: outer live-browser walkthrough per `docs/praxis/manual-testing.md`, then PR submit.
- **Current execution pointer:** none — build queue exhausted; next steps are outer walkthrough + tie-off.
- **Certainty:** proving.
- **Build notes (2026-07-06):** run-scoped topics landed as one passive `tool_result` observer extension (`agent-runtime/execute-run-updates`) publishing on successful explicit side effects, not per-tool publisher threading. Known limit: an `execute_orchestrate` drive publishes once at drive end — intra-drive liveness stays on refetch until a scheduler-seam hook is scoped.
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

<!-- elicitation-gap-guidance (FE-1116) definition retired 2026-07-06 ln-sync: done 2026-07-01, merged as #280; closure oracle src/graph/__tests__/elicitation-gap-guidance-closure.test.ts; detail in docs/archive/PLAN_HISTORY.md. -->

### planning-process-model

- **Name:** Planning-process model — plan-as-projection, epistemic horizon, and the `scope`-node question
- **Linear:** FE-1127
- **Branch:** tbd for the tracer (groundwork — `slice` removal + D103-L path + CueLoop liftout — merged 2026-07-03 as #283)
- **Kind:** structural / plan-plane semantics
- **Status:** proving; groundwork merged, plan-as-projection tracer not started. Mostly SPEC/skill work at first, low code-conflict.
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
    exchange-answering-chrome (FE-1138, exchange-presentation arc)
      status: in flight (PR #293, ln/fe-1138-answering-chrome)
      depends_on: exchange-rendering (done), component-dx primitives, STRUCTURED_EXCHANGE_ANSWERING_PATHS.md
      pairs_with: exchange-rendering -[boundary]-> live answering UI vs transcript renders

    executor-run-observer (FE-1141)
      status: code-complete; PR #295 open; outer walkthrough owed
      depends_on: orchestrator-cutover arc (landed), D23-L, D84-L, D98-L
      seam: execute.* RPC read projections + run-scoped brunch.updated topics
      boundary_with: web-driver-streaming -[optional]-> streaming frames / worker-verify tails stay there

  Recently Completed:
    orchestrator-cutover arc (FE-1089..FE-1125), walkthrough-fixes (FE-1122), exchange-rendering (FE-1123)

  Next:
    planning-process-model (FE-1127)
      status: proving / exploratory; groundwork merged (#283)
      depends_on: D103-L, D100-L (project seam)
      cheapest_first_tracer: plan-as-projection

  Parallel / Low-Conflict:
    in-flight ln/* wave (definitions ride their branches):
      FE-1124 #288, FE-1134 #289, FE-1135 #291, FE-1136 #292, FE-1137 #290, FE-1152 #294
    orchestrator-stub-retirement -[candidate cleanup]-> next executor-adjacent slice
    component-dx (FE-1115) -[paused]-> exchange-answering-chrome

  Horizon:
    session-branching
    compaction-and-conflict-widening
    fixture-vs-real-audit
    web-driver-streaming
    flue-pattern-adoption
    framework-direction-stubs
    geolog-and-petri-execution

  Retired:
    orchestrator-tool-port -[superseded]-> orchestrator-cutover arc
    coherence-first-class

done anchors:
  generalized-capture -> elicitor-generate, elicitor-project
  elicitor-generate -> elicitor-project
  subagent-reconciliation -> acquisition arm + future subagent diversity
  readiness-bands-interrogation -> renderer-golden-coverage
  ontology-revision -> renderer-golden-coverage, elicitor-project

rules:
  candidates never commit graph truth (I51-L)
  topology files own current subtree state
  scratch evidence is not durable until promoted to .fixtures/runs/
  an arc (§Initiatives) closes only when its done-definition holds, incl. topology-README reconciliation + residue discharge
```
