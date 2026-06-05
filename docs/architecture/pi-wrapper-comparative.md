# Pi wrapper comparative — howcode vs Brunch

This document compares two architectures that wrap the same upstream coding-agent SDK (`@earendil-works/pi-coding-agent`, "Pi") behind a web UI:

- **howcode** ([github.com/IgorWarzocha/howcode](https://github.com/IgorWarzocha/howcode)) — a single-user Electron desktop workbench built around live Pi sessions.
- **Brunch** — this repository; a pre-release POC product whose canonical artifact is an intent-graph spec, with Pi acting as one engine among several.

The point of the comparison is not to evaluate howcode. It is to use a contemporaneous, opposite-thesis wrapper as a mirror for Brunch's own architectural commitments, so that **the risks and debts we already own are visible against an external baseline**.

The recommendations at the end of this document are Brunch-specific. They are written as guard-rails for ongoing work, not as a sweeping refactor agenda. The dependencies listed against each recommendation use SPEC.md decision and assumption IDs.

## 1. Architectures at a glance

### howcode

```pseudo
processes:
  Renderer (Chromium)
    React + Vite + Tailwind v4
    window.piDesktop (contextBridge preload)
    DesktopServiceClient (typed IPC)
  Electron main
    window lifecycle
    IPC router
    spawns service host child process
  Service host (Node child)
    imports @earendil-works/pi-coding-agent in-process
    PiRuntime envelope around AgentSession
    live-runtime-registry: cache by sessionPath, mutation locks, idle disposal
    SQLite (better-sqlite3) mirror for inbox/sidebar/running-state
    terminal manager (PTY)
```

- Pi binding: SDK imported once, lazily, via dynamic `import('@earendil-works/pi-coding-agent')` after applying `PI_CODING_AGENT_DIR`. A `PiRuntime` envelope adds `cwd`, `branchName`, `chatGroupId`, and `attachmentFileAccess` around each live `AgentSession`.
- Public surface: a typed `DesktopRequestMap` / `DesktopEventMap` exposed as `window.piDesktop`. The verb set is **Composer-centric** — `getComposerState`, `sendComposerPrompt`, `stopComposerRun`, `setComposerModel`, `setComposerThinkingLevel`, `openThreadRuntime`, `answerNativeAskQuestions`, etc. — each verb wraps a Pi mutation and emits domain events.
- Native UI substitutions for Pi tools: `ask_questions` is intercepted at the tool layer and answered through the React UI.
- Mode axis: `composerMode: 'chat' | 'code'` — a binary product-level switch that picks model and thinking-level defaults.
- Persistence: Pi JSONL is authoritative for transcripts. SQLite mirrors thread summaries, inbox snippets, running state, and chat-group membership for fast list-view rendering.
- Escape hatch: an embedded xterm.js Pi TUI takeover for cases the wrapper does not model.

### Brunch

```pseudo
modes (same Node process for tui/print, separate processes for rpc/web sidecar):
  tui
    embeds Pi in-process via InteractiveMode
    sealed Brunch Pi profile (no ambient .pi/ discovery)
    statically imported Brunch extension shell
    workspace coordinator owns spec/session/graph state
    optional web sidecar attaches read-only
  rpc
    JSON-RPC line server over stdio
    same coordinator, full mutation surface
  web
    HTTP + WebSocket sidecar
    read-only JSON-RPC handlers
    serves the React+Vite SPA from dist-web
  print
    snapshot render of workspace state, no agent loop

stores:
  Pi JSONL transcript (.brunch/sessions/*.jsonl)
    canonical for: session_binding, agent_runtime_state, structured_exchange tuples, worldUpdate
  SQLite via Drizzle (.brunch/graph.db)
    canonical for: specs, nodes, edges, change_log, reconciliation_needs
  .brunch/workspace.json
    project identity, posture, current/default spec+session acceleration
```

- Pi binding: SDK imported in-process. A "sealed Brunch Pi Profile" disables ambient `.pi/` discovery and injects an explicit, statically-imported extension shell.
- Public surface: Brunch's own JSON-RPC — never Pi's RPC. Named product method families: `workspace.*`, `session.*`, `graph.*`, `rpc.discover`. Mutation methods route through a Brunch `CommandExecutor` independently of Pi.
- Product reframing of Pi:
  - `workspace(cwd) → spec → session` is the canonical hierarchy. Threads are not first-class; sessions are durable linear JSONL transcripts bound to exactly one spec.
  - The product artifact is the **intent graph** in SQLite. Mutations flow through the `CommandExecutor`; Pi just invokes `commit_graph` and `accept_review_set` tools that route to it.
  - The agent loop is **elicitation-first** / **offer-first**: at idle the user responds to structured exchanges (`present_question`/`request_answer`, `present_options`/`request_choice|choices`, `present_review_set`/`request_review`).
  - Pi's `extension_ui_request(editor)` is relayed through Brunch as a product-shaped pending exchange; clients answer through Brunch methods, and Brunch synthesizes the `extension_ui_response` back to Pi.
- Mode axes: transport (TUI/RPC/print/web) × operational mode (`elicit` / future `execute`) × agent role (`elicitor` / `reviewer` / `reconciler` / future `executor`) × strategy × lens. SPEC D23-L holds these as separate axes by design.
- Concurrency: one-writer / many-observer. Web attaches read-only by SPEC D33-L. Session identity is never inferred from transport connection.
- Read-model discipline: SPEC D19-L forbids generic read APIs, REST view stores, and canonical cross-store event spines. `brunch.updated` is a process-local invalidation hint only — clients refetch through named projections.

## 2. The actual disagreement

```diagram
╭─────────────────────────────────╮          ╭───────────────────────────────────╮
│ howcode                         │          │ Brunch                            │
│                                 │          │                                   │
│  Pi AgentSession                │          │  Brunch product state             │
│        ▲                        │          │  (workspace → spec → session,     │
│        │ surface adapts to Pi   │          │   intent graph in SQLite,         │
│        │                        │          │   reconciliation needs)           │
│  Composer verbs                 │          │        ▲                          │
│  (send/stop/setModel/...)       │          │        │ surface IS the product   │
│        ▲                        │          │        │                          │
│        │                        │          │  Named JSON-RPC families          │
│  Typed IPC channel maps         │          │  (workspace.*, session.*,         │
│        ▲                        │          │   graph.*, rpc.discover)          │
│        │                        │          │        ▲                          │
│  React renderer                 │          │  Pi (in-process, sealed profile)  │
│                                 │          │  is one engine populating         │
│                                 │          │  product state, not the center    │
╰─────────────────────────────────╯          ╰───────────────────────────────────╯
   "wrap Pi as the product"                     "wrap Pi as infrastructure"
```

| Axis                             | howcode                                                       | Brunch                                                                                  |
|----------------------------------|---------------------------------------------------------------|------------------------------------------------------------------------------------------|
| Canonical human object           | thread / session                                              | spec graph (sessions bound under specs)                                                  |
| Public contract                  | typed IPC verb maps, Composer-centric                         | named JSON-RPC method families + `rpc.discover`                                          |
| Pi visibility to clients         | implicit — verbs mirror Pi mutations                          | explicitly forbidden by SPEC R27                                                         |
| Persistence                      | Pi JSONL + SQLite mirror for list views                       | Pi JSONL = transcript truth; SQLite = graph truth                                        |
| Mutation authority               | every verb flows through `AgentSession`                       | graph mutations through `CommandExecutor`, independent of Pi (D4-L, D20-L)               |
| Mode axes                        | `composerMode: chat | code` preset switch                     | transport × op-mode × agent role × strategy × lens (D23-L)                               |
| Concurrency                      | single window owns the runtime cache                          | one-writer / many-observer; web attaches read-only (D33-L)                               |
| Pi profile                       | inherits ambient `.pi/` (it *is* a Pi UX)                     | sealed profile (D39-L); ambient `.pi/` disabled                                          |
| Escape hatch                     | embedded xterm Pi TUI takeover                                | none — leaving the product model means leaving Brunch                                    |

The disagreement is not cosmetic. It determines API shape, persistence model, concurrency model, what counts as truth, and what future features are easy.

- **howcode says**: wrapping means *adapting Pi to a better UI/runtime environment* while preserving Pi's session worldview. The agent session is the product.
- **Brunch says**: wrapping means *preventing Pi's worldview from leaking out* and forcing all interactions through product semantics. The graph spec is the product; Pi is infrastructure.

Neither is "more correct"; they are optimizing for different truths. The risks below follow from the truth Brunch is optimizing for.

## 3. Tradeoffs

### What each architecture makes cheap and expensive

#### howcode
- **Cheap**: Pi-adjacent feature velocity; closeness to the live `AgentSession`; low-latency native shell affordances (terminal, git, diff, attachments, dictation); responsive list/inbox UI via the SQLite mirror; bespoke per-tool UI substitutions like native `ask_questions`.
- **Expensive**: anything that is not naturally a thread/session; durable product semantics beyond conversation history; headless automation or third-party clients; multi-observer consistency; generalized structured interaction beyond per-tool patches; a clean public API story.

#### Brunch
- **Cheap**: canonical product semantics independent of Pi phrasing; named projections over stable stores; deterministic probe verification; transport independence; one-writer/many-observer; swapping agent roles without changing client contract; strong authority around graph mutation.
- **Expensive**: ambient freeform agent UX; Pi feature parity; reuse of the Pi customization ecosystem; anything that does not fit the Brunch ontology; flexible browser-side writing today; iterating fast on product shape if the ontology turns out to be wrong.

### The hostile critiques worth keeping

- **Against howcode**: it is accumulating product state around Pi sessions without a strong canonical model, so future non-chat features will turn into synchronization debt. The SQLite "mirror" is already partly authoritative for inbox/sidebar/running-state.
- **Against Brunch**: it is building a rich product ontology and transport discipline before fully proving that users want that much semantic control instead of just a better agent console.

The second critique is the more important one for our purposes: it is a warning against architecture outrunning evidence.

## 4. Cross-pollination — what is safe to borrow

### Brunch borrowing from howcode

| Tactic                                          | Verdict             | Notes                                                                                                 |
|-------------------------------------------------|---------------------|--------------------------------------------------------------------------------------------------------|
| Composer-centric verbs as public surface        | ❌ do not borrow    | Would leak Pi/session semantics into our public contract and undercut D5-L, D19-L, R27 (discovery).    |
| Selective mirror / projection cache for hot reads | ⚠️ bounded only   | Acceptable only as a strictly disposable cache, never as a second truth plane. SPEC D19-L is the line. |
| Typed IPC-style channels                        | ⚠️ adapter only     | Fine as a local desktop adapter implementation detail if we ever ship one; not as the product contract.|
| Per-tool UI substitution (e.g. `ask_questions`) | ❌ do not borrow    | We already have a general product-owned pending-exchange abstraction (D17-L); bespoke per-tool patches would compete with it. |
| Embedded TUI takeover escape hatch              | ❌ do not borrow    | Direct contradiction of D2-L and D39-L. Brunch is not a Pi distribution; leaving the model means leaving Brunch. |

### What howcode could (hypothetically) gain from Brunch

This is included only so the comparison is symmetric; it has no Brunch action items.

- Product RPC + `rpc.discover` for an automation/probe/multi-client story.
- Transport-vs-operational-mode separation as `chat|code` grows past preset switching.
- Sealed-profile / spec-hierarchy / graph-as-canonical — these would actively damage howcode's strength as a Pi-native workbench and are not appropriate for it.

## 5. Risks already inside Brunch

Each item below is an accidentally load-bearing seam or an unfinished commitment that the SPEC has already articulated but the code has not fully discharged. Severity is relative to Brunch's stated goals, not absolute.

### R1. Private `SessionManager` flush internals (severity: high)

Brunch currently depends on private-ish Pi behavior — `_rewriteFile()`, `setSessionFile(...)` — to force pre-assistant persistence and avoid duplicate prefixes. This is classic accidental load-bearing: a Pi minor version could break Brunch silently or noisily.

- **Why it matters**: Pi JSONL persistence ordering is canonical for many Brunch projections (`session.pendingExchange`, exchange extraction, world-update entries). If the private flush behavior shifts, every projection that assumes "the entry is durable before we project it" can drift.
- **Owning SPEC items**: A1-L (Pi seam sufficiency), D1-L (depend on `pi-coding-agent`), D17-L (Pi transcript substrate).
- **Mitigation**: convert each private call site into a Brunch-side adapter with a single chokepoint, and either upstream a stable seam to Pi or write a contract test that fails on Pi upgrades that change the observable behavior we rely on.

### R2. Public RPC vocabulary drift (resolved)

`src/rpc/README.md` is now the canonical method contract, and dispatch/discovery are generated from one registry. The active public session names are `session.triggerExchange`, `session.pendingExchange`, `session.submitExchangeResponse`, `session.exchanges`, and `session.runtimeState`; removed names are quarantined in the RPC README's absent-name list and are not compatibility aliases.

- **Why it mattered**: every external client and probe written against stale names would have become a constraint on future renames.
- **Owning SPEC items**: D5-L (single public protocol), D19-L (named method families), R11 (JSON-RPC primary), R27 (Brunch-owned discovery).
- **Resolved by**: FE-795 RPC registry refactor; no aliases or deprecation adapters were added under Brunch's pre-release/free-rewrite posture.

### R3. Pi lifecycle/timing coupling (severity: medium-high)

Beyond R1, Brunch leans on specific Pi semantics: `prepareNextTurn` ordering, structured `toolResult` ordering, extension UI request/response flow, compaction hooks, and session lifecycle hooks. These are reasonable seams to depend on, but the dependency is currently undocumented and untested as a contract.

- **Why it matters**: a Pi behavior change in any of these will manifest as subtle projection or elicitation bugs, not as a clear API break.
- **Owning SPEC items**: A1-L, A11-L, D17-L, D33-L (Pi extension UI relay).
- **Mitigation**: enumerate the exact Pi behaviors we depend on in `docs/architecture/pi-seam-extensions.md`, and back each with a probe or contract test under `src/probes/*`. Currently `structured-exchange-rpc-proof.ts` does this for the editor relay; expand the pattern.

### R4. Read-model discipline vs UI ambition (severity: medium)

SPEC D19-L forbids mirror stores, generic read APIs, and view databases. This is correct for the POC, but the moment the web UI wants something like "list every session across all specs, ordered by last activity, with the latest pending exchange inlined," we will be tempted to add a mirror table or a join-shaped read endpoint.

- **Why it matters**: silent erosion of D19-L is how Brunch would acquire a parallel canonical store without ever deciding to. howcode's mirror DB is the cautionary case.
- **Owning SPEC items**: D19-L, D6-L, NO-3 (no DB-backed chat/turn projection).
- **Mitigation**: when a UI need looks like it wants a mirror, add a *disposable, rebuildable* projection cache scoped to the request lifecycle and labelled as such, or push back on the UI design. Never add a table whose rows are derivative of canonical truth without a hard-coded rebuild path.

### R5. Linear-transcript-only commitment (severity: medium, narrow blast radius)

SPEC R8 and decisions around session binding reject branched/forked transcripts for the POC. This is a deliberate simplification, but it is also a hard incompatibility surface if Pi evolves branch semantics or users want branching.

- **Why it matters**: a future "branch this session to try a different elicitation path" feature would require touching projection, persistence, session binding, and the structured-exchange substrate at once.
- **Owning SPEC items**: R8 (linear sessions), D33-L (transport vs session identity).
- **Mitigation**: tag the rejection explicitly at the code seams that assume linearity (currently in `src/session/session-transcript.ts`, projection readers, and the binding entry). Note in those seams that branching is a known future migration, not a missed case. Do not defensively code for it.

### R6. Forward-designed axis matrix outrunning user evidence (severity: medium)

SPEC D23-L commits to transport × operational mode × agent role × strategy × lens as separate axes. Today the runtime only meaningfully populates *transport* and *operational mode = elicit*; `reviewer` and `reconciler` are partial, `executor` is future, and the lens/strategy axes only have a small set of populated values.

- **Why it matters**: building infrastructure for axes we have not exercised risks freezing wrong assumptions into the schema, prompts, and runtime-state projection. The oracle's pointed warning was: *you are proving you are not Pi before proving users want the non-Pi worldview strongly enough.*
- **Owning SPEC items**: D23-L, D40-L (runtime state), D59-L (objective axes).
- **Mitigation**: when designing for an axis that has not been exercised end-to-end, prefer leaving the seam stubbed-but-honest (signature + intent comment) over building a working substrate. Walking-skeleton over second-system.

### R7. `sessionPath` / session-identity assumptions (severity: low-medium, but easy to grow)

We have not (yet) made the howcode mistake of keying everything off `sessionPath` — our identity story routes through workspace coordinator state and `session_binding` entries. But the temptation will arise as soon as we add a second long-running consumer of session state (e.g., a background reviewer that needs to address a specific session).

- **Why it matters**: identity sprawl across cache, DB, and routing is what makes howcode's runtime lifecycle gnarly. Brunch is currently disciplined here and should stay that way.
- **Owning SPEC items**: D33-L, D11-L (workspace → spec → session).
- **Mitigation**: keep `(specId, sessionId)` the only identity primitive for session-scoped state. Refuse to add session-path-keyed caches unless there is a non-replaceable reason (e.g., file-system mtime watchers).

### R8. Web sidecar as read-only attachment is a product bottleneck (severity: low now, rising)

SPEC D33-L holds web read-only as a deliberate POC posture. Once the web UI becomes more than an observer dashboard, this constraint will be felt — especially if browser-side commit-graph proposals or review-set authoring become product surfaces.

- **Why it matters**: lifting read-only without revisiting the one-writer assumption would introduce silent multi-writer races against the same Pi JSONL transcript.
- **Owning SPEC items**: D33-L, R12, NO-3 (one writer in POC).
- **Mitigation**: when we plan to lift this, do it through an explicit posture change (probably a "write lease" concept) and not by adding mutation methods to `createReadOnlyRpcHandlers`. Treat the read-only handler set as a load-bearing fence.

## 6. Rabbit holes to refuse

The patterns below are not active risks today but are the kinds of design that the oracle and this comparison flagged as plausible futures. Refuse them by default; require explicit revisitation of SPEC if they look attractive.

- **A "Composer" object as Brunch's public verb surface.** It is the natural shape if we ever build a desktop client. It is also the shape that undoes D19-L by giving clients a Pi-shaped API.
- **A SQLite mirror of session/exchange state to speed up list views.** If a view feels slow, profile the projection first; if necessary, cache *inside the projection handler* rather than building a parallel table.
- **A "Pi takeover" / shell-out-to-real-Pi escape hatch.** Direct contradiction of D2-L and D39-L. If Brunch cannot model something, the answer is a Brunch decision (build it, defer it, decline it), not bypass.
- **Tool-by-tool UI substitution for Pi tools** (the howcode `ask_questions` pattern). We already have `present_*` / `request_*` structured exchanges and the editor relay as the general path (D17-L, D33-L). Per-tool patches would compete with that abstraction and erode it.
- **A second event spine** (Kafka-style topic bus, generic `events.subscribe`, or canonical cross-store changelog beyond the in-place graph `change_log` and Pi JSONL). SPEC D19-L is explicit: `brunch.updated` is a hint, not a fact.
- **Inferring session identity from transport connection.** Tempting in WebSocket code; forbidden by D33-L.
- **Generic `records.*` / `entities.*` RPC families.** Forbidden by D3-L; the vocabulary is graph-native and session-native.
- **Per-relation policy registries on graph edges.** D51-L closed this; the edge category set is fixed.
- **Treating `composerMode`-style binary mode switches as a Brunch concept.** Operational mode, agent role, strategy, and lens are the axes (D23-L, D40-L).

## 7. Prioritary debts to pay down

In recommended order; each links back to risks above.

1. **Pay down R1 — private `SessionManager` flush dependency.** Centralize the call sites behind a single Brunch-side adapter; add a contract test that exercises pre-assistant flush ordering against the installed Pi version. If the seam is genuinely necessary, open the upstream conversation. This is the single most fragile point of contact with Pi.

2. **Keep R2 resolved — do not reopen RPC compatibility aliases.** The canonical vocabulary now lives in `src/rpc/README.md`, dispatch/discovery share one registry, and retired names are absent rather than aliased. Future client work should use the discovered canonical names and keep retired names only in the RPC README's absent-name list.

3. **Pay down R3 — make Pi lifecycle dependencies legible.** Enumerate every Pi behavior we depend on (timing, ordering, hook semantics) in `docs/architecture/pi-seam-extensions.md` and back each with a probe under `src/probes/*`. This turns a class of silent breakage into a class of loud breakage.

4. **Fence R4 — write the read-model discipline down as a code-level rule.** Add a short `src/rpc/READ_MODEL_DISCIPLINE.md` (or expand `src/rpc/README.md`) with: no mirror tables; projections live next to their owning store; caching is request-scoped and disposable; `brunch.updated` is a hint, never a fact. Reference it from PR templates.

5. **Tag R5 in code, not just in docs.** Add narrow `// linear-transcript: see SPEC R8` markers at the projection and persistence sites that assume linearity. The goal is to make the assumption visible to anyone reading the seam, so that "small additions" do not accidentally branch us.

6. **Hold R6 by default; require evidence to lift it.** For any new axis-related substrate (reviewer policy, lens registry, strategy registry), the default posture is *stub-with-intent-comment* until two real callers exist (rule of three / proving posture per `AGENTS.md`). New runtime substrate requires an explicit assumption-status update in SPEC.

7. **Defer R8 explicitly.** No new mutation handlers in `createReadOnlyRpcHandlers`. When lifting read-only becomes a real requirement, open a posture discussion in SPEC first; do not let the read-only fence erode silently.

## 8. Operating principles to keep

These are not new rules. They are the things this comparison reaffirmed; pinning them here so they stay legible.

- **Pi is infrastructure, not the product.** Every time a feature is easier to ship by exposing a Pi concept directly, that is a signal to design the product abstraction, not to ship the leak. The Composer-verb temptation is the canonical example.
- **The graph is canonical; Pi JSONL is canonical for transcripts; everything else is projection.** No mirror, no second event spine, no shadow store. If we find ourselves wanting one, audit the projection first.
- **Discovery beats convention.** `rpc.discover` is the contract; method names that exist but aren't discoverable should be treated as private.
- **Stub-with-intent over speculative substrate.** For axes/roles/lenses not yet exercised, leave honest stubs. Architecture should follow user evidence, not lead it by more than one move.
- **Make Pi seams legible.** Every dependency on Pi behavior — public or private — should be findable, named, and probe-backed.
- **One writer for the POC, by posture.** Lifting this requires an explicit SPEC change, not just code that happens to work.

## 9. References

- `memory/SPEC.md` — canonical specification; particularly Capability Requirements R8, R11, R12, R27 and Active Decisions D1-L, D2-L, D3-L, D4-L, D5-L, D17-L, D19-L, D20-L, D23-L, D33-L, D39-L, D40-L, D51-L.
- `docs/architecture/prd.md` — product requirements.
- `docs/architecture/pi-seam-extensions.md` — Pi seam inventory and Brunch-owned extensions.
- `src/rpc/README.md` — current RPC surface, discovery contract, and absent-name list.
- `src/.pi/README.md` — extension/profile sealing notes.
- howcode source ([github.com/IgorWarzocha/howcode](https://github.com/IgorWarzocha/howcode)) — comparative reference, especially `desktop/pi-module.ts`, `desktop/runtime-host/live-runtime-service.ts`, `desktop/runtime/composer-state.ts`, `src/electron/preload/create-desktop-api.ts`.
