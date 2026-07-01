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

**Execute / orchestration cutover.** The `orchestrator-cutover` arc re-grows the old cook orchestrator on the alpha branch using native Pi executor tools and a durable `ExecutionSpecSnapshot` projection seam, rather than harmonizing `main` and `next` schemas or reviving the old execute/orchestrator foreground split. FE-1089 (`orchestrator-alpha-cutover`) landed the descriptive `fs`-only foothold scaffold and is done; real execution + land continue in the stacked `executor-sandbox` → `executor-agent-runner` → `executor-land` frontiers behind an injected capability-port seam.

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

### orchestrator-cutover — ◐ active

- **Goal:** re-grow the old `main` cook orchestrator natively on alpha's CODE/executor substrate (D99-L), layer by layer: projection seam → descriptive lifecycle shape → real runnable sandbox → real change-producing agent → real promotion/land. Split by capability layer + risk + reversibility so each layer is independently reviewable and the hard-to-reverse git seam lands last.
- **Members:**
  - `orchestrator-alpha-cutover` (FE-1089) ✓ done — `ExecutionSpecSnapshot` projection seam + the descriptive `fs`-only cook lifecycle scaffold (`execute_plan_file` → … → `execute_promotion_prepare`). Proved the lifecycle shape + thin-adapter/one-side-effect-per-tool pattern with zero real execution.
  - `executor-sandbox` → next — `GitWorktreePort` + `TestRunnerPort`: a run becomes a real, runnable, verifiable git workspace (no LLM, subprocess only).
  - `executor-agent-runner` → after sandbox — `AgentRunnerPort` reusing the D90-L–D93-L sealed subagent substrate: a run actually produces real changes via a code-owned write-capable CODE worker.
  - `executor-land` → last — `GitLandPort`: a run's real changes get promoted (run-local land first, host land later); the only externally-visible, hard-to-reverse seam.
- **Done-definition:** a selected-spec cook run can be planned, executed against a real git worktree by a real CODE worker that produces real diffs, verified by real tests, and landed — each layer behind the established injected-capability-port seam (SPEC D99-L cook-execution-ports refinement), no faked side effects, topology immutable in execution, and `execute_status` `pendingTools` empty. Open follow-ups (adaptive replan, real Petri-net execution) ride their own horizon items, not arc blockers.
- **Anchors:** D39-L, D40-L, D52-L, D90-L–D93-L, D98-L, D99-L (incl. land-substrate finding + cook-execution-ports refinement) / I49-L, I52-L.

## Sequencing

### Active

- `executor-sandbox` (`orchestrator-cutover` arc) — **next up; design chosen, ready to scope.** First real-execution frontier: replace the `fs`-only simulation with a real runnable sandbox via two injected capability ports — `GitWorktreePort` (real `git worktree add`, replacing `worktree.ts`'s `mkdir`) and `TestRunnerPort` (real verify subprocess). No LLM, subprocess only, low blast radius. Stacks on the FE-1089 branch. First slice: the git-worktree port. See `executor-sandbox` frontier definition for the chosen ports seam (SPEC D99-L cook-execution-ports refinement).
- `elicitor-project` (FE-1085) — **design-gated proving frontier.** Cross-plane derivation (requirements -> design, design -> oracles) remains undesigned under A33-L; run `ln-design` before scope/build.
- `exchange-symmetry-audit` — **earned cleanup.** Delete-oriented audit of the exchange projection/renderer split; not a capability blocker.
- `structured-exchange-affordance` — **earned hardening.** Collapse recurring discriminant-companion and nested-payload affordance failures into clearer schema/tool contracts.
- `elicitation-gap-guidance` — **proving frontier.** Generate "what next?" gap guidance from graph shape/readiness, distinct from ranking already-registered gaps.

### Recently Completed

- 2026-06-30 `orchestrator-alpha-cutover` (FE-1089) — **descriptive cutover scaffold done** (arc member of `orchestrator-cutover`). Landed the `ExecutionSpecSnapshot` projection seam plus the full `fs`-only cook lifecycle simulation through `execute_promotion_prepare`, establishing the thin-Pi-adapter / one-explicit-side-effect-per-tool pattern with zero real execution. Scoping real land surfaced the D99-L land-substrate finding (copied-dir worktree, prewritten-ingested results, no git in core), so real execution + land were reordered into the `executor-sandbox` → `executor-agent-runner` → `executor-land` frontiers.
- 2026-06-29 `spec-structural-relief` — SPEC slimmed from long-form register to compact live index; pre-slim snapshot archived in `docs/archive/SPEC_HISTORY.md`.
- 2026-06-26 `renderer-golden-coverage` (FE-1091) — context pipeline done; prompt/subagent topology flattened and locked.
- 2026-06-26 `data-model-legibility` (FE-1090) — reference substrate complete; generated ontology tables and authored graph heuristics have canonical homes.
- Older completed frontiers: `docs/archive/PLAN_HISTORY.md`.

### Next

- `executor-agent-runner` (`orchestrator-cutover` arc) — **after `executor-sandbox`.** Inject the `AgentRunnerPort` so a run actually produces real changes via a code-owned write-capable CODE worker reusing the D90-L–D93-L sealed subagent substrate, replacing the prewritten-ingest tools (`execute_agent_result`, `execute_test_result`) with a real runner. Stacks on `executor-sandbox`.
- `executor-land` (`orchestrator-cutover` arc) — **last; the only hard-to-reverse seam.** Inject the `GitLandPort` so a run's real diffs get promoted (run-local land first, host land later), consuming the Petri + promotion artifacts rather than re-deriving run state. Drops `land` from `execute_status` `pendingTools`. Stacks on `executor-agent-runner`.

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

### orchestrator-alpha-cutover

- **Name:** Reconcile orchestrator with alpha branch
- **Linear:** [FE-1089](https://linear.app/hash/issue/FE-1089/reconcile-orchestrator-with-alpha-branch)
- **Branch:** `ka/fe-1089-orchestrator-alpha-cutover`
- **Kind:** structural / execute-mode orchestration cutover
- **Status:** done (descriptive scaffold); arc member of `orchestrator-cutover`. Branch still needs Linear→Done + PR tie-off.
- **Certainty:** proven for the descriptive layer.
- **Current execution pointer:** none on this frontier; the descriptive `fs`-only foothold chain is complete through promotion-prepare (cook-plan compatibility hardening → plan-file → launch readiness → run/worktree/populate → source policy/copy → report → slice start/execute/agent-result/test-result/complete → run-complete → Petri export → promotion-prepare). Real execution + land moved off this frontier into the `executor-sandbox` → `executor-agent-runner` → `executor-land` arc frontiers after scoping "actual land" surfaced the D99-L land-substrate finding. Preserve the no-land boundary (no host git branch/ref/worktree mutation, no faked side effects against copied source) until those real-execution frontiers land it.
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
  - ✓ `execute_plan_preview` maps the draft into an old-cook-compatible DTO preview without writing `plan.yaml`.
  - ✓ Cook-plan compatibility is field-classified against the old `Plan` model: `spec` provenance is mapped; `profile`, `harnessNotes`, `writes`, and reachability/probe fields remain explicitly deferred/absent until alpha has truthful sources.
  - ✓ `execute_plan_file` writes the old-cook `Plan` payload to `.brunch/cook/specs/<specId>/plan.yaml` as one explicit `write_file` side effect, stripping preview-only fields and creating no run/worktree/Petri/promotion artifacts.
  - ✓ `execute_launch` validates the selected spec's plan path as `missing_plan` or `ready`, returns `runStatus: not_started`, and creates no run/worktree/Petri/report/promotion artifacts.
  - ✓ `execute_run_create` creates `.brunch/cook/runs/<runId>/run.json` metadata for a ready plan and creates no worktree/Petri/report/promotion artifacts.
  - ✓ `execute_worktree_create` creates an empty `.brunch/cook/runs/<runId>/worktree/` for an existing run and updates run metadata; it does not populate source, run agents, write reports, compile Petri artifacts, promote, or land.
  - ✓ `execute_populate` copies the selected plan into the worktree and updates run metadata; it does not copy host source, run agents, write reports, compile Petri artifacts, promote, or land.
  - ✓ `execute_source_policy` records the host-source policy and updates run metadata; it does not copy host source, run agents, write reports, compile Petri artifacts, promote, or land.
  - ✓ `execute_source_copy` copies bounded host source into the worktree, excluding `.brunch`, `.git`, `node_modules`, `dist`, and `build`; it does not run agents, write reports, compile Petri artifacts, promote, or land.
  - ✓ `execute_report_init` initializes `reports.jsonl` with a single `run_ready` event and updates run metadata; it does not execute slices, compile Petri artifacts, promote, or land.
  - ✓ `execute_slice_start` appends a `slice_started` marker for one plan slice and updates run metadata; it does not run agents, tests, Petri transitions, promote, or land.
  - ✓ `execute_slice_execute` writes an `agent-output/<sliceId>/request.json` execution request, appends `slice_execution_requested`, and updates run metadata; it does not run agents, tests, Petri transitions, promote, or land.
  - ✓ `execute_agent_result` ingests a prewritten `agent-output/<sliceId>/result.json`, appends `slice_agent_result`, and updates run metadata; it does not launch agents, run tests, compile Petri artifacts, promote, or land.
  - ✓ `execute_test_result` ingests a prewritten `agent-output/<sliceId>/test-result.json`, appends `slice_test_result`, and updates run metadata; it does not run tests, compile Petri artifacts, promote, or land.
  - ✓ `execute_slice_complete` appends `slice_completed` and records the completed slice id; it does not compile Petri artifacts, promote, or land.
  - ✓ `execute_run_complete` appends `run_completed` once every plan slice is complete; it does not compile Petri artifacts, promote, or land.
  - ✓ `execute_petri_export` writes the minimal Petrinaut `net.json` artifact for a completed run; it does not promote or land.
  - ✓ `execute_promotion_prepare` writes a descriptive `promotion/promotion.json` report for a Petri-exported run and records `status:"promotion_prepared"`; it creates no git branch, promotion ref, or worktree mutation, and does not land.
  - ✓ Descriptive cutover scaffold complete: the `fs`-only foothold chain truthfully simulates the cook lifecycle without any git/topology mutation or faked execution.
  - Blocked → moved out of frontier: actual host land is blocked on real agent/test execution + a real git worktree (no truthful source otherwise); reordered into the `executor-sandbox` → `executor-agent-runner` → `executor-land` arc frontiers. Do not fake a host git mutation against copied source under I52-L.
  - Later: real cook execution, real worktrees, host promotion/land, and adaptive replan arrive under the `executor-sandbox` → `executor-agent-runner` → `executor-land` frontiers behind the D99-L cook-execution-ports seam; interpretive execution may reinterpret task briefs but may not mutate plan/net topology.
- **Traceability:** R26; D39-L, D40-L, D58-L, D90-L, D91-L, D92-L, D93-L, D98-L, D99-L / I49-L, I52-L; `src/executor/TOPOLOGY.md`, `src/.pi/extensions/README.md`.

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

### executor-sandbox

- **Name:** Real executor sandbox — git worktree + test runner ports
- **Linear:** tbd (new FE issue when started, per AGENTS.md frontier workflow)
- **Branch:** tbd (new Graphite branch stacked on `ka/fe-1089-orchestrator-alpha-cutover`)
- **Kind:** structural / execute-mode runner substrate (`orchestrator-cutover` arc)
- **Status:** next; design chosen (`ln-design` ran), ready to scope.
- **Certainty:** proving.
- **Why now / unlocks:** the FE-1089 chain proved the cook lifecycle shape with `fs`-only descriptive footholds, but every step simulates execution (copied-dir "worktree", prewritten-ingested agent/test results, no git). A meaningful run needs a real, runnable, verifiable workspace first. This is the lowest-blast-radius real-execution layer (subprocess only, no LLM).
- **Design verdict (chosen):** real execution enters orchestration core through an **injected capability-port bag**, not a deep environment object or an effect-program rewrite. Port *types* live in `src/executor/cook-execution-ports.ts` (`CookExecutionPorts` = `{ GitWorktreePort, AgentRunnerPort, TestRunnerPort, GitLandPort }`); real implementations live in the app layer (`src/app/cook-*.ts`) and are injected by the Pi adapters, preserving the D52-L/I52-L boundary (no git/subprocess in core). See SPEC D99-L cook-execution-ports refinement.
- **Objective:** Implement and inject `GitWorktreePort` (real `git worktree add`, replacing `worktree.ts`'s `mkdir`) and `TestRunnerPort` (real verify subprocess), so a run becomes a real, runnable, verifiable git workspace — keeping the one-explicit-side-effect-per-tool discipline (I52-L).
- **Acceptance (to refine via `ln-scope`):**
  - `src/executor/cook-execution-ports.ts` defines the `CookExecutionPorts` bag as types only; orchestration core imports no git/subprocess.
  - `GitWorktreePort` makes the per-run worktree a real `git worktree`, replacing the `mkdir`+copy substrate in `worktree.ts`.
  - `TestRunnerPort` runs the real verify subprocess and ingests its true result, replacing the prewritten `test-result.json` ingest path for the sandbox layer.
  - App-layer implementations under `src/app/cook-*.ts`; adapters inject the bag; focused tests cover the port contracts.
- **Traceability:** D39-L, D40-L, D52-L, D90-L, D91-L, D92-L, D93-L, D98-L, D99-L (land-substrate finding + cook-execution-ports refinement) / I49-L, I52-L; depends on `orchestrator-alpha-cutover`; `src/executor/TOPOLOGY.md`.

### executor-agent-runner

- **Name:** Real cook agent runner — change-producing CODE worker port
- **Linear:** tbd (new FE issue when started)
- **Branch:** tbd (stacked on `executor-sandbox`)
- **Kind:** structural / execute-mode runner substrate (`orchestrator-cutover` arc)
- **Status:** after `executor-sandbox`.
- **Certainty:** proving.
- **Why now / unlocks:** with a real sandbox, a run can finally produce real changes. This frontier introduces the only LLM-bearing port and reuses the sealed subagent substrate rather than a new agent runtime.
- **Objective:** Implement and inject `AgentRunnerPort` so a run actually produces real diffs via a code-owned write-capable CODE worker reusing the D90-L–D93-L sealed subagent substrate, retiring the prewritten-ingest tool (`execute_agent_result`) in favor of the real runner.
- **Acceptance (to refine via `ln-scope`):**
  - `AgentRunnerPort` implementation (app layer) launches a write-capable CODE worker over the `executor-sandbox` worktree under the D90-L–D93-L grant model.
  - `execute_agent_result` is re-grounded on or retired in favor of the real runner; no prewritten `result.json` ingest remains on this layer.
  - Real diffs land in the sandbox worktree; focused tests/witness cover the runner contract.
- **Traceability:** D39-L, D40-L, D52-L, D90-L, D91-L, D92-L, D93-L, D98-L, D99-L / I49-L, I52-L; depends on `executor-sandbox`.

### executor-land

- **Name:** Real cook land — promotion port (run-local then host)
- **Linear:** tbd (new FE issue when started)
- **Branch:** tbd (stacked on `executor-agent-runner`)
- **Kind:** structural / execute-mode runner substrate (`orchestrator-cutover` arc)
- **Status:** last; the only externally-visible, hard-to-reverse seam.
- **Certainty:** proving.
- **Why now / unlocks:** only once a run produces real, verified diffs does a truthful land have a source (D99-L land-substrate finding). This layer lands last so the hard-to-reverse git mutation is the final, independently-reviewable step.
- **Objective:** Implement and inject `GitLandPort` so a run's real diffs are promoted — run-local land first, host land later — consuming/validating the Petri + promotion artifacts rather than re-deriving run state.
- **Acceptance (to refine via `ln-scope`):**
  - `GitLandPort` implementation (app layer) performs a run-local land of the verified worktree diffs first; host land is a later, explicitly-accepted slice.
  - The land path consumes/validates the existing Petri + `promotion.json` artifacts rather than re-deriving run state.
  - `execute_status` `pendingTools` drops `land` once a real (at minimum run-local, real-git) land exists.
- **Traceability:** D39-L, D40-L, D52-L, D98-L, D99-L (land-substrate finding) / I49-L, I52-L; depends on `executor-agent-runner`; `src/executor/TOPOLOGY.md`.

### elicitor-project

- **Name:** Elicitor `project` capability — cross-plane derivation
- **Linear:** [FE-1085](https://linear.app/hash/issue/FE-1085) — elicitor project capability design
- **Branch:** tbd
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
- **Stabilizes:** the boundary between generated gap guidance and persisted `reconciliation_need` / `elicitation_gap` records.
- **Objective:** Give the elicitor a graph-shaped asking agenda for next useful questions without turning prompt examples into a parallel gap ontology.
- **Acceptance:** Guidance is derived from current graph/readiness context and rendered into elicitor context; it distinguishes suggested next questions from committed graph truth; existing registered gaps remain rankable but are not the only source of asking guidance.
- **Traceability:** D56-L, D64-L, D65-L, D94-L, D97-L.

## Dependencies

```text
frontiers:
  Active:
    executor-sandbox (orchestrator-cutover arc)
      status: next up; design chosen (ports bag), ready to scope
      depends_on: orchestrator-alpha-cutover (FE-1089), D52-L, D99-L cook-execution-ports refinement, I52-L
      ports: GitWorktreePort, TestRunnerPort
      stacks_on: ka/fe-1089-orchestrator-alpha-cutover

    elicitor-project
      status: design-gated
      depends_on: elicitor-generate, D95-L, D96-L, I51-L
      retires: A33-L

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
    orchestrator-alpha-cutover (FE-1089), spec-structural-relief, renderer-golden-coverage, data-model-legibility

  Next:
    executor-agent-runner (orchestrator-cutover arc)
      status: after executor-sandbox
      depends_on: executor-sandbox, D90-L..D93-L, D52-L, I49-L, I52-L
      ports: AgentRunnerPort
      stacks_on: executor-sandbox

    executor-land (orchestrator-cutover arc)
      status: last; only hard-to-reverse seam
      depends_on: executor-agent-runner, D99-L land-substrate finding, D52-L, I52-L
      ports: GitLandPort
      unblocks: host cook land/promotion; drops `land` from execute_status pendingTools
      stacks_on: executor-agent-runner

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
