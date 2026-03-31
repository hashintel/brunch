---
name: ln-plan
description: "Break a feature or project into vertical slices and update memory/PLAN.md. Re-run to retire completed slices or add new ones. Use when starting a new feature, creating an implementation plan, or organizing work."
argument-hint: "[feature or project area to plan]"
---

# Dev Plan

Break a feature into tracer-bullet slices and spikes (Hunt & Thomas), grouped into temporal phases. Slices are thin end-to-end paths through all integration layers. Order by uncertainty first, dependency second (Reinertsen: retire risk early, not just finish tasks early).

## Input

The feature or project area: $ARGUMENTS

If context is thin, run a brief interview (not a full `ln-grill`) to fill gaps.

## Plan

1. If `memory/PLAN.md` exists, read it first. Retire completed slices (mark `done`). Assess what remains and what's changed.
2. Explore the codebase. Identify architectural constraints the slices must respect (routes, schema, auth, third-party boundaries).
3. Draft or revise phases and slices. Each slice must be independently demoable and independently grabbable where possible. Group into temporal phases. For each, name dependent requirements and assumptions from `memory/SPEC.md`.
4. Confirm with user — adjust granularity, reorder, split or merge.

## Output

Write or update `./memory/PLAN.md` following the template at `@resources/plan-template.md`.

### Traceability

Every slice and spike must name its dependent requirements and assumptions from `memory/SPEC.md`. This is the bridge between the two documents — invalidating an assumption in SPEC surfaces every slice it touches in PLAN.

## Routing

After writing the roadmap, present these options to the user (use `tool-ask-question`):

| #   | Label             | Target       | Why                                             |
| --- | ----------------- | ------------ | ----------------------------------------------- |
| 1   | Scope first slice | `ln-scope`   | Plan is written, define the first pending slice |
| 2   | Grill it more     | `ln-grill`   | Plan has gaps that need deeper understanding    |
| 3   | Back to triage    | `ln-consult` | Direction needs reassessment                    |

Recommended: **1**

---
*Draws from [mattpocock/skills/prd-to-plan](https://github.com/mattpocock/skills/tree/main/prd-to-plan) and [mattpocock/skills/prd-to-issues](https://github.com/mattpocock/skills/tree/main/prd-to-issues).*
