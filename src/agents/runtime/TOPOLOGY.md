# agents/runtime/ — agent prompt runtime policy

SPEC decisions: D40-L, D52-L, D58-L, D85-L, D90-L, D93-L, D98-L

## Owns

Runtime prompt/tool policy that is Pi-independent: exhaustive foreground runtime dispatch, live elicitor prompt/context assembly, executor prompt/control assembly, foreground active-tool policy, shared blocked-tool contract, and agent body location lookup. Strategy/lens/method control policy is suspended as live foreground authority.

```text
runtime/
├── TOPOLOGY.md
├── foreground-policy.ts central exhaustive foreground prompt/tool facade
├── elicitor/         live SPEC-mode elicitor prompt/context/tool source of truth
├── executor/         narrow CODE-mode executor prompt/control/tool source of truth
├── shared/           pure helpers and shared runtime policy contracts
├── _suspended/       quarantined legacy strategy/lens/method/readiness controls
├── __tests__/          prompt/runtime policy tests
└── __snapshots__/      Vitest file snapshots for full composed prompts
```

## Boundary rules

```pseudo
rules:
  agents/runtime/foreground-policy -> agents/runtime/{elicitor,executor}, agents/prompts/registry
  agents/runtime/elicitor -> agents/prompts/elicitor.md, agents/runtime/elicitor/context.ts
  agents/runtime/executor -> agents/prompts/executor.md, agents/runtime/shared
  agents/runtime/_suspended -> agents/skills/_suspended/, agents/contexts/_suspended/
  agents/runtime -> agents/prompts/registry, agents/prompts, agents/skills
  agents/runtime -> agents/contexts, graph/, projections/, session/ [read/projection types and helpers]
  .pi/extensions/agent-runtime/* -> agents/runtime [adapter calls central policy]
  agents/runtime x> .pi extension hooks/tools       [no Pi registration side effects]
```

Pi extensions remain the runtime adapter: they gather the current Pi session state, graph reads, active tool registry, and base system prompt, then call `foreground-policy.ts` to produce Brunch-authored model-facing text and active-tool legality for every accepted foreground state.

## Migration note

This directory was moved from `.pi/extensions/agent-runtime/{runtime,system-prompts}` during the LLM-context ingress refactor. The remaining `.pi/extensions/agent-runtime/` files should stay thin: hook registration, Pi API calls, and adapter-specific tool activation only.

The live elicitor path is centralized under `elicitor/`; the narrow CODE-mode executor path is centralized under `executor/`. Legacy prompt-resource negotiation, readiness-derived method/tool derivation, and axis-shaped context policy live under `_suspended/`, which is excluded from normal lint/type/build/test discovery and has no top-level compatibility exports.
