# agents/contexts/ — agent-visible context text

SPEC decisions: D52-L, D58-L, D60-L, D76-L, D78-L, D83-L, D91-L, D96-L

## Owns

`src/agents/contexts/` owns reusable Brunch-authored text that enters the model: pushed seed blocks, context-tool result text, graph/context markdown, generated/authored shared context references, and structured-exchange tool result text.

```text
contexts/
├── primitives/       markdown, TOON, tree, and section formatting helpers
├── references/       runtime-eligible shared context references cited by skills/prompts
├── seeds/            per-turn pushed context blocks and origination seed payloads
├── graph/            graph overview/neighborhood, related-node, mutation, reconciliation text
├── elicitation.ts    elicitation agenda/update text
├── workspace/        <workspace> context text
├── spec/             <specification> context text
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
```

`src/.pi/__tests__/architecture.test.ts` guards the adapter half of this boundary for `brunch-data` and structured-exchange tools: Pi adapters may own schemas, labels, descriptions, prompt snippets, and TUI rendering, but provider-visible Brunch text must be imported from this subtree rather than formatted inline.

`references/` files are runtime-eligible agent-readable context references. They are shared cite targets for prompt resources when vocabulary or judgment content should be loaded on demand without copying tables into skill bodies. Generated references, such as `references/graph-ontology.md`, are committed artifacts with their source-of-truth and drift-check command named in the file. Authored references, such as `references/graph-authoring-heuristics.md`, carry shared judgment with concrete skill readers and must point to generated references for vocabulary rather than restating tables. The packaged CLI copies this subtree into `dist/agents/contexts/references/` because skills may cite these files at runtime.

## Snapshot convention

Context golden files live beside their tests under `__snapshots__/` and use stock Vitest file snapshots. There is no separate preview writer.

## Migration note

Reusable agent-visible renderers have moved here from the retired `src/renderers/` layer, and formerly adapter-local model text for graph mutation/related reads plus elicitation/reconciliation register tools now lives here too. Human/product-only text now lives beside the single owner that emits it (`app/print-workspace-state.ts`, `session/transcript-markdown.ts`).
