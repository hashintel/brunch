# agents/skills/suspended/ — suspended prompt-resource taxonomy

SPEC decisions: D25-L, D52-L, D85-L, D95-L, D98-L

## Owns

`src/agents/skills/suspended/` is the quarantine home for prompt resources organized by the retired strategy/lens/method taxonomy when those resources no longer participate in the live elicitor manifest.

```text
suspended/
├── README.md
├── strategies/<name>/SKILL.md   retired interaction-shape resources
├── lenses/<name>/SKILL.md       retired focus-lens resources
└── methods/<name>/SKILL.md      retired workflow/tool-routing resources
    └── references/*.md          disclosed payloads owned by the method resource
```

## Boundary Rules

```pseudo
rules:
  agents/runtime/suspended/ -> agents/skills/suspended/ [legacy manifest compatibility]
  agents/runtime/elicitor/ x> agents/skills/suspended/ [live elicitor does not negotiate prompt resources]
  agents/skills/suspended/ x> TypeScript imports [read-only prompt resources]
```

## Migration Note

The strategy/lens/method taxonomy has moved here. Useful conduct should be lifted into activity-named homes under `agents/skills/` only when the live elicitor needs a real prompt-resource surface again; filesystem presence alone does not make these suspended resources active.
