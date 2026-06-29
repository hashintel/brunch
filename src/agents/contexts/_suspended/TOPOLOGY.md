# agents/contexts/_suspended/ — suspended elicitor context controls

SPEC decisions: D40-L, D52-L, D60-L, D83-L, D98-L

## Owns

`src/agents/contexts/_suspended/` is the quarantine home for context renderers that exist only to support the pre-D98 elicitor control system while it is being retired. Code here is not part of the live elicitor prompt path.

## Boundary Rules

```pseudo
rules:
  agents/contexts/_suspended/ -> graph/, projections/, session/, workspace/ [legacy context compatibility]
  agents/runtime/_suspended/ -> agents/contexts/_suspended/ [legacy control compatibility]
  agents/runtime/elicitor/ x> agents/contexts/_suspended/ [live elicitor does not read suspended context]
```

## Migration Note

The first phase is suspension rather than deletion. Legacy readiness-shaped, lens-shaped, and recommendation-shaped context can move here only when a non-elicitor compatibility reader still needs it.
