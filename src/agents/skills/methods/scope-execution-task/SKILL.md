---
name: scope-execution-task
description: "Interpret an execute-mode frontier or plan item into a bounded task brief before building."
---

# scope-execution-task

Use this method in execute mode before treating a plan item as literal implementation work. The plan is a build hypothesis: it names the user's intended frontier, but it may be under-scoped, over-specific, missing a design seam, or written before the codebase shape was known. Your job is to restate the next executable task without silently changing durable plan topology.

Start by calling `execute_status` when the active tools expose it. Use its result as the boundary check for what execute mode can honestly do now: which foothold tools are ported, which of `plan` / `cook` / `land` are still pending, and whether the current posture is `strict` or `interpretive`. Do not imply that an unported tool exists just because the frontier vocabulary says it should eventually exist.

Then call `execute_snapshot` when it is active and the task depends on selected-spec truth. Treat the returned `ExecutionSpecSnapshot` as the handoff contract for scoping: requirements, criteria, verifies links, mode, and design/oracle context. If `execute_snapshot` is unavailable, say so and fall back to pushed graph context or read-only graph tools; do not invent a snapshot.

Call `execute_plan_check` when it is active and you need to know whether the snapshot is ready to become plan input. Treat warnings as scoping facts, not blockers, and treat blocked status as a reason to ask for more spec work before plan/cook/land claims.

Read the selected spec, pushed graph context, current session notes, and any run/report context available through Brunch tools. Identify the user-facing behavior, the requirement or criterion it serves, and the smallest codebase boundary that can prove progress. Prefer one vertical task brief over a grab bag. Name assumptions and missing context explicitly; do not invent product intent to fill gaps.

The task brief should answer:

- what behavior this task will make true
- what code or UI surface appears to own it
- what tests, probes, or review evidence should prove it
- what is intentionally out of scope
- where the plan wording was reinterpreted, if at all

Allowed in interpretive execution: strengthen the test target, choose a better local module/UI shape, add necessary glue inside the same frontier, or reject a too-literal reading that would produce unusable code. Not allowed: split or merge durable plan nodes, reorder dependencies, mutate graph truth, rewrite `net.json`, or silently skip criteria. Those are adaptive-replan behaviors and require a separate orchestrator decision.

If the task cannot be scoped safely, stop with a short question or a blocked report instead of pushing ambiguity into the builder.
