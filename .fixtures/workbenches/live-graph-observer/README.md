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

## Browser feedback loop

Use Chrome DevTools Protocol tooling as the primary browser observer. Playwright
can still be useful for future scripted cross-browser checks, but the branch's
manual feedback loop is CDP-first because it gives quick console, network, and
accessibility-tree inspection without becoming product runtime behavior.

Launch the web host from this workbench:

```sh
# Terminal A: standalone web observer host
( cd .fixtures/workbenches/live-graph-observer && node ../../../bin/brunch-cli.js --mode web )
```

The host prints a localhost URL such as:

```text
Brunch web sidecar listening on http://127.0.0.1:<port>/spec/<specId>
```

or, when no selected spec route is available yet:

```text
Brunch web sidecar listening on http://127.0.0.1:<port>
```

Open and inspect that URL with `cdp-cli`:

```sh
# Terminal B: browser observer
cdp-cli launch
cdp-cli new "http://127.0.0.1:<port>/spec/<specId>"
cdp-cli tabs

# Accessibility tree / page content
cdp-cli snapshot "127.0.0.1"
cdp-cli snapshot "127.0.0.1" --format text

# Runtime signals
cdp-cli console "127.0.0.1" -t error -d 2
cdp-cli network "127.0.0.1" -d 2 -t fetch
```

If the page title or URL is ambiguous, use the page id from `cdp-cli tabs`
instead of the `127.0.0.1` title/URL substring in later commands.

### Annotation tooling

`agentation`, if used, is complementary to CDP tooling: CDP observes the browser
(console, network, accessibility tree, screenshots), while `agentation` annotates
a running browser so an agent can fetch human/agent notes through its own CLI.
This card does not enable `agentation`, add a dependency, or import it into
`src/web/*`. If a future slice wants annotated web UI feedback inside product
code, that slice owns the dependency/import change.

### Current verification note

- `npm run build` passed during the Card 2 builder attempt.
- `brunch-cli --mode web` launched from this workbench and printed a localhost
  URL.
- Browser automation is still pending on this machine until a local browser
  backend works. Observed blockers: harness Chromium crashed, Playwright's
  default Chrome path crashed under macOS sandbox/framework loading,
  WebKit/Firefox were not installed, and the Chromium browser install attempt
  was interrupted. Until that is fixed, the documented CDP loop is the intended
  command path but the page-observable browser smoke is not yet complete.
