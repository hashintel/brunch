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

## Sequencing

### Active

- `orchestrator-tool-port` (FE-1107) — **D98-sensitive proving frontier, intentionally deferred.** Parked on its own branch while the remaining SPEC-mode frontiers are clarified first.

### Recently Completed

- 2026-07-01 `elicitation-gap-guidance` (FE-1116) — the spec-global persisted `elicitation_gaps` register and its count-based readiness scoring are retired; the asking agenda is now a session-local `brunch.elicitation_scratchpad` fold seeded from a thin graph-fact seed; `latestExpectedBand(kind)` is the single band scalar; and settlement (`advisory` | `settled`, orthogonal to `basis`) is materialized and command-enforced (D99-L, I52-L). Closure oracle: `src/graph/__tests__/elicitation-gap-guidance-closure.test.ts` grep-guards the retired names. All co-located `TOPOLOGY.md` homes named in `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` are reconciled; that doc's status flips to landed.
- 2026-07-01 `portable-resource-paths--manifest-location` (bugfix, `ln-induct` from PR #273) — skill manifest `location` is now the loader-resolved absolute `Skill.filePath` instead of a hardcoded repo-relative string, so it resolves under any process cwd or `dist/`-only install; dead `liveBrunchSkillRepoPath`/`bundledAgentBodyRepoPath` builders removed; the two prompt-composition goldens normalize the machine root to a `<PKG>/…` token. See SPEC §Acknowledged Blind Spots "Live-vs-harness wiring divergence".
- 2026-07-01 `promoted-run-path-normalization` (tooling) — `.fixtures/runs/**` no longer leaks developer-workstation absolute paths; `npm run check:promoted-run-paths` guards committed evidence going forward. `.fixtures/seeds/**` is untouched (separate seed-curation concern). Not a `fixture-vs-real-audit` sweep.
- 2026-06-30 `structured-exchange-affordance` (FE-1108) — exchange authoring guidance now teaches present-side response rules and review-set nested companions at the boundary; one unearned exchange projection adapter was inlined into its RPC consumer, and topology inventories name the retained model-facing/projection homes.
- 2026-06-30 `elicitor-project` (FE-1085) — project canonicalized as a first-level live skill home over existing exchange/review-set seams; A33-L validated, D100-L added, and the prompt manifest witnesses `project`.
- 2026-06-29 `spec-structural-relief` — SPEC slimmed from long-form register to compact live index; pre-slim snapshot archived in `docs/archive/SPEC_HISTORY.md`.
- 2026-06-26 `renderer-golden-coverage` (FE-1091) — context pipeline done; prompt/subagent topology flattened and locked.
- 2026-06-26 `data-model-legibility` (FE-1090) — reference substrate complete; generated ontology tables and authored graph heuristics have canonical homes.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

- _None distinct._

### Parallel / Low-Conflict

- `component-dx` (FE-1115) — Pi TUI component DX: the standalone real-terminal preview harness (shipped), plus ongoing refinement of existing `.pi/components` and new ones as product needs surface them; independent of the active elicitor/orchestrator stack.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

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
- **Status:** active. First slice (the preview harness) shipped; refinement/new-component slices are open-ended and get their own `memory/cards/component-dx--<slug>.md` cards on this branch.
- **Current execution pointer:** `memory/cards/component-dx--component-preview-harness.md` (first slice, done).
- **Objective:** Give `.pi/components` authors a fast, faithful iteration loop, then use it to refine existing components and build new ones as product needs surface them.
- **Acceptance (first slice, done):**
  - `npm run dev:components` (and a `tsx watch`-backed variant) boots a real `ProcessTerminal` + `TUI`; no workspace, session, or DB is required.
  - A registry maps each previewable component to the same presentation contract its real call site uses (`ctx.ui.custom(factory, options)`): `{ overlay: true, overlayOptions }` for overlay components (workspace-dialog), no options for inline-swap components (axis-picker, multi-choice-picker) — not a uniform "always overlay" assumption.
  - A small `custom()` shim mirrors pi-coding-agent's real `showExtensionCustom` branching closely enough that nested overlays (a previewed component calling `tui.showOverlay` on the `tui` it's given) work without special-casing.
  - Theme is a real `Theme` instance (constructed via the public `Theme` class from `@earendil-works/pi-coding-agent`), not a duck-typed stand-in; it satisfies both `LabTheme` and `WorkspaceDialogTheme` call sites structurally.
- **Open (not yet scoped):** refine existing components' rendering/affordances/copy; build new `.pi/components` as needed. Both carried-forward findings from the first slice are resolved: the axis-picker harness/production presentation drift is fixed (harness now drives the picker via `tui.addChild`/`tui.setFocus`, matching production's inline swap), and the unwired `tui-lab` slash command (`registerBrunchTuiLab`) is retired — `TuiStyleLabComponent` now lives at `.pi/components/tui-lab/style-lab-component.ts` as a preview-harness-only reference component. The harness's lane coverage gap is also closed: `static-preview.ts` adds the transcript-message-renderer lane (`alternatives`, via a captured `registerBrunchAlternatives` renderer) and the persistent-chrome lane (`chrome-header`), alongside the original `ctx.ui.custom` lane. The footer lane (`ui.setFooter`) is deliberately deferred — driven by live session state, and rides the scope the user wants to refine later. A fourth, `[experimental]` entry (`brunch-editor`) previews the `ctx.ui.setEditorComponent` slot: `BrunchEditorComponent` wraps `CustomEditor` in a runtime-state-labeled bordered box (design exploration only, not yet wired into production chrome) — first of a planned family that also covers the `request_*` question-form pickers (`request_response` etc.), which the user wants to refine next using the same `projectBorderedChrome` primitive.
- **Traceability:** none required for the harness itself — dev tooling only. Component refinement/creation slices add SPEC links only if they change durable product boundaries. Extends the "Build/test convention" section of `src/.pi/components/TOPOLOGY.md` and the "Launcher Surface" section of `src/dev/TOPOLOGY.md`.

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

### elicitor-project

- **Name:** Elicitor `project` capability — cross-plane derivation
- **Linear:** [FE-1085](https://linear.app/hash/issue/FE-1085) — elicitor project capability design
- **Branch:** `ln/fe-1085-elicitor-project-prep`
- **Kind:** structural / capability
- **Status:** done.
- **Certainty:** proving.
- **Retires:** A33-L by materializing the branch-implied distinct `project` surface into canon and the live skill manifest.
- **Lights up:** requirements/design/oracle cross-plane derivation over the frozen elicitor capability axes.
- **Objective:** Materialize cross-plane derivation as a distinct first-level live `project` move over the existing exchange triad and review-set commitment path, without introducing a new tool, schema family, or direct graph-write seam.
- **Acceptance:** done.
  - `memory/SPEC.md`, `memory/PLAN.md`, and the touched parent topology homes state one consistent shape: `project` is a distinct first-level live skill home, not a `generate` branch.
  - The live skill manifest includes `project`, and its guidance covers accepted-graph derivation lanes such as intent → design and design → oracle.
  - `project` reuses `present_candidates`, `request_response`, `present_review_set`, and the existing `map` / review-set commitment boundary; it does not add a new product tool or exchange schema family.
  - D97-L provenance applies: cite ontology/render surfaces, do not copy vocabulary lists into the skill.
- **Traceability:** D95-L, D96-L, D97-L / A33-L / I51-L, I54-L; D60-L.

### structured-exchange-affordance

- **Name:** Structured-exchange affordance hardening
- **Linear:** [FE-1108](https://linear.app/hash/issue/FE-1108/harden-structured-exchange-affordances)
- **Branch:** `ln/fe-1108-structured-exchange-affordance`
- **Kind:** hardening / earned contract cleanup
- **Status:** done.
- **Certainty:** earned.
- **Absorbs:** the former `exchange-symmetry-audit` cleanup; the remaining delete pass is residue of exchange hardening, not a separate dependency boundary.
- **Closes:** recurring "enforced but untaught" failures where the model sees legal schemas but not the intended present-vs-response, discriminant-companion, or nested review-set payload contract.
- **Canonicalizes:** structured-exchange schema descriptions, prompt guidelines, renderer/context language, and the final kept-vs-deleted exchange projection/render inventory around `present_question`, `present_candidates`, `present_review_set`, `request_response`, and their companion detail shapes.
- **Objective:** Tighten the live structured-exchange authoring contract after the `request_response` collapse so the model-facing surface teaches the legal shape directly instead of relying on deep validator failures or legacy pairing prose, then delete any exchange-layer mirrors that no longer earn a shared home.
- **Acceptance:** done.
  - Present-side choice vs freeform vs candidate selection rules are explicit where the model authors them; stale legacy request-tool pairing language is removed.
  - Review-set nested payload companions (`grounding`, `pitch`, `epistemicStatus`, related discriminants) are described or re-shaped at the authoring boundary, not only rejected deep in graph validation.
  - `present_candidates` / `request_response` wording stays aligned with I51-L: recognition only until a later review-set or graph-mutation commitment path.
  - Unjustified `projections/exchanges/*` and `agents/contexts/exchanges/*` symmetry survivors are inlined or deleted; retained modules name a real multi-consumer or model-facing-text ownership reason.
  - `src/projections/TOPOLOGY.md` and the touched exchange topology homes agree on the final kept-vs-deleted inventory.
  - Tests cover the affordance-level shapes that previously generated review findings, not just the deepest schema rejection points.
- **Traceability:** I23-L, I51-L, I53-L, D27-L, D37-L, D38-L, D65-L, D66-L, D84-L, D86-L, D96-L, D100-L; `docs/design/STRUCTURED_EXCHANGE_COLLAPSE.md`, `src/projections/TOPOLOGY.md`, `src/agents/contexts/exchanges/TOPOLOGY.md`.

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
    elicitation-gap-guidance, structured-exchange-affordance, elicitor-project, spec-structural-relief, renderer-golden-coverage, data-model-legibility

  Next:
    none

  Parallel / Low-Conflict:
    component-dx (FE-1115)

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
