# projections/ — reusable DTO boundaries

SPEC decisions: D52-L

## Owns

Structured DTOs derived from graph, session, workspace, or tool facts when the shape is reused across adapters, renderers, RPC, web, probes, or agent context assembly.

Projection modules preserve information; they do not render markdown, perform Pi registration, own transport handlers, mutate graph/session state, or import web/RPC/app adapters.

## Directory layout

```pseudo
projections/
  graph/                 graph read/command DTO projection
  session/               transcript-context and runtime-state DTO projection
  structured-exchange/   canonical toolResult.details construction and transcript details → domain DTO adapters
  workspace/             workspace/session snapshot DTO projection
```

## Dependency direction

```pseudo
projections/* -> graph/, session/, workspace/ [domain inputs]
projections/  x> .pi/, rpc/, app/, web/
```

Current migration notes:

- `projections/structured-exchange/*` imports Zod schemas from `.pi/extensions/exchanges/schemas/` because D37-L/D41-L currently place the structured-exchange schema lock at that Pi transcript seam. That is an explicit temporary exception, not a general adapter dependency permission.
- `projections/session/runtime-state.ts` owns flattened runtime-state DTO projection while `session/runtime-state.ts` owns transcript entry facts and append helpers.
