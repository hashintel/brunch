# Print projection — owned installed-package gate

Date: 2026-08-10  
Commit tested: `89e063444`  
Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`  
Host: macOS arm64, Node `v24.19.0`, npm `12.0.2`  
Workspace: `/tmp/brunch-fe-1348-print-hJITyF/selected-workspace` (fresh bounded scratch, removed after capture)

## Disposition

**Owned gate; row remains `partial`.** The source entry projected the selected workspace and exited 0 without changing any canonical file. A real `npm pack` and foreign-cwd global-prefix install completed, but npm 12 blocked `better-sqlite3@12.11.1`'s install script. The installed `brunch --mode print` therefore exited 1 before producing a projection because its native binding was absent. No install-script bypass or repair was attempted.

Owner: FE-1348 `Print projection` row. Re-entry trigger: a fresh real packed install in an environment that permits the package-declared native dependency install scripts, or an owned successful release-pack installation retained for reuse. Cost/value: one bounded rerun can compare the installed projection and close byte stability; bypassing package installation now would weaken release-shape evidence.

This does not close or alter the separate `Installed-package integrity` row.

## Setup and exact commands

The selected workspace was established through the supported source RPC entry before the read-only baseline:

```sh
SCRATCH=$(mktemp -d /tmp/brunch-fe-1348-print-XXXXXX)
WORK="$SCRATCH/selected-workspace"
PACK="$SCRATCH/pack"
PREFIX="$SCRATCH/prefix"
mkdir -p "$WORK" "$PACK" "$PREFIX"
npm run dev-cli -- rpc workspace.activate \
  '{"decision":{"action":"newSpec","title":"FE-1348 print projection scratch"}}' \
  --workspace "$WORK"

(cd "$WORK" && find .brunch -type f -print0 | sort -z | xargs -0 shasum -a 256) > "$SCRATCH/before.sha256"
npm run dev-cli -- --workspace "$WORK" --mode print
(cd "$WORK" && find .brunch -type f -print0 | sort -z | xargs -0 shasum -a 256) > "$SCRATCH/after-source.sha256"

npm pack --pack-destination "$PACK"
npm install --global --prefix "$PREFIX" "$PACK/hashintel-brunch-1.0.0-alpha.13.tgz"
(cd "$WORK" && "$PREFIX/bin/brunch" --mode print)
(cd "$WORK" && find .brunch -type f -print0 | sort -z | xargs -0 shasum -a 256) > "$SCRATCH/after-installed-attempt.sha256"
```

Command outcomes:

| Leg | Exit | Outcome |
| --- | ---: | --- |
| Source `npm run dev-cli -- --workspace "$WORK" --mode print` | 0 | Projection produced. |
| `npm pack` | 0 | Real `1.0.0-alpha.13` tarball produced. |
| npm 12 global-prefix install | 0 | Install completed with blocked-script warnings. |
| Installed foreign-cwd `brunch --mode print` | 1 | No projection; missing `better_sqlite3.node`. |

## Source projection evidence

```text
Brunch workspace state
status: ready
cwd: /tmp/brunch-fe-1348-print-hJITyF/selected-workspace
spec: FE-1348 print projection scratch (1)
session: 019feb5b-d240-7dda-af7d-927a68bc9742
sessionFile: /tmp/brunch-fe-1348-print-hJITyF/selected-workspace/.brunch/sessions/2026-08-10T11-08-11-200Z_019feb5b-d240-7dda-af7d-927a68bc9742.jsonl
```

The output identifies the activated selected workspace, spec, session, and canonical session file.

## Installed-leg gate evidence

npm reported:

```text
npm warn install-scripts 3 packages had install scripts blocked because they are not covered by allowScripts:
npm warn install-scripts   better-sqlite3@12.11.1 (install: prebuild-install || node-gyp rebuild --release)
```

The installed CLI then reported `Could not locate the bindings file` for every expected `better_sqlite3.node` location under the isolated prefix. It emitted no workspace projection. This is the known real-package-install gate, not a print-output mismatch.

## Byte-stability manifest

All canonical regular files present after activation were included:

```text
8dbc5652e46b23246b8f8fb65f5685a9100e026c6e799d55840a5881440936a9  .brunch/brunch-v1.db
c824e8518007494ac6e74a20cfcd37d1a5caa75b1c3d7ab105d8c7c85e4fc6ba  .brunch/sessions/2026-08-10T11-08-11-200Z_019feb5b-d240-7dda-af7d-927a68bc9742.jsonl
ee3cb916c85d676daefc0f62970c9a22847c80dcba89b6d91a7f65716a33e610  .brunch/workspace.json
```

Sizes were respectively 69,632 bytes, 496 bytes, and 348 bytes. The baseline, post-source, and post-installed-attempt manifest files each had SHA-256:

```text
c1ee36abe49a3ffcf348089e64152dcd2d88e017b28388364de2c2f08b8fd238
```

Thus source print and the failed installed attempt left every existing canonical file byte-stable. The installed success case remains unproved and is not inferred from this failed attempt.

## Cleanup proof

The complete `/tmp/brunch-fe-1348-print-hJITyF` root contained the workspace, tarball, and isolated prefix. It was removed after capture; `test ! -e /tmp/brunch-fe-1348-print-hJITyF` returned success. No retained install, fixture, seed, workbench, or promoted run artifact remains.
