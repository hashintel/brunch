# agents/prompts/ — foreground agent bodies

SPEC decisions: D25-L, D40-L, D58-L, D85-L, D90-L, D91-L, D93-L, D98-L

## Owns

Flat markdown persona text for Brunch foreground operational modes. The foreground roster is code-owned in `src/agents/runtime/policy.ts`; body file locations are centralized in `src/agents/registry.ts`.

```text
prompts/
├── README.md
├── elicitor.md       elicit runtime / target-SPEC foreground body
└── executor.md       execute runtime / target-CODE foreground body
```

This directory is markdown-only. It carries no TypeScript and registers no Pi hooks.

## Prompt-shape decisions

- **Flat foreground files are canonical:** foreground agent bodies live at `src/agents/prompts/{elicitor,executor}.md`.
- **Background bodies are subagent resources, not foreground prompts:** `explorer`, `researcher`, `projector`, and `reviewer` live under `src/agents/subagents/` and load only through the explicit `BACKGROUND_SUBAGENT_IDS` registry.
- **Runtime/product vocabulary stays honest:** current runtime ids are `elicit` and `execute`; target product labels are SPEC and CODE. `elicitor` is the elicit/target-SPEC foreground agent and `executor` is the execute/target-CODE foreground agent; retired orchestrator / pi-coder body aliases are not preserved.

## Does NOT own

- Background prompt bodies, frontmatter, or spawnability — `src/agents/subagents/` plus `src/.pi/extensions/subagents/`.
- Foreground prompt composition, pushed seed contexts, prompt-resource manifest selection, or tool/method legality — `src/agents/runtime/` and `src/agents/contexts/seeds/`.
- Strategy/lens/method prompt-resource skills — `src/agents/skills/`.
- Reusable model-facing context text — `src/agents/contexts/`.
- Human/product-only text rendering — owned beside its product/session caller.
- Pi tool definitions, lifecycle hooks, UI, and background child-session loading/running — `src/.pi/extensions/*`.
