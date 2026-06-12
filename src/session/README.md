# session/ — Session domain layer

SPEC decisions: D6-L, D11-L, D12-L, D13-L, D21-L, D40-L, D52-L, D76-L, D77-L, D78-L

## Owns

Projection of Brunch's session semantics out of Pi's JSONL substrate,
plus the coordination logic for workspace/spec/session lifecycle.

- **Transcript projection** — reading Pi JSONL, projecting Brunch-relevant
  structure (assistant/user rows, custom entries, tool results).

- **Exchange extraction** — session exchange projection: prompt-side
  span + response-side span, per D13-L.

- **Runtime-state transcript facts** — `brunch.agent_runtime_state` entry type,
  parser, and append helpers. Reusable runtime-state projection/policy lives in
  `projections/session/`; `.pi` may append operational-mode entries but does not
  own hidden runtime memory.

- **Structured-exchange loop helpers** — deterministic POC exchange generation,
  pending prompt reconstruction from structured transcript tuples, and response
  toolResult materialization. RPC maps these domain results to JSON-RPC status
  and error codes; transcript mechanics stay here.

- **Workspace coordination** — boot flow, spec/session selection,
  `.brunch/workspace.json` management. The `WorkspaceSessionCoordinator`
  is the only module that creates/opens Pi sessions for Brunch user flows
  and writes collapsed `brunch.session_binding` entries (`{schemaVersion,
  specId}`). Its chrome state is a selection snapshot (`cwd`, optional
  project, selected `spec`) and intentionally carries no readiness phase or
  chat-mode display fields. Its private `workspace-session-coordinator/`
  subtree owns coordinator-shaped boot/probe helpers such as canonical
  session-file classification; external callers import only the public root
  module.

- **Session binding** — session↔spec binding entries in JSONL.

- **Session envelope** — canonical session envelope reader (spec/session pair).

- **Turn-boundary choreography** — write-side seam for the assistant-visible
  watermark, `worldUpdate`, mention staleness, and honest assistant origination.
  `prepare-next-turn.ts` owns the single pre-turn continuity writer; Pi lifecycle
  hooks adapt it through `.pi/extensions/session/lifecycle.ts`, and
  `before_provider_request` is a guard-only check. `start-assistant-turn.ts`
  owns the origination decision and context seed entries; `context-seed.ts`
  composes the seed's provider-visible payload (spec overview + top-ranked
  open gaps) from spec-scoped reads; `originate-assistant-turn.ts` is the one
  seed-and-kick choreography every entry point (TUI boot, `session.triggerExchange`)
  delegates to — origin derives from conversational-message presence in the
  projected transcript, never entry counts (I46-L).

- **Continuity carriers (FE-857)** — model-intent continuity entries
  (`worldUpdate`, side-task/reviewer drains, mention staleness hints, context
  seed) persist as pi `CustomMessageEntry` (provider-visible `content` +
  structured `details`); ledger-only entries (`own_mutation`, `mention`,
  runtime state, binding, lifecycle) stay on `CustomEntry`.
  `appendPreparedContinuityEntry` in `prepare-next-turn.ts` routes by carrier.
  Rule: at the reconciler/guard seam use `appendCustomMessageEntry` directly;
  `pi.sendMessage` is for out-of-band injection with delivery semantics only.

## Session PULL read-shape ledger

D60-L read-shape ownership is explicit for the session-domain sources the
PROJECT-stage DTOs lock against. These are source reads/facts, not reusable
projection seams; consumers should expose only the subset they need, and a
consumer that merely tags an existing source shape should read the source
directly instead of growing a wrapper.

| Shape | Canonical owner | Current consumers | Disposition / reason |
| --- | --- | --- | --- |
| `cwd_inventory` | `inspectWorkspaceCwdInventory` | `read_workspace_context`, `renderers/workspace/workspace-context.ts` | Direct PULL read. The typed inventory already matches the tool/renderer seam, so no `projections/workspace/workspace-context` wrapper survives. |
| `workspace_overview` | `inspectWorkspaceOverview` | `read_workspace_context`, `renderers/workspace/workspace-context.ts` | Direct PULL read. Same rationale as `cwd_inventory`: the source shape is already the consumer shape. |
| `workspace_session_state` | `WorkspaceSessionCoordinator` (`WorkspaceSessionState`) | `projections/workspace/workspace-state.ts`, `chromeStateForWorkspace`, app/rpc/web workspace flows | Source union owned by the coordinator. Downstream code may flatten it, but the coordinator remains the authority for the narrow chrome snapshot and status-variant field set. |
| `agent_runtime_state` | `latestValidBrunchAgentStateEntryData` and transcript-backed runtime-state facts in `session/runtime-state.ts` | `projections/session/runtime-state.ts`, `projections/session/affordances.ts`, `.pi/extensions/runtime/` | Transcript-backed source read. Projection/policy layers derive from these facts rather than storing parallel hidden runtime memory. |

## Runtime affordance coverage ledger

Runtime posture affordances are pure derivations over projected runtime state plus
capability-readiness over selected-spec gaps. `projections/session/affordances.ts`
owns legal option sets and default-on-switch values; `session.runtimeState`
currently exposes only the selected value per axis. Deferred means eligible or
known but not currently transported for that consumer.

| Row | Canonical owner | Agent | RPC | Web | Reason for deferred |
| --- | --- | --- | --- | --- | --- |
| `goal.options` | `affordances.goal.legalOptions` | required | deferred | deferred | Transport follows a concrete UI/client need; agent already needs legality. |
| `goal.default_on_switch` | `affordances.goal.defaultOnSwitch` | required | deferred | deferred | Transport follows a concrete posture-switch surface. |
| `goal.selection` | `session.runtimeState.agent.goal` | required | required | deferred | RPC already reports current posture; web has no posture UI yet. |
| `strategy.options` | `affordances.strategy.legalOptions` | required | deferred | deferred | Transport follows a concrete UI/client need; AUTO excludes `freestyle`. |
| `strategy.default_on_switch` | `affordances.strategy.defaultOnSwitch` | required | deferred | deferred | Transport follows a concrete posture-switch surface. |
| `strategy.selection` | `session.runtimeState.agent.strategy` | required | required | deferred | RPC already reports current posture; web has no posture UI yet. |
| `lens.options` | `affordances.lens.legalOptions` | required | deferred | deferred | Transport follows a concrete UI/client need. |
| `lens.default_on_switch` | `affordances.lens.defaultOnSwitch` | required | deferred | deferred | Transport follows a concrete posture-switch surface. |
| `lens.selection` | `session.runtimeState.agent.lens` | required | required | deferred | RPC already reports current posture; web has no posture UI yet. |
| `active-review-set` | product-state-gated review-cycle surface | deferred | deferred | deferred | Needs current review-set product state; not derivable from runtime policy alone. |
| `turn-mode` | product-state-gated freestyle-vs-structured turn surface | deferred | deferred | deferred | Needs current turn/exchange mode state; not derivable from runtime policy alone. |

`runtime-affordances-coverage.test.ts` guards the required subsets: agent rows
must remain covered by the shared derivation, RPC rows by the public session
schema, and the product-state-gated rows must stay explicit deferred tripwires.

## Does NOT own

- Graph state, CommandExecutor, graph queries — those live in `graph/`.
- Prompt composition, context building — those live in `.pi/agents/`.
- Pi extension registration — those live in `.pi/extensions/`.

## Imported by

- `.pi/agents/contexts/` — for session/transcript context reads.
- `.pi/extensions/context/` — for direct workspace kickoff inventory / overview reads.
- `projections/session/` — for reusable transcript-context DTO projection.
- `projections/workspace/` — for reusable workspace-state DTO projection.
- `renderers/session/` — for reusable transcript markdown rendering.
- `renderers/workspace/` — for workspace inventory / overview text rendering over source session read shapes.
- `rpc/` — for session.* and workspace.* RPC handlers.
- `.pi/extensions/` — for session lifecycle hooks.

## Moved from src/ root

These files migrated here on 2026-06-02:

| File                              | Session concern                    |
|-----------------------------------|------------------------------------|
| `workspace-session-coordinator.ts`| boot, spec/session selection       |
| `session-binding.ts`              | session↔spec binding               |
| `brunch-session-envelope.ts`      | session envelope reader            |
| `session-projection-reader.ts`    | JSONL projection target resolution |
| `session-transcript.ts`           | transcript row projection          |
| `exchange-projection.ts`          | exchange extraction                |
| `runtime-state.ts`                | runtime-state transcript entries   |
| `structured-exchange.ts`          | structured exchange schemas/types  |
| `structured-exchange-loop.ts`     | deterministic exchange loop helpers|
| `project-identity.ts`             | workspace identity (cwd discovery) |
