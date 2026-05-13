---
name: ln-spec
description: "Crystallize shared understanding into a reviewable spec, or update an existing one. Use when the problem needs a written specification, when assumptions or decisions have changed, or when the user says 'write a spec'."
argument-hint: "[feature or problem to specify]"
---

# Ln Spec

Crystallize understanding into a **spec** — the reviewable decision record between shared agreement and actionable plan. Every section should close a decision; a spec that restates the conversation instead of narrowing the solution space has failed.

`memory/SPEC.md` plus `memory/PLAN.md` are the only canonical planning state. Do not spin up sidecar specs, decision logs, or assumption ledgers without explicit permission.

Skip steps that are unnecessary (e.g. already covered by prior skills in this session). This is not a checklist — it is a workflow.

## Input

The feature or problem: $ARGUMENTS

## Procedure

**Mode detection.** If the user provides a specific finding, research result, or decision to record — not a new feature area — this is a **patch**, not a full pass. Skip to step 5.

1. **Capture the problem** from the user's perspective — what they want and *why*. The *why* shapes the solution space.
2. **Explore the codebase** to verify assertions, understand current state, and find existing patterns. If `memory/SPEC.md` exists, read it first — this is an update, not a blank-slate write.
3. **Interview** (if understanding is thin), to close remaining gaps. Walk each branch of the design tree. For each question, provide your recommended answer. If the codebase can answer a question, explore it instead of asking. Use `ln-grill` if it hasn't already been run.
4. **Sketch modules** to build or modify. Apply Ousterhout's depth test — favor deep modules with small interfaces and large hidden implementations, testable in isolation. Check with the user that modules match expectations. Use `ln-design` if it hasn't already been run.
5. **Write or update** `memory/SPEC.md`.

## Output

Write or update `memory/SPEC.md` following the [spec template](assets/spec-template.md). If the file already exists, read it first — preserve existing content, evolve sections that need change.

### Verification Design boundary

ln-spec owns the **inner loop** of verification design: verification commands, verification policy, and inner-loop oracle items (type checks, fast unit tests, linting). Middle and outer loop oracle strategy, diagnostic assessment, and blind spots are owned by `ln-oracles`. Not every scoped slice requires a full oracle-design pass, but frontier items or slices involving LLM behavior, visual rendering, or compositional/system-level claims should route through `ln-oracles` before implementation. When writing or updating §Verification Design, preserve any content written by ln-oracles (§Verification Stance, §Diagnostic Assessment, §Oracle Strategy middle/outer tiers, §Design notes, §Acknowledged Blind Spots).

### Traceability

If `memory/PLAN.md` exists, verify that changed assumptions and decisions still align with affected frontier items. If it does not exist yet, close the reference chain as far as current artifacts allow: assumptions should still name dependent decisions and validation approaches, and frontier links can be added later by `ln-plan`.

### Weight management

Use the same unit-of-record rules as `ln-build` §Same-item tests. Before adding a row, compare against nearby items in the same feature area. Prefer **update** or **merge** over **add** when the seam is the same.

**Units of record:**

- **Assumption** = one unresolved question at one seam
- **Decision** = one committed choice between alternatives at one seam
- **Invariant** = one seam-level structural property protected by tests

**These are not new rows** — they are updates or merges to existing rows:
- confidence changes, validation narratives, added evidence
- helper names, file layout, or implementation mechanics
- one more branch/state/kind/phase/action example of an existing rule
- one implementation step under an already-recorded decision

**Smell checks before adding:**
- The sentence starts with "for this slice" or names a temporary cutover step → probably an update, not a new item
- The difference is only approve/reject, confirm/force-close, or kind/phase/state variants of one shared rule → merge into the seam-level row
- The item would stop making sense once the code ships and no alternative remains live → probably a decision that should not be tracked
- The item is an implementation mechanic inside an already-chosen boundary → no-op

Large cleanup is `ln-sync` work. When writing or patching, keep the touched area coherent; do not attempt a risky whole-document consolidation.

### Cross-reference integrity

Every amendment must close its reference chain as far as the current lifecycle stage allows. After editing, verify:

- **New assumption** → has: dependent decision(s), validation approach, and implicated frontier item(s) in `memory/PLAN.md` **if `memory/PLAN.md` already exists**
- **New decision** → has: dependent assumption(s), supersession note
- **New invariant** → has: establishing frontier item in `memory/PLAN.md` **if known** (or scoped slice if already defined), protecting test (or `manual (outer loop)`), proved decision
- **New constraint** → has: rationale for exclusion
- **New inner-loop oracle item** → names the invariant(s) it protects

## Routing

After filing the spec, present these options to the user (use `tool-ask-question`):

| #   | Label            | Target        | Why                                               |
| --- | ---------------- | ------------- | ------------------------------------------------- |
| 1   | Plan frontier    | `ln-plan`     | Spec is complete, break it into frontier items    |
| 2   | Design oracles   | `ln-oracles`  | Spec needs middle/outer loop verification design  |
| 3   | Grill it more    | `ln-grill`    | Spec has gaps that need deeper understanding      |
| 4   | Back to triage   | `ln-consult`  | Direction needs reassessment                      |

Recommended: **1** (then **2** after planning, or **2** now if verification is the pressing concern)

---
*Adapted from [mattpocock/skills/write-a-prd](https://github.com/mattpocock/skills/tree/main/write-a-prd).*
