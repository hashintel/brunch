# agents/skills/elicit/ — live elicitation conduct

SPEC decisions: D40-L, D52-L, D82-L, D98-L

## Owns

`src/agents/skills/elicit/` is the activity-named home for durable question and exchange guidance once it is no longer expressed as a suspended method resource. `SKILL.md` now provides the durable Agent Skills–compliant guidance stub for this activity home, while the live elicitor prompt still owns the currently active elicitation conduct directly.

## Boundary Rules

```pseudo
rules:
  agents/runtime/elicitor/ -> agents/prompts/elicitor.md [current live conduct]
  agents/skills/elicit/   x> agents/runtime/_suspended/ [no legacy axis dependency]
  agents/skills/elicit/   x> TypeScript imports [read-only prompt resources when present]
```
