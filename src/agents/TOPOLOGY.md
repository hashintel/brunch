# agents/ — Brunch agent context ingress

SPEC decisions: D39-L, D40-L, D52-L, D60-L, D85-L, D90-L, D91-L, D93-L, D98-L

## Owns

`src/agents/` is the Pi-independent home for Brunch-authored model-facing context and runtime policy. It now owns bundled agent prompt bodies, Brunch prompt-resource skills, foreground roster policy, live elicitor prompt/context assembly, prompt composition/runtime legality, seed context composition, reusable agent-visible context renderers, and the central registry for prompt/skill paths.

```text
agents/
├── README.md
├── prompts/           flat foreground elicit/execute body markdown
├── subagents/         flat background subagent body markdown
├── skills/            activity prompt resources plus suspended legacy taxonomy
├── runtime/           live elicitor runtime, shared helpers, and suspended controls
├── contexts/          live elicitor context plus reusable seed/graph/exchange text
├── registry.ts        path registry for foreground bodies and prompt-resource skills
└── __tests__/         registry/topology tests
```

## Boundary rules

```pseudo
rules:
  agents/registry.ts -> agents/prompts/{elicitor,executor}.md [foreground body file locations]
  .pi/extensions/subagents/agents.ts -> agents/subagents/*.md [background body file locations]
  agents/registry.ts x> agents/skills/_suspended/*/*/SKILL.md [no live prompt-resource registry]
  agents/contexts/   -> graph/, projections/, session/, workspace/ [agent-visible text over already-read facts]
  agents/runtime/elicitor -> agents/prompts, agents/contexts/live [live SPEC-mode source of truth]
  agents/runtime/    -> agents/registry, agents/prompts, agents/skills, session/schema
  .pi/extensions/*   -> agents/                   [adapters ask for Brunch-authored context]
  session/           -> agents/contexts/seeds/    [origination asks for seed payload text]
  projections/session/runtime-state.ts x> agents/runtime/_suspended/ [public projection stays mode/role only]
  agents/            x> Pi extension hooks        [no registration side effects]
```

## Migration note

Foreground prompt bodies, background subagent bodies, prompt-resource skills, foreground roster/tool policy, live elicitor prompt/context assembly, prompt composition, prompt-resource/tool legality, seed context composition, reusable agent-visible context renderers, and formerly adapter-local model-facing text live here. Pi extensions remain runtime adapters that register hooks/tools, gather data, and call this layer for Brunch-authored text.

The simplified elicitor lives under `runtime/elicitor/` and `contexts/live/`. The pre-D98 strategy/lens/method control system is quarantined under `runtime/_suspended/`, `contexts/_suspended/`, and `skills/_suspended/`; normal live topology should not import it.
