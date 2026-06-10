# .pi/extensions/ — Pi adapter registrars

SPEC decisions: D34-L, D35-L, D37-L, D39-L, D40-L, D52-L, D69-L

## Owns

Pi-facing registration and adaptation only: lifecycle hooks, agent tool definitions, command/shortcut handlers, TUI chrome affordances, autocomplete wrappers, per-turn system-prompt append hooks, dev-gated read-only introspection taps, payload/session-log query tools, workspace dialogs, and Pi-specific tool result renderers.

## Does NOT own

- Agent prompt-resource semantics or manifest composition — `.pi/agents/` and `.pi/skills/`.
- Graph truth, graph mutation policy, or graph readers — `graph/`.
- Pi JSONL/session semantics, runtime-state projection, workspace coordination, or transcript exchange projection — `session/` until the runtime-state follow-up split lands.
- Reusable DTO projection or reusable markdown/text rendering — top-level `projections/` and `renderers/`.
- Product transport handlers — `rpc/`, `app/`, and `web/`.

## Directory layout

```text
extensions/
├── README.md
├── AUDIT.md                 temporary audit note; do not treat as topology source
├── chrome/                  TUI header/title/footer/sidecar-widget chrome projection
├── commands/                /brunch:* commands, shortcut, branch/tree policy
├── compaction/              auto-compaction anchor contract and future hook
├── context/                 snapshot/context Pi tools
├── exchanges/               structured-exchange present_* / request_* Pi tools
├── graph/                   mutate_graph/read_graph Pi tools
├── introspection/           dev-gated read-only provider-payload tap + /introspect command
├── introspect-query/        dev-gated read-only brunch_introspect_query tool over captured payloads
├── session-query/           dev-gated read-only brunch_session_query tool over current branch
├── shared/                  projection/truncation helpers + Zod→Pi schema adapter for dev query tools
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

`exchanges/schemas/` is the intentional current exception to "adapter-only": it owns the Zod-authored structured-exchange details schema per D37-L/D41-L until a separate schema-ownership slice moves or names that seam. Zod-to-Pi `TSchema` conversion is confined to two per-plane adapters: `exchanges/pi-schema.ts` (structured-exchange) and `shared/pi-tool-schema.ts` (dev-gated query tools). Both export JSON Schema draft 2020-12 (`z.toJSONSchema`), which strict provider validators require.

`exchanges/shared/markdown.ts` contains Pi-rendering helpers. Move only reusable product markdown/text rendering into the future renderer seam; keep Pi `renderCall` / `renderResult` widgets and UI-only message components local to `.pi/`.
