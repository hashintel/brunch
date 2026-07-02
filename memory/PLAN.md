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
  - `exchange-answering-chrome` (né `bordered-chrome-production`) — live answering UI: bordered picker/dialog replacements for the `ctx.ui.select`/`ctx.ui.editor` answering paths.
- **Done-definition:** every exchange kind in the closed inventory renders honestly in transcript and re-render; live single-choice answering no longer routes through pi's plain `ctx.ui.select`; each renderer has a `dev:components` preview entry; `src/.pi/extensions/exchanges/TOPOLOGY.md`, `src/projections/TOPOLOGY.md` shape ledger, and `src/.pi/components/TOPOLOGY.md` reconciled; the formatter-home decision (see `exchange-rendering`) recorded in `memory/SPEC.md`.
- **Anchors:** D37-L, D38-L, D41-L (exchange schema/UI seam); D52-L, D60-L, D75-L (projection pipeline); TESTING_FINDINGS.md F7/F8/F11.

## Sequencing

### Active

- `walkthrough-batch-2` (FE-1124) — continued doctor-pass scenarios (those not blocked on exchange-rendering) + fixture/seed preparation and generative-scenario variation sets (seed-variation worklist: TESTING_PLAN.md scenario 2). Branch `ln/fe-1124-walkthrough-batch-2` (stack tip, this worktree). Findings ledger: `TESTING_FINDINGS.md`. Beat-5 findings F16/F17 spawned `session-entry-orientation` (Next); its generative-option verification consumes this frontier's seed variants.
- `walkthrough-fixes` (FE-1122) — **built 2026-07-02** (all cards incl. F10 addendum; commits `e0701b4`…`486824b` on `ln/fe-1122-walkthrough-fixes`); pending PR tie-off. Walkthrough continues on a stacked follow-on branch.
- `orchestrator-tool-port` (FE-1107) — **D98-sensitive proving frontier, intentionally deferred.** Parked on its own branch while the remaining SPEC-mode frontiers are clarified first.

### Recently Completed

- 2026-07-03 `exchange-rendering` (FE-1123) — the structured-exchange transcript render frontier is closed: every ● row in `memory/cards/exchange-rendering--sweep.md` is built; request-response discriminants now have per-formatter render-honesty coverage and `dev:components` preview entries; structural-illegal preview fixture no longer carries an invented schema tag; `src/.pi/extensions/__tests__/exchange-family-completeness.test.ts` is the executable aggregate DoD across registered tools, formatters, preview entries, and snapshots. `npm run verify` passed. Human outer oracles remain owed: walkthrough re-observation for `TESTING_PLAN.md` scenarios 3/5 and preview-gallery aesthetic review.
- 2026-07-01 `component-dx--rounded-box-primitive` (FE-1115) — `.pi/components/rounded-box.ts` now owns the shared rounded-border projection for bordered Pi TUI presentation components. `brunch-editor.ts`, `workspace-dialog/component.ts`, and `cards.ts` delegate their box drawing to `projectRoundedBox`; direct-render tests cover right/left labels, thumb rows, blank padding, pre-rendered content width, and card title placement. This closes `component-dx`'s active scope; remaining production-wiring work moves to `bordered-chrome-production` (new frontier, below).
- 2026-07-01 `component-dx--wheel-scroll-passthrough` (FE-1115) — `workspace-dialog-scroll` now opts into preview-harness SGR wheel handling: `showComponentPreview` owns mouse enable/disable plus wheel-to-arrow translation, `.pi/components/mouse-wheel.ts` owns the raw SGR parser, and harness tests prove the long-list preview reaches the same visible state as equivalent ArrowDown input. Residual, carried forward: a manual physical-terminal smoke test (iTerm2/Kitty/Ghostty) to confirm native wheel emission matches the injected SGR shape has not been run.
- 2026-07-01 `elicitation-gap-guidance` (FE-1116) — the spec-global persisted `elicitation_gaps` register and its count-based readiness scoring are retired; the asking agenda is now a session-local `brunch.elicitation_scratchpad` fold seeded from a thin graph-fact seed; `latestExpectedBand(kind)` is the single band scalar; and settlement (`advisory` | `settled`, orthogonal to `basis`) is materialized and command-enforced (D99-L, I52-L). Closure oracle: `src/graph/__tests__/elicitation-gap-guidance-closure.test.ts` grep-guards the retired names. All co-located `TOPOLOGY.md` homes named in `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` are reconciled; that doc's status flips to landed.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

<<<<<<< ours — heading `Next` (S+F, confidence: low)
// hint: Structural and logic conflict. Both design and behavior differ.
1. `planning-process-model` — proving/exploratory, opened by D103-L. Cheapest first tracer is plan-as-projection; the epistemic-horizon/decision-flow model and the `scope`-node question stay behind that fog. Groundwork already on branch `ln/fe-xxx-plan-plane-redesign`.
2. `exchange-answering-chrome` — not yet started; no Linear issue or branch yet. Second member of the `exchange-presentation` arc (renamed from `bordered-chrome-production`; main-editor thread split to `main-editor-chrome`, Horizon). Owns the live answering surfaces (choice/review pickers, free-text answer dialog); pairs with `exchange-rendering`, which owns transcript renders.
=======
1. `exchange-rendering` (FE-1123) — coverage frontier (structural head slice + sweep body), opened 2026-07-02 from walkthrough findings F7/F8/F11. Branch `ln/fe-1123-exchange-rendering` in worktree `brunch-next-lambda`. First member of the `exchange-presentation` arc.
2. `planning-process-model` — proving/exploratory, opened by D103-L. Cheapest first tracer is plan-as-projection; the epistemic-horizon/decision-flow model and the `scope`-node question stay behind that fog. Groundwork already on branch `ln/fe-xxx-plan-plane-redesign`.
3. `session-entry-orientation` — opened 2026-07-02 from beat-5 walkthrough findings F16/F17 (MAJOR), absorbing chrome polish F13/F14 and F15 option (a). No Linear issue or branch yet (create on pickup). Owns what a session says and asks at entry: deterministic entry chrome, elicitor re-entry assessment, and the process-level mode menu. Low code-conflict with `exchange-rendering` (chrome + prompt files, not formatters/renderers).
4. `exchange-answering-chrome` — not yet started; no Linear issue or branch yet. Second member of the `exchange-presentation` arc (renamed from `bordered-chrome-production`; main-editor thread split to `main-editor-chrome`, Horizon). Owns the live answering surfaces (choice/review pickers, free-text answer dialog); pairs with `exchange-rendering`, which owns transcript renders.
>>>>>>> theirs — heading `Next` (S+F, confidence: low)

### Parallel / Low-Conflict

- `component-dx` (FE-1115) — **paused.** Preview harness plus shared presentation primitives shipped; open for further dev-tooling refinement if a concrete need surfaces, but nothing is actively scoped. Production-wiring follow-on split to `exchange-answering-chrome` (né `bordered-chrome-production`) and `main-editor-chrome`.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

- `main-editor-chrome` — wire `BrunchEditorComponent` as the persistent input editor via `ctx.ui.setEditorComponent` (D22-L/D35-L chrome territory). Split out of the former `bordered-chrome-production` on 2026-07-02 because it is not exchange work; carries the unverified render-height assumption its first tracer must resolve (see `exchange-answering-chrome` rename note).
- `reconciliation-derivation` — derive `edge_revalidation` reconciliation needs from LSN comparison instead of persisting them; full definition below (inventory findings from 2026-07-02, worth keeping).
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

### exchange-rendering

- **Name:** Structured-exchange transcript rendering — fix, unify, and lock the renderer family
- **Linear:** [FE-1123](https://linear.app/hash/issue/FE-1123/structured-exchange-rendering-fix-unify-and-lock-the-transcript)
- **Branch:** `ln/fe-1123-exchange-rendering` (stacked on `ln/fe-1122-walkthrough-fixes`; worktree `~/Code/hashintel/brunch-next-lambda`)
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
- **Linear:** unassigned (create on pickup)
- **Branch:** tbd
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


### session-entry-orientation

- **Name:** Session entry orientation — entry chrome, re-entry assessment, and the process-level mode menu
- **Linear:** unassigned (create on pickup)
- **Branch:** tbd
- **Kind:** bounded feature / kick-design + chrome; introduces a new workflow entry behavior (the mode menu) at the session-entry seam.
- **Status:** not started; opened 2026-07-02 from walkthrough beat-5 findings.
- **Certainty:** proving — the mode menu's product shape is unproven: deterministic kick chrome vs prompt-directed agent behavior, every-entry vs graph-threshold gating, and how a menu choice maps to skill routing are all open design questions the first tracer must answer.
- **Source findings:** TESTING_FINDINGS.md F16 (no "where are we" orientation on resume), F17 (resume dives into elicitation instead of asking what to do), absorbing F13 (welcome block placement/styling), F14 (kick indicator salience), F15 option (a) (session-global "Worked for Ns" collapsed-block label; option (c) rides `exchange-rendering`'s renderCall row instead).
- **Why now / unlocks:** both MAJOR findings sit on the first thing every user experiences (session entry), and the mode menu is the user-facing surface of skill-manifest routing — it converges with TESTING_PLAN.md goal 6 (generative discoverability) and the scenario 7 mode-switch probe, turning discoverability from model volition into an explicit affordance.
- **Objective (three threads):**
  1. **Deterministic entry chrome:** welcome block as its own styled element after the header (F13); kick activity driven through pi's salient `setWorkingMessage`/`setWorkingVisible` surface rather than only a status-line entry (F14); resume-variant state/status insertion (workspace name, mode, graph stats) in TUI chrome or transcript (F16a); optionally the cheap turn_end "Worked for Ns" global label (F15a, accepting pi's global-label semantics).
  2. **Elicitor re-entry assessment:** kick/persona guidance so the assistant opens re-entry with an *assessment* — a summary of what the graph expresses (not a node listing), a forecast of what's TODO and what comes next, doubling as the teaching surface for what Brunch can do (F16b). Raw material already exists in the context seed's graph facts (D101-L/D102-L); this is prompt shaping, not new plumbing.
  3. **Process-level mode menu:** first interaction on entry is a `request_response` single-select over process moves — continue via design-decision questions · continue via example-based questions · generatively expand/enhance · design the technical implementation · design the verification approach — before any questioning proceeds (F17). Options map onto skill routing (elicit variants / propose / project).
- **Lights up:** the first user-*directed* skill routing — a menu choice steering conduct, rather than the model inferring the move from prose.
- **Retires:** the open question of whether generative-mode discoverability needs prompt guidance, chrome, or an explicit affordance (goal 6's cheapest probe).
- **Depends on:** F1 fix (composed kick prompt reaching every provider call — landed, FE-1122); context-seed graph facts (D101-L/D102-L); `request_response` exchange seam (D37-L/D38-L).
- **Blocked by (verification only, not build):** conduct verification for the menu's generative options (propose/project) needs the `walkthrough-batch-2` seed variants (`intent-settled`, `requirements-accepted`) — the elicit-path options are verifiable on existing seeds now.
- **Verification:** live walkthrough re-observation beats — cold-open (scenario 1 variant on an empty workbench) and resume (beat 5 repeat) — plus captured `system-prompt.md`/`origination.md` debug oracles for the kick composition; menu→conduct routing evidence via session JSONL skill `read` calls (TESTING_PLAN.md scenario 2 oracles).
- **Traceability:** D98-L (mode→role→prompt composition), D101-L/D102-L (session seed facts), D37-L/D38-L (structured-exchange seam); TESTING_PLAN.md goal 6 + scenarios 1/2/7.

### walkthrough-fixes

- **Name:** Doctor-pass walkthrough fixes (batch 1)
- **Linear:** [FE-1122](https://linear.app/hash/issue/FE-1122/walkthrough-doctor-pass-fixes-kick-prompt-origination-record-kick)
- **Branch:** `ln/fe-1122-walkthrough-fixes` (stacked on `ln/fe-xxx-plan-plane-redesign` / PR #283)
- **Kind:** defect-closure batch inside settled seams, sourced from the 2026-07-02 TESTING_PLAN.md walkthrough.
- **Status:** scoped, ready to build. Findings ledger: `TESTING_FINDINGS.md`. Walkthrough continues in parallel; later beats may append further cards or a batch-2 frontier.
- **Certainty:** earned (settled seams; each card closes a named defect).
- **Objective:** Close the beat-1 walkthrough findings: kick turn must carry the composed foreground prompt (F1 — pi `triggerTurn` path bypasses `before_agent_start`); origination decision record written at decision time (F2); kick-time chrome (activity indicator F3, welcome intro F4, collapsed thinking F6); elicitor prompt refinements (concision F5, multi-select nudge F9, retired "ranked elicitation gaps" vocabulary).
- **Current execution pointer:** `memory/cards/walkthrough--elicitor-prompt-refinements.md`. Excluded/deferred: F7/F8 (`present_question`/`request_response` rendering refinements).
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

### elicitation-gap-guidance

- **Name:** Session-local elicitation gaps from a graph-derived seed
- **Linear:** [FE-1116](https://linear.app/hash/issue/FE-1116/session-local-elicitation-gaps-from-a-graph-derived-seed)
- **Branch:** `ln/fe-1116-elicitation-gap-guidance` (onto `ln/fe-1108-structured-exchange-affordance`)
- **Kind:** structural / elicitor guidance + session-state seam
- **Status:** ✓ done (2026-07-01). All six cards landed; closure oracle `src/graph/__tests__/elicitation-gap-guidance-closure.test.ts` grep-guards the retired names.
- **Certainty:** proving (retired on land).
- **Retires:** the persisted spec-scoped `elicitation_gaps` register and its count-based readiness scoring (D65-L, D45-L); the fixed spec-creation seed catalog `SEEDED_ELICITATION_GAPS` (D75-L).
- **Materializes (folded slice):** advisory/settled `settlement` as a graph dimension orthogonal to `basis`, enforced at the command layer and surfaced in projection/context (D99-L, I52-L, D63-L) — formerly the separate `settlement-materialization` frontier, folded in per the 2026-07-01 review + user decision. Landed 2026-07-01 (Card 5).
- **Depends on:** readiness bands, data-model legibility, and the stable exchange affordance surface (all done). Settlement is folded in as a later slice; the thin seed still must **not** depend on advisory/settlement state (A36-L).
- **Lights up:** a session-local, cumulative asking agenda seeded per session from thin graph facts and focused by a prompt orientation directive.
- **Stabilizes:** the boundary between graph truth (durable), the session-local gap scratchpad (non-authoritative asking agenda), and persisted `reconciliation_need` follow-up; plus a single code-owned latest-expected-band scalar source.
- **Objective:** Replace the spec-global persisted `elicitation_gaps` register and its count-based readiness estimate with (1) a session-local cumulative gap scratchpad — one `brunch.elicitation_scratchpad` custom session entry + one fold projection + read/write tools (not tool-result details, no runtime-state duplication), (2) a thin graph-derived neutral seed per session, (3) an `elicitor.md` orientation directive that focuses a vein, (4) a reconciled latest-expected-band scalar model, and (5) a materialized advisory/settled `settlement` graph dimension (orthogonal to `basis`, command-enforced, surfaced in projection/context) — without inventing a second persisted gap ontology or any count-based readiness scoring.
- **Acceptance:**
  - Count-based readiness reasoning is deleted: `derivePresenceCoverage` and the coverage-over-gaps estimate (`readiness-estimate.ts`) are removed; no code path scores readiness by counting nodes/gaps (D45-L, I31-L).
  - The persisted `elicitation_gaps` table and `elicitation-driver.ts` sorter are retired; consumers (`.pi/extensions/agent-runtime/system-prompts/world-reads.ts`, `specification-overview-context.ts`, subagent snapshot in `pi-subagents.ts`) migrate to session-local state (D65-L, D101-L).
  - A session-state extension defines the gap scratchpad model (new `brunch.elicitation_scratchpad` custom entry following the `runtime-state.ts` fold precedent, not sharing runtime-state storage) plus read/write tools replacing `read_elicitation_gaps`/`update_elicitation_gaps`; entries are non-authoritative (I56-L) and low-confidence noticings route here, not the graph (D81-L; `spawn_gap` expected outcomes and the old `action: 'spawn'` write path removed).
  - Each session's scratchpad is seeded from a thin graph-derived neutral seed (facts, not scores) that does not depend on advisory/settlement state (D102-L, A36-L).
  - `elicitor.md` carries the "new session → establish orientation → focus a vein" directive that turns the neutral seed into a session-specific agenda (D102-L).
  - Subagents receive the session gap scratchpad in their world snapshot (migrate `pi-subagents.ts` off `getElicitationGaps`).
  - Band model reconciled to a single code-owned per-kind latest-expected-band scalar map; the array `INTENT_KIND_BANDS` and the earliest-band `bandsForKind(kind)[0]` read in `graph-slice.ts` are removed/fixed (D94-L, I50-L).
  - The three reference files are consolidated to the agreed ownership split — `readiness-bands.md` (band semantics / latest-expected), `data-model.md` (kind → source-question + role/modality), `question-kinds-per-intent-kind.md` (projection catalog / phrasings) — with duplicated latest-band/source-question content removed (D97-L).
  - Capture probes/tests that assumed `spawn_gap` (`capture-commitment-gradient-gate.test.ts`, `src/probes/capture-quality-loop.ts`) are updated to the session-state outlet; the old elicitation tool `action: 'spawn'` is not accepted.
  - Settlement (folded slice): graph schema carries `settlement` (`advisory` | `settled`) separate from `basis`; CommandExecutor validation + promotion/rewrite/supersede/reconcile paths enforce I52-L (advisory never read as settled by projection/plan/commitment readers); projection/context surface settlement so capability-readiness (D74-L) can consult it; capture reference material updated (D99-L, D63-L).
  - Anti-regression: tests prove the old attractor is gone — no `read_elicitation_gaps`/`update_elicitation_gaps` tools or `action: 'spawn'` gap write path, no readiness count/coverage language, readiness resolves with an empty scratchpad, and `getElicitationGaps`/`derivePresenceCoverage`/`readinessEstimate`/`elicitation-driver`/`SEEDED_ELICITATION_GAPS` no longer exist.
- **Traceability:** D45-L, D63-L, D65-L, D74-L, D75-L, D81-L, D94-L, D97-L, D99-L, D101-L, D102-L; A36-L; I31-L, I50-L, I52-L, I56-L; `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` (topology + consolidation ledger); `src/graph/schema/**` (settlement), `src/graph/command-executor.ts`, `src/projections/**`, `src/agents/contexts/**`, `src/session/runtime-state.ts`, `src/.pi/extensions/agent-runtime/{runtime/index.ts,system-prompts/world-reads.ts}`, `src/graph/queries.ts` (`derivePresenceCoverage`), `src/graph/elicitation-driver.ts`, `src/graph/command-executor.ts` (`SEEDED_ELICITATION_GAPS`), `src/projections/session/readiness-estimate.ts`, `src/session/specification-overview-context.ts`, `src/app/pi-subagents.ts`, `src/probes/capture-quality-loop.ts`, `src/probes/public-rpc-parity-proof.ts`, `src/graph/schema/nodes.ts`, `src/agents/contexts/data-model/graph/graph-slice.ts`, `src/agents/prompts/elicitor.md`, `src/agents/references/{readiness-bands,data-model}.md`, `src/agents/skills/elicit/references/question-kinds-per-intent-kind.md`.


### planning-process-model

- **Name:** Planning-process model — plan-as-projection, epistemic horizon, and the `scope`-node question
- **Linear:** unassigned
- **Branch:** `ln/fe-xxx-plan-plane-redesign` (plan-plane groundwork already landed here: `slice` removal + D103-L + CueLoop liftout)
- **Kind:** structural / plan-plane semantics
- **Status:** proving candidate opened by D103-L; sequence after `elicitation-gap-guidance`. Mostly SPEC/skill work at first, low code-conflict.
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
    orchestrator-tool-port
      status: deferred / D98-sensitive
      depends_on: D39-L, D90-L, D91-L, D92-L, D93-L, I49-L, D98-L
      active_scope: memory/cards/orchestrator-tool-port--plan-check-tool.md

  Recently Completed:
    elicitation-gap-guidance, component-dx--rounded-box-primitive, component-dx--wheel-scroll-passthrough

  Next:
    exchange-rendering
      status: coverage frontier, buildable-now; head slice proving, sweep rows earned
      arc: exchange-presentation
      depends_on: D37-L, D38-L, D41-L, D52-L/D60-L/D75-L (projection pipeline), walkthrough-fixes (FE-1122 lands first)
      boundary_with: exchange-answering-chrome (live answering UI there; transcript renders here)
    planning-process-model
      status: proving / exploratory (opened by D103-L)
      depends_on: D103-L, D100-L (project seam)
      cheapest_first_tracer: plan-as-projection
    session-entry-orientation
      status: not started, no Linear issue/branch yet (opened 2026-07-02 from F16/F17; absorbs F13/F14/F15a)
      depends_on: FE-1122 F1 fix (landed), D101-L/D102-L (seed facts), D37-L/D38-L (request_response seam)
      verification_gated_by: walkthrough-batch-2 seed variants -[optional]-> generative menu options only
    exchange-answering-chrome
      status: not started, no Linear issue/branch yet (renamed from bordered-chrome-production; main-editor thread -> main-editor-chrome, Horizon)
      arc: exchange-presentation
      depends_on: component-dx (paused, primitives shipped), STRUCTURED_EXCHANGE_ANSWERING_PATHS.md
      pairs_with: exchange-rendering -[boundary]-> live answering UI vs transcript renders

  Parallel / Low-Conflict:
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
