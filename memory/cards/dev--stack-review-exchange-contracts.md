# Stack review: structured-exchange contract hardening

Frontier: n/a
Status:   active
Mode:     slices
Created:  2026-07-06

## Orientation

- Containing seam: structured-exchange schemas, projections, model-facing render oracles, and Pi exchange collectors; sourced from PR #288/#292/#293 open comments.
- Current branch: `ln/fe-1152-refinements` stack tip. These repairs harden closed exchange arcs rather than reopening their product scope.
- Posture: earned closure inside settled seams, with repo-level high stakes: validate boundary data loudly and make invalid terminal states unrepresentable.
- Main risk: fixing one path (TUI, RPC, model-facing render, or projection) while leaving a parallel path with the old contract.

## Card 1 — make multi-line render honesty location-sensitive enough to fail omissions

Status: next
Weight: full

### Target Behavior

A multi-line structured-exchange leaf is not considered rendered merely because its lines appear in unrelated parts of the formatted text.

### Full-card cold-start reads

- `memory/SPEC.md` — verification / structured-exchange product contract; D37-L, D75-L, D108-L.
- `memory/PLAN.md` — closed `exchange-presentation` and `capture-ingest-throughline` arcs.
- `src/agents/contexts/exchanges/TOPOLOGY.md` — model-facing exchange formatter ownership.
- `src/agents/contexts/exchanges/render-honesty.ts` — current render oracle.

### Boundary Crossings

```pseudo
exchange details object
→ render formatter
→ render-honesty oracle
→ formatter tests / snapshots
```

### Risks and Assumptions

- RISK: requiring exact raw multi-paragraph text will re-break legitimate indentation/blockquote formatting.
  → MITIGATION: normalize whitespace and require ordered/contiguous ownership, or require an explicit representation for the path.
- ASSUMPTION (validated 2026-07-06): the oracle function `missingRenderedDetailsLeaves` is imported only by tests; runtime formatters import only the `RenderElision` type and elision constants from this module, so the fix has no runtime blast radius.
  → VALIDATE: focused test fixture that previously false-passed now fails.

### Acceptance Criteria

✓ `src/agents/contexts/exchanges/__tests__/*honesty*` or a new focused test — a missing multi-line leaf whose lines appear elsewhere is reported missing.
✓ Existing formatter honesty tests still pass without reintroducing broad path-specific representation overrides.

### Verification Approach

- Inner: focused render-honesty unit test plus existing exchange formatter tests.
- Gate: `npm run fix`; `npm run verify` before commit.

### Cross-cutting obligations

- Do not weaken the render oracle into arbitrary prose/path sentinels.
- Keep formatter-specific elisions explicit and path-owned.

### Expected touched paths (tentative)

```pseudo
src/agents/contexts/exchanges/
├── render-honesty.ts                         ~
└── __tests__/
    └── <render-honesty-or-formatter-test>.ts ~
```

## Card 2 — enforce nonblank digest carriers at the schema boundary

Status: done
Weight: full

### Target Behavior

Digest abstracts and accepted digest echoes are rejected at the boundary when blank or whitespace-only.

### Full-card cold-start reads

- `memory/SPEC.md` — D106-L, D110-L, I57-L digest accepted-terminal contract.
- `memory/PLAN.md` — `present-digest` closure notes.
- `src/exchanges/schemas/TOPOLOGY.md` — digest and request-review schema ownership.
- `src/exchanges/TOPOLOGY.md` — exchange family contract.

### Boundary Crossings

```pseudo
present_digest params/details
→ zDigestMaterial
→ pending exchange reconstruction
→ request_review terminal details
→ capture sweep accepted_abstract carrier
```

### Risks and Assumptions

- RISK: fixing only `present_digest` params leaves projection-built request details able to carry blank `accepted_abstract`.
  → MITIGATION: use one shared nonblank markdown/carrier schema in both present and request schemas; update projection tests too.
- NOTE (verified 2026-07-06): no shared nonblank helper exists yet — `shared.ts` has only inline `z.string().min(1)` uses. Create a trim-based `zNonBlankMarkdown` (`.min(1)` admits whitespace-only); the in-file precedent for the pattern is the `request_changes` comment refine at `request.ts:272-274`.
- RISK: `pendingExchangeFromStructuredPresent` (`pending-exchange.ts:116-127`) returns its object without re-parsing, so a blank abstract bypasses the pending schema's `zNonBlankString` guard on exactly the digest path.
  → MITIGATION: cover the structured-present branch explicitly — either re-parse through the pending schema or prove the upstream present schema rejects blank first.
- ASSUMPTION: blank digest material has no valid legacy meaning in this pre-release posture.
  → VALIDATE: schema tests reject blank/whitespace carriers.
- NOTE: the same blank-`zMarkdown` pattern exists on other required carriers — candidate rubric fields (`present.ts:178-188`), `zPresentOption.content` (`present.ts:22-28`), `zAnsweredOptionEcho.content` (`request.ts:57-63`). Out of scope here; named sweep candidates once the shared helper exists.
- SEQUENCING: build this card before Card 3 — Card 3's mitigation (parse built values through the tightened schema) depends on the nonblank schema landing first.

### Acceptance Criteria

✓ `src/exchanges/schemas/__tests__/present.test.ts` or `params.test.ts` — `present_digest.digest.abstract` rejects `''` and whitespace-only strings.
✓ `src/exchanges/schemas/__tests__/request.test.ts` — digest review approval rejects blank/whitespace `answered.accepted_abstract`.
✓ Pending exchange reconstruction continues to accept valid digest abstracts and preserves them unchanged except intentional trimming where already documented.
✓ A blank digest abstract cannot reach `digestAbstract` via `pendingExchangeFromStructuredPresent` — the structured-present branch is tested explicitly (it currently returns unparsed).

### Verification Approach

- Inner: schema tests and present-digest projection tests.
- Gate: `npm run fix`; `npm run verify` before commit.

### Cross-cutting obligations

- No compatibility shim accepting both blank and nonblank forms; this is pre-release boundary validation.
- Keep `accepted_abstract` as the sole sweep-visible digest carrier.

### Expected touched paths (tentative)

```pseudo
src/exchanges/schemas/
├── shared.ts                         ~
├── present.ts                        ~
├── request.ts                        ~
└── __tests__/
    ├── present.test.ts               ~
    ├── params.test.ts ?
    └── request.test.ts               ~
src/session/structured-exchange-loop/pending-exchange.ts ?
src/exchanges/projections/__tests__/present-digest.test.ts ?
```

## Card 3 — make request-review projection inputs match terminal schema states

Status: next
Weight: full

### Target Behavior

`projectRequestReview` cannot construct a `request_changes` terminal without a required nonblank comment.

### Full-card cold-start reads

- `memory/SPEC.md` — D37-L, D106-L, D110-L; request/review terminal contract.
- `src/exchanges/schemas/TOPOLOGY.md` — `request_review` comment requirement.
- `src/exchanges/projections/request-response/review.ts` — projection builder.
- `src/.pi/extensions/exchanges/shared/review-source.ts` — TUI caller.

### Boundary Crossings

```pseudo
TUI/RPC review decision
→ projectRequestReview input type
→ RequestReviewDetails schema shape
→ session projection / capture sweep
```

### Risks and Assumptions

- RISK: casts hide projection/schema divergence after the type is corrected.
  → MITIGATION: remove unnecessary `as RequestReviewDetails` casts where feasible or parse/assert the built value through the schema in tests.
- ASSUMPTION (validated 2026-07-06): all current `request_changes` callers already collect a comment before projection — `review-source.ts:60-62` re-prompts via `collectRequiredInput`, `accepted-response.ts:150-156` rejects blank comments explicitly, and the dev fixture passes a literal. This is a latent type hole, not a live bug: expect type-tightening plus test-caller fallout only.
  → VALIDATE: compile plus focused review-source/projection tests.
- SEQUENCING: build after Card 2 — parse built values through the tightened nonblank schema, as this card's own mitigation suggests.

### Acceptance Criteria

✓ `src/exchanges/projections/request-response/review.ts` — the `request_changes` input arm requires `comment: string` and does not use `comment ?? ''`.
✓ Tests prove request-changes projection includes the supplied comment and no schema-invalid fallback path remains.
✓ Existing review-set and digest approve/reject terminal paths still project correctly.

### Verification Approach

- Inner: projection unit tests and schema tests.
- Gate: `npm run fix` (type-aware lint catches invalid callers); `npm run verify` before commit.

### Cross-cutting obligations

- Keep review-set and digest review sharing one projection surface only where their terminal contracts truly match.
- Do not add a second nested model for review terminals.

### Expected touched paths (tentative)

```pseudo
src/exchanges/projections/request-response/
├── review.ts                 ~
└── <review test>.ts ?
src/.pi/extensions/exchanges/shared/review-source.ts ?
src/exchanges/projections/__tests__/present-digest.test.ts ?
src/exchanges/schemas/__tests__/request.test.ts ?
```

## Card 4 — distinguish required-input capability gaps from user cancellation

Status: next
Weight: full

### Target Behavior

Required follow-up input reports `unavailable` when the UI lacks an input capability and `cancelled` only when the user dismisses an available prompt.

### Full-card cold-start reads

- `memory/SPEC.md` — structured-exchange response semantics and high-stakes boundary validation.
- `memory/PLAN.md` — `exchange-answering-chrome` closure notes; pi 0.80.x hasUI-first obligation.
- `HANDOFF.md` — pi 0.80.x UI stub hazards and answer collector notes.
- `src/.pi/extensions/exchanges/TOPOLOGY.md` — answering-surface precedence.

### Boundary Crossings

```pseudo
choice / choices / review collector
→ collectRequiredInput
→ projectRequestChoice / Choices / Review terminal
→ tool result terminate policy
```

### Risks and Assumptions

- RISK: returning a new status union from `collectRequiredInput` creates churn in all callers.
  → MITIGATION: update all call sites together — five sites across the three caller files (`choice-source.ts:107,114`, `choices-editor.ts:135,147`, `review-source.ts:62`); keep the helper tiny and explicit.
- NOTE (verified 2026-07-06): no schema work needed — the `unavailable` terminal already exists in every request family (`zUnavailableOutcome`, `request.ts:26-37`), in the projection input unions, in the terminal helpers, and in `REQUEST_OUTCOME_KEYS`. `answer-source.ts` already implements the exact split (`unavailable` when no capability path exists, `cancelled` only on user dismissal of an available prompt) — copy the house pattern.
- BEHAVIORAL CHOICE (confirm during build): mapping the capability gap to `unavailable` *without* `terminate: true` changes observable turn flow — the current code terminates in both cases. Verify the non-terminating choice matches how the existing non-interactive `unavailable` paths behave before landing.
- ASSUMPTION: missing `ctx.ui.input` is a capability gap even when `ctx.hasUI` is true (pi 0.80.x stub/partial UI contexts).
  → VALIDATE: tests for missing input on Other / None-required comment / review request-changes paths.

### Acceptance Criteria

✓ `src/.pi/extensions/exchanges/shared/required-input.ts` returns distinct outcomes for answered, cancelled, and unavailable.
✓ `choice-source.ts`, `choices-editor.ts`, and `review-source.ts` map unavailable required input to `unavailable` terminal without `terminate: true`.
✓ Tests cover at least one single-select and one review required-input path with `ctx.ui.input` absent.

### Verification Approach

- Inner: exchange extension tests in `src/.pi/extensions/__tests__/exchanges-present-request.test.ts` or focused helper tests.
- Gate: `npm run fix`; `npm run verify` before commit.

### Cross-cutting obligations

- Preserve user dismissal semantics: an available prompt dismissed by the user remains `cancelled` and terminates the turn.
- Preserve hasUI-first checks; do not gate on method shape alone for primary response surfaces.

### Expected touched paths (tentative)

```pseudo
src/.pi/extensions/exchanges/shared/
├── required-input.ts      ~
├── choice-source.ts       ~
├── choices-editor.ts      ~
└── review-source.ts       ~
src/.pi/extensions/__tests__/exchanges-present-request.test.ts ~
```
