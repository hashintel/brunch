# agents/ — Brunch agent context ingress

SPEC decisions: D39-L, D40-L, D52-L, D60-L, D85-L, D90-L, D91-L, D93-L

## Owns

`src/agents/` is the Pi-independent home for Brunch-authored model-facing context. In the current migration slice it owns only the central registry for bundled agent bodies and Brunch prompt-resource skill paths; the markdown files still live under `src/.pi/` until the move slices land.

```text
agents/
├── README.md
├── registry.ts        current path registry for bundled agent bodies and prompt-resource skills
└── __tests__/         registry/topology tests
```

## Boundary rules

```pseudo
rules:
  agents/registry.ts -> .pi/agents/*/SYSTEM.md   [current body file locations]
  agents/registry.ts -> .pi/skills/*/*/SKILL.md  [current prompt-resource locations]
  .pi/extensions/*   -> agents/registry.ts       [adapters ask for Brunch-authored context locations]
  projections/session/runtime-policy.ts -> agents/registry.ts [temporary roster-location edge]
  agents/            x> Pi extension hooks       [no registration side effects]
```

## Migration note

This directory is intentionally thin right now. It establishes the owner for LLM context ingress without moving bytes in the same slice. Later slices move prompt bodies, skills, prompt composition, seed context, runtime policy, and agent-visible renderers here; Pi extensions remain runtime adapters that register hooks/tools and call this layer.
