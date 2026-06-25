# src/ — Brunch source topology

Decision D52-L in `memory/SPEC.md` locks the target layout. The current LLM-context ingress refactor introduces `agents/` as the Pi-independent owner for Brunch-authored agent context; its registry still points at existing `.pi` prompt/skill files until the move slices land.

```text
src/
├── app/                  Product host entrypoints and wiring
├── workspace/            Cwd/package identity helpers and small workspace stores
├── scripts/              Local executable utilities
│
├── agents/              Pi-independent owner for Brunch-authored LLM context ingress
│                           (currently central path registry; content moves later)
│
├── .pi/                  Sealed Pi-harness runtime surface
│   ├── agents/             current markdown body file home during migration
│   ├── skills/             current prompt-resource file home during migration
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
  workspace/       -> constants/ or workspace-local files only
  projections/*   -> agents/, graph/, session/, workspace/ [read/domain imports allowed; agents/ is temporary registry edge]
  renderers/*     -> projections/, graph/, session/, workspace/ as needed for input types
  agents/         -> .pi/agents/, .pi/skills/      [current migration registry only]
  .pi/            -> agents/, graph/, session/, projections/, renderers/ [Pi runtime adapters/resources]
  rpc/           -> graph/, session/, projections/, renderers/
  app/           -> graph/, session/, projections/, renderers/
  graph/, session/ x> .pi/, rpc/, app/, web/
  projections/    x> .pi/, rpc/, app/, web/
  renderers/      x> .pi/, rpc/, app/, web/
  web/            -> rpc/ types only
```

Rules:

- `workspace/` owns cwd-scoped identity, inventory, and workspace default-state persistence. It must not import Pi, session, graph, DB, projection, renderer, adapter, transport, app, or web modules.
- `graph/` imports from `db/`. No other layer imports `db/` directly.
- `agents/` owns the Brunch-authored LLM-context ingress seam. Today it centralizes the file registry for prompt bodies and prompt-resource skills; later slices move the content/rendering owners under this seam. The current `projections/session/runtime-policy.ts` import of this registry is a migration edge only: once runtime policy moves under `agents/runtime/`, projections should stop depending on `agents/`.
- `.pi/` owns Pi-harness extensions/components and temporarily hosts the existing markdown prompt/skill files while the LLM-context ingress refactor proceeds.
- `.pi/extensions/` registers Pi tools/hooks/UI affordances and delegates product semantics outward.
- `.pi/agents/` and `.pi/skills/` are current file homes, not the long-term conceptual owner, for Brunch-authored prompt bodies and read-on-demand markdown resources.
- `projections/` owns reusable structured output; `renderers/` owns reusable lossy text output.
- `web/` is a separate Vite build target.

## Migration notes

Product entrypoints now live in `app/`; package/project identity helpers and `.brunch/workspace.json` default-state persistence live in `workspace/`; reusable workspace state DTOs live in `projections/workspace/`; and reusable print-mode workspace-state text lives in `renderers/workspace/`. No compatibility root files remain for the old root-level Brunch entrypoint, print helper, or package-identity paths.

The old domain-local `src/{graph,session,structured-exchange}/project/` folders now live under `projections/{graph,session,exchanges}/`.

The old domain-local `src/{graph,session,structured-exchange}/format/` folders and `src/render/` now live under `renderers/{graph,session,structured-exchange}/` and `renderers/`.

Runtime-state transcript entry facts live in `session/runtime-state.ts`; reusable flattened runtime-state projection/policy now lives in `projections/session/runtime-state.ts` and `projections/session/runtime-policy.ts`.

The earlier `src/agents/` top-level prompt subtree had moved under `src/.pi/{agents,skills}/`; the new `src/agents/` seam reclaims the name for Pi-independent LLM context ingress. It starts with a registry that points at the existing `.pi` files so the move can proceed byte-stably. The old `src/.pi/context/` prompt-pack subtree remains retired.
