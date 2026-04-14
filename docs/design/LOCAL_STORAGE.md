# Local-First Storage Design

> Design exploration from 2026-04-12. Referenced by SPEC.md D81.
> Status: **approved direction** — BrunchProject struct with shallow walk-up.

## Shape

```typescript
interface BrunchProject {
  root: string        // absolute path to .brunch/
  dbPath: string      // .brunch/brunch.db
  configPath: string  // .brunch/config.json (future)
  cwd: string         // the directory where .brunch/ was found or created
}

/** Walk up from cwd looking for .brunch/ (max ~5 levels, stop at home or root).
 *  Returns null if not found. */
function findBrunchProject(cwd: string): BrunchProject | null

/** Create .brunch/ in cwd. Throws if it already exists. */
function initBrunchProject(cwd: string): BrunchProject

/** Find or create: find first, create if not found. */
function resolveBrunchProject(cwd: string): BrunchProject
```

## Walk-up behavior

Matches `.git` discovery semantics:
1. Check `cwd/.brunch/` — if found, use it
2. Walk up parent directories (max 5 levels)
3. Stop at filesystem root or user home directory
4. If not found anywhere, create `.brunch/` in the original `cwd`

## Integration with launcher

```typescript
// src/server/index.ts (or future bin entry)
const project = resolveBrunchProject(process.cwd())
const db = createDb(project.dbPath)
const app = createApp(db, project)
```

## .brunch/ directory structure

```
.brunch/
  brunch.db        # SQLite database (all projects/runs within this directory)
  brunch.db-wal    # WAL file (auto-created by SQLite)
  brunch.db-shm    # shared memory file (auto-created by SQLite)
  config.json      # future: user preferences, model config
```

## Design alternatives considered

- **A (Minimal):** Just change the default DB path to `.brunch/brunch.db`. No resolution logic, no struct. Too simple — doesn't handle subdirectory invocation or future config.
- **C (Explicit, no walk-up):** Only look in cwd. Simplest mental model but breaks when user runs from a subdirectory.

## Open questions

- `.brunch/` should be gitignored in repositories using Brunch — the SQLite DB contains local session state and API responses.
- Should the walk-up depth be configurable? (Probably not — 5 levels is sufficient.)
- Should `resolveBrunchProject` print a message when it creates a new `.brunch/`? (Yes — first-run feedback.)
