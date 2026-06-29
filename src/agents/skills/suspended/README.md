# agents/skills/suspended/ — suspended prompt-resource taxonomy

SPEC decisions: D25-L, D52-L, D85-L, D95-L, D98-L

## Owns

`src/agents/skills/suspended/` is the quarantine home for prompt resources organized by the retired strategy/lens/method taxonomy when those resources no longer participate in the live elicitor manifest.

## Boundary Rules

```pseudo
rules:
  agents/runtime/suspended/ -> agents/skills/suspended/ [legacy manifest compatibility]
  agents/runtime/elicitor/ x> agents/skills/suspended/ [live elicitor does not negotiate prompt resources]
  agents/skills/suspended/ x> TypeScript imports [read-only prompt resources]
```

## Migration Note

The first phase names the suspended boundary. Later slices may move surviving legacy resources here or regroup useful guidance under activity-named live directories.
