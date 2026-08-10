# Stdio public RPC — owned gate

Date: 2026-08-10

Prior evidence commit: `89e063444`

Retry base commit: `1aa97e6e3421d412acb37dae13c288a0f7f28783`

Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`

Workspace: `.fixtures/scratch/fe-1348-stdio-public-rpc` (fresh, ignored, removed after capture)

## Disposition

**Owned product-level gate; row remains `partial`.** Provider use was authorized for this bounded retry, but the launched Brunch runtime had no provider/model available to fire the assistant-first turn. `session.triggerExchange` returned `{"status":"idle","exchange":null}`. Canonical JSONL contains the context seed but no `brunch.kick`, assistant message, or structured present tuple; therefore `session.exchanges` is empty and `session.pendingExchange` is idle. There is no public pending exchange ID to answer, so calling `session.submitExchangeResponse` would be invalid rather than a typed response proof.

This preserves the prior truthful result: discovery, activation, reads, and empty canonical/projection agreement work through the public stdio RPC. The new retry removes authorization as the gate and localizes the remaining gate to provider/model availability inside the launched Brunch runtime.

Owner: FE-1348 `Stdio public RPC` row. Re-entry trigger: run the same bounded public path when the launched Brunch runtime has a provider/model available to `session.triggerExchange`, or when a deterministic supported product path can author a pending exchange. Cost/value: one real assistant-first turn plus one typed answer closes the row; private transcript minting would invalidate the evidence.

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
