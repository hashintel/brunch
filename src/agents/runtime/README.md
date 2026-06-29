# agents/runtime/ — agent prompt runtime policy

SPEC decisions: D40-L, D52-L, D58-L, D85-L, D90-L, D93-L, D98-L

## Owns

Runtime prompt policy that is Pi-independent: live elicitor prompt/context assembly, foreground roster definitions, foreground prompt composition, prompt-resource manifest rendering/loading, active tool policy, and agent body location lookup. Strategy/lens/method control policy is suspended as live elicitor authority.

```text
runtime/
├── README.md
├── elicitor/         live SPEC-mode elicitor prompt/context/tool source of truth
├── shared/           pure helpers shared by current runtime readers
├── suspended/        legacy strategy/lens/method/readiness controls
├── capability-readiness.ts  compatibility export to suspended/
├── compose.ts          compatibility export to suspended/
├── policy.ts           compatibility export to suspended/
├── prompt-skills.ts    compatibility export to suspended/
├── state.ts            compatibility export to suspended/
├── __tests__/          prompt/runtime policy tests
└── __snapshots__/      Vitest file snapshots for full composed prompts
```

## Boundary rules

```pseudo
rules:
  agents/runtime/elicitor -> agents/prompts/elicitor.md, agents/contexts/live/
  agents/runtime/suspended -> agents/skills/suspended/, agents/contexts/suspended/
  agents/runtime -> agents/registry, agents/prompts, agents/skills
  agents/runtime -> agents/contexts, graph/, projections/, session/ [read/projection types and helpers]
  .pi/extensions/agent-runtime/* -> agents/runtime [adapter calls central policy]
  agents/runtime x> .pi extension hooks/tools       [no Pi registration side effects]
```

Pi extensions remain the runtime adapter: they gather the current Pi session state, graph reads, active tool registry, and base system prompt, then call this layer to produce Brunch-authored model-facing text and tool/resource legality.

## Migration note

This directory was moved from `.pi/extensions/agent-runtime/{runtime,system-prompts}` during the LLM-context ingress refactor. The remaining `.pi/extensions/agent-runtime/` files should stay thin: hook registration, Pi API calls, and adapter-specific tool activation only.

The live elicitor path is centralized under `elicitor/`. Legacy prompt-resource negotiation, readiness-derived method/tool derivation, and axis-shaped context policy live under `suspended/`; the old top-level module names remain thin compatibility exports until non-elicitor callers and tests move.
