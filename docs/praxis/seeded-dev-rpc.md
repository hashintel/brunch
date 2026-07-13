# Seeded Local Dev Workflow

Use this guide when you want a practical local Brunch workspace populated with reusable seed fixtures, while still being able to inspect and curate that workspace from scripts or another coding agent.

This is a local harness:

- reusable seed files under `.fixtures/seeds/**` are explicit starting truth
- the public RPC surface stays public; local curation is a separate explicit command
- product-path proof still comes from JSONL-backed runs that use the real agent tools (`read_graph` / `mutate_graph`)

## 0. Choose an isolated workbench

Prefer a workbench directory so seeded `.brunch/` state does not mix with the repo root.

```bash
REPO="$(git rev-parse --show-toplevel)"
DEV_WORKSPACE="$REPO/.fixtures/workbenches/bilal-macro-view"
```

## 1. Seed explicit starting truth

```bash
npm run seed -- --workspace "$DEV_WORKSPACE" --seed bilal-macro-view/grounded-intent --reset
```

`--reset` only clears Brunch runtime state in that workbench: `data.db`, WAL/SHM siblings, `sessions/`, `debug/`, and `workspace.json`.

## 2. Launch Brunch against that workbench

The friendly path is the dev launcher:

```bash
npm run dev-cli -- --workspace "$DEV_WORKSPACE"
```

Or just run `npm run dev-cli` and answer the prompt flow.

Notes:

- TUI is the default mode.
- Source/dev builds automatically mirror debug artifacts into `$DEV_WORKSPACE/.brunch/debug/`.
- Prompt-affecting dev surfaces stay explicit; add `--dev-tools` only when you want query tools or subagent affordances.

## 3. Inspect the workspace over public RPC

The launcher exposes one-shot RPC reads without a separate helper script:

```bash
npm run dev-cli -- rpc workspace.selectionState --workspace "$DEV_WORKSPACE"
npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace "$DEV_WORKSPACE"
```

Projected node codes are rendered from `kind + kindOrdinal` (`G1`, `TH1`, `CTX1`, `CR1`, ...). Use `graph.overview` to discover the current code before addressing existing nodes by code in a curation payload.

## 4. Curate graph truth through the explicit local seam

`npm run dev-cli -- mutate ...` is the replacement for the old gated `dev.graph.mutateGraph` RPC path. It still routes through `CommandExecutor.mutateGraph`; it is just no longer disguised as a public RPC method.

Example payload:

```bash
cat > /tmp/brunch-mutate.json <<'JSON'
{
  "specId": 1,
  "createBasis": "explicit",
  "ops": [
    {
      "op": "create_node",
      "ref": "th1",
      "plane": "intent",
      "kind": "thesis",
      "title": "The macro view should make derivation history legible from structure alone.",
      "body": "Manual fixture curation thesis for local testing.",
      "source": "manual-dev-cli"
    },
    {
      "op": "create_edge",
      "category": "rationale",
      "support": { "existingCode": "G1" },
      "claim": "th1",
      "stance": "for",
      "rationale": "The existing goal motivates this thesis."
    }
  ]
}
JSON

npm run dev-cli -- mutate --workspace "$DEV_WORKSPACE" --params-file /tmp/brunch-mutate.json
```

You can also pipe JSON on stdin:

```bash
cat /tmp/brunch-mutate.json | npm run dev-cli -- mutate --workspace "$DEV_WORKSPACE"
```

Read back the result:

```bash
npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace "$DEV_WORKSPACE"
```

Basis rule of thumb:

- `explicit` — exact human-authored or manually curated truth
- `implicit` — agent-materialized specifics after concept-level acceptance

Do not use local `mutate` commands as proof that the product `mutate_graph` tool path works. Product proof requires a transcript-backed run with a real tool result.

## 5. Export curated truth back to a seed fixture

```bash
npm run dev-cli -- export --workspace "$DEV_WORKSPACE" --spec-id 1 --out "$REPO/.fixtures/seeds/<name>/<variant>.json"
```

For inspection without writing:

```bash
npm run dev-cli -- export --workspace "$DEV_WORKSPACE" --spec-id 1 | jq '{spec, nodeCount:(.nodes|length), edgeCount:(.edges|length)}'
```

## 6. Run the product-path fixture curation tracer

When you need proof that the agent/tool path can expand a seeded fixture, run the curation probe. It loads an explicit base variant and asks the real Brunch runtime to use `read_graph` then `mutate_graph`.

```bash
"$REPO/node_modules/.bin/tsx" "$REPO/src/probes/fixture-curation-loop.ts" \
  --fixture-root "$REPO/.fixtures" \
  --seed-name bilal-macro-view \
  --seed-variant grounded-intent
```

## 7. Browser and sidecar notes

The TUI-started web sidecar is read-only. It observes graph updates from the same host, but it does not expose write methods.

If another coding agent needs to inspect or curate the same workbench, have it call the explicit launcher subcommands against that directory rather than talking to the sidecar directly.

## Troubleshooting

- `graph node code "G1" does not resolve`: inspect `graph.overview` for the selected `specId`; codes are spec-scoped.
- Empty `workspace.selectionState`: check that you seeded and read from the same workbench directory.
- Stale or surprising graph state: re-run `npm run seed -- --workspace "$DEV_WORKSPACE" --seed <name>/<variant> --reset`.
