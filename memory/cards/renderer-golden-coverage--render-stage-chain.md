# Renderer Golden Coverage Chain

Frontier: renderer-golden-coverage
Status:   active
Mode:     chain
Created:  2026-06-11

## Orientation

- Seam: RENDER-stage reusable lossy text under `src/renderers/` plus the sketch → lock → formalize oracle loop that keeps LLM-facing wording from drifting silently.
- Frontier: `renderer-golden-coverage`, now the next sequenced trio work after `projection-shape-coverage` closed on this branch.
- Current truth in-tree:
  - already locked: `graph/graph-slice`, `graph/node-neighborhood`, `session/runtime-frame`
  - uncovered likely `●`: `session/transcript`, `workspace/workspace-state`, `exchanges/request-*`, `exchanges/present-question`, `exchanges/present-options`, `exchanges/present-review-set`
  - disposition still needs an honest call: `workspace/workspace-context` is named as a consumer seam in `src/session/README.md`, but current code-path grep finds no live caller
  - explicit `○` / topology stubs that should stay out unless their seam activates: `graph/commit-result.ts`, `graph/reconciliation-needs.ts`, `exchanges/present-candidates.ts`
- Known doc drift to retire first:
  - `memory/PLAN.md` previously spoke as if `src/scripts/render-preview.ts` / `npm run render` already existed; they do not.
  - `memory/CROSS_CUT_PLAN.md` still describes file-snapshot locks as net-new even though `graph/` and `session/runtime-frame` now use `toMatchFileSnapshot`.
- Main risk: snapshotting dead or single-owner rows for symmetry, or overbuilding a preview framework before the ledger names exactly which renderers still matter.
- Cross-cutting obligations: preserve D52-L (`renderers/` stays free of adapter/transport imports); keep goldens co-located with renderer tests under `src/renderers/**/__previews__/`; keep `○` stubs untouched; preserve the human eyeball step before lock.

Posture: proving. Card 1 retires authority drift; Cards 2-5 cash the now-legible coverage closures.

## Dependency Sketch

```text
Card 1  renderer ledger + preview-loop authority
  ├─ unlocks Cards 2-5 by making the required rows and sketch path explicit
  └─ may delete/demote workspace-context instead of snapshotting it

Cards 2-5 are independent after Card 1
  ├─ Card 2  workspace rows
  ├─ Card 3  session transcript row
  ├─ Card 4  exchange request-family rows
  └─ Card 5  exchange present-family rows + frontier close
```

## Card 1 - Close the renderer ledger and preview-loop authority

### Objective

Before adding any more goldens, close the authority gap around what counts as a required renderer row and what the actual sketch path is. This card should make later cards mechanical rather than rediscovery-heavy.

### Light-card cold-start reads

- `memory/PLAN.md` — frontier: `renderer-golden-coverage`
- `memory/CROSS_CUT_PLAN.md` — §Renderer feedback loops
- `src/renderers/README.md`
- existing locked tests: `src/renderers/graph/previews.test.ts`, `src/renderers/session/runtime-frame.test.ts`
- `src/session/README.md` — current `workspace-context` consumer claims
- `package.json`

### Acceptance Criteria

✓ `src/renderers/README.md` carries a closed renderer ledger with one row per current renderer, including required/deferred/stub disposition and current oracle status.

✓ The ledger makes an explicit call on `workspace/workspace-context`: keep-and-cover only if it still owns a real consumer seam; otherwise demote or retire it.

✓ `memory/PLAN.md` and any touched cross-cut notes stop claiming a preview harness already exists when it does not.

✓ This card chooses one honest sketch path for the rest of the frontier: either materialize a minimal shared preview harness (`src/scripts/render-preview.ts` + `npm run render`) or explicitly narrow the frontier to test-local preview generation. Later cards should not reopen that choice.

### Out of scope / guardrails

- Do not snapshot every uncovered renderer in this card.
- Do not keep `workspace-context` merely to preserve directory symmetry.
- Do not invent a preview DSL or generalized renderer framework.

### Expected touched paths (tentative)

```text
memory/
├── PLAN.md ~
└── CROSS_CUT_PLAN.md ~?
package.json ~?
src/renderers/
└── README.md ~
src/scripts/
└── render-preview.ts +?
```

## Card 2 - Close the workspace renderer rows honestly

### Objective

Close the `workspace/` rows without pretending both existing files are equally real. `workspace-state` is clearly load-bearing; `workspace-context` needs an explicit keep-or-retire decision before it gets any snapshot surface.

### Light-card cold-start reads

- Card 1 output in `src/renderers/README.md`
- `src/renderers/workspace/workspace-state.ts`
- `src/renderers/workspace/workspace-state.test.ts`
- `src/renderers/workspace/workspace-context.ts`
- `src/session/README.md`
- active callers such as `src/app/brunch.ts`

### Acceptance Criteria

✓ `workspace-state` has co-located preview/golden coverage plus semantic invariants over live status variants and the absence of retired chrome/readiness fields.

✓ If `workspace-context` survives Card 1 as a required row, it gets its own co-located preview/golden over both `cwd_inventory` and `workspace_overview`; if not, it is deleted or demoted and the docs agree.

✓ The renderer ledger marks the workspace rows closed after this card.

### Out of scope / guardrails

- No new workspace projection or adapter layer.
- No reintroduction of retired `phase`, `chatMode`, or persisted readiness concepts.
- Do not widen session read shapes merely to make renderer tests easier.

### Expected touched paths (tentative)

```text
src/renderers/workspace/
├── workspace-state.ts ~?
├── workspace-state.test.ts ~
├── workspace-context.ts ~|-
└── __previews__/ +?
src/renderers/README.md ~
src/session/README.md ~?
src/app/brunch.ts ?
```

## Card 3 - Move transcript markdown locking into renderer home

### Objective

Give `renderers/session/transcript.ts` its own co-located golden and invariants so the renderer home owns transcript wording, while `session/session-transcript.ts` keeps only the wrapper/parsing proof it actually owns.

### Light-card cold-start reads

- Card 1 output in `src/renderers/README.md`
- `src/renderers/session/transcript.ts`
- `src/session/session-transcript.ts`
- `src/session/session-transcript.test.ts`
- `src/projections/session/transcript-context.ts`

### Acceptance Criteria

✓ `src/renderers/session/transcript.ts` has a co-located preview/golden built from a mixed transcript fixture covering user content, assistant text, generic tool results, structured exchange tool results, and omitted non-text blocks.

✓ The renderer-level test owns the text-shape lock; higher-level `session/session-transcript.*` tests keep only wrapper behavior that the renderer test does not prove.

✓ The ledger marks `session/transcript` covered while leaving `session/runtime-frame` as already covered.

### Out of scope / guardrails

- No new transcript projection fields or session-manager behavior changes.
- Do not widen transcript rendering to include thinking/toolCall/image blocks.
- Do not move transcript parsing ownership out of `session/`.

### Expected touched paths (tentative)

```text
src/renderers/session/
├── transcript.ts ~?
├── transcript.test.ts +
└── __previews__/ +
src/session/
├── session-transcript.ts ?
└── session-transcript.test.ts ~
src/renderers/README.md ~
```

## Card 4 - Lock the request-side exchange renderer family

### Objective

Lock the request-response renderers as one family because they all render the same terminal union shape (`cancelled | unavailable | answered`) and share the same failure modes: comment quoting, markdown escaping, and branch-specific copy drift.

### Light-card cold-start reads

- Card 1 output in `src/renderers/README.md`
- `src/renderers/exchanges/request-answer.ts`
- `src/renderers/exchanges/request-choice.ts`
- `src/renderers/exchanges/request-choices.ts`
- `src/renderers/exchanges/request-review.ts`
- corresponding `.pi/extensions/exchanges/request-*.ts` callers

### Acceptance Criteria

✓ `request-answer`, `request-choice`, `request-choices`, and `request-review` each have preview/golden coverage for answered and non-answered branches.

✓ Invariants cover the semantic edges snapshots can hide: cancel/unavailable copy, markdown escaping of labels, and quote-block handling for optional comments.

✓ Tests reuse existing domain DTO shapes and do not become a second schema/persistence test suite.

### Out of scope / guardrails

- No exchange-schema or editor-fallback redesign.
- No `present_candidates` work.
- No candidate-capture or generalized-capture symmetry expansion.

### Expected touched paths (tentative)

```text
src/renderers/exchanges/
├── request-answer.ts ~?
├── request-choice.ts ~?
├── request-choices.ts ~?
├── request-review.ts ~?
├── request-family.test.ts +?
└── __previews__/ +
src/renderers/README.md ~
```

## Card 5 - Lock the present-side exchange renderers and close the frontier

### Objective

Close the remaining exchange prompt-side rows, then reconcile the ledger so `renderer-golden-coverage` can hand off cleanly to `prompt-composition-golden-coverage`.

### Light-card cold-start reads

- Card 1 output in `src/renderers/README.md`
- `src/renderers/exchanges/present-question.ts`
- `src/renderers/exchanges/present-options.ts`
- `src/renderers/exchanges/present-review-set.ts`
- corresponding `src/projections/exchanges/*.ts` sources and current structured-exchange tests

### Acceptance Criteria

✓ `present-question`, `present-options`, and `present-review-set` each have co-located preview/golden coverage plus at least one semantic invariant.

✓ The invariants guard the real failure modes: heading/body composition for question; hidden option-id comment retention plus escaping for options; stable entity/edge draft narration for review-set without raw internal refs bleeding through.

✓ `present-candidates` remains explicit `○` / topology stub unless the active codebase now gives it a real consumer.

✓ Final docs mark every `●` row in `src/renderers/README.md` as covered and every `○` row explicit, so the frontier can advance to `prompt-composition-golden-coverage`.

### Out of scope / guardrails

- No new exchange renderer families.
- No prompt-composition work yet.
- Do not reopen the sketch-path choice settled in Card 1.

### Expected touched paths (tentative)

```text
src/renderers/exchanges/
├── present-question.ts ~?
├── present-options.ts ~?
├── present-review-set.ts ~?
├── present-family.test.ts +?
└── __previews__/ +
src/renderers/README.md ~
memory/PLAN.md ~?
```
