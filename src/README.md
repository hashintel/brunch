# src/ — Brunch source topology

Decision D52-L in `memory/SPEC.md` locks the target layout. Runtime-state projection remains a planned follow-up split under Cards 4–5 of the active topology chain.

```text
src/
├── app/                  Product host entrypoints and wiring
├── workspace/            Cwd/package/workspace identity helpers
├── scripts/              Local executable utilities
│
├── .pi/                  Sealed Pi-harness runtime surface
│   ├── agents/             Pi session-agent prompt assembly and definitions
│   ├── skills/             goal/strategy/lens/method resources read on demand
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
├── renderers/            Lossy text/markdown/toon/tool-content rendering
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
  projections/*   -> graph/, session/, workspace/ [read/domain imports allowed]
  renderers/*     -> projections/, graph/, session/ as needed for input types
  .pi/            -> graph/, session/, projections/, renderers/ [Pi runtime adapters/resources]
  rpc/           -> graph/, session/, projections/, renderers/
  app/           -> graph/, session/, projections/, renderers/
  graph/, session/ x> .pi/, rpc/, app/, web/
  projections/    x> .pi/, rpc/, app/, web/
  renderers/      x> .pi/, rpc/, app/, web/
  web/            -> rpc/ types only
```

Rules:

- `graph/` imports from `db/`. No other layer imports `db/` directly.
- `.pi/` owns Pi-harness agents/resources/extensions/components. It is not just an adapter folder; it is the product's sealed Pi runtime surface.
- `.pi/extensions/` registers Pi tools/hooks/UI affordances and delegates product semantics outward.
- `.pi/agents/` owns runtime prompt assembly and legal resource manifests; `.pi/skills/` owns read-on-demand markdown resources.
- `projections/` owns reusable structured output; `renderers/` owns reusable lossy text output.
- `web/` is a separate Vite build target.

## Migration notes

Product entrypoints now live in `app/`, package identity tests live in `workspace/`, reusable workspace state DTOs live in `projections/workspace/`, and reusable print-mode workspace-state text lives in `renderers/workspace/`. No compatibility root files remain for the old root-level Brunch entrypoint, print helper, or package-identity paths.

The old domain-local `src/{graph,session,structured-exchange}/project/` folders now live under `projections/{graph,session,exchanges}/`.

The old domain-local `src/{graph,session,structured-exchange}/format/` folders and `src/render/` now live under `renderers/{graph,session,structured-exchange}/` and `renderers/`.

Runtime-state transcript entry facts live in `session/runtime-state.ts`; reusable flattened runtime-state projection/policy now lives in `projections/session/runtime-state.ts` and `projections/session/runtime-policy.ts`.

The old `src/agents/` top-level prompt subtree has moved under `src/.pi/{agents,skills}/` because these agents/resources live only inside the Pi harness. The old `src/.pi/context/` prompt-pack subtree remains retired.
