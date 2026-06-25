# agents/ — Brunch agent context ingress

SPEC decisions: D39-L, D40-L, D52-L, D60-L, D85-L, D90-L, D91-L, D93-L

## Owns

`src/agents/` is the Pi-independent home for Brunch-authored model-facing context. It now owns bundled agent prompt bodies, Brunch prompt-resource skills, and the central registry for their paths.

```text
agents/
├── README.md
├── prompts/           bundled foreground/background agent body markdown
├── skills/            strategy/lens/method prompt-resource markdown
├── registry.ts        path registry for bundled agent bodies and prompt-resource skills
└── __tests__/         registry/topology tests
```

## Boundary rules

```pseudo
rules:
  agents/registry.ts -> agents/prompts/*/SYSTEM.md [body file locations]
  agents/registry.ts -> agents/skills/*/*/SKILL.md [prompt-resource locations]
  .pi/extensions/*   -> agents/registry.ts       [adapters ask for Brunch-authored context locations]
  projections/session/runtime-policy.ts -> agents/registry.ts [temporary roster-location edge]
  agents/            x> Pi extension hooks       [no registration side effects]
```

## Migration note

This directory is intentionally mid-migration. Agent prompt bodies and prompt-resource skills have moved here byte-stably. Later slices move prompt composition, seed context, runtime policy, and agent-visible renderers here; Pi extensions remain runtime adapters that register hooks/tools and call this layer.
