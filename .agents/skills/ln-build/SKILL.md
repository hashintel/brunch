---
name: ln-build
description: "Implement one scoped slice using TDD red-green-refactor. Use when ready to write code for a defined slice of work, or when the user wants test-driven development."
argument-hint: "[paste or reference a ln-scope card]"
---

# Ln Build

Implement **one** slice. Beck's red-green-refactor, one cycle, no scope creep.

## Input

A scope card from `ln-scope`, or one commit-sized step from `memory/REFACTOR.md`: $ARGUMENTS

The canonical path is `ln-scope` → `ln-build`. For refactors, `ln-refactor` may hand off one commit-sized step to implement. If neither a scope card nor a single refactor step exists, suggest `ln-scope` or `ln-refactor` first. Accept a raw behavior description only for trivial changes where scoping would be ceremony.

Extract: target behavior, boundary crossings, acceptance criteria, and **verification approach**. For refactor steps, derive these from the selected commit step and existing tests before writing new code.

## Red

Translate acceptance criteria into failing tests. If the scope card includes a verification approach, the oracle strategy informs test design — schema validation oracles become Zod parse assertions, differential oracles become golden master comparisons, round-trip oracles become persist-then-query cycles.

Run them. Confirm each fails for the expected reason — a test that fails with an error is not red, it is broken.

If tests pass unexpectedly, the scope was wrong. Tighten assertions or revisit `ln-scope`.

## Green

Write the minimum code to pass the tests. Build inside-out: functional core first (pure domain logic, no I/O), then imperative shell (thin I/O adapter), then wire end-to-end (Bernhardt, "Boundaries").

No speculative abstractions. YAGNI. Only extract when two concrete cases force it.

## Refactor

Tests are green. Now improve: align names to the lexicon in `memory/SPEC.md`, deepen shallow modules (Ousterhout), make invalid states unrepresentable (Minsky), delete anything unused. Never refactor while tests are red.

## Verify and commit

Run the project's verification harness. All checks must pass. Commit: `feat: [target behavior in lowercase]`

## Traceability (mandatory — do before routing)

After the slice lands and verification passes, do all of these before presenting routing options:

1. If working from `memory/PLAN.md`, mark the slice `done`. Check `## Dependencies` — if this slice unblocked multiple downstream slices, note them as newly available (some may be parallelizable). If working from `memory/REFACTOR.md`, mark the commit step complete there instead
2. Update `memory/SPEC.md` §Assumptions — set `Status` to `validated` or `invalidated` as evidence warrants, update `Confidence` if the evidence changed it, and flag implicated slices in PLAN.md
3. Add new invariants to `memory/SPEC.md` §Invariants — each structural property now protected by tests. If working from `memory/PLAN.md`, update the `Invariants established` field on the corresponding slice
4. Add any new decisions to `memory/SPEC.md` §Decisions, new assumptions to §Assumptions
5. Update `memory/SPEC.md` §Verification Design → Current Coverage with new test files and counts

These are bookkeeping steps, not optional. Routing comes after.

## Routing

After traceability is complete, present these options to the user (use `tool-ask-question`):

| #   | Label            | Target       | Why                                                          |
| --- | ---------------- | ------------ | ------------------------------------------------------------ |
| 1   | Scope next slice | `ln-scope`   | More slices remain — if multiple were unblocked, name them   |
| 2   | Review the code  | `ln-review`  | Assess quality after an implementation burst (chains to `ln-refactor` if structural issues found) |
| 3   | Revise spec      | `ln-spec`    | Build revealed the spec needs structural revision            |
| 4   | Revise plan      | `ln-plan`    | Revisit the plan or re-prioritize                            |
| 5   | Back to triage   | `ln-consult` | Direction needs reassessment                                 |

Recommended: **1** if pending slices exist, **2** after multiple consecutive builds.

---
*Draws from [mattpocock/skills/tdd](https://github.com/mattpocock/skills/tree/main/tdd).*
