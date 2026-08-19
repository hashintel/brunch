# Seeded workbench and fixture validation

Date: 2026-08-10
Commit under test: `b37b5d2a36480e683850462f42f511e5ca81e645`
Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`
Host: macOS arm64; Node `v24.19.0`; npm `12.0.2`; tsx `4.23.0`
Seed: `workspace-alpha-grounding/base`
Disposable workspace: `/tmp/brunch-fe1348-seed.<random>` (removed after capture)

## Result

**Built.** The compact current seed passed the graph fixture validator, the real seed CLI reset and loaded it into an explicit fresh workspace outside the repository, and supported public dev RPC reads agreed on the selected workspace, newly activated session, and canonical graph. All generated database, workspace, and session state remained disposable runtime state; none was retained as tracked evidence.

This closes only the `Seeded workbench and fixture validation` row. It does not exercise the TUI, a provider, or production behavior changes.

## Commands and observations

The normal `npx tsx` wrapper could not create its IPC pipe in the execution sandbox (`listen EPERM`). The same checked-in validator entry point was therefore run through tsx's Node loader, without changing validator or fixture behavior:

```sh
node --import tsx src/graph/validate-fixture.ts workspace-alpha-grounding/base
```

It reported the fixture structurally legal, with authored, stored, and active-context cardinalities all equal to **5 nodes / 3 edges**.

A fresh external directory was allocated with `mktemp -d /tmp/brunch-fe1348-seed.XXXXXX`. The supported seed CLI was then invoked explicitly with both workspace and reset arguments:

```sh
npm run seed -- \
  --workspace /tmp/brunch-fe1348-seed.<random> \
  --seed workspace-alpha-grounding/base \
  --reset
```

The CLI reported `workspace-alpha-grounding/base → spec 1 (5 nodes, 3 edges)` and named the external `.brunch/brunch-v1.db` destination. No default workbench path was passed or inferred.

Supported development RPC paths were discovered and read with:

```sh
npm run dev-cli -- rpc rpc.discover --workspace "$W"
npm run dev-cli -- rpc workspace.state --workspace "$W"
npm run dev-cli -- rpc workspace.activate \
  '{"decision":{"action":"newSession","specId":1}}' --workspace "$W"
npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace "$W"
npm run dev-cli -- rpc session.runtimeState \
  '{"specId":1,"sessionId":"<activated-session-id>"}' --workspace "$W"
```

- Before activation, `workspace.state` returned `select_spec`, proving the seed did not manufacture session state.
- Explicit `newSession` activation selected spec 1, title `Alpha Grounding`, kind `product`, and created one workspace-local JSONL session.
- The next `workspace.state` returned the same spec and session identity.
- `graph.overview` returned LSN 2 and exactly the seed's 5 settled explicit nodes and 3 settled explicit edges. Titles, categories, endpoints, and the `Selected spec` definition agreed with the tracked JSON fixture.
- `session.runtimeState` returned `ready` for the activated identity in `specify` / `elicitor` posture. Its empty mentions and `world.graph.latestLsn: null` are session mention-watermark state, not a competing graph head; canonical graph authority remained the `graph.overview` read at LSN 2.

## Runtime-state and safety proof

The disposable workspace contained only:

```text
.brunch/brunch-v1.db
.brunch/workspace.json
.brunch/sessions/<activated-session>.jsonl
```

It was outside the repository, so none of those files could enter the repository index or serve as promoted run evidence. The only retained evidence is this reviewed Markdown observation; no database or JSONL was copied into `.fixtures/runs/`.

The protected pre-existing default workbench database was not opened, reset, modified, or used. Its SHA-256 was identical before and after the row:

```text
36484da7d7fc7d87c0dc8066b752c541aba5e5382fc58b0264d677d4dff47c16
```

`git status --short --ignored` continued to classify its `.brunch/` directory as ignored (`!!`), while normal `git status --short` remained empty before evidence authoring. This corroborates the documented authority split: tracked seed JSON is reusable fixture input; workspace `.brunch/` is local runtime state, not tracked evidence.

After capture, the exact external workspace and row-owned temporary output files were removed. The protected default workbench remained byte-identical.
