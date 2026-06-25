# .pi/extensions/ — Pi adapter registrars

SPEC decisions: D34-L, D35-L, D37-L, D39-L, D40-L, D44-L, D52-L, D69-L, D71-L, D90-L, D91-L

## Owns

Pi-facing registration and adaptation only: lifecycle hooks, agent tool definitions, command/shortcut handlers, TUI chrome affordances, autocomplete wrappers, per-turn system-prompt append hooks, dev-gated read-only introspection taps, payload/session-log query tools, workspace dialogs, and Pi-specific tool result renderers.

## Does NOT own

- Agent role prompt definitions, skill resource bodies, prompt composition, and prompt-resource legality — `agents/`. `agent-runtime/` is now only the Pi hook/tool adapter for that central policy.
- Graph truth, graph mutation policy, or graph readers — top-level `graph/`.
- Pi JSONL/session semantics, runtime-state projection, workspace coordination, or transcript exchange projection — top-level `session/`, `projections/`, and related domain seams.
- Reusable DTO projection or reusable markdown/text rendering — top-level `projections/` and `renderers/`.
- Product transport handlers — `rpc/`, `app/`, and `web/`.

## Directory layout

```text
extensions/
├── README.md
├── agent-runtime/          Pi adapter for central agent runtime policy plus execute-mode stub
│   ├── runtime/            operational-mode Pi tool activation adapter
│   ├── system-prompts/     before_agent_start hook adapter
│   └── orchestrator-stub/
├── brunch-data/            Pi tools over selected Brunch graph/spec/workspace/session data
│   ├── graph/              mutate_graph/read_graph tools + selected-spec graph read seam
│   ├── context/            workspace/spec/session context tools
│   ├── elicitation/        read/update elicitation-gap register tools
│   └── reconciliation/     read/update reconciliation-need register tools
├── session-hooks/          session lifecycle and boundary refresh hooks
│   └── session/
├── dev-mode/               dev-gated observability/query tools
│   ├── introspection/      passive provider-payload tap + /introspect command
│   ├── introspect-query/   brunch_introspect_query over captured payloads
│   └── session-query/      brunch_session_query over the current branch
├── web-tools/              web_fetch/web_search read tools for referenced-document acquisition
│   └── web/
├── subagents/              D44-L/D91-L sealed SDK child sessions and `subagent` tool
├── chrome/                 TUI header/title/footer/sidecar-widget chrome projection
├── commands/               /brunch:* commands, shortcut, branch/tree policy
├── compaction/             auto-compaction anchor contract and future hook
├── exchanges/              structured-exchange present_* / request_* Pi tools
├── mentions/               #graph mention prompt hint + autocomplete provider
├── shared/                 projection/truncation helpers + Zod→Pi schema adapter for dev query tools
├── workspace/              spec/session picker command adapter
└── tui-lab/                local TUI experiment registrar
```

## Boundary rules

```pseudo
rules:
  .pi/extensions/* -> agents/, .pi/components/, graph/, session/, projections/, renderers/ [adapter imports allowed]
  .pi/extensions/* x> db/                                                            [no direct storage]
  graph/, session/    x> .pi/                                                        [domain layers never import adapters]
  agents/prompts/     x> .pi/extensions/                                             [prompt bodies do not register Pi hooks]
  projections/        x> .pi/, rpc/, app/, web/                                      [no transport/UI imports]
  renderers/          x> .pi/, rpc/, app/, web/                                      [no transport/UI imports]
```

## TUI launch chrome

`chrome/` is the only product extension that should install Brunch's persistent TUI shell chrome. It receives launch facts from `src/app/brunch-tui.ts` through `BrunchChromeState`; it does not read web host, workspace, or activation state itself.

## Migration notes

`exchanges/schemas/` is the intentional current exception to "adapter-only": it owns the Zod-authored structured-exchange details schema per D37-L/D41-L until a separate schema-ownership slice moves or names that seam. Zod-to-Pi `TSchema` conversion is confined to two per-plane adapters: `exchanges/pi-schema.ts` (structured-exchange) and `shared/pi-tool-schema.ts` (dev-gated query tools). Both export JSON Schema draft 2020-12 (`z.toJSONSchema`), which strict provider validators require.

`exchanges/shared/markdown.ts` contains Pi-rendering helpers. Move only reusable product markdown/text rendering into the future renderer seam; keep Pi `renderCall` / `renderResult` widgets and UI-only message components local to `.pi/`.
