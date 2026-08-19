# Cross-surface graph/session settlement — failed authorized journey

Date: 2026-08-12  
Frontier/owner: FE-1348 `post-hardening-alpha-validation`  
Disposition: parked; the sweep row remains `partial`

## Conduct boundary

One authorized standalone React journey ran against a fresh external workspace at commit `b688df57d6a6025afc31ea58f890e26dcfcfb508`. The user supplied the card's exact one-requirement instruction once. They made no approval and supplied no second answer. Production code and durable target state were not repaired or mutated outside normal product conduct, and the journey was not rerun.

Target: spec `1`, session `019ff69b-b3a5-7558-8c09-8ab5381d1525`. `session.jsonl` is the exact 13-entry canonical file; its SHA-256 is `34a2aefbd1281678e88179d154510e9d57b403964708c1437060730c7275581a`.

## Canonical sequence

The retained JSONL records exactly:

1. one provider-authored ask, `fe1348-anchor-1`;
2. one user answer containing the authorized instruction;
3. one provider-authored `present_review_set`, `fe1348-req-1`, containing exactly one settled `intent` / `requirement` entity draft and `edgeDrafts: []`;
4. its tool result, `status: structural_illegal`, diagnostic `edgeDrafts must be non-empty`; and
5. a provider-authored plain standalone approval ask, `fe1348-req-approve-1`, left unanswered.

The provider's fallback approval ask was not a rendered review-set approval and could not settle through the required shared review-set operation. The stop-before-approval rule therefore fired.

## Browser evidence

`browser-duplicate-ask.png` shows React rendering the canonical first ask twice across live/hydrated presentation. This is additional evidence for existing SW2 only; canonical JSONL still contains one ask and one answer.

`browser-projection-failure.png` shows the consequential `Session transcript cannot be displayed` state after the illegal review-set result and fallback ask. It is retained under the finding below rather than opened as a second finding: this one bounded journey does not independently diagnose a second capability/sub-seam, and the sweep's closed-inventory rule requires stopping at the first new product contradiction.

No pre-approval review-set screenshot, approval submit, receipt-bearing state, reconnect comparison, or RPC frame ledger exists because the journey stopped before approval as required.

## Authority audit

`graph-after-stop.json` is a post-stop public `graph.overview` read: `nodes: []`, `edges: []`, `lsn: 1`.

`sqlite-after-stop.json` was produced with `better-sqlite3` opened as `{ readonly: true, fileMustExist: true }`. It records graph clock LSN 1, only the initial `create_spec` change-log row, and no nodes or edges. Thus the failed proposal and unanswered fallback ask caused no graph effect.

## Finding and re-entry

**CS1 — legal one-node/zero-edge review set rejected by structural validation.** The product contract and authorized minimum batch require one settled requirement with no edges, but `present_review_set` rejects `edgeDrafts: []` as structurally illegal. The projection failure is consequential evidence attached to CS1, not a separately diagnosed finding. Existing SW2 remains owned by `shared-session-host-cutover` unchanged.

Disposition: **promoted to FE-1348**, which owns this still-open row. Re-enter only after an explicitly scoped production repair reconciles review-set structural validation with a legal one-node/zero-edge batch (and guards the projection consequence), followed by new user authorization for one fresh journey. Cost/value: the defect blocks the smallest honest review-set approval and all cross-surface settlement evidence; fixing it restores a core graph-authoring path, while rerunning first would spend provider/user time against a deterministic rejection.

## Cleanup

Host, listener, and writer-owner cleanup completed on bounded attempt 2 without manual repair. Hashes were retained and verified before removing the exact external workspace. See `cleanup.txt` and `SHA256SUMS.txt`.

## Verification

- Exact JSONL: 13 entries; expected SHA-256 matched.
- Post-stop public graph read and read-only SQLite audit: no effect, LSN 1.
- Repository documentation gate: `npm run check` (run after reconciliation; result reported in the commit/build report).
- Focused production tests and approval/reconnect oracles were not rerun: the card forbids production repair/rerun, and no approval or settlement occurred.
