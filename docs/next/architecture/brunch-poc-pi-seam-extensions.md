# Brunch POC — Pi Seam Extensions

This is a sibling document to [brunch-poc-architecture-prd.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/next/architecture/brunch-poc-architecture-prd.md). It captures four architectural extensions to the POC that drill into how specific Brunch product affordances land on pi's existing seams. The PRD asserts that pi can be used as an internal harness without forcing Brunch to become a pi distribution; this document checks that claim against four concrete affordances and records where Brunch owns work that pi does not provide.

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

### Pi seams used

- `pi-tui` plus the `SessionSelectorComponent` pattern in `cli/session-picker.ts`. The selector is replaceable: same `TUI` + `setKeybindings` + `addChild` + `setFocus` sequence, swapping the inner component for a `SpecSelectorComponent`.
- `ExtensionCommandContext.switchSession(sessionPath, { withSession })` for the case where each spec is bound to its own session file. This is the supported teardown-and-rebuild path.
- `ExtensionUIContext.custom<T>(...)` for mounting a spec picker as an overlay inside an interactive session, so spec-switching does not require leaving the agent loop.

### Brunch-owned work

- A `SpecRegistry` over `.brunch/` that enumerates the specs in the workspace, where a spec is identified by its intent-graph root and carries display metadata (name, last activity, current coherence verdict).
- A `SpecSelectorComponent` modeled on `SessionSelectorComponent` but reading from `SpecRegistry` rather than `SessionManager`.
- A `SpecBinding` decision per spec: either (a) one session per spec, in which case spec switching uses `switchSession`, or (b) one shared session across specs with lens-style framing handling spec scope.
- A persistent `brunch.spec_switch` custom entry, mirroring `brunch.lens_switch`, so resume reconstructs which spec was active at each point in the transcript.

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

- A `brunch.offer` custom-message envelope: `{ kind: "actions" | "question", prompt?, options: [{ id, label, value }], multi: boolean, freeform: boolean, allowSkip: boolean, expiresOn?: TurnId | Timestamp }`.
- A `brunch.offer_response` custom-message envelope with the user's selection, freeform text, or skip outcome.
- A single Brunch-owned renderer for `brunch.offer` per mode: TUI overlay, web component, RPC `extension_ui_request` extension method.
- A `MultiSelectOverlay` component built once on `pi-tui` primitives, returning `string[]`.
- A `session_start` hook that synthesizes an initial offer when no transcript history exists, so every fresh session opens with a surface.
- A protocol extension to the RPC `extension_ui_request` family for `multiSelect` and `freeformWithChoice`, with a corresponding web client implementation. This is additive, not a replacement.

### Posture

- The offer envelope is durable transcript truth, not ephemeral UI state. Selections are written back as custom messages so the agent can reason over them on the next turn and the transcript reload faithfully reproduces what was offered and what was chosen.
- The agent is allowed to refuse to chat without an offer. The Brunch system prompt should require the agent to either produce an offer or emit `brunch.needs_human` for cases the agent cannot resolve.
- In print mode an offer either resolves via an explicit auto-policy or returns a structured `needs_human` outcome. It does not block.
- Multi-choice answers are first-class. Single-choice is a degenerate multi-choice with `multi: false`.

### Residual risks

- The offer envelope risks being treated as a replacement for the LLM's natural narrative. Brunch should keep offers as the *interaction* surface while the assistant's prose remains the *explanation* surface. A lens that bypasses offers is allowed only for explicitly free-chat moments.
- Pi's RPC `extension_ui_request` types are currently fixed. Adding `multiSelect` and `freeformWithChoice` is a Brunch-side protocol extension that the web client must agree on; this is small but non-zero coupling that should be tracked.

## Cross-cutting consequences

The four affordances together imply a small Brunch-owned subsystem cluster that the PRD's "Brunch host" box should be understood to contain:

- `SideTaskRegistry` and `SideTaskRunner`.
- `LensRegistry` and `LensBundle`.
- `SpecRegistry` and `SpecSelectorComponent`.
- `OfferEnvelope`, `OfferRenderer` per mode, and `MultiSelectOverlay`.

All four subsystems route their durable effects through the same shared command layer described in the PRD. None of them require modifying pi.

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

## Open questions

1. Whether a lens may register its own pi tools at load time or must declare them up front. Up-front declaration keeps `setActiveTools` sufficient but constrains lens authorship.
2. Whether spec switching is always a session switch or whether one transcript may span several spec roots with lens-mediated framing.
3. Whether the offer envelope should be a single `brunch.offer` type with a `kind` discriminator or several types (`brunch.action_menu`, `brunch.question`, `brunch.question_freeform`) for sharper renderer typing.
4. Whether side-task results should always go through the shared command layer or whether read-only "advice" side tasks are allowed to produce custom-message results without touching graph state.
5. Whether the RPC `multiSelect` and `freeformWithChoice` protocol extensions should live in Brunch's own JSON-RPC surface from day one rather than as an extension of pi's `extension_ui_request` family.
6. Whether before-images should be stored from M4 to simplify later coherence work, accepting the doubled write-time read cost, or deferred to M8 when their consumers exist.
7. Whether the change-log `op` payload should be free-form JSON keyed only by `target_kind`, or a discriminated union of typed op shapes per graph plane to make change-log replay strongly typed.
