# .pi/extensions/ — Pi adapter registrars

SPEC decisions: D34-L, D35-L, D37-L, D39-L, D40-L, D52-L

## Owns

Pi-facing registration and adaptation only: lifecycle hooks, agent tool definitions, command/shortcut handlers, TUI chrome affordances, autocomplete wrappers, per-turn system-prompt append hooks, workspace dialogs, and Pi-specific tool result renderers.

## Does NOT own

- Agent prompt-resource semantics or manifest composition — `.pi/agents/` and `.pi/skills/`.
- Graph truth, graph mutation policy, or graph readers — `graph/`.
- Pi JSONL/session semantics, runtime-state projection, workspace coordination, or transcript exchange projection — `session/`.
- Reusable DTO projection or reusable markdown/text rendering — target top-level `projections/` and `renderers/` seams; current domain-local `*/project/` and `*/format/` folders are migration inputs.
- Product transport handlers — `rpc/`, `app/`, and `web/`.

## Directory layout

```text
extensions/
├── README.md
├── AUDIT.md                 temporary audit note; do not treat as topology source
├── chrome/                  TUI title/footer/chrome projection
├── commands/                /brunch:* commands, shortcut, branch/tree policy
├── compaction/              auto-compaction anchor contract and future hook
├── context/                 snapshot/context Pi tools
├── exchanges/               structured-exchange present_* / request_* Pi tools
├── graph/                   commit_graph/read_graph Pi tools
├── mentions/                #graph mention prompt hint + autocomplete provider
├── runtime/                 active-tool policy and tool/user_bash guards
├── session/                 session lifecycle hooks
├── system-prompts/          before_agent_start dynamic prompt append
├── workspace/               spec/session picker command adapter
└── subagents/               future subagent config/tool surface
```

## Boundary rules

```pseudo
rules:
  .pi/extensions/* -> .pi/agents/, .pi/components/, graph/, session/, projections/, renderers/ [adapter imports allowed]
  .pi/extensions/* x> db/                                                            [no direct storage]
  graph/, session/    x> .pi/                                                        [domain layers never import adapters]
  .pi/agents/         x> .pi/extensions/                                             [prompt assembly does not register Pi hooks]
  projections/        x> .pi/, rpc/, app/, web/                                      [no transport/UI imports]
  renderers/          x> .pi/, rpc/, app/, web/                                      [no transport/UI imports]
```

## Migration notes

`exchanges/schemas/` is the intentional current exception to "adapter-only": it owns the Zod-authored structured-exchange details schema per D37-L/D41-L until a separate schema-ownership slice moves or names that seam. `exchanges/pi-schema.ts` remains the only Zod-to-Pi `TSchema` adapter.

`exchanges/shared/markdown.ts` contains Pi-rendering helpers. Move only reusable product markdown/text rendering into the future renderer seam; keep Pi `renderCall` / `renderResult` widgets and UI-only message components local to `.pi/`.
