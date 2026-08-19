# Cross-surface graph/session settlement — pre-approval gate passed, host lifetime diverged

Date: 2026-08-12  
Frontier/owner: FE-1348 `post-hardening-alpha-validation`  
Disposition: consumed one-shot evidence retained; row remains `partial`

## Conduct boundary

One authorized standalone React journey ran at pinned HEAD `19c8151a6961670d8ba1371125fdde969bb83ee4` on branch `ln/fe-1348-audit-all-usage-and-testing-paths`. It used fresh external workspace `/tmp/brunch-fe1348-post-sw3-final.jYIzva`, spec `1`, session `019ff748-8a4b-73cb-b260-ec45ba3b061c`, and exact target URL `http://127.0.0.1:65333/session/1/019ff748-8a4b-73cb-b260-ec45ba3b061c`.

The workspace/spec/session were created through public `workspace.activate`; exactly one source `--mode web` host was launched; and the exact fixed instruction was submitted once through the target-addressed React route after exactly one suitable initial ask appeared. No other instruction, correction, review answer, reload, relaunch, or retry occurred.

## Pre-approval gate

The pre-approval product gate passed:

- `session.jsonl` is the exact 13-entry active-branch Pi JSONL, SHA-256 `5cd1b668b3f302c040ee7dbd05af797f350165323c5bc18e8eecbf3cb20c955f`.
- The instruction appears in one successful initial-ask terminal. Its bytes occur twice in the JSONL because that one terminal preserves the answer in both model-facing `content` and structured `details`; this is one submission, not two.
- Exactly one successful `present_review_set`, `fe1348-single-req-1`, contains one settled `intent` / `requirement` draft (`REQ1`) and `edges: []`.
- Exactly one unresolved continuation carries `Approve`, `Request changes`, and `Reject`. There is no review terminal, approval, mutation tool call, or graph effect.
- `session.presentation` was `ready` and preserved the answered initial ask, one review offer, its one-node/zero-edge payload, its canonical continuation, and one non-duplicated assistant continuation line.
- The live browser AX capture showed visible `Settlement: settled`, exactly one actionable control for each canonical review choice, no review `Answer` control, no duplicate proposal, and only the ordinary unused `Message` composer.
- Public `graph.overview` remained empty at LSN `1`.

`browser-pre-approval.ax.txt` is the exact pre-approval accessibility capture. A pre-approval screenshot was created in temporary evidence staging but was no longer present when terminal reconciliation began. After the host exit was confirmed, `browser-render-retained-after-host-exit.*` captured the same still-rendered in-memory DOM without navigation, reload, or product input. It corroborates the rendered semantics but does not claim the server was still live.

## One-shot infrastructure divergence

The delegated host command started at `2026-08-12T18:43:09.914Z`, advertised port `65333`, and ended at `2026-08-12T18:45:21.892Z`. The executor had returned the pre-approval handoff while treating the host as live, but the user and coordinator independently found no listener. The user therefore could not perform the one authorized **Approve** action.

This is witness-infrastructure lifetime failure **WI1**, not recurrence of SW2 or failure of SW3's repaired pre-approval semantics. The journey stopped permanently: no relaunch, retry, approval, alternate decision, reload, or product repair was attempted.

Unperformed leaves are explicitly absent:

- approval and receipt-bearing review terminal;
- post-approval `session.presentation` A;
- settled-before-reload browser evidence;
- the one authorized reload;
- `session.presentation` B and A/B comparison;
- settled-after-reload browser evidence;
- accepted graph effect and receipt convergence.

## Canonical authority audit

`sqlite-after-stop.json` was produced after host exit with `better-sqlite3` opened `{ readonly: true, fileMustExist: true }`. It records graph clock LSN `1`, zero nodes, zero edges, and only the baseline `create_spec` change-log row. There is no `accept_review_set`, `mutate_graph`, receipt, or other graph mutation.

The public pre-approval `graph.overview` independently agrees: zero nodes, zero edges, LSN `1`.

## Cleanup

The owned browser session was closed. Host PID `46823`, listener child PID `46910`, listener `65333`, writer owner, and open target files were absent before deletion. Exact evidence was retained before only `/tmp/brunch-fe1348-post-sw3-final.jYIzva` and `/tmp/brunch-fe1348-post-sw3-evidence.NLIFvD` were removed. See `cleanup.txt`.

## Re-entry

The cross-surface settlement row remains `partial` under FE-1348. Re-enter only with:

1. an execution/handoff context that demonstrably keeps its sole owned host and browser alive while the user performs the approval;
2. a fresh external workspace and target; and
3. fresh explicit authorization for one new one-shot journey.

Execute mode interaction remains independently `partial`; FE-1348 remains active.

## Verification

- Exact JSONL and SHA-256 retained.
- Canonical pre-approval audit, public presentation, public graph baseline, browser AX, and rendered-DOM evidence retained.
- Read-only/file-must-exist SQLite audit proves zero graph mutation.
- Host terminal lifecycle and bounded cleanup evidence retained.
- Repository documentation gate reported in the build/commit handoff.
- No production code, test code, fixtures, dependencies, approval, graph effect, receipt, reload, or missing settlement evidence was manufactured.

## Card leaf completion

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Pre-approval AX + screenshot semantics | met-with-divergence | `browser-pre-approval.ax.txt` proves the live gate; the temporary pre-approval screenshot was absent at reconciliation, while `browser-render-retained-after-host-exit.*` corroborates the same in-memory DOM without claiming server liveness |
| Conduct: one instruction and one approval | met-with-divergence | `conduct.json`: one instruction, zero approvals because WI1 made the authorized control unavailable |
| Canonical JSONL + SHA ledger | met-with-divergence | `session.jsonl`, `canonical-pre-approval-audit.json`, `SHA256SUMS.txt`: one open review continuation; no approved terminal or receipt |
| Presentation A before reload | dropped | absent because approval did not occur |
| Settled browser before reload | dropped | absent because approval did not occur |
| Exactly one reload | dropped | zero reloads under the one-shot stop rule |
| Presentation B + A/B comparison | dropped | absent because approval/reload did not occur |
| Settled browser after reload | dropped | absent because approval/reload did not occur |
| Public graph overview after settlement | met-with-divergence | `graph-baseline-pre-approval.json`: zero nodes/edges at LSN 1; no settlement occurred |
| Stopped-host SQLite audit | met-with-divergence | `sqlite-after-stop.json`: only `create_spec`, zero nodes/edges, no acceptance effect |
| Receipt convergence | dropped | no receipt or accepted effect exists |
| Cleanup + hashes | met | `cleanup.txt`, `SHA256SUMS.txt` |
| Repository check | met-with-divergence | lint passed with six known warnings; authorized files passed format; konsistent, links, skills, and promoted paths passed; aggregate `npm run check` stopped on two unrelated pre-existing stdio evidence formatting issues |
| FE-1348 reconciliation | met | sweep row remains `partial`; Execute remains `partial`; FE-1348 remains active; WI1 has an owner and re-entry trigger |

Skipped-test-count delta versus parent: `0` (no tests were changed or run; this was evidence/docs-only).
