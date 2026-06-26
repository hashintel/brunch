# Dev Feedback Loops

This directory owns Brunch-only development loops and curation seams. Nothing here is product runtime configuration, and nothing here may silently widen the sealed Pi profile.

## Ownership

`src/dev/**` owns four things:

- the human-facing dev launcher (`scripts/dev.ts` → `src/dev/dev-cli.ts`)
- the explicit graph-curation seam for fixture shaping (`graph-curation.ts`)
- faux/introspection/tier-2 harnesses used by tests and probes
- dev-only witnesses such as `generate-fan-out-witness.ts`

It does not own published CLI behavior, public RPC contracts, or database imports from outside `graph/`.

## Launcher Surface

`npm run dev` is the front door for local workbenches.

- With no args, it prompts for a workbench, whether to start from current state or a reset seed, and whether to open the web sidecar.
- TUI is the default mode.
- Seeding is always explicit: the launcher only seeds when `--seed <name/variant> --reset` is present or chosen in the prompt flow.
- `rpc`, `mutate`, and `export` are explicit subcommands for scripted reads, graph curation, and fixture export.
- `npm run dev:raw -- ...` remains the escape hatch to the underlying app entrypoint.

Current subcommands:

```text
npm run dev
npm run dev -- --workspace .fixtures/workbenches/live-graph-observer --open-web
npm run dev -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/live-graph-observer
npm run dev -- mutate --workspace .fixtures/workbenches/live-graph-observer --params-file /tmp/mutate.json
npm run dev -- export --workspace .fixtures/workbenches/live-graph-observer --spec-id 1 --out .fixtures/seeds/custom/example.json
```

## Debug Mirrors And Dev Tools

Source runs and local dev builds automatically mirror debug artifacts into `<workspace>/.brunch/debug/`.

- This automatic mirror is for passive observability only: system prompt captures, Brunch-owned tool content, origination records, and debug transcript rendering.
- Prompt-affecting dev surfaces stay explicit. `--dev-tools` is the opt-in for query tools and subagent affordances.
- TUI boots therefore have three states: product-default, debug-mirror-only, and debug-mirror plus dev tools.

## Graph Curation

`graph-curation.ts` is the canonical local fixture-shaping seam.

- It accepts the former dev-mutate grammar: create/patch/delete node and edge ops, with projected node-code resolution scoped to one spec.
- It resolves those projected references before entering `CommandExecutor.mutateGraph`, so fixture shaping still uses the product-owned mutation boundary.
- It is intentionally in-process, not a hidden RPC host flag. External agents should call the explicit `npm run dev -- mutate ...` or `npm run dev -- rpc ...` commands instead of relying on a long-lived write-enabled sidecar.

## Faux And Tier-2 Loops

- `createBrunchFauxHarness()` and `runBrunchFauxTurn()` are Tier-1 exact-payload loops.
- `runBrunchIntrospectionTurn()` writes paired subjective/mechanical artifacts for prompt inspection.
- `runTier2RealBootFauxTurn()`, `bootTier2RuntimeThroughRunBrunchTui()`, and `bootTier2RuntimeFromFixture()` own real-boot proofs: session activation, origination, restart/resume, and runtime registration.

Tier-2 means “real Brunch/Pi boot path,” not necessarily “real provider.” Tests may substitute only auth/model/provider services while keeping session construction, extension registration, transcript wiring, and origination choreography on the product path.

## Dependency Posture

Brunch now resolves `@earendil-works/pi-*` through installed packages only. The old `PI_SOURCE` Vite/Vitest alias path was retired because it no longer affected the real `tsx` dev loop and had become a non-consequent maintenance surface.

If a future slice needs alternate-source Pi iteration again, that slice must re-establish it as a current, end-to-end consequence rather than reviving dead ambient flags.
