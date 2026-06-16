# .pi/agents/ — agent role definitions (markdown)

SPEC decisions: D25-L, D40-L, D58-L

## Owns

The keyed agent role prompt resources only — the markdown bodies an agent role
contributes as its system-prompt persona.

```text
agents/
├── README.md
└── definitions/      keyed agent role prompts (body = system-prompt resource)
    ├── elicitor.md
    └── reviewer.md
```

This directory is **markdown-only**, like `.pi/skills/`. It carries no
TypeScript and registers no Pi hooks. The `{name, description, location}`
manifest metadata that advertises these files is code-owned in
`.pi/extensions/runtime/state.ts`, not filesystem-discovered (D39-L sealing).

## Does NOT own

The prompt-assembly machinery that *uses* these definitions now lives with the
extension that consumes it:

- **Prompt composition + pushed seed contexts** — `.pi/extensions/system-prompts/`
  (`compose.ts` emits the runtime header + gated manifest; `seed/workspace.ts`
  and `seed/graph.ts` render the pushed context blocks).
- **Prompt-resource manifest + tool/method legality** — `.pi/extensions/runtime/`
  (`state.ts`).
- **Goal/strategy/lens/method resources** — `.pi/skills/`.
- **Reusable lossy text/markdown rendering** — `renderers/`.
- **Pi tool definitions, lifecycle hooks, UI** — `.pi/extensions/*`.

## Migration note

Until 2026-06, this directory also held `compose.ts`, `state.ts`, and a
`contexts/` render layer. Those moved to the extensions that consume them so the
tree answers "who owns prompt assembly?" by walking to `system-prompts/` and
`runtime/`, and so "context" stops meaning both the pushed prompt seed and the
`read_context` pull tool. The seed renderers were renamed (`renderWorkspaceSeed`,
`renderGraphSeed`) to de-conflate from `renderers/` and the pull tool.
