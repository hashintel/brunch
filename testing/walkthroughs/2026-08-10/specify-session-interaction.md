# Specify session interaction

Date: 2026-08-10  
Commit under test: `ec1cfeff3e4fc57d09df40bccfe45e62d03066fd`  
Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`  
Host: Darwin 25.6.0 arm64  
Node: v24.19.0  
npm: 12.0.2  
Brunch: 1.0.0-alpha.13 on Pi 0.83.0

## Disposition

**Built.** One bounded provider-backed Specify interaction ran through the real source TUI in a fresh disposable workspace. It oriented from an empty greenfield graph, completed assistant-authored asks and user answers, produced two accepted graph-update digests, and read the settled graph back through public RPC. Canonical JSONL mutation receipts, SQLite change-log LSNs, `graph.overview`, TUI summaries, and debug mirrors agree.

This closes only the `Specify session interaction` row. It does not close stdio RPC, cross-surface settlement, companion, or any other overlapping row.

## Entry path and model

Fresh row-owned paths:

```text
workspace: .fixtures/scratch/fe1348-specify-session
driver:    .fixtures/scratch/tui-driver/fe1348-specify-session
session:   019feb6f-e139-7dc1-83e8-d0cdb05c2600
```

The real entry was:

```sh
npm run tui-driver -- start --name fe1348-specify-session --cols 140 --rows 48 -- \
  npm run dev-cli -- --workspace .fixtures/scratch/fe1348-specify-session --no-webui
```

TUI choices were `Start a new specification` → title `Bounded Specify Proof` → `Yes — this is greenfield` → `Work via intent`. The footer identified the resolved supported model as provider `anthropic`, model `claude-opus-5`, thinking `medium`. Ambient supported auth was used only by the product process; no auth file, token, API key, or protected configuration was read into evidence or modified.

## Exact bounded interaction

### Orientation

The assistant inspected the empty greenfield seed and stated:

> “Bounded Specify Proof” is an empty greenfield spec — no nodes, no posture recorded. So we start at the anchor: what problem this thing answers.

It then opened the smallest grounding ask rather than inventing intent.

### Assistant-authored ask and answer

Assistant ask:

> The graph is empty, so nothing constrains me yet. Three things pin down a spec fast: Problem, Subject, and Constraint. Give me whatever you have, in whatever form.

Answer:

> A local CLI should turn one sentence into a saved note. It serves solo developers and must work offline.

The orientation follow-up asked whether existing docs, code, or decisions should be treated as source; the answer was `No.`

The next bounded assistant ask requested storage, fields, read-back, and invocation. Answer:

> 1. One append-only text file. 2. Timestamp and text. 3. List only. 4. note add "text".

The following ask was cancelled rather than widening the authorized interaction.

### Digest/update outcomes

After the first answer, the visible TUI digest was:

> Captured: G1 goal, CTX1 solo developer, CON1 offline.

After the second answer, it was:

> Captured: D1 append-only file, REQ1 add, REQ2 list, INV1 note shape, CON2 no edit/delete.

These were not prose-only claims: each followed a successful graph mutation and each has an exact receipt/LSN comparison below.

## Canonical agreement

| Surface | First accepted effect | Second accepted effect | Agreement |
| --- | --- | --- | --- |
| TUI | `Graph mutated successfully (LSN 2)`; digest names G1/CTX1/CON1 | `Graph mutated successfully (LSN 3)`; digest names D1/REQ1/REQ2/INV1/CON2 | Visible outcome names the nodes persisted at the corresponding LSN. |
| Active Pi JSONL | `brunch.own_mutation {specId:1, lsn:2, source:"mutate_graph"}` | `brunch.own_mutation {specId:1, lsn:3, source:"mutate_graph"}` | One receipt carrier per accepted mutation; no duplicate receipt. |
| SQLite `change_log` | one `mutate_graph` row at LSN 2, nodes 1–3 and edges 1–2 | one `mutate_graph` row at LSN 3, nodes 4–8 and edges 3–8 | Exactly one canonical change-log row per JSONL receipt. |
| Public `graph.overview` | G1, CTX1, CON1 all `createdAtLsn: 2` | D1, REQ1, REQ2, INV1, CON2 all `createdAtLsn: 3` | Eight settled explicit stakeholder nodes and eight settled edges; overview LSN is 3. |
| Debug `tool-contents.md` | success text names LSN 2, G1/CTX1/CON1, edges 1–2 | success text names LSN 3, D1/REQ1/REQ2/INV1/CON2, edges 3–8 | Latest debug mirror repeats the exact accepted tool results and answers. |

`workspace.state` returned spec 1, title `Bounded Specify Proof`, `product` / `greenfield`, and the same session id/file. The final `graph.overview` returned LSN 3, eight nodes, and eight edges. The seed-time `entry-contents.md` correctly remains the provider-entry snapshot at LSN 1; it is not a latest-state store. `session.runtimeState.world.graph.latestLsn` remained `null`, correctly representing the session mention watermark rather than canonical graph head. No mirror was used as mutation authority.

The active JSONL had 26 entries. Relevant ordering was: context seed → assistant orientation/ask → answer result → `brunch.own_mutation` LSN 2 → mutation tool result → digest → second ask/answer → `brunch.own_mutation` LSN 3 → mutation tool result → digest. This preserves receipt-before-visible-settlement ordering.

## Incidental observation

One assistant attempt omitted `acceptsDigest` from a questionnaire ask. The adapter returned `TOOL_INPUT_INVALID` to the model, rendered no persistent human-facing error, and the assistant immediately retried with a valid ask. This matches the already-settled R6 validation/retry contract in `TESTING_FINDINGS.md`; it caused no state mutation or user-visible defect and does not reopen or create a finding. Repeated provider-quality evaluation is outside this row.

## Cleanup and protected state

The final open ask was cancelled, then `Ctrl+D` stopped the TUI normally. Before deletion, `tui-driver list` reported the named session as `stopped`; no writer process remained. After retaining this Markdown record, the row-owned workspace and driver directory were removed, and `tui-driver list` returned `no sessions`.

No tracked fixture/seed, promoted run, source, config, package, or tooling file was changed.

Protected paths after the run:

```text
9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028  .pi/settings.json
a6bf0354bf2443f74b1bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9  src/dev/__tests__/interactive-shell-config.test.ts
08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045  git diff -- .pi/settings.json
```
