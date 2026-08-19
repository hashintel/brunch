# Installed interactive-mode boot

## Scope

Witness the freshly packed, isolated `@hashintel/brunch` binary starting the authless TUI and standalone web from separate foreign working directories. This is startup-only evidence: no provider turn and no publication.

## Environment

- Source commit: `394561a47f3825f9da0689759ee7ba5d1eba2fb9`
- Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`
- Host: macOS arm64
- Packed package: `@hashintel/brunch@1.0.0-alpha.13`
- Installed binary: fresh temporary global-prefix install outside the repository
- Foreign working directories: separate empty temporary `tui-cwd` and `web-cwd` directories
- TUI observer: project-owned `npm run tui-driver` PTY fallback; native Herdr control and local `herdr` CLI were unavailable from the Herdr-managed pane with `EPERM`

## Fresh packed install

Ran `npm pack --pack-destination <temp>/pack`, then installed the sole tarball into a fresh isolated prefix with the exact reviewed release-pack policy derived from truthy `package.json.allowScripts` entries:

```text
better-sqlite3@12.11.1,@google/genai,protobufjs,esbuild,fsevents,@nubjs/nub@0.4.5
```

`npm install --global --prefix <temp>/prefix --allow-scripts=<truthy-list> <tarball>` completed with 211 packages added. The installed binary's `--help` reported the expected `tui | web | print | rpc` modes.

## Installed authless TUI

From the repository, used `npm run tui-driver` only as the PTY harness around a shell that changed to the fresh foreign `tui-cwd` and `exec`'d the absolute freshly installed binary with `--no-webui`.

The bounded wait matched `Choose`, and the rendered 120×40 screen showed the real startup surface:

```text
brunch v1.0.0-alpha.13
built on Pi v0.83.0

Choose a specification
Choose or create the spec/session before the agent loop runs.

› Start a new specification
  Cancel
```

This is an authless pre-agent-loop surface, not an inference from process liveness. No selection or provider turn was made.

Shutdown evidence:

- `tui-driver stop` reported the named session stopped.
- `tui-driver rm` removed its scratch session.
- `tui-driver list` reported `no sessions`.
- A process query for the installed TUI command reported no residue.

## Installed standalone web

Changed directly to the separate fresh foreign `web-cwd`, launched the absolute freshly installed binary with `--mode web`, and captured its stdout. It reported:

```text
Brunch web running at http://127.0.0.1:64309
```

A bounded HTTP GET to that exact loopback URL returned `HTTP/1.1 200 OK`, `content-type: text/html; charset=utf-8`, and `cache-control: no-store`. The served body contained both `<title>Brunch` and `<div id="root"`, proving a real packaged web startup surface rather than process existence alone.

Shutdown evidence:

- Sent `SIGINT`; the installed web process exited.
- A subsequent bounded request to the reported URL failed because the listener was closed.
- A process query for the installed web command reported no residue.

## Cleanup and disposition

The temporary packed artifact, isolated prefix, foreign working directories, captured HTTP files, and PID/output files were removed. The TUI driver's named ignored scratch session was removed. No tracked runtime evidence, provider output, publication state, or finding was created.

Result: the `Installed interactive-mode boot` row is **built**. The fresh installed binary exposes both required real startup surfaces from foreign working directories and both compositions shut down without listener, process, or driver-session residue.
