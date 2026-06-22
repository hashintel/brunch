# subagents extension — D44-L

> **Status (handoff doc):** mechanism **built + verified**, but **not yet wired
> into startup** — the `subagent` tool is absent/default-off until a launch path
> passes `subagents` to `createBrunchPiExtensions(...)`. This README is
> intentionally fatter than the sibling topology READMEs because the feature is
> mid-integration; once it is wired, trim it back to the short orientation-surface
> convention (ownership + SPEC refs + layout).

SPEC decisions: D44-L (subagent), D39-L (sealed profile), D40-L (registration ≠
advertisement). Frontier: PLAN.md `subagent-adoption`.

---

## TL;DR for the next agent

1. **It works and is fully tested.** `runSubagent` runs a sealed in-process SDK
   child session over a faux provider in the tests; the full gate is green
   (typecheck / lint / format / 334 unit tests / build).
2. **The only thing left is the startup wiring decision.**
   `loadBrunchSubagents()` in [`src/app/pi-subagents.ts`](../../../app/pi-subagents.ts)
   is **never called** yet. Pick a gate (recommended: `BRUNCH_DEV`, mirroring
   introspection) and pass its result as `{ subagents }` into
   `createBrunchPiExtensions(...)`. See [How to wire it in](#how-to-wire-it-in).
3. **Canonical docs now match the implementation.** SPEC `D44-L` / `I29-L` name
   the **SDK sealed child session** model; do not restore the superseded
   subprocess/argv-shape design.
4. **Don't reintroduce** ambient `~/.pi` discovery, the `globalThis.__pi_subagents`
   bridge, or a `pi` subprocess — all three conflict with D39-L sealing and were
   deliberately dropped.

---

## What this is

The D44-L `subagent` tool: a main-agent-invoked, **blocking** Pi tool that
delegates an isolated reasoning task to a sealed Pi child session and returns the
child's last assistant message as tool-result content. Starter agents are
read-only (`scout`, `researcher`) or no-tools (`proposer`) — no write/worker
agent yet.

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
        │ systemPrompt  = agent .md body (REPLACES base) │  not Pi coding base
        │ modelRegistry = parent's (resolved auth)       │  no model bootstrap
        │ sessionManager= SessionManager.inMemory(cwd)   │  nothing persisted
        │ tools         = explicit allowlist only        │  no bash/edit/write
        ╰───────────────────────────────────────────────╯
                    │ session.prompt(task)
                    ▼ getLastAssistantText() ──▶ tool-result content
```

The child has no conversation context (the `task` string must be
self-contained), no `CommandExecutor`, no graph access, and no Brunch RPC. Its
last assistant message is the only thing that crosses back to the parent.

## File map

| File | Responsibility |
| --- | --- |
| [`agents.ts`](./agents.ts) | Markdown agent loader: tiny frontmatter parser (no YAML dep), TypeBox-validated schema (`name`, `description`, `tools`, `model`, `thinking`), `loadSubagentDefinitions(dir)` → `Map<name, def>`. Fails loud on malformed/duplicate agents. |
| [`config.ts`](./config.ts) | TypeBox loader for [`config.json`](./config.json) (`version`, `maxConcurrency`; tolerates `$comment`). |
| [`session.ts`](./session.ts) | The sealed child-session runner. `resolveSubagentModel`, `planSubagentTools`, `runSubagent`. Never throws — failures return as error results. **Injectable SDK builders** (`createServices`/`createSession`) for testing. |
| [`index.ts`](./index.ts) | `registerBrunchSubagents(pi, deps)` — registers the one `subagent` tool (single `{agent,task}` or parallel `{tasks:[…]}`), `createSemaphore` for bounded concurrency, result formatting. Re-exports the public surface. |
| [`agents/*.md`](./agents) | Declarative agent definitions (see below). |
| [`config.json`](./config.json) | Externalized concurrency cap (`maxConcurrency: 4`). |
| [`subagents.test.ts`](./subagents.test.ts) | Tests parsing, config, model resolution, tool planning, semaphore fairness, registrar usage errors, abort lifecycle, and **two end-to-end faux-provider child-session runs** asserting the sealing invariants. |
| [`../../../app/pi-subagents.ts`](../../../app/pi-subagents.ts) | **App composition root.** `loadBrunchSubagents({cwd, agentDir})` assembles `BrunchSubagentsDeps` using the sealed `pi-settings` helpers. Keeps `.pi/` free of `src/app` imports (deps are injected). |

Boundary rule: `.pi/extensions/subagents/*` may import the SDK and `../web/`
(for `web_search`/`web_fetch`), but **never** `src/app/*`. The app layer injects
the sealed primitives.

## Agent definitions (`agents/*.md`)

Frontmatter is the registry contract; the markdown body is the child's system
prompt (used verbatim, replacing Pi's coding base).

```yaml
---
name: scout                 # required, unique
description: …              # required (shown in the tool description/catalog)
tools: read, grep, find, ls # comma-separated; omit/empty ⇒ no tools
model: default              # "default" (inherit parent) or "provider/model-id"
thinking: low               # low | medium | high
---
<body becomes the child system prompt>
```

Starter agents (read-only / no-write):

| agent | tools | role |
| --- | --- | --- |
| `scout` | `read, grep, find, ls` | read-only codebase recon |
| `researcher` | `web_search, web_fetch` | external web research |
| `proposer` | _(none)_ | one candidate-proposal variant per call; fan out for diversity |

Tool resolution (`planSubagentTools`): read-only filesystem tools come from the
SDK (`createReadToolDefinition(cwd)` etc., cwd-bound, override built-ins of the
same name); web tools come from Brunch's own `../web/` factories. Write/shell
built-ins (`bash`/`edit`/`write`) are never in the pool; an unknown tool name in
frontmatter **throws** at plan time (authoring bug → fail loud).

## How to wire it in

The feature is registered behind an opt-in in `createBrunchPiExtensions` already:
when its options carry `subagents`, the tool is registered **and** unioned into
the opt-in active-tool channel (alongside the dev introspection tools); when
omitted it is absent (default-off). See
[`src/app/pi-extensions.ts`](../../../app/pi-extensions.ts) — search for
`options.subagents` and `BRUNCH_SUBAGENT_TOOL`.

What is missing is a **launch path that supplies those deps**. Mirror the
introspection precedent in
[`src/app/brunch-tui.ts`](../../../app/brunch-tui.ts):

**Step 1 — import the composition root** (top of `brunch-tui.ts`):

```ts
import { loadBrunchSubagents } from './pi-subagents.js';
```

**Step 2 — load the deps inside the runtime factory.** In
`createBrunchAgentSessionRuntimeFactory`, the returned
`async ({ cwd, agentDir: runtimeAgentDir, sessionManager }) => { … }` already has
`cwd` and `runtimeAgentDir` in scope. Before the `createBrunchPiSettings({...})`
call, gate the load (recommended gate: `context.dev`, i.e. `BRUNCH_DEV`, per
D71-L):

```ts
const subagents = context.dev
  ? await loadBrunchSubagents({ cwd, agentDir: runtimeAgentDir })
  : undefined;
```

**Step 3 — pass it into the extensions options**, right next to the existing
introspection opt-in (search for `context.dev ? { introspection: … }`):

```ts
...(context.dev ? { introspection: context.dev.introspection } : {}),
...(subagents ? { subagents } : {}),   // ← add this line
```

That's the whole wiring. `createBrunchPiExtensions` does the rest: it registers
the `subagent` tool and adds `BRUNCH_SUBAGENT_TOOL` to the opt-in allowlist so
the operational-mode policy advertises it.

### Choosing the gate (the real decision)

`createBrunchPiExtensions` adds `subagent` to the **active** tool set whenever
`subagents` is present, so **do not** load it unconditionally — that would make
subagents live in every production `elicit` session, contradicting D44-L
("optional enhancement, not load-bearing") and the default-off design.

- **Recommended (proving stage):** gate on `context.dev` / `BRUNCH_DEV`, exactly
  like introspection. Exercisable in dev, dead in prod, no new switch.
- **Production trigger** ("when may the elicitor delegate acquisition?") is
  explicitly **deferred** (D82-L successor seam). When that lands, the gate
  becomes a posture/capability check rather than the dev switch.

To also drive it from the dev/faux loop, wire `loadBrunchSubagents` into the
`src/dev/` front door / faux-harness the same way (D68-L).

## Conceptual reference (preserved from the design discussion)

**Isolation is total.** The child does **not** share the parent's thread. Own
in-memory session/auth/settings, own system prompt, returns only its last
assistant message. The faux-provider tests assert this: the child system prompt
is the agent body (not "coding agent"), only the declared tools are advertised to
the model, and the task is the sole conversational input.

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

| Aspect | Original | Brunch (this) |
| --- | --- | --- |
| Agent discovery | Bundled `agents/*.md` beside `index.ts` **+** `globalThis.__pi_subagents` runtime bridge for other extensions | Bundled `agents/*.md` via explicit `loadSubagentDefinitions(dir)`; **no** bridge, **no** ambient `~/.pi` scan |
| Frontmatter | Loose: string split + silent defaults; extra `subagent_agents` allowlist; `model` default `anthropic/claude-sonnet-4-6` | Strict TypeBox schema, **fails loud**; no `subagent_agents` (no nesting); `model: default` inherits parent |
| Execution | `spawn()` a child `pi` process (`--mode json -p --no-session --no-skills --no-extensions`, re-adds `--extension` paths, `--append-system-prompt` temp file) | In-process SDK `AgentSession` with sealed services |
| Isolation basis | OS process boundary + flags; depends on a resolvable `pi` binary on PATH | Sealed in-memory services; no binary, no ambient leakage |
| Nesting | Supported via `subagent`-as-tool + `PI_SUBAGENT_ALLOWED` | Not supported (children lack the tool) |

The file-based bundled layout you liked is preserved; the parts that fight
sealing (the `globalThis` bridge and the `pi` subprocess) are what changed.

## Verify

```bash
# from repo root
npx tsc -p tsconfig.build.json --noEmit          # typecheck (project)
npx oxlint --type-aware src/.pi/extensions/subagents src/app/pi-subagents.ts src/app/pi-extensions.ts
npx oxfmt --check src/.pi/extensions/subagents/*.ts src/app/pi-subagents.ts src/app/pi-extensions.ts
npx vitest --run src/.pi/extensions/subagents     # 26 tests
npx vitest --run src/.pi                           # 271 tests (blast radius of the opt-in channel change)
npm run build                                      # compiles + copies agents/*.md + config.json into dist
```

(Project convention: `npm run fix` inner loop, `npm run verify` gate — but those
mutate the whole tree; prefer the file-scoped commands above when other work is
in flight.)

## Deferred / open

- **Startup wiring + gate** — see [How to wire it in](#how-to-wire-it-in). The
  mechanism is done; the gate is a product decision.
- **Product startup wiring** — choose and prove the launch gate that supplies
  subagent deps intentionally; ordinary sessions should remain default-off until then.
- **Nesting** and a **write-capable `worker`** — deferred until an execute
  operational mode lands.
- **Progress UI** — NDJSON/`subagent.progress` streaming for TUI/web is deferred
  (the SDK child runs in-process; surface its progress when bandwidth permits).
