# Brunch dev loops

`src/dev/` owns Brunch-only development loops and curation seams. The public entry point is the repository script:

```sh
npm run dev
```

That command runs `scripts/dev.ts`, which calls `runDevCli()` in `src/dev/dev-cli.ts`. Use this launcher for local workbenches instead of invoking product internals directly.

## What lives here

- `dev-cli.ts` — launcher, scripted RPC helper, graph curation command, and seed export command.
- `graph-curation.ts` — fixture-shaping mutations routed through `CommandExecutor`.
- `faux-harness.ts` / `tier-2-harness.ts` — exact-payload and real-boot test/probe loops.
- `introspection-launcher.ts` — paired subjective/mechanical prompt-inspection artifacts under `.fixtures/scratch/introspection/`.
- `generate-fan-out-witness.ts` — real-model witness for proposal fan-out and no-write-before-pick behavior.
- `component-preview.ts` and `component-preview/` — local component preview support.

This directory does not own product runtime behavior, public RPC contracts, graph truth, or the sealed Pi profile. It may exercise those seams; it should not silently widen them.

## Dev launcher quick reference

```sh
# Interactive launcher; prompts for a tracked seed-derived workbench.
npm run dev

# Reset a workbench from one tracked seed and launch TUI.
npm run dev -- --seed workspace-alpha-grounding/base --reset

# Reset, launch TUI, and open the web observer sidecar.
npm run dev -- --seed workspace-alpha-grounding/base --reset --open-web

# Same, with prompt-affecting developer query tools enabled.
npm run dev -- --seed workspace-alpha-grounding/base --reset --open-web --dev-tools

# Re-open an existing workbench without reseeding.
npm run dev -- --workspace .fixtures/workbenches/workspace-alpha-grounding

# Read public product RPC projections.
npm run dev -- rpc workspace.state --workspace .fixtures/workbenches/workspace-alpha-grounding
npm run dev -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/workspace-alpha-grounding

# Shape graph fixture state through the product command layer.
npm run dev -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding --params-file /tmp/mutate.json

# Export a workbench spec as a seed candidate.
npm run dev -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1 --out .fixtures/seeds/custom/example.json
```

Rules:

- Seeding is explicit. Launch-time seeding requires both `--seed <name>/<variant>` and `--reset`.
- With `--seed` and no `--workspace`, the launcher derives `.fixtures/workbenches/<name>/`.
- Use `npm run dev:raw -- ...` only when you need direct raw app access.

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
- web sidecar launch via `--open-web`
- ordinary Brunch product tools selected by operational mode

## Audit checklist for recent model changes

Use [`../../TESTING_PLAN.md`](../../TESTING_PLAN.md) for the full demo/audit plan. Short version:

1. Start with a reset seed workbench:
   ```sh
   npm run dev -- --seed workspace-alpha-grounding/base --reset --open-web --dev-tools
   ```
2. Confirm `.brunch/debug/entry-contents.md` and `.brunch/debug/origination.md` appear after activation/origination.
3. Trigger one provider turn and confirm `.brunch/debug/system-prompt.md` includes the live Brunch skills manifest.
4. Check that each manifest `<location>` is an absolute path ending in `agents/skills/<id>/SKILL.md`.
5. Inspect context seed output for graph facts and scratchpad, not readiness scores or persisted gap rows.
6. Use RPC reads to compare transcript-visible behavior with graph projections:
   ```sh
   npm run dev -- rpc session.runtimeState --workspace <workspace>
   npm run dev -- rpc session.exchanges --workspace <workspace>
   npm run dev -- rpc graph.overview '{"specId":1}' --workspace <workspace>
   ```
7. For settlement behavior, verify graph reads/writes surface `settlement` and respect advisory → settled monotonic promotion.
