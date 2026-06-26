# renderers/ — human/product text rendering

SPEC decisions: D52-L, D60-L, D83-L

## Owns

`src/renderers/` now owns reusable text that is **not** deliberately model-facing. Print-mode workspace-state text moved to the app print owner; this directory only retains debug/report transcript markdown until the session move lands.

```text
renderers/
└── session/transcript.ts          debug/report transcript markdown
```

Agent-visible context text moved to `src/agents/contexts/`:

- graph overview/neighborhood context
- workspace/specification/session context-tool text
- structured-exchange tool-result text
- markdown/TOON/tree/section context formatting primitives

## Boundary rules

```pseudo
rules:
  renderers/ -> projections/, session/, workspace/ [human/product input types]
  renderers/ x> .pi/, rpc/, app/, web/             [no adapters/transports]
  renderers/ x> agents/contexts/                  [does not own model-facing text]
```

## Migration note

This directory intentionally no longer carries the context-render house-style ledger. That current agent-context topology lives in `src/agents/contexts/README.md`; `memory/SPEC.md` D83-L owns the decision event.
