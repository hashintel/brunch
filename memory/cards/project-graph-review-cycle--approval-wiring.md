# Review-set approval wiring

Frontier: project-graph-review-cycle
Status:   done
Mode:     single
Created:  2026-06-06

## Orientation

- Containing seam: FE-809 `project-graph-review-cycle`, specifically the product path from a transcript-backed `present_review_set` / `request_review` structured exchange to graph truth through `CommandExecutor.acceptReviewSet`.
- Relevant frontier item: `project-graph-review-cycle` ([FE-809](https://linear.app/hash/issue/FE-809/project-graph-review-set-proposal-and-atomic-acceptance)); the schema/emission lock is complete, and PLAN names approval-to-`acceptReviewSet` product wiring plus the real `project-graph` probe as remaining FE-809 work.
- Volatile handoff state: the topology cleanup moved reusable exchange helpers to `src/projections/structured-exchange/` and `src/renderers/structured-exchange/`, Pi exchange tools to `src/.pi/extensions/exchanges/`, and app entrypoints to `src/app/`. Two unrelated active cards remain: live mention autocomplete and dev semantic graph mutations. The semantic mutation card should wait because this slice may touch `CommandExecutor` / review-set graph code.
- Main open risk: approval could accidentally commit a stale or reconstructed payload that differs from the reviewed `present_review_set`. This slice must recover the exact pending review-set details from transcript truth, translate them once, and commit atomically only for `decision: "approve"`.

Posture: proving (inherited from `project-graph-review-cycle`).

Frontier-level cross-cutting obligations this slice carries:

- Preserve D27-L/I15-L: review-set approval is one `acceptReviewSet` command, one spec-local LSN, one change-log row, and no partial acceptance.
- Preserve D28-L: request-changes and reject are transcript-visible terminal outcomes; they do not mutate graph truth in this slice.
- Preserve D4-L/D20-L: graph mutation routes only through `CommandExecutor`; RPC/session code must not write graph rows or call DB directly.
- Preserve D61-L/D62-L: existing graph references in review payloads use selected-spec projected codes at adapter/UI boundaries, then resolve inside graph translation.
- Preserve D63-L/I40-L: accepted review-set graph rows are `basis: explicit`; the review payload does not carry per-item basis.
- Preserve D37-L/D41-L: request-review details remain Zod-authored structured-exchange transcript payloads; TypeBox is only the RPC/Pi parameter adapter where needed.
- Preserve harness-as-false-proof guard: tests should exercise the public session/RPC path or the same projection helpers it uses, not private graph calls masquerading as product wiring.

## Card 1 — Approve review-set exchange into graph truth

Status: done
Weight: full

Completed: 2026-06-06 — `session.submitExchangeResponse` now accepts review decisions, appends canonical `request_review` terminal results, routes approve through `CommandExecutor.acceptReviewSet`, publishes graph invalidations on approval, and leaves request-changes/reject non-mutating. Verified with `npm run verify`.

### Target Behavior

Submitting an approved pending review exchange commits the exact presented review set into the selected spec graph through `CommandExecutor.acceptReviewSet`.

### Boundary Crossings

```pseudo
→ transcript-backed pending review exchange
→ session.submitExchangeResponse public RPC params
→ request_review toolResult projection / append
→ reviewed present_review_set payload recovery
→ CommandExecutor.acceptReviewSet
→ graph/change_log/product update projections
→ docs/PLAN reconciliation for FE-809 remaining work
```

### Risks and Assumptions

- RISK: Pending review response may be accepted without a matching open `present_review_set`.
  → MITIGATION: recover the pending exchange via `pendingExchangeFromEnvelope`; require `pending.mode === "review"`, matching `exchangeId`, and a recoverable `reviewSet` payload before accepting review responses.
- RISK: The pending projection currently exposes `review_set` in snake_case details shape, while `CommandExecutor.acceptReviewSet` consumes the graph-domain camelCase `ReviewSetProposalPayload`.
  → MITIGATION: add an explicit, tested adapter from canonical present-review-set details back to graph-domain payload, preserving exact node/edge semantics and selected-spec existing-code refs.
- RISK: Approval graph mutation may happen before the request-review toolResult is appended, making transcript audit look out of order.
  → MITIGATION: define and test the order; prefer append+flush terminal `request_review` first, then commit with `proposalEntryId` pointing at the persisted request or reviewed present entry, unless implementation proves Pi session manager cannot expose the appended id cheaply. Whatever order is chosen must be documented in result/change-log tests.
- RISK: Reusing `session.submitExchangeResponse` for review decisions could break text/choice capture semantics.
  → MITIGATION: extend the params schema as an additional answer branch (`{review:{decision, comment?}}`) and keep existing text/choice/multi-choice tests green.
- RISK: Request-changes could require immediate successor proposal generation.
  → MITIGATION: this slice records the terminal request-changes outcome and returns a non-mutating result; successor generation remains a later FE-809/probe behavior unless already provided by the agent loop.
- ASSUMPTION: Approve/reject/request-changes can share `session.submitExchangeResponse` rather than adding a new public method.
  → IMPACT IF FALSE: web/RPC clients would need a separate review response method, and PLAN/RPC docs would need a larger public-surface change.
  → VALIDATE: handler tests prove `session.pendingExchange` returns `mode: "review"`, `session.submitExchangeResponse` accepts the review decision, and product updates/refetches match existing session mutation patterns.
  → memory/SPEC.md: D49-L already lists `request_review` as a terminal response supported by `session.submitExchangeResponse`.

### Posture check

This proving slice lights up the FE-809 product path that is currently only graph-ready in isolation: transcript review approval → exact graph acceptance → observable graph update. It also stabilizes the invariant that review approval cannot be a caller-side patch/commit sequence.

### Acceptance Criteria

```pseudo tree
review approval product path
├── pending review projection
│   ├── ✓ session.pendingExchange returns `mode: "review"` with the canonical reviewed nodes/edges from a matching `present_review_set`
│   └── ✓ malformed or unsupported review-set details do not become an approvable pending review
├── response params and transcript append
│   ├── ✓ session.submitExchangeResponse accepts `{answer:{review:{decision:"approve", comment?}}}` only for pending review exchanges
│   ├── ✓ request_changes requires a non-empty comment and appends a canonical `request_review` toolResult without graph mutation
│   ├── ✓ reject appends a canonical `request_review` toolResult without graph mutation
│   └── ✓ text/choice/multi-choice response behavior and synchronous capture stay unchanged
├── approve-to-graph
│   ├── ✓ approve translates the exact reviewed `review_set` payload to `ReviewSetProposalPayload` and calls `CommandExecutor.acceptReviewSet`
│   ├── ✓ accepted nodes/edges are written with `basis: explicit`, one selected-spec LSN, and one `accept_review_set` change-log row
│   ├── ✓ existing-code endpoints resolve only inside the selected spec
│   ├── ✓ structural-illegal review payload returns a loud `structural_illegal` acceptance result and does not append misleading success state
│   └── ✓ success publishes selected-session updates and graph mutation updates with `{specId, lsn}`
├── public/result shape
│   ├── ✓ submit result distinguishes `review: {status:"approved", lsn,...}` from ordinary `capture` results or deliberately extends the existing result without overloading capture
│   └── ✓ rpc.discover schema/examples describe review submission without creating `reviewSet.*` methods
└── reconciliation
    ├── ✓ src/rpc/README.md reflects `request_review` support if the public response schema changes
    ├── ✓ memory/PLAN.md FE-809 execution pointer advances to the real `project-graph` proposal probe
    └── ✓ memory/SPEC.md / docs/design/REVIEW_SETS.md are updated only if implementation changes D27-L/D28-L/D49-L semantics
```

### Verification Approach

- Inner: session projection tests — prove review pending exchange recovery from Pi-like `present_review_set` toolResult details.
- Inner: RPC handler tests — drive `session.submitExchangeResponse` against a selected session containing a pending review exchange and assert transcript append, graph rows, change-log, and product updates.
- Inner: graph translation tests — prove details-to-review-payload adapter preserves selected-spec projected-code refs and rejects drifted fields.
- Middle: small product-path fixture/probe (deterministic, no LLM) — activate a workspace/spec/session, append/present a review set through the same structured-exchange projection helpers, submit approve over public RPC, read `graph.overview` back.
- Outer: real `project-graph` LLM proposal probe is not part of this card unless the implementation turns out already wired enough; scope/run it after this card lands.

### Cross-cutting obligations

- Do not add standalone `reviewSet.*` public RPC methods or DB-backed review-set entities.
- Do not expose partial acceptance or accept-with-edits.
- Do not add reviewer async jobs in this slice; D29-L reviewer remains deferred unless explicitly scoped.
- Do not give the web/browser direct graph mutation authority for review drafts; browser submits the review decision, not graph nodes/edges.
- Do not widen `commit_graph` tool semantics while wiring review approval.

### Expected touched paths (tentative)

```pseudo tree
src/session/
├── structured-exchange-loop.ts                         ~
├── structured-exchange-loop.test.ts                    ~
├── exchange-projection.ts                              ?
└── exchange-projection.test.ts                         ?

src/projections/structured-exchange/
├── present-review-set.ts                               ~
├── request-review.ts                                   ~
├── review-set-payload.ts                               +?
└── *.test.ts                                           +?

src/renderers/structured-exchange/
└── request-review.ts                                   ?

src/rpc/
├── methods/session.ts                                  ~
├── handlers.test.ts                                    ~
└── README.md                                           ~?

src/graph/
├── review-set.ts                                       ?
├── review-set.test.ts                                  ?
└── command-executor/accept-review-set.test.ts          ?

src/probes/
├── review-set-approval-proof.ts                        +?
└── review-set-approval-proof.test.ts                   +?

memory/
├── PLAN.md                                             ~
└── SPEC.md                                             ?

docs/design/
└── REVIEW_SETS.md                                      ?
```
