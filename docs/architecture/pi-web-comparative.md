# Pi wrapper comparative — pi-web vs Brunch

This is a sibling document to [pi-wrapper-comparative.md](pi-wrapper-comparative.md) (howcode vs Brunch). It compares another architecture that wraps the same upstream coding-agent SDK (`@earendil-works/pi-coding-agent`, "Pi") behind a web UI:

- **pi-web** ([github.com/jmfederico/pi-web](https://github.com/jmfederico/pi-web)) — a split-process Fastify + Vite/Lit web app with a standalone session daemon and trusted remote-machine federation, built as a browser-based control plane over live Pi sessions.
- **Brunch** — this repository; a pre-release POC product whose canonical artifact is an intent-graph spec, with Pi acting as one engine among several.

As with the howcode comparison, the point is not to evaluate pi-web. It is to use a contemporaneous, opposite-thesis wrapper as a mirror for Brunch's own architectural commitments. pi-web sits on the **same side as howcode** — "wrap Pi as the product" — but pushes further than howcode into operations and distribution (a process-isolated daemon and multi-machine federation). That makes it the sharper mirror for two Brunch commitments the howcode comparison only grazed: the **read-only web sidecar welded to a single TUI writer** (R8 / D33-L) and the **private Pi flush dependency** (R1).

The recommendations at the end are Brunch-specific guard-rails, not a refactor agenda. Dependencies use SPEC.md decision/assumption IDs; risk numbers (R1, R6, R8) refer to the risk register in [pi-wrapper-comparative.md §5](pi-wrapper-comparative.md).

> Naming caution: there are two unrelated `pi-web` repositories. This document is about **`jmfederico/pi-web`** (Fastify + Vite/Lit, WebSocket, session daemon, federation). A different `agegr/pi-web` is a Next.js + SSE app with an in-app Pi runtime; it is **not** the subject here.

## 1. Architectures at a glance

### pi-web

```pseudo
processes (three, independently restartable):
  Client (browser)
    Vite + Lit custom elements
    single AppState object (appState.ts)
    imperative domain controllers:
      Session / Activity / Auth / Workspace /
      Project / Machine / FileExplorer / Git
    SessionSocket + RealtimeSocket (manual reconnect/backoff 500ms→5000ms)
    browser-side plugin loader (dynamic import from manifest)
  Web/API process (pi-web-server)
    Fastify; @fastify/websocket; @fastify/static
    proxies HTTP + WS to the daemon (SessionDaemonClient)
    serves client bundle + /pi-web-plugins/* assets
  Session daemon (pi-web-sessiond)
    SessionEventHub / AuthService / PiSessionService / TerminalService
    imports @earendil-works/pi-coding-agent IN-PROCESS
    createAgentSessionServices + createAgentSessionFromServices
    keeps live runtimes alive across browser/web restarts

stores:
  Pi JSONL sessions (Pi's default session storage)
    canonical for: transcripts/history
  ~/.pi-web/projects.json, ~/.pi-web/machines.json
    canonical for: project + trusted-machine control plane
  workspaces: discovered, not stored
  active runtimes + WebSockets: daemon memory
```

- Pi binding: SDK imported **in-process inside the daemon** via `PiSessionService`. The web/API process holds no Pi runtime; it is a proxy + static host.
- Public surface: **route/resource-oriented HTTP + path-scoped WebSockets**, federated under `/api/machines/:machineId/...`. Sessions are a REST-ish verb set: `GET /sessions`, `POST /sessions/:id/prompt`, `/model`, `/thinking-level`, `/shell`, `/commands/run`, `/abort|stop|archive|restore`. Realtime is `/api/sessions/:id/events`, `/api/sessions/events`, `/api/events`, plus a separate terminal socket.
- Worldview: a thin **machine → project → workspace → session** control plane, but below that line Pi-native concepts are exposed almost verbatim — models, thinking levels, slash commands, `tool.start/update/end`, `shell.*`, `pi.event`, auth providers, terminals, Pi-shaped prompt attachments.
- Distinctive reach: **trusted remote-machine federation** — drive agents on remote machines through one browser control plane. An **AuthService** (providers / api-key / OAuth) exists because of this.
- Extensibility: pi-web's **own browser-side UI plugin system** (`activate(context)` → `actions`, `workspacePanels`, `workspaceLabels`, `themes`). Not sandboxed, no server hooks, does not run in the daemon. Discoverable from bundled plugins, `~/.pi-web/plugins`, and installed Pi packages exposing `piWeb.plugins`. Separately, pi-web ships a small Pi extension registering a `/pi-web` command.

### Brunch

```pseudo
modes (same Node process for tui/print; separate surfaces for rpc/web):
  tui
    embeds Pi in-process via InteractiveMode
    sealed Brunch Pi profile (no ambient .pi/ discovery)
    statically imported Brunch extension shell
    workspace coordinator owns spec/session/graph state (the one writer)
    optional web sidecar attaches (read-mostly)
  rpc
    JSON-RPC line server over stdio
    same coordinator, full mutation surface (createRpcHandlers)
  web
    HTTP + WebSocket sidecar (startWebHost)
    createReadOnlyRpcHandlers by default;
      createWebSidecarRpcHandlers adds session.driveTurn / session.answerExchange
      only when a driver/broker handle is attached
    serves the React+Vite SPA from dist-web
    --mode web (standalone, no TUI) is deferred and throws
  print
    state render of workspace state, no agent loop

stores:
  Pi JSONL transcript (.brunch/sessions/*.jsonl)
    canonical for: session_binding, agent_runtime_state, structured_exchange tuples, worldUpdate
  SQLite via Drizzle (.brunch/data.db)
    canonical for: specs, nodes, edges, change_log, reconciliation_needs
  .brunch/workspace.json
    project identity, posture, current/default spec+session
```

- Pi binding: SDK imported in-process; a sealed Brunch Pi Profile disables ambient `.pi/` discovery (D39-L) and injects an explicit, statically-imported extension shell.
- Public surface: Brunch's own JSON-RPC — never Pi's. Named families `workspace.*`, `session.*`, `graph.*`, `rpc.discover`. Graph mutations route through a Brunch `CommandExecutor` independently of Pi (D4-L, D20-L).
- Worldview: `workspace(cwd) → spec → session`. The product artifact is the **intent graph in SQLite**; Pi just invokes `mutate_graph` / `accept_review_set` tools that route to the executor. Pi concepts are forbidden from reaching clients (R27).
- Concurrency: one-writer / many-observer. The browser attaches read-mostly by D33-L; session identity is never inferred from transport.
- Read-model discipline: D19-L forbids mirror stores, generic read APIs, and canonical cross-store event spines. `brunch.updated` is a process-local invalidation hint; clients refetch named projections (TanStack Query).

## 2. The actual disagreement

```diagram
╭─────────────────────────────────╮          ╭───────────────────────────────────╮
│ pi-web                          │          │ Brunch                            │
│                                 │          │                                   │
│  Pi AgentSession                │          │  Brunch product state             │
│  (+ remote machines)            │          │  (workspace → spec → session,     │
│        ▲                        │          │   intent graph in SQLite,         │
│        │ surface adapts to Pi   │          │   reconciliation needs)           │
│        │                        │          │        ▲                          │
│  REST per-session routes +      │          │        │ surface IS the product   │
│  path-scoped WS event streams   │          │        │                          │
│        ▲                        │          │  Named JSON-RPC families          │
│        │                        │          │  (workspace.*, session.*,         │
│  Fastify proxy + session daemon │          │   graph.*, rpc.discover)          │
│        ▲                        │          │        ▲                          │
│  Lit control-plane shell        │          │  Pi (in-process, sealed profile)  │
│  (machine/project/workspace)    │          │  is one engine populating         │
│                                 │          │  product state, not the center    │
╰─────────────────────────────────╯          ╰───────────────────────────────────╯
   "wrap Pi as the product,                     "wrap Pi as infrastructure"
    then distribute it"
```

| Axis                       | pi-web                                                        | Brunch                                                                          |
|----------------------------|--------------------------------------------------------------|---------------------------------------------------------------------------------|
| Canonical human object     | session (under machine/project/workspace)                    | spec graph (sessions bound under specs)                                          |
| Public contract            | REST per-session routes + path-scoped WebSockets             | named JSON-RPC method families + `rpc.discover`                                  |
| Pi visibility to clients   | exposed — models, thinking, commands, tool/shell events, terminals | explicitly forbidden by R27                                                |
| Persistence                | Pi JSONL + `~/.pi-web/*.json` control plane; runtimes in daemon memory | Pi JSONL = transcript truth; SQLite = graph truth                       |
| Mutation authority         | every action flows through `AgentSession`                    | graph mutations through `CommandExecutor`, independent of Pi (D4-L, D20-L)       |
| Process model              | **3 processes; daemon outlives browser and web/API**         | tui writer process + read-mostly web sidecar; `--mode web` deferred             |
| Concurrency                | many clients attach to a live daemon session                 | one-writer / many-observer; web read-mostly (D33-L)                              |
| Reach                      | **multi-machine federation** (trusted remote machines)       | single cwd; multi-machine is a non-goal                                          |
| Pi profile                 | inherits ambient Pi; ships a `/pi-web` Pi extension          | sealed profile (D39-L); ambient `.pi/` disabled                                  |
| AuthN/Z                    | first-class AuthService (providers / api-key / OAuth)        | none — local single-user                                                         |
| Client state              | single mutable `AppState` + imperative controllers + manual WS reconnect | TanStack Query cache + refetch-on-hint                                |
| Extensibility (clients)    | own browser-side UI plugin system (unsandboxed)              | none exposed; Pi extension/skill/theme APIs hidden in POC                        |
| Escape hatch               | terminals + Pi-native passthrough (you can always reach Pi)  | none — leaving the product model means leaving Brunch                            |

- **pi-web says**: wrapping means *adapting Pi to a better, distributable runtime environment* while preserving Pi's session worldview — and then adding an operations layer (daemon, machines, auth) on top. The agent session is the product; the value-add is supervision and reach.
- **Brunch says**: wrapping means *preventing Pi's worldview from leaking out* and forcing all interactions through product semantics. The graph spec is the product; Pi is infrastructure.

Neither is "more correct." But pi-web demonstrates two capabilities Brunch has deliberately not built — **session survivability** and **multi-machine reach** — and that absence is where the most useful critique lands.

## 3. Tradeoffs

### What each architecture makes cheap and expensive

#### pi-web
- **Cheap**: session survivability across disconnect/restart (the daemon owns runtimes); multi-machine operation; Pi feature parity for free (models, thinking, terminals, tool/shell streams); native ops affordances (file tree, git, terminals); browser-side UI extension without touching the server.
- **Expensive**: anything that is not naturally a session/thread; durable product semantics beyond conversation; a stable client contract decoupled from Pi's churn; multi-observer consistency guarantees (event ordering and reconnect-gap recovery are hand-rolled); a canonical model if non-chat features arrive.

#### Brunch
- **Cheap**: canonical product semantics independent of Pi phrasing; named projections over stable stores; deterministic probe verification; transport independence; swapping agent roles without changing the client contract; strong authority around graph mutation.
- **Expensive**: ambient freeform agent UX; Pi feature parity; session survivability (the writer lives in the TUI process); multi-machine reach; browser-side writing today; iterating fast on product shape if the ontology turns out wrong.

### The hostile critiques worth keeping

- **Against pi-web**: it exposes Pi's event and session worldview directly to the browser and hand-rolls client state over raw streams, so Pi version drift ripples into the UI and correctness (ordering, missed-events-during-reconnect) rests on imperative controller code. Below its thin control plane there is no canonical model, so non-chat product state would accrete as synchronization debt — the same trajectory the howcode comparison flagged.
- **Against Brunch**: it has built session survivability *out* of the architecture by welding the one writer to the TUI process, and it depends on **private** Pi flush internals at its most load-bearing seam — so the project whose thesis is "seal Pi away" is, at that seam, *more* exposed to a Pi upgrade than pi-web, which stays on public session APIs. And the broader howcode critique still stands: Brunch is proving it is not Pi before proving users want the non-Pi worldview strongly enough.

The second Brunch critique is the more important one. pi-web makes it concrete: a process boundary Brunch does not have is exactly what would let Brunch lift the read-only web constraint safely.

## 4. Cross-pollination — what is safe to borrow

### Brunch borrowing from pi-web

| Tactic                                              | Verdict              | Notes                                                                                                                                       |
|-----------------------------------------------------|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| **Process-isolated session daemon** (writer outside the TUI) | ✅ borrow the shape | The strongest lesson. Move the workspace/session writer into a standalone process; TUI and browser both attach as clients. Unblocks R8 / D33-L without multi-writer races. See §7.1. |
| REST per-session routes as the public contract      | ❌ do not borrow     | Would leak Pi/session semantics into the contract and undercut D5-L, D19-L, R27. Brunch keeps named JSON-RPC families + discovery.          |
| Raw Pi event/tool/shell passthrough to clients      | ❌ do not borrow     | Direct contradiction of R27; couples the client to Pi's churn. Brunch projects product-shaped state, not Pi events.                          |
| Imperative single-`AppState` + manual WS reconnect  | ❌ do not borrow     | Brunch's refetch-on-hint (Query cache invalidated by `brunch.updated`) is more robust to dropped events. Do not replace it with patching.    |
| Multi-machine federation                            | ⚠️ defer, not now    | A real future axis, but a POC non-goal. If it arrives, it enters through an explicit SPEC posture change, not by generalizing the sidecar.   |
| First-class AuthService (OAuth / api-key)           | ⚠️ only with remote  | Auth is a consequence of remote/federation. Local single-user Brunch needs none until it leaves the single-machine posture.                 |
| Browser-side UI plugin system                       | ❌ do not borrow     | Brunch hides Pi's extension/skill/theme APIs in the POC by design; an unsandboxed browser plugin layer would reopen exactly that surface.    |
| Terminals / git panels as first-class product objects | ❌ do not borrow   | These are Pi-native ops affordances, not Brunch product objects. They belong to the "Pi console" thesis Brunch rejects.                      |

### What pi-web could (hypothetically) gain from Brunch

Included only for symmetry; no Brunch action items.

- A discoverable named contract (`rpc.discover`) and refetch-on-hint read model would decouple its client from Pi's churn and ease a multi-client/automation story.
- A canonical domain model below the control plane would prevent synchronization debt if non-chat product semantics ever arrive.
- These would actively damage pi-web's strength as a Pi-native, distributable console, so they are not appropriate for it.

## 5. Risks this mirror sharpens

This comparison does not introduce a new Brunch risk register; it sharpens three entries already in [pi-wrapper-comparative.md §5](pi-wrapper-comparative.md) by showing a wrapper that resolved the underlying tension a different way.

### R8 — read-only web sidecar / single-writer coupling (severity: medium, raised by this mirror)

pi-web makes the cost legible. Brunch's writer lives **inside the TUI process**; the web host serves `createReadOnlyRpcHandlers` and only accepts `session.driveTurn` / `session.answerExchange` when a driver/broker handle is attached ([web-host.ts](../../src/rpc/web-host.ts), [handlers.ts](../../src/rpc/handlers.ts)). `--mode web` (standalone) deliberately throws ([brunch.ts](../../src/app/brunch.ts)). Two consequences follow that pi-web does not have:

- **No session survivability.** If the TUI process dies, the live session dies. pi-web's daemon keeps runtimes alive across browser *and* web/API restarts.
- **A product ceiling.** Lifting read-only by adding mutation methods to the sidecar would introduce silent multi-writer races against the same Pi JSONL transcript — the failure D33-L exists to prevent.

- **Why it matters**: both limits trace to the same missing process boundary. The fix is structural, not incremental.
- **Owning SPEC items**: D33-L (web read-only / transport vs session identity), R12 (JSON-RPC primary), NO-3 (one writer in POC).
- **Mitigation**: §7.1 — extract the writer into a session daemon so the one-writer invariant is enforced by a process that outlives every client.

### R1 — private `SessionManager` flush dependency (severity: high; the irony this mirror exposes)

Brunch forces pre-assistant persistence through private-ish Pi behavior (`_rewriteFile()`, `setSessionFile(...)`). pi-web, by contrast, stays on public construction APIs (`createAgentSessionServices`, `createAgentSessionFromServices`, `SessionManager`).

- **Why it matters**: the project whose thesis is "seal Pi away" has, at its single most load-bearing contact point, a **more** fragile dependency on Pi internals than the project that embraces Pi. A Pi minor bump could break Brunch silently here while leaving pi-web untouched.
- **Owning SPEC items**: A1-L (Pi seam sufficiency), D1-L (depend on `pi-coding-agent`), D17-L (Pi transcript substrate).
- **Mitigation**: unchanged from the howcode doc — centralize the call sites behind one Brunch-side adapter and add a contract test that fails on Pi upgrades that change the observable flush ordering. This is the first debt to pay (§7.2).

### R6 — architecture outrunning evidence (severity: medium, reaffirmed)

pi-web shipped a multi-machine agent console — daemon, federation, terminals, auth, plugins — in roughly the surface area Brunch spent proving it is *not* Pi (graph ontology, axis matrix, sealed profile, projection/renderer/compose pipeline), much of which is still stubbed (`reviewer`, `reconciler`, `executor`, most lenses/strategies).

- **Why it matters**: if the spec-graph thesis is wrong, Brunch has made the more expensive mistake. pi-web is the evidence that a usable Pi wrapper is reachable far sooner when the worldview is preserved.
- **Owning SPEC items**: D23-L (axis matrix), D40-L (runtime state), D59-L (objective axes).
- **Mitigation**: unchanged — stub-with-intent over speculative substrate for any axis not exercised end-to-end; new runtime substrate requires an explicit assumption-status update in SPEC.

## 6. Rabbit holes to refuse

Refuse by default; require explicit SPEC revisitation if any look attractive after seeing pi-web do them.

- **REST per-session routes / a session-verb API as Brunch's public surface.** The natural shape if Brunch ever wants Pi parity quickly. It undoes D19-L and R27 by giving clients a Pi-shaped API.
- **Streaming raw Pi `tool.*` / `shell.*` / `pi.event` to the browser.** Tempting for a "live console" view; forbidden by R27. Project product-shaped session/exchange state instead.
- **Replacing refetch-on-hint with imperative cache patching over a raw event stream.** pi-web's `AppState` + controllers model is more code and more failure modes (ordering, reconnect gaps). Keep `brunch.updated` a hint and refetch named projections.
- **Terminals / git panels / file-tree as Brunch product objects.** These are Pi-native ops affordances; adopting them is adopting the "Pi console" thesis Brunch rejects (D2-L, D39-L).
- **A browser-side, unsandboxed plugin system.** Reopens the Pi extension/skill/theme surface the POC deliberately seals (D39-L).
- **Multi-machine federation or an AuthService before the single-machine POC is proven.** Both are downstream of a posture change, not features to grow into the sidecar.
- **Generalizing the read-only sidecar into a write surface to "catch up" to pi-web.** The correct path to web writes is the daemon (§7.1) plus an explicit write-lease posture, not mutation methods bolted onto `createReadOnlyRpcHandlers` (R8).

## 7. Prioritary debts to pay down

In recommended order.

1. **Design a process-isolated session daemon (pay down R8 / honor D33-L).** This is the headline recommendation from the pi-web mirror. Extract the workspace/session writer out of the TUI process into a standalone daemon that owns the single live session and the `CommandExecutor`. The TUI and the browser both attach to it as clients — the TUI as the current writer, the browser as observer today and as a *lease-holding* writer later. Benefits, all consistent with existing posture:
   - **Session survivability**: a browser or TUI crash no longer kills the session (closes the resilience gap pi-web exposes).
   - **Safe path to web writes**: the daemon is the single point that can enforce a write lease, so lifting D33-L's read-only constraint no longer means multi-writer races on the JSONL transcript.
   - **No worldview leak**: the daemon still speaks Brunch named JSON-RPC, not Pi routes — this borrows pi-web's *process shape*, not its contract.
   Do this only through an explicit SPEC posture change (a "session daemon + write lease" decision), not by quietly widening the sidecar. Until then, keep the read-only fence intact.

2. **Pay down R1 — private `SessionManager` flush dependency.** Made more urgent by the irony this mirror exposes. Centralize `_rewriteFile()` / `setSessionFile()` behind one adapter and add a contract test against the installed Pi version. If the seam is genuinely necessary, open the upstream conversation. This remains the single most fragile point of contact with Pi.

3. **Hold R6 by default; require evidence to lift it.** pi-web is the external baseline for "shipped sooner." For any new axis-related substrate (reviewer policy, lens/strategy registries, executor mode), the default posture stays *stub-with-intent* until two real callers exist.

4. **Fence the read-model line (R4 from the howcode doc) against ops-affordance creep.** pi-web's file-tree/git/terminal/activity endpoints are attractive and all want mirror-shaped reads. If a Brunch UI need looks like it wants a mirror table or a join-shaped endpoint, add a request-scoped disposable projection cache or push back on the design (D19-L).

## 8. Operating principles to keep

Reaffirmed by this comparison; pinned so they stay legible.

- **Pi is infrastructure, not the product.** pi-web's Pi-native passthrough is the canonical counter-example. Every feature that is easier by exposing a Pi concept directly is a signal to design the product abstraction, not ship the leak.
- **Borrow process shapes, not contracts.** pi-web's daemon is worth copying; its REST-per-session surface and raw-event streams are not.
- **The notification is a hint; canonical truth is refetched.** `brunch.updated` over named projections beats imperative state patching over raw streams.
- **One writer for the POC, by posture.** Lifting this is a SPEC change — and the daemon is how to lift it safely, not by widening the sidecar.
- **Make Pi seams legible.** The R1 irony is the proof: a "sealed" posture is only as sealed as its most private dependency. Every dependency on Pi behavior must be findable, named, and probe-backed.
- **Architecture should follow user evidence, not lead it by more than one move.** pi-web is the external reminder that a usable wrapper is reachable sooner; Brunch's heavier bet must keep earning its surface.

## 9. References

- `memory/SPEC.md` — canonical specification; particularly Capability Requirements R8, R11, R12, R27 and Active Decisions D1-L, D2-L, D4-L, D5-L, D17-L, D19-L, D20-L, D23-L, D33-L, D39-L, D40-L.
- [pi-wrapper-comparative.md](pi-wrapper-comparative.md) — sibling comparison (howcode vs Brunch); the shared risk register (R1–R8) and rabbit-hole list this document builds on.
- [prd.md](prd.md) — product requirements.
- [pi-seam-extensions.md](pi-seam-extensions.md) — Pi seam inventory and Brunch-owned extensions.
- [../../src/rpc/TOPOLOGY.md](../../src/rpc/TOPOLOGY.md) — current RPC surface, discovery contract, and absent-name list.
- [../../src/.pi/TOPOLOGY.md](../../src/.pi/TOPOLOGY.md) — extension/profile sealing notes.
- [../../src/app/brunch.ts](../../src/app/brunch.ts), [../../src/rpc/web-host.ts](../../src/rpc/web-host.ts), [../../src/rpc/handlers.ts](../../src/rpc/handlers.ts) — Brunch mode dispatch, web host, and read-only / sidecar handler boundary.
- pi-web source ([github.com/jmfederico/pi-web](https://github.com/jmfederico/pi-web)) — comparative reference, especially `src/server/sessiond.ts`, `src/server/sessions/piSessionService.ts`, `src/server/sessiond/sessionProxyRoutes.ts`, `src/shared/federatedRoutes.ts`, `src/client/src/components/PiWebApp.ts`, `src/client/src/appState.ts`, and `docs/plugins.md`.
