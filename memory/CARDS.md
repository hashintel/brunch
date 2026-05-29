<!-- CARDS.md — temporary scope-card queue inside one frontier item.
     Created by ln-scope. Delete when exhausted or superseded.
     Frontier boundary: pi-ui-extension-patterns / FE-744.
-->

# Structured-exchange schema authoring queue

## Orientation

- **Containing seam:** `src/tui-client/.pi/extensions/structured-exchange/`, inside the FE-744 `pi-ui-extension-patterns` frontier.
- **Current durable change:** `memory/SPEC.md` D41-L now permits Zod v4 as a product/protocol schema source when JSON Schema export is proven; TypeBox remains valid for direct JSON-Schema-shaped seams.
- **Main open risk:** schema authoring can drift from the carefully designed thread model by adding plausible fields, changing names, or prematurely filling underspecified areas.
- **Cross-cutting obligations:** preserve Pi transcript truth (`present_* -> request_* -> capture_*` toolResult details), classify by typed details rather than tool name alone, keep public/Pi boundaries JSON-Schema-exportable, and route future graph writes through `CommandExecutor` only.

## Queue discipline

These cards stay inside the existing FE-744 frontier and branch. They do not create new Linear issues or branches. Build in order.

**Strict no-drift rule:** implement exactly the model captured below. Do not add fields because they seem useful. If implementation pressure suggests a new field, stop and ask; do not improvise.

## Exact captured design from this thread

This section is the volatile handoff. Treat it as binding for the build.

### Schema naming

User convention:

```ts
import * as z from "zod"

// schema value / Zod source runtime parser
const zPresentCandidatesDetails = z.object({})

// inferred type
type PresentCandidatesDetails = z.infer<typeof zPresentCandidatesDetails>

// parsing
const candidateDetails = zPresentCandidatesDetails.parse({})

// JSON schema conversion
const PresentCandidatesDetailsSchema = z.toJSONSchema(zPresentCandidatesDetails)
```

Rules:

- Do **not** name Zod source values `*Schema`.
- Zod source values use `z` prefix: `zPresentCandidatesDetails`.
- Inferred TS types use the bare domain name: `PresentCandidatesDetails`.
- `*Schema` suffix means “this is JSON Schema-shaped”. It is allowed for:
  - JSON Schema generated from Zod with `z.toJSONSchema(...)`.
  - TypeBox schemas, because TypeBox schemas are already JSON-Schema-shaped.
- If TypeBox source values need a library prefix in a non-boundary helper, use `tb*`.
- Words such as `Details`, `Params`, `Payload`, and `Result` are data-type name parts; they do not identify a schema library.

### File organization

Use layer-first organization:

```text
src/tui-client/.pi/extensions/structured-exchange/schemas/
  README.md
  shared.ts
  present.ts
  request.ts
  capture.ts
  index.ts
```

Reason: ease of overview and sharing. `capture.ts` exists because `capture_` tools are the fourth schema layer discussed in this thread.

### Global details header rule

`schema` and `v` are realistic only if readers validate them. We chose to keep them as checked discriminants.

```yaml
details_header:
  schema: "brunch.structured_exchange.present" | "brunch.structured_exchange.request" | "brunch.structured_exchange.capture"
  v: 1
  exchange_id: string
```

Rules:

- `schema` discriminates structured-exchange details from ordinary tool results without trusting `toolName` alone.
- `v` must be validated; unsupported versions should fail/ignore rather than silently parse.
- Use `v`, not `schema_version`, in the new Zod-authored details model.

### `tool_meta` sequence/sibling information

We rejected separate `present_tool`, `kind`, and `expected_request` fields in favor of a compact sequence descriptor.

We considered `tool_kind`, then preferred something like `tool_meta`.

Present side:

```yaml
tool_meta:
  curr: present_question | present_options | present_review_set | present_candidates
  next: request_answer | request_choice | request_choices | request_review
```

Request side:

```yaml
tool_meta:
  prev: present_question | present_options | present_review_set | present_candidates
  curr: request_answer | request_choice | request_choices | request_review
  next?: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate
```

Capture side:

```yaml
tool_meta:
  prev: request_answer | request_choice | request_choices | request_review
  curr: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate
```

Rules:

- No `phase` field. It proves nothing; it is derivable from `curr` / layer.
- No present-side `status: presented`. If a present result exists, it was presented.
- No `prev_required` / `next_required` fields for now.
- Request terminal state is **not** a string `status`; it is a property-presence union.

### `comment` vs `message`

Rule:

```yaml
comment:
  meaning: user-authored supplementary text
  source: human input
  examples:
    - optional explanation after selecting a listed option
    - required explanation for Other / None
    - review change-request rationale
    - rejection reason if user supplies one

message:
  meaning: system-authored explanatory text
  source: Brunch/tool/runtime
  examples:
    - "User cancelled the request."
    - "request_choices requires interactive UI."
    - "Invalid JSON in editor fallback."
    - "Unknown choice id."
```

Do not use `note` in the new schema model. Use `comment` for user input and `message` for system/runtime explanation.

## Present layer: exact shapes and rules

### General present shape

```yaml
present:
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

### `present_options` naming

The drift was `present_option_set` vs `present_options`. Decision: keep `present_options`; the existing tool name is fine.

### `present_candidates`

This is the exact shape the user wrote and approved:

```yaml
present_candidates:
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

Rules for `present_candidates`:

- `core_bet` effectively acts as the headline/thesis of the candidate-proposal unit.
- `user_rubric` is the human-readable comparison surface.
- `meta_rubric` is persisted internal reasoning trace for later capture; it may be used by the assistant/capture step but is not necessarily rendered by default.
- Internally, the assistant may reason in terms of the four D31-L meta-rubric axes, then derive the `user_rubric` structure for the `present_candidates` tool.
- `graph_refs` are per-candidate.
- `graph_refs` consist strictly of graph node references: `{ node_id: string }` only.
- Do **not** add roles, caveats, assumptions, observations, grounding prose, or ad-hoc text to `graph_refs`.
- If such information matters, it should either already be in the graph or be captured in the `capture_` phase.
- Avoid low/medium/high scalar ratings for cost/risk/confidence/timeline by default; they usually obscure comparison rather than clarify.

User-facing rubric remap captured from conversation:

```yaml
instead_of:
  - Confidence
  - Timeline
  - Complexity
  - Risk
  - Verification
  - Key tradeoff

use:
  core_bet: "why choose this option"
  best_fit: "what you get"
  cost_complexity: "what it costs you"
  covers_well: "what it hits"
  main_risks: "what it misses"
  lock_in_constraints: "what it commits you to"
  recommendation: "the LLM's opinion"
```

Relationship to D31-L meta-rubric:

```yaml
internal_meta_axes:
  - legibility_cost_of_knowing
  - failure_modes
  - coverage_range
  - commitment

user_facing_facets:
  core_bet:
    role: headline / product-thesis-fit
    question: "What thesis is this option making, and why would we choose it?"
  best_fit:
    role: where this option shines
    sources: [legibility_cost_of_knowing, coverage_range]
  cost_complexity:
    role: what it asks of us
    sources: [legibility_cost_of_knowing, commitment]
  covers_well:
    role: positive coverage
    sources: [coverage_range]
  main_risks:
    role: negative coverage / failure
    sources: [failure_modes, coverage_range]
  lock_in_constraints:
    role: downstream commitment
    sources: [commitment]
  recommendation:
    role: agent judgment
    sources: [all_facets]
```

### Other present tools

The thread did not fully redesign exact payloads for `present_question`, `present_options`, or `present_review_set` beyond the general present shape and existing tool family names. Build conservative schemas from the existing implementation and the rules above. Do **not** invent extra candidate/review semantics beyond what is already in code/docs.

Known from the original sketch:

```yaml
present_question:
  purpose: question heading and body; presentationally looks like normal assistant message

present_options:
  purpose: options, each with content and optional rationale

present_review_set:
  purpose: requirement or criterion nodes proposed as a set
  caution: review-set semantics are documented elsewhere; do not make candidate selection into a review-set flow
```

Examples to include in README/tests where useful:

#### `present_question`

```yaml
present_question:
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

#### `present_options` for single choice

```yaml
present_options:
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

#### `present_options` for multiple choices

```yaml
present_options:
  schema: "brunch.structured_exchange.present"
  v: 1
  exchange_id: "open-risks"

  tool_meta:
    curr: present_options
    next: request_choices

  display:
    heading: "Which risks should we keep visible?"
    body: "Choose one or more risks to carry into the next slice."

  options:
    - id: "transport"
      content: "Transport contract"
      rationale: "Public RPC behavior is now a product seam."
    - id: "chrome"
      content: "Chrome recovery"
      rationale: "Visual product ownership remains open before FE-744 closes."
```

#### `present_review_set` conservative example

```yaml
present_review_set:
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
    proposal_entry_id: "entry-review-proposal-17"
```

Do not elaborate `review_set` beyond existing design docs unless the builder first routes back through design/spec.

## Request layer: exact shapes and rules

Request details use property presence as the terminal discriminator. Runtime code should check for property presence.

```yaml
request:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: string

  tool_meta:
    prev: present_question | present_options | present_review_set | present_candidates
    curr: request_answer | request_choice | request_choices | request_review
    next?: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate

  answered:
    # variant-specific payload here
  cancelled?:
    message?: string
  unavailable?:
    message: string
```

But the schema must enforce exactly one of:

```yaml
- answered
- cancelled
- unavailable
```

Pseudo-TypeScript intent:

```ts
type RequestDetails = RequestBase &
  (
    | { answered: AnsweredPayload; cancelled?: never; unavailable?: never }
    | { answered?: never; cancelled: { message?: string }; unavailable?: never }
    | { answered?: never; cancelled?: never; unavailable: { message: string } }
  )
```

### Request examples: every variant and terminal outcome

#### `request_answer` — answered

```yaml
request_answer:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "problem-frame"

  tool_meta:
    prev: present_question
    curr: request_answer
    next: capture_answer

  answered:
    text: "The hard part is keeping the agent and graph coherent across sessions."
```

#### `request_answer` — cancelled

```yaml
request_answer:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "problem-frame"

  tool_meta:
    prev: present_question
    curr: request_answer

  cancelled:
    message: "User cancelled."
```

#### `request_answer` — unavailable

```yaml
request_answer:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "problem-frame"

  tool_meta:
    prev: present_question
    curr: request_answer

  unavailable:
    message: "request_answer requires interactive UI."
```

#### `request_choice` after `present_options` — answered with listed choice

```yaml
request_choice:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "domain-shape"

  tool_meta:
    prev: present_options
    curr: request_choice
    next: capture_choice

  answered:
    choice:
      id: "local-first"
      label: "Local-first app"
      kind: listed
    comment: "This fits the POC constraints."
```

#### `request_choice` after `present_options` — answered with other choice

```yaml
request_choice:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "domain-shape"

  tool_meta:
    prev: present_options
    curr: request_choice
    next: capture_choice

  answered:
    choice:
      id: "other"
      label: "A local-first app with optional cloud sync later"
      kind: other
    comment: "The listed local-first option is close, but cloud sync should stay imaginable."
```

#### `request_choice` after `present_options` — answered with none choice

```yaml
request_choice:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "domain-shape"

  tool_meta:
    prev: present_options
    curr: request_choice
    next: capture_choice

  answered:
    choice:
      id: "none"
      label: "None of these"
      kind: none
    comment: "All of these assume too much about deployment."
```

#### `request_choice` after `present_candidates` — answered

```yaml
request_choice:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "candidate-direction"

  tool_meta:
    prev: present_candidates
    curr: request_choice
    next: capture_candidate

  answered:
    choice:
      id: "candidate-local-workbench"
      label: "Local workbench for graph-native specs"
      kind: listed
    comment: "This matches the product thesis; carry over the chrome/coherence emphasis."
```

#### `request_choice` — cancelled

```yaml
request_choice:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "domain-shape"

  tool_meta:
    prev: present_options
    curr: request_choice

  cancelled:
    message: "User cancelled."
```

#### `request_choice` — unavailable

```yaml
request_choice:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "domain-shape"

  tool_meta:
    prev: present_options
    curr: request_choice

  unavailable:
    message: "request_choice requires interactive UI."
```

#### `request_choices` — answered with listed choices

```yaml
request_choices:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "open-risks"

  tool_meta:
    prev: present_options
    curr: request_choices
    next: capture_choices

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

#### `request_choices` — answered with listed plus other

```yaml
request_choices:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "open-risks"

  tool_meta:
    prev: present_options
    curr: request_choices
    next: capture_choices

  answered:
    choices:
      - id: "transport"
        label: "Transport contract"
        kind: listed
      - id: "other"
        label: "Schema source-of-truth drift"
        kind: other
    comment: "The schema-library decision could affect both runtime and web client boundaries."
```

#### `request_choices` — answered with none

```yaml
request_choices:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "open-risks"

  tool_meta:
    prev: present_options
    curr: request_choices
    next: capture_choices

  answered:
    choices:
      - id: "none"
        label: "None of these"
        kind: none
    comment: "These are not the risks I want to prioritize."
```

#### `request_choices` — cancelled

```yaml
request_choices:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "open-risks"

  tool_meta:
    prev: present_options
    curr: request_choices

  cancelled:
    message: "User cancelled."
```

#### `request_choices` — unavailable

```yaml
request_choices:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "open-risks"

  tool_meta:
    prev: present_options
    curr: request_choices

  unavailable:
    message: "request_choices requires interactive UI."
```

#### `request_review` — approve

```yaml
request_review:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "review-set-17"

  tool_meta:
    prev: present_review_set
    curr: request_review
    next: capture_review

  answered:
    decision: approve
    comment: "This is ready to commit."
```

#### `request_review` — request changes

```yaml
request_review:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "review-set-17"

  tool_meta:
    prev: present_review_set
    curr: request_review
    next: capture_review

  answered:
    decision: request_changes
    comment: "Regenerate this with clearer non-goals."
```

#### `request_review` — reject

```yaml
request_review:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "review-set-17"

  tool_meta:
    prev: present_review_set
    curr: request_review
    next: capture_review

  answered:
    decision: reject
    comment: "This is solving the wrong problem."
```

#### `request_review` — cancelled

```yaml
request_review:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "review-set-17"

  tool_meta:
    prev: present_review_set
    curr: request_review

  cancelled:
    message: "User cancelled."
```

#### `request_review` — unavailable

```yaml
request_review:
  schema: "brunch.structured_exchange.request"
  v: 1
  exchange_id: "review-set-17"

  tool_meta:
    prev: present_review_set
    curr: request_review

  unavailable:
    message: "request_review requires interactive UI."
```

Request rules:

- Use `comment`, not `note`, for user-authored supplementary text.
- `request_choice` can follow `present_options` or `present_candidates`.
- If `request_choice` follows `present_candidates`, the later capture tool is `capture_candidate`.
- `request_choices` follows `present_options`.
- `request_review` follows `present_review_set`.
- `request_review` supports `approve`, `request_changes`, and `reject`; `comment` is required for `request_changes`.
- `other` / `none` choices require a user `comment`.

## Capture layer: exact decisions and limits

The thread established a capture layer but did **not** fully design graph payload schemas. Do not invent them.

Decisions:

- There will be `capture_` tool entries after `request_` tool results.
- Capture is where semantic/generative work happens after user response.
- For `present_candidates`, graph generation happens **after** the user makes a choice.
- `capture_candidate` draws on:
  - the selected candidate’s user-facing description (`user_rubric`),
  - the selected candidate’s internal `meta_rubric`,
  - the selected candidate’s `graph_refs`,
  - the user’s selected choice,
  - the user’s `comment`, if any.
- `present_candidates` may capture meta-rubric reasoning trace in `details`; that trace is later input to capture.
- `present_candidates` does **not** generate graph sets directly.
- Do not add ad-hoc observations to present details for later capture.
- All semantic capture happens at `capture_*`.
- Actual graph writes still route through `CommandExecutor`.

Minimum capture sequence shape discussed:

```yaml
capture:
  schema: "brunch.structured_exchange.capture"
  v: 1
  exchange_id: string

  tool_meta:
    prev: request_answer | request_choice | request_choices | request_review
    curr: capture_answer | capture_choice | capture_choices | capture_review | capture_candidate
```

Do **not** add committed graph nodes, graph edges, LSNs, or `CommandExecutor` result fields to capture details in this schema pass unless the user explicitly approves a concrete shape.

Capture examples for every current permutation:

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

`capture_candidate` consumes the selected candidate id from the prior `request_choice`; do not duplicate candidate/user/meta rubric payloads into capture details unless the user approves that change.

## Prepared scope-card queue

---

## Card 1 — Write schema README from exact captured contract

**Weight:** full scope card  
**Status:** next

### Target Behavior

The structured-exchange schema directory contains a README that records the exact naming, layering, validation, export, and semantic-boundary rules captured above.

### Boundary Crossings

```text
-> memory/CARDS.md exact captured design contract
-> src/tui-client/.pi/extensions/structured-exchange/schemas/README.md
-> future schema implementation guardrails
```

### Risks and Assumptions

- **RISK:** The README introduces new drift.  
  -> **MITIGATION:** copy the captured contract faithfully; do not add fields or new vocabulary.
- **RISK:** The README becomes design prose that tests do not enforce.  
  -> **MITIGATION:** Cards 2+ add tests for machine-checkable rules.

### Acceptance Criteria

- [ ] `src/tui-client/.pi/extensions/structured-exchange/schemas/README.md` exists.
- [ ] README captures the exact naming rules, file layout, header, `tool_meta`, `comment`/`message`, present, request, candidate, and capture rules above.
- [ ] README explicitly says not to invent graph payload fields in capture details.

### Verification Approach

- **Inner:** Markdown review against this card.
- **Middle:** none unless formatting tools touch markdown.
- **Outer:** none.

### Cross-cutting obligations

- Do not implement schemas in Card 1.
- Do not migrate runtime code in Card 1.

---

## Card 2 — Add shared Zod primitives and JSON Schema export convention

**Weight:** full scope card  
**Status:** queued

### Target Behavior

The schema layer exposes shared Zod primitives for the exact shared vocabulary captured above.

### Acceptance Criteria

- [ ] `zod` is added as a dependency.
- [ ] `schemas/shared.ts` defines `z*` source schemas and bare inferred types for the details header, markdown string alias, graph node ref, tool names, and `tool_meta` variants.
- [ ] JSON Schema exports use the `*Schema` suffix only for JSON-Schema-shaped outputs.
- [ ] Tests prove representative shared schemas parse and export via `z.toJSONSchema(..., { unrepresentable: "throw" })`.

### Verification Approach

- **Inner:** targeted Vitest parse/export tests.
- **Middle:** `npm run fix`.
- **Gate:** `npm run verify` before commit.

### Cross-cutting obligations

- Do not alter existing runtime structured-exchange parsing/projection.

---

## Card 3 — Add present detail Zod schemas

**Weight:** full scope card  
**Status:** queued

### Target Behavior

The schema layer models the present-side details vocabulary captured above without adding fields.

### Acceptance Criteria

- [ ] `schemas/present.ts` defines `zPresentQuestionDetails`, `zPresentOptionsDetails`, `zPresentReviewSetDetails`, `zPresentCandidatesDetails`, and a present union.
- [ ] `zPresentCandidatesDetails` exactly captures the approved `present_candidates` shape.
- [ ] Invalid candidate `graph_refs` with fields other than `node_id` fail validation.
- [ ] No present schema includes `phase`, `status`, `next_required`, `schema_version`, ad-hoc assumptions/caveats/observations, or scalar rating fields.
- [ ] JSON Schema export succeeds.

### Verification Approach

- **Inner:** targeted Vitest parse/export tests.
- **Middle:** `npm run fix`.
- **Gate:** `npm run verify` before commit.

### Cross-cutting obligations

- Use conservative shapes for `present_question`, `present_options`, and `present_review_set`; do not elaborate beyond existing implementation/docs and captured rules.

---

## Card 4 — Add request detail Zod schemas

**Weight:** full scope card  
**Status:** queued

### Target Behavior

The schema layer models request-side details as exactly-one property-presence terminal outcome unions.

### Acceptance Criteria

- [ ] `schemas/request.ts` defines `zRequestAnswerDetails`, `zRequestChoiceDetails`, `zRequestChoicesDetails`, `zRequestReviewDetails`, and a request union.
- [ ] Request schemas accept exactly one of `answered`, `cancelled`, or `unavailable`.
- [ ] Tests reject multiple outcomes and missing outcome.
- [ ] `comment` appears only in user-authored answered payloads.
- [ ] `message` appears only in `cancelled` / `unavailable` system-authored payloads.
- [ ] `request_choice` supports `prev: present_options | present_candidates`.
- [ ] `request_review` requires `comment` when `decision = request_changes`.
- [ ] JSON Schema export succeeds.

### Verification Approach

- **Inner:** targeted Vitest parse/export tests.
- **Middle:** `npm run fix`.
- **Gate:** `npm run verify` before commit.

### Cross-cutting obligations

- Do not change public RPC behavior in this card.

---

## Card 5 — Add capture detail Zod schemas at the agreed minimum

**Weight:** full scope card  
**Status:** queued

### Target Behavior

The schema layer models capture-side details only to the extent explicitly agreed: header plus request-to-capture `tool_meta` sequencing.

### Acceptance Criteria

- [ ] `schemas/capture.ts` defines capture tool-name schemas and minimal capture detail schemas for `capture_answer`, `capture_choice`, `capture_choices`, `capture_review`, and `capture_candidate`.
- [ ] Capture schemas include `schema`, `v`, `exchange_id`, and capture `tool_meta`.
- [ ] `capture_candidate` may include `selected_candidate_id` only if implementation keeps it as the selected choice id already recorded by request; do not add graph payloads.
- [ ] Capture schemas do not include committed graph nodes, graph edges, LSNs, `CommandExecutor` results, assumptions, caveats, or observations.
- [ ] JSON Schema export succeeds.

### Verification Approach

- **Inner:** targeted Vitest parse/export tests.
- **Middle:** `npm run fix`.
- **Gate:** `npm run verify` before commit.

### Cross-cutting obligations

- Capture remains a transcript layer, not graph truth.
- If the builder feels capture needs prose analysis fields, stop and ask; do not invent them.

---

## Card 6 — Consolidate schema exports and gap report

**Weight:** light scope card  
**Status:** queued

### Objective

The structured-exchange schema layer exports a coherent public surface and records unresolved gaps before runtime migration begins.

### Acceptance Criteria

- [ ] `schemas/index.ts` re-exports the intended schema/type surface.
- [ ] README has a short “Known gaps before runtime migration” section only if implementation reveals gaps.
- [ ] Existing runtime code is not migrated in this queue.

### Verification Approach

- **Inner:** import/compile smoke via targeted tests.
- **Middle:** `npm run fix`.
- **Gate:** `npm run verify` before commit.

### Assumption dependency

Depends on: D41-L as revised — Zod v4 source schemas are allowed when JSON Schema export is proven.
