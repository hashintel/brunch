# app/

SPEC decisions: D52-L, D111-L, D123-L, I58-L

## Owns

Product host entrypoints and wiring for Brunch runtime modes.

Current entrypoints:

- `brunch.ts` — CLI dispatch. With no positional subcommand it launches the TUI, RPC, or print mode. Provider authentication is configured inside the TUI through Pi's native `/login`; there is no standalone Brunch login command. `--mode web` is reserved but deferred: the browser client is served only as the TUI sidecar.
- `print-workspace-state.ts` — terse human/product print-mode rendering for `brunch --mode print`.
- `brunch-tui.ts` — TUI launch path, embedded Pi session runtime wiring, and the web sidecar. It passes Pi's native model registry directly into session creation and leaves model and thinking selection to Pi. Its boot-kick `sendCustomMessage` adapter resolves at scheduling time and serializes seed and kick sends.

Current runtime support modules:

- `pi-settings.ts` — the sealed Pi profile, including the soft recommended `anthropic` / `claude-sonnet-4-6` default. The default is not an allowlist; Pi's native `/model` surface may select any supported provider/model/thinking combination. Its `systemPromptOverride` deliberately replaces Pi's coding-assistant base prompt wholesale with a short Brunch preamble; Brunch prompt composition supplies the product context that follows.
- `pi-session-options.ts` — internal Brunch-to-Pi session option projection for lifecycle forwarding and tool hardening. It does not pin model, scoped-model, or thinking policy.
- `git-worktree-port.ts`, `git-slice-integration-port.ts`, `agent-runner-port.ts`, `test-runner-port.ts`, `git-land-port.ts`, `git-host-promotion-port.ts`, `planner-port.ts` — app-layer execution-port implementations injected into executor Pi tools; executor core owns contracts and state transitions. `agent-runner-port.ts` bridges executor run metadata to the sealed subagent worker substrate and fails closed when subagent deps or Pi model context are absent. `planner-port.ts` (FE-1197) bridges the bounded planning projection to the sealed planner subagent, renders repair findings into the task, recovers the outermost JSON object from the reply, and fails closed on missing deps/model context; parsing, validation, and admission stay executor-owned. `git-land-port.ts` commits verified run output and atomically creates the deterministic `brunch/review/<runId>` ref while leaving the run worktree detached. `git-host-promotion-port.ts` performs promoted-commit diff inspection in the run worktree and accepted host patch application via `git apply`; it must not create commits, refs, branch switches, or staged index state. `git-slice-integration-port.ts` provisions one detached worktree per slice, commits slice output, preflights fan-in with `git merge-tree --write-tree`, and advances the run workspace only after conflict-free certainty.

Model recommendations and latency evidence live in [`docs/model-recommendations.md`](../../docs/model-recommendations.md).

## Does not own

- Provider/model registry policy or auth onboarding — Pi's native `/model` and `/login` surfaces.
- Graph truth, command execution, or persistence — `graph/` and `db/`.
- Pi registrars and reusable Pi UI components — `.pi/`.
- Agent prompt resources and model-facing context text — `agents/`.
- Session transcript semantics, binding, and workspace/session coordination — `session/`.
- JSON-RPC method semantics — `rpc/`.
- React client code — `web/`.

## Dependency direction

`app/` may import from `.pi/`, `agents/`, `graph/`, `session/`, `rpc/`, and `projections/` to compose product modes. Domain layers must not import `app/`.
