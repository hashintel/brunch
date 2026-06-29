# agents/contexts/live/ — live elicitor context assembly

SPEC decisions: D40-L, D52-L, D60-L, D83-L, D98-L

## Owns

`src/agents/contexts/live/` is the home for plain context blocks used by the live SPEC-mode elicitor. It assembles selected-spec, workspace, and session orientation for the foreground elicitor without consulting suspended strategy, lens, method, readiness-estimate, or elicitation-gap recommendation controls.

```text
live/
├── README.md
└── elicitor-context.ts  plain selected-spec/workspace context for the live elicitor
```

## Boundary Rules

```pseudo
rules:
  agents/contexts/live/ -> agents/contexts/spec, agents/contexts/workspace, agents/contexts/session [plain context blocks]
  agents/runtime/elicitor/ -> agents/contexts/live/ [live prompt assembly]
  agents/contexts/live/ x> agents/runtime/suspended/ [no legacy control reads]
```

## Migration Note

This directory starts as a topology home. The next refactor slices move live elicitor context assembly here before the old context/control system is quarantined under `agents/contexts/suspended/` and `agents/runtime/suspended/`.
