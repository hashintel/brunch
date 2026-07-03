# Close the present_candidates ledger row

Frontier: exchange-rendering
Status:   active
Mode:     single
Created:  2026-07-03

Posture: earned (inherited from exchange-rendering). Closure move: locks the last present-family renderer and flips its ledger row to built.

## Light scope card

### Objective

Close the `present_candidates` row of the exchange-rendering sweep: the persisted `content` formatter renders every populated details leaf honestly (or elides by named rule), the tuple golden covers candidates → choice with provenance, and a `dev:components` preview entry exists.

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L (renderResult = Markdown pass-through), D105-L/D106-L (content grammar + option echo), D108-L (src/exchanges/ consolidation); §Design Notes "Exchange-presentation oracle design"
- memory/PLAN.md    — frontier: exchange-rendering
- memory/cards/exchange-rendering--sweep.md — ledger row "present_candidates" + §Verification + §Cross-cutting obligations
- src/agents/contexts/exchanges/TOPOLOGY.md — formatter home + dual-audience rule
```

### Work notes

- Formatter exists (`formatPresentCandidates`, rubric table via `userRubricRows`); the row is `partial`, not empty. The remaining work is verification + preview, plus one micro-decision.
- **Micro-decision (fill-time, content-side only):** keep the per-candidate rubric as labeled bold lines vs. restructure toward card-like sections. Under D104-L pass-through, this is purely a persisted-`content` (model-facing) choice — decide once, record in the ledger row note. `projectRoundedBox` is available but not obligatory and lives on the renderResult side only.
- Existing tuple golden `src/agents/contexts/exchanges/__snapshots__/candidates-tuples.md` — confirm it covers candidates → choice with provenance; extend rather than duplicate.
- Honesty check: `candidate.user_rubric` values are conditionally rendered (`if (value)`); every populated leaf of `PresentCandidatesProjection.details` must be rendered or appear in a named elision list (follow the `PRESENT_QUESTION_CONTENT_ELISIONS` pattern).

### Acceptance Criteria

```
✓ present-candidates honesty test — every populated details leaf rendered or in the formatter's declared elision list (render-honesty.ts pattern)
✓ candidates-tuples.md golden — candidates content + paired request_response choice (provenance) render in transcript order, snapshots green
✓ dev:components registry entry — present_candidates preview renders from a details fixture
✓ ledger row flipped — memory/cards/exchange-rendering--sweep.md present_candidates → built with fill note
```

### Verification Approach

```
- Inner: tuple golden (content family) — candidates → choice pair
- Middle: render-honesty invariant test for formatPresentCandidates
- Outer: preview-gallery review of the new entry (human aesthetic judgment)
```

### Cross-cutting obligations

- Dual-audience discipline: `content` changes are model-context changes — tier-2 dual-audience probe fires on snapshot diffs.
- Preview-harness parity: changed renderer lands with its `dev:components` entry.
- Boundary rule: never touch `shared/choice-source.ts` / `choices-editor.ts` collection paths.

### Assumption dependency

None — the row builds on locked decisions (D104-L–D106-L, D108-L), no live SPEC assumption gates it.

### Expected touched paths (tentative)

```
src/agents/contexts/exchanges/
├── present-candidates.ts                        ~
├── __tests__/present-candidates.test.ts         ~
├── __snapshots__/candidates-tuples.md           ~
src/dev/component-preview/
├── registry.ts                                  ~
└── exchange-fixtures.ts                         ~
memory/cards/exchange-rendering--sweep.md        ~
```

Note: `src/dev/component-preview/registry.ts` and the sweep ledger are shared write paths with the other two open-row cards — build the three cards sequentially on the frontier branch, not in parallel worktrees.
