# Cross-composition writer transfer

Date: 2026-08-10
Frontier: FE-1348 `post-hardening-alpha-validation`
Row: `Cross-composition writer transfer`
Disposition: `built`

## Boundary and method

A fresh run of the existing FE-1321 production authority oracle exercised exactly this row. The Vitest parent drove a real PTY through the production `runBrunchTui` launch seam, started the production standalone host and WebSocket RPC composition, and projected the canonical Pi JSONL through `session.presentation`. It supplied only bounded content-addressed faux-provider replies for the ordinary turns; it did not replace the TUI launcher, inject a second runtime, use a browser, mutate production/config/fixtures, or run additional campaign behavior.

Environment: commit `340b3499f`, branch `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`, Node `v24.19.0`, npm `12.0.2`, Pi `0.84.1`, Vitest `4.1.10`, Darwin `25.6.0 arm64`.

## Fresh production witness

```text
npx vitest --run --maxWorkers=1 \
  src/app/__tests__/session-runtime-contract-authority.slow.test.ts

Test Files  1 passed (1)
Tests      12 passed (12)
Duration   11.53s (tests 10.08s)
```

The ordinary `npm test -- <slow-test>` entrance was first confirmed to exclude `*.slow.test.ts` by policy; the direct Vitest invocation above is the fresh row oracle and ran all 12 authority leaves unskipped.

## Authority and transfer evidence

| Beat | Fresh oracle evidence |
| --- | --- |
| TUI baseline | The production PTY child owns the one coordinator-created `(specId, sessionId)` target and its sole JSONL. Its `owner.json` PID is numeric and differs from the Vitest/standalone parent PID. Before contention, the workspace reports one session and one available target. |
| Rival refusal identity | The standalone host itself starts and answers `workspace.state = ready`, but WebSocket `session.open` for the TUI-owned target fails with JSON-RPC code `-32020` and message matching `already has a writer`. |
| Refusal is mutation-free | Session count, available-target count, and canonical file identity remain `1`, `1`, and identical. JSONL byte length is unchanged, and `owner.json` is byte-identical before/after the probe. The incumbent TUI then completes `Carry on after the refused second window.` → `Carried on with the sole writable runtime.`, ruling out a damaged incumbent. |
| Normal shutdown release | Ctrl-D ends the PTY within the bounded wait; liveness is false and the target writer-lock path is absent. |
| Standalone reacquire | A production standalone web composition opens the released target with `{status:"opened"}` (not attached), and its new `owner.json` PID equals the standalone parent PID. It reports the same sole session and exact canonical file. |
| Continuity | The four TUI-era user/assistant messages are a pinned prefix of standalone `session.presentation`. `session.driveTurn` appends `Continue this target from standalone web.` → `Standalone web continued the transferred target.` to that same JSONL; the post-turn JSONL starts byte-for-byte with the pre-transfer JSONL and session count stays one. |
| Projection agreement | At settlement, production `session.presentation` messages and entry count exactly equal a fresh parent-side `projectSessionPresentationFile` projection of that same JSONL. |
| Final release | Closing the standalone host removes the target writer lock again. |

## Cleanup proof

The oracle's `finally` closes the WebSocket client and standalone host, unregisters its bounded provider, stops/removes the row-owned TUI-driver session, and recursively removes both fresh system-temporary workspace and Pi profile. Post-run checks found `npm run tui-driver -- list` reporting `no sessions`, no `brunch-runtime-contract-*` or `brunch-authority-agent-*` temporary roots, and no writer lock. Two pre-existing ignored `companion-pty-*` driver directories remained untouched as protected scratch residue.

## Leaf disposition

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Real TUI owns the target before contention | met | Production PTY child owner PID differs from rival parent; one target/file. |
| Rival standalone open is refused with exact identity | met | WebSocket RPC `session.open`: `-32020`, `already has a writer`. |
| Refusal causes no mutation or authority theft | met | Same counts/file, stable JSONL byte length, byte-identical owner record, incumbent turn succeeds. |
| Normal TUI shutdown releases authority | met | Ctrl-D exits; lock absent. |
| Standalone reopens and continues the same JSONL | met | `opened`, same file/session, TUI prefix retained, driven turn textually appended. |
| Owner/lock and projection evidence agree | met | Standalone PID owns reacquired lock; RPC projection equals fresh file projection; close releases lock. |
| Row-owned resources are removed | met | No live driver session, row temp roots, host, provider, or writer lock remains. |

Skipped-test-count delta versus parent: `0`.
