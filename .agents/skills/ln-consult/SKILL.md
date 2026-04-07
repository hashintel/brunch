---
name: ln-consult
description: "Lightweight triage for the ln-* skill set. Use when unsure which ln skill to use next, starting work on something new, or when the user asks for guidance on their development process."
---

# Ln Consult

Assess where the user is and suggest one `ln-*` skill.

If context is unclear, ask **one** clarifying question — then recommend.

Canonical flow is usually `ln-grill → ln-spec → ln-plan → [ln-design when interface shape is uncertain] → [ln-oracles when verification strategy needs explicit design] → ln-scope → [ln-spike] → ln-build → ln-review → [ln-refactor] → [ln-sync]`.

## Routing table

| Situation                                                | Suggest       |
| -------------------------------------------------------- | ------------- |
| Idea is vague, needs fleshing out                        | `ln-grill`    |
| Understanding exists, needs a written spec               | `ln-spec`     |
| Spec exists, needs a plan with slices                    | `ln-plan`     |
| Plan/spec exists, needs explicit verification strategy   | `ln-oracles`  |
| Plan exists, next slice needs a scope card               | `ln-scope`    |
| Module interface needs exploration                       | `ln-design`   |
| Scope card exists (from `ln-scope`), ready to code       | `ln-build`    |
| Technical uncertainty blocks a slice                     | `ln-spike`    |
| Code works but needs restructuring                       | `ln-refactor` |
| Code works but quality/architecture needs audit          | `ln-review`   |
| Docs feel stale or out of sync with code                 | `ln-sync`     |
| Session ending, context compacting, or switching threads | `ln-handoff`  |

## Output

```md
## Assessment
[1-2 sentences on current state]
```

## Routing

After assessment, present the top 2–3 relevant options from the routing table to the user (use `tool-ask-question`). Mark the best fit as recommended. If two skills are clearly sequential (e.g., `ln-scope` then `ln-build`), note the sequence in the recommended option's description.
