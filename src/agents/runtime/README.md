# agents/runtime/ — agent prompt runtime policy

SPEC decisions: D40-L, D52-L, D58-L, D85-L, D90-L, D93-L

## Owns

Runtime prompt policy that is Pi-independent: foreground prompt composition, prompt-resource manifest rendering/loading, active method/tool derivation, and agent body location lookup.

```text
runtime/
├── README.md
├── compose.ts          pure prompt composer: agent body + runtime header + context + manifest
├── prompt-skills.ts    prompt-resource manifest loader/renderer
├── state.ts            runtime-state-to-manifest/tool policy projection
├── __tests__/          prompt/runtime policy tests
└── __snapshots__/      Vitest file snapshots for full composed prompts
```

## Boundary rules

```pseudo
rules:
  agents/runtime -> agents/registry, agents/prompts, agents/skills
  agents/runtime -> graph/, projections/, renderers/, session/ [read/projection types and helpers]
  .pi/extensions/agent-runtime/* -> agents/runtime [adapter calls central policy]
  agents/runtime x> .pi extension hooks/tools       [no Pi registration side effects]
```

Pi extensions remain the runtime adapter: they gather the current Pi session state, graph reads, active tool registry, and base system prompt, then call this layer to produce Brunch-authored model-facing text and tool/resource legality.

## Migration note

This directory was moved from `.pi/extensions/agent-runtime/{runtime,system-prompts}` during the LLM-context ingress refactor. The remaining `.pi/extensions/agent-runtime/` files should stay thin: hook registration, Pi API calls, and adapter-specific tool activation only.
