# agents/runtime/elicitor/ — live elicitor prompt runtime

SPEC decisions: D40-L, D52-L, D85-L, D98-L

## Owns

`src/agents/runtime/elicitor/` owns the live SPEC-mode elicitor assembly path: fixed prompt body selection, plain context composition, and the explicit active-tool policy used by the foreground elicitor.

## Boundary Rules

```pseudo
rules:
  agents/runtime/elicitor/ -> agents/prompts/elicitor.md [fixed body]
  agents/runtime/elicitor/ -> agents/contexts/live/ [plain context]
  agents/runtime/elicitor/ -> agents/runtime/shared/ [shared runtime helpers]
  .pi/extensions/agent-runtime/* -> agents/runtime/elicitor/ [adapter wiring]
  agents/runtime/elicitor/ x> agents/runtime/suspended/ [no legacy control reads]
```

## Migration Note

This directory becomes the source of truth for "what prompt and context does the elicitor run with right now?" The parent `agents/runtime/` modules keep their current behavior until the live path is introduced and adapters are rewired.
