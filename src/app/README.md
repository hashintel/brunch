# app/

SPEC decisions: D52-L

## Owns

Product host entrypoints and wiring for Brunch runtime modes.

Current entrypoints:

- `brunch.ts` — CLI mode dispatch for TUI, RPC, web, and print.
- `brunch-tui.ts` — TUI launch path and embedded Pi session runtime wiring.

## Does not own

- Graph truth, command execution, or persistence — `graph/` and `db/`.
- Pi registrars, prompt resources, and reusable Pi UI components — `.pi/`.
- Session transcript semantics, binding, and workspace/session coordination — `session/`.
- JSON-RPC method semantics — `rpc/`.
- React client code — `web/`.

## Dependency direction

`app/` may import from `.pi/`, `graph/`, `session/`, `rpc/`, `projections/`, and `renderers/` to compose product modes. Domain layers must not import `app/`.
