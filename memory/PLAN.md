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

**Elicitor capability spine (D95-L).** The elicitor build-out is organized as **`capture` / `generate` / `project`** over the frozen `strategy` / `lens` / `method` axes (A35-L).

- **`capture` is done** via generalized capture (D80-L-D82-L).
- **`generate` is implementation-complete through a real-model fan-out witness** on this branch (FE-1059): one plane-parameterized `generate-proposal` method, `present_candidates` unstubbed, fan-in as method conduct (`pick` / `synthesize` / `compose`), and I51-L no-write evidence.
- **`project` is next and design-gated** (A33-L): cross-plane derivation may fold into `generate` or may need a distinct surface.
- **`acquire` rides the completed subagent reconciliation substrate** (A34-L), not its own frontier.

**Context-pipeline coverage (D60-L).** PULL and PROJECT are ledgered and locked; COMPOSE is locked except for its explicit full-stack renderer tripwire; **RENDER remains open** as `renderer-golden-coverage` (FE-870). That frontier is a parallel evidence/quality track, never a ship gate.

```text
context-pipeline/
├── PULL      graph + session reads       ✓ done
├── PROJECT   projections/                ✓ done
├── RENDER    renderers/                  ◐ open: renderer-golden-coverage
└── COMPOSE   system-prompts + skills     ✓ done*

*COMPOSE has one deferred full-stack real-rendered-context tripwire owned by RENDER.
```

**Topology and evidence discipline.** Directory `README.md` files under `src/**` own current topology state. `memory/SPEC.md` owns product contract and architectural decisions; `memory/PLAN.md` owns only rolling frontier state. Scratch probe artifacts under `.fixtures/scratch/` are not durable evidence until reviewed and promoted to `.fixtures/runs/`.

## Sequencing

### Active

- `elicitor-generate` (FE-1059, branch `ln/fe-1059-elicitor-generate`) — **tie-off / evidence sync.** Code slices are built: `present_candidates` is unstubbed; the shared `generate-proposal` method covers intent/design/oracle; and the real-model oracle fan-out witness passes in scratch (`.fixtures/scratch/generate-fan-out/2026-06-24T16-51-13-704Z/`). Remaining branch work is to review/promote that run, update canonical evidence lines, retire the exhausted scope card, and decide whether the optional A1 anti-prompt or manual-TUI fan-in witness belongs on this branch or a follow-up.

### Recently Completed

- 2026-06-24 `subagent-reconciliation` (FE-1054) — foreground/background reconciliation complete through the execute-mode readiness target (D90-L-D93-L/I49-L): shared `AgentManifest`, code-owned background discovery, semi-permeable injected-world child sessions, sovereign grants gated by code-owned `canDelegate`, return rendering, and live `execute` -> `orchestrator` mode with a product-registered stub tool. `code` -> `pi-coder` remains future work.
- 2026-06-24 `readiness-bands-interrogation` (FE-1058) — D94-L/I50-L materialized: derived four-band ladder, two carriers (`gap.band` for asking agenda, plane-derived node bands for projection thresholds), per-kind table deleted, `projection` band added, and goldens/readers reconciled.
- 2026-06-23 `ontology-revision` (FE-1052) — node/edge/detail/spec-kind ontology revision done and archived; forward constraints survive as dependencies for renderer relocking and future coherence/oracle/design/plan graph work.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

- `elicitor-project` — **design-gated.** Cross-plane derivation (requirements -> design, design -> oracles) remains undesigned under A33-L; run `ln-design` before any scope/build.
- `renderer-golden-coverage` — **active parallel coverage track.** Remaining RENDER work: `<session>`, `renderGraphSeed`, `exchanges/*`, `formatRelatedNodesResult` relocation/repair, and the `brunch print` fork.
- `exchange-symmetry-audit` — **earned cleanup.** Delete-oriented audit of the exchange projection/renderer split; not a capability blocker.

### Parallel / Low-Conflict

- `fixture-vs-real-audit` — `ln-induct` candidate for real-vs-fixture shape gaps (tool ids, orphan tool results, provider payload assumptions).
- `elicitation-gap-guidance` — generative graph-shape analysis for "what next?" gaps; distinct from ranking already-registered gaps.
- `structured-exchange-affordance` — recurring discriminant-companion contract lens; most lead fixes landed, but the systemic audit remains available when similar review findings recur.
- `spec-structural-relief` — accepted ledger for future SPEC sharding only if a real context-budget/navigation failure trips it.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

- `coherence-first-class` — bounded coherence verdicts backed by reconciliation needs.
- `compaction-and-conflict-widening` — long-horizon continuity through compaction.
- `web-driver-streaming` — remaining consumer/UI and non-freeform answer legs after the built topology-A relay battery.
- `flue-pattern-adoption` — post-POC harness-pattern adoption.
- `framework-direction-stubs` — discretionary structural stubs only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

## Frontier Definitions

### elicitor-generate

- **Name:** Elicitor `generate` capability — plane-parameterized generative proposal + `present_candidates` un-stub
- **Linear:** [FE-1059](https://linear.app/hash/issue/FE-1059) — elicitor generate capability
- **Branch:** `ln/fe-1059-elicitor-generate`
- **Kind:** structural / capability
- **Status:** active tie-off. Built slices: `present_candidates` tool/projection/renderer + pick path; intent/design/oracle facets under one `generate-proposal` method; progressive-disclosure `references/{intent,design,oracle}.md`; real-boot activation check; real-model fan-out witness harness. Latest scratch run `2026-06-24T16-51-13-704Z` passed on `openai-codex/gpt-5.5`.
- **Certainty:** proving -> earned after evidence promotion. A31-L's fan-out half has a clean scratch witness; A32-L fan-in completion remains a separate manual-TUI proof unless this branch explicitly scopes it.
- **Objective:** Tie off `generate` by promoting reviewed fan-out evidence, updating A31-L/probe observations, and retiring the exhausted scope card. Do not add `fan_in_mode` unless manual/live fan-in proof shows the UI/schema must carry it.
- **Acceptance:**
  - The reviewed run is promoted from `.fixtures/scratch/generate-fan-out/2026-06-24T16-51-13-704Z/` to `.fixtures/runs/generate-fan-out/2026-06-24T16-51-13-704Z/`.
  - `src/.pi/skills/methods/generate-proposal/probes.md` records P3 as observed from the promoted run.
  - `memory/SPEC.md` A31-L records the promoted fan-out evidence and keeps A32-L's fan-in completion honest.
  - `memory/cards/elicitor-generate--fan-out-witness-run.md` is either updated to a completed record for the optional S2 decision or deleted once its state is reconciled.
  - I51-L remains true: `present_candidates` never commits graph truth; commitment remains through review-set approval or the role-named `mutateGraph` grammar.
- **Follow-ups (not required for tie-off):**
  - Optional S2 A1 extractive-oracle anti-prompt no-fire witness.
  - Manual-TUI fan-in completion witness for A32-L compose behavior.
  - Optional subagent proposal diversity: parallel `projector` / reviewer-style fan-out is an enhancement to `generate`, not an independent horizon frontier.
  - `generate-proposal` -> `generate` rename.
  - `capture_candidate` -> review-set commit leg.
  - D97-L refresh of `docs/design/ELICITATION_QUESTIONS.md` as a canonical heuristic-rendering surface.
- **Traceability:** D95-L, D96-L, D97-L / A31-L, A32-L, A35-L / I51-L.

### elicitor-project

- **Name:** Elicitor `project` capability — cross-plane derivation
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** structural / capability
- **Status:** next; design-gated by A33-L.
- **Certainty:** proving; the first deliverable is a design verdict, not code.
- **Objective:** Decide whether cross-plane derivation folds into `generate` with an upstream-graph input or needs a distinct surface for target-plane nodes + connecting cross-plane edges.
- **Acceptance:**
  - Run `ln-design` with at least three module shapes and a recommendation.
  - If distinct, subsequent scope/build uses the review-set path for commitment (I51-L) and role-named `mutateGraph` grammar for edges.
  - The old `oracle-design-plan-graphs` horizon concern is resolved here: lifting oracle/design/plan planes beyond stubs is either `project` itself or a direct consequence of the chosen `project` shape, not a separate frontier until design proves otherwise.
  - D97-L provenance applies: cite ontology/render surfaces, do not copy vocabulary lists into the skill.
- **Traceability:** D95-L, D96-L, D97-L / A33-L / I51-L; D60-L.

### renderer-golden-coverage

- **Name:** Adopt the D83-L context-render house style and lock remaining RENDER-stage surfaces
- **Linear:** [FE-870](https://linear.app/hash/issue/FE-870)
- **Branch:** `ln/fe-870-renderer-golden-context-tools`
- **Kind:** coverage + build / hardening
- **Status:** next / active parallel. Substrate, `<workspace>`, `<specification>`, graph overview/neighborhood renders, and band-filtered graph slice hardening are done. Remaining work needs a fresh `ln-scope` pass.
- **Objective:** Finish the RENDER stage: `<session>`, `renderGraphSeed`, `exchanges/*`, `formatRelatedNodesResult` structural-leak repair + relocation into `renderers/`, and the `brunch print` house-style-vs-status fork.
- **Acceptance:** `src/renderers/README.md` carries the closed ledger; required rows are built in the house style and locked with focused goldens/semantic invariants; no adapter/transport imports enter `renderers/`.
- **Traceability:** D19-L, D52-L, D60-L, D62-L, D83-L.

### exchange-symmetry-audit

- **Name:** Exchange-surface three-layer symmetry audit
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** refactor / earned cleanup
- **Status:** next candidate, not capability-blocking.
- **Objective:** Confirm each retained `projections/exchanges` and `renderers/exchanges` file earns its place; delete symmetry regrowth where single-owner reads were mirrored into shared layers only for shape symmetry.
- **Acceptance:** Retained files have named multi-consumer/shared-semantics justification; unjustified mirrors are deleted; TUI presenters stay local and renderers stay durable markdown/text/TOON only.
- **Traceability:** D27-L, D65-L, D66-L.

## Dependencies

```text
frontiers:
  Active:
    elicitor-generate
      status: tie-off / evidence sync
      proof: scratch A31-L fan-out run passed; needs promotion + canonical evidence updates

  Next:
    elicitor-project
      status: design-gated
      depends_on: elicitor-generate, D95-L, D96-L, I51-L

    renderer-golden-coverage
      status: active parallel coverage
      depends_on: context-pipeline PULL+PROJECT, D83-L, D52-L
      coordinates_with: elicitor-generate (present_candidates render already landed in house style)

    exchange-symmetry-audit
      status: earned cleanup
      depends_on: exchange surface being mostly built

  Parallel / Low-Conflict:
    fixture-vs-real-audit
    elicitation-gap-guidance
    structured-exchange-affordance
    spec-structural-relief

  Horizon:
    coherence-first-class
    compaction-and-conflict-widening
    web-driver-streaming
    flue-pattern-adoption
    framework-direction-stubs
    geolog-and-petri-execution

done anchors:
  generalized-capture -> elicitor-generate, elicitor-project
  subagent-reconciliation -> acquisition arm + future subagent diversity
  readiness-bands-interrogation -> renderer-golden-coverage
  ontology-revision -> renderer-golden-coverage, coherence-first-class, oracle-design-plan-graphs

rules:
  candidates never commit graph truth (I51-L)
  topology READMEs own current subtree state
  scratch evidence is not durable until promoted to .fixtures/runs/
```
