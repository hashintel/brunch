# Dev feedback loops

This directory owns Brunch-only development feedback loops. These helpers are not product runtime configuration and must not weaken the sealed Pi profile (D39-L).

## Pi source alias (D67-L)

Brunch tracks the latest published `@earendil-works/pi-*` line. Two resolution concerns are kept strictly separate:

- **Types + default resolution → installed `dist`.** The published packages ship their own `dist/index.d.ts`, so `tsc`, `tsx`, the editor/LSP, oxlint type-aware lint, and ordinary runtime all resolve pi from `node_modules`. There are deliberately **no `paths` in `tsconfig.json`** — adding them would make a personal source checkout the unconditional default for everyone (tsconfig paths cannot be env-gated) and is unnecessary because the dist `.d.ts` are version-matched to the declared deps.
- **No-rebuild source iteration → runtime alias, gated by `PI_SOURCE`.** When you want edits in a sibling `pi-mono` checkout to take effect without rebuilding, set `PI_SOURCE=1`. `vite.config.ts`'s `piSourceAlias()` then redirects all four packages (`pi-ai`, `pi-agent-core`, `pi-coding-agent`, `pi-tui`) to `pi-mono` source for `vite` and `vitest`. `PI_SOURCE_ROOT` overrides the default checkout path (`/Users/lunelson/.pi/pi-mono`); the alias is inert if the checkout does not exist.

`pi-agent-core` is aliased even though Brunch never imports it directly: `pi-coding-agent`'s source imports it, so a partial alias would produce a mixed source/dist module graph.

### tsx source mode (Cards 2–3, when needed)

`vitest`/`vite` are covered by the alias above. The **`tsx`**-run loops (`npm run dev` TUI, probes) do **not** read `vite.config.ts`; tsx resolves through `tsconfig`. When a real-provider/TUI source-iteration loop actually needs no-rebuild pi edits, add an opt-in `tsconfig.dev.json` (extends `./tsconfig.json`, adds the pi `paths` + `allowImportingTsExtensions`) and run `tsx --tsconfig tsconfig.dev.json`. Do **not** add those paths to the base `tsconfig.json`. This is intentionally deferred — Card 1 only needs the vitest-level alias proven by `pi-source-alias.test.ts`.
