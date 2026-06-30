# _suspended/strategies/ — suspended historical interaction sources

SPEC decisions: D25-L, D26-L, D53-L, D85-L, D98-L

This directory contains historical strategy-axis prompt resources only. Under D98-L they are not active prompt resources, not user-changeable runtime axes, and not model-routable skills.

## Current disposition

| Suspended source | Surviving guidance | Current live home |
| --- | --- | --- |
| `freestyle` | ordinary user-driven turns remain valid; structured exchange is optional when useful | `src/agents/prompts/elicitor.md` |
| `step-wise-decision-tree` | ask one focused structured question, branch from the answer, abstain on weak classification support | `src/agents/skills/elicit/SKILL.md` |
| `step-wise-disambiguate` | use contrastive examples to collapse graph-relevant ambiguity | `src/agents/skills/elicit/SKILL.md` |

## Boundary rules

```pseudo
rules:
  agents/runtime/elicitor/ x> _suspended/strategies/ [live elicitor does not load strategy-axis resources]
  _suspended/strategies/ -> agents/skills/{elicit}/SKILL.md [historical source only]
  _suspended/strategies/ -> agents/prompts/elicitor.md [historical source only]
```

Do not add new active strategy members here. If future work needs interaction-shape guidance, add it to a live activity-owned home or create a new SPEC/PLAN decision that reopens prompt-resource organization.
