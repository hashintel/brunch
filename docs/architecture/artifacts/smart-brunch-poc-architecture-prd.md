# Smart-Brunch POC Architecture PRD

Source: distilled from `docs/architecture/artifacts/transcript-of-pi-architecture-review.md` (a conversation that examined the `pi` agent framework as a foundation for `brunch`, working name `foobar` in the transcript). Corrections made mid-conversation are folded in as-of-final positions; earlier mistakes are not retained.

## 1. Product summary

`brunch` is a locally-installed Node CLI (`npm i -g brunch`) that wraps the `pi` agent stack and presents it through several modes against a project scoped to the current working directory. It is **not a fork** of `pi`; it consumes `pi`'s extension and SDK APIs internally while presenting only its own opinionated surface to the end user.

Invocation shape:

```sh
brunch                # default: chat TUI for the local agent
brunch --mode web     # serves a local web UI over the same agent
brunch --mode rpc     # JSON-RPC over stdio (for driver programs)
brunch --mode print   # one-shot, headless, pipeline-friendly
```

All data lives in a per-cwd directory:

```
.brunch/
  data.db            # SQLite — records (intent graph), change log, coherence
  sessions/*.jsonl   # pi SessionManager (raw transcripts, compaction)
  auth.json          # pi AuthStorage (provider credentials, OAuth)
  settings.json      # brunch + pi settings
```

The structured data is conceptualized as an **intent graph** — typed records and edges that together specify a software project. The agent and the user both edit this graph; brunch must keep the graph structurally legal, surface semantic (global) coherence verdicts, and maintain continuity of context across sessions and across direct user edits.

## 2. Dependency choices

| Concern | Choice |
|---|---|
| Core dependency | `@earendil-works/pi-coding-agent` (transitively pulls `pi-agent-core`, `pi-ai`, `pi-tui`) |
| Web component library | Skip `pi-web-ui` initially. Its components expect an `Agent` instance in the same JS context; brunch's agent runs in Node, so a thin React frontend over WS is simpler. Reconsider only if a substantial chunk of its message/artifact rendering proves worth re-importing. |
| Forking pi | Explicitly not. Pi's design philosophy is "adapt, don't fork." Everything brunch needs is reachable through pi's SDK, extension API, services bundle, and `convertToLlm` / `transformContext` / `prepareNextTurn` hooks. |

`pi-coding-agent` is the harness brunch consumes — `createAgentSession`, `createAgentSessionServices`, `createAgentSessionRuntime`, `SessionManager`, `AuthStorage`, `ModelRegistry`, `SettingsManager`, `ResourceLoader`, `ExtensionRunner`, the built-in coding tools, and the three modes (`InteractiveMode`, `runRpcMode`, `runPrintMode`).

Brunch consumes pi's extension API by registering its own extension factories internally; it does **not** expose pi's `--extension` / `--skill` / `--prompt-template` flags to users. The end-user surface is brunch's own CLI flags only.

## 3. Architectural pillars

### 3.1 Pi's relevant seams (the levers brunch pulls)

- **Service bundle** (`createAgentSessionServices` → `AgentSessionServices`): plain TS interface + constructor function. No DI container. Every service has a sensible default but accepts an injected override. Brunch reconstructs this bundle pointed at `.brunch/` and may swap in its own backends.
- **Two-stage agent construction**: `createAgentSessionServices` (slow: load settings, scan extensions, read auth) → `createAgentSessionFromServices` (fast: build session over existing services). Brunch can build services once and host multiple sessions/runtimes.
- **Per-turn render pipeline** inside the agent loop: `agent.state.messages` → `transformContext(messages, signal)` → `convertToLlm(messages)` → `streamFn(model, { systemPrompt, messages, tools })`. The system prompt is built once at session start and reused; the message list is freshly rendered every turn. These two functions are the only sanctioned places to manipulate the transcript before it ships to the LLM.
- **Custom message roles** via TypeScript declaration merging into `CustomAgentMessages`. New roles only become visible to the LLM when `convertToLlm` projects them; the agent's `state.messages` retains the raw form for UI rendering. Compaction (`compactionSummary`) and bash execution (`bashExecution`) already use this mechanism in pi.
- **`prepareNextTurn` hook**: runs after `turn_end` and before the next LLM call; returns an optional `AgentLoopTurnUpdate` that can replace context/model/thinking state. The `Agent` class exposes it with signature `(signal?: AbortSignal) => Promise<AgentLoopTurnUpdate | undefined>` — session is captured via closure. The natural place to inject "world has changed since last turn" updates. (Pi also exposes adjacent hooks: `shouldStopAfterTurn`, `getSteeringMessages`, `getFollowUpMessages`, `beforeToolCall`, `afterToolCall` — all useable from the same extension.)
- **Built-in extension API**: tools, slash commands, keybindings, UI components, event hooks, custom providers — all the surfaces brunch needs to fold its record tools into the agent without modifying pi.
- **JSON-RPC protocol** already shipped as `modes/rpc/` (`RpcCommand`, `RpcResponse`, `RpcEventListener`). The same vocabulary becomes brunch's WS protocol for the browser.

### 3.2 Two agents, one record store (not one agent with four faces)

A clarification that emerged in the transcript: the four modes are four ways to drive the **coding agent**. The browser, when given its own tool surface, is effectively a second agent product (mirroring pi-web-ui's relationship to pi-coding-agent). Brunch can stay simpler than pi here by running **one agent**, in Node, and presenting it to the browser as a remote head over WS. The intent graph is the shared spine; the agent is shared too.

### 3.3 Process topology

```diagram
                       user runs `brunch [--mode …]`
                                   │
                                   ▼
                       ╭─────────────────────╮
                       │  brunch CLI         │
                       │  (single binary)    │
                       ╰─────────┬───────────╯
        ┌──────────────┬─────────┴─────────┬─────────────────┐
        ▼              ▼                   ▼                 ▼
   (default TUI)  --mode web          --mode rpc        --mode print
        │              │                   │                 │
        │              ▼                   │                 │
        │      ╭───────────────╮           │                 │
        │      │ local HTTP +  │           │                 │
        │      │ WS server     │           │                 │
        │      ╰───────┬───────╯           │                 │
        ▼              ▼                   ▼                 ▼
   ╭──────────────────────────────────────────────────────────────╮
   │  SHARED LAYER: brunch agent host                             │
   │    AgentSessionRuntime (pi-coding-agent SDK)                 │
   │    brunch extension (record tools + worldUpdate role)        │
   │    curated system prompt + curated toolset                   │
   │    services bundle pointed at .brunch/                       │
   ╰──────────────────────────────┬───────────────────────────────╯
                                  ▼
                       ╭─────────────────────────╮
                       │   .brunch/  (per-cwd)   │
                       │   data.db (SQLite)      │
                       │   sessions/*.jsonl      │
                       │   auth.json             │
                       │   settings.json         │
                       ╰─────────────────────────╯
```

## 4. Transport: one protocol

**Position (after retracting an earlier sketch that paired JSON-RPC with REST endpoints):** the browser, headless drivers, internal agent tools, and TUI slash commands all funnel through one set of typed command functions. The transport differs (WS, stdio, in-process); the vocabulary doesn't.

```diagram
                       ╭─────────────────────╮
                       │   commands.ts       │  ← single source of truth
                       │   - typed verbs     │
                       │   - authority gate  │
                       │   - event emit      │
                       ╰──────────┬──────────╯
                                  │ called by
   ┌──────────────┬───────────────┼───────────────┬────────────────┐
   ▼              ▼               ▼               ▼                ▼
records.*    session tool     web HTTP        webhook        slash command
RPC method   handlers         shim            receiver       (TUI)
   │              │               │               │                │
   └────────┬─────┴───────┬───────┴───────┬───────┴────────────────┘
            ▼             ▼               ▼
     browser WS     agent (Node,    external HTTP
                    in-process)     callers
```

### 4.1 Primary surface: JSON-RPC

Methods exposed on the dispatcher:

```
session.*
  session.prompt        { text, attachments? }
  session.abort         { sessionId }
  session.subscribe     { sessionId } → stream of session events
  session.list / get / create / branch / fork
  session.modelInfo / setModel

records.*
  records.query         { type, where, orderBy, limit, cursor }
  records.get           { type, id }
  records.create        { type, data, idempotencyKey }
  records.update        { type, id, ifVersion, patch }
  records.delete        { type, id, ifVersion }
  records.subscribe     { type?, id? } → snapshot + stream of records.changed
  records.unsubscribe   { subscriptionId }

graph.*
  graph.currentLsn      → number
  graph.changesSince    { lsn, filters? }
  graph.coherence       → { state, computed_at_lsn, violations }
```

Server-pushed events: `session_event`, `records.changed`, `graph.coherence_changed`.

### 4.2 Secondary surface: minimal HTTP shim

Only where the transport itself matters; never used by the browser SPA's data plane.

```
GET    /                          → static SPA bundle
GET    /api/health                → liveness
GET    /api/records/:type/:id     → curl-friendly shim over records.get
POST   /webhooks/:source          → translates payloads into records.* commands
POST   /api/uploads               → multipart, returns blob id usable in records.*
```

Each HTTP handler delegates to the same internal command function the RPC dispatcher uses. No second source of truth.

## 5. Records / intent graph

### 5.1 Storage

SQLite via `better-sqlite3`, file at `.brunch/data.db`. Three structural tables:

```sql
CREATE TABLE graph_clock (lsn INTEGER PRIMARY KEY);

CREATE TABLE change_log (
  lsn         INTEGER PRIMARY KEY,
  ts          INTEGER NOT NULL,
  actor       TEXT    NOT NULL,   -- {kind, id, on_behalf_of?}
  op          TEXT    NOT NULL,   -- create | update | delete | edge_add | edge_remove
  record_type TEXT    NOT NULL,
  record_id   TEXT    NOT NULL,
  diff        BLOB    NOT NULL,   -- json patch
  invariants_violated TEXT        -- nullable; populated by validator
);

CREATE TABLE coherence (
  id              INTEGER PRIMARY KEY,
  computed_at_lsn INTEGER NOT NULL,
  state           TEXT    NOT NULL,  -- clean | dirty | validating | incoherent
  violations      BLOB    NOT NULL   -- json[]: { rule_id, scope, message, evidence, severity }
);
```

Domain tables (records and edges) carry per-row `version` columns derived from the change log. Schemas defined with TypeBox so the same shape covers TS types, runtime validation, and tool-input schemas.

### 5.2 Authority model

Composed from pi primitives:

1. **Agent acts as delegate of authenticated user.** Every command carries `actor: { kind, id, on_behalf_of? }`. AuthStorage is reused as the identity source.
2. **Authority is field-level**, declared in TypeBox schemas via `@authority` annotations (agent-writable, user-only, either). The server enforces on every command regardless of caller.
3. **Three tiers of agent action**, mirroring `ToolExecutionMode`:
   - autonomous (reads, agent-owned writes)
   - requires confirmation (shared writes, deletions) — surfaced via pi's tool-approval flow
   - human-only — tool returns a structured `{ status: "requires_human", reason }` outcome; the agent decides whether to escalate to the user via UI prompt, slash command, or non-zero exit
4. **Commands, not CRUD.** Verbs match domain transitions (`approve_invoice`, `assign_owner`), so the authority gate sees intent, not just bytes. Generic `records.update` exists but is a low-trust fallback.
5. **Optimistic concurrency on every write.** `ifVersion` echoes the version the caller read; mismatch returns `{ ok: false, code: "version_conflict", current }` and the caller re-reads.
6. **Subscriptions are the agent's "watch" channel.** Sessions can subscribe to record changes; updates flow back into the next turn via the worldUpdate mechanism (§7).

### 5.3 Headless-mode behavior for confirmation-gated actions

Print mode has no human, so confirmation-gated and user-only commands either:
- Refuse with a structured outcome and a non-zero exit (default), or
- Proceed under an explicit `--auto-approve=safe|all` policy.

RPC mode forwards the gate decision to the driver process as an event; the driver answers using its own UI or policy.

## 6. Frontend (React)

The browser is a thin remote head over the JSON-RPC dispatcher via one WebSocket. No REST in the data plane.

### 6.1 Three primitives over one transport

| Primitive | Maps to | Used for |
|---|---|---|
| Query     | `rpc.call(method, params)`, response cached by `(method, params)` | Reads with no live-update need (schemas, dropdowns) |
| Subscription | `records.subscribe` → snapshot + stream | Any record view (lists, detail pages, dashboards) |
| Mutation  | `rpc.call(...)`, optimistic update + invalidate | Writes (`records.*`, `session.*`) |

### 6.2 Implementation choice

- One `RpcClient` singleton: connect/reconnect, request/response id map, subscription map, re-subscribe on reconnect.
- TanStack Query for cache, dedup, optimistic updates, and re-render scheduling.
- `useSubscription` is a ~30-line bridge: `useQuery` for the initial snapshot (`staleTime: Infinity`), `useEffect` opens the RPC subscription and pushes updates into the query cache via `setQueryData`.
- Routing via TanStack Router; loaders pre-warm the cache with `ensureQueryData` so route components mount with data already present.
- Optional optimization: brunch's `/` HTML handler can run a small set of initial queries server-side and bake their results into `<script id="__initial_cache">`; the React app seeds the cache before any WS roundtrip. Ship without it first.

### 6.3 Properties the architecture guarantees

- Every view is **eventually consistent with the record store by construction**. Agent writes, user edits in another tab, and webhook updates all show up automatically.
- Optimistic concurrency surfaces conflicts at write time with `version_conflict`; the UI offers discard/merge/keep without polling or stale warnings.
- No data-loading waterfalls: JS load and WS open run in parallel; subscriptions start as soon as the bundle parses.

## 7. Continuity of context across turns (the coherence loop)

The hardest problem in this architecture, and the one the design must solve at one well-defined point. The transcript decomposes it into four orthogonal questions:

```diagram
╭─ "Has the world changed since my session last looked?" ─────╮
│  Q1: DETECTION   — Did anything change at all?              │
│  Q2: RELEVANCE   — Of what changed, what matters to me?     │
│  Q3: COHERENCE   — Is the graph still globally legal?       │
│  Q4: RECONCILE   — How does the agent learn about it?       │
╰─────────────────────────────────────────────────────────────╯
```

### 7.1 Detection (monotonic clock)

`graph_clock` advances on every write. `change_log` appends one row per write. A session keeps `lastSeenLsn`; the gross filter is `currentLsn > lastSeenLsn`.

### 7.2 Relevance (per-session interest set)

Three layers, persisted alongside session state:

| Layer | Members | When added |
|---|---|---|
| Direct | Record IDs the session read, wrote, or subscribed to | On every records.* call |
| Mentioned | Record IDs appearing in user/assistant text | On message ingest (regex on `record:` URIs, optional LLM pass during compaction) |
| Neighborhood | 1-hop edges out from Direct + Mentioned | Computed at query time, not stored |

The interest set lives in `.brunch/sessions/<id>.jsonl` as a new entry kind.

### 7.3 Coherence (separable, queryable property)

- **Structural validation** runs synchronously on every write. Local invariants enforced as DB constraints or per-command precondition checks. The graph is never structurally illegal.
- **Semantic validation** runs asynchronously (debounced) against the global graph or affected subgraphs. Writes a new `coherence` row each time. Graph can be `clean` / `dirty` / `validating` / `incoherent`.
- `coherence.computed_at_lsn` records the freshness of the verdict — the agent and UI both know whether the verdict is current.

### 7.4 Reconciliation (turn-boundary injection)

The single architectural point where all of the above lands. Brunch's pi extension installs a `prepareNextTurn` closure on the `Agent` (signature `(signal?) => Promise<AgentLoopTurnUpdate | undefined>`); the session and records client are captured in the closure scope:

```ts
function installWorldUpdateHook(agent: Agent, session: BrunchSession, records: RecordsClient) {
  agent.prepareNextTurn = async (signal) => {
    const currentLsn = await records.getCurrentLsn();
    if (currentLsn === session.lastSeenLsn) return undefined;

    const events   = await records.changesSince(session.lastSeenLsn, { excludeActor: session.id });
    const relevant = filterByInterestSet(events, session);
    const coh      = await records.getCoherenceState();
    session.lastSeenLsn = currentLsn;

    if (relevant.length === 0 && coh.state === "clean") return undefined;

    return {
      messagesToAppend: [{
        role: "worldUpdate",
        relevantChanges: relevant,
        coherenceState: coh,
        timestamp: Date.now(),
      }],
    };
  };
}
```

A new custom role is declared and projected:

```ts
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages { worldUpdate: WorldUpdateMessage; }
}

// in convertToLlm:
case "worldUpdate":
  return { role: "user", content: [{ type: "text", text: formatWorldUpdate(m) }] };
```

The rendered text reads as a user-attributed note at the top of the next turn, listing relevant changes, the coherence verdict, violations, and suggested follow-ups (re-read records, revise plans, decline conflicting writes, help resolve violations).

### 7.5 Within-turn consistency

A turn operates against a snapshot. Mid-turn writes from other actors do not interrupt; they surface at the next turn boundary. At turn-end, the runtime may check whether any read-set records were modified by another actor since the turn started; default policy is **accept-and-flag**: writes land, `coherence` flips to `dirty`, the validator re-runs. Reject-on-conflict and last-writer-wins are alternatives left for later.

### 7.6 Compaction must carry the coherence anchor

When the conversation compacts, the compaction summary includes the interest set and the most recent coherence verdict — otherwise the compacted session loses its grip on the graph. This belongs in the pi `transformContext` hook brunch overrides.

## 8. Mode-by-mode capability matrix

Capabilities are not symmetrically exposable across all four modes; the asymmetry follows from the medium.

| Capability | TUI | Web | Print | RPC |
|---|---|---|---|---|
| Read records / queries | ✓ | ✓ | ✓ (json dump) | ✓ |
| Write agent-owned fields | ✓ | ✓ | ✓ | ✓ |
| Subscribe to live updates | ✓ | ✓ | n/a | ✓ (event stream) |
| Confirmation-gated writes | ✓ (dialog) | ✓ (modal) | needs `--auto-approve` | ✓ (driver decides) |
| User-only writes | ✓ (suspend + prompt) | ✓ (native form) | **cannot service** | ✓ only if driver is a UI |
| Direct user editing without invoking agent | awkward | natural | n/a | n/a |
| Multi-user simultaneous | poor | natural | n/a | depends on driver |
| Tool execution attribution | ✓ | ✓ | ✓ | ✓ |

Design rule: **all functionality is exposable through the human-interactive modes; the headless modes expose everything that doesn't require a live human, plus a structured `requires_human` outcome.**

## 9. Escalating list of architectural features to be proven

Ordered so each tier validates the next tier's foundation. Each milestone is a thin vertical slice that yields a runnable, demoable system.

### M0 — Walking skeleton (Node binary + TUI)
Prove the wrapping model works at all.

- `brunch` binary in `package.json`.
- Default invocation either calls pi's `main(args, options)` with curated args, or constructs the lower-level pieces directly: `createAgentSessionServices` → `createAgentSessionRuntime` → `new InteractiveMode({...}).run()`.
- `.brunch/` directory creation; pi services pointed at it (via `agentDir`); auth/sessions/settings all live there.
- Curated toolset: a small subset of pi's built-in coding tools.
- Curated system prompt that does not leak pi's default coding-assistant identity.
- No extensions, no records yet.
- **Done when:** `brunch` opens a TUI chat session in a project dir, persists session JSONL in `.brunch/sessions/`, and the user can talk to the model.

### M1 — Mode shell (print + rpc delegated)
Prove the mode dispatcher.

- Brunch builds an `AgentSessionRuntime` once via `createAgentSessionRuntime`, then dispatches to a mode based on flags.
- `brunch --mode print "..."` delegates to `runPrintMode(runtimeHost, options)`.
- `brunch --mode rpc` delegates to `runRpcMode(runtimeHost)`; existing pi RPC clients work unmodified.
- Default mode constructs `new InteractiveMode({...}).run()` against the same runtime.
- **Done when:** all three pi-backed modes run from one binary, all reading/writing the same `.brunch/`.

### M2 — JSON-RPC dispatcher + web shell
Prove the universal protocol surface and the browser transport.

- New internal `commands.ts` layer with typed `session.*` verbs that wrap pi's session API.
- A general RPC dispatcher that the stdio (M1) and WS transports both call into.
- `brunch --mode web` starts an HTTP server, serves a stub SPA at `/`, opens WS at `/ws`, exposes `session.*` over RPC.
- Browser stub uses one RpcClient + a single `useSubscription("session.subscribe")` view to show streaming messages, plus a `useMutation("session.prompt")` form.
- **Done when:** opening `http://localhost:<port>` shows live agent output and lets the user send prompts, talking only over WS.

### M3 — Records data plane (SQLite + commands)
Prove the structured data layer in isolation.

- `.brunch/data.db` with `graph_clock`, `change_log`, plus one or two domain tables.
- `commands.ts` gains `records.*` verbs; authority gate stub (everything autonomous for now); optimistic concurrency via `ifVersion`.
- `records.subscribe` emits snapshot + change events over WS.
- A trivial record-browser route in the SPA: list, detail, edit (`useSubscription` + `useMutation` with rollback).
- **Done when:** editing a record in the browser, in two tabs, propagates live; the change_log shows every write with actor attribution.

### M4 — Agent ↔ records integration
Prove that the agent can manipulate records through pi's extension API.

- Internal brunch pi extension registers `record_query`, `record_get`, `record_create`, `record_update`, `record_subscribe` tools.
- Tool input schemas mirror records.* command shapes; tool implementations call `commands.ts` in-process (no transport).
- System prompt extended with a "Records" section describing schema and authority tiers.
- `convertToLlm` override added to handle brunch's custom message roles.
- **Done when:** the agent can read and write records from the TUI; a tab open in the web UI sees the same changes flow in live.

### M5 — Authority model and gated tools
Prove the three-tier authority model end-to-end.

- Field-level authority annotations on schemas; server enforces.
- Confirmation-gated writes surface through pi's tool-approval flow in TUI; modal in web UI; event-back-to-driver in RPC; `requires_human` outcome in print mode (with `--auto-approve` opt-in policy).
- Per-write `actor` attribution propagated through commands and into change_log rows.
- **Done when:** every record write, regardless of mode, goes through the same gate, with consistent attribution and consistent gate behavior.

### M6 — Intent graph: detection + relevance + reconciliation
Prove the continuity-of-context loop end-to-end (Q1, Q2, Q4 of §7).

- Session state tracks `lastSeenLsn` and Direct interest set (no Mentioned, no Neighborhood yet).
- `prepareNextTurn` hook implemented in brunch's extension: detects LSN drift, filters by Direct interest set, emits a `worldUpdate` custom message when relevant.
- Default `convertToLlm` projection of `worldUpdate` to a user-text turn.
- **Done when:** two TUI sessions in the same project (or one TUI + one browser edit) cause the second session to receive a "world changed" note before its next LLM call.

### M7 — Coherence as a first-class graph property (Q3)
Prove that the graph carries a coherence state separable from any single write.

- Sync structural validation enforced at commit (DB constraints + per-command checks).
- Async semantic validator subscribes to `records.changed`, debounces, recomputes global rules, writes `coherence` rows.
- `graph.coherence` RPC method + `graph.coherence_changed` event.
- `worldUpdate` messages include the latest coherence verdict and violations.
- Web UI shows a coherence badge and clickable violations.
- **Done when:** introducing a deliberate cross-record contradiction (via UI or agent) shows up as `incoherent` in browser, TUI, and the next agent turn — all referencing the same `computed_at_lsn`.

### M8 — Compaction-aware continuity
Prove that long sessions retain their grip on the graph after compaction.

- `transformContext` override produces a `compactionSummary` that includes the session's interest set and most recent coherence verdict, not just the prose summary.
- **Done when:** a compacted session, after several worldUpdate injections, still references the right records by id and still surfaces coherence violations relevant to its prior turns.

### M9 — Interest set widening + read-set conflict
Prove the tunable false-positive controls.

- Add Mentioned set (regex on `record:` URIs in messages; optional LLM extraction during compaction).
- Add Neighborhood depth (1-hop, configurable) computed at query time.
- Implement turn-end accept-and-flag: writes land but coherence flips to `dirty` immediately if read-set conflicts are detected; the validator re-runs.
- **Done when:** the agent stops being startled by unrelated edits (no spurious worldUpdate noise), and concurrent edits during long turns get explicit dirty-state flagging.

### M10 — HTTP shim (webhooks, uploads, permalinks)
Prove the transport-driven HTTP surface without polluting the data plane.

- `POST /webhooks/:source` translates payloads to `records.*` commands via the same `commands.ts`.
- `POST /api/uploads` returns blob ids usable in record fields.
- `GET /api/records/:type/:id` as a curl shim.
- SPA permalinks (e.g. `/r/<type>/<id>`) load the standard shell and subscribe over WS.
- **Done when:** a webhook updates a record and every open browser tab sees it live, and a `curl` user can read records without a WS client.

### M11 — pi-web-ui component reuse (deferred decision)
Decide whether to depend on `pi-web-ui` after the SPA exists.

- Audit which pi-web-ui components — message rendering, attachment handling, model picker, sandboxed artifacts — are worth importing.
- If yes: build a `RemoteAgent` proxy that satisfies the bits of `Agent` those components read (state.messages, state.tools, subscribe, prompt, abort), forwarding over WS.
- If no: keep the bespoke React app and skip the dependency.
- **Done when:** decision recorded, with concrete components either imported or replaced.

## 10. Non-goals for the POC

These are explicitly out of scope for the milestones above, to be added only if real usage demands them:

- Multi-tenancy / multi-project orchestration. POC is single-cwd, single-user.
- Remote `brunch` deployment. The HTTP/WS server is bound to localhost.
- A user-facing pi extension API. Brunch is opinionated; users see only brunch's CLI flags.
- A second persistence backend. SQLite is the only target; an `AuthStorageBackend`-style interface seam can be added later if needed.
- Plan/scheduling features layered on the intent graph (the graph itself is the unit being proven).
- Cross-project intent graph references.

## 11. Open questions worth tracking

Not blockers for any milestone but worth carrying as decisions surface:

- **Hard vs soft incoherence response policy.** Severity field on violations is straightforward; how the agent's system prompt instructs response to each severity is design work.
- **Initial-cache injection in `/`** — worth measuring perceived snappiness before committing.
- **Whether `worldUpdate` is one message kind or several** (e.g. separate `recordChange` and `coherenceChange` roles) — affects how granularly the agent can be instructed to react.
- **Mid-turn LLM-driven interest extraction** — adds an LLM call per compaction; trade-off between recall and cost.
- **TanStack Router vs simpler router** — TanStack Router's loader pattern composes well with the subscription model, but pulls a non-trivial dep; defer until route count justifies it.
