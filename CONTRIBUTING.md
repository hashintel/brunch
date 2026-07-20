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

# launch Brunch from this repo as the target workspace
npm run dev
```

`npm run dev` launches the Brunch CLI in TUI mode. The TUI is currently the writer/driver, and the browser UI is served through its transitional process-local sidecar. The FE-1200 standalone `brunch --mode web` host serves and drives target-addressed React sessions directly without a TUI process.

These are current parallel host shapes, not the intended steady state. The [`shared-session-host-convergence`](./memory/PLAN.md#shared-session-host-convergence--planned) arc will prove how Pi's `InteractiveMode` attaches to one independent cwd-scoped host, then retire the raw TUI relay and `/rpc/driver` while preserving both useful presentations. Read [`docs/design/WEB_UI_ARCHITECTURE.md`](./docs/design/WEB_UI_ARCHITECTURE.md) before changing `brunch-tui.ts`, `brunch-web.ts`, `live-session-host.ts`, or the web transport.

Real-provider runs use Pi's native auth store. Configure auth through `/login` in the TUI (or Pi itself); do not add project `.env` keys or revive the retired `brunch login` command.

Useful launch variants:

```bash
# launch against another workspace directory
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer

# suppress automatic browser opening while keeping the transitional sidecar host running
npm run dev -- --no-webui

# build and run the standalone target-addressed web host
npm run build:web
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer --mode web

# run the JSON-RPC line server
npm run dev -- --mode rpc

# render current workspace state and exit
npm run dev -- --mode print
```

Brunch stores local runtime state under the target workspace's `.brunch/` directory.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Brunch CLI directly from source. Defaults to `--mode tui`. |
| `npm run dev-cli` | Select/create a temporary, named, existing, or seed-derived dev instance. |
| `npm run test` | Run Vitest once (fast default; excludes `*.slow.test.ts`). |
| `npm run test:slow` | Run only `*.slow.test.ts`. |
| `npm run test:full` | Run every Vitest test, including slow tests. |
| `npm run fix` | Apply lint fixes, then format. |
| `npm run check` | Read-only lint + format check. |
| `npm run verify` | Fast local checkpoint: fix → test → build. Routine pre-commit run. |
| `npm run verify:full` | Full gate: fix → test:full → build. CI runs this on every PR; run it locally only when you touch host landing, slice integration, run promotion, or worktree behavior. |
| `npm run build` | Build TypeScript, packaged Pi assets, and the web bundle. |
| `npm run seed -- --workspace <dir> --seed <set>/<slug>` | Seed a workspace from `.fixtures/seeds`. |
| `npm run db:generate` | Generate Drizzle migrations. |
| `npm run db:studio` | Open Drizzle Studio. |
| `npm run changeset` | Record release intent and user-facing release notes for a pull request. |
| `npm run check:release-pack` | Pack, install, and smoke-test the publishable artifact without publishing it. |

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

1. `src/app/brunch.ts` dispatches TUI, standalone web, RPC, or print mode.
2. `WorkspaceSessionCoordinator` selects/creates a workspace spec and a Pi JSONL-backed Brunch session.
3. The TUI/Pi runtime drives the elicitor agent, structured exchanges, runtime posture, and graph tools.
4. All durable graph/spec mutations go through `graph/CommandExecutor` and SQLite-backed graph tables.
5. `rpc/` exposes named Brunch JSON-RPC methods over stdio/WebSocket/in-process handlers.
6. `web/` is a React client over the Brunch RPC surface, currently served by both the transitional TUI sidecar and standalone `--mode web` host; it must not read SQLite, JSONL, Pi RPC, or `.brunch/workspace.json` directly. New session-host work targets the standalone semantic contract and the planned shared host—not the raw sidecar relay.

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

Direct source launch never seeds for you:

```bash
npm run seed -- --workspace .fixtures/workbenches/live-graph-observer --seed workspace-spread/alpha-grounding
npm run dev -- --cwd .fixtures/workbenches/live-graph-observer
```

For an interactive temporary/named/existing/seeded instance flow, use `npm run dev-cli` instead.

Add `--reset` to the seed command when you want to wipe that workbench's Brunch runtime state before loading the seed.

## Working posture

Brunch is pre-release. Prefer direct, scoped repairs over compatibility scaffolding unless `SPEC.md`, `PLAN.md`, or the user explicitly requires data/API preservation. Keep the lexicon tight: retire stale concepts and update tests/docs with the code slice that makes them obsolete.

For agent-assisted work, follow [`AGENTS.md`](./AGENTS.md): frontier items map to Linear/Graphite workflow, topology READMEs are canonical, and the routine local checkpoint is `npm run verify` (fast) before committing. The authoritative full gate is the `Test` GitHub Actions workflow (`npm run test:full` + `check` + `build`) that runs on every PR; run `npm run verify:full` locally when your change touches a slow test or the production seam it witnesses (currently host landing, slice integration, run promotion, or worktree behavior).

## Releasing

Brunch alpha releases are published from `next` by
[the release workflow](./.github/workflows/release.yml). Contributors do not
edit the package version, create release tags, or publish from a local
checkout.

For a pull request that changes the published package, record the intended
SemVer bump and concise user-facing notes:

```bash
npm run changeset
```

Commit the generated Markdown file under `.changeset/` with the change. CI
requires every ordinary pull request into `next` to carry explicit release
intent. For a pull request that does not affect the published package, record
that decision with an empty changeset:

```bash
npm run changeset -- --empty
```

The generated Changesets version pull request is exempt because it consumes
the accumulated changesets instead of adding another one.

After changesets land on `next`, the workflow creates or updates one
**Version Packages** pull request. Merging that reviewed pull request is the
release approval: the next workflow run executes the release-pack smoke,
publishes `@hashintel/brunch` to the npm `alpha` dist-tag, pushes the native
single-package `v<version>` tag, and creates a GitHub Release from the generated
`CHANGELOG.md`. The npm `latest` tag remains on the stable line until a
separate `main` release process is enabled.

Publishing uses npm trusted publishing from `hashintel/brunch`'s
`release.yml`, not a repository `NPM_TOKEN`. Before the first automated
release, an npm owner must configure that trusted publisher with `npm publish`
permission. The workflow's HASH worker token creates CI-triggering release
pull requests and is the actor allowed to create protected release tags. The
package release script fails closed outside GitHub Actions, outside
`hashintel/brunch`'s `next` branch, or without the OIDC environment required
for trusted publishing. The worker token is repository-scoped to contents and
pull-request writes, and protected-tag pushes fail the release job instead of
letting GitHub synthesize a missing tag from the default branch.

If a run fails before npm accepts the version, fix the cause and rerun it. If
npm already contains the version, do not edit or reuse that immutable version;
inspect npm, the Git tag, and the GitHub Release before deciding which missing
artifact needs reconciliation.
