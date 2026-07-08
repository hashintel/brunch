# executor/ — execute-mode projection contracts

SPEC decisions: D111-L (executor cutover over injected ports), D52-L (layer boundary), D112-L / FE-1125 (run driver), I58-L (bounded execute-mode side effects).

## Owns

Pure contracts and orchestration helpers that turn `next` graph facts into execute-mode cook runs. This subtree is product core: it imports graph DTOs, owns run metadata/report transitions and the `ExecutionPorts` contract types, but it does not register Pi tools, read SQLite, or own SDK/app integration effects. Real agent/test/promotion capabilities enter through app-layer port implementations (`src/app/*-port.ts`) injected by Pi composition. Narrow exception: `worktree.ts` owns run-local `empty_dir` git initialization (`git init` + empty base commit) because that substrate is an internal executor artifact, not a host capability surface.

```text
executor/
├── TOPOLOGY.md
├── agent-result.ts       AgentRunnerPort -> slice result report + normalized worker stream artifact
├── orchestrate.ts        run facts + RunScheduler -> drive() over the lifecycle steps
├── run-abandon.ts        active run -> abandoned run metadata, preserving artifacts
├── plan-file.ts          old cook-compatible DTO preview -> spec-scoped plan.yaml + provenance
├── launch.ts             spec-scoped plan.yaml provenance -> non-running launch readiness
├── plan-preview.ts       executable-plan draft -> old cook-compatible DTO preview
├── petri.ts              completed run -> minimal Petrinaut net.json
├── promotion.ts          petri-exported run -> run-local promotion (GitLandPort) + report
├── host-promotion.ts     promoted run -> preflight/apply report (GitHostPromotionPort)
├── observer-read.ts      run bundle -> tolerant read-only RunSummary/RunDetail projections incl. requirements, reports, and worker/verify stream tails (consumed by rpc execute.*)
├── populate.ts           worktree -> plan-only worktree population
├── report.ts             source-copied run -> reports.jsonl initialization
├── report-verdict.ts     reports.jsonl -> latest per-slice verification verdicts
├── run-complete.ts       completed slices -> run completion marker
├── run-auto-replan-policy.ts recommendation + retry budget -> conservative delegated action/refusal
├── run-freshness.ts      run metadata + plan provenance -> retry/replan freshness diagnosis
├── run-replan-recommendation.ts run retry eligibility -> human-readable recommendation
├── run-retry-eligibility.ts run freshness + lifecycle status -> safe HITL action set
├── run-supersession.ts   prior run + fresh launch -> new linked run metadata
├── run.ts                ready plan.yaml -> metadata-only run creation
├── slice-execute.ts      active slice -> execution request artifact
├── slice-complete.ts     test-ingested slice -> completion marker
├── slice-start.ts        reports-ready run -> slice-start marker
├── source-copy.ts        source policy -> bounded host source copy
├── source-policy.ts      plan-populated worktree -> source policy selection
├── test-result.ts        run worktree + verify target -> verify subprocess (TestRunnerPort) -> slice test report + normalized verify stream artifact
├── worktree.ts           run metadata substrate -> git worktree (GitWorktreePort) or isolated empty dir
├── execution-ports.ts    injected capability ports (git worktree, agent runner, test runner, git land, host-promotion preflight)
├── execution-spec-snapshot.ts   graph facts -> ExecutionSpecSnapshot v1, incl. executable requirement dependencies
├── executable-plan-draft.ts     plan outline -> executable-plan draft DTO, incl. slice dependencies
├── executable-plan-draft-artifact.ts executable-plan draft -> .brunch/execution-reports artifact
├── execute-plan-check.ts        ExecutionSpecSnapshot -> read-only plan-input findings
├── execute-plan-outline.ts      ExecutionSpecSnapshot -> side-effect-free plan outline
├── plan-outline-artifact.ts     plan outline -> .brunch/execution-reports artifact
└── __tests__/
```

## Boundary rules

```pseudo
rules:
  executor/ -> graph/schema/ [read typed DTOs]
  # enforced by __tests__/boundaries.test.ts
  executor/ x> db/, .pi/, app/, rpc/, web/ [no storage, adapter, transport, or UI effects]
```

`ExecutionSpecSnapshot` is the durable projection seam between the spec/graph product and the native execute-mode orchestrator. Both `main`-derived imports and `next` graph reads can target this shape while their internal models continue to evolve. Requirement-to-requirement dependency edges are the only graph dependencies lowered into executable slice `depends_on`; dependency edges with non-requirement endpoints remain graph context/hygiene concerns and do not block executable plan production merely because the cook scheduler cannot represent them. Every helper advances run metadata with at most one explicit, declared side effect (I58-L): plan/outline artifact writers touch only `.brunch/execution-reports`; cook helpers write only the declared files under `.brunch/cook` or the run worktree described per module below; agent/test/promotion effects are delegated to injected ports; port failure leaves run metadata unadvanced. The only direct subprocess exception is `empty_dir` run-local git repository initialization in `worktree.ts`, bounded to the run worktree and recorded as the worktree-create side effect. No helper mutates the graph, and host mutation is limited to the accepted-SHA file apply in `host-promotion.ts`.

`run-abandon.ts` is a bounded HITL replanning mutation: it marks an active run `abandoned` while preserving existing evidence paths and files. It refuses missing and already-terminal completed/promoted runs, and it never deletes worktrees, reports, Petri artifacts, promotion artifacts, or graph state.

## Cook plan preview compatibility

`plan-preview.ts` is a compatibility preview for the old main cook `Plan` model, not a plan-file writer. The preview may carry extra review metadata such as `schemaVersion`, but every old-runner field must be classified before a writer or runner consumes it.

| Old cook `Plan` field | Preview status | Rationale |
| --- | --- | --- |
| `mode` | mapped | Comes from `ExecutionSpecSnapshot.mode` through the outline/draft chain. |
| `spec` | mapped | Derived from draft requirement ids/definitions and criterion verification targets; inert provenance only. |
| `epics[].id`, `summary`, `depends_on`, `verification` | mapped/defaulted | Draft frontier ids/titles/dependencies map directly; epic verification is currently an empty old-compatible array. |
| `slices[].id`, `epic_id`, `definition`, `depends_on`, `verification`, `derived_from` | mapped | Draft task ids, requirement ids, dependency placeholders, and criterion targets map directly. |
| `profile`, `harnessNotes` | deferred/absent | Alpha has no profile/toolchain detection or harness-prior-art source yet. |
| `epics[].probe`, `epics[].reachability` | deferred/absent | Alpha has no truthful boot/probe or host-blind reachability source yet. |
| `slices[].writes` | deferred/absent | Alpha has no file-layout authoring source yet; do not invent ownership. |

`plan-file.ts` is the first executable-plan-file boundary: it strips preview-only fields (`schemaVersion`, `sideEffects`) and writes old-cook `Plan` payload data to `.brunch/cook/specs/<specId>/plan.yaml`, plus a sibling `plan.provenance.json` recording the graph LSN / visibility / mode used to produce that payload. It still does not create cook runs, worktrees, Petri artifacts, graph mutations, or promotion refs.

`launch.ts` is the first runner-facing boundary, but it is intentionally non-running: it validates whether the selected spec's bounded `plan.yaml` is missing, lacks provenance, is stale against the current graph projection, is blocked by current projection findings, or is ready, and returns `runStatus: not_started` with no side effects. Actual run creation, worktrees, Petri artifacts, reports, promotion refs, and land branches remain out of scope until a later runner slice accepts those side effects explicitly.

`run.ts` creates only metadata for a ready plan: `.brunch/cook/runs/<runId>/run.json` with the selected spec id, plan path, `status:"created"`, and optional run-environment policy (`substrate` and `verifyTarget`). It accepts the first run-resource side effect but still does not create a worktree, Petri artifact, report log, promotion ref, or land branch.

`run-freshness.ts` is a read-only replanning helper for existing runs. It reads `run.json`, reuses launch freshness/provenance checks against the current graph projection stamp, and reports whether the run is fresh, stale, missing provenance, missing its plan, blocked by projection, or missing entirely. It does not mutate run metadata, generate a new plan, or choose HITL recovery actions.

`run-retry-eligibility.ts` combines run freshness with the run lifecycle status to classify whether the current step can be retried, a fresh plan can be regenerated before retry, a new run is required, or the run is terminal. It only returns allowed action names; it does not execute retries, mutate plans, or supersede runs.

`run-replan-recommendation.ts` wraps retry eligibility in concise human-facing diagnosis text plus one recommended action. It is still read-only core: no prompts, no tool registration, no action execution, and no run mutation.

`run-auto-replan-policy.ts` is the conservative automation policy over a precomputed recommendation. It auto-delegates only fresh-run `retry_current_step` when retry budget remains and stale-early `regenerate_plan`; stale started/missing runs require human start-new-run, and terminal/blocked runs stay inspect-only. It owns no filesystem, driver, tool, or graph effects: retry/regenerate are injected delegates, and the policy never auto-supersedes.

`run-supersession.ts` is the first bounded mutation helper in the HITL replanning family. Given an existing run and a fresh launch-ready plan, it creates a new `created` run with `supersedesRunId` pointing to the prior run. It refuses missing prior runs, stale/non-ready plans, and target run id collisions, and it never mutates the prior run.

`worktree.ts` creates the run workspace from the metadata substrate. The default `git_worktree` substrate creates a real git worktree through the injected `GitWorktreePort` (app-layer `git worktree add --detach <worktreeDir> HEAD`) and updates `run.json` to `status:"worktree_created"`. The `empty_dir` substrate creates an isolated run directory, initializes a run-local git repository with an empty base commit, and never invokes the host git-worktree port; exact-root checks prevent host-linked `.git` markers from being accepted. If the selected port operation or run-local initialization fails, run metadata is not advanced (`status:"worktree_create_failed"`). Source population, scaffold templating, agent execution, Petri artifacts, report logs, promotion refs, and land branches remain deferred.

`populate.ts` performs the first bounded worktree population: it copies the selected plan into `.brunch/cook/runs/<runId>/worktree/.brunch/cook/plan.yaml` and updates `run.json` to `status:"worktree_populated"`. Host source copying, sandbox policy, agent execution, Petri artifacts, report logs, promotion refs, and land branches remain deferred.

`source-policy.ts` records the source policy for a plan-populated run by writing `source-policy.json` and updating `run.json` to `status:"source_policy_selected"`. This is policy selection only: host source files are not copied and execution remains deferred. `orchestrate.ts` defaults greenfield plans to `plan_only` and requires explicit `host_source_deferred` to copy host files into that run.

`source-copy.ts` performs bounded host source copying for `host_source_deferred`: it copies top-level source entries into the worktree while excluding `.brunch`, `.git`, `node_modules`, `dist`, and `build`, then records `status:"source_copied"`. Slice execution, Petri artifacts, report logs, promotion refs, and land branches remain deferred.

`report.ts` initializes `reports.jsonl` for a source-copied run with a single `run_ready` event and records `status:"reports_initialized"`. It creates the report log carrier but still does not execute slices or produce Petri artifacts.

`slice-start.ts` appends a `slice_started` marker for one plan slice and records the active slice/epic in `run.json`. It is not agent execution: no tools/tests run and no Petri transitions or promotion artifacts are created.

`slice-execute.ts` creates the first execution request artifact for the active slice under `agent-output/<sliceId>/request.json`, appends `slice_execution_requested`, and records `status:"slice_execution_requested"`. It still does not invoke an agent process, run tests, compile Petri artifacts, promote, or land.

`agent-result.ts` runs the injected `AgentRunnerPort` for the active slice's worktree/request/result paths, appends `slice_agent_result`, and records `status:"agent_result_ingested"`. During the long runner call, normalized worker updates are optionally appended to `.brunch/cook/runs/<runId>/streams/<sliceId>/agent.jsonl`; these are Brunch-owned stream events, not raw Pi session payloads. Runner failure returns `agent_run_failed` and leaves metadata unchanged. The app-layer runner launches the sealed `worker` subagent when subagent deps and Pi model context are injected; this core module still does not import the SDK, run tests, compile Petri artifacts, promote, or land.

`test-result.ts` runs the verify subprocess in the run's worktree through the injected `TestRunnerPort`, passing the run's optional `verifyTarget` when present (app-layer default remains `npm run verify`). It appends `slice_test_result` with the true verdict and exit code, and records `status:"test_result_ingested"`. During the long verify call, normalized verify updates are optionally appended to `.brunch/cook/runs/<runId>/streams/<sliceId>/verify.jsonl`; these are Brunch-owned stream events over stdout/stderr/status chunks, not raw subprocess handles. A failing verdict still advances the run; only a runner that cannot execute (`status:"test_run_failed"`) leaves metadata unchanged. It does not compile Petri artifacts, promote, or land.

`slice-complete.ts` appends `slice_completed` after test result ingestion and records the completed slice id in `run.json`. Petri artifacts, promotion refs, and land branches remain deferred.

`run-complete.ts` appends `run_completed` once every plan slice is completed and every completed slice has latest passing verification evidence in `reports.jsonl`; failed or missing verification leaves metadata unchanged. Petri artifacts, promotion refs, and land branches remain deferred.

`petri.ts` writes the first minimal Petrinaut artifact at `.brunch/cook/runs/<runId>/petrinaut/net.json` for a completed run and records `status:"petri_exported"`. Promotion refs and land branches remain deferred.

`promotion.ts` is the first land/promotion boundary: for a `petri_exported` run with a worktree and latest passing verification evidence it invokes the injected `GitLandPort`, then writes `.brunch/cook/runs/<runId>/promotion/promotion.json` (runId, specId, petriPath, reportsPath, completedSliceIds, run-local commit SHA) and records `status:"promotion_prepared"`. Failed or missing verification, `GitLandPort` failure, or no changes leaves metadata unchanged. This is run-local only: host branch/ref promotion remains out of scope, and actual host land remains pending.

`host-promotion.ts` is the host-promotion preflight/apply boundary. Preflight validates that `run.json.promotionCommitSha` agrees with `promotion/promotion.json` and delegates read-only promoted-commit diff inspection to `GitHostPromotionPort`, returning changed files and patch summary with `sideEffects: []`. Apply requires an accepted commit SHA, reruns preflight, and delegates bounded host worktree patch application to the same port; it reports `host_worktree_apply` and still does not commit, create refs, switch branches, or stage the host index.

`orchestrate.ts` is the run driver (FE-1125, D112-L): a generic `drive()` loop advances a run by repeatedly asking a pure `RunScheduler` for the ready step and calling the matching lifecycle step function with the injected `ExecutionPorts`. It owns no side effects of its own — `run.json` status is the loop state, and per-slice-frontier readiness derives from completion facts, not the status enum. `linearScheduler` returns a single ready step and drives a run end-to-end from `created` to `promotion_prepared` (run-local land via `GitLandPort`); the set-returning `ready()` contract leaves room for a future `PetriScheduler` (real Petri-net execution) without reshaping the loop. Host promotion/land stays off the driven chain (a separate, explicitly-accepted surface) — the scheduler reports no ready step at `promotion_prepared`.
