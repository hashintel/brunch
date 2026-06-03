# session/ — Session domain layer

SPEC decisions: D6-L, D11-L, D12-L, D13-L, D21-L, D52-L

## Owns

Projection of Brunch's session semantics out of Pi's JSONL substrate,
plus the coordination logic for workspace/spec/session lifecycle.

- **Transcript projection** — reading Pi JSONL, projecting Brunch-relevant
  structure (assistant/user rows, custom entries, tool results).

- **Exchange extraction** — session exchange projection: prompt-side
  span + response-side span, per D13-L.

- **Runtime-state projection** — flattened transcript-backed agent posture,
  mention, world-watermark, and lifecycle slots from linear Brunch session
  envelopes. `.pi` may append operational-mode entries, but the pure projection
  lives here.

- **Structured-exchange loop helpers** — deterministic POC exchange generation,
  pending prompt reconstruction from structured transcript tuples, and response
  toolResult materialization. RPC maps these domain results to JSON-RPC status
  and error codes; transcript mechanics stay here.

- **Workspace coordination** — boot flow, spec/session selection,
  `.brunch/workspace.json` management. The `WorkspaceSessionCoordinator`
  is the only module that creates/opens Pi sessions for Brunch user flows
  and writes collapsed `brunch.session_binding` entries (`{schemaVersion,
  specId}`). Its private `workspace-session-coordinator/` subtree owns
  coordinator-shaped boot/probe helpers such as canonical session-file
  classification; external callers import only the public root module.

- **Session binding** — session↔spec binding entries in JSONL.

- **Session envelope** — canonical session envelope reader (spec/session pair).

- **LSN staleness tracking** — Pi extension records current LSN at session
  start, checks at `prepareNextTurn`, injects `worldUpdate` with optional
  re-snapshot when stale.

## Does NOT own

- Graph state, CommandExecutor, graph snapshots — those live in `graph/`.
- Prompt composition, context building — those live in `agents/`.
- Pi extension registration — those live in `.pi/extensions/`.

## Imported by

- `agents/contexts/` — for session/transcript snapshots
- `rpc/` — for session.* and workspace.* RPC handlers
- `.pi/extensions/` — for session lifecycle hooks

## Moved from src/ root

These files migrated here on 2026-06-02:

| File                              | Session concern                    |
|-----------------------------------|------------------------------------|
| `workspace-session-coordinator.ts`| boot, spec/session selection       |
| `session-binding.ts`              | session↔spec binding               |
| `brunch-session-envelope.ts`      | session envelope reader            |
| `session-projection-reader.ts`    | JSONL projection target resolution |
| `session-transcript.ts`           | transcript row projection          |
| `exchange-projection.ts`         | exchange extraction                |
| `runtime-state.ts`                | runtime state projection           |
| `structured-exchange.ts`          | structured exchange schemas/types  |
| `structured-exchange-loop.ts`     | deterministic exchange loop helpers|
| `project-identity.ts`             | workspace identity (cwd discovery) |
