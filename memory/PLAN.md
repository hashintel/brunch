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

**Active arcs.** Work is organized into multi-frontier **initiatives (arcs)** — see [§Initiatives](#initiatives) for through-lines, member frontiers, and done-definitions: the completed **skill-substrate** arc (populate / weed / lock), the active **elicitor-capability-spine** arc (`capture` / `generate` done, `project` next), and the active **context-pipeline** arc (PULL / PROJECT / COMPOSE locked, RENDER open).

**Topology and evidence discipline.** Directory `README.md` files under `src/**` own current topology state. `memory/SPEC.md` owns product contract and architectural decisions; `memory/PLAN.md` owns only rolling frontier state. Scratch probe artifacts under `.fixtures/scratch/` are not durable evidence until reviewed and promoted to `.fixtures/runs/`.

## Initiatives

<!-- Initiative (arc) = a multi-frontier architectural through-line. This is NOT a tracker/branch
     altitude — frontiers stay flat (one Linear issue + branch each) per AGENTS.md. The arc index is
     a legibility + completability layer only: it names the through-line so "was this captured
     thoroughly?" is a lookup, not a reconstruction from scattered SPEC decisions.
     Created/updated by ln-plan; closed and reconciled by ln-sync. Keep each arc thin (goals,
     members, done-definition, anchors). An arc closes only when its done-definition holds —
     including reconciliation of co-located topology READMEs and discharge of any standing-obligation
     residue scoped to it. Arc completion is the trigger for residue that no future frontier touches. -->

### skill-substrate — ✓ done (2026-06-25)

- **Goals:** (1) populate the skills the elicitor needs; (2) weed dead-code / stub skills; (3) isolate + lock graph schema, descriptions, tips, and heuristics as context.
- **Members:** FE-893, FE-861, FE-898, FE-1052 (all done).
- **Done-definition:** legal skill set sealed by the `agents/runtime/state.ts` path list; no dead stubs (the `__fixtures__` sealing fixture excepted); heuristics distilled + locked into `SKILL.md` bodies, not duplicated in topology READMEs. ✓ — final `strategies/` + `lenses/` README reconciliation discharged 2026-06-25 (dead `INTENT_GRAPH_SEMANTICS.md` pointer + stale "M5 input" tables removed).
- **Anchors:** D85-L (axis populate / weed), D97-L (heuristic-provenance lock), A35-L (axes frozen under the capability spine).

### elicitor-capability-spine — ◐ active

- **Goal:** build `capture` / `generate` / `project` over the frozen `strategy` / `lens` / `method` axes (A35-L), on top of the skill-substrate arc.
- **Members:**
  - `capture` ✓ done via generalized capture (D80-L–D82-L).
  - `generate` ✓ done through promoted real-model fan-out evidence (FE-1059): one plane-parameterized `generate-proposal` method, `present_candidates` unstubbed, fan-in as method conduct (`pick` / `synthesize` / `compose`), promoted I51-L no-write evidence.
  - `project` → `elicitor-project` (FE-1085), **next, design-gated** (A33-L): cross-plane derivation may fold into `generate` or need a distinct surface.
  - `acquire` rides the completed subagent-reconciliation substrate (A34-L), not its own frontier.
- **Done-definition:** all three capabilities carry promoted real-model evidence; no capability remains a stub or a method-less axis member. Open follow-ups (A32-L fan-in completion, the A1 anti-prompt) are tracked on their assumptions, not as arc blockers.
- **Anchors:** D95-L, D96-L; A31-L–A35-L; I51-L.

### context-pipeline — ◐ active

- **Goal:** lock the PULL → PROJECT → RENDER → COMPOSE context pipeline (D60-L).

```text
context-pipeline/
├── PULL      graph + session reads       ✓ done
├── PROJECT   projections/                ✓ done
├── RENDER    renderers/                  ◐ open: renderer-golden-coverage (FE-870)
└── COMPOSE   system-prompts + skills     ✓ done*

*COMPOSE has one deferred full-stack real-rendered-context tripwire owned by RENDER.
```

- **Done-definition:** every pipeline stage closed or owned by a live coverage frontier; the COMPOSE full-stack tripwire discharged by RENDER. `renderer-golden-coverage` is a parallel evidence/quality track, never a ship gate.
- **Anchors:** D60-L; D83-L (RENDER house style).

## Sequencing

### Active

- None. `elicitor-generate` is tied off pending branch submission; the next frontier is `elicitor-project`.

### Recently Completed

- 2026-06-25 `elicitor-generate` (FE-1059) — **generate capability done through promoted A31-L fan-out evidence.** Built slices: `present_candidates` tool/projection/renderer + pick path; intent/design/oracle facets under one plane-parameterized `generate-proposal` method; progressive-disclosure references; real-boot activation check; and real-model fan-out witness harness. Promoted run `.fixtures/runs/generate-fan-out/2026-06-24T16-51-13-704Z/` passed with `openai-codex/gpt-5.5`: oracle lens pinned, `SKILL.md` and `references/oracle.md` read, `present_candidates` emitted, no pre-prompt kick, no graph delta, no `mutate_graph`, and no approved review result. A32-L fan-in completion and the A1 anti-prompt remain follow-ups, not branch debt.
- 2026-06-24 `subagent-reconciliation` (FE-1054) — foreground/background reconciliation complete through the execute-mode readiness target (D90-L-D93-L/I49-L): shared `AgentManifest`, code-owned background discovery, semi-permeable injected-world child sessions, sovereign grants gated by code-owned `canDelegate`, return rendering, and live `execute` -> `orchestrator` mode with a product-registered stub tool. `code` -> `pi-coder` remains future work.
- 2026-06-24 `readiness-bands-interrogation` (FE-1058) — D94-L/I50-L materialized: derived four-band ladder, two carriers (`gap.band` for asking agenda, plane-derived node bands for projection thresholds), per-kind table deleted, `projection` band added, and goldens/readers reconciled.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

- `orchestrator-tool-port` (FE-1087) — **scoped.** Port the external `brunch cook` orchestrator into execute-mode tools without granting the foreground orchestrator direct shell/file-write authority. First active scope: `memory/cards/orchestrator-tool-port--plan-check-tool.md`.
- `elicitor-project` (FE-1085) — **design-gated.** Cross-plane derivation (requirements -> design, design -> oracles) remains undesigned under A33-L; run `ln-design` before any scope/build.
- `data-model-legibility` — **active.** Single canonical home for data-model meta-guidance, with closed-vocabulary tables generated from the typed `graph/schema` sources (D97-L). Design verdict landed (Shape C); first tracer landed (generated kind→band table + `check:data-model` drift guard, cited by `methods/capture`). Remaining: edge-category + detail-form tables, the authored judgment layer, and the subtypes→`detail` remodel.
- `renderer-golden-coverage` — **active parallel coverage track.** Remaining RENDER work: `<session>`, `renderGraphSeed`, `exchanges/*`, `formatRelatedNodesResult` relocation/repair, and the `brunch print` fork.
- `exchange-symmetry-audit` — **earned cleanup.** Delete-oriented audit of the exchange projection/renderer split; not a capability blocker.

### Parallel / Low-Conflict

- `fixture-vs-real-audit` — `ln-induct` candidate for real-vs-fixture shape gaps (tool ids, orphan tool results, provider payload assumptions).
- `elicitation-gap-guidance` — generative graph-shape analysis for "what next?" gaps; distinct from ranking already-registered gaps.
- `structured-exchange-affordance` — recurring discriminant-companion contract lens; most lead fixes landed, but the systemic audit remains available when similar review findings recur.
- `spec-structural-relief` — accepted ledger for future SPEC sharding only if a real context-budget/navigation failure trips it.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them **or the completion of the arc they belong to** ([§Initiatives](#initiatives) done-definitions); they are not standalone cleanup buckets. When an arc's trailing residue falls outside any future frontier's blast radius, **arc completion is its trigger** — this is the hole that left the `strategies/` + `lenses/` README reconciliation orphaned until 2026-06-25.

### Horizon

- `coherence-first-class` — bounded coherence verdicts backed by reconciliation needs.
- `compaction-and-conflict-widening` — long-horizon continuity through compaction.
- `web-driver-streaming` — remaining consumer/UI and non-freeform answer legs after the built topology-A relay battery.
- `flue-pattern-adoption` — post-POC harness-pattern adoption.
- `framework-direction-stubs` — discretionary structural stubs only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — exploratory, parallel to Brunch proper.

## Frontier Definitions

### orchestrator-tool-port

- **Name:** Port cook orchestrator into execute-mode tools
- **Linear:** [FE-1087](https://linear.app/hash/issue/FE-1087/port-cook-orchestrator-into-execute-mode-tools)
- **Branch:** tbd
- **Kind:** structural / execute-mode tool boundary
- **Status:** scoped; first scope file active.
- **Certainty:** proving.
- **Current execution pointer:** `memory/cards/orchestrator-tool-port--plan-check-tool.md`.
- **Objective:** Replace the execute-mode standup stub with real orchestrator tooling by porting reusable `brunch cook` core logic into product-owned modules and exposing it through thin `.pi/extensions` adapters, while preserving the orchestrator foreground agent's no-direct-`bash` / no-direct-`edit` / no-direct-`write` authority.
- **Acceptance:**
  - First tracer replaces `orchestrator_stub` with a read-only `cook_plan_check` tool that validates a cook plan and returns typed plan shape/findings without creating a run sandbox.
  - Later `cook_run` tooling is bounded behind orchestrator-owned sandbox/worktree machinery; write-capable worker sessions, if any, are code-owned child execution boundaries, not foreground-agent direct tools.
  - External `../brunch` CLI behavior is ported as reusable product core plus Pi adapter, not wrapped as a shell command.
- **Traceability:** D39-L, D40-L, D90-L, D91-L, D92-L, D93-L / I49-L; `src/.pi/extensions/README.md`.

### elicitor-project

- **Name:** Elicitor `project` capability — cross-plane derivation
- **Linear:** [FE-1085](https://linear.app/hash/issue/FE-1085) — elicitor project capability design
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

### data-model-legibility

- **Name:** Single canonical home for data-model meta-guidance + generation seam
- **Linear:** tbd
- **Branch:** tbd
- **Kind:** structural / design + build
- **Status:** active; design verdict landed (`ln-design`: Shape C — two layers behind one index). First tracer-bullet **landed**: generated kind→band table at `src/graph/schema/_generated/ontology.md` + `check:data-model` drift guard (wired into `npm run check`), cited by `methods/capture`. Load-bearing claim 1 (typed `graph/schema` sources are the closed, importable vocabulary set — D73-L) validated by the landed generator. Remaining: edge-category + detail-form tables, the authored judgment layer (heuristics / promotion / checkability ladder / subtypes verdict), and the subtypes→`detail` remodel review.
- **Certainty:** proving.
- **Current execution pointer:** none active — re-scope the next slice (authored judgment layer, or further generated tables).
- **Objective:** Recover + reconcile the retired `INTENT_GRAPH_SEMANTICS` content into one canonical data-model meta-guidance home; generate the closed-vocabulary tables (planes / kinds / bands / edge-category policy / `detail` schemas) from the typed `graph/schema` sources (un-defers `_generated/`) so heuristics are **cited** (D97-L), not inlined and duplicated across skill bodies.
- **Acceptance:**
  - ✓ `ln-design` produced ≥3 module shapes for the home + generation seam with a recommendation (Shape C), before any doc/script.
  - The canonical-truth boundary is decided: what is generated from `kinds.ts` / `nodes.ts` / `category-policy.ts` vs authored judgment. (Direction set by Shape C; kind→band table materialized, remaining tables pending.)
  - Subtypes/`detail` modelling review: each retired subtype family sorted into `kind` (behavior-bearing), `detail` facet (inert classification), or already-covered; decide whether an inert `detail` facet dimension earns its carrying cost given the kind/band/form machinery already discriminates.
  - The two capture gaps are explicitly ruled in or out: constraint/invariant subtype enums; the 8-rung checkability ladder + `strength`.
  - Skill bodies cite the new home (D97-L); inlined heuristic copies collapse to one cite-target.
  - ✓ A drift guard (`check:data-model`, mirroring `check:skills`, wired into `npm run check`) fails if the generated reference diverges from the typed sources.
  - If `ln-design` splits this into recover-doc / build-generator / subtypes-remodel frontiers, create a `data-model-legibility` arc per §Initiatives.
- **Traceability:** D73-L (domain owns vocabulary), D88-L (`detail` form union), D97-L (heuristic provenance); un-defers the `_generated/` deferral in [`src/agents/skills/README.md`](src/agents/skills/README.md); relates to `elicitor-project` (A33-L, shared D97-L rule).

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
- **Objective:** Confirm each retained `projections/exchanges` and `agents/contexts/exchanges` file earns its place; delete symmetry regrowth where single-owner reads were mirrored into shared layers only for shape symmetry.
- **Acceptance:** Retained files have named multi-consumer/shared-semantics justification; unjustified mirrors are deleted; TUI presenters stay local and exchange context renderers stay durable markdown/text/TOON only.
- **Traceability:** D27-L, D65-L, D66-L.

## Dependencies

```text
frontiers:
  Active:
    none

  Next:
    orchestrator-tool-port
      status: scoped
      depends_on: D39-L, D90-L, D91-L, D92-L, D93-L, I49-L
      active_scope: memory/cards/orchestrator-tool-port--plan-check-tool.md

    elicitor-project
      status: design-gated
      depends_on: elicitor-generate, D95-L, D96-L, I51-L

    data-model-legibility
      status: active (design landed Shape C; first tracer landed)
      depends_on: graph/schema typed sources (kinds.ts, nodes.ts, category-policy.ts), D73-L, D88-L, D97-L
      materialized: _generated/ontology.md (src/graph/schema) + check:data-model

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
  elicitor-generate -> elicitor-project
  subagent-reconciliation -> acquisition arm + future subagent diversity
  readiness-bands-interrogation -> renderer-golden-coverage
  ontology-revision -> renderer-golden-coverage, coherence-first-class, elicitor-project

rules:
  candidates never commit graph truth (I51-L)
  topology READMEs own current subtree state
  scratch evidence is not durable until promoted to .fixtures/runs/
  an arc (§Initiatives) closes only when its done-definition holds, incl. topology-README reconciliation + residue discharge
```
