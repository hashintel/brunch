# FE-1348 installed-package integrity

## Frozen setup

- UTC sweep record date: 2026-08-10.
- Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`.
- Commit tested: `bd9951cbdfcb82ad9a95ae3e896938c622d04d48`.
- Host: macOS Darwin 25.6.0, arm64; `CI` unset.
- Tools: Node `v24.19.0`; npm `12.0.2`; Git `2.50.1 (Apple Git-155)`.
- Selected fixture intentions: none. The release-pack script owns a disposable temporary pack/install/foreign-cwd workspace and removes it after the run.

## Row contract

Capability: **Installed-package integrity**. The repository-owned `npm run check:release-pack` entry point must pass, proving the tarball asset inventory, isolated global install, foreign-cwd print boot, public RPC workspace activation, and native SQLite binding without source-tree reachability.

## Execution

Command: `npm run check:release-pack`

Outcome: exit 0.

- `npm pack` produced exactly one `@hashintel/brunch@1.0.0-alpha.13` tarball containing 1,644 files (2.0 MB packed, 6.6 MB unpacked).
- The script's asset assertions accepted the required prompt registry, web entry point, runtime Markdown assets, and eight live skill definitions, while rejecting neither excluded `dist/web/` nor `dist/probes/` content.
- npm installed 211 packages into the isolated global prefix in 10 seconds. The npm 12 install used the repository-reviewed truthy `package.json.allowScripts` entries, including `better-sqlite3@12.11.1`.
- The installed `brunch` binary ran `--mode print` from the foreign cwd and emitted the required `Brunch workspace state` projection.
- The same installed binary handled a stdio `workspace.activate` RPC request from the foreign cwd, returned `status: "ready"`, and created `.brunch/brunch-v1.db`. This exercises the installed native SQLite binding rather than merely loading a source-tree dependency.
- Final oracle output: `check:release-pack OK — packed artifact installs, boots from a foreign cwd, and opens SQLite`.

npm emitted two dependency deprecation warnings (`prebuild-install@7.1.3` and `node-domexception@1.0.0`). Neither contradicted package installation, foreign-cwd execution, or SQLite activation, so this evidence-only row did not open a finding or alter the closed inventory.

## Cleanup and reconciliation

- The command removed its disposable temporary directory; no packed tarball, install prefix, foreign-cwd database, fixture, or source artifact was retained.
- The repository worktree was clean immediately after execution.
- No production, package policy, canonical architecture, or frontier-level obligation changed. Reconciliation is limited to this retained evidence and the row's ledger status.
- No tests were skipped by this row oracle; skipped-test-count delta versus the parent commit: **0**.
