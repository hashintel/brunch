# Witness gap closure — ask runtime-mount battery + candidates supersession probe

Frontier: exchange-ask-refinement
Status:   active
Mode:     slices
Created:  2026-07-08

Orientation:

- Containing seam: the structured-exchange terminal seam (D116-L ask cutover) and its capture read side (D28-L/I57-L sweep semantics).
- Frontier: `exchange-ask-refinement` (FE-1164), built + review-verified; the 2026-07-08 witness audit (`ln-witness`) closed the sweep-classifier regression and the ask render-honesty gap on-branch, leaving two named honest gaps this file closes.
- Volatile state: branch `ln/fe-1164-ask-terminal` awaits tie-off; these slices land on it as verification closure before `gt submit`.
- Main open risk: slice 1's oracle must not re-implement pi's `InteractiveMode` — the boundary is deliberately drawn at Brunch's `ctx.ui.custom` factory wiring; pi's own dialog plumbing stays covered by the pi-bump re-verification checklist and manual walkthroughs.

Posture: proving (inherited from exchange-ask-refinement) — but both slices are closure-shaped: they lock in seam invariants rather than light up new paths. Neither depends on an unretired unknown.

Cross-cutting obligations (frontier-inherited, both slices):

- I57-L: projection and capture consume only accepted terminal payloads; cancelled chains contribute no offer payload.
- Answering-surface standing obligation (SPEC §Design Notes, exchange-presentation): capability guards check `ctx.hasUI` before method shape; interactive awaits bracket with `withWorkingIndicatorHidden`.
- D104-L render-honesty: any new formatter output asserted in these tests reads through `content`, not details-side reconstruction.

---

## Card 1 — Ask runtime-mount contract battery (full card)

### Target Behavior

The registered `ask` tool, executed against a real `ctx.ui.custom` implementation that mounts components into a real pi-tui `TUI` over a VirtualTerminal, renders the question surface and resolves one schema-valid durable toolResult for each collection mode (free text, single-select, multi-select).

### Full-card cold-start reads

```
- memory/SPEC.md   — D116-L, D104-L, I23-L; §Design Notes "Exchange-presentation oracle design"
- memory/PLAN.md    — frontier: exchange-ask-refinement
- docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md — mechanism + coverage matrix + pi-bump checklist (the boundary this card stops at)
- src/.pi/components/__tests__/exchange-answer-editor.harness.test.ts — the VirtualTerminal drive pattern to extend
- src/.pi/extensions/exchanges/ask.ts — the execute() dispatch under test
```

### Boundary Crossings

```
→ registered ask tool definition (createAskTool)
→ tool.execute(params, ctx) with a harness StructuredExchangeUiContext
→ ctx.ui.custom factory → component constructed by ask.ts (editor / decision picker / multi-choice picker)
→ real TUI + VirtualTerminal mount, injected keys
→ onDone → collect path (incl. commentPrompt input rung where declared)
→ ToolResult { content, details } — parsed by zAskDetails
```

### Risks and Assumptions

```
- RISK: pi's TUI needs async render settling (waitForRender) and the harness custom()
  must reproduce pi's focus handoff → MITIGATION: reuse the exchange-answer-editor
  harness pattern (addChild/setFocus/waitForRender), which already proved this.
- RISK: the oracle drifts into re-implementing InteractiveMode → MITIGATION: the harness
  custom() implements only the factory contract (tui, theme, keybindings, done); anything
  beyond that is out of scope by declaration.
- ASSUMPTION: the factory signature Brunch relies on (tui, theme, keybindings, done) is
  stable across pi 0.80.x.
    → IMPACT IF FALSE: battery breaks on pi bumps in the same place the product would
    → VALIDATE: this card's tests become exactly that tripwire; checklist already names it
    → [no new SPEC assumption — covered by A25-L pi-tracking]
```

### Posture check

Closure axes: **locks in** the "ask mounts real UI and resolves one durable result" contract as an executable completion test (invariants axis); **retires** the last automated-coverage hole between component-level proofs and the manual walkthrough (uncertainty axis, in the fixture-vs-real drift class the sweep regression just demonstrated is live).

### Acceptance Criteria

```
✓ ask free-text mount — execute() with harness custom() mounts the answer editor in a real
  TUI; typed input + enter resolves; details parse via zAskDetails with answered.text
✓ ask free-text comment rung — with commentPrompt, the input rung fires after submit and
  the comment lands in answered.comment
✓ ask single-select mount — options render (markdown body + labels visible in viewport);
  arrow + enter resolves answered.choice with the option echo
✓ ask multi-select mount — space-toggles + enter resolve answered.choices; None exclusivity
  honored through the mounted picker
✓ ask escape — esc on each mounted surface resolves the cancelled terminal (terminate: true)
✓ working-indicator bracket — collection awaits run under withWorkingIndicatorHidden
  (spy or contract assertion)
```

### Verification Approach

Oracle design confirmed 2026-07-08 (`ln-oracles` pass; factory boundary, SPEC reconciliation at close, and indicator assertion all user-approved).

```
- Inner/middle pair (combination principle — both halves required per mode):
    viewport render assertion (VirtualTerminal, real pi-tui TUI, injected keys)
      — proves the UI journey: component mounted, body visible, keys routed
    zAskDetails.parse on the resolved result
      — proves the structural half: exactly one schema-valid durable terminal
  Either alone is gameable; together they close the mount-without-resolve and
  resolve-without-mount rivals.
- Negative space: after resolution, exactly one result per execute(); harness
  teardown (finally stop) leaves no orphaned focus/timer.
- Standing-obligation spy: collection awaits bracket with withWorkingIndicatorHidden.
- Outer (deliberate blind spot, not owed here): pi's InteractiveMode custom() plumbing
  beyond the factory boundary — mitigated by the pi-bump re-verification checklist,
  manual walkthroughs (caught F18), and FE-1167's live beats.
  Revisit triggers: a pi bump changing the custom-factory signature, or a walkthrough
  defect this battery should have caught but didn't.
```

**At build close:** add the InteractiveMode-plumbing blind-spot row (reason, mitigation, triggers above) to `memory/SPEC.md` §Acknowledged Blind Spots, and note the mount battery in the exchange-presentation oracle-design entry (§Design Notes).

### Expected touched paths (tentative)

```
src/.pi/extensions/__tests__/
└── ask-runtime-mount.test.ts   +
src/.pi/extensions/exchanges/shared/
└── ui-context.ts               ?   (only if the harness needs an exported context type)
```

---

## Card 2 — present_candidates supersession probe (light card)

### Objective

Close the I57-L named gap: a dedicated regeneration probe proving that for `present_candidates` chains, only the accepted terminal's choice payload enters the capture sweep, and cancelled chains contribute nothing.

### Light-card cold-start reads

```
- memory/SPEC.md   — I57-L (names this exact gap), D28-L, D106-L
- memory/PLAN.md    — frontier: exchange-ask-refinement
- src/probes/__tests__/present-digest-supersession-proof.test.ts — the pattern to mirror,
  including the real-toolName ('ask') discipline from the 2026-07-08 witness audit
```

### Acceptance Criteria

```
✓ regeneration chain — present_candidates offer → cancelled/regenerated offers → accepted
  terminal (toolName 'ask', request_choice details): sweep tail carries only the accepted
  terminal; only its choice/options payload is readable; presents stay excluded
✓ cancelled chain — a candidates chain ending cancelled contributes no offer payload to
  the sweep tail
✓ product-minted leg — acceptedResponseFromParams (mode choice, respondsToPresentTool
  present_candidates) message enters the sweep as the real persisted shape and carries the
  selected candidate
```

### Verification Approach

```
- Middle: differential-by-construction probe over projectCaptureSweepWindow — projection-
  built entries plus one real product-minted acceptedResponseFromParams message, same
  oracle family as the digest supersession proof. Fixtures are constructed from canonical
  projections (D105-L boundary-validated constructors), not captured or hand-authored —
  no JSON drift channel.
- Blind spot (accepted): candidates regeneration as live model conduct — the probe pins
  read semantics ahead of the flow existing. Revisit trigger: candidates regeneration
  becomes a live product flow.
```

**At build close:** remove the "present_candidates chains have no dedicated regeneration probe" sentence from I57-L in `memory/SPEC.md` and cite the new probe file there.

### Cross-cutting obligations

```
- Keep one deliberately legacy-wrapped (request_response) row to pin pre-cutover reads,
  mirroring the digest proof.
```

### Assumption dependency

None — all inputs are current-source projections; no live SPEC assumption gates this.

### Expected touched paths (tentative)

```
src/probes/__tests__/
└── present-candidates-supersession-proof.test.ts   +
memory/SPEC.md                                       ~   (I57-L: remove the named
                                                          candidates-gap sentence at close)
```

### Promotion checklist

All no — stays light. (No requirement change; no new assumption; mirrors an existing decision'd oracle pattern; single seam; familiar seam from this thread.)
