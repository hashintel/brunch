---
name: ln-plan
description: "Break a feature or project area into frontier-ordered work packets and update `memory/PLAN.md`. Re-run to retire completed work, reorder priorities, or add new items."
argument-hint: "[feature or project area to plan]"
---

# Ln Plan

Plan the **rolling frontier**, not the whole historical timeline.

The mature-mode shape is:

- `Active` — ordered work that is open now
- `Next` — near-horizon items, loosely ordered
- `Horizon` — future work, lightly shaped
- `Recently Completed` — last 2-3 completed items only
- `Dependencies` — active / next blocking relationships only

Archive deeper history to `docs/archive/PLAN_HISTORY.md` instead of keeping it live in `memory/PLAN.md`.

## Input

The feature or project area: $ARGUMENTS

If context is thin, run a brief interview — not a full `ln-grill`.

If this is a fresh thread or the frontier rationale is unclear, read `HANDOFF.md` if present before planning.

## Planning rules

### Work-type awareness

Classify each item before deciding how much planning weight it needs.

| Work type | Planning weight |
| --- | --- |
| Structural | full packet with `memory/SPEC.md` traceability |
| Bounded feature | objective + acceptance + verification; add `memory/SPEC.md` links only if durable boundaries change |
| Hardening | task-level objective + acceptance |
| Bugfix | usually do not add to `memory/PLAN.md` unless it changes frontier priority |
| Refactor | route through `ln-refactor` unless it is itself frontier work |

### Anti-fragmentation

Create a new item only when it introduces at least one of:

1. a new lifecycle seam
2. a new transport or persistence seam
3. a new workflow entry / exit behavior
4. a meaningful unblocker for forward progress

Do not fragment the plan for minor action/status variants or ordinary follow-through inside a settled seam.

### Epistemic horizon

If live low-confidence assumptions block downstream work, stop the plan at that boundary. Plan spikes or thinner proving steps, not fantasy certainty.

## Procedure

1. Read `memory/PLAN.md` if it exists. Retire or archive stale completed material.
2. Read `memory/SPEC.md` if it exists. Pull only the live requirements, assumptions, decisions, and invariants that still constrain forward work.
3. Explore the codebase enough to understand real boundaries.
4. Draft or revise `Active`, `Next`, and `Horizon`.
5. Add `Why now / unlocks` for `Active` or `Next` items when ordering would otherwise be opaque to a fresh thread.
6. Keep `Recently Completed` to 2-3 terse items max. Move older history to `docs/archive/PLAN_HISTORY.md`.
7. Update `Dependencies` to reflect only active / next items.

## Traceability

Traceability is conditional on structural significance.

- Structural items should name relevant requirements, assumptions, decisions, or invariants from `memory/SPEC.md`.
- Bounded features and hardening tasks only need SPEC links if they change durable boundaries or depend on a live assumption.

## Output

Write or update `memory/PLAN.md` using the [plan template](assets/plan-template.md).

## Routing

After writing the plan, present these options to the user (use `tool-ask-question`):

| #   | Label             | Target       | Why |
| --- | ----------------- | ------------ | --- |
| 1   | Scope next item   | `ln-scope`   | The frontier is clear and ready to scope |
| 2   | Design oracles    | `ln-oracles` | Verification design needs explicit work |
| 3   | Grill it more     | `ln-grill`   | Planning surfaced unresolved product questions |
| 4   | Back to triage    | `ln-consult` | Direction needs reassessment |

Recommended: **1**
