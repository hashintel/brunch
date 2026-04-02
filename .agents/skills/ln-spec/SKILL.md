---
name: ln-spec
description: "Crystallize shared understanding into a reviewable spec, or update an existing one. Use when the problem needs a written specification, when assumptions or decisions have changed, or when the user says 'write a spec'."
argument-hint: "[feature or problem to specify]"
---

# Dev Spec

Crystallize understanding into a **spec** — the reviewable decision record between shared agreement and actionable plan. Every section should close a decision; a spec that restates the conversation instead of narrowing the solution space has failed.

Skip steps that are unnecessary (e.g. already covered by prior skills in this session). This is not a checklist — it is a workflow.

## Input

The feature or problem: $ARGUMENTS

## Procedure

**Mode detection.** If the user provides a specific finding, research result, or decision to record — not a new feature area — this is a **patch**, not a full pass. Skip to step 5.

1. **Capture the problem** from the user's perspective — what they want and *why*. The *why* shapes the solution space.
2. **Explore the codebase** to verify assertions, understand current state, and find existing patterns. If `memory/SPEC.md` exists, read it first — this is an update, not a blank-slate write.
3. **Interview** (if understanding is thin), to close remaining gaps. Walk each branch of the design tree. For each question, provide your recommended answer. If the codebase can answer a question, explore it instead of asking. Use `/ln-grill` if it hasn't already been run.
4. **Sketch modules** to build or modify. Apply Ousterhout's depth test — favor deep modules with small interfaces and large hidden implementations, testable in isolation. Check with the user that modules match expectations. Use `/ln-design` if it hasn't already been run.
5. **Write or update** `./memory/SPEC.md`.

## Output

Write or update `./memory/SPEC.md` following the template at `@resources/spec-template.md`. If the file already exists, read it first — preserve existing content, evolve sections that need change.

### Verification Design boundary

ln-spec owns the **inner loop** of verification design: verification commands, verification policy, and inner-loop oracle items (type checks, fast unit tests, linting). Middle and outer loop oracle strategy, diagnostic assessment, and blind spots are owned by `ln-oracles`. When writing or updating §Verification Design, preserve any content written by ln-oracles (§Verification Stance, §Diagnostic Assessment, §Oracle Strategy middle/outer tiers, §Design notes, §Acknowledged Blind Spots).

### Traceability

If `memory/PLAN.md` exists, verify that changed assumptions and decisions still align with affected slices.

### Cross-reference integrity

Every amendment must close its reference chain. After editing, verify:

- **New assumption** → has: dependent decision(s), implicated slice(s) in PLAN.md, validation approach
- **New decision** → has: dependent assumption(s), supersession note
- **New invariant** → has: establishing slice in PLAN.md, protecting test (or `manual (outer loop)`), proved decision
- **New constraint** → has: rationale for exclusion
- **New inner-loop oracle item** → names the invariant(s) it protects

## Routing

After filing the spec, present these options to the user (use `tool-ask-question`):

| #   | Label            | Target        | Why                                               |
| --- | ---------------- | ------------- | ------------------------------------------------- |
| 1   | Plan slices      | `ln-plan`     | Spec is complete, break it into slices            |
| 2   | Design oracles   | `ln-oracles`  | Spec needs middle/outer loop verification design  |
| 3   | Grill it more    | `ln-grill`    | Spec has gaps that need deeper understanding      |
| 4   | Back to triage   | `ln-consult`  | Direction needs reassessment                      |

Recommended: **1** (then **2** after planning, or **2** now if verification is the pressing concern)

---
*Adapted from [mattpocock/skills/write-a-prd](https://github.com/mattpocock/skills/tree/main/write-a-prd).*
