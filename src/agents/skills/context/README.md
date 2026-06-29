# agents/skills/context/ — live context-reading conduct

SPEC decisions: D40-L, D52-L, D60-L, D98-L

## Owns

`src/agents/skills/context/` is the activity-named home for durable context-reading guidance once it is no longer expressed as a suspended method resource. `SKILL.md` now carries the durable Agent Skills–compliant guidance stub for this activity home, while live context shape remains owned by `agents/contexts/live/`.

## Boundary Rules

```pseudo
rules:
  agents/contexts/live/  -> projections/, session/, workspace/ [current context rendering]
  agents/skills/context/ x> agents/runtime/_suspended/ [no legacy axis dependency]
  agents/skills/context/ x> TypeScript imports [read-only prompt resources when present]
```
