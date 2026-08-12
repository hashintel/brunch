# Final cross-surface settlement witness

Frontier: post-hardening-alpha-validation
Status:   active
Mode:     single
Created:  2026-08-12

## Orientation

- The containing seam is D27-L/I15-L review-set acceptance projected through D133-L/I65-L's JSONL-derived standalone React session surface; graph truth remains SQLite and session truth remains the active-branch Pi JSONL.
- FE-1348 `post-hardening-alpha-validation` is the containing proving coverage frontier. This card is the one-shot evidence fill for its still-`partial` `Cross-surface graph/session settlement` row after independently approved and verified repairs `c180eb55e` and `69d6fd7b`.
- No `HANDOFF.md` exists. The consumed prior witness is the volatile boundary: it proved one canonical one-node/zero-edge settled proposal without SW2 duplication, then stopped before approval on SW3's collapsed React settlement/continuation semantics.
- Main risk: spending the final authorization on a plausible-looking UI while canonical session, graph, receipt, reload, or cleanup truth diverges. Every gate below is fail-closed; the journey has no retry or repair path.

Posture: proving (inherited from `post-hardening-alpha-validation`).

Weight: full — this evidence-only slice crosses a real provider, standalone host, React/browser interaction, public RPC projections, canonical JSONL, and read-only SQLite authority.

## Target Behavior

One authorized standalone React approval journey closes the FE-1348 cross-surface settlement row with convergent canonical evidence.

## Full-card cold-start reads

A fresh executor must read these exact sources before starting the witness:

- `AGENTS.md` — protected-state, high-stakes boundary, verification, and no-untracked-deletion rules.
- `memory/POSTURE.md` — prototype/high-stakes posture.
- `memory/SPEC.md` — requirements 10–12, 17, 21, 23, and 32; D4-L, D20-L, D27-L, D104-L, D108-L, D116-L, D125-L, D132-L, D133-L, and D141-L; I10-L, I15-L, I20-L, I52-L, I64-L, and I65-L.
- `memory/PLAN.md` — frontier `post-hardening-alpha-validation`, its aggregate DoD, and the explicitly still-open Execute row.
- `memory/cards/post-hardening-alpha-validation--usage-and-verification-sweep.md` — `Cross-surface graph/session settlement` and `Execute mode interaction` rows only.
- `TESTING_FINDINGS.md` — CS1, SW2, and SW3 only.
- `docs/praxis/manual-testing.md` — browser-first observation, canonical evidence, findings discipline, and cleanup.
- `testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-witness/walkthrough.md` and its `session.jsonl`, screenshot, target, and SQLite audit — consumed pre-approval witness, exact instruction, and missing-proof boundary.
- `testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-rerun/walkthrough.md` and `testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-final/walkthrough.md` — immutable SW2/CS1 failure provenance and stop discipline.
- `src/web/TOPOLOGY.md`, `src/projections/TOPOLOGY.md`, and `src/rpc/TOPOLOGY.md` — thin React client, shared presentation, public hosted-session methods, and canonical-store boundaries.
- `src/web/routes/session.tsx` and `src/web/__tests__/session-route.test.tsx` — repaired settled-review rendering, one-decision submission guard, receipt rendering, and reload reconciliation.
- `src/projections/session/session-presentation.ts` and `src/projections/session/__tests__/session-presentation.test.ts` — canonical offer/terminal/receipt projection and no-loss oracle.
- `src/session/review-set-settlement.ts`, `src/session/__tests__/review-set-settlement.test.ts`, and `src/probes/__tests__/review-set-settlement-convergence.test.ts` — one shared atomic acceptance effect and receipt convergence.
- `src/graph/command-executor/__tests__/accept-review-set.test.ts` — legal one-settled-node/zero-edge acceptance and exact `accept_review_set` audit shape.

## Boundary Crossings

```text
fresh system-temporary external workspace
→ public workspace/spec/session activation
→ source standalone `--mode web` host
→ target-addressed production React route
→ one real provider-authored ask
→ exact fixed instruction submitted once
→ one visibly settled one-node/zero-edge review interaction
→ one authorized Approve decision
→ shared review-set settlement operation
→ one atomic CommandExecutor `accept_review_set` effect
→ canonical Pi JSONL + public session.presentation A
→ exactly one browser reload
→ public session.presentation B + graph.overview
→ stopped-host read-only SQLite audit
→ retained hashed evidence + bounded cleanup
```

## Fixed conduct

Use a newly created system-temporary directory outside the checkout, `.fixtures/`, and every retained prior target. Record the absolute path before any product command. Create the disposable spec/session only through public Brunch activation, launch the source standalone product with:

```sh
npm run dev-cli -- --workspace "$FRESH_EXTERNAL_WORKSPACE" --mode web
```

Use the direct target-addressed `/session/<specId>/<sessionId>` React route through `agent-browser`; use the same host's public WebSocket JSON-RPC only for named reads. Do not use the TUI, `/rpc/driver`, raw Pi RPC/events, a private handler, direct JSONL authoring, direct SQLite writes, fixture seeding, or a second writable runtime.

Submit this exact instruction once, byte-for-byte apart from transport newline normalization:

> This disposable specification has one requirement: a local command must save one plain-text note while offline. Show only that requirement as one settled graph proposal for my review. Do not commit it before I approve the exact graph draft, do not add an edge or another graph item, and do not propose or commit anything else in this journey.

No other instruction, clarification, corrective answer, ambient message, or review response is permitted. The user's authorization attached to this card permits exactly one **Approve** activation after the pre-approval gate passes; the executor must never activate **Request changes**, **Reject**, or **Approve** a second time.

## One-shot stop rule

This card has one journey and no recovery branch. At the first divergence:

1. stop user/product input immediately;
2. do not reload, retry, relaunch, correct provider conduct, click a rival control, repair state, edit production code, or manufacture a missing artifact;
3. retain only the evidence that exists, explicitly mark every unperformed later leaf as absent, and reconcile the row/finding without claiming closure; and
4. perform bounded cleanup of only this card's browser, host, and fresh external workspace.

A divergence includes: wrong/freshness-ambiguous target; duplicate actionable initial ask; the exact instruction not settling once; more than one proposal or graph item; any edge; advisory/hidden settlement; missing, duplicate, or differently labeled review choices; a generic **Answer** control for the review; duplicated proposal/continuation narration; a visible submit failure; more than one decision request; any graph effect before approval; more than one accepted effect; receipt/projection/graph/SQLite disagreement; reload divergence; or incomplete writer/listener/workspace cleanup. The ordinary always-available **Message** composer is not the forbidden generic review **Answer** control, but it must remain unused.

## Risks and Assumptions

- RISK: provider conduct adds a clarification, edge, or second item → MITIGATION: the exact instruction is submitted once and the run stops at the first non-conforming proposal; no corrective turn is allowed.
- RISK: React looks repaired while a duplicate or generic control remains semantically actionable → MITIGATION: gate approval on an `agent-browser` accessibility snapshot plus screenshot proving one proposal, visible `settled`, and exactly one canonical three-choice set with no review **Answer** control or duplicate narration.
- RISK: a second observer accidentally becomes a writer or changes attachment state → MITIGATION: all retained reads use named public methods on the already-running standalone host and exact durable target; no second host/runtime is started.
- RISK: local confirmation masks a failed or duplicated commit → MITIGATION: require exact agreement among JSONL terminal receipt, both public presentation reads, public graph overview, and read-only SQLite graph clock/change log/items.
- ASSUMPTION: the repaired route can carry one production provider review from open choice through durable reload without another semantic contradiction.
  → IMPACT IF FALSE: the FE-1348 row remains `partial`; the retained divergence must receive a fixed/promoted/retired disposition, and this authorization is consumed.
  → VALIDATE: this journey itself is the cheapest and final authorized proof.

## Posture check

- Proof of life: the previously stopped standalone React path crosses the real approval boundary and survives one reload.
- Invariant: one user decision produces exactly one I15-L `accept_review_set` transaction, LSN, change-log row, terminal receipt, node, and no edge.
- Uncertainty retired: whether SW3's repaired React semantics remain legible/actionable and converge with canonical stores in a fresh production-shaped journey.

## Acceptance Criteria

- ✓ `browser-pre-approval.ax.txt` + `browser-pre-approval.png` — React shows exactly one settled proposal containing exactly one `intent/requirement` draft and zero edges; `settled` is visible; exactly one each of **Approve**, **Request changes**, and **Reject** is actionable; no generic review **Answer** control, duplicate actionable ask/proposal, or duplicate proposal/continuation narration is present.
- ✓ `conduct.json` + canonical `session.jsonl` audit — one fresh external target receives the fixed instruction exactly once and exactly one review decision, `approve`, is activated once; no retry, second answer, correction, other decision, or pre-approval graph effect occurs.
- ✓ `session.jsonl` + SHA-256 ledger — the exact active-branch canonical file contains one successful `present_review_set` for the one settled requirement/zero-edge payload and one correlated answered `request_review` terminal carrying decision `approve` plus the graph receipt; no second accepted review terminal or model-authored mutation path completes the proposal.
- ✓ public `session-presentation-a.json` — after canonical settlement and before reload, `session.presentation` is `ready`, contains the one review offer plus one correlated approved terminal/receipt, exposes no open review choices, and agrees with the settled React receipt view.
- ✓ `browser-settled-before-reload.ax.txt` + `browser-settled-before-reload.png` — after the one approval, React visibly reports **Decision: Approve** and the graph commit receipt, with no acceptance controls remaining.
- ✓ reload ledger in `conduct.json` — exactly one normal browser reload occurs after presentation A and before presentation B; no navigation, second reload, host restart, or user/product input occurs between A and B.
- ✓ public `session-presentation-b.json` + `presentation-comparison.json` — after that one reload, presentation B is `ready` and its semantic result is exactly equal to A; the reloaded React view retains the approved decision/receipt and no review controls or overlay residue.
- ✓ `browser-settled-after-reload.ax.txt` + `browser-settled-after-reload.png` — the once-reloaded product UI visibly agrees with presentation B and the pre-reload settled view.
- ✓ public `graph-overview.json` — the explicit spec is at exactly one LSN beyond its creation baseline and contains exactly one settled requirement node matching the approved draft/code, zero edges, and no additional graph item.
- ✓ stopped-host `sqlite-after-stop.json` — `better-sqlite3` opened with `{ readonly: true, fileMustExist: true }` reports exactly one `accept_review_set` change-log effect for the spec, exactly one resulting settled/explicit requirement node, zero edges, and no `mutate_graph` or second acceptance effect.
- ✓ `receipt-convergence.json` — JSONL terminal receipt, presentation A receipt, presentation B receipt, graph overview LSN/node code, graph clock, and the sole `accept_review_set` row identify the same one atomic effect.
- ✓ `cleanup.txt` + `SHA256SUMS.txt` — after graceful shutdown, the created browser session, host PID, listener, target writer owner, open target files, and exact fresh external workspace are absent; all retained evidence was copied and hashed before only the card-created external workspace was removed.
- ✓ `npm run check` — retained walkthrough links and canonical reconciliation are valid without production/test changes.
- ✓ FE-1348 reconciliation review — on success only the `Cross-surface graph/session settlement` row becomes `built`; `Execute mode interaction` remains `partial`, FE-1348 remains active, and no aggregate frontier-complete claim is made.

## Invariants preserved

- One approval remains indivisible and routes through the shared response-settlement operation into one `CommandExecutor.acceptReviewSet` call — guarded by: JSONL/receipt convergence, public graph overview, and read-only change-log audit. **Stop the line:** any count other than one is a contradiction, not a retry prompt.
- Every reviewed item's settlement remains explicit and visible before approval — guarded by: pre-approval browser AX/screenshot plus the canonical review payload.
- JSONL and SQLite remain the only durable authorities; React, live overlay, Query cache, screenshots, and retained RPC responses remain projections/evidence — guarded by: A/B fresh public projection equality and independent read-only DB audit.
- The target remains singular and target-addressed under I64-L — guarded by: target/environment ledger and cleanup proof; no second host or private driver surface is permitted.
- SW2 monotonic reconciliation survives the SW3 repair — guarded by: one actionable representation before approval, no controls after terminal settlement, and exact A/B equality across one reload.
- Existing failed/consumed evidence stays immutable; this journey uses a new workspace and a new retained evidence directory.

## Verification Approach

- Inner: artifact assertions over the exact JSONL, two public `session.presentation` results, one public `graph.overview`, action/reload ledger, and read-only SQLite query.
- Middle: differential convergence — presentation A equals presentation B, and both receipts equal JSONL/graph/SQLite authority for the sole effect.
- Outer: `agent-browser` accessibility snapshots/screenshots over the standalone React product before approval, after settlement, and after exactly one reload; the card's explicit authorization owns the single Approve action.
- Documentation gate: `npm run check` after pass/failure reconciliation. Do not run or change production implementation as part of this card.

## Cross-cutting obligations

- Preserve D27-L/I15-L atomic review authority, including exact per-item settlement and one receipt-bearing terminal only after commit success.
- Preserve D133-L/I65-L convergence: React must regain a fresh JSONL-derived semantic state after reload without a mirror store or durable-history dedupe.
- Preserve D141-L/I64-L target addressing and writer exclusion; this witness exercises standalone web only and performs no raw-relay cutover/deletion work.
- Follow `docs/praxis/manual-testing.md` findings discipline. Any divergence must be fixed, promoted to a named owner, or explicitly retired; `deferred` is not terminal.
- Execute remains `partial` under its existing owner/re-entry trigger. Even a fully successful settlement witness leaves FE-1348 active.

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                               ?  # success/failure truth only; FE-1348 remains active
└── cards/
    ├── post-hardening-alpha-validation--usage-and-verification-sweep.md   ~
    └── post-hardening-alpha-validation--final-settlement-witness.md       -  # consumed after execution
TESTING_FINDINGS.md                                                        ~
testing/walkthroughs/2026-08-12/
└── cross-surface-graph-session-settlement-post-sw3-final/                 +
src/                                                                       —  # no production or test edits
.fixtures/                                                                 —  # fresh workspace is external, then removed
```

`memory/SPEC.md`, topology files, prior walkthrough evidence, source code, tests, fixtures, dependencies, and package configuration are read-only. If execution appears to require changing any of them, stop: that is a divergence and this one-shot card does not authorize repair.
