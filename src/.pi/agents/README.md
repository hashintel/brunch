# .pi/agents/ — agent role definitions (markdown)

SPEC decisions: D25-L, D40-L, D58-L, D85-L

## Owns

The keyed agent role prompt resources only — the markdown bodies an agent role
contributes as its system-prompt persona. Live agent definitions use the
`src/.pi/agents/{agent-name}/SYSTEM.md` convention so references can later sit
beside the body without making filesystem discovery part of product behavior.

```text
agents/
├── README.md
├── elicitor/
│   └── SYSTEM.md     keyed foreground elicit-mode system-prompt resource
├── pi-coder/
│   └── SYSTEM.md     future unwired coding-agent augmentation baseline
└── reviewer/
    └── SYSTEM.md     keyed future review-side system-prompt resource
```

This directory is **markdown-only**, like `.pi/skills/`. It carries no
TypeScript and registers no Pi hooks. The `{name, description, location}`
manifest metadata and agent-body location are code-owned in
`.pi/extensions/runtime/state.ts`, not filesystem-discovered (D39-L sealing).

## Prompt-shape decisions

- **SYSTEM.md convention is adopted:** live and named future agent bodies use
  `src/.pi/agents/<agent>/SYSTEM.md`; this is no longer an open prompt-shape
  residue.
- **`[sub]` sub-agent convention:** deferred until the first sub-agent lands.
  When a real delegated side-agent is built, mark its definition as `[sub]` in
  the canonical agent roster/README and register it through the same code-owned
  manifest path; do not add empty sub-agent stubs before a consumer exists.

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

The D85-L agent-definition convention is enacted for the live foreground body and
for named future bodies: `elicitor/SYSTEM.md`, `reviewer/SYSTEM.md`, and the
unwired `pi-coder/SYSTEM.md` baseline all use `<agent>/SYSTEM.md`. `reviewer.md`
flat legacy shape is retired. `pi-coder` records Pi's `buildSystemPrompt`
worked-example baseline while D58-L's augment-vs-replace question stays open.
