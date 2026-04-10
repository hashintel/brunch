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

After the slice lands and verification passes, update only the traceability items touched by this slice. For each candidate artifact, choose exactly one action: **add**, **update**, **merge**, **archive**, or **no-op**.

### Local comparison set

Compare new facts only against items the current slice already references:

- the current slice block in `memory/PLAN.md` (and its tracer bullets)
- rows in `memory/SPEC.md` named by the slice (§Assumptions, §Decisions, §Invariants to respect/established)
- assumption/decision IDs from the scope card
- test files added or changed in this slice

Do **not** scan the whole spec looking for the perfect merge target. If nothing in this local set clearly matches, **add** and let `ln-sync` consolidate later.

### Same-item tests

Use these to decide whether a candidate fact is already covered by an existing local row:

- **Same assumption** = same boundary/component + same unresolved claim. Differences in wording, confidence, evidence, or validation method → same assumption.
- **Same decision** = same seam/boundary + same chosen alternative. Narrower helpers, file layout, implementation mechanics, or first concrete use of an already-chosen pattern → same decision.
- **Same invariant** = same seam/boundary + same rule template + same proved decision(s). Approve/reject, confirm/force-close, reload/refresh/resume, or kind/phase/state variants of one shared rule → same invariant.

### Steps

1. **Mark completion.** Mark the slice or tracer bullet `done` in `memory/PLAN.md`. Note newly unblocked downstream slices.

2. **Assumptions** — for each assumption the slice touched or relied on:
   - Evidence answered it → **update** status to `validated` or `invalidated`; flag implicated slices
   - Evidence changed certainty only → **update** confidence
   - Same assumption exists locally → **merge** into it
   - New unresolved belief the slice depended on, not already guaranteed by code/tests, and if false would change future work → **add**
   - Otherwise → **no-op**

3. **Decisions** — a decision records a committed choice at a seam, not an execution diary entry:
   - Slice only implemented an existing decision without changing the choice → **no-op**
   - Same decision exists locally and choice stayed the same → **update** (clearer rationale/scope) or **merge** (narrower instance of same pattern)
   - Slice chose one alternative among ≥2 plausible alternatives, non-trivial to reverse, future work could revisit → **add**
   - Slice changed the answer at the same seam → **add** new row with `Supersedes: Dn`
   - Otherwise → **no-op**

4. **Invariants** — prefer one seam-level invariant over many branch-level invariants:
   - No new/changed test protects the property → **no-op**
   - Property is temporary migration state or one example of a broader rule → **merge** or **no-op**
   - Same invariant exists locally and only `Protected by` grew → **update**
   - Candidate is another branch/state/kind/phase/action variant of the same rule → **merge** (keep surviving ID, union `Protected by`, append to `Established by` only if the statement widened)
   - Property can regress independently of all local invariants (different seam, rule, proved decision, or test family) → **add**
   - Otherwise → **merge**

5. **Completed-slice note in PLAN.md** — max 4 bullets / 6 lines:
   - shipped outcome
   - seam changed (optional)
   - evidence (tests/manual)
   - remaining debt or follow-up (optional)
   - If a note already exists, **update** it; do not append another paragraph. If marking `done` plus invariant/decision updates already captures everything → **no-op**

6. **Verification coverage** — update `memory/SPEC.md` §Current Coverage. If the test file already appears, **update** counts; do not add a duplicate entry.

When uncertain between merge and add → add. When uncertain between update and no-op → update.

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
