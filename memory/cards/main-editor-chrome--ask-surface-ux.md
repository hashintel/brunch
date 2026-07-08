# Ask surface UX — option sub-text, hierarchical esc, compact result content

Frontier: main-editor-chrome
Status:   active
Mode:     slices
Created:  2026-07-08

Orientation:

- Containing seam: the unified ask collection flow (`src/.pi/extensions/exchanges/ask.ts`) and its picker components (`exchange-decision-picker`, `multi-choice-picker`), plus the content formatter (`src/agents/contexts/exchanges/ask.ts`).
- Frontier: `main-editor-chrome` (FE-1169) thread 2 of six. Grill-settled 2026-07-08; no open design questions.
- Ordering: this file lands **before** `main-editor-chrome--details-driven-rendering.md` (both churn exchange content/goldens; grill adjacency note). Card 3 here rewrites content goldens once; the rendering file must not re-churn them.
- Main open risk: hierarchical esc requires re-presenting the picker after a nested back-out — the collection flow becomes a small state loop instead of a straight line.

Posture: proving (inherited from main-editor-chrome).

Confirmed code facts (2026-07-08): `choicesFromParams` (ask.ts) maps options to `{id, label}` only — `description` never reaches the pickers; nested `collectRequiredInput` / optional-comment cancels currently return `terminal(..., 'cancelled')`, killing the whole ask.

---

## Card 1 (light) — two-line option rows restore description sub-text · status: next

### Objective

Picker option rows render the option's description/rationale as a second dimmed line under the label, in both the decision picker and the multi-choice picker, fed from ask params (and declared continuation payloads) that currently drop it.

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L (content still canonical), D106-L (echo self-containment)
- memory/PLAN.md    — frontier: main-editor-chrome, thread 2
- src/.pi/components/exchange-decision-picker.ts + multi-choice-picker.ts — current row rendering
- src/.pi/extensions/exchanges/ask.ts — choicesFromParams (the drop point)
```

### Acceptance Criteria

```
✓ exchange-decision-picker.test.ts — a choice with a description renders a second dimmed line;
  without one renders single-line (no blank second row)
✓ multi-choice-picker.test.ts — same two-line contract, checkbox column aligned across both lines
✓ exchanges-extension.test.ts (or ask collection suite) — choicesFromParams carries description through
  to picker choices for standalone options and declared continuation options
✓ scroll behavior: long two-line lists page correctly through projectScrollViewport —
  scroll-viewport.test.ts extension or picker harness test
✓ dev:components preview entries for both pickers show a mixed list (with/without descriptions)
```

### Verification Approach

```
- Inner: component direct tests + picker harness tests
- Outer: dev:components visual check (rides the frontier's running gallery obligation)
```

### Cross-cutting obligations

```
- The two-line row is the same affordance the consult menu (commands-and-menus file, Card 2) will
  reuse — keep the row projection reusable at the component level, not inlined per picker
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/components/
├── exchange-decision-picker.ts               ~
├── multi-choice-picker.ts                    ~
└── __tests__/ (both suites + harness)        ~
src/.pi/extensions/exchanges/ask.ts           ~  (choicesFromParams shape)
src/dev/component-preview/registry.ts         ~  (mixed-description preview data)
```

---

## Card 2 (full) — hierarchical esc: root cancels, nested steps go back · status: pending (after Card 1)

### Target Behavior

Pressing esc inside a nested ask step (the Other free-text editor, or a comment prompt) returns the user to the picker with prior selection state intact, while esc at the picker root still resolves the ask as `cancelled`.

### Full-card cold-start reads

```
- memory/SPEC.md   — D109-L (esc-inert precedent for orientation menus — deliberately NOT adopted
  here; root esc stays terminal), D106-L
- memory/PLAN.md    — frontier: main-editor-chrome, thread 2 (esc dynamics)
- src/.pi/extensions/exchanges/ask.ts — collectChoice / collectMultiChoice / collectRequiredInput flow
- src/.pi/extensions/exchanges/shared/required-input.ts — nested step status shape
```

### Boundary Crossings

```
→ picker component onDone (root selection or root esc)
→ ask.ts collection loop (new: re-enter picker on nested back-out instead of terminal cancel)
→ nested collectors (Other editor, comment input) — esc maps to a distinct 'back' outcome, not 'cancelled'
→ projectAsk terminal only from root esc / completion
```

### Risks and Assumptions

```
- RISK: re-presenting a ctx.ui.custom picker after a nested back-out double-mounts or loses focus
  → MITIGATION: loop around the custom() call (one mount per presentation); harness test drives
    picker → Other → esc → picker re-present
- RISK: multi-choice back-out semantics are ambiguous (esc inside the Nth Other of several selections)
  → MITIGATION: back out to the multi-picker with all checkbox state restored; drop only the
    in-progress Other label — assert exactly this in the harness test
- ASSUMPTION: the sealed ctx.ui.editor fallback path can distinguish esc-back from empty-submit
    → IMPACT IF FALSE: fallback path keeps flat cancel semantics; document the divergence in the
      collection comment and the answering-paths doc instead of forcing it
    → VALIDATE: read pi's editor return contract during red phase; cheap
```

### Posture check

Proving. Invariants axis: locates the ask collection loop seam (the same loop `/brunch:continue`
re-entry will use). Uncertainty axis: none load-bearing beyond the fallback nuance above.

### Acceptance Criteria

```
✓ ask collection test (exchanges-extension.test.ts family) — root esc on decision picker → status
  'cancelled', terminate: true (unchanged behavior pinned)
✓ same suite — esc in Other editor → picker re-presented; selecting a listed option then completes
  with status 'answered' (no cancelled result recorded)
✓ same suite — esc in required-comment step → back to picker; esc in optional-comment step → back
  to picker (not skip, not cancel)
✓ multi-choice harness — nested esc restores checkbox state; in-progress Other discarded
✓ ask-runtime-mount.test.ts — registered-ask battery stays green (stop-the-line: runtime mount
  behavior must not regress)
```

### Invariants preserved

```
- Root esc = terminal 'cancelled' with terminate — guarded by: pinned assertion above (deliberate
  divergence from D109-L's inert-esc; the ask is model-initiated, so cancel must end the call)
- Broker/headless paths untouched (no UI = no esc dynamics) — guarded by: existing unavailable-path
  tests in the ask suite
- Comment opt-in semantics (F20: commentPrompt presence gates the step) — guarded by: existing
  comment tests in the ask suite
```

### Verification Approach

```
- Inner: ask collection tests with scripted picker outcomes + component harness tests
- Outer: manual beat — drive single/multi with Other + comment, esc at each depth (rides the
  frontier's walkthrough obligation)
```

### Cross-cutting obligations

```
- The back-out loop is the seam /brunch:continue (commands file, Card 3) re-enters — name the loop
  function exportably, do not inline it
```

### Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── ask.ts                                    ~  (collection loop; nested outcome mapping)
├── shared/required-input.ts                  ~  ('back' outcome distinct from 'cancelled')
└── __tests__ via src/.pi/extensions/__tests__/  ~
src/.pi/components/__tests__/ (picker harnesses) ~
docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md ~  (esc semantics row)
```

---

## Card 3 (light) — compact unified formatAsk result content · status: pending (after Card 2)

### Objective

The durable ask result content replaces its duplicated Question/Answer h2 sections with one compact block — question body once, options as a checklist with the selection marked and non-selected struck — consistent across free-text, single, multi, and comment variants.

### Light-card cold-start reads

```
- memory/SPEC.md   — D106-L (echo must stay self-contained: question + options + answer all present),
  D104-L (content remains the canonical model-facing record)
- memory/PLAN.md    — frontier: main-editor-chrome, thread 2 (compact form sketch in the frontier
  definition; grill example in FE-1169 issue description)
- src/agents/contexts/exchanges/ask.ts — formatAsk + five-branch writer golden
- src/agents/contexts/exchanges/render-honesty.ts + ASK_CONTENT_ELISIONS — elision contract
```

### Acceptance Criteria

```
✓ ask writer golden (agents/contexts/exchanges/__tests__/, five-branch outcome matrix) — regenerated
  to the compact form; every branch still self-contained per D106-L (question, presented options,
  selection, comment all recoverable from content alone)
✓ render-honesty suite — details → content coverage holds under the new form; ASK_CONTENT_ELISIONS
  updated only for genuinely elided fields
✓ exchange-family-completeness.test.ts — formatter/preview/snapshot coverage stays green
✓ capture probes (exchange-capture-contract-proof.test.ts, sweep-watermark.test.ts) — stay green
  (stop-the-line: capture reads details, but a red here means the form change leaked further)
```

### Verification Approach

```
- Inner: writer golden regeneration + render-honesty + family-completeness
- Middle: capture-contract probes as the blast-radius tripwire
```

### Cross-cutting obligations

```
- One golden churn: the details-driven-rendering file must consume this form, not re-shape it
- Strikethrough/checklist syntax must render acceptably through the existing markdown theme —
  verify in dev:components static preview, note any renderer gap for the rendering file
```

### Assumption dependency

None — format-only; capture semantics read details (I57-L), pinned by the named probes.

### Expected touched paths (tentative)

```
src/agents/contexts/exchanges/
├── ask.ts                                    ~
├── render-honesty.ts                         ~  (elision list only if fields change)
├── __snapshots__/                            ~  (regenerated)
└── __tests__/                                ~
```
