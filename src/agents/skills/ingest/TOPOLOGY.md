# agents/skills/ingest/ — source intake conduct

SPEC decisions: D66-L, D81-L, D82-L, D98-L, D99-L / I52-L

## Owns

`src/agents/skills/ingest/` owns source intake conduct: identifying whether material came from a human answer, paste, referenced document/URL, or brownfield inspection; digesting raw or large material; and preserving provenance phrasing before graph mapping. It delegates graph kind, edge, and settlement guidance to `src/agents/skills/map/references/`.

## Boundary Rules

```pseudo
rules:
  agents/runtime/elicitor/ -> agents/prompts/elicitor.md [current live conduct]
  agents/skills/ingest/  -> agents/skills/map/references/ [graph mapping and routing]
  agents/skills/ingest/  x> agents/runtime/_suspended/ [no legacy axis dependency]
  agents/skills/ingest/  x> TypeScript imports [read-only prompt resources when present]
```
