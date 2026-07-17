# agents/runtime/elicitor/ — live elicitor prompt runtime

SPEC decisions: D40-L, D52-L, D58-L, D85-L, D98-L, D101-L, D102-L, D118-L, D134-L

## Owns

`src/agents/runtime/elicitor/` owns the live Specify-mode elicitor assembly path: fixed prompt body selection, thin selected-spec/workspace plus explicitly pushed context composition, and the explicit active-tool policy used by the foreground elicitor.

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
  agents/runtime/foreground-policy -> agents/runtime/elicitor/ [central dispatch]
```

## Migration Note

This directory is the source of truth for "what prompt and context does the elicitor run with right now?" Live prompt-frame context lives here with the prompt runtime. Origination/resume continuity is supplied once by `agents/contexts/seeds/origination.ts`; later graph and scratchpad detail is discovered through the active read tools. Reusable explicit snapshot renderers stay under `agents/contexts/`.
