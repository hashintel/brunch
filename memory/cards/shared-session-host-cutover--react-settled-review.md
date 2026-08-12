# React settled-review semantics repair

Frontier: shared-session-host-cutover
Status:   active
Mode:     single
Created:  2026-08-12

## Orientation

- The containing seam is D133-L/I65-L's shared JSONL-derived session presentation rendered by `src/web/routes/session.tsx`; the canonical review-set projection already preserves per-item settlement and its declared continuation.
- The containing PLAN frontier is `shared-session-host-cutover` (earned). PLAN and `TESTING_FINDINGS.md` assign SW3 here; this repair is a hard prerequisite to re-enter FE-1348's `Cross-surface graph/session settlement` row, not a claim that the row or cutover is complete.
- No `HANDOFF.md` exists. The retained SW3 witness is the volatile evidence boundary: one successful settled review set and one unresolved `approve` / `request_changes` / `reject` continuation, with no approval or graph effect.
- Main risk: fixing presentation by adding another decoder or control state. The repair must correlate the existing canonical offer and live open ask by exchange id, not create another store, RPC shape, or review vocabulary.

Posture: earned (inherited from `shared-session-host-cutover`).

Weight: light — this is a bounded React adapter defect inside the settled D116-L/D125-L/D133-L projection and answering seams; it changes no requirement, decision, or authority boundary.

## Objective

Restore the canonical settled review-set meaning in React as one visibly settled, semantically explicit review interaction.

## Cold-start reads

A fresh builder must read these exact sources before editing:

- `AGENTS.md` — development posture, file safety, topology ownership, and verification policy.
- `memory/POSTURE.md` — prototype/high-stakes boundary posture.
- `memory/SPEC.md` — requirements 12, 17, 23, and 32; decisions D27-L, D106-L, D116-L, D125-L, D132-L, D133-L, and D141-L; invariants I52-L, I64-L, and I65-L.
- `memory/PLAN.md` — `shared-session-host-cutover`; FE-1348 cross-surface dependency and re-entry gate.
- `memory/cards/post-hardening-alpha-validation--usage-and-verification-sweep.md` — `Cross-surface graph/session settlement` row only.
- `TESTING_FINDINGS.md` — SW3 only.
- `testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-witness/walkthrough.md` — stop condition and claim boundary.
- `testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-witness/session.jsonl` — exact canonical offer and unresolved continuation.
- `testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-witness/browser-pre-approval.png` — observed React contradiction.
- `src/web/TOPOLOGY.md` — thin-client ownership, route semantics, and no-second-store rule.
- `src/projections/TOPOLOGY.md` and `src/exchanges/schemas/TOPOLOGY.md` — shared projection and declared-continuation ownership.
- `src/exchanges/projections/present-review-set.ts`, `src/exchanges/schemas/present.ts`, and `src/.pi/extensions/exchanges/ask/continuation.ts` — canonical settlement/options and the existing headless review answer encoding.
- `src/projections/session/session-presentation.ts` and `src/projections/session/__tests__/session-presentation.test.ts` — already-preserved review-set/continuation semantic type and no-loss oracle.
- `src/web/features/session/live-overlay.ts`, `src/web/routes/session.tsx`, and `src/web/__tests__/session-route.test.tsx` — live/canonical reconciliation and the public React rendering seam.

## Acceptance Criteria

- ✓ `src/web/__tests__/session-route.test.tsx > session route > renders a settled review and its open continuation as one explicit review interaction` — an SW3-shaped public `BrunchWebApp`/RPC fixture renders the proposal once, visibly renders the canonical `settled` value, and exposes exactly one each of **Approve**, **Request changes**, and **Reject** as the review choices.
- ✓ The same route test — the unresolved review continuation has no generic question textbox and no generic **Answer** submit control; the always-available ordinary **Message** composer remains a separate ambient-turn control.
- ✓ The same route test — the offer heading/narrative is rendered once rather than repeated as a second confirmation-like block; the review control uses concise review labeling instead of replaying continuation narration.
- ✓ The same route test — each choice uses the existing `session.answerExchange` contract: Approve and Reject submit their canonical ids, while Request changes exposes its specifically labeled required-change field and submits the existing `request_changes:<comment>` headless encoding.
- ✓ Existing `src/web/__tests__/session-route.test.tsx > session route > renders a proposition-first review set and exact approved receipt without acceptance controls`, extended with settlement assertions — every rendered node and edge exposes its own canonical settlement, so mixed review sets cannot collapse to a batch-level label.
- ✓ Existing `src/web/__tests__/session-route.test.tsx > session route > hydrates, drives, reduces targeted live state, answers, settles, and recovers durably` — ordinary free-text asks and ambient free-text turns remain operable.
- ✓ Existing SW2 oracles in `src/web/__tests__/session-route.test.tsx` — `merges competing canonical and hydrated asks without collapsing durable history`, `canonical terminal wins over a stale hydrated ask`, `does not let a deferred initial open-ask snapshot overwrite a newer ask event`, and `does not resurrect a deferred initial open ask after settlement` remain green.

## Implementation constraints

- Consume the projected `present_review_set.reviewSet` and declared `continuation` already returned by `session.presentation`; use the live open ask only to establish that the matching exchange is currently actionable.
- Correlate offer and open control by canonical `exchangeId`. Do not copy the review vocabulary into a new store, invent a React-only exchange model, scan JSONL in the browser, or widen RPC.
- Keep the control inside the existing route/`session.answerExchange` path. A dedicated Request-changes rationale is not a generic continuation answer field; it exists only when that canonical decision requires it.
- Do not redesign candidate, digest, questionnaire, transcript, or global visual systems. Do not implement raw-relay cutover/deletion work in this slice.

## Invariants preserved

- Every review-set node and edge continues to expose its own canonical `advisory | settled` value; no batch default or UI inference hides D27-L settlement — guarded by: the new SW3 route oracle, the extended proposition-first route test, and the existing projection no-loss test `preserves an ordered review set, declared continuation, and every terminal outcome without loss`.
- Review approval remains one indivisible user decision through the existing shared settlement path; React never mutates graph truth directly — guarded by: the new route RPC assertion and existing review-set settlement/RPC suites.
- Ordinary messages and free-text asks keep their existing input semantics, and the ambient Message composer does not silently answer a pending exchange — guarded by: the named route lifecycle oracle and the full `session-route.test.tsx` suite.
- SW2's one-actionable-representation and monotonic subscribe/resnapshot/terminal precedence remain unchanged; durable history is not deduplicated — guarded by: the four named SW2 route tests above. **Stop the line:** a red result here is not a fixture-update opportunity.
- Canonical truth remains active-branch Pi JSONL plus graph persistence, with Query/live overlay as projection/ephemeral progress only — guarded by: I65-L projection tests and the absence of any new state/RPC path in this manifest.

## Verification Approach

- Inner: `npm test -- src/web/__tests__/session-route.test.tsx` — proves the SW3 behavior through the public React route and keeps ordinary ask/SW2 reconciliation rivals green.
- Inner hygiene: `npm run fix` after the implementation edit.
- Checkpoint: `npm run verify` — repository fast gate.
- Outer: no new journey is authorized by this card. FE-1348's existing `Cross-surface graph/session settlement` sweep row owns the fresh one-shot browser/JSONL/graph/reload witness; re-enter only after this repair is merged and the user gives fresh explicit authorization.

## Cross-cutting obligations

- Preserve target-addressed D141-L session RPC/events and I64-L single answering authority; this is semantic presentation repair, not runtime-host work.
- Preserve I65-L convergence: after settlement/reconnect, React must still equal a fresh canonical session projection modulo declared ephemeral progress.
- This card closes only SW3's production prerequisite. It does not close FE-1348's row, authorize approval, or claim graph-effect/receipt/reload evidence.

## Assumption dependency

None — the retained JSONL, current projection type, route behavior, and screenshot directly establish the defect and the existing data needed for the repair.

## Expected touched paths (tentative)

```text
src/web/
├── routes/
│   └── session.tsx                    ~
└── __tests__/
    └── session-route.test.tsx         ~
```

`src/projections/session/session-presentation.ts`, `src/web/features/session/live-overlay.ts`, exchange schemas/projectors, RPC handlers, canonical PLAN/SPEC, and retained evidence are read-only for this slice. If implementation appears to require changing one of those seams, stop and rescope rather than widening this repair.
