# Contributing to Brunch

The root [`README.md`](./README.md) is for people running Brunch. This file is for people changing this repository.

## Current sources of truth

Start with these, in this order:

- [`memory/SPEC.md`](./memory/SPEC.md) — product contract, architecture decisions, invariants, vocabulary, verification stance.
- [`memory/PLAN.md`](./memory/PLAN.md) — live frontier work and current sequencing.
- `src/**/README.md` — canonical topology notes for the code they sit beside.
- [`AGENTS.md`](./AGENTS.md) — agent workflow, planning, branch, and verification rules.

Useful supporting docs:

- [`docs/architecture/prd.md`](./docs/architecture/prd.md)
- [`docs/architecture/pi-seam-extensions.md`](./docs/architecture/pi-seam-extensions.md) — historical/mixed-status seam rationale; current runtime truth lives in `memory/SPEC.md` and `src/**/TOPOLOGY.md`
- [`docs/architecture/probes-and-transcripts.md`](./docs/architecture/probes-and-transcripts.md)
- [`.fixtures/README.md`](./.fixtures/README.md)

Older `docs/design/*` files are design references unless `SPEC.md`, `PLAN.md`, or a nearby `src/**/README.md` names them as current authority.

## Local setup

Use a Node version compatible with [`package.json`](./package.json), then:

```bash
npm install

# real-provider runs need an Anthropic key
printf 'ANTHROPIC_API_KEY=sk-ant-...\n' > .env

# launch Brunch from this repo as the target workspace
npm run dev
```

`npm run dev` launches the Brunch CLI in TUI mode. The TUI is the writer/driver; the browser UI is currently a sidecar served by that TUI process, not a standalone `--mode web` product mode.

Useful launch variants:

```bash
# launch against another workspace directory
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer

# suppress automatic browser opening while keeping the sidecar host running
npm run dev -- --no-webui

# run the JSON-RPC line server
npm run dev -- --mode rpc

# render current workspace state and exit
npm run dev -- --mode print
```

Brunch stores local runtime state under the target workspace's `.brunch/` directory.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Brunch CLI from source. Defaults to `--mode tui`. |
| `npm run test` | Run Vitest once. |
| `npm run fix` | Apply lint fixes, then format. |
| `npm run check` | Read-only lint + format check. |
| `npm run verify` | Full local gate: fix → test → build. |
| `npm run build` | Build TypeScript, packaged Pi assets, and the web bundle. |
| `npm run seed -- --workspace <dir> --seed <set>/<slug>` | Seed a workspace from `.fixtures/seeds`. |
| `npm run db:generate` | Generate Drizzle migrations. |
| `npm run db:studio` | Open Drizzle Studio. |
| `npm run release -- --dry-run patch` | Preview release packaging/publish flow. |

`package.json` is the complete script list.

## Architecture snapshot

Current source topology follows `SPEC.md` decision D52-L:

```text
src/
├── app/          # CLI entrypoints and product host wiring
├── workspace/    # cwd identity and .brunch/workspace.json helpers
├── scripts/      # local executable utilities
├── .pi/          # sealed Pi profile, agents, skills, components, extensions
├── db/           # Drizzle schema, migrations, SQLite connection lifecycle
├── graph/        # graph domain, CommandExecutor, graph readers/policy/schema
├── session/      # Pi JSONL transcript projection, exchanges, runtime state, coordination
├── projections/  # information-preserving DTOs reused across boundaries
├── renderers/    # lossy text/markdown rendering
├── rpc/          # Brunch JSON-RPC handlers, protocol, web host
├── web/          # React sidecar client over Brunch RPC
├── probes/       # product/proof drivers and reportable oracles
└── dev/          # dev-only harnesses; excluded from packaged product behavior
```

High-level flow:

1. `src/app/brunch.ts` dispatches TUI, RPC, or print mode.
2. `WorkspaceSessionCoordinator` selects/creates a workspace spec and a Pi JSONL-backed Brunch session.
3. The TUI/Pi runtime drives the elicitor agent, structured exchanges, runtime posture, and graph tools.
4. All durable graph/spec mutations go through `graph/CommandExecutor` and SQLite-backed graph tables.
5. `rpc/` exposes named Brunch JSON-RPC methods over stdio/WebSocket/in-process handlers.
6. `web/` is a read-only sidecar client over the Brunch RPC surface; it must not read SQLite, JSONL, Pi RPC, or `.brunch/workspace.json` directly.

Important boundaries:

- `graph/` is the only application layer that imports `db/` directly.
- Mutations go through owning seams (`CommandExecutor`, session transcript helpers, or workspace coordinator), not raw tables.
- `projections/` preserves structure; `renderers/` may lose structure for human-readable output.
- `rpc/` is named product methods, not a generic records/REST API.
- `web/` consumes RPC projections only.

## Fixtures, probes, and local state

Fixture conventions live in [`.fixtures/README.md`](./.fixtures/README.md). Short version:

- `.fixtures/seeds/` — tracked reusable seed inputs.
- `.fixtures/workbenches/` — launchable local workspaces; their `.brunch/` state is local runtime state.
- `.fixtures/runs/` — curated probe evidence with reports/transcripts.
- `.fixtures/scratch/` — ignored dev-loop output.

Seed explicitly; `npm run dev` never seeds for you:

```bash
npm run seed -- --workspace .fixtures/workbenches/live-graph-observer --seed workspace-spread/alpha-grounding
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer
```

Add `--reset` to the seed command when you want to wipe that workbench's Brunch runtime state before loading the seed.

## Working posture

Brunch is pre-release. Prefer direct, scoped repairs over compatibility scaffolding unless `SPEC.md`, `PLAN.md`, or the user explicitly requires data/API preservation. Keep the lexicon tight: retire stale concepts and update tests/docs with the code slice that makes them obsolete.

For agent-assisted work, follow [`AGENTS.md`](./AGENTS.md): frontier items map to Linear/Graphite workflow, topology READMEs are canonical, and the standard verification gate is `npm run verify` before committing.

## Releasing

Preview without mutating git/npm:

```bash
npm run release -- --dry-run patch
npm run release -- --dry-run --ci patch
```

Release from a clean checkout when ready:

```bash
npm run release -- patch
```

The release flow rebuilds the packaged CLI/runtime artifact and runs `npm pack --dry-run --json` before publishing. Local releases require npm authentication; trusted-publishing CI is not configured here yet.
