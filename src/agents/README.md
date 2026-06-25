# agents/ — Brunch agent context ingress

SPEC decisions: D39-L, D40-L, D52-L, D60-L, D85-L, D90-L, D91-L, D93-L

## Owns

`src/agents/` is the Pi-independent home for Brunch-authored model-facing context. It now owns bundled agent prompt bodies, Brunch prompt-resource skills, prompt composition/runtime legality, seed context composition, and the central registry for prompt/skill paths.

```text
agents/
├── README.md
├── prompts/           bundled foreground/background agent body markdown
├── skills/            strategy/lens/method prompt-resource markdown
├── runtime/           prompt composition and prompt-resource/tool legality
├── contexts/          agent-visible context text, currently seed composition
├── registry.ts        path registry for bundled agent bodies and prompt-resource skills
└── __tests__/         registry/topology tests
```

## Boundary rules

```pseudo
rules:
  agents/registry.ts -> agents/prompts/*/SYSTEM.md [body file locations]
  agents/registry.ts -> agents/skills/*/*/SKILL.md [prompt-resource locations]
  agents/contexts/   -> graph/, session/, renderers/ [agent-visible text over already-read facts]
  .pi/extensions/*   -> agents/                   [adapters ask for Brunch-authored context]
  session/           -> agents/contexts/seeds/    [origination asks for seed payload text]
  projections/session/runtime-policy.ts -> agents/registry.ts [temporary roster-location edge]
  agents/            x> Pi extension hooks        [no registration side effects]
```

## Migration note

This directory is intentionally mid-migration. Agent prompt bodies, prompt-resource skills, prompt composition, prompt-resource/tool legality, and context seed composition have moved here byte-stably. Later slices move reusable agent-visible renderers here; Pi extensions remain runtime adapters that register hooks/tools and call this layer.
