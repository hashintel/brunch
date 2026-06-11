# Dev feedback loops

This directory owns Brunch-only development feedback loops. These helpers are not product runtime configuration and must not weaken the sealed Pi profile (D39-L).

## Pi source alias (D67-L)

Brunch tracks the latest published `@earendil-works/pi-*` line. Two resolution concerns are kept strictly separate:

- **Types + default resolution → installed `dist`.** The published packages ship their own `dist/index.d.ts`, so `tsc`, `tsx`, the editor/LSP, oxlint type-aware lint, and ordinary runtime all resolve pi from `node_modules`. There are deliberately **no `paths` in `tsconfig.json`** — adding them would make a personal source checkout the unconditional default for everyone (tsconfig paths cannot be env-gated) and is unnecessary because the dist `.d.ts` are version-matched to the declared deps.
- **No-rebuild source iteration → runtime alias, gated by `PI_SOURCE`.** When you want edits in a sibling `pi-mono` checkout to take effect without rebuilding, set `PI_SOURCE=1`. `vite.config.ts`'s `piSourceAlias()` then redirects all four packages (`pi-ai`, `pi-agent-core`, `pi-coding-agent`, `pi-tui`) to `pi-mono` source for `vite` and `vitest`. `PI_SOURCE_ROOT` overrides the default checkout path (`join(os.homedir(), '.pi', 'pi-mono')`); the alias is inert if the checkout does not exist.

`pi-agent-core` is aliased even though Brunch never imports it directly: `pi-coding-agent`'s source imports it, so a partial alias would produce a mixed source/dist module graph.

### tsx source mode (Cards 2–3, when needed)

`vitest`/`vite` are covered by the alias above. The **`tsx`**-run loops (`npm run dev` TUI, probes) do **not** read `vite.config.ts`; tsx resolves through `tsconfig`. When a real-provider/TUI source-iteration loop actually needs no-rebuild pi edits, add an opt-in `tsconfig.dev.json` (extends `./tsconfig.json`, adds the pi `paths` + `allowImportingTsExtensions`) and run `tsx --tsconfig tsconfig.dev.json`. Do **not** add those paths to the base `tsconfig.json`. This is intentionally deferred — Card 1 only needs the vitest-level alias proven by `pi-source-alias.test.ts`.

## Faux loop (D68-L)

`src/dev/index.ts` is the dev front door. It exports the shared faux-harness factory and the scripted faux launcher, plus the existing workspace RPC helper namespace. The tiny faux-provider config used by buildable probes lives in `src/probes/faux-provider.ts`; `src/dev/faux-harness.ts` re-exports it for dev-loop callers without making probes import build-excluded `src/dev/**` modules.

- `createBrunchFauxHarness()` boots an in-memory Pi `AgentSession` with in-memory auth, model registry, session manager, settings manager, no active tools, and a deterministic faux provider.
- `runBrunchFauxTurn()` is the smoke launcher: it scripts one prompt→assistant turn with no network I/O and returns the assistant text plus provider call count.
- `brunchFauxProviderConfig()` defaults to the literal in-process dev key and accepts an explicit api-key override. Subprocess probes pass the pi 0.79 `$ENV` form themselves; the in-process harness does not mutate `process.env` to satisfy a subprocess concern.

Product probes may import `src/probes/faux-provider.ts` when they need deterministic faux wiring, but they remain product-verification probes under `src/probes/`; they do not become dev loops merely because they share infrastructure.

## Introspection loop (D69-L)

`runBrunchIntrospectionTurn()` is the paired-run artifact writer for the dev-only introspection loop. The Pi side is the explicit, read-only `src/.pi/extensions/introspection/` registrar, included only when `createBrunchPiExtensions(..., { introspection: { enabled: true } })` is passed. Product Brunch sessions omit it by default and keep the D39-L offline default. The launcher does not mutate `process.env`; any future online real-provider lift belongs at session construction with save/restore scoping.

The passive extension tap records the final `before_provider_request` payload. The launcher then drives a subjective `session.prompt(...)` turn and writes the correlated scratch run under repo-root `.fixtures/scratch/introspection/<run-id>/`, independent of the workspace cwd it targets:

- `mechanical.json` — latest passive provider-payload capture plus optional `/introspect` base-prompt report
- `subjective.json` — assistant answer text from the subjective prompt
- `manifest.json` — paired summary keyed by the same captured turn id

The `/introspect` command reports `ctx.getSystemPromptOptions()` base inputs plus the latest passive capture; it deliberately does not claim to reconstruct exact model input. Exactness belongs to the passive provider-payload tap registered last in the Brunch extension bundle.
