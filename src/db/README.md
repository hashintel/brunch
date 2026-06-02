# db/ — Persistence substrate

SPEC decisions: D16-L, D41-L, D52-L

## Owns

- **Drizzle table definitions** (`schema.ts`) — specs, nodes, edges,
  change_log, graph_clock, reconciliation_need. Canonical column-level source
  of truth for persisted shapes. `specs` stores `{id, name, slug,
  readiness_grade}` only; `elicitation_posture` and `commitment_focus` are
  retired. Exports shared enum `const` arrays (`INTENT_KINDS`,
  `READINESS_GRADES`, `EDGE_CATEGORIES`, etc.) reused by `graph/` domain types
  and Pi tool parameter schemas.

- **Row schema derivation** (`row-schemas.ts`) — runtime insert/select
  schemas derived from Drizzle tables via `drizzle-typebox`. Do not
  hand-author parallel row schemas alongside table definitions.

- **Connection lifecycle** (`connection.ts`) — `better-sqlite3` connection
  creation, WAL mode, pragmas, migration runner.

- **Migrations** — Drizzle-managed schema migrations for `.brunch/data.db`.
  Wired when the first `drizzle-kit generate` run lands.

## Does NOT own

- Domain logic, validation, policy, CommandExecutor, readers, change-log
  replay — all of that lives in `graph/`.
- Query construction beyond simple helpers — domain queries live in `graph/`.

## Imported by

- `graph/` — the only layer that imports `db/` directly.
  No other layer should import from this directory.

## Enum flow

`db/schema.ts` owns the single `const` arrays (`INTENT_KINDS`,
`EDGE_CATEGORIES`, `NODE_BASES`, etc.). Other layers derive from them:

```
db/schema.ts                       const arrays + Drizzle tables
  │                                (single source of truth)
  ├──► db/row-schemas.ts           drizzle-typebox insert/select
  │                                (@sinclair/typebox 0.34)
  ├──► graph/schema/nodes.ts       type IntentKind = (typeof INTENT_KINDS)[number]
  │    graph/schema/edges.ts       type EdgeCategory = (typeof EDGE_CATEGORIES)[number]
  │
  └──► Pi tool parameter schemas   Type.Union(INTENT_KINDS.map(Type.Literal))
                                   (typebox v1.x — Pi's package)
```

Do not redeclare enum literals in `graph/` or tool definitions.
Import the `const` array from `db/schema.ts` and derive.

## Stack (settled by A20-L spike)

`drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` + `better-sqlite3@12.8.0`
+ `drizzle-typebox@0.3.3` + `@sinclair/typebox@0.34.14`
