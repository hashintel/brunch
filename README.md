![Status: alpha](https://img.shields.io/badge/status-alpha-orange)

# Brunch Alpha

> Brunch Alpha is pre-release software. Data models, local workspace files, CLI behavior, and developer-facing APIs may change without migration support while the alpha line is still proving the product foundation.

Brunch Alpha is a re-foundation of `brunch` on top of the Pi coding-agent harness. It is an opinionated local product for co-authoring a specification with an agent: Brunch owns the spec workspace, graph model, structured exchanges, and public RPC surface while using Pi for the agent loop, transcript substrate, TUI shell, and extension seams.

The current alpha is TUI-first. Running `brunch` opens an interactive terminal UI that drives the local agent session and also serves a read-only browser sidecar for richer visual projections over the same host. RPC and print modes exist for probes, automation, and scripted inspection; a standalone web-only mode is planned but not currently a product mode.

## Run Brunch

Brunch requires Node 20+ and an Anthropic API key.

Create a `.env` file in the project directory where you want to use Brunch:

```bash
printf 'ANTHROPIC_API_KEY=sk-ant-...\n' > .env
```

Then launch the alpha from that directory:

```bash
npx @hashintel/brunch@alpha
```

Brunch creates or reuses a local `.brunch/` workspace under the current directory. That workspace holds project-scoped Brunch state, including the selected spec/session, graph persistence, and Pi JSONL-backed transcript data.

Useful launch variants:

```bash
# default interactive TUI
npx @hashintel/brunch@alpha

# TUI plus browser sidecar launch
npx @hashintel/brunch@alpha --open-web

# JSON-RPC line server for tools and probes
npx @hashintel/brunch@alpha --mode rpc

# render current workspace state and exit
npx @hashintel/brunch@alpha --mode print
```

If you prefer a global install:

```bash
npm install -g @hashintel/brunch@alpha
brunch
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for real-provider agent runs. |
| `ANTHROPIC_MODEL` | No | Foreground agent model override. |
| `OBSERVER_MODEL` | No | Background/observer model override where configured. |
| `BRUNCH_PORT` | No | Port for the local web sidecar host. |

## Product Shape

Brunch Alpha is one local host with several presentation surfaces:

- `--mode tui` is the default writer/driver. It embeds the Pi coding-agent runtime, Brunch prompt policy, structured exchange tools, graph tools, workspace/session selection, and TUI chrome.
- The browser sidecar is served by the TUI process. It is a Brunch React app over Brunch JSON-RPC, currently oriented around read-only graph/session projections.
- `--mode rpc` exposes Brunch product methods over JSON-RPC for probes, integrations, and automation. Clients speak Brunch method names rather than raw Pi commands.
- `--mode print` is a headless one-shot surface for scripting and inspecting workspace state.

The durable product model is graph-native: the intent graph is canonical specification meaning, with oracle, design, and plan graph planes as accountable downstream work. Mutations go through Brunch-owned command/session seams; the browser and probes read named projections instead of reading SQLite, JSONL, or Pi internals directly.

## Developer Setup

Clone the repository, install dependencies, and run the source CLI:

```bash
npm install
printf 'ANTHROPIC_API_KEY=sk-ant-...\n' > .env
npm run dev
```

Common development commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Brunch CLI from source. Defaults to TUI mode. |
| `npm run test` | Run Vitest once. |
| `npm run fix` | Apply lint fixes, then format. |
| `npm run check` | Read-only lint, format, and skill consistency checks. |
| `npm run verify` | Full local gate: fix, test, and build. |
| `npm run build` | Build TypeScript, packaged Pi assets, and the web bundle. |

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for release flow, fixture workflow, and the current internal source-of-truth documents.

## Source Overview

The `src/` topology follows the current architecture decision in [`memory/SPEC.md`](./memory/SPEC.md). Directory-level `README.md` files under `src/**/` are canonical for the boundaries they describe.

```text
src/
├── .pi/          # sealed Pi runtime surface: agents, skills, components, extensions
│   ├── agents/      # Brunch foreground/background agent role prompts
│   ├── components/  # reusable Pi TUI/message components
│   ├── extensions/  # Brunch Pi registrars: tools, hooks, commands, UI affordances
│   ├── skills/      # Brunch agent skills read on demand by the runtime
│   └── settings.json # dev-only ambient Pi settings when launching from src/
├── app/         # CLI mode dispatch and product host wiring
├── db/          # Drizzle schema, migrations, and SQLite connection lifecycle
├── dev/         # dev-only harnesses and proof tests
├── graph/       # graph domain, schema, readers, policy, and CommandExecutor
├── probes/      # product/proof drivers and reportable oracle runs
├── projections/ # structured DTOs derived from domain/session/tool facts
├── renderers/   # lossy text, markdown, and display renderers
├── rpc/         # Brunch JSON-RPC protocol, handlers, registry, and web host
├── session/     # Pi JSONL transcript projection, exchanges, runtime state, coordination
├── utils/       # small shared utilities
├── web/         # React browser sidecar over Brunch RPC
├── workspace/   # cwd/package identity and .brunch workspace state helpers
└── constants.ts # shared package/product constants
```

Important boundaries:

- `src/.pi/` is a sealed Brunch Pi profile, not a generic user extension directory. Production Brunch imports its Pi resources and extension factories explicitly.
- `graph/` is the only application layer that imports `db/` directly.
- `rpc/` exposes named Brunch product methods, not a generic records API.
- `web/` consumes Brunch RPC projections only; it must not read SQLite, Pi RPC, local JSONL, or `.brunch/workspace.json` directly.
- `projections/` preserves reusable structure; `renderers/` may lose structure for human-readable output.

## Architecture Docs

Start here when changing the alpha architecture:

- [`memory/SPEC.md`](./memory/SPEC.md) — product contract, capability requirements, decisions, assumptions, invariants, and lexicon.
- [`memory/PLAN.md`](./memory/PLAN.md) — active frontier work and current sequencing.
- [`docs/architecture/prd.md`](./docs/architecture/prd.md) — POC product thesis, mode topology, and milestone ladder.
- [`docs/architecture/pi-seam-extensions.md`](./docs/architecture/pi-seam-extensions.md) — how Brunch lands structured exchanges, lenses, spec selection, side tasks, and staleness on Pi seams.
- [`docs/architecture/probes-and-transcripts.md`](./docs/architecture/probes-and-transcripts.md) — probe artifacts, transcript evidence, and report shape.
- [`src/README.md`](./src/README.md) — current source topology and dependency direction.

## Help

```bash
npx @hashintel/brunch@alpha --help
```
