# .pi/agents/ — agent role definitions (markdown)

SPEC decisions: D25-L, D40-L, D58-L, D85-L, D90-L, D91-L, D93-L

## Owns

The keyed agent body resources only — the markdown bodies a foreground or
background agent contributes as its system-prompt persona. Live agent definitions
use the `src/.pi/agents/{agent-name}/SYSTEM.md` convention so references can
later sit beside the body without making filesystem discovery part of product
behavior.

```text
agents/
├── README.md
├── elicitor/
│   └── SYSTEM.md     keyed foreground elicit-mode system-prompt resource
├── explorer/
│   └── SYSTEM.md     keyed background codebase recon body + frontmatter
├── orchestrator/
│   └── SYSTEM.md     keyed foreground execute-mode system-prompt resource
├── pi-coder/
│   └── SYSTEM.md     future unwired coding-agent augmentation baseline
├── projector/
│   └── SYSTEM.md     keyed background candidate-proposal variant body + frontmatter
├── researcher/
│   └── SYSTEM.md     keyed background web-research body + frontmatter
└── reviewer/
    └── SYSTEM.md     keyed background proposal/commitment review body + frontmatter
```

This directory is **markdown-only**, like `.pi/skills/`. It carries no
TypeScript and registers no Pi hooks. Foreground metadata and agent-body
locations are code-owned in the op-mode-keyed foreground roster
(`src/projections/session/runtime-policy.ts`); background metadata is authored as
frontmatter but discovered only through the explicit
`BACKGROUND_SUBAGENT_IDS` registry in `src/.pi/extensions/subagents/agents.ts`.
Both project into the shared manifest type
(`src/session/schema/agent-manifest.ts`), not filesystem discovery (D39-L/D90-L/D93-L).

## Prompt-shape decisions

- **SYSTEM.md convention is adopted:** foreground and background agent bodies use
  `src/.pi/agents/<agent>/SYSTEM.md`; this is no longer an open prompt-shape
  residue.
- **Background frontmatter is authoring DX:** background `SYSTEM.md` files carry
  `name`/`description`/`tools`/`model`/`thinking`, but the code-owned registry
  decides which ids exist. Unlisted directories are not spawnable. Background
  bodies are the first section of an assembled child prompt; injected world
  snapshots and graph-read tools are owned by `extensions/subagents/`.

## Does NOT own

The prompt-assembly machinery that *uses* these definitions now lives with the
extension that consumes it:

- **Foreground prompt composition + pushed seed contexts** —
  `.pi/extensions/system-prompts/` (`compose.ts` emits the runtime header + gated
  manifest; `seed/workspace.ts` and `seed/graph.ts` render the pushed context
  blocks).
- **Background prompt assembly and injected-world child-session wiring** —
  `.pi/extensions/subagents/`.
- **Prompt-resource manifest selection + tool/method legality** —
  `.pi/extensions/runtime/` (`state.ts`), fed by the foreground roster in
  `src/projections/session/runtime-policy.ts`.
- **Strategy/lens/method prompt-resource skills** — `.pi/skills/`.
- **Reusable lossy text/markdown rendering** — `renderers/`.
- **Pi tool definitions, lifecycle hooks, UI, and background child-session
  loading/running** — `.pi/extensions/*`.

## Migration note

Until 2026-06, this directory also held `compose.ts`, `state.ts`, and a
`contexts/` render layer. Those moved to the extensions that consume them so the
tree answers "who owns prompt assembly?" by walking to `system-prompts/` and
`runtime/`, and so "context" stops meaning both the pushed prompt seed and the
`read_context` pull tool. The seed renderers were renamed (`renderWorkspaceSeed`,
`renderGraphSeed`) to de-conflate from `renderers/` and the pull tool.

The D85-L agent-definition convention is enacted for foreground bodies, and D90-L
extends the same home to background bodies: `elicitor/SYSTEM.md`,
`orchestrator/SYSTEM.md`, `explorer/SYSTEM.md`, `researcher/SYSTEM.md`,
`projector/SYSTEM.md`, `reviewer/SYSTEM.md`, and the unwired
`pi-coder/SYSTEM.md` baseline all use `<agent>/SYSTEM.md`. The former
`src/.pi/extensions/subagents/agents/*.md` background home and the flat legacy
`reviewer.md` shape are retired. `pi-coder` records Pi's `buildSystemPrompt`
worked-example baseline while D58-L's augment-vs-replace question stays open.
