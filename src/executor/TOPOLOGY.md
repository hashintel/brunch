# executor/ — execute-mode projection contracts

SPEC decisions: D111-L (executor cutover over injected ports), D52-L (layer boundary), D112-L / FE-1125 (run driver), D123-L (scope handoff contract), I58-L (bounded execute-mode side effects).

## Owns

Pure contracts and orchestration helpers that turn `next` graph facts into execute-mode cook runs. This subtree is product core: it imports graph DTOs, owns run metadata/report transitions and the `ExecutionPorts` contract types, but it does not register Pi tools, read SQLite, or own SDK/app integration effects. Real agent/test/promotion capabilities enter through app-layer port implementations (`src/app/*-port.ts`) injected by Pi composition. Narrow exception: `worktree.ts` owns run-local `empty_dir` git initialization (`git init` + empty base commit) because that substrate is an internal executor artifact, not a host capability surface.

```text
executor/
├── TOPOLOGY.md
├── agent-result.ts       AgentRunnerPort -> slice result report + normalized worker stream artifact
├── orchestrate-topology.ts compiled executor topology + shared run/slice subnet identities, explicit places/arcs, initial marking, and executor transition guards
├── orchestrate.ts        run facts + RunScheduler -> drive() over lifecycle steps, delegating Petri runtime/terminal helpers + raw runtime-event journal
├── petri-events.ts       bounded `petrinaut/events.jsonl` path + append/parse helpers and process-local observer wake-ups
├── petri-plan-snapshot.ts immutable run-local plan snapshot path + atomic first-write helper
├── petri-projection.ts   shared Petri projection contract + parser/normalizer for snapshot/read/live-update boundaries
├── petri-runtime-plan.ts shared populated-plan fallback resolution for driver and observer Petri materialization
├── petri-marking.ts      bounded `petrinaut/marking.json` snapshot path + tolerant persisted current-marking helper with non-authoritative lifecycle provenance and claimed-firing resume hints
├── petri-replay-eligibility.ts raw net presence + journal integrity -> derived replay-eligibility gate
├── petri-runtime.ts      materialized serial Petri runtime, lifecycle-facts -> replayable transition-history projection, topology-guard enabled-transition selection, and bound executors for today's lifecycle step handlers
├── petri-terminal.ts     exhausted/halting drive terminal classification -> shared journal event + DriveOutcome meaning
├── run-abandon.ts        active run -> abandoned run metadata, preserving artifacts
├── plan-file.ts          old cook-compatible DTO preview -> spec-scoped plan.yaml + provenance
├── launch.ts             spec-scoped plan.yaml provenance -> non-running launch readiness
├── plan-preview.ts       executable-plan draft -> old cook-compatible DTO preview
├── petri.ts              shared pre-execution/completed-run raw `petrinaut/net.json` + SDCPN v1 projection writer
├── petrinaut/            Petrinaut-specific SDCPN/replay-export/frame/SSE/launcher projections
├── petri-replay.ts       raw net export + runtime-event journal -> derived Petri projection/current-marking projection
├── promotion.ts          petri-exported run -> run-local promotion (GitLandPort) + report
├── host-promotion.ts     promoted run -> preflight/apply report (GitHostPromotionPort)
├── observer-read.ts      run bundle -> tolerant read-only RunSummary/RunDetail projections incl. requirements, reports, Petri runtime-event tail, derived replay projection, and worker/verify stream tails (consumed by rpc execute.*)
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
├── execution-spec-snapshot.ts   graph facts -> ExecutionSpecSnapshot v1, incl. executable requirement dependencies and scope handoff packages
├── executable-plan-draft.ts     plan outline -> executable-plan draft DTO, incl. slice dependencies and scope/design/verification context
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

`ExecutionSpecSnapshot` is the durable projection seam between the spec/graph product and the native execute-mode orchestrator. Both `main`-derived imports and `next` graph reads can target this shape while their internal models continue to evolve. It excludes advisory nodes/edges. D123-L scope packages have exactly one frontier owner, a non-empty definition, and direct requirement, criterion, design, and verification anchors; incomplete packages, duplicate requirement ownership, and dependencies on unscoped requirements block plan production. Once scopes exist, outlines lower only committed scopes and never infer owners or unscoped tasks. Requirement-to-requirement dependency edges become executable slice `depends_on`, and the scheduler starts only slices whose declared dependencies are complete; unresolved or cyclic dependencies halt without advancing metadata. Dependency edges with non-requirement endpoints remain package context rather than scheduler edges. Slice request enrichment from the populated plan validates every required scope field and fails closed, so scope context cannot silently degrade to an id-only worker request. Every helper advances run metadata with at most one explicit, declared side effect (I58-L): plan/outline artifact writers touch only `.brunch/execution-reports`; cook helpers write only the declared files under `.brunch/cook` or the run worktree described per module below; agent/test/promotion effects are delegated to injected ports; port failure leaves run metadata unadvanced. The only direct subprocess exception is `empty_dir` run-local git repository initialization in `worktree.ts`, bounded to the run worktree and recorded as the worktree-create side effect. No helper mutates the graph, and host mutation is limited to the accepted-SHA file apply in `host-promotion.ts`.

`run-abandon.ts` is a bounded HITL replanning mutation: it marks an active run `abandoned` while preserving existing evidence paths and files. It refuses missing and already-terminal completed/promoted runs, and it never deletes worktrees, reports, Petri artifacts, promotion artifacts, or graph state.

## Cook plan preview compatibility

`plan-preview.ts` is a compatibility preview for the old main cook `Plan` model, not a plan-file writer. The preview may carry extra review metadata such as `schemaVersion`, but every old-runner field must be classified before a writer or runner consumes it.

| Old cook `Plan` field | Preview status | Rationale |
| --- | --- | --- |
| `scope_handoff_required` | Brunch extension | Plan-level corruption guard: when true, every active slice must retain its scope identity and complete worker context. Old runners ignore the extra field. |
| `mode` | mapped | Comes from `ExecutionSpecSnapshot.mode` through the outline/draft chain. |
| `spec` | mapped | Derived from draft requirement ids/definitions and criterion verification targets; inert provenance only. |
| `epics[].id`, `summary`, `depends_on`, `verification` | mapped/defaulted | Draft frontier ids/titles/dependencies map directly; epic verification is currently an empty old-compatible array. |
| `slices[].id`, `epic_id`, `definition`, `depends_on`, `verification`, `derived_from` | mapped | Draft task ids, requirement ids, dependency placeholders, and criterion targets map directly. |
| `slices[].scope_id`, `design_context`, `verification_context` | mapped | The D123-L scope handoff preserves committed scope, design, and verification context into `plan.yaml`; the native worker-request path consumes these fields. |
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

`slice-execute.ts` creates the execution request artifact for the active slice under `agent-output/<sliceId>/request.json`, appends `slice_execution_requested`, and records `status:"slice_execution_requested"`. It requires the active slice to be readable from the populated plan before advancing, then carries definition, verification criteria, and scope/design/verification context. Missing or malformed plan data returns `plan_slice_invalid` with no side effects. It still does not invoke an agent process, run tests, compile Petri artifacts, promote, or land.

`agent-result.ts` runs the injected `AgentRunnerPort` for the active slice's worktree/request/result paths, appends `slice_agent_result`, and records `status:"agent_result_ingested"`. During the long runner call, normalized worker updates are optionally appended to `.brunch/cook/runs/<runId>/streams/<sliceId>/agent.jsonl`; these are Brunch-owned stream events, not raw Pi session payloads. Runner failure returns `agent_run_failed` and leaves metadata unchanged. The app-layer runner launches the sealed `worker` subagent when subagent deps and Pi model context are injected; this core module still does not import the SDK, run tests, compile Petri artifacts, promote, or land.

`test-result.ts` runs the verify subprocess in the run's worktree through the injected `TestRunnerPort`, passing the run's optional `verifyTarget` when present (app-layer default remains `npm run verify`). It appends `slice_test_result` with the true verdict and exit code, and records `status:"test_result_ingested"`. During the long verify call, normalized verify updates are optionally appended to `.brunch/cook/runs/<runId>/streams/<sliceId>/verify.jsonl`; these are Brunch-owned stream events over stdout/stderr/status chunks, not raw subprocess handles. A failing verdict still advances the run; only a runner that cannot execute (`status:"test_run_failed"`) leaves metadata unchanged. It does not compile Petri artifacts, promote, or land.

`slice-complete.ts` appends `slice_completed` after test result ingestion and records the completed slice id in `run.json`. Petri artifacts, promotion refs, and land branches remain deferred.

`run-complete.ts` appends `run_completed` once every plan slice is completed and every completed slice has latest passing verification evidence in `reports.jsonl`; failed or missing verification leaves metadata unchanged. Petri artifacts, promotion refs, and land branches remain deferred.

`petri-plan-snapshot.ts` atomically freezes the source plan at `petrinaut/plan.json`. Product `execute_run_create` prepares that snapshot, `net.json`, `net.sdcpn.json`, and a create-only empty `events.jsonl` before returning, so clients can attach before orchestration. `drive()` verifies preparation before its first lifecycle effect and fails closed when observer artifacts are unavailable. Worktree population and Petri runtime resolution prefer the same frozen snapshot, preventing published topology from diverging from execution if the source plan changes. `petri.ts` atomically creates immutable definition files; later preparation/export accepts byte-identical content and rejects rewrites. `petri_export` records `status:"petri_exported"` without changing the published definition. These are Brunch-owned observer projections, not runtime authority. Compatibility with Petrinaut's loader remains an external consumer oracle, not a claim established by the local shape test.

`petrinaut/replay-export.ts`, `petrinaut/stream-frames.ts`, and `petrinaut/sse.ts` validate and reduce `net.sdcpn.json` + `events.jsonl` into replay-equivalent ordered frames and SSE chunks. `petri-events.ts` notifies same-process observers only after durable append; callbacks are wake-up hints and the journal remains replay truth. A failed durable append instead wakes run-scoped journal-failure listeners, `drive()` halts before any further lifecycle advancement (`petri_journal_append_failed`), and active streams close so clients reconnect against whatever remained durable rather than waiting on a wake-up that cannot come. Normal completion closes only after its journal terminal, preserving final transition order. `run.ts` metadata listeners wake active streams for `abandoned`, the sole metadata-only terminal, and synthesize the same `run:finish` shape. These surfaces never own lifecycle truth, mutate `run.json`, or grant parallel side-effect authority. Process-local wake-ups are the declared first ceiling; split-process execution requires file watching or a durable broker.

`petri-replay.ts` is a read-side reducer only: given the raw `petrinaut/net.json` export and a non-empty, complete `petrinaut/events.jsonl` journal, it replays transition firings into a derived current-marking projection (`currentMarking`, `firedTransitionCount`, terminal summary). `petri-replay-eligibility.ts` owns the gate for when that replay is even allowed; `petri-replay.ts` owns only the reduction once the artifact pair is admitted. `petri-projection.ts` owns the shared Petri projection contract plus the parser/normalizer used at snapshot read, observer read, and live `execute.run` cache-patch boundaries so those surfaces enforce one payload shape instead of drifting copies. `petri-marking.ts` is the first durability seam above that reducer: it persists the executor's latest current-marking snapshot to `petrinaut/marking.json` as a Brunch-owned runtime artifact, annotated with the lifecycle facts (`runStatus`, `activeSliceId`, `completedSliceIds`) it was derived from so readers can reject stale snapshots when `run.json` has moved on. It is still not lifecycle/recovery truth, but it now carries a bounded recovery hint: when the persisted `claimedTransitionIds`, `currentMarking`, and `firedTransitionCount` still match the live runtime for the same lifecycle facts, the driver may resume that claimed firing order instead of recomputing a fresh one. Missing, empty, malformed, torn, provenance-mismatched, or runtime-mismatched artifacts fail closed to replay, fresh frontier selection, or "no derived projection" rather than mutating run state.

`petri-runtime-plan.ts` owns plan resolution shared by `drive()`, export, and observer reads. An explicitly recorded `populatedPlanPath` is the authoritative run-local snapshot and never falls back to the mutable source plan when unreadable; metadata that omits it may still use the known worktree path before the source-plan fallback. Plan reads and topology materialization fail closed: unreadable plans yield no derived Petri projection, while duplicate slice ids, invalid dependency graphs, or lifecycle histories that cannot replay halt `drive()` with a structured outcome instead of escaping as a rejected tool call. Only `promotion_prepared` is successful scheduler exhaustion; a nonterminal empty frontier emits `net_deadlocked`. Live `execute.run` updates send explicit `null` ready/blocked hints when reconstruction fails so caches cannot retain stale actionable frontiers.

`promotion.ts` is the first land/promotion boundary: for a `petri_exported` run with a worktree and latest passing verification evidence it invokes the injected `GitLandPort`, then writes `.brunch/cook/runs/<runId>/promotion/promotion.json` (runId, specId, petriPath, reportsPath, completedSliceIds, run-local commit SHA) and records `status:"promotion_prepared"`. Failed or missing verification, `GitLandPort` failure, or no changes leaves metadata unchanged. This is run-local only: host branch/ref promotion remains out of scope, and actual host land remains pending.

`host-promotion.ts` is the host-promotion preflight/apply boundary. Preflight validates that `run.json.promotionCommitSha` agrees with `promotion/promotion.json` and delegates read-only promoted-commit diff inspection to `GitHostPromotionPort`, returning changed files and patch summary with `sideEffects: []`. Apply requires an accepted commit SHA, reruns preflight, and delegates bounded host worktree patch application to the same port; it reports `host_worktree_apply` and still does not commit, create refs, switch branches, or stage the host index.

`orchestrate.ts` is the run driver (FE-1125, D112-L): a generic `drive()` loop advances a run by repeatedly asking a pure `RunScheduler` for the ready step and then executing the matching bound Petri transition with the injected `ExecutionPorts`. `run.json` status is still the loop state, but the Petri-specific runtime facts no longer live as ad hoc inline switches inside the driver: `petri-runtime.ts` owns the current serial runtime materialization (`currentMarking`, enabled transitions, ready steps, blocked steps) plus the explicit lifecycle-facts -> replayable transition-history projection used to reconstruct that marking from `run.json`, now selecting enabled transitions from Petri input arcs plus compiled executor transition guards for the slice frontier / active-slice policy, plus the binding layer that maps those transitions onto today's lifecycle step handlers; the serial runtime preserves slice `epicId` on compiled slice-start transitions and on the exposed `petriReadySteps` / `petriBlockedSteps` frontier hints so read surfaces can show frontier ownership honestly without inventing a second scheduler DTO. `petri-terminal.ts` owns exhausted-vs-halted terminal meaning for both the emitted journal event and the returned `DriveOutcome`. `linearScheduler` is now the single-step compatibility view over that runtime frontier, while `petriScheduler` exposes the whole set-returning `ready()` surface for a future real Petri frontier without reshaping the loop. The driver may also reuse a persisted claim-set from `petrinaut/marking.json` when its lifecycle provenance still matches `run.json` and every claimed transition is still enabled in the live Petri runtime; that resume hint is validated against the runtime frontier rather than trusted as authority. The Petri tracer persists raw executor transition / terminal facts to `.brunch/cook/runs/<runId>/petrinaut/events.jsonl` through `petri-events.ts` and still fans them out through `DriveContext.onNetEvent`; that journal is a Brunch-owned runtime-event projection only, not recovery truth and not a substitute for `run.json` or `reports.jsonl`. Appends are fail-closed: an event that cannot be durably journaled reaches no hint surface or marking snapshot and the drive halts, keeping the journal a truthful prefix of run facts (an already-halting terminal keeps its root-cause reason; only a would-be completed terminal downgrades to `petri_journal_append_failed`). Failed agent and verify-runner attempts journal as `attempt_failed` facts — non-marking vocabulary that replay and the Petrinaut export skip — and the drive retries in-run to a constant bound; `run.json` carries the active-slice attempt counter so the bound survives restarts, successful ingestion clears it (per-stage bounds), and explicit `execute_replan_retry_current_step` resets it. In parallel, `petri-marking.ts` snapshots the latest current marking to `.brunch/cook/runs/<runId>/petrinaut/marking.json` after transition and terminal facts; this is still not lifecycle authority, but it is now a bounded driver resume hint for claimed firing order. `observer-read.ts` now prefers that persisted marking snapshot and falls back to replay (`canProjectPetriReplay(...)` + `petri-replay.ts`) when the snapshot is absent or unreadable; a matching snapshot that lags the journal's terminal fact has its terminal backfilled from replay truth, so completion stays journal-ordered even when the terminal wake-up outruns the marking persist. Host promotion/land stays off the driven chain (a separate, explicitly-accepted surface) — the scheduler reports no ready step at `promotion_prepared`.
