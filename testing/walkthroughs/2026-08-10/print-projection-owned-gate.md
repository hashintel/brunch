# Print projection — source and installed-package evidence

- Date: 2026-08-10
- Commit tested: `d195d8dbb`
- Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`
- Host: macOS arm64, Node `v24.19.0`, npm `12.0.2`
- Installed-leg workspace: `/tmp/brunch-fe-1348-print-final-IC1hKr/selected-workspace` (fresh bounded scratch, removed after capture)

## Disposition

**Built.** The previously recorded source leg projected its selected workspace and left every canonical file byte-stable. On the current commit, a fresh real tarball installed into an isolated global prefix using exactly the reviewed `package.json.allowScripts` policy now used by `scripts/check-release-pack.mjs`. From a foreign cwd, the installed CLI projected a freshly activated selected workspace and exited 0. Every canonical regular file had identical SHA-256 and size before and after print.

This closes only the `Print projection` row. It does not widen into interactive startup or alter the separate `Installed-package integrity` row.

## Source leg retained from the owned-gate run

The source command passed on commit `89e063444`:

```sh
npm run dev-cli -- --workspace "$WORK" --mode print
```

It identified the activated workspace, spec, session, and canonical session file. The baseline and post-source manifests were identical for all canonical regular files. That valid source evidence is preserved rather than rerun.

## Fresh installed leg

The workspace was created through supported source RPC before the read-only baseline. The packed install reproduced the release-pack harness policy without unrestricted script execution:

```sh
SCRATCH=$(mktemp -d /tmp/brunch-fe-1348-print-final-XXXXXX)
WORK="$SCRATCH/selected-workspace"
PACK="$SCRATCH/pack"
PREFIX="$SCRATCH/prefix"
FOREIGN="$SCRATCH/foreign-cwd"
mkdir -p "$WORK" "$PACK" "$PREFIX" "$FOREIGN"

npm run dev-cli -- rpc workspace.activate \
  '{"decision":{"action":"newSpec","title":"FE-1348 installed print projection scratch"}}' \
  --workspace "$WORK"

(cd "$WORK" && find .brunch -type f -print0 | sort -z | xargs -0 shasum -a 256) \
  > "$SCRATCH/before.sha256"

npm pack --pack-destination "$PACK"
ALLOW=$(node -e "const p=require('./package.json'); process.stdout.write(Object.entries(p.allowScripts).filter(([,v])=>v).map(([k])=>k).join(','))")
npm install --global --prefix "$PREFIX" --allow-scripts="$ALLOW" \
  "$PACK/hashintel-brunch-1.0.0-alpha.13.tgz"

(cd "$FOREIGN" && "$PREFIX/bin/brunch" --cwd "$WORK" --mode print)

(cd "$WORK" && find .brunch -type f -print0 | sort -z | xargs -0 shasum -a 256) \
  > "$SCRATCH/after-installed.sha256"
cmp "$SCRATCH/before.sha256" "$SCRATCH/after-installed.sha256"
```

The exact reviewed allowlist was:

```text
better-sqlite3@12.11.1,@google/genai,protobufjs,esbuild,fsevents,@nubjs/nub@0.4.5
```

The install added 211 packages and emitted only deprecation warnings; it emitted no blocked-script warning. The tarball SHA-256 was `664354adf2300470e24ba59c183ac306985a1e17a83742ea7a320caa3cd26ace`.

## Installed projection evidence

The command exited 0 with empty stderr and produced:

```text
Brunch workspace state
status: ready
cwd: /tmp/brunch-fe-1348-print-final-IC1hKr/selected-workspace
spec: FE-1348 installed print projection scratch (1)
session: 019feb9c-b5eb-7bd0-9bf5-d6674a7d51bb
sessionFile: /tmp/brunch-fe-1348-print-final-IC1hKr/selected-workspace/.brunch/sessions/2026-08-10T12-19-03-787Z_019feb9c-b5eb-7bd0-9bf5-d6674a7d51bb.jsonl
```

This proves the installed executable was launched from a cwd outside both the repository and selected workspace while projecting the explicitly selected workspace.

## Canonical-file byte stability

All canonical regular files present after activation were included:

```text
1cfebdc9267250ea69e0c3d0834ec1213bae1c3fc18a8b8469449982170757b8  .brunch/brunch-v1.db
6eac5ca577fcb0dc571177896ead50ccc0000b53734fe15b56462c439d7dcc79  .brunch/sessions/2026-08-10T12-19-03-787Z_019feb9c-b5eb-7bd0-9bf5-d6674a7d51bb.jsonl
c5c58867b0051a8b3e5da2fc325f6b4417bd72bcd6b05bc770e306193d65edc2  .brunch/workspace.json
```

Sizes were respectively 69,632 bytes, 512 bytes, and 348 bytes before and after. Both manifest files had SHA-256:

```text
ed65ca3771bc04531dbaa4276f49319074988d0e457e5dcdd975d99fef0260f4
```

`cmp` passed for both the checksum manifests and independently captured size manifests. Installed print therefore did not mutate, add, or remove any canonical regular file.

## Cleanup proof

The complete `/tmp/brunch-fe-1348-print-final-IC1hKr` root contained the selected workspace, tarball, isolated prefix, foreign cwd, and command captures. It was removed after documenting the evidence; no retained install, fixture, seed, workbench, or promoted run artifact remains.
