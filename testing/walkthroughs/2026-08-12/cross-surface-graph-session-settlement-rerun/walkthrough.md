# Cross-surface graph/session settlement rerun — stopped on SW2

Date: 2026-08-12  
Frontier/owner: FE-1348 `post-hardening-alpha-validation`  
Disposition: failed evidence retained; row remains `partial` and is wait-gated on SW2 repair

## Conduct boundary

One authorized standalone React journey ran against fresh external workspace `/tmp/brunch-fe1348-cross-final.9bBVZ6` at commit `abb0b8bd64d71a9c170f0d1e042faa93e6abc6f9`. Target: spec `1`, session `019ff6ce-1291-7763-99c9-830b4ec122b4`.

The pre-proposal stop gate fired because React exposed duplicate actionable controls for the first canonical ask. The user attempted the first duplicate. React falsely reported `Answer could not be submitted (ask closed)`, while canonical settlement succeeded with the first option, financial settlement. That wrong canonical choice derailed provider conduct. The second stale duplicate remained actionable, and the later fallback ask was duplicated too. No retry, production fix, proposal, review, approval, or graph effect occurred.

No screenshot path was supplied for this run. The user's transcript report is the browser evidence; the canonical session and database artifacts independently establish the resulting conduct and authority state.

## Canonical sequence

`session.jsonl` is the exact 13-entry active-branch Pi JSONL. Its SHA-256 is `6d8144e83ba7e7469b3878a87506585fb8017a5d226122cd3b42b177b7a7c454`. It records exactly:

1. one provider-authored multi-select ask, `fe1348-anchor-1`;
2. one successful result settling that canonical ask as `financial`;
3. one provider-authored questionnaire ask attempt, `fe1348-anchor-2`, rejected as `validation_failed` because `acceptsDigest` was missing; and
4. one fallback free-text ask with the same exchange id, left unresolved.

There is no user-message entry carrying the card's required instruction, no `present_review_set`, no proposal/review terminal, no receipt, and no accepted effect. The false browser `ask closed` report therefore contradicted the successful canonical financial-choice result and caused the provider to follow the wrong branch.

## Authority audit

`graph-after-stop.json` records the supplied public graph overview: `nodes: []`, `edges: []`, LSN 1.

`sqlite-after-stop.json` is a read-only/file-must-exist audit copied from the stopped target. It records graph clock LSN 1, only the initial `create_spec` change-log row, and no nodes or edges. No proposal, review, approval, `accept_review_set`, or `mutate_graph` effect exists.

## Finding and re-entry

This is stronger evidence for existing **SW2**, not a new finding. Duplicate actionable React controls are not merely confusing presentation noise: one can produce a false `ask closed` failure while its canonical answer succeeds, leave a stale rival control behind, and derail provider conduct. The later ask duplication shows the fault persisted beyond the first exchange.

SW2 remains promoted to `shared-session-host-cutover`, which owns live-overlay versus canonical-hydration deduplication. The FE-1348 cross-surface row remains `partial` and is wait-gated on SW2 repair before another authorized journey. Cost/value: repair prevents a visible failure from contradicting canonical settlement and avoids wasting provider/user attempts on conduct driven by an unintended answer.

CS1 remains fixed in code by `8c23ada95`, `fd10e839c`, and `abb0b8bd6`, with focused regressions and `npm run verify`; this stopped journey did not reach `present_review_set`, so the repaired cross-surface behavior is not outer-witnessed.

## Cleanup

Host, listener, and writer-owner cleanup completed on bounded attempt 2. Reconciliation confirmed no writer-lock file or open workspace files, copied and hashed the exact canonical JSONL plus graph/SQLite evidence, then removed only `/tmp/brunch-fe1348-cross-final.9bBVZ6`. See `cleanup.txt` and `SHA256SUMS.txt`.

## Verification

- Exact JSONL: 13 entries; supplied and retained SHA-256 match.
- Public graph overview and read-only SQLite audit: no effect, LSN 1.
- Browser evidence: user transcript report; no screenshot path supplied.
- Repository documentation gate: `npm run check` after reconciliation.
- No production fix, retry, proposal, approval, or settlement oracle was run.
