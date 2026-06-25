# agents/contexts/ — agent-visible context text

SPEC decisions: D52-L, D58-L, D60-L, D76-L, D78-L, D83-L, D91-L, D96-L

## Owns

`src/agents/contexts/` owns reusable Brunch-authored text that enters the model: pushed seed blocks, context-tool result text, graph/context markdown, and structured-exchange tool result text.

```text
contexts/
├── primitives/       markdown, TOON, tree, and section formatting helpers
├── seeds/            per-turn pushed context blocks and origination seed payloads
├── graph/            graph overview/neighborhood and planned graph result text
├── workspace/        <workspace> context text
├── specification/    <specification> context text
├── session/          <session> runtime-frame and readiness text
└── exchanges/        present_* / request_* structured-exchange result text
```

## Boundary rules

```pseudo
rules:
  agents/contexts/ -> graph/, projections/, session/, workspace/ [render already-read facts]
  .pi/extensions/* -> agents/contexts/                         [adapters gather data, then ask for text]
  session/         -> agents/contexts/seeds/                   [origination asks for seed payload text]
  agents/contexts/ x> .pi/, app/, rpc/, web/                   [no host, adapter, or transport effects]
  renderers/       x> agents/contexts/                         [human/product renderers do not own model text]
```

## Snapshot convention

Context golden files live beside their tests under `__snapshots__/` and use stock Vitest file snapshots. There is no separate preview writer.

## Migration note

Reusable agent-visible renderers have moved here from `src/renderers/`. `src/renderers/` remains for human/product-only text such as print-mode workspace state and debug transcript output. Later refactor items promote adapter-local model text (for example related-node, mutation-result, elicitation, and reconciliation tool text) into this subtree.
