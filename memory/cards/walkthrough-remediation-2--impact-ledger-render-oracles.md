# FE-1187 Impact Ledger absorption + render oracles

Frontier: walkthrough-remediation-2
Status:   active
Mode:     slices
Created:  2026-07-15

Posture: proving (inherited from walkthrough-remediation-2)

- Containing seam: the review-set TUI presentation layer (`ExchangeReviewSetResultComponent`), currently the "card wall" (prototype variant 0); D127-L's human-reviewed default is now locked as the borderless Impact Ledger (prototype variant 4, `#impactLedger`/`#renderBorderlessLedger` in `src/dev/component-preview/review-set-prototype.ts`).
- Frontier item: `walkthrough-remediation-2` (FE-1187), "Next scope" bullet — absorb the human-selected borderless Impact Ledger over the landed terminal/details shape.
- Volatile handoff state: none remaining — `HANDOFF.md` covered the now-closed prototype verdict and oracle design; this card supersedes it for the render-absorption slice.
- Main open risk: the D127-L Intent/Implementation/Assurance/Planning kind-grouping taxonomy and the `obligation` compatibility-label mapping currently exist only inside the throwaway prototype file; landing them in production without a differential/honesty check could silently drop a leaf or misgroup a kind.
- Cross-cutting obligations this sequence must preserve: the dual-audience render split (model-facing `content` vs TUI `renderResult`, this sequence touches only the TUI side); the family-completeness negative-space test (every registered exchange tool keeps formatter + renderResult-from-details + `dev:components` preview entry + snapshot pair); the render-honesty discipline (`src/agents/contexts/exchanges/render-honesty.ts`).

## Card 1 · Absorb the borderless Impact Ledger into the production renderer — `done`

### Target Behavior

`ExchangeReviewSetResultComponent` renders the borderless Impact Ledger (Terms first, then Intent/Implementation/Assurance/Planning in explicit kind order, shared column widths, elided repeated adjacent kinds, dim `refs:` rows, `obligation` fallback label) as the sole production review-set presentation, and the throwaway comparison prototype is retired.

### Full-card cold-start reads

```text
- memory/SPEC.md — D127-L (review concern groups, Term, Evidence, Verification obligation, Review set entries); D104-L, D116-L (details-backed renderer contract); the "Exchange-presentation oracle design" and new "FE-1187 Impact Ledger render oracle design" Design Notes
- memory/PLAN.md — frontier: walkthrough-remediation-2; "Next scope" and "D127-L renderer boundary" bullets
- src/dev/component-preview/review-set-prototype.ts — port `#impactLedger`, `#renderBorderlessLedger`, `#symbolicConnectionsByNode`, `#kindLabel`, `#nodesInReviewGroup`, `REVIEW_GROUPS`, and the kind→group map (currently prototype-only, lines ~260–300, ~396–525)
- src/.pi/components/exchange-review-set-result.ts — current production "card wall" renderer being replaced
- src/.pi/components/__tests__/exchange-review-set-result.test.ts — existing render tests to update
- src/dev/component-preview/registry.ts — `review-set-prototype` entry to delete; `present-review-set` entry's fixture stays
```

### Boundary Crossings

```text
→ present_review_set structured-exchange details (PresentReviewSetDetails, unchanged)
→ ExchangeReviewSetResultComponent.render(width) (rewritten body)
→ table@6.9.0 borderless layout (word-wrap, void border, aligned columns)
→ pi-tui Component render contract (unchanged interface)
→ src/dev/component-preview/registry.ts (prototype entry removed)
```

### Risks and Assumptions

```text
- RISK: the ported kind→group map or `obligation` label mapping drifts from the prototype's exact behavior during the port
  → MITIGATION: card 2/3's oracles (word-wrap-tolerant render-honesty, differential extractor) land against this renderer immediately after; do not consider this card done until at least one of them is green
- ASSUMPTION: no other call site depends on the retired "card wall" layout's exact text (e.g. a golden snapshot elsewhere, or a probe assertion)
  → IMPACT IF FALSE: a snapshot/probe update ships alongside this card instead of being a surprise later
  → VALIDATE: `rg` for `ExchangeReviewSetResultComponent` call sites and existing snapshot files before rewriting; update every snapshot this card's diff invalidates
```

### Posture check

Proving posture. Scores on **proof of life** (the locked review shape becomes the live production render path for the first time) and **invariants** (locates/stabilizes the review-set render seam that the R8–R10 conduct/settlement oracles sit downstream of).

### Acceptance Criteria

```text
✓ src/.pi/components/__tests__/exchange-review-set-result.test.ts — updated snapshot(s) show Terms-first, kind-ordered, elided-adjacent-kind, aligned-column, dim-refs-row output at narrow and wide widths
✓ npm run test — src/.pi/extensions/exchanges/__tests__/exchange-renderer-inventory.test.ts stays green (or its present_review_set tuple golden is updated deliberately, not incidentally)
✓ src/dev/component-preview/registry.ts — `review-set-prototype` entry and src/dev/component-preview/review-set-prototype.ts no longer exist; `present-review-set` entry renders the new production component unchanged (already wired at registry.ts:538-547)
✓ npm run verify — lint/format/test/build all pass
```

### Verification Approach

```text
- Inner: golden/inline snapshot(s) on `ExchangeReviewSetResultComponent` at 2–3 widths (narrow/normal/wide); type-aware lint
- Middle: existing `exchange-renderer-inventory.test.ts` family-completeness negative space stays green
- Outer: none owned by this card — the one normal-width human walkthrough is already named under the FE-1187 R8–R10 frontier annotation and fires after cards 2–4 land
```

### Cross-cutting obligations

```text
- Model-facing `content` (src/agents/contexts/exchanges/present-review-set.ts, formatPresentReviewSet) is out of scope — this card touches the TUI renderResult family only
- Do not silently drop the exact-payload inspection affordance or the one-whole-set control surface named in D127-L's Review set entry
```

### Expected touched paths (tentative)

```text
src/.pi/components/
├── exchange-review-set-result.ts        ~
└── __tests__/
    └── exchange-review-set-result.test.ts ~
src/dev/component-preview/
├── review-set-prototype.ts              -
└── registry.ts                          ~
src/.pi/extensions/exchanges/__tests__/
└── exchange-renderer-inventory.test.ts  ~?
```

### Completion evidence

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Golden snapshots show Terms-first ordering, explicit concern/kind order, adjacent-kind elision, aligned columns, dim `refs:` rows, and narrow/wide wrapping | met | `src/.pi/components/__tests__/exchange-review-set-result.test.ts`; narrow/normal/wide snapshots in `__snapshots__/exchange-review-set-result.test.ts.snap` |
| Family-completeness inventory remains green | met | `npx vitest run src/.pi/components/__tests__/exchange-review-set-result.test.ts src/agents/contexts/exchanges/__tests__/exchange-renderer-inventory.test.ts` (2 files, 3 tests passed) |
| Prototype entry/file retired; production `present-review-set` preview wiring preserved | met | `src/dev/component-preview/review-set-prototype.ts` deleted; registry entry removed while `present-review-set` remains unchanged |
| Full verification gate | met | `npm run verify` (265 files passed, 1 skipped; 2104 tests passed, 2 skipped; build passed) |
| Preserve model-facing content and whole-set settlement surface | met | No model formatter, schema, settlement command, or picker path changed; production change is confined to details-backed TUI rendering |
| Reconcile topology after replacing proposal-card presentation | met-with-divergence | `src/.pi/extensions/exchanges/TOPOLOGY.md` updated; `src/.pi/extensions/__tests__/exchanges-present-request.test.ts` assertions deliberately updated because the gate exposed card-wall text coupling outside the tentative path list |

Skipped-test-count delta vs parent: **0** (2 skipped tests; 1 skipped file before and after).

Card 1's golden structural oracle is green. The stronger independent wrap-honesty and differential oracles remain explicitly queued as Cards 2–3; the Card 1-only delegation stops here.

## Card 2 · Word-wrap-tolerant render-honesty — `next`

### Objective

`missingRenderedDetailsLeaves` no longer false-passes a leaf whose value was split across `table`'s word-wrapped physical output lines, and the review-set details honesty test exercises this against the new Impact Ledger renderer.

### Light-card cold-start reads

```text
- memory/SPEC.md — "FE-1187 Impact Ledger render oracle design" Design Note; "Exchange-presentation oracle design" (render-honesty invariant, item 2)
- memory/PLAN.md — frontier: walkthrough-remediation-2
```

### Acceptance Criteria

```text
✓ src/agents/contexts/exchanges/__tests__/render-honesty.test.ts — new case: a long value that `table` word-wraps across 2+ physical lines is recognized as rendered
✓ src/agents/contexts/exchanges/__tests__/present-review-set.test.ts (or a sibling honesty test) — every populated leaf in a long-content review-set fixture is either rendered or declared elided against the new Impact Ledger output
```

### Verification Approach

```text
- Inner: vitest unit tests on `missingRenderedDetailsLeaves` directly, plus the review-set honesty test above
```

### Cross-cutting obligations

```text
- Preserve the existing declared-elision-list philosophy (elision means intent, not accidental drop) — do not weaken it while adding wrap tolerance
```

### Assumption dependency

`None` — this extends an already-landed, already-tested invariant helper with one additional tolerance rule; no live `memory/SPEC.md` §Assumptions is implicated.

### Expected touched paths (tentative)

```text
src/agents/contexts/exchanges/
├── render-honesty.ts                          ~
└── __tests__/
    ├── render-honesty.test.ts                 ~
    └── present-review-set.test.ts              ~?
```

### Promotion checklist

All no — bounded extension of an existing helper inside a settled seam, no requirement/decision/invariant change.

## Card 3 · Differential reference-extractor test — `next`

### Objective

A deliberately naive reference extractor (flat node/edge/term inventory, no styling or grouping) is compared against the Impact Ledger's code/connection inventory over the witnessed fixture plus hand-authored edge fixtures, proving inventory completeness independent of the renderer's own grouping logic.

### Light-card cold-start reads

```text
- memory/SPEC.md — "FE-1187 Impact Ledger render oracle design" Design Note
- memory/PLAN.md — frontier: walkthrough-remediation-2; Verification (Impact Ledger render, D127-L) line
- src/dev/component-preview/exchange-fixtures.ts — presentReviewSetFixture, the existing witnessed 17-node/11-edge fixture
```

### Acceptance Criteria

```text
✓ new differential test file — naive extractor's node/edge/refs inventory over presentReviewSetFixture equals the Impact Ledger's own inventory (same codes, same connection counts)
✓ same test — hand-authored edge fixtures (empty group, single-node group, term-only group, max-refs group) each pass the same differential check
```

### Verification Approach

```text
- Inner: vitest unit test, deterministic fixtures, no LLM in the loop
```

### Cross-cutting obligations

```text
- Keep the reference extractor deliberately dumb (flat list, no styling) — its value is independence from the renderer's own logic, not sophistication
```

### Assumption dependency

`None`.

### Expected touched paths (tentative)

```text
src/.pi/components/__tests__/
└── exchange-review-set-result-differential.test.ts +
src/dev/component-preview/
└── exchange-fixtures.ts ~?  (only if edge-case fixtures are added here rather than inlined in the new test)
```

### Promotion checklist

All no.

## Card 4 · Content-length variant gallery — `next`

### Objective

A dev-only `src/dev/component-preview/` registry entry cycles through deterministic content-length permutations of the witnessed review-set fixture (all-short, all-long, alternating, one long outlier among short entries, term-heavy vs. connection-heavy) rendered through the real Impact Ledger component at real terminal height, giving the FE-1187 outer-loop walkthrough a repeatable stress surface — no `fast-check`, no new dependency.

### Light-card cold-start reads

```text
- memory/SPEC.md — "FE-1187 Impact Ledger render oracle design" Design Note (explicit fast-check rejection + rationale); "FE-1187 Impact Ledger content-length legibility" blind spot
- memory/PLAN.md — frontier: walkthrough-remediation-2; Verification (Impact Ledger render, D127-L) line
- src/dev/component-preview/registry.ts — `manySpecsWorkspaceInventory` / `workspace-dialog-scroll` precedent for the generator + cycling pattern
```

### Acceptance Criteria

```text
✓ new registry entry — cycling next/prev (same convention as ComponentGalleryComponent up/down) through named content-length variants of the Impact Ledger, each rendered at real width/height
✓ npm run dev:components — the entry is reachable and each variant renders without throwing
```

### Verification Approach

```text
- Inner: type-aware lint; the entry must render without throwing across all named variants (a quick smoke test is acceptable, but this tool's actual value is human-judged)
- Outer: this tool is itself outer-loop tooling — no automated legibility gate is expected or wanted (see the SPEC blind-spot entry)
```

### Cross-cutting obligations

```text
- Deterministic permutations only, no randomness — a bad variant must be nameable and reproducible, not a shrinkable property
```

### Assumption dependency

`None`.

### Expected touched paths (tentative)

```text
src/dev/component-preview/
├── review-set-content-variants.ts +  (or a similarly named new file; generator + variant list)
└── registry.ts                     ~
```

### Promotion checklist

All no.
