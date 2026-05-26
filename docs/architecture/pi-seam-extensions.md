# Brunch POC — Pi Seam Extensions

This is a sibling document to [prd.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md). It captures four architectural extensions to the POC that drill into how specific Brunch product affordances land on pi's existing seams. The PRD asserts that pi can be used as an internal harness without forcing Brunch to become a pi distribution; this document checks that claim against four concrete affordances and records where Brunch owns work that pi does not provide.

The four affordances:

1. Async "side-chain" sub-agents whose results return at a later turn boundary.
2. Switchable lenses / strategies for the primary interviewing agent.
3. A TUI spec selector for opening or switching between specifications.
4. An assistant-/system-offer-first interaction model with multi-choice answers.

For each one this document records the pi seams it relies on, the Brunch-owned work it forces, and the residual risks.

## Conventions

- "Pi seam" means an existing public API in `@earendil-works/pi-agent-core` or `@earendil-works/pi-coding-agent` that Brunch can call without modifying pi.
- "Brunch-owned" means a module that lives inside the Brunch host and is not provided by pi.
- All custom-message types in this document use the `brunch.*` prefix to keep the Brunch product namespace distinct from pi's own custom entries.

## 1. Async side-chain sub-agents

### Need

The PRD already commits to treating turns as snapshot-oriented reasoning units and surfacing external graph divergence at the next turn boundary via `worldUpdate`. Brunch also needs to be able to dispatch non-blocking inference work *during* a primary-agent turn — for example, an oracle-side analysis or a candidate-proposal expansion — whose result must reach the primary agent on a later turn without disturbing the active turn.

### Pi seams used

- `prepareNextTurn` on `pi-agent-core`'s agent loop. The agent loop already calls `config.prepareNextTurn?.(nextTurnContext)` between turns. This is the sanctioned injection point for `worldUpdate` and is reusable as the side-chain delivery point.
- `pi.sendMessage(...)` and `pi.appendEntry(...)` with `deliverAs: "nextTurn"`. The coding-agent session already supports queueing a custom message for the next turn rather than steering the active one.
- A second, headless `createAgentSessionServices` plus session-runtime instance constructed inside a Brunch tool or background worker, with its own model, tools, and prompt. Nothing in pi prevents this; the harness is just a class.

### Brunch-owned work

Pi does not have a first-class "spawn child agent, attach to parent turn" concept. Brunch owns the bookkeeping:

- A `SideTaskRegistry` durable record keyed by parent turn id with status (`pending`, `running`, `succeeded`, `failed`, `cancelled`), originating lens, expected result shape, and an optional graph-revision watermark.
- A `SideTaskRunner` that wraps the headless agent invocation, persists raw payloads through the same transcript substrate as the primary agent, and emits a `brunch.side_task_result` custom message into the side-task record when the task completes.
- A `prepareNextTurn` hook owned by Brunch that, in addition to `worldUpdate`, drains any `succeeded` side-task results whose parent turn lineage matches the current session and injects them as custom messages before the next model call.

### Posture

- Mid-turn cancellation of side tasks is allowed but mid-turn delivery is not. Results always wait for the next turn boundary, consistent with the PRD's accept-and-flag stance.
- Side tasks must mutate durable Brunch state only through the shared command layer described in the PRD's "One shared mutation surface" decision. They are not a bypass for graph writes.
- Side-task attribution is its own authority tier: writes made by a side task are attributed to the parent turn but tagged with the side-task id so the user can trace which lens or expansion produced them.

### Residual risks

- Pi has no "wait for next turn boundary" primitive the registry can subscribe to natively. Brunch must wire the registry into `prepareNextTurn` itself rather than relying on a pi-side scheduler.
- Long-running side tasks risk crossing a compaction boundary; their results must therefore carry enough graph context to remain interpretable after compaction. This couples the registry to the coherence-anchor work in the PRD's compaction section.

## 2. Switchable lenses for the primary agent

### Need

The interviewing agent should be able to operate under several elicitation strategies — for example "design-tree", "ambiguity-explore", "candidate-proposal" — as well as analytical lenses tied to graph planes — "intent", "design", "oracles", "plan". A lens is a coherent bundle of system-prompt orientation, active tools, and message projections, not just a prompt swap.

### Pi seams used

- `before_agent_start` event whose result may include `systemPrompt`. Multiple extensions chain, so a lens-extension can layer over the Brunch base prompt without owning the whole assembly.
- `context` event whose result may include rewritten `messages`. This is the sanctioned place for a lens to project history differently — for example hiding earlier candidate-proposal output during an ambiguity-explore pass.
- `pi.setActiveTools(toolNames)` to swap the tool subset per lens.
- `pi.registerCommand(...)` for `/lens design-tree`, `/lens intent`, etc., and `pi.registerMessageRenderer(...)` for lens-specific custom messages.
- `ExtensionUIContext.select` (or a Brunch-owned multi-select overlay) for a `/lens` picker UI.

### Brunch-owned work

- A `LensBundle` abstraction: `{ id, systemPromptFragment, activeTools, contextProjection?, customRenderers?, allowedSideTasks? }`.
- A `LensRegistry` holding the loaded bundles and the currently active bundle for each session.
- A persistent `brunch.lens_switch` custom entry written at every switch so resume and compaction preserve which lens was active when which messages were produced.
- A `prepareNextTurn` participation point so a lens switch that happens between turns can re-render the system prompt and tool roster before the next model call.

### Posture

- Lenses are Brunch policy bundles, not pi extensions. A lens may register pi extensions internally, but the lens itself is a Brunch concept and the user-facing surface is `/lens`, not pi's extension model.
- Switching lenses mid-turn is disallowed. Switches take effect at the next turn boundary so the model's reasoning context remains coherent within a turn.
- The active lens is part of the session's interest state for cross-session detection purposes: a lens switch may widen or narrow the session's interest set against the graph.

### Residual risks

- Pi extensions registered by a lens cannot be cleanly unregistered today without `/reload`. Brunch must therefore keep lens-owned tool sets registered once and use `setActiveTools` to gate availability rather than registering and unregistering tools per switch.
- A lens that aggressively rewrites `context` can violate the PRD's "single sanctioned place" rule if multiple lenses also do so. Brunch should enforce one Brunch-owned `context` participant that delegates to the active lens, not many independent ones.

## 3. TUI spec selector and spec switching

### Need

A user should be able to open a Brunch TUI and pick which specification to work on, or switch between specifications mid-session. The PRD already commits to graph-native spec workspace planes and to `.brunch/` as the local product state root, but it does not yet pin down spec-level identity or how spec switching interacts with sessions.

### Workspace state hierarchy

Brunch operates over a three-level hierarchy. Each level scopes the one below it, and at any moment the TUI has exactly one selection in each level:

```
cwd     (current project — pi/process scope)
└── spec    (specification belonging to the project; survives `/new`)
    └── session   (chat belonging to the specification)
```

Implications:

- The spec selector is **gated before everything else**. On launch, if no spec is bound to the cwd or none has been chosen for this process, the TUI opens directly into `SpecSelectorComponent` and no agent loop runs until a spec is selected.
- The selected spec is **durable across `/new`**. A pi-level new-session reset (`switchSession` to a fresh session file) inside the same spec must preserve `current_spec_id`; spec change is only allowed via an explicit re-invocation of the selector overlay.
- Spec selection state is persisted under `.brunch/state.json` (or equivalent) keyed by cwd, so re-opening the TUI on the same project resumes the last spec without re-prompting.
- Changing the spec requires re-invoking the selector UI; there is no slash command that silently switches spec, because spec-switch always emits a `brunch.spec_switch` custom entry through the command layer (see §3 Brunch-owned work).

### Pi seams used

- `pi-tui` plus the `SessionSelectorComponent` pattern in `cli/session-picker.ts`. The selector is replaceable: same `TUI` + `setKeybindings` + `addChild` + `setFocus` sequence, swapping the inner component for a `SpecSelectorComponent`.
- `ExtensionCommandContext.switchSession(sessionPath, { withSession })` for the case where each spec is bound to its own session file. This is the supported teardown-and-rebuild path.
- `ExtensionUIContext.custom<T>(...)` for mounting a spec picker as an overlay inside an interactive session, so spec-switching does not require leaving the agent loop.

### Brunch-owned work

- A `SpecRegistry` over `.brunch/` that enumerates the specs in the workspace, where a spec is identified by its intent-graph root and carries display metadata (name, last activity, current coherence verdict).
- A `SpecSelectorComponent` modeled on `SessionSelectorComponent` but reading from `SpecRegistry` rather than `SessionManager`.
- A `SpecBinding` decision per spec: either (a) one session per spec, in which case spec switching uses `switchSession`, or (b) one shared session across specs with lens-style framing handling spec scope.
- A persistent `brunch.spec_switch` custom entry, mirroring `brunch.lens_switch`, so resume reconstructs which spec was active at each point in the transcript.
- A persistent **TUI status line / chrome region** that displays four facts at all times, regardless of which overlay is active: current `cwd` (project), current `spec` (id + short title), current `phase`/`stage` for that spec, current `chat-mode` (e.g. `interview`, `clarify`, `oracle-lens-active`). The chrome region is owned by Brunch on top of `pi-tui`'s root layout and is not consumed by transient overlays. Selector overlays, offer overlays, and confirmation dialogs render above the chrome but do not occlude it.

### Posture

- The POC should prefer one-session-per-spec for simplicity. Shared-session-multi-spec can be a later refinement once lens machinery is proven.
- Spec switching always runs through the shared command layer, even in the TUI: the selector emits a `spec.switch` command rather than mutating session state directly.
- A spec switch may legitimately invalidate the active lens (an oracle lens on spec A is not meaningful on spec B). The Brunch host owns the validation and either preserves, downgrades, or resets the lens on switch.

### Residual risks

- Pi's `SessionManager` is one-directory-per-process. If the POC needs spec-roots outside `.brunch/sessions/`, Brunch must either reconfigure `SessionManager.create(cwd, customDir)` per spec or maintain its own indirection layer above pi's session resolution. This couples directly to the JSONL viability proof in M2.
- The selector overlay competes with other overlays (model picker, confirmation dialogs). Brunch must own a small overlay-priority policy so a spec switch does not stomp an in-flight confirmation.

## 4. Assistant- and system-offer-first interaction with multi-choice answers

### Need

Every Brunch session should open with a concrete action or answer surface rather than an empty prompt. The user should always be able to either choose from offered actions or answer an offered question, where answers may be single-choice, multi-choice, or freeform-plus-choice. This is a product stance: Brunch is a guided-elicitation product, not an open chat.

### Pi seams used

- `pi.registerMessageRenderer(customType, renderer)` for rendering a Brunch offer envelope inline in the transcript across TUI, web, and RPC.
- `pi.sendMessage(...)` and `pi.appendEntry(...)` with `deliverAs: "followUp"` for posting the user's selection back into the active turn without inventing a new transport.
- `ExtensionUIContext.select`, `confirm`, `input` for the simple cases.
- `ExtensionUIContext.custom<T>(...)` for the multi-select and freeform-plus-choice cases. The API is generic on `T`, so a multi-select overlay legitimately returns `string[]`.
- The RPC mode's `extension_ui_request` channel for routing the same UI requests to the web client.

### Brunch-owned work

- A `brunch.offer` custom-message envelope: `{ kind: "actions" | "question", prompt?, options: [{ id, label, value }], multi: boolean, freeform: boolean, allowSkip: boolean, expiresOn?: TurnId | Timestamp, captureHint?: TurnCaptureHint }`.
- A `brunch.offer_response` custom-message envelope with the user's selection, freeform text, or skip outcome.
- A single Brunch-owned renderer for `brunch.offer` per mode: TUI overlay, web component, RPC `extension_ui_request` extension method.
- A `MultiSelectOverlay` component built once on `pi-tui` primitives, returning `string[]`. The same overlay machinery covers both interaction shapes: a **radio** variant (`multi: false`, exactly one selection enforced) and a **checkbox** variant (`multi: true`, any subset including empty if `allowSkip: true`). These are not separate overlays; the visual affordance (`◉ / ◯` vs `☑ / ☐`) is driven by the `multi` field on `brunch.offer`. Keybindings, freeform-plus-choice composition, and `expiresOn` handling are identical across the two variants.
- A `session_start` hook that synthesizes an initial offer when no transcript history exists, so every fresh session opens with a surface.
- A protocol extension to the RPC `extension_ui_request` family for `multiSelect` and `freeformWithChoice`, with a corresponding web client implementation. This is additive, not a replacement.

### Capture-aware offer envelope

The `captureHint` field on `brunch.offer` is a **private side-channel** the interviewer attaches to substantive questions so the observer (the graph-capture pass that processes the user's response) has explicit priors instead of free-associating over the whole graph. The hint is invisible to the user but visible in the transcript.

```ts
type TurnCaptureHint = {
  expectedKinds: IntentKind[];         // kinds the response is likely to produce
  candidateRelations?: RelationKind[]; // edges the response may motivate
  targetItems?: NodeRef[];             // graph items the question is about
  captureMode:
    | 'new_item'
    | 'clarify_existing'
    | 'choose_option'
    | 'rank_priority'
    | 'resolve_need'
    | 'provide_example';
  resolvesNeedId?: string;             // reconciliation_need this offer is resolving
  options?: Array<{
    label: string;                     // mirrors the user-visible option label
    mapsTo?: {
      nodeKind?: IntentKind;
      relationKind?: RelationKind;
      targetRef?: NodeRef;
      framingAs?: string;              // see Product-framing modality
    };
  }>;
};
```

The observer treats hints as priors, not commands. The user retains escape hatches (`allowSkip`, freeform) and the observer's abstention rule still applies — if the response does not match any hint, the observer may emit zero mutations rather than force a fit.

### Posture

- The offer envelope is durable transcript truth, not ephemeral UI state. Selections are written back as custom messages so the agent can reason over them on the next turn and the transcript reload faithfully reproduces what was offered and what was chosen.
- The agent is allowed to refuse to chat without an offer. The Brunch system prompt should require the agent to either produce an offer or emit `brunch.needs_human` for cases the agent cannot resolve.
- In print mode an offer either resolves via an explicit auto-policy or returns a structured `needs_human` outcome. It does not block.
- Multi-choice answers are first-class. Single-choice is a degenerate multi-choice with `multi: false`.
- Capture hints are advisory. The observer must abstain rather than force a graph mutation when the user's response does not match the hint.

### Residual risks

- The offer envelope risks being treated as a replacement for the LLM's natural narrative. Brunch should keep offers as the *interaction* surface while the assistant's prose remains the *explanation* surface. A lens that bypasses offers is allowed only for explicitly free-chat moments.
- Pi's RPC `extension_ui_request` types are currently fixed. Adding `multiSelect` and `freeformWithChoice` is a Brunch-side protocol extension that the web client must agree on; this is small but non-zero coupling that should be tracked.

## 5. Graph-entity mentions and mention staleness

### Need

The user (and the agent, on the user's behalf) should be able to refer to graph entities directly inside chat input using a `#` mention. Mentions must resolve to a stable graph identity, must persist in the transcript, and — crucially — must participate in Brunch's staleness-detection so that the agent does not silently reuse a now-stale snapshot of an entity that has been mutated since it was last read.

### Pi seams used

- `ctx.ui.addAutocompleteProvider((current) => ...)` over Pi's prompt editor. The autocomplete item's `value` is inserted into the editor; Pi does not persist hidden autocomplete metadata.
- `before_agent_start` system-prompt injection for teaching the active agent how to interpret Brunch `#` handles and when to call a lookup/re-read tool. The inserted handle is just transcript text unless Brunch adds a later parser/indexer.
- Brunch custom transcript entries (`pi.appendEntry`, `pi.registerMessageRenderer`) for future mention ledger/staleness records and resolved entity snapshots; these are separate from the autocomplete insertion itself.
- `prepareNextTurn` for injecting mention-staleness hints into the agent's next-turn context, alongside the existing `worldUpdate` flow.
- The reconciliation-need substrate and global LSN (see §Reconciliation-need substrate and §Graph clock) for comparing the LSN at which a mention was last *snapshotted into the model's working context* against the entity's current LSN.

### Brunch-owned work

- A `#` autocomplete provider sourced from `SpecRegistry` + current spec's graph index. It may search current titles and descriptions, but the inserted `value` must be a stable handle such as `#A12` or `#<node-id>`; popup `label`/`description` are UI-only and are not session metadata.
- A Brunch mention indexer that parses user/assistant text for stable `#` handles after input and resolves them to `{ id: NodeId, title_at_mention: string, lsn_at_mention: number }` for the session mention ledger. This parsing/indexing step, not Pi autocomplete, is what creates structured mention state.
- A graph lookup/re-read tool (for example `brunch.entity_reread`) whose prompt guidance tells the agent to resolve `#A12` by passing the handle without the `#` when deeper entity detail matters.
- A `SessionMentionLedger` in the session-scoped state: for each `id` ever mentioned in this session, the highest `snapshotted_lsn` — i.e. the LSN at which the agent most recently received the full entity payload (either via initial context, a `worldUpdate` cascade, or an explicit re-read tool call). The ledger persists with the session and survives compaction.
- A staleness check executed during `prepareNextTurn`:
  1. Walk the session's `SessionMentionLedger`.
  2. For every entry where the entity's current LSN > `snapshotted_lsn`, the entity is **stale-in-context** for this session.
  3. Brunch synthesizes a `brunch.mention_staleness_hint` entry (custom message, `deliverAs: "nextTurn"`) summarising the stale set. The hint is **discretionary advice to the agent**, not a forced re-read: it tells the agent "if you intend to reason over `#foo` again, re-read it; the snapshot you have is from LSN 412, current is LSN 487."
  4. The agent decides whether to invoke a re-read tool (which then updates `snapshotted_lsn`) or to proceed with the existing snapshot, accepting the staleness.
- A `brunch.entity_reread` command/tool (through the shared command layer) that re-snapshots a named entity and updates `snapshotted_lsn` to the LSN observed at re-read.

### Posture

- Mentions are anchored to stable handles/IDs, never to titles. Title-based autocomplete is a UX affordance only; the transcript persists the inserted textual handle, not the popup label/description.
- The mention ledger is **session-scoped**, not transcript-scoped: the question "what has this agent seen at what LSN" is a per-session model-context question, and crossing sessions (via `switchSession`) legitimately resets it.
- Staleness hints are **discretionary**. The agent's autonomy over its own context is preserved; Brunch merely surfaces the gap. The product stance is that re-read is cheap and worth doing when in doubt, but the framework does not mandate it.
- Staleness hints reuse the same `worldUpdate` machinery and the same global LSN as the rest of the change-log / reconciliation substrate; this is not a parallel staleness mechanism.

### Residual risks

- The session mention ledger can grow unbounded across very long sessions. A simple cap (most-recent N mentions, or LRU eviction at compaction time) is acceptable for the POC; the cost of an occasional missed staleness hint is bounded by the agent's own re-read judgment.
- Title-based autocomplete is convenient but risks anchoring to volatile labels. The insertion-time rewrite to ID-anchored mention is non-negotiable; without it, renames silently break references.
- The staleness check competes for next-turn context budget with `worldUpdate` summaries and offers. Brunch should treat staleness hints as compactly-rendered (one line per stale entity, capped) rather than dumping diffs.

## Cross-cutting consequences

The five affordances together imply a small Brunch-owned subsystem cluster that the PRD's "Brunch host" box should be understood to contain:

- `SideTaskRegistry` and `SideTaskRunner`.
- `LensRegistry` and `LensBundle`.
- `SpecRegistry` and `SpecSelectorComponent`.
- `OfferEnvelope`, `OfferRenderer` per mode, and `MultiSelectOverlay`.
- `MentionAutocompleteOverlay`, `SessionMentionLedger`, and the staleness-hint synthesiser in `prepareNextTurn`.

All five subsystems route their durable effects through the same shared command layer described in the PRD. None of them require modifying pi.

The custom-message + `deliverAs: "nextTurn" | "followUp"` + `prepareNextTurn` triad turns out to be load-bearing for Brunch's product semantics. It is what allows offers, side-chain results, world updates, and lens switches to all be expressed in one substrate without inventing a second event plane.

## Milestone implications

These extensions do not require new milestones, but they sharpen the existing ones:

- **M0** should already prove the Brunch system prompt and curated toolset land cleanly; the lens model is built on the same surface and should be sketched but not built here.
- **M3** (web shell) should treat the offer envelope as a first-class transport requirement, not a later UI polish item.
- **M5** (agent ↔ graph integration) must already route through the shared command layer side tasks will also use; the side-task registry can be added in the same milestone if the registry is small.
- **M7** (detection, relevance, turn-boundary reconciliation) is the natural home for the `SideTaskRegistry` drain step and for the `brunch.spec_switch` interest-set rebinding.
- **M9** (compaction-aware continuity) must preserve lens identity, active spec, and any in-flight side tasks across compaction.

## Graph clock, change log, and command-layer invariant

The PRD asserts that every durable graph mutation advances a monotonic graph revision via a graph clock and appends to a change log, that writes carry optimistic concurrency information such as `ifVersion`, and that all graph mutations route through one Brunch-owned command layer. This section pins down the mechanics, the ORM choice, and the consistency invariant the rest of the system depends on.

### The non-negotiable invariant

**The graph clock and change log must remain absolutely consistent.** Every durable mutation to spec-workspace graph state must:

1. Advance the graph clock by exactly one LSN per commit.
2. Append change-log entries tagged with that LSN inside the same SQLite transaction as the data writes.
3. Carry per-entity optimistic concurrency information so concurrent writers see explicit conflicts rather than lost updates.

Any code path that mutates graph state without participating in this protocol is a defect, not a feature. There is no escape hatch, no "internal-only" write path, no maintenance script that bypasses the command layer. Schema migrations that move data must themselves allocate LSNs and emit change-log entries.

### ORM: Drizzle

Brunch will use Drizzle on top of `better-sqlite3` for graph persistence. The reasoning:

- Drizzle keeps SQL explicit; the LSN-bump and change-log insert remain visible in the command-layer code rather than hidden in middleware.
- Drizzle supports `RETURNING` clauses, which makes the single-statement LSN bump (`UPDATE graph_clock SET lsn = lsn + 1 WHERE id = 1 RETURNING lsn`) idiomatic.
- Drizzle's transaction API gives the command layer one explicit boundary inside which all of (precondition check, entity writes, version bumps, LSN allocation, change-log insert) must happen.
- Drizzle has no built-in change-tracking middleware competing with this scheme, unlike ORMs that try to provide "automatic audit trails."

ORMs that promise automatic change tracking (Prisma middleware, TypeORM subscribers, sequelize hooks) are explicitly rejected for this layer. Their hooks run at the wrong time relative to LSN allocation and would create a second, weaker mutation path the command layer cannot enforce.

### Single LSN per commit

A commit is the unit of advance, not a row. The shape:

- A `graph_clock` table with a single row carrying the current `lsn` value.
- Each transaction allocates exactly one LSN via `UPDATE graph_clock SET lsn = lsn + 1 RETURNING lsn`.
- A `change_log` table keyed by `(lsn, seq)` where `seq` orders multiple ops within the same commit.
- Every entity row carries `version INTEGER NOT NULL` for optimistic concurrency, separate from the LSN.

Schema sketch:

```sql
CREATE TABLE graph_clock (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  lsn     INTEGER NOT NULL
);
INSERT INTO graph_clock (id, lsn) VALUES (1, 0);

CREATE TABLE change_log (
  lsn         INTEGER NOT NULL,
  seq         INTEGER NOT NULL,
  ts          INTEGER NOT NULL,
  actor       TEXT NOT NULL,            -- 'user' | 'agent:<turnId>' | 'side_task:<id>'
  turn_id     TEXT,                     -- nullable; present for agent-attributed writes
  target_kind TEXT NOT NULL,            -- 'node' | 'edge' | 'coherence' | ...
  target_id   TEXT NOT NULL,
  op          TEXT NOT NULL,            -- 'create' | 'update' | 'delete' | ...
  before_json TEXT,                     -- optional; see "before-images" below
  after_json  TEXT,
  PRIMARY KEY (lsn, seq)
);
CREATE INDEX change_log_target_idx ON change_log (target_id, lsn);
CREATE INDEX change_log_lsn_idx    ON change_log (lsn);
```

`change_log(lsn, seq)` as a composite key gives Brunch the right shape on day one and avoids a painful migration later from a per-row-LSN model.

### LSN-per-commit correctness

In the POC, the Brunch host is a single-process single-writer over the SQLite database. SQLite in WAL mode plus a single writing process gives LSN-per-commit correctness for free, provided every write goes through one shared command layer that wraps allocations and change-log inserts in one Drizzle transaction:

```ts
db.transaction((tx) => {
  // 1. precondition checks (ifVersion guards, structural legality)
  // 2. entity writes (UPDATE ... WHERE id = ? AND version = ? ; bump version)
  // 3. allocate the LSN:
  const [{ lsn }] = tx
    .update(graphClock)
    .set({ lsn: sql`${graphClock.lsn} + 1` })
    .where(eq(graphClock.id, 1))
    .returning({ lsn: graphClock.lsn });
  // 4. insert change_log rows tagged with `lsn` and ordered by `seq`
  // 5. update coherence_state if dirty-set changed
});
// 6. post-commit fanout to subscribers (TUI redraw, WS broadcast)
```

This shape stays correct as long as the invariant holds: **every mutation goes through this helper, inside one transaction, with the LSN bump and the change-log insert as siblings of the data write.** The risk is not the mechanism; it is socialization of the rule.

### Enforcing the invariant

To make "command layer is the only entry point" enforceable rather than aspirational:

- The graph Drizzle client is not exported as a public symbol from the graph subsystem. Only a `GraphCommands` facade is exported.
- Tests assert that no source file outside `graph/commands/*` imports the raw Drizzle client for graph tables. A simple grep-based check in CI is sufficient for the POC and can be promoted later.
- Pi tools that need to mutate graph state register thin shims that call `GraphCommands.*`. They never receive a database handle.
- Side tasks, lenses, RPC clients, web mutations, and TUI slash commands all call the same `GraphCommands` facade. There is no per-caller specialization of write paths.
- Schema migrations themselves use `GraphCommands` for any data movement; they may add or alter tables outside the command layer, but they may not write graph data without participating in the LSN/change-log protocol.
- The post-commit fanout is the only legal way to learn about changes. Subscribers must not poll the change log without going through the subsystem's subscription API.

This rule is the social load-bearing piece. The mechanism is small; the discipline is the architecture.

### Optimistic concurrency

`ifVersion` is per-entity, separate from the LSN. Each write carries `WHERE id = ? AND version = ?` and treats zero rows affected as a structured `version_conflict` outcome surfaced through the command layer's return type, not an exception. The PRD's "structured outcomes" requirement applies here directly:

```ts
type CommandResult<T> =
  | { ok: true; lsn: number; data: T }
  | { ok: false; reason: "version_conflict"; expected: number; actual: number }
  | { ok: false; reason: "needs_human" | "policy_blocked" | "structural_illegal"; ... };
```

`ifVersion` answers "did I race?" and produces a per-entity conflict. The LSN answers "where is the world?" and is per-commit. They are not the same number and the command layer must not conflate them.

### Before-images

Storing `before_json` doubles read traffic on writes but makes change-log entries self-contained for diffing and undo. For the POC:

- **M4 (graph data plane):** before-images are optional. Storing only `after_json` is acceptable; backward reconstruction can use entity versions.
- **M8 (coherence as first-class graph property):** before-images become required if coherence validators need to diff committed changes to recompute verdicts incrementally.

The schema reserves the column from the start so this is a posture change, not a migration.

### Coherence state in the same write path

The PRD treats coherence (`clean | dirty | validating | incoherent`) as queryable product state. It must live in the same transaction as the writes that disturbed it:

- A small `coherence_state` table tracks the current verdict per graph plane (or per spec, depending on plane granularity).
- A dirty-set update inside the command transaction marks coherence as `dirty` whenever a write touches an entity that participates in a semantic invariant.
- Synchronous structural-legality checks are part of the precondition phase and prevent the commit. Semantic-coherence validation may run asynchronously and update the verdict later through the same command layer (allocating its own LSN, emitting `coherence`-targeted change-log entries).

### Subscriber side

Post-commit fanout is in-process for TUI and RPC subscribers and broadcasts over WebSocket for browser clients. Subscribers receive the commit's LSN, the affected target ids, and a thin descriptor — never the raw database handle. Browser clients use the LSN to invalidate or patch TanStack Query caches; TUI surfaces use it to trigger redraws.

Cross-session detection for `prepareNextTurn` is a query: `SELECT * FROM change_log WHERE lsn > ? AND target_id IN (interest_set) ORDER BY lsn, seq`. Indexes on `change_log(lsn)` and `change_log(target_id, lsn)` cover both the post-commit drain and the interest-filtered detection.

### Complexity verdict

The mechanism itself is small: schema is ~30 lines, the `applyMutation` helper is ~100 lines, post-commit fanout is ~20 lines, optimistic-concurrency wiring is per-command. The long-tail cost lives elsewhere:

- Threading **every** mutation through the command layer (social, not technical).
- Designing the `op` payload shape so change-log entries are self-describing enough for replay, audit, and worldUpdate composition.
- Wiring the subscriber side into both TanStack Query (browser) and the TUI redraw loop (interactive).
- The coherence-verdict lifecycle, which is where most of the durable design work actually lives.

### Milestone implications for the change log

- **M4 (graph data plane)** introduces the `graph_clock`, `change_log`, and `coherence_state` schema, the `GraphCommands` facade, single-LSN-per-commit allocation, per-entity `ifVersion`, and post-commit fanout. Before-images may be deferred.
- **M5 (agent ↔ graph integration)** requires that every agent graph tool route through `GraphCommands` rather than touching Drizzle directly.
- **M7 (detection, relevance, turn-boundary reconciliation)** consumes the change log via `prepareNextTurn` and depends on the `lsn` and `target_id` indexes existing.
- **M8 (coherence)** likely turns on before-images and adds semantic-coherence validation that itself allocates LSNs through the command layer.
- **M9 (compaction-aware continuity)** must preserve session-scoped `lastSeenLsn` across compaction so interest filtering against the change log remains correct after long sessions.

## Reconciliation-need substrate

The PRD commits to coherence as a first-class queryable product state and to a per-commit change log with attribution. Working through the [comparative-architecture-notes review](file:///Users/lunelson/Code/hashintel/bilal-spec-elicitation-proto/LN_REVIEW/comparative-architecture-notes.md) surfaced a third orthogonal substrate that neither the change log nor coherence state should be made to carry alone: **process debt**. Possible observations, possible relations, possible duplicates, stale context, proposal-pending reviews, graph-quality findings, coverage gaps, authority conflicts, and unresolved impasses are all assertions that *judgment is required* — not truth claims and not coherence verdicts. This section pins down the substrate.

### The four-substrate model

The POC's durable state divides into four substrates with strict responsibilities and one shared command layer:

| Substrate | What it owns |
| --- | --- |
| Graph nodes + edges | **Truth** — semantic content and relations across the four planes |
| `change_log` | **Audit / history** — every commit, attribution, before/after |
| `coherence_state` | **Verdict** — per-plane status and machine-readable violations |
| `reconciliation_need` | **Actionable queue** — process debt with independent lifecycle |

Each has a single responsibility. Coherence violations may reference need IDs; needs may reference causing LSNs or violation IDs; **neither subsumes the other**. The actionable queue UI reads from `reconciliation_need` only.

### Schema

```sql
CREATE TABLE reconciliation_need (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL,   -- semantic_conflict | possible_observation |
                                         -- possible_relation | possible_duplicate |
                                         -- stale_context | proposal_pending |
                                         -- graph_quality | coverage_gap |
                                         -- authority_conflict | impasse
  status                TEXT NOT NULL,   -- open | in_progress | resolved | superseded
  spec_id               TEXT NOT NULL,
  plane                 TEXT NOT NULL,
  target_refs           TEXT NOT NULL,   -- JSON array of NodeRefs the need is about
  summary               TEXT NOT NULL,
  details_json          TEXT,
  caused_by_lsn         INTEGER,        -- LSN of the commit that raised the need
  caused_by_turn_id     TEXT,           -- turn that produced the commit
  raised_by_actor       TEXT NOT NULL,  -- 'user' | 'agent:<turnId>' | 'side_task:<id>'
  resolution_authority  TEXT,           -- authority tier permitted to resolve
  created_lsn           INTEGER NOT NULL,
  resolved_lsn          INTEGER
);
CREATE INDEX recon_need_status_idx ON reconciliation_need (status, spec_id);
CREATE INDEX recon_need_target_idx ON reconciliation_need (spec_id, plane);
```

### Mutation invariant

Needs are mutated through a `ReconciliationCommands` facade alongside `GraphCommands` and under the same global LSN + change-log discipline:

- Every need create/update/resolve/supersede allocates an LSN via the same `graph_clock` table.
- Every need mutation appends a `change_log` entry with `target_kind = 'reconciliation_need'`.
- Needs and graph nodes may be mutated in the **same transaction** when the interviewer resolves a need inline as part of an ordinary turn's commit. This is desirable: a question whose answer both writes a new invariant and closes a `possible_observation` need should commit atomically.
- Side tasks raise needs through the same facade; attribution remains clean (`raised_by_actor = 'side_task:<id>'`).

### `worldUpdate` extension

The PRD's `worldUpdate` carries relevant external graph divergence between turns. It is extended to also carry a compact summary of newly opened and newly resolved relevant needs for the session's interest set:

```ts
type WorldUpdate = {
  graphChanges: GraphChange[];     // existing
  needs: {
    openedRelevant: ReconciliationNeedRef[];
    resolvedRelevant: ReconciliationNeedRef[];
  };                                // new
};
```

Interest-set filtering applies symmetrically: a need is relevant to a session iff at least one of its `target_refs` is in the session's interest set.

### Where impasse lands

`impasse` is a `reconciliation_need` kind, not a graph node kind. An unresolved contradiction, gap, or authority deadlock is process debt. It may *reference* the conflicting graph nodes via `target_refs` and may *reference* a coherence violation, but it is not itself semantic truth. This resolves the question of where to put the prototype's "impasse hub" concept without conflating reasoning truth with process debt. See also §Reasoning records under Framework alignment.

### Cost and milestone placement

Additive to M4:

- One new table (`reconciliation_need`) + two indexes.
- `ReconciliationCommands` facade — formulaic given the layer is already typed.
- Worldupdate envelope extension (one new field, optional).
- One new `change_log` `target_kind` value.

Consumers arrive incrementally:

- **M5**: agent graph tools may raise needs (e.g. a `possible_duplicate` when the agent suspects two intent nodes are the same claim).
- **M7**: `prepareNextTurn` reads relevant open needs and includes them in `worldUpdate`; the interviewer may resolve them inline through capture-aware offers (see §4).
- **M8**: coherence violations link to needs that would resolve them when the validator finds them; semantic coherence and process debt are distinct but cross-referenced.

### Residual risks

- **Three queues confusion.** If users see coherence violations, open needs, and worldUpdate notifications all competing for attention, the actionable queue must clearly win — Brunch UI policy should always route "what should I handle next" through `reconciliation_need`.
- **Need spam.** A side task or kernel that raises low-confidence needs aggressively can flood the queue. The mitigation is policy-level (per-kind rate limits, dedup on `(kind, target_refs)`), not schema-level.
- **Shadow semantics.** A need is not a semantic edge. Code paths that treat a `semantic_conflict` need as if it were a `conflicts_with` edge will silently confuse process debt with truth. The command layer must reject reads of `reconciliation_need` from anything that should be reading graph edges.

## Flue framework evaluation

The PRD commits Brunch to layering on `pi-coding-agent` as an internal harness. Two future affordances — first-class sandboxing of tool execution, and the ability to run Brunch (or parts of it) remotely — are not native to pi. The Flue framework (`withastro/flue`, cloned for review at `/Users/lunelson/Clones/withastro/flue`) is itself built on pi-agent-core and explicitly covers both of those gaps, so it was worth checking whether Brunch should swap pi-coding-agent for Flue as the harness substrate.

### Verdict

Flue is **not a categorical fit** as the Brunch harness for the POC. It optimizes for the opposite axis of the design space — headless, server-deployed, request/response agent endpoints — and in doing so removes most of the pi seams that the four affordances above rely on. Adopting Flue would force Brunch to rebuild interaction surfaces from scratch and would work against the grain of Flue's persistence and HTTP model.

The decision is: **stay on `pi-coding-agent` as the harness; treat Flue as a reference design for two specific subsystems Brunch will eventually need.**

### What Flue does that pi does not

- A clean sandbox abstraction (`SandboxFactory` / `SessionEnv` / `SandboxApi`) with adapters for in-process virtual (just-bash), host (`local()`), and a connector catalog covering Daytona, E2B, Cloudflare Containers, Modal, Vercel, Mirage, Boxd, and others.
- A `--target node | cloudflare` build pipeline that produces a deployable artifact, with Durable Object session persistence and a `worker_loaders` + Workspace pattern for SQLite-indexed filesystems on Workers.
- A `connectMcpServer` adapter that turns remote MCP servers into pi `ToolDef`s without any per-tool registration code in the agent.
- A per-run `FlueEvent` stream with an in-process subscriber registry, surfaced as SSE on the agent HTTP endpoint — useful as a model for Brunch's per-turn event fanout.
- A small, well-typed roles/skills/AGENTS.md discovery loop driven from the session's `cwd`, which is a cleaner shape than pi-coding-agent's defaults for the specific case of "discover everything from the project directory."

### Why Flue is the wrong shape for the POC harness

The four affordances in this document lean on a specific pi triad: **custom-message entries + `deliverAs: "nextTurn" | "followUp"` + `prepareNextTurn`**. That triad is load-bearing for offers, side-chain results, world updates, and lens switches. Flue's public `SessionData` knows three entry kinds only — `message`, `compaction`, `branch_summary` — and exposes neither `appendEntry`, nor `deliverAs`, nor a `prepareNextTurn` hook.

Concretely, Flue has **no equivalent** for any of:

- `prepareNextTurn` injection of `worldUpdate` between turns.
- `pi.appendEntry({ deliverAs: "nextTurn" })` for side-chain result delivery. Flue's `session.task()` is awaited inline.
- Custom-message entry types + `registerMessageRenderer` for `brunch.offer`, `brunch.lens_switch`, `brunch.spec_switch`, `brunch.side_task_result`.
- `pi.registerCommand` for `/lens`, `/spec`, `/compact`-style affordances.
- `ExtensionUIContext.select | confirm | input | custom` for confirmation-gated writes and overlay UIs.
- `pi-tui` primitives, including `SessionSelectorComponent` as a model for `SpecSelectorComponent`.
- A JSON-RPC + WebSocket subscription transport. Flue is HTTP+SSE, request/response over `POST /agents/<name>/<id>`.
- Project-local JSONL sessions under `.brunch/`. Flue stores `SessionData` JSON via `SessionStore` keyed by `(instanceId, harness, sessionName)`.

Flue's own framing makes the mismatch explicit: *"100% headless and programmable. There's no baked-in assumption like requiring a human operator to function. No TUI. No GUI. Just TypeScript."* Brunch is the inverse — guided elicitation with offer-first interaction across TUI, web, RPC, and print.

### What Brunch should adopt *from* Flue, on top of pi

Flue's two real contributions — sandbox abstraction and remote deployment — are independently liftable patterns. Brunch should not depend on Flue, but should consciously model two future Brunch-owned subsystems on Flue's shapes:

1. **`BrunchSandbox` interface, modeled on Flue's `SessionEnv` / `SandboxApi`.** When Brunch reaches the milestone where agent tool execution needs sandboxing (well after M0–M3 and likely after M5), introduce a Brunch-owned `BrunchSandbox` with the same shape: `exec(cmd, { cwd, env, timeout, signal })` plus the file primitives (`readFile`, `writeFile`, `stat`, `readdir`, `exists`, `mkdir`, `rm`). Provide an in-process default (the existing pi tools running against the host) and leave room for connector-style adapters per provider. The connector catalog format (`connectors/sandbox--<provider>.md` as installation instructions, not npm packages) is also worth copying: it keeps the Brunch core free of provider SDK dependencies.

2. **`brunch --mode serve` (or equivalent) remote deployment target, modeled on `flue build --target ...`.** When Brunch needs to run hosted/remote, the deployable artifact should be a build of the same Brunch host with the interactive adapters (TUI, slash commands, overlays) replaced by a transport adapter (HTTP+SSE or JSON-RPC over WebSocket). Flue's `flue-app.ts` Hono-based shape, its `RunSubscriberRegistry` for live-tail, and its Durable Object persistence pattern are all reasonable references. The point is that "headless remote Brunch" should be a *mode* of the same host, not a parallel codebase — which is the same posture the PRD already takes for the four local modes.

3. **MCP tool adapter shape, modeled on `connectMcpServer`.** Even if Brunch's POC does not expose MCP to end users, the function-level shape (`connectMcpServer(name, { url, headers, transport? }) → { tools, close }`) is worth replicating when Brunch needs remote tool wiring. Keep it adapter-level; do not bake MCP into the Brunch system prompt or curated toolset.

4. **Per-run event stream as a first-class subsystem, modeled on `FlueEvent` + `RunSubscriberRegistry`.** Brunch already needs subscriptions for graph and session state; the run-level event stream (turn boundaries, tool calls, compaction events, operation lifecycle) is adjacent and should share the same fanout substrate. Flue's typed `FlueEvent` union is a good reference for the shape of Brunch's own event envelope.

### What is explicitly *not* adopted

- Flue's session storage model. Brunch stays JSONL-first per M2.
- Flue's HTTP+SSE-only transport. Brunch's primary transport remains JSON-RPC with subscriptions per the PRD.
- Flue's headless-only stance. Brunch keeps TUI, web, RPC, and print modes as peers.
- Flue's "agent as deployable workspace" framing. Brunch is a local product first, and remote operation is a deployment mode of that product, not its primary shape.
- Flue's `roles` abstraction as a substitute for the Brunch lens model. Roles are call-scoped system prompt overlays; lenses are durable, switchable bundles of system prompt + tools + context projection + custom renderers, persisted in the transcript via `brunch.lens_switch`. The lens model strictly subsumes Flue roles for Brunch's needs.

### Milestone implications

These adoptions do not change the POC milestone ladder. They are deferred and additive:

- **M0–M9** proceed against pi-coding-agent as planned.
- A post-M9 sandbox milestone introduces `BrunchSandbox` as the abstraction layer between pi tool execution and the host or a remote provider.
- A separate post-M9 remote-deployment milestone introduces `brunch --mode serve` against the same Brunch host, with the interactive adapters replaced by a headless transport adapter.

Both items should be tracked in `memory/PLAN.md` as deferred frontier items rather than POC scope.

## Framework alignment & deferred subsystems

The programme's AI R&D framework — which this POC ultimately serves — anticipates an end-to-end specification → plan → execution → validation workflow with explicit governance, orchestration, and action layers; durable spec/plan/execution state stored in Geolog (TA1.2) with theories enforcing relationships; per-task context routing with access audit; per-task least-privilege sandboxing; multiple candidate specs/plans with trade-off analysis; and first-class validation gates including proof obligations and assurance strategies. The POC explicitly does not deliver all of that. This section catalogues the framework concerns it defers, the minimum hedges adopted to preserve compatibility, and the one place where typed structure is worth landing in the POC even though execution is deferred.

Three substantive resolutions in this section — the reasoning-records storage shape, the typed oracle-plane stub, and the product-framing modality — were arrived at by pressure-testing the POC against the [comparative-architecture review](file:///Users/lunelson/Code/hashintel/bilal-spec-elicitation-proto/LN_REVIEW/comparative-architecture-notes.md) of a sibling spec-elicitation prototype, with the oracle as third party. The reconciliation-need substrate above is the fourth resolution from the same review; it lives in its own top-level section because it is a substrate, not a deferred concern.

### Explicitly deferred subsystems

For each deferred subsystem the POC adopts a single-paragraph posture or naming convention so the foundations do not accidentally close off the framework trajectory.

#### Geolog (TA1.2 data store)

Geolog does not yet exist; modelling Brunch's domain as Geolog theories is non-trivial parallel work. The POC's SQLite + Drizzle + Brunch-owned change log is therefore written so it survives either future fate — Geolog as a separate higher-tier store of canonical truth (with SQLite a local cache or projection), or SQLite as terminal for the local product. The non-negotiable invariant in this document holds in both cases: a per-commit append log with attribution is the minimum either projection needs. The PRD should not commit to SQLite as either stopgap or terminal; it should commit to the *invariant shape* and leave the storage substrate replaceable.

#### Plan execution

The plan plane in the POC is data. A separate Petri-net execution model is anticipated as a sibling representation compiled alongside the plan graph, with coloured tokens that reference plan-graph node IDs. The POC need not build this, but must keep plan-graph nodes addressable by stable IDs across revisions (which the per-entity `version` model already supports) so the eventual Petri net can refer to them without ambiguity. A one-paragraph commitment to this in the PRD prevents the plan-plane schema from accidentally closing it off.

#### Context layer

Per-task context routing and access audit — distinguishing context globally available from context intentionally granted from context actually accessed — is a large scope problem with no obvious POC slice. The PRD should reserve the subsystem name and state explicitly that POC tools have unrestricted reads within the workspace; this single sentence keeps code from being written that assumes "context = everything" forever.

#### Capability tiers

Per-task least-privilege scoping (read/write boundaries, sandbox capabilities, sensitive-context tags, revocation) is a separate axis from authority tiers (who must approve). The model is not yet figured out. The PRD should add one sentence to the authority-model section stating the two axes are orthogonal so they do not get fused in code: authority tiers gate *who must approve*; capability tiers, future, will gate *what a task is permitted to do*.

#### Candidate artefacts

Multiple candidate specs or plans with trade-off summaries are anticipated by the framework but have no first-class shape in the POC. The PRD should state that intent/oracle/design/plan items may, in the future, be variants under a parent slot with one variant promoted as canonical — without building it. This preserves the move.

### Oracle plane: typed stub for the POC

The oracle plane is the one place where typed structure is worth landing in the POC even though no execution component consumes it yet. Three forces converge:

1. The framework anticipates validation methods, proof obligations, assurance levels, and assumption-invalidation cascade as a core part of the long-term spec → plan → execution → validation loop.
2. The behavioral-kernel design at [`docs/design/BEHAVIORAL_KERNELS.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/BEHAVIORAL_KERNELS.md) makes these entity types *near-term*, not far-future. Every kernel card emits typed artefacts that include invariants, criteria, examples, decisions, and proof obligations; the interviewer workflow's Step 6 already wants to write `Obligation` nodes when a kernel surfaces a `proof_candidate`. The oracle plane is therefore on the kernel emission path from the day kernels are wired into the agent — around M5.
3. The cost of typing the plane now (without runners) is small and additive to M4.

#### Intent-plane subtypes (informed by the kernel artefact taxonomy)

Subtypes on existing intent-plane node types, not new tables. The vocabulary mirrors `BEHAVIORAL_KERNELS.md`'s "Artifacts" rows so kernel cards can emit directly into the typed plane:

- `requirement.kind: 'informal' | 'formal_property' | 'type_contract' | 'acceptance_criterion'`
- `requirement.status: 'draft' | 'active' | 'blocked' | 'met' | 'failed'`
- `assumption.kind: 'discharge_required' | 'trusted'`
- `assumption.status: 'active' | 'invalidated' | 'retired'`
- `invariant.kind: 'state' | 'transition' | 'data_integrity'` (the three subtypes kernels already emit)
- `example.kind: 'positive' | 'negative'`
- `decision.alternatives_considered: example_id[]` (kernels record rejected options as negative examples linked to the decision)
- `claim.proof_candidate: boolean` (the kernel-Step-6 marker indicating a claim warrants stronger checkability)

#### Authority, epistemic status, and framing — three orthogonal classification axes

Every intent-plane node also carries three orthogonal classification fields. Each is a small coarse enum plus an optional contextual note. These are **context-pack compression labels, not a theory of truth**: deterministic code may use them for grouping, warnings, and escalation, but not for final semantic resolution.

```ts
authority:        'stakeholder' | 'technical' | 'external' | 'derived';
authority_note?:  string;
epistemic_status: 'observed' | 'asserted' | 'assumed' | 'inferred';
epistemic_note?:  string;
framing_as?:      <see allowed matrix below>;
framing_json?:    Record<string, unknown>;
```

Good deterministic uses: group/filter/render nodes by coarse label; prioritise `observed` over `inferred` in compact context packs; flag `stakeholder`/`technical` conflicts for review; require user confirmation before retiring `stakeholder`/`asserted` items. Bad deterministic uses: `technical/observed` always wins; `derived/inferred` can always be dropped; complex precedence matrices that pretend to resolve semantic meaning automatically.

#### Product-framing modality — allowed matrix

The intent ontology covers engineering-spec shapes well but is thin on product-framing concepts (problem, persona, JTBD, value proposition, product concept, precedent, market wedge, non-goal). Rather than introduce eight new top-level node kinds — which would balloon the command surface, complicate relation-policy legality, and risk an "intent ontology committee" — the POC adopts a queryable secondary classification via `framing_as`, with a tight allowed matrix:

| Base kind | `framing_as` allowed values |
| --- | --- |
| `goal` | `product_concept`, `value_proposition`, `market_wedge`, `jtbd` (goal-shaped) |
| `context` | `problem`, `persona`, `jtbd` (situation-shaped), `precedent` |
| `constraint` | `non_goal` |
| (other kinds) | none in POC |

`non_goal` is intentionally kept as a `constraint` framing rather than a top-level kind because the current intent-graph semantics already wants it there.

Framing primarily drives **elicitation, rendering, and context packing** in the POC — not new relation-policy rules. Base kind still drives edge legality and most traversal. Context packs, scope-card UI, and compaction summaries must render a dedicated **Product framing** block so the data does not silently disappear from the agent's view.

Kernel-activation gate: behavioral kernels should not engage in earnest before at least one `product_concept`, one `problem`, one `persona`, and one `non_goal` (or scope boundary) have been captured for the spec. This is the minimum framing bundle required for brief #7 ("Notion meets Linear meets Slack") in the [fixture strategy](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md) to succeed.

#### Oracle-plane entities (new node types)

```diagram
╭───────────────────────╮     validates    ╭──────────────────────╮
│ Check                 │ ───────────────▶│ Requirement (intent)  │
│  - method_id          │                  │  Invariant (intent)   │
│  - status             │                  │  Criterion (intent)   │
│  - last_run_at        │                  ╰──────────────────────╯
│  - evidence_id?       │                         ▲
│  - assurance_level    │                         │ depends_on
│  - checkability_tier  │     instance_of         │
╰──────────┬────────────╯ ───┐                    │
           │                 ▼             ╭──────────────────────╮
           │ produces  ╭───────────────╮   │ Assumption (intent)  │
           ▼           │ Validation-   │   ╰──────────────────────╯
   ╭──────────────╮    │ Method        │
   │ Evidence     │    │  - kind       │   ╭──────────────────────╮
   │  - kind      │    │  - config     │   │ Obligation           │
   │  - payload_ref│   ╰───────────────╯   │  - status            │
   ╰──────┬───────╯                        │  - derived_from_inv  │
          │ counterexample_for             ╰──────────┬───────────╯
          ▼                                           │
   ╭──────────────╮      ◀────discharges──────────────╯
   │ Invariant    │              (from Check)
   │ (intent)     │
   ╰──────────────╯
```

`ValidationMethod.kind` enumerates the framework's checkability spectrum and the kernel doc's "progressive checkability" tiers:

- `example_witness` — a worked positive or negative example
- `validator` — a well-formedness or parser check
- `unit_test` · `property_test`
- `lint` · `typecheck`
- `model_check` · `proof` · `trusted_interface`
- `ai_review`

`Check.checkability_tier` records the mechanism (which slot of the spectrum); `Check.assurance_level` records the resulting strength (`trusted | tested | model_checked | proved`). They are separate fields because the same mechanism can yield different strengths depending on coverage.

#### Edge types

Additive to the M4 edge-type catalogue:

- `validates` — Check → Requirement | Invariant | Criterion
- `instance_of` — Check → ValidationMethod
- `produces` — Check → Evidence
- `discharges` — Check → Obligation
- `depends_on` — Requirement → Assumption (cascade trigger)
- `derived_from` — Obligation → Invariant | formal-property Requirement
- `counterexample_for` — Example → Invariant (named explicitly in `BEHAVIORAL_KERNELS.md` §"Worked example — project deletion")
- `witnesses` — Example → Invariant | Criterion

#### Coherence rule for assumption invalidation cascade

One new rule in the coherence validator: when an `Assumption` transitions to `invalidated`, every active `Requirement` or `Invariant` with a `depends_on` edge to it must transition to `blocked` or surface a coherence violation. This is the cascade in its minimum form — a coherence rule, not an evolution engine. It composes with the M8 coherence work without inventing a separate lifecycle subsystem.

#### What the stub enables and what it does not

Enables:

- The agent can create typed requirements, assumptions, invariants, examples, decisions, criteria, checks, obligations, and evidence references.
- Kernel cards from `BEHAVIORAL_KERNELS.md` emit their typed artefacts directly into the graph using stable schema, not ad-hoc JSON.
- Proof obligations and `proof_candidate` markers can be written from kernel Step 6 without inventing storage on the fly.
- Assumption invalidation produces visible coherence state on dependent items.
- UI can render validation strategy and assurance posture alongside the intent graph.

Does not enable:

- No runner: nothing actually executes a check. `Check.status` is agent- or user-driven.
- No automatic obligation derivation from formal properties.
- No evidence storage backend (`evidence.payload_ref` is an opaque ID).
- No assurance-level computation rules; `assurance_level` is recorded, not derived.
- No kernel-card registry as a first-class graph item. Kernel activation in a turn is captured as a transcript custom entry (`brunch.kernel_activation`, on the same model as `brunch.lens_switch`) rather than a graph node in the POC.

#### Cost and milestone placement

Additive to M4 (graph data plane):

- ~8 typed columns added to intent-plane nodes.
- 4 new node tables (Check, ValidationMethod, Evidence, Obligation).
- 8 edge types added to the edge-type catalogue.
- 1 coherence rule for assumption invalidation.
- `GraphCommands` mutations for each new node and edge type (formulaic).

No new transport, no new authority tier, no new transcript shape beyond the `brunch.kernel_activation` custom entry. Behavioral kernels become a consumer of the typed plane from M5 onwards (agent ↔ graph integration) without further schema change.

### What this hedges against

- **Formal-verification teams arriving in scope.** The intent and oracle planes already speak the typed vocabulary the framework anticipates for them. No re-typing pass.
- **Petri-net plan execution.** When it lands, it can dispatch validation methods and write `Check.status` updates through the same command layer without schema churn.
- **Geolog migration.** The entity and edge vocabulary above is exactly the kind of typed structure that translates cleanly into Geolog theories later. The local model and the eventual Geolog model speak the same words.
- **Behavioral kernels reaching maturity.** Kernel Step 6 ("escalate to formal verification if useful") has a typed home from M5 onwards instead of requiring a retrofit once kernels stabilise.

### What this does not hedge against

- A specific proof-obligation derivation strategy from formal properties.
- A specific assurance-strategy framework (composition rules, hierarchy propagation, trust-boundary algebra).
- A specific evidence-storage backend (filesystem, object store, Geolog-attached blob).

All three are out of scope and should remain so.

### Reasoning records: storage shape resolution

The comparative review surfaced three plausible storage shapes for reasoning records — decisions, justifications, impasses — emphasising the prototype's "hub node" framing. After pressure-testing, the POC adopts a deliberately non-uniform resolution that distinguishes truth from process debt.

| Reasoning artefact | Where it lives in the POC |
| --- | --- |
| `decision` | Ordinary intent-plane graph node (already in the ontology). Independent lifecycle, ordinary semantic edges (`selected`, `rejected`), kernel-emitted, visible to `worldUpdate`. |
| `justification` | Compact rationale text on the produced node, **plus** explicit `supports` / `depends_on` semantic edges where any dependency is load-bearing for assumption-invalidation cascade or coherence. Not a separate graph kind in the POC. |
| `impasse` | A `reconciliation_need` of `kind: 'impasse'` (see §Reconciliation-need substrate). Not graph truth; process debt referencing the conflicting nodes via `target_refs`. |

The principle: **if it is truth, it goes in the graph; if it is process debt, it goes in `reconciliation_need`.**

Concretely:

- `decision` nodes have edges to the `example` nodes (kind `positive` for selected, `negative` with `counterexample_for` for rejected) that record the alternatives. The kernel-emitted `decision.alternatives_considered` field above captures this directly.
- Dependency-bearing premises live as ordinary semantic edges from the produced node (a `decision`, `requirement`, or `invariant`) to the `assumption`s it depends on. The coherence validator traverses these edges for the cascade; it does **not** traverse a separate justification substrate.
- Lightweight justification text — the "why" prose that does not bear any dependency the cascade needs to see — lives in the `rationale` field on the produced node, alongside the `authority_note` and `epistemic_note` fields.
- Impasses are raised as needs at the moment a contradiction, gap, or authority deadlock is detected. They may reference a coherence violation (when the contradiction is structural) or stand alone (when the gap is purely process-shaped, e.g. "no stakeholder has answered question X").

#### What this rules out

- No standalone `justification` graph kind. If a future consumer (formal-verification team, multi-premise reasoning audit) demands typed-hyperedge promotion, it would be a deliberate M5/M6 schema migration, not an ad-hoc addition.
- No standalone `impasse` graph kind. The prototype's "impasse hub" was conflating truth with process debt; the four-substrate model resolves the conflation.
- No reasoning-record sprawl: code paths that want to add `justification` or `impasse` as graph kinds without a forcing function should be refused at review.

#### Cost and milestone placement

Additive to M4, but mostly *subtractive* relative to the comparative-review proposal: no new tables, no new top-level node kinds, no new edge categories beyond what the oracle-plane stub already needs. The `rationale` field on intent-plane nodes is one new column. The reconciliation-need substrate is already paying the cost for the impasse case.

#### When to revisit

By M5/M6, if formal-verification consumers need to query, rebind, or review reasoning acts independently of the nodes they produced, the oracle-plane Q1 "advanced path" (typed `reasoning_record` hyperedges) is the deliberate promotion route. Until that consumer exists, the cost is not worth paying.

## Open questions

1. Whether a lens may register its own pi tools at load time or must declare them up front. Up-front declaration keeps `setActiveTools` sufficient but constrains lens authorship.
2. Whether spec switching is always a session switch or whether one transcript may span several spec roots with lens-mediated framing.
3. Whether the offer envelope should be a single `brunch.offer` type with a `kind` discriminator or several types (`brunch.action_menu`, `brunch.question`, `brunch.question_freeform`) for sharper renderer typing.
4. Whether side-task results should always go through the shared command layer or whether read-only "advice" side tasks are allowed to produce custom-message results without touching graph state.
5. Whether the RPC `multiSelect` and `freeformWithChoice` protocol extensions should live in Brunch's own JSON-RPC surface from day one rather than as an extension of pi's `extension_ui_request` family.
6. Whether before-images should be stored from M4 to simplify later coherence work, accepting the doubled write-time read cost, or deferred to M8 when their consumers exist.
7. Whether the change-log `op` payload should be free-form JSON keyed only by `target_kind`, or a discriminated union of typed op shapes per graph plane to make change-log replay strongly typed.
8. When (M-number or brief-count signal) to promote framings from `framing_as` to first-class node kinds. The current rule is "only when a framing repeatedly demands unique relation-policy or coherence behaviour across multiple briefs"; the operational signal for this remains under-specified.
9. Whether `worldUpdate`'s extension to carry need summaries needs its own envelope variant (`worldUpdate.v2`) or a backwards-compatible additive payload field is sufficient.
10. Whether `reconciliation_need.kind = 'impasse'` should split into finer subtypes (`contradiction`, `gap`, `authority_conflict`) immediately or after the first encounters in fixture runs reveal which distinctions matter operationally.
11. Whether the observer should be allowed to write graph mutations and reconciliation needs in different transactions for the same turn, or must always commit atomically. Atomic commit is simpler; split commit allows partial capture when one of the two fails legality checks.
12. Whether `authority` and `epistemic_status` fields belong on every intent-plane node, or only on the durable claim subtypes (requirement, assumption, invariant, decision) and not on structural ones (term, context, example).
13. Whether the kernel-activation gate (`product_concept` + `problem` + `persona` + `non_goal`) should be a hard block on kernel engagement or a soft signal the interviewer surfaces via offers.
