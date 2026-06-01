# db/ — Persistence substrate

SPEC decisions: D16-L, D41-L, D52-L

## Owns

- **Drizzle table definitions** — nodes, edges, change_log, graph_clock,
  reconciliation_need, coherence_state, spec row. Canonical column-level
  source of truth for persisted shapes.

- **Migrations** — Drizzle-managed schema migrations for `.brunch/data.db`.

- **Connection lifecycle** — `better-sqlite3` connection creation,
  WAL mode, pragmas.

- **Row schema derivation** — runtime insert/update schemas derived from
  Drizzle table definitions through a single adapter path (chosen during
  the A20-L prep-envelope spike: `drizzle-zod`, `drizzle-orm/typebox`,
  or equivalent). Do not hand-author parallel row schemas alongside
  table definitions.

## Does NOT own

- Domain logic, validation, policy, CommandExecutor, readers, change-log
  replay — all of that lives in `graph/`.
- Query construction beyond simple helpers — domain queries live in `graph/`.

## Imported by

- `graph/` — the only layer that imports `db/` directly.
  No other layer should import from this directory.

## Target state (after A20-L spike + M4)

```
db/
├── README.md
├── schema.ts               Drizzle table definitions
├── connection.ts            better-sqlite3 lifecycle
├── migrations/              Drizzle migration files
└── row-schemas.ts           derived runtime schemas (from Drizzle tables)
```
