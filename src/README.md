# src/ — Brunch source topology

Decision D52-L in `memory/SPEC.md` locks the target layout. The current LLM-context ingress refactor introduces `agents/` as the Pi-independent owner for Brunch-authored agent context; agent prompt bodies, prompt-resource skills, prompt runtime policy, and context seed composition now live there.

```text
src/
├── app/                  Product host entrypoints and wiring
├── workspace/            Cwd/package identity helpers and small workspace stores
├── scripts/              Local executable utilities
│
├── agents/              Pi-independent owner for Brunch-authored LLM context ingress
│   ├── prompts/            agent role body markdown resources
│   ├── skills/             prompt-resource markdown resources
│   ├── runtime/            prompt composition and prompt-resource/tool legality
│   └── contexts/           agent-visible seed, context-tool, graph, exchange text
│
├── .pi/                  Sealed Pi-harness runtime surface
│   ├── components/         reusable Pi TUI/message components
│   └── extensions/         Pi registrars: tools, hooks, commands, TUI affordances
│
├── db/                   Persistence substrate
│                           Drizzle schema, migrations, connection lifecycle
│
├── graph/                Graph domain layer
│                           CommandExecutor, readers, policy, validators,
│                           query bucketing, change-log replay, recon-need substrate
│
├── session/              Session domain layer
│                           transcript projection, exchange extraction,
│                           workspace coordination, session binding, LSN staleness
│
├── projections/          Structured DTOs derived from domain/session/tool facts
├── renderers/            Human/product-only lossy text rendering
│
├── rpc/                  Brunch JSON-RPC handlers
│                           protocol, method handlers, WebSocket adapter
│
└── web/                  React client (standalone build target)
                            routes, hooks, RPC client
```

## Dependency direction

```pseudo
rules:
  graph/          -> db/                         [allowed]
  workspace/       -> constants/ or workspace-local files only
  projections/*   -> graph/, session/, workspace/ [read/domain imports allowed]
  renderers/*     -> projections/, session/, workspace/ as needed for human/product input types
  agents/         -> graph/, projections/, session/, workspace/ [agent-visible text over already-read facts]
  .pi/            -> agents/, graph/, session/, projections/ [Pi runtime adapters/resources]
  rpc/           -> graph/, session/, projections/
  app/           -> agents/, graph/, session/, projections/, renderers/
  graph/, session/ x> .pi/, rpc/, app/, web/
  projections/    x> .pi/, rpc/, app/, web/
  renderers/      x> .pi/, rpc/, app/, web/
  web/            -> rpc/ types only
```

Rules:

- `workspace/` owns cwd-scoped identity, inventory, and workspace default-state persistence. It must not import Pi, session, graph, DB, projection, renderer, adapter, transport, app, or web modules.
- `graph/` imports from `db/`. No other layer imports `db/` directly.
- `agents/` owns the Brunch-authored LLM-context ingress seam. Today it hosts agent prompt bodies, prompt-resource skills, foreground roster policy, prompt composition, prompt-resource/tool legality, context seed composition, reusable agent-visible context renderers, and the central file registry.
- `.pi/` owns Pi-harness extensions/components and no longer hosts Brunch-authored prompt bodies, prompt-resource skills, prompt composition, or provider-visible tool/session text.
- `.pi/extensions/` registers Pi tools/hooks/UI affordances and delegates product semantics outward.
- `projections/` owns reusable structured output; `agents/contexts/` owns reusable model-facing text; `renderers/` owns human/product-only lossy text output.
- `web/` is a separate Vite build target.

## Migration notes

Product entrypoints now live in `app/`; package/project identity helpers and `.brunch/workspace.json` default-state persistence live in `workspace/`; reusable workspace state DTOs live in `projections/workspace/`; and reusable print-mode workspace-state text lives in `renderers/workspace/`. No compatibility root files remain for the old root-level Brunch entrypoint, print helper, or package-identity paths.

The old domain-local `src/{graph,session,structured-exchange}/project/` folders now live under `projections/{graph,session,exchanges}/`.

The old domain-local `src/{graph,session,structured-exchange}/format/` folders and `src/render/` first moved under `renderers/`; reusable model-facing renderers now live under `agents/contexts/`, while `renderers/` retains human/product-only text.

Runtime-state transcript entry facts live in `session/runtime-state.ts`; reusable flattened runtime-state projection lives in `projections/session/runtime-state.ts`, while foreground roster/tool policy lives in `agents/runtime/policy.ts`.

The earlier `src/agents/` top-level prompt subtree had moved under `src/.pi/{agents,skills}/`; the new `src/agents/` seam reclaims the name for Pi-independent LLM context ingress. Agent bodies have moved to `src/agents/prompts/`; prompt-resource skills have moved to `src/agents/skills/`. The old `src/.pi/context/` prompt-pack subtree remains retired.
