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

## Does not own

- Graph truth, command execution, or persistence — `graph/` and `db/`.
- Pi registrars and reusable Pi UI components — `.pi/`.
- Agent prompt resources and model-facing context text — `agents/`.
- Session transcript semantics, binding, and workspace/session coordination — `session/`.
- JSON-RPC method semantics — `rpc/`.
- React client code — `web/`.

## Dependency direction

`app/` may import from `.pi/`, `agents/`, `graph/`, `session/`, `rpc/`, `projections/`, and `renderers/` to compose product modes. Domain layers must not import `app/`.
