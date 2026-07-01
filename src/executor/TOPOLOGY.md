# executor/ — execute-mode projection contracts

SPEC decisions: FE-1089 cutover frontier; `brunch-orchestrator-cutover-to-next.md` Arc 1 data bridge.

## Owns

Pure contracts and projection helpers that turn `next` graph facts into execute-mode orchestration inputs. This subtree is product core: it imports graph DTOs and emits stable orchestration DTOs, but it does not register Pi tools, read SQLite, run Petri nets, execute slices, or promote/land changes.

```text
executor/
├── TOPOLOGY.md
├── agent-result.ts       AgentRunnerPort -> slice result report
├── plan-file.ts          old cook-compatible DTO preview -> spec-scoped plan.yaml
├── launch.ts             spec-scoped plan.yaml -> non-running launch readiness
├── plan-preview.ts       executable-plan draft -> old cook-compatible DTO preview
├── petri.ts              completed run -> minimal Petrinaut net.json
├── promotion.ts          petri-exported run -> run-local promotion (GitLandPort) + report
├── populate.ts           worktree -> plan-only worktree population
├── report.ts             source-copied run -> reports.jsonl initialization
├── run-complete.ts       completed slices -> run completion marker
├── run.ts                ready plan.yaml -> metadata-only run creation
├── slice-execute.ts      active slice -> execution request artifact
├── slice-complete.ts     test-ingested slice -> completion marker
├── slice-start.ts        reports-ready run -> slice-start marker
├── source-copy.ts        source policy -> bounded host source copy
├── source-policy.ts      plan-populated worktree -> source policy selection
├── test-result.ts        run worktree -> verify subprocess (TestRunnerPort) -> slice test report
├── worktree.ts           run metadata -> real git worktree (GitWorktreePort)
├── execution-ports.ts    injected capability ports (git worktree, agent runner, test runner, git land)
├── execution-spec-snapshot.ts   graph facts -> ExecutionSpecSnapshot v1
├── executable-plan-draft.ts     plan outline -> executable-plan draft DTO
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
  executor/ x> db/, .pi/, app/, rpc/, web/ [no storage, adapter, transport, or UI effects]
```

`ExecutionSpecSnapshot` is the durable projection seam between the spec/graph product and the native execute-mode orchestrator. Both `main`-derived imports and `next` graph reads can target this shape while their internal models continue to evolve. Artifact writers in this subtree may write only explicit execution artifacts under `.brunch/execution-reports`; cook helpers may create only the side effects accepted below. They must not run agents, compile Petri nets, write report logs, promotion refs, land branches, or graph mutations.

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

`plan-file.ts` is the first executable-plan-file boundary: it strips preview-only fields (`schemaVersion`, `sideEffects`) and writes old-cook `Plan` payload data to `.brunch/cook/specs/<specId>/plan.yaml` as a single explicit `write_file` side effect. It still does not create cook runs, worktrees, Petri artifacts, graph mutations, or promotion refs.

`launch.ts` is the first runner-facing boundary, but it is intentionally non-running: it validates whether the selected spec's bounded `plan.yaml` is missing or ready and returns `runStatus: not_started` with no side effects. Actual run creation, worktrees, Petri artifacts, reports, promotion refs, and land branches remain out of scope until a later runner slice accepts those side effects explicitly.

`run.ts` creates only metadata for a ready plan: `.brunch/cook/runs/<runId>/run.json` with the selected spec id, plan path, and `status:"created"`. It accepts the first run-resource side effect but still does not create a worktree, Petri artifact, report log, promotion ref, or land branch.

`worktree.ts` creates a real git worktree for an existing run through the injected `GitWorktreePort` (app-layer `git worktree add --detach <worktreeDir> HEAD`) and updates `run.json` to `status:"worktree_created"`. If the port fails, run metadata is not advanced (`status:"worktree_create_failed"`). Source population, sandbox strategy, agent execution, Petri artifacts, report logs, promotion refs, and land branches remain deferred.

`populate.ts` performs the first bounded worktree population: it copies the selected plan into `.brunch/cook/runs/<runId>/worktree/.brunch/cook/plan.yaml` and updates `run.json` to `status:"worktree_populated"`. Host source copying, sandbox policy, agent execution, Petri artifacts, report logs, promotion refs, and land branches remain deferred.

`source-policy.ts` records the host-source policy for a plan-populated run by writing `source-policy.json` and updating `run.json` to `status:"source_policy_selected"`. This is policy selection only: host source files are not copied and execution remains deferred.

`source-copy.ts` performs bounded host source copying for `host_source_deferred`: it copies top-level source entries into the worktree while excluding `.brunch`, `.git`, `node_modules`, `dist`, and `build`, then records `status:"source_copied"`. Slice execution, Petri artifacts, report logs, promotion refs, and land branches remain deferred.

`report.ts` initializes `reports.jsonl` for a source-copied run with a single `run_ready` event and records `status:"reports_initialized"`. It creates the report log carrier but still does not execute slices or produce Petri artifacts.

`slice-start.ts` appends a `slice_started` marker for one plan slice and records the active slice/epic in `run.json`. It is not agent execution: no tools/tests run and no Petri transitions or promotion artifacts are created.

`slice-execute.ts` creates the first execution request artifact for the active slice under `agent-output/<sliceId>/request.json`, appends `slice_execution_requested`, and records `status:"slice_execution_requested"`. It still does not invoke an agent process, run tests, compile Petri artifacts, promote, or land.

`agent-result.ts` runs the injected `AgentRunnerPort` for the active slice's worktree/request/result paths, appends `slice_agent_result`, and records `status:"agent_result_ingested"`. Runner failure returns `agent_run_failed` and leaves metadata unchanged. The app-layer runner launches the sealed `worker` subagent when subagent deps and Pi model context are injected; this core module still does not import the SDK, run tests, compile Petri artifacts, promote, or land.

`test-result.ts` runs the verify subprocess in the run's worktree through the injected `TestRunnerPort` (app-layer `npm run verify`), appends `slice_test_result` with the true verdict and exit code, and records `status:"test_result_ingested"`. A failing verdict still advances the run; only a runner that cannot execute (`status:"test_run_failed"`) leaves metadata unchanged. It does not compile Petri artifacts, promote, or land.

`slice-complete.ts` appends `slice_completed` after test result ingestion and records the completed slice id in `run.json`. Petri artifacts, promotion refs, and land branches remain deferred.

`run-complete.ts` appends `run_completed` once every plan slice is completed and records `status:"run_completed"`. Petri artifacts, promotion refs, and land branches remain deferred.

`petri.ts` writes the first minimal Petrinaut artifact at `.brunch/cook/runs/<runId>/petrinaut/net.json` for a completed run and records `status:"petri_exported"`. Promotion refs and land branches remain deferred.

`promotion.ts` is the first land/promotion boundary: for a `petri_exported` run with a worktree it invokes the injected `GitLandPort`, then writes `.brunch/cook/runs/<runId>/promotion/promotion.json` (runId, specId, petriPath, reportsPath, completedSliceIds, run-local commit SHA) and records `status:"promotion_prepared"`. `GitLandPort` failure or no changes leaves metadata unchanged. This is run-local only: host branch/ref promotion remains out of scope, and actual host land remains pending.
