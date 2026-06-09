# Seeded local dev RPC workflow

Use this guide when you want a practical local Brunch workspace populated with reusable seed fixtures, while still being able to inspect and mutate that workspace from an agent conversation through JSON-RPC.

This is a **local development harness**:

- reusable seed files under `.fixtures/seeds/**` are explicit starting truth;
- `dev.graph.mutateGraph` is opt-in and routes through `CommandExecutor`, but is not a product API;
- product-flow proof still comes from transcript-backed runs that use the real agent tools (`read_graph` / `mutate_graph`).

## 0. Choose an isolated workspace

Prefer a workbench directory so seeded `.brunch/` state does not mix with whatever is in the repo root.

```bash
REPO="$(git rev-parse --show-toplevel)"
DEV_WORKSPACE="$REPO/.fixtures/workbenches/seeded-dev-rpc"
mkdir -p "$DEV_WORKSPACE"
```

To reset this scratch workspace only:

```bash
rm -rf "$DEV_WORKSPACE/.brunch"
```

Do not run that cleanup command against a workspace whose Brunch sessions or graph data you care about.

## 1. Seed all current fixtures

Run the seed loader from the target workspace. It loads every `.fixtures/seeds/<set>/<slug>.json` through `CommandExecutor` into `$DEV_WORKSPACE/.brunch/data.db`.

```bash
(
  cd "$DEV_WORKSPACE"
  "$REPO/node_modules/.bin/tsx" "$REPO/src/graph/seed-fixtures.ts"
)
```

Current seed sets include:

- `bilal-port/*` — full Bilal-derived specs.
- `bilal-port-variants/macro-view-grounded-intent` — explicit-basis grounded-intent base variant for curation/proposal tests.

The loader currently seeds all sets. Inspect the actual spec ids before issuing graph calls; do not assume a fixed id ordering.

## 2. Define a one-shot dev RPC helper

`--mode=rpc` is a JSON-RPC line server over stdio. For command-line work, it is easiest to send one or more JSON lines and let the process exit at EOF.

```bash
brunch_rpc() {
  local payload="$1"
  (
    cd "$DEV_WORKSPACE"
    printf '%s\n' "$payload" | \
      BRUNCH_DEV=1 "$REPO/node_modules/.bin/tsx" "$REPO/src/app/brunch.ts" --mode=rpc
  )
}
```

`BRUNCH_DEV=1` enables `dev.graph.mutateGraph`. Without that switch, the method is absent from discovery and calls return `Method not found`.

RPC output may include `brunch.updated` notifications as separate JSON lines. Filter responses by `id` when scripting:

```bash
brunch_rpc '{"jsonrpc":"2.0","id":1,"method":"rpc.discover"}' \
  | jq 'select(.id == 1).result.methods[].method'
```

For one-shot command-line work, prefer the dev helper. It sets `BRUNCH_DEV=1`, sends one request, filters notifications, and prints only the response result:

```bash
"$REPO/node_modules/.bin/tsx" "$REPO/src/dev/workspace-rpc.ts" \
  --workspace "$DEV_WORKSPACE" \
  graph.overview '{"specId":4}'
```

## 3. Inspect seeded specs

```bash
brunch_rpc '{"jsonrpc":"2.0","id":2,"method":"workspace.selectionState"}' \
  | jq 'select(.id == 2).result.specs[] | {id: .spec.id, title: .spec.title, sessions: (.sessions | length)}'
```

Pick the `specId` you want to inspect or mutate:

```bash
SPEC_ID=1
```

Read the graph overview:

```bash
brunch_rpc "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"graph.overview\",\"params\":{\"specId\":$SPEC_ID}}" \
  | jq 'select(.id == 3).result | {nodeCount, edgeCount, lsn, goals: [.nodes[] | select(.kind == "goal") | {id, code: ("G" + (.kindOrdinal|tostring)), title}]}'
```

Projected node codes are not stored in the DB. They are rendered from `kind` + `kindOrdinal` using the graph labels (`G1`, `TH1`, `T1`, `CTX1`, `R1`, `CR1`, etc.). Use `graph.overview` to find the current `kindOrdinal` before referencing existing nodes by code.

`lsn` is the selected spec's local graph-clock value. Compare freshness as
`{specId, lsn}`; seeded spec ids and bare LSN values do not imply workspace-wide
ordering.

## 4. Activate a session when session methods matter

Graph reads and `dev.graph.mutateGraph` take explicit `specId` and do not require a selected session. Session methods do.

Create a new session for a seeded spec:

```bash
brunch_rpc "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"workspace.activate\",\"params\":{\"decision\":{\"action\":\"newSession\",\"specId\":$SPEC_ID}}}" \
  | jq 'select(.id == 4).result | {status, spec, session}'
```

Then session calls such as `session.triggerExchange`, `session.pendingExchange`, `session.submitExchangeResponse`, and `session.runtimeState` operate on that selected session unless you pass an explicit session target where supported.

## 5. Make a dev graph mutation

Use `dev.graph.mutateGraph` for exact local curation or seam testing. Default to `createBasis: "explicit"` when you are manually authoring new fixture truth.

The example below adds a thesis and connects it to an existing goal. Replace `G1` with a real code from your `graph.overview` output.

```bash
cat > /tmp/brunch-dev-commit.json <<JSON
{"jsonrpc":"2.0","id":90,"method":"dev.graph.mutateGraph","params":{"specId":$SPEC_ID,"createBasis":"explicit","ops":[{"op":"create_node","ref":"th1","plane":"intent","kind":"thesis","title":"The macro view should make derivation history legible from structure alone.","body":"Manual dev curation thesis for local fixture testing.","source":"manual-dev-rpc"},{"op":"create_edge","category":"support","support":{"existingCode":"G1"},"claim":"th1","stance":"for","rationale":"The existing goal motivates this thesis."}]}}
JSON

(
  cd "$DEV_WORKSPACE"
  BRUNCH_DEV=1 "$REPO/node_modules/.bin/tsx" "$REPO/src/app/brunch.ts" --mode=rpc < /tmp/brunch-dev-commit.json
) | jq 'select(.id == 90)'
```

Read back the mutation:

```bash
brunch_rpc "{\"jsonrpc\":\"2.0\",\"id\":91,\"method\":\"graph.overview\",\"params\":{\"specId\":$SPEC_ID}}" \
  | jq 'select(.id == 91).result.nodes[] | select(.source == "manual-dev-rpc")'
```

Sibling specs should keep their own overview LSN after this commit:

```bash
SIBLING_SPEC_ID=2
brunch_rpc "{\"jsonrpc\":\"2.0\",\"id\":92,\"method\":\"graph.overview\",\"params\":{\"specId\":$SIBLING_SPEC_ID}}" \
  | jq 'select(.id == 92).result | {nodeCount, edgeCount, lsn}'
```

### Capture a curated DB back to a seed fixture

After manual refinement, export the persisted spec graph back into the consolidated seed contract. The exporter defaults to `graph_truth` projection so superseded predecessors that remain in accepted graph history are preserved.

```bash
"$REPO/node_modules/.bin/tsx" "$REPO/src/graph/export-fixtures.ts" \
  --workspace "$DEV_WORKSPACE" \
  --spec-id "$SPEC_ID" \
  --out "$REPO/.fixtures/seeds/<set>/<slug>.json"
```

For inspection without writing:

```bash
"$REPO/node_modules/.bin/tsx" "$REPO/src/graph/export-fixtures.ts" \
  --workspace "$DEV_WORKSPACE" \
  --spec-id "$SPEC_ID" \
  | jq '{spec, nodeCount:(.nodes|length), edgeCount:(.edges|length)}'
```

### Basis rule of thumb

- `explicit` — exact human-authored/manual curation or exact reviewed items.
- `implicit` — agent materialized specific graph items after concept-level acceptance.

Do not use `dev.graph.mutateGraph` with `createBasis: "implicit"` as evidence that the product `propose-graph` flow works. Product proof requires a transcript with a real `mutate_graph` tool result.

## 6. Run the product-path fixture curation tracer

When you need proof that the agent/tool path can expand a seeded fixture, run the curation probe. It loads an explicit base variant and asks the real Brunch runtime to use `read_graph` then `mutate_graph`.

```bash
"$REPO/node_modules/.bin/tsx" "$REPO/src/probes/fixture-curation-loop.ts" \
  --fixture-root "$REPO/.fixtures" \
  --seed-set bilal-port-variants \
  --seed-slug macro-view-grounded-intent
```

A successful run writes:

```text
.fixtures/runs/fixture-curation/<run-id>/
├── session.jsonl
├── transcript.md
├── report.json
└── graph-overview.json
```

The checked-in reference run `.fixtures/runs/fixture-curation/fixture-curation-2026-06-05T104440Z/` is historical pre-migration evidence from the earlier `commit_graph` tool. Fresh runs of `src/probes/fixture-curation-loop.ts` now use `mutate_graph` and should be preferred when you need current product-path proof.

## 7. Browser/TUI notes

The TUI-started web sidecar is read-only. It can observe graph updates from the same host, but it does not expose `dev.graph.mutateGraph`.

For agent-addressable dev mutations, run a separate `BRUNCH_DEV=1 --mode=rpc` command against the same workspace directory. Keep to the one-writer discipline: do not run concurrent dev RPC writes and TUI/agent writes against the same workspace unless you are deliberately testing concurrency behavior.

## Troubleshooting

- `Method not found` for `dev.graph.mutateGraph`: check `BRUNCH_DEV=1` and ensure you are using `--mode=rpc`, not the TUI-started web sidecar.
- `graph node code "G1" does not resolve`: inspect `graph.overview` for the selected `specId`; codes are spec-scoped.
- Empty `workspace.selectionState`: check that you seeded from the same `$DEV_WORKSPACE` directory you are using for RPC.
- Stale or surprising graph state: reset only the scratch workspace with `rm -rf "$DEV_WORKSPACE/.brunch"`, then reseed.
