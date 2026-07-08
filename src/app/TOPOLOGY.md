# app/

SPEC decisions: D52-L, D113-L, D114-L, D115-L

## Owns

Product host entrypoints and wiring for Brunch runtime modes.

Current entrypoints:

- `brunch.ts` — CLI dispatch. With no positional subcommand it launches the
  TUI, RPC, or print mode. The `login` positional routes to the standalone
  auth flow before workspace/session boot. `--mode web` is reserved but
  deferred: the browser client is served only as the TUI sidecar (a standalone
  headless web host is a future feature).
- `print-workspace-state.ts` — terse human/product print-mode rendering for
  `brunch --mode print`.
- `brunch-tui.ts` — TUI launch path, embedded Pi session runtime wiring, and the
  web sidecar (`startWebHost`; browser launch is opt-in via `--open-web`). It
  resolves boot-time allowlisted-model availability for the workspace-dialog
  warning, and passes the same no-auth notice into session-orientation wiring.
  Its boot-kick live `sendCustomMessage` adapter resolves at scheduling time so
  `session_start` cannot park the TUI before subscription, but queues all sends
  in one per-kick serial chain after the defer window so seed custom messages
  settle before the triggering kick send begins.

Current runtime support modules:

- `model-policy.ts` — D113-L/D115-L model-policy boundary: the code-owned
  ordered allowlist, Brunch-contained `ModelRegistry`, first-auth fall-through
  resolver, scoped `/model` cycle list, and single-source no-auth guidance copy.
  Ambient/custom Pi `models.json` entries are not a Brunch product surface for
  the alpha.
- `brunch-login.ts` — D114-L standalone auth-onboarding flow. It reads provider
  order from `model-policy.ts`, writes only Pi's global `AuthStorage` file
  (`auth.json`, relocatable via `PI_CODING_AGENT_DIR`), and does not boot a
  Brunch workspace or Pi session.
- `pi-session-options.ts` — internal Brunch-to-Pi session option projection for
  lifecycle forwarding, tool hardening, pinned thinking/scoped model policy, and
  optional concrete model override.
- `git-worktree-port.ts`, `agent-runner-port.ts`, `test-runner-port.ts`,
  `git-land-port.ts`, `git-host-promotion-port.ts` —
  app-layer execution-port implementations injected into executor Pi tools;
  executor core owns the port contracts and state transitions, while app owns
  concrete external capability implementations. `agent-runner-port.ts` bridges
  executor run metadata to the sealed subagent worker substrate and fails closed
  when subagent deps or Pi model context are absent. `git-host-promotion-port.ts`
  performs promoted-commit diff inspection in the run worktree and accepted host
  patch application via `git apply`; it must not create commits, refs, branch
  switches, or staged index state.

## Does not own

- Graph truth, command execution, or persistence — `graph/` and `db/`.
- Pi registrars and reusable Pi UI components — `.pi/`.
- Agent prompt resources and model-facing context text — `agents/`.
- Session transcript semantics, binding, and workspace/session coordination — `session/`.
- JSON-RPC method semantics — `rpc/`.
- React client code — `web/`.

## Dependency direction

`app/` may import from `.pi/`, `agents/`, `graph/`, `session/`, `rpc/`, and `projections/` to compose product modes. Domain layers must not import `app/`.
