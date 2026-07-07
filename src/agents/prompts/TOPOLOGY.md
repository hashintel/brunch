# agents/prompts/ — foreground agent bodies

SPEC decisions: D25-L, D40-L, D58-L, D85-L, D90-L, D91-L, D93-L, D98-L

## Owns

Flat markdown persona text for Brunch foreground operational modes. Live elicitor assembly is code-owned in `src/agents/runtime/elicitor/`; body file locations are centralized in `src/agents/prompts/registry.ts`.

```text
prompts/
├── TOPOLOGY.md
├── registry.ts       path registry for foreground body files
├── __tests__/        foreground body registry tests
├── elicitor.md       specify runtime / Specify foreground body
└── executor.md       execute runtime / Execute foreground body
```

This directory carries foreground body markdown and the small body-location registry. It registers no Pi hooks.

## Prompt-shape decisions

- **Flat foreground files are canonical:** foreground agent bodies live at `src/agents/prompts/{elicitor,executor}.md`.
- **Background bodies are subagent resources, not foreground prompts:** `explorer`, `researcher`, `projector`, and `reviewer` live under `src/agents/subagents/` and load only through the explicit `BACKGROUND_SUBAGENT_IDS` registry.
- **Runtime/product vocabulary stays honest:** current runtime ids are `specify` and `execute`; product labels are `Specify` and `Execute`. `elicitor` is the specify/Specify foreground agent and `executor` is the execute/Execute foreground agent; retired orchestrator / pi-coder body aliases are not preserved.

## Does NOT own

- Background prompt bodies, frontmatter, or spawnability — `src/agents/subagents/` plus `src/.pi/extensions/subagents/`.
- Foreground prompt composition, pushed seed contexts, prompt-resource manifest selection, or tool/method legality — `src/agents/runtime/` and `src/agents/contexts/seeds/`.
- Activity-named prompt-resource skill homes and runtime-eligible references — `src/agents/skills/` and `src/agents/references/`.
- Reusable model-facing context text — `src/agents/contexts/`.
- Human/product-only text rendering — owned beside its product/session caller.
- Pi tool definitions, lifecycle hooks, UI, and background child-session loading/running — `src/.pi/extensions/*`.
