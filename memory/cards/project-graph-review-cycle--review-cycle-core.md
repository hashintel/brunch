# Project-graph review-cycle core tracer

Frontier: project-graph-review-cycle
Status:   active
Mode:     chain
Created:  2026-06-05

## Orientation

- Containing seam: FE-809 `project-graph-review-cycle`, specifically the review-set payload / structured-exchange / graph-command seam that turns `project-graph` proposals into exact user-reviewed graph truth.
- Relevant frontier item: `project-graph-review-cycle` ([FE-809](https://linear.app/hash/issue/FE-809/project-graph-review-set-proposal-and-atomic-acceptance)); this scope narrows that branch/issue, it does not create a new frontier.
- Volatile handoff state: no `HANDOFF.md`; `memory/PLAN.md` says the first FE-809 scope card was pending. The existing `tooling--worktree-command-ux.md` card is unrelated and has disjoint write paths.
- Main open risk: D27-L says review-set proposals are structured-exchange payloads, but runtime `present_review_set` / `request_review` tools are still stubs; the graph acceptance seam should land before real LLM proposal probes so invalid generations can stay internal to retry/regeneration.

Posture: proving (inherited from `project-graph-review-cycle`).

Frontier-level cross-cutting obligations this chain carries:

- Preserve D4-L/D20-L: graph truth mutates only through `CommandExecutor`; no adapter, RPC handler, or transcript helper writes DB rows directly.
- Preserve D27-L/D28-L: review sets live in structured-exchange transcript payloads and successor proposal entries, not as standalone public review-set entities.
- Preserve D61-L/D62-L: review payloads resolve selected-spec projected graph codes at adapter/UI boundaries and never accept raw DB ids from the agent/user.
- Preserve D63-L/I40-L: exact review-set approval writes `basis: explicit`; mutation pathway is recorded in `change_log.operation`, not persisted as a basis value.
- Preserve harness-as-false-proof guard: later probes must exercise the default Brunch runtime factory and registered tools, not import private helpers as a substitute for product wiring.

The chain intentionally stops before the real LLM `project-graph` probe. Whether approval wiring should be driven primarily by the `request_review` Pi tool, public `session.submitExchangeResponse`, or a shared session-domain handler should be decided after Cards 1–2 make the production payload and tuple shape concrete.

## Card 1 — Graph-layer review-set acceptance command

Status: next
Weight: full

### Target Behavior

A dry-run-valid review-set payload can be accepted through `CommandExecutor.acceptReviewSet` as one explicit-basis atomic graph batch.

### Boundary Crossings

```pseudo
→ generated review-set draft payload
→ graph/review-set payload validation and selected-spec code resolution
→ CommandExecutor dry-run planning
→ CommandExecutor.acceptReviewSet
→ SQLite nodes / edges / change_log
```

### Risks and Assumptions

- RISK: Reusing `commitGraph` directly could record `operation: "commit_graph"` and erase the review-set acceptance pathway.
  → MITIGATION: share the private planner/transaction mechanics, but keep an `accept_review_set` command result/change-log operation for accepted review sets.
- RISK: The current review-set helper lives under `.pi/extensions/graph/`, which makes adapter code look like the domain owner.
  → MITIGATION: move proposal validation/translation into `graph/` and delete the adapter-local helper/test rather than preserving a compatibility alias.
- RISK: Existing-node references in review payloads could accidentally accept raw DB ids or cross-spec handles.
  → MITIGATION: accept projected codes only at the adapter/UI boundary, resolve them against the selected spec, and pass internal ids only after graph-layer validation.
- ASSUMPTION: A normalized review-set payload supplied by session/tool adapters is the right input to `CommandExecutor.acceptReviewSet`; `graph/` should not read Pi JSONL to resolve `proposal_entry_id`.
  → IMPACT IF FALSE: `graph/` and `session/` would become coupled, violating D52-L and reshaping later approval wiring.
  → VALIDATE: command tests pass `proposalEntryId` as audit metadata plus the normalized payload; no `session/` imports from `graph/` command code.
- ASSUMPTION: A14-L's non-LLM subclaim is ready to harden: deterministic fixture payloads can prove dry-run/acceptance semantics before real LLM proposal generation is measured.
  → IMPACT IF FALSE: later LLM probes may force payload-shape changes, invalidating Cards 2+.
  → VALIDATE: keep this slice focused on payload invariants and dry-run/real-run parity; leave free-form generation legality rates to the next probe scope.
  → memory/SPEC.md §Assumptions A14-L

### Posture check

This is a proving tracer on the invariant axis. Landing it stabilizes I15-L/I20-L/I40-L for review-set acceptance and retires the non-LLM uncertainty that a reviewed exact payload can commit atomically as explicit graph truth. It deliberately does not claim to retire the remaining A14-L real-agent generation subclaim.

### Acceptance Criteria

```pseudo
review-set validation
├── ✓ src/graph/review-set.test.ts — valid proposal payloads with lens, epistemic status, grounding/support, draft nodes, and draft edges dry-run successfully without graph mutation
├── ✓ src/graph/review-set.test.ts — retired `relation` fields, missing epistemic/grounding data, invalid edge stance, and unresolved projected codes return `structural_illegal`
└── ✓ src/graph/review-set.test.ts — projected existing-node codes resolve only inside the selected spec and never expose raw DB ids in the payload contract

atomic acceptance
├── ✓ src/graph/command-executor/accept-review-set.test.ts — `acceptReviewSet` writes all reviewed nodes/edges with `basis: explicit`
├── ✓ src/graph/command-executor/accept-review-set.test.ts — acceptance uses one LSN and one `change_log` row with `operation: "accept_review_set"` and `proposalEntryId` audit metadata
├── ✓ src/graph/command-executor/accept-review-set.test.ts — structural failure leaves node/edge counts, graph clock, and kind counters unchanged
└── ✓ src/graph/command-executor/accept-review-set.test.ts — per-item basis and retired `accepted_review_set` values are not accepted as proposal payload fields
```

### Verification Approach

- Inner: graph-layer unit tests for payload validation, selected-spec existing-code resolution, explicit-basis acceptance, and failed-accept rollback.
- Middle: dry-run/real-run differential assertions over the same payload prove proposal-time validation and acceptance-time validation stay in parity.
- Outer: none in this card; product-path proof waits for structured-exchange wiring.

### Cross-cutting obligations

- Keep proposal validation/translation in `graph/`; `.pi/extensions/` may adapt only after this seam exists.
- Do not introduce a review-set table, public review-set RPC entity, or partial-accept API.
- Do not preserve the old `.pi/extensions/graph/review-set-proposal.ts` helper as a bridge unless it is tiny and removed in this card.

### Expected touched paths (tentative)

```pseudo
src/graph/
├── review-set.ts                                      +
├── review-set.test.ts                                 +
├── index.ts                                           ~
├── README.md                                          ~
├── command-executor.ts                                ~
└── command-executor/
    ├── commit-graph-batch.ts                          ?
    ├── commit-graph-types.ts                          ?
    └── accept-review-set.test.ts                      +

src/.pi/extensions/graph/
└── review-set-proposal.ts                             -

src/.pi/__tests__/
└── review-set-proposal.test.ts                        -
```

## Card 2 — Review-set structured-exchange tuple

Status: next
Weight: full

### Target Behavior

A dry-run-valid review-set proposal appears as a recoverable `present_review_set` / `request_review` structured-exchange tuple before any graph mutation occurs.

### Boundary Crossings

```pseudo
→ agent present_review_set tool call
→ .pi/extensions/structured-exchange review-set adapter
→ graph/review-set dry-run gate
→ structured-exchange projection / markdown formatting
→ Pi JSONL present toolResult details/content
→ request_review terminal decision tool
→ session exchange projection and pending-exchange recovery
```

### Risks and Assumptions

- RISK: The target Zod details schema currently names only a `proposal_entry_id`, while D27-L requires the structured exchange payload to carry the exact entity/edge drafts the user reviews.
  → MITIGATION: reconcile only the review-set schema/runtime shape needed for this card; do not migrate unrelated `present_*` / `request_*` tools in the same slice.
- RISK: Adding graph validation to `present_review_set` could make structured-exchange tools import DB state or hidden workspace globals.
  → MITIGATION: pass explicit selected-spec review-set dependencies through the extension shell, mirroring the existing `registerBrunchGraph` dependency injection; no direct `db/` imports in `.pi/extensions/`.
- RISK: Invalid generated proposals could become user-visible review UI instead of internal retry feedback.
  → MITIGATION: invalid proposal tool results must be non-reviewable `structural_illegal` diagnostics; session pending-exchange recovery should treat only validated present-review-set details as an open review request.
- ASSUMPTION: Implementing the runtime review tuple against the existing structured-exchange runtime model is cheaper than migrating every structured-exchange tool to the newer Zod-authored `v: 1` model first.
  → IMPACT IF FALSE: Card 2 becomes a broader schema migration, and approval wiring scope should wait.
  → VALIDATE: review-set schema tests name any intentional runtime/target dual shape; unrelated present/request tests stay green without broad rewrites.
- ASSUMPTION: The existing Pi `ctx.ui.select` / `ctx.ui.input` affordances are enough for approve / request changes / reject in TUI, with cancellation/unavailable recorded as terminal request details.
  → IMPACT IF FALSE: the request tool may need an editor fallback or bespoke UI before approval wiring can be scoped.
  → VALIDATE: request-review tool tests cover select/input, required request-changes comment, cancellation, and unavailable UI.

### Posture check

This is a proving tracer on the proof-of-life and invariant axes for the transcript half of FE-809. It makes review-set payloads recoverable through the product structured-exchange seam without yet claiming graph mutation on approval.

### Acceptance Criteria

```pseudo
registered review tools
├── ✓ src/.pi/__tests__/structured-exchange-present-request.test.ts — `present_review_set` and `request_review` are registered structured-exchange tools
├── ✓ src/.pi/__tests__/prompting.test.ts — review tools are available to the elicitor only through the structured-exchange method/tool policy when grade/strategy allow them
└── ✓ src/.pi/__tests__/operational-mode.test.ts — elicit-mode tool filtering does not expose side-effecting tools while adding the review tuple

present_review_set
├── ✓ src/.pi/__tests__/structured-exchange-present-request.test.ts — valid proposal params render durable markdown with pitch, epistemic status, grounding/support, entity drafts, and edge drafts
├── ✓ src/.pi/__tests__/structured-exchange-present-request.test.ts — valid proposal details preserve the canonical review-set payload and expected `request_review` tool
└── ✓ src/.pi/__tests__/structured-exchange-present-request.test.ts — invalid proposal params return non-reviewable `structural_illegal` diagnostics and are not recovered as pending review exchanges

request_review
├── ✓ src/.pi/__tests__/structured-exchange-present-request.test.ts — approve, request-changes, and reject responses persist terminal `request_review` details and markdown
├── ✓ src/.pi/__tests__/structured-exchange-present-request.test.ts — request-changes requires a non-empty user comment
└── ✓ src/.pi/__tests__/structured-exchange-present-request.test.ts — cancellation/unavailable states are transcript-visible terminal outcomes

session projection
├── ✓ src/session/exchange-projection.test.ts — `present_review_set` closes only with the matching terminal `request_review` result
└── ✓ src/session/structured-exchange-loop.test.ts — pending-exchange recovery can expose a review-mode pending exchange from a validated `present_review_set`
```

### Verification Approach

- Inner: structured-exchange tool/projection tests for registration, markdown/details parity, terminal review decision details, invalid-proposal recovery, and comment rules.
- Middle: session projection tests over explicit Pi JSONL entries prove the present/request tuple is recoverable from transcript truth.
- Outer: none in this card; approval commit and real LLM proposal generation remain unscoped until the product entrypoint is clear.

### Cross-cutting obligations

- Do not add standalone `brunch.review_set_proposal` transcript entries or public `reviewSet.*` RPC methods.
- Keep `present_review_set` semantic display in `toolResult.content` / `renderResult`; `renderCall` remains non-semantic.
- Keep invalid proposal feedback internal to agent retry/regeneration; do not make structurally illegal batches user-reviewable.

### Expected touched paths (tentative)

```pseudo
src/.pi/
├── pi-extension-shell.ts                              ?
├── __tests__/
│   ├── structured-exchange-present-request.test.ts    ~
│   ├── structured-exchange-schemas.test.ts            ~
│   ├── prompting.test.ts                              ~
│   └── operational-mode.test.ts                       ~
└── extensions/
    └── structured-exchange/
        ├── index.ts                                   ~
        ├── present-review-set.ts                      ~
        ├── request-review.ts                          ~
        ├── shared/model.ts                            ?
        └── schemas/
            ├── present.ts                             ?
            ├── request.ts                             ?
            └── README.md                              ?

src/structured-exchange/
├── project/
│   ├── present-review-set.ts                          ~
│   └── request-review.ts                              ~
└── format/
    ├── present-review-set.ts                          ~
    └── request-review.ts                              ~

src/session/
├── exchange-projection.test.ts                        ~
├── structured-exchange-loop.ts                        ~
└── structured-exchange-loop.test.ts                   ~

src/agents/
└── state.ts                                           ~
```
