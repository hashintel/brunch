# Standalone-web driven session — owned gate

Date: 2026-08-10

Commit under test: `2bb1fbd0b76183051a2dc4421a45b195dc0e2736`

Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`

Workbench: `.fixtures/workbenches/standalone-web-driven-session` (fresh, row-owned, ignored, retained)

Environment: Node `v24.19.0`, npm `12.0.2`, Pi `0.84.1`, agent-browser `0.33.2`, Darwin `25.6.0 arm64`.

## Disposition

**Owned outer-evidence gate; row remains `partial`.** The source standalone host launched successfully, but the required real-browser observer could not start. Both a named and default agent-browser launch failed before navigation with `Auto-launch failed: CDP response channel closed`; fresh namespaces failed with `Daemon process exited during startup with no error output`, including a `--debug` retry. Because no browser reached the direct route, no production WebSocket lifecycle or browser claim was made. Provider/model/assistant-authored-ask availability was not tested after this earlier honest stop.

Owner: FE-1348 `Standalone-web driven session` row. Re-entry trigger: rerun the bounded journey when agent-browser can launch/connect to Chrome in the execution host; the same run must then also have a production provider/model capable of authoring one supported structured ask. Cost/value: one browser journey can close route, RPC, ask, projection, reload, and cleanup evidence; substituting curl, a test browser, or manufactured transcript state would invalidate D142-L.

## Supported target setup

A fresh target was created only through the bounded public Brunch RPC prerequisite:

```sh
npm run dev-cli -- rpc workspace.activate \
  '{"decision":{"action":"newSpec","title":"FE-1348 standalone web driven session"}}' \
  --workspace .fixtures/workbenches/standalone-web-driven-session
```

The result named durable target `(specId=1, sessionId=019fec48-522f-7524-9272-f21395a84004)` and canonical file:

```text
.brunch/sessions/2026-08-10T15-26-30-447Z_019fec48-522f-7524-9272-f21395a84004.jsonl
```

No JSONL, SQLite row, provider output, or open-ask state was authored directly.

## Source launch and browser gate

Exact source launch:

```sh
npm run dev-cli -- \
  --workspace .fixtures/workbenches/standalone-web-driven-session \
  --mode web
```

The CLI reported `Brunch web running at http://127.0.0.1:63889`. A transport-only curl check returned HTTP `200` and 378 bytes from `/`; this proves listener startup, not browser presentation.

The intended direct route was:

```text
http://127.0.0.1:63889/session/1/019fec48-522f-7524-9272-f21395a84004
```

The required observer attempts stopped before navigation:

```text
agent-browser --session fe1348-standalone open <direct-route>
✗ Auto-launch failed: CDP response channel closed

agent-browser open <direct-route>
✗ Auto-launch failed: CDP response channel closed

agent-browser --debug --namespace fe1348b open <direct-route>
✗ Daemon process exited during startup with no error output. Re-run with --debug for more details.
```

No PTY, `/rpc/driver`, raw `brunch.sessionEvent`, raw Pi RPC, private handler, or targetless fallback was substituted.

## Canonical state at stop

The canonical JSONL remained a three-entry product-created skeleton:

```text
session
custom brunch.session_binding
session_info
```

It contains no user or assistant message, structured ask, or fabricated settlement. No `owner.json` existed because the browser never issued `session.open`. Accordingly, `session.driveTurn`, `session.openAsks`, `session.answerExchange`, `session.presentation`, and `session.close` were not claimed.

## Cleanup and retained evidence

The row-owned host PID exited after `SIGTERM`; a bounded curl probe reported the loopback listener closed. No row-named agent-browser process remained, and no writer-owner file existed. The ignored workbench `.brunch/` remains locally retained as required; it was neither promoted nor deleted.

No production, config, fixture, PLAN, SPEC, or findings-ledger path changed.

## Leaf disposition

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Source/route observation | dropped | Source command and URL observed; real-browser route observation blocked by agent-browser daemon/CDP startup. |
| Production WebSocket lifecycle trace | dropped | Browser never navigated, so no lifecycle method was claimed. |
| Ask and settlement observation | dropped | Browser gate occurred before provider/model/ask availability could be tested. |
| Canonical active-branch comparison | dropped | Canonical three-entry JSONL retained; no browser or settled RPC projection existed to compare. |
| Reload convergence | dropped | No initial browser attachment existed to reload. |
| Close/cleanup proof | met-with-divergence | No route-level `session.close` occurred; host process/listener exited, writer owner remained absent, and no row-owned browser process remained. |
| No implementation or manufactured success | met | Tracked diff is limited to the scoped ledger and this walkthrough; canonical runtime state was not edited. |

Observed `npm run verify`: 337 test files passed, 1 skipped; 2761 tests passed, 2 skipped.

Skipped-test-count delta versus parent: `0` (no tests were added, skipped, or parked by this row).
