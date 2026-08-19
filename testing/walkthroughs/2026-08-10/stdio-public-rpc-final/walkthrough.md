# Final stdio public RPC witness

Date: 2026-08-12

Source commit: `3cddae4ebe971d271da82950850ec4cfd840355e`

Verdict: **pass; `Stdio public RPC` built.**

## Identity and authority

The immutable handoff SHA-256 is `330ff422dbcb8922c00c93aee2d00daaf069221740c3ede9d4cfe91991da1c92`. It named workspace `/tmp/brunch-fe1348-stdio-final.SmRMCO`, spec `1`, session `019ff5de-130f-7abe-b651-0db9e0932963`, and the exact session file retained here as [`session.jsonl`](session.jsonl). Before conduct, that file had 9 entries and SHA-256 `29116a67a9fe061719646ec4091be77b8bc00cda39a3161bf9d9a48ed0639e92`. PID `22785` was stopped, port `57724` had no listener, and no `owner.json` existed.

The active branch ended in exactly one unresolved Anthropic `claude-opus-5` free-text ask: exchange `fe1348-anchor-1`, provider tool call `toolu_01KPTx4A71oSce6R1RDVM7D2`. It had no correlated terminal.

## One-shot conduct

Every product call was one fresh invocation of `npm run dev-cli -- rpc <method> [params-json] --workspace /tmp/brunch-fe1348-stdio-final.SmRMCO`. [`evidence.json`](evidence.json) retains the ordered params, results, statuses, hashes, relevant discovery schemas, and invocation counts.

1. `rpc.discover` advertised the five required methods and sufficient schemas.
2. `workspace.activate` opened the exact handed-off file and returned `ready` without changing its hash.
3. The sole `session.triggerExchange` returned the handed-off exchange as `pending`; the hash remained unchanged.
4. Pre-submit `session.pendingExchange` returned that same question and text mode; `session.exchanges` reported its sole current open prompt and no completed exchange. The hash remained unchanged.
5. The sole `session.submitExchangeResponse` used one schema-valid text answer and returned `accepted` for `fe1348-anchor-1`.
6. Post-submit `session.pendingExchange` returned `idle`; `session.exchanges` returned `ready`, one prompt/response correlation, and no open prompt.

The final file has 10 entries and SHA-256 `e1571d794560ab0cbbe946f9f3884ea3e0d4b974bf0595c069b617d7afa2abc6`. Its one-entry delta is an `ask` tool result carrying the original provider tool-call id, exchange id, submitted text, and valid terminal details. No synthetic assistant call or second terminal was appended.

Conduct counts: one fresh target, one provider turn, one trigger, one submit; zero retries, repairs, clones, private/raw/WebSocket calls, direct state edits, graph calls/effects, duplicate submits, or second provider turns.

## Incidental presentation finding

The user observed the question unanswered and supplied a screenshot in which React visually rendered the same question twice. Canonical audit proves exactly one provider ask, and the public stdio projections also recovered exactly one ask. The duplicate is therefore promoted separately to `shared-session-host-cutover`'s standalone/web presentation seam; it does not block or weaken this stdio conduct verdict and was not fixed inline.

## Cleanup and claim limit

After retained hashes agreed, no one-shot process, port `57724` listener, or writer owner remained. Only the coordinator-created disposable workspace was removed; retained evidence is the handoff, combined evidence record, exact final JSONL, and this walkthrough.

This witness proves only the repaired same-workspace free-text public stdio lifecycle. It makes no graph-settlement, browser/TUI correctness, cross-surface parity, provider-quality, Execute, or FE-1348-frontier-completion claim.
