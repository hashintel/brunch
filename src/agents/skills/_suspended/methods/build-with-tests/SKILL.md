---
name: build-with-tests
description: "Execute a scoped build task with test-first discipline while preserving the deterministic harness boundary."
---

# build-with-tests

Use this method after an execute-mode task brief is clear enough to build. If the brief does not mention the current execute foothold, call `execute_status` first when available and confirm that the requested action is actually ported. If the brief needs spec truth, call `execute_snapshot` or rely on a task brief that already names the snapshot facts it used; if it claims plan readiness, call `execute_plan_check` or cite the plan-check result already present in the brief; if it claims plan completion, call `execute_cook_run_complete` only after all slices are complete and report that Petri/promotion are still pending. If it claims plan shape, executable-plan-shaped data, old-cook compatibility, or any cook scaffold step, call the matching `execute_*` foothold and report only what that tool actually did. Do not imply that any foothold runs agents, tests, Petri, promotion, or land unless the tool result explicitly says so. Work like a disciplined coding agent inside Brunch's deterministic execution harness: understand the surrounding code, write or strengthen the relevant tests, implement the smallest coherent behavior, and report the evidence. Passing tests are necessary, but they are not a license to ignore the task brief, design context, accessibility, integration, or user-visible quality constraints that were pushed into the prompt.

Current execute footholds include `execute_status`, `execute_snapshot`, `execute_plan_check`, `execute_plan_outline`, `execute_plan_draft`, `execute_cook_plan_preview`, `execute_cook_plan_file`, `execute_cook_launch`, `execute_cook_run_create`, `execute_cook_worktree_create`, `execute_cook_populate`, `execute_cook_source_policy`, `execute_cook_source_copy`, `execute_cook_report_init`, `execute_cook_slice_start`, `execute_cook_slice_execute`, `execute_cook_agent_result`, `execute_cook_test_result`, `execute_cook_slice_complete`, `execute_cook_run_complete`, `execute_cook_petri_export`, `execute_cook_promotion_prepare`, `execute_plan_draft_artifact`, and `execute_plan_outline_artifact`.

Start by reading existing tests and nearby implementation. Match the repository's naming, imports, public interfaces, and error-handling conventions. Prefer public-interface tests that fail for the missing behavior, not private implementation assertions or trivially passing checks. If the task is UI-facing, include the behavior users observe: states, accessibility affordances, responsive behavior, or visual integration with the existing design system when those are part of the brief.

Then implement in small steps. Keep the implementation local to the scoped task unless the brief names a shared seam. Do not weaken tests to make progress. Do not use direct shell or file-write authority unless the active tool policy exposes it; execute mode may route code changes through code-owned tools rather than raw Pi builtins.

Report the outcome as evidence, not self-praise:

- tests/probes run and their result
- files or surfaces changed
- deviations from the task brief
- remaining risks or blocked follow-ups

If the build reveals that the plan topology is wrong, do not freelance a new topology. Emit the finding for adaptive replan: what should split, merge, reorder, or be clarified, and what evidence led to that conclusion.
