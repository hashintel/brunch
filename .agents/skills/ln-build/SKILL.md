---
name: ln-build
description: "Implement one scoped slice using TDD red-green-refactor. Use when ready to write code for a defined slice of work, or when the user wants test-driven development."
argument-hint: "[paste or reference a ln-scope card]"
---

# Dev Build

Implement **one** slice. Beck's red-green-refactor, one cycle, no scope creep.

## Input

A scope card from `ln-scope`, or a clear behavior description: $ARGUMENTS

Extract: target behavior, boundary crossings, and acceptance criteria.

## Red

Translate acceptance criteria into failing tests. Run them. Confirm each fails for the expected reason — a test that fails with an error is not red, it is broken.

If tests pass unexpectedly, the scope was wrong. Tighten assertions or revisit `ln-scope`.

## Green

Write the minimum code to pass the tests. Build inside-out: functional core first (pure domain logic, no I/O), then imperative shell (thin I/O adapter), then wire end-to-end (Bernhardt, "Boundaries").

No speculative abstractions. YAGNI. Only extract when two concrete cases force it.

## Refactor

Tests are green. Now improve: align names to the lexicon in `memory/SPEC.md`, deepen shallow modules (Ousterhout), make invalid states unrepresentable (Minsky), delete anything unused. Never refactor while tests are red.

## Verify and commit

Run the project's verification harness. All checks must pass. Commit: `feat: [target behavior in lowercase]`

## Traceability

After the slice lands:

- Mark it done in `memory/PLAN.md`
- If implementation validated or invalidated assumptions → update `memory/SPEC.md` §Assumptions, flag affected slices in `memory/PLAN.md`
- If implementation produced new decisions or surfaced new assumptions → update `memory/SPEC.md` §Decisions / §Assumptions
- If the plan needs significant revision → suggest `ln-plan`; if the spec needs revision → suggest `ln-spec`

## Routing

After the slice lands, present these options to the user (use `tool-ask-question`):

| #   | Label            | Target       | Why                                          |
| --- | ---------------- | ------------ | -------------------------------------------- |
| 1   | Scope next slice | `ln-scope`   | More slices remain on the plan               |
| 2   | Review the code  | `ln-review`  | Assess quality after an implementation burst |
| 3   | Update spec      | `ln-spec`    | Build surfaced spec-level changes            |
| 4   | Revise plan      | `ln-plan`    | Revisit the plan or re-prioritize            |
| 5   | Back to triage   | `ln-consult` | Direction needs reassessment                 |

Recommended: **1** if pending slices exist, **2** after multiple consecutive builds.

---
*Draws from [mattpocock/skills/tdd](https://github.com/mattpocock/skills/tree/main/tdd).*
