# src/ — Brunch source topology

Decision D52-L in `memory/SPEC.md` locks the target layout. Some layers are still mid-migration; migration notes below distinguish current files from final ownership.

```text
src/
├── app/                  Product host entrypoints and wiring                  [target]
├── workspace/            Cwd/package/workspace identity helpers               [target]
├── scripts/              Local executable utilities                           [target]
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
│                           snapshot bucketing, change-log replay, recon-need substrate
│
├── session/              Session domain layer
│                           transcript projection, exchange extraction,
│                           workspace coordination, session binding, LSN staleness
│
├── projections/          Structured DTOs derived from domain/session/tool facts [target]
├── renderers/            Lossy text/markdown/toon/tool-content rendering       [target]
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
  app/           -> graph/, session/, projections/, renderers/, scripts/
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

Product entrypoints now live in `app/`, print-mode utility code lives in `scripts/`, and package identity tests live in `workspace/`. No compatibility root files remain for the old `src/brunch*`, `src/print-snapshot*`, or `src/package-identity*` paths.

Temporary drift: `src/scripts/print-snapshot.ts` still contains reusable workspace snapshot DTO/rendering code consumed by `rpc/` and `web/`. The next projection/renderer migration should move those shared pieces to `projections/workspace/` and `renderers/workspace/`, leaving `scripts/` as local utility shell code only.
Current `src/{graph,session,structured-exchange}/project/` folders are planned inputs to top-level `projections/` when they represent reusable DTO boundaries.

Current `src/{graph,session,structured-exchange}/format/` folders and `src/render/` are planned inputs to top-level `renderers/` when they represent reusable lossy text/markdown boundaries. Collapse single-caller helpers instead of creating bucket-like top-level files.

The old `src/agents/` top-level prompt subtree has moved under `src/.pi/{agents,skills}/` because these agents/resources live only inside the Pi harness. The old `src/.pi/context/` prompt-pack subtree remains retired.
