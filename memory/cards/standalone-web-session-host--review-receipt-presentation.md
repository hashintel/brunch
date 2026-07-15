# Standalone web — review receipt presentation closure

Frontier: standalone-web-session-host
Status:   active
Mode:     slices
Created:  2026-07-15

## Orientation

- **Containing seam:** D27-L/I15-L review-set settlement already requires an approved `request_review` terminal to carry the exact committed graph receipt; current runtime settlement has `MutateGraphSuccess`, but persisted validated details drop it.
- **Frontier:** FE-1200 `standalone-web-session-host`; this is the user-approved intra-frontier rescope for blocked presentation sweep row B2. It does not create a new PLAN frontier, issue, or branch.
- **Volatile state:** `HANDOFF.md` predates the now-built presentation rows and remains protected until final reconciliation.
- **Main risk:** accidentally creating a second receipt model or parsing formatted markdown. The graph-owned `MutateGraphSuccess` type remains canonical; request details validate and carry it, and presentation consumes only validated details.

Posture: earned (inherited from `standalone-web-session-host`). These slices materialize the already-settled D27-L/I15-L receipt-bearing-terminal contract and then close its web presentation row.

Cross-cutting obligations:

- D128-L single decode: React never parses `toolResult.details` or formatter markdown.
- D27-L/I15-L: approval commits once before minting one receipt-bearing terminal; request-changes/reject/cancel/unavailable carry no receipt.
- Whole-set-only authority, one LSN/change-log entry, retry/duplicate rejection, target isolation, and non-rendered `worldUpdate` continuity remain unchanged.
- No FE-1187 visual-design expansion; proposition-first semantic HTML is sufficient here.

## Slice 1 — Persist the committed review receipt

Status: done
Weight: full

### Target Behavior

An approved `present_review_set` response persists its canonical graph mutation receipt inside validated `request_review` details.

### Cold-start reads

- `memory/SPEC.md` — D27-L, D41-L, D105-L, D108-L; I15-L, I23-L, I26-L
- `memory/PLAN.md` — frontier `standalone-web-session-host`
- `memory/cards/standalone-web-session-host--presentation-coverage.md` — blocked B2 row and aggregate DoD
- `src/exchanges/schemas/TOPOLOGY.md` — request-detail source boundaries
- `src/session/TOPOLOGY.md` — shared review-set settlement authority
- `src/graph/TOPOLOGY.md` — command receipt ownership

### Boundary Crossings

```pseudo
session review answer
  -> settleReviewSetResponse commits through CommandExecutor.acceptReviewSet
  -> projectRequestReview constructs validated request_review details
  -> Pi JSONL toolResult.details persists receipt
  -> zRequestReviewDetails validates on read-back
```

### Risks and Assumptions

- RISK: duplicate DTO/schema ownership → MITIGATION: keep `MutateGraphSuccess` as the static source and make the Zod receipt validator explicitly conform to that graph-owned type; do not declare a second TypeScript receipt interface.
- RISK: receipt appears on non-approved outcomes → MITIGATION: require it only on the `present_review_set` + `approve` schema/projector branch; reject it elsewhere through strict schemas.
- RISK: accepted terminal can precede commit → MITIGATION: settlement passes `accepted` into the projector only after `acceptReviewSet` succeeds; failed commit mints no accepted details.
- ASSUMPTION: the existing `MutateGraphSuccess` fields are the complete receipt required by D27-L/I15-L.
  → IMPACT IF FALSE: Slice 2's no-loss projection would be under-specified.
  → VALIDATE: existing formatter and settlement tests consume its LSN and changed-entity sets; schema round-trip asserts every field.

### Posture check

This closes code/spec drift in one named seam: D27-L/I15-L already say receipt-bearing terminal, while persisted details omit the receipt. It canonicalizes the graph-owned mutation-success shape as the terminal receipt and removes markdown as the only persisted rendering of that fact.

### Acceptance Criteria

- ✓ `src/session/__tests__/review-set-settlement.test.ts` — approved settlement details contain the exact `MutateGraphSuccess` returned by the one successful `acceptReviewSet` call; failed/non-approved outcomes contain no receipt and do not commit.
- ✓ `src/exchanges/schemas/__tests__/request.test.ts` — the approved review-set branch accepts a full canonical receipt, rejects missing/malformed receipt, and request-changes/reject/digest-review branches reject receipt fields.
- ✓ `src/exchanges/projections/__tests__/request-review.test.ts` (or current owning request-response projection test) — `projectRequestReview` requires and preserves the exact receipt only for approved `present_review_set` input.
- ✓ existing local-TUI/public-RPC review-set differential and retry/duplicate suites — both paths persist normalized-equivalent receipt-bearing details and still produce one graph effect.

### Invariants preserved

- Atomic whole-set settlement, one LSN/change-log entry, no post-approval mutation — guarded by: `review-set-settlement.test.ts` plus existing registered local/RPC differential tests.
- Digest review details remain receipt-free and retain `accepted_abstract` semantics — guarded by: request schema/projection tests and digest presentation tests.
- Boundary validation remains Zod-owned; constructors do not parse objects they just built — guarded by: exchange schema/projection topology tests.

### Verification Approach

- Inner: schema/projector TDD over exact branch legality and no-loss receipt round-trip.
- Middle: shared settlement and local/RPC differential tests over real command results.
- Outer: none; this slice changes persisted semantic truth but not user presentation.

### Expected touched paths (tentative)

```pseudo
src/exchanges/
├── schemas/request.ts                              ~
├── schemas/__tests__/request.test.ts               ~
├── projections/request-response/review.ts          ~
└── projections/__tests__/request-review.test.ts    ?
src/session/
├── review-set-settlement.ts                        ~
└── __tests__/review-set-settlement.test.ts         ~
src/rpc/__tests__/                                  ? (existing review settlement differential only)
src/.pi/extensions/__tests__/                       ? (existing local settlement differential only)
src/exchanges/schemas/TOPOLOGY.md                   ?
src/session/TOPOLOGY.md                             ?
memory/cards/standalone-web-session-host--review-receipt-presentation.md ~
memory/PLAN.md                                      ~
```

## Slice 2 — Present the review set and receipt

Status: next
Weight: full

### Target Behavior

A settled review-set exchange rehydrates as one semantic proposal and terminal receipt that the standalone React session renders without decoding raw details.

### Cold-start reads

- `memory/SPEC.md` — D27-L, D104-L, D107-L, D108-L, D128-L; I15-L, I20-L, I65-L
- `memory/PLAN.md` — frontier `standalone-web-session-host`
- `memory/cards/standalone-web-session-host--presentation-coverage.md` — B2 and aggregate DoD
- `src/exchanges/schemas/TOPOLOGY.md` — present/review detail vocabulary
- `src/projections/TOPOLOGY.md` — shared semantic projection owner
- `src/web/TOPOLOGY.md` — React adapter/single-decode contract

### Boundary Crossings

```pseudo
Pi JSONL present_review_set + request_review toolResults
  -> zPresentReviewSetDetails / zRequestReviewDetails validation
  -> session-presentation semantic entries
  -> session.presentation RPC
  -> React proposition-first offer + terminal decision/receipt
  -> reconnect repeats the same JSONL-derived projection
```

### Risks and Assumptions

- RISK: proposition rendering drifts into FE-1187 visual design → MITIGATION: semantic headings/lists/definition lists only; no styling system or visual redesign.
- RISK: offer and terminal are coupled by transcript guesswork → MITIGATION: preserve each entry's validated exchange id and declared continuation; do not infer adjacency or mutate across entries.
- RISK: partial approval appears in UI → MITIGATION: render only canonical whole-set decision vocabulary and receipt; no per-node controls.
- ASSUMPTION: Slice 1 lands the validated `receipt: MutateGraphSuccess` branch exactly as scoped.
  → IMPACT IF FALSE: this card becomes stale; stop before building.
  → VALIDATE: re-orient against the committed schema/projector tests before red.

### Posture check

This closes the last open I65-L family using the already-established D128-L projection seam and deletes the current mismatch where an accepted graph receipt is visible only in formatter markdown.

### Acceptance Criteria

- ✓ `src/projections/session/__tests__/session-presentation.test.ts` — review-set offer projection preserves ordered nodes, edges, grouped consequences, display fields, and declared `request_review` continuation without loss; terminal projection preserves approve/request-changes/reject/cancel/unavailable and the exact approved receipt.
- ✓ `src/projections/session/__tests__/session-presentation.test.ts` — malformed `present_review_set` or `request_review` details classify honestly without leaking raw payload.
- ✓ `src/web/__tests__/session-route.test.tsx` — React renders proposition-first review-set semantics, each terminal decision/comment, and approved LSN/changed-entity receipt from `SessionPresentationEntry` only; no partial-accept controls exist.
- ✓ `src/dev/__tests__/standalone-web-session-host.real-entry.test.ts` — one production `present_review_set → ask({continues}) → approve` commits once, settles, reconnects, and rehydrates the same offer, decision, and receipt from JSONL.
- ✓ existing concurrency and local-TUI/public-RPC settlement suites — target isolation, one graph effect, and normalized terminal parity remain green.

### Invariants preserved

- D128-L single decode and malformed-detail honesty — guarded by projection/route tests.
- D27-L/I15-L settlement authority and whole-set atomicity — guarded by production entry plus settlement differential tests.
- B1/B3 production reconnect witnesses remain present and green; later family work may not replace them — guarded by distinct tests in `standalone-web-session-host.real-entry.test.ts`.
- `worldUpdate` remains continuity-only and cross-session message/ask leakage stays forbidden — guarded by `standalone-web-session-host.concurrency.test.ts`.

### Verification Approach

- Inner: projection shape/no-loss and React adapter tests.
- Middle: production host settle/reconnect plus local/RPC differential.
- Outer: automated semantic/accessibility structure; FE-1187 owns visual-polish judgment.

### Expected touched paths (tentative)

```pseudo
src/projections/session/
├── session-presentation.ts                         ~
└── __tests__/session-presentation.test.ts          ~
src/web/
├── routes/session.tsx                              ~
├── features/session/                               ? (one focused adapter only if route pressure requires it)
└── __tests__/session-route.test.tsx                ~
src/dev/__tests__/
└── standalone-web-session-host.real-entry.test.ts  ~
memory/cards/standalone-web-session-host--presentation-coverage.md ~ (B2 built only after acceptance)
memory/cards/standalone-web-session-host--review-receipt-presentation.md ~
memory/PLAN.md                                      ~
src/projections/TOPOLOGY.md                         ?
src/web/TOPOLOGY.md                                 ?
```

## Sequence rule

Slice 2 is released only after Slice 1 commits the exact validated receipt shape above and review confirms D27-L/I15-L settlement parity. If that shape differs or introduces a new owner, mark Slice 2 stale and rescope rather than adapting silently.
