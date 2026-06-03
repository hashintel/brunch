# Workbench — live-graph-observer

A reusable cwd for manually exercising the `live-graph-observer` (FE-795) frontier
end-to-end. Treat this directory as the project cwd when launching `brunch-cli`
so that `.brunch/` and `data.db` scaffold here rather than in the repo root.

## Why it exists

The frontier's middle/outer verification needs a stable, throwaway cwd where the
TUI writer and the web observer host can both run against a fresh
`.brunch/data.db`. Committing this directory (and only this README) guarantees
every contributor agrees on where the manual smoke happens.

## How to use it

From the repo root, run:

```sh
# Dev build, against TS source (no build step needed)
( cd .fixtures/workbenches/live-graph-observer && npx tsx ../../../src/brunch.ts --mode print )

# Built bin (after `npm run build`)
( cd .fixtures/workbenches/live-graph-observer && node ../../../bin/brunch-cli.js --mode print )

# Once installed (e.g. via `npm link` or a published install)
( cd .fixtures/workbenches/live-graph-observer && brunch-cli --mode print )
```

On first launch Brunch scaffolds a local `.brunch/` directory containing
`data.db` and Pi session files **inside this workbench directory**, not in the
repo root. That state is per-cwd by design and must not be committed.

## What is and is not committed

- ✅ This `README.md` is committed.
- 🚫 `.brunch/` (created on first launch) is ignored by the repo-level
  `.gitignore` and must stay uncommitted. If anything else appears here later
  (logs, scratch transcripts), prefer keeping them ignored rather than
  whitelisting them.

## Modes you will exercise here

- `--mode print` — non-interactive workspace projection; smoke for CLI identity
  and DB scaffolding.
- `--mode tui` — interactive writer session; once the `live-graph-observer`
  observer host card lands, this is also the launch path that exposes a local
  web observer URL.
- `--mode web` — standalone web host; useful for web-only iteration before the
  TUI-hosted observer path is wired in.

The exact verified manual smoke sequence for browser observation (which web
inspection / annotation tooling, expected port, etc.) is owned by the
`live-graph-observer--mise-en-place.md` Card 2 (browser feedback loop decision)
and will be recorded here once that card lands.
