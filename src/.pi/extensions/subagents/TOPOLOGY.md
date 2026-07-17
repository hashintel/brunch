# subagents extension — D44-L / D91-L / D92-L

> **Status:** product Specify-mode wiring active. Normal Brunch launches inject
> the selected parent spec/workspace/session snapshot, spec-bound graph readers,
> and the code-owned delegatable set — registration is unconditional; whether the
> `subagent` tool is active/advertised is the per-mode tool policy's call
> (Specify-mode's elicitor allowlist includes it, Execute-mode's executor
> allowlist excludes it). Launches that explicitly omit subagent deps, or carry
> an empty delegatable set, do not register or advertise the tool.

SPEC decisions: D44-L (subagent), D39-L (sealed profile), D40-L (registration ≠
advertisement), D90-L (shared foreground/background manifest + code-owned
background discovery), D91-L (semi-permeable seal + assembled prompt), D92-L
(sovereign grants + code-owned delegatable-set gate), D93-L (op-mode↔foreground
collapse). Frontier: PLAN.md `subagent-reconciliation`.

---

## TL;DR for the next agent

1. **It works through the faux-provider child-session path.** `runSubagent`
   assembles a background prompt, preserves sealed in-memory services, and can
   grant a spec-bound `read_graph` tool from injected parent-world handles.
2. **Startup wiring is product-owned.** The app root calls
   [`loadBrunchSubagents()`](../../../app/pi-subagents.ts) for normal Specify-mode
   launches, injecting selected-world context and the code-owned delegatable set.
   The registrar advertises and runs only loaded definitions in that allowlist.
3. **Spawnability is op-mode-owned, not frontmatter-owned.** Background manifests
   author sovereign `tools` grants, but their `canDelegate` remains empty; a
   manifest cannot self-advertise into Specify mode.
4. **Canonical docs now match the semi-permeable implementation.** SPEC
   `D44-L` / `D91-L` / `I29-L` name the SDK sealed child session with explicit
   injected world reads; do not restore the superseded no-world/verbatim-body
   shape.
5. **Don't reintroduce** ambient `~/.pi` discovery, the `globalThis.__pi_subagents`
   bridge, or a `pi` subprocess — all three conflict with D39-L sealing and were
   deliberately dropped.

---

## What this is

The D44-L/D91-L `subagent` tool: a main-agent-invoked, **blocking** Pi tool that
delegates an isolated reasoning task to a sealed Pi child session and normally
returns the child's last assistant message as tool-result content. Internal callers
may instead request one factory-owned terminating output tool by name/schema and
require exactly one validated submission; callers cannot inject tool execution
behavior around the manifest-owned grant. Starter background agents
are read-only (`explorer`, `researcher`) or no-tools (`projector`, `reviewer`) and
are spawnable by Specify mode because the app root supplies them in the code-owned
delegatable set. The execute-only `worker` is registry-owned but not
spawnable through the foreground `subagent` tool; `AgentRunnerPort` launches it
directly for sandbox runs with bounded `read` + `write_worktree_file` authority.
`explorer` can also read the selected parent spec through `read_graph` when the
app root injects graph readers.

It is the Brunch-native realization of the community "subagents" pattern
(`amosblomqvist/pi-subagents`, the canonical pi example, etc.), but using Pi's
**SDK** instead of spawning the `pi` binary. See
[Comparison to the original](#comparison-to-the-original-amosblomqvistpi-subagents).

## Execution model — SDK child session, not a subprocess

Each subagent runs as an in-process SDK `AgentSession`
(`createAgentSessionServices` → `createAgentSessionFromServices`), built from
**explicit sealed services** so it inherits nothing implicit (D39-L):

```diagram
╭──────────────── foreground agent (elicitor) ────────────────╮
│  subagent tool.execute({ agent, task } | { tasks:[…] })      │
│     │  semaphore(maxConcurrency) + Promise.all + AbortSignal │
│     ▼                                                        │
│  runSubagent ─ resolveSubagentModel ─ planSubagentTools ──╮  │
╰───────────────────────────────────────────────────────────│─╯
                                                             ▼
        ╭──────── sealed SDK child AgentSession ────────╮
        │ authStorage   = AuthStorage.inMemory()        │  no ambient auth.json
        │ settings      = inMemory(BRUNCH policy)        │  injected per child
        │ resourceLoader= sealed: noExtensions/noSkills/ │  no ambient discovery
        │                 noPromptTemplates/noThemes/    │
        │                 noContextFiles                 │
        │ systemPrompt  = assembled background prompt    │  body + control + snapshot
        │ modelRegistry = parent's (resolved auth)       │  no model bootstrap
        │ sessionManager= SessionManager.inMemory(cwd)   │  nothing persisted
        │ tools         = explicit allowlist only        │  read-only graph if injected
        ╰───────────────────────────────────────────────╯
                    │ session.prompt(task)
                    ▼ assistant text or exactly-one typed submission ──▶ caller
```

The child has no ambient conversation context, no `CommandExecutor`, and no
Brunch RPC. Parent world access is explicit and semi-permeable: the prompt gets a
snapshot-at-spawn block (selected workspace/spec/session plus bounded session
digest), while selected-spec graph reads happen on demand through granted Brunch
read tools such as `read_graph`. Foreground delegation returns only the last
assistant message; bounded internal ports may instead capture validated arguments
from an explicit output-contract tool. Structured tool `details` remain render-only.

## File map

| File                                                             | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`agents.ts`](./agents.ts)                                       | Markdown agent loader: tiny frontmatter parser (no YAML dep), TypeBox-validated schema (`name`, `description`, `tools`, `model`, `thinking`), explicit `BACKGROUND_SUBAGENT_IDS` registry, `loadSubagentDefinitions(dir, ids?)` over `src/agents/subagents/<id>.md` → `Map<name, def>`. Projects frontmatter into the shared `AgentManifest` background shape and fails loud on malformed/duplicate/id-drifted agents. |
| [`config.ts`](./config.ts)                                       | TypeBox loader for [`config.json`](./config.json) (`version`, `maxConcurrency`; tolerates `$comment`).                                                                                                                                                                                                                                                                                                                 |
| [`prompt-assembly.ts`](./prompt-assembly.ts)                     | Background prompt assembler: agent body + child-control header + injected world snapshot + `<brunch-skills>` + background router rules. Reuses the shared prompt-skill manifest renderer; deliberately omits the foreground elicitation recommendation block.                                                                                                                                                          |
| [`session.ts`](./session.ts)                                     | The sealed child-session runner. `resolveSubagentModel`, `createSubagentToolCatalog`, `planSubagentTools`, `createSubagentOutputContract`, `runSubagent`. The catalog is the shared source that resolves sovereign manifest-authored grants; the branded output factory is the sole extra-tool path and owns capture + termination. Never throws — failures return as error results. **Injectable SDK builders** (`createServices`/`createSession`) for testing.       |
| [`index.ts`](./index.ts)                                         | `registerBrunchSubagents(pi, deps)` — registers the one `subagent` tool (single `{agent,task}` or parallel `{tasks:[…]}`), filters advertisement/execution to `definitions ∩ deps.delegatableAgents`, `createSemaphore` for bounded concurrency, result formatting. Re-exports the public surface.                                                                                                                     |
| [`../../../agents/subagents/<id>.md`](../../../agents/subagents) | Declarative background agent body home. Background bodies carry frontmatter; `agents.ts` loads only registry-listed ids.                                                                                                                                                                                                                                                                                               |
| [`config.json`](./config.json)                                   | Externalized concurrency cap (`maxConcurrency: 4`).                                                                                                                                                                                                                                                                                                                                                                    |
| [`__tests__/agents.test.ts`](./__tests__/agents.test.ts)         | Tests parsing, config, model resolution, tool planning, semaphore fairness, registrar usage errors, abort lifecycle, and **two end-to-end faux-provider child-session runs** asserting the sealing invariants.                                                                                                                                                                                                         |
| [`../../../app/pi-subagents.ts`](../../../app/pi-subagents.ts)   | **App composition root.** `loadBrunchSubagents({cwd, agentDir, delegatableAgents, world})` assembles `BrunchSubagentsDeps` using the sealed `pi-settings` helpers plus explicit parent-world handles and the code-owned op-mode delegatable set. Keeps `.pi/` free of `src/app` imports (deps are injected).                                                                                                           |

Boundary rule: `.pi/extensions/subagents/*` may import the SDK and `../web-tools/web/`
(for `web_search`/`web_fetch`), but **never** `src/app/*`. The app layer injects
the sealed primitives.

## Agent definitions (`src/agents/subagents/<id>.md`)

Frontmatter is the background-agent authoring contract; the code-owned
`BACKGROUND_SUBAGENT_IDS` list is the registry. The markdown body is the first
section of the child's assembled system prompt, replacing Pi's coding base.
Foreground bodies live separately as flat files under `src/agents/prompts/` and
their metadata is owned by the op-mode keyed foreground roster. `canDelegate` is
not a background frontmatter field; background manifests project it to `[]`.

```yaml
---
name: explorer              # required, unique
description: …              # required (shown in the tool description/catalog)
tools: read, grep, find, ls # comma-separated; omit/empty ⇒ no tools
model: default              # "default" (inherit parent) or "provider/model-id"
thinking: low               # low | medium | high
---
<body becomes the child system prompt>
```

Starter agents (read-only / no-write):

| agent        | tools                              | role                                                           |
| ------------ | ---------------------------------- | -------------------------------------------------------------- |
| `explorer`   | `read, grep, find, ls, read_graph` | read-only codebase + selected-spec graph recon                 |
| `researcher` | `web_search, web_fetch`            | external web research                                          |
| `projector`  | _(none)_                           | one candidate-proposal variant per call; fan out for diversity |
| `reviewer`   | _(none)_                           | proposal/commitment review from supplied context               |
| `worker`     | `read, write_worktree_file`         | execute-mode sandbox code worker (not Specify-delegatable)     |

Tool resolution (`planSubagentTools`): read-only filesystem tools come from the
SDK (`createReadToolDefinition(cwd)` etc., cwd-bound, override built-ins of the
same name); web tools come from Brunch's own `../web-tools/web/` factories; `read_graph`
comes from the graph extension's reusable read-tool factory and is available only
when parent graph readers are injected. `write_worktree_file` is a Brunch-owned
bounded complete-file write tool scoped to the child session cwd; `AgentRunnerPort`
uses it with `cwd = worktreeDir`. The child grant is sovereign: it resolves against
this catalog, not against the parent op-mode's active tool list. Shell/nesting
built-ins (`bash`, ambient `write`/`edit`, `subagent`) are not in the catalog; an
unknown tool name in frontmatter **throws** at plan time (authoring bug → fail loud).

## Startup wiring

`createBrunchPiExtensions` registers and advertises `subagent` only when its
options carry `subagents` with a non-empty `delegatableAgents` set; omitted or
empty deps keep the tool absent. The app root supplies those deps for normal
Specify-mode launches, using the current selected spec, a spec-bound `GraphReaders`
object, selected workspace/session facts, `sessionManager.getBranch()` for the
bounded digest, and the operational mode's code-owned delegatable set for
spawnability.

Do not load subagents as an ambient extension independent of product state. The
gate is product context: selected spec/session plus non-empty code-owned
spawnability, not the dev-tools switch.

## Conceptual reference (preserved from the design discussion)

**Isolation is ambient-closed, explicit-world-open.** The child does **not** share
the parent's thread. It owns in-memory session/auth/settings and receives only the
assembled prompt plus explicitly granted tools. The faux-provider tests assert
this: the child system prompt is assembled from the agent body (not "coding
agent"), only declared tools are advertised, the task is the conversational
input, and `read_graph` returns the parent spec only.

**Blocking: yes (D44-L).** The parent's turn awaits the child. Within one call,
multiple `tasks` fan out concurrently via `Promise.all` + `createSemaphore`
(capped by `config.json` `maxConcurrency`), and `AbortSignal` propagates parent
cancellation into `session.abort()`. For I/O-bound LLM calls this is the right
primitive set — `worker_threads` would add nothing (the work is network I/O, not
CPU), and the subprocess/RPC models trade that simplicity for ambient-discovery
coupling we explicitly rejected.

**Nesting: deliberately not supported (yet).** The original grants `subagent` as
a *tool* to nest-capable agents (its `worker`), bounded by a `subagent_agents` →
`PI_SUBAGENT_ALLOWED` allowlist, no depth counter (bundled depth stops at 2).
Brunch children get an explicit allowlist that **excludes** `subagent`, so they
cannot recurse — a safety property, not an oversight. To enable nesting later:
add a recursion-bounded `subagent` tool to a child's pool in `planSubagentTools`
and carry a depth/allowlist bound; pairs naturally with the future write-capable
`worker` under an execute op-mode.

## Comparison to the original (`amosblomqvist/pi-subagents`)

| Aspect          | Original                                                                                                                                                    | Brunch (this)                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent discovery | Bundled `agents/*.md` beside `index.ts` **+** `globalThis.__pi_subagents` runtime bridge for other extensions                                               | Flat `src/agents/subagents/<id>.md` home via explicit `BACKGROUND_SUBAGENT_IDS` → `loadSubagentDefinitions(dir, ids?)`; **no** bridge, **no** ambient `~/.pi` scan, and no directory scan |
| Frontmatter     | Loose: string split + silent defaults; extra `subagent_agents` allowlist; `model` default `anthropic/claude-sonnet-4-6`                                     | Strict TypeBox schema, **fails loud**; no `subagent_agents` (no nesting); `model: default` inherits parent                                                                                |
| Execution       | `spawn()` a child `pi` process (`--mode json -p --no-session --no-skills --no-extensions`, re-adds `--extension` paths, `--append-system-prompt` temp file) | In-process SDK `AgentSession` with sealed services                                                                                                                                        |
| Isolation basis | OS process boundary + flags; depends on a resolvable `pi` binary on PATH                                                                                    | Sealed in-memory services; no binary, no ambient leakage                                                                                                                                  |
| Nesting         | Supported via `subagent`-as-tool + `PI_SUBAGENT_ALLOWED`                                                                                                    | Not supported (children lack the tool)                                                                                                                                                    |

The file-based bundled layout you liked is preserved; the parts that fight
sealing (the `globalThis` bridge and the `pi` subprocess) are what changed.

## Verify

```bash
# from repo root
npx tsc -p tsconfig.build.json --noEmit          # typecheck (project)
npx oxlint --type-aware src/.pi/extensions/subagents src/app/pi-subagents.ts src/app/pi-extensions.ts
npx oxfmt --check src/.pi/extensions/subagents/*.ts src/app/pi-subagents.ts src/app/pi-extensions.ts
npx vitest --run src/.pi/extensions/subagents     # focused subagent tests
npx vitest --run src/.pi                           # 271 tests (blast radius of the opt-in channel change)
npm run build                                      # compiles + copies agent bodies + config.json into dist
```

(Project convention: `npm run fix` inner loop, `npm run verify` gate — but those
mutate the whole tree; prefer the file-scoped commands above when other work is
in flight.)

## Deferred / open

- **Production launch gate** — choose and prove the non-dev condition that
  supplies subagent deps intentionally; ordinary production sessions remain
  default-off until then.
- **Nesting** and a **write-capable `worker`** — deferred until an execute
  operational mode lands.
- **Progress UI** — NDJSON/`subagent.progress` streaming for TUI/web is deferred
  (the SDK child runs in-process; surface its progress when bandwidth permits).
