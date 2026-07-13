# `.fixtures/`

Current seed data, launchable workbenches, curated probe artifacts, and ephemeral
dev-loop scratch output for the Brunch POC. The active convention for committed
evidence is **harness/probe first, JSONL-backed**: each committed run must have a
probe id, a run id, executable/reportable oracle output, and the source
`session.jsonl` needed for review. Human-readable transcript rendering now
belongs in workspace-local `.brunch/debug/transcript.md` during faux-harness runs,
not as a default committed probe artifact. Brief-based golden fixtures may return
later, but they should be generated through the current harness/probe path rather
than a separate brief-library subsystem.

See [`docs/architecture/probes-and-transcripts.md`](../docs/architecture/probes-and-transcripts.md)
for the current architecture.

## Layout

```
.fixtures/
├── seeds/                      # Tracked reusable explicit-basis inputs
│   └── <seed-family>/
│       ├── README.md
│       ├── <variant>.json
│       └── _*.ts               # Reproducible data-prep scripts, not product code
├── workbenches/                # Launchable local workspaces; .brunch/ is gitignored
│   └── <name>/
├── runs/                       # Tracked curated/promoted probe evidence
│   └── <probe-id>/
│       └── <run-id>/
│           ├── session.jsonl        # Source transcript / canonical run evidence
│           ├── report.json          # Probe report and artifact paths
│           └── graph-overview.json  # Optional graph readback when graph truth is the proof target
└── scratch/                    # Gitignored ephemeral dev-loop output
    └── <loop>/
        └── <run-id>/
```

Promote scratch to evidence only deliberately: move a reviewed
`scratch/<loop>/<run-id>/` under `runs/<probe-id>/<run-id>/`, add the missing
probe report and source transcript artifacts, then track it. Dev launchers must
resolve scratch from the repo-root `.fixtures/scratch/`, independent of the
workspace cwd they target.

Promoted `runs/**` evidence must stay portable: replace any developer-workstation
absolute path (`/Users/<user>/…`, `/home/<user>/…`) with a placeholder such as
`<repo>`, `<workbench>`, `<ephemeral-workspace>`, or `<external-source>` before
committing. `npm run check:promoted-run-paths` guards this over `git ls-files
.fixtures/runs`; `.fixtures/seeds/**` is a separate, out-of-scope concern.

Seed workbench state explicitly; direct `npm run dev` never seeds, and `npm run dev-cli` seeds only through its explicit seed/reset path. See
[`seeds/README.md`](./seeds/README.md) for the roster-level seed disposition
catalog. From the repo root, load one tracked seed into one named workspace with:

```sh
npm run seed -- --seed workspace-alpha-grounding/base --reset
npm run dev-cli -- --workspace .fixtures/workbenches/workspace-alpha-grounding
```

The seed command writes only the target workspace's `.brunch/data.db` and reports
that destination path plus the `name/variant → specId` mapping. Add `--reset` to
wipe the target workspace's runtime state before seeding — `data.db`
(+ `-wal`/`-shm`),
`sessions/`, `debug/`, and `workspace.json` — so a relaunch starts a fresh session
instead of resuming a stale one; unknown files in `.brunch/` and the directory
itself survive. Use `--all-seeds` only as an explicit opt-in when a manual
workbench or probe-input database needs every tracked seed as a distinct spec.
Running `npm run seed` without `--workspace` and either `--seed` or `--all-seeds`
fails with usage instead of loading every seed into the shell cwd.

## Current runs

- `runs/public-rpc-parity/2026-05-29-public-rpc-parity/` — FE-744 public Brunch
  JSON-RPC structured-exchange parity proof.
- `runs/fixture-curation/fixture-curation-2026-06-05T104440Z/` —
  historical pre-D53-L dev-seed-fixtures tracer proving a Bilal-derived explicit
  base seed could be expanded through the then-current real
  `propose-graph`/`commit_graph` product path with implicit graph readback.
  Fresh probe runs should now use `mutate_graph`.
- `runs/project-graph-review-cycle/2026-06-06-project-graph-review-cycle/` —
  FE-809 tracer proving a Bilal-derived explicit base seed can drive real
  `project-graph` proposal generation through `present_review_set`, public RPC
  review approval, and explicit-basis graph readback.
