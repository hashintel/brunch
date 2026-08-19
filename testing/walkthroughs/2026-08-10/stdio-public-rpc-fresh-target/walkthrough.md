# Stdio public RPC fresh-target witness

Date: 2026-08-12

Source commit: `5097ac86440f6c270eadc5c6cdd9d741425a855e`

Target: spec `1`, session `019ff59d-45d0-761f-9bca-e7fb655cfdd5`, disposable workspace `/tmp/brunch-fe1348-stdio-fresh.FsFSuK`

## Result

**Parked at the first phase-2 product-boundary failure; the sweep row remains `partial`.** The immutable handoff independently passed its identity, file/hash, 9-entry count, stopped PID/listener, and absent-writer-owner gates. Public `rpc.discover` advertised every allowed method and its schemas. Public `workspace.activate` reopened the exact original-workspace target as `ready`, and `workspace.state` plus `session.runtimeState` agreed on cwd/spec/session.

The single allowed `session.triggerExchange` invocation then returned:

```json
{"status":"idle","exchange":null}
```

The canonical JSONL remained byte-identical at SHA-256 `b2066a55f75c9cc74c15c960d31797005e39281d6ee09050aebaa65ff6c113e3` and still ended in the unresolved provider-authored free-text ask `fe1348-anchor-1`. Because trigger did not project that same pending exchange, conduct stopped immediately. No `session.pendingExchange`, `session.exchanges`, or `session.submitExchangeResponse` call followed the failed gate; the submit invocation count is zero. No retry, repair, clone, direct state edit, private handler, raw Pi RPC, WebSocket RPC, graph effect, or second provider turn occurred.

Owner: FE-1348 `Stdio public RPC` row. Re-entry trigger: the transcript-backed stdio trigger/projection path must be accepted and repaired for a stopped same-workspace provider-authored ask, then a newly authorized fresh target may run once. Cost/value: repair would make the public compatibility projection usable across standalone-to-stdio composition; another unmodified attempt would only repeat the proved idle contradiction.

## Evidence

- [`handoff.json`](handoff.json) — coordinator/user phase packet.
- [`commands/`](commands/) — exact secret-free argv, stdout, stderr, and exit status for each one-shot call. Product-call order is discovery, activation, workspace state, runtime state, and one trigger.
- [`hashes/`](hashes/) — the canonical hash stayed equal to the handoff hash after every call and matches the retained copy.
- [`assertions/`](assertions/) — machine-readable conduct report plus pre-cleanup authority and cleanup checks.
- [`session.jsonl`](session.jsonl) — exact canonical 9-entry JSONL copied before workspace disposal.

## Cleanup

PID `12791` and listener `50834` were stopped, and no writer `owner.json` existed before phase 2 or cleanup. After evidence copy, only the coordinator-created disposable workspace `/tmp/brunch-fe1348-stdio-fresh.FsFSuK` was removed. The retained JSONL hash matches the packet hash.
