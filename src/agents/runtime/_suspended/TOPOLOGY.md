# agents/runtime/_suspended/ — suspended runtime control system

SPEC decisions: D40-L, D52-L, D85-L, D98-L

## Owns

`src/agents/runtime/_suspended/` is the quarantine home for the pre-D98 runtime control system: strategy/lens/method prompt-resource selection, readiness-derived method legality, elicitation-gap recommendations, and axis-shaped context policy that no longer owns live elicitor behavior.

## Boundary Rules

```pseudo
rules:
  agents/runtime/_suspended/ -> agents/skills/_suspended/ [legacy prompt resources]
  agents/runtime/_suspended/ -> agents/contexts/_suspended/ [legacy context controls]
  agents/runtime/elicitor/ x> agents/runtime/_suspended/ [live elicitor source of truth stays separate]
```

## Migration Note

Move code here only when the live elicitor no longer calls it. Compatibility shims are allowed for non-elicitor readers during the suspension phase, but they should point at the suspended owner rather than keeping legacy concepts mixed into the live runtime path.
