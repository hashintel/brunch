# agents/ — Brunch agent context ingress

SPEC decisions: D39-L, D40-L, D52-L, D60-L, D85-L, D90-L, D91-L, D93-L

## Owns

`src/agents/` is the Pi-independent home for Brunch-authored model-facing context and runtime policy. It now owns bundled agent prompt bodies, Brunch prompt-resource skills, foreground roster policy, prompt composition/runtime legality, seed context composition, reusable agent-visible context renderers, and the central registry for prompt/skill paths.

```text
agents/
├── README.md
├── prompts/           bundled foreground/background agent body markdown
├── skills/            strategy/lens/method prompt-resource markdown
├── runtime/           prompt composition and prompt-resource/tool legality
├── contexts/          agent-visible seed, context-tool, graph, and exchange text
├── registry.ts        path registry for bundled agent bodies and prompt-resource skills
└── __tests__/         registry/topology tests
```

## Boundary rules

```pseudo
rules:
  agents/registry.ts -> agents/prompts/*/SYSTEM.md [body file locations]
  agents/registry.ts -> agents/skills/*/*/SKILL.md [prompt-resource locations]
  agents/contexts/   -> graph/, projections/, session/, workspace/ [agent-visible text over already-read facts]
  agents/runtime/    -> agents/registry, projections/session/capability-readiness, session/schema
  .pi/extensions/*   -> agents/                   [adapters ask for Brunch-authored context]
  session/           -> agents/contexts/seeds/    [origination asks for seed payload text]
  projections/session/runtime-state.ts -> agents/runtime/policy.ts [consume code-owned roster]
  agents/            x> Pi extension hooks        [no registration side effects]
```

## Migration note

Agent prompt bodies, prompt-resource skills, foreground roster/tool policy, prompt composition, prompt-resource/tool legality, seed context composition, reusable agent-visible context renderers, and formerly adapter-local model-facing text live here. Pi extensions remain runtime adapters that register hooks/tools, gather data, and call this layer for Brunch-authored text.
