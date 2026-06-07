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
- TypeBox is not a schema authoring layer for this seam; the only permitted TypeBox reference is the Pi `TSchema` cast adapter in `../pi-schema.ts`.
- `Details`, `Params`, `Payload`, and `Result` are data-type name parts, not schema-library markers.

## File layout

```text
schemas/
  README.md
  shared.ts
  present.ts
  request.ts
  capture.ts
  params.ts
  index.ts
```

The organization is layer-first: shared vocabulary, tool parameter schemas, present details, request details, capture details, and one public export barrel.

## Source boundaries

```pseudo
chain active Pi tool / session trigger / RPC editor relay
  -> parse params or relay payload at the entry boundary
  -> projections/exchanges/* constructs details
  -> relevant details Zod schema parses result
  -> renderers/structured-exchange/* renders durable markdown
```

- Active `.pi/extensions/exchanges/*.ts` files own Pi registration and UI collection only.
- `../pi-schema.ts` is the only Zod JSON Schema to Pi `TSchema` adapter.
- `projections/exchanges/*` is the only construction boundary for active present/request `toolResult.details`.
- `renderers/structured-exchange/*` owns durable markdown for active present/request emissions.
- Session pending exchange recovery projects from canonical present/request details; it does not author a TypeBox semantic schema.
- The RPC/editor relay is an intentional current product fallback and must still emit canonical details through projectors.
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
  curr: present_question | present_options | present_review_set | present_candidates
  next: request_answer | request_choice | request_choices | request_review
```

Request details:

```yaml
tool_meta:
  prev: present_question | present_options | present_review_set | present_candidates
  curr: request_answer | request_choice | request_choices | request_review
  next?: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate
```

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
  curr: present_question | present_options | present_review_set | present_candidates
  next: request_answer | request_choice | request_choices | request_review
display:
  heading: string
  body?: markdown
  preface?: markdown
```

### `present_question`

A question heading/body that presents like a normal assistant message:

```yaml
schema: "brunch.structured_exchange.present"
v: 1
exchange_id: "problem-frame"
tool_meta:
  curr: present_question
  next: request_answer
display:
  heading: "What problem are we solving first?"
  body: "Name the pain, the protagonist, and the constraint that matters most."
  preface: "We have the project shape, but not the user-facing pull yet."
```

### `present_options`

Keep the existing `present_options` name. Options have content and optional rationale.

```yaml
schema: "brunch.structured_exchange.present"
v: 1
exchange_id: "domain-shape"
tool_meta:
  curr: present_options
  next: request_choice
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

For multiple choice, `tool_meta.next` is `request_choices`.

### `present_review_set`

Keep review-set semantics conservative and defer to existing design docs. Do not turn candidate selection into a review-set flow.

```yaml
schema: "brunch.structured_exchange.present"
v: 1
exchange_id: "review-set-17"
tool_meta:
  curr: present_review_set
  next: request_review
display:
  heading: "Review proposed requirements"
  body: "Approve the set, request changes, or reject it."
review_set:
  nodes:
    - draft_id: "req-approval"
      plane: intent
      kind: requirement
      title: "Approval is atomic"
      body?: markdown
      detail?: object
  edges:
    - category: dependency | proof | support | realization | boundary | composition | association | supersession
      source: { draft_id: "req-approval" } | { existing_code: "G1" }
      target: { draft_id: "goal-review" } | { existing_code: "G1" }
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
  next: request_choice
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

## Request layer

Request terminal outcome is a property-presence union. Exactly one of `answered`, `cancelled`, or `unavailable` must be present.

```yaml
schema: "brunch.structured_exchange.request"
v: 1
exchange_id: string
tool_meta:
  prev: present_question | present_options | present_review_set | present_candidates
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
- `request_answer` follows `present_question` and may lead to `capture_answer`.
- `request_choice` follows `present_options` or `present_candidates`; after candidates it may lead to `capture_candidate`.
- `request_choices` follows `present_options` and may lead to `capture_choices`.
- `request_review` follows `present_review_set` and may lead to `capture_review`.
- `request_review` supports `approve`, `request_changes`, and `reject`; `comment` is required for `request_changes`.
- `other` and `none` choices require a user `comment`.

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

## Known gaps before runtime migration

No additional schema-contract gaps were found while implementing this schema layer. Runtime tools and projection code still use the existing tuple details model until a later migration slice deliberately rewires them to these exports.
