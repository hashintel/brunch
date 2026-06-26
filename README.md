![Status: alpha](https://img.shields.io/badge/status-alpha-orange)

# Brunch Alpha

> Brunch Alpha is pre-release software. Data models, local workspace files, CLI behavior, and developer-facing APIs may change without migration support while the alpha line is still proving the product foundation.

Brunch Alpha is a re-foundation of `brunch` on top of the Pi coding-agent harness. It is an opinionated local product for co-authoring a specification with an agent: Brunch owns the spec workspace, graph model, structured exchanges, and public RPC surface while using Pi for the agent loop, transcript substrate, TUI shell, and extension seams.

The current alpha is TUI-first. Running `brunch` opens an interactive terminal UI that drives the local agent session and also serves a read-only browser sidecar for richer visual projections over the same host. RPC and print modes exist for probes, automation, and scripted inspection; a standalone web-only mode is planned but not currently a product mode.

## Run Brunch

Brunch requires Node 24. Launch the alpha from the project directory you want Brunch to use:

```bash
npx @hashintel/brunch@alpha
```

Brunch creates or reuses a local `.brunch/` workspace under the current directory. That workspace holds project-scoped Brunch state, including the selected spec/session, graph persistence, and Pi JSONL-backed transcript data. No `.env` file is required for a local/offline launch.

Useful launch variants:

```bash
# default interactive TUI
npx @hashintel/brunch@alpha

# TUI plus browser sidecar launch
npx @hashintel/brunch@alpha --open-web
```

Prefer `npx` during the alpha line. Global installs are easy to leave stale while the CLI, local workspace shape, and Pi integration are still moving.

## Environment Variables

Brunch does not own a provider/model/port configuration surface. Provider auth and model selection belong to the embedded Pi runtime, and live model calls use whatever Pi auth is configured on the machine. The model selection forwarded by Brunch agents is `default` ("inherit the parent's current model"), so there is no `ANTHROPIC_MODEL`/`OBSERVER_MODEL` override path. The web sidecar always binds an ephemeral port and prints its URL; there is no `BRUNCH_PORT`.

Brunch's own environment surface is operational (offline/dev/source flags), not product config:

| Variable | Default | Description |
| --- | --- | --- |
| `PI_OFFLINE` | `1` | Brunch defaults this to `1` (offline) around the interactive run. Set `0` only when deliberately exercising live provider calls through configured Pi auth. |
| `PI_SKIP_VERSION_CHECK` | `1` | Defaulted to `1` by Brunch to skip Pi's runtime version check. |
| `BRUNCH_DEV` | — | Set `1` to expose the dev-only `dev.graph.mutateGraph` method in the JSON-RPC dev surface. Absent from discovery otherwise. |
| `BRUNCH_DB` | `./.brunch/data.db` | SQLite path used by `drizzle-kit` tooling only (`db:generate`, `db:studio`). Does not affect the runtime workspace DB, which is resolved per-cwd. |
| `PI_SOURCE` / `PI_SOURCE_ROOT` | — | Dev-only: set `PI_SOURCE=1` to alias the `@earendil-works/pi-*` packages to a local `pi-mono` checkout (default `~/.pi/pi-mono`, overridable via `PI_SOURCE_ROOT`) so source edits apply without rebuilding. Inert unless the checkout exists. |
| `BRAVE_API_KEY` | — | Optional. Enables the Brave-backed web-search extension; absent, web search throws. |

## Product Shape

Brunch Alpha is one local host with several presentation surfaces:

- The TUI is the default writer/driver. It embeds the Pi coding-agent runtime, Brunch prompt policy, structured exchange tools, graph tools, workspace/session selection, and TUI chrome.
- The browser sidecar is served by the TUI process. It is a Brunch React app over Brunch JSON-RPC, currently oriented around read-only graph/session projections.
- The JSON-RPC surface exposes Brunch product methods for probes, integrations, and automation. Clients speak Brunch method names rather than raw Pi commands.
- The print surface is a headless one-shot path for scripting and inspecting workspace state.

The durable product model is graph-native: the intent graph is canonical specification meaning, with oracle, design, and plan graph planes as accountable downstream work. Mutations go through Brunch-owned command/session seams; the browser and probes read named projections instead of reading SQLite, JSONL, or Pi internals directly.

## Developer Setup

Clone the repository, install dependencies, and run the source CLI:

```bash
npm install
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

## Run Against Seeded Workbenches

`npm run dev` runs the CLI from TS source against whatever cwd you point it at; it **never seeds by implication**. For realistic local development you seed a named workbench under `.fixtures/workbenches/<name>/` with explicit graph fixtures, then launch Brunch against that cwd. The workbench's `.brunch/` state (`data.db`, sessions) scaffolds inside that directory and is gitignored, so seeded state never mixes with the repo root.

Seed a chosen graph into a workbench, then launch from the repo root:

```bash
# Seed one tracked fixture into a named workbench (--reset wipes prior runtime state first)
npm run seed -- --workspace .fixtures/workbenches/live-graph-observer --seed workspace-spread/alpha-grounding --reset

# Interactive TUI writer + read-only web sidecar against that workbench
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer

# Open the sidecar in a browser as well
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer --open-web
```

Seed selection is `<set>/<slug>` from `.fixtures/seeds/` (see [`.fixtures/seeds/README.md`](./.fixtures/seeds/README.md) for the disposition catalog). Use `--all-seeds` instead of `--seed` only when you deliberately want every tracked fixture loaded as its own spec; a bare `npm run seed` fails with usage rather than seeding the shell cwd.

For agent-addressable inspection or curation over JSON-RPC, use the seeded-RPC walkthrough in [`docs/testing/seeded-dev-rpc.md`](./docs/testing/seeded-dev-rpc.md). Keep one writer per workspace: do not run concurrent dev RPC writes and a TUI/agent session against the same cwd unless you are deliberately testing concurrency.

Live provider runs require `PI_OFFLINE=0` plus configured Pi auth; otherwise the default offline launch exercises the workspace, graph, and UI paths without reaching a provider.

## Source Overview

The `src/` topology follows the current architecture decision in [`memory/SPEC.md`](./memory/SPEC.md). Directory-level `README.md` files under `src/**/` are canonical for the boundaries they describe.

```text
src/
├── .pi/          # sealed Pi runtime surface: components, extensions, settings
│   ├── components/  # reusable Pi TUI/message components
│   ├── extensions/  # Brunch Pi registrars: tools, hooks, commands, UI affordances
│   └── settings.json # dev-only ambient Pi settings when launching from src/
├── agents/      # agent prompts, prompt-resource skills, runtime policy, model-facing context
├── app/         # CLI mode dispatch, product host wiring, and print-mode text
├── db/          # Drizzle schema, migrations, and SQLite connection lifecycle
├── dev/         # dev-only harnesses and proof tests
├── graph/       # graph domain, schema, readers, policy, and CommandExecutor
├── probes/      # product/proof drivers and reportable oracle runs
├── projections/ # structured DTOs derived from domain/session/tool facts
├── rpc/         # Brunch JSON-RPC protocol, handlers, registry, and web host
├── session/     # Pi JSONL transcript projection, exchanges, runtime state, transcript text
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
- `projections/` preserves reusable structure; `agents/contexts/` owns model-facing text; human/product text lives beside its app/session owner.

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
