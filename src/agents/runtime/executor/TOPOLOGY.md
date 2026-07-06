# agents/runtime/executor/ — foreground executor runtime

SPEC decisions: D40-L, D52-L, D90-L, D93-L, D98-L

## Owns

`src/agents/runtime/executor/` owns the narrow Execute-mode foreground executor policy: literal executor body composition, runtime control text, and the explicit registered-tool allowlist for foreground execute mode.

```text
executor/
├── TOPOLOGY.md
├── active-tools.ts   fixed executor active-tool allowlist
└── compose-prompt.ts literal body + Execute-mode control assembly
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

Write-capable cook/run orchestration landed with the `orchestrator-cutover` arc: the policy now admits the full `execute_*` tool family (including the `execute_orchestrate` run driver). The FE-1089-era `orchestrator_stub` standup proof is retired (FE-1155).
