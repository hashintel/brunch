---
name: ln-consult
description: "Lightweight triage for the ln-* skill set. Use when unsure which ln skill to use next, starting work on something new, or when the user asks for guidance on their development process."
---

# Ln Consult

Assess where the user is, classify the work, and suggest the next `ln-*` skill.

If context is unclear, ask **one** clarifying question — then recommend.

The mature-mode default is conditional, not ceremonial: only structural work should pay the full `spec → plan → scope → build` cost.

Orient, then classify.

## Fresh-thread re-entry

If this is a fresh thread or an unfamiliar area, reload the live context before routing:

1. `memory/SPEC.md`
2. `memory/PLAN.md`
3. `HANDOFF.md` if present
4. `docs/archive/PLAN_HISTORY.md` only if the current frontier or touched area is still unclear

Start the assessment with 2-4 bullets naming:

- the containing seam or subsystem
- the active frontier item or nearby priority
- volatile state or manual follow-up from handoff
- the main open risk

## Work-type classification

Classify the request before routing.

| Work type | Signals | Default handling |
| --- | --- | --- |
| **Structural** | New seam, new boundary, durable architectural choice, invalidates assumptions | `ln-spec` / `ln-plan` / `ln-scope` as needed |
| **Bounded feature** | New capability inside settled seams | `ln-scope` with a lightweight packet, then `ln-build` |
| **Hardening** | Dependency audit, fixture work, perf, tooling upkeep | direct `ln-build` if scope is obvious; `ln-scope` only if the boundary is fuzzy |
| **Bugfix** | Regression or incorrect behavior inside known seams | direct fix + test; route to `ln-build` only if useful |
| **Refactor** | Rename, extract, restructure without changing behavior | `ln-refactor` |

If the work crosses more than two seams, changes a requirement, or would change future planning if it went differently, promote it to **structural**.

If you cannot name the containing seam from the live docs, treat the work as **structural** until proven otherwise.

Presume **structural** on a fresh thread when the work touches workflow closure, routed layout ownership, persistence schema, knowledge-graph behavior, observer sync, or transport contracts.

## Canonical flow

Typical structural flow is:

`ln-grill → ln-spec → ln-plan → [ln-design] → [ln-oracles] → ln-scope → [ln-spike] → ln-build → ln-review → [ln-refactor] → [ln-sync]`

Typical bounded flow is:

`ln-scope → ln-build`

Typical hardening / bugfix flow is:

`ln-build`

## Routing table

| Situation | Work type | Suggest |
| --- | --- | --- |
| Idea is vague, needs fleshing out | structural | `ln-grill` |
| Understanding exists, needs a written spec | structural | `ln-spec` |
| Spec exists, needs work sequencing | structural | `ln-plan` |
| Verification strategy is the main uncertainty | structural | `ln-oracles` |
| Next work item needs precise boundaries | structural or bounded | `ln-scope` |
| Module interface needs exploration | structural | `ln-design` |
| Scope card or lightweight packet exists, ready to code | bounded, hardening, bugfix | `ln-build` |
| Technical uncertainty blocks progress | any | `ln-spike` |
| Code works but needs restructuring | refactor | `ln-refactor` |
| Code works but quality / architecture needs audit | any | `ln-review` |
| Docs are stale, overweight, or milestone context needs cleanup | structural / maintenance | `ln-sync` |
| Session is ending or context is getting fragile | any | `ln-handoff` |

## Output

```md
## Assessment
- [orientation bullet]
- [orientation bullet]
- [1-2 sentences on current state and work classification]
```

## Routing

After assessment, present the top 2–3 relevant options from the routing table to the user (use `tool-ask-question`). Mark the best fit as recommended. If two skills are clearly sequential (for example `ln-scope` then `ln-build`), note the sequence in the recommended option's description.
