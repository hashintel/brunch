# renderers/ — reusable lossy text rendering

SPEC decisions: D52-L

## Owns

Reusable lossy renderers that turn domain or projection inputs into markdown, compact text, TOON-like summaries, or toolResult content text.

Renderers may import input types from `projections/`, `graph/`, or `session/`, but they do not construct canonical DTOs, register Pi tools, handle RPC, or import web/app adapters.

## Directory layout

```pseudo
renderers/
  markdown.ts            shared markdown helpers
  toon.ts                compact structured-data rendering stub
  graph/                 graph overview/neighborhood/command markdown
  session/               transcript markdown
  exchanges/             durable exchange markdown
  workspace/             print-mode workspace state text
```

## Dependency direction

```pseudo
renderers/* -> projections/, graph/, session/ [input types/data]
renderers/  x> .pi/, rpc/, app/, web/
```
