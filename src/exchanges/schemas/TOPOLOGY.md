# Structured-exchange schema contract

This directory owns the Zod-authored, JSON-Schema-exportable details model for structured-exchange transcript tool results. Runtime tools, session projection, pending-exchange recovery, and tests consume these schemas as the semantic source of truth.

## Naming

```ts
import * as z from "zod"

const zPresentCandidatesDetails = z.object({})
type PresentCandidatesDetails = z.infer<typeof zPresentCandidatesDetails>
const candidateDetails = zPresentCandidatesDetails.parse({})
const PresentCandidatesDetailsSchema = z.toJSONSchema(zPresentCandidatesDetails)
```

- Zod source values use the `z` prefix and are not named `*Schema`.
- Inferred TypeScript types use the bare domain name.
- `*Schema` means JSON-Schema-shaped output generated from Zod with `z.toJSONSchema(...)`.
- TypeBox is not a schema authoring layer for this seam; the only permitted TypeBox reference is the Pi `TSchema` cast adapter in `src/.pi/extensions/exchanges/pi-schema.ts`.
- `Details`, `Params`, `Payload`, and `Result` are data-type name parts, not schema-library markers.

## File layout

```text
schemas/
  TOPOLOGY.md
  shared.ts
  present.ts
  request.ts
  capture.ts
  params.ts              ask + present/request tool parameter schemas
  editor.ts
  index.ts
```

The organization is layer-first: shared vocabulary, tool parameter schemas, present details, request details, capture details, the `request_choices` editor wire envelope, and one public export barrel. `request_response` is a tool-parameter schema only: it reuses the canonical request transcript details (`request_answer` / `request_choice` / `request_choices` / `request_review`) rather than introducing a second request-details model.

`editor.ts` is not part of the transcript details model: it owns the JSON envelope prefilled into `ctx.ui.editor` for `request_choices` (the one request payload Pi built-ins cannot carry over RPC). Its wire-level `status` string never appears in transcript details, which carry outcomes as key presence.

## Source boundaries

```pseudo
chain active Pi tool / session trigger / RPC editor relay
  -> parse params or relay payload at the entry boundary
  -> src/exchanges/projections/* constructs typed details
  -> agents/contexts/exchanges/* renders provider-visible durable markdown
```

- Active `.pi/extensions/exchanges/*.ts` files own Pi registration and UI collection only.
- `src/.pi/extensions/exchanges/pi-schema.ts` is the only Zod JSON Schema to Pi `TSchema` adapter.
- `present_review_set.payload` is a **graph-owned boundary-teaching schema** (`zReviewSetProposalPayloadForBoundary` in `graph/review-set.ts`), not `z.unknown()`: the param boundary rejects a JSON string, the wrong tool's shape (e.g. `mutate_graph`'s `{createBasis, ops}`), and malformed nested companions such as `grounding: string`. The full requiredness/field-diagnostic contract stays owned by `validateReviewSetPayloadShape` in the same graph module; the boundary schema advertises `lens`, `epistemicStatus`, `grounding {summary, support[]}`, `pitch {title, narrative}`, `entityDrafts[]`, and role-named `edgeDrafts[]` so the model sees the nested structure before the deep validator runs.
- `src/exchanges/projections/*` is the only construction boundary for active present/request `toolResult.details`.
- `agents/contexts/exchanges/*` owns durable provider-visible markdown for active present/request emissions.
- Session pending exchange recovery projects from canonical present/request details; it does not author a TypeBox semantic schema.
- The RPC/editor relay is an intentional current product fallback and must still emit canonical details through projectors.
- Details schemas remain the read-side recognizer for persisted transcript `toolResult.details`; write-side projection constructors rely on typed branch construction after boundary validation.
- The proof-era `brunch.structured_exchange.result` details model is retired.

## Global details header

All detail payloads carry checked discriminants:

```yaml
schema: "brunch.structured_exchange.present" | "brunch.structured_exchange.request" | "brunch.structured_exchange.capture"
v: 1
exchange_id: string
```

- `schema` identifies structured-exchange details without trusting `toolName` alone.
- `v` is validated; unsupported versions fail parsing and should be ignored by readers.
- Use `v`, not `schema_version`, in this Zod-authored model.

## Tool sequencing metadata

No `phase` field is used. Layer and `tool_meta.curr` are sufficient.

Present details:

```yaml
tool_meta:
  curr: present_question | present_review_set | present_candidates | present_digest
  next: request_response
```

Request details:

```yaml
tool_meta:
  prev: present_question | present_review_set | present_candidates | present_digest
  curr: request_answer | request_choice | request_choices | request_review
  next?: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate
```

`ask({ exchangeId, body, options?, multiple? })` emits canonical standalone ask request details carrying the question echo and answer in one result. `request_response({ exchangeId })` now emits canonical request details for surviving offer presents only: `request_choice` for `present_candidates`, and `request_review` for a `present_review_set` or `present_digest` decision.

Capture details:

```yaml
tool_meta:
  prev: request_answer | request_choice | request_choices | request_review
  curr: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate
```

Do not add `present_tool`, `kind`, `expected_request`, `prev_required`, `next_required`, present-side `status: presented`, or request-side string `status` fields in this model.

## `comment` and `message`

- `comment` is user-authored supplementary text: option-selection explanation, required Other/None explanation, review change-request rationale, or rejection reason when supplied.
- `message` is system/tool/runtime-authored explanatory text: cancellation text, unavailable UI text, invalid JSON in editor fallback, or unknown choice diagnostics.
- Do not use `note` in the new schema model.

## Present layer

General present shape:

```yaml
schema: "brunch.structured_exchange.present"
v: 1
exchange_id: string
tool_meta:
  curr: present_question | present_review_set | present_candidates | present_digest
  next: request_response
response_kind?: answer | choice | choices
display:
  heading: string
  body?: markdown
  preface?: markdown
```

### `present_question`

A merged question/offer anchor. No `options` means free text; `options` means a single choice; `options` with `multiple: true` in params projects `response_kind: choices`.

```yaml
schema: "brunch.structured_exchange.present"
v: 1
exchange_id: "problem-frame"
tool_meta:
  curr: present_question
  next: request_response
response_kind: answer
display:
  heading: "What problem are we solving first?"
  body: "Name the pain, the protagonist, and the constraint that matters most."
  preface: "We have the project shape, but not the user-facing pull yet."
```

```yaml
schema: "brunch.structured_exchange.present"
v: 1
exchange_id: "domain-shape"
tool_meta:
  curr: present_question
  next: request_response
response_kind: choice
display:
  heading: "Which product shape should we optimize for?"
  body: "Pick the shape that best matches the POC posture."
options:
  - id: "local-first"
    content: "Local-first app"
    rationale: "Matches the current single-machine POC constraint."
  - id: "cloud-collab"
    content: "Cloud collaboration app"
    rationale: "Better for teams, but outside the current deployment target."
```

### `present_review_set`

Keep review-set semantics conservative and defer to existing design docs. Do not turn candidate selection into a review-set flow.

```yaml
schema: "brunch.structured_exchange.present"
v: 1
exchange_id: "review-set-17"
tool_meta:
  curr: present_review_set
  next: request_response
display:
  heading: "Review proposed requirements"
  body: "Approve the set, request changes, or reject it."
review_set:
  nodes:
    - draft_id: "req-approval"
      proposed_code: "REQ1"
      plane: intent
      kind: requirement
      title: "Approval is atomic"
      body?: markdown
      detail?: object
  edges:
    - category: dependency | proof | support | realization | boundary | composition | association | supersession
      dependency?: { draft_id: "req-approval" } | { existing_code: "REQ1" }
      dependent?: { draft_id: "goal-review" } | { existing_code: "G1" }
      oracle?: { draft_id: "check-launch" } | { existing_code: "CHK1" }
      claim?: { draft_id: "goal-review" } | { existing_code: "G1" }
      support?: { draft_id: "req-approval" } | { existing_code: "REQ1" }
      abstract?: { draft_id: "goal-review" } | { existing_code: "G1" }
      concrete?: { draft_id: "req-approval" } | { existing_code: "REQ1" }
      boundary?: { draft_id: "guardrail" } | { existing_code: "B1" }
      subject?: { draft_id: "goal-review" } | { existing_code: "G1" }
      whole?: { draft_id: "goal-review" } | { existing_code: "G1" }
      part?: { draft_id: "req-approval" } | { existing_code: "REQ1" }
      a?: { draft_id: "req-approval" } | { existing_code: "REQ1" }
      b?: { draft_id: "goal-review" } | { existing_code: "G1" }
      successor?: { draft_id: "goal-review-v2" } | { existing_code: "G2" }
      predecessor?: { draft_id: "goal-review-v1" } | { existing_code: "G1" }
      stance?: for | against
      rationale?: markdown
```

Rules:

- `review_set` contains only `nodes` and `edges` in transcript details.
- Proposal audit ids and graph command payloads stay outside `toolResult.details`; later acceptance derives graph commands at the graph adapter/domain boundary.
- Do not add `proposal_entry_id`, `pitch`, `user_rubric`, `meta_rubric`, `graph_drafts`, `entity_drafts`, `edge_drafts`, `command_payload`, per-item `basis`, or raw DB ids to this details shape.
- Candidate rubrics are candidate-specific; do not copy candidate comparison facets into review-set details.

### `present_candidates`

Exact approved shape:

```yaml
schema: "brunch.structured_exchange.present"
v: 1
exchange_id: string
tool_meta:
  curr: present_candidates
  next: request_response
display:
  heading: string
  body?: markdown
candidates:
  - id: string
    title: string
    user_rubric:
      core_bet: markdown
      best_fit: markdown
      cost_complexity: markdown
      covers_well: markdown
      main_risks: markdown
      lock_in_constraints: markdown
      recommendation?: markdown
    meta_rubric:
      legibility_cost_of_knowing?: markdown
      failure_modes?: markdown
      coverage_range?: markdown
      commitment?: markdown
    graph_refs:
      - node_id: string
```

Rules:

- `core_bet` is the headline/thesis of the candidate-proposal unit.
- `user_rubric` is the human-readable comparison surface.
- `meta_rubric` is persisted internal reasoning trace for later capture; it is not necessarily rendered by default.
- The assistant may reason in D31-L meta-rubric axes, then derive the user rubric.
- `graph_refs` are per-candidate and consist strictly of `{ node_id: string }`.
- Do not add roles, caveats, assumptions, observations, grounding prose, or ad-hoc text to `graph_refs`.
- Avoid low/medium/high scalar ratings for cost, risk, confidence, or timeline.

User-facing facets replace confidence/timeline/complexity/risk/verification/key-tradeoff scalar surfaces:

- `core_bet`: why choose this option.
- `best_fit`: what you get.
- `cost_complexity`: what it costs you.
- `covers_well`: what it hits.
- `main_risks`: what it misses.
- `lock_in_constraints`: what it commits you to.
- `recommendation`: the LLM's opinion.

Relationship to D31-L meta-rubric:

- `legibility_cost_of_knowing`, `failure_modes`, `coverage_range`, and `commitment` are internal meta axes.
- `best_fit` derives from legibility/cost of knowing plus coverage range.
- `cost_complexity` derives from legibility/cost of knowing plus commitment.
- `covers_well` derives from coverage range.
- `main_risks` derives from failure modes plus coverage range.
- `lock_in_constraints` derives from commitment.
- `recommendation` may draw on all facets.

### `present_digest`

`present_digest` carries prose-only large-source review material. It is not a review-set or graph-proposal carrier: `digest.abstract` is required and nonblank (trim-based `zNonBlankMarkdown` in `shared.ts`), `digest.analysis` and `digest.recommendation` are optional markdown, and graph draft / node / edge / command payload fields are rejected at the params/detail boundary. Its terminal is the existing review response vocabulary through `request_response`; approval echoes the accepted abstract (same nonblank boundary) on request details so sweep reads have one self-contained digest carrier.

## Request layer

Request terminal outcome is a property-presence union. Exactly one of `answered`, `cancelled`, or `unavailable` must be present.

```yaml
schema: "brunch.structured_exchange.request"
v: 1
exchange_id: string
tool_meta:
  prev: present_question | present_review_set | present_candidates
  curr: request_answer | request_choice | request_choices | request_review
  next?: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate
answered:
  # variant-specific payload
cancelled?:
  message?: string
unavailable?:
  message: string
```

Rules:

- Use `comment`, not `note`, for user-authored supplementary text.
- `message` appears only under `cancelled` or `unavailable`.
- `request_answer` follows `present_question` free-text prompts and may lead to `capture_answer`; answered text must be non-empty after trimming.
- `request_choice` follows `present_question` option prompts or `present_candidates`; after candidates it may lead to `capture_candidate`.
- `request_choices` follows `present_question` multi-option prompts and may lead to `capture_choices`.
- `request_review` follows `present_review_set` or `present_digest` and may lead to `capture_review`.
- `request_review` supports `approve`, `request_changes`, and `reject`; `comment` is required for `request_changes`. Digest approvals also carry `accepted_abstract` as the sweep-visible digest echo.
- `other` and `none` choices require a user `comment`.
- `request_choice` and `request_choices` answered payloads carry `answered.options`: the full listed option echo from the pending present (`id`, `content`, optional `rationale`). Selected write-ins stay in `choice(s)` as `kind: other | none`; they are not appended to `options`.

Variant payload examples:

```yaml
request_answer answered:
  answered:
    text: "The hard part is keeping the agent and graph coherent across sessions."
```

```yaml
request_choice answered:
  answered:
    choice:
      id: "local-first"
      label: "Local-first app"
      kind: listed
    options:
      - id: "local-first"
        content: "Local-first app"
        rationale: "Best matches the POC posture."
      - id: "cloud-first"
        content: "Cloud-hosted collaboration"
    comment: "This fits the POC constraints."
```

```yaml
request_choices answered:
  answered:
    choices:
      - id: "transport"
        label: "Transport contract"
        kind: listed
      - id: "chrome"
        label: "Chrome recovery"
        kind: listed
    options:
      - id: "transport"
        content: "Transport contract"
      - id: "chrome"
        content: "Chrome recovery"
        rationale: "Presentation debt blocks walkthrough quality."
    comment: "These are the ones I care about before graph work."
```

```yaml
request_review answered:
  answered:
    decision: request_changes
    comment: "Regenerate this with clearer non-goals."
```

```yaml
cancelled:
  message: "User cancelled."
```

```yaml
unavailable:
  message: "request_choices requires interactive UI."
```

## Capture layer

Capture exists, but graph payloads are intentionally not designed in this schema pass.

Minimum shape:

```yaml
schema: "brunch.structured_exchange.capture"
v: 1
exchange_id: string
tool_meta:
  prev: request_answer | request_choice | request_choices | request_review
  curr: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate
```

Rules:

- Capture is where semantic/generative post-response work happens.
- For `present_candidates`, graph generation happens after the user chooses a candidate.
- `capture_candidate` draws on the selected candidate description, meta rubric, graph refs, selected choice, and user comment from prior transcript evidence.
- `present_candidates` may carry meta-rubric reasoning trace in details for later capture.
- `present_candidates` does not generate graph sets directly.
- Do not add ad-hoc observations to present details for later capture.
- All semantic capture happens at `capture_*`.
- Actual graph writes still route through `CommandExecutor`.
- Do not invent committed graph nodes, graph edges, LSNs, `CommandExecutor` results, assumptions, caveats, observations, or graph payload fields in capture details.

Examples:

```yaml
capture_answer:
  schema: "brunch.structured_exchange.capture"
  v: 1
  exchange_id: "problem-frame"
  tool_meta:
    prev: request_answer
    curr: capture_answer
```

```yaml
capture_choice:
  schema: "brunch.structured_exchange.capture"
  v: 1
  exchange_id: "domain-shape"
  tool_meta:
    prev: request_choice
    curr: capture_choice
```

```yaml
capture_choices:
  schema: "brunch.structured_exchange.capture"
  v: 1
  exchange_id: "open-risks"
  tool_meta:
    prev: request_choices
    curr: capture_choices
```

```yaml
capture_review:
  schema: "brunch.structured_exchange.capture"
  v: 1
  exchange_id: "review-set-17"
  tool_meta:
    prev: request_review
    curr: capture_review
```

```yaml
capture_candidate:
  schema: "brunch.structured_exchange.capture"
  v: 1
  exchange_id: "candidate-direction"
  tool_meta:
    prev: request_choice
    curr: capture_candidate
```

`capture_candidate` consumes the selected candidate id from the prior `request_choice`; do not duplicate candidate, user-rubric, or meta-rubric payloads into capture details unless a later design approves that change.

## Migration state

Runtime migration is complete: Pi exchange tools, `src/exchanges/projections/*`, session recovery, and the RPC relay all consume these exports. The proof-era tuple details model is retired (D105-L, D108-L).
