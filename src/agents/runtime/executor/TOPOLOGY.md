# agents/runtime/executor/ — foreground executor runtime

SPEC decisions: D40-L, D52-L, D90-L, D93-L, D98-L

## Owns

`src/agents/runtime/executor/` owns the Execute-mode foreground executor policy: literal executor body composition, runtime control text, and the explicit registered-tool allowlist for foreground execute mode. The executor allowlist is structurally composed from the live elicitor allowlist plus executor-only orchestration, so CODE authority remains concentric with SPEC authority (D40-L).

```text
executor/
├── TOPOLOGY.md
├── active-tools.ts   concentric executor active-tool allowlist
├── compose-prompt.ts literal body + Execute-mode control assembly
└── __tests__/        executor prompt conduct tests
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

The execute-mode run machinery itself lives in `src/executor/` (pure core over injected `ExecutionPorts`, D111-L/D112-L) and is admitted here as executor-only `execute_*` grants, including the `execute_orchestrate` run driver. The FE-1089-era `orchestrator_stub` standup proof is retired (FE-1155).
