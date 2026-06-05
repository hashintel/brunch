# Structured-exchange schema lock

Frontier: project-graph-review-cycle
Status:   active
Mode:     single
Created:  2026-06-05

## Orientation

- Containing seam: FE-809 `project-graph-review-cycle`, specifically the structured-exchange details/schema seam that carries proposal, response, and capture payloads through Pi JSONL without schema invention during tool implementation.
- Relevant frontier item: `project-graph-review-cycle` ([FE-809](https://linear.app/hash/issue/FE-809/project-graph-review-set-proposal-and-atomic-acceptance)); this scope narrows that frontier before approval-to-commit wiring and the real `project-graph` proposal probe.
- Volatile handoff state: no `HANDOFF.md`; no active scope cards remain after the review-cycle core card was retired. The previous Card 2 intentionally left runtime/target schema duality in place, and user review found real drift in the `present_review_set` schema shape.
- Main open risk: the current runtime details model, Zod target schema layer, Pi TypeBox tool params, and session pending-exchange helpers can each look like a source of truth. This slice must make the Zod details layer the canonical schema source for structured-exchange transcript payloads without pretending Pi tool parameter schemas are the same thing.

Posture: proving (inherited from `project-graph-review-cycle`).

Frontier-level cross-cutting obligations this slice carries:

- Preserve D27-L/D28-L: review sets live in structured-exchange transcript payloads and successor proposal entries, not as standalone public review-set entities or public `reviewSet.*` RPC methods.
- Preserve I23-L/I26-L: structured-exchange details are schema-checked transcript payloads, and no boundary may hand-author parallel Zod and TypeBox sources for the same semantic shape.
- Preserve D4-L/D20-L/I11-L: schema/capture details may describe graph drafts or analysis, but graph mutation still routes only through `CommandExecutor` in later acceptance/capture paths.
- Preserve D61-L/D62-L: review-set endpoints at adapter/UI boundaries use draft ids or projected existing graph codes, not raw DB ids.
- Preserve D63-L/I40-L: review approval strength is a later graph `basis: explicit` effect, not a field in review-set proposal details.
- Preserve harness-as-false-proof guard: later review-cycle probes must exercise default Brunch runtime wiring against these locked details, not private helpers with divergent shapes.

## Card 1 — Canonical structured-exchange schema lock

Status: next
Weight: full

### Target Behavior

Every structured-exchange tool result payload has one Zod-authored canonical details schema that runtime, projection, docs, and tests agree on.

### Boundary Crossings

```pseudo
→ designed structured-exchange payload shapes
→ .pi/extensions/structured-exchange/schemas Zod source
→ runtime tool detail producers / parsers
→ session exchange projection and pending-exchange recovery
→ docs/tests that prevent schema invention and TypeBox semantic drift
```

### Canonical data-shape lock

The build must preserve this minimum shape vocabulary; refine only by deleting ambiguity or matching already-designed schema docs, not by inventing new review facets.

```yaml
presentQuestionDetails:
  schema: literal "brunch.structured_exchange.present"
  v: literal 1
  exchange_id: string
  tool_meta:
    curr: literal "present_question"
    next: literal "request_answer"
  display:
    heading: string
    body: string?
    preface: string?

presentOptionsDetails:
  schema: literal "brunch.structured_exchange.present"
  v: literal 1
  exchange_id: string
  tool_meta:
    curr: literal "present_options"
    next: enum        # request_choice | request_choices
  display:
    heading: string
    body: string?
    preface: string?
  options:
    - id: string
      content: string
      rationale: string?

presentReviewSetDetails:
  schema: literal "brunch.structured_exchange.present"
  v: literal 1
  exchange_id: string
  tool_meta:
    curr: literal "present_review_set"
    next: literal "request_review"
  display:
    heading: string
    body: string?
  review_set:
    nodes: ReviewSetNodeDraft[]
    edges: ReviewSetEdgeDraft[]

reviewSetNodeDraft:
  draft_id: string
  plane: enum         # intent | oracle | design | plan
  kind: string
  title: string
  body: string?
  detail: unknown?

reviewSetEdgeDraft:
  category: string
  source: ReviewSetEndpointRef
  target: ReviewSetEndpointRef
  stance: enum?       # for | against
  rationale: string?

reviewSetEndpointRef:
  oneOf:
    - draft_id: string
    - existing_code: string

presentCandidatesDetails:
  schema: literal "brunch.structured_exchange.present"
  v: literal 1
  exchange_id: string
  tool_meta:
    curr: literal "present_candidates"
    next: literal "request_choice"
  display:
    heading: string
    body: string?
  candidates: PresentedCandidate[]

presentedCandidate:
  id: string
  title: string
  user_rubric:
    core_bet: string
    best_fit: string
    cost_complexity: string
    covers_well: string
    main_risks: string
    lock_in_constraints: string
    recommendation: string?
  meta_rubric:
    legibility_cost_of_knowing: string?
    failure_modes: string?
    coverage_range: string?
    commitment: string?
  graph_refs:
    - node_id: string

requestDetails:
  schema: literal "brunch.structured_exchange.request"
  v: literal 1
  exchange_id: string
  tool_meta:
    prev: enum
    curr: enum
    next: enum?
  oneOf:
    - answered: object
    - cancelled:
        message: string?
    - unavailable:
        message: string

captureDetails:
  schema: literal "brunch.structured_exchange.capture"
  v: literal 1
  exchange_id: string
  tool_meta:
    prev: enum
    curr: enum

_rules:
  - Zod schemas under `schemas/` are the semantic source of truth for toolResult.details.
  - Pi tool parameter schemas may remain TypeBox adapter shells because `defineTool` requires TypeBox parameters; they must not define or duplicate semantic toolResult.details contracts.
  - `present_review_set.review_set` uses `nodes` / `edges`; do not introduce `proposal_entry_id`, `pitch`, `user_rubric`, `meta_rubric`, `graph_drafts`, `entity_drafts`, `edge_drafts`, `command_payload`, `basis`, or raw DB ids into the details schema.
  - Candidate rubric fields remain candidate-specific; do not copy them into review-set schemas unless SPEC/design docs are deliberately revised first.
  - Request terminal outcome is property-presence (`answered` | `cancelled` | `unavailable`), not a runtime `status` string in canonical details.
  - Capture details are transcript evidence only and contain no graph mutation payload.
```

### Risks and Assumptions

- RISK: Migrating runtime details from the legacy camelCase `schemaVersion` model to the Zod `v` / snake_case model could break public session pending-exchange projection or tests that currently consume legacy details.
  → MITIGATION: treat transcript details as the locked schema boundary and update projection adapters/tests in the same slice; keep public RPC response shapes stable unless they are themselves duplicating tool-result details.
- RISK: Retiring TypeBox too broadly could fight Pi's `defineTool` API, which expects TypeBox parameter schemas.
  → MITIGATION: draw a hard line: TypeBox may remain only for Pi tool parameters or unrelated RPC/config schemas; semantic structured-exchange `toolResult.details` shapes are Zod-only.
- RISK: The previous review-set runtime payload includes audit-ish `proposalEntryId` and graph-owned `payload` wrappers that are not in the designed review surface.
  → MITIGATION: remove those from canonical details; if later acceptance needs an audit proposal entry, derive it from the transcript entry/tool call path or scope an explicit separate metadata field outside `review_set`.
- RISK: Existing `src/graph/review-set.ts` uses camelCase graph command payload fields (`entityDrafts`, `edgeDrafts`) while the transcript details lock uses snake_case `nodes` / `edges`.
  → MITIGATION: keep translation at the adapter/domain boundary explicit and tested; do not make graph command payload naming leak into structured-exchange details.
- ASSUMPTION: The current Zod schema family is the right canonical layer to lock before runtime approval wiring.
  → IMPACT IF FALSE: approval wiring would keep accumulating adapters over unstable details and make later transcript fixtures non-comparable.
  → VALIDATE: tests parse/export every present/request/capture details variant and runtime fixtures fail if tool results emit unparseable or drifted details.
  → memory/SPEC.md §Invariants I23-L/I26-L

### Posture check

This is a proving tracer on the invariant axis. It does not prove user-visible review acceptance by itself; it stabilizes the transcript contract that all later review-cycle slices must use. Landing it should make schema drift/invention mechanically visible before approval-to-commit wiring or real `project-graph` probes run.

### Acceptance Criteria

```pseudo
schema source of truth
├── ✓ src/.pi/__tests__/structured-exchange-schemas.test.ts — every present/request/capture tool details variant parses through Zod and exports JSON Schema
├── ✓ src/.pi/__tests__/structured-exchange-schemas.test.ts — `present_review_set.review_set` accepts `nodes` / `edges` and rejects invented or retired fields (`proposal_entry_id`, `pitch`, `user_rubric`, `meta_rubric`, `graph_drafts`, `entity_drafts`, `edge_drafts`, `command_payload`, per-item `basis`, raw DB ids)
├── ✓ src/.pi/__tests__/structured-exchange-schemas.test.ts — `present_candidates` keeps its designed candidate rubric shape and rejects review-set fields
├── ✓ src/.pi/__tests__/structured-exchange-schemas.test.ts — request details use exactly-one terminal outcome object and enforce required request-change / Other / None comments
└── ✓ src/.pi/__tests__/structured-exchange-schemas.test.ts — capture details remain analysis/transcript facts and reject graph mutation payloads

runtime/projection alignment
├── ✓ src/.pi/__tests__/structured-exchange-present-request.test.ts — implemented tools emit details that parse with the canonical Zod schemas
├── ✓ src/session/exchange-projection.test.ts — present/request closure and transcript display read canonical Zod details rather than legacy hand-authored runtime guards
├── ✓ src/session/structured-exchange-loop.test.ts — pending-exchange recovery reconstructs text, option, multi-option, and review pending exchanges from canonical details
└── ✓ source assertion — no semantic structured-exchange details interface or TypeBox schema remains outside `src/.pi/extensions/structured-exchange/schemas/`; TypeBox usage under structured-exchange is limited to Pi tool parameter schemas

schema docs / topology
├── ✓ src/.pi/extensions/structured-exchange/schemas/README.md — documents the locked shapes using the same names and field vocabulary as tests
└── ✓ memory/SPEC.md / memory/PLAN.md — reconciles I23-L/I26-L and the FE-809 execution pointer if the lock changes their coverage or remaining work
```

### Verification Approach

- Inner: Zod schema parse/export tests and drift-rejection fixtures — prove every structured-exchange tool result shape is locked and copy/pasteable as JSON Schema.
- Middle: runtime/projection fixtures over Pi-like toolResult entries — prove implemented tools and session recovery consume the locked details rather than a parallel model.
- Architectural: source assertions / grep tests — prove TypeBox does not remain a semantic structured-exchange details source, while allowing Pi tool parameter TypeBox schemas as adapter-only.
- Outer: none in this card; product-path approval and real LLM proposal probes wait until the schema lock lands.

### Cross-cutting obligations

- Do not add runtime compatibility bridges for legacy details unless they are tiny, named, and removed in this same slice; migration posture is free-rewrite.
- Do not change graph truth mutation semantics; this slice locks transcript schema, not approval commit behavior.
- Do not move candidate rubric concepts into review-set details without an explicit SPEC/design revision.
- Do not create a standalone review-set RPC/entity model.
- Keep docs/tests authoritative enough that a later agent can implement unwired tools without inventing fields.

### Expected touched paths (tentative)

```pseudo
src/.pi/
├── __tests__/
│   ├── structured-exchange-schemas.test.ts            ~
│   ├── structured-exchange-present-request.test.ts    ~
│   ├── extension-registry.test.ts                     ?
│   └── operational-mode.test.ts                       ?
└── extensions/
    └── structured-exchange/
        ├── shared/
        │   ├── model.ts                               -
        │   └── recovery.ts                            ~
        ├── schemas/
        │   ├── README.md                              ~
        │   ├── shared.ts                              ~
        │   ├── present.ts                             ~
        │   ├── request.ts                             ~
        │   ├── capture.ts                             ~
        │   └── index.ts                               ~
        ├── present-question.ts                        ~
        ├── present-options.ts                         ~
        ├── present-review-set.ts                      ~
        ├── request-answer.ts                          ~
        ├── request-choice.ts                          ~
        ├── request-choices.ts                         ~
        └── request-review.ts                          ~

src/structured-exchange/
├── project/
│   ├── present-question.ts                            ~
│   ├── present-options.ts                             ~
│   ├── present-review-set.ts                          ~
│   ├── request-answer.ts                              ~
│   ├── request-choice.ts                              ~
│   ├── request-choices.ts                             ~
│   └── request-review.ts                              ~
└── format/
    ├── present-review-set.ts                          ~
    └── request-review.ts                              ~

src/session/
├── exchange-projection.ts                             ~
├── exchange-projection.test.ts                        ~
├── structured-exchange-loop.ts                        ~
└── structured-exchange-loop.test.ts                   ~

memory/
├── SPEC.md                                            ?
└── PLAN.md                                            ~
```
