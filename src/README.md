# src/ — Brunch source topology

Decision D52-L in `memory/SPEC.md` locks this layout.

```
src/
├── .pi/                  Pi adapter layer (TUI)
│   ├── components/         reusable TUI components
│   └── extensions/         Pi registrars: agent tools, TUI commands, enhancements
│
├── agents/               Agent intelligence layer
│   ├── modes/              operational mode prompts and rules
│   ├── strategies/         interaction-shape prompts (propose-graph, project-graph, etc.)
│   ├── lenses/             topical-focus prompts (intent, design, oracle, etc.)
│   └── contexts/           snapshot orchestration (calls graph/ and session/)
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
├── rpc/                  Brunch JSON-RPC handlers
│                           protocol, method handlers, WebSocket adapter
│
└── web/                  React client (standalone build target)
                            routes, hooks, RPC client
```

## Dependency direction

```
.pi/extensions/  ──┐
                   ├──▶  graph/  ──▶  db/
rpc/  ────────────┤
                   ├──▶  session/
agents/  ─────────┘
                         (Pi JSONL — not Brunch-owned storage)

web/  ── standalone build, imports from rpc/ types only
```

Rules:
- `graph/` imports from `db/`. No other layer imports `db/` directly.
- `agents/` imports snapshot functions from `graph/` and `session/`.
- `.pi/extensions/` and `rpc/` may import from `graph/`, `session/`, and `agents/`.
- `web/` is a separate Vite build target.

## Migration notes

The session-domain files (workspace-session-coordinator, session-binding,
session-projection-reader, brunch-session-envelope, session-transcript,
exchange-projection, structured-exchange, project-identity) now live in
`src/session/`; `brunch-pi-profile.ts` in `src/.pi/`; `web-host` in `src/rpc/`;
the React client in `src/web/` (formerly `web-client/`); shared test helpers
in `src/probes/`. The active workspace file is `.brunch/workspace.json`
(`state.json` is retired).

Prompt composition has moved to `src/agents/compose.ts` per D52-L/D58-L. The
remaining `src/.pi/context/` files are legacy source material only; product code
must not import that composer while the rest of the frontier rehomes/deletes old
prompt-pack content.
