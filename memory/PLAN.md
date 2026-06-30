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

**Live arc.** The remaining active initiative is the **elicitor-capability-spine** arc (`capture` / `generate` done, `project` next). Closed arc detail no longer lives in the rolling plan.

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

### elicitor-capability-spine — ◐ active

- **Goal:** build `capture` / `generate` / `project` over the frozen `strategy` / `lens` / `method` axes (A35-L), on top of the skill-substrate arc.
- **Members:**
  - `capture` ✓ done via generalized capture (D80-L–D82-L).
  - `generate` ✓ done through promoted real-model fan-out evidence (FE-1059): one plane-parameterized `generate-proposal` method, `present_candidates` unstubbed, fan-in as method conduct (`pick` / `synthesize` / `compose`), promoted I51-L no-write evidence.
  - `project` → `elicitor-project` (FE-1085), **active, design-gated** (A33-L): cross-plane derivation may fold into `generate` or need a distinct surface.
  - `acquire` rides the completed subagent-reconciliation substrate (A34-L), not its own frontier.
- **Done-definition:** all three capabilities carry promoted real-model evidence; no capability remains a stub or a method-less axis member.
- **Anchors:** D95-L, D96-L; A31-L–A35-L; I51-L.

## Sequencing

### Active

- `elicitor-project` (FE-1085) — **design-gated proving frontier.** Cross-plane derivation (requirements -> design, design -> oracles) remains undesigned under A33-L; run `ln-design` before scope/build.
- `orchestrator-tool-port` (FE-1087) — **D98-sensitive proving frontier.** Port the external `brunch cook` orchestrator into CODE/executor tooling, not a separate execute/orchestrator product mode.
- `exchange-symmetry-audit` — **earned cleanup.** Delete-oriented audit of the exchange projection/renderer split; not a capability blocker.
- `structured-exchange-affordance` — **earned hardening.** Collapse recurring discriminant-companion and nested-payload affordance failures into clearer schema/tool contracts.
- `elicitation-gap-guidance` — **proving frontier.** Generate "what next?" gap guidance from graph shape/readiness, distinct from ranking already-registered gaps.

### Recently Completed

- 2026-06-29 `spec-structural-relief` — SPEC slimmed from long-form register to compact live index; pre-slim snapshot archived in `docs/archive/SPEC_HISTORY.md`.
- 2026-06-26 `renderer-golden-coverage` (FE-1091) — context pipeline done; prompt/subagent topology flattened and locked.
- 2026-06-26 `data-model-legibility` (FE-1090) — reference substrate complete; generated ontology tables and authored graph heuristics have canonical homes.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

- _None._

### Parallel / Low-Conflict

- _None._
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Horizon

- `compaction-and-conflict-widening` — long-horizon continuity through compaction.
- `fixture-vs-real-audit` — `ln-induct` candidate for real-vs-fixture shape gaps (tool ids, orphan tool results, provider payload assumptions).
- `web-driver-streaming` — remaining consumer/UI and non-freeform answer legs after the built topology-A relay battery.
- `flue-pattern-adoption` — post-POC harness-pattern adoption.
- `framework-direction-stubs` — discretionary structural stubs only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

### Retired / Never

- `coherence-first-class` — retired as an independent frontier; future coherence work should be driven only by a concrete triggering frontier that needs it.

## Frontier Definitions

### orchestrator-tool-port

- **Name:** Port cook orchestration into CODE/executor tools
- **Linear:** [FE-1087](https://linear.app/hash/issue/FE-1087/port-cook-orchestrator-into-execute-mode-tools)
- **Branch:** tbd
- **Kind:** structural / execute-mode tool boundary
- **Status:** active; first scope file exists but must be reconciled against D98-L before build.
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
- **Status:** active; design-gated by A33-L.
- **Certainty:** proving; the first deliverable is a design verdict, not code.
- **Retires:** A33-L by deciding whether cross-plane derivation is a `generate` extension or a distinct `project` surface.
- **Lights up:** requirements/design/oracle cross-plane derivation over the frozen elicitor capability axes.
- **Objective:** Decide whether cross-plane derivation folds into `generate` with an upstream-graph input or needs a distinct surface for target-plane nodes + connecting cross-plane edges.
- **Acceptance:**
  - Run `ln-design` with at least three module shapes and a recommendation.
  - If distinct, subsequent scope/build uses the review-set path for commitment (I51-L) and role-named `mutateGraph` grammar for edges.
  - The old `oracle-design-plan-graphs` horizon concern is resolved here: lifting oracle/design/plan planes beyond stubs is either `project` itself or a direct consequence of the chosen `project` shape, not a separate frontier until design proves otherwise.
  - D97-L provenance applies: cite ontology/render surfaces, do not copy vocabulary lists into the skill.
- **Traceability:** D95-L, D96-L, D97-L / A33-L / I51-L; D60-L.

### exchange-symmetry-audit

- **Name:** Exchange-surface three-layer symmetry audit
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** refactor / earned cleanup
- **Status:** active candidate, not capability-blocking.
- **Certainty:** earned.
- **Deletes / retires:** unjustified exchange projection/context mirrors that exist only for symmetry.
- **Locks in:** shared exchange layers exist only for multi-consumer semantics; TUI presenters stay local.
- **Objective:** Confirm each retained `projections/exchanges` and `agents/contexts/exchanges` file earns its place; delete symmetry regrowth where single-owner reads were mirrored into shared layers only for shape symmetry.
- **Acceptance:** Retained files have named multi-consumer/shared-semantics justification; unjustified mirrors are deleted; TUI presenters stay local and exchange context renderers stay durable markdown/text/TOON only.
- **Traceability:** D27-L, D65-L, D66-L.

### structured-exchange-affordance

- **Name:** Structured-exchange affordance hardening
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** hardening / earned contract cleanup
- **Status:** active candidate.
- **Certainty:** earned.
- **Closes:** recurring "enforced but untaught" failures where the model sees legal schemas but not the intended discriminant/companion contract.
- **Canonicalizes:** structured-exchange schema descriptions and renderer/context language around discriminants, companion fields, and nested payloads.
- **Objective:** Audit the structured-exchange request/present/review payload surface after the `request_response` collapse and make the legal shape obvious at the model boundary.
- **Acceptance:** Nested review-set payload shape and discriminant-companion expectations are described or re-shaped where the model authors them; stale request-tool pairing language is gone; tests cover the affordance-level shape that previously produced review findings.
- **Traceability:** I23-L, D37-L, D38-L, D84-L, D86-L; `docs/design/STRUCTURED_EXCHANGE_COLLAPSE.md`.

### elicitation-gap-guidance

- **Name:** Elicitation gap guidance from graph shape
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** structural / elicitor guidance
- **Status:** active candidate.
- **Certainty:** proving.
- **Lights up:** model-facing "what next?" guidance derived from graph topology, readiness bands, and current elicitation state.
- **Stabilizes:** the boundary between generated gap guidance, advisory graph capture, persisted `reconciliation_need` records, and `elicitation_gap` records.
- **Objective:** Give the elicitor a graph-shaped asking agenda for next useful questions without turning prompt examples into a parallel gap ontology.
- **Acceptance:** Guidance is derived from current graph/readiness context and rendered into elicitor context; it distinguishes suggested next questions from settled graph truth and advisory early outer-band signal; existing registered gaps remain rankable but are not the only source of asking guidance.
- **Traceability:** D56-L, D64-L, D65-L, D94-L, D97-L, D99-L; I52-L.

## Dependencies

```text
frontiers:
  Active:
    elicitor-project
      status: design-gated
      depends_on: elicitor-generate, D95-L, D96-L, I51-L
      retires: A33-L

    orchestrator-tool-port
      status: D98-sensitive
      depends_on: D39-L, D90-L, D91-L, D92-L, D93-L, I49-L, D98-L
      active_scope: memory/cards/orchestrator-tool-port--plan-check-tool.md

    exchange-symmetry-audit
      status: earned cleanup
      depends_on: exchange surface being mostly built

    structured-exchange-affordance
      status: earned hardening
      depends_on: request_response collapse and review-set proposal payload shape

    elicitation-gap-guidance
      status: proving
      depends_on: readiness bands, data-model legibility, elicitor-generate

  Recently Completed:
    spec-structural-relief, renderer-golden-coverage, data-model-legibility

  Next:
    none

  Parallel / Low-Conflict:
    none

  Horizon:
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
