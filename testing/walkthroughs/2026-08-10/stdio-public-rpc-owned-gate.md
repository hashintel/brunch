# Stdio public RPC — owned gate

Date: 2026-08-10  
Commit tested: `a95269f696a4e0e331a4ed81b9ec64e7fcc4665a`  
Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`  
Workspace: `.fixtures/scratch/fe-1348-stdio-public-rpc` (fresh, ignored, removed after capture)

## Disposition

**Owned gate; row remains `partial`.** The real stdio entry proves discovery, workspace/spec/session activation, transcript-backed reads, and schema/result agreement. It cannot complete a structured exchange without an assistant-authored present tuple. `session.triggerExchange` explicitly advertises that the product mints no deterministic exchange and returned `{"status":"idle","exchange":null}`. A provider turn is excluded by this row, and fixture-minting/test-only wiring would violate the public-entry requirement.

Owner: FE-1348 `Stdio public RPC` row. Re-entry trigger: an explicitly authorized provider-backed assistant present on a disposable workspace, or a deterministic **supported product** RPC path that authors a pending exchange. Cost/value: one bounded follow-up can close public response submission and JSONL/projection convergence; manufacturing private transcript state now would produce misleading evidence.

## Exact public commands and results

All calls used `npm run dev-cli -- rpc`; no raw Pi RPC was used.

```sh
W=.fixtures/scratch/fe-1348-stdio-public-rpc
mkdir -p "$W"
npm run dev-cli -- rpc rpc.discover --workspace "$W"
npm run dev-cli -- rpc workspace.activate '{"decision":{"action":"newSpec","title":"FE-1348 stdio RPC scratch"}}' --workspace "$W"
npm run dev-cli -- rpc workspace.state --workspace "$W"
npm run dev-cli -- rpc session.triggerExchange --workspace "$W"
npm run dev-cli -- rpc session.runtimeState '{"specId":1,"sessionId":"019feb59-4703-716c-9010-44a8e118eca6"}' --workspace "$W"
npm run dev-cli -- rpc session.exchanges '{"specId":1,"sessionId":"019feb59-4703-716c-9010-44a8e118eca6"}' --workspace "$W"
npm run dev-cli -- rpc session.pendingExchange '{"specId":1,"sessionId":"019feb59-4703-716c-9010-44a8e118eca6"}' --workspace "$W"
```

Key results:

```json
{"status":"ready","spec":{"id":1,"title":"FE-1348 stdio RPC scratch","kind":"product"},"session":{"id":"019feb59-4703-716c-9010-44a8e118eca6"}}
{"status":"idle","exchange":null}
{"status":"ready","specId":1,"sessionId":"019feb59-4703-716c-9010-44a8e118eca6","agent":{"operationalMode":"specify","role":"elicitor"},"mentions":{"graphNodes":[],"files":[]},"world":{"graph":{"latestLsn":null},"git":{"head":null}}}
{"status":"empty","exchanges":[],"openPrompt":null}
{"status":"idle","exchange":null}
```

## Discovery/schema and canonical comparison

`rpc.discover` advertised:

- `workspace.activate` with strict `newSpec` input (`action`, nonblank `title`) and a `ready` result requiring `spec`, `session`, and `chrome`;
- `session.runtimeState` requiring `specId` and `sessionId`, with `ready`/Specify/elicitor result constraints;
- `session.pendingExchange` with terminal `pending` and `idle` result alternatives;
- `session.submitExchangeResponse` with strict text, option, option-list, and review answer alternatives and an `accepted` result;
- `session.triggerExchange` described as a kick that does **not** mint a deterministic exchange.

The accepted activation result and all read results conform to those discovered schemas. The canonical JSONL contained exactly four entries: session header, `brunch.session_binding` for spec 1, matching session name, and the context seed appended by `session.triggerExchange`. It contained no structured present/request tuple. Accordingly, both public projections agreed: `session.exchanges` was empty and `session.pendingExchange` was idle. This is agreement, but not completion of the row's required structured exchange.

## Cleanup proof

After capture:

```sh
rm -rf .fixtures/scratch/fe-1348-stdio-public-rpc
find .fixtures/scratch -maxdepth 1 -name 'fe-1348-stdio-public-rpc' -print
# no output
```

No fixture, seed, ignored seeded-workbench DB, or promoted run artifact was touched.
