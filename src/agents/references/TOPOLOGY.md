# agents/references/ — runtime-eligible shared references

SPEC decisions: D52-L, D58-L, D85-L, D97-L, D98-L

## Owns

`src/agents/references/` owns static, runtime-eligible Markdown references that skills, prompts, and generated manifests may cite or load on demand. These files are not rendered from current workspace state; they are durable shared reference text for concepts that should not be copied into each skill body.

```text
references/
├── data-model.md           graph vocabulary and model-facing data concepts
├── node-neighbourhoods.md  graph-neighborhood reading guidance
├── product-concept.md      short Brunch product concept
└── readiness-bands.md      canonical readiness, settlement, and band terms
```

## Boundary Rules

```pseudo
rules:
  agents/references/ -> graph/schema + graph/policy [cite schema-owned vocabulary]
  agents/references/ x> runtime state [static reference text only]
  agents/skills/* -> agents/references/ [load-on-demand shared concepts]
  agents/contexts/ x> agents/references/ [contexts render runtime facts, references hold static concepts]
```
