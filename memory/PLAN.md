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

**Alpha release lane (opened 2026-07-07).** Brunch ships as `@hashintel/brunch@1.0.0-alpha.x` from the `next` trunk. A same-day spike → grill → spec pass admitted `alpha-release-readiness` (FE-1159): two release-blocking packaging defects, a pinned model-allowlist policy (D113-L), Pi-auth-riding onboarding with `brunch login` (D114-L), and a no-auth upstream gate (D115-L).

**Exchange-ask cutover (D116-L, built 2026-07-08).** A one-shot **ask** tool is now the only interactive structured-exchange terminal; `present_question` and the registered `request_response` collector are retired; offer presents declare their ask continuation in details. "Pending exchange" dissolved as a concept; headless RPC discovery of open asks is deferred (A39-L → Horizon `headless-ask-discovery`). Frontier `exchange-ask-refinement` (FE-1164) awaits tie-off.

**Merge wave (2026-07-08) + plan consolidation.** The braided ship-gate stack and the KA executor lanes are merged to `next` (#286–#298). Still open: FE-1159 (#299), FE-1115 (#301), FE-1164 (unsubmitted), and KA's #300/#302/#303. A same-day `ln-plan` hygiene pass batched all straggling outer-loop residue from the merged lanes into `walkthrough-evidence-batch` (FE-1167), pruned non-frontier Horizon rows, and folded `blank-carrier-sweep` into the FE-1163 ledger.

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

- `alpha-release-readiness` (FE-1159) — get the `1.0.0-alpha` line publishable and onboardable (packaging fixes, pinned model allowlist, Pi-auth ride + `brunch login`, no-auth gate). Admitted 2026-07-07 from spike + grill + spec (D113-L/D114-L/D115-L, req 29, A38-L, I59-L). Built + walkthrough-witnessed; PR [#299](https://github.com/hashintel/brunch/pull/299) awaiting merge → publish. Branch `ln/fe-1159-alpha-release`. Definition below.
- `exchange-ask-refinement` (FE-1164) — built, review-verified, and witness-gap closed 2026-07-08; branch `ln/fe-1164-ask-terminal` awaiting `gt submit` + tie-off (stacked on FE-1115 #301). See Recently Completed; definition below (kept live: `headless-ask-discovery` and `review-commentary-widening` build on it).
- `tool-schema-convergence` (FE-1163) — next build: sweep over the 46-tool provider-facing schema surface. **Stacks on `ln/fe-1164-ask-terminal`** (2026-07-08 decision — the ask cutover reshaped the exchanges family the sweep normalizes). Ledger: `memory/cards/tool-schema-convergence--ledger.md` (now includes the folded blank-carrier row). Definition below.
- `main-editor-chrome` (FE-1169) — **promoted from Horizon 2026-07-08**, opening the chrome batch: persistent Brunch-owned main input editor + UX-level TUI component rendering/affordance refinement (the work FE-1115's DX closure explicitly excluded). Branch `ln/fe-1169-editor-chrome`, stacked on `ln/fe-1164-ask-terminal`. Definition below.

### Recently Completed

- 2026-07-08 **merge wave — ship-gate stack + KA executor lanes to `next`:** FE-1122 (#286), FE-1123 (#287), FE-1124 (#288), FE-1134 (#289), FE-1135 (#291), FE-1136 (#292), FE-1137 (#290), FE-1138 (#293), FE-1152 (#294); KA: FE-1141 (#295), FE-1154 (#297), FE-1155 (#296), FE-1107 (#298). All outer-loop residue from these lanes is batched into `walkthrough-evidence-batch` (FE-1167) — no merged frontier carries open obligations of its own. Definitions archived to `docs/archive/PLAN_HISTORY.md` (2026-07-08 hygiene pass).
- 2026-07-08 `exchange-ask-refinement` (FE-1164) — review-fix closeout landed after the 2026-07-08 review found the first build not-done: the previously skipped structured-exchange answer suite and live web-driver/order proofs are un-skipped; standalone `ask` owns free-text/single/multi collection with custom→editor→broker/unavailable precedence where applicable; multi-choice editor-envelope fallback is live under ask; offer continuations fail loudly without declared `details.continuation`; declared candidate/digest/review options drive the pickers; legacy Pi adapter files (`present-question.ts`, `request-response.ts`, answer/choice/review sources) are deleted while preserved request-detail discriminants remain for capture/sweep/RPC parity. `npm run verify` passed except the first run hit the known roving-suite flake in `git-host-promotion-port`; rerun passed tests and build. **2026-07-08 walkthrough + witness audit addenda (same branch):** F18–F20 ask-surface fixes (free-text markdown-body rendering, free-text comment collection, commentPrompt-presence-gated optional comments); a witness audit then caught and fixed the sweep classifier excluding `ask` toolNames from the capture tail (the "capture semantics stay green" claim had been witnessed only against retired `request_response` fixtures), added the ask render-honesty oracle + `ASK_CONTENT_ELISIONS`, and gave `ask-tuples.md` a writer test with a five-branch outcome matrix. Witness-gap closure then added the real pi-tui runtime-mount battery for registered `ask` and the dedicated `present_candidates` supersession probe.
- Older completed frontiers (the 2026-07-06 wave — FE-1138, FE-1136, FE-1135, FE-1154, the KA executor lane, arc `orchestrator-cutover` — plus `exchange-rendering` FE-1123, `elicitation-gap-guidance` FE-1116, and the 2026-07-01 `component-dx` slices): `docs/archive/PLAN_HISTORY.md`.

### Next

- `walkthrough-evidence-batch` ([FE-1167](https://linear.app/hash/issue/FE-1167/walkthrough-evidence-batch-outer-loop-checks-for-merged-orientation)) — the one batch owning all outer-loop residue from the merged lanes (FE-1134 generative-menu evidence, FE-1137 thin/rich Execute beats + deferred orientation-choice questions, FE-1124 Card 3 + seed worklist, FE-1107 KA-conversation residue). Runs after FE-1164 merges so the beats witness the ask surfaces. Closes arc `deterministic-orientation`. Definition below.
- **Chrome batch (next work area, user-declared 2026-07-08):** opened same day by promoting `main-editor-chrome` (FE-1169) to Active — the frontier now also owns the UX-level component rendering/affordance refinement lane (widened at promotion; it does not wait for the current lanes to merge). Further chrome frontiers open here as scoped.

### Parallel / Low-Conflict

- **Open PRs:** FE-1159 alpha release (#299) · FE-1115 TUI refinements (#301) · KA: FE-1114 executor replanning guards (#300), FE-1166 greenfield executor harness (#302), FE-1141 readable run evidence (#303).
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
- `agent-tracing` — passive trace instrumentation over Pi lifecycle events for debugging plus conduct/quality evaluation: NDJSON emitter extension (introspection-tap discipline), subagent span joining via SDK `session.subscribe`, and a mechanical-trace × semantic-JSONL join for deterministic conduct checks and judged passes. Entry move is an `ln-spike` (dev-gated `nikiforovall/pi-otel` import: do span trees beat `.brunch/debug/` + JSONL projections?) before any port of `JoshMock/the-agency` observability as the in-product base. Traces are dev/eval artifacts, never product truth (no event-spine backdoor). Design: `docs/design/AGENT_TRACING.md`; sibling idea note `docs/design/RLM_INVESTIGATION_PATTERN.md`.
- `web-driver-streaming` — remaining consumer/UI and non-freeform answer legs after the built topology-A relay battery.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

### Retired / Never

- `coherence-first-class` — retired as an independent frontier; future coherence work should be driven only by a concrete triggering frontier that needs it.
- `flue-pattern-adoption` + `framework-direction-stubs` — removed from Horizon 2026-07-08: both are postures/directions, not work items, and both already live in `memory/SPEC.md` §Future Direction ("Adoption patterns from Flue"; "Framework alignment & deferred subsystems"). Re-enter only via a concrete triggering frontier.
- `fixture-vs-real-audit` — dropped 2026-07-08 (action-or-drop call): its operative content graduated into `ln-review`'s contract-lens catalog (the opaque-companion lens carries the untested-against-real angle); run `ln-induct` on fresh evidence rather than keeping a standing audit bucket.
- `roving-suite-flake` — dropped 2026-07-08 (action-or-drop call), **re-open condition met same day**: a builder's `npm run verify` hit the `git-host-promotion-port` full-suite timeout twice in a row during the FE-1164 witness-gap closure (passes in isolation and on other machines/runs). Owed: an `ln-diagnose` session with a trusted repro loop (suspect class: cross-suite resource contention under full-suite load — worker count, tmp-git-repo churn, or port/file-lock collision).
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


### main-editor-chrome

- **Name:** Main editor chrome + TUI component UX & rendering
- **Linear:** [FE-1169](https://linear.app/hash/issue/FE-1169/main-editor-chrome-and-tui-component-ux-refinement)
- **Branch:** `ln/fe-1169-editor-chrome`, stacked on `ln/fe-1164-ask-terminal` (2026-07-08 decision — starts ahead of the lane tie-off; restacks as parents merge)
- **Kind:** bounded feature / presentation-layer production wiring (chrome territory, D22-L/D35-L) + one deliberate SPEC revision (D104-L pass-through rule). Head of the chrome batch. Reframed 2026-07-08 (grill) from the promotion-time definition.
- **Certainty:** proving — the persistent-editor seam (`ctx.ui.setEditorComponent`) is unexercised and carries the unverified render-height assumption; details-driven transcript rendering is a new render path; the component-UX lane is judgment-heavy outer-loop work.
- **Why now / unlocks:** user-declared chrome batch opener (2026-07-08). The DX loop is delivered (FE-1115) but UX-level rendering/affordance quality was excluded from that closure; the ask cutover (FE-1164) unified the answering surface, making its UX seams (esc dynamics, option sub-text, result duplication) newly visible and worth fixing once, canonically.
- **Objective (six threads, grilled 2026-07-08):**
  1. **Main editor chrome (tracer):** wire `BrunchEditorComponent` as the persistent input editor via `ctx.ui.setEditorComponent`. Carries the unverified render-height assumption its first slice must resolve. De-risked by FE-1138 (`Editor`-inside-Brunch-chrome proven on the one-shot seam; shared `.pi/components/editor-lines.ts` rule-strip helpers).
  2. **Ask surface UX:** option rows gain description/rationale sub-text in the unified picker (two-line rows — the same component change serves the consult menu); hierarchical esc — root esc = cancel (terminal, unchanged), nested esc (Other/comment steps) = go back one step (UI-local navigation; no D109-L or A39-L entanglement); `formatAsk` result content moves to the compact unified form (one question block, options as a checklist, selection marked, non-selected struck) replacing the duplicated Question/Answer h2 sections, generalized across free-text/single/multi/comment variants via the five-branch writer golden.
  3. **Details-driven transcript rendering (D104-L revision):** revert the "renderResult = markdown pass-through of content" rule so the TUI renders richly from toolResult `details` — driven primarily by `present_candidates` / `present_review_set` structured content. **Render-honesty survives the revision**: `content` stays the canonical model-facing record (details ⊆ content, elision lists); only the TUI's presentation source changes. Expected breakage: `exchange-family-completeness` and content-golden families change meaning — deliberate, not regression. Record the revision via `ln-sync` at first landing. Review rendering targets the *current* payload shape; the per-item commentary widening stays in Horizon `review-commentary-widening`.
  4. **Mode-reactive input chrome:** remap `shift+tab` from Pi's thinking-level cycle (`app.thinking.cycle`) to operational-mode cycling — D113-L already pins thinking level as policy, so this closes a policy leak; main editor and ask surfaces color border + border-label by projected operational mode (works for two modes; extends to `develop` for free).
  5. **Commands:** keep the `brunch:` namespace. `/brunch:menu` replaces the current top-level create/switch-specification entry; `/brunch:consult` forces the orientation dialog; `/brunch:continue` revives the disabled design (sequenced with the esc work — the natural "re-present the open ask" verb); `/brunch:mode` exists. Lexicon: **menu** = top-level workspace/spec navigation; **consult** = orientation dialog — distinct surfaces, distinct commands.
  6. **Border semantics + theme expansion:** every bordered surface declares a semantic role, no raw border colors (lock-in invariant candidate). Two channels: **mode-reactive** (main editor, ask surfaces) vs **surface-identity** (workspace dialog, consult menu — stable, visibly independent of mode). Pre-session menu surfaces take the injected theme (the D22-L boot gate currently renders unthemed). `dev:components` demo expands to witness text variations, border levels, and both channels in light/dark.
- **Annotations:** Lights up: Brunch-owned persistent input chrome; the details-driven TUI render path. Stabilizes: the chrome projection seam (D35-L single-renderer discipline); border semantics as the component family's theming contract; the unified ask surface's UX register. Retires: the render-height assumption (thread 1); the D104-L pass-through rule (thread 3, deliberate revision).
- **Absorbed obligations:** `workspace-dialog-headless-guard` (`workspace/index.ts:51` ungated `ctx.ui.custom` — fix in the first chrome slice); the never-run physical-terminal wheel smoke beat (FE-1115 residual, iTerm2/Kitty/Ghostty).
- **Explicitly out:** `develop` mode / `engineer` agent (own Horizon frontier, D98-L revision — see `develop-mode`); per-item review commentary widening (Horizon `review-commentary-widening`); headless ask discovery (Horizon, A39-L).
- **Current execution pointer (updated post judo-review + compact ask result 2026-07-08):** built so far: A1+A2+A3 (ask rows, hierarchical esc, compact `formatAsk` content/goldens), C1 (shift+tab cycle), D1 (menu rename). Judo review over the first wave added two fix cards that now gate the remainder: `memory/cards/main-editor-chrome--keybinding-scope-fix.md` (in-process thinking-cycle suppression — C1's shared-file write is a cross-product defect — plus alt+m restore + footer hint) and `main-editor-chrome--ask-step-refactor.md` (StepResult/comment-step consolidation, choice-row hoist, exported re-present loop). Remaining order: the two fix cards (parallel-safe) → `memory/cards/main-editor-chrome--details-driven-rendering.md` (D104-L rewrite; consumes compact ask form; review-set renderer deliberately unscoped until this lands) → C2 border-by-mode (`memory/cards/main-editor-chrome--mode-reactive-chrome.md`) → D2–D3 (`memory/cards/main-editor-chrome--commands-and-menus.md`) → D4 (independent, anytime) → `memory/cards/main-editor-chrome--theme-demo-expansion.md` last.
- **Traceability:** D22-L (Brunch-owned TUI boot / chrome mounting), D35-L (chrome as Brunch projection over Pi UI primitives), D104-L (revised by thread 3), D106-L (self-contained echoes constrain the compact formatAsk form), D113-L (pinned thinking level justifies the remap), D34-L (command containment — keep namespace, collision test), FE-1138 precedent; `src/.pi/components/TOPOLOGY.md`, `src/.pi/extensions/chrome/TOPOLOGY.md`, `src/.pi/extensions/exchanges/TOPOLOGY.md`, `src/dev/TOPOLOGY.md`.

### walkthrough-evidence-batch

- **Name:** Walkthrough evidence batch — outer-loop checks for the merged orientation and executor lanes
- **Linear:** [FE-1167](https://linear.app/hash/issue/FE-1167/walkthrough-evidence-batch-outer-loop-checks-for-merged-orientation)
- **Branch:** tbd at pickup (off `next` after FE-1164 merges — the beats must witness the ask surfaces, not the retired ones)
- **Kind:** verification batch / walkthrough evidence + external-residue closure. Arc: `deterministic-orientation` (closing member).
- **Certainty:** proving — the evidence is the point; conduct quality on the generative flows and Execute-mode assessment is unwitnessed.
- **Why now / unlocks:** created by the 2026-07-08 hygiene fold — FE-1134, FE-1137, FE-1124, and FE-1107 all merged with the *same* unowned residue ("outer walkthrough evidence on a re-braided branch"), leaving three frontiers permanently un-closable. This batch owns all of it in one place with one trigger.
- **Objective (four residue groups):**
  1. **FE-1134 evidence:** live walkthrough beats for the orientation menu's generative options (propose/project), using the FE-1124 seed variants; menu→conduct routing evidence via session JSONL skill reads.
  2. **FE-1137 evidence:** Execute-mode entry beats on thin vs rich seeds (assessment honesty: Ask on thin, Proceed on rich); capture evidence on the two deferred orientation-choice questions — `continue`/`proceed` semantics and the sticky-posture candidate (a D98-L-sensitive reversal; route through `ln-grill`/`ln-spec` if evidence says revisit).
  3. **FE-1124 remainder:** Card 3 review variants (`memory/cards/walkthrough-batch-2--seed-variants.md`) + the seed-variation worklist; findings continue in `TESTING_FINDINGS.md`.
  4. **FE-1107/KA residue:** confirm executor-card GC (incl. `memory/cards/executor-run-integrity--plan-projection.md`), settle FE-1107 close-or-narrow, hold the demo session (`docs/DEMO_STACK_OVERVIEW_2026-07-06.md`, delete after), then the owed post-KA `ln-plan` pass.
- **Annotations:** Retires: the unwitnessed-conduct uncertainty on generative menus and Execute entry (the arc's "one witnessed e2e run per generative flow" obligation). Closes: arc `deterministic-orientation`; the FE-1107 disposition question.
- **Acceptance sketch:** per-flow walkthrough beats recorded against `TESTING_FINDINGS.md` with session JSONL evidence; the two deferred FE-1137 questions answered or explicitly re-routed; KA residue dispositions recorded in PLAN; arc marked done only when its done-definition holds (incl. topology reconciliation).
- **Verification:** manual outer loop per `docs/praxis/manual-testing.md`, with session JSONL + debug-mirror artifacts as the recorded oracles.
- **Traceability:** D98-L, D109-L, D40-L, D74-L, D101-L/D102-L; TESTING_PLAN.md goals 6/7; arc `deterministic-orientation` done-definition.

### alpha-release-readiness

- **Name:** Alpha release readiness — packaging, model allowlist, auth onboarding
- **Linear:** [FE-1159](https://linear.app/hash/issue/FE-1159/alpha-release-readiness-packaging-model-allowlist-auth-onboarding)
- **Branch:** `ln/fe-1159-alpha-release`
- **Kind:** structural — distribution/packaging seam + a new auth/model-policy seam + first-run onboarding behavior.
- **Status:** active. Admitted 2026-07-07 (spike → grill → spec, same day); all five alpha-readiness implementation threads are built (model allowlist, packaging fixes, release verification smoke, `brunch login`, and no-auth gate). Outer walkthrough ran 2026-07-07 (evidence below); PR [#299](https://github.com/hashintel/brunch/pull/299) submitted same day. Remaining closeout: merge, then publish (see §Publish mechanics).
- **Certainty:** mixed — packaging fixes are `earned` (spike-witnessed defects, closure-shaped); allowlist/no-auth-gate/login are `proving` (first tracer through a new seam).
- **Why now / unlocks:** the ship gate's audience is colleagues/collaborators including non-Pi users; the published package currently crashes at boot for any fresh install, and a no-auth user gets a silent dead TUI. Nothing else on the plan makes Brunch installable.
- **Objective (five threads, from spike evidence + settled design):**
  1. **Packaging fixes (earned, built 2026-07-07):** `build:pi-assets` preserves compiled output while copying prompt/subagent/reference markdown assets, and `drizzle-orm`/`drizzle-typebox` are runtime dependencies.
  2. **Model allowlist (proving, built 2026-07-07):** code-owned ordered fall-through list of `provider/model/thinking` entries (`anthropic/claude-sonnet-4-6` then `openrouter/anthropic/claude-sonnet-4.6`, both `thinking: low`); first entry with resolvable auth wins; enforced by a Brunch-owned `ModelRegistry` through the existing `agentServices.modelRegistry` seam (D113-L), with scoped `/model` cycling limited to the allowlist.
  3. **No-auth gate (proving, built 2026-07-07):** workspace-dialog warning banner (non-blocking); UI-capable orientation junctures + kick do not fire when no allowlisted model resolves (D115-L, I59-L); no-UI degraded paths keep the `no_model_available` origination backstop.
  4. **`brunch login` (proving, built 2026-07-07):** standalone CLI subcommand over Pi's public `AuthStorage` (OAuth callbacks + API-key set), writing to `~/.pi/agent/auth.json` (D114-L). No `pi login` CLI exists to delegate to. The implementation uses Pi 0.80.3's canonical API-key credential tag (`type: 'api_key'`) and re-runs Brunch model-policy resolution for the exit report.
  5. **Release verification loop (built 2026-07-07; review-tightened 2026-07-08):** `npm run check:release-pack` packs the tarball, asserts the release-critical prompt registry, runtime prompt/subagent/reference markdown assets, and 8 live skill files in the tar listing, installs into an isolated prefix using the platform-correct npm bin path, and runs the installed `brunch --mode print` from a foreign cwd so the clobber/dependency class of defect cannot silently return.
- **Retires:** the "does the built package work elsewhere?" uncertainty (spike answered: yes, once the two defects are fixed); the implicit "first Pi-available model" default; the silent no-auth boot.
- **Lights up:** installability for non-Pi colleagues; the first onboarding surface (`brunch login` + warning copy); a release check that can join `npm run verify` or CI.
- **Depends on:** D39-L (sealed profile), D34-L (built-in command containment — registry-layer enforcement, not chrome suppression), D109-L (juncture semantics the no-auth gate sits upstream of), D113-L/D114-L/D115-L, A38-L, I59-L, req 1/29.
- **Blocked by:** nothing hard. The KA stack merged to `next` 2026-07-07; this branch sits directly on `next`.
- **Publish mechanics (resolved 2026-07-07):** manual-local via release-it from a `next`-trunk checkout, matching how `main` published 0.2.0–0.8.0 (no publish CI exists; npm already hosts the old product at `latest: 0.8.0`, so the alpha rides dist-tag `alpha` and leaves `latest` untouched). `.release-it.json` enforces `requireBranch: next`, tags with the bare version (matching main's tag style), and runs `npm run check:release-pack` as the pre-publish hook (the smoke now includes a DB-touching rpc leg that proves the installed better-sqlite3 native binding). First publish: `npm run release -- --no-increment` (ships the already-set `1.0.0-alpha.0`); subsequent alphas: `npm run release` (release-it bumps the prerelease). Requires npm auth with `@hashintel` publish rights — the only human-gated step. `better-sqlite3` is pinned exact (`12.11.1`) so the repo `allowScripts` entry stays verifiable; note that consumer installs are governed by the *user's* script policy, not our package.json — `npx @hashintel/brunch@alpha` works because better-sqlite3 resolves its prebuilt binding, which the smoke's DB leg now witnesses.
- **Verification:** the release-verification loop (thread 5) is the frontier's own oracle family; I59-L is covered by no-auth `ModelRegistry` juncture tests (including no-UI degradation), workspace-dialog banner assertion, boot preflight propagation, single-source copy checks, and the unchanged origination backstop test; `brunch login` is exercised against a scratch `PI_CODING_AGENT_DIR`. A38-L conduct reproducibility continues to validate via alpha-user walkthroughs.
- **Outer walkthrough evidence (2026-07-07, scratch `PI_CODING_AGENT_DIR` + seeded `workspace-alpha-grounding` workbench):** (1) no-auth boot showed the workspace-dialog warning banner, entered the session without a J1 juncture, and wrote an empty `auth.json`; (2) `brunch login` with a real OpenRouter key wrote Pi's `auth.json` and the exit report resolved the OpenRouter allowlist entry; (3) the *first real provider turn then 400ed on every Anthropic-family backend* — `read_graph`'s params schema carried a top-level `oneOf` (FE-1053) that Anthropic rejects; the faux-provider suite structurally could not catch this. Fixed on-branch (commit `FE-1159: Drop read_graph top-level oneOf…`): union removed, companions enforced by the executor's `structural_illegal` diagnostics, Tier-2 regression oracle asserts no provider-facing tool schema has a top-level union. (4) Post-fix: junctures fire, banner gone, full elicitation loop verified live on both allowlist entries — OpenRouter kick ≈11s, question turn ≈13s incl. one tool call, graph writes landed (incl. an agent self-recovery from a `STRUCTURAL_ILLEGAL` batch); Anthropic-direct kick ≈14.5s after `brunch login` with an Anthropic API key. A38-L latency at `thinking: low` felt acceptable; no conduct anomalies observed.
- **Current execution pointer:** branch tie-off (`gt submit`) and publish; no prepared scope file. Packaging, allowlist, release-check, `brunch login`, no-auth gate, the walkthrough-found `read_graph` schema fix, and PR-299 review fixes all landed as FE-1159 commits on this branch (SHAs churn under gt restacks; find them by the `FE-1159:` prefix). Post-A38-L allowlist revision candidates named by the user: `openai/gpt-5.5`, `openai/gpt-5.4-mini` (verify exact pi-ai catalog ids before adding).
- **Traceability:** req 1, req 29; D113-L, D114-L, D115-L; A38-L; I59-L; SPEC §Future Direction (Brunch-owned config home, role-tiered model picks — both deferred).

### tool-schema-convergence

- **Name:** Tool-schema convergence sweep — one adapter, two schema sources, build-time provider legality
- **Linear:** [FE-1163](https://linear.app/hash/issue/FE-1163/tool-schema-convergence-one-adapter-two-schema-sources-build-time)
- **Branch:** `ln/fe-1163-tool-schema-convergence`, **stacked on `ln/fe-1164-ask-terminal`** (2026-07-08 re-sequencing: the ask cutover reshaped the exchanges family this sweep normalizes; supersedes "off `next` after FE-1159 ties off")
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
- **Status:** active. Substrate/verify policy is built on PR #302; follow-up live failure scope is open in `memory/cards/executor-run-environment--actionable-slice-request.md` (buildable next after FE-1166 tie-off). Current scope cards: `memory/cards/executor-run-environment--substrate-verify.md`; `memory/cards/executor-run-environment--actionable-slice-request.md`.
- **Objective:** Separate run substrate and verify target from source-copy policy so greenfield fixture runs can use an isolated run directory and product-owned verification profile instead of always starting from a host git worktree and hardcoded `npm run verify`.
- **Traceability:** FE-1114 follow-up live-run evidence; `src/executor/worktree.ts`, `src/executor/test-result.ts`, `src/app/test-runner-port.ts`, `src/.pi/extensions/executor/execute-run-create/index.ts`; follow-up worker-request evidence from run `run-mrbyf8u9` recorded in `memory/cards/executor-run-environment--actionable-slice-request.md`.

<!-- elicitation-gap-guidance (FE-1116) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D99-L, D101-L, D102-L, I52-L, I56-L, closure oracle
     src/graph/__tests__/elicitation-gap-guidance-closure.test.ts, docs/archive/SESSION_LOCAL_ELICITATION_GAPS.md. -->

<!-- executor-run-observer (FE-1141) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #295);
     durable truth: execute.* read projections, run-scoped brunch.updated topics, src/executor/TOPOLOGY.md,
     src/web/TOPOLOGY.md. Follow-on KA work continues on #300/#302/#303. -->

<!-- executor-run-integrity (FE-1154) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #297);
     retained card executor-run-integrity--plan-projection.md GCs via FE-1167's KA residue item. -->

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
    alpha-release-readiness (FE-1159)
      status: built + walkthrough-witnessed; PR #299 awaiting merge; publish = merge -> check:release-pack -> npm publish
      branch: ln/fe-1159-alpha-release (directly on next)
      depends_on: D39-L, D34-L, D109-L, D113-L, D114-L, D115-L
    exchange-ask-refinement (FE-1164)
      status: built + review-verified 2026-07-08; awaiting gt submit + tie-off
      branch: ln/fe-1164-ask-terminal (stacked on tied-off ln/fe-1115-tui-refinements-1, PR #301)
      depends_on: D116-L, D37-L, D105-L, D106-L, D110-L/I57-L (capture semantics preserved)
      feeds: -[dissolves pending-exchange scan]-> headless-ask-discovery (Horizon, A39-L)
             -[re-expresses payload]-> review-commentary-widening (Horizon)
    tool-schema-convergence (FE-1163)
      status: next build; ledger authored + re-based 2026-07-08 (13 rows / 46 tools, incl. folded blank-carriers row)
      branch: ln/fe-1163-tool-schema-convergence -[hard]-> stacks on ln/fe-1164-ask-terminal (2026-07-08 decision)
      shape: coverage frontier; ledger memory/cards/tool-schema-convergence--ledger.md
    main-editor-chrome (FE-1169)
      status: promoted from Horizon + reframed via grill 2026-07-08 (six threads: editor tracer, ask UX,
              D104-L revision, mode-reactive chrome, brunch: commands, border semantics); scoping next
      branch: ln/fe-1169-editor-chrome -[hard]-> stacks on ln/fe-1164-ask-terminal
      absorbed: workspace-dialog-headless-guard, physical-terminal wheel smoke beat
      revises: D104-L (pass-through rule; render-honesty preserved) -> record via ln-sync at first landing
      depends_on: D22-L, D35-L, D113-L; FE-1138 Editor-in-chrome precedent
      feeds: -[groundwork]-> develop-mode (Horizon; mode-cycling key + border-by-mode land mode-agnostic)

  Next:
    walkthrough-evidence-batch (FE-1167)
      arc: deterministic-orientation (closing member)
      status: admitted 2026-07-08 (hygiene fold of FE-1134/FE-1137/FE-1124/FE-1107 residue)
      branch: tbd -[hard]-> after FE-1164 merges (beats must witness ask surfaces)
      owns: generative-menu evidence, thin/rich Execute beats + deferred orientation-choice questions,
            FE-1124 Card 3 + seed worklist, FE-1107/KA residue (card GC, close-or-narrow, demo session, post-KA plan pass)

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
