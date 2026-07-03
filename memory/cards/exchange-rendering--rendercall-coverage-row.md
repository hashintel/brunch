# Close the renderCall coverage ledger row

Frontier: exchange-rendering
Status:   active
Mode:     single
Created:  2026-07-03

Posture: earned (inherited from exchange-rendering). Closure move: records one rule (`renderCall` stays empty vs. minimal call line) and applies it uniformly across every registered exchange tool, locked by a test.

## Light scope card

### Objective

Decide the `renderCall` rule once — stay empty or render a minimal call line — record it, apply it to every registered exchange tool in `src/.pi/extensions/exchanges/`, and lock the uniformity with one test so a new registration cannot silently diverge.

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L (renderResult = Markdown pass-through; renderCall is the sibling surface), D40-L (tool policy)
- memory/PLAN.md    — frontier: exchange-rendering
- memory/cards/exchange-rendering--sweep.md — ledger row "renderCall coverage"
- src/.pi/extensions/exchanges/TOPOLOGY.md — registration surface + adapter boundary
```

### Work notes

- Current sites: `renderCall` handlers in `present-question.ts`, `present-candidates.ts`, `present-review-set.ts`, `request-response.ts` under `src/.pi/extensions/exchanges/`.
- **Micro-decision (the substance of this row):** the durable user-visible surface is the toolResult, not the call (`present-question.ts` already states this). Choose once between (a) empty render — the call is invisible, the result carries everything — or (b) a minimal one-line call marker for transcript legibility while the tool runs. Record the chosen rule and its rationale in the ledger row note (and a short comment at one registration site); it is presentation-adapter policy, not a SPEC decision, unless the choice changes persisted content.
- Uniformity lock: one test that walks the registered exchange tools and asserts each `renderCall` conforms to the recorded rule, so the family-completeness registry test (later slice) can build on it.

### Acceptance Criteria

```
✓ renderCall rule recorded — ledger row note names the rule and rationale
✓ rule applied per kind — every registered exchange tool's renderCall conforms (no per-kind drift)
✓ uniformity test green — one test asserts conformance across all registrations
✓ ledger row flipped — memory/cards/exchange-rendering--sweep.md renderCall coverage → built with fill note
```

### Verification Approach

```
- Inner: renderCall uniformity test over the registered exchange tools
- Middle: existing snapshot suite stays green (rule must not disturb content/renderResult surfaces)
- Outer: quick TUI spot-check that in-flight exchange calls read sanely
```

### Cross-cutting obligations

- Dual-audience discipline: renderCall is TUI-only; persisted `content` must not change under this row.
- Boundary rule: never touch `shared/choice-source.ts` / `choices-editor.ts` collection paths.

### Assumption dependency

None — pure presentation-adapter policy over settled registrations.

### Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── present-question.ts                          ~
├── present-candidates.ts                        ~
├── present-review-set.ts                        ~
├── request-response.ts                          ~
src/.pi/extensions/__tests__/                    ~   (renderCall uniformity test)
memory/cards/exchange-rendering--sweep.md        ~
```

Note: this card's write paths overlap the `.pi` registration files the other two row cards may brush against, plus the shared sweep ledger — build this card **after** the present_candidates and structural-illegal cards, sequentially on the frontier branch.
