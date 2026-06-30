---
name: scope-execution-task
description: "Interpret an execute-mode frontier or plan item into a bounded task brief before building."
---

# scope-execution-task

Use this method in execute mode before treating a plan item as literal implementation work. The plan is a build hypothesis: it names the user's intended frontier, but it may be under-scoped, over-specific, missing a design seam, or written before the codebase shape was known. Your job is to restate the next executable task without silently changing durable plan topology.

Start by calling `execute_status` when the active tools expose it. Use its result as the boundary check for what execute mode can honestly do now: which foothold tools are ported, which of `plan` / `cook` / `land` are still pending, and whether the current posture is `strict` or `interpretive`. Do not imply that an unported tool exists just because the frontier vocabulary says it should eventually exist.

Then call `execute_snapshot` when it is active and the task depends on selected-spec truth. Treat the returned `ExecutionSpecSnapshot` as the handoff contract for scoping: requirements, criteria, verifies links, mode, and design/oracle context. If `execute_snapshot` is unavailable, say so and fall back to pushed graph context or read-only graph tools; do not invent a snapshot.

Call `execute_plan_check` when it is active and you need to know whether the snapshot is ready to become plan input. Treat warnings as scoping facts, not blockers, and treat blocked status as a reason to ask for more spec work before plan/cook/land claims.

Call `execute_plan_outline` when it is active and you need a reviewable plan-shaped outline. Treat the outline as orientation and task-brief material, not as an executable cook plan or a durable plan file.

Call `execute_plan_draft` when it is active and you need executable-plan-shaped data for review or downstream tooling. Treat the draft as schema-shaped data, not as a written `plan.yaml` or a cook run.

Call `execute_cook_plan_preview` when it is active and you need to inspect the old-cook-compatible DTO shape. It previews compatibility only; it does not write `plan.yaml`, compile a Petri net, or start a cook run.

Call `execute_cook_plan_file` only when the user asks to write the executable old-cook-compatible plan file. It writes `.brunch/cook/specs/<specId>/plan.yaml` and returns an explicit `write_file` side effect; it still does not create a cook run, worktree, Petri net, or promotion branch.

Call `execute_cook_launch` only to validate the selected spec's cook launch readiness. It reports `missing_plan` or `ready` against the spec-scoped plan file and always returns `runStatus: not_started`; it does not create a cook run, worktree, Petri net, or promotion branch.

Call `execute_cook_run_create` only to create durable run metadata for a ready spec-scoped plan. It writes `.brunch/cook/runs/<runId>/run.json` and returns explicit `mkdir` + `write_file` side effects; it still does not create a worktree, Petri net, reports log, promotion branch, or land branch.

Call `execute_cook_worktree_create` only to create the empty worktree directory for an existing run. It writes `.brunch/cook/runs/<runId>/worktree/` and updates `run.json`; it still does not populate source files, run agents, compile Petri nets, write reports, promote, or land.

Call `execute_cook_populate` only to copy the selected plan into an existing run worktree. It writes `.brunch/cook/runs/<runId>/worktree/.brunch/cook/plan.yaml` and updates `run.json`; it still does not copy host source files, run agents, compile Petri nets, write reports, promote, or land.

Call `execute_cook_source_policy` only to record the source population policy for an already plan-populated run. It writes `source-policy.json` and updates `run.json`; it still does not copy host source files, run agents, compile Petri nets, write reports, promote, or land.

Call `execute_cook_source_copy` only after source policy is selected and the user asks to copy bounded host source into the worktree. It copies top-level source entries while excluding `.brunch`, `.git`, `node_modules`, `dist`, and `build`, then updates `source-policy.json` and `run.json`; it still does not run agents, compile Petri nets, write reports, promote, or land.

Call `execute_cook_report_init` only to initialize `reports.jsonl` after source copy. It writes a single `run_ready` report and updates `run.json`; it still does not run agents, compile Petri nets, promote, or land.

Call `execute_cook_slice_start` only to append a slice-start marker after reports are initialized. It appends a `slice_started` report and updates `run.json`; it still does not run agents, run tests, compile Petri nets, promote, or land.

Call `execute_cook_slice_execute` only to create an execution request artifact for the active slice. It writes `agent-output/<sliceId>/request.json`, appends a `slice_execution_requested` report, and updates `run.json`; it still does not run agents, run tests, compile Petri nets, promote, or land.

Call `execute_cook_agent_result` only to ingest an already-written agent result for the active slice. It reads `agent-output/<sliceId>/result.json`, appends `slice_agent_result`, and updates `run.json`; it still does not launch agents, run tests, compile Petri nets, promote, or land.

Call `execute_cook_test_result` only to ingest an already-written test result for the active slice. It reads `agent-output/<sliceId>/test-result.json`, appends `slice_test_result`, and updates `run.json`; it still does not run tests, compile Petri nets, promote, or land.

Call `execute_cook_slice_complete` only after test result ingestion. It appends `slice_completed` and updates `run.json`; it still does not compile Petri nets, promote, or land.

Call `execute_plan_draft_artifact` only when the user asks to persist executable-plan-shaped data for review. It writes an artifact under `.brunch/execution-reports`; it still does not create an executable `plan.yaml`, cook run, worktree, Petri net, or promotion branch.

Call `execute_plan_outline_artifact` only when the user asks to persist that outline for review. It writes an artifact under `.brunch/execution-reports`; it still does not create a cook run, worktree, Petri net, or promotion branch.

Read the selected spec, pushed graph context, current session notes, and any run/report context available through Brunch tools. Identify the user-facing behavior, the requirement or criterion it serves, and the smallest codebase boundary that can prove progress. Prefer one vertical task brief over a grab bag. Name assumptions and missing context explicitly; do not invent product intent to fill gaps.

The task brief should answer:

- what behavior this task will make true
- what code or UI surface appears to own it
- what tests, probes, or review evidence should prove it
- what is intentionally out of scope
- where the plan wording was reinterpreted, if at all

Allowed in interpretive execution: strengthen the test target, choose a better local module/UI shape, add necessary glue inside the same frontier, or reject a too-literal reading that would produce unusable code. Not allowed: split or merge durable plan nodes, reorder dependencies, mutate graph truth, rewrite `net.json`, or silently skip criteria. Those are adaptive-replan behaviors and require a separate orchestrator decision.

If the task cannot be scoped safely, stop with a short question or a blocked report instead of pushing ambiguity into the builder.
