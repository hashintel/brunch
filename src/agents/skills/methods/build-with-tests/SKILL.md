---
name: build-with-tests
description: "Execute a scoped build task with test-first discipline while preserving the deterministic harness boundary."
---

# build-with-tests

Use this method after an execute-mode task brief is clear enough to build. Work like a disciplined coding agent inside Brunch's deterministic execution harness: understand the surrounding code, write or strengthen the relevant tests, implement the smallest coherent behavior, and report the evidence. Passing tests are necessary, but they are not a license to ignore the task brief, design context, accessibility, integration, or user-visible quality constraints that were pushed into the prompt.

Start by reading existing tests and nearby implementation. Match the repository's naming, imports, public interfaces, and error-handling conventions. Prefer public-interface tests that fail for the missing behavior, not private implementation assertions or trivially passing checks. If the task is UI-facing, include the behavior users observe: states, accessibility affordances, responsive behavior, or visual integration with the existing design system when those are part of the brief.

Then implement in small steps. Keep the implementation local to the scoped task unless the brief names a shared seam. Do not weaken tests to make progress. Do not use direct shell or file-write authority unless the active tool policy exposes it; execute mode may route code changes through code-owned tools rather than raw Pi builtins.

Report the outcome as evidence, not self-praise:

- tests/probes run and their result
- files or surfaces changed
- deviations from the task brief
- remaining risks or blocked follow-ups

If the build reveals that the plan topology is wrong, do not freelance a new topology. Emit the finding for adaptive replan: what should split, merge, reorder, or be clarified, and what evidence led to that conclusion.
