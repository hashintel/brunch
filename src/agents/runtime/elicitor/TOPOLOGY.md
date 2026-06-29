# agents/runtime/elicitor/ — live elicitor prompt runtime

SPEC decisions: D40-L, D52-L, D85-L, D98-L

## Owns

`src/agents/runtime/elicitor/` owns the live SPEC-mode elicitor assembly path: fixed prompt body selection, plain context composition, and the explicit active-tool policy used by the foreground elicitor.

```text
elicitor/
├── TOPOLOGY.md
├── active-tools.ts         fixed live elicitor active-tool policy
├── compose-live-prompt.ts  fixed body + plain context assembly
├── context.ts              plain selected-spec/workspace context for the live elicitor
├── __tests__/              live-path assembly tests
└── __snapshots__/          live prompt/tool-policy goldens
```

## Boundary Rules

```pseudo
rules:
  agents/runtime/elicitor/ -> agents/prompts/elicitor.md [fixed body]
  agents/runtime/elicitor/context.ts -> agents/contexts/seeds/ [prompt context input types]
  agents/runtime/elicitor/ -> agents/runtime/shared/ [shared runtime helpers]
  .pi/extensions/agent-runtime/* -> agents/runtime/elicitor/ [adapter wiring]
  agents/runtime/elicitor/ x> agents/runtime/_suspended/ [no legacy control reads]
```

## Migration Note

This directory is the source of truth for "what prompt and context does the elicitor run with right now?" Live prompt-frame context lives here with the prompt runtime; reusable model-state context renderers stay under `agents/contexts/data-model/`.
