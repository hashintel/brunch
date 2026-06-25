# agents/prompts/ — agent role bodies

SPEC decisions: D25-L, D40-L, D58-L, D85-L, D90-L, D91-L, D93-L

## Owns

Keyed foreground and background agent body resources — the markdown persona text a Brunch agent contributes to its system prompt.

```text
prompts/
├── README.md
├── elicitor/SYSTEM.md       foreground elicit-mode body
├── orchestrator/SYSTEM.md   foreground execute-mode body
├── explorer/SYSTEM.md       background codebase recon body + frontmatter
├── researcher/SYSTEM.md     background web-research body + frontmatter
├── projector/SYSTEM.md      background candidate-proposal body + frontmatter
├── reviewer/SYSTEM.md       background proposal/commitment review body + frontmatter
└── pi-coder/SYSTEM.md       future unwired coding-agent augmentation baseline
```

This directory is markdown-only. It carries no TypeScript and registers no Pi hooks. Foreground metadata is code-owned in the op-mode-keyed foreground roster (`src/projections/session/runtime-policy.ts`), while body file locations are centralized in `src/agents/registry.ts`. Background metadata is authored as frontmatter but discovered only through the explicit `BACKGROUND_SUBAGENT_IDS` registry in `src/.pi/extensions/subagents/agents.ts`.

## Prompt-shape decisions

- **SYSTEM.md convention is adopted:** foreground and background agent bodies use `src/agents/prompts/<agent>/SYSTEM.md`.
- **Background frontmatter is authoring DX:** background `SYSTEM.md` files carry `name`/`description`/`tools`/`model`/`thinking`, but the code-owned registry decides which ids exist. Unlisted directories are not spawnable.

## Does NOT own

- Foreground prompt composition + pushed seed contexts — `.pi/extensions/agent-runtime/system-prompts/` until the runtime/context move slices land.
- Background prompt assembly and injected-world child-session wiring — `.pi/extensions/subagents/`.
- Prompt-resource manifest selection + tool/method legality — `.pi/extensions/agent-runtime/runtime/` and `src/projections/session/runtime-policy.ts` until the runtime move slice lands.
- Strategy/lens/method prompt-resource skills — `src/agents/skills/`.
- Reusable lossy text/markdown rendering — `renderers/` until agent-visible renderers move.
- Pi tool definitions, lifecycle hooks, UI, and background child-session loading/running — `.pi/extensions/*`.

## Migration note

This directory is the first moved content home under `src/agents/`. Pi extension code remains a runtime adapter: it loads foreground bodies and background agent definitions through `src/agents/registry.ts`, not through extension-local paths or directory discovery. `pi-coder` records Pi's `buildSystemPrompt` worked-example baseline while D58-L's augment-vs-replace question stays open.
