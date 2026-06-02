# session/ — Session domain layer

SPEC decisions: D6-L, D11-L, D12-L, D13-L, D21-L, D52-L

## Owns

Projection of Brunch's session semantics out of Pi's JSONL substrate,
plus the coordination logic for workspace/spec/session lifecycle.

- **Transcript projection** — reading Pi JSONL, projecting Brunch-relevant
  structure (assistant/user rows, custom entries, tool results).

- **Exchange extraction** — elicitation exchange projection: prompt-side
  span + response-side span, per D13-L.

- **Workspace coordination** — boot flow, spec/session selection,
  `.brunch/state.json` management. The `WorkspaceSessionCoordinator`
  is the only module that creates/opens Pi sessions for Brunch user flows
  and writes `brunch.session_binding`.

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

## Migration from src/ root

These files currently at `src/` root migrate here incrementally:

| Current file                      | Session concern                    |
|-----------------------------------|------------------------------------|
| `workspace-session-coordinator.ts`| boot, spec/session selection       |
| `session-binding.ts`              | session↔spec binding               |
| `brunch-session-envelope.ts`      | session envelope reader            |
| `session-projection-reader.ts`    | JSONL projection                   |
| `session-transcript.ts`           | transcript row projection          |
| `elicitation-exchange.ts`         | exchange extraction                |
| `structured-exchange.ts`          | structured exchange schemas/types  |

Move each file when it is next touched for substantive work, not as a
bulk rename. Update imports at the call sites.
