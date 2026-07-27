---
title: Evaluate the architecture of `pi` packages
threadId: T-019e34d3-549a-73d5-a5d1-8cc9245b4ef0
created: 2026-05-17T07:25:25.530Z
agentMode: smart
---

# Evaluate the architecture of `pi` packages

## User

I'd like to potentially use the system-explainer skill, to explain the project we're currently in; however let's start with whatever your standard approach would be for this. I'd like to understand how the different packages here work together, specifically in the case of the `packages/coding-agent/`

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/README.md"
}
```

## User

**Tool Result:** `TU-033I9o5X0tFyvBwAB6GouA`

**Tool Result:** `TU-033I9o5glINSmeRVl4yjCz`

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "for p in agent ai coding-agent tui web-ui; do echo \"=== $p ===\"; jq '{name, dependencies, peerDependencies, bin}' packages/$p/package.json 2>/dev/null; done",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/coding-agent/ && echo \"---src---\" && ls packages/coding-agent/src/",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/agent/src/ packages/ai/src/ packages/tui/src/ packages/web-ui/src/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

## User

**Tool Result:** `TU-033I9oGrGDPHO5X5MneMux`

**Tool Result:** `TU-033I9oIAwy7dnaTXDoOtbG`

**Tool Result:** `TU-033I9oJ24ipnSuqZnBr4ie`

## Assistant

Good — dependency picture is clear. Let me look deeper into `coding-agent`'s internals before summarizing.

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/coding-agent/src/core/ packages/coding-agent/src/cli/ packages/coding-agent/src/modes/ packages/coding-agent/src/utils/ packages/coding-agent/src/bun/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/main.ts",
  "read_range": [
    1,
    100
  ]
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/index.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/index.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/ai/src/index.ts"
}
```

## User

**Tool Result:** `TU-033I9oRiqj3Pm0mGqnf4zb`

**Tool Result:** `TU-033I9oTXdJJYSjMA6XOilm`

**Tool Result:** `TU-033I9oWXiqdcJJVwyRrsdY`

**Tool Result:** `TU-033I9oWmRPn80xKv4AIfXG`

**Tool Result:** `TU-033I9oWsaEWBSvfNBEqK9w`

## Assistant

I've got enough to give you a grounded overview. Here is my standard answer before we consider applying any explainer skill.

### Package dependency graph

```diagram
                    ╭───────────╮
                    │  pi-ai    │  ← provider SDKs (OpenAI, Anthropic,
                    │ (packages │     Google, Bedrock, Mistral, …),
                    │   /ai)    │     unified streaming, models registry
                    ╰─────┬─────╯
                          │
                          ▼
                 ╭────────────────╮
                 │ pi-agent-core  │  ← agent loop, tool calling,
                 │ (packages/     │     session/JSONL repo, compaction,
                 │   agent)       │     system prompts, skills loader
                 ╰───┬────────────╯
                     │
        ┌────────────┴───────────────────────┐
        ▼                                    ▼
╭────────────────────╮              ╭────────────────╮
│ pi-coding-agent    │              │   pi-web-ui    │
│ (packages/         │              │ (uses pi-ai +  │
│   coding-agent)    │              │  pi-tui for    │
│   = `pi` CLI       │              │  web chat UI)  │
╰───┬────────────────╯              ╰────────────────╯
    │ depends on
    ▼
╭────────────────────╮
│      pi-tui        │  ← terminal renderer, editor, keybindings,
│ (packages/tui)     │     diff rendering, image-in-terminal
╰────────────────────╯
```

- **pi-ai** is the leaf: it normalizes every provider into one streaming API + a generated `models.ts`. No internal deps.
- **pi-agent-core** sits on top of pi-ai and adds the *agent runtime* (the loop, tool invocation, conversation state, JSONL session repo, compaction, skill loading, prompt assembly).
- **pi-tui** is independent — pure terminal rendering primitives (no AI/agent knowledge).
- **pi-coding-agent** is the product. It composes `pi-agent-core` + `pi-ai` + `pi-tui` into the `pi` CLI binary and the SDK (`createAgentSession`).
- **pi-web-ui** is the parallel web frontend — it reuses `pi-ai` (for provider streaming in the browser) and `pi-tui` (some shared utilities) but does **not** depend on `pi-agent-core` or `pi-coding-agent`.

### Internal shape of `packages/coding-agent/`

The package is organized as **CLI shell → core runtime → modes → utilities**:

```diagram
src/
├── cli.ts, main.ts          ← entry: arg parsing, mode dispatch
├── cli/                     ← arg parsing, file/image processing,
│                              model & session pickers
├── core/                    ← the engine
│   ├── sdk.ts               ← createAgentSession() — the public API
│   ├── agent-session.ts     ← session object: events, prompts, model cycling
│   ├── agent-session-runtime.ts
│   ├── agent-session-services.ts   ← wires services (auth, registry, settings, …)
│   ├── session-manager.ts          ← JSONL session persistence + migration
│   ├── settings-manager.ts         ← layered settings (project/user/system)
│   ├── auth-storage.ts             ← API keys + OAuth credentials
│   ├── model-registry.ts / model-resolver.ts
│   ├── tools/                      ← bash, read, write, edit, grep, find, ls
│   ├── compaction/                 ← context-window summarization
│   ├── extensions/                 ← extension/plugin host
│   ├── skills.ts, slash-commands.ts
│   ├── system-prompt.ts, prompt-templates.ts
│   ├── export-html/                ← HTML transcript export
│   └── event-bus.ts, output-guard.ts, telemetry.ts
├── modes/                   ← how the session is driven
│   ├── interactive/         ← full TUI app (components, theme)
│   ├── print-mode.ts        ← one-shot non-interactive ("pi 'do X'")
│   └── rpc/                 ← RPC server/client for embedding
├── bun/                     ← Bun-specific shims
├── utils/                   ← clipboard, git, shell, images, paths…
└── migrations.ts            ← session schema migrations
```

**Key boundaries:**

1. **`core/sdk.ts`** is the *only* surface intended for programmatic embedders. It exposes `createAgentSession`, `createAgentSessionRuntime`, `createAgentSessionServices`, and tool factories. The CLI itself is just one consumer of this SDK.
2. **`core/agent-session-services.ts`** is the wiring layer: it constructs `AuthStorage`, `ModelRegistry`, `SettingsManager`, `SessionManager`, `KeybindingsManager`, `ResourceLoader`, `PackageManager`, `ExtensionRunner`, then passes them to a session.
3. **`core/agent-session.ts`** is the session object — it owns the conversation state and emits events (`turn:start`, `tool:call`, `tool:result`, `agent:end`, etc.) that the modes subscribe to.
4. **`modes/`** chooses how the session is presented: interactive TUI, single-shot print, or RPC. All three are thin presentations over the same session API.
5. **`core/extensions/`** is the plugin system — extensions can add tools, slash commands, keybindings, UI components, and hook events without modifying the core.
6. **`core/tools/`** holds the built-in coding tools (bash/read/write/edit/grep/find/ls). Each has both a `*ToolDefinition` (for the agent) and a factory for custom CWDs.

### Where each dependency package is used inside coding-agent

- `pi-ai` — providers, model lookup, streaming primitives, `ImageContent`, OAuth types.
- `pi-agent-core` — re-exported pieces of session, compaction, prompt-template, skills loader, harness types (coding-agent re-wraps many of these with its own coding-specific defaults).
- `pi-tui` — `TUI`, `ProcessTerminal`, `setKeybindings`, components for the interactive mode.

### Suggested next step

Given the size (the `index.ts` alone exports ~150 symbols), a good explainer would have these tabs:

1. **Overview** — package graph above
2. **Lifecycle** — request → session → agent loop → tool call → result → event → render
3. **Modes** — interactive vs print vs RPC
4. **Tools** — built-ins + extension tools
5. **Session & compaction** — JSONL repo, cut points, summaries
6. **Auth & models** — auth storage, model registry, provider resolution
7. **Extensions** — hook points and capability surface
8. **SDK** — embedding the agent programmatically

Want me to (a) drill into one of these areas in detail, (b) load and run the `interactive-system-explainer` skill to produce the HTML artifact, or (c) sketch the scenario data first so the simulator has something concrete to show?

## User

let me circle this a little differently: where in this arrangement would you draw "server", "client", and "persistence" (DB, files) boundaries? And speculate: if the "server" side of this was tasked with maintaining more than just the session, but also some kind of structured data that ostensibly the user and agent would both operate on, where would that live and how would the tools for modifying it be exposed? how would the authority be modelled?

## Assistant

Good question. Let me ground this in what's actually in the code, then speculate.

### Current boundaries (grounded)

```diagram
  ╭─────────────── CLIENT (presentation) ────────────────╮
  │  modes/interactive/   (TUI app)                      │
  │  modes/print-mode     (one-shot stdout)              │
  │  modes/rpc/           (JSON-RPC over stdio)          │
  │     ▲                  └─ RpcClient is already       │
  │     │                     exported — a client/server │
  │     │                     split exists in-process    │
  ╰─────┼────────────────────────────────────────────────╯
        │ events + commands  (event-bus.ts)
  ╭─────┼─── "SERVER" (in-process today) ────────────────╮
  │  core/sdk.ts                 createAgentSession()    │
  │  core/agent-session.ts       conversation owner      │
  │  core/agent-session-runtime  loop driver             │
  │  core/agent-session-services service container       │
  │     │  injects ↓                                     │
  │  core/tools/*                bash/read/write/…       │
  │  core/extensions/*           plugin host             │
  │  core/compaction/*           context management      │
  │  pi-agent-core               agent loop + harness    │
  │  pi-ai                       LLM provider client     │
  ╰─────┼────────────────────────────────────────────────╯
        │ via injected services
  ╭─────▼────── PERSISTENCE (all file-based) ────────────╮
  │  SessionManager       JSONL session log per session  │
  │  AuthStorage          auth.json (pluggable backend!) │
  │  SettingsManager      layered JSON: system/user/proj │
  │  PackageManager       installed extensions on disk   │
  │  ResourceLoader       project context files          │
  │  + the working tree    (the "data" the tools edit)   │
  ╰──────────────────────────────────────────────────────╯
```

Three observations that matter for the speculation:

1. **The server/client split is already latent.** `modes/rpc/` plus `RpcClient`/`runRpcMode` exports show the team has already isolated "drive a session" from "render a session." Today both halves live in the same process; promoting to a network boundary is mostly a transport swap.
2. **Services are injected, not hard-coded.** `AuthStorage` ships with `FileAuthStorageBackend` *and* `InMemoryAuthStorageBackend` — the contract is explicitly pluggable. `agent-session-services.ts` is a DI container. That means each persistence concern can be swapped for a remote/DB backend without rewriting the runtime.
3. **The current "structured data" the agent operates on is the file system.** Tools = file system verbs (`read`, `write`, `edit`, `grep`, `find`, `ls`, `bash`). The whole tool vocabulary assumes "the user and the agent share a working tree, OS arbitrates access." That's the implicit authority model today.

### Speculation: adding shared structured data

Suppose the server now owns a structured store (records, not files) that both the user (via web-ui) and the agent (via tools) mutate.

#### Where it lives in the package graph

The natural shape, given the existing seams:

```diagram
  ╭───────────────────╮       ╭───────────────────────╮
  │   pi-web-ui       │       │  pi-coding-agent      │
  │  (user client)    │       │  (agent client)       │
  │   reads/writes    │       │  exposes records as   │
  │   records via UI  │       │  tools to the LLM     │
  ╰────────┬──────────╯       ╰──────────┬────────────╯
           │                              │
           │  same protocol               │  same protocol
           │  (extend rpc/ or HTTP)       │
           ▼                              ▼
        ╭──────────────────────────────────────╮
        │   NEW: pi-record-server              │
        │   - record schemas (typebox)         │
        │   - command/event log                │
        │   - projections / read models        │
        │   - subscription stream              │
        │   - authority gate                   │
        ╰──────────────────┬───────────────────╯
                           │
                           ▼
                   ╭──────────────╮
                   │  DB / event  │
                   │  log         │
                   ╰──────────────╯
```

A new package — call it `pi-record-server` — would own the structured data. It would be the *first* package in the repo that needs a real DB (SQLite at minimum; the existing JSONL pattern doesn't survive multi-writer concurrency). It would emit a stream of events so both clients stay in sync; the web-ui already speaks event streams, and the agent's `event-bus.ts` is the same pattern.

The agent's *access* to records would be a new tool family inside `coding-agent` — e.g. `record_query`, `record_get`, `record_create`, `record_update`, `record_subscribe` — registered the same way `createBashTool` etc. are today. Because tools are already `ToolDefinition` objects with input schemas, you'd just point them at the server's RPC instead of `fs.*`. The system prompt would describe the record schema the same way it currently describes the file tree.

#### How tools would be exposed

Two routes, both supported by the existing extension system:

- **Built-in route:** add `core/tools/record-*.ts` alongside the file tools, with factory functions like `createRecordQueryTool({ client, schema })`. They'd participate in the same `wrapRegisteredTool` machinery, the same approval flow, the same diff rendering (with a "record diff" component instead of file diff).
- **Extension route:** ship as an extension package (`pi-record-tools`) that registers tools via `ExtensionRuntime`. This is probably preferable — the extensions system already exists for exactly this "add a tool family without modifying core" use case, and the tools are domain-specific.

#### How authority would be modeled

This is the genuinely hard part, and the existing code gives you three primitives to compose:

| Existing primitive | What it gives you for records |
|---|---|
| `ToolExecutionMode` (read-only / mutating / dangerous) | Per-tool risk classification, surfaces approval prompts |
| `AuthStorage` (per-credential, pluggable) | Agent *runs as* a user identity, not as "the agent" |
| `BeforeAgentStartEvent` / `BeforeProviderRequestEvent` hooks | Policy gates that can deny or transform a request |
| `event-bus` + JSONL append-only log | Existing event-sourcing muscle memory |

A reasonable model:

1. **The agent acts as a delegate of an authenticated user.** `AuthStorage` already carries that identity; reuse it as the actor on every record command. Every event is attributed: `actor: { kind: "agent", on_behalf_of: <user> }` vs `actor: { kind: "user", id: <user> }`. This makes audit trivially recoverable.

2. **Authority is field-level, not record-level.** Schemas (typebox is already the project's schema lib) carry `@authority` annotations: e.g. `status` is agent-writable, `approved_by` is user-only, `notes` is either. The server enforces this on every command, regardless of which client issued it.

3. **Three tiers of agent action, mirroring `ToolExecutionMode`:**
   - **Autonomous:** record reads, schema-allowed writes to agent-owned fields. No prompt.
   - **Requires confirmation:** writes to shared fields, deletions. Uses the existing tool-approval UI flow (same surface as a dangerous bash command).
   - **Forbidden / human-only:** writes the schema marks user-only. Tool returns a structured "needs human" result the agent can route to the user via a slash command or web-ui notification.

4. **Commands, not CRUD.** Tools should expose verbs that match domain transitions (`approve_invoice`, `assign_owner`) rather than `update(table, id, patch)`. This is what makes authority *checkable* — the gate knows what's being attempted, not just which bytes are changing. (This is exactly the `stateful-systems` skill's discipline, and it would fit this slice cleanly.)

5. **Optimistic concurrency on every write.** Each record carries a version; the agent's tool input must echo the version it read. The server rejects stale writes and returns the current state; the agent re-reads and decides. This protects against the user editing in the web-ui while the agent is mid-turn.

6. **Subscription = the agent's "watch" tool.** Long-running sessions can subscribe to record changes; injected as a system message ("user changed status to X") so the agent's plan stays consistent with reality.

#### What this implies for the repo

- New package: `pi-record-server` (server + schema definitions + client lib).
- New package or extension: record tools for `coding-agent`.
- `web-ui` grows a record browser/editor that talks the same protocol.
- `auth-storage` becomes the cross-cutting identity, not just an LLM-credential bag.
- The `rpc/` mode generalizes into "the agent's connection to the server" — local stdio for single-user use, network for shared.
- JSONL session files stay; record state moves to SQLite/Postgres.

If you want, I can sketch this as a concrete `stateful-systems` design packet (states, commands, events, invariants) — that would be the natural feeder into an `interactive-system-explainer` artifact, since the explainer skill explicitly says "if lifecycle behavior is unclear, model it first."

## User

I'd like to keep talking about how the other parts work, and how this would work with them: right now the four possible ways of interacting with the system seem to be TUI, GUI (web), print-mode, and JSON-RPC over stdio; in the scenario you outlined above, would all functionalities be exposable through all of these forms?

## Assistant

Good framing, but one correction up front: today **web-ui does not actually depend on coding-agent** — it imports `pi-ai` and `pi-tui` only. So at the moment it's a parallel browser chat product, not a frontend over the agent. To make the four-mode story true, web-ui would need to become an RPC client of the agent runtime (the existing `modes/rpc/` is the natural transport — same JSON-RPC protocol, just websocket instead of stdio).

Given that, the four modes really split along **two axes**, not one:

```diagram
                  Human present in the loop?
                  ┌────────────────┬────────────────┐
                  │      yes       │       no       │
  ┌───────────────┼────────────────┼────────────────┤
  │ rich          │     web        │  RPC (driven   │
  │ rendering     │                │  by another    │
  │               │                │  program)      │
  ├───────────────┼────────────────┼────────────────┤
  │ stream/text   │     TUI        │    print       │
  │ only          │                │                │
  └───────────────┴────────────────┴────────────────┘
```

That collapses the question. There are really two pairs:

- **Human-interactive: TUI + web.** Both must reach full feature parity for the record system — just different presentations of the same session.
- **Headless: print + RPC.** Neither has a live human; either the run is fully autonomous, or a driving program substitutes for one.

### Which capabilities cross all four

| Capability | TUI | Web | Print | RPC |
|---|---|---|---|---|
| Read records / queries | ✓ | ✓ | ✓ (dump JSON) | ✓ |
| Write agent-owned fields | ✓ | ✓ | ✓ | ✓ |
| Subscribe to live updates | ✓ | ✓ | n/a (one-shot) | ✓ (event stream) |
| Tool execution attribution | ✓ | ✓ | ✓ | ✓ |
| Confirmation-gated writes | ✓ (dialog) | ✓ (modal) | needs `--auto-approve` policy | ✓ (driver decides) |
| User-only writes | ✓ (suspend agent, prompt user) | ✓ (native UI) | **cannot service** | ✓ only if driver is a UI |
| Direct user editing of records (no agent) | awkward | natural | n/a | n/a |
| Multi-user simultaneous | poor | natural | n/a | depends on driver |

So the answer is **no, not symmetrically** — but the asymmetry follows from the medium, not from the architecture. Three categories:

#### 1. Capabilities that genuinely span all four
The *agent's* operations on records: query, read, agent-scoped writes, subscribe. These are RPC verbs; every mode is just a different presentation of the same call. The tool definitions in `coding-agent` don't change — only what surrounds them does.

#### 2. Capabilities that need a human-interactive mode
Anything in the authority model that says "user-only" or "needs confirmation." Print mode literally cannot service these — there's no one to ask. Two reasonable fallbacks:
- **Refuse**: tool returns `{ status: "requires_human", reason: …}`, the agent records it as a blocker and exits with a non-zero code.
- **Auto-policy**: `--auto-approve=safe` etc., as a deliberate operator choice. This is already the pattern coding-agent uses for `bash` and `edit` in print mode.

RPC sits in the middle: confirmation-gated calls become events the driver receives, and the driver either has its own UI (web, another TUI) or its own policy. The existing `event-bus` machinery already models this — `BeforeAgentStartEvent` and tool-call events can be intercepted and answered.

#### 3. Capabilities that are only natural in one mode
- **Bulk record browsing/editing without invoking the agent** is really a web-ui thing. You could build a TUI record browser (the existing selector components could be repurposed), but the web is the right surface for tables, forms, and multi-user editing.
- **Pure pipeline use** ("read these record IDs, summarize, exit") is the print mode's whole reason to exist.
- **Embedding in another app** is RPC's reason to exist.

### The architectural consequence

If you want symmetry where it's achievable, the design discipline is:

1. **All record operations are commands defined once**, as schemas (typebox fits), executed by the server. Tools in `coding-agent` and UI affordances in `web-ui` both compile down to the same command set. No mode has private capabilities.
2. **The "needs human" result is a first-class outcome**, not an exception. Every tool can return it; every mode has a defined behavior for it (UI: prompt; print: fail with structured reason; RPC: emit event).
3. **The event stream is the synchronization substrate.** The agent subscribes the same way the web-ui subscribes. Print mode subscribes only briefly. RPC forwards events to the driver. Today this is `event-bus.ts` in-process; promoting it to a network stream is the main work.
4. **Web-ui becomes a peer of TUI**, not a separate product — both implemented as clients of the same RPC protocol. The current `modes/rpc/` types (`RpcCommand`, `RpcResponse`, `RpcEventListener`) are already shaped like this.

So the cleaner statement is: **all functionality is exposable through the human-interactive modes; the headless modes expose everything that doesn't require a live human, plus a structured "needs human" outcome that headless drivers can route however they want.**

Want to look at the actual `modes/rpc/` shape next, to see how close it already is to being that universal protocol?

## User

I'd like to understand more about how the web-ui currently works, as an aside, first: I'm surprised that it does not involve the same agent core; what is the use-case for it?

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/package.json"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/web-ui/ && echo \"---src---\" && ls packages/web-ui/src/ && echo \"---components---\" && ls packages/web-ui/src/components/ 2>/dev/null && echo \"---tools---\" && ls packages/web-ui/src/tools/ 2>/dev/null && echo \"---storage---\" && ls packages/web-ui/src/storage/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/index.ts"
}
```

## User

**Tool Result:** `TU-033IAUbb8XCoBzsz6ASmDY`

**Tool Result:** `TU-033IAUcZrvnYc40boar8Fu`

**Tool Result:** `TU-033IAUex9wdqL8GaKgIysH`

## Assistant

Correction to my earlier statement — I was wrong. Web-ui **does** use `pi-agent-core` (line 3 of its `index.ts` re-exports `Agent`, `AgentMessage`, `AgentState`, `ThinkingLevel`). It's missing from the `package.json` `dependencies` block, which is what threw me. So the dependency reality is:

```diagram
                ╭───────────╮
                │  pi-ai    │
                ╰─────┬─────╯
                      ▼
              ╭────────────────╮
              │ pi-agent-core  │  ← the Agent class runs here
              ╰───┬────────┬───╯
                  │        │
                  ▼        ▼
          ╭────────────╮  ╭──────────────╮
          │ pi-coding- │  │  pi-web-ui   │
          │  agent     │  │              │
          ╰────────────╯  ╰──────────────╯
                  │             │
                  ▼             ▼
              pi-tui        pi-tui (utils)
```

Both `coding-agent` and `web-ui` are **peers sitting on top of `pi-agent-core`**. Same agent loop, completely different tool surface, completely different runtime environment.

### What web-ui actually is

Looking at its source, it is **a browser-native chat app in the spirit of claude.ai**, not a frontend to the coding agent:

**Runtime model:**
- Pure client-side. No backend. The browser holds the API keys (BYOK via `ProviderKeyInput`, `CustomProviderCard`) and talks directly to OpenAI/Anthropic/etc., with an optional CORS proxy.
- Sessions persist in **IndexedDB** (`storage/backends/indexeddb-storage-backend.ts`, `SessionsStore`, `SettingsStore`) — the equivalent of coding-agent's JSONL files, but browser-local.
- Built as web components on `lit` + `@mariozechner/mini-lit` + Tailwind.

**Tool surface (`src/tools/`):**
- `javascript-repl` — JS REPL executed in-page
- `extract-document` — parses PDF/DOCX/XLSX uploads in the browser (pdfjs, jszip, xlsx)
- `artifacts/` — Claude-style artifacts: HTML, SVG, Image, Markdown, Text, each rendered into a sandboxed iframe
- A renderer registry (`tool-renderer-registry`, `message-renderer-registry`) so consumers can plug in custom tool/message UIs

**Conspicuously absent:** anything that touches a file system, a shell, a project tree. No `bash`, `read`, `edit`, `grep`. The toolset is what the browser can safely do *to itself*.

**Sandbox machinery (`components/sandbox/`):**
- `SandboxedIframe` plus a runtime-provider model (`ArtifactsRuntimeProvider`, `AttachmentsRuntimeProvider`, `FileDownloadRuntimeProvider`, `ConsoleRuntimeProvider`) and a `RuntimeMessageBridge` / `RuntimeMessageRouter`.
- This is the substitute for OS-level isolation: untrusted LLM-generated code runs in an iframe and talks to the host page via a postMessage protocol.

**Re-exported types from agent-core** confirm the integration depth: it uses the same `Agent`, `AgentMessage`, `AgentState` types — i.e. the same conversation/turn machinery as coding-agent. It just feeds that agent a different toolbox.

### The use case

Two ways to read it:

1. **Library** ("Reusable web UI components for AI chat interfaces powered by @earendil-works/pi-ai" — direct from `package.json`). Someone builds a custom AI app in the browser; web-ui supplies the chat panel, message list, attachment handling, provider/model selectors, sandboxed artifact rendering, IndexedDB persistence, JS REPL, document extraction. They get a Claude.ai-ish stack out of the box.

2. **Reference app.** There's an `example/` folder; the `dev` script runs `npm run dev --prefix example`. So the package doubles as a working browser chat app — useful as a demo and as a way for the maintainers to dogfood the components.

### Why it doesn't share coding-agent's runtime

Three reasons that fall out of the design:

- **Environment.** Coding-agent's tools assume Node, a filesystem, a shell, `proper-lockfile`, `glob`, `chalk`, `undici`. None of that runs in a browser. Web-ui's tools assume `window`, iframes, IndexedDB, postMessage. The agent loop is shared because it's pure logic; everything below it is OS-bound.
- **Trust model.** Coding-agent's tools operate on *the user's machine*, gated by approval prompts. Web-ui's tools operate on *the page itself*, gated by iframe sandboxing. Different threat surfaces, different gates.
- **Deployment.** Coding-agent is a CLI you install. Web-ui is shipped to a browser, possibly serverless. The "backend" is the LLM provider directly.

### How this changes the earlier conversation

This makes the original "four modes" picture more honest:

- TUI and print mode are **`coding-agent` running locally with file-system tools**.
- RPC is **the same `coding-agent`, but driven by another program**.
- Web-ui is **a different agent product entirely** — same agent core, different tool surface, browser-resident.

So for the speculative record-server story: web-ui would not "become a frontend over coding-agent." It would become **a second agent that happens to share the record store**, with its own toolset (the record tools running over a network protocol) instead of artifacts/REPL/extract. Coding-agent gets the same record tools alongside its file tools. The record server is the shared spine; the two agents are siblings, not stacked.

That actually matches your earlier framing better — there isn't one server with four clients, there are two agents (CLI + browser) plus a record server, and the four "modes" really mean "four ways to drive *the coding agent specifically*."

## User

OK that's more clear now. So now tell me more about how prompts are context are composed, given that the core agent loop seems to be shared, but the two paths (CLI vs WEB) compose different capabilities, tools, orientations: how is the context on any given turn composed for the agent in the WEB scenario, different to that in one of the CLI scenarios, and where does this logic live?

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/agent/src/harness/ && echo \"---\" && wc -l packages/agent/src/harness/system-prompt.ts packages/agent/src/harness/prompt-templates.ts packages/agent/src/agent.ts packages/agent/src/agent-loop.ts 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "wc -l packages/coding-agent/src/core/system-prompt.ts packages/coding-agent/src/core/prompt-templates.ts packages/coding-agent/src/core/agent-session.ts packages/web-ui/src/ChatPanel.ts packages/web-ui/src/components/AgentInterface.ts packages/web-ui/src/prompts/*.ts 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/web-ui/src/prompts/ packages/agent/src/harness/session/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

## User

**Tool Result:** `TU-033IAgfkYr3MdtQPpWKuKb`

**Tool Result:** `TU-033IAggh95xZ1htfRfyzqs`

**Tool Result:** `TU-033IAgj6mHC1sa3al5oOAm`

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/harness/system-prompt.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/harness/prompt-templates.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/system-prompt.ts"
}
```

## User

**Tool Result:** `TU-033IAgohi2bRaaK9v5pjI5`

**Tool Result:** `TU-033IAgpVudadO2EdHNYky4`

**Tool Result:** `TU-033IAgq2ZGcIR7LzoSMKPS`

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/ChatPanel.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/components/AgentInterface.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/prompts/prompts.ts"
}
```

## User

**Tool Result:** `TU-033IAgxM2jj2x754zivmpV`

**Tool Result:** `TU-033IAgyQigoMmIrIBOEWkj`

**Tool Result:** `TU-033IAgz6dUlzk0S2QMRNqA`

## Assistant

Here's the picture — and an important asymmetry between the two sides.

### What's actually shared in `pi-agent-core`

Surprisingly little of the prompt-composition logic is in the core. The core provides:

- The **`Agent` class** with `state.messages`, `state.tools`, `state.model`, and a `prompt()` method. The Agent does not build a system prompt; it receives whatever messages it's handed.
- The **agent loop** (`agent-loop.ts`) — stream, accumulate tool calls, run tools, append results, loop.
- A tiny helper, `formatSkillsForSystemPrompt`, that emits a `<available_skills>` XML block. That's the entire shared "prompt building" surface — 34 lines.
- A **prompt template loader** (`prompt-templates.ts`, 267 lines) that loads `.md` files with YAML frontmatter and supports `$1`, `$@`, `$ARGUMENTS` substitution. This is what slash commands are made of.

So the core says: *here's how a turn flows and how to format skills; everything else is your problem*. The two consumers take wildly different views on "everything else."

### CLI: a built-on-the-fly system prompt around a filesystem

`coding-agent/src/core/system-prompt.ts` owns the composition. On every session start, `buildSystemPrompt` produces a single string with this layered structure:

```diagram
  ╭─ buildSystemPrompt(options) ─────────────────────────╮
  │  1. Either customPrompt OR the default coding role:  │
  │     "You are an expert coding assistant operating    │
  │      inside pi..."                                   │
  │                                                      │
  │  2. Available tools (filtered by selectedTools,      │
  │     each with a one-line snippet)                    │
  │                                                      │
  │  3. Guidelines — tool-aware:                         │
  │     - if bash but no grep/find/ls:                   │
  │         "Use bash for file operations like rg/find"  │
  │     - if bash + grep/find/ls:                        │
  │         "Prefer grep/find/ls over bash (faster,      │
  │          respects .gitignore)"                       │
  │     - plus user-supplied promptGuidelines            │
  │     - always: "Be concise", "Show file paths"        │
  │                                                      │
  │  4. Pi docs map (README/docs/examples paths)         │
  │                                                      │
  │  5. appendSystemPrompt (verbatim)                    │
  │                                                      │
  │  6. # Project Context (AGENTS.md + other context     │
  │     files loaded by ResourceLoader, each rendered    │
  │     as ## <path> + content)                          │
  │                                                      │
  │  7. <available_skills> XML (only if `read` tool      │
  │     is available; otherwise omitted)                 │
  │                                                      │
  │  8. Current date: YYYY-MM-DD                         │
  │  9. Current working directory: <cwd>                 │
  ╰──────────────────────────────────────────────────────╯
```

Key properties:

- **The prompt knows about the filesystem and the tools simultaneously.** Guidelines are computed from the actual tool selection — turn off `grep`/`find`/`ls`, and the agent is told to use `bash`. This is real coupling between prompt content and tool registration.
- **Project context is injected as text.** `AGENTS.md` and friends are read once at session start and concatenated into the system prompt under a `# Project Context` heading. That's why your project's `AGENTS.md` rules end up actually influencing the model.
- **Skills are presented as XML, not loaded.** The prompt only lists `<name>`, `<description>`, `<location>` per skill. The model reads the full skill file via the `read` tool when it decides one is relevant — which is why skills are gated on `read` being available.
- **Per-turn additions are minimal.** The system prompt is built once; subsequent turns just append the new user message (text + optional `ImageContent` for images) and let `SessionManager` keep the JSONL log. Compaction may summarize older turns to keep the context bounded.

### Web: a thin system prompt, fat tool descriptions

The web side does **not have a `buildSystemPrompt` equivalent**. There is no file in `web-ui/src/` that composes a system prompt. Instead:

- The **embedder** (the consuming app — see `web-ui/example/`) constructs the `Agent` and decides what system message it carries.
- `ChatPanel.setAgent(agent, config)` then *receives* that agent and only **augments tools**, **wires `streamFn` and `getApiKey`**, and **subscribes** to events:

  ```ts
  // ChatPanel.setAgent excerpt
  const additionalTools = config?.toolsFactory?.(...) || [];
  const tools = [this.artifactsPanel.tool, ...additionalTools];
  this.agent.state.tools = tools;
  ```

- `AgentInterface` is a pure view: it subscribes to `AgentEvent`s (`message_start`, `message_update`, `turn_end`, …) and calls `session.prompt(input)` when the user sends.

So where does the model's "orientation" come from? **From the tool descriptions themselves.** Look at `web-ui/src/prompts/prompts.ts`:

- `JAVASCRIPT_REPL_TOOL_DESCRIPTION(...)` — a ~50-line mini-manual explaining the JS environment, which packages to import from esm.run, persistence model, helpers.
- `ARTIFACTS_TOOL_DESCRIPTION(...)` — ~75 lines covering when to use artifacts vs REPL, HTML-artifact requirements, styling guidance.
- `ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RW` / `_RO` — describes the `listArtifacts()`, `getArtifact()`, `createOrUpdateArtifact()` API.
- `ATTACHMENTS_RUNTIME_DESCRIPTION` — describes `listAttachments()`, `readTextAttachment()`, etc.

These descriptions are concatenated **into each tool's description field**, and the runtime-provider snippets are **interpolated into the tools that expose them**. The model learns "what world am I in?" by reading the tool descriptions, not the system prompt.

### The two strategies, contrasted

|  | CLI (coding-agent) | Web (web-ui) |
|---|---|---|
| Who builds the system prompt | `buildSystemPrompt` in coding-agent | Embedder (or none at all) |
| Where the agent learns its "world" | System prompt: cwd, AGENTS.md, tool guidelines, skills XML | Tool descriptions: each tool ships a mini-manual |
| Project context | Loaded files concatenated into prompt | No project; the conversation is the project |
| Skills | Loaded from disk, listed in XML, gated on `read` | Not used |
| Attachments | Text/image inlined as message content | Stored on `UserMessageWithAttachments`; tool runtime exposes them via JS APIs (`listAttachments()`) — the LLM-generated code reads them at runtime, not the prompt |
| Persistence | JSONL via `SessionManager`, compaction-aware | IndexedDB via `SessionsStore` |
| Per-turn additions | Minimal: new user message | Minimal: new user message; attachments referenced by id |
| Coupling between tools and prompt | Tight: guidelines change with tool set | Loose: each tool is self-describing |

### Why this asymmetry exists (and what it implies)

It maps to the two environments cleanly:

- **The CLI has a fixed world** — a working directory, a project, a small stable tool vocabulary. So the system prompt can be authoritative about the world ("you are in `/Users/.../pi`, here are your tools, here are the project rules") and the tool descriptions can stay terse.
- **The web has a malleable world** — no cwd, no project files, tools added by the embedder (`toolsFactory`), arbitrary attachment types in IndexedDB. So the system prompt can't predict the world; instead, each tool carries the orientation needed to use it, and runtime providers (artifacts/attachments) extend that orientation by composing their own description fragments into the tools they augment.

The consequence for your earlier record-server speculation: the **CLI side would integrate record tools by extending `buildSystemPrompt`** (adding a "Records" section like "Project Context", plus tool snippets and guidelines), while the **web side would integrate them as fat self-describing tools** (an `RecordsToolRenderer` plus tool descriptions that explain the schema and authority model). Same record server, two prompt-composition idioms — both already supported by the existing seams.

## User

OK and within a single conversation: I assume that along with the user prompt at each turn, the actual inference call receives this *preceded by some kind of rendering of the transcript up to this point*, does it not? how is that controlled?

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/agent.ts"
}
```

## User

**Tool Result:** `TU-033IAtZnhXRoUNm6wp9nl4`

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "grep -nE \"convertToLlm|transformContext|stream\\(|streamFn|messages:\" packages/agent/src/agent-loop.ts | head -60",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "wc -l packages/coding-agent/src/core/messages.ts && head -100 packages/coding-agent/src/core/messages.ts",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

## User

**Tool Result:** `TU-033IAtk9nqf6Qm1Ii13sgk`

**Tool Result:** `TU-033IAtkFGR8h8v09mTNqLw`

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/messages.ts",
  "read_range": [
    100,
    195
  ]
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/agent-loop.ts",
  "read_range": [
    270,
    360
  ]
}
```

## User

**Tool Result:** `TU-033IAts0uWI90WkgPsROZM`

**Tool Result:** `TU-033IAtsOtIk1V97ehM05ud`

## Assistant

Yes — every turn rebuilds the full LLM payload from the running transcript. The control surface for that rendering is small and explicit. Here's the exact path.

### Per-turn flow inside `streamAssistantResponse`

```diagram
                                                                   per turn
  ╭─────────────────────────────╮   transformContext?   ╭───────────────────╮
  │ context.messages            │ ───────────────────▶  │ AgentMessage[]    │
  │ (the live transcript:       │  (optional pre-pass:  │ (post-transform)  │
  │  AgentMessage[])            │   summarize, redact,  ╰─────────┬─────────╯
  │                             │   reorder, etc.)                │
  ╰─────────────────────────────╯                                 ▼
                                                       config.convertToLlm()
                                                                  │
                                                                  ▼
                                                       ╭──────────────────────╮
                                                       │ llmMessages:         │
                                                       │ Message[] (only      │
                                                       │ user/assistant/      │
                                                       │ toolResult shapes,   │
                                                       │ no custom roles)     │
                                                       ╰──────────┬───────────╯
                                                                  ▼
                              ╭───────────────────────────────────────────────╮
                              │ Context = {                                   │
                              │   systemPrompt: context.systemPrompt,         │
                              │   messages:     llmMessages,                  │
                              │   tools:        context.tools,                │
                              │ }                                             │
                              ╰───────────────────────────────────────────────╯
                                                                  │
                                                                  ▼
                                       streamFn(model, context, { … signal, key })
```

So **the transcript is rendered on every turn**, freshly, from `agent.state.messages`. There is no incremental append to a server-side conversation object — the full conversation, plus the system prompt, plus the tools, is shipped each time.

### The three points of control

`Agent` exposes exactly three hooks for shaping that rendering, and they fire in this order:

#### 1. `transformContext(messages, signal): Promise<AgentMessage[]>`
Pre-pass that rewrites the `AgentMessage[]` itself. Same role types in, same role types out. This is where **truncation, summarization, redaction, and reordering** belong. The coding-agent's compaction runs here (replacing older turns with a `compactionSummary` message).

#### 2. `convertToLlm(messages): Message[] | Promise<Message[]>`
The **mandatory** projection from the agent's internal message vocabulary to the provider-visible vocabulary. Default implementation in `agent.ts`:

```ts
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter(
    (message) => message.role === "user" || message.role === "assistant" || message.role === "toolResult",
  );
}
```

— it drops anything that isn't one of those three roles.

The coding-agent overrides this in `core/messages.ts` to handle the **custom roles it introduces via declaration merging**:

```ts
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    bashExecution:      BashExecutionMessage;
    custom:             CustomMessage;
    branchSummary:      BranchSummaryMessage;
    compactionSummary:  CompactionSummaryMessage;
  }
}
```

…and the override projects each custom role to a `user` message with shaped text:

| Custom role | Renders as |
|---|---|
| `bashExecution` | `user` msg: ``Ran `cmd`\n```output``` `` (skipped entirely if `excludeFromContext` — the `!!` prefix in the TUI) |
| `custom` | `user` msg with the extension's content |
| `branchSummary` | `user` msg wrapped in `BRANCH_SUMMARY_PREFIX/SUFFIX` |
| `compactionSummary` | `user` msg wrapped in `COMPACTION_SUMMARY_PREFIX/SUFFIX` (`"The conversation history before this point was compacted into the following summary:\n<summary>…</summary>"`) |

So compaction's job is two-fold: `transformContext` swaps the cut-off prefix of messages for a single `compactionSummary` message, then `convertToLlm` renders that as a wrapped user message the LLM sees. From the model's point of view, the previous N turns simply become one "previous summary" user turn.

#### 3. `streamFn`
Where the actual provider call happens. Defaults to `streamSimple` from `pi-ai`. Web-ui replaces it with `createStreamFn(...)` that wraps `streamSimple` with optional CORS-proxy logic (see `AgentInterface.setupSessionSubscription`). Coding-agent leaves it as the default.

Note what the rendering **does not** include automatically: the system prompt is just held on `agent.state.systemPrompt` and passed alongside the messages — it is **not** re-rendered or recomposed per turn. It's set once at session start (`AgentSession` builds it via `buildSystemPrompt`) and reused.

### How each side configures this

| Hook | CLI (coding-agent) | Web (web-ui) |
|---|---|---|
| `systemPrompt` | Built by `buildSystemPrompt` at session start: role + tools + guidelines + AGENTS.md + skills XML + cwd + date | Set by the embedder (or left empty); web-ui itself doesn't compose one |
| `transformContext` | Used for compaction (replace older turns with `compactionSummary`); also the place extensions can hook context shaping | Not set by default — the transcript is passed through unchanged |
| `convertToLlm` | Overridden to project `bashExecution`, `custom`, `branchSummary`, `compactionSummary` into `user` messages | Uses `defaultConvertToLlm` — drops anything not user/assistant/toolResult (which is fine, web-ui doesn't introduce extra roles); ChatPanel's `defaultConvertToLlm` export is just a re-export of the core one |
| `streamFn` | Default `streamSimple` | Wrapped in `createStreamFn` for CORS proxy support |
| Tools | Built-in coding tools + extension tools; described in system prompt | Artifacts tool + embedder-supplied tools; described in each tool's own description field |

### Where this leads conceptually

There are basically three layers controlling what the model sees per turn:

```diagram
  ╭──────────────────────────────────────────────╮
  │  systemPrompt   ← built once, reused         │  ← "the world"
  ╰──────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────╮
  │  AgentMessage[] in agent.state.messages      │  ← "the journal"
  │  ↓ transformContext (shape the journal)      │
  │  ↓ convertToLlm    (project to LLM roles)    │
  │  = Message[]                                 │
  ╰──────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────╮
  │  tools          ← live from agent.state.tools │  ← "the verbs"
  ╰──────────────────────────────────────────────╯
```

The agent core enforces only this rigid contract — system prompt + messages + tools — and the two hooks (`transformContext`, `convertToLlm`) are the *only* sanctioned places to manipulate the journal before it ships. Custom message roles (added via TS declaration merging into `CustomAgentMessages`) only become legible to the model when `convertToLlm` knows how to render them.

For your earlier record-server speculation, this is the key seam: a record-watch subscription (e.g. "user changed status while you were thinking") would inject a `recordChange` custom message via the extension API, and the coding-agent's `convertToLlm` would gain a case to render it as a system-style user message — exactly the pattern `compactionSummary` and `branchSummary` already use. No core changes needed; only a custom role and a projection clause.

## User

so if i understand correctly, there is a function exposed from the agent core, which lets implementations control how the raw messages are actuall rendered to the "transcript view" that is submitted to the actual LLM call? meaning: optional filtering, formatting, etc.?

## Assistant

Yes — exactly. The seam is **two functions, both swappable per `Agent` instance**, both invoked on every turn inside `streamAssistantResponse`:

```ts
// agent-loop.ts, streamAssistantResponse
let messages = context.messages;                          // AgentMessage[]
if (config.transformContext) {
  messages = await config.transformContext(messages, signal); // AgentMessage[] → AgentMessage[]
}
const llmMessages = await config.convertToLlm(messages);  // AgentMessage[] → Message[]

const llmContext: Context = {
  systemPrompt: context.systemPrompt,
  messages:     llmMessages,
  tools:        context.tools,
};
await streamFunction(config.model, llmContext, { …, apiKey, signal });
```

So per turn there's a two-stage render pipeline:

| Stage | Signature | Output type | What it's for |
|---|---|---|---|
| `transformContext` (optional) | `(messages, signal) => Promise<AgentMessage[]>` | Same vocabulary | **Reshape the journal**: filter out messages, replace a prefix with a summary, redact secrets, drop tool noise, reorder. Compaction lives here. |
| `convertToLlm` (mandatory, defaulted) | `(messages) => Message[] \| Promise<Message[]>` | LLM vocabulary | **Project to the wire format**: drop roles the LLM doesn't know about, format custom messages as user-text, escape, wrap with prefixes/suffixes. |

Both are set on the `Agent` instance:

```ts
new Agent({
  transformContext: async (msgs) => /* … */,
  convertToLlm:     (msgs)       => /* … */,
});
// or later:
agent.transformContext = …;
agent.convertToLlm = …;
```

The default `convertToLlm` is the deliberately conservative one in `agent.ts`:

```ts
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter(
    (m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
  );
}
```

— everything else is silently dropped. That's why custom roles only "exist" for the LLM if you provide a `convertToLlm` that knows how to render them, as coding-agent does for `bashExecution`, `custom`, `branchSummary`, `compactionSummary`.

A few subtleties worth knowing:

- **The transcript array itself is not mutated.** `transformContext` returns a new array; `convertToLlm` returns a new array. The agent's `state.messages` keeps the raw journal intact (including custom roles), so the UI can still render bash blocks, custom messages, branch summaries, etc., as their original types. Only the LLM gets the projected view.
- **The system prompt is *not* part of this pipeline.** It's stored separately on `context.systemPrompt` and passed alongside the messages. Both functions only shape the body of the conversation, never the system message.
- **Tools are also not part of this pipeline.** `context.tools` is passed through unchanged from `agent.state.tools`. If you want the tool list visible to the LLM to vary per turn, you have to mutate `agent.state.tools` directly (or via the `prepareNextTurn` hook).
- **Order matters and is fixed.** `transformContext` runs first, `convertToLlm` second. So a compactor can introduce a custom `compactionSummary` message during `transformContext`, knowing that `convertToLlm` will project it into a `user` message a few lines later.
- **Both hooks see `signal`.** They can be async and abortable — important if the transform itself calls the LLM (which compaction does, to generate the summary).
- **There is no "rendered transcript" cached anywhere.** Every turn re-runs both functions over the current `agent.state.messages`. Cheap because both are pure-ish projections; expensive if compaction needs to summarize, which is why the compaction logic uses `shouldCompact` to decide whether to act.

So your mental model is right: the agent core's contract is "give me messages + a system prompt + tools," and these two functions are the only sanctioned, instance-configurable place where an implementation gets to decide what "messages" actually means when it's time to talk to the LLM.

## User

you mentioned a "DI container" earlier in one of your summaries, can you tell me more about what this is?

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "wc -l packages/coding-agent/src/core/agent-session-services.ts packages/coding-agent/src/core/agent-session-runtime.ts packages/coding-agent/src/core/sdk.ts",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/agent-session-services.ts"
}
```

## User

**Tool Result:** `TU-033IBANeDFUucfMfMnHVyo`

**Tool Result:** `TU-033IBAOm6czxAZxL28Mo7a`

## Assistant

Good prompt to revisit — I overstated it earlier. Looking at the actual code, **it's not a DI container in the framework sense**. There's no registration step, no resolution graph, no lifecycle/scope manager, no autowiring. What I should have said is "**a service bundle with manual dependency injection**." Let me describe what it actually is.

### What's literally in the file

Two plain functions and one plain interface:

```ts
// the bundle
interface AgentSessionServices {
  cwd: string;
  agentDir: string;
  authStorage:     AuthStorage;
  settingsManager: SettingsManager;
  modelRegistry:   ModelRegistry;
  resourceLoader:  ResourceLoader;
  diagnostics:     AgentSessionRuntimeDiagnostic[];
}

// constructor for the bundle
createAgentSessionServices(options): Promise<AgentSessionServices>

// constructor for a session that takes the bundle
createAgentSessionFromServices({ services, sessionManager, … }): Promise<…>
```

That's the entire mechanism. No framework, no decorators, no provider tokens.

### What `createAgentSessionServices` actually does

It's manual construction with **two affordances** that make it useful:

1. **Every service has a default but is also injectable.** Look at the `??` chain:
   ```ts
   const authStorage     = options.authStorage     ?? AuthStorage.create(join(agentDir, "auth.json"));
   const settingsManager = options.settingsManager ?? SettingsManager.create(cwd, agentDir);
   const modelRegistry   = options.modelRegistry   ?? ModelRegistry.create(authStorage, …);
   const resourceLoader  = new DefaultResourceLoader({ …, cwd, agentDir, settingsManager });
   ```
   If the caller passes one in, use it; otherwise construct the file-backed default. This is the "dependency injection" part — but it's done with constructor parameters and nullish coalescing, not a container.

2. **The construction order encodes the dependency graph.** `modelRegistry` needs `authStorage`; `resourceLoader` needs `settingsManager`; so they're built in that order. There's no DAG resolver; the human author of this function arranged the lines correctly.

After construction, it also does a tiny amount of **post-wiring**: it asks `resourceLoader` for extensions, registers their providers with `modelRegistry`, applies extension flag values. That's not DI either — it's a setup script that happens to live next to the constructor.

### Why I called it a "DI container"

Two patterns made me reach for the term, both of them weaker than what a real container provides:

- **The bundle interface.** `AgentSessionServices` collects the long-lived, cwd-bound services into one object that's threaded through subsequent calls (`createAgentSessionFromServices({ services, … })`). That's a *service locator* shape — one object you ask for whatever you need.
- **Pluggable backends behind interfaces.** `AuthStorage` accepts an `AuthStorageBackend`; `ResourceLoader` is the interface, `DefaultResourceLoader` is the implementation. So when I said "everything's injectable," what's actually true is *some things have an interface seam* — `AuthStorage`, `SessionManager` (via `AuthStorageBackend`, JSONL vs memory repo in `pi-agent-core`), `ResourceLoader`. Others (`SettingsManager`, `ModelRegistry`) are concrete classes that you can substitute by passing a pre-built instance, but they don't have a formal interface.

So the right characterization is: **manual, constructor-based DI, packaged as a service bundle, with optional override of any service**. Plus a couple of explicit interface seams (`AuthStorageBackend`, the session repo abstraction in `pi-agent-core`) where pluggability is formalized.

### Why the design works for them anyway

For this codebase's needs, the lack of a real container is fine — arguably better. Three reasons:

1. **The dependency graph is shallow and stable.** Five services with clear ordering. A container would add ceremony without removing complexity.
2. **The "scope" question is solved by recreation.** Comments in the file say: *"These services are recreated whenever the effective session cwd changes."* Instead of scoped resolution (request/session scopes in a container), they just rebuild the bundle. Simple, explicit, easy to reason about.
3. **The two-phase construction is the real value.** `createAgentSessionServices` first (slow: loads settings, scans extensions, reads auth file), then `createAgentSessionFromServices` second (fast: builds a session against existing services). This is what lets the CLI resolve "which model and tools?" *against* the services before instantiating the session — exactly the comment at the top of the file. A container would force you to either resolve everything up front or write factory functions to defer.

### More accurate vocabulary, going forward

When I said "DI container" I should have said one of:

- **Service bundle / context object** — most accurate; the `AgentSessionServices` interface is the thing.
- **Composition root** — the function `createAgentSessionServices` is the place where defaults are wired together and overrides are accepted.
- **Manual constructor injection** — the technique used inside both `createAgentSessionServices` and `createAgentSessionFromServices`.

So for the earlier conversation about a hypothetical record server: the relevant point still holds — you'd extend `AgentSessionServices` with a `recordClient`, default-construct it in `createAgentSessionServices`, and let callers inject a mock or alternate implementation. But it's "extend the bundle and the constructor function," not "register a binding with a container." Just plain TypeScript with deliberate seams.

## User

OK so now, how is all of this meant to be consumed and used? Is one meant to fork/copy the monorepo and build on it, or to start a new project from scratch that depends upon these packages, and uses their exposed options, hooks, and plugin APIs?

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/coding-agent/docs/ packages/coding-agent/examples/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/README.md",
  "read_range": [
    1,
    100
  ]
}
```

## User

**Tool Result:** `TU-033IBO4H6Kd3D6zystmhxk`

**Tool Result:** `TU-033IBO6TrlgSk2pVHx2tAc`

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/coding-agent/examples/extensions/ packages/coding-agent/examples/sdk/ 2>/dev/null && echo \"---\" && head -30 packages/coding-agent/examples/README.md 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "sed -n '400,653p' packages/coding-agent/README.md",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

## User

**Tool Result:** `TU-033IBOD9fUzCtAdsOmFr35`

**Tool Result:** `TU-033IBOEIjNqjVY5R1nf4Av`

## Assistant

The intended consumption model is **explicitly not "fork and modify."** From the README's opening line: *"Adapt pi to your workflows, not the other way around, without having to fork and modify pi internals."* The whole architecture is shaped around that promise. There are four sanctioned consumption paths, in increasing depth:

### 1. Use `pi` as-is, extend it in place (most common)

Install the published CLI, then add capabilities through the resource system:

```bash
npm install -g @earendil-works/pi-coding-agent
pi install <package>          # or pi install -l <package> for project-local
```

A **pi package** is just a regular npm/git package with a `pi` key in its `package.json` (or conventional `extensions/`, `skills/`, `prompts/`, `themes/` directories). Pi auto-discovers them at startup. The four resource kinds it loads:

- **Skills** — Markdown files with YAML frontmatter that get surfaced to the model.
- **Prompt templates** — Markdown files exposed as slash commands with `$1`/`$@`/`$ARGUMENTS` substitution.
- **Themes** — TUI styling.
- **Extensions** — TypeScript files that hook the lifecycle: add tools, commands, keybindings, UI components, intercept tool calls, modify the system prompt, register custom providers.

The 70+ files in `examples/extensions/` (auto-commit, dirty-repo-guard, custom-compaction, doom-overlay, snake, plan-mode, subagent, …) show that essentially every "feature" you'd normally fork to add can be done as an extension. The maintainers explicitly excluded things like sub-agents and plan mode from the core, on purpose, so the extension API has to carry that weight.

This is what 95% of users are meant to do.

### 2. Embed via SDK (`createAgentSession`)

For wrapping the agent in your own app — a different UI, a different shell, a bot, a CI runner — you import from `@earendil-works/pi-coding-agent`:

```ts
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@earendil-works/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

await session.prompt("What files are in the current directory?");
```

The `examples/sdk/` folder is a graduated tour: `01-minimal` → `02-custom-model` → `03-custom-prompt` → `04-skills` → `05-tools` → `06-extensions` → `07-context-files` → `08-prompt-templates` → `09-api-keys-and-oauth` → `10-settings` → `11-sessions` → `12-full-control` → `13-session-runtime`. That progression is the intended on-ramp: each example adds one more piece of customization without abandoning the previous ones.

`createAgentSessionRuntime` and `createAgentSessionServices` (the service bundle we just discussed) are for cases that need to swap sessions in-process or share services across many sessions — e.g. a long-lived server hosting multiple users.

The README literally points to a real example: *"See [openclaw/openclaw](https://github.com/openclaw/openclaw) for a real-world SDK integration."*

### 3. Drive from another process via RPC

For non-Node integrations (Python, Go, Rust, a desktop app, a Slack bot):

```bash
pi --mode rpc
```

JSON-RPC over stdio with strict LF-delimited JSONL framing. `RpcClient`, `RpcCommand`, `RpcResponse`, `RpcSessionState`, `RpcEventListener` are exported. This is the "treat pi as a server, write your own client" path — same agent, no Node embedding required.

### 4. Pipe / batch via print mode

```bash
cat README.md | pi -p "Summarize this text"
pi -p "Review the code"
```

For shell pipelines and CI. This is just print mode + stdin piping; not really a "consumption model" per se, more an interaction mode.

---

### Where forking actually makes sense

The README does not forbid forking, and `docs/development.md` covers it — but it's positioned as the path for contributors to the project itself, not for consumers. The honest cases for forking are:

- You want to change the **agent loop**, the **system-prompt builder**, the **session JSONL format**, or the **compaction algorithm** in ways the existing hooks don't expose. (These are deep enough that they're not exposed by design.)
- You want to add a **new built-in provider** that needs deep changes in `pi-ai`.
- You want to **rebrand and redistribute** as a different product (which is what `openclaw` appears to do — though I haven't read its source).

If you're forking to add a tool, a UI element, a command, a context-shaping rule, a footer, a status indicator, an autocompleter, a theme, a slash command, a credential manager, a confirmation gate, a context file convention, or a custom message renderer — there's already an extension hook for that, and the example folder probably has a 50-line demo. The architecture punishes forking by making it unnecessary.

### How this maps to your earlier record-server thought experiment

Each consumption path lands a different way:

| Path | How it gets record tools |
|---|---|
| Pi package | Publish `pi-record-tools` as an npm package; `pi install pi-record-tools` adds the tools to anyone's pi |
| SDK embed | Pass record tools as `customTools` to `createAgentSession`, supply your own services bundle that includes a record client |
| RPC driver | The driver process talks to both pi and the record server; record tools live in pi as in the package case |
| Print mode | Same package install; auto-approve policies decide which record writes are allowed unattended |

So the layering for that hypothetical feature would be: **the record server is a new package, the record tools are a pi package (extension), and consumers pick their integration depth from the four paths above** — none of which involve modifying the pi monorepo.

The Philosophy section of the README codifies this stance: "No MCP. No sub-agents. No permission popups. No plan mode. No built-in to-dos. No background bash." Each absence is paired with "use an extension or install a package." The unwritten rule is: *if a feature would limit how someone wants to work, it doesn't go in the core; it goes in an extension you can choose to load or not.*

## User

let's imagine a tool that users can install with `npm i -g foobar`. This tool would be invokable from a directory on a user's system, and would *wrap the local agent*, and expose interactions with this agent through different modes, including web-ui, e.g.

```sh
foobar # starts chat TUI for local-agent
foobar --mode web # opens web GUI-over-local-agent
foobar --mode rpc # addresses local-agent via RPC
```

`foobar` would scope and store all relevant data to the `cwd`, in a local `.foobar/` directory. It would create an SQLite store for its structured data; it may also use JSONL for the raw session data. It would not expose pi's extension/customization APIs but it would use them itself?

How should such a thing be constructed? which of the pi packages would it depend on?

## Assistant

Good thought experiment. Let me work through it concretely. The key insight is that `foobar` is building **a product, not a fork** — same relationship to pi as `coding-agent` has to `pi-agent-core`, just at the next layer up.

### Dependency choice: what to depend on

You have a clean two-option fork here:

#### Option A (recommended): depend on `pi-coding-agent` directly
```
foobar
└── @earendil-works/pi-coding-agent
      ├── pi-agent-core  (transitive)
      ├── pi-ai          (transitive)
      └── pi-tui         (transitive)
```

You inherit the full harness: `createAgentSession`, `SessionManager` (JSONL, compaction, branching), `AuthStorage`, `ModelRegistry`, `SettingsManager`, `ExtensionRunner`, all the built-in coding tools, the TUI components, `InteractiveMode`, `runPrintMode`, `runRpcMode`, `RpcClient`. You override what you don't want via the SDK's options. **This is the right starting point unless you discover a constraint.**

#### Option B: depend on `pi-agent-core` only
Skip coding-agent entirely. You write your own session manager, auth, model registry, system-prompt builder, mode dispatcher. You get only the `Agent` class and the agent loop. Useful if `foobar` has a wildly different domain (no filesystem, no coding tools, no project-context-files concept) — but most products won't.

The vast majority of foobar-shaped products land on Option A. The harness *is* the value.

#### What about web-ui?

`pi-web-ui` is a **components library**, not a server. Its components expect an `Agent` instance in the same JS context. In your design the agent runs on the server (in `.foobar/`), so the components don't fit out of the box. Two realistic stances:

- **Adapt web-ui:** depend on it and write a "remote Agent proxy" — a thin class that implements the bits of `Agent` that `AgentInterface` reads (state.messages, state.tools, subscribe, prompt, abort) and forwards them over websocket to the server. Most of the rendering, attachments, artifacts, sandbox, model picker can be reused.
- **Skip web-ui:** write your own browser UI in whatever framework you prefer. Lighter footprint, no Lit dependency, but you rebuild message rendering, streaming, model picker, etc.

The pragmatic answer is **start without it, add it later if reusable parts justify the dependency.** The components are nice but they're shaped for a specific BYOK-in-browser product.

### Architecture sketch

```diagram
                              user runs `foobar [--mode …]`
                                          │
                                          ▼
                              ╭─────────────────────╮
                              │  foobar CLI         │
                              │  (single binary,    │
                              │   chooses mode)     │
                              ╰─────────┬───────────╯
              ┌───────────────┬─────────┴─────────┬─────────────────┐
              ▼               ▼                   ▼                 ▼
       (default TUI)    --mode web           --mode rpc        --mode print
              │               │                   │                 │
              │               ▼                   │                 │
              │       ╭───────────────╮            │                 │
              │       │ local HTTP +  │            │                 │
              │       │ websocket     │            │                 │
              │       │ server (host) │            │                 │
              │       ╰───────┬───────╯            │                 │
              │               │                   │                 │
              ▼               ▼                   ▼                 ▼
        ╭──────────────────────────────────────────────────────────────╮
        │  SHARED LAYER: foobar agent host                             │
        │  ─ AgentSessionRuntime (createAgentSession from pi-coding-   │
        │    agent)                                                    │
        │  ─ foobar built-in extension (records tools + UI bits)       │
        │  ─ foobar curated system prompt                              │
        │  ─ foobar curated toolset (subset of coding-agent tools +    │
        │    record tools)                                             │
        │  ─ services bundle: SessionManager / AuthStorage /           │
        │    ModelRegistry / SettingsManager / ResourceLoader          │
        │    all pointed at .foobar/                                   │
        ╰──────────────────────────────┬───────────────────────────────╯
                                       ▼
                          ╭────────────────────────╮
                          │   .foobar/  (per-cwd)   │
                          │                         │
                          │  data.db   (SQLite —    │
                          │   records, projections, │
                          │   indices)              │
                          │                         │
                          │  sessions/*.jsonl       │
                          │   (pi SessionManager)   │
                          │                         │
                          │  auth.json              │
                          │   (pi AuthStorage)      │
                          │                         │
                          │  settings.json          │
                          │   (foobar settings,     │
                          │   optionally pi too)    │
                          ╰─────────────────────────╯
```

### How each mode resolves

#### Default (TUI)
Two paths, in order of laziness:

```ts
// Easiest: re-use InteractiveMode wholesale
import { main } from "@earendil-works/pi-coding-agent";
await main({
  cwd: process.cwd(),
  agentDir: path.join(process.cwd(), ".foobar"),
  // synthesize the args you want users to be able to pass; ignore everything else
  args: { /* curated */ },
  // hardcode foobar's services / extensions
});
```

Or — for tighter control — call the lower-level pieces:

```ts
import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  InteractiveMode,
} from "@earendil-works/pi-coding-agent";

const services = await createAgentSessionServices({
  cwd: process.cwd(),
  agentDir: path.join(process.cwd(), ".foobar"),
});

const { session } = await createAgentSessionFromServices({
  services,
  sessionManager: SessionManager.create({ dir: ".foobar/sessions" }),
  customTools: foobarTools,                  // your record tools
  noTools: false,
  tools: ["read", "grep", "find", "ls"],     // curated subset of built-ins
});

await new InteractiveMode({ session, ... }).run();
```

#### `--mode web`
This is the mode that actually changes the architecture. You need a server process **because the agent runs in Node** (reads `.foobar/data.db`, runs tools that touch the filesystem), and the browser is just a remote head.

```ts
// foobar/src/modes/web.ts
import express from "express";       // or hono, fastify, h3 — any HTTP server
import { WebSocketServer } from "ws";
import { createAgentSessionServices, createAgentSessionFromServices } from "@earendil-works/pi-coding-agent";

const services = await createAgentSessionServices({ cwd, agentDir });
const { session } = await createAgentSessionFromServices({ services, ... });

const app = express();
app.use(express.static(/* foobar's built-in web bundle */));
const server = app.listen(port);

const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  // Mirror session events to the websocket
  const unsub = session.subscribe(async (event) => {
    ws.send(JSON.stringify({ type: "event", event }));
  });
  ws.on("message", async (raw) => {
    const cmd = JSON.parse(raw.toString());
    if (cmd.type === "prompt") await session.prompt(cmd.text);
    if (cmd.type === "abort")  session.abort();
    // …read records, list records, write records, etc.
  });
  ws.on("close", unsub);
});

console.log(`foobar web at http://localhost:${port}`);
```

Notice this is **the same JSON-RPC vocabulary that pi's `--mode rpc` already speaks**, just over websocket instead of stdio. So a cleaner implementation: reuse pi's RPC dispatcher directly and pipe it to the websocket — you get the protocol "for free."

Browser bundle: ship it as a static `dist/` baked into the npm package; serve it from express. Use web-ui's components with a `RemoteAgent` proxy, or roll your own — your call.

#### `--mode rpc`
Almost trivial — delegate:

```ts
// foobar/src/modes/rpc.ts
import { runRpcMode } from "@earendil-works/pi-coding-agent";
await runRpcMode({
  services,
  customTools: foobarTools,
  // … foobar's curated config
});
```

Users get pi's well-tested JSON-RPC protocol; foobar just gets to configure the services and tools.

#### `--mode print`
Same delegation:

```ts
import { runPrintMode } from "@earendil-works/pi-coding-agent";
await runPrintMode({ services, prompt, ... });
```

### SQLite + records integration

Three pieces, all internal to foobar:

```diagram
  ╭───────────────────────────────────────────────────────────╮
  │  foobar/src/records/                                      │
  │  ─ db.ts            (better-sqlite3 connection)           │
  │  ─ schema.sql       (tables, indices, triggers)           │
  │  ─ migrations.ts    (versioned schema migrations)         │
  │  ─ commands.ts      (typed commands: createX, updateX)    │
  │  ─ queries.ts       (typed reads + subscriptions)         │
  │  ─ events.ts        (emit on every write — for ws +       │
  │                      agent watch tool)                    │
  ╰───────────────────────────────────────────────────────────╯
                              │
                              ▼
  ╭───────────────────────────────────────────────────────────╮
  │  foobar/src/agent-extension.ts                            │
  │  Registers as a pi ExtensionFactory:                      │
  │   - tools:  record_query, record_get, record_create,      │
  │             record_update, record_subscribe               │
  │   - hooks:  beforeToolCall → authority gate               │
  │             prepareNextTurn → inject watched changes      │
  │   - slash commands: /records, /undo                       │
  ╰───────────────────────────────────────────────────────────╯
                              │
                              ▼
  ╭───────────────────────────────────────────────────────────╮
  │  foobar/src/web-api.ts                                    │
  │  HTTP/WS endpoints for the browser UI:                    │
  │   - GET  /api/records?…                                   │
  │   - POST /api/records/:type                               │
  │   - WS   subscribe to /api/events (record changes +       │
  │          session events)                                  │
  ╰───────────────────────────────────────────────────────────╯
```

The crucial pattern: **records have one source of truth (SQLite via `records/`), and two consumers (the pi extension for agent access, the web-api for user access).** Both go through the same `commands.ts` so authority gates and event emission fire regardless of who initiated the change. Same `commands.ts` is what the TUI's slash commands call too.

### Closing the loop on "uses pi's extension API but doesn't expose it"

You consume the extension API by **calling `createAgentSessionServices`/`createAgentSession` with hardcoded `extensionFactories` and tool lists, and never reading user-supplied `--extension`/`--skill`/`--prompt-template` flags from the CLI.**

You can even be belt-and-braces about it:

- Pass `noTools: true` then explicitly pass your `tools` list + `customTools`.
- Override `customPrompt` so pi's default coding-assistant prompt doesn't appear.
- Use `createAgentSessionServices` with `resourceLoaderOptions` that disable disk discovery for extensions/skills/prompt templates/themes.
- Set `agentDir` to `.foobar/` so pi's `~/.pi/agent/` paths don't get touched at all.

The result: pi's extension *plumbing* runs internally and powers foobar's features; pi's extension *contract* never reaches the end user. From their point of view foobar is opinionated and self-contained.

### Summary

| Concern | Choice |
|---|---|
| Core dep | `@earendil-works/pi-coding-agent` |
| Web UI dep | Add `@earendil-works/pi-web-ui` only if reusing its components; otherwise skip |
| Agent location | Always Node (so file tools + SQLite work) |
| Web mode shape | Local HTTP+WS server; browser is a thin remote head over JSON-RPC |
| RPC mode | Delegate to `runRpcMode` |
| TUI mode | Delegate to `InteractiveMode` or `main()` with curated args |
| Print mode | Delegate to `runPrintMode` |
| Structured data | SQLite in `.foobar/data.db`, owned by a `records/` module |
| Records → agent | Internal pi extension registering tools + hooks |
| Records → user | HTTP/WS endpoints from foobar's own web server |
| Sessions | `SessionManager` pointed at `.foobar/sessions/*.jsonl` |
| Auth/models | `AuthStorage`/`ModelRegistry` pointed at `.foobar/` |
| User-facing extension API | None — foobar consumes pi's API; users see only foobar's CLI flags |

The whole thing fits in one npm package, a few thousand lines of TypeScript, plus a static web bundle. The interesting work is in `records/` and the web frontend; everything else is delegation.

## User

let me push slightly on the web server API: you said the browser is a thin remote head over JSON-RPC, but then also acknowledged that there might be REST-like endpoints for the structured data. These sound potentially divergent

## Assistant

You're right, and that was a sloppy moment in my sketch. Two protocols for one product is a real cost: two clients to maintain, two error models, two auth stories, two ways for things to drift. Let me retract the REST endpoints and argue for a cleaner shape.

### The honest position: one protocol, used for both

The same reasons that made JSON-RPC the right fit for the agent — long-lived connection, bidirectional, server-pushed events, structured method/result/error — apply just as well to records. Records aren't a different kind of thing; they're another set of methods on the same bus.

```diagram
        ╭──── browser ────╮      ╭──── headless driver ────╮
        │  WebSocket      │      │  stdio                  │
        ╰────────┬────────╯      ╰────────────┬────────────╯
                 │                            │
                 ▼                            ▼
        ╭────────────────────────────────────────────────╮
        │  foobar JSON-RPC dispatcher                    │
        │                                                │
        │  session.* methods   (already pi's rpc)        │
        │   - session.prompt                             │
        │   - session.abort                              │
        │   - session.subscribe                          │
        │                                                │
        │  records.* methods   (foobar adds)             │
        │   - records.query     {type, where, …}         │
        │   - records.get       {type, id}               │
        │   - records.create    {type, data, idemKey}    │
        │   - records.update    {type, id, ifVersion, …} │
        │   - records.delete    {type, id, ifVersion}    │
        │   - records.subscribe {type?, id?}             │
        │                                                │
        │  events (server → client, unsolicited)         │
        │   - session_event                              │
        │   - records.changed                            │
        ╰────────────────────────────────────────────────╯
```

The browser is now a JSON-RPC client over WS. A curl-equivalent headless driver speaks the same protocol over stdio (or another WS). The agent's record tools speak the same protocol *internally* (just function calls on the same dispatcher, not even going over a transport). One vocabulary, three call sites, zero translation layers.

### Why this is genuinely better, not just neater

Three concrete benefits, beyond "less code":

1. **The agent's record tools and the browser's record actions go through the exact same command layer.** When the agent does `records.update` and when a user clicks "save" in the web UI, they hit the same authority gate, the same optimistic-concurrency check, the same `records.changed` event emission. With a split (RPC for agent, REST for UI), you'd duplicate that logic or have the REST layer call into the RPC layer — extra code and a place to drift.

2. **Subscriptions are first-class, not bolted on.** `records.subscribe` returns a subscription id; the server pushes `records.changed` events until you `records.unsubscribe`. With REST you'd need either polling or a parallel SSE/WS channel, which is the divergence problem in miniature.

3. **The same protocol description doubles as the wire format for two existing modes.** `foobar --mode rpc` and the browser are the same protocol, just different transports. New tooling (`foobar-cli`, `foobar-watch`, language SDKs) only has to learn one thing.

### What about the REST appeal?

The reason REST kept sneaking into my earlier sketch is real and worth naming. REST is good at three things foobar legitimately needs:

| REST is good at | Honest assessment |
|---|---|
| Debuggability with `curl` | True. A `foobar-cli get records/invoices/123` thin wrapper around JSON-RPC covers this. |
| External integrations (webhooks in, links out) | Webhooks specifically *do* need HTTP. So does sharing a permalink to a record. |
| File uploads (multipart) | Real concern. WS handles binary but multipart is awkward. |
| Caching with HTTP intermediaries | Not relevant here — single-user local server. |
| Resource-shaped URLs | Aesthetic; doesn't reduce code. |

So the principled compromise is: **keep one primary protocol (JSON-RPC over WS for browser, stdio for headless drivers), and add a thin HTTP surface only where the *transport* genuinely matters.** That second surface should be a *projection of the same commands*, not a parallel implementation. Concretely:

```
HTTP surface (thin, optional, transport-driven):
  GET    /api/records/:type/:id        → calls records.get internally
  POST   /webhooks/:source             → translates payload into records.* commands
  POST   /api/uploads                  → multipart, returns blob id usable in records.*
  GET    /api/health                   → liveness
  GET    /                             → serves the static web bundle
```

These endpoints all delegate to the same internal command functions; they're shims, not a second API. The browser does *not* use them — it talks WS exclusively. The HTTP surface exists for external callers and uploads.

A useful guideline: **if a feature requires a long-lived connection or pushes events, it's WS. If it only needs request-response and a non-WS caller exists, it can be HTTP.** Records normally fall in the first bucket. Webhooks and uploads in the second.

### The mental model

```diagram
                            ╭─────────────────────╮
                            │   commands.ts       │  ← single source of truth
                            │   (typed verbs,     │
                            │    authority gate,  │
                            │    event emit)      │
                            ╰──────────┬──────────╯
                                       │ called by
            ┌──────────────┬───────────┼───────────┬───────────────┐
            ▼              ▼           ▼           ▼               ▼
        records.*    session tool   web HTTP    webhook       slash command
        RPC method   handlers       shim        receiver      (TUI)
            │              │           │           │               │
            └────────┬─────┴─────┬─────┴─────┬─────┴───────────────┘
                     ▼           ▼           ▼
              browser WS    agent (Node)   external
                            (in-process)   HTTP callers
```

Every actor — browser, agent, headless RPC driver, webhook source, TUI slash command — calls the same set of typed command functions. The transports differ; the surface doesn't.

So: yes, REST endpoints were divergent; retracting them as a primary surface. The correct primary is **JSON-RPC for everything, served over WS to the browser and stdio for headless mode.** A small HTTP surface stays only for the things HTTP is specifically needed for, and it's strictly a shim over the same command layer — never the agent's path, never the browser's path.

## User

the possible exception that seems plausible to me at first, was that maybe there are read-only REST endpoints, i.e. just GET, to facilitate data loading and display; but maybe this is not necessary. How would the front-end architecture work then, assuming we're using React, when the server I/O is all RPC over websockets?

## Assistant

Good — you're right that read-only GETs *feel* plausible but they don't actually buy you much here, because the data you want to load is the same data you want to *watch* (records change, the agent might be writing them mid-view). Once a view needs live updates, fetching it once over GET means you have to layer a WS subscription on top anyway. Better to start with the subscription.

Here's how the frontend architecture works.

### Three primitives, one transport

The whole React app needs exactly three data primitives, all implemented over the single WS connection:

| Primitive | Maps to | When |
|---|---|---|
| **Query** | One JSON-RPC call, response cached by `(method, params)` | Reads where you don't need live updates (settings, dropdown options, schema metadata) |
| **Subscription** | `records.subscribe` → one snapshot + a stream of `records.changed` events | Any view of records — list pages, detail pages, dashboards |
| **Mutation** | One JSON-RPC call, returns result + invalidates/updates cache | Writes: `records.create`, `records.update`, `session.prompt` |

This is the same trichotomy GraphQL uses, and Relay/Apollo/tRPC/TanStack Query all support — there's nothing exotic about it.

### Client layer (transport + state)

```diagram
                            ╭───────────────────────╮
                            │  WebSocket (one,      │
                            │   foobar:port/ws)     │
                            ╰───────────┬───────────╯
                                        │
                            ╭───────────▼───────────╮
                            │  RpcClient (singleton)│
                            │  - connect / reconnect│
                            │  - id ↔ request map   │
                            │  - subscription map   │
                            │  - re-subscribe on    │
                            │    reconnect          │
                            ╰───────────┬───────────╯
                                        │
              ╭─────────────────────────┼─────────────────────────╮
              ▼                         ▼                         ▼
        useQuery(method,         useSubscription(            useMutation(method)
                 params)                 method, params)
              │                         │                         │
              ▼                         ▼                         ▼
         TanStack Query           TanStack Query             TanStack Query
         queryFn = rpc.call       initialData = first         mutationFn = rpc.call
                                   event; onUpdate →           onMutate = optimistic
                                   queryClient.setQueryData    onSettled = invalidate
```

**One WebSocket, one client, three hooks.** The RpcClient owns the wire; the hooks own the React integration; TanStack Query owns the cache and re-render scheduling. Each piece does one thing.

A typical view ends up looking like this:

```tsx
function InvoiceDetail({ id }: { id: string }) {
  const { data: invoice, status } = useSubscription("records.subscribe", {
    type: "invoice",
    id,
  });
  const updateInvoice = useMutation("records.update");

  if (status === "loading") return <Skeleton />;
  if (!invoice) return <NotFound />;

  return (
    <Form
      defaultValues={invoice}
      onSubmit={(values) =>
        updateInvoice.mutate({
          type: "invoice",
          id,
          ifVersion: invoice.version,
          data: values,
        })
      }
    />
  );
}
```

No fetch, no useEffect data loading, no manual cache invalidation. The subscription handles initial load *and* live updates uniformly. The mutation handles writes *and* concurrency (the `ifVersion` round-trips).

### Why TanStack Query, given the trichotomy

I'd reach for TanStack Query rather than rolling state management because:

- It already understands `(method, params) → cached result` semantics — that's its whole model. You just supply a custom `queryFn` that calls `rpc.call(method, params)`.
- It has battle-tested **optimistic updates** with rollback (`onMutate` / `onError`), which you'll want for record edits.
- It handles **request deduplication**: two components subscribing to the same record share one subscription on the wire.
- The cache invalidation API (`queryClient.invalidateQueries`, `setQueryData`) is exactly what a subscription handler needs to push live updates into.
- It plays nicely with React Suspense / `use()` if you want that idiom.

The only thing it doesn't natively do is WS subscriptions. You bridge that in ~30 lines:

```ts
function useSubscription(method, params) {
  const queryClient = useQueryClient();
  const queryKey = [method, params];

  const query = useQuery({
    queryKey,
    queryFn: () => rpc.call(method, params),         // initial snapshot
    staleTime: Infinity,                              // don't refetch — we're subscribed
  });

  useEffect(() => {
    const sub = rpc.subscribe(method, params, (event) => {
      queryClient.setQueryData(queryKey, event.value);
    });
    return () => sub.unsubscribe();
  }, [method, JSON.stringify(params)]);

  return query;
}
```

That's it. Everything else — render scheduling, garbage collection of stale data, devtools — comes from TanStack.

### What about the initial load?

This is the question REST GETs feel like they solve, but the answer is straightforward:

- Foobar's web server serves a **static SPA bundle** (HTML + JS + CSS, the same dist baked into the npm package).
- The HTML loads instantly; the JS opens the WS; the first roundtrip happens on localhost.
- First paint shows route shell + skeletons; subscriptions resolve in single-digit milliseconds.
- For a single-user local dev tool, you cannot perceive the difference between this and SSR.

If you wanted to optimize further, the truly cheap trick is: **inject the initial cache snapshot into the HTML**. Foobar's HTTP handler for `/` can run the relevant queries server-side, JSON-stringify them, and bake them into a `<script id="__initial_cache">…</script>` tag. The React app reads that on mount and seeds `queryClient.setQueryData` before any WS roundtrip happens. This makes first paint truly instantaneous and is ~50 lines of code total. Whether it's worth it depends on perceived snappiness; you can ship without it and add later.

### Routing and code-splitting

Standard React Router (or TanStack Router, which integrates nicely with TanStack Query) with `lazy()` per route. Because data loading goes through the WS subscription primitive, **there are no data-loading waterfalls** — code loads while data subscriptions kick off in parallel. The classic SPA cold-start problem (load JS → load data → render) collapses to (load JS + open WS in parallel → render).

If you go with TanStack Router, the loader pattern works cleanly:

```ts
const route = createRoute({
  path: "/invoices/$id",
  loader: ({ params }) => queryClient.ensureQueryData({
    queryKey: ["records.get", { type: "invoice", id: params.id }],
    queryFn: () => rpc.call("records.get", { type: "invoice", id: params.id }),
  }),
  component: InvoiceDetail,
});
```

The loader pre-warms the cache before the component mounts; the component then upgrades that cache entry to a live subscription via `useSubscription`. Best of both worlds.

### Reconnect, errors, optimistic concurrency

Three behaviors the RpcClient + hooks layer needs to handle, all standard:

- **Reconnect:** when the WS drops, the client opens a new one and re-issues every active subscription. TanStack Query treats this as if the subscription's data became fresh again; no UI flicker beyond a brief stale state.
- **Errors:** RPC errors come back as standard JSON-RPC `{ code, message, data }` and are exposed through TanStack's `error` field on each hook. You handle them per-view (banner, toast, inline) like any async error.
- **Optimistic concurrency:** `records.update` returns `{ ok: false, code: "version_conflict", current }` when `ifVersion` is stale. The mutation's `onError` shows a conflict UI and offers "discard local / merge / keep mine"; rolling back the optimistic update is a one-liner in TanStack.

### When you'd actually reach for a REST GET

Three honest cases left over:

1. **A user shares a permalink to a specific record.** Opening that URL needs an HTML page; the page can either (a) be served by the same SPA shell and load via WS subscription on mount (recommended), or (b) be SSR'd from a GET handler. The SPA path is simpler.
2. **An external tool wants to grep records without speaking JSON-RPC.** This is what `foobar-cli` is for — a small CLI wrapper around the WS client. If you also expose a `GET /api/records/:type/:id` shim it's strictly a convenience for `curl`.
3. **A static asset that happens to be a record.** Images, attachments, generated PDFs — they need `Content-Type` headers and HTTP caching. These genuinely should be HTTP, but they're files, not records.

None of these are reasons to introduce REST as the *frontend's* data path. The browser stays on the WS spine; the HTTP surface stays a small shim for things HTTP is uniquely good at.

### The thing this all enables

Once every view in the React app is a `useSubscription`, the app becomes **eventually consistent with the server's record store, by construction.** When the agent updates a record, every open browser tab shows the change immediately. When the user edits in tab A, tab B sees it. When two clients race, optimistic concurrency catches the conflict at write time. You never write a refresh button, you never write a polling loop, you never write a "stale data" warning — those failure modes simply don't exist in the data plane.

That's the architectural payoff for committing to one protocol with subscriptions as a first-class primitive. The frontend gets simpler, not more complex.

## User

OK excellent. very interesting. I think we're getting close to the outline of an MVP for such a product. A further question: Let's imagine that the structured records this application lets you build, together with an agent, are the nodes and edges of an *intent graph*. This intent graph as a whole, constitutes the specification for a software project, which means that it must remain structurally legal (local rules) as well as semantically legal (global coherence). This also means that in any given agent session, continuity of context such as elicited by the agent, and expressed by the user, is important. In an application architecture which allows multiple sessions however, and also allows direct user-editing in some way, there is the possibility that this continuity becomes disrupted between turns. In this architecture the way we are imagining it so far, how can I determine between turns, if the overall "state of the world / coherence state" of the intent-graph might have changed between turns of a session, due to changes that were made outside of that session?

## Assistant

Great question — and it cuts to the deepest architectural problem in this design. Let me work through it carefully.

The problem decomposes into **four distinct questions** that often get conflated:

```diagram
  ╭─ "Has the world changed since my session last looked?" ─────╮
  │  Q1: DETECTION   — Did anything change at all?              │
  │  Q2: RELEVANCE   — Of what changed, what matters to me?     │
  │  Q3: COHERENCE   — Is the graph still globally legal?       │
  │  Q4: RECONCILE   — How does the agent learn about it?       │
  ╰─────────────────────────────────────────────────────────────╯
```

Each needs its own mechanism, and they compose.

### Q1 — Detection: a monotonic clock for the graph

The cheapest answer: every write to the records store advances a **monotonic Log Sequence Number** (LSN, or call it `graphRevision`). One counter, graph-wide.

```sql
CREATE TABLE graph_clock (lsn INTEGER PRIMARY KEY);
CREATE TABLE change_log (
  lsn        INTEGER PRIMARY KEY,
  ts         INTEGER NOT NULL,
  actor      TEXT NOT NULL,       -- session_id, user, agent_on_behalf_of, …
  op         TEXT NOT NULL,       -- create | update | delete | edge_add | edge_remove
  record_type TEXT NOT NULL,
  record_id  TEXT NOT NULL,
  diff       BLOB NOT NULL,       -- json patch
  invariants_violated TEXT        -- nullable; populated by validator
);
```

Every command writes one row to `change_log` and advances `graph_clock`. The append-only log is the source of truth for "what happened." Per-record `version` columns are derived from this — the existence of the log is what makes detection possible without polling individual records.

A session, between turns, asks one cheap question:

```ts
const currentLsn = await records.getCurrentLsn();
if (currentLsn > session.lastSeenLsn) {
  // something happened — proceed to Q2
}
```

That's the gross filter. Constant-time, no false negatives.

### Q2 — Relevance: a per-session interest set

The vast majority of changes are not relevant to any given session. You need a **session-scoped read set** that grows as the agent (and the user, via the UI) touches the graph.

Three layers of interest, in increasing aggressiveness:

| Layer | Members | When added |
|---|---|---|
| **Direct** | Record IDs the session read, wrote, or whose subscribe stream it consumed | On every records.* call inside the session |
| **Mentioned** | Record IDs that appear in user prompts or assistant messages (extracted by regex on `record:` URIs, or by an LLM pass during compaction) | On message ingest |
| **Neighborhood** | 1-hop edges out from the direct set; optionally further | Computed at query time, not stored |

Persist the Direct + Mentioned sets alongside session state (`.foobar/sessions/<id>.jsonl` already has the right shape; add `interest_set` lines as a new entry type). The Neighborhood is computed on demand against the current graph.

Between turns:

```ts
const events = await records.changesSince(session.lastSeenLsn, {
  actor: { not: session.id },         // exclude self-writes
});
const relevant = events.filter(e =>
  session.interestSet.has(e.record_id) ||
  session.interestSet.hasNeighbor(e.record_id, depth=1)
);
```

If `relevant` is empty, the change cloud is "background noise" — record progress in some other session, an unrelated edit by the user. Update `lastSeenLsn` silently and proceed.

If `relevant` is non-empty, you have a **divergence**.

### Q3 — Coherence: a separable, queryable property

Treat coherence as **a property of the graph that has its own lifecycle**, not as a synchronous validation gate. Two reasons:

1. **Performance**: global coherence checks are expensive (graph traversals, cycle detection, constraint propagation). You don't want every write to pay that cost.
2. **Honesty**: a graph can be locally legal everywhere yet globally incoherent. Pretending writes can always restore coherence is a lie.

Concretely:

```sql
CREATE TABLE coherence (
  id                 INTEGER PRIMARY KEY,
  computed_at_lsn    INTEGER NOT NULL,
  state              TEXT NOT NULL,     -- clean | dirty | validating | incoherent
  violations         BLOB NOT NULL      -- json[]: rule_id, scope, message, evidence
);
```

Two things populate it:

- **Structural validation** runs **eagerly** on every write — these are local invariants enforced as DB constraints or per-command precondition checks. A write that breaks structure is rejected at commit. The graph is never structurally illegal.
- **Semantic validation** runs **lazily / out-of-band** — a coherence validator subscribes to `records.changed`, debounces, and re-evaluates global rules over the graph (or affected subgraphs, with dependency tracking). It writes a new `coherence` row each time it completes. The graph can be in `dirty` state during validation, `incoherent` after if violations are found.

This means the system has a **coherence state**, not just a coherence answer. You can ask it three questions:

| Question | Answer |
|---|---|
| Is the graph currently believed coherent? | `state` field |
| Was that determination current as of which LSN? | `computed_at_lsn` |
| What violations exist? | `violations` |

For session-level reasoning, the second one matters most: if `computed_at_lsn < currentLsn`, the coherence verdict is stale and a fresh validation should be queued.

### Q4 — Reconciliation: the agent learns at the turn boundary

Now the architectural payoff. We already saw that the agent loop has a **`prepareNextTurn`** hook that runs between turns and can inject a turn update. And we saw that **custom message roles** can be added via TypeScript declaration merging into `CustomAgentMessages`, with their projection to LLM-visible content defined by `convertToLlm`. These are the only seams you need.

```diagram
  ╭──────────────────────────────────────────────────────────────╮
  │  foobar agent extension's prepareNextTurn:                   │
  │                                                              │
  │  1. const currentLsn = records.getCurrentLsn()               │
  │  2. if (currentLsn === session.lastSeenLsn) return undefined │
  │  3. const events = records.changesSince(session.lastSeenLsn, │
  │                       excludeActor: session.id)              │
  │  4. const relevant = filterByInterestSet(events, session)    │
  │  5. const coh = records.getCoherenceState()                  │
  │  6. session.lastSeenLsn = currentLsn                         │
  │  7. if (relevant.empty && coh.clean) return undefined        │
  │  8. return {                                                 │
  │       messagesToAppend: [{                                   │
  │         role: "worldUpdate",                                 │
  │         relevantChanges: relevant,                           │
  │         coherenceState: coh,                                 │
  │         timestamp: Date.now(),                               │
  │       }],                                                    │
  │     }                                                        │
  ╰──────────────────────────────────────────────────────────────╯
```

The `worldUpdate` custom message role is declared and projected:

```ts
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    worldUpdate: WorldUpdateMessage;
  }
}

// in convertToLlm:
case "worldUpdate":
  return {
    role: "user",
    content: [{ type: "text", text: formatWorldUpdate(m) }],
  };
```

Where `formatWorldUpdate` produces something like:

```
[Note: while this conversation was idle, the intent graph changed in ways
relevant to what we've been discussing.]

Changes since the last turn (3 relevant of 17 total):
  - Goal G-payments-v2 (was: status=draft, now: status=approved)
      changed by: user, 12:43
  - Constraint C-pci-required (added)
      created by: user, 12:44
  - Task T-stripe-integration (was: depends_on=[G-payments-v1],
                                now: depends_on=[G-payments-v2])
      changed by: session S-789 (Alice), 12:45

Coherence: as of LSN 18472 (current), graph is INCOHERENT.
Violations:
  - rule: tasks_must_link_to_active_goal
    scope: T-checkout-flow
    message: links to deleted goal G-checkout-v0
    evidence: …

Please take these into account before proceeding. You may need to:
  - re-read records you were working with
  - revise plans that assumed prior state
  - decline to make changes that would conflict
  - help resolve coherence violations if relevant to this conversation
```

The agent reads this as user-attributed context at the top of its next response. It can choose to re-fetch records, ask the user clarifying questions, propose a recovery, or surface the coherence problem.

### The flow, end-to-end

```diagram
  user types prompt              user edits in web UI         another session writes
         │                                │                            │
         │                                ▼                            ▼
         │                  ╭─────────────────────────────────────────────╮
         │                  │  records server: every command              │
         │                  │   - append to change_log                    │
         │                  │   - advance graph_clock                     │
         │                  │   - emit records.changed event              │
         │                  │   - update per-record version               │
         │                  │   - structural validation (sync)            │
         │                  ╰─────────────┬───────────────────────────────╯
         │                                │
         │                                ▼
         │                  ╭─────────────────────────────────────────────╮
         │                  │  coherence validator (async, debounced)     │
         │                  │   - recomputes global invariants            │
         │                  │   - writes new coherence row                │
         │                  ╰─────────────────────────────────────────────╯
         ▼
  ╭─────────────────────────────────────────────────────────────────────────╮
  │  session.prompt(...) is called                                          │
  │                                                                         │
  │  agent loop, before LLM call:                                           │
  │   1. prepareNextTurn fires                                              │
  │   2. compares lastSeenLsn → currentLsn                                  │
  │   3. fetches relevant changes + coherence state                         │
  │   4. if non-empty: appends a worldUpdate custom message                 │
  │                                                                         │
  │  agent loop, building LLM payload (we mapped this earlier):             │
  │   5. transformContext runs                                              │
  │   6. convertToLlm projects worldUpdate → user message                   │
  │   7. systemPrompt + messages + tools shipped to provider                │
  │                                                                         │
  │  agent loop, during turn:                                               │
  │   8. every tool call to records.* updates session.interestSet           │
  │      and session.lastSeenLsn                                            │
  ╰─────────────────────────────────────────────────────────────────────────╯
```

### The properties this gives you

- **No polling.** The clock + change log is the source of truth; the session checks it at one moment, the turn boundary.
- **No false negatives.** If `currentLsn > lastSeenLsn`, the system knows the world has changed. It can be deliberate about how loudly to tell the agent.
- **Tunable false positives.** The interest set + neighborhood depth controls how often "something changed but it doesn't matter" leaks into the conversation. Start tight (Direct only), widen if the agent makes incoherent decisions.
- **Explicit coherence as a first-class signal.** The agent doesn't infer coherence from the records' surface; it sees the validator's verdict and the violations directly.
- **Honest about staleness.** Because `coherence.computed_at_lsn` is recorded, the agent can be told "coherence verdict is current" vs "verdict is stale; treat with skepticism."
- **One mechanism serves all event sources.** Other sessions, direct UI edits, webhooks, future collaborators — they all advance the same LSN, write to the same log, are filtered by the same interest set.

### The subtler dimensions

A few things the MVP doesn't need to solve but the architecture should leave room for:

**Snapshot vs live consistency within a turn.** A turn is a sequence of tool calls that may take minutes. Do you let mid-turn changes from other actors affect the agent? For an intent graph, I'd say **no**: the turn operates against a snapshot, and any updates that landed mid-turn surface at the *next* turn boundary. This keeps the agent's reasoning internally coherent. The cost is occasional staleness; the gain is no thrashing.

**Read-set conflict at turn-end.** When the turn finishes and its writes are about to commit, you can check: were any records in the turn's read set modified by another actor since the turn started? If yes, you've got a transactional conflict. Options: reject the writes (forces the agent to retry with fresh data — expensive), accept the writes (last-writer-wins), or accept-and-flag (writes land, but `coherence` immediately enters `dirty` and the validator runs). Accept-and-flag is the friendliest for an MVP.

**Hard vs soft incoherence response.** Structural violations should never exist (commit-time enforcement). Semantic violations have severity: some make the graph unusable (the agent should refuse to elaborate the affected subtree until repaired), others are just warnings. Encode `severity` in the violation record and let the agent's prompt template decide how to react.

**Coherence-aware compaction.** When the conversation gets long enough to compact, the compaction summary should *include* the interest set and recent coherence verdicts, not just the message text. Otherwise the compacted session loses its grip on the graph it was reasoning about. This is the right place to keep the "what was this conversation about, in graph terms?" anchor.

**Coherence is itself a graph property — surface it in the UI too.** The web UI should show the coherence badge alongside the graph view, with violations clickable. The agent's `worldUpdate` injection and the user's UI experience should be two views of the same state — neither should be authoritative over the other.

### The minimum viable version

For an MVP, ship:

- `graph_clock` + `change_log` tables with monotonic LSN.
- Per-session `lastSeenLsn` and `interestSet` (Direct only, no Neighborhood yet).
- A synchronous structural validator (DB constraints + per-command checks).
- A trivial coherence validator that runs on every commit (no debounce yet) and writes verdicts to `coherence`.
- A `prepareNextTurn` hook in the foobar agent extension that produces `worldUpdate` messages when relevant.
- A `worldUpdate` custom message role with a plain-text projection.

That's ~600 lines of TypeScript + SQL. You can ship a coherent (pun intended) MVP without ever optimizing, then add Neighborhood depth, debouncing, dependency-tracked re-validation, read-set conflict checks, and severity-aware response policies as real usage reveals which corners actually hurt.

The deep payoff: because every cross-session, cross-actor change leaves a trace in one place (the change log), and because the agent's awareness of "what changed" goes through one place (the `prepareNextTurn` hook), you have **a single point in the architecture where the continuity-of-context problem is solved**. Add a new mode (collaborator joining the session, headless bot writing records), and that point is the only thing that needs to know.