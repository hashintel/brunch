# agents/contexts/data-model/ — model-state context text

SPEC decisions: D19-L, D40-L, D45-L, D52-L, D60-L, D78-L, D83-L, D97-L

## Owns

`src/agents/contexts/data-model/` owns model-facing renderers for already-read Brunch project state: graph reads, selected-spec context, workspace context, session runtime-frame/readiness text, plan markdown output, and elicitation-gap agenda/update text. It does not read storage, register tools, or compose runtime prompts.

```text
data-model/
├── graph/              graph overview/neighborhood, related-node, mutation, reconciliation text
├── plan/               plan-plane graph node markdown output
├── session/            <session> runtime-frame and readiness text
├── spec/               <specification> context text
├── workspace/          <workspace> context text
└── elicitation-gaps.ts elicitation agenda/update text
```

## Boundary Rules

```pseudo
rules:
  agents/contexts/data-model/ -> graph/, projections/, session/, workspace/ [render already-read facts]
  agents/contexts/data-model/ x> agents/runtime/ [no prompt/runtime policy]
  agents/contexts/data-model/ x> .pi/, app/, rpc/, web/ [no host, adapter, or transport effects]
```
