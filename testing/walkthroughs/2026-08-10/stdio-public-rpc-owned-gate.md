# Stdio public RPC — owned gate

Date: 2026-08-10

Prior evidence commit: `89e063444`

Retry base commit: `1aa97e6e3421d412acb37dae13c288a0f7f28783`

Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`

Workspace: `.fixtures/scratch/fe-1348-stdio-public-rpc` (fresh, ignored, removed after capture)

## Final disposition

**Fixed and superseded as the active gate.** Repairs `f6053d605`, `f741f94df`, `bd77c277f`, and `3cddae4eb` were followed by one successful fresh same-workspace public witness. Exact activation, trigger, pending, exchanges, one direct submit, post-submit projections, append-only JSONL delta, and cleanup are retained in [`stdio-public-rpc-final/`](stdio-public-rpc-final/). The sweep now marks only `Stdio public RPC` built; Execute and cross-surface settlement remain partial. The user-observed duplicate React question is separately promoted as SW2 under `shared-session-host-cutover` and does not revise this historical conduct.

## Historical disposition

**Owned product-level gate; row remained `partial`.** A 2026-08-12 bounded re-entry used the retained standalone provider-authored pending ask only through a byte-for-byte disposable clone. The first true public-boundary failure was `workspace.activate`: it returned `status: needs_human` and `Selected session is not available for the selected spec.` The copied canonical JSONL retained its original-workspace cwd and was not rewritten. No response was submitted and no repair was attempted.

The command harness returned exit status `0` for that typed activation outcome, so the scripted capture continued through the read-only `workspace.state`, `session.runtimeState`, `session.triggerExchange`, `session.pendingExchange`, and `session.exchanges` calls before semantic inspection. Those outputs sharpen the contradiction but do not override the stop boundary: `workspace.state` found the named target, while trigger/pending returned idle and exchanges returned `open_prompt` with no projected exchange even though canonical active-branch JSONL ends in the provider-authored `fe1348-anchor-2` ask. The clone JSONL stayed byte-identical through those reads. There was no `session.submitExchangeResponse` call.

Owner: FE-1348 `Stdio public RPC` row. Re-entry trigger: only after clone activation/projection portability is separately accepted and repaired, or a fresh supported pending target supersedes this retained input. Cost/value: fixing or avoiding the cwd-bound clone contradiction would permit the same one-response public proof; rewriting retained/copy state would invalidate the evidence.

The earlier provider/model attempt remains valid historical narrowing: its launched Brunch runtime had no provider/model available, so `session.triggerExchange` returned `{"status":"idle","exchange":null}` and no typed response was legal.

A later fresh same-workspace attempt superseded clone portability as the active gate without rewriting this history. Public activation reopened the exact original target as ready, but the one allowed `session.triggerExchange` returned idle while canonical JSONL remained byte-identical and ended in unresolved provider-authored free-text ask `fe1348-anchor-1`. Conduct stopped before pending/exchanges/submit, with no retry or repair. Evidence: [`stdio-public-rpc-fresh-target/walkthrough.md`](stdio-public-rpc-fresh-target/walkthrough.md).

## 2026-08-12 retained-exchange re-entry

Source workspace: `/tmp/brunch-fe1348-final2.QTlmdv` (protected, retained)

Disposable clone: `/tmp/brunch-fe1348-stdio-reentry.hTx07h` (removed after serializable capture)

Source session SHA-256 before and after:

```text
ca2a176b3c63a32cd934daebf10c92840047dcf2dbffb3483bafb81d1f13114e
```

No source writer-owner file existed before or after conduct. Process enumeration was unavailable in the sandbox, so no stronger process claim is made. Discovery advertised `rpc.discover` and `session.triggerExchange` with omitted params; conduct used the actual no-params invocation. The coordinator's earlier read-only `{}` discovery preflight is excluded from row conduct and from success/failure accounting.

Exact serializable outputs, exit statuses, source manifests, assertions, and cleanup proof are retained under [`stdio-public-rpc-reentry/`](stdio-public-rpc-reentry/). The active-branch comparison records:

- the 13-entry canonical JSONL ends in the real Anthropic-authored `fe1348-anchor-2` multi-select ask with no terminal result;
- the source and clone JSONL hashes matched before conduct and remained unchanged after all read-only calls;
- normalized trigger and pending wrappers agreed only as idle/null, while exchanges reported one `open_prompt` range and no exchange tuple;
- no submit, provider launch, graph effect, private handler, direct state edit, raw Pi/WebSocket call, or retry occurred; and
- only the disposable clone was removed.

## Runtime identity

The invoking Pi harness reported, without credentials:

```text
PI_PROVIDER=openai-codex
PI_MODEL=gpt-5.6-sol
PI_REASONING_LEVEL=low
```

These identify the invoking harness only. The protected project `.pi/settings.json` declares no default provider/model fields, and the child Brunch runtime produced no model-authored transcript entry. No auth variables or secrets were recorded.

## Exact public commands

Every product call used `npm run dev-cli -- rpc`; no raw Pi RPC, test-only transcript mutation, or repeat campaign was used.

```sh
W=.fixtures/scratch/fe-1348-stdio-public-rpc
mkdir -p "$W"
npm run dev-cli -- rpc rpc.discover --workspace "$W"
npm run dev-cli -- rpc workspace.activate '{"decision":{"action":"newSpec","title":"FE-1348 authorized stdio RPC"}}' --workspace "$W"
npm run dev-cli -- rpc session.triggerExchange --workspace "$W"
npm run dev-cli -- rpc workspace.state --workspace "$W"
npm run dev-cli -- rpc session.runtimeState '{"specId":1,"sessionId":"019feb7b-41a5-7c9c-93cd-5b79995a2347"}' --workspace "$W"
npm run dev-cli -- rpc session.exchanges '{"specId":1,"sessionId":"019feb7b-41a5-7c9c-93cd-5b79995a2347"}' --workspace "$W"
npm run dev-cli -- rpc session.pendingExchange '{"specId":1,"sessionId":"019feb7b-41a5-7c9c-93cd-5b79995a2347"}' --workspace "$W"
```

Exact serializable outputs are retained under [`stdio-public-rpc/`](stdio-public-rpc/). `discovered-methods.json` retains the relevant discovered parameter/result schemas.

## Present, response, and result

```json
{"status":"idle","exchange":null}
```

- Assistant-authored present: **none**.
- Typed response: **not submitted**; no public pending exchange existed.
- Submit result: **not applicable**.

Discovery still describes `session.triggerExchange` as a kick that does not mint a deterministic exchange, and `session.submitExchangeResponse` as requiring an `exchangeId` plus a typed answer. The idle trigger result conforms to the discovered schema.

## Canonical JSONL and projection agreement

Retained [`session.jsonl`](stdio-public-rpc/session.jsonl) has exactly four entries:

1. session header;
2. `brunch.session_binding` for spec `1`;
3. matching session name; and
4. `brunch.context_seed`.

It has no kick, assistant message, or structured present tuple. Fresh public projections agree exactly with that canonical state:

```json
{"status":"empty","exchanges":[],"openPrompt":null}
{"status":"idle","exchange":null}
```

`session.runtimeState` is ready in Specify/elicitor mode. This proves canonical/projection agreement for the failed-to-fire assistant-first attempt, but not the required structured exchange. The retained JSONL and projection outputs may support later diagnosis; they do **not** close the separate cross-surface settlement row.

## Cleanup

```sh
rm -rf .fixtures/scratch/fe-1348-stdio-public-rpc
test ! -e .fixtures/scratch/fe-1348-stdio-public-rpc
```

The scratch workspace was removed. No fixture, seed, ignored seeded-workbench state, or promoted run artifact was touched.
