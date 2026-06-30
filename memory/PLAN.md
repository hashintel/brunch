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

**Active arcs.** Work is organized into multi-frontier **initiatives (arcs)** — see [§Initiatives](#initiatives) for through-lines, member frontiers, and done-definitions: the completed **skill-substrate** arc (populate / weed / lock), the active **elicitor-capability-spine** arc (`capture` / `generate` done, `project` next), and the active **context-pipeline** arc (PULL / PROJECT / COMPOSE locked, RENDER still open for final prompt/subagent topology closure).

**Execute / orchestration cutover.** FE-1089 is the active CODE/executor cutover frontier: re-grow the old cook orchestrator on the alpha branch using native Pi executor tools and a durable `ExecutionSpecSnapshot` projection seam, rather than harmonizing `main` and `next` schemas or reviving the old execute/orchestrator foreground split. The first slices are footholds only — prompt-resource conduct, read-only status/snapshot tools, and projection contracts — before any plan/cook/land runner port.

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

### context-pipeline — ✓ done (2026-06-26)

- **Goal:** lock the PULL → PROJECT → RENDER → COMPOSE context pipeline (D60-L).

```text
context-pipeline/
├── PULL      graph + session reads       ✓ done
├── PROJECT   projections/                ✓ done
├── RENDER    agents/contexts + local human outputs ✓ done
└── COMPOSE   system-prompts + skills     ✓ done

Foreground prompt bodies are flat under `src/agents/prompts/{elicitor,executor}.md`; background subagent bodies are flat under `src/agents/subagents/{explorer,researcher,projector,reviewer}.md`; the old nested prompt-body convention is retired from loaders, docs, tests, and package asset copying.
```

- **Done-definition:** every pipeline stage closed; COMPOSE's full-stack tripwire discharged by RENDER; foreground prompt bodies flattened under `src/agents/prompts/{elicitor,executor}.md`; background subagent bodies flattened under `src/agents/subagents/{explorer,researcher,projector,reviewer}.md`; no stale `prompts/<agent>/SYSTEM.md` convention remains in docs, tests, or packaged asset copying.
- **Anchors:** D60-L; D83-L (RENDER house style).

## Sequencing

### Active

- `orchestrator-alpha-cutover` (FE-1089) — active on `ka/fe-1089-orchestrator-alpha-cutover`. Native CODE/executor footholds landed: execute-mode method guidance, side-effect-free `execute_status`, `ExecutionSpecSnapshot v1`, `execute_snapshot`, `execute_plan_check`, `execute_plan_outline` (now embeds criterion content), `execute_plan_outline_artifact`, `ExecutablePlanDraft`, `execute_plan_draft`, `execute_plan_draft_artifact`, `execute_cook_plan_preview`, and method guidance routing through those foothold tools. Next slice should harden cook-plan compatibility (for example schema parity with the old plan model) before any plan file writer or runner; no cook runs/worktrees yet.

### Recently Completed

- 2026-06-26 `renderer-golden-coverage` (FE-1091) — **context pipeline done.** The final topology slice flattened foreground prompt bodies to `src/agents/prompts/{elicitor,executor}.md`, moved background bodies to `src/agents/subagents/{explorer,researcher,projector,reviewer}.md`, retired nested prompt-body directories and the unwired `pi-coder` body, updated explicit registries/loaders and packaged asset copying, and reconciled `src/agents/` / prompt / subagent topology READMEs.
- 2026-06-26 `data-model-legibility` (FE-1090) — **reference substrate complete.** Generated ontology tables are materialized from typed graph sources with `check:data-model`; authored graph-authoring heuristics are cited by `capture` + `commit-graph`; the final checkability/subtype audit closed with no schema/runtime expansion: progressive checkability is accepted only as skill-local oracle conduct, `checkability`/`strength` fields are rejected carrying cost, subtype enums are rejected as parallel ontology, and `detail.form` remains inert payload plus renderer hook.
- 2026-06-25 `elicitor-generate` (FE-1059) — **generate capability done through promoted A31-L fan-out evidence.** Built slices: `present_candidates` tool/projection/renderer + pick path; intent/design/oracle facets under one plane-parameterized `generate-proposal` method; progressive-disclosure references; real-boot activation check; and real-model fan-out witness harness. Promoted run `.fixtures/runs/generate-fan-out/2026-06-24T16-51-13-704Z/` passed with `openai-codex/gpt-5.5`: oracle lens pinned, `SKILL.md` and `references/oracle.md` read, `present_candidates` emitted, no pre-prompt kick, no graph delta, no `mutate_graph`, and no approved review result. A32-L fan-in completion and the A1 anti-prompt remain follow-ups, not branch debt.
- 2026-06-24 `subagent-reconciliation` (FE-1054) — foreground/background reconciliation complete through the execute-mode readiness target (D90-L-D93-L/I49-L): shared `AgentManifest`, code-owned background discovery, semi-permeable injected-world child sessions, sovereign grants gated by code-owned `canDelegate`, return rendering, and live `execute` -> `orchestrator` mode with a product-registered stub tool. `code` -> `pi-coder` remains future work.
- 2026-06-24 `readiness-bands-interrogation` (FE-1058) — D94-L/I50-L materialized: derived four-band ladder, two carriers (`gap.band` for asking agenda, plane-derived node bands for projection thresholds), per-kind table deleted, `projection` band added, and goldens/readers reconciled.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

- `elicitor-project` (FE-1085) — **design-gated.** Cross-plane derivation (requirements -> design, design -> oracles) remains undesigned under A33-L; run `ln-design` before any scope/build.
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

### orchestrator-alpha-cutover

- **Name:** Reconcile orchestrator with alpha branch
- **Linear:** [FE-1089](https://linear.app/hash/issue/FE-1089/reconcile-orchestrator-with-alpha-branch)
- **Branch:** `ka/fe-1089-orchestrator-alpha-cutover`
- **Kind:** structural / execute-mode orchestration cutover
- **Status:** active; foothold slices landed.
- **Certainty:** proving.
- **Current execution pointer:** next slice should harden cook-plan compatibility (for example schema parity with the old plan model) before any plan file writer or runner; do not create cook runs/worktrees yet.
- **Objective:** Cut the old `main` cook orchestrator off the divergent stable branch and re-grow it natively on alpha's CODE/executor substrate. The near-term bridge is `ExecutionSpecSnapshot v1` plus side-effect-free executor tools; data-model harmonization and adaptive replan are deferred.
- **Acceptance:**
  - ✓ CODE/executor prompt resources can scope and build from a plan hypothesis without granting raw write/shell authority.
  - ✓ `execute_status` reports current strict/interpretive foothold state and pending `plan`/`cook`/`land` without side effects.
  - ✓ `ExecutionSpecSnapshot v1` projects graph requirements, criteria, positive witness/verifies links, mode, and context buckets from `next` graph DTOs.
  - ✓ `execute_snapshot` reads the active selected-spec graph and returns the snapshot with `sideEffects: []`.
  - ✓ `execute_plan_check` consumes the snapshot and returns typed plan-input findings without creating a run sandbox.
  - ✓ `execute_plan_outline` turns the snapshot into reviewable plan-shaped data with embedded criterion content, without creating a run sandbox or plan file.
  - ✓ `execute_plan_outline_artifact` writes the reviewable outline under `.brunch/execution-reports/<specId>/plan-outline.json` without creating a cook run/worktree.
  - ✓ `ExecutablePlanDraft` / `execute_plan_draft` produces executable-plan-shaped epics/slices/criterion verification data without writing a plan file.
  - ✓ `execute_plan_draft_artifact` writes the executable-plan draft under `.brunch/execution-reports/<specId>/executable-plan-draft.json` without creating a cook run/worktree.
  - ✓ `execute_cook_plan_preview` maps the draft into an old-cook-compatible DTO preview without writing `plan.yaml`.
  - Next: compatibility hardening toward the old plan model before any plan file writer or runner.
  - Later: cook execution, Petri/net artifacts, worktrees, promotion/land, and adaptive replan arrive as separate slices; topology mutation remains out of interpretive execution.
- **Traceability:** R26; D39-L, D40-L, D58-L, D90-L, D91-L, D92-L, D93-L, D98-L, D99-L / I49-L, I52-L; `src/orchestration/README.md`, `src/.pi/extensions/README.md`.

### orchestrator-tool-port

- **Name:** Port cook orchestration into CODE/executor tools
- **Linear:** [FE-1087](https://linear.app/hash/issue/FE-1087/port-cook-orchestrator-into-execute-mode-tools)
- **Branch:** tbd
- **Kind:** structural / execute-mode tool boundary
- **Status:** superseded as a separate frontier by FE-1089; preserve only as historical precursor if Linear remains open.
- **Certainty:** proving.
- **Objective:** Old framing for porting reusable `brunch cook` logic into CODE/executor tools. FE-1089 now owns the active alpha cutover, including the first read-only plan-facing tool.
- **Acceptance:** See `orchestrator-alpha-cutover`.
- **Traceability:** D39-L, D40-L, D90-L, D91-L, D92-L, D93-L, D98-L, D99-L / I49-L, I52-L.

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
- **Linear:** [FE-1090](https://linear.app/hash/issue/FE-1090/data-model-legibility-reference-substrate)
- **Branch:** `ln/fe-1090-data-model-legibility-reference-substrate`
- **Kind:** structural / design + build
- **Status:** done. Design verdict landed (`ln-design`: Shape C — two layers behind one index). Generated kind→band, edge-category, and detail/form tables live at `src/agents/contexts/references/graph-ontology.md` with the `check:data-model` drift guard (wired into `npm run check`) and packaged runtime asset copy. The authored graph-authoring heuristics row lives at `src/agents/contexts/references/graph-authoring-heuristics.md` and is cited by `capture` + `commit-graph`. Final verdict: progressive checkability is accepted only as oracle skill conduct in `generate-proposal/references/oracle.md`; claim-level `checkability`/`strength` fields and subtype enums are rejected carrying cost; `detail.form` remains inert payload plus renderer hook.
- **Certainty:** proving.
- **Objective:** Recover + reconcile the retired `INTENT_GRAPH_SEMANTICS` content and adjacent heuristic docs into one SPEC-mode data-model reasoning substrate under `src/agents/`: runtime-eligible references in `src/agents/contexts/references/`, backstage curation notes in `src/agents/docs/`, and pruned/cited skill bodies. Generate the closed-vocabulary tables (planes / kinds / bands / edge-category policy / `detail` schemas) from typed graph sources so heuristics are **cited** (D97-L), not inlined and duplicated across skill bodies; align the result with D98-L's mode-only runtime posture.
- **Acceptance:**
  - ✓ `ln-design` produced ≥3 module shapes for the home + generation seam with a recommendation (Shape C), before any doc/script.
  - ✓ The canonical-truth boundary is decided: what is generated from `kinds.ts` / `nodes.ts` / `category-policy.ts` vs authored judgment. Kind→band, edge-category policy, required detail, and `detail.form` tables are materialized in `src/agents/contexts/references/graph-ontology.md`.
  - ✓ Subtypes/`detail` modelling review: retired subtype families are rejected as parallel ontology; method-specific structure is already covered by inert `detail.form` from typed sources.
  - ✓ The two capture gaps are explicitly ruled in or out: constraint/invariant subtype enums are rejected as parallel ontology; the 8-rung checkability ladder is narrowed to oracle skill conduct; `strength` / claim-level checkability fields are rejected carrying cost.
  - ✓ Skill bodies cite the new home (D97-L); inlined heuristic copies collapse to one cite-target. `capture` + `commit-graph` now cite `graph-authoring-heuristics.md` for shared graph-authoring judgment; oracle checkability conduct stays skill-local in `generate-proposal/references/oracle.md`.
  - ✓ A drift guard (`check:data-model`, mirroring `check:skills`, wired into `npm run check`) fails if the generated reference diverges from the typed sources.
  - If `ln-design` splits this into recover-doc / build-generator / subtypes-remodel frontiers, create a `data-model-legibility` arc per §Initiatives.
- **Traceability:** D73-L (domain owns vocabulary), D88-L (`detail` form union), D97-L (heuristic provenance), D98-L (SPEC/CODE mode-only runtime posture); un-defers and relocates the generated-reference pattern into `src/agents/contexts/references/`; relates to `elicitor-project` (A33-L, shared D97-L rule).

### renderer-golden-coverage

- **Name:** Adopt the D83-L context-render house style and lock remaining RENDER-stage surfaces
- **Linear:** [FE-1091](https://linear.app/hash/issue/FE-1091/renderer-golden-coverage-and-prompt-assembly-lock)
- **Branch:** `ln/fe-1091-renderer-golden-coverage-and-prompt-assembly-lock`
- **Kind:** coverage + build / hardening
- **Status:** done. The render/prompt sweep ledger closed renderer and assembly evidence, and the final topology slice flattened foreground prompt bodies to `src/agents/prompts/{elicitor,executor}.md` and background subagent bodies to `src/agents/subagents/{explorer,researcher,projector,reviewer}.md`.
- **Current execution pointer:** none; scope file consumed and retired.
- **Certainty:** earned — RENDER topology is now established; this frontier closed coverage, prompt assembly evidence, and stale topology ambiguity rather than proving a new seam.
- **Closes:** context-pipeline RENDER stage plus the COMPOSE full-stack real-rendered-context tripwire.
- **Locks in:** D83-L house style for model-facing context surfaces and prompt assembly as a golden/semantic-invariant surface.
- **Objective:** Finish the RENDER stage and lock system-prompt assembly as a golden surface. Remaining work lives by audience: model-facing context and prompt text under `src/agents/`, human/product text beside its app/session owner. Incidental prompt remodelling belongs here only when needed to make prompt assembly lockable: foreground prompts flatten to `src/agents/prompts/elicitor.md` and `src/agents/prompts/executor.md`; subagent prompt bodies flatten to `src/agents/subagents/{explorer,reviewer,researcher,projector}.md`; `src/agents/` topology must make `contexts`, `prompts`, `runtime`, `shared`, `skills`, and `subagents` roles legible. This frontier also extends D83-L to thin graph-derived markdown document outputs for selected-spec and plan-plane material, as future web/download response sources.
- **Acceptance:** `src/agents/contexts/README.md`, `src/agents/prompts/README.md`, `src/agents/runtime/README.md`, `src/agents/subagents/README.md`, `src/app/README.md`, and `src/session/README.md` carry the audience/topology split; required model-facing renderer rows are built in the house style and locked with focused goldens/semantic invariants; system prompt assembly is locked with goldens/semantic invariants; selected-spec context moves from `contexts/specification/specification-context.ts` to `contexts/spec/spec-context.ts`; `contexts/spec/spec-output.ts` and `contexts/plan/plan-output.ts` use md-pen to render thin markdown-flattened outputs from graph/projection input rather than from `memory/SPEC.md` / `memory/PLAN.md`; foreground prompt files are flat (`prompts/elicitor.md`, `prompts/executor.md`); subagent files are flat under `subagents/`; no adapter/transport imports enter `agents/contexts/`; prompt topology remodel deletes obsolete role/body aliases rather than preserving compatibility shims.
- **Traceability:** D19-L, D40-L, D52-L, D58-L, D60-L, D62-L, D83-L, D98-L.

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
    renderer-golden-coverage
      status: done (RENDER coverage + prompt assembly lock + prompt/subagent topology flattening)
      depends_on: context-pipeline PULL+PROJECT, D83-L, D52-L, D58-L, D98-L
      coordinates_with: data-model-legibility (references substrate), elicitor-generate (present_candidates render already landed in house style)

  Next:
    orchestrator-tool-port
      status: scoped
      depends_on: D39-L, D90-L, D91-L, D92-L, D93-L, I49-L
      active_scope: memory/cards/orchestrator-tool-port--plan-check-tool.md

    elicitor-project
      status: design-gated
      depends_on: elicitor-generate, D95-L, D96-L, I51-L

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
