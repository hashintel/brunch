# agents/skills/review/ — live review conduct

SPEC decisions: D52-L, D85-L, D95-L, D98-L

## Owns

`src/agents/skills/review/` is the activity-named home for durable review guidance once it is no longer expressed as a suspended lens or method resource. `SKILL.md` now provides the durable Agent Skills–compliant guidance stub for this activity home, while live review conduct is still expressed through the elicitor prompt and graph review tools.

## Boundary Rules

```pseudo
rules:
  agents/runtime/elicitor/ -> agents/prompts/elicitor.md [current live conduct]
  agents/skills/review/   x> agents/runtime/_suspended/ [no legacy axis dependency]
  agents/skills/review/   x> TypeScript imports [read-only prompt resources when present]
```
