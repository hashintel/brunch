# .pi/ — Brunch Pi runtime surface

SPEC decisions: D25-L, D34-L, D35-L, D37-L, D39-L, D40-L, D52-L, D58-L, D59-L, D60-L, D69-L, D90-L, D91-L

This directory is Brunch's sealed Pi-harness surface. It contains product extension registrars and reusable TUI components that run inside the embedded Pi coding-agent harness. Agent role bodies live in `src/agents/prompts/`, and Brunch prompt-resource skills live in `src/agents/skills/`; this tree remains the Pi runtime adapter home during the migration.

## Owns

- Pi extension registration: tools, lifecycle hooks, command handlers, autocomplete, TUI chrome, workspace dialogs, and dev-gated read-only introspection. `extensions/session/lifecycle.ts` adapts Pi session/turn hooks into one ordered Brunch session-boundary pipeline: workspace rebinding first, then continuity preparation steps. `extensions/graph/index.ts` stamps the live watermark carriers for own mutations and full graph-overview reads.
- Reusable Pi TUI components used by those extensions.

## Does NOT own

- Graph truth, mutation policy, readers, or graph DTOs — `graph/` and target `projections/graph/`.
- Pi JSONL/session semantics and workspace/session coordination — `session/`.
- Product JSON-RPC handlers — `rpc/`.
- React client UI — `web/`.
- Brunch-authored model-facing prompt/context text — `agents/`.
- Reusable product projection/rendering — `projections/`, `agents/contexts/`, and local app/session owners by audience.

## Layout

```text
.pi/
├── README.md
├── settings.json                 dev Pi settings for local `.pi` iteration
├── brunch-pi-settings.ts        sealed Pi settings/resource-loader policy
├── brunch-pi-extensions.ts      explicit Brunch extension factory; no ambient discovery
├── components/                    reusable Pi TUI/message components
└── extensions/                    Pi registrars and runtime adapters
```

## Boundary rules

```pseudo
rules:
  .pi/extensions/  -> agents/, .pi/components/, graph/, session/, rpc/ [adapter imports]
  .pi/extensions/  x> db/                                  [no direct storage]
  graph/, session/ x> .pi/                                 [domain layers never import Pi]
```

Production Brunch does not rely on ambient discovery from the repository root. The product shell imports extension factories explicitly; tests for extensions/components live in `.pi/__tests__/`.

`settings.json` is only for direct `pi` launches from `src/`: it disables product-composition registrars that need explicit shell-provided Brunch deps, plus the Brunch web tools because their `web_fetch` / `web_search` names commonly conflict with global Pi web extensions. Other standalone/default-factory extensions remain available for ambient Pi discovery and `/reload` iteration; disabled entries can still be tested explicitly with `pi -ne -e <path>`.

`SYSTEM.md` / `APPEND_SYSTEM.md` are Pi's static ambient prompt files. Brunch's dynamic selected-spec/runtime/gap-driven prompt contribution is per-turn and therefore uses `before_agent_start` in `extensions/system-prompts/`, appending to the already assembled Pi system prompt by returning `systemPrompt: event.systemPrompt + brunchPrompt`. The ambient `APPEND_SYSTEM.md` files (project `<cwd>/.pi/` and global `<agentDir>/`) are **sealed out** of Brunch sessions (D39-L): `brunchResourceLoaderOptions` pins `appendSystemPrompt: []`, overriding Pi's resource-loader fallback to ambient discovery (the `no*` flags do not cover the append-prompt source). Proven by the live-loader seal oracle in `src/app/__tests__/brunch-tui.test.ts` (a planted ambient append must not reach `getAppendSystemPrompt()`).
