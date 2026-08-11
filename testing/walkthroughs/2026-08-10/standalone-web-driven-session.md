# Standalone-web driven session — owned gate

Date: 2026-08-10; rerun 2026-08-11

Commit under test: `2bb1fbd0b76183051a2dc4421a45b195dc0e2736`

Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`

Workbench: `.fixtures/workbenches/standalone-web-driven-session` (fresh, row-owned, ignored, retained)

Environment: Node `v24.19.0`, npm `12.0.2`, Pi `0.84.1`, agent-browser `0.33.2`, Darwin `25.6.0 arm64`.

## Disposition

**Owned product defect; row remains `partial`.** The 2026-08-11 rerun cleared the earlier browser/provider gates and completed a real standalone-web structured exchange, but a normal browser reload twice rendered `Session transcript cannot be displayed.` The terminated host also left its writer owner file behind after its process and listener were gone. The row cannot close until reload and bounded shutdown cleanup succeed without manual state repair.

Owner: FE-1348 `Standalone-web driven session` row. Re-entry trigger: fix the reload/cleanup defect in a separate row-sized scope, then rerun this same bounded browser journey. Cost/value: reload is a basic supported-session expectation and the stale owner blocks honest reacquisition; both are required before this path can carry product confidence.

## 2026-08-11 real-browser rerun

Commit under test: `2b217b865`.

Environment: Brunch `v1.0.0-alpha.13`, Anthropic `claude-opus-5`, agent-browser with the required `--no-sandbox,--ignore-certificate-errors` launch arguments, Darwin `25.6.0 arm64`.

The existing row-owned workbench started through the source standalone entry point at `http://127.0.0.1:50343`. Agent-browser reached the target-addressed route and observed the production React session UI over the production WebSocket transport:

```text
http://127.0.0.1:50343/session/1/019fec48-522f-7524-9272-f21395a84004
```

The production provider authored an opening free-text `ask`. The browser answered it, and canonical JSONL recorded the assistant tool call, exactly one successful tool result containing the browser answer, and the provider's follow-up digest/ask sequence. `session.runtimeState` returned `ready` in Specify mode and `graph.overview` agreed that no graph effect had yet been accepted (`lsn: 1`, empty nodes/edges).

The initial ordinary-message probe raced the already-open ask and failed honestly with `Turn failed. Please retry.` After the answer settled, the old form reported `ask closed`; canonical JSONL shows the answer had succeeded and the provider had advanced to the next prompt.

### Reload defect

A normal browser reload, followed by network-idle settlement, rendered only:

```text
Session transcript cannot be displayed.
```

A second reload after a three-second disconnect interval produced the same result. The document and static assets all returned HTTP 200; no browser console or page error was emitted. The failure therefore occurred in session attachment/presentation rather than document serving.

### Cleanup defect

Agent-browser closed normally. Terminating the row-owned standalone host stopped the listener, and `kill -0` confirmed the writer-owner PID no longer existed, but the writer owner file remained:

```text
.brunch/writer-locks/1-MDE5ZmVjNDgtNTIyZi03NTI0LTkyNzItZjIxMzk1YTg0MDA0.lock/owner.json
```

The file was retained unchanged as evidence; no manual cleanup, JSONL edit, database write, or product-state repair was used to manufacture success.

### Rerun leaf disposition

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Source/route observation | met | Real agent-browser reached the production target-addressed route. |
| Production WebSocket lifecycle trace | met-with-divergence | Initial open and live updates worked; reload attachment failed. |
| Ask and settlement observation | met | Provider-authored ask answered through React; canonical JSONL contains one successful result and follow-up. |
| Canonical active-branch comparison | met | JSONL, `session.runtimeState`, and `graph.overview` agreed with the observed settled state. |
| Reload convergence | dropped | Two normal reloads rendered `Session transcript cannot be displayed.` |
| Close/cleanup proof | dropped | Listener and process ended, but the writer owner file remained. |
| No implementation or manufactured success | met | No production/config/fixture content or canonical state was edited. |

Skipped-test-count delta versus parent: `0` (no test or test policy changed).

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
