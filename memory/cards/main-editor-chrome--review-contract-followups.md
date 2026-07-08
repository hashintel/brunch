# Review contract follow-ups — canonical theme contract, synthetic toolResult ownership

Frontier: main-editor-chrome
Status:   active
Mode:     slices
Created:  2026-07-08

Orientation:

- Containing seams: the component theme contract (`LabTheme`, `src/.pi/components/tui-lab/`) and the synthetic exchange-message contract (`src/session/structured-exchange-loop/`).
- Frontier: `main-editor-chrome` (FE-1169). Source: 2026-07-08 judo review #2 (range `dd405f67~`), findings 6–7, with low findings 9–10 folded in as while-there rows.
- Shared theme: both fixes adopt a canonical contract instead of a local re-declaration — one deletes casts, the other deletes a hand-built message shape.
- Main open risk: none structural; slice 2 exports a previously private shape and must not change the persisted message bytes.

Posture: earned (closure/canonicalization moves over landed behavior; nothing unknown).

## Slice 1 (light) — candidates renderer joins the canonical theme contract

Status: done

### Objective

`ExchangeCandidatesResultComponent` takes the canonical theme type its sibling components use, deleting the local `ThemeLike` with its `(color: never, …)` signature and the `'accent' as never` cast.

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L (details-backed rendering rule; this card must not change render output)
- memory/PLAN.md    — frontier: main-editor-chrome
- src/.pi/components/exchange-candidates-result.ts — the ThemeLike + casts (lines 7–10, 45)
- src/.pi/components/consult-menu.ts — the sibling pattern (LabTheme, plain theme.fg('accent', …))
```

### Acceptance Criteria

```
✓ boundary — no `never` casts remain in exchange-candidates-result.ts; theme param is LabTheme (or
  the actual pi Theme type, matching how present-candidates.ts renderResult receives it)
✓ exchange-candidates-result.test.ts — rendered output byte-identical (suite stays green unchanged)
✓ while-there — truncatePlain either reuses the width-safe helpers the box already owns (safeLines)
  or gains a one-line comment naming why length-based truncation is acceptable here
```

## Slice 2 (light) — synthetic toolResult message owned beside its call constructor

### Objective

A `syntheticExchangeToolResultMessage` constructor lives in `src/session/structured-exchange-loop/` next to `syntheticExchangeToolCallMessage`, and `/brunch:continue` (`commands/index.ts` `appendRecoveredAskResult`) uses it instead of hand-building the shape inline.

### Light-card cold-start reads

```
- memory/PLAN.md    — frontier: main-editor-chrome
- src/session/structured-exchange-loop/synthetic-tool-call.ts — the call-half constructor + exchangeToolCallId
- src/session/structured-exchange-loop/accepted-response.ts — toolResultMessageBase (the private
  canonical shape; converge, don't create a third copy)
- src/.pi/extensions/commands/index.ts — appendRecoveredAskResult (≈393–411)
```

### Acceptance Criteria

```
✓ contract — the toolResult shape (role/toolCallId via exchangeToolCallId/isError/timestamp: 0) is
  constructed in exactly one module; accepted-response.ts either reuses the new constructor or the
  commit names why its base stays separate
✓ commands-runtime-switch.test.ts — the /brunch:continue synthetic pair is byte-identical (suite
  stays green unchanged)
✓ while-there (finding 9) — adaptOrientationUi (juncture.ts) collapses its duplicated rpc-timeout
  select branches onto selectWithRpcTimeout; registrar/juncture suites stay green
✓ while-there (finding 10) — detectStartupTerminalTheme (pi-settings.ts) gains a ceiling: comment
  naming the COLORFGBG limit and the live-theme-controller upgrade path
```

## Verification Approach

```
- Inner: named component/commands/orientation suites per slice; npm run fix after each edit
- Gate: npm run verify per slice commit
```

## Cross-cutting obligations

```
- Proposal-vocabulary fence (HANDOFF.md §B2): candidates rendering keeps proposal register; no
  acceptance/commit language changes ride along with the theme-contract fix
- B2 will follow the details-rendering pattern; slice 1 leaves details-rendering.ts untouched
```

## Assumption dependency

None — both slices canonicalize existing, tested behavior.

## Expected touched paths (tentative)

```
src/.pi/components/
├── exchange-candidates-result.ts             ~
└── __tests__/exchange-candidates-result.test.ts ?
src/session/structured-exchange-loop/
├── synthetic-tool-call.ts                    ~
└── accepted-response.ts                      ?
src/.pi/extensions/
├── commands/index.ts                         ~
└── session-orientation/juncture.ts           ~
src/app/pi-settings.ts                        ~
```
