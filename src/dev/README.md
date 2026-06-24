# Dev feedback loops

This directory owns Brunch-only development feedback loops. These helpers are not product runtime configuration and must not weaken the sealed Pi profile (D39-L).

This README is a topology-local contract, not a tutorial. It records what `src/dev/**` owns, which proof loops live here, and which runtime substitutions are allowed. Operational notes are included only when they prevent a topology mistake.

## Pi source alias (D67-L)

Brunch tracks the latest published `@earendil-works/pi-*` line. Two resolution concerns are kept strictly separate:

- **Types + default resolution → installed `dist`.** The published packages ship their own `dist/index.d.ts`, so `tsc`, `tsx`, the editor/LSP, oxlint type-aware lint, and ordinary runtime all resolve pi from `node_modules`. There are deliberately **no `paths` in `tsconfig.json`** — adding them would make a personal source checkout the unconditional default for everyone (tsconfig paths cannot be env-gated) and is unnecessary because the dist `.d.ts` are version-matched to the declared deps.
- **No-rebuild source iteration → runtime alias, gated by `PI_SOURCE`.** When you want edits in a sibling `pi-mono` checkout to take effect without rebuilding, set `PI_SOURCE=1`. `vite.config.ts`'s `piSourceAlias()` then redirects all four packages (`pi-ai`, `pi-agent-core`, `pi-coding-agent`, `pi-tui`) to `pi-mono` source for `vite` and `vitest`. `PI_SOURCE_ROOT` overrides the default checkout path (`join(os.homedir(), '.pi', 'pi-mono')`); the alias is inert if the checkout does not exist.

`pi-agent-core` is aliased even though Brunch never imports it directly: `pi-coding-agent`'s source imports it, so a partial alias would produce a mixed source/dist module graph.

### tsx source mode (Cards 2–3, when needed)

`vitest`/`vite` are covered by the alias above. The **`tsx`**-run loops (`npm run dev` TUI, probes) do **not** read `vite.config.ts`; tsx resolves through `tsconfig`. When a real-provider/TUI source-iteration loop actually needs no-rebuild pi edits, add an opt-in `tsconfig.dev.json` (extends `./tsconfig.json`, adds the pi `paths` + `allowImportingTsExtensions`) and run `tsx --tsconfig tsconfig.dev.json`. Do **not** add those paths to the base `tsconfig.json`. This is intentionally deferred — Card 1 only needs the vitest-level alias proven by `pi-source-alias.test.ts`.

## Faux loop (D68-L)

`src/dev/index.ts` is the dev front door. It exports the shared faux-harness factory and the scripted faux launcher, plus the existing workspace RPC helper namespace. The tiny faux-provider config used by buildable probes lives in `src/probes/faux-provider.ts`; `src/dev/faux-harness.ts` re-exports it for dev-loop callers without making probes import build-excluded `src/dev/**` modules.

- `createBrunchFauxHarness()` boots an in-memory Pi `AgentSession` with in-memory auth, model registry, session manager, and a deterministic faux provider. By default it also uses in-memory settings and no active tools; Tier-1 callers may pass a Brunch-configured `resourceLoader`/`settingsManager` pair so the faux provider captures the real extension-mutated payload. It records `providerContexts` for Tier-1 assertions over exact provider messages and active tools after Brunch mutation.
- `runBrunchFauxTurn()` is the smoke launcher: it scripts one prompt→assistant turn with no network I/O and returns the assistant text plus provider call count.
- `brunchFauxProviderConfig()` defaults to the literal in-process dev key and accepts an explicit api-key override. Subprocess probes pass the pi 0.79 `$ENV` form themselves; the in-process harness does not mutate `process.env` to satisfy a subprocess concern.

Product probes may import `src/probes/faux-provider.ts` when they need deterministic faux wiring, but they remain product-verification probes under `src/probes/`; they do not become dev loops merely because they share infrastructure.

## Introspection loop (D69-L)

`runBrunchIntrospectionTurn()` is the paired-run artifact writer for the dev-only introspection loop. The Pi side is the explicit, read-only `src/.pi/extensions/introspection/` registrar, included only when `createBrunchPiExtensions(..., { introspection: { enabled: true } })` is passed. Product Brunch sessions omit it by default and keep the D39-L offline default. The launcher does not mutate `process.env`; any future online real-provider lift belongs at session construction with save/restore scoping.

## Tier-2 real boot loop (FE-847)

`runTier2RealBootFauxTurn()` is the real-boot harness for runtime choreography tests: it enters through `runBrunchTui`, drives one faux-provider turn, and exposes the captured provider context, active tool names, transcript entries, session file, and `.brunch/debug/transcript.md` path. The debug transcript is rendered from Pi's canonical context construction, then filtered to user, assistant, and Brunch-owned custom tool-result messages. `bootTier2RuntimeThroughRunBrunchTui()` owns real runtime boot proofs such as ready context and `BRUNCH_DEV`-gated query-tool registration. `resumeTier2Fixture()` writes a fixture JSONL transcript, reopens it through the workspace/session coordinator, and reports original vs resumed session-file state so restart/resume assertions do not need local fake boot helpers. `bootTier2RuntimeFromFixture()` is the resume-side real-boot chassis (pre-seed a fixture transcript, then boot the real runtime over it — the I46 resume-origination oracle), and `rebootTier2Runtime()` re-boots the real runtime over the same session file after flushing Pi's deferred JSONL (the I47 actual-restart idempotence oracle). The FE-847 coverage-first scaffold is fully live as of 2026-06-11 — no skipped/todo rows remain. Suites split across two files: kick/boot-path suites in `tier-2-harness.test.ts`, the coverage-first scaffold suites (I45/I46/I47) in `tier-2-scaffold.test.ts`, with shared transcript/assertion helpers in `tier-2-test-support.ts`.

Tier-2 means "real Brunch/Pi runtime boot", not "always a live provider" and not "always faux". The provider/auth source is a separate axis:

- No `agentServices` override: Brunch builds product services through `createBrunchAgentSessionRuntimeFactory()`. The model registry can see real configured auth only when the boot uses the real Pi agent dir and the run opts out of offline mode.
- `agentServices` override: tests substitute only auth/model/provider services while keeping the Brunch runtime, extension registration, session manager, transcript, and origination choreography on the product path. This is still a real boot proof, but it is not a real-provider proof.
- Temporary `agentDir`: useful for isolation, but it intentionally hides ambient model auth. Do not use it for a real-provider witness that expects product-configured models.
- `PI_OFFLINE=1`: valid for deterministic/no-network loops; invalid for live-model evidence. Real-provider dev probes must set `PI_OFFLINE=0` explicitly.

## Generate fan-out witness (FE-1059)

`runGenerateFanOutWitness()` is the dev-only real-model probe for the `elicitor-generate` oracle plane. It enters through `bootTier2RuntimeFromFixture()` with no `agentServices` override, pins the real `brunch:lens` command to `oracle`, seeds explicit intent/design graph truth through `CommandExecutor`, sends the P3 `generate-proposal` prompt under a bounded timeout, and writes JSONL-backed scratch artifacts to `.fixtures/scratch/generate-fan-out/<run-id>/`. Its report reads only canonical `session.jsonl` markers: `generate-proposal/SKILL.md`, `references/oracle.md`, `present_candidates`, and the I51-L no-write evidence (unchanged graph counts/LSN, no `mutate_graph`, no approved review result). `skipped` and `blocked` reports are evidence of environment/turn state, not A31-L passes; promoted evidence belongs under `.fixtures/runs/` only after human review.

Run it with `npm run probe:generate-fan-out -- --timeout-ms 60000`. The script sets `PI_OFFLINE=0`, prepends mise's Node LTS install to `PATH` so native modules such as `better-sqlite3` load against the ABI they were built with, and boots with the real Pi agent dir so the product model registry can see configured model auth.

## Proof ownership ledger

- **Unit:** pure derivations and local policy tables (`projections/session/*`, `session/*` helpers).
- **Tier-1 faux session:** exact provider context after in-memory Brunch mutation, prompt/tool payloads, and hook mutation proof via `createBrunchFauxHarness().providerContexts`.
- **Tier-2 real boot:** `runBrunchTui` boot, ready context, runtime registration, transcript files, and restart/resume state via `tier-2-harness.ts`.
- **Probe/transport:** public JSON-RPC, CLI, subprocess, and cross-process parity claims.

## Introspection loop (D69-L)

The passive extension tap records the final `before_provider_request` payload. The launcher then drives a subjective `session.prompt(...)` turn and writes the correlated scratch run under repo-root `.fixtures/scratch/introspection/<run-id>/`, independent of the workspace cwd it targets:

- `mechanical.json` — latest passive provider-payload capture plus optional `/introspect` base-prompt report
- `subjective.json` — assistant answer text from the subjective prompt
- `manifest.json` — paired summary keyed by the same captured turn id

The `/introspect` command reports `ctx.getSystemPromptOptions()` base inputs plus the latest passive capture; it deliberately does not claim to reconstruct exact model input. Exactness belongs to the passive provider-payload tap registered last in the Brunch extension bundle. In `BRUNCH_DEV` real TUI launches, that same passive capture mirrors the latest final system prompt bytes into `.brunch/debug/system-prompt.md`; Brunch-owned text `tool_result` content appends to `.brunch/debug/tool-contents.md`. This is an ephemeral workspace debug cache, separate from repo-root `.fixtures/scratch/` evidence, and does not attempt `renderResult()` flattening.
