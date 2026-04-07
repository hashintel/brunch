# Dev Server & Debugging Tools

Runtime tooling for observing the running application — logs, database inspection, and process management.

## How it works

The `npm run dev` script wraps two services with `agent-tail run`:

- **`vite`** — frontend dev server → `tmp/logs/latest/vite.log`
- **`api`** — backend server → `tmp/logs/latest/api.log`

The Vite plugin (`agentTail()` in `vite.config.ts`) captures browser `console.*` calls → `tmp/logs/latest/browser.log`.

All output is also interleaved in `tmp/logs/latest/combined.log`.

## Important

The dev server **must** be started via `npm run dev` for server-side logs to be captured. If Vite is started directly (e.g. bare `vite`), only `browser.log` will exist — `vite.log`, `api.log`, and `combined.log` will be missing.

## Orphan process cleanup

The `dev` script kills any orphaned processes on ports 5173 (Vite) and 3000 (API) before starting. This prevents `EADDRINUSE` errors when a previous dev session was killed without clean shutdown (e.g. agent timeout, force-quit, crashed terminal).

If you hit port conflicts outside `npm run dev`, kill orphans manually:

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
```

## Reading logs

Use `Read` or `Grep` against `tmp/logs/latest/`:

```bash
# Check for server errors
grep -i error tmp/logs/latest/vite.log
grep -i error tmp/logs/latest/api.log

# Browser console output
cat tmp/logs/latest/browser.log

# Everything interleaved
cat tmp/logs/latest/combined.log
```

## Session history

Each `npm run dev` invocation creates a timestamped session directory under `tmp/logs/`. The `latest` symlink always points to the most recent session. Older sessions remain available for comparison.

## Drizzle Studio (database inspector)

Browse and edit the SQLite database visually:

```bash
npm run studio
```

Opens `https://local.drizzle.studio` in the browser. Reads from `brunch.db` (or `$BRUNCH_DB`) — the same file the API server writes to. Config lives in `drizzle.config.ts`.

Note: tests use in-memory databases, so test data won't appear in Studio. Only data from actual dev server sessions (`npm run dev`) is visible.
