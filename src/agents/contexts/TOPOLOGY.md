# agents/contexts/ — agent-visible context text

SPEC decisions: D52-L, D58-L, D60-L, D76-L, D78-L, D83-L, D91-L, D96-L, D98-L

## Owns

`src/agents/contexts/` owns reusable Brunch-authored text that enters the model as rendered runtime context: pushed seed blocks, context-tool result text, data-model renderer text, and structured-exchange tool result text. Runtime-eligible static references live in `src/agents/references/`; live elicitor prompt-frame context belongs to `src/agents/runtime/elicitor/`.

```text
contexts/
├── _suspended/       quarantined legacy lens/readiness/recommendation-shaped context controls
├── data-model/       model-facing graph/spec/session/workspace/plan/elicitation renderers
├── seeds/            per-turn pushed context blocks and origination seed payloads
└── exchanges/        present_* / request_* structured-exchange result text
```

Formatting primitives used by these renderers live in `src/agents/shared/`; they are shared helper substrate, not a child context surface.

## Boundary rules

```pseudo
rules:
  agents/contexts/ -> graph/, projections/, session/, workspace/ [render already-read facts]
  agents/runtime/_suspended -> agents/contexts/_suspended/      [legacy control context]
  .pi/extensions/* -> agents/contexts/                         [adapters gather data, then ask for text]
  session/         -> agents/contexts/seeds/                   [origination asks for seed payload text]
  agents/contexts/ x> .pi/, app/, rpc/, web/                   [no host, adapter, or transport effects]
```

Targeted `.pi/extensions` tests guard the adapter half of this boundary for `brunch-data`, `agent-runtime`, and structured-exchange tools: Pi adapters may own schemas, labels, descriptions, prompt snippets, and TUI rendering, but provider-visible Brunch text must be imported from this subtree rather than formatted inline.

Static files that should be loaded on demand rather than rendered from runtime state live in `src/agents/references/`. Schema-owned graph vocabulary lives in `src/graph/schema/**` and `src/graph/policy/**`; authored graph-mapping judgment lives under `src/agents/skills/map/references/`; readiness-band terminology lives at `src/agents/references/readiness-bands.md`. Draft injectable slice candidates may live under their owning skill while being evaluated when they self-label as drafts and are not treated as required prompt-resource payload until a skill or prompt cites them.

## Snapshot convention

Context golden files live beside their tests under `__snapshots__/` and use stock Vitest file snapshots. There is no separate preview writer.

## Migration note

Reusable agent-visible renderers have moved here from the retired `src/renderers/` layer, and formerly adapter-local model text for graph mutation/related reads plus elicitation/reconciliation register tools now lives here too. Human/product-only text now lives beside the single owner that emits it (`app/print-workspace-state.ts`, `session/transcript-markdown.ts`).

The simplified elicitor prompt context now lives with the live runtime in `src/agents/runtime/elicitor/context.ts`. Context that exists only for retired strategy/lens/method/readiness behavior belongs in `_suspended/`, outside normal test/build discovery.
