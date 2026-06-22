# session/schema/ — Session vocabulary leaves

SPEC decisions: D52-L, D73-L, D85-L

## Owns

Drizzle-free, Pi-free closed vocabulary for session-domain state.

- `kinds.ts` is the session-side mirror of `src/graph/schema/kinds.ts`: a pure constants leaf that imports nothing and owns the runtime axis vocab for `op_mode`, agent-role ids, `strategy`, `lens`, and the `auto` sentinel.
- Display-only planned runtime choices, such as `execute`, live here beside the runtime enum they extend for UI choice surfaces, but are not valid persisted runtime state until implemented.

## Does NOT own

- Runtime-state transcript entry parsing or append helpers — those stay in `src/session/runtime-state.ts`.
- Runtime policy, legal option derivation, or prompt-resource manifests — those stay in `src/projections/session/` and `src/.pi/extensions/runtime/`.
- Graph vocabulary — that remains in `src/graph/schema/kinds.ts`.

## Dependency rule

`kinds.ts` imports nothing. Consumers import these constants/types from the leaf directly when they only need vocab. Import from `session/runtime-state.ts` only for transcript-state entry parsing/append APIs and the state shapes those APIs own.
