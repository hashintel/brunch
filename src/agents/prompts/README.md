# agents/prompts/ — agent role bodies

SPEC decisions: D25-L, D40-L, D58-L, D85-L, D90-L, D91-L, D93-L

## Owns

Keyed foreground and background agent body resources — the markdown persona text a Brunch agent contributes to its system prompt. Background bodies intentionally stay here instead of a parallel `src/agents/subagents/` home because foreground and background manifests share the same `AgentManifest.body` file convention; spawnability is still owned by the subagent registry, not by this directory.

```text
prompts/
├── README.md
├── elicitor/SYSTEM.md       foreground elicit-mode body
├── executor/SYSTEM.md       foreground execute-mode body
├── explorer/SYSTEM.md       background codebase recon body + frontmatter
├── researcher/SYSTEM.md     background web-research body + frontmatter
├── projector/SYSTEM.md      background candidate-proposal body + frontmatter
├── reviewer/SYSTEM.md       background proposal/commitment review body + frontmatter
└── pi-coder/SYSTEM.md       future unwired coding-agent augmentation baseline
```

This directory is markdown-only. It carries no TypeScript and registers no Pi hooks. Foreground metadata is code-owned in the op-mode-keyed foreground roster (`src/agents/runtime/policy.ts`), while body file locations are centralized in `src/agents/registry.ts`. Background metadata is authored as frontmatter but discovered only through the explicit `BACKGROUND_SUBAGENT_IDS` registry in `src/.pi/extensions/subagents/agents.ts`.

## Prompt-shape decisions

- **SYSTEM.md convention is adopted:** foreground and background agent bodies use `src/agents/prompts/<agent>/SYSTEM.md`.
- **Background bodies are subagent resources, not foreground prompts:** `explorer`, `researcher`, `projector`, and `reviewer` are loaded only through the explicit `BACKGROUND_SUBAGENT_IDS` registry in `src/.pi/extensions/subagents/agents.ts`; keeping their markdown beside foreground bodies is a shared body-file convention, not foreground availability.
- **Background frontmatter is authoring DX:** background `SYSTEM.md` files carry `name`/`description`/`tools`/`model`/`thinking`, but the code-owned registry decides which ids exist. Unlisted directories are not spawnable.

## Does NOT own

- Foreground prompt composition, pushed seed contexts, prompt-resource manifest selection, or tool/method legality — `src/agents/runtime/` and `src/agents/contexts/seeds/`.
- Background prompt assembly and injected-world child-session wiring — `src/.pi/extensions/subagents/`.
- Strategy/lens/method prompt-resource skills — `src/agents/skills/`.
- Reusable model-facing context text — `src/agents/contexts/`.
- Human/product-only text rendering — owned beside its product/session caller.
- Pi tool definitions, lifecycle hooks, UI, and background child-session loading/running — `src/.pi/extensions/*`.

## Migration note

Pi extension code remains a runtime adapter: it loads foreground bodies and background agent definitions through `src/agents/registry.ts`, not through extension-local paths or directory discovery. `pi-coder` records Pi's `buildSystemPrompt` worked-example baseline while D58-L's augment-vs-replace question stays open.
