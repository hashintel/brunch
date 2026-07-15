# Brunch dev loops

`src/dev/` owns Brunch-only development loops and curation seams. The workbench launcher entry point is:

```sh
npm run dev-cli
```

That command runs `scripts/dev.ts`, which calls `runDevCli()` in `src/dev/dev-cli.ts`. `npm run dev` directly runs the product CLI from TypeScript source and accepts its ordinary flags.

## What lives here

- `dev-cli.ts` — launcher, scripted RPC helper, graph curation command, and seed export command.
- `graph-curation.ts` — fixture-shaping mutations routed through `CommandExecutor`.
- `faux-harness.ts` / `tier-2-harness.ts` — exact-payload and real-boot test/probe loops.
- `introspection-launcher.ts` — paired subjective/mechanical prompt-inspection artifacts under `.fixtures/scratch/introspection/`.
- `generate-fan-out-witness.ts` — real-model witness for proposal fan-out and no-write-before-pick behavior.
- `component-preview.ts` and `component-preview/` — local component preview support.

This directory does not own product runtime behavior, public RPC contracts, graph truth, or the sealed Pi profile. It may exercise those seams; it should not silently widen them.

## Interactive TUI driving

The canonical priority order is:

1. On an overlay-capable host, follow the exact isolated candidate launch and cleanup protocol in [`../../docs/praxis/manual-testing.md`](../../docs/praxis/manual-testing.md). It supplies auth without copying credentials, disables discovery and project trust, and loads only the temporary `pi-interactive-shell` candidate. Use hands-free sessions so the agent can query bounded output and send text/named keys while a human watches, types to take over, and presses `Ctrl+G` to return control. Health-check import/spawn, resize, status, kill, and empty cleanup after any Pi/package/Node/OS/architecture change.
2. In a sandbox or headless environment where socket-backed execution fails, use the project-owned `npm run tui-driver` Expect/headless-xterm workflow in that same protocol. Always `stop`, `rm`, then confirm `list` is empty.

The external extension is temporary test tooling, not a Brunch dependency or sealed-profile extension. The witnessed candidate was `pi-interactive-shell` 0.13.0 on Pi 0.80.x/macOS arm64, resolving its declared `zigpty ^0.1.6` to 0.1.6 despite upstream's 0.2.1 release line. Do not add direct `zigpty` integration. The fallback lacks overlay takeover, runtime resize, and multiline/bracketed paste; its strengths are constrained-sandbox viability, VT reconstruction, waits, bounded viewports/log tails, named-key input, and deterministic teardown.

## Dev launcher quick reference

```sh
# Interactive launcher; choose a temporary, new, existing, or seed-derived instance.
npm run dev-cli

# Launch a bare auto-named instance under the system temp directory.
npm run dev-cli -- --temp

# Create or open a named workbench without seeding.
npm run dev-cli -- --workbench my-workbench

# Reset a workbench from one tracked seed and launch TUI; the web observer opens by default.
npm run dev-cli -- --seed workspace-alpha-grounding/base --reset

# Same, without automatically opening the web observer in a browser.
npm run dev-cli -- --seed workspace-alpha-grounding/base --reset --no-webui

# Re-open an existing arbitrary workspace path without reseeding.
npm run dev-cli -- --workspace .fixtures/workbenches/workspace-alpha-grounding

# Read public product RPC projections.
npm run dev-cli -- rpc workspace.state --workspace .fixtures/workbenches/workspace-alpha-grounding
npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/workspace-alpha-grounding

# Shape graph fixture state through the product command layer.
npm run dev-cli -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding --params-file /tmp/mutate.json

# Export a workbench spec as a seed candidate.
npm run dev-cli -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1 --out .fixtures/seeds/custom/example.json
```

Rules:

- Seeding is explicit. Launch-time seeding requires both `--seed <name>/<variant>` and `--reset`.
- With `--seed` and no `--workspace`, the launcher derives `.fixtures/workbenches/<name>/`.
- Use `npm run dev -- ...` when workbench selection or fixture operations are unnecessary.

## Debug mirrors

Source/dev TUI launches mirror observability artifacts into the active workspace by default:

```text
<workspace>/.brunch/debug/
├── entry-contents.md    # Brunch custom entries/custom messages appended at source seams
├── origination.md       # assistant-kick decision/outcome records
├── system-prompt.md     # latest final provider system prompt after provider request
├── tool-contents.md     # selected Brunch-owned text tool results
└── transcript.md        # harness-generated transcript rendering, not ordinary TUI default
```

Important trigger details:

- `entry-contents.md` and `origination.md` do not require `--dev-tools`; they come from the passive debug mirror in source/dev TUI runs.
- `system-prompt.md` requires an actual provider request. Its absence before the first turn is not by itself a failure.
- `tool-contents.md` requires a mirrored tool result from the allowlist in `src/.pi/extensions/dev-mode/introspection/debug-cache.ts`.
- `transcript.md` is produced by faux/tier-2 harness loops; do not expect it from every manual TUI launch.

The debug mirror is observability only. Product code must never read it back as state.

## What `--dev-tools` changes

`--dev-tools` enables prompt-affecting developer query tools. It is not required for passive `.brunch/debug/*` mirrors, and it is not required for product subagents.

Enabled only with `--dev-tools`:

- `brunch_session_query` — read-only query over the current session branch. Candidate for retirement if the ordinary debug mirrors prove sufficient.
- `brunch_introspect_query` — read-only query over captured provider payload/base prompt inputs. Candidate for retirement if the ordinary debug mirrors prove sufficient.

Available in normal source/dev TUI runs without `--dev-tools`:

- product `subagent` tool in Specify mode, when a delegatable set is registered
- passive debug cache mirroring
- `/introspect` command when the introspection extension is present through the debug mirror
- default web sidecar browser launch (`--no-webui` suppresses automatic browser opening)
- ordinary Brunch product tools selected by operational mode

## Audit checklist for recent model changes

Use [`../../TESTING_PLAN.md`](../../TESTING_PLAN.md) for the full demo/audit plan. Short version:

1. Start with a reset seed workbench:
   ```sh
   npm run dev-cli -- --seed workspace-alpha-grounding/base --reset --dev-tools
   ```
2. Confirm `.brunch/debug/entry-contents.md` and `.brunch/debug/origination.md` appear after activation/origination.
3. Trigger one provider turn and confirm `.brunch/debug/system-prompt.md` includes the live Brunch skills manifest.
4. Check that each manifest `<location>` is an absolute path ending in `agents/skills/<id>/SKILL.md`.
5. Inspect context seed output for graph facts and scratchpad, not readiness scores or persisted gap rows.
6. Use RPC reads to compare transcript-visible behavior with graph projections:
   ```sh
   npm run dev-cli -- rpc session.runtimeState --workspace <workspace>
   npm run dev-cli -- rpc session.exchanges --workspace <workspace>
   npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace <workspace>
   ```
7. For settlement behavior, verify graph reads/writes surface `settlement` and respect advisory → settled monotonic promotion.
