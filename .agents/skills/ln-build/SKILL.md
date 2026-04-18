---
name: ln-build
description: "Implement one scoped slice using TDD red-green-refactor. Use when ready to write code for a defined slice of work, or when the user wants test-driven development."
argument-hint: "[paste or reference an ln-scope card]"
---

# Ln Build

Implement **one** scope card. Beck's red-green-refactor, one cycle, no scope creep.

## Input

A full or light scope card from `ln-scope`, or a trivial direct-fix request: $ARGUMENTS

Extract: target behavior / objective, acceptance criteria, and verification approach.

Treat the scope card as the next implementation step inside its containing `memory/PLAN.md` frontier item. The frontier item is the plan-level work item; the scope card is just the current execution step inside it. Unless `ln-plan` has already split the frontier into separate items, do **not** infer a new Linear issue or Graphite branch from scope-card granularity; multiple consecutive scope cards may land on the same branch.

Re-enter before red.

If this is a fresh thread or an unfamiliar area, reload:

1. `memory/SPEC.md`
2. `memory/PLAN.md`
3. `HANDOFF.md` if present
4. `docs/archive/PLAN_HISTORY.md` only if the frontier or touched area is still unclear

Write a 2-4 bullet orientation note naming the containing seam, the frontier item, any manual verification debt, and the main open risk.

If the request is a direct fix and you cannot name the containing seam or whether it is settled, stop and route through `ln-scope` first.

Do not invent new planning docs, scratch histories, or alternate memory locations while building. Durable state reconciles back into `memory/SPEC.md` and `memory/PLAN.md`; temporary support artifacts stay in `HANDOFF.md` or `memory/REFACTOR.md` only while they are still live.

## Red

Translate acceptance criteria into failing tests when the change benefits from them. For bugfixes or subtle seam changes, prefer one high-leverage regression test. For trivial maintenance or doc-only work, tests may be unnecessary.

Run the relevant checks. Confirm failures are meaningful.

## Green

Write the minimum code to pass. Build inside-out: functional core first, thin I/O shell second, then end-to-end wiring.

No speculative abstractions. Only extract when two concrete cases force it.

## Refactor

With tests green, improve names, boundaries, and obvious local structure. Do not widen scope.

## Verify and commit

Run the project's verification harness. All checks must pass.

## Canonical reconciliation (mandatory)

After verification, reconcile canonical state every time. The reconciliation may end in a no-op, but skipping it is not allowed.

Traceability depth is **conditional**, not automatic.

After the build lands and verification passes, ask:

- [ ] Did this establish or change a seam / boundary?
- [ ] Did this make or reverse a non-trivial design decision?
- [ ] Did this retire or create an assumption?
- [ ] Did this establish a new seam-level invariant?

### If all answers are no

- Mark the work done in `memory/PLAN.md` **if it was tracked there**
- Update `Recently Completed` if the plan uses it
- Do **not** add new SPEC/PLAN bookkeeping just because work happened
- If the work was non-trivial, required manual verification, or leaves residual risk, record `Done / Verified / Watch` in `memory/PLAN.md` `Recently Completed` when that watch matters beyond the current session

### If any answer is yes

Update only the touched traceability items.

#### Same-item tests

- **Same assumption** = same boundary/component + same unresolved claim
- **Same decision** = same seam/boundary + same chosen alternative
- **Same invariant** = same seam/boundary + same rule template + same proved decision(s)

#### Update rules

1. **PLAN**
   - Mark the item done if it was tracked
   - If the change closes or unblocks a frontier item, reflect that in `Active`, `Next`, or `Recently Completed`

2. **Assumptions**
   - evidence answered it → update to `validated` or `invalidated`
   - same assumption exists locally → merge/update
   - new unresolved belief that would change future work if false → add

3. **Decisions**
   - existing decision merely implemented → no-op
   - same decision, wider rationale/scope → update
   - genuinely new alternative chosen at a seam → add

4. **Invariants**
   - no new protecting oracle/test → no-op
   - same seam-level invariant gained coverage → update
   - genuinely independent seam/rule/proof → add

When uncertain between merge and add, add. When uncertain between update and no-op, update.

If uncertain whether the seam is actually settled, promote — do not silently keep the work light.

### Retire derivative artifacts

After reconciliation, garbage-collect exhausted temporary files instead of leaving breadcrumbs or tombstones:

- `HANDOFF.md` — keep only if unfinished volatile transfer state still exists; otherwise delete it
- `memory/REFACTOR.md` — keep only while unfinished refactor steps still depend on it; otherwise delete it
- Do not create archive copies, numbered handoffs, or completion-pointer files

## Routing

After verification and any necessary promotion updates, present these options to the user (use `tool-ask-question`):

| #   | Label            | Target       | Why |
| --- | ---------------- | ------------ | --- |
| 1   | Scope next item  | `ln-scope`   | More frontier work remains |
| 2   | Review the code  | `ln-review`  | Assess quality after an implementation burst |
| 3   | Revise spec      | `ln-spec`    | The build changed durable architecture |
| 4   | Revise plan      | `ln-plan`    | The frontier or priorities changed |
| 5   | Back to triage   | `ln-consult` | Direction needs reassessment |

Recommended: **1** if more work remains, **2** after multiple consecutive builds.
