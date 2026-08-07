# session/ — Session domain layer

SPEC decisions: D6-L, D11-L, D12-L, D13-L, D21-L, D27-L, D40-L, D52-L, D76-L, D77-L, D78-L, D84-L, D98-L, D101-L, D102-L, D109-L, D118-L, D125-L, D132-L, D133-L, I15-L, I56-L, I64-L, I65-L, I66-L

## Owns

Projection of Brunch's session semantics out of Pi's JSONL substrate,
plus the coordination logic for workspace/spec/session lifecycle.

- **Transcript projection** — reading Pi JSONL, projecting Brunch-relevant
  structure (assistant/user rows, custom entries, tool results).

- **Active-session-branch contract** (D24-L, I19-L) — current Brunch product
  state means Pi's active root-to-leaf branch, not append order. Live callers
  must use `SessionManager.getBranch()`; file-backed callers must open through
  Pi's `SessionManager` and then use its branch/header APIs. Full-tree or
  append-order reads are legal only for explicitly named history/diagnostic
  surfaces. `active-session-branch.ts` is the canonical file-backed adapter:
  it opens through Pi and returns `getHeader()` plus `getBranch()`; the session
  envelope, canonical inventory, default transcript rendering, and exchange/RPC
  projections consume that seam. Production reader regrowth is guarded by
  `__tests__/active-branch-reader-inventory.test.ts`, whose exact diagnostic
  allow-list preserves only purpose-named artifact/history readers.

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
  helpers, mirroring `runtime-state.ts`'s fold pattern exactly (latest-snapshot-wins
  over the active session branch, never runtime-state fields or tool-result
  `details`). The fold is branch-correct because its live callers now supply
  `SessionManager.getBranch()`; abandoned-branch rivals cover the live-consumer
  family.
  Foreground context seeds,
  the `read_elicitation_scratchpad` / `update_elicitation_scratchpad` tools, and
  subagent world snapshots all read the same fold. It never becomes canonical
  graph truth by projection side effect.

- **Elicitation style and process-move carriers** (`elicitation-style.ts`, `process-move.ts`) — D98-L/D109-L use two disjoint active-branch custom entries. `brunch.elicitation_style` is last-valid-entry-wins across kicks and accepts only `interrogate | disambiguate | propose`; every Specify prompt projects it without changing role, authority, capability, or target plane. `brunch.process_move` accepts only `move_to_execution | prepare_execution | compile_plan | execute_plan` and is fresh only after the latest `brunch.kick`, so the next kick consumes it. Escape/timeout has no carrier. `originate-assistant-turn.ts` renders only a fresh process move into the seed; persistent style belongs to foreground prompt composition. The retired mixed carrier has no parser or compatibility path. Pi-facing menu and juncture choreography remains in `.pi/extensions/session-orientation/`. The cross-control ownership and lifetime map is canonical in [`agents/runtime/elicitor/TOPOLOGY.md`](../agents/runtime/elicitor/TOPOLOGY.md#control-ownership).

- **Review-set settlement** (`review-set-settlement.ts`, D27-L/I15-L) — the shared local/RPC response authority. It revalidates the exact persisted `present_review_set`, translates that reviewed payload into one mutation, and commits approval once through `CommandExecutor.acceptReviewSet`; the operation, spec-local LSN, and single change-log row are the durable acceptance record. Only then does it pass the exact successful `MutateGraphSuccess` into the request projector and construct the validated receipt-bearing terminal; adapters retain only their distinct Pi-owned vs Brunch-owned append mechanics. Required per-node and per-edge settlement is preserved through that same approval without a post-approval mutation.

- **Live-session host fan-out** (`live-session-host.ts`, D132-L/D141-L/I64-L) — owns target-addressed runtime cells and one host-lifetime `subscribeAll` observer set for standalone web. Every cell dispatches semantic deltas through that set, including cells opened after subscription and reopened targets; sequence numbers remain contiguous within an open epoch and restart at zero after close/reopen. RPC owns wire validation and method naming. D141-L does not make this module the TUI runtime inventory: normal TUI keeps its real `InteractiveMode` runtime and must adapt that exact session into the same semantic projection/RPC contracts. The active arc now acquires fail-closed per-target filesystem writer authority before either composition constructs a runtime. `session-writer-guard.ts` never steals stale-looking locks; normal disposal and construction failure release them, and `app/brunch-tui.ts` adds a synchronous `process.on('exit')` release because Pi's `InteractiveMode` ends interactive quits with `process.exit(0)` without running disposal. `tui-live-session-adapter.ts` adapts the exact `InteractiveMode`-owned session and live ask registry into the same target-addressed semantic host contract without owning or disposing that runtime. The later cutover retires the raw TUI relay without growing a third host abstraction.

- **Structured-exchange loop helpers** — deterministic POC exchange generation,
  pending prompt reconstruction from structured transcript tuples, response
  toolResult materialization, and the process-local live answer rendezvous used
  by live TUI-sidecar and standalone-host drivers (`live-exchange-broker.ts`). RPC maps these domain results
  to JSON-RPC status and error codes; transcript mechanics stay here. The **live
  ask registry** (`live-ask-registry.ts`, D125-L) is the single runtime source of
  open-ask truth: it generalizes the broker's in-flight `pending` map into
  observable open-ask state that also carries each ask's D116-L question payload
  keyed by exchange id (`open` → `answered` | `cancelled` | `closed`). Every ask
  mode registers at open time via the payload-carrying `opener`, which requires
  the executing tool's abort signal. An already-aborted signal never exposes an
  open ask; a later abort synchronously removes it, records `cancelled`, and
  resolves the collector without an answer. Answer, explicit cancellation, and
  abort all detach the listener at settlement. `session.openAsks` therefore
  discovers only live asks without scanning the transcript; the answer still
  arrives through the string `awaitAnswer`/`submitAnswer` contract and reduces
  to canonical `ask` details
  (plus preserved choice/review detail variants). Questionnaire mode checks a
  schema-tagged JSON answer envelope against the open ask's fixed questions
  before resolving the rendezvous; other per-mode interpretation remains in the
  ask collection path. In-memory and process-local by design: a stale/unknown exchange id reads
  `closed`, never hangs. See
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
  provider-legality toolCall pair); external callers import only the root. The pending shape distinguishes `present_review_set` review decisions from `present_digest` conversational feedback. Review-set approval may commit graph drafts; digest feedback cannot. A later runtime-resolved digest questionnaire/confirmation mints the sole accepted-abstract carrier for downstream capture.

- **Workspace coordination** — boot flow and spec/session selection over the
  workspace-owned `.brunch/workspace.json` state store. The
  `WorkspaceSessionCoordinator` is the only module that creates/opens Pi
  sessions for Brunch user flows
  and writes collapsed `brunch.session_binding` entries (`{schemaVersion,
  specId}`). Its chrome state is a selection snapshot (`cwd`, optional
  project discovered by `workspace/project-identity.ts`, selected spec identity
  `{id, title}` projected from the complete coordinator spec state) and
  intentionally carries no posture, readiness-phase, or chat-mode display fields.
  Its private `workspace-session-coordinator/` subtree owns coordinator-shaped
  session-file/probe helpers such as canonical session-file classification;
  external callers import only the public root module. `WorkspaceLaunchInventory`
  requires `workspacePopulated` (complete gitignore-visible file evidence beyond
  `.brunch/`, via `workspace/cwd-inventory.ts`, without widening topology
  children) — the D118-L establishment branch signal, distinct from the
  `.brunch/workspace.json` posture stub below.

- **Spec-posture establishment** (`spec-establishment.ts`, D118-L) — the pure
  deterministic branching over cwd-populated state and current posture shared
  by spec creation (posture starts unestablished) and spec resume (never
  re-asked once `origin` is set). Lives here rather than under
  `.pi/components/workspace-dialog/` (that seam's tentative home) because
  `src/.pi/components/TOPOLOGY.md`'s dependency direction only allows
  components to import session/, never the reverse, and both the dialog
  (create) and the coordinator (resume) need it. Spec posture itself
  (`kind`/`origin`/`relatesToSpecId`) is spec-row state owned by `db/` and
  read into required `WorkspaceSpecState` fields via `CommandExecutor.getSpec`
  (`origin` and `relatesToSpecId` remain nullable where the graph domain permits);
  this module decides *whether to ask*, never persists.

- **Targeted live-session hosting** (`live-session-host.ts`) — a cwd-process-local map keyed by durable `(specId, sessionId)`, with one writable runtime and driver owner per target, target-local prompt admission, ask answering, semantic event sequencing, and fail-loud active-turn disposal. Host disposal first settles every in-flight open; a runtime that resolves after disposal begins is disposed immediately rather than registered, so disposal leaves no orphaned cells. `WorkspaceSessionCoordinator.openTargetSession` and target-spec replacement binding open that exact session without reading or mutating workspace defaults; route/connection identities never substitute for the target. `src/dev/__tests__/standalone-web-session-host.concurrency.test.ts` validates two simultaneous production-wired targets: overlapping asks/graph writes, target-local events and driver rivals, isolated failure/recovery, reconnect, separate JSONL, and shared graph changes delivered only through `worldUpdate`. Distinct production candidate/review-set/digest witnesses in `standalone-web-session-host.real-entry.test.ts` prove settlement/reconnect convergence, including the exact receipt-bearing review terminal.

- **Session binding** — session↔spec binding entries in JSONL.

- **Session envelope** — canonical session envelope reader (spec/session pair).
  It consumes `active-session-branch.ts`, validates exactly one binding on the
  active path, and accepts Pi-valid `parentSession`, `branch_summary`, and sibling
  trees without a second Brunch tree parser.

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
  2026-06-12; the deterministic offer was a pre-elicitation-gaps fossil whose
  only surviving remnant is the permutation *script* in
  `probes/deterministic-exchange-script.ts` — probe-land sequencing, consumed
  by `__tests__/structured-exchange-loop.test.ts`. Nothing in the repo mints a
  `present_*` pair from it: FE-1187 rewired the R24 parity probe to fabricate
  its own pair in the active `present_candidates` grammar, and FE-1311 deleted
  the orphaned synthetic-pair writers). The LLM
  turn completing a 'start' decision is fired by the launch path after session
  creation via `session.sendCustomMessage(kickTurnMessage(origin), { triggerTurn: true })`,
  guarded on model availability (unauthenticated launches idle); completion
  returns a classified `KickCompletionOutcome` (`fired`, `skipped`, or `failed`)
  so callers distinguish a provider turn from an attempted origination. The assistant
  authors the opening live, typically via real `present_*`/`ask` tool
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
| `agent_runtime_vocab`     | `schema/kinds.ts`, `schema/tool-names.ts`                                                                      | `runtime-state.ts`, `agents/runtime/`, `.pi/extensions/agent-runtime/`, `.pi/extensions/executor/`, `executor/run-execution-authority.ts` | Pure vocabulary leaf for operational modes, agent-role ids, shared Brunch tool-name constants, and the `BrunchExecuteToolName` roster union that keys executor run-mutation classification; imports nothing and mirrors D73-L's graph taxonomy direction on the session side. |
| `agent_runtime_state`     | `latestValidBrunchAgentStateEntryData` and transcript-backed runtime-state facts in `session/runtime-state.ts` | `projections/session/runtime-state.ts`, `agents/runtime/`, `.pi/extensions/agent-runtime/`                                        | Transcript-backed source read. Public projections report operational mode and derived role only; stale legacy fields are ignored on read.                                             |

## Runtime posture coverage ledger

Live runtime posture is operational-mode keyed. `session.runtimeState` reports
mode and derived role, plus mention/world/lifecycle facts. Anything more specific
belongs to product exchange state or prompt-resource behavior, not transcript
runtime state.

Distinct from **spec posture** (D118-L: `origin`/confirmed `kind`/
`relatesToSpecId`) below — spec posture is spec-row state owned by `db/`, not
runtime/transcript state, and is out of scope for this ledger. It is also
distinct from the workspace-level posture stub in `.brunch/workspace.json`
(`WorkspacePostureState`, unchanged), which stays owned by `workspace/`.

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
