# agents/ — Brunch agent context ingress

SPEC decisions: D39-L, D40-L, D52-L, D60-L, D85-L, D90-L, D91-L, D93-L, D98-L, D130-L

## Owns

`src/agents/` is the Pi-independent home for Brunch-authored model-facing context and runtime policy. It now owns bundled agent prompt bodies, Brunch prompt-resource skills, foreground roster policy, live elicitor prompt/context assembly, prompt composition/runtime legality, seed context composition, reusable agent-visible context renderers, and co-located registries for prompt/resource paths. Code-owned elicitor guidance renders the graph-schema canonical execution-harness title so agent instructions and executor authority cannot rename independently.

```text
agents/
├── TOPOLOGY.md
├── prompts/           flat foreground Specify/Execute body markdown
├── subagents/         flat background subagent body markdown
├── skills/            first-level live activity resources plus their references
├── references/        runtime-eligible shared markdown references
├── runtime/           live elicitor/executor runtime policy and shared helpers
├── shared/            formatting helpers for agent-visible text
└── contexts/          reusable seed/data-model/exchange text
```

## Boundary rules

```pseudo
rules:
  agents/prompts/registry.ts -> agents/prompts/{elicitor,executor}.md [foreground body file locations]
  .pi/extensions/subagents/agents.ts -> agents/subagents/*.md [background body file locations]
  agents/skills/registry.ts -> agents/skills/*/SKILL.md [first-level live skill registry only]
  agents/references/ -> graph/schema + graph/policy [authored shared references cite schema-owned vocabulary]
  agents/contexts/data-model/ -> graph/, projections/, session/, workspace/ [agent-visible text over already-read facts]
  agents/runtime/elicitor -> agents/prompts, agents/runtime/elicitor/context.ts [live Specify-mode source of truth]
  agents/runtime/elicitor -> graph/schema/nodes.ts [canonical Project execution harness title]
  agents/runtime/    -> agents/prompts/registry, agents/prompts, agents/skills, session/schema
  .pi/extensions/*   -> agents/                   [adapters ask for Brunch-authored context]
  session/           -> agents/contexts/seeds/    [origination asks for seed payload text]
  agents/            x> Pi extension hooks        [no registration side effects]
```

## Migration note

Foreground prompt bodies, background subagent bodies, prompt-resource skills, foreground roster/tool policy, live elicitor prompt/context assembly, prompt composition, prompt-resource/tool legality, seed context composition, reusable agent-visible context renderers, and formerly adapter-local model-facing text live here. Pi extensions remain runtime adapters that register hooks/tools, gather data, and call this layer for Brunch-authored text.

The simplified elicitor lives under `runtime/elicitor/`, including its prompt-frame context renderer. Live prompt resources are the first-level homes under `skills/`; strategy/lens/method taxonomy is not a live runtime, registry, or filesystem-discovery concept.
