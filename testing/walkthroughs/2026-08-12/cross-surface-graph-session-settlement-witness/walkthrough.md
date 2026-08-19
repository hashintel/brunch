# Cross-surface graph/session settlement — stopped before approval

Date: 2026-08-12  
Frontier/owner: FE-1348 `post-hardening-alpha-validation`  
Disposition: consumed evidence retained; row remains `partial`

## Conduct boundary

One authorized standalone React journey ran at pinned HEAD `21cf48c502645ba31c4cf6f706421a6382861572` on branch `ln/fe-1348-audit-all-usage-and-testing-paths`, using external workspace `/tmp/brunch-fe1348-settlement-final.L0wZG7`. Target: spec `1`, session `019ff710-ca4c-7014-baf6-395121277794`, URL `http://127.0.0.1:58673/session/1/019ff710-ca4c-7014-baf6-395121277794`.

The user submitted the card's exact instruction once. They did not approve and did not submit a second answer. The pre-approval gate fired because React did not render the canonical settled review and its continuation choices with their intended semantics. The journey was not retried or relaunched.

## Canonical session evidence

`session.jsonl` is the exact 13-entry active-branch Pi JSONL copied from `/tmp/brunch-fe1348-settlement-final.L0wZG7/.brunch/sessions/2026-08-12T17-41-40-556Z_019ff710-ca4c-7014-baf6-395121277794.jsonl`; SHA-256: `7bc260c371f8f3a13a3933cda743c4f7bea42f947330628661fe08302961a482`.

It records one initial free-text ask, its successful answer, one successful `present_review_set` (`fe1348-rs-1`) containing exactly one settled `intent` / `requirement` entity draft and `edgeDrafts: []`, then one unresolved continuation ask carrying `continues: fe1348-rs-1`. The canonical continuation provides `approve`, `request_changes`, and `reject`. There is no approval result, accepted review terminal, receipt, or second answer.

## Browser evidence and classification

`browser-pre-approval.png` is the supplied user-visible observation. The initial answer control appeared once and exactly one proposal appeared. This is **not recurrence of SW2**: there was no duplicate actionable initial ask or duplicate proposal.

The remaining contradiction is semantic legibility at the React projection boundary: the canonical review set is settled, but React does not visibly label its settlement; the canonical approval choices do not render as choices and instead collapse to a generic `Answer`/message input; and the offer title/narrative plus continuation confirmation render as two confirmation-like text blocks. The user therefore could not identify or activate the intended one-of-three settlement continuation with confidence and stopped under the card gate.

This is one contradiction inside the already-enumerated cross-surface row, not an inventory expansion. It is promoted to the existing `shared-session-host-cutover` owner, whose semantic React projection obligation already requires one actionable representation and JSONL-equivalent meaning. Re-entry requires repair of settled review-set/continuation semantic rendering, then fresh explicit authorization for a new one-shot witness. Cost/value: the repair makes user-only approval legible and actionable; without it, approving through a generic input risks ambiguous settlement authority.

## Graph authority audit

`sqlite-after-stop.json` was produced after host shutdown with `better-sqlite3` opened `{ readonly: true, fileMustExist: true }`. It independently records graph clock LSN `1`, only the baseline `create_spec` change-log row, and zero nodes and edges.

No retained public `graph.overview` response exists after shutdown, so this walkthrough does not claim one. No graph effect, receipt, public session-presentation A/B projection, or reload evidence exists because the pre-approval gate fired.

## Cleanup

Host PID `57049` was stopped, listener `58673` was absent, and `.brunch/writer-locks` contained no owner before removal. After the exact JSONL, screenshot, environment/target ledger, and read-only SQLite audit were copied and hashed, only `/tmp/brunch-fe1348-settlement-final.L0wZG7` was removed. `cleanup.txt` proves the external workspace and listener remain absent. `SHA256SUMS.txt` covers every retained non-walkthrough evidence file.

## Verification

- Exact JSONL: 13 entries; retained SHA-256 matches the source hash.
- Read-only/file-must-exist SQLite audit: no graph effect, zero nodes/edges, LSN 1, only `create_spec`.
- Cleanup: stopped host reported; no listener or writer owner; exact external workspace absent.
- Repository read-only gate: reported in the build/commit report after reconciliation.
- No production code, tests, fixtures, public post-stop graph read, approval, settlement, projection A/B, or reload was manufactured.
