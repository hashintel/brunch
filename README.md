![Status: alpha](https://img.shields.io/badge/status-alpha-orange)

# Brunch Alpha

> Brunch Alpha is pre-release software. Data models, local workspace files, CLI behavior, and developer-facing APIs may change without migration support while the alpha line is still proving the product foundation.

Brunch Alpha is a re-foundation of `brunch` on top of the Pi coding-agent harness. It is an opinionated local product for co-authoring a specification with an agent: Brunch owns the spec workspace, graph model, structured exchanges, and public RPC surface while using Pi for the agent loop, transcript substrate, TUI shell, and extension seams.

The current alpha has two interactive entry paths. Running `brunch` opens the Pi-backed TUI and also serves its transitional browser sidecar. Running `brunch --mode web` starts the shipped standalone React host, which can open and drive explicitly targeted Brunch sessions without constructing the TUI. FE-1200 proved the standalone target-addressed session host, concurrent session isolation, JSONL hydration/live convergence, and the required structured-exchange presentation family.

The architecture is still mid-transition: TUI mode currently owns a separate Pi runtime and raw sidecar relay, while standalone web owns the newer `LiveSessionHost` and semantic event contract. The planned [`shared-session-host-convergence`](./memory/PLAN.md#shared-session-host-convergence--planned) work will preserve both useful presentations while moving them onto one independent cwd-scoped host, then delete the old relay and `/rpc/driver`. Contributors working in this area should start with [`docs/design/WEB_UI_ARCHITECTURE.md`](./docs/design/WEB_UI_ARCHITECTURE.md).

## Run Brunch

Brunch requires Node 24. Launch the alpha from the project directory you want Brunch to use:

```bash
npx @hashintel/brunch@alpha
```

Brunch creates or reuses a local `.brunch/` workspace under the current directory. That workspace holds project-scoped Brunch state, including the selected spec/session, graph persistence, and Pi JSONL-backed transcript data. No `.env` file is required. Live agent turns require provider auth in Pi's native auth store; configure it through `/login` in the TUI (or Pi itself). There is no standalone `brunch login` command.

Useful launch variants:

```bash
# interactive TUI + browser sidecar (default)
npx @hashintel/brunch@alpha

# suppress automatic browser opening while keeping the transitional TUI sidecar available
npx @hashintel/brunch@alpha --no-webui

# standalone React host with target-addressed session driving (no TUI process)
npx @hashintel/brunch@alpha --mode web
```

Prefer `npx` during the alpha line. Global installs are easy to leave stale while the CLI, local workspace shape, and Pi integration are still moving.

## Environment Variables

Brunch does not own a provider/model/port configuration surface. Provider auth and model selection belong to the embedded Pi runtime, and live model calls use whatever Pi auth the user configured through Pi's native `/login`. The model selection forwarded by Brunch agents is `default` ("inherit the parent's current model"), so there is no `ANTHROPIC_MODEL`/`OBSERVER_MODEL` override path. Both current web hosts bind an ephemeral loopback port and print their URL; there is no `BRUNCH_PORT`.

Brunch's own environment surface is operational (offline/dev/source flags), not product config:

| Variable                       | Default             | Description                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PI_OFFLINE`                   | `1`                 | Brunch scopes Pi's offline startup mode around the interactive run to suppress update activity. This does not disable authenticated provider inference.                                                                                      |
| `PI_SKIP_VERSION_CHECK`        | `1`                 | Defaulted to `1` by Brunch to skip Pi's runtime version check.                                                                                                                                                                                 |
| `BRUNCH_DEV`                   | —                   | Set `1` to expose the dev-only `dev.graph.mutateGraph` method in the JSON-RPC dev surface. Absent from discovery otherwise.                                                                                                                    |
| `BRUNCH_DB`                    | `./.brunch/data.db` | SQLite path used by `drizzle-kit` tooling only (`db:generate`, `db:studio`). Does not affect the runtime workspace DB, which is resolved per-cwd.                                                                                              |
| `PI_SOURCE` / `PI_SOURCE_ROOT` | —                   | Dev-only: set `PI_SOURCE=1` to alias the `@earendil-works/pi-*` packages to a local `pi-mono` checkout (default `~/.pi/pi-mono`, overridable via `PI_SOURCE_ROOT`) so source edits apply without rebuilding. Inert unless the checkout exists. |
| `BRAVE_API_KEY`                | —                   | Optional. Enables the Brave-backed web-search extension; absent, web search throws.                                                                                                                                                            |

## Product Shape

Brunch Alpha is one local product with several presentation surfaces:

- The TUI is the default interactive presentation. It currently embeds the Pi coding-agent runtime, Brunch prompt policy, structured exchange tools, graph tools, workspace/session selection, and TUI chrome.
- Standalone web (`--mode web`) is a first-class interactive presentation. Its cwd-scoped combined host owns target-addressed sealed Pi sessions and serves the React app over Brunch JSON-RPC plus semantic live-session events.
- The TUI-started browser sidecar remains current alpha behavior for graph/run observation, but its singleton raw relay and `/rpc/driver` host shape are transitional and must not be extended as a second architecture.
- The JSON-RPC surface exposes Brunch product methods for probes, integrations, and automation. Clients speak Brunch method names rather than raw Pi commands.
- The print surface is a headless one-shot path for scripting and inspecting workspace state.

Current and target host diagrams, launch instructions, code paths, and cutover ownership live in [`docs/design/WEB_UI_ARCHITECTURE.md`](./docs/design/WEB_UI_ARCHITECTURE.md).

The durable product model is graph-native: the intent graph is canonical specification meaning, with oracle, design, and plan graph planes as accountable downstream work. Mutations go through Brunch-owned command/session seams; the browser and probes read named projections instead of reading SQLite, JSONL, or Pi internals directly.

## Developer Setup

Clone the repository, install dependencies, and run the source CLI:

```bash
npm install
npm run dev
```

Build the React bundle once before running standalone web from source:

```bash
npm run build:web
npm run dev -- --cwd <workspace> --mode web
```

The standalone root route lists specs and runs. Until session-inventory UI lands, open a session directly at `/session/<specId>/<sessionId>`; the selected ids are in `<workspace>/.brunch/workspace.json` under `defaults`. Do not run TUI and standalone web as independent writers over the same session while the shared-host transition remains open.

Common development commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Brunch CLI directly from source. Defaults to TUI + transitional sidecar. |
| `npm run dev -- --mode web` | Run the standalone target-addressed web host (requires a built web bundle). |
| `npm run dev-cli` | Select/create temporary, named, or seeded dev instances. |
| `npm run test`   | Run Vitest once.                                          |
| `npm run fix`    | Apply lint fixes, then format.                            |
| `npm run check`  | Read-only lint, format, and skill consistency checks.     |
| `npm run verify` | Full local gate: fix, test, and build.                    |
| `npm run build`  | Build TypeScript, packaged Pi assets, and the web bundle. |

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for release flow, fixture workflow, and the current internal source-of-truth documents.

## Run Against Seeded Workbenches

`npm run dev` runs the CLI from TS source against whatever cwd you point it at; it **never seeds by implication**. For realistic local development you seed a named workbench under `.fixtures/workbenches/<name>/` with explicit graph fixtures, then launch Brunch against that cwd. The workbench's `.brunch/` state (`data.db`, sessions) scaffolds inside that directory and is gitignored, so seeded state never mixes with the repo root.

Seed a chosen graph into a workbench, then launch from the repo root:

```bash
# Seed one tracked fixture into a named workbench (--reset wipes prior runtime state first)
npm run seed -- --workspace .fixtures/workbenches/live-graph-observer --seed workspace-spread/alpha-grounding --reset

# Interactive TUI + transitional browser sidecar against that workbench
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer

# Keep the transitional sidecar running without automatically opening a browser
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer --no-webui

# Or run the standalone target-addressed React host
npm run build:web
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer --mode web
```

Seed selection is `<set>/<slug>` from `.fixtures/seeds/` (see [`.fixtures/seeds/README.md`](./.fixtures/seeds/README.md) for the disposition catalog). Use `--all-seeds` instead of `--seed` only when you deliberately want every tracked fixture loaded as its own spec; a bare `npm run seed` fails with usage rather than seeding the shell cwd.

For interactive workbench selection (`--temp`, `--workbench <name>`, existing workspaces, or seed/reset), run `npm run dev-cli`. For agent-addressable inspection or curation over JSON-RPC, use the seeded-RPC walkthrough in [`docs/praxis/seeded-dev-rpc.md`](./docs/praxis/seeded-dev-rpc.md). Keep one writer per workspace: do not run concurrent dev RPC writes and a TUI/agent session against the same cwd unless you are deliberately testing concurrency.

Live provider runs require `PI_OFFLINE=0` plus configured Pi auth; otherwise the default offline launch exercises the workspace, graph, and UI paths without reaching a provider.

## Source Overview

The `src/` topology follows the current architecture decision in [`memory/SPEC.md`](./memory/SPEC.md). Directory-level `TOPOLOGY.md` files under `src/**/` are canonical for the boundaries they describe.

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
├── web/         # React client for standalone web and the transitional TUI sidecar
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
- [`docs/architecture/pi-seam-extensions.md`](./docs/architecture/pi-seam-extensions.md) — mixed-status Pi-seam rationale; use it for background on structured exchanges, side tasks, and staleness, but defer to `memory/SPEC.md` and `src/**/TOPOLOGY.md` for current runtime truth.
- [`docs/architecture/probes-and-transcripts.md`](./docs/architecture/probes-and-transcripts.md) — probe artifacts, transcript evidence, and report shape.
- [`src/README.md`](./src/README.md) — current source topology and dependency direction.
- [`docs/design/WEB_UI_ARCHITECTURE.md`](./docs/design/WEB_UI_ARCHITECTURE.md) — current standalone host, colleague code journey, pi-web-derived shared-host target, and sidecar-retirement plan.

## Help

```bash
npx @hashintel/brunch@alpha --help
```
