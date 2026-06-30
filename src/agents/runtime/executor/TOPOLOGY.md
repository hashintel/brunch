# agents/runtime/executor/ — foreground executor runtime

SPEC decisions: D40-L, D52-L, D90-L, D93-L, D98-L

## Owns

`src/agents/runtime/executor/` owns the narrow CODE-mode foreground executor policy: literal executor body composition, runtime control text, and the explicit registered-tool allowlist for foreground execute mode.

```text
executor/
├── TOPOLOGY.md
├── active-tools.ts   fixed executor active-tool allowlist
└── compose-prompt.ts literal body + CODE-mode control assembly
```

## Boundary Rules

```pseudo
rules:
  agents/runtime/executor/ -> agents/prompts/executor.md [fixed body]
  agents/runtime/executor/ -> agents/runtime/shared/ [blocked-tool/runtime helpers]
  agents/runtime/foreground-policy -> agents/runtime/executor/ [central dispatch]
  agents/runtime/executor/ x> .pi/extensions/ [no Pi hook/tool registration side effects]
```

## Migration Note

This is intentionally smaller than full delegated CODE orchestration. It gives execute mode a concrete prompt/tool policy and leaves write-capable cook/run orchestration to the `orchestrator-tool-port` frontier.
