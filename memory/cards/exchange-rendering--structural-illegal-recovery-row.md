# Close the STRUCTURAL_ILLEGAL / recovery ledger row

Frontier: exchange-rendering
Status:   active
Mode:     single
Created:  2026-07-03

Posture: earned (inherited from exchange-rendering). Closure move: locks the failure-path render surface with solo goldens; these terminal states rarely occur live, so fixtures are the only reliable oracle.

## Light scope card

### Objective

Close the `STRUCTURAL_ILLEGAL / recovery` row of the exchange-rendering sweep: hand-authored fixtures drive solo goldens (no paired present) for the structural-illegal diagnostic render, and the recovery-recognizer path is covered so a dangling present is rendered/recovered honestly.

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L (Markdown pass-through), D108-L (src/exchanges/ consolidation; recovery.ts home); §Design Notes "Exchange-presentation oracle design"
- memory/PLAN.md    — frontier: exchange-rendering
- memory/cards/exchange-rendering--sweep.md — ledger row "STRUCTURAL_ILLEGAL / recovery" + §Verification
- src/exchanges/TOPOLOGY.md — recovery.ts ownership + dependency direction
```

### Work notes

- Owners: `formatExchangeStructuralIllegal` (`src/agents/contexts/exchanges/present-review-set.ts`) and `src/exchanges/recovery.ts` (`findIncompleteStructuredExchangePresents`).
- Agent-facing but user-visible on failure: the diagnostic render (`# STRUCTURAL_ILLEGAL` + field/message bullets) is what a user sees when a review-set submission is structurally illegal.
- Solo goldens: no request pair exists for these states — golden files stand alone, per the tuple inventory in the sweep's Verification section ("STRUCTURAL_ILLEGAL (solo)").
- Fixtures are hand-authored (construct diagnostics arrays and dangling-present entry sequences directly); do not try to reproduce them through the live loop.
- Recovery leg: assert `findIncompleteStructuredExchangePresents` picks up an unanswered present and skips completed ones, using EntryLike fixtures — this is the recognizer the session loop relies on to re-offer a dangling exchange.

### Acceptance Criteria

```
✓ structural-illegal solo golden — formatExchangeStructuralIllegal renders heading + one bullet per diagnostic; snapshot green
✓ structural-illegal honesty — every populated diagnostics leaf (field, message) appears in the render
✓ recovery recognizer test — dangling present detected, completed exchange excluded (hand-authored EntryLike fixtures)
✓ dev:components entry — structural-illegal diagnostic preview renders from a fixture
✓ ledger row flipped — memory/cards/exchange-rendering--sweep.md STRUCTURAL_ILLEGAL / recovery → built with fill note
```

### Verification Approach

```
- Inner: solo goldens (content family) for structural-illegal; unit test for recovery recognizer
- Middle: render-honesty assertion over the diagnostic formatter
- Outer: preview-gallery review of the diagnostic entry
```

### Cross-cutting obligations

- Dual-audience discipline: the diagnostic `content` is model context too — keep it terse and stable.
- Preview-harness parity: entry in `src/dev/component-preview/registry.ts`.
- Boundary rule: never touch `shared/choice-source.ts` / `choices-editor.ts` collection paths.

### Assumption dependency

None — failure-path rendering over locked schemas (D108-L); no live SPEC assumption gates it.

### Expected touched paths (tentative)

```
src/agents/contexts/exchanges/
├── present-review-set.ts                        ~   (formatExchangeStructuralIllegal, if render changes)
├── __tests__/                                   ~   (structural-illegal + recovery tests)
├── __snapshots__/                               +   (structural-illegal solo golden)
src/exchanges/
└── __tests__/                                   ?   (recovery recognizer test, if homed here instead)
src/dev/component-preview/
├── registry.ts                                  ~
└── exchange-fixtures.ts                         ~
memory/cards/exchange-rendering--sweep.md        ~
```

Note: `src/dev/component-preview/registry.ts` and the sweep ledger are shared write paths with the other two open-row cards — build sequentially on the frontier branch.
