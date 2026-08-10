# Brunch dev loops

`src/dev/` owns Brunch-only development loops and curation seams. The workbench launcher entry point is:

```sh
npm run dev-cli
```

That command runs `scripts/dev.ts`, which calls `runDevCli()` in `src/dev/dev-cli.ts`. `npm run dev` directly runs the product CLI from TypeScript source and accepts its ordinary flags. See [`../../docs/praxis/comparison-runs.md`](../../docs/praxis/comparison-runs.md) for the PM seed walkthrough, deterministic-read cheatsheet, agent evidence recipe, and the distinct cross-product comparison approach.

## What lives here

- `dev-cli.ts` — launcher, scripted RPC helper, graph curation command, and seed export command.
- `graph-curation.ts` — fixture-shaping mutations routed through `CommandExecutor`.
- `faux-harness.ts` / `tier-2-harness.ts` — exact-payload and real-boot test/probe loops.
- `introspection-launcher.ts` — paired subjective/mechanical prompt-inspection artifacts under `.fixtures/scratch/introspection/`.
- `generate-fan-out-witness.ts` — real-model witness for proposal fan-out and no-write-before-pick behavior.
- `component-preview.ts` and `component-preview/` — local component preview support.

This directory does not own product runtime behavior, public RPC contracts, graph truth, or the sealed Pi profile. It may exercise those seams; it should not silently widen them.

## Control-surface selection

Use the least indirect surface that proves the claim; see [`../../docs/praxis/manual-testing.md`](../../docs/praxis/manual-testing.md).

1. For machine-facing conduct, use the supported structured interface: public Brunch RPC where the operation exists, Pi RPC, or Claude stream-JSON/Agent SDK. A PTY is not the default text transport.
2. For browser behavior, use the standalone Brunch web host plus browser automation.
3. For terminal rendering, key/focus/lifecycle behavior, or deliberate human observation, use a real Herdr pane when available.
4. Without Herdr, use the permanent project-local `pi-interactive-shell` package for a supervised overlay, or the project-owned `npm run tui-driver` Expect/headless-xterm path when a headless PTY is required. Always prove final status and empty cleanup; `tui-driver` requires `stop`, `rm`, then an empty `list`.

Brunch Execute comparison remains terminal-driven for now: stdio RPC has no live session driver and hosted web RPC has no process-move operation. PLAN `cli-mode-entry` and `comparison-machine-interface-cutover` own that gap. Do not bypass it through JSONL or private-state mutation.

The external extension is permanent project development tooling, not a Brunch dependency or sealed-profile extension: it stays outside the shipped package manifest, `src/.pi`, and runtime dependency graph. Version 0.13.0 was witnessed on Pi 0.80.x/macOS arm64, resolving its declared `zigpty ^0.1.6` to 0.1.6 despite upstream's 0.2.1 release line. Do not add direct `zigpty` integration. The headless fallback lacks overlay takeover, runtime resize, and multiline/bracketed paste; its strengths are constrained-sandbox viability, VT reconstruction, waits, bounded viewports/log tails, named-key input, and deterministic teardown.

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

The consequential-fact evaluator, report, runner, and directive-ablation seam remain functional dev/eval primitives, but the earlier consequential-fact / `warrant-ablation-campaign` line is retired rather than parked; see the FE-1208 reshape and closeout entries in [`docs/archive/PLAN_HISTORY.md`](../../docs/archive/PLAN_HISTORY.md#2026-07-16-fe-1208-reshape-ln-plan-consequential-fact-discovery-tracer--automation-observability-dx). `capture-ledger-tracer` is the live successor for rich mixed-source matched comparison.

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
├── system-prompt.md       # latest final provider system prompt after provider request
├── tool-contents.md       # selected Brunch-owned text tool results
├── trajectory.ndjson      # bounded normalized events used by the joiner
├── trajectory.json        # latest joined trajectory report data
├── trajectory-report.md   # latest joined trajectory report for reading
└── transcript.md          # harness-generated transcript rendering, not ordinary TUI default
```

Important trigger details:

- `entry-contents.md` and `origination.md` come from the passive debug mirror in source/dev TUI runs.
- `system-prompt.md` requires an actual provider request. Its absence before the first turn is not by itself a failure.
- `tool-contents.md` requires a mirrored tool result from the allowlist in `src/.pi/extensions/dev-mode/introspection/debug-cache.ts`.
- `transcript.md` is produced by faux/tier-2 harness loops; do not expect it from every manual TUI launch.

The debug mirror is observability only. Product code must never read it back as state.

Normal source/dev TUI runs include product subagents when a delegatable set is registered, passive debug mirroring, the `/introspect` command, the default web sidecar browser launch (`--no-webui` suppresses it), and ordinary product tools selected by operational mode. No prompt-affecting developer tool channel exists.

## Audit checklist for recent model changes

Use [`../../TESTING_PLAN.md`](../../TESTING_PLAN.md) for the full demo/audit plan. Short version:

1. Start with a reset seed workbench:
   ```sh
   npm run dev-cli -- --seed workspace-alpha-grounding/base --reset
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
