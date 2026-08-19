# Cross-surface graph/session settlement — owned gate

Date: 2026-08-10  
Commit under test: `0f8abd43e`  
Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`

## Disposition

**Partial; owned gate.** The retained Specify observation proves exact one-effect graph cardinality and canonical graph readback for two accepted `mutate_graph` effects. Current deterministic contract oracles prove the shared review-set settlement and semantic-presentation contracts. The retained record does not contain a fresh JSONL-derived semantic session projection that can be normalized and compared with another fresh product projection for either observed effect. The disposable workspace was already removed, so this row cannot honestly prove normalized-equivalent fresh projections without rerunning a provider turn or manufacturing inaccessible state; both are excluded.

Owner: FE-1348. Re-enter only when an authorized successful product journey retains the canonical JSONL plus two fresh product projections of the same accepted effect (for example, RPC snapshot and reconnect projection) long enough to run the normalization comparison. No RPC, browser, companion, or Specify row is closed by this record.

## Evidence attribution and one-effect cardinalities

Reused exact observations come only from [`specify-session-interaction.md`](specify-session-interaction.md):

| Accepted effect | Receipt carrier in active Pi JSONL | Canonical SQLite `change_log` | Canonical graph readback | Cardinality disposition |
| --- | --- | --- | --- | --- |
| First `mutate_graph` effect | exactly one `brunch.own_mutation`, `{specId: 1, lsn: 2, source: "mutate_graph"}` | exactly one `mutate_graph` row at LSN 2 | G1, CTX1, and CON1 each have `createdAtLsn: 2`; edges 1–2 belong to the effect | 1 receipt / 1 LSN / 1 change-log row; exact node settlement witnessed |
| Second `mutate_graph` effect | exactly one `brunch.own_mutation`, `{specId: 1, lsn: 3, source: "mutate_graph"}` | exactly one `mutate_graph` row at LSN 3 | D1, REQ1, REQ2, INV1, and CON2 each have `createdAtLsn: 3`; edges 3–8 belong to the effect | 1 receipt / 1 LSN / 1 change-log row; exact node settlement witnessed |

The retained `graph.overview` was a public canonical read over SQLite graph truth and reported graph head LSN 3, eight nodes, and eight edges. The TUI digest and `.brunch/debug/tool-contents.md` agreed with those effects, but they are corroborating mirrors only. Neither is mutation or read authority.

## Deterministic current-contract oracle

Command:

```sh
npm test -- src/graph/command-executor/__tests__/accept-review-set.test.ts \
  src/session/__tests__/review-set-settlement.test.ts \
  src/projections/session/__tests__/session-presentation.test.ts
```

Result: 3 test files passed; 20 tests passed; 0 skipped in 790 ms.

Attribution:

- `accept-review-set.test.ts` proves one atomic `accept_review_set` LSN/change-log row and exact translated node/edge settlement at the canonical `CommandExecutor` owner.
- `review-set-settlement.test.ts` proves response settlement calls `acceptReviewSet` exactly once and rejects non-approvals.
- `session-presentation.test.ts` proves validated receipt-bearing terminal details survive the shared semantic projection without loss.

These are current contract oracles, not substitutes for the missing observation-bound projection comparison. They establish how normalization must be judged, but cannot retroactively reconstruct the deleted provider workspace.

## Projection-equivalence oracle and gate

The required comparison is:

```text
normalize(fresh projection A for target spec/session after accepted effect)
  == normalize(fresh projection B for the same target and canonical JSONL head)
```

Normalization may remove only declared ephemeral progress/transport metadata; it must preserve target identity, terminal family/status, accepted receipt `{specId, lsn}`, and settled semantic payload. Both inputs must be freshly derived from the retained canonical JSONL/product read path. A TUI summary, debug Markdown, or copied walkthrough prose cannot occupy either side.

The Specify record retained no serializable fresh session projections and the underlying JSONL/workspace no longer exists. Therefore this oracle is not runnable against the witnessed effects, and the row remains `partial`.

## Authority analysis

- **Mutation authority:** SQLite graph state written through `CommandExecutor`.
- **Session authority:** active-branch Pi JSONL.
- **Authorized read/projection evidence:** public graph/session projections freshly derived from those stores.
- **Non-authoritative corroboration:** TUI summaries and `.brunch/debug/**` mirrors.

No UI/debug mirror was treated as authority, and no unavailable artifact was invented.

## Cleanup and protected state

No provider process was started and no scratch state was created. The earlier Specify row had already stopped its writer and removed its disposable workspace/driver directory. This row added only this retained Markdown record and updated its one ledger row.

Protected paths after verification:

```text
9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028  .pi/settings.json
08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045  git diff -- .pi/settings.json
a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9  src/dev/__tests__/interactive-shell-config.test.ts
```
