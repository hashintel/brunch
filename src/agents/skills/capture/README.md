# agents/skills/capture/ — live capture conduct

SPEC decisions: D66-L, D81-L, D82-L, D98-L

## Owns

`src/agents/skills/capture/` is the activity-named home for live capture guidance once durable conduct is lifted out of the suspended method taxonomy. It currently has no advertised `SKILL.md`; the live elicitor prompt owns active capture conduct directly.

## Boundary Rules

```pseudo
rules:
  agents/runtime/elicitor/ -> agents/prompts/elicitor.md [current live conduct]
  agents/skills/capture/  x> agents/runtime/suspended/ [no legacy axis dependency]
  agents/skills/capture/  x> TypeScript imports [read-only prompt resources when present]
```
