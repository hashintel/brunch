# session/ — Session domain layer

SPEC decisions: D6-L, D11-L, D12-L, D13-L, D21-L, D40-L, D52-L, D76-L, D77-L, D78-L, D84-L / A29-L, D101-L, D102-L, I56-L

## Owns

Projection of Brunch's session semantics out of Pi's JSONL substrate,
plus the coordination logic for workspace/spec/session lifecycle.

- **Transcript projection** — reading Pi JSONL, projecting Brunch-relevant
  structure (assistant/user rows, custom entries, tool results).

- **Exchange extraction** — session exchange projection: prompt-side
  span + response-side span, per D13-L.

- **Runtime vocabulary leaf** — `schema/kinds.ts` mirrors
  `graph/schema/kinds.ts` for the session side: a drizzle-free, Pi-free leaf that
  owns operational-mode ids, foreground agent-role ids, and display labels for
  the mode picker. Consumers that only need
  vocabulary import directly from `session/schema/kinds.ts`; `runtime-state.ts`
  consumes the leaf for transcript-state parsing and no longer owns duplicate
  runtime literals.

- **Runtime-state transcript facts** — `brunch.agent_runtime_state` entry type,
  parser, and append helpers. Reusable runtime-state projection/policy lives in
  `projections/session/`; `.pi` may append operational-mode entries but does not
  own hidden runtime memory.

- **Elicitation scratchpad carrier** (`elicitation-scratchpad.ts`) — the one
  session-local, non-authoritative asking-agenda substrate (D101-L, I56-L):
  a `brunch.elicitation_scratchpad` custom-entry type plus parse/fold/append
  helpers, mirroring `runtime-state.ts`'s fold pattern exactly (latest-snapshot-wins,
  reconstructed from the session branch — branch-correct by construction, never
  from runtime-state fields or tool-result `details`). Foreground context seeds,
  the `read_elicitation_scratchpad` / `update_elicitation_scratchpad` tools, and
  subagent world snapshots all read the same fold. It never becomes canonical
  graph truth by projection side effect.

- **Session orientation carrier** (`session-orientation.ts`) — the deterministic,
  product-owned choice dialog that routes an assistant-originated kick without
  spending a model turn asking (session-entry-orientation frontier, D37-L: not
  an exchange). A `brunch.session_orientation` custom-entry type is an
  append-only log (one entry per juncture resolution, unlike the scratchpad's
  replace-in-place snapshot); `latestSessionOrientation` reconstructs the most
  recent resolution, and `freshSessionOrientationChoice` additionally checks it
  against the last-fired `brunch.kick` entry so a choice recorded before an
  earlier kick never re-routes a later one. The choice union covers both the
  SPEC-side menu ids and the CODE-side execute-entry ids (`proceed`, `backfill`,
  `design_first`, `oracle_first`, `project_plan`) on the same carrier — no
  parallel entry type. `originate-assistant-turn.ts` folds the fresh choice into
  `composeContextSeedContent`'s orientation section
  (`agents/contexts/data-model/session-orientation.ts` owns the render text)
  and accepts a `forceSeed` option so mid-session dialog-triggered kicks
  (J3/J4/J6 and CODE-side J5) can lay down a fresh seed even when the graph LSN
  has not moved. The Pi-facing dialog function, menu descriptors, juncture
  orchestrator, and event/command registrar (`ctx.ui.select` adapter,
  entry/degraded-mode rules, live-kick composition) live in
  `.pi/extensions/session-orientation/`.

- **Structured-exchange loop helpers** — deterministic POC exchange generation,
  pending prompt reconstruction from structured transcript tuples, response
  toolResult materialization, and the process-local live answer rendezvous used
  by the TUI sidecar (`live-exchange-broker.ts`). RPC maps these domain results
  to JSON-RPC status and error codes; transcript mechanics stay here. The broker
  holds only an in-flight `request_response` promise keyed by exchange id; the
  answered result still reduces to canonical `request_answer` / `request_choice`
  / `request_choices` Pi JSONL details. The broker exists only for `answer`
  (free-text) today — `choice`/`choices`/review have no broker-equivalent yet, a
  named `web-driver-streaming` Horizon gap, not an oversight here. See
  [`docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`](../../docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md)
  for why this broker path is structurally distinct from `session.submitExchangeResponse`
  (which never touches this broker or Pi's `ctx.ui.*` at all). **Provider-legality rule
  (2026-06-12):** every synthetic exchange toolResult (present offers at
  origination, request responses at submit) persists as a *pair* — a synthetic
  assistant toolCall (`syntheticExchangeToolCallMessage`, sentinel provenance
  `brunch-exchange`) immediately followed by the toolResult, sharing one
  `^[a-zA-Z0-9_-]+$` id (`exchangeId__toolName`, never `:`). Real providers
  reject orphan `tool_result` blocks and non-conforming ids; the faux provider
  validates neither, so only the Tier-2 provider-legality assertion and live
  runs guard this shape. `structured-exchange-loop.ts` is the public entry
  point over a private `structured-exchange-loop/` subtree split by purpose:
  `pending-exchange.ts` (read-path reconstruction + schema), `accepted-response.ts`
  (response toolResult materialization), and `synthetic-tool-call.ts` (the
  provider-legality toolCall pair); external callers import only the root.

- **Workspace coordination** — boot flow and spec/session selection over the
  workspace-owned `.brunch/workspace.json` state store. The
  `WorkspaceSessionCoordinator` is the only module that creates/opens Pi
  sessions for Brunch user flows
  and writes collapsed `brunch.session_binding` entries (`{schemaVersion,
  specId}`). Its chrome state is a selection snapshot (`cwd`, optional
  project discovered by `workspace/project-identity.ts`, selected `spec`)
  and intentionally carries no readiness phase or chat-mode display fields.
  Its private `workspace-session-coordinator/` subtree owns coordinator-shaped
  session-file/probe helpers such as canonical session-file classification;
  external callers import only the public root module.

- **Session binding** — session↔spec binding entries in JSONL.

- **Session envelope** — canonical session envelope reader (spec/session pair).

- **Turn-boundary choreography** — write-side seam for the assistant-visible
  watermark, `worldUpdate`, mention staleness, and honest assistant origination.
  `prepare-next-turn.ts` owns the single pre-turn continuity writer; Pi lifecycle
  hooks adapt it through `.pi/extensions/session-hooks/session/lifecycle.ts`, and
  `before_provider_request` is a guard-only check. `start-assistant-turn.ts`
  owns the origination decision and context seed entries;
  `agents/contexts/seeds/origination.ts` composes the seed's provider-visible
  payload — the spec overview from spec-scoped reads, plus the session scratchpad
  projection reconstructed from the session branch's entries fold;
  `originate-assistant-turn.ts` is the one seed choreography every entry point (TUI boot, `session.triggerExchange`)
  delegates to — origin derives from conversational-message presence in the
  projected transcript, never entry counts (I46-L). Origination only *decides
  and seeds* — it fabricates **no** `present_*` exchange (D78-L revised
  2026-06-12; the deterministic offer was a pre-elicitation-gaps fossil, now
  probe-land machinery in `probes/deterministic-exchange-script.ts`). The LLM
  turn completing a 'start' decision is fired by the launch path after session
  creation via `session.sendCustomMessage(kickTurnMessage(origin), { triggerTurn: true })`,
  guarded on model availability (unauthenticated launches idle); the assistant
  authors the opening live, typically via real `present_*`/`request_*` tool
  calls. The RPC `session.triggerExchange` is a kick surface — it seeds and
  reports pending state only for assistant-created exchanges.

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

| Shape                     | Canonical owner                                                                                                | Current consumers                                                                                                                 | Disposition / reason                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd_inventory`           | `workspace/cwd-inventory.ts` (`inspectWorkspaceCwdInventory`)                                                  | `read_workspace_context`, `agents/contexts/data-model/workspace/workspace-context.ts`                                             | Workspace-owned direct PULL read. The typed inventory already matches the tool/renderer seam, so no `projections/workspace/workspace-context` wrapper survives.                        |
| `workspace_overview`      | `workspace-overview-context.ts` (`inspectWorkspaceOverview`)                                                   | `read_workspace_context`, origination seed context, `agents/contexts/data-model/workspace/workspace-context.ts`                   | Session-side composition over graph specs and canonical session files. Same no-wrapper rationale as `cwd_inventory`: the source shape is already the consumer shape.                   |
| `workspace_session_state` | `WorkspaceSessionCoordinator` (`WorkspaceSessionState`)                                                        | `projections/workspace/workspace-state.ts`, `chromeStateForWorkspace`, app/rpc/web workspace flows                                | Source union owned by the coordinator. Downstream code may flatten it, but the coordinator remains the authority for the narrow chrome snapshot and status-variant field set.          |
| `agent_runtime_vocab`     | `schema/kinds.ts`, `schema/tool-names.ts`                                                                      | `runtime-state.ts`, `agents/runtime/`, `.pi/extensions/agent-runtime/`                                                            | Pure vocabulary leaf for operational modes, agent-role ids, and shared Brunch tool-name constants; imports nothing and mirrors D73-L's graph taxonomy direction on the session side.   |
| `agent_runtime_state`     | `latestValidBrunchAgentStateEntryData` and transcript-backed runtime-state facts in `session/runtime-state.ts` | `projections/session/runtime-state.ts`, `agents/runtime/`, `.pi/extensions/agent-runtime/`                                        | Transcript-backed source read. Public projections report operational mode and derived role only; stale legacy fields are ignored on read.                                             |

## Runtime posture coverage ledger

Live runtime posture is operational-mode keyed. `session.runtimeState` reports
mode and derived role, plus mention/world/lifecycle facts. Anything more specific
belongs to product exchange state or prompt-resource behavior, not transcript
runtime state.

| Row                         | Canonical owner                                         | Agent    | RPC      | Web      | Reason for deferred                                                       |
| --------------------------- | ------------------------------------------------------- | -------- | -------- | -------- | ------------------------------------------------------------------------- |
| `operational_mode.selection`| `session/runtime-state.ts`                              | required | required | required | —                                                                         |
| `foreground_role.derived`   | `projections/session/runtime-state.ts`                  | required | required | required | Role is derived from mode; it is not a second independently switched axis. |
| `active-review-set`         | product-state-gated review-cycle surface                | deferred | deferred | deferred | Needs current review-set product state; not derivable from runtime state. |
| `turn-exchange-surface`     | product-state-gated structured-exchange surface         | deferred | deferred | deferred | Needs current turn/exchange state; not derivable from runtime state alone. |

## Does NOT own

- Cwd project identity, pure cwd inventory, and `.brunch/workspace.json` persistence — those live in `workspace/`.
- Graph state, CommandExecutor, graph queries — those live in `graph/`.
- Prompt composition and pushed seed context building — those live in `agents/runtime/` and `agents/contexts/seeds/`, adapted by `.pi/extensions/agent-runtime/system-prompts/`.
- Pi extension registration — those live in `.pi/extensions/`.

## Imported by

- `agents/contexts/seeds/` — for agent-visible per-turn and origination seed text.
- `.pi/extensions/brunch-data/context/` — for direct workspace overview reads; pure cwd inventory comes from `workspace/`.
- `projections/session/` — for reusable transcript-context DTO projection.
- `projections/workspace/` — for reusable workspace-state DTO projection.
- `transcript-markdown.ts` — for debug transcript markdown rendering beside the session transcript utilities.
- `agents/contexts/data-model/workspace/` — for workspace inventory / overview agent-context text over source session read shapes.
- `rpc/` — for session.* and workspace.* RPC handlers.
- `.pi/extensions/` — for session lifecycle hooks.

## Moved from src/ root

These files migrated here on 2026-06-02:

| File                               | Session concern                                             |
| ---------------------------------- | ----------------------------------------------------------- |
| `workspace-session-coordinator.ts` | boot, spec/session selection                                |
| `session-binding.ts`               | session↔spec binding                                        |
| `brunch-session-envelope.ts`       | session envelope reader                                     |
| `session-projection-reader.ts`     | JSONL projection target resolution                          |
| `session-transcript.ts`            | transcript row projection                                   |
| `transcript-markdown.ts`           | debug transcript markdown text                              |
| `exchange-projection.ts`           | exchange extraction                                         |
| `runtime-state.ts`                 | runtime-state transcript entries                            |
| `structured-exchange.ts`           | structured exchange schemas/types                           |
| `structured-exchange-loop.ts`      | pending-exchange read path + response-side synthetic pairs  |
| `flush-session-manager.ts`         | the one named reliance on pi's private session-file rewrite |
