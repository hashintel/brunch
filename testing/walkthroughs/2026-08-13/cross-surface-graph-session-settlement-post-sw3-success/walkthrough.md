# Cross-surface graph/session settlement — successful post-SW3 witness

Date: 2026-08-13  
Frontier/owner: FE-1348 `post-hardening-alpha-validation`  
Source: `cad69d602542fb774416a33ae2d48b4460e69039`, including SW3 repairs `c180eb55e` and `69d6fd7b`  
Disposition: successful retained witness; cross-surface sweep row `built`; FE-1348 remains active

## Target and conduct

The manually hosted, user-owned standalone React journey used fresh external workspace `/tmp/brunch-fe1348-post-sw3-final.wb4C0B`, spec `1`, session `019ffa35-a778-7ddc-bd73-c0acb6ba72d3`, and URL `http://127.0.0.1:55244/session/1/019ffa35-a778-7ddc-bd73-c0acb6ba72d3`. The host remained available across the user's decision, satisfying WI1's re-entry trigger.

Before approval, React showed exactly one settled `intent` / `requirement` proposal (`REQ1`), zero edges, exactly one each of **Approve**, **Request changes**, and **Reject**, no generic review **Answer**, and no duplicate proposal or narration. The structured proposal did not need an `assistant:` prefix.

The user clicked **Approve** exactly once. React then showed **Decision: Approve**, receipt LSN `2`, created node `REQ1`, zero edges, and no remaining review controls. The user reloaded exactly once. No further product input, second decision, retry, relaunch, or additional reload occurred.

The canonical JSONL contains `Do  │ not` rather than `Do not`. The coordinator presented the fixed instruction as a blockquote, and the user's TUI copy included its quote gutter. This byte-exact conduct leaf is `met-with-divergence`: it is witness-harness contamination, not Brunch behavior or a product finding. The instruction's semantics and the one-item/zero-edge conduct remained exact.

## Canonical convergence

- [`session.jsonl`](session.jsonl) is the exact 16-entry active-branch Pi JSONL. It contains one successful `present_review_set`, one correlated approved `request_review` terminal with receipt LSN `2`, no `mutate_graph` call, and the final assistant confirmation.
- [`session-presentation-a.json`](session-presentation-a.json) and [`session-presentation-b.json`](session-presentation-b.json) are byte-for-byte and JSON equal. Target, cursor `14:0d50dd88`, and entries are identical; each contains one receipt-bearing approved terminal at LSN `2` plus the final assistant message.
- [`graph-overview-a.json`](graph-overview-a.json) and [`graph-overview-b.json`](graph-overview-b.json) are byte-for-byte equal: graph LSN `2`, one settled explicit `intent` / `requirement` node created and updated at LSN `2`, and zero edges.
- [`sqlite-after-stop.json`](sqlite-after-stop.json) was captured after the host stopped through `better-sqlite3` with `{ readonly: true, fileMustExist: true }`. It records graph clock LSN `2`, exactly `create_spec` then one `accept_review_set`, one requirement node, zero edges, no `mutate_graph`, and no second acceptance.
- [`receipt-convergence.json`](receipt-convergence.json) proves the JSONL, both presentations, both graph reads, graph clock, node, and sole SQLite acceptance row identify the same atomic effect.

## Outer evidence

- [`browser-pre-approval.png`](browser-pre-approval.png) shows the single settled one-node/zero-edge proposal and canonical three-choice review set.
- [`browser-settled-before-reload.png`](browser-settled-before-reload.png) shows the one approved decision and receipt before reload.
- [`browser-settled-after-reload.png`](browser-settled-after-reload.png) shows the same settled state after exactly one reload.

## Historical disposition

Prior WI1 evidence remains immutable failure provenance: its delegated host did not survive the approval handoff. This persistent user-owned host satisfied WI1's named re-entry trigger and closed the outer evidence gap without erasing that history.

CS1, SW2, and SW3 remain fixed. This successful path outer-witnesses all three repairs through approval, receipt, one reload, public A/B convergence, graph readback, and stopped-host SQLite authority. It does not complete `shared-session-host-cutover`.

`Execute mode interaction` remains `partial` and is the sole open required product row. FE-1348 remains active and is not frontier-complete.

## Cleanup

The listener on port `55244` and target writer owner were absent before cleanup. All retained artifacts were copied and their hashes verified before only `/tmp/brunch-fe1348-post-sw3-final.wb4C0B` and `/tmp/brunch-fe1348-post-sw3-final-evidence.wb4C0B` were removed. See [`cleanup.txt`](cleanup.txt) and [`SHA256SUMS.txt`](SHA256SUMS.txt).

## Acceptance

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Pre-approval single settled proposal and canonical controls | met | `browser-pre-approval.png`; `session.jsonl`; one settled REQ1, zero edges, one three-choice set, no generic review Answer or duplicate |
| One fixed instruction and exactly one approval | met-with-divergence | `conduct.json`; one approval and no retry; byte-exact `Do  │ not` is blockquote-gutter harness contamination with unchanged semantics |
| One receipt-bearing approved canonical terminal | met | `session.jsonl`; terminal `c39fe3eb`, decision `approve`, receipt LSN 2, REQ1, zero edges |
| Presentation A before reload | met | `session-presentation-a.json`; ready, terminal receipt and final assistant message |
| Settled browser before reload | met | `browser-settled-before-reload.png`; Decision: Approve, LSN 2, REQ1, no controls |
| Exactly one reload and no later input | met | `conduct.json`; reloads 1, post-approval/reload input 0 |
| Presentation B and A/B equality | met | `session-presentation-b.json`; `presentation-comparison.json`; byte comparison |
| Settled browser after reload | met | `browser-settled-after-reload.png`; same settled receipt state |
| Public graph A/B | met | both graph overviews: one settled explicit requirement at LSN 2, zero edges |
| Stopped-host SQLite authority | met | `sqlite-after-stop.json`; read-only/file-must-exist; exactly create_spec then accept_review_set |
| Receipt convergence | met | `receipt-convergence.json`; JSONL/A/B/graph/SQLite identify one effect |
| Cleanup and hashes | met | `cleanup.txt`; `SHA256SUMS.txt` |
| FE-1348 reconciliation | met | cross-surface row built; Execute partial; FE-1348 active |

Skipped-test-count delta versus parent: `0` (no tests changed or run; evidence/docs-only).
