---
name: scope-execution-task
description: "Interpret an execute-mode frontier or plan item into a bounded task brief before building."
---

# scope-execution-task

Use this method in execute mode before treating a plan item as literal implementation work. The plan is a build hypothesis: it names the user's intended frontier, but it may be under-scoped, over-specific, missing a design seam, or written before the codebase shape was known. Your job is to restate the next executable task without silently changing durable plan topology.

Read the selected spec, pushed graph context, current session notes, and any run/report context available through Brunch tools. Identify the user-facing behavior, the requirement or criterion it serves, and the smallest codebase boundary that can prove progress. Prefer one vertical task brief over a grab bag. Name assumptions and missing context explicitly; do not invent product intent to fill gaps.

The task brief should answer:

- what behavior this task will make true
- what code or UI surface appears to own it
- what tests, probes, or review evidence should prove it
- what is intentionally out of scope
- where the plan wording was reinterpreted, if at all

Allowed in interpretive execution: strengthen the test target, choose a better local module/UI shape, add necessary glue inside the same frontier, or reject a too-literal reading that would produce unusable code. Not allowed: split or merge durable plan nodes, reorder dependencies, mutate graph truth, rewrite `net.json`, or silently skip criteria. Those are adaptive-replan behaviors and require a separate orchestrator decision.

If the task cannot be scoped safely, stop with a short question or a blocked report instead of pushing ambiguity into the builder.
