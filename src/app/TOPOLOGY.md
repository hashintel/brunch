# app/

SPEC decisions: D52-L

## Owns

Product host entrypoints and wiring for Brunch runtime modes.

Current entrypoints:

- `brunch.ts` — CLI mode dispatch for TUI, RPC, and print. `--mode web` is
  reserved but deferred: the browser client is served only as the TUI sidecar
  (a standalone headless web host is a future feature).
- `print-workspace-state.ts` — terse human/product print-mode rendering for
  `brunch --mode print`.
- `brunch-tui.ts` — TUI launch path, embedded Pi session runtime wiring, and the
  web sidecar (`startWebHost`; browser launch is opt-in via `--open-web`).

Current runtime support modules:

- `pi-session-options.ts` — internal Brunch-to-Pi session option projection for
  lifecycle forwarding, tool hardening, thinking preset, and optional concrete
  model override.
- `git-worktree-port.ts`, `agent-runner-port.ts`, `test-runner-port.ts` —
  app-layer execution-port implementations injected into executor Pi tools;
  executor core owns the port contracts and state transitions, while app owns
  concrete external capability implementations. `agent-runner-port.ts` bridges
  executor run metadata to the sealed subagent worker substrate and fails closed
  when subagent deps or Pi model context are absent.

## Does not own

- Graph truth, command execution, or persistence — `graph/` and `db/`.
- Pi registrars and reusable Pi UI components — `.pi/`.
- Agent prompt resources and model-facing context text — `agents/`.
- Session transcript semantics, binding, and workspace/session coordination — `session/`.
- JSON-RPC method semantics — `rpc/`.
- React client code — `web/`.

## Dependency direction

`app/` may import from `.pi/`, `agents/`, `graph/`, `session/`, `rpc/`, and `projections/` to compose product modes. Domain layers must not import `app/`.
