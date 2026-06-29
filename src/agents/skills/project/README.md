# agents/skills/project/ — live projection conduct

SPEC decisions: D52-L, D73-L, D82-L, D98-L

## Owns

`src/agents/skills/project/` is the activity-named home for durable graph projection guidance once it is no longer expressed as a suspended method resource. It currently has no advertised `SKILL.md`; graph projection authority remains code-owned through `graph/` and active tools.

## Boundary Rules

```pseudo
rules:
  graph/                  -> graph/schema/ [typed projection vocabulary]
  agents/skills/project/  x> agents/runtime/suspended/ [no legacy axis dependency]
  agents/skills/project/  x> TypeScript imports [read-only prompt resources when present]
```
