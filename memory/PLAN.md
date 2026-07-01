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

**Live arc.** The **elicitor-capability-spine** arc (`capture` / `generate` / `project`) is done for the current POC capability surface. The retired strategy/lens/method runtime trees are no longer part of live product topology; current capability work routes through the code-owned first-level skill manifest and activity-named skill homes. Closed arc detail no longer lives in the rolling plan.

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

- `elicitation-gap-guidance` — **next proving frontier after exchange hardening.** Derive "what next?" guidance from graph shape, settlement, and readiness rather than only sorting the existing gap register.
- `orchestrator-tool-port` (FE-1107) — **D98-sensitive proving frontier, intentionally deferred.** Parked on its own branch while the remaining SPEC-mode frontiers are clarified first.

### Recently Completed

- 2026-06-30 `structured-exchange-affordance` (FE-1108) — exchange authoring guidance now teaches present-side response rules and review-set nested companions at the boundary; one unearned exchange projection adapter was inlined into its RPC consumer, and topology inventories name the retained model-facing/projection homes.
- 2026-06-30 `elicitor-project` (FE-1085) — project canonicalized as a first-level live skill home over existing exchange/review-set seams; A33-L validated, D100-L added, and the prompt manifest witnesses `project`.
- 2026-06-29 `spec-structural-relief` — SPEC slimmed from long-form register to compact live index; pre-slim snapshot archived in `docs/archive/SPEC_HISTORY.md`.
- 2026-06-26 `renderer-golden-coverage` (FE-1091) — context pipeline done; prompt/subagent topology flattened and locked.
- 2026-06-26 `data-model-legibility` (FE-1090) — reference substrate complete; generated ontology tables and authored graph heuristics have canonical homes.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

1. `elicitation-gap-guidance`

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
- **Traceability:** D95-L, D96-L, D97-L / A33-L / I51-L; D60-L.

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

- **Name:** Elicitation gap guidance from graph shape
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** structural / elicitor guidance
- **Status:** active candidate; sequence second after structured-exchange affordances are tightened.
- **Certainty:** proving.
- **Lights up:** model-facing "what next?" guidance derived from graph topology, readiness bands, and current elicitation state.
- **Stabilizes:** the boundary between the stored `elicitation_gaps` register, a derived asking agenda, advisory graph signal, and persisted `reconciliation_need` follow-up.
- **Objective:** Move the elicitor from "sort the open gap rows" to a richer asking agenda derived from graph topology, readiness/settlement semantics, and current elicitation state, without inventing a second persisted gap ontology.
- **Acceptance:**
  - A read-side asking agenda is derived from current graph + readiness + gap state and rendered into elicitor-facing context.
  - The agenda can surface next useful asks that come from advisory or missing graph structure even when no existing `elicitation_gap` row names them exactly.
  - The contract distinguishes stored gaps, advisory graph signal, and reconciliation follow-up instead of laundering them into one list.
  - Existing `elicitation_gaps` remain rankable and editable, but they become one input to asking guidance rather than the whole asking agenda.
- **Traceability:** D56-L, D64-L, D65-L, D74-L, D94-L, D97-L, D99-L; I50-L, I52-L; `src/session/specification-overview-context.ts`, `src/graph/elicitation-driver.ts`.

## Dependencies

```text
frontiers:
  Active:
    elicitation-gap-guidance
      status: second / proving
      depends_on: readiness bands, data-model legibility, elicitor-generate, and a stable exchange affordance surface for asking/proposal loops

    orchestrator-tool-port
      status: deferred / D98-sensitive
      depends_on: D39-L, D90-L, D91-L, D92-L, D93-L, I49-L, D98-L
      active_scope: memory/cards/orchestrator-tool-port--plan-check-tool.md

  Recently Completed:
    structured-exchange-affordance, elicitor-project, spec-structural-relief, renderer-golden-coverage, data-model-legibility

  Next:
    elicitation-gap-guidance

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
