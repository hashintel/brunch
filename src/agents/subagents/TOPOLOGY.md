# agents/subagents/ — background agent bodies

SPEC decisions: D39-L, D44-L, D90-L, D91-L, D92-L, D93-L, D100-L

## Owns

Flat markdown body resources for background subagents. These are not foreground prompt bodies; spawnability is owned by the explicit `BACKGROUND_SUBAGENT_IDS` registry in `src/.pi/extensions/subagents/agents.ts`.

```text
subagents/
├── TOPOLOGY.md
├── explorer.md       background codebase recon body + frontmatter
├── researcher.md     background web-research body + frontmatter
├── projector.md      optional background variant-generator body + frontmatter
└── reviewer.md       background proposal/commitment review body + frontmatter
```

Each file carries frontmatter (`name`, `description`, `tools`, `model`, `thinking`) plus the child system-prompt body. Frontmatter is authoring DX; the code-owned registry decides which ids exist. Unlisted files are not spawnable.

`projector.md` is not the public `project` capability seam. The foreground first-level `project` skill owns cross-plane derivation conduct; the background projector remains an optional child-session helper for variant generation or framing when the foreground agent delegates work.

## Boundary rules

```pseudo
rules:
  .pi/extensions/subagents/agents.ts -> agents/subagents/*.md [explicit BACKGROUND_SUBAGENT_IDS only]
  agents/subagents/                  x> foreground prompt roster
  agents/subagents/                  x> first-level skill manifest
  agents/subagents/                  x> Pi hooks or runtime registration
```

## Does NOT own

- Foreground SPEC/CODE prompt bodies — `src/agents/prompts/`.
- Background prompt assembly, child-session sealing, tool grants, and spawn execution — `src/.pi/extensions/subagents/`.
- Prompt-resource skills — `src/agents/skills/`.
